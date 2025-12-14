"""
Comprehensive test suite for code_parser.py
Run: python -m pytest test_code_parser_simple.py -v
Or directly: python test_code_parser_simple.py
"""

import json
import time
import tempfile
from pathlib import Path
import ast
import sys

# Add project root to path BEFORE importing anything from my_agent
# Path structure: project_root/my_agent/crawler/tests/test_code_parser_simple.py
test_file = Path(__file__).resolve()  # Resolve to absolute path
# tests -> crawler -> my_agent -> project_root
project_root = test_file.parent.parent.parent.parent
sys.path.insert(0, str(project_root))

try:
    # Import only the code_parser module, not the full my_agent package
    # This avoids loading agent.py which has google.adk dependencies
    import importlib.util
    
    code_parser_path = test_file.parent.parent / "code_parser.py"  # tests -> crawler -> code_parser.py
    
    if not code_parser_path.exists():
        raise FileNotFoundError(f"code_parser.py not found at: {code_parser_path}")
    
    spec = importlib.util.spec_from_file_location("code_parser", code_parser_path)
    code_parser = importlib.util.module_from_spec(spec)
    sys.modules['code_parser'] = code_parser
    spec.loader.exec_module(code_parser)
    
    FastAPIParser = code_parser.FastAPIParser
    FlaskParser = code_parser.FlaskParser
    ExpressParser = code_parser.ExpressParser
    HTTPMethod = code_parser.HTTPMethod
    Parameter = code_parser.Parameter
    Route = code_parser.Route
    extract_routes_parallel = code_parser.extract_routes_parallel
    should_scan_file = code_parser.should_scan_file
    _hash_content = code_parser._hash_content
    RouteCacheManager = code_parser.RouteCacheManager
    
except Exception as e:
    print(f"Error importing code_parser: {e}")
    print(f"\nProject root: {project_root}")
    print(f"Expected code_parser.py at: {project_root / 'my_agent' / 'crawler' / 'code_parser.py'}")
    print("\nEnsure you're running from project root:")
    print("  python my_agent/crawler/tests/test_code_parser_simple.py")
    sys.exit(1)


# ============================================================================
# Test Utilities
# ============================================================================

class Colors:
    """ANSI color codes."""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def print_header(text):
    """Print a section header."""
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'='*70}{Colors.RESET}")
    print(f"{Colors.BLUE}{Colors.BOLD}{text}{Colors.RESET}")
    print(f"{Colors.BLUE}{Colors.BOLD}{'='*70}{Colors.RESET}\n")


def assert_equal(actual, expected, msg=""):
    """Custom assertion for clarity."""
    if actual != expected:
        raise AssertionError(f"{msg}\nExpected: {expected}\nActual: {actual}")


def assert_true(condition, msg=""):
    """Assert condition is True."""
    if not condition:
        raise AssertionError(msg)


def assert_in(item, container, msg=""):
    """Assert item is in container."""
    if item not in container:
        raise AssertionError(f"{msg}\n{item} not in {container}")


def assert_len(container, length, msg=""):
    """Assert container has specific length."""
    if len(container) != length:
        raise AssertionError(f"{msg}\nExpected length {length}, got {len(container)}")


# ============================================================================
# FastAPI Parser Tests
# ============================================================================

