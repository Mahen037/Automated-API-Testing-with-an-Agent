"""
Helpers for connecting Google ADK agents to the Playwright MCP server via STDIO.
Mirrors the structure of github_mcp.py.
"""

from __future__ import annotations

import os
import shlex
import shutil
import subprocess
from pathlib import Path
import sys
import time
from typing import Any, Dict, List, Optional

from google.adk.tools.mcp_tool import McpToolset, StdioConnectionParams
from mcp import StdioServerParameters


# Default executable and arguments as per the ExecuteAutomation docs
_DEFAULT_COMMAND = "npx"
_DEFAULT_ARGS: List[str] = ["-y", "@executeautomation/playwright-mcp-server"]


class PlaywrightMcpConfigError(RuntimeError):
    """Raised when the Playwright MCP toolset cannot be configured."""


def _resolve_command() -> str:
    """Return the executable used to launch the Playwright MCP server."""
    command = os.getenv("PLAYWRIGHT_MCP_COMMAND", _DEFAULT_COMMAND).strip()
    if not command:
        raise PlaywrightMcpConfigError(
            "PLAYWRIGHT_MCP_COMMAND cannot be empty. "
            "Provide a command or remove the environment override."
        )
    return command


def _resolve_args() -> List[str]:
    """Return the arguments passed to the Playwright MCP server executable."""
    raw_args = os.getenv("PLAYWRIGHT_MCP_ARGS")
    if raw_args is None or not raw_args.strip():
        return list(_DEFAULT_ARGS)
    return shlex.split(raw_args)


def _resolve_server_env() -> Dict[str, str]:
    """Build the environment dictionary passed to the Playwright MCP server."""
    env: Dict[str, str] = {}

    # Optional: forward Playwright environment variables
    # Example: PLAYWRIGHT_MCP_ENV_BROWSER=chromium
    prefix = "PLAYWRIGHT_MCP_ENV_"
    for key, value in os.environ.items():
        if key.startswith(prefix):
            forwarded_key = key.removeprefix(prefix)
            if forwarded_key:
                env[forwarded_key] = value

    # Optional explicit variables supported by Playwright MCP
    # e.g., PLAYWRIGHT_HEADLESS, PLAYWRIGHT_TRACE_DIR, etc.
    headless = os.getenv("PLAYWRIGHT_HEADLESS")
    if headless:
        env["PLAYWRIGHT_HEADLESS"] = headless

    return env


def create_playwright_mcp_toolset(
    *, timeout_seconds: Optional[float] = None, tool_name_prefix: Optional[str] = "playwright_"
) -> McpToolset:
    """Create a configured toolset backed by the Playwright MCP server."""
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
    )


def run_playwright_tests() -> Dict[str, Any]:
    """Execute `npx playwright test` for the generated specs.

    Returns a payload containing the command that was run, exit code, stdio, and
    bookkeeping so an agent can summarize the outcome without parsing stdout.
    """

    base_dir = Path.cwd()
    for parent in [base_dir] + list(base_dir.parents):
        if (parent / "node_modules").exists():
            base_dir = parent
            break

    # Resolve spec directory (default: .api-tests/tests)
    spec_root = base_dir / ".api-tests" / "tests"
    if not spec_root.exists():
        return {
            "status": "error",
            "error": f"Spec directory '{spec_root}' does not exist.",
            "spec_directory": str(spec_root),
        }
    
    spec_files = sorted(
        str(path.relative_to(spec_root)) for path in spec_root.rglob("*.spec.ts") if path.is_file()
    )
    
    local_bin = base_dir / "node_modules" / ".bin"
    playwright_bin = local_bin / ("playwright.cmd" if os.name == "nt" else "playwright")

    # Build the command
    if playwright_bin.exists():
        command: List[str] = [str(playwright_bin), "test", "--config", str(base_dir / "playwright.config.ts")]
    else:
        command: List[str] = ["npx", "playwright", "test", "--config", str(base_dir / "playwright.config.ts")]

    # Extend PATH so local node_modules/.bin is visible
    env = os.environ.copy()
    env["PATH"] += os.pathsep + str(local_bin)

    start_time = time.time()
    try:
        result = subprocess.Popen(
            command,
            cwd=str(base_dir),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            shell=(os.name == "nt"),  # required for Windows .cmd files
        )

        stdout_lines = []
        for line in result.stdout:
            print(line, end="")           # stream live
            stdout_lines.append(line)

        exit_code = result.wait() # Blocks until process exits
        duration = time.time() - start_time
        stdout_text = "".join(stdout_lines)

        print(f"\n[Agent] Playwright finished with exit code {exit_code} in {duration:.2f}s")

    except FileNotFoundError as exc:
        return {
            "status": "error",
            "error": (
                "Playwright CLI not found. Ensure that either "
                "`npm install @playwright/test` has been run or "
                "`playwright` is in your PATH."
            ),
            "command": shlex.join(command),
            "exception": str(exc),
        }

    return {
        "status": "success" if exit_code == 0 else "failure",
        "exit_code": exit_code,
        "command": shlex.join(command),
        "duration": f"{duration:.2f}s",
        "stdout": stdout_text,
        "stderr": "",               # merged into stdout
        "spec_directory": str(spec_root),
        "spec_files": spec_files,
        "report_dir": str(base_dir / "playwright-report"),
    }
