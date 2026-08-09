'use client';
import { useUserData } from '@nhost/nextjs';
import { useQuery } from '@apollo/client';
import { useOrg } from '@/components/OrgContext';
import { GET_ORG_USAGE, GET_ORG_WORKFLOWS } from '@/lib/graphql';
import { UsageIndicator } from '@/components/UsageIndicator';
import { StatusBadge } from '@/components/StatusBadge';
import Link from 'next/link';

export default function DashboardHome() {
  const user = useUserData();
  const { selectedOrgId } = useOrg();

  const { data: usageData } = useQuery(GET_ORG_USAGE, {
    variables: { orgId: selectedOrgId },
    skip: !selectedOrgId,
  });

  const { data: workflowsData } = useQuery(GET_ORG_WORKFLOWS, {
    variables: { orgId: selectedOrgId },
    skip: !selectedOrgId,
  });

  const org = usageData?.organizations_by_pk;
  const workflows = workflowsData?.workflows || [];
  
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {user?.displayName || 'User'}</h1>
          <p className="page-subtitle">Here's what's happening in {org?.name || 'your organization'}</p>
        </div>
      </div>
      
      <div className="page-body">
        <div className="dashboard-grid">
          <div className="glass-card stat-card animate-slide-up" style={{ animationDelay: '0s' }}>
            <h3 className="stat-title">Total Workflows</h3>
            <div className="stat-value">{workflows.length}</div>
          </div>
          
          <div className="glass-card stat-card animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h3 className="stat-title">Organization Quota</h3>
            {org ? (
              <UsageIndicator quotaUsed={org.quota_used} quotaLimit={org.quota_limit} />
            ) : (
              <div className="skeleton" style={{ height: '40px', width: '100%', marginTop: '0.5rem' }}></div>
            )}
          </div>
        </div>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '2rem 0 1rem', color: 'white' }}>Recent Workflows</h2>
        
        <div className="dashboard-grid">
          {workflows.slice(0, 3).map((wf: any, index: number) => (
            <Link href={`/dashboard/workflows/${wf.id}`} key={wf.id} className="glass-card workflow-card animate-slide-up" style={{ animationDelay: `${0.2 + index * 0.1}s` }}>
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
                <span>{wf.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            </Link>
          ))}
          {workflows.length === 0 && (
            <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>No workflows found</p>
              <Link href="/dashboard/workflows/new" className="btn btn-primary">Create Your First Workflow</Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