class TestFastAPIParser:
    """Test FastAPI route extraction."""
    
    @staticmethod
    def test_01_simple_get_route():
        """Test extracting simple GET route."""
        code = '''
from fastapi import FastAPI

app = FastAPI()

@app.get("/users")
def get_users():
    """Get all users."""
    return []
'''
        parser = FastAPIParser("test.py")
        tree = ast.parse(code)
        parser.visit(tree)
        
        assert_len(parser.routes, 1, "Should extract 1 route")
        assert_equal(parser.routes[0].path, "/users")
        assert_in(HTTPMethod.GET, parser.routes[0].methods)
        assert_equal(parser.routes[0].handler_name, "get_users")
    
    @staticmethod
    def test_02_post_with_parameters():
        """Test POST route with typed parameters."""
        code = '''
from fastapi import FastAPI

app = FastAPI()

@app.post("/users")
def create_user(name: str, email: str, age: int = 0):
    """Create a new user."""
    return {"id": 1}
'''
        parser = FastAPIParser("test.py")
        tree = ast.parse(code)
        parser.visit(tree)
        
        assert_len(parser.routes, 1)
        route = parser.routes[0]
        assert_in(HTTPMethod.POST, route.methods)
        assert_len(route.parameters, 3, "Should extract 3 parameters")
        assert_equal(route.parameters[0].name, "name")
        assert_equal(route.parameters[0].type_hint, "str")
    
    @staticmethod
    def test_03_route_with_auth():
        """Test route requiring authentication."""
        code = '''
from fastapi import FastAPI, Depends

app = FastAPI()

@app.get("/admin", dependencies=[Depends(verify_token)])
def admin_panel():
    """Admin only."""
    return {}
'''
        parser = FastAPIParser("test.py")
        tree = ast.parse(code)
        parser.visit(tree)
        
        assert_len(parser.routes, 1)
        assert_true(parser.routes[0].auth_required, "Should detect auth requirement")
    
    @staticmethod
    def test_04_multiple_routes():
        """Test file with multiple routes."""
        code = '''
from fastapi import FastAPI

app = FastAPI()

@app.get("/items")
def list_items():
    return []

@app.post("/items")
def create_item(name: str):
    return {}

@app.get("/items/{item_id}")
def get_item(item_id: int):
    return {}

@app.put("/items/{item_id}")
def update_item(item_id: int, name: str):
    return {}
'''
        parser = FastAPIParser("test.py")
        tree = ast.parse(code)
        parser.visit(tree)
        
        assert_len(parser.routes, 4, "Should extract 4 routes")
        paths = [r.path for r in parser.routes]
        assert_in("/items", paths)
        assert_in("/items/{item_id}", paths)
    
    @staticmethod
    def test_05_delete_route():
        """Test DELETE route."""
        code = '''
from fastapi import FastAPI

app = FastAPI()

@app.delete("/items/{item_id}")
def delete_item(item_id: int):
    return {"deleted": True}
'''
        parser = FastAPIParser("test.py")
        tree = ast.parse(code)
        parser.visit(tree)
        
        assert_len(parser.routes, 1)
        assert_in(HTTPMethod.DELETE, parser.routes[0].methods)


# ============================================================================
# Flask Parser Tests
# ============================================================================

class TestFlaskParser:
    """Test Flask route extraction."""
    
    @staticmethod
    def test_01_simple_route():
        """Test simple Flask route."""
        code = '''
from flask import Flask

app = Flask(__name__)

@app.route("/hello")
def hello():
    """Say hello."""
    return "Hello World"
'''
        parser = FlaskParser("test.py")
        tree = ast.parse(code)
        parser.visit(tree)
        
        assert_len(parser.routes, 1)
        assert_equal(parser.routes[0].path, "/hello")
        assert_in(HTTPMethod.GET, parser.routes[0].methods)
    
    @staticmethod
    def test_02_multiple_methods():
        """Test Flask route with multiple HTTP methods."""
        code = '''
from flask import Flask

app = Flask(__name__)

@app.route("/data", methods=["GET", "POST", "PUT"])
def handle_data():
    return {}
'''
        parser = FlaskParser("test.py")
        tree = ast.parse(code)
        parser.visit(tree)
        
        assert_len(parser.routes, 1)
        route = parser.routes[0]
        assert_in(HTTPMethod.GET, route.methods)
        assert_in(HTTPMethod.POST, route.methods)
        assert_in(HTTPMethod.PUT, route.methods)
    
    @staticmethod
    def test_03_url_parameters():
        """Test Flask route with URL parameters."""
        code = '''
from flask import Flask

app = Flask(__name__)

@app.route("/users/<int:user_id>")
def get_user(user_id: int):
    return {"id": user_id}
'''
        parser = FlaskParser("test.py")
        tree = ast.parse(code)
        parser.visit(tree)
        
        assert_len(parser.routes, 1)
        assert_equal(parser.routes[0].path, "/users/<int:user_id>")
    
    @staticmethod
    def test_04_multiple_flask_routes():
        """Test file with multiple Flask routes."""
        code = '''
from flask import Flask

app = Flask(__name__)

@app.route("/")
def index():
    return "Home"

@app.route("/api/users", methods=["GET", "POST"])
def users():
    return []

@app.route("/api/items/<id>")
def get_item(id):
    return {}
'''
        parser = FlaskParser("test.py")
        tree = ast.parse(code)
        parser.visit(tree)
        
        assert_len(parser.routes, 3, "Should extract 3 routes")


