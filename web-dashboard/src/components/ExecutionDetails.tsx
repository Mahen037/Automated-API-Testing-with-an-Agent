import { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp, ExternalLink, Copy, Check, FolderOpen, FileText, Clock, HardDrive } from 'lucide-react';
import './ExecutionDetails.css';

interface ExecutionDetailsProps {
    command?: string;
    duration?: string;
    exitCode?: number;
    specDirectory?: string;
    specFiles?: string[];
    reportPath?: string;
    stdout?: string;
    status?: 'success' | 'failure' | 'error' | 'running' | 'idle';
}

export function ExecutionDetails({
    command,
    duration,
    exitCode,
    specDirectory,
    specFiles = [],
    reportPath,
    stdout,
    status = 'idle'
}: ExecutionDetailsProps) {
    const [showOutput, setShowOutput] = useState(false);
    const [copied, setCopied] = useState(false);

    const copyCommand = async () => {
        if (command) {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!command && !specFiles.length) {
        return null;
    }

    const getStatusBadge = () => {
        switch (status) {
            case 'success':
                return <span className="exec-badge success">Passed</span>;
            case 'failure':
                return <span className="exec-badge error">Failed</span>;
            case 'error':
                return <span className="exec-badge error">Error</span>;
            case 'running':
                return <span className="exec-badge running">Running</span>;
            default:
                return null;
        }
    };

    return (
        <div className="execution-details">
            <div className="exec-header">
                <div className="exec-header-left">
                    <Terminal size={18} />
                    <h3>Execution Details</h3>
                    {getStatusBadge()}
                </div>
            </div>

            <div className="exec-content">
                {/* Command Line */}
                {command && (
                    <div className="exec-row">
                        <span className="exec-label">Command</span>
                        <div className="exec-command">
                            <code>{command}</code>
                            <button
                                className="btn-icon"
                                onClick={copyCommand}
                                title="Copy command"
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>
                )}

                {/* Stats Row */}
                <div className="exec-stats">
                    {duration && (
                        <div className="exec-stat">
                            <Clock size={14} />
                            <span className="stat-label">Duration</span>
                            <span className="stat-value">{duration}</span>
                        </div>
                    )}
                    {exitCode !== undefined && (
                        <div className="exec-stat">
                            <HardDrive size={14} />
                            <span className="stat-label">Exit Code</span>
                            <span className={`stat-value ${exitCode === 0 ? 'success' : 'error'}`}>
                                {exitCode}
                            </span>
                        </div>
                    )}
                    {specFiles.length > 0 && (
                        <div className="exec-stat">
                            <FileText size={14} />
                            <span className="stat-label">Specs</span>
                            <span className="stat-value">{specFiles.length} file{specFiles.length !== 1 ? 's' : ''}</span>
                        </div>
                    )}
                </div>

                {/* Spec Directory */}
                {specDirectory && (
                    <div className="exec-row">
                        <span className="exec-label">
                            <FolderOpen size={14} />
                            Spec Directory
                        </span>
                        <code className="exec-path">{specDirectory}</code>
                    </div>
                )}

                {/* Spec Files List */}
                {specFiles.length > 0 && (
                    <div className="exec-files">
                        <span className="exec-label">
                            <FileText size={14} />
                            Test Files
                        </span>
                        <ul>
                            {specFiles.map((file, i) => (
                                <li key={i}>
                                    <FileText size={12} />
                                    {file}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Report Link */}
                {reportPath && (
                    <div className="exec-row">
                        <span className="exec-label">
                            <FileText size={14} />
                            HTML Report
                        </span>
                        <div className="exec-report-link">
                            <code className="exec-path">{reportPath}</code>
                            <a
                                href={`file://${reportPath}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-icon"
                                title="Open report"
                            >
                                <ExternalLink size={14} />
                            </a>
                        </div>
                    </div>
                )}

                {/* Stdout/Output */}
                {stdout && (
                    <div className="exec-output">
                        <div
                            className="exec-output-header"
                            onClick={() => setShowOutput(!showOutput)}
                        >
                            <span>Test Output</span>
                            {showOutput ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                        {showOutput && (
                            <pre className="exec-output-content">
                                {stdout}
                            </pre>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
