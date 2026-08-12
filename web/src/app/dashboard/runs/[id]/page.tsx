'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSubscription } from '@apollo/client';
import { useUserData } from '@nhost/nextjs';
import { nhost } from '@/lib/nhost';
import { WATCH_WORKFLOW_RUN, WATCH_STEP_RUNS } from '@/lib/graphql';
import { StatusBadge } from '@/components/StatusBadge';
import { ReactFlow, Background, Controls, Node, Edge, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { RunNode } from '@/components/RunNode';
import Link from 'next/link';

const nodeTypes = {
  runNode: RunNode,
};

function formatRunDuration(
  status?: string,
  startedAt?: string,
  completedAt?: string,
  updatedAt?: string
): string {
  if (!startedAt) return 'Duration unavailable';
  const startMs = new Date(startedAt).getTime();
  if (isNaN(startMs) || startMs <= 0) return 'Duration unavailable';

  let endMs: number;
  const normalizedStatus = (status || '').toLowerCase();

  if (normalizedStatus === 'running') {
    endMs = Date.now();
  } else if (completedAt) {
    endMs = new Date(completedAt).getTime();
  } else if (updatedAt) {
    endMs = new Date(updatedAt).getTime();
  } else {
    return 'Duration unavailable';
  }

  if (isNaN(endMs) || endMs < startMs) return 'Duration unavailable';
  const diffMs = Math.max(0, endMs - startMs);

  // Sanity threshold: If duration exceeds 24 hours (86,400,000 ms), treat as corrupt/stale
  if (diffMs > 86400000) return 'Duration unavailable';

  if (diffMs < 1000) return `${diffMs}ms`;
  const totalSec = Math.floor(diffMs / 1000);
  if (totalSec < 60) return `${(diffMs / 1000).toFixed(1)}s`;
  const mins = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${mins}m ${sec}s`;
}

export default function RunViewer() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const user = useUserData();

  const { data: runData } = useSubscription(WATCH_WORKFLOW_RUN, { variables: { runId: id } });
  const { data: stepsData } = useSubscription(WATCH_STEP_RUNS, { variables: { workflowRunId: id } });
  
  const [isApproving, setIsApproving] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [selectedStepRunId, setSelectedStepRunId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const run = runData?.workflow_runs_by_pk;
  const steps = stepsData?.step_runs || [];

  const handleApprove = async (stepRunId: string) => {
    setIsApproving(true);
    try {
      const token = nhost.auth.getAccessToken();
      const res = await fetch('/api/approve-step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ stepRunId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to approve step');
      }
    } catch (err: any) {
      console.error('Error approving step:', err);
      alert(err.message || 'Failed to approve step');
    } finally {
      setIsApproving(false);
    }
  };

  const handleCancelRun = async () => {
    if (!id || isActionLoading) return;
    if (!confirm('Are you sure you want to cancel this workflow run?')) return;
    setIsActionLoading(true);
    try {
      const token = nhost.auth.getAccessToken();
      const res = await fetch('/api/cancel-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ workflowRunId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to cancel workflow run');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to cancel workflow run');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRunAgain = async () => {
    if (!run?.workflow_id) return;
    setIsActionLoading(true);
    try {
      const token = nhost.auth.getAccessToken();
      const res = await fetch('/api/trigger-workflow-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ workflow_id: run.workflow_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to start new run');
      }
      if (data.workflow_run_id) {
        router.push(`/dashboard/runs/${data.workflow_run_id}`);
      }
    } catch (err: any) {
      alert(err.message || 'Error starting new run');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRetryStep = async (stepRunId: string) => {
    if (!stepRunId) return;
    setIsActionLoading(true);
    try {
      const token = nhost.auth.getAccessToken();
      const res = await fetch('/api/approve-step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ stepRunId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to retry step');
      }
    } catch (err: any) {
      alert(err.message || 'Error retrying step');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Check if run is stuck (running for > 10 minutes without update)
  const isStuckRun = useMemo(() => {
    if (!run || run.status !== 'running') return false;
    const lastActiveMs = new Date(run.updated_at || run.started_at).getTime();
    if (isNaN(lastActiveMs) || lastActiveMs <= 0) return false;
    return Date.now() - lastActiveMs > 10 * 60 * 1000;
  }, [run]);

  // Re-build nodes and edges when steps change
  useEffect(() => {
    if (!steps || steps.length === 0) return;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    
    // Sort steps by order
    const sortedSteps = [...steps].sort((a: any, b: any) => 
      (a.workflow_step?.step_order || 0) - (b.workflow_step?.step_order || 0)
    );

    let currentY = 100;

    sortedSteps.forEach((stepRun: any, index: number) => {
      const isSelected = stepRun.id === selectedStepRunId;
      const stepType = stepRun.workflow_step?.step_type || 'unknown';
      const prevStep = index > 0 ? sortedSteps[index - 1] : null;
      const isPrevBranch = prevStep?.workflow_step?.step_type === 'conditional_branch';

      // Visual branching layout: if previous step was conditional branch, offset downwards
      if (isPrevBranch) {
        currentY = 220;
      } else if (prevStep && prevStep.workflow_step?.step_type !== 'conditional_branch' && currentY > 100) {
        if (stepType === 'approval_gate' || stepType === 'notify') {
          currentY = 100;
        }
      }

      newNodes.push({
        id: stepRun.id,
        type: 'runNode',
        position: { x: index * 350, y: currentY },
        data: {
          stepRunId: stepRun.id,
          name: stepRun.workflow_step?.name || `Step ${index + 1}`,
          type: stepType,
          order: stepRun.workflow_step?.step_order || index + 1,
          status: stepRun.status,
          startedAt: stepRun.started_at,
          completedAt: stepRun.completed_at,
          attemptCount: stepRun.attempt_count,
          onApprove: handleApprove,
          isApproving,
          isSelected,
          onClick: () => setSelectedStepRunId(stepRun.id)
        },
      });

      if (index > 0 && prevStep) {
        const isEdgeBranch = prevStep.workflow_step?.step_type === 'conditional_branch';
        newEdges.push({
          id: `e-${prevStep.id}-${stepRun.id}`,
          source: prevStep.id,
          sourceHandle: isEdgeBranch ? 'bottom-source' : 'right-source',
          target: stepRun.id,
          targetHandle: isEdgeBranch ? 'top-target' : undefined,
          animated: stepRun.status === 'running' || stepRun.status === 'pending',
          label: isEdgeBranch ? 'True Path' : undefined,
          labelStyle: { fill: '#9ca3af', fontSize: '11px', fontWeight: 600 },
          labelBgStyle: { fill: '#111827', fillOpacity: 0.8 },
          style: { stroke: isEdgeBranch ? '#3b82f6' : 'var(--text-secondary)', strokeWidth: 2 }
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [steps, selectedStepRunId, isApproving, setNodes, setEdges]);

  const selectedStepData = useMemo(() => {
    return steps.find((s: any) => s.id === selectedStepRunId);
  }, [steps, selectedStepRunId]);

  const pausedStepRun = useMemo(() => {
    return steps.find((s: any) => s.status === 'awaiting_approval');
  }, [steps]);

  const failedStepRun = useMemo(() => {
    return steps.find((s: any) => s.status === 'failed');
  }, [steps]);

  const completedStepsCount = useMemo(() => {
    return steps.filter((s: any) => s.status === 'completed').length;
  }, [steps]);

  const totalStepsCount = run?.workflow?.workflow_steps?.length || steps.length;
  const overallDurationStr = formatRunDuration(run?.status, run?.started_at, run?.completed_at, run?.updated_at);

  if (!run) return <div className="page-body">Loading run console...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Console Top Header Bar */}
      <div className="page-header" style={{ flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '1rem' }}>
          
          {/* Back & Workflow Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link 
              href={`/dashboard/workflows/${run.workflow_id || ''}`}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#9ca3af' }}
            >
              ← Back to Workflow
            </Link>
            <div>
              <h1 className="page-title" style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {run.workflow?.name || 'Execution Console'}
              </h1>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Run ID: <span style={{ fontFamily: 'monospace', color: '#d1d5db' }}>{id}</span>
              </div>
            </div>
          </div>

          {/* Console Controls & Badges */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {/* Trigger Type Badge */}
            <span style={{ 
              fontSize: '0.75rem', 
              fontWeight: 700, 
              padding: '0.25rem 0.625rem', 
              borderRadius: '9999px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#9ca3af',
              textTransform: 'uppercase'
            }}>
              ⚡ {run.trigger_type || 'Manual'}
            </span>

            {/* Step Progress Badge */}
            <span style={{ 
              fontSize: '0.75rem', 
              fontWeight: 700, 
              padding: '0.25rem 0.625rem', 
              borderRadius: '9999px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#60a5fa'
            }}>
              📊 {completedStepsCount} / {totalStepsCount} Steps
            </span>

            {/* Duration */}
            {overallDurationStr && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                ⏱ {overallDurationStr}
              </span>
            )}

            <StatusBadge status={run.status} />

            {/* Contextual Primary Action Control Buttons */}
            {run.status === 'running' && (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleCancelRun}
                disabled={isActionLoading}
                style={{ fontWeight: 600 }}
              >
                ✕ Cancel Run
              </button>
            )}

            {run.status === 'paused' && (
              <>
                {pausedStepRun && (
                  <button
                    className="btn btn-primary"
                    style={{
                      backgroundColor: '#f59e0b',
                      backgroundImage: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      borderColor: '#d97706',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.8125rem',
                      padding: '0.45rem 1rem',
                      boxShadow: '0 0 15px rgba(245, 158, 11, 0.4)'
                    }}
                    onClick={() => handleApprove(pausedStepRun.id)}
                    disabled={isApproving}
                  >
                    {isApproving ? 'Approving...' : '✓ Approve & Continue'}
                  </button>
                )}
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleCancelRun}
                  disabled={isActionLoading}
                  style={{ fontWeight: 600 }}
                >
                  ✕ Cancel Run
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleRunAgain}
                  disabled={isActionLoading}
                  style={{ fontWeight: 600 }}
                >
                  🔄 Run Again
                </button>
              </>
            )}

            {run.status === 'failed' && (
              <>
                {failedStepRun && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleRetryStep(failedStepRun.id)}
                    disabled={isActionLoading}
                    style={{ fontWeight: 600 }}
                  >
                    ⚡ Retry Step
                  </button>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleRunAgain}
                  disabled={isActionLoading}
                  style={{ fontWeight: 600 }}
                >
                  🔄 Run Again
                </button>
              </>
            )}

            {(run.status === 'completed' || run.status === 'cancelled') && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRunAgain}
                disabled={isActionLoading}
                style={{ fontWeight: 600 }}
              >
                🔄 Run Again
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stuck Run Recovery Banner */}
      {isStuckRun && (
        <div style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#ffffff'
        }}>
          <div>
            ⚠️ <strong>Execution appears to be stuck</strong> — No step has reported progress in over 10 minutes.
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => window.location.reload()}
            >
              🔄 Refresh Status
            </button>
            <button 
              className="btn btn-danger btn-sm"
              onClick={handleCancelRun}
              disabled={isActionLoading}
            >
              ✕ Cancel Run
            </button>
          </div>
        </div>
      )}

      {/* Execution Summary Banner */}
      <div style={{
        padding: '0.75rem 1.5rem',
        backgroundColor: run.status === 'paused' 
          ? 'rgba(245, 158, 11, 0.12)' 
          : run.status === 'failed'
            ? 'rgba(239, 68, 68, 0.12)'
            : run.status === 'cancelled'
              ? 'rgba(107, 114, 128, 0.15)'
              : run.status === 'completed'
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(59, 130, 246, 0.12)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        fontSize: '0.875rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: '#ffffff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {run.status === 'paused' && (
            <span>
              ⚠️ <strong>Run paused at {pausedStepRun?.workflow_step?.name || 'Manager Approval'}</strong> — {completedStepsCount} of {totalStepsCount} steps completed. Waiting for an authorized <strong>Owner or Editor</strong> to approve.
            </span>
          )}
          {run.status === 'completed' && (
            <span>
              ✅ <strong>Run completed successfully</strong> — All {totalStepsCount} steps executed cleanly {overallDurationStr && overallDurationStr !== 'Duration unavailable' ? `in ${overallDurationStr}` : ''}.
            </span>
          )}
          {run.status === 'failed' && (
            <span>
              ❌ <strong>Run failed at {failedStepRun?.workflow_step?.name || 'step'}</strong> — {completedStepsCount} of {totalStepsCount} steps completed.
            </span>
          )}
          {run.status === 'cancelled' && (
            <span>
              ■ <strong>Run cancelled by user</strong> — Execution halted ({completedStepsCount} of {totalStepsCount} steps completed).
            </span>
          )}
          {run.status === 'running' && !isStuckRun && (
            <span>
              ⚡ <strong>Execution in progress</strong> — Processing steps ({completedStepsCount} / {totalStepsCount} completed)...
            </span>
          )}
        </div>
      </div>
      
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* React Flow Canvas Area */}
        <div style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.4}
            maxZoom={1.5}
          >
            <Background color="rgba(255, 255, 255, 0.05)" gap={20} size={1} />
            <Controls />
          </ReactFlow>
          
          {run.error && (
            <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px', zIndex: 10 }}>
              <div className="glass-card" style={{ borderColor: 'var(--color-danger)', backgroundColor: 'rgba(17, 24, 39, 0.95)' }}>
                <h3 style={{ color: 'var(--color-danger)', marginBottom: '0.5rem', fontSize: '1rem', fontWeight: 700 }}>Run Error Details</h3>
                <pre className="log-viewer log-error">{run.error}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Side Panel Drawer for Selected Node details */}
        {selectedStepRunId && selectedStepData && (
          <div style={{ 
            width: '420px', 
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(17, 24, 39, 0.98)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideInRight 0.3s ease',
            zIndex: 20
          }}>
            <div style={{ 
              padding: '1.25rem', 
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#fff' }}>{selectedStepData.workflow_step?.name}</h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Step {selectedStepData.workflow_step?.step_order} • Type: <span style={{ color: '#60a5fa', fontWeight: 600 }}>{selectedStepData.workflow_step?.step_type}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStepRunId(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#d1d5db' }}>Status</span>
                <StatusBadge status={selectedStepData.status} />
              </div>

              {/* Sub-meta metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Duration</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>
                    {formatRunDuration(selectedStepData.status, selectedStepData.started_at, selectedStepData.completed_at)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Attempts</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>
                    #{selectedStepData.attempt_count || 1}
                  </div>
                </div>
              </div>
              
              {/* Approval Box if awaiting approval */}
              {selectedStepData.status === 'awaiting_approval' && (
                <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px' }}>
                  <h4 style={{ color: 'var(--color-warning)', marginBottom: '0.25rem', fontWeight: 700, fontSize: '0.95rem' }}>⚠️ Manual Approval Required</h4>
                  <p style={{ fontSize: '0.8125rem', marginBottom: '0.75rem', color: '#d1d5db' }}>
                    This approval gate step requires confirmation from a user with <strong>Owner</strong> or <strong>Editor</strong> organization role.
                  </p>
                  <button 
                    className="btn btn-primary" 
                    style={{ 
                      width: '100%', 
                      backgroundColor: '#f59e0b',
                      backgroundImage: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      borderColor: '#d97706',
                      fontWeight: 700,
                      boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)'
                    }}
                    onClick={() => handleApprove(selectedStepData.id)}
                    disabled={isApproving}
                  >
                    {isApproving ? 'Approving...' : '✓ Approve & Continue'}
                  </button>
                </div>
              )}

              {/* Approved Information */}
              {selectedStepData.approved_by && (
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', fontSize: '0.8125rem', color: '#6ee7b7' }}>
                  <div>✓ <strong>Approved by User:</strong> {selectedStepData.approved_by}</div>
                  {selectedStepData.approved_at && (
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                      Approved at: {new Date(selectedStepData.approved_at).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              {/* Input Data */}
              {selectedStepData.input && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Input Data</div>
                  <pre className="log-viewer log-input">{JSON.stringify(selectedStepData.input, null, 2)}</pre>
                </div>
              )}
              
              {/* Output Data */}
              {selectedStepData.output && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Output Data</div>
                  <pre className="log-viewer">{JSON.stringify(selectedStepData.output, null, 2)}</pre>
                </div>
              )}
              
              {/* Error Data */}
              {selectedStepData.error && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Error Details</div>
                  <pre className="log-viewer log-error">{selectedStepData.error}</pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
