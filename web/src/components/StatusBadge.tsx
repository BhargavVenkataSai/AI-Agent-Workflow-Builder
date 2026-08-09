'use client';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const getStatusClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'approved':
        return 'status-badge-success';
      case 'running':
        return 'status-badge-running pulse-animation';
      case 'failed':
        return 'status-badge-danger';
      case 'paused':
      case 'awaiting_approval':
        return 'status-badge-warning';
      case 'pending':
      case 'skipped':
      default:
        return 'status-badge-pending';
    }
  };

  return (
    <span className={`status-badge ${getStatusClass(status)}`}>
      {status || 'pending'}
    </span>
  );
};
