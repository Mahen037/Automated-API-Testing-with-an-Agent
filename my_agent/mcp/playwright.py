"""Helpers for connecting Google ADK agents to the Playwright MCP server via STDIO."""

from __future__ import annotations

import os
import shlex
from typing import Dict, List, Optional

from google.adk.tools.mcp_tool import McpToolset, StdioConnectionParams
from mcp import StdioServerParameters

DEFAULT_COMMAND = "npx"
DEFAULT_ARGS: List[str] = ["-y", "@executeautomation/playwright-mcp-server"]


class PlaywrightMcpConfigError(RuntimeError):
    """Raised when the Playwright MCP toolset cannot be configured."""


def _resolve_command() -> str:
    command = os.getenv("PLAYWRIGHT_MCP_COMMAND", DEFAULT_COMMAND).strip()
    if not command:
        raise PlaywrightMcpConfigError(
            "PLAYWRIGHT_MCP_COMMAND cannot be empty. Provide a command or remove the "
            "environment override."
        )
    return command


def _resolve_args() -> List[str]:
    raw_args = os.getenv("PLAYWRIGHT_MCP_ARGS")
    if raw_args is None or not raw_args.strip():
        return list(DEFAULT_ARGS)
    return shlex.split(raw_args)


def _resolve_server_env() -> Dict[str, str]:
    env: Dict[str, str] = {}

    prefix = "PLAYWRIGHT_MCP_ENV_"
    for key, value in os.environ.items():
        if key.startswith(prefix):
            forwarded_key = key.removeprefix(prefix)
            if forwarded_key:
                env[forwarded_key] = value

    headless = os.getenv("PLAYWRIGHT_HEADLESS")
    if headless:
        env["PLAYWRIGHT_HEADLESS"] = headless

    return env


def create_playwright_mcp_toolset(
    *,
    timeout_seconds: Optional[float] = None,
    tool_name_prefix: Optional[str] = "PLAYWRIGHT",
) -> McpToolset:
    command = _resolve_command()
    args = _resolve_args()
    env = _resolve_server_env()

    timeout = timeout_seconds if timeout_seconds is not None else float(
        os.getenv("PLAYWRIGHT_MCP_TIMEOUT", "20.0")
    )

    connection_params = StdioConnectionParams(
        server_params=StdioServerParameters(command=command, args=args, env=env),
        timeout=timeout,
    )

    return McpToolset(
        connection_params=connection_params,
        tool_name_prefix=tool_name_prefix,
    )
