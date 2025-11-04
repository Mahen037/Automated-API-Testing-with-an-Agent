"""Utility tools for persisting extracted API routes locally."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

ROUTES_DIR = Path(".api-tests") / "routes"
TESTS_DIR = Path(".api-tests") / "tests"


def store_routes_snapshot(
    *,
    repo: str,
    routes: List[Dict[str, Any]],
    commit: Optional[str] = None,
    filename: str = "routes.json",
) -> Dict[str, str]:
    """Writes the collected routes to `.api-tests/routes/<filename>`.

    Args:
        repo: Repository identifier or URL the routes came from.
        routes: List of extracted route descriptors.
        commit: Optional commit SHA for traceability.
        filename: Override the output filename (defaults to `routes.json`).

    Returns:
        Metadata about the stored file so the agent can confirm success.
    """
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
    """Persists generated Playwright test code under `.api-tests/tests`.

    Args:
        filename: Output filename (will be written verbatim).
        code: The Playwright test source code to write.
        routes_source: Optional reference to the routes snapshot used.

    Returns:
        Metadata describing where the tests were stored.
    """
    TESTS_DIR.mkdir(parents=True, exist_ok=True)

    output_path = TESTS_DIR / filename
    output_path.write_text(code, encoding="utf-8")

    result: Dict[str, str] = {"status": "success", "path": str(output_path)}
    if routes_source:
        result["routes_source"] = routes_source
    return result
