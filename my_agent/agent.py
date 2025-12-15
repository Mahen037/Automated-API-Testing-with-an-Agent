import os
import time

from dotenv import load_dotenv
from google.adk.agents import SequentialAgent, LoopAgent
from google.adk.agents.llm_agent import Agent

from .mcp import create_github_mcp_toolset, create_playwright_mcp_toolset
from .prompts.prompt_parser import PROMPTS
from .tools import (
    # Route snapshots
    list_route_snapshots,
    load_route_snapshot,
    store_routes_snapshot,
    crawl_routes_snapshot,
    # Tests
    store_playwright_tests,
    list_playwright_tests,
    load_playwright_test,
    # Execution
    run_playwright_tests,
)

load_dotenv()  # Make variables from .env available for MCP configuration.

_RATE_LIMIT_SECONDS = float(os.getenv("GEMINI_MIN_REQUEST_INTERVAL", "15.0"))
_last_request_time = 0.0

def enforce_gemini_rate_limit(*_, **__):
    """
    Synchronously throttle Gemini calls. 
    Using sync sleep ensures the thread actually pauses regardless of framework await behavior.
    """
    print("=== ENFORCING GEMINI RATE LIMIT ===")
    global _last_request_time
    now = time.monotonic()
    
    # Calculate how much time has passed since the last request
    time_since_last = now - _last_request_time
    
    # If we haven't waited long enough, sleep for the remainder
    if time_since_last < _RATE_LIMIT_SECONDS:
        wait_time = _RATE_LIMIT_SECONDS - time_since_last
        print(f"RATE LIMIT: Throttling for {wait_time:.2f}s to respect 5 RPM quota...")
        time.sleep(wait_time)
        
    _last_request_time = time.monotonic()

github_toolset = create_github_mcp_toolset()
playwright_toolset = create_playwright_mcp_toolset()

# ---------------------------------------------------------------------
# Endpoint Discovery Agent
# ---------------------------------------------------------------------
endpoint_agent = Agent(
    model="gemini-3-pro-preview",
    name="endpoint_agent",
    description=(
        """
        Scrapes GitHub repositories for HTTP endpoints and stores structured
        results for automated testing pipelines.
        """
    ),
    instruction=(
        PROMPTS["route_extraction"].prompt
        + "\n\nReference the output format when structuring the response:\n\n"
        + PROMPTS["route_extraction"].output_format
    ),
    tools=[
        github_toolset, 
        store_routes_snapshot, 
        crawl_routes_snapshot
    ],
)

# -------------------------------------------------------------------
# Junior Test Generation Agent
# -------------------------------------------------------------------

junior_test_generation_agent = Agent(
    model="gemini-3-pro-preview",
    name="junior_test_generation_agent",
    description="Generates initial Playwright API tests from stored route snapshots.",
    instruction=(
        PROMPTS["junior_test_generation"].prompt
        + "\n\n"
        + PROMPTS["junior_test_generation"].output_format
    ),
    tools=[
        list_route_snapshots,
        load_route_snapshot,
        store_playwright_tests,
    ],
)

# -------------------------------------------------------------------
# Senior Test Review Agent
# -------------------------------------------------------------------

senior_test_review_agent = Agent(
    model="gemini-3-pro-preview",
    name="senior_test_review_agent",
    description="Reviews generated Playwright tests and approves or revises them.",
    instruction=(
        PROMPTS["senior_test_review"].prompt
        + "\n\n"
        + PROMPTS["senior_test_review"].output_format
    ),
    tools=[
        list_route_snapshots,
        load_route_snapshot,
        list_playwright_tests,
        load_playwright_test,
        store_playwright_tests,   # overwrite/fix if needed
    ],
)

# -------------------------------------------------------------------
# Loop Agent: Junior ↔ Senior refinement
# -------------------------------------------------------------------

test_generation_loop = LoopAgent(
    name="test_generation_loop",
    description="Iteratively generates and reviews Playwright tests until approved.",
    sub_agents=[
        junior_test_generation_agent,
        senior_test_review_agent,
    ],
    max_iterations=2,   # CI-safe bound
)

test_execution_agent = Agent(
    model='gemini-3-pro-preview',
    name='test_execution_agent',
    description=(
        """
        Executes generated Playwright tests via the Playwright MCP HTTP server and reports results.
        """
    ),
    instruction=(
        PROMPTS["test_execution"].prompt
        + "\n\n Reference the output format when structuring the response:\n\n"
        + PROMPTS["test_execution"].output_format
    ),
    tools=[run_playwright_tests],
)


root_agent = SequentialAgent(
    name='root_agent',
    description=(
        """
        Orchestrates endpoint extraction, Playwright test generation, and remote execution for GitHub repositories.
        """
    ),
    sub_agents=[
        endpoint_agent, 
        test_generation_loop, 
        test_execution_agent
    ]
)

# test_generation_agent = Agent(
#     model='gemini-3-pro-preview',
#     name='test_generation_agent',
#     description=(
#         """
#         Generates Playwright-compatible API tests for the discovered HTTP endpoints.
#         """
#     ),
#     instruction=PROMPTS["test_generation"].prompt + "\n\n Reference the output format when structuring the response:\n\n" + PROMPTS["test_generation"].output_format,
#     tools=[
#         github_toolset,
#         list_route_snapshots,
#         load_route_snapshot,
#         store_playwright_tests,
#     ],
# )