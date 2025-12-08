import { useState, useEffect } from 'react';
import { Play, RotateCw, Zap } from 'lucide-react';
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

            setStatus({ status: 'completed', message: 'Completed!' });
            onTestComplete?.();

            setTimeout(() => {
                setShowModal(false);
                setIsRunning(false);
                setStatus(null);
                setRepoUrl('');
            }, 2000);
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
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
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

                        {status && (
                            <div className={`status-box status-${status.status}`}>
                                <div className="status-header">
                                    {status.status === 'running' && <div className="spinner" />}
                                    <span className="status-text">{status.message}</span>
                                </div>
                                {status.output && (
                                    <pre className="status-output">{status.output}</pre>
                                )}
                            </div>
                        )}

                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={handleClose}
                                disabled={isRunning}
                            >
                                {isRunning ? 'Close' : 'Cancel'}
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