# ============================================================================
# Express Parser Tests
# ============================================================================

class TestExpressParser:
    """Test Express.js route extraction."""
    
    @staticmethod
    def test_01_basic_routes():
        """Test basic Express routes."""
        code = '''
app.get('/users', handler);
app.post('/users', handler);
'''
        parser = ExpressParser("test.js")
        routes = parser.parse(code)
        
        assert_len(routes, 2, "Should extract 2 routes")
        assert_equal(routes[0].path, "/users")
        assert_in(HTTPMethod.GET, routes[0].methods)
        assert_in(HTTPMethod.POST, routes[1].methods)
    
    @staticmethod
    def test_02_all_http_methods():
        """Test Express with various HTTP methods."""
        code = '''
app.get('/api', handler);
app.post('/api', handler);
app.put('/api', handler);
app.delete('/api', handler);
app.patch('/api', handler);
app.head('/api', handler);
app.options('/api', handler);
'''
        parser = ExpressParser("test.js")
        routes = parser.parse(code)
        
        assert_len(routes, 7, "Should extract 7 routes")
        methods = [r.methods[0] for r in routes]
        assert_in(HTTPMethod.GET, methods)
        assert_in(HTTPMethod.POST, methods)
        assert_in(HTTPMethod.PUT, methods)
        assert_in(HTTPMethod.DELETE, methods)
        assert_in(HTTPMethod.PATCH, methods)
    
    @staticmethod
    def test_03_router_routes():
        """Test Express router routes."""
        code = '''
router.get('/api/users', handler);
router.post('/api/users', handler);
router.delete('/api/items/:id', handler);
'''
        parser = ExpressParser("test.ts")
        routes = parser.parse(code)
        
        assert_len(routes, 3, "Should extract 3 router routes")
        paths = [r.path for r in routes]
        assert_in("/api/users", paths)
        assert_in("/api/items/:id", paths)
    
    @staticmethod
    def test_04_parameterized_routes():
        """Test Express routes with parameters."""
        code = '''
app.get('/users/:id', handler);
app.get('/posts/:id/comments/:cid', handler);
app.put('/items/:itemId', handler);
'''
        parser = ExpressParser("test.js")
        routes = parser.parse(code)
        
        assert_len(routes, 3)
        paths = [r.path for r in routes]
        assert_in("/users/:id", paths)
        assert_in("/posts/:id/comments/:cid", paths)


# ============================================================================
# File Filtering Tests
# ============================================================================

class TestFileFiltering:
    """Test file filtering logic."""
    
    @staticmethod
    def test_01_skip_node_modules():
        """Should skip node_modules directory."""
        assert_true(
            not should_scan_file("node_modules/express/index.js"),
            "Should skip node_modules"
        )
        assert_true(
            not should_scan_file("src/node_modules/pkg/file.js"),
            "Should skip nested node_modules"
        )
    
    @staticmethod
    def test_02_skip_venv():
        """Should skip virtual environment directories."""
        assert_true(not should_scan_file("venv/lib/site.py"))
        assert_true(not should_scan_file(".venv/bin/python"))
        assert_true(not should_scan_file("env/lib/module.py"))
    
    @staticmethod
    def test_03_skip_build_artifacts():
        """Should skip build directories."""
        assert_true(not should_scan_file("build/index.js"))
        assert_true(not should_scan_file("dist/app.js"))
        assert_true(not should_scan_file("out/bundle.js"))
        assert_true(not should_scan_file(".next/data.json"))
    
    @staticmethod
    def test_04_skip_cache_dirs():
        """Should skip cache directories."""
        assert_true(not should_scan_file("__pycache__/module.pyc"))
        assert_true(not should_scan_file(".pytest_cache/data"))
        assert_true(not should_scan_file(".mypy_cache/version"))
    
    @staticmethod
    def test_05_skip_hidden_dirs():
        """Should skip hidden directories."""
        assert_true(not should_scan_file(".git/config"))
        assert_true(not should_scan_file(".github/workflows/test.yml"))
        assert_true(not should_scan_file(".idea/settings.xml"))
    
    @staticmethod
    def test_06_accept_route_files():
        """Should accept files in routes directories."""
        assert_true(should_scan_file("src/routes/users.py"))
        assert_true(should_scan_file("app/routes/items.ts"))
        assert_true(should_scan_file("src/routes/api.js"))
    
    @staticmethod
    def test_07_accept_controller_files():
        """Should accept files in controllers directories."""
        assert_true(should_scan_file("src/controllers/auth.py"))
        assert_true(should_scan_file("app/controllers/user.ts"))
        assert_true(should_scan_file("api/controllers/data.js"))
    
    @staticmethod
    def test_08_accept_handler_files():
        """Should accept files in handlers directories."""
        assert_true(should_scan_file("src/handlers/request.py"))
        assert_true(should_scan_file("app/handlers/response.ts"))
        assert_true(should_scan_file("api/handlers/error.js"))
    
    @staticmethod
    def test_09_accept_api_files():
        """Should accept files in api directories."""
        assert_true(should_scan_file("src/api/endpoints.py"))
        assert_true(should_scan_file("app/api/routes.ts"))
    
    @staticmethod
    def test_10_reject_generic_files():
        """Should reject non-priority files."""
        assert_true(not should_scan_file("utils/helpers.py"))
        assert_true(not should_scan_file("config/settings.ts"))
        assert_true(not should_scan_file("lib/util.js"))


