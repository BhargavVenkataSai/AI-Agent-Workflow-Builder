import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { StepTypeIcon } from './StepTypeIcon';

interface RunNodeProps {
  data: {
    name: string;
    type: string;
    order: number;
    status: string;
    onClick: () => void;
    isSelected?: boolean;
  };
}

export function RunNode({ data }: RunNodeProps) {
  const { name, type, order, status, onClick, isSelected } = data;

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'var(--color-success)';
      case 'failed': return 'var(--color-danger)';
      case 'running': return 'var(--color-primary)';
      case 'awaiting_approval': return 'var(--color-warning)';
      case 'skipped': return 'var(--text-secondary)';
      case 'pending': default: return 'var(--text-secondary)';
    }
  };

  const statusColor = getStatusColor(status);
  const isRunning = status?.toLowerCase() === 'running';

  return (
    <div 
      className={`glass-card run-node ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      style={{ 
        width: '280px',
        padding: '1rem',
        cursor: 'pointer',
        border: `2px solid ${isSelected ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isSelected ? '0 0 15px rgba(59, 130, 246, 0.3)' : 'none',
        position: 'relative',
        transition: 'all 0.2s ease',
        backgroundColor: 'rgba(17, 24, 39, 0.8)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--text-secondary)', width: '8px', height: '8px', border: 'none' }} />
      
      {/* Pulse animation for running state */}
      {isRunning && (
        <div style={{
          position: 'absolute',
          top: -2, left: -2, right: -2, bottom: -2,
          borderRadius: 'inherit',
          border: `2px solid ${statusColor}`,
          animation: 'pulse 2s infinite',
          pointerEvents: 'none'
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ 
          width: '36px', height: '36px', 
          borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.05)',
          color: statusColor,
          flexShrink: 0
        }}>
          <StepTypeIcon type={type} />
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontSize: '0.7rem', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em',
            color: 'var(--text-secondary)',
            marginBottom: '0.25rem',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>Step {order}</span>
            <span style={{ 
              color: statusColor, 
              fontWeight: 600,
              textShadow: isRunning ? `0 0 8px ${statusColor}` : 'none'
            }}>
              {status || 'Unknown'}
            </span>
          </div>
          <div style={{ 
            fontSize: '0.95rem', 
            fontWeight: 600, 
            color: '#fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {name}
          </div>
        </div>
      </div>
      
      <Handle type="source" position={Position.Right} style={{ background: 'var(--text-secondary)', width: '8px', height: '8px', border: 'none' }} />
    </div>
  );
}
