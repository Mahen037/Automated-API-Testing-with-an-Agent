import { useState } from 'react';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, AlertTriangle, Clock, FileCode2 } from 'lucide-react';
import type { EndpointResult } from '../utils/types';
import { formatDuration } from '../utils/parser';
import './TestResultsSummary.css';

interface TestResultsSummaryProps {
    endpoints: EndpointResult[];
    hasData: boolean;
}

export function TestResultsSummary({ endpoints, hasData }: TestResultsSummaryProps) {
    const [showFailedDetails, setShowFailedDetails] = useState(true);
    const [showPassedDetails, setShowPassedDetails] = useState(false);

    if (!hasData || endpoints.length === 0) {
        return null;
    }

    const passed = endpoints.filter(e => e.status === 'passed');
    const failed = endpoints.filter(e => e.status === 'failed');
    const total = endpoints.length;
    const passRate = total > 0 ? Math.round((passed.length / total) * 100) : 0;

    // Clean error message by removing ANSI codes
    const cleanMessage = (msg: string): string => {
        return msg
            .replace(/\u001b\[[0-9;]*m/g, '') // Remove ANSI color codes
            .replace(/\\u001b\[[0-9;]*m/g, '') // Remove escaped ANSI codes
            .split('\n')[0] // Take first line only
            .substring(0, 200); // Limit length
    };

    // Extract the key assertion failure from error
    const extractFailureSummary = (error: EndpointResult['error']): { expected: string; received: string } | null => {
        if (!error?.message) return null;

        const cleanMsg = error.message.replace(/\u001b\[[0-9;]*m/g, '');

        // Match "Expected: X" and "Received: Y" patterns
        const expectedMatch = cleanMsg.match(/Expected.*?:\s*["']?([^"'\n]+)["']?/);
        const receivedMatch = cleanMsg.match(/Received.*?:\s*["']?([^"'\n]+)["']?/);

        if (expectedMatch && receivedMatch) {
            return {
                expected: expectedMatch[1].substring(0, 100),
                received: receivedMatch[1].substring(0, 100)
            };
        }
        return null;
    };

    return (
        <div className="test-results-summary">
            {/* Overall Status Banner */}
            <div className={`summary-banner ${failed.length > 0 ? 'has-failures' : 'all-passed'}`}>
                <div className="banner-icon">
                    {failed.length > 0 ? (
                        <AlertTriangle size={32} />
                    ) : (
                        <CheckCircle2 size={32} />
                    )}
                </div>
                <div className="banner-content">
                    <h2>
                        {failed.length > 0
                            ? `${failed.length} Test${failed.length > 1 ? 's' : ''} Failed`
                            : 'All Tests Passed!'}
                    </h2>
                    <p>
                        {passed.length} passed • {failed.length} failed • {passRate}% pass rate
                    </p>
                </div>
                <div className="banner-stats">
                    <div className="stat-item passed">
                        <CheckCircle2 size={18} />
                        <span>{passed.length}</span>
                    </div>
                    <div className="stat-item failed">
                        <XCircle size={18} />
                        <span>{failed.length}</span>
                    </div>
                </div>
            </div>

            {/* Failed Tests Section */}
            {failed.length > 0 && (
                <div className="results-section failed-section">
                    <button
                        className="section-header"
                        onClick={() => setShowFailedDetails(!showFailedDetails)}
                    >
                        <XCircle size={20} className="section-icon" />
                        <span className="section-title">Failed Tests ({failed.length})</span>
                        {showFailedDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    {showFailedDetails && (
                        <div className="section-content">
                            {failed.map((test, idx) => {
                                const failureSummary = extractFailureSummary(test.error);
                                return (
                                    <div key={test.id || idx} className="test-result-item failed">
                                        <div className="test-header">
                                            <span className="test-name">{test.name}</span>
                                            <span className="test-duration">
                                                <Clock size={12} />
                                                {formatDuration(test.duration)}
                                            </span>
                                        </div>
                                        <div className="test-location">
                                            <FileCode2 size={12} />
                                            {test.file}:{test.line}
                                        </div>
                                        {failureSummary && (
                                            <div className="test-failure-summary">
                                                <div className="expected">
                                                    <span className="label">Expected:</span>
                                                    <code>{failureSummary.expected}</code>
                                                </div>
                                                <div className="received">
                                                    <span className="label">Received:</span>
                                                    <code>{failureSummary.received}</code>
                                                </div>
                                            </div>
                                        )}
                                        {!failureSummary && test.error?.message && (
                                            <div className="test-error-message">
                                                {cleanMessage(test.error.message)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Passed Tests Section */}
            {passed.length > 0 && (
                <div className="results-section passed-section">
                    <button
                        className="section-header"
                        onClick={() => setShowPassedDetails(!showPassedDetails)}
                    >
                        <CheckCircle2 size={20} className="section-icon" />
                        <span className="section-title">Passed Tests ({passed.length})</span>
                        {showPassedDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    {showPassedDetails && (
                        <div className="section-content">
                            {passed.map((test, idx) => (
                                <div key={test.id || idx} className="test-result-item passed">
                                    <div className="test-header">
                                        <CheckCircle2 size={14} className="pass-icon" />
                                        <span className="test-name">{test.name}</span>
                                        <span className="test-duration">
                                            <Clock size={12} />
                                            {formatDuration(test.duration)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