# ============================================================================
# Content Hashing Tests
# ============================================================================

class TestContentHashing:
    """Test content hashing for caching."""
    
    @staticmethod
    def test_01_identical_content():
        """Identical content should produce same hash."""
        content = "def hello(): pass"
        hash1 = _hash_content(content)
        hash2 = _hash_content(content)
        assert_equal(hash1, hash2, "Same content should have same hash")
    
    @staticmethod
    def test_02_different_content():
        """Different content should produce different hashes."""
        hash1 = _hash_content("def hello(): pass")
        hash2 = _hash_content("def hello(): return 42")
        assert_true(hash1 != hash2, "Different content should have different hashes")
    
    @staticmethod
    def test_03_whitespace_sensitive():
        """Hash should be sensitive to whitespace."""
        hash1 = _hash_content("def func():\n  pass")
        hash2 = _hash_content("def func():\npass")
        assert_true(hash1 != hash2, "Whitespace changes should affect hash")


# ============================================================================
# Cache Manager Tests
# ============================================================================

class TestCacheManager:
    """Test caching functionality."""
    
    @staticmethod
    def test_01_initialization():
        """Test cache manager initialization."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = RouteCacheManager(tmpdir)
            assert_equal(cache.hashes, {}, "Cache should start empty")
    
    @staticmethod
    def test_02_detect_new_files():
        """Test detecting new files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = RouteCacheManager(tmpdir)
            
            files = {"file1.py": "code1", "file2.py": "code2"}
            changed = cache.get_changed_files(files)
            
            assert_len(changed, 2, "First run should detect all files as changed")
    
    @staticmethod
    def test_03_no_changes():
        """Test detecting no changes."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = RouteCacheManager(tmpdir)
            
            files = {"file.py": "def func(): pass"}
            cache.get_changed_files(files)
            
            # Second run with same content
            changed = cache.get_changed_files(files)
            assert_len(changed, 0, "Second run should detect no changes")
    
    @staticmethod
    def test_04_detect_modifications():
        """Test detecting modified files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = RouteCacheManager(tmpdir)
            
            files_v1 = {"file.py": "def func(): pass"}
            cache.get_changed_files(files_v1)
            
            files_v2 = {"file.py": "def func(): return 42"}
            changed = cache.get_changed_files(files_v2)
            
            assert_len(changed, 1, "Should detect modified file")
            assert_in("file.py", changed, "Modified file should be in changed list")
    
    @staticmethod
    def test_05_remove_stale_files():
        """Test removing stale file hashes."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = RouteCacheManager(tmpdir)
            
            files = {"file1.py": "code1", "file2.py": "code2"}
            cache.get_changed_files(files)
            
            # Remove file2
            cache.remove_stale({"file1.py"})
            
            assert_true("file1.py" in cache.hashes)
            assert_true("file2.py" not in cache.hashes, "Stale file should be removed")


# ============================================================================
# Parallel Processing Tests
# ============================================================================

class TestParallelProcessing:
    """Test parallel route extraction."""
    
    @staticmethod
    def test_01_extract_fastapi_routes():
        """Test extracting FastAPI routes in parallel."""
        files = {
            f"api_{i}.py": f'''
from fastapi import FastAPI
app = FastAPI()

@app.get("/route{i}")
def handler_{i}():
    return {{"id": {i}}}
'''
            for i in range(5)
        }
        
        routes, metadata = extract_routes_parallel(
            files,
            framework="fastapi",
            use_cache=False,
            max_workers=2
        )
        
        assert_len(routes, 5, "Should extract 5 routes")
        assert_equal(metadata["status"], "success")
        assert_equal(metadata["routes_count"], 5)
    
    @staticmethod
    def test_02_extract_express_routes():
        """Test extracting Express routes in parallel."""
        files = {
            f"api_{i}.js": f"app.get('/route{i}', handler);"
            for i in range(5)
        }
        
        routes, metadata = extract_routes_parallel(
            files,
            framework="express",
            use_cache=False,
            max_workers=2
        )
        
        assert_len(routes, 5, "Should extract 5 routes")
        assert_equal(metadata["status"], "success")
    
    @staticmethod
    def test_03_mixed_framework_extraction():
        """Test extracting from mixed frameworks."""
        files = {
            "routes/api.py": '''
from fastapi import FastAPI
app = FastAPI()

@app.get("/users")
def users():
    return []
''',
            "routes/app.js": "app.get('/items', handler);",
        }
        
        routes, metadata = extract_routes_parallel(
            files,
            use_cache=False,
            max_workers=2
        )
        
        assert_true(len(routes) >= 2, f"Should extract routes from both frameworks, got {len(routes)}")
    
    @staticmethod
    def test_04_empty_files():
        """Test handling empty files."""
        files = {"empty.py": "", "another.js": ""}
        
        routes, metadata = extract_routes_parallel(
            files,
            use_cache=False
        )
        
        assert_equal(len(routes), 0, "Should handle empty files gracefully")


# ============================================================================
# Performance Tests
# ============================================================================

class TestPerformance:
    """Test performance characteristics."""
    
    @staticmethod
    def _generate_realistic_code(num_routes: int) -> str:
        """Generate realistic FastAPI code with multiple routes."""
        code = '''from fastapi import FastAPI, Depends
from typing import List

app = FastAPI()

def verify_token(token: str) -> str:
    return token

'''
        for i in range(num_routes):
            auth = "dependencies=[Depends(verify_token)]" if i % 3 == 0 else ""
            code += f'''@app.get("/api/v1/resource{i}", {auth})
def handler_{i}(skip: int = 0, limit: int = 10):
    """Handle resource {i}."""
    return {{"id": {i}, "items": []}}

'''
        return code
    
    @staticmethod
    def test_01_sequential_vs_parallel_small():
        """Test parallelization on SMALL repo (20 files)."""
        files = {
            f"routes/api_{i}.py": TestPerformance._generate_realistic_code(5)
            for i in range(20)
        }
        
        # Sequential
        start = time.perf_counter()
        routes_seq, _ = extract_routes_parallel(
            files,
            use_cache=False,
            max_workers=1
        )
        time_seq = (time.perf_counter() - start) * 1000
        
        # Parallel
        start = time.perf_counter()
        routes_par, _ = extract_routes_parallel(
            files,
            use_cache=False,
            max_workers=4
        )
        time_par = (time.perf_counter() - start) * 1000
        
        assert_len(routes_seq, len(routes_par))
        speedup = time_seq / time_par if time_par > 0 else 1
        print(f"    Small (20 files): Sequential {time_seq:.2f}ms | Parallel {time_par:.2f}ms | Speedup: {speedup:.2f}x")
    
    @staticmethod
    def test_02_sequential_vs_parallel_medium():
        """Test parallelization on MEDIUM repo (50 files)."""
        files = {
            f"routes/api_{i}.py": TestPerformance._generate_realistic_code(8)
            for i in range(50)
        }
        
        # Sequential
        start = time.perf_counter()
        routes_seq, _ = extract_routes_parallel(
            files,
            use_cache=False,
            max_workers=1
        )
        time_seq = (time.perf_counter() - start) * 1000
        
        # Parallel
        start = time.perf_counter()
        routes_par, _ = extract_routes_parallel(
            files,
            use_cache=False,
            max_workers=4
        )
        time_par = (time.perf_counter() - start) * 1000
        
        assert_len(routes_seq, len(routes_par))
        speedup = time_seq / time_par if time_par > 0 else 1
        print(f"    Medium (50 files): Sequential {time_seq:.2f}ms | Parallel {time_par:.2f}ms | Speedup: {speedup:.2f}x")
    
    @staticmethod
    def test_03_sequential_vs_parallel_large():
        """Test parallelization on LARGE repo (100 files)."""
        files = {
            f"routes/api_{i}.py": TestPerformance._generate_realistic_code(10)
            for i in range(100)
        }
        
        # Sequential
        start = time.perf_counter()
        routes_seq, _ = extract_routes_parallel(
            files,
            use_cache=False,
            max_workers=1
        )
        time_seq = (time.perf_counter() - start) * 1000
        
        # Parallel
        start = time.perf_counter()
        routes_par, _ = extract_routes_parallel(
            files,
            use_cache=False,
            max_workers=4
        )
        time_par = (time.perf_counter() - start) * 1000
        
        assert_len(routes_seq, len(routes_par))
        speedup = time_seq / time_par if time_par > 0 else 1
        print(f"    Large (100 files): Sequential {time_seq:.2f}ms | Parallel {time_par:.2f}ms | Speedup: {speedup:.2f}x")
    
    @staticmethod
    def test_04_file_filtering_speed():
        """Test file filtering is fast."""
        paths = [
            "node_modules/pkg/file.js",
            "src/routes/api.py",
            ".git/config",
            "venv/lib/site.py",
            "src/controllers/user.ts",
        ] * 100
        
        start = time.perf_counter()
        for path in paths:
            should_scan_file(path)
        duration = (time.perf_counter() - start) * 1000
        
        print(f"    File filtering ({len(paths)} paths): {duration:.2f}ms")
        assert_true(duration < 100, "File filtering should be fast (<100ms)")


# ============================================================================
# Test Runner
# ============================================================================

def run_tests():
    """Run all tests."""
    print_header("Code Parser Test Suite")
    
    test_classes = [
        ("FastAPI Parser", TestFastAPIParser),
        ("Flask Parser", TestFlaskParser),
        ("Express Parser", TestExpressParser),
        ("File Filtering", TestFileFiltering),
        ("Content Hashing", TestContentHashing),
        ("Cache Manager", TestCacheManager),
        ("Parallel Processing", TestParallelProcessing),
        ("Performance", TestPerformance),
    ]
    
    total_tests = 0
    passed_tests = 0
    failed_tests = 0
    errors = []
    
    for category_name, test_class in test_classes:
        print(f"{Colors.CYAN}{category_name}:{Colors.RESET}")
        
        test_methods = [m for m in dir(test_class) if m.startswith('test_')]
        
        for method_name in sorted(test_methods):
            total_tests += 1
            test_name = method_name.replace('_', ' ').replace('test ', '').title()
            
            try:
                method = getattr(test_class, method_name)
                method()
                print(f"  {Colors.GREEN}✓{Colors.RESET} {test_name}")
                passed_tests += 1
            except AssertionError as e:
                print(f"  {Colors.RED}✗{Colors.RESET} {test_name}")
                print(f"    {Colors.RED}{str(e)[:100]}{Colors.RESET}")
                failed_tests += 1
                errors.append((test_name, str(e)))
            except Exception as e:
                print(f"  {Colors.RED}✗{Colors.RESET} {test_name}")
                print(f"    {Colors.RED}Exception: {str(e)[:100]}{Colors.RESET}")
                failed_tests += 1
                errors.append((test_name, str(e)))
        
        print()
    
    # Print summary
    print_header("Test Summary")
    print(f"Total:  {total_tests}")
    print(f"{Colors.GREEN}Passed: {passed_tests}{Colors.RESET}")
    print(f"{Colors.RED}Failed: {failed_tests}{Colors.RESET}\n")
    
    if failed_tests > 0:
        print(f"{Colors.RED}{Colors.BOLD}Failed Tests:{Colors.RESET}")
        for test_name, error in errors:
            print(f"  • {test_name}")
    
    if failed_tests == 0:
        print(f"{Colors.GREEN}{Colors.BOLD}✓ ALL TESTS PASSED!{Colors.RESET}\n")
        return 0
    else:
        print(f"{Colors.RED}{Colors.BOLD}✗ SOME TESTS FAILED!{Colors.RESET}\n")
        return 1


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    exit_code = run_tests()
    sys.exit(exit_code)