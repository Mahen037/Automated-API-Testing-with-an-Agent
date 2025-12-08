import type { ReactNode } from 'react';
import './SummaryCard.css';

interface SummaryCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: ReactNode;
    variant?: 'default' | 'success' | 'error' | 'warning';
}

export function SummaryCard({
    title,
    value,
    subtitle,
    icon,
    variant = 'default'
}: SummaryCardProps) {
    return (
        <div className={`summary-card ${variant}`}>
            <div className="summary-card-header">
                <span className="summary-card-title">{title}</span>
                <div className="summary-card-icon">{icon}</div>
            </div>
            <div className="summary-card-value">{value}</div>
            {subtitle && (
                <div className="summary-card-subtitle">{subtitle}</div>
            )}
        </div>
    );
}

interface SummaryCardSkeletonProps {
    count?: number;
}

export function SummaryCardSkeleton({ count = 4 }: SummaryCardSkeletonProps) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="summary-card">
                    <div className="summary-card-header">
                        <div className="skeleton" style={{ width: 80, height: 14 }} />
                        <div className="skeleton" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                    </div>
                    <div className="skeleton" style={{ width: 100, height: 40, marginTop: 8 }} />
                    <div className="skeleton" style={{ width: 60, height: 12, marginTop: 8 }} />
                </div>
            ))}
        </>
    );
}
