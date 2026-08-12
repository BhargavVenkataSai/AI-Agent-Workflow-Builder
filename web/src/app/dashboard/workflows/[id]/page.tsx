'use client';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { useUserData } from '@nhost/nextjs';
import { nhost } from '@/lib/nhost';
import { GET_WORKFLOW_DETAIL, UPDATE_WORKFLOW, GET_USER_ORGS } from '@/lib/graphql';
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
  const { selectedOrgId } = useOrg();
  const user = useUserData();

  const { data: userOrgsData } = useQuery(GET_USER_ORGS, {
    variables: { userId: user?.id },
    skip: !user?.id,
  });

  const selectedMember = userOrgsData?.org_members?.find((m: any) => m.organization.id === selectedOrgId);
  const currentRole = selectedMember?.role;
  const canEdit = currentRole === 'owner' || currentRole === 'editor';
  const isOwner = currentRole === 'owner';

  const { data, loading, refetch } = useQuery(GET_WORKFLOW_DETAIL, {
    variables: { id },
    skip: !id,
  });

  const [updateWorkflow, { loading: isSaving }] = useMutation(UPDATE_WORKFLOW);
  const [isTriggering, setIsTriggering] = useState(false);

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

  const [showRunModal, setShowRunModal] = useState(false);
  const [initialPayload, setInitialPayload] = useState('{\n  "lead_source": "website_form",\n  "contact_email": "prospect@example.com"\n}');
  const [runModalError, setRunModalError] = useState<string | null>(null);

  const isPayloadValidJson = useMemo(() => {
    if (!initialPayload.trim()) return true;
    try {
      JSON.parse(initialPayload);
      return true;
    } catch {
      return false;
    }
  }, [initialPayload]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showRunModal) {
        setShowRunModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showRunModal]);

  const handleDirectRun = async (customPayload?: any) => {
    const activeSteps = workflow?.workflow_steps || steps;
    if (!activeSteps || activeSteps.length === 0) {
      alert('Cannot run workflow: Please click "+ Add Step" to configure steps for this workflow before running.');
      return;
    }

    setIsTriggering(true);
    try {
      const token = nhost.auth.getAccessToken();
      const res = await fetch('/api/trigger-workflow-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ 
          workflow_id: id,
          initial_payload: customPayload || {} 
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Unable to start workflow');
      }
      if (data.workflow_run_id) {
        setShowRunModal(false);
        router.push(`/dashboard/runs/${data.workflow_run_id}`);
      }
    } catch (err: any) {
      alert(err.message || 'Unable to start workflow');
    } finally {
      setIsTriggering(false);
    }
  };

  const handleOpenRunModal = () => {
    const activeSteps = workflow?.workflow_steps || steps;
    if (!activeSteps || activeSteps.length === 0) {
      alert('Cannot run workflow: Please click "+ Add Step" to configure steps for this workflow before running.');
      return;
    }
    setRunModalError(null);
    setShowRunModal(true);
  };

  const handleExecuteRun = async () => {
    if (!isPayloadValidJson || isTriggering) return;
    
    let parsedPayload = {};
    try {
      if (initialPayload.trim()) {
        parsedPayload = JSON.parse(initialPayload);
      }
    } catch (e: any) {
      setRunModalError('Invalid JSON format: Expected a valid JSON object.');
      return;
    }

    setRunModalError(null);
    await handleDirectRun(parsedPayload);
  };

  const handleRun = async () => {
    // Single-click direct execution on main button
    await handleDirectRun();
  };

  const handleAddStepClick = () => {
    if (!editMode) {
      enterEditMode();
    }
    setShowAddStep(true);
  };

  const handleEditStepClick = (index: number) => {
    if (!editMode) {
      enterEditMode();
    }
    setExpandedStep(index);
  };

  const handleDeleteStepClick = (index: number) => {
    if (!editMode) {
      if (!workflow) return;
      setName(workflow.name);
      setDescription(workflow.description || '');
      const updatedSteps = workflow.workflow_steps
        .filter((_: any, i: number) => i !== index)
        .map((s: any, i: number) => ({ ...s, step_order: i + 1 }));
      setSteps(updatedSteps);
      setTriggers(workflow.workflow_triggers.map((t: any) => ({ ...t })));
      setEditMode(true);
      setExpandedStep(null);
    } else {
      removeStep(index);
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
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {canEdit && !editMode && (
            <button onClick={enterEditMode} className="btn btn-secondary">Edit Workflow</button>
          )}
          {editMode && (
            <>
              <button onClick={() => setEditMode(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={isSaving} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
          {canEdit && !editMode && (
            <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
              <button 
                onClick={handleRun} 
                disabled={isTriggering} 
                className="btn btn-primary" 
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', fontWeight: 700, padding: '0.6rem 1.25rem' }}
              >
                {isTriggering ? 'Starting...' : '▶ Run Workflow'}
              </button>
              <button
                type="button"
                onClick={handleOpenRunModal}
                disabled={isTriggering}
                title="Configure custom execution payload"
                aria-label="Configure custom execution payload"
                className="btn btn-secondary"
                style={{ padding: '0.6rem 0.75rem', color: '#9ca3af' }}
              >
                ⚙
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="page-body builder-container">
        {/* Steps Section */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff' }}>
              Steps <span style={{ color: '#9ca3af', fontWeight: 400 }}>({displaySteps.length})</span>
            </h2>
            {canEdit && (
              <button className="btn btn-primary btn-sm" onClick={handleAddStepClick} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
                <span>Add Step</span>
              </button>
            )}
          </div>

          {showAddStep && (
            <div className="glass-card" style={{ marginBottom: '1.25rem', padding: '1.25rem', backgroundColor: 'rgba(17, 24, 39, 0.8)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Step Type</h4>
                <button type="button" onClick={() => setShowAddStep(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.875rem' }}>✕ Close</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {STEP_TYPES.map(st => {
                  const restricted = (st.value === 'db_write' || st.value === 'notify') && !isOwner;
                  return (
                    <button key={st.value} onClick={() => addStep(st.value)} disabled={restricted}
                      className="step-type-picker-btn" style={{ opacity: restricted ? 0.5 : 1, textAlign: 'left', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', cursor: restricted ? 'not-allowed' : 'pointer' }}>
                      <StepTypeIcon type={st.value} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#ffffff' }}>{st.label}</div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.125rem' }}>
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
              <div key={step.id} className="step-item" style={{ backgroundColor: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div className="step-order" style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700, flexShrink: 0 }}>
                    {step.step_order}
                  </div>
                  <StepTypeIcon type={step.step_type} />
                  <div className="step-content" style={{ flex: 1, minWidth: 0 }}>
                    <div className="step-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, overflow: 'hidden' }}>
                        {editMode ? (
                          <input className="form-input" value={step.name} onChange={e => updateStepName(index, e.target.value)}
                            style={{ fontSize: '0.9rem', padding: '0.25rem 0.5rem', flex: 1 }} />
                        ) : (
                          <div className="step-title" style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.name}</div>
                        )}
                        <span className="step-type-badge" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', backgroundColor: 'rgba(255, 255, 255, 0.06)', color: '#9ca3af', textTransform: 'uppercase' }}>
                          {step.step_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                        {canEdit && (
                          <>
                            {editMode && (
                              <>
                                <button className="btn-icon" onClick={() => moveStep(index, 'up')} disabled={index === 0} title="Move Up">↑</button>
                                <button className="btn-icon" onClick={() => moveStep(index, 'down')} disabled={index === displaySteps.length - 1} title="Move Down">↓</button>
                              </>
                            )}
                            <button 
                              className="btn btn-secondary btn-sm" 
                              onClick={() => handleEditStepClick(index)}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#60a5fa' }}
                            >
                              Edit
                            </button>
                            <button 
                              className="btn btn-secondary btn-sm" 
                              onClick={() => handleDeleteStepClick(index)}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#f87171' }}
                            >
                              Delete
                            </button>
                            <button className="btn-icon" onClick={() => setExpandedStep(expandedStep === index ? null : index)}>
                              {expandedStep === index ? '▲' : '▼'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {expandedStep === index && (
                      <div className="step-config-editor" style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        {editMode ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {Object.entries(step.config || {}).map(([key, value]) => {
                              const isTextarea = key === 'body' || key === 'prompt' || key === 'message' || key === 'headers' || key === 'condition' || (typeof value === 'string' && value.length > 40);
                              const isMethod = key === 'method';
                              
                              return (
                                <div key={key} className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label" style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'capitalize', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                                    {key.replace(/_/g, ' ')}
                                  </label>

                                  {isMethod ? (
                                    <select 
                                      className="form-input" 
                                      value={String(value)}
                                      onChange={e => updateStepConfig(index, key, e.target.value)}
                                      style={{ backgroundColor: '#0a0e1a', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '0.375rem', padding: '0.5rem', width: '100%' }}
                                    >
                                      <option value="GET">GET</option>
                                      <option value="POST">POST</option>
                                      <option value="PUT">PUT</option>
                                      <option value="DELETE">DELETE</option>
                                      <option value="PATCH">PATCH</option>
                                    </select>
                                  ) : typeof value === 'object' ? (
                                    <textarea 
                                      className="form-input" 
                                      value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                                      onChange={e => {
                                        const raw = e.target.value;
                                        try { 
                                          updateStepConfig(index, key, JSON.parse(raw)); 
                                        } catch {
                                          updateStepConfig(index, key, raw);
                                        }
                                      }}
                                      rows={4} 
                                      style={{ fontFamily: 'monospace', fontSize: '0.8125rem', backgroundColor: '#0a0e1a', color: '#34d399', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '0.375rem', padding: '0.625rem', width: '100%', resize: 'vertical' }} 
                                    />
                                  ) : isTextarea ? (
                                    <textarea 
                                      className="form-input" 
                                      value={String(value)}
                                      onChange={e => updateStepConfig(index, key, e.target.value)}
                                      rows={4} 
                                      style={{ fontFamily: 'monospace', fontSize: '0.8125rem', backgroundColor: '#0a0e1a', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '0.375rem', padding: '0.625rem', width: '100%', resize: 'vertical' }} 
                                    />
                                  ) : typeof value === 'number' ? (
                                    <input 
                                      className="form-input" 
                                      type="number" 
                                      step="0.1" 
                                      value={value as number}
                                      onChange={e => updateStepConfig(index, key, parseFloat(e.target.value))} 
                                      style={{ backgroundColor: '#0a0e1a', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '0.375rem', padding: '0.5rem', width: '100%' }} 
                                    />
                                  ) : (
                                    <input 
                                      className="form-input" 
                                      value={String(value)}
                                      onChange={e => updateStepConfig(index, key, e.target.value)} 
                                      style={{ backgroundColor: '#0a0e1a', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '0.375rem', padding: '0.5rem', width: '100%' }} 
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <pre className="step-config-preview" style={{ margin: 0, padding: '0.625rem', borderRadius: '0.375rem', backgroundColor: '#0a0e1a', fontSize: '0.75rem', color: '#34d399', overflowX: 'auto' }}>
                            {JSON.stringify(step.config, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )) : (
              /* Polished Empty State for Workflow Steps */
              <div 
                className="glass-card" 
                style={{ 
                  textAlign: 'center', 
                  padding: '3rem 2rem', 
                  backgroundColor: 'rgba(17, 24, 39, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '0.875rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', marginBottom: '1rem' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', margin: '0 0 0.375rem 0' }}>No steps configured yet.</h3>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '0 0 1.25rem 0' }}>Add your first step to build this workflow.</p>
                {canEdit && (
                  <button className="btn btn-primary" onClick={handleAddStepClick} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
                    <span>Add Step</span>
                  </button>
                )}
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

      {/* Run Workflow Execution Modal */}
      {showRunModal && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="run-workflow-title"
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRunModal(false);
          }}
        >
          <div 
            className="glass-card" 
            style={{ 
              width: '640px', 
              maxWidth: '92vw', 
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#111827', 
              border: '1px solid rgba(255, 255, 255, 0.15)', 
              borderRadius: '14px', 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              overflow: 'hidden',
              animation: 'slideUp 0.15s ease-out'
            }}
          >
            {/* Header */}
            <div style={{ padding: '1.5rem 1.75rem 1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 id="run-workflow-title" style={{ fontSize: '1.625rem', fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
                    Run Workflow
                  </h2>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: '#d1d5db', marginTop: '0.25rem' }}>
                    {workflow.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                    <span>Manual trigger • New execution</span>
                  </div>
                </div>

                <button 
                  type="button" 
                  onClick={() => setShowRunModal(false)}
                  aria-label="Close modal"
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.05)', 
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '8px', 
                    color: '#9ca3af', 
                    cursor: 'pointer', 
                    width: '32px', 
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.125rem',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Error banner if submission failed */}
              {runModalError && (
                <div style={{ padding: '0.875rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '0.875rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>Unable to start workflow</div>
                  <div>{runModalError}</div>
                </div>
              )}

              {/* Execution Input Section */}
              <div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.2rem' }}>
                  Execution Input
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#9ca3af', marginBottom: '0.875rem' }}>
                  Provide the initial data that will be passed to the first step.
                </div>

                {/* Code Container Box */}
                <div style={{ 
                  borderRadius: '8px', 
                  border: '1px solid rgba(255, 255, 255, 0.12)', 
                  backgroundColor: '#0d1117',
                  overflow: 'hidden'
                }}>
                  {/* Header Bar */}
                  <div style={{ 
                    padding: '0.5rem 0.875rem', 
                    backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span>Execution Payload</span>
                      <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: '#60a5fa' }}>JSON</span>
                    </div>

                    {/* Real-time Validation Indicator Badge */}
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {isPayloadValidJson ? (
                        <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.12)' }}>
                          ✓ Valid JSON
                        </span>
                      ) : (
                        <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.12)' }}>
                          ⚠ Invalid JSON
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Textarea */}
                  <textarea
                    rows={7}
                    value={initialPayload}
                    onChange={(e) => setInitialPayload(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                      }
                    }}
                    style={{
                      width: '100%',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontSize: '0.8125rem',
                      lineHeight: 1.5,
                      backgroundColor: 'transparent',
                      color: '#e2e8f0',
                      border: 'none',
                      outline: 'none',
                      padding: '0.875rem',
                      resize: 'vertical',
                      minHeight: '180px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="{}"
                  />
                </div>

                {/* Validation Error Hint */}
                {!isPayloadValidJson && (
                  <div style={{ fontSize: '0.78125rem', color: '#ef4444', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>⚠ Invalid JSON: Expected a valid JSON object.</span>
                  </div>
                )}
              </div>

              {/* What Will Happen Summary Box */}
              <div style={{ 
                padding: '0.875rem 1rem', 
                backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                border: '1px solid rgba(255, 255, 255, 0.08)', 
                borderRadius: '8px',
                fontSize: '0.8125rem'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trigger Mode</div>
                    <div style={{ fontWeight: 600, color: '#ffffff', marginTop: '0.2rem' }}>▶ Manual</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>First Step</div>
                    <div style={{ fontWeight: 600, color: '#ffffff', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      → {displaySteps[0]?.name || 'Step 1'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Steps</div>
                    <div style={{ fontWeight: 600, color: '#ffffff', marginTop: '0.2rem' }}>
                      → {displaySteps.length} {displaySteps.length === 1 ? 'step' : 'steps'}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer Actions */}
            <div style={{ padding: '1.25rem 1.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
              <button 
                type="button" 
                onClick={() => setShowRunModal(false)}
                className="btn btn-secondary"
                disabled={isTriggering}
                style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRun}
                disabled={!isPayloadValidJson || isTriggering}
                className="btn btn-primary"
                style={{ 
                  background: (!isPayloadValidJson || isTriggering)
                    ? '#374151'
                    : 'linear-gradient(135deg, #10b981, #059669)',
                  borderColor: (!isPayloadValidJson || isTriggering) ? '#4b5563' : '#059669',
                  color: '#ffffff',
                  fontWeight: 700, 
                  padding: '0.625rem 1.5rem',
                  fontSize: '0.875rem',
                  cursor: (!isPayloadValidJson || isTriggering) ? 'not-allowed' : 'pointer',
                  boxShadow: (!isPayloadValidJson || isTriggering) ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.35)',
                  transition: 'all 0.15s ease'
                }}
              >
                {isTriggering ? '◌ Starting workflow...' : '▶ Run Workflow'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
