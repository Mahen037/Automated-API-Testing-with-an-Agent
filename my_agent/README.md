# Internal Docs

This directory wraps the Google ADK agent logic (prompts, MCP wiring, and tooling) that powers automated route discovery and Playwright test generation/execution. Use this README for day-to-day development details; the project-level README covers demos and high-level context.

## Directory Layout

```
my_agent/
├── agent.py              # root SequentialAgent orchestration
├── mcp/                  # MCP toolset builders (GitHub & Playwright)
├── prompts/              # YAML prompts + parser
├── tools.py              # Local storage helpers + Playwright CLI runner
└── __init__.py
```

Generated artifacts live outside this folder:

- `.api-tests/routes/` – saved route snapshots (JSON)
- `.api-tests/tests/` – generated Playwright `*.spec.ts`
- `.api-tests/reports/` – latest Playwright HTML/JSON reports

## Python Environment Setup

1. Create a virtual environment (example using venv):
   ```bash
   python -m venv venv
   ```
2. Activate it:
   - Windows: `venv\Scripts\activate`
   - macOS/Linux: `source venv/bin/activate`
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. (Optional) Freeze updates:
   ```bash
   pip freeze > requirements.txt
   ```

## Node/Playwright Setup

1. Ensure Node.js ≥ 18 is installed.
2. Install npm dependencies once:
   ```bash
   npm install
   ```
3. Install Playwright browsers (first run):
   ```bash
   npx playwright install
   ```

## Environment Variables (.env)

Create `my_agent/.env` (or project root `.env`) and load it via `dotenv`. Only the keys referenced by the codebase are listed here.

### Required

```
GOOGLE_GENAI_USE_VERTEXAI=0
GOOGLE_API_KEY=<google-api-key>
GITHUB_TOKEN=<github-api-key>
```

## Running MCP Servers

### GitHub

The agent launches the GitHub MCP server on demand using the STDIO transport:

```
npx -y @modelcontextprotocol/server-github
```

### Playwright

The agent launches the Playwright MCP server on demand using the STDIO transport:

```
npx -y @executeautomation/playwright-mcp-server
```

## Directory Conventions

- **Prompts**: defined per YAML file under `my_agent/prompts/`. Use `prompt_parser.py` to load them.
- **Tools**: all file I/O and CLI helpers live in `tools.py`, so agents can import a single module for route storage and test execution.
- **Artifacts**: the `.api-tests/` tree is safe to wipe/regenerate; it’s produced by the agents.

## Common Commands

- Run the SequentialAgent via ADK Web:
  ```bash
  adk web --no-reload
  ```
  Paste the repo of interest into the chat, and let the agent run.

- Run Playwright specs manually:
  ```bash
  npx playwright test
  ```
- Inspect latest Playwright report manually:
  ```bash
  npx playwright show-report .api-tests\reports
  ```

## Troubleshooting Tips

- **Missing GitHub routes**: ensure `GITHUB_TOKEN` has access to the target repo; check MCP server logs.
- **Playwright MCP 406 errors**: the HTTP client must send `Accept: application/json, text/event-stream` and reuse cookies/session.
- **Specs hard-coding localhost**: override `PLAYWRIGHT_BASE_URL` or edit spec constants before running against remote services.

Keep this README up to date whenever folder structure, environment names, or setup steps change. External documentation should reference this file for in-depth developer guidance.
