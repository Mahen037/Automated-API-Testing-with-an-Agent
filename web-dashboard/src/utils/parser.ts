import type { PlaywrightReport, ParsedReport, DashboardStats, EndpointResult, ReportStatus } from './types';

/**
 * Extract HTTP method from test title (e.g., "GET /users/" -> "GET")
 */
function extractMethod(title: string): string {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    for (const method of methods) {
        if (title.toUpperCase().includes(method)) {
            return method;
        }
    }
    return 'GET';
}

/**
 * Extract endpoint path from test title
 */
function extractEndpoint(title: string): string {
    // Match common API path patterns like /users/ or /api/v1/items
    const pathMatch = title.match(/\/[\w\-\/:{}]+\/?/);
    if (pathMatch) {
        return pathMatch[0];
    }
    return '/';
}

/**
 * Generate a unique ID for an endpoint result
 */
function generateId(file: string, line: number, title: string): string {
    return `${file}-${line}-${title.slice(0, 20)}`.replace(/[^a-zA-Z0-9-]/g, '_');
}

/**
 * Recursively extract test results from nested suites
 */
function extractTestsFromSuites(
    suites: PlaywrightReport['suites'],
    results: EndpointResult[]
): void {
    for (const suite of suites) {
        // Process specs in this suite
        if (suite.specs) {
            for (const spec of suite.specs) {
                for (const test of spec.tests) {
                    const lastResult = test.results[test.results.length - 1];
                    const status = lastResult?.status ?? 'skipped';

                    results.push({
                        id: generateId(spec.file, spec.line, spec.title),
                        name: spec.title,
                        endpoint: extractEndpoint(spec.title),
                        method: extractMethod(spec.title),
                        status: status === 'passed' ? 'passed' : status === 'skipped' ? 'skipped' : 'failed',
                        duration: lastResult?.duration ?? 0,
                        error: lastResult?.error,
                        file: spec.file,
                        line: spec.line,
                    });
                }
            }
        }

        // Recursively process nested suites
        if (suite.suites && suite.suites.length > 0) {
            extractTestsFromSuites(suite.suites, results);
        }
    }
}

/**
 * Parse Playwright JSON report into dashboard-friendly format
 */
export function parsePlaywrightReport(report: PlaywrightReport): ParsedReport {
    const endpoints: EndpointResult[] = [];
    const errorCount = report?.errors?.length || 0;

    // Extract tests from all suites
    if (report.suites && report.suites.length > 0) {
        extractTestsFromSuites(report.suites, endpoints);
    }

    // Calculate stats
    const runStartTime = report.runStartTime
        ? new Date(report.runStartTime)
        : new Date(report.stats.startTime);
    const runEndTime = report.runEndTime ? new Date(report.runEndTime) : undefined;
    const durationFromRun = report.runDurationMs ?? (
        runEndTime
            ? Math.max(0, runEndTime.getTime() - runStartTime.getTime())
            : undefined
    );

    const passed = endpoints.filter(e => e.status === 'passed').length;
    const failed = endpoints.filter(e => e.status === 'failed').length;
    const skipped = endpoints.filter(e => e.status === 'skipped').length;
    const totalTests = endpoints.length;

    // Use stats from report if available, otherwise calculate
    const stats: DashboardStats = {
        totalTests: totalTests || report.stats.expected + report.stats.unexpected + report.stats.skipped,
        passed: passed || report.stats.expected,
        failed: failed || report.stats.unexpected,
        skipped: skipped || report.stats.skipped,
        flaky: report.stats.flaky,
        duration: durationFromRun ?? report.stats.duration,
        passRate: totalTests > 0 ? (passed / totalTests) * 100 : 0,
        startTime: runStartTime,
    };

    // Determine if we have any real data
    const hasData = endpoints.length > 0 || report.errors.length > 0 || stats.totalTests > 0;

    const deriveStatus = (): ReportStatus => {
        if (errorCount > 0 && totalTests === 0) return 'compilation_error';
        if (failed > 0 || errorCount > 0) return 'failed';
        if (passed > 0) return 'passed';
        if (totalTests === 0) return 'no_tests';
        return 'unknown';
    };

    return {
        stats,
        endpoints,
        errors: report.errors,
        hasData,
        status: deriveStatus(),
        errorCount,
    };
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) {
        return `${Math.round(ms)}ms`;
    }
    if (ms < 60000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
}

/**
 * Calculate pass rate as a percentage
 */
export function calculatePassRate(passed: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((passed / total) * 100);
}

/**
 * Get status color class
 */
export function getStatusClass(status: string): string {
    switch (status) {
        case 'passed':
            return 'success';
        case 'failed':
            return 'error';
        case 'skipped':
            return 'warning';
        default:
            return 'info';
    }
}
