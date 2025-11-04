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

## Route Snapshots

When the agent finishes enumerating endpoints, it calls the
`store_routes_snapshot` tool. The tool writes the payload to
`.api-tests/routes/routes.json` (creating folders as needed). Override the file
name by passing the optional `filename` argument. The JSON includes `repo`,
`commit`, and `routes`, making it easy for automated test pipelines to pick up.

## Playwright Test Generation

The `test_generation_agent` consumes stored route snapshots and authors Playwright
tests compatible with the Playwright MCP runner.

1. Query available snapshots with `list_route_snapshots`, then load the desired
   file via `load_route_snapshot`.
2. Draft Playwright `@playwright/test` suites that exercise the HTTP endpoints
   (positive and negative checks as appropriate).
3. Persist each suite with `store_playwright_tests`, providing a filename that
   ends in `.spec.ts`. The tool saves the file to `.api-tests/tests/`.

## Running Generated Tests

Playwright project scaffolding (`package.json`, `tsconfig.json`, and
`playwright.config.ts`) lives at the repository root. To execute generated tests:

1. Ensure Node.js ≥ 18 is installed locally.
2. Install dependencies once with `npm install`.
3. (Optional) Override the service host via `PLAYWRIGHT_BASE_URL` or edit the
   inline `BASE_URL` constants inside the generated specs.
4. Run `npx playwright test` (the config points to `.api-tests/tests/`).

## Playwright MCP Execution

The `test_execution_agent` communicates with a running Playwright MCP HTTP
server (default `http://localhost:9222/mcp`) to list and execute the generated
specs remotely.

1. Launch the server separately, e.g. `npx @playwright/mcp --port 9222`.
2. (Optional) Override the endpoint via `PLAYWRIGHT_MCP_HTTP_URL` and timeout via
   `PLAYWRIGHT_MCP_HTTP_TIMEOUT`.
3. Invoke the agent; it calls `playwright_list_tools` to discover capabilities
   and `run_playwright_tests` to trigger execution. Results are returned in the
   agent response.
