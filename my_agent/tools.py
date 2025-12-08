"""Common tools for storing artifacts and running Playwright CLI tasks."""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

# Resolve project root (parent of my_agent directory)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ROUTES_DIR = PROJECT_ROOT / ".api-tests" / "routes"
TESTS_DIR = PROJECT_ROOT / ".api-tests" / "tests"


def store_routes_snapshot(
    *,
    repo: str,
    routes: List[Dict[str, Any]],
    commit: Optional[str] = None,
    filename: str = "routes.json",
) -> Dict[str, str]:
    """Writes the collected routes to `.api-tests/routes/<filename>`."""
    ROUTES_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"repo": repo, "commit": commit, "routes": routes}

    output_path = ROUTES_DIR / filename
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    return {"status": "success", "path": str(output_path)}


def list_route_snapshots() -> Dict[str, List[str]]:
    """Returns the available route snapshot filenames."""
    ROUTES_DIR.mkdir(parents=True, exist_ok=True)
    snapshots = sorted(
        str(path.name) for path in ROUTES_DIR.glob("*.json") if path.is_file()
    )
    return {"snapshots": snapshots}


def load_route_snapshot(*, filename: str) -> Dict[str, Any]:
    """Loads a specific route snapshot JSON payload."""
    ROUTES_DIR.mkdir(parents=True, exist_ok=True)
    target_path = ROUTES_DIR / filename
    if not target_path.exists():
        raise FileNotFoundError(
            f"Route snapshot '{filename}' not found in {ROUTES_DIR}."
        )
    return json.loads(target_path.read_text(encoding="utf-8"))


def store_playwright_tests(
    *,
    filename: str,
    code: str,
    routes_source: Optional[str] = None,
) -> Dict[str, str]:
    """Persists generated Playwright test code under `.api-tests/tests`."""
    TESTS_DIR.mkdir(parents=True, exist_ok=True)

    output_path = TESTS_DIR / filename
    output_path.write_text(code, encoding="utf-8")

    result: Dict[str, str] = {"status": "success", "path": str(output_path)}
    if routes_source:
        result["routes_source"] = routes_source
    return result


def run_playwright_tests() -> Dict[str, Any]:
    """Execute `npx playwright test` for the generated specs."""

    base_dir = PROJECT_ROOT

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
    config_path = base_dir / "playwright.config.ts"

    if playwright_bin.exists():
        command: List[str] = [str(playwright_bin), "test", "--config", str(config_path)]
    else:
        command = ["npx", "playwright", "test", "--config", str(config_path)]

    env = os.environ.copy()
    env["PATH"] = os.pathsep.join([str(local_bin), env.get("PATH", "")])

    start_time = time.time()
    try:
        process = subprocess.Popen(
            command,
            cwd=str(base_dir),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            shell=(os.name == "nt"),
        )

        stdout_lines: List[str] = []
        assert process.stdout is not None
        for line in process.stdout:
            print(line, end="")
            stdout_lines.append(line)

        exit_code = process.wait()
    except FileNotFoundError as exc:
        return {
            "status": "error",
            "error": (
                "Playwright CLI not found. Ensure `npm install` has been run "
                "and that Playwright binaries are available on PATH."
            ),
            "command": shlex.join(command),
            "exception": str(exc),
        }

    duration = time.time() - start_time
    stdout_text = "".join(stdout_lines)

    return {
        "status": "success" if exit_code == 0 else "failure",
        "exit_code": exit_code,
        "command": shlex.join(command),
        "duration": f"{duration:.2f}s",
        "stdout": stdout_text,
        "report_path": str(base_dir / "playwright-report" / "index.html"),
        "spec_directory": str(spec_root),
        "spec_files": spec_files,
    }
