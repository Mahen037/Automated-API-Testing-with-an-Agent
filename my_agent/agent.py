import os
import time

from dotenv import load_dotenv
from google.adk.agents import SequentialAgent, LoopAgent
from google.adk.agents.llm_agent import Agent
from google.genai import types
from .custom_agent import GenerationRevisionAgent
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
    approve_generation,
    request_changes,
    cleanup_loop_state,
    # Execution
    run_playwright_tests,
)

load_dotenv()  # Make variables from .env available for MCP configuration.

github_toolset = create_github_mcp_toolset()
playwright_toolset = create_playwright_mcp_toolset()

# ---------------------------------------------------------------------
# Endpoint Discovery Agent
# ---------------------------------------------------------------------
endpoint_agent = Agent(
    model="gemini-2.5-flash",
    name="endpoint_agent",
    description=(
        """
        Scrapes GitHub repositories for HTTP endpoints and stores structured
        results for automated testing pipelines.
        """
    ),
    generate_content_config=types.GenerateContentConfig(
        temperature=0.0,
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
    model="gemini-2.5-flash",
    name="junior_test_generation_agent",
    description="Generates initial Playwright API tests from stored route snapshots.",
    instruction=(
        PROMPTS["junior_test_generation"].prompt
        + "\n\nReference the output format when structuring the response:\n\n"
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
    model="gemini-2.5-flash",
    name="senior_test_review_agent",
    description="Reviews generated Playwright tests and approves or revises them.",
    instruction=(
        PROMPTS["senior_test_review"].prompt + 
        "\n\nReference the output format when structuring the response:\n\n" 
        + PROMPTS["senior_test_review"].output_format
    ),
    tools=[
        list_route_snapshots,
        load_route_snapshot,
        list_playwright_tests,
        load_playwright_test,
        approve_generation,
        request_changes,
    ],
)

# -------------------------------------------------------------------
# Loop Agent: Junior ↔ Senior refinement
# -------------------------------------------------------------------

test_generation_loop = GenerationRevisionAgent(
    name="test_generation_loop",
    description="Iteratively generates and reviews Playwright tests until approved.",
    sub_agents=[
        junior_test_generation_agent,
        senior_test_review_agent,
    ],
)

# test_generation_loop = LoopAgent(
#     name="test_generation_loop",
#     description="Iteratively generates and reviews Playwright tests until approved.",
#     sub_agents=[
#         junior_test_generation_agent,
#         senior_test_review_agent,
#     ],
#     max_iterations=2,   # CI-safe bound
# )



# -------------------------------------------------------------------
# Test Execution Agent
# -------------------------------------------------------------------
test_execution_agent = Agent(
    model='gemini-2.5-flash',
    name='test_execution_agent',
    description=(
        """
        Executes generated Playwright tests via the Playwright MCP HTTP server and reports results.
        """
    ),
    instruction=(
        PROMPTS["test_execution"].prompt
        + "\n\nReference the output format when structuring the response:\n\n"
        + PROMPTS["test_execution"].output_format
    ),
    tools=[run_playwright_tests],
)

# -------------------------------------------------------------------
# Cleanup Agent: Remove internal loop-control files
# -------------------------------------------------------------------
cleanup_agent = Agent(
    name="cleanup_agent",
    description="Cleans up internal loop-control artifacts.",
    instruction="Remove internal loop-control files.",
    tools=[cleanup_loop_state],
)

# -------------------------------------------------------------------
# Root Agent: Orchestrate the entire process
# -------------------------------------------------------------------
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
        test_execution_agent,
    ]
)