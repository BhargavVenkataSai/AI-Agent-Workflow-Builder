'use client';
import { useQuery } from '@apollo/client';
import { useOrg } from '@/components/OrgContext';
import { useUserData } from '@nhost/nextjs';
import { GET_ORG_WORKFLOWS, GET_USER_ORGS } from '@/lib/graphql';
import { StatusBadge } from '@/components/StatusBadge';
import Link from 'next/link';

export default function WorkflowsList() {
  const { selectedOrgId } = useOrg();
  const user = useUserData();

  const { data: userOrgsData } = useQuery(GET_USER_ORGS, {
    variables: { userId: user?.id },
    skip: !user?.id,
  });

  const { data, loading } = useQuery(GET_ORG_WORKFLOWS, {
    variables: { orgId: selectedOrgId },
    skip: !selectedOrgId,
  });

  const selectedMember = userOrgsData?.org_members?.find((m: any) => m.organization.id === selectedOrgId);
  const currentRole = selectedMember?.role;
  const canEdit = currentRole === 'owner' || currentRole === 'editor';
  const workflows = data?.workflows || [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Workflows</h1>
          <p className="page-subtitle">Manage your automated AI agents and processes</p>
        </div>
        {canEdit && (
          <Link href="/dashboard/workflows/new" className="btn btn-primary">
            New Workflow
          </Link>
        )}
      </div>
      
      <div className="page-body">
        {loading ? (
          <div className="dashboard-grid">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card workflow-card skeleton" style={{ height: '160px' }}></div>
            ))}
          </div>
        ) : workflows.length > 0 ? (
          <div className="dashboard-grid">
            {workflows.map((wf: any, index: number) => (
              <Link href={`/dashboard/workflows/${wf.id}`} key={wf.id} className="glass-card workflow-card animate-slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
                <div className="workflow-card-header">
                  <h3 className="workflow-name">{wf.name}</h3>
                  {wf.workflow_runs?.[0] && (
                    <StatusBadge status={wf.workflow_runs[0].status} />
                  )}
                </div>
                <p className="workflow-desc">{wf.description || 'No description provided.'}</p>
                <div className="workflow-meta">
                  <span>{wf.workflow_steps?.length || 0} steps</span>
                  <span>•</span>
                  <span>{wf.workflow_triggers?.length || 0} triggers</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'white', marginBottom: '0.5rem' }}>No workflows yet</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Create your first workflow to get started with automation.</p>
            {canEdit && (
              <Link href="/dashboard/workflows/new" className="btn btn-primary">
                Create Workflow
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
