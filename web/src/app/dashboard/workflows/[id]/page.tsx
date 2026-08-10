'use client';
import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { useUserData } from '@nhost/nextjs';
import { GET_WORKFLOW_DETAIL, UPDATE_WORKFLOW } from '@/lib/graphql';
import { useOrg } from '@/components/OrgContext';
import { StepTypeIcon } from '@/components/StepTypeIcon';
import { StatusBadge } from '@/components/StatusBadge';
import Link from 'next/link';

const STEP_TYPES = [
  { value: 'llm_call', label: 'LLM Call', description: 'Call an AI model (Groq)' },
  { value: 'http_request', label: 'HTTP Request', description: 'Make an API call' },
  { value: 'db_write', label: 'DB Write', description: 'Write data to database (owner only)' },
  { value: 'notify', label: 'Notify', description: 'Send a notification (owner only)' },
  { value: 'conditional_branch', label: 'Conditional Branch', description: 'If/else based on previous output' },
  { value: 'approval_gate', label: 'Approval Gate', description: 'Pause for human approval' },
];

const TRIGGER_TYPES = [
  { value: 'manual', label: 'Manual', description: 'Run via UI button' },
  { value: 'webhook', label: 'Webhook', description: 'Trigger via external HTTP call (owner only)' },
  { value: 'scheduled', label: 'Scheduled', description: 'Run on a cron schedule' },
  { value: 'database_event', label: 'Database Event', description: 'Trigger on row changes' },
];

function getDefaultConfig(stepType: string): any {
  switch (stepType) {
    case 'llm_call':
      return { prompt: 'Analyze the following: {{previous_output}}', model: 'llama-3.3-70b-versatile', temperature: 0.7 };
    case 'http_request':
      return { url: 'https://httpbin.org/post', method: 'POST', headers: {}, body: '{"data": "{{previous_output}}"}' };
    case 'db_write':
      return { table: 'watched_records', data: { payload: '{{previous_output}}' } };
    case 'notify':
      return { channel: 'console', message: 'Workflow step completed' };
    case 'conditional_branch':
      return { condition: '{{previous_output}}', operator: 'contains', value: 'success' };
    case 'approval_gate':
      return { message: 'Please review and approve this step' };
    default:
      return {};
  }
}

function getDefaultTriggerConfig(triggerType: string): any {
  switch (triggerType) {
    case 'webhook':
      return { secret: 'my-webhook-secret-123' };
    case 'scheduled':
      return { cron: '0 * * * *', description: 'Every hour' };
    case 'database_event':
      return { table: 'watched_records', operation: 'INSERT' };
    default:
      return {};
  }
}

