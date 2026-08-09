'use client';

interface StepTypeIconProps {
  type: string;
}

export const StepTypeIcon = ({ type }: StepTypeIconProps) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'llm_call':
        return { icon: '🧠', color: '#6366f1' };
      case 'http_request':
        return { icon: '🌐', color: '#3b82f6' };
      case 'db_write':
        return { icon: '💾', color: '#10b981' };
      case 'notify':
        return { icon: '🔔', color: '#f59e0b' };
      case 'conditional_branch':
        return { icon: '🔀', color: '#8b5cf6' };
      case 'approval_gate':
        return { icon: '✅', color: '#ef4444' };
      default:
        return { icon: '⚙️', color: '#6b7280' };
    }
  };

  const { icon, color } = getIcon(type);

  return (
    <div className="step-type-icon" style={{ backgroundColor: `${color}20`, border: `1px solid ${color}50` }}>
      <span role="img" aria-label={type} style={{ textShadow: `0 0 10px ${color}` }}>{icon}</span>
    </div>
  );
};
