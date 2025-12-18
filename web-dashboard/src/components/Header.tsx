import { useState, useEffect, useRef } from 'react';
import { Play, RotateCw, Zap, Github, X } from 'lucide-react';
import { triggerTestRun, waitForTestCompletion } from '../utils/api';
import type { RunStatusResponse } from '../utils/api';
import './Header.css';

interface HeaderProps {
    onTestComplete?: () => void;
}

export function Header({ onTestComplete }: HeaderProps) {
    const [isRunning, setIsRunning] = useState(false);
    const [status, setStatus] = useState<RunStatusResponse | null>(null);
    const [repoUrl, setRepoUrl] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

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

    // Close history dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
                setShowHistory(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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

            setStatus({ status: 'completed', message: 'Tests generated successfully!' });
            onTestComplete?.();

            setTimeout(() => {
                setIsRunning(false);
                setStatus(null);
            }, 3000);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setStatus({ status: 'failed', message });
            setIsRunning(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && repoUrl.trim() && !isRunning) {
            handleRunTests();
        }
    };

    const handleSelectHistory = (url: string) => {
        setRepoUrl(url);
        setShowHistory(false);
    };

    const clearInput = () => {
        setRepoUrl('');
        inputRef.current?.focus();
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

                {/* Always visible input section */}
                <div className="header-input-section">
                    <div className="input-container" ref={inputRef}>
                        <Github className="input-icon" size={18} />
                        <input
                            type="text"
                            className="header-input"
                            placeholder="Enter GitHub repo URL (e.g., https://github.com/owner/repo)"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            onFocus={() => history.length > 0 && setShowHistory(true)}
                            onKeyDown={handleKeyDown}
                            disabled={isRunning}
                        />
                        {repoUrl && !isRunning && (
                            <button className="input-clear" onClick={clearInput} title="Clear">
                                <X size={16} />
                            </button>
                        )}

                        {/* History dropdown */}
                        {showHistory && history.length > 0 && !isRunning && (
                            <div className="history-dropdown">
                                <div className="history-label">Recent repositories</div>
                                {history.map((url, i) => (
                                    <button
                                        key={i}
                                        className="history-item"
                                        onClick={() => handleSelectHistory(url)}
                                    >
                                        <Github size={14} />
                                        <span>{url.replace('https://github.com/', '')}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        className="btn btn-primary"
                        onClick={handleRunTests}
                        disabled={isRunning || !repoUrl.trim()}
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
            </div>

            {/* Status bar below header */}
            {status && (
                <div className={`status-bar status-bar-${status.status}`}>
                    <div className="container status-bar-content">
                        {status.status === 'running' && <div className="spinner-small" />}
                        <span className="status-bar-message">{status.message}</span>
                        {status.output && (
                            <details className="status-bar-details">
                                <summary>View output</summary>
                                <pre className="status-bar-output">{status.output}</pre>
                            </details>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}
