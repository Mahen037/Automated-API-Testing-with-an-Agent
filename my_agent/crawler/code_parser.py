"""Efficient structured code parsing for extracting API routes from various frameworks."""

from __future__ import annotations

import ast
import json
import hashlib
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, asdict, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
import time


class HTTPMethod(str, Enum):
    """Supported HTTP methods."""
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"
    PATCH = "PATCH"
    HEAD = "HEAD"
    OPTIONS = "OPTIONS"


@dataclass
class Parameter:
    """Represents a route parameter."""
    name: str
    type_hint: Optional[str] = None
    required: bool = True
    description: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Route:
    """Represents an extracted API route."""
    path: str
    methods: List[HTTPMethod] = field(default_factory=lambda: [HTTPMethod.GET])
    handler_name: Optional[str] = None
    file_path: Optional[str] = None
    line_number: Optional[int] = None
    parameters: List[Parameter] = field(default_factory=list)
    request_body_type: Optional[str] = None
    response_type: Optional[str] = None
    auth_required: bool = False
    description: Optional[str] = None
    decorators: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "path": self.path,
            "methods": [m.value for m in self.methods],
            "handler_name": self.handler_name,
            "file_path": self.file_path,
            "line_number": self.line_number,
            "parameters": [p.to_dict() for p in self.parameters],
            "request_body_type": self.request_body_type,
            "response_type": self.response_type,
            "auth_required": self.auth_required,
            "description": self.description,
            "decorators": self.decorators,
        }


class FastAPIParser(ast.NodeVisitor):
    """Efficient FastAPI route extractor using AST."""
    
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.routes: List[Route] = []
        self.methods_cache = {m.name: m for m in HTTPMethod}
    
    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        """Visit function definitions for route decorators."""
        for decorator in node.decorator_list:
            route = self._extract_from_decorator(decorator, node)
            if route:
                self.routes.append(route)
        self.generic_visit(node)
    
    def _extract_from_decorator(self, dec: ast.expr, func: ast.FunctionDef) -> Optional[Route]:
        """Extract route from @app.method(path) decorator."""
        if not isinstance(dec, ast.Call) or not isinstance(dec.func, ast.Attribute):
            return None
        
        method = dec.func.attr.upper()
        if method not in self.methods_cache:
            return None
        
        if not dec.args or not isinstance(dec.args[0], ast.Constant):
            return None
        
        path = dec.args[0].value
        if not isinstance(path, str):
            return None
        
        auth = self._check_auth(dec, func)
        params = self._extract_params(func)
        
        return Route(
            path=path,
            methods=[self.methods_cache[method]],
            handler_name=func.name,
            file_path=self.file_path,
            line_number=func.lineno,
            parameters=params,
            auth_required=auth,
            description=ast.get_docstring(func),
            decorators=[dec.func.attr],
        )
    
    def _extract_params(self, func: ast.FunctionDef) -> List[Parameter]:
        """Extract parameters from function signature."""
        skip = {"self", "request", "response", "db", "session"}
        params = []
        
        for arg in func.args.args:
            if arg.arg in skip:
                continue
            type_hint = ast.unparse(arg.annotation) if arg.annotation else None
            params.append(Parameter(name=arg.arg, type_hint=type_hint))
        
        return params
    
    def _check_auth(self, dec: ast.Call, func: ast.FunctionDef) -> bool:
        """Check if route requires authentication."""
        for keyword in dec.keywords:
            if keyword.arg == "dependencies":
                return True
        
        func_str = ast.unparse(func).lower()
        return "auth" in func_str or "security" in func_str


