'use client';
import { useEffect } from 'react';
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
  
  const { selectedOrgId, setSelectedOrg } = useOrg();

  const { data: orgData, loading: orgsLoading } = useQuery(GET_USER_ORGS, {
    variables: { userId: user?.id },
    skip: !user?.id,
  });

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isAuthLoading, router]);

  useEffect(() => {
    if (orgData?.org_members?.length > 0 && !selectedOrgId) {
      const firstOrg = orgData.org_members[0];
      setSelectedOrg(firstOrg.organization.id, firstOrg.role);
    }
  }, [orgData, selectedOrgId, setSelectedOrg]);

  if (isAuthLoading || !isAuthenticated) {
    return <div className="layout-container" style={{ alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', marginBottom: '1rem' }}>Workflow App</h2>
          <select 
            className="form-input" 
            value={selectedOrgId || ''}
            onChange={(e) => {
              const member = orgData?.org_members.find((m: any) => m.organization.id === e.target.value);
              if (member) setSelectedOrg(member.organization.id, member.role);
            }}
            disabled={orgsLoading}
          >
            {orgsLoading ? (
              <option>Loading orgs...</option>
            ) : (
              orgData?.org_members?.map((member: any) => (
                <option key={member.organization.id} value={member.organization.id}>
                  {member.organization.name}
                </option>
              ))
            )}
          </select>
        </div>
        
        <nav className="sidebar-nav">
          <Link href="/dashboard" className={`sidebar-nav-item ${pathname === '/dashboard' ? 'active' : ''}`}>
            Dashboard
          </Link>
          <Link href="/dashboard/workflows" className={`sidebar-nav-item ${pathname.includes('/workflows') ? 'active' : ''}`}>
            Workflows
          </Link>
        </nav>
        
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
              {user?.displayName?.[0]?.toUpperCase() || 'U'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'white', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user?.displayName || 'User'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user?.email}</div>
            </div>
          </div>
          <button onClick={() => signOut()} className="btn btn-secondary" style={{ width: '100%' }}>
            Sign Out
          </button>
        </div>
      </aside>
      
      <main className="main-content">
        {children}
      </main>
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
