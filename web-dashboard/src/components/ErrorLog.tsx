import { AlertTriangle, FileWarning } from 'lucide-react';
import type { ReportError } from '../utils/types';
import './ErrorLog.css';

interface ErrorLogProps {
    errors: ReportError[];
}

export function ErrorLog({ errors }: ErrorLogProps) {
    if (errors.length === 0) {
        return null;
    }

    return (
        <div className="error-log-container">
            <div className="error-log-header">
                <AlertTriangle size={20} className="error-log-icon" />
                <h3>Compilation Errors</h3>
                <span className="error-count">{errors.length}</span>
            </div>

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