export default function WorkflowDetail() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { selectedOrgId, selectedOrgRole } = useOrg();
  const canEdit = selectedOrgRole === 'owner' || selectedOrgRole === 'editor';
  const isOwner = selectedOrgRole === 'owner';

  const { data, loading, refetch } = useQuery(GET_WORKFLOW_DETAIL, {
    variables: { id },
    skip: !id,
  });

  const [updateWorkflow, { loading: isSaving }] = useMutation(UPDATE_WORKFLOW);
  const [isTriggering, setIsTriggering] = useState(false);
  const user = useUserData();

  const [editMode, setEditMode] = useState(false);
  const [steps, setSteps] = useState<any[]>([]);
  const [triggers, setTriggers] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showAddStep, setShowAddStep] = useState(false);
  const [showAddTrigger, setShowAddTrigger] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const workflow = data?.workflows_by_pk;

  const enterEditMode = useCallback(() => {
    if (!workflow) return;
    setName(workflow.name);
    setDescription(workflow.description || '');
    setSteps(workflow.workflow_steps.map((s: any, i: number) => ({
      ...s,
      step_order: i + 1,
      config: { ...s.config },
    })));
    setTriggers(workflow.workflow_triggers.map((t: any) => ({ ...t })));
    setEditMode(true);
  }, [workflow]);

  const addStep = (stepType: string) => {
    // Layer 2: Only owners can add db_write, notify
    if ((stepType === 'db_write' || stepType === 'notify') && !isOwner) {
      alert('Only organization owners can add ' + stepType.replace('_', ' ') + ' steps.');
      return;
    }
    const newStep = {
      id: `new-${Date.now()}`,
      workflow_id: id,
      step_order: steps.length + 1,
      step_type: stepType,
      name: STEP_TYPES.find(t => t.value === stepType)?.label || stepType,
      config: getDefaultConfig(stepType),
    };
    setSteps([...steps, newStep]);
    setShowAddStep(false);
    setExpandedStep(steps.length);
  };

  const addTrigger = (triggerType: string) => {
    // Layer 2: Only owners can add webhook triggers
    if (triggerType === 'webhook' && !isOwner) {
      alert('Only organization owners can add webhook triggers.');
      return;
    }
    const newTrigger = {
      id: `new-${Date.now()}`,
      workflow_id: id,
      trigger_type: triggerType,
      config: getDefaultTriggerConfig(triggerType),
      is_active: true,
    };
    setTriggers([...triggers, newTrigger]);
    setShowAddTrigger(false);
  };

  const removeStep = (index: number) => {
    const updated = steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i + 1 }));
    setSteps(updated);
    setExpandedStep(null);
  };

  const removeTrigger = (index: number) => {
    setTriggers(triggers.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const arr = [...steps];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    setSteps(arr.map((s, i) => ({ ...s, step_order: i + 1 })));
  };

  const updateStepConfig = (index: number, key: string, value: any) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], config: { ...updated[index].config, [key]: value } };
    setSteps(updated);
  };

  const updateStepName = (index: number, newName: string) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], name: newName };
    setSteps(updated);
  };

  const handleSave = async () => {
    try {
      const stepObjects = steps.map((s: any) => ({
        workflow_id: id,
        step_order: s.step_order,
        step_type: s.step_type,
        name: s.name,
        config: s.config,
      }));
      const triggerObjects = triggers.map((t: any) => ({
        workflow_id: id,
        trigger_type: t.trigger_type,
        config: t.config,
        is_active: t.is_active,
      }));
      await updateWorkflow({
        variables: {
          id,
          set: { name, description },
          steps: stepObjects,
          triggers: triggerObjects,
        },
      });
      setEditMode(false);
      refetch();
    } catch (err: any) {
      console.error(err);
      alert('Error saving: ' + (err.message || 'Unknown error'));
    }
  };

  // SINGLE deterministic execution path: direct API call to /api/trigger-workflow-run
  // No Hasura Action mutation, no fallback pattern.
  const handleRun = async () => {
    setIsTriggering(true);
    try {
      const res = await fetch('/api/trigger-workflow-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_id: id, userId: user?.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error triggering run');
      }
      if (data.workflow_run_id) {
        router.push(`/dashboard/runs/${data.workflow_run_id}`);
      }
    } catch (err: any) {
      alert(err.message || 'Error triggering run');
    } finally {
      setIsTriggering(false);
    }
  };

  if (loading) return <div className="page-body"><div className="skeleton" style={{ height: 200 }} /></div>;
  if (!workflow) return <div className="page-body"><p>Workflow not found.</p></div>;

  const displaySteps = editMode ? steps : workflow.workflow_steps;
  const displayTriggers = editMode ? triggers : workflow.workflow_triggers;

  return (
    <>
      <div className="page-header">
        <div>
          {editMode ? (
            <>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)}
                style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }} />
              <input className="form-input" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Description" />
            </>
          ) : (
            <>
              <h1 className="page-title">{workflow.name}</h1>
              <p className="page-subtitle">{workflow.description || 'No description'}</p>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {canEdit && !editMode && (
            <button onClick={enterEditMode} className="btn btn-secondary">Edit</button>
          )}
          {editMode && (
            <>
              <button onClick={() => setEditMode(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={isSaving} className="btn btn-primary">
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
          {canEdit && !editMode && (
            <button onClick={handleRun} disabled={isTriggering} className="btn btn-primary">
              {isTriggering ? 'Starting...' : '▶ Run Workflow'}
            </button>
          )}
        </div>
      </div>

      <div className="page-body builder-container">
        {/* Steps Section */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              Steps <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>({displaySteps.length})</span>
            </h2>
            {editMode && (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddStep(!showAddStep)}>
                + Add Step
              </button>
            )}
          </div>

          {showAddStep && (
            <div className="glass-card" style={{ marginBottom: '1rem' }}>
              <h4 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Select Step Type</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                {STEP_TYPES.map(st => {
                  const restricted = (st.value === 'db_write' || st.value === 'notify') && !isOwner;
                  return (
                    <button key={st.value} onClick={() => addStep(st.value)} disabled={restricted}
                      className="step-type-picker-btn" style={{ opacity: restricted ? 0.5 : 1 }}>
                      <StepTypeIcon type={st.value} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{st.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {st.description}
                          {restricted && ' 🔒'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="step-list">
            {displaySteps.length > 0 ? displaySteps.map((step: any, index: number) => (
              <div key={step.id} className="step-item">
                <div className="step-order">{step.step_order}</div>
                <StepTypeIcon type={step.step_type} />
                <div className="step-content" style={{ flex: 1 }}>
                  <div className="step-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                      {editMode ? (
                        <input className="form-input" value={step.name} onChange={e => updateStepName(index, e.target.value)}
                          style={{ fontSize: '0.9rem', padding: '0.25rem 0.5rem' }} />
                      ) : (
                        <div className="step-title">{step.name}</div>
                      )}
                      <span className="step-type-badge">{step.step_type.replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      {editMode && (
                        <>
                          <button className="btn-icon" onClick={() => moveStep(index, 'up')} disabled={index === 0}>↑</button>
                          <button className="btn-icon" onClick={() => moveStep(index, 'down')} disabled={index === displaySteps.length - 1}>↓</button>
                          <button className="btn-icon" onClick={() => setExpandedStep(expandedStep === index ? null : index)}>
                            {expandedStep === index ? '▲' : '▼'}
                          </button>
                          <button className="btn-icon danger" onClick={() => removeStep(index)}>✕</button>
                        </>
                      )}
                      {!editMode && (
                        <button className="btn-icon" onClick={() => setExpandedStep(expandedStep === index ? null : index)}>
                          {expandedStep === index ? '▲' : '▼'}
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedStep === index && (
                    <div className="step-config-editor">
                      {editMode ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {Object.entries(step.config || {}).map(([key, value]) => (
                            <div key={key} className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: '0.75rem' }}>{key}</label>
                              {typeof value === 'object' ? (
                                <textarea className="form-input" value={JSON.stringify(value, null, 2)}
                                  onChange={e => {
                                    try { updateStepConfig(index, key, JSON.parse(e.target.value)); } catch {}
                                  }}
                                  rows={3} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} />
                              ) : typeof value === 'number' ? (
                                <input className="form-input" type="number" step="0.1" value={value as number}
                                  onChange={e => updateStepConfig(index, key, parseFloat(e.target.value))} />
                              ) : (
                                <input className="form-input" value={String(value)}
                                  onChange={e => updateStepConfig(index, key, e.target.value)} />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <pre className="step-config-preview">{JSON.stringify(step.config, null, 2)}</pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )) : (
              <div className="glass-card" style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: 'var(--text-secondary)' }}>No steps configured. {canEdit && 'Click Edit to add steps.'}</p>
              </div>
            )}
          </div>

          {/* Triggers Section */}
          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                Triggers <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>({displayTriggers.length})</span>
              </h2>
              {editMode && (
                <button className="btn btn-secondary btn-sm" onClick={() => setShowAddTrigger(!showAddTrigger)}>
                  + Add Trigger
                </button>
              )}
            </div>

            {showAddTrigger && (
              <div className="glass-card" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {TRIGGER_TYPES.map(tt => {
                    const restricted = tt.value === 'webhook' && !isOwner;
                    return (
                      <button key={tt.value} onClick={() => addTrigger(tt.value)} disabled={restricted}
                        className="step-type-picker-btn" style={{ opacity: restricted ? 0.5 : 1 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{tt.label}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {tt.description}{restricted && ' 🔒'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {displayTriggers.map((trigger: any, index: number) => (
                <div key={trigger.id} className="glass-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="step-type-badge">{trigger.trigger_type.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.75rem' }}>
                      {trigger.is_active ? '● Active' : '○ Inactive'}
                    </span>
                    {trigger.config && Object.keys(trigger.config).length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                        {JSON.stringify(trigger.config)}
                      </div>
                    )}
                  </div>
                  {editMode && (
                    <button className="btn-icon danger" onClick={() => removeTrigger(index)}>✕</button>
                  )}
                </div>
              ))}
              {displayTriggers.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No triggers configured.</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Runs Section */}
        <div>
          <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Recent Runs</h3>
            {workflow.workflow_runs?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {workflow.workflow_runs.map((run: any) => (
                  <Link href={`/dashboard/runs/${run.id}`} key={run.id}
                    style={{ display: 'block', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', color: 'inherit', textDecoration: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.875rem' }}>{new Date(run.started_at).toLocaleString()}</span>
                      <StatusBadge status={run.status} />
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Trigger: {run.trigger_type}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>No runs yet. Click &quot;Run Workflow&quot; to start.</p>
            )}
          </div>

          {/* Webhook Info */}
          {workflow.workflow_triggers?.some((t: any) => t.trigger_type === 'webhook') && (
            <div className="glass-card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Webhook Endpoint</h3>
              <pre className="log-viewer" style={{ fontSize: '0.75rem' }}>
{`POST /v1/functions/webhook-trigger
Content-Type: application/json
x-webhook-secret: <your-secret>

{
  "workflow_id": "${id}",
  "payload": { ... }
}`}
              </pre>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
