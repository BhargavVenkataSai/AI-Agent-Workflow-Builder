'use client';

import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useUserData } from '@nhost/nextjs';
import { GET_USER_ORGS } from '@/lib/graphql';
import { useOrg } from '@/components/OrgContext';

export default function SettingsPage() {
  const user = useUserData();
  const { selectedOrgId } = useOrg();
  const [copiedId, setCopiedId] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'api'>('general');

  const { data: orgData, loading: orgsLoading } = useQuery(GET_USER_ORGS, {
    variables: { userId: user?.id },
    skip: !user?.id,
  });

  const selectedMember = orgData?.org_members?.find(
    (m: any) => m.organization.id === selectedOrgId
  );
  const currentOrg = selectedMember?.organization || orgData?.org_members?.[0]?.organization;
  const currentRole = selectedMember?.role || orgData?.org_members?.[0]?.role || 'owner';

  const formattedRole = currentRole ? currentRole.charAt(0).toUpperCase() + currentRole.slice(1) : 'Owner';
  const isOwner = currentRole === 'owner';
  const members = currentOrg?.org_members || [];

  const quotaUsed = currentOrg?.quota_used || 0;
  const quotaLimit = currentOrg?.quota_limit || 100;
  const quotaPercentage = Math.min(100, Math.round((quotaUsed / quotaLimit) * 100));

  const handleCopyOrgId = () => {
    if (currentOrg?.id) {
      navigator.clipboard.writeText(currentOrg.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  if (orgsLoading) {
    return (
      <div style={{ color: '#9ca3af', padding: '2rem', textAlign: 'center' }}>
        Loading organization settings...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: 'white', fontSize: '1rem'
          }}>
            {currentOrg?.name?.[0]?.toUpperCase() || 'O'}
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Organization Settings
          </h1>
        </div>
        <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '0.25rem 0 0 0' }}>
          Manage workspace preferences, team member access, and execution limits for <strong style={{ color: '#ffffff' }}>{currentOrg?.name || 'your organization'}</strong>.
        </p>
      </div>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          style={{
            padding: '0.625rem 1rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'general' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            color: activeTab === 'general' ? '#60a5fa' : '#9ca3af',
            transition: 'all 0.15s ease'
          }}
        >
          ⚙️ General & Quota
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('members')}
          style={{
            padding: '0.625rem 1rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'members' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            color: activeTab === 'members' ? '#60a5fa' : '#9ca3af',
            transition: 'all 0.15s ease'
          }}
        >
          👥 Team Members ({members.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('api')}
          style={{
            padding: '0.625rem 1rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'api' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            color: activeTab === 'api' ? '#60a5fa' : '#9ca3af',
            transition: 'all 0.15s ease'
          }}
        >
          🔑 Webhooks & API
        </button>
      </div>

      {/* Main Settings Card */}
      <div className="glass-card" style={{ padding: '1.75rem', backgroundColor: '#111827', borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        {activeTab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#d1d5db', marginBottom: '0.375rem' }}>
                  Organization Name
                </label>
                <input
                  type="text"
                  readOnly
                  value={currentOrg?.name || 'Organization'}
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.875rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#d1d5db', marginBottom: '0.375rem' }}>
                  Your Access Role
                </label>
                <div style={{
                  padding: '0.625rem 0.875rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '8px',
                  color: '#60a5fa',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span>🛡️ {formattedRole}</span>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 400 }}>
                    {isOwner ? 'Full Permissions' : 'Read/Execute Permissions'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#d1d5db', marginBottom: '0.375rem' }}>
                Organization UUID
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  readOnly
                  value={currentOrg?.id || ''}
                  style={{
                    flex: 1,
                    padding: '0.625rem 0.875rem',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    color: '#9ca3af',
                    fontFamily: 'monospace',
                    fontSize: '0.8125rem'
                  }}
                />
                <button
                  type="button"
                  onClick={handleCopyOrgId}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.625rem 1rem', fontSize: '0.8125rem', fontWeight: 600 }}
                >
                  {copiedId ? '✓ Copied' : '📋 Copy ID'}
                </button>
              </div>
            </div>

            <div style={{
              padding: '1.25rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#ffffff' }}>
                    Monthly Execution Quota
                  </h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                    Atomic execution quota tracked per monthly billing period.
                  </p>
                </div>
                <span style={{
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  padding: '0.25rem 0.625rem',
                  borderRadius: '9999px',
                  backgroundColor: quotaPercentage >= 90 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: quotaPercentage >= 90 ? '#f87171' : '#34d399',
                  border: `1px solid ${quotaPercentage >= 90 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                }}>
                  {quotaUsed} / {quotaLimit} Runs Used ({quotaPercentage}%)
                </span>
              </div>

              <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden', marginTop: '0.75rem' }}>
                <div style={{
                  height: '100%',
                  width: `${quotaPercentage}%`,
                  background: quotaPercentage >= 90 ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
              Members belonging to <strong style={{ color: '#ffffff' }}>{currentOrg?.name}</strong> and their organization authorization roles.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {members.map((m: any) => {
                const memberEmail = m.user?.email || m.user?.displayName || m.user_id;
                const memberRole = m.role ? m.role.charAt(0).toUpperCase() + m.role.slice(1) : 'Member';
                const isUserOwner = m.role === 'owner';

                return (
                  <div
                    key={m.id || m.user_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.875rem 1rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '34px', height: '34px', borderRadius: '50%',
                        background: isUserOwner ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'linear-gradient(135deg, #6b7280, #374151)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, fontSize: '0.8125rem'
                      }}>
                        {memberEmail[0]?.toUpperCase() || 'M'}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff' }}>
                          {memberEmail}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                          ID: <span style={{ fontFamily: 'monospace' }}>{m.user_id}</span>
                        </div>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.625rem',
                      borderRadius: '6px',
                      backgroundColor: isUserOwner ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                      color: isUserOwner ? '#60a5fa' : '#9ca3af',
                      border: `1px solid ${isUserOwner ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
                    }}>
                      {memberRole}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              padding: '1.25rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px'
            }}>
              <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#ffffff' }}>
                Inbound Webhook Integration
              </h4>
              <p style={{ margin: '0.25rem 0 0.875rem 0', fontSize: '0.8125rem', color: '#9ca3af' }}>
                External systems can trigger active workflows in this organization using authenticated Hasura Action webhooks.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', marginBottom: '0.25rem' }}>
                    Webhook Endpoint URL
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook-trigger`}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '6px',
                      color: '#60a5fa',
                      fontFamily: 'monospace',
                      fontSize: '0.8125rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', marginBottom: '0.25rem' }}>
                    Example Authorization Header
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="Authorization: Bearer <your-webhook-trigger-secret>"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '6px',
                      color: '#9ca3af',
                      fontFamily: 'monospace',
                      fontSize: '0.8125rem'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
