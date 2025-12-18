// Type definitions for Playwright JSON report format

export interface PlaywrightReport {
    config: ReportConfig;
    suites: TestSuite[];
    errors: ReportError[];
    stats: ReportStats;
}

export interface ReportConfig {
    configFile: string;
    rootDir: string;
    workers: number;
    timeout: number;
    projects: Project[];
}

export interface Project {
    name: string;
    testDir: string;
    outputDir: string;
    retries: number;
    timeout: number;
}

export interface TestSuite {
    title: string;
    file: string;
    line: number;
    column: number;
    specs: TestSpec[];
    suites?: TestSuite[]; // Nested suites
}

export interface TestSpec {
    title: string;
    ok: boolean;
    tests: Test[];
    file: string;
    line: number;
    column: number;
}

export interface Test {
    timeout: number;
    annotations: Annotation[];
    expectedStatus: string;
    projectName: string;
    results: TestResult[];
    status: 'expected' | 'unexpected' | 'skipped' | 'flaky';
}

export interface TestResult {
    workerIndex: number;
    status: 'passed' | 'failed' | 'timedOut' | 'skipped';
    duration: number;
    error?: TestError;
    stdout: OutputEntry[];
    stderr: OutputEntry[];
    retry: number;
    startTime: string;
    attachments: Attachment[];
}

export interface TestError {
    message: string;
    stack: string;
    location?: {
        file: string;
        line: number;
        column: number;
    };
    snippet?: string;
}

export interface Annotation {
    type: string;
    description?: string;
}

export interface OutputEntry {
    text?: string;
    buffer?: string;
}

export interface Attachment {
    name: string;
    contentType: string;
    path?: string;
    body?: string;
}

export interface ReportError {
    message: string;
    stack: string;
    location?: {
        file: string;
        line: number;
        column: number;
    };
    snippet?: string;
}

export interface ReportStats {
    startTime: string;
    duration: number;
    expected: number;
    unexpected: number;
    skipped: number;
    flaky: number;
}

// Derived types for dashboard display

export interface DashboardStats {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    flaky: number;
    duration: number;
    passRate: number;
    startTime: Date;
}

export interface EndpointResult {
    id: string;
    name: string;
    endpoint: string;
    method: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: TestError;
    file: string;
    line: number;
}

export interface ParsedReport {
    stats: DashboardStats;
    endpoints: EndpointResult[];
    errors: ReportError[];
    hasData: boolean;
    status: ReportStatus;
    errorCount: number;
}

export type ReportStatus =
    | 'passed'
    | 'failed'
    | 'compilation_error'
    | 'no_tests'
    | 'unknown';