class FlaskParser(ast.NodeVisitor):
    """Efficient Flask route extractor using AST."""
    
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.routes: List[Route] = []
        self.methods_cache = {m.name: m for m in HTTPMethod}
    
    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        """Visit function definitions for @app.route decorators."""
        for decorator in node.decorator_list:
            route = self._extract_from_decorator(decorator, node)
            if route:
                self.routes.append(route)
        self.generic_visit(node)
    
    def _extract_from_decorator(self, dec: ast.expr, func: ast.FunctionDef) -> Optional[Route]:
        """Extract route from @app.route(path, methods=[...]) decorator."""
        if not isinstance(dec, ast.Call) or not isinstance(dec.func, ast.Attribute):
            return None
        
        if dec.func.attr != "route":
            return None
        
        if not dec.args or not isinstance(dec.args[0], ast.Constant):
            return None
        
        path = dec.args[0].value
        if not isinstance(path, str):
            return None
        
        methods = self._extract_methods(dec)
        params = self._extract_params(func)
        
        return Route(
            path=path,
            methods=methods,
            handler_name=func.name,
            file_path=self.file_path,
            line_number=func.lineno,
            parameters=params,
            description=ast.get_docstring(func),
            decorators=["route"],
        )
    
    def _extract_methods(self, dec: ast.Call) -> List[HTTPMethod]:
        """Extract HTTP methods from keywords."""
        methods = [HTTPMethod.GET]
        
        for kw in dec.keywords:
            if kw.arg == "methods" and isinstance(kw.value, ast.List):
                extracted = []
                for elt in kw.value.elts:
                    if isinstance(elt, ast.Constant) and isinstance(elt.value, str):
                        m = elt.value.upper()
                        if m in self.methods_cache:
                            extracted.append(self.methods_cache[m])
                if extracted:
                    methods = extracted
        
        return methods
    
    def _extract_params(self, func: ast.FunctionDef) -> List[Parameter]:
        """Extract parameters from function signature."""
        skip = {"self", "request", "response"}
        params = []
        
        for arg in func.args.args:
            if arg.arg not in skip:
                type_hint = ast.unparse(arg.annotation) if arg.annotation else None
                params.append(Parameter(name=arg.arg, type_hint=type_hint))
        
        return params


class ExpressParser:
    """Efficient regex-based Express.js route extractor."""
    
    # Compiled patterns for performance
    ROUTE_PATTERNS = [
        re.compile(r"app\.(get|post|put|delete|patch|head|options)\s*\(\s*['\"]([^'\"]+)['\"]"),
        re.compile(r"router\.(get|post|put|delete|patch|head|options)\s*\(\s*['\"]([^'\"]+)['\"]"),
    ]
    
    AUTH_PATTERN = re.compile(r"(auth|protect|login|jwt|token|verify)", re.IGNORECASE)
    
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.routes: List[Route] = []
    
    def parse(self, content: str) -> List[Route]:
        """Extract routes from content efficiently."""
        for pattern in self.ROUTE_PATTERNS:
            for match in pattern.finditer(content):
                method = match.group(1).upper()
                path = match.group(2)
                
                if method in HTTPMethod.__members__:
                    auth = bool(self.AUTH_PATTERN.search(content[max(0, match.start()-200):match.end()]))
                    self.routes.append(Route(
                        path=path,
                        methods=[HTTPMethod[method]],
                        file_path=self.file_path,
                        auth_required=auth,
                    ))
        
        return self.routes


# Efficient file filtering with compile-once patterns
SKIP_DIRS = {
    "node_modules", ".venv", "venv", "env",
    "build", "dist", "out", ".next",
    "__pycache__", ".pytest_cache", ".mypy_cache",
    ".git", ".github", "migrations", ".idea",
}

PRIORITY_PATTERNS = {
    ".py": ("routes", "controllers", "handlers", "views", "api", "app"),
    ".ts": ("routes", "controllers", "handlers", "api"),
    ".js": ("routes", "controllers", "handlers", "api"),
}


def should_scan_file(file_path: str) -> bool:
    """Determine if file should be scanned (fast-path filtering)."""
    path = Path(file_path)
    
    # Quick directory skip
    for part in path.parts:
        if part in SKIP_DIRS or (part.startswith(".") and part != "."):
            return False
    
    # Check file extension and path keywords
    suffix = path.suffix
    if suffix in PRIORITY_PATTERNS:
        keywords = PRIORITY_PATTERNS[suffix]
        path_lower = str(path).lower()
        return any(kw in path_lower for kw in keywords)
    
    return False


def _hash_content(content: str) -> str:
    """Fast content hash for change detection."""
    return hashlib.md5(content.encode()).hexdigest()


