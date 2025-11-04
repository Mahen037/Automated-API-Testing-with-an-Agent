"""Utility tools for calling the Playwright MCP server over HTTP."""

from __future__ import annotations

import os
from itertools import count
from typing import Any, Dict, Optional

import requests

_DEFAULT_URL = "http://localhost:9222/mcp"
_URL_ENV = "PLAYWRIGHT_MCP_HTTP_URL"
_TIMEOUT_ENV = "PLAYWRIGHT_MCP_HTTP_TIMEOUT"
_REQUEST_ID_COUNTER = count(1)


class PlaywrightMcpHttpError(RuntimeError):
    """Raised when the Playwright MCP HTTP call fails."""


def _resolve_base_url() -> str:
    """Returns the base URL for the Playwright MCP server."""
    url = os.getenv(_URL_ENV, _DEFAULT_URL).strip()
    if not url:
        raise PlaywrightMcpHttpError(
            "PLAYWRIGHT_MCP_HTTP_URL is empty. Provide a valid MCP endpoint."
        )
    return url


def _resolve_timeout() -> float:
    raw = os.getenv(_TIMEOUT_ENV)
    if raw:
        try:
            return float(raw)
        except ValueError as exc:
            raise PlaywrightMcpHttpError(
                f"PLAYWRIGHT_MCP_HTTP_TIMEOUT must be a number, got: {raw!r}"
            ) from exc
    return 30.0


def _call_mcp(method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Sends a JSON-RPC call to the Playwright MCP server."""
    url = _resolve_base_url()
    timeout = _resolve_timeout()
    payload = {
        "jsonrpc": "2.0",
        "id": next(_REQUEST_ID_COUNTER),
        "method": method,
        "params": params or {},
    }

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }

    try:
        response = requests.post(url, json=payload, timeout=timeout)
    except requests.RequestException as exc:
        raise PlaywrightMcpHttpError(
            f"Failed to reach Playwright MCP server at {url}: {exc}"
        ) from exc

    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise PlaywrightMcpHttpError(
            f"Playwright MCP server returned HTTP {response.status_code}: {response.text}"
        ) from exc

    try:
        data = response.json()
    except ValueError as exc:
        raise PlaywrightMcpHttpError(
            f"Playwright MCP server response is not valid JSON: {response.text}"
        ) from exc

    if "error" in data:
        raise PlaywrightMcpHttpError(
            f"MCP error {data['error'].get('code')}: {data['error'].get('message')}"
        )

    result = data.get("result")
    if not isinstance(result, dict):
        raise PlaywrightMcpHttpError(
            f"Unexpected MCP response payload: {data!r}"
        )
    return result


def playwright_list_tools() -> Dict[str, Any]:
    """Lists the tools exposed by the Playwright MCP server."""
    result = _call_mcp("tools/list")
    return {"tools": result.get("tools", [])}


def playwright_call_tool(
    *,
    name: str,
    arguments: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Calls an arbitrary Playwright MCP tool by name."""
    params = {"name": name, "arguments": arguments or {}}
    result = _call_mcp("tools/call", params=params)
    return {"result": result}


def run_playwright_tests(
    *,
    spec: Optional[str] = None,
    config: Optional[str] = None,
    additional_args: Optional[list[str]] = None,
) -> Dict[str, Any]:
    """Executes Playwright tests via the MCP server.

    Args:
        spec: Optional test file globs (forwarded to Playwright).
        config: Optional path to the Playwright config file.
        additional_args: Extra CLI arguments to pass to Playwright.

    Returns:
        The raw result dictionary from the MCP server.
    """
    arguments: Dict[str, Any] = {}
    if spec:
        arguments["spec"] = spec
    if config:
        arguments["config"] = config
    if additional_args:
        arguments["additionalArgs"] = additional_args

    result = _call_mcp(
        "tools/call",
        params={
            "name": "runTests",
            "arguments": arguments,
        },
    )
    return {"result": result}
