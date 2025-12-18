import type { PlaywrightReport } from './types';

const API_BASE = 'http://localhost:9000';

export interface TestFileInfo {
    filename: string;
    name: string;
    path: string;
    size: number;
}

export interface RunTestsResponse {
    status: 'started' | 'running' | 'completed' | 'failed';
    message: string;
}

export interface RunStatusResponse {
    status: 'idle' | 'running' | 'completed' | 'failed' | 'no_test_run';
    message: string;
    output?: string;
    repoUrl?: string;
    startTime?: string;
    endTime?: string;
}

/**
 * List all test spec files
 */
export async function listTestFiles(): Promise<TestFileInfo[]> {
    const response = await fetch(`${API_BASE}/api/tests`);

    if (!response.ok) {
        throw new Error(`Failed to list tests: ${response.statusText}`);
    }

    const data = await response.json();
    return data.files;
}

/**
 * Fetch the latest test results
 */
export async function fetchLatestResults(): Promise<PlaywrightReport> {
    const response = await fetch(`${API_BASE}/api/results/latest`);

    if (!response.ok) {
        throw new Error(`Failed to fetch results: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Trigger a test run
 * @param repoUrl - If provided, runs the ADK agent on this repo. If not, runs existing tests.
 */
export async function triggerTestRun(repoUrl?: string): Promise<RunTestsResponse> {
    const response = await fetch(`${API_BASE}/api/run-tests`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoUrl }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || `Failed to trigger tests: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Get the status of the current test run
 */
export async function getRunStatus(): Promise<RunStatusResponse> {
    const response = await fetch(`${API_BASE}/api/run-tests/status`);

    if (!response.ok) {
        throw new Error(`Failed to get status: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Delete a test file
 */
export async function deleteTestFile(filename: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/tests/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Failed to delete: ${response.statusText}`);
    }
}

/**
 * Poll for test run completion
 */
export async function waitForTestCompletion(
    onStatusUpdate: (status: RunStatusResponse) => void,
    intervalMs = 2000,
    maxAttempts = 300
): Promise<RunStatusResponse> {
    let attempts = 0;

    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                const status = await getRunStatus();
                onStatusUpdate(status);

                if (status.status === 'completed' || status.status === 'failed') {
                    resolve(status);
                    return;
                }

                attempts++;
                if (attempts >= maxAttempts) {
                    reject(new Error('Test run timed out'));
                    return;
                }

                setTimeout(poll, intervalMs);
            } catch (error) {
                reject(error);
            }
        };

        poll();
    });
}

/**
 * Check if the backend is healthy
 */
export async function checkHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/health`);
        return response.ok;
    } catch {
        return false;
    }
}
