import asyncio
import os
import time

from dotenv import load_dotenv
from google.adk.agents import SequentialAgent
from google.adk.agents.llm_agent import Agent

from .github_mcp import create_github_mcp_toolset
from .routes_storage import (
    list_route_snapshots,
    load_route_snapshot,
    store_playwright_tests,
    store_routes_snapshot,
)
from .playwright_mcp import create_playwright_mcp_toolset, run_playwright_tests
from .prompts import (
    PLAYWRIGHT_TEST_EXECUTION_PROMPT,
    PLAYWRIGHT_TEST_GENERATION_PROMPT,
    ROUTE_EXTRACTION_PROMPT,
)
load_dotenv()  # Make variables from .env available for MCP configuration.

_RATE_LIMIT_SECONDS = float(os.getenv("GEMINI_MIN_REQUEST_INTERVAL", "7.0"))
_last_request_time = 0.0

async def enforce_gemini_rate_limit(*_, **__):
    """Throttle Gemini calls so we do not exceed free-tier request quotas."""
    global _last_request_time
    now = time.monotonic()
    wait = (_last_request_time + _RATE_LIMIT_SECONDS) - now
    if wait > 0:
        await asyncio.sleep(wait)
    _last_request_time = time.monotonic()

github_toolset = create_github_mcp_toolset()
playwright_toolset = create_playwright_mcp_toolset()

endpoint_agent = Agent(
    model='gemini-2.5-flash',
    name='endpoint_agent',
    description=(
        """
        Scrapes GitHub repositories for HTTP endpoints and 
        stores structured results for automated testing pipelines.
        """
    ),
    instruction=(ROUTE_EXTRACTION_PROMPT),
    before_model_callback=[enforce_gemini_rate_limit],
    tools=[github_toolset, store_routes_snapshot],
)

test_generation_agent = Agent(
    model='gemini-2.5-flash',
    name='test_generation_agent',
    description=(
        """
        Generates Playwright-compatible API tests for the discovered HTTP endpoints.
        """
    ),
    instruction=(PLAYWRIGHT_TEST_GENERATION_PROMPT),
    before_model_callback=[enforce_gemini_rate_limit],
    tools=[
        github_toolset,
        list_route_snapshots,
        load_route_snapshot,
        store_playwright_tests,
    ],
)

test_execution_agent = Agent(
    model='gemini-2.5-flash',
    name='test_execution_agent',
    description=(
        """
        Executes generated Playwright tests via the Playwright MCP HTTP server and reports results.
        """
    ),
    instruction=(PLAYWRIGHT_TEST_EXECUTION_PROMPT),
    before_model_callback=[enforce_gemini_rate_limit],
    tools=[run_playwright_tests],
)


root_agent = SequentialAgent(
    name='root_agent',
    description=(
        """
        Orchestrates endpoint extraction, Playwright test generation, and remote execution for GitHub repositories.
        """
    ),
    sub_agents=[endpoint_agent, test_generation_agent, test_execution_agent]
)
