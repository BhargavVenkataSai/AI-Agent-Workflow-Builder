'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthenticationStatus } from '@nhost/nextjs';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuthenticationStatus();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="auth-container">
      <div className="glass-card animate-fade-in" style={{ textAlign: 'center', padding: '3rem' }}>
        <h1 className="auth-title">AI Agent Workflow Builder</h1>
        <p className="auth-subtitle" style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>Redirecting...</p>
        <div className="skeleton" style={{ height: '4px', width: '200px', margin: '0 auto', borderRadius: '4px' }}></div>
      </div>
    </div>
  );
}
