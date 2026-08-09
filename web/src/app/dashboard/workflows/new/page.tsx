'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { useOrg } from '@/components/OrgContext';
import { CREATE_WORKFLOW } from '@/lib/graphql';

export default function NewWorkflow() {
  const router = useRouter();
  const { selectedOrgId } = useOrg();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [createWorkflow, { loading }] = useMutation(CREATE_WORKFLOW);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedOrgId) {
      setErrorMessage('No organization selected. Your user account must belong to an organization before creating a workflow.');
      return;
    }

    try {
      const { data } = await createWorkflow({
        variables: {
          object: {
            org_id: selectedOrgId,
            name,
            description,
            is_active: true
          }
        }
      });
      
      if (data?.insert_workflows_one?.id) {
        router.push(`/dashboard/workflows/${data.insert_workflows_one.id}`);
      }
    } catch (err: any) {
      console.error('Error creating workflow:', err);
      setErrorMessage(err.message || 'Failed to create workflow');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Create Workflow</h1>
          <p className="page-subtitle">Set up a new automated process</p>
        </div>
        <button onClick={() => router.back()} className="btn btn-secondary">Cancel</button>
      </div>
      
      <div className="page-body">
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          {errorMessage && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171'
            }}>
              {errorMessage}
            </div>
          )}

          {!selectedOrgId && !errorMessage && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#fbbf24'
            }}>
              ⚠️ No organization selected. Please ensure your user account is assigned to an organization in Nhost.
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Workflow Name</label>
              <input 
                type="text" 
                className="form-input" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Customer Onboarding Agent"
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Description (Optional)</label>
              <textarea 
                className="form-input" 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this workflow do?"
              />
            </div>
            
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading || !name.trim() || !selectedOrgId}
              style={{ marginTop: '1rem' }}
            >
              {loading ? 'Creating...' : 'Create Workflow'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
