import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Clock, Activity, RefreshCw, AlertCircle } from 'lucide-react';
import { Header } from '../components/Header';
import { SummaryCard, SummaryCardSkeleton } from '../components/SummaryCard';
import { TestList } from '../components/TestList';
import { ErrorLog } from '../components/ErrorLog';
import { TestFileList } from '../components/TestFileList';
import { formatDuration, parsePlaywrightReport } from '../utils/parser';
import { fetchLatestResults, checkHealth, listTestFiles, triggerTestRun, waitForTestCompletion, fixAndRetryTests } from '../utils/api';
import type { ParsedReport } from '../utils/types';
import './Dashboard.css';

export function Dashboard() {
    const [data, setData] = useState<ParsedReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
    const [testFileCount, setTestFileCount] = useState(0);
    const [isRunningTests, setIsRunningTests] = useState(false);
    const [isFixing, setIsFixing] = useState(false);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);

    // Check backend health on mount
    useEffect(() => {
        checkHealth().then(setBackendHealthy);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch both test results and file list
            const [report, testFiles] = await Promise.all([
                fetchLatestResults(),
                listTestFiles().catch(() => [])
            ]);
            const parsed = parsePlaywrightReport(report);
            setData(parsed);
            setTestFileCount(testFiles.length);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load test data';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleRunTests = useCallback(async () => {
        if (isRunningTests) return;

        setIsRunningTests(true);
        try {
            await triggerTestRun(); // Run tests without repo URL = execute existing tests
            await waitForTestCompletion(() => { });
            await fetchData(); // Refresh results
        } catch (err) {
            console.error('Failed to run tests:', err);
        } finally {
            setIsRunningTests(false);
        }
    }, [isRunningTests, fetchData]);

    const handleFixAndRetry = useCallback(async () => {
        if (isFixing || isRunningTests) return;

        setIsFixing(true);
        try {
            await fixAndRetryTests();
            await waitForTestCompletion(() => { });
            await fetchData(); // Refresh results
        } catch (err) {
            console.error('Failed to fix and retry:', err);
        } finally {
            setIsFixing(false);
        }
    }, [isFixing, isRunningTests, fetchData]);

    // Fetch data on mount
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleTestComplete = () => {
        fetchData();
    };

    const statusLabel = data ? (() => {
        switch (data.status) {
            case 'passed':
                return 'Passed';
            case 'failed':
                return 'Failed';
            case 'compilation_error':
                return 'Compilation Error';
            case 'no_tests':
                return 'No Tests';
            default:
                return 'Unknown';
        }
    })() : '—';

    const statusVariant = data ? (() => {
        switch (data.status) {
            case 'passed':
                return 'success' as const;
            case 'failed':
            case 'compilation_error':
                return 'error' as const;
            case 'no_tests':
                return 'warning' as const;
            default:
                return 'default' as const;
        }
    })() : 'default';

    return (
        <>
            <Header onTestComplete={handleTestComplete} />

            <main className="page">
                <div className="container">
                    {/* Backend Status Warning */}
                    {backendHealthy === false && (
                        <div className="warning-banner">
                            <AlertCircle size={20} />
                            <div>
                                <strong>Backend not connected</strong>
                                <p>Start the backend with: <code>cd web-dashboard/api && python server.py</code></p>
                            </div>
                        </div>
                    )}

                    {/* Error Banner */}
                    {error && (
                        <div className="error-banner">
                            <p>{error}</p>
                            <button className="btn btn-secondary" onClick={fetchData}>
                                <RefreshCw size={16} />
                                Retry
                            </button>
                        </div>
                    )}

                    {/* Summary Cards */}
                    <div className="summary-grid">
                        {loading ? (
                            <SummaryCardSkeleton count={6} />
                        ) : data ? (
                            <>
                                <SummaryCard
                                    title="Status"
                                    value={statusLabel}
                                    subtitle={
                                        data.status === 'compilation_error'
                                            ? 'Tests blocked by compilation errors'
                                            : data.status === 'failed'
                                                ? 'Some tests failed'
                                                : data.status === 'no_tests'
                                                    ? 'No tests executed yet'
                                                    : 'Latest run status'
                                    }
                                    icon={<AlertCircle size={18} />}
                                    variant={statusVariant}
                                />
                                <SummaryCard
                                    title="Errors"
                                    value={data.errorCount}
                                    subtitle={data.errorCount > 0 ? 'Compilation/runner errors' : 'No compilation errors'}
                                    icon={<XCircle size={18} />}
                                    variant={data.errorCount > 0 ? 'error' : 'default'}
                                />
                                <SummaryCard
                                    title="Passed"
                                    value={data.stats.passed}
                                    subtitle={data.stats.totalTests > 0 ? `${data.stats.passRate.toFixed(0)}% pass rate` : 'No tests run yet'}
                                    icon={<CheckCircle2 size={18} />}
                                    variant={data.stats.passed > 0 ? 'success' : 'default'}
                                />
                                <SummaryCard
                                    title="Failed"
                                    value={data.stats.failed}
                                    subtitle={
                                        data.errorCount > 0
                                            ? 'Compilation errors blocked run'
                                            : data.stats.failed > 0
                                                ? 'Needs attention'
                                                : 'All tests passing'
                                    }
                                    icon={<XCircle size={18} />}
                                    variant={data.stats.failed > 0 ? 'error' : 'default'}
                                />
                                <SummaryCard
                                    title="Duration"
                                    value={data.stats.duration > 0 ? formatDuration(data.stats.duration) : '—'}
                                    subtitle={data.stats.duration > 0 ? `Started ${data.stats.startTime.toLocaleTimeString()}` : 'No runs yet'}
                                    icon={<Clock size={18} />}
                                />
                                <SummaryCard
                                    title="Total Tests"
                                    value={`${data.stats.totalTests}`}
                                    subtitle={
                                        data.status === 'compilation_error'
                                            ? 'Blocked before execution'
                                            : 'Endpoints tested'
                                    }
                                    icon={<Activity size={18} />}
                                />
                            </>
                        ) : null}
                    </div>

                    {/* Two-column layout */}
                    <div className="content-grid">
                        {/* Left: Test Results */}
                        <div className="content-main">
                            {/* Error Log (if any compilation errors) */}
                            {data && data.errors.length > 0 && (
                                <div className="section">
                                    <ErrorLog 
                                        errors={data.errors} 
                                        onFixAndRetry={handleFixAndRetry}
                                        isFixing={isFixing}
                                    />
                                </div>
                            )}

                            {/* Test Results List */}
                            <div className="section">
                                {loading ? (
                                    <div className="test-list-skeleton">
                                        <div className="skeleton" style={{ height: 48 }} />
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <div key={i} className="skeleton" style={{ height: 64, marginTop: 1 }} />
                                        ))}
                                    </div>
                                ) : data ? (
                                    <TestList
                                        endpoints={data.endpoints}
                                        hasTestFiles={testFileCount > 0}
                                        hasErrors={data.errors.length > 0}
                                        onRunTests={handleRunTests}
                                        selectedFile={selectedFile}
                                    />
                                ) : null}
                            </div>
                        </div>

                        {/* Right: Test Files */}
                        <div className="content-sidebar">
                            <TestFileList
                                onRefresh={fetchData}
                                selectedFile={selectedFile}
                                onSelectFile={setSelectedFile}
                            />
                        </div>
                    </div>

                    {/* Last Updated Footer */}
                    {data && data.stats.duration > 0 && (
                        <div className="dashboard-footer">
                            <span>Last run: {data.stats.startTime.toLocaleString()}</span>
                            <button className="btn-text" onClick={fetchData}>
                                <RefreshCw size={14} />
                                Refresh
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
