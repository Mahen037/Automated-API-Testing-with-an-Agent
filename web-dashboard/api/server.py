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
class PhaseState:
    """State for an individual pipeline phase"""
    def __init__(self, id: str, name: str, icon: str):
        self.id = id
        self.name = name
        self.icon = icon
        self.status = "pending"  # pending, running, completed, failed
        self.summary = ""
        self.details: List[str] = []
        self.artifacts: List[dict] = []
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "icon": self.icon,
            "status": self.status,
            "summary": self.summary,
            "details": self.details,
            "artifacts": self.artifacts,
            "startTime": self.start_time.isoformat() if self.start_time else None,
            "endTime": self.end_time.isoformat() if self.end_time else None,
        }


class RunState:
    status: str = "idle"  # idle, running, completed, failed
    message: str = ""
    output: str = ""
    repo_url: str = ""
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    # Enhanced tracking
    agent_narrative: str = ""  # Human-readable summary from agent
    current_phase: str = ""
    phases: List[PhaseState] = []
    
    # Execution details
    exec_command: str = ""
    exec_duration: str = ""
    exec_exit_code: Optional[int] = None
    exec_spec_directory: str = ""
    exec_spec_files: List[str] = []
    exec_report_path: str = ""
    exec_stdout: str = ""
    
    # Route discovery results
    routes_found: int = 0
    services_found: List[str] = []
    
    def reset(self):
        """Reset state for a new run"""
        self.status = "running"
        self.message = ""
        self.output = ""
        self.agent_narrative = ""
        self.current_phase = ""
        self.phases = [
            PhaseState("discovery", "Endpoint Discovery", "search"),
            PhaseState("generation", "Test Generation", "generate"),
            PhaseState("execution", "Test Execution", "execute"),
        ]
        self.exec_command = ""
        self.exec_duration = ""
        self.exec_exit_code = None
        self.exec_spec_directory = ""
        self.exec_spec_files = []
        self.exec_report_path = ""
        self.exec_stdout = ""
        self.routes_found = 0
        self.services_found = []

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
    
    # Enhanced tracking
    agentNarrative: Optional[str] = None
    currentPhase: Optional[str] = None
    phases: Optional[List[dict]] = None
    
    # Execution details
    execCommand: Optional[str] = None
    execDuration: Optional[str] = None
    execExitCode: Optional[int] = None
    execSpecDirectory: Optional[str] = None
    execSpecFiles: Optional[List[str]] = None
    execReportPath: Optional[str] = None
    execStdout: Optional[str] = None
    
    # Discovery results
    routesFound: Optional[int] = None
    servicesFound: Optional[List[str]] = None


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
    """Run the ADK agent asynchronously using Runner with enhanced tracking"""
    global run_state
    
    try:
        # Initialize enhanced state
        run_state.reset()
        run_state.repo_url = repo_url
        run_state.start_time = datetime.now()
        
        run_state.output += f"🚀 Starting ADK Agent\n"
        run_state.output += f"📦 Repository: {repo_url}\n\n"
        
        # Phase 1: Setup
        run_state.current_phase = "discovery"
        run_state.phases[0].status = "running"
        run_state.phases[0].start_time = datetime.now()
        run_state.phases[0].summary = f"Analyzing repository: {repo_url}"
        
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
        
        # Track which agent is currently running
        current_sub_agent = ""
        narrative_parts = []
        
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=SimpleMessage(repo_url)
        ):
            event_type = type(event).__name__
            
            # Detect agent transitions and update phase tracking
            if hasattr(event, 'author') and event.author:
                author = str(event.author)
                if 'endpoint' in author.lower() and current_sub_agent != 'endpoint':
                    current_sub_agent = 'endpoint'
                    run_state.current_phase = "discovery"
                    run_state.message = "Discovering API endpoints..."
                    if run_state.phases[0].status != "completed":
                        run_state.phases[0].status = "running"
                elif 'generation' in author.lower() and current_sub_agent != 'generation':
                    # Mark discovery as complete
                    run_state.phases[0].status = "completed"
                    run_state.phases[0].end_time = datetime.now()
                    
                    # Start generation phase
                    current_sub_agent = 'generation'
                    run_state.current_phase = "generation"
                    run_state.phases[1].status = "running"
                    run_state.phases[1].start_time = datetime.now()
                    run_state.message = "Generating Playwright tests..."
                    
                    # Update discovery phase with artifacts
                    route_files = list(ROUTES_DIR.glob("*.json"))
                    if route_files:
                        run_state.phases[0].artifacts = [
                            {"name": f.name, "path": str(f.relative_to(PROJECT_ROOT)), "type": "routes"}
                            for f in route_files
                        ]
                        run_state.routes_found = len(route_files)
                        run_state.phases[0].details.append(f"Found {len(route_files)} route snapshot(s)")
                        
                elif 'execution' in author.lower() and current_sub_agent != 'execution':
                    # Mark generation as complete
                    run_state.phases[1].status = "completed"
                    run_state.phases[1].end_time = datetime.now()
                    
                    # Start execution phase
                    current_sub_agent = 'execution'
                    run_state.current_phase = "execution"
                    run_state.phases[2].status = "running"
                    run_state.phases[2].start_time = datetime.now()
                    run_state.message = "Executing Playwright tests..."
                    
                    # Update generation phase with artifacts
                    test_files = list(TESTS_DIR.glob("*.spec.ts"))
                    if test_files:
                        run_state.phases[1].artifacts = [
                            {"name": f.name, "path": str(f.relative_to(PROJECT_ROOT)), "type": "tests"}
                            for f in test_files
                        ]
                        run_state.phases[1].details.append(f"Generated {len(test_files)} test file(s)")
                        run_state.exec_spec_files = [f.name for f in test_files]
            
            # Capture narrative text from agent responses
            if hasattr(event, 'content') and event.content:
                content = str(event.content)
                # Check if this looks like narrative text (not just tool calls)
                if len(content) > 50 and not content.startswith('[') and not content.startswith('{'):
                    narrative_parts.append(content)
                run_state.output += f"[{event_type}] {content[:500]}\n"
            elif hasattr(event, 'text') and event.text:
                text = str(event.text)
                if len(text) > 20:
                    narrative_parts.append(text)
                run_state.output += f"{text}\n"
            else:
                run_state.output += f"[{event_type}]\n"
            
            # Keep output manageable
            lines = run_state.output.split('\n')
            if len(lines) > 500:
                run_state.output = '\n'.join(lines[-500:])
        
        # Mark final phase as complete
        run_state.phases[2].status = "completed"
        run_state.phases[2].end_time = datetime.now()
        
        # Build agent narrative from collected parts
        run_state.agent_narrative = "\n\n".join(narrative_parts[-5:]) if narrative_parts else "Agent completed processing."
        
        # Update execution phase with report info
        report_path = PROJECT_ROOT / ".api-tests" / "reports" / "index.html"
        if report_path.exists():
            run_state.exec_report_path = str(report_path)
            run_state.phases[2].artifacts = [
                {"name": "index.html", "path": ".api-tests/reports/index.html", "type": "report"}
            ]
        
        run_state.exec_spec_directory = str(TESTS_DIR)
        
        # Count final results
        final_test_files = list(TESTS_DIR.glob("*.spec.ts"))
        final_route_files = list(ROUTES_DIR.glob("*.json"))
        run_state.exec_spec_files = [f.name for f in final_test_files]
        run_state.routes_found = len(final_route_files)
        
        # Update phase summaries
        run_state.phases[0].summary = f"Analyzed {repo_url} and found {len(final_route_files)} service(s)"
        run_state.phases[1].summary = f"Generated {len(final_test_files)} Playwright test file(s)"
        run_state.phases[2].summary = f"Executed tests, results saved to .api-tests/reports/"
        
        run_state.output += "\n--- Agent Complete ---\n"
        run_state.end_time = datetime.now()
        run_state.status = "completed"
        run_state.message = "Agent completed! Tests generated and executed."
        
        # Calculate duration
        if run_state.start_time:
            duration = datetime.now() - run_state.start_time
            run_state.exec_duration = f"{duration.total_seconds():.2f}s"
        
    except ImportError as e:
        run_state.output += f"\n❌ Import Error: {e}\n"
        run_state.output += "Make sure google-adk is installed: pip install google-adk\n"
        run_state.status = "failed"
        run_state.message = f"Import error: {e}"
        run_state.end_time = datetime.now()
        # Mark current phase as failed
        for phase in run_state.phases:
            if phase.status == "running":
                phase.status = "failed"
                phase.end_time = datetime.now()
        
    except Exception as e:
        run_state.output += f"\n❌ Error: {e}\n"
        run_state.status = "failed"
        run_state.message = f"Error: {str(e)}"
        run_state.end_time = datetime.now()
        # Mark current phase as failed
        for phase in run_state.phases:
            if phase.status == "running":
                phase.status = "failed"
                phase.end_time = datetime.now()


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
    """Get the status of the current/last test run with enhanced tracking data"""
    
    # If there were no test runs at all
    if not run_state.start_time:
        return RunStatusResponse(
            status="no_test_run",
            message="No tests have been executed yet",
            output=None,
            repoUrl=None,
            startTime=None,
            endTime=None,
            agentNarrative=None,
            currentPhase=None,
            phases=None,
            execCommand=None,
            execDuration=None,
            execExitCode=None,
            execSpecDirectory=None,
            execSpecFiles=None,
            execReportPath=None,
            execStdout=None,
            routesFound=None,
            servicesFound=None
        )
    
    # Convert phases to dict format
    phases_data = [phase.to_dict() for phase in run_state.phases] if run_state.phases else None
    
    return RunStatusResponse(
        status=run_state.status,
        message=run_state.message,
        output=run_state.output if run_state.output else None,
        repoUrl=run_state.repo_url if run_state.repo_url else None,
        startTime=run_state.start_time.isoformat() if run_state.start_time else None,
        endTime=run_state.end_time.isoformat() if run_state.end_time else None,
        
        # Enhanced tracking
        agentNarrative=run_state.agent_narrative if run_state.agent_narrative else None,
        currentPhase=run_state.current_phase if run_state.current_phase else None,
        phases=phases_data,
        
        # Execution details
        execCommand=run_state.exec_command if run_state.exec_command else None,
        execDuration=run_state.exec_duration if run_state.exec_duration else None,
        execExitCode=run_state.exec_exit_code,
        execSpecDirectory=run_state.exec_spec_directory if run_state.exec_spec_directory else None,
        execSpecFiles=run_state.exec_spec_files if run_state.exec_spec_files else None,
        execReportPath=run_state.exec_report_path if run_state.exec_report_path else None,
        execStdout=run_state.exec_stdout if run_state.exec_stdout else None,
        
        # Discovery results
        routesFound=run_state.routes_found if run_state.routes_found else None,
        servicesFound=run_state.services_found if run_state.services_found else None
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
