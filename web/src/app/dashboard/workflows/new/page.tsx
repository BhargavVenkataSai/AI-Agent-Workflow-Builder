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
  
  const [createWorkflow, { loading }] = useMutation(CREATE_WORKFLOW);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId) return;

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
    } catch (err) {
      console.error('Error creating workflow:', err);
      alert('Failed to create workflow');
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
              disabled={loading || !name.trim()}
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
