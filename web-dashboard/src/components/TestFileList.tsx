import { useState, useEffect } from 'react';
import { FileCode2, Trash2, RefreshCw, Eye } from 'lucide-react';
import { listTestFiles, deleteTestFile } from '../utils/api';
import type { TestFileInfo } from '../utils/api';
import './TestFileList.css';

interface TestFileListProps {
    onRefresh?: () => void;
    selectedFile?: string | null;
    onSelectFile?: (filename: string | null) => void;
}

export function TestFileList({ onRefresh, selectedFile, onSelectFile }: TestFileListProps) {
    const [files, setFiles] = useState<TestFileInfo[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const data = await listTestFiles();
            setFiles(data);
        } catch (err) {
            console.error('Failed to load test files:', err);
            setFiles([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, []);

    const handleDelete = async (filename: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering file selection
        if (!confirm(`Delete ${filename}?`)) return;

        try {
            await deleteTestFile(filename);
            setFiles(files.filter(f => f.filename !== filename));
            // If the deleted file was selected, clear selection
            if (selectedFile === filename) {
                onSelectFile?.(null);
            }
            onRefresh?.();
        } catch (err) {
            console.error('Failed to delete file:', err);
        }
    };

    const handleSelectFile = (filename: string) => {
        // Toggle selection: if already selected, deselect
        if (selectedFile === filename) {
            onSelectFile?.(null);
        } else {
            onSelectFile?.(filename);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        return `${(bytes / 1024).toFixed(1)} KB`;
    };

    return (
        <div className="test-file-list">
            <div className="test-file-list-header">
                <FileCode2 size={16} />
                <span>Test Files</span>
                <button className="btn-icon" onClick={fetchFiles} title="Refresh">
                    <RefreshCw size={14} className={loading ? 'icon-spin' : ''} />
                </button>
            </div>

            <div className="test-file-list-content">
                {loading ? (
                    <div className="test-file-loading">
                        <div className="spinner" />
                    </div>
                ) : files.length === 0 ? (
                    <div className="test-file-empty">
                        <p>No test files found.</p>
                        <p className="text-muted">Run the agent via <code>adk web</code> to generate tests.</p>
                    </div>
                ) : (
                    <>
                        {/* Show All option when a file is selected */}
                        {selectedFile && (
                            <button
                                className="test-file-show-all"
                                onClick={() => onSelectFile?.(null)}
                            >
                                <Eye size={14} />
                                <span>Show All Tests</span>
                            </button>
                        )}
                        <ul className="test-file-items">
                            {files.map((file) => (
                                <li
                                    key={file.filename}
                                    className={`test-file-item ${selectedFile === file.filename ? 'selected' : ''}`}
                                    onClick={() => handleSelectFile(file.filename)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSelectFile(file.filename)}
                                >
                                    <div className="test-file-info">
                                        <span className="test-file-name">{file.name}</span>
                                        <span className="test-file-size">{formatSize(file.size)}</span>
                                    </div>
                                    <button
                                        className="test-file-delete"
                                        onClick={(e) => handleDelete(file.filename, e)}
                                        title="Delete test file"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>

            <div className="test-file-list-footer">
                <span>{files.length} file{files.length !== 1 ? 's' : ''}</span>
                {selectedFile && (
                    <span className="selected-indicator">• Filtering by: {files.find(f => f.filename === selectedFile)?.name}</span>
                )}
            </div>
        </div>
    );
}

