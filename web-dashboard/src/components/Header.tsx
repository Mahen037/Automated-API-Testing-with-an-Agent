import { useState, useEffect } from 'react';
import { Play, RotateCw, Zap, Search, TestTube, CheckCircle2, XCircle } from 'lucide-react';
import { triggerTestRun, waitForTestCompletion } from '../utils/api';
import type { RunStatusResponse } from '../utils/api';
import './Header.css';

interface HeaderProps {
    onTestComplete?: () => void;
}

export function Header({ onTestComplete }: HeaderProps) {
    const [isRunning, setIsRunning] = useState(false);
    const [status, setStatus] = useState<RunStatusResponse | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [repoUrl, setRepoUrl] = useState('');
    const [history, setHistory] = useState<string[]>([]);

    // Load history on mount
    useEffect(() => {
        const saved = localStorage.getItem('repo_history');
        if (saved) {
            try {
                setHistory(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse history', e);
            }
        }
    }, []);

    const saveToHistory = (url: string) => {
        if (!url) return;
        const newHistory = [url, ...history.filter(h => h !== url)].slice(0, 10);
        setHistory(newHistory);
        localStorage.setItem('repo_history', JSON.stringify(newHistory));
    };

    const handleRunTests = async () => {
        const url = repoUrl.trim();
        if (!url) return;

        saveToHistory(url);

        try {
            setIsRunning(true);
            setStatus({
                status: 'running',
                message: 'Starting ADK agent...'
            });

            await triggerTestRun(url);

            await waitForTestCompletion((newStatus) => {
                setStatus(newStatus);
            });

            onTestComplete?.();

            // Keep modal open for 3 seconds to show completion
            setTimeout(() => {
                setShowModal(false);
                setIsRunning(false);
                setStatus(null);
                setRepoUrl('');
            }, 3000);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setStatus({ status: 'failed', message });
            setIsRunning(false);
        }
    };

    const handleClose = () => {
        if (!isRunning) {
            setShowModal(false);
            setStatus(null);
        }
    };

    const getPhaseIcon = (phaseId: string, status?: string) => {
        const isActive = status === 'running';
        const isComplete = status === 'completed';
        const isFailed = status === 'failed';

        const iconClass = `phase-step-icon ${isComplete ? 'complete' : ''} ${isActive ? 'active' : ''} ${isFailed ? 'failed' : ''}`;

        if (phaseId === 'discovery') {
            return <Search className={iconClass} size={16} />;
        } else if (phaseId === 'generation') {
            return <TestTube className={iconClass} size={16} />;
        } else {
            return <Play className={iconClass} size={16} />;
        }
    };

    return (
        <header className="header">
            <div className="container header-content">
                <div className="header-brand">
                    <Zap className="header-icon" />
                    <div>
                        <h1 className="header-title">API Test Dashboard</h1>
                        <p className="header-subtitle">Automated Testing Agent</p>
                    </div>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={() => setShowModal(true)}
                    disabled={isRunning}
                >
                    {isRunning ? (
                        <>
                            <RotateCw className="icon-spin" size={16} />
                            <span>Running...</span>
                        </>
                    ) : (
                        <>
                            <Play size={16} />
                            <span>Run Tests</span>
                        </>
                    )}
                </button>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={handleClose}>
                    <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
                        <h2 className="modal-title">Run API Tests</h2>

                        <p className="modal-description">
                            Enter a GitHub repository URL to analyze endpoints, generate tests, and execute them.
                        </p>

                        <div className="form-group">
                            <label htmlFor="repoUrl">GitHub Repository URL</label>
                            <div className="input-wrapper">
                                <input
                                    id="repoUrl"
                                    type="text"
                                    list="repo-history"
                                    placeholder="https://github.com/owner/repo"
                                    value={repoUrl}
                                    onChange={(e) => setRepoUrl(e.target.value)}
                                    disabled={isRunning}
                                    className="input"
                                    autoFocus
                                />
                                <datalist id="repo-history">
                                    {history.map((url, i) => (
                                        <option key={i} value={url} />
                                    ))}
                                </datalist>
                            </div>
                            <small className="input-hint">
                                Select from history or enter a new URL.
                            </small>
                        </div>

                        {/* Phase Progress Indicator */}
                        {status && status.phases && (
                            <div className="phase-progress">
                                {status.phases.map((phase, index) => (
                                    <div key={phase.id} className={`phase-step ${phase.status}`}>
                                        <div className="phase-step-indicator">
                                            {phase.status === 'completed' ? (
                                                <CheckCircle2 size={16} className="phase-step-icon complete" />
                                            ) : phase.status === 'failed' ? (
                                                <XCircle size={16} className="phase-step-icon failed" />
                                            ) : (
                                                getPhaseIcon(phase.id, phase.status)
                                            )}
                                        </div>
                                        <div className="phase-step-content">
                                            <span className="phase-step-name">{phase.name}</span>
                                            {phase.summary && (
                                                <span className="phase-step-summary">{phase.summary}</span>
                                            )}
                                        </div>
                                        {index < status.phases!.length - 1 && (
                                            <div className={`phase-connector ${phase.status === 'completed' ? 'complete' : ''}`} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Status Message */}
                        {status && (
                            <div className={`status-box status-${status.status}`}>
                                <div className="status-header">
                                    {status.status === 'running' && <div className="spinner" />}
                                    {status.status === 'completed' && <CheckCircle2 size={18} className="status-success-icon" />}
                                    {status.status === 'failed' && <XCircle size={18} className="status-error-icon" />}
                                    <span className="status-text">{status.message}</span>
                                </div>

                                {/* Agent Narrative */}
                                {status.agentNarrative && (
                                    <div className="status-narrative">
                                        {status.agentNarrative.split('\n').slice(0, 5).map((line, i) => (
                                            <p key={i}>{line || '\u00A0'}</p>
                                        ))}
                                    </div>
                                )}

                                {/* Output Log (collapsed view) */}
                                {status.output && (
                                    <details className="status-output-details">
                                        <summary>View Full Output</summary>
                                        <pre className="status-output">{status.output}</pre>
                                    </details>
                                )}
                            </div>
                        )}

                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={handleClose}
                                disabled={isRunning}
                            >
                                {isRunning ? 'Running...' : 'Cancel'}
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleRunTests}
                                disabled={isRunning || !repoUrl.trim()}
                            >
                                {isRunning ? 'Running...' : 'Start Agent'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
