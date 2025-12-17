"""Helpers for connecting Google ADK agents to the GitHub MCP server."""

from __future__ import annotations

import os
import shlex
from typing import Dict, List

from google.adk.tools.mcp_tool import McpToolset, StdioConnectionParams
from mcp import StdioServerParameters

DEFAULT_COMMAND = "npx"
DEFAULT_ARGS: List[str] = ["-y", "@modelcontextprotocol/server-github"]


class GithubMcpConfigError(RuntimeError):
    """Raised when the GitHub MCP toolset cannot be configured."""


def _resolve_command() -> str:
    command = os.getenv("GITHUB_MCP_COMMAND", DEFAULT_COMMAND).strip()
    if not command:
        raise GithubMcpConfigError(
            "GITHUB_MCP_COMMAND cannot be empty. Provide a command or remove the"
            " environment override."
        )
    return command


def _resolve_args() -> List[str]:
    raw_args = os.getenv("GITHUB_MCP_ARGS")
    if raw_args is None or not raw_args.strip():
        return list(DEFAULT_ARGS)
    return shlex.split(raw_args)


def _resolve_server_env() -> Dict[str, str]:
    # Prefer the env var commonly expected by GitHub MCP setups
    token = (os.getenv("GITHUB_PERSONAL_ACCESS_TOKEN") or os.getenv("GITHUB_TOKEN") or "").strip()
    if not token:
        raise GithubMcpConfigError(
            "Set GITHUB_PERSONAL_ACCESS_TOKEN (preferred) or GITHUB_TOKEN with a GitHub PAT."
        )

    env: Dict[str, str] = {
        "GITHUB_PERSONAL_ACCESS_TOKEN": token,
        "GITHUB_TOKEN": token,  # keep for compatibility
    }

    owner = os.getenv("GITHUB_MCP_OWNER")
    if owner:
        env["GITHUB_OWNER"] = owner

    repository = os.getenv("GITHUB_MCP_REPOSITORY")
    if repository:
        env["GITHUB_REPOSITORY"] = repository

    prefix = "GITHUB_MCP_ENV_"
    for key, value in os.environ.items():
        if key.startswith(prefix):
            forwarded_key = key.removeprefix(prefix)
            if forwarded_key:
                env[forwarded_key] = value

    return env


def create_github_mcp_toolset(
    *, timeout_seconds: float | None = None, tool_name_prefix: str | None = "GITHUB"
) -> McpToolset:
    command = _resolve_command()
    args = _resolve_args()
    env = _resolve_server_env()

    timeout = timeout_seconds if timeout_seconds is not None else float(
        os.getenv("GITHUB_MCP_TIMEOUT", "10.0")
    )

    connection_params = StdioConnectionParams(
        server_params=StdioServerParameters(command=command, args=args, env=env),
        timeout=timeout,
    )

    return McpToolset(
        connection_params=connection_params,
        tool_name_prefix=tool_name_prefix,
    )
