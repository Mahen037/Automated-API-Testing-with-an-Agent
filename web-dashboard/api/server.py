"""
FastAPI Backend for API Test Dashboard

This server provides endpoints for:
- Fetching test results from .api-tests/reports/
- Listing available test specs from .api-tests/tests/
- Running the ADK agent to analyze repos and generate tests
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add project root to path so we can import my_agent
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Paths
API_TESTS_DIR = PROJECT_ROOT / ".api-tests"
REPORTS_DIR = API_TESTS_DIR / "reports"
ROUTES_DIR = API_TESTS_DIR / "routes"
TESTS_DIR = API_TESTS_DIR / "tests"

# App setup
app = FastAPI(
    title="API Test Dashboard Backend",
    description="Backend API for the API Test Dashboard",
    version="1.0.0",
)

# CORS - allow frontend to access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def extract_service_name(filename: str) -> str:
    """Extract service name from a test file like 'users.spec.ts' -> 'users'"""
    return filename.replace('.spec.ts', '').replace('-', ' ').title()


# State for tracking test runs
class RunState:
    status: str = "idle"  # idle, running, completed, failed
    message: str = ""
    output: str = ""
    repo_url: str = ""
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

run_state = RunState()


# Request/Response Models
class TestFileInfo(BaseModel):
    filename: str
    name: str
    path: str
    size: int


class TestFilesResponse(BaseModel):
    files: List[TestFileInfo]


class RunTestsRequest(BaseModel):
    repoUrl: Optional[str] = None  # Repo URL to analyze


class RunTestsResponse(BaseModel):
    status: str
    message: str


class RunStatusResponse(BaseModel):
    status: str
    message: str
    output: Optional[str] = None
    repoUrl: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None


# API Endpoints

@app.get("/api/tests", response_model=TestFilesResponse)
async def list_test_files():
    """List all test spec files in .api-tests/tests/"""
    files = []
    
    if TESTS_DIR.exists():
        for test_file in sorted(TESTS_DIR.glob("*.spec.ts")):
            files.append(TestFileInfo(
                filename=test_file.name,
                name=extract_service_name(test_file.name),
                path=str(test_file.relative_to(PROJECT_ROOT)),
                size=test_file.stat().st_size
            ))
    
    return TestFilesResponse(files=files)


@app.get("/api/routes")
async def list_route_files():
    """List all route JSON files in .api-tests/routes/"""
    files = []
    
    if ROUTES_DIR.exists():
        for route_file in sorted(ROUTES_DIR.glob("*.json")):
            try:
                data = json.loads(route_file.read_text())
                files.append({
                    "filename": route_file.name,
                    "repo": data.get("repo", "Unknown"),
                    "routeCount": len(data.get("routes", [])),
                })
            except:
                files.append({
                    "filename": route_file.name,
                    "repo": "Unknown",
                    "routeCount": 0,
                })
    
    return {"files": files}


@app.get("/api/results/latest")
async def get_latest_results():
    """Return the latest test results from index.json"""
    
    results_file = REPORTS_DIR / "index.json"
    
    if not results_file.exists():
        # Return empty structure if no results
        return {
            "config": {},
            "suites": [],
            "errors": [],
            "stats": {
                "startTime": datetime.now().isoformat(),
                "duration": 0,
                "expected": 0,
                "unexpected": 0,
                "skipped": 0,
                "flaky": 0
            }
        }
    
    try:
        return json.loads(results_file.read_text())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read results: {e}")


@app.post("/api/run-tests", response_model=RunTestsResponse)
async def trigger_test_run(request: RunTestsRequest):
    """Run ADK agent to analyze repo and generate tests, or run existing tests"""
    global run_state
    
    if run_state.status == "running":
        raise HTTPException(
            status_code=409,
            detail="A test run is already in progress"
        )
    
    # Reset state
    run_state.status = "running"
    run_state.output = ""
    run_state.repo_url = request.repoUrl or ""
    run_state.start_time = datetime.now()
    run_state.end_time = None
    
    if request.repoUrl:
        run_state.message = f"Starting agent for {request.repoUrl}..."
        # Run the ADK agent with the repo URL
        asyncio.create_task(run_agent_async(request.repoUrl))
    else:
        run_state.message = "Running Playwright tests..."
        # Just run existing tests
        asyncio.create_task(run_tests_async())
    
    return RunTestsResponse(
        status="started",
        message=run_state.message
    )


async def run_agent_async(repo_url: str):
    """Run the ADK agent asynchronously using Runner"""
    global run_state
    
    try:
        run_state.output += f"🚀 Starting ADK Agent\n"
        run_state.output += f"📦 Repository: {repo_url}\n\n"
        
        # Clean up previous tests to ensure isolation
        import shutil
        run_state.output += "🧹 Cleaning up previous tests...\n"
        if TESTS_DIR.exists():
            shutil.rmtree(TESTS_DIR)
        if ROUTES_DIR.exists():
            shutil.rmtree(ROUTES_DIR)
        TESTS_DIR.mkdir(parents=True, exist_ok=True)
        ROUTES_DIR.mkdir(parents=True, exist_ok=True)
        
        # Import ADK components
        from google.adk.runners import Runner
        from google.adk.sessions import InMemorySessionService
        from my_agent.agent import root_agent
        
        run_state.output += "✅ Loaded agent modules\n"
        run_state.message = "Initializing agent..."
        
        # Create session service and runner
        session_service = InMemorySessionService()
        runner = Runner(
            agent=root_agent,
            app_name="api-test-dashboard",
            session_service=session_service,
        )
        
        run_state.output += "✅ Created runner\n"
        run_state.message = "Running agent pipeline..."
        
        # Wrapper for message to satisfy ADK runner
        class SimplePart:
            def __init__(self, text):
                self.text = text
                
        class SimpleMessage:
            def __init__(self, content):
                self.role = "user"
                self.content = content
                self.parts = [SimplePart(content)]
        
        # Run the agent
        user_id = "dashboard-user"
        session_id = f"session-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        
        if hasattr(session_service, "create_session"):
            await session_service.create_session(
                session_id=session_id,
                app_name="api-test-dashboard",
                user_id=user_id
            )
        
        run_state.output += f"📝 Session: {session_id}\n\n"
        run_state.output += "--- Agent Output ---\n"
        
        # Flush stdout to ensure logs appear
        sys.stdout.flush()
        
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=SimpleMessage(repo_url)
        ):
            # Log events
            event_type = type(event).__name__
            # print(f"DEBUG: Event {event_type}") # Debug to console
            
            if hasattr(event, 'content') and event.content:
                content = str(event.content)
                run_state.output += f"[{event_type}] {content[:200]}\n"
            elif hasattr(event, 'text') and event.text:
                run_state.output += f"{event.text}\n"
            else:
                run_state.output += f"[{event_type}]\n"
            
            # Keep output manageable
            lines = run_state.output.split('\n')
            if len(lines) > 500: # Increased buffer
                run_state.output = '\n'.join(lines[-500:])
        
        run_state.output += "\n--- Agent Complete ---\n"
        run_state.end_time = datetime.now()
        run_state.status = "completed"
        run_state.message = "Agent completed! Tests generated and executed."
        
    except ImportError as e:
        run_state.output += f"\n❌ Import Error: {e}\n"
        run_state.output += "Make sure google-adk is installed: pip install google-adk\n"
        run_state.status = "failed"
        run_state.message = f"Import error: {e}"
        run_state.end_time = datetime.now()
        
    except Exception as e:
        run_state.output += f"\n❌ Error: {e}\n"
        run_state.status = "failed"
        run_state.message = f"Error: {str(e)}"
        run_state.end_time = datetime.now()


async def run_tests_async():
    """Run Playwright tests asynchronously (existing tests only)"""
    global run_state
    
    try:
        cmd = ["npm", "test"]
        run_state.output += f"Running: {' '.join(cmd)}\n\n"
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(PROJECT_ROOT),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        
        while True:
            line = await process.stdout.readline()
            if not line:
                break
            decoded = line.decode("utf-8", errors="replace")
            run_state.output += decoded
            lines = run_state.output.split('\n')
            if len(lines) > 100:
                run_state.output = '\n'.join(lines[-100:])
        
        await process.wait()
        
        run_state.end_time = datetime.now()
        
        if process.returncode == 0:
            run_state.status = "completed"
            run_state.message = "Tests completed successfully!"
        else:
            run_state.status = "completed"
            run_state.message = f"Tests finished with exit code {process.returncode}"
            
    except Exception as e:
        run_state.status = "failed"
        run_state.message = f"Error: {str(e)}"
        run_state.output += f"\nError: {str(e)}"
        run_state.end_time = datetime.now()


@app.get("/api/run-tests/status", response_model=RunStatusResponse)
async def get_run_status():

    # If there were no test runs at all
    if not run_state.start_time:
        return RunStatusResponse(
            status="no_test_run",
            message="No tests have been executed yet",
            output=None,
            repoUrl=None,
            startTime=None,
            endTime=None
        )
    
    """Get the status of the current/last test run"""
    return RunStatusResponse(
        status=run_state.status,
        message=run_state.message,
        output=run_state.output if run_state.output else None,
        repoUrl=run_state.repo_url if run_state.repo_url else None,
        startTime=run_state.start_time.isoformat() if run_state.start_time else None,
        endTime=run_state.end_time.isoformat() if run_state.end_time else None,
    )


@app.delete("/api/tests/{filename}")
async def delete_test_file(filename: str):
    """Delete a test spec file"""
    test_file = TESTS_DIR / filename
    
    if not test_file.exists():
        raise HTTPException(status_code=404, detail=f"Test file {filename} not found")
    
    test_file.unlink()
    
    # Also try to delete matching route file
    route_name = filename.replace('.spec.ts', '-routes.json')
    route_file = ROUTES_DIR / route_name
    if route_file.exists():
        route_file.unlink()
    
    return {"status": "deleted", "file": filename}


def fix_syntax_issues(content: str) -> tuple[str, list[str]]:
    """Fix common syntax issues in generated test files.
    
    Returns:
        Tuple of (fixed_content, list_of_fixes_applied)
    """
    fixes = []
    
    # Define replacements using Unicode code points for reliability
    replacements = [
        # Smart/curly single quotes -> straight apostrophe
        ('\u2018', "'", "left single quote"),   # '
        ('\u2019', "'", "right single quote"),  # ' (also used as apostrophe)
        ('\u201B', "'", "single high-reversed-9 quote"),
        # Smart/curly double quotes -> straight double quote
        ('\u201C', '"', "left double quote"),   # "
        ('\u201D', '"', "right double quote"),  # "
        ('\u201F', '"', "double high-reversed-9 quote"),
        # Prime marks (sometimes confused with quotes)
        ('\u2032', "'", "prime"),               # ′
        ('\u2033', '"', "double prime"),        # ″
        # Dashes -> hyphen-minus
        ('\u2013', '-', "en-dash"),             # –
        ('\u2014', '-', "em-dash"),             # —
        ('\u2015', '-', "horizontal bar"),
        # Ellipsis
        ('\u2026', '...', "ellipsis"),          # …
        # Other common problematic characters
        ('\u00A0', ' ', "non-breaking space"),  # NBSP
        ('\u200B', '', "zero-width space"),
        ('\u200C', '', "zero-width non-joiner"),
        ('\u200D', '', "zero-width joiner"),
        ('\uFEFF', '', "byte order mark"),
    ]
    
    chars_replaced = set()
    for old_char, new_char, description in replacements:
        if old_char in content:
            content = content.replace(old_char, new_char)
            chars_replaced.add(description)
    
    if chars_replaced:
        fixes.append(f"Replaced special characters: {', '.join(sorted(chars_replaced))}")
    
    return content, fixes


class FixTestsResponse(BaseModel):
    status: str
    files_fixed: int
    total_fixes: int
    details: list


@app.post("/api/fix-tests", response_model=FixTestsResponse)
async def fix_test_files():
    """Fix common syntax issues in all test files (smart quotes, etc.)"""
    
    if not TESTS_DIR.exists():
        return FixTestsResponse(
            status="no_tests",
            files_fixed=0,
            total_fixes=0,
            details=[]
        )
    
    details = []
    files_fixed = 0
    total_fixes = 0
    
    for test_file in TESTS_DIR.glob("*.spec.ts"):
        try:
            content = test_file.read_text(encoding="utf-8")
            fixed_content, fixes = fix_syntax_issues(content)
            
            if fixes:
                test_file.write_text(fixed_content, encoding="utf-8")
                files_fixed += 1
                total_fixes += len(fixes)
                details.append({
                    "file": test_file.name,
                    "fixes": fixes
                })
        except Exception as e:
            details.append({
                "file": test_file.name,
                "error": str(e)
            })
    
    return FixTestsResponse(
        status="success" if files_fixed > 0 else "no_fixes_needed",
        files_fixed=files_fixed,
        total_fixes=total_fixes,
        details=details
    )


@app.post("/api/fix-and-retry")
async def fix_and_retry_tests():
    """Fix syntax issues in test files and re-run the tests"""
    global run_state
    
    if run_state.status == "running":
        raise HTTPException(
            status_code=409,
            detail="A test run is already in progress"
        )
    
    # First, fix any syntax issues
    fix_result = await fix_test_files()
    
    # Reset state for new test run
    run_state.status = "running"
    run_state.output = ""
    run_state.repo_url = ""
    run_state.start_time = datetime.now()
    run_state.end_time = None
    
    if fix_result.files_fixed > 0:
        run_state.message = f"Fixed {fix_result.total_fixes} issue(s) in {fix_result.files_fixed} file(s). Running tests..."
        run_state.output += f"🔧 Fixed {fix_result.total_fixes} syntax issue(s):\n"
        for detail in fix_result.details:
            if "fixes" in detail:
                run_state.output += f"  - {detail['file']}: {', '.join(detail['fixes'])}\n"
        run_state.output += "\n"
    else:
        run_state.message = "No fixes needed. Running tests..."
    
    # Run the tests
    asyncio.create_task(run_tests_async())
    
    return {
        "status": "started",
        "fixes_applied": fix_result.files_fixed > 0,
        "fix_details": fix_result.details,
        "message": run_state.message
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "testsDir": str(TESTS_DIR),
        "testsExist": TESTS_DIR.exists(),
        "reportsExist": (REPORTS_DIR / "index.json").exists(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)
