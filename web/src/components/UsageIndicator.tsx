'use client';

interface UsageIndicatorProps {
  quotaUsed: number;
  quotaLimit: number;
}

export const UsageIndicator = ({ quotaUsed, quotaLimit }: UsageIndicatorProps) => {
  const percentage = Math.min(100, Math.max(0, (quotaUsed / quotaLimit) * 100)) || 0;
  
  let colorClass = 'usage-progress-good';
  if (percentage > 85) {
    colorClass = 'usage-progress-danger';
  } else if (percentage > 60) {
    colorClass = 'usage-progress-warning';
  }

  return (
    <div className="usage-indicator">
      <div className="usage-header">
        <span className="usage-label">Quota Usage</span>
        <span className="usage-value">{quotaUsed} / {quotaLimit}</span>
      </div>
      <div className="usage-track">
        <div className={`usage-fill ${colorClass}`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
};
