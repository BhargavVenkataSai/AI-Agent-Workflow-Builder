'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSubscription } from '@apollo/client';
import { useUserData } from '@nhost/nextjs';
import { nhost } from '@/lib/nhost';
import { WATCH_WORKFLOW_RUN, WATCH_STEP_RUNS } from '@/lib/graphql';
import { StatusBadge } from '@/components/StatusBadge';
import { ReactFlow, Background, Controls, Node, Edge, Position, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { RunNode } from '@/components/RunNode';

const nodeTypes = {
  runNode: RunNode,
};

export default function RunViewer() {
  const { id } = useParams() as { id: string };
  const user = useUserData();

  const { data: runData } = useSubscription(WATCH_WORKFLOW_RUN, { variables: { runId: id } });
  const { data: stepsData } = useSubscription(WATCH_STEP_RUNS, { variables: { workflowRunId: id } });
  
  const [isApproving, setIsApproving] = useState(false);
  const [selectedStepRunId, setSelectedStepRunId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const run = runData?.workflow_runs_by_pk;
  const steps = stepsData?.step_runs || [];

  // Re-build nodes and edges when steps change
  useEffect(() => {
    if (!steps || steps.length === 0) return;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    
    // Sort steps by order just in case
    const sortedSteps = [...steps].sort((a: any, b: any) => 
      (a.workflow_step?.step_order || 0) - (b.workflow_step?.step_order || 0)
    );

    sortedSteps.forEach((stepRun: any, index: number) => {
      const isSelected = stepRun.id === selectedStepRunId;
      
      newNodes.push({
        id: stepRun.id,
        type: 'runNode',
        position: { x: index * 350, y: 100 },
        data: {
          name: stepRun.workflow_step?.name || `Step ${index + 1}`,
          type: stepRun.workflow_step?.step_type || 'unknown',
          order: stepRun.workflow_step?.step_order || index + 1,
          status: stepRun.status,
          isSelected,
          onClick: () => setSelectedStepRunId(stepRun.id)
        },
      });

      if (index > 0) {
        const prevStep = sortedSteps[index - 1];
        newEdges.push({
          id: `e-${prevStep.id}-${stepRun.id}`,
          source: prevStep.id,
          target: stepRun.id,
          animated: stepRun.status === 'running' || stepRun.status === 'pending',
          style: { stroke: 'var(--text-secondary)', strokeWidth: 2 }
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [steps, selectedStepRunId, setNodes, setEdges]);

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

  const selectedStepData = useMemo(() => {
    return steps.find((s: any) => s.id === selectedStepRunId);
  }, [steps, selectedStepRunId]);

  if (!run) return <div className="page-body">Loading run data...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1 className="page-title">Run Viewer</h1>
            <p className="page-subtitle">Run ID: {id}</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Started: {new Date(run.started_at).toLocaleString()}
            </div>
            <StatusBadge status={run.status} />
          </div>
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
            minZoom={0.5}
            maxZoom={1.5}
          >
            <Background color="rgba(255, 255, 255, 0.05)" gap={20} size={1} />
            <Controls style={{ backgroundColor: 'rgba(17, 24, 39, 0.8)', fill: 'white', borderColor: 'rgba(255,255,255,0.1)' }} />
          </ReactFlow>
          
          {run.error && (
            <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px', zIndex: 10 }}>
              <div className="glass-card" style={{ borderColor: 'var(--color-danger)' }}>
                <h3 style={{ color: 'var(--color-danger)', marginBottom: '0.5rem' }}>Run Error</h3>
                <pre className="log-viewer log-error">{run.error}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Side Panel for Selected Node details */}
        {selectedStepRunId && selectedStepData && (
          <div style={{ 
            width: '400px', 
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideInRight 0.3s ease'
          }}>
            <div style={{ 
              padding: '1.25rem', 
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{selectedStepData.workflow_step?.name}</h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Step {selectedStepData.workflow_step?.step_order} • {selectedStepData.workflow_step?.step_type}
                </div>
              </div>
              <button 
                onClick={() => setSelectedStepRunId(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Status</span>
                <StatusBadge status={selectedStepData.status} />
              </div>
              
              {selectedStepData.status === 'awaiting_approval' && (
                <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 'var(--radius-sm)' }}>
                  <h4 style={{ color: 'var(--color-warning)', marginBottom: '0.5rem' }}>Manual Approval Required</h4>
                  <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>This step requires human approval to proceed.</p>
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%' }}
                    onClick={() => handleApprove(selectedStepData.id)}
                    disabled={isApproving}
                  >
                    {isApproving ? 'Approving...' : 'Approve Step'}
                  </button>
                </div>
              )}

              {selectedStepData.input && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Input Data</div>
                  <pre className="log-viewer log-input">{JSON.stringify(selectedStepData.input, null, 2)}</pre>
                </div>
              )}
              
              {selectedStepData.output && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Output Data</div>
                  <pre className="log-viewer">{JSON.stringify(selectedStepData.output, null, 2)}</pre>
                </div>
              )}
              
              {selectedStepData.error && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Error Message</div>
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
