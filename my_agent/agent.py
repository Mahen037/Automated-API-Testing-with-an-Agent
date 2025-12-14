import asyncio
import os
import time
import warnings
warnings.filterwarnings("ignore")

from dotenv import load_dotenv
from pathlib import Path
from google.adk.agents import SequentialAgent
from google.adk.agents.llm_agent import Agent

from .mcp import create_github_mcp_toolset, create_playwright_mcp_toolset
from .tools import (
    list_route_snapshots,
    load_route_snapshot,
    run_playwright_tests,
    store_playwright_tests,
    store_routes_snapshot,
)
from .prompts.prompt_parser import PROMPTS
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(env_path)

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
    instruction=PROMPTS["route_extraction"].prompt + "\n\n Reference the output format when structuring the response:\n\n" + PROMPTS["route_extraction"].output_format,
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
    instruction="""IMPORTANT: You MUST generate and save Playwright test files.

Your task:
1. FIRST: Call list_route_snapshots() to see available route files
2. THEN: For EACH snapshot file, call load_route_snapshot(filename=<the_filename>)
3. THEN: Generate Playwright test code for ALL routes in the snapshot
4. FINALLY: Call store_playwright_tests(filename='<service>.spec.ts', code='<the_test_code>', routes_source='<snapshot_file>')

You MUST call store_playwright_tests to save your generated tests. This is required.

""" + PROMPTS["test_generation"].prompt + "\n\n Reference the output format when structuring the response:\n\n" + PROMPTS["test_generation"].output_format,
    before_model_callback=[enforce_gemini_rate_limit],
    output_key="test_generation_result",
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
    instruction=PROMPTS["test_execution"].prompt + "\n\n Reference the output format when structuring the response:\n\n" + PROMPTS["test_execution"].output_format,
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
