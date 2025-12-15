"""Common tools for storing artifacts and running Playwright CLI tasks."""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from .crawler.code_parser import extract_routes_parallel, routes_to_json

ROUTES_DIR = Path(".api-tests") / "routes"
TESTS_DIR = Path(".api-tests") / "tests"


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



def list_playwright_tests() -> Dict[str, List[str]]:
    """List generated Playwright spec files under `.api-tests/tests`."""
    TESTS_DIR.mkdir(parents=True, exist_ok=True)
    specs = sorted(
        str(path.relative_to(TESTS_DIR))
        for path in TESTS_DIR.rglob("*.spec.ts")
        if path.is_file()
    )
    return {"specs": specs}


def load_playwright_test(*, filename: str) -> Dict[str, Any]:
    """Load a generated Playwright spec file from `.api-tests/tests`."""
    TESTS_DIR.mkdir(parents=True, exist_ok=True)
    target_path = TESTS_DIR / filename
    if not target_path.exists():
        raise FileNotFoundError(f"Spec file '{filename}' not found in {TESTS_DIR}.")
    return {"filename": filename, "code": target_path.read_text(encoding="utf-8")}


def run_playwright_tests() -> Dict[str, Any]:
    """Execute `npx playwright test` for the generated specs."""

    base_dir = Path.cwd()
    for parent in [base_dir] + list(base_dir.parents):
        if (parent / "package.json").exists():
            base_dir = parent
            break

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
def crawl_routes_snapshot(
    *,
    repo: str,
    files_dict: Dict[str, str],  # {file_path: content}
    commit: Optional[str] = None,
) -> Dict[str, Any]:
    """Extract routes efficiently and store snapshot."""
    routes, metadata = extract_routes_parallel(
        files=files_dict,
        use_cache=True,
        max_workers=4,
    )
    
    payload = {
        "repo": repo,
        "commit": commit,
        "routes": [r.to_dict() for r in routes],
        "metadata": metadata,
    }
    
    # Store using existing store_routes_snapshot
    ROUTES_DIR.mkdir(parents=True, exist_ok=True)
    output_path = ROUTES_DIR / f"{repo.replace('/', '_')}_routes.json"
    output_path.write_text(json.dumps(payload, indent=2))
    
    return {
        "status": "success",
        "path": str(output_path),
        "routes_found": len(routes),
        **metadata,
    }
