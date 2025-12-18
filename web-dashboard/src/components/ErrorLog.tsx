import { AlertTriangle, FileWarning, Wrench, RotateCw } from 'lucide-react';
import type { ReportError } from '../utils/types';
import './ErrorLog.css';

interface ErrorLogProps {
    errors: ReportError[];
    onFixAndRetry?: () => void;
    isFixing?: boolean;
}

// Detect if errors are likely fixable (smart quotes, etc.)
function hasFixableErrors(errors: ReportError[]): boolean {
    const fixablePatterns = [
        /unexpected token/i,
        /unterminated string/i,
        /invalid character/i,
        /syntax.*error/i,
    ];
    
    return errors.some(error => 
        fixablePatterns.some(pattern => pattern.test(error.message))
    );
}

export function ErrorLog({ errors, onFixAndRetry, isFixing }: ErrorLogProps) {
    if (errors.length === 0) {
        return null;
    }

    const showFixButton = hasFixableErrors(errors) && onFixAndRetry;

    return (
        <div className="error-log-container">
            <div className="error-log-header">
                <div className="error-log-header-left">
                    <AlertTriangle size={20} className="error-log-icon" />
                    <h3>Compilation Errors</h3>
                    <span className="error-count">{errors.length}</span>
                </div>
                {showFixButton && (
                    <button
                        className="btn btn-fix"
                        onClick={onFixAndRetry}
                        disabled={isFixing}
                        title="Automatically fix common syntax issues (smart quotes, etc.) and retry"
                    >
                        {isFixing ? (
                            <>
                                <RotateCw size={14} className="icon-spin" />
                                <span>Fixing...</span>
                            </>
                        ) : (
                            <>
                                <Wrench size={14} />
                                <span>Fix & Retry</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            {showFixButton && (
                <div className="error-log-hint">
                    <span>💡</span>
                    <span>These errors may be caused by smart quotes or special characters in the generated code. Click "Fix & Retry" to automatically fix and re-run tests.</span>
                </div>
            )}

            <div className="error-log-list">
                {errors.map((error, index) => (
                    <div key={index} className="error-log-item">
                        <div className="error-log-location">
                            <FileWarning size={14} />
                            {error.location ? (
                                <span>
                                    {error.location.file.split('/').pop()}
                                    <span className="line-number">:{error.location.line}:{error.location.column}</span>
                                </span>
                            ) : (
                                <span>Unknown location</span>
                            )}
                        </div>
                        <div className="error-log-message">
                            {error.message.split('\n')[0]}
                        </div>
                        {error.snippet && (
                            <pre className="error-log-snippet">{error.snippet}</pre>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
