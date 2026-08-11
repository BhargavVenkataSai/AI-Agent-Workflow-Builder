'use client';

interface UsageIndicatorProps {
  quotaUsed?: number;
  quotaLimit?: number;
}

export const UsageIndicator = ({ quotaUsed = 0, quotaLimit = 0 }: UsageIndicatorProps) => {
  const safeUsed = quotaUsed ?? 0;
  const safeLimit = quotaLimit ?? 0;
  const percentage = safeLimit > 0 ? Math.min(100, Math.max(0, (safeUsed / safeLimit) * 100)) : 0;
  
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
        <span className="usage-value">{safeUsed} / {safeLimit}</span>
      </div>
      <div className="usage-track">
        <div className={`usage-fill ${colorClass}`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
};

