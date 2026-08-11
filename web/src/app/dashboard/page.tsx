'use client';
import { useUserData } from '@nhost/nextjs';
import { useQuery } from '@apollo/client';
import { useOrg } from '@/components/OrgContext';
import { GET_DASHBOARD_METRICS, GET_ORG_WORKFLOWS, GET_USER_ORGS } from '@/lib/graphql';
import { UsageIndicator } from '@/components/UsageIndicator';
import { StatusBadge } from '@/components/StatusBadge';
import Link from 'next/link';

export default function DashboardHome() {
  const user = useUserData();
  const { selectedOrgId } = useOrg();

  const { data: userOrgsData } = useQuery(GET_USER_ORGS, {
    variables: { userId: user?.id },
    skip: !user?.id,
  });

  const { data: metricsData, loading: metricsLoading } = useQuery(GET_DASHBOARD_METRICS, {
    variables: { orgId: selectedOrgId },
    skip: !selectedOrgId,
  });

  const { data: workflowsData, loading: workflowsLoading } = useQuery(GET_ORG_WORKFLOWS, {
    variables: { orgId: selectedOrgId },
    skip: !selectedOrgId,
  });

  const selectedMember = userOrgsData?.org_members?.find((m: any) => m.organization.id === selectedOrgId);
  const org = metricsData?.organizations_by_pk || selectedMember?.organization || userOrgsData?.org_members?.[0]?.organization;
  const currentRole = selectedMember?.role || userOrgsData?.org_members?.[0]?.role;
  const formattedRole = currentRole ? currentRole.charAt(0).toUpperCase() + currentRole.slice(1) : '';

  const workflows = workflowsData?.workflows || [];
  const totalWorkflowsCount = metricsData?.workflows_aggregate?.aggregate?.count ?? workflows.length;
  const activeRunsCount = metricsData?.active_runs?.aggregate?.count ?? 0;
  const completedRunsCount = metricsData?.completed_runs?.aggregate?.count ?? 0;

  const quotaUsed = org?.quota_used ?? 0;
  const quotaLimit = org?.quota_limit ?? 100;
  const usagePercentage = quotaLimit > 0 ? Math.min(100, Math.round((quotaUsed / quotaLimit) * 100)) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Metrics Cards Grid (4 Columns) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        
        {/* Metric 1: Total Workflows */}
        <div className="glass-card stat-card" style={{ padding: '1.25rem', borderRadius: '0.875rem', backgroundColor: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', transition: 'all 0.2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#9ca3af' }}>Total Workflows</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {metricsLoading ? '...' : totalWorkflowsCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Active workflows in your organization
          </div>
        </div>

        {/* Metric 2: Active Runs */}
        <div className="glass-card stat-card" style={{ padding: '1.25rem', borderRadius: '0.875rem', backgroundColor: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', transition: 'all 0.2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#9ca3af' }}>Active Runs</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {metricsLoading ? '...' : activeRunsCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Currently running workflows
          </div>
        </div>

        {/* Metric 3: Completed Runs */}
        <div className="glass-card stat-card" style={{ padding: '1.25rem', borderRadius: '0.875rem', backgroundColor: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', transition: 'all 0.2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#9ca3af' }}>Completed Runs</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {metricsLoading ? '...' : completedRunsCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Successful workflow executions
          </div>
        </div>

        {/* Metric 4: Organization Usage */}
        <div className="glass-card stat-card" style={{ padding: '1.25rem', borderRadius: '0.875rem', backgroundColor: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', transition: 'all 0.2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#9ca3af' }}>Organization Usage</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6"/><path d="M6 20V10"/><path d="M18 20V4"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {usagePercentage}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
            {quotaUsed} / {quotaLimit} executions used
          </div>
        </div>
      </div>

      {/* Grid Section: Quick Actions & Organization Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
        
        {/* Quick Actions Card */}
        <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '0.875rem', backgroundColor: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', margin: '0 0 1rem 0' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link 
              href="/dashboard/workflows/new" 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
                <span>Create New Workflow</span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Link>

            <Link 
              href="/dashboard/workflows" 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                <span>View All Workflows</span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Link>

            <button 
              type="button"
              onClick={() => alert(`Organization Settings for ${org?.name || 'Organization'}\nRole: ${formattedRole}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                <span>Organization Settings</span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>

        {/* Organization Info & Quota Card */}
        <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '0.875rem', backgroundColor: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Organization</span>
              {formattedRole && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '9999px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  {formattedRole}
                </span>
              )}
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.25rem 0' }}>
              {org?.name || 'Loading...'}
            </h3>
            <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: 0 }}>
              Slug: <code style={{ color: '#60a5fa', background: 'rgba(0,0,0,0.2)', padding: '0.1rem 0.3rem', borderRadius: '0.25rem' }}>{org?.slug || 'acme-ai-labs'}</code>
            </p>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <UsageIndicator quotaUsed={quotaUsed} quotaLimit={quotaLimit} />
          </div>
        </div>

      </div>

      {/* Recent Workflows Section */}
      <div style={{ marginTop: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>Recent Workflows</h2>
            <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '0.25rem 0 0 0' }}>Workflows managed within {org?.name || 'your organization'}</p>
          </div>
          <Link href="/dashboard/workflows" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            View all <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>

        {workflowsLoading ? (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'rgba(17, 24, 39, 0.4)' }}>
            <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Loading workflows...</div>
          </div>
        ) : workflows.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {workflows.slice(0, 3).map((wf: any) => (
              <Link 
                href={`/dashboard/workflows/${wf.id}`} 
                key={wf.id} 
                className="glass-card" 
                style={{ 
                  padding: '1.25rem', 
                  borderRadius: '0.875rem', 
                  backgroundColor: 'rgba(17, 24, 39, 0.6)', 
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wf.name}</h3>
                  {wf.workflow_runs?.[0] && (
                    <StatusBadge status={wf.workflow_runs[0].status} />
                  )}
                </div>
                <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '2.5rem', lineHeight: 1.5 }}>
                  {wf.description || 'No description provided.'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: '#6b7280', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <span>{wf.workflow_steps?.length || 0} steps</span>
                  <span>•</span>
                  <span>{wf.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* Polished Empty State for Workflows */
          <div 
            className="glass-card" 
            style={{ 
              padding: '3.5rem 2rem', 
              borderRadius: '1rem', 
              backgroundColor: 'rgba(17, 24, 39, 0.4)', 
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center'
            }}
          >
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', marginBottom: '1.25rem' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>

            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.5rem 0' }}>
              Create your first workflow
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#9ca3af', maxWidth: '400px', margin: '0 0 1.75rem 0', lineHeight: 1.5 }}>
              Build an automated process for your team using multi-step LLM calls, conditional logic, and API triggers.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link 
                href="/dashboard/workflows/new" 
                className="btn btn-primary"
                style={{ 
                  padding: '0.625rem 1.25rem', 
                  borderRadius: '0.5rem', 
                  fontWeight: 600, 
                  fontSize: '0.875rem', 
                  background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
                <span>Create Workflow</span>
              </Link>
              <Link 
                href="/dashboard/workflows" 
                style={{ 
                  padding: '0.625rem 1.25rem', 
                  borderRadius: '0.5rem', 
                  fontWeight: 500, 
                  fontSize: '0.875rem', 
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#e5e7eb'
                }}
              >
                Explore Workflows
              </Link>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

