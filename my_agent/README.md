# GitHub MCP Integration

This project connects the Google ADK agent to the GitHub MCP server so the agent
can browse repositories, open pull requests, and discuss code.

## Prerequisites

1. Create a GitHub personal access token with the `repo` scope and store it in
   the `.env` file as `GITHUB_TOKEN=<your-token>`.
2. (Optional) Restrict the server to a specific owner or repository by adding:
   - `GITHUB_MCP_OWNER=<org-or-user>`
   - `GITHUB_MCP_REPOSITORY=<owner/repo>`
3. If you need to pass extra environment variables to the server, prefix them
   with `GITHUB_MCP_ENV_`, e.g. `GITHUB_MCP_ENV_MCP_SERVER_GITHUB_BRANCH=main`.
4. Ensure Node.js is available so the agent can execute
   `npx -y @modelcontextprotocol/server-github`. The first run downloads the
   server package from npm.

After setting the environment variables, start the agent as usual. The GitHub
MCP tools will be added automatically when the agent imports `my_agent.agent`.

## Gemini Rate Limiting

The agent uses `gemini-2.5-flash` by default. A lightweight throttler enforces
at least seven seconds between calls so the free-tier quota is not exceeded.
Override the interval by setting `GEMINI_MIN_REQUEST_INTERVAL` in your
environment (value in seconds).
