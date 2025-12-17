# API Test Dashboard

A beautiful, modern dashboard for visualizing API test results from the Automated API Testing Agent.

![Dashboard Preview](./preview.png)

## Features

- **Summary Cards**: At-a-glance view of pass/fail rates, duration, and coverage
- **Test List**: Detailed view of all endpoint tests with filtering
- **Error Display**: Expandable error logs with stack traces
- **Test Runner**: Trigger new test runs directly from the UI
- **Dark Mode**: Premium dark theme with glassmorphism effects

## Getting Started

### Prerequisites

- Node.js 20.19+ (or 22.12+)
- Python 3.10+
- The parent project's dependencies installed

### Installation

1. **Install frontend dependencies:**
   ```bash
   cd web-dashboard
   npm install
   ```

2. **Install backend dependencies:**
   ```bash
   cd web-dashboard/api
   pip install -r requirements.txt
   ```

### Running the Dashboard

You need to run both the frontend and backend:

**Terminal 1 - Frontend:**
```bash
cd web-dashboard
npm run dev
```
The dashboard will be available at http://localhost:5173

**Terminal 2 - Backend:**
```bash
cd web-dashboard/api
python server.py
```
The API will be available at http://localhost:8000

### Running Tests

Before you can see results in the dashboard, you need to run the test suite:

```bash
# From the project root
npm test
```

Or use the "Run Tests" button in the dashboard UI.

## Project Structure

```
web-dashboard/
├── api/
│   ├── server.py          # FastAPI backend
│   └── requirements.txt   # Python dependencies
├── src/
│   ├── components/        # React components
│   │   ├── Header.tsx     # Navigation + Run Tests button
│   │   ├── SummaryCard.tsx # Stats cards
│   │   ├── TestList.tsx   # Endpoint results list
│   │   └── ErrorLog.tsx   # Error display
│   ├── pages/
│   │   └── Dashboard.tsx  # Main dashboard page
│   ├── hooks/
│   │   └── useTestData.ts # Data fetching hook
│   ├── utils/
│   │   ├── api.ts         # Backend API client
│   │   ├── parser.ts      # JSON report parser
│   │   └── types.ts       # TypeScript interfaces
│   ├── App.tsx            # Root component
│   ├── main.tsx           # Entry point
│   └── index.css          # Design system
├── index.html             # HTML template
└── package.json           # Dependencies
```

## API Endpoints

The backend provides the following endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/results/latest` | GET | Returns the latest test results |
| `/api/run-tests` | POST | Triggers a new test run |
| `/api/run-tests/status` | GET | Returns current run status |
| `/health` | GET | Health check |

## Technology Stack

- **Frontend**: React 18, Vite, TypeScript
- **Styling**: Vanilla CSS with custom design system
- **Icons**: Lucide React
- **Backend**: FastAPI (Python)
- **Charts**: Recharts (ready for future use)

## Dividing Work (2 People)

This dashboard was designed to allow work division:

### Person A: Agent Engineer
Focus on `my_agent/` - improving test generation quality

### Person B: Platform Engineer  
Focus on `web-dashboard/` - this UI and infrastructure

## License

MIT
