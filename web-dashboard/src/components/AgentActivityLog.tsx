import { useState } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, Search, GitBranch, TestTube, Play, CheckCircle2, XCircle, Clock, FileCode2 } from 'lucide-react';
import './AgentActivityLog.css';

export interface AgentPhase {
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    icon: 'search' | 'generate' | 'execute';
    summary?: string;
    details?: string[];
    startTime?: Date;
    endTime?: Date;
    artifacts?: { name: string; path: string; type: 'routes' | 'tests' | 'report' }[];
}

interface AgentActivityLogProps {
    phases: AgentPhase[];
    currentPhase?: string;
    agentNarrative?: string;
    isRunning?: boolean;
    repoUrl?: string;
}

export function AgentActivityLog({ 
    phases, 
    currentPhase, 
    agentNarrative, 
    isRunning,
    repoUrl 
}: AgentActivityLogProps) {
    const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(['discovery', 'generation', 'execution']));
    const [showFullNarrative, setShowFullNarrative] = useState(true);

    const togglePhase = (phaseId: string) => {
        const newExpanded = new Set(expandedPhases);
        if (newExpanded.has(phaseId)) {
            newExpanded.delete(phaseId);
        } else {
            newExpanded.add(phaseId);
        }
        setExpandedPhases(newExpanded);
    };

    const getPhaseIcon = (iconType: string, status: string) => {
        const iconClass = `phase-icon ${status}`;
        switch (iconType) {
            case 'search':
                return <Search className={iconClass} size={18} />;
            case 'generate':
                return <TestTube className={iconClass} size={18} />;
            case 'execute':
                return <Play className={iconClass} size={18} />;
            default:
                return <FileCode2 className={iconClass} size={18} />;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle2 size={14} className="status-icon success" />;
            case 'failed':
                return <XCircle size={14} className="status-icon error" />;
            case 'running':
                return <div className="spinner-small" />;
            default:
                return <Clock size={14} className="status-icon pending" />;
        }
    };

    const formatDuration = (start?: Date, end?: Date) => {
        if (!start) return '';
        const endTime = end || new Date();
        const ms = endTime.getTime() - start.getTime();
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    return (
        <div className="agent-activity-log">
            <div className="activity-header">
                <div className="activity-header-left">
                    <MessageSquare size={20} />
                    <h2>Agent Activity</h2>
                    {isRunning && <span className="running-badge">Running</span>}
                </div>
                {repoUrl && (
                    <div className="repo-info">
                        <GitBranch size={14} />
                        <a href={repoUrl} target="_blank" rel="noopener noreferrer">
                            {repoUrl.replace('https://github.com/', '')}
                        </a>
                    </div>
                )}
            </div>

            {/* Agent Narrative Section */}
            {agentNarrative && (
                <div className="agent-narrative">
                    <div 
                        className="narrative-header"
                        onClick={() => setShowFullNarrative(!showFullNarrative)}
                    >
                        <span>Agent Response</span>
                        {showFullNarrative ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                    {showFullNarrative && (
                        <div className="narrative-content">
                            {agentNarrative.split('\n').map((line, i) => (
                                <p key={i}>{line || '\u00A0'}</p>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Pipeline Phases */}
            <div className="pipeline-phases">
                {phases.map((phase) => (
                    <div 
                        key={phase.id} 
                        className={`phase-card ${phase.status} ${currentPhase === phase.id ? 'current' : ''}`}
                    >
                        <div 
                            className="phase-header"
                            onClick={() => togglePhase(phase.id)}
                        >
                            <div className="phase-header-left">
                                {getPhaseIcon(phase.icon, phase.status)}
                                <span className="phase-name">{phase.name}</span>
                                {getStatusIcon(phase.status)}
                            </div>
                            <div className="phase-header-right">
                                {phase.startTime && (
                                    <span className="phase-duration">
                                        {formatDuration(phase.startTime, phase.endTime)}
                                    </span>
                                )}
                                {expandedPhases.has(phase.id) ? (
                                    <ChevronUp size={16} />
                                ) : (
                                    <ChevronDown size={16} />
                                )}
                            </div>
                        </div>

                        {expandedPhases.has(phase.id) && (
                            <div className="phase-body">
                                {phase.summary && (
                                    <div className="phase-summary">
                                        {phase.summary}
                                    </div>
                                )}

                                {phase.details && phase.details.length > 0 && (
                                    <ul className="phase-details">
                                        {phase.details.map((detail, i) => (
                                            <li key={i}>{detail}</li>
                                        ))}
                                    </ul>
                                )}

                                {phase.artifacts && phase.artifacts.length > 0 && (
                                    <div className="phase-artifacts">
                                        <span className="artifacts-label">Generated Files:</span>
                                        <ul>
                                            {phase.artifacts.map((artifact, i) => (
                                                <li key={i} className={`artifact-${artifact.type}`}>
                                                    <FileCode2 size={12} />
                                                    <span className="artifact-name">{artifact.name}</span>
                                                    <span className="artifact-path">{artifact.path}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// Default empty state component
export function AgentActivityEmpty() {
    return (
        <div className="agent-activity-log empty">
            <div className="activity-header">
                <MessageSquare size={20} />
                <h2>Agent Activity</h2>
            </div>
            <div className="empty-activity">
                <GitBranch size={32} />
                <h3>No Recent Activity</h3>
                <p>Click "Run Tests" to analyze a GitHub repository. The agent will:</p>
                <ol>
                    <li><Search size={14} /> <strong>Discover</strong> API endpoints from the codebase</li>
                    <li><TestTube size={14} /> <strong>Generate</strong> Playwright test specs</li>
                    <li><Play size={14} /> <strong>Execute</strong> tests and produce reports</li>
                </ol>
            </div>
        </div>
    );
}
