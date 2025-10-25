"""Helpers for connecting Google ADK agents to the GitHub MCP server."""

from __future__ import annotations

import os
import shlex
from typing import Dict, List

from google.adk.tools.mcp_tool import McpToolset, StdioConnectionParams
from mcp import StdioServerParameters

# Defaults recommended by the Model Context Protocol GitHub server docs.
_DEFAULT_COMMAND = "npx"
_DEFAULT_ARGS: List[str] = ["-y", "@modelcontextprotocol/server-github"]


class GithubMcpConfigError(RuntimeError):
    """Raised when the GitHub MCP toolset cannot be configured."""


def _resolve_command() -> str:
    """Returns the executable used to launch the GitHub MCP server."""
    command = os.getenv("GITHUB_MCP_COMMAND", _DEFAULT_COMMAND).strip()
    if not command:
        raise GithubMcpConfigError(
            "GITHUB_MCP_COMMAND cannot be empty. Provide a command or remove the"
            " environment override."
        )
    return command


def _resolve_args() -> List[str]:
    """Returns the arguments passed to the GitHub MCP server executable."""
    raw_args = os.getenv("GITHUB_MCP_ARGS")
    if raw_args is None or not raw_args.strip():
        return list(_DEFAULT_ARGS)
    return shlex.split(raw_args)


def _resolve_server_env() -> Dict[str, str]:
    """Builds the environment dictionary passed to the GitHub MCP server."""
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise GithubMcpConfigError(
            "Set GITHUB_TOKEN with a GitHub personal access token that has the"
            " repo scope so the MCP server can authenticate."
        )

    env: Dict[str, str] = {"GITHUB_TOKEN": token}

    # Optional overrides understood by @modelcontextprotocol/server-github.
    owner = os.getenv("GITHUB_MCP_OWNER")
    if owner:
        env["GITHUB_OWNER"] = owner

    repository = os.getenv("GITHUB_MCP_REPOSITORY")
    if repository:
        env["GITHUB_REPOSITORY"] = repository

    # Allow passing any additional custom environment variables by setting
    # GITHUB_MCP_ENV_<NAME>=value. The prefix is stripped when forwarded.
    prefix = "GITHUB_MCP_ENV_"
    for key, value in os.environ.items():
        if key.startswith(prefix):
            forwarded_key = key.removeprefix(prefix)
            if forwarded_key:
                env[forwarded_key] = value

    return env


def create_github_mcp_toolset(
    *, timeout_seconds: float | None = None, tool_name_prefix: str | None = "github_"
) -> McpToolset:
    """Creates a configured toolset backed by the GitHub MCP server."""
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
