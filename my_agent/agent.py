import asyncio
import os
import time

from dotenv import load_dotenv
from google.adk.agents.llm_agent import Agent

from .github_mcp import create_github_mcp_toolset

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

root_agent = Agent(
    model='gemini-2.5-flash',
    name='root_agent',
    description=(
        "Provides current times for cities and can inspect GitHub repositories "
        "to summarize HTTP endpoints."
    ),
    instruction=(
        "You are a helpful assistant with two primary skills:\n"
        "1. When the user asks for the current time in a city, call the "
        "`get_current_time` tool with the provided city name.\n"
        "2. When the user supplies a GitHub repository, use the GitHub MCP "
        "toolset to explore the repo codebase. Look for HTTP route definitions "
        "in common frameworks (Express/NestJS, FastAPI/Flask, Spring, etc.), "
        "collect the endpoints you find, and return them in a clear summary. "
        "Prefer structured JSON when the user requests the endpoints or when "
        "it helps clarity."
    ),
    before_model_callback=[enforce_gemini_rate_limit],
    tools=[github_toolset],
)
