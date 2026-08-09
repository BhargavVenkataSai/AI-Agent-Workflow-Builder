'use client';
import { useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useSubscription, useMutation } from '@apollo/client';
import { WATCH_WORKFLOW_RUN, WATCH_STEP_RUNS, APPROVE_STEP } from '@/lib/graphql';
import { StatusBadge } from '@/components/StatusBadge';
import { StepTypeIcon } from '@/components/StepTypeIcon';

export default function RunViewer() {
  const { id } = useParams() as { id: string };
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: runData } = useSubscription(WATCH_WORKFLOW_RUN, { variables: { runId: id } });
  const { data: stepsData } = useSubscription(WATCH_STEP_RUNS, { variables: { workflowRunId: id } });
  
  const [approveStep, { loading: isApproving }] = useMutation(APPROVE_STEP);

  const run = runData?.workflow_runs_by_pk;
  const steps = stepsData?.step_runs || [];

  useEffect(() => {
    if (steps.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [steps]);

  const handleApprove = async (stepRunId: string) => {
    try {
      await approveStep({ variables: { stepRunId } });
    } catch (err) {
      console.error('Error approving step:', err);
      alert('Failed to approve step');
    }
  };

  if (!run) return <div className="page-body">Loading run data...</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Run Viewer</h1>
          <p className="page-subtitle">Run ID: {id}</p>
        </div>
      </div>
      
      <div className="page-body">
        <div className={`run-banner ${run.status.toLowerCase()}`}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>Overall Status</h2>
            <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>
              Started: {new Date(run.started_at).toLocaleString()}
              {run.completed_at && ` • Completed: ${new Date(run.completed_at).toLocaleString()}`}
            </p>
          </div>
          <StatusBadge status={run.status} />
        </div>

        {run.error && (
          <div className="glass-card" style={{ borderColor: 'var(--color-danger)', marginBottom: '2rem' }}>
            <h3 style={{ color: 'var(--color-danger)', marginBottom: '0.5rem' }}>Run Error</h3>
            <pre className="log-viewer log-error">{run.error}</pre>
          </div>
        )}

        <div className="run-timeline">
          {steps.map((stepRun: any) => (
            <div key={stepRun.id} className={`timeline-item ${stepRun.status.toLowerCase()}`}>
              <div className="timeline-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <StepTypeIcon type={stepRun.workflow_step.step_type} />
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{stepRun.workflow_step.name}</h3>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Step {stepRun.workflow_step.step_order} • Type: {stepRun.workflow_step.step_type}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={stepRun.status} />
                </div>
                
                {stepRun.input && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Input</div>
                    <pre className="log-viewer log-input">{JSON.stringify(stepRun.input, null, 2)}</pre>
                  </div>
                )}
                
                {stepRun.output && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Output</div>
                    <pre className="log-viewer">{JSON.stringify(stepRun.output, null, 2)}</pre>
                  </div>
                )}
                
                {stepRun.error && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Error</div>
                    <pre className="log-viewer log-error">{stepRun.error}</pre>
                  </div>
                )}
                
                {stepRun.status === 'awaiting_approval' && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 'var(--radius-sm)' }}>
                    <h4 style={{ color: 'var(--color-warning)', marginBottom: '0.5rem' }}>Manual Approval Required</h4>
                    <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>This step requires human approval to proceed.</p>
                    <button 
                      className="btn btn-primary" 
                      onClick={() => handleApprove(stepRun.id)}
                      disabled={isApproving}
                    >
                      {isApproving ? 'Approving...' : 'Approve Step'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </>
  );
}