@dataclass
class ParseResult:
    """Result of parsing a single file."""
    file_path: str
    routes: List[Route]
    hash: str
    framework: Optional[str] = None


def parse_file_with_framework(
    file_path: str, content: str, framework: Optional[str] = None
) -> Optional[ParseResult]:
    """Parse single file efficiently."""
    if not content or not should_scan_file(file_path):
        return None
    
    routes = []
    content_hash = _hash_content(content)
    detected_fw = framework
    
    try:
        if file_path.endswith(".py"):
            if not detected_fw:
                detected_fw = "fastapi" if "fastapi" in content.lower() else "flask"
            
            tree = ast.parse(content, filename=file_path)
            
            if detected_fw == "fastapi":
                parser = FastAPIParser(file_path)
            else:
                parser = FlaskParser(file_path)
            
            parser.visit(tree)
            routes = parser.routes
        
        elif file_path.endswith((".ts", ".js")):
            detected_fw = "express"
            parser = ExpressParser(file_path)
            routes = parser.parse(content)
    
    except (SyntaxError, ValueError):
        return None
    
    return ParseResult(
        file_path=file_path,
        routes=routes,
        hash=content_hash,
        framework=detected_fw,
    ) if routes else None


class RouteCacheManager:
    """Efficient caching for parsed routes with incremental updates."""
    
    def __init__(self, cache_dir: str = ".api-tests/.route-cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_file = self.cache_dir / "file_hashes.json"
        self.hashes: Dict[str, str] = self._load_hashes()
    
    def _load_hashes(self) -> Dict[str, str]:
        """Load cached file hashes."""
        if self.cache_file.exists():
            try:
                return json.loads(self.cache_file.read_text())
            except (json.JSONDecodeError, IOError):
                pass
        return {}
    
    def save_hashes(self) -> None:
        """Save file hashes for next run."""
        self.cache_file.write_text(json.dumps(self.hashes, indent=2))
    
    def get_changed_files(self, files: Dict[str, str]) -> Dict[str, str]:
        """Return only files that changed since last parse."""
        changed = {}
        
        for file_path, content in files.items():
            new_hash = _hash_content(content)
            old_hash = self.hashes.get(file_path)
            
            if new_hash != old_hash:
                changed[file_path] = content
                self.hashes[file_path] = new_hash
        
        return changed
    
    def remove_stale(self, current_files: Set[str]) -> None:
        """Clean up hashes for deleted files."""
        to_remove = set(self.hashes.keys()) - current_files
        for f in to_remove:
            del self.hashes[f]


def extract_routes_parallel(
    files: Dict[str, str],
    framework: Optional[str] = None,
    max_workers: int = 4,
    use_cache: bool = True,
) -> Tuple[List[Route], Dict[str, str]]:
    """
    Extract routes from multiple files in parallel with caching.
    
    Args:
        files: Dict of {file_path: content}
        framework: Override framework detection
        max_workers: Number of parallel threads
        use_cache: Enable incremental caching
    
    Returns:
        (routes, metadata) - All routes found and stats
    """
    cache_mgr = RouteCacheManager() if use_cache else None
    
    # Get only changed files if caching enabled
    if cache_mgr:
        files = cache_mgr.get_changed_files(files)
    
    if not files:
        return [], {"status": "no_changes", "routes_count": 0}
    
    all_routes = []
    frameworks = {}
    start = time.time()
    
    # Parallel parsing
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(parse_file_with_framework, fp, content, framework): fp
            for fp, content in files.items()
        }
        
        for future in as_completed(futures):
            result = future.result()
            if result:
                all_routes.extend(result.routes)
                frameworks[result.file_path] = result.framework
    
    # Save cache and return
    if cache_mgr:
        cache_mgr.save_hashes()
    
    metadata = {
        "status": "success",
        "routes_count": len(all_routes),
        "files_scanned": len(files),
        "frameworks_detected": frameworks,
        "duration_seconds": f"{time.time() - start:.2f}",
    }
    
    return all_routes, metadata


def routes_to_json(routes: List[Route]) -> Dict[str, Any]:
    """Convert routes to JSON-serializable format."""
    return {
        "routes": [r.to_dict() for r in routes],
        "total": len(routes),
        "timestamp": time.time(),
    }
