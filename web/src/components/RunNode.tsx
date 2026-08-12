import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { StepTypeIcon } from './StepTypeIcon';

interface RunNodeProps {
  data: {
    stepRunId: string;
    name: string;
    type: string;
    order: number;
    status: string;
    startedAt?: string;
    completedAt?: string;
    attemptCount?: number;
    onApprove?: (stepRunId: string) => void;
    isApproving?: boolean;
    onClick: () => void;
    isSelected?: boolean;
  };
}

function formatDuration(startedAt?: string, completedAt?: string): string | null {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);
  if (diffMs < 1000) return `${diffMs}ms`;
  return `${(diffMs / 1000).toFixed(1)}s`;
}

export function RunNode({ data }: RunNodeProps) {
  const {
    stepRunId,
    name,
    type,
    order,
    status,
    startedAt,
    completedAt,
    attemptCount,
    onApprove,
    isApproving,
    onClick,
    isSelected,
  } = data;

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return '#10b981';
      case 'failed': return '#ef4444';
      case 'running': return '#3b82f6';
      case 'awaiting_approval': return '#f59e0b';
      case 'skipped': return '#6b7280';
      case 'pending': default: return '#6b7280';
    }
  };

  const statusColor = getStatusColor(status);
  const isRunning = status?.toLowerCase() === 'running';
  const isAwaitingApproval = status?.toLowerCase() === 'awaiting_approval';
  const durationStr = formatDuration(startedAt, completedAt);

  return (
    <div 
      className={`glass-card run-node ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      style={{ 
        width: '300px',
        padding: '1rem',
        cursor: 'pointer',
        border: isAwaitingApproval 
          ? '2px solid #f59e0b'
          : `2px solid ${isSelected ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)'}`,
        boxShadow: isAwaitingApproval
          ? '0 0 20px rgba(245, 158, 11, 0.4)'
          : isSelected 
            ? '0 0 15px rgba(59, 130, 246, 0.4)' 
            : '0 4px 12px rgba(0, 0, 0, 0.3)',
        position: 'relative',
        transition: 'all 0.2s ease',
        backgroundColor: isAwaitingApproval ? 'rgba(30, 25, 15, 0.95)' : 'rgba(17, 24, 39, 0.9)',
        borderRadius: '12px'
      }}
    >
      {/* Handles for flow connections */}
      <Handle type="target" position={Position.Left} style={{ background: '#9ca3af', width: '8px', height: '8px', border: 'none' }} />
      <Handle type="target" position={Position.Top} id="top-target" style={{ background: '#9ca3af', width: '8px', height: '8px', border: 'none' }} />

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

      {/* Header Info */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ 
          width: '40px', height: '40px', 
          borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: isAwaitingApproval ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
          color: statusColor,
          flexShrink: 0,
          border: `1px solid ${statusColor}33`
        }}>
          <StepTypeIcon type={type} />
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontSize: '0.6875rem', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em',
            color: 'var(--text-secondary)',
            marginBottom: '0.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>Step {order}</span>
            <span style={{ 
              color: statusColor, 
              fontWeight: 700,
              textShadow: isRunning ? `0 0 8px ${statusColor}` : 'none'
            }}>
              {status ? status.replace('_', ' ').toUpperCase() : 'PENDING'}
            </span>
          </div>

          <div style={{ 
            fontSize: '0.9375rem', 
            fontWeight: 700, 
            color: '#fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: '0.25rem'
          }}>
            {name}
          </div>

          {/* Sub-meta: Duration and Attempt Count */}
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.725rem', color: '#9ca3af' }}>
            {durationStr && <span>⏱ {durationStr}</span>}
            {attemptCount !== undefined && attemptCount > 0 && (
              <span>🔄 Attempt #{attemptCount}</span>
            )}
          </div>
        </div>
      </div>

      {/* Prominent Manual Approval Box inside Node */}
      {isAwaitingApproval && (
        <div style={{ 
          marginTop: '0.75rem', 
          paddingTop: '0.75rem', 
          borderTop: '1px solid rgba(245, 158, 11, 0.3)',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          borderRadius: '8px',
          padding: '0.625rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 700, marginBottom: '0.2rem' }}>
            ⚠️ Waiting for approval
          </div>
          <div style={{ fontSize: '0.7rem', color: '#d1d5db', marginBottom: '0.5rem' }}>
            Required Role: <span style={{ color: '#ffffff', fontWeight: 600 }}>Owner / Editor</span>
          </div>

          {onApprove && (
            <button
              type="button"
              className="btn btn-primary"
              style={{
                width: '100%',
                backgroundColor: '#f59e0b',
                backgroundImage: 'linear-gradient(135deg, #f59e0b, #d97706)',
                borderColor: '#d97706',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.75rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                cursor: isApproving ? 'wait' : 'pointer',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
                border: 'none',
                transition: 'all 0.2s ease'
              }}
              onClick={(e) => {
                e.stopPropagation();
                onApprove(stepRunId);
              }}
              disabled={isApproving}
            >
              {isApproving ? 'Approving...' : '✓ Approve & Continue'}
            </button>
          )}
        </div>
      )}

      {/* Source Handles for standard or branch connections */}
      <Handle type="source" position={Position.Right} id="right-source" style={{ background: '#9ca3af', width: '8px', height: '8px', border: 'none' }} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" style={{ background: '#9ca3af', width: '8px', height: '8px', border: 'none' }} />
    </div>
  );
}
