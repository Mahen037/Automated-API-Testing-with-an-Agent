import { useState } from 'react';
import { CheckCircle2, XCircle, SkipForward, ChevronDown, ChevronUp, FileCode2, Play, AlertTriangle } from 'lucide-react';
import type { EndpointResult } from '../utils/types';
import { formatDuration } from '../utils/parser';
import './TestList.css';

interface TestListProps {
    endpoints: EndpointResult[];
    hasTestFiles?: boolean;
    hasErrors?: boolean;
    onRunTests?: () => void;
    selectedFile?: string | null;
}

export function TestList({ endpoints, hasTestFiles = false, hasErrors = false, onRunTests, selectedFile }: TestListProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'passed' | 'failed' | 'skipped'>('all');

    // First filter by selected file, then by status
    const filteredEndpoints = endpoints.filter(ep => {
        // Filter by file if one is selected
        if (selectedFile && ep.file !== selectedFile) {
            return false;
        }
        // Then filter by status
        if (filter === 'all') return true;
        return ep.status === filter;
    });

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'passed':
                return <CheckCircle2 size={16} className="icon-success" />;
            case 'failed':
                return <XCircle size={16} className="icon-error" />;
            case 'skipped':
                return <SkipForward size={16} className="icon-warning" />;
            default:
                return null;
        }
    };

    const getMethodBadgeClass = (method: string) => {
        switch (method) {
            case 'GET': return 'method-get';
            case 'POST': return 'method-post';
            case 'PUT': return 'method-put';
            case 'PATCH': return 'method-patch';
            case 'DELETE': return 'method-delete';
            default: return 'method-default';
        }
    };

    if (endpoints.length === 0) {
        // Different messaging based on state
        if (hasTestFiles && hasErrors) {
            return (
                <div className="test-list-empty test-list-error-state">
                    <AlertTriangle size={48} className="icon-warning" />
                    <h3>Tests Failed to Execute</h3>
                    <p>Test files were found but couldn't be run successfully. Check the errors above for details.</p>
                    <div className="test-list-hints">
                        <p><strong>Common causes:</strong></p>
                        <ul>
                            <li>Target API server not running (check endpoint URLs)</li>
                            <li>Missing npm dependencies (<code>npm install</code>)</li>
                            <li>Playwright not installed (<code>npx playwright install</code>)</li>
                            <li>TypeScript compilation errors in test files</li>
                        </ul>
                    </div>
                    {onRunTests && (
                        <button className="btn btn-primary" onClick={onRunTests}>
                            <Play size={16} />
                            Retry Tests
                        </button>
                    )}
                </div>
            );
        }

        if (hasTestFiles) {
            return (
                <div className="test-list-empty">
                    <FileCode2 size={48} />
                    <h3>Tests Not Yet Executed</h3>
                    <p>Test files are ready. Click "Run Tests" to execute them and see results here.</p>
                    {onRunTests && (
                        <button className="btn btn-primary" onClick={onRunTests}>
                            <Play size={16} />
                            Run Tests
                        </button>
                    )}
                </div>
            );
        }

        return (
            <div className="test-list-empty">
                <FileCode2 size={48} />
                <h3>No Test Results</h3>
                <p>No test files found. Use the agent to analyze a repository and generate tests.</p>
            </div>
        );
    }

    // Get endpoints filtered by file only (for accurate counts in filter buttons)
    const fileFilteredEndpoints = selectedFile
        ? endpoints.filter(ep => ep.file === selectedFile)
        : endpoints;

    return (
        <div className="test-list">
            <div className="test-list-header">
                <h2>
                    Endpoint Tests
                    {selectedFile && (
                        <span className="file-filter-badge">
                            • {selectedFile.replace('.spec.ts', '')}
                        </span>
                    )}
                </h2>
                <div className="test-list-filters">
                    <button
                        className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        All ({fileFilteredEndpoints.length})
                    </button>
                    <button
                        className={`filter-btn ${filter === 'passed' ? 'active' : ''}`}
                        onClick={() => setFilter('passed')}
                    >
                        Passed ({fileFilteredEndpoints.filter(e => e.status === 'passed').length})
                    </button>
                    <button
                        className={`filter-btn ${filter === 'failed' ? 'active' : ''}`}
                        onClick={() => setFilter('failed')}
                    >
                        Failed ({fileFilteredEndpoints.filter(e => e.status === 'failed').length})
                    </button>
                </div>
            </div>

            <div className="test-list-items">
                {filteredEndpoints.map((endpoint) => (
                    <div
                        key={endpoint.id}
                        className={`test-item ${endpoint.status}`}
                    >
                        <div
                            className="test-item-main"
                            onClick={() => setExpandedId(expandedId === endpoint.id ? null : endpoint.id)}
                        >
                            <div className="test-item-status">
                                {getStatusIcon(endpoint.status)}
                            </div>
                            <div className="test-item-info">
                                <div className="test-item-name">
                                    <span className={`method-badge ${getMethodBadgeClass(endpoint.method)}`}>
                                        {endpoint.method}
                                    </span>
                                    <span className="endpoint-path">{endpoint.endpoint}</span>
                                </div>
                                <div className="test-item-title">{endpoint.name}</div>
                            </div>
                            <div className="test-item-meta">
                                <span className="test-duration">{formatDuration(endpoint.duration)}</span>
                                {endpoint.error && (
                                    expandedId === endpoint.id
                                        ? <ChevronUp size={16} />
                                        : <ChevronDown size={16} />
                                )}
                            </div>
                        </div>

                        {expandedId === endpoint.id && endpoint.error && (
                            <div className="test-item-error">
                                <div className="error-message">{endpoint.error.message}</div>
                                {endpoint.error.snippet && (
                                    <pre className="error-snippet">{endpoint.error.snippet}</pre>
                                )}
                                {endpoint.error.stack && (
                                    <details className="error-stack-details">
                                        <summary>Stack Trace</summary>
                                        <pre className="error-stack">{endpoint.error.stack}</pre>
                                    </details>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
