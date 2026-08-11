'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthenticationStatus, useUserData, useSignOut } from '@nhost/nextjs';
import { useQuery } from '@apollo/client';
import Link from 'next/link';
import { GET_USER_ORGS } from '@/lib/graphql';
import { OrgProvider, useOrg } from '@/components/OrgContext';

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthenticationStatus();
  const user = useUserData();
  const { signOut } = useSignOut();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const orgDropdownRef = useRef<HTMLDivElement>(null);

  const { selectedOrgId, setSelectedOrg } = useOrg();

  const { data: orgData, loading: orgsLoading } = useQuery(GET_USER_ORGS, {
    variables: { userId: user?.id },
    skip: !user?.id,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target as Node)) {
        setOrgDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isAuthLoading, router]);

  useEffect(() => {
    if (orgData?.org_members?.length > 0 && !selectedOrgId) {
      const firstOrg = orgData.org_members[0];
      setSelectedOrg(firstOrg.organization.id);
    }
  }, [orgData, selectedOrgId, setSelectedOrg]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (isAuthLoading || !isAuthenticated) {
    return (
      <div className="layout-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#0a0e1a', color: '#9ca3af' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <span>Loading workspace...</span>
        </div>
      </div>
    );
  }

  const selectedMember = orgData?.org_members?.find((m: any) => m.organization.id === selectedOrgId);
  const currentOrg = selectedMember?.organization || (orgData?.org_members?.[0]?.organization);
  const currentRole = selectedMember?.role || (orgData?.org_members?.[0]?.role);

  // Format role string (e.g. 'owner' -> 'Owner')
  const formattedRole = currentRole ? currentRole.charAt(0).toUpperCase() + currentRole.slice(1) : '';

  // Dynamic greeting firstName derivation
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const firstName = displayName.split(' ')[0];

  const currentHour = new Date().getHours();
  const timeGreeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="layout-container" style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0a0e1a', color: '#f3f4f6' }}>
      
      {/* Mobile Top Bar */}
      <div style={{ display: 'none', width: '100%', padding: '0.75rem 1rem', backgroundColor: '#111827', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }} className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#ffffff' }}>Workflow App</span>
        </div>
        <button 
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation menu"
          style={{ background: 'none', border: 'none', color: '#9ca3af', padding: '0.5rem', cursor: 'pointer' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
        </button>
      </div>

      {/* Sidebar Overlay on Mobile */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 45, backdropFilter: 'blur(4px)' }}
        />
      )}

      {/* Sidebar Navigation */}
      <aside 
        className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}
        style={{
          width: sidebarCollapsed ? '76px' : '280px',
          backgroundColor: '#111827',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          flexShrink: 0,
          transition: 'width 0.3s ease, transform 0.3s ease'
        }}
      >
        {/* Brand Header & Organization Switcher */}
        <div style={{ padding: sidebarCollapsed ? '1rem 0.625rem' : '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', gap: '0.5rem', marginBottom: sidebarCollapsed ? '0.75rem' : '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)', flexShrink: 0 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </div>
              {!sidebarCollapsed && (
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.2, whiteSpace: 'nowrap' }}>Workflow App</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>Automation Platform</div>
                </div>
              )}
            </div>

            {/* Sidebar Collapse Toggle Button */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#9ca3af',
                padding: '0.4rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                <polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/>
              </svg>
            </button>
          </div>

          {/* Org Selector Card & Custom Dropdown */}
          <div ref={orgDropdownRef} style={{ position: 'relative', width: '100%' }}>
            <button
              type="button"
              onClick={() => setOrgDropdownOpen((prev) => !prev)}
              disabled={orgsLoading || !orgData?.org_members?.length}
              aria-expanded={orgDropdownOpen}
              aria-label="Select organization"
              title={sidebarCollapsed ? (currentOrg?.name || 'Organization') : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                gap: '0.625rem',
                padding: sidebarCollapsed ? '0.625rem 0.5rem' : '0.625rem 0.75rem',
                backgroundColor: orgDropdownOpen ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: orgDropdownOpen ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '0.625rem',
                cursor: orgsLoading ? 'wait' : 'pointer',
                transition: 'all 0.2s ease',
                color: '#ffffff',
                textAlign: 'left',
                outline: 'none',
                boxShadow: orgDropdownOpen ? '0 0 12px rgba(59, 130, 246, 0.2)' : 'none'
              }}
              onMouseOver={(e) => {
                if (!orgDropdownOpen && !orgsLoading) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }
              }}
              onMouseOut={(e) => {
                if (!orgDropdownOpen) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }
              }}
            >
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)'
              }}>
                {currentOrg?.name?.[0]?.toUpperCase() || 'O'}
              </div>

              {!sidebarCollapsed && (
                <>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {currentOrg?.name || (orgsLoading ? 'Loading...' : 'No Organization')}
                    </div>
                    {formattedRole && (
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>{formattedRole}</span>
                      </div>
                    )}
                  </div>

                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9ca3af"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: orgDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}
                  >
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </>
              )}
            </button>

            {/* Custom Popover Dropdown Menu */}
            {orgDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  backgroundColor: '#161e2e',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '0.75rem',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
                  backdropFilter: 'blur(16px)',
                  zIndex: 100,
                  padding: '0.5rem',
                  animation: 'slideUp 0.15s ease-out'
                }}
              >
                <div style={{ padding: '0.375rem 0.5rem 0.5rem', fontSize: '0.65rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Organizations ({orgData?.org_members?.length || 1})
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {orgsLoading ? (
                    <div style={{ padding: '0.5rem', fontSize: '0.8125rem', color: '#9ca3af', textAlign: 'center' }}>Loading organizations...</div>
                  ) : orgData?.org_members?.length > 0 ? (
                    orgData.org_members.map((member: any) => {
                      const isSelected = member.organization.id === currentOrg?.id;
                      const memberRole = member.role ? member.role.charAt(0).toUpperCase() + member.role.slice(1) : 'Member';
                      return (
                        <button
                          key={member.organization.id}
                          type="button"
                          onClick={() => {
                            setSelectedOrg(member.organization.id);
                            setOrgDropdownOpen(false);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.625rem',
                            padding: '0.5rem 0.625rem',
                            borderRadius: '0.5rem',
                            backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                            border: isSelected ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseOver={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                          }}
                          onMouseOut={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            backgroundColor: isSelected ? '#3b82f6' : '#374151',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            flexShrink: 0
                          }}>
                            {member.organization.name?.[0]?.toUpperCase() || 'O'}
                          </div>

                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {member.organization.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: isSelected ? '#60a5fa' : '#9ca3af' }}>
                              {memberRole}
                            </div>
                          </div>

                          {isSelected && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div style={{ padding: '0.5rem 0.625rem', fontSize: '0.8125rem', color: '#ffffff' }}>
                      No organization membership
                    </div>
                  )}
                </div>

                <div style={{ margin: '0.375rem 0', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }} />

                <button
                  type="button"
                  onClick={() => {
                    setOrgDropdownOpen(false);
                    alert(`Managing Organizations for ${currentOrg?.name || 'your organization'}\nRole: ${formattedRole || 'N/A'}`);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.625rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: '#9ca3af',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.color = '#9ca3af';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>Manage Organizations</span>
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: sidebarCollapsed ? '1rem 0.5rem' : '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto' }}>
          <Link 
            href="/dashboard" 
            title={sidebarCollapsed ? "Dashboard" : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: '0.75rem',
              padding: sidebarCollapsed ? '0.625rem 0.5rem' : '0.625rem 0.875rem',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: pathname === '/dashboard' ? '#ffffff' : '#9ca3af',
              backgroundColor: pathname === '/dashboard' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              borderLeft: pathname === '/dashboard' ? '3px solid #3b82f6' : '3px solid transparent',
              transition: 'all 0.15s ease'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
            {!sidebarCollapsed && <span>Dashboard</span>}
          </Link>

          <Link 
            href="/dashboard/workflows" 
            title={sidebarCollapsed ? "Workflows" : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: '0.75rem',
              padding: sidebarCollapsed ? '0.625rem 0.5rem' : '0.625rem 0.875rem',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: pathname.includes('/workflows') ? '#ffffff' : '#9ca3af',
              backgroundColor: pathname.includes('/workflows') ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              borderLeft: pathname.includes('/workflows') ? '3px solid #3b82f6' : '3px solid transparent',
              transition: 'all 0.15s ease'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            {!sidebarCollapsed && <span>Workflows</span>}
          </Link>

          <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
            {!sidebarCollapsed && (
              <span style={{ display: 'block', padding: '0 0.875rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Management
              </span>
            )}
            <button 
              type="button"
              title={sidebarCollapsed ? "Settings" : undefined}
              onClick={() => alert(`Organization Settings for ${currentOrg?.name || 'Organization'}\nRole: ${formattedRole}`)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                gap: '0.75rem',
                padding: sidebarCollapsed ? '0.625rem 0.5rem' : '0.625rem 0.875rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#9ca3af',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              {!sidebarCollapsed && <span>Settings</span>}
            </button>
          </div>
        </nav>

        {/* User Profile Footer */}
        <div style={{ padding: sidebarCollapsed ? '1rem 0.5rem' : '1rem 1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', gap: '0.75rem', marginBottom: sidebarCollapsed ? '0.5rem' : '0.875rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0 }} title={sidebarCollapsed ? `${displayName} (${user?.email})` : undefined}>
              {displayName[0]?.toUpperCase() || 'U'}
            </div>
            {!sidebarCollapsed && (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</span>
                  {formattedRole && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '0.25rem', backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', textTransform: 'uppercase' }}>{formattedRole}</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
              </div>
            )}
          </div>

          <button 
            type="button"
            onClick={() => signOut()} 
            title={sidebarCollapsed ? "Sign out" : undefined}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#9ca3af',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)'; e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            {!sidebarCollapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>
      
      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
        {/* Top Header */}
        <header className="page-header" style={{ padding: '1.25rem 2rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(17, 24, 39, 0.7)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
              {timeGreeting}, {firstName}
            </h1>
            <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '0.25rem 0 0 0' }}>
              Here's what's happening across {currentOrg?.name || 'your organization'}.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {currentOrg && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem', borderRadius: '9999px', backgroundColor: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.75rem', color: '#e5e7eb' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                <span>{currentOrg.name}</span>
                {formattedRole && (
                  <>
                    <span style={{ color: '#6b7280' }}>•</span>
                    <span style={{ color: '#3b82f6', fontWeight: 600 }}>{formattedRole}</span>
                  </>
                )}
              </div>
            )}

            <Link href="/dashboard/workflows/new" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.375rem', borderRadius: '0.5rem', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#ffffff' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
              <span>Create Workflow</span>
            </Link>
          </div>
        </header>

        <main className="page-body" style={{ padding: '2rem', flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrgProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </OrgProvider>
  );
}

