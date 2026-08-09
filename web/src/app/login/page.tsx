'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSignInEmailPassword, useSignUpEmailPassword, useAuthenticationStatus, useSignOut } from '@nhost/nextjs';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  
  const router = useRouter();
  const { isAuthenticated } = useAuthenticationStatus();
  const { signOut } = useSignOut();

  const { signInEmailPassword, isLoading: isSignInLoading, error: signInError } = useSignInEmailPassword();
  const { signUpEmailPassword, isLoading: isSignUpLoading, error: signUpError } = useSignUpEmailPassword();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    // If user is already authenticated, sign them out first so they can sign in with the new account
    if (isAuthenticated) {
      await signOut();
    }

    if (isLogin) {
      const res = await signInEmailPassword(email, password);
      if (res.isSuccess) {
        router.push('/dashboard');
      } else if (res.error) {
        setNotification({
          type: 'error',
          message: res.error.message || 'Invalid email or password. Please try again.'
        });
      }
    } else {
      const res = await signUpEmailPassword(email, password);
      if (res.isSuccess) {
        if (res.needsEmailVerification) {
          setNotification({
            type: 'info',
            message: 'Account created! Please check your email to verify your account before logging in.'
          });
          setIsLogin(true);
        } else {
          // Auto sign-in on success
          const signInRes = await signInEmailPassword(email, password);
          if (signInRes.isSuccess) {
            router.push('/dashboard');
          } else {
            setNotification({
              type: 'success',
              message: 'Account created successfully! Please sign in below.'
            });
            setIsLogin(true);
          }
        }
      } else if (res.error) {
        const errorMsg = res.error.message || '';
        if (errorMsg.toLowerCase().includes('already') || res.error.status === 409) {
          setNotification({
            type: 'info',
            message: 'An account with this email already exists. Switched to Sign In.'
          });
          setIsLogin(true);
        } else {
          setNotification({
            type: 'error',
            message: errorMsg || 'Sign up failed. Please try again.'
          });
        }
      }
    }
  };

  const isLoading = isLogin ? isSignInLoading : isSignUpLoading;

  return (
    <div className="auth-container">
      <div className="glass-card auth-card animate-slide-up">
        <h1 className="auth-title">Agent Workflow</h1>
        <p className="auth-subtitle">{isLogin ? 'Sign in to your account' : 'Create a new account'}</p>

        {isAuthenticated && !notification && (
          <div 
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#60a5fa',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>You are currently signed in.</span>
            <button 
              onClick={() => router.push('/dashboard')}
              style={{ background: 'none', border: 'none', color: '#60a5fa', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}
            >
              Go to Dashboard →
            </button>
          </div>
        )}
        
        {notification && (
          <div 
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              backgroundColor: notification.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : notification.type === 'info' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${notification.type === 'success' ? 'rgba(34, 197, 94, 0.4)' : notification.type === 'info' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              color: notification.type === 'success' ? '#4ade80' : notification.type === 'info' ? '#60a5fa' : '#f87171',
            }}
          >
            {notification.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input 
              type="email" 
              className="form-input" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '1rem', padding: '0.75rem' }}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>
        
        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setNotification(null);
            }}
            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 500 }}
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
