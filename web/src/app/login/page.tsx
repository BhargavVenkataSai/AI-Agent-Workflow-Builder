'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSignInEmailPassword, useSignUpEmailPassword, useAuthenticationStatus, useSignOut } from '@nhost/nextjs';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  
  const router = useRouter();
  const { isAuthenticated } = useAuthenticationStatus();
  const { signOut } = useSignOut();

  const { signInEmailPassword, isLoading: isSignInLoading } = useSignInEmailPassword();
  const { signUpEmailPassword, isLoading: isSignUpLoading } = useSignUpEmailPassword();

  // Automatically redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

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
        const status = res.error.status;
        const msg = res.error.message || '';
        
        if (msg.toLowerCase().includes('unverified') || msg.toLowerCase().includes('verify') || (res.error as any)?.error === 'unverified-user') {
          setNotification({
            type: 'info',
            message: 'Your email address is not verified yet. Please check your email inbox for the verification link.'
          });
        } else if (status === 401 || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('incorrect')) {
          setNotification({
            type: 'error',
            message: 'Invalid email or password. Please double-check your credentials.'
          });
        } else {
          setNotification({
            type: 'error',
            message: msg || 'Sign in failed. Please check your credentials and try again.'
          });
        }
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
              message: 'Account created successfully! Please sign in with your password.'
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
    <div 
      className="auth-container" 
      style={{ 
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0e1a',
        color: '#f3f4f6',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        padding: '1.5rem 1rem',
        boxSizing: 'border-box'
      }}
    >
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .auth-input-focus:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25) !important;
        }
      `}</style>

      {/* Background Decorative Radial Glows */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(50px)', zIndex: 0, pointerEvents: 'none' }}></div>
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(50px)', zIndex: 0, pointerEvents: 'none' }}></div>

      {/* Main Authentication Card */}
      <div 
        className="glass-card auth-card animate-slide-up" 
        style={{ 
          width: '100%',
          maxWidth: '420px',
          margin: '0 auto',
          padding: '2.5rem 2rem',
          backgroundColor: 'rgba(17, 24, 39, 0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '1rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          position: 'relative',
          zIndex: 1,
          boxSizing: 'border-box'
        }}
      >
        {/* Top Border Glow Accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)' }}></div>

        {/* Brand Icon Header */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px -4px rgba(59, 130, 246, 0.5)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
        </div>

        <h1 style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.5rem 0', letterSpacing: '-0.025em' }}>
          {isLogin ? 'Welcome back' : 'Create an account'}
        </h1>
        <p style={{ textAlign: 'center', color: '#9ca3af', margin: '0 0 2rem 0', fontSize: '0.875rem', lineHeight: 1.5 }}>
          {isLogin ? 'Enter your credentials to access your account' : 'Sign up to start building automated workflows'}
        </p>


        {/* Notification Banner */}
        {notification && (
          <div 
            style={{
              padding: '0.875rem 1rem',
              borderRadius: '0.75rem',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              backgroundColor: notification.type === 'success' ? 'rgba(34, 197, 94, 0.12)' : notification.type === 'info' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${notification.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : notification.type === 'info' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: notification.type === 'success' ? '#4ade80' : notification.type === 'info' ? '#60a5fa' : '#f87171',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem'
            }}
          >
            <div style={{ marginTop: '0.125rem', flexShrink: 0 }}>
              {notification.type === 'success' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>}
              {notification.type === 'info' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>}
              {notification.type === 'error' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>}
            </div>
            <span style={{ lineHeight: 1.4 }}>{notification.message}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Email Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="email" style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e5e7eb' }}>
              Email address
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <div style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none', color: '#9ca3af', zIndex: 2 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              </div>
              <input 
                id="email"
                type="email" 
                className="auth-input-focus"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={isLoading}
                autoComplete="email"
                style={{ 
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.75rem 0.875rem 0.75rem 2.75rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '0.5rem',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="password" style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e5e7eb' }}>
              Password
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <div style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none', color: '#9ca3af', zIndex: 2 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <input 
                id="password"
                type={showPassword ? "text" : "password"}
                className="auth-input-focus"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
                autoComplete={isLogin ? "current-password" : "new-password"}
                style={{ 
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.75rem 2.75rem 0.75rem 2.75rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '0.5rem',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                style={{ 
                  position: 'absolute', 
                  right: '0.875rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  background: 'none', 
                  border: 'none', 
                  color: '#9ca3af', 
                  cursor: 'pointer', 
                  padding: '0.25rem',
                  borderRadius: '0.25rem',
                  zIndex: 2,
                  outline: 'none'
                }}
                onFocus={(e) => e.currentTarget.style.color = '#ffffff'}
                onBlur={(e) => e.currentTarget.style.color = '#9ca3af'}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            style={{ 
              width: '100%', 
              marginTop: '0.5rem', 
              padding: '0.875rem', 
              background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)', 
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)',
              transition: 'all 0.2s ease',
              opacity: isLoading ? 0.75 : 1
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Processing...
              </>
            ) : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>
        
        {/* Toggle Login/Signup Footer */}
        <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.875rem', color: '#9ca3af' }}>
          <span>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button 
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setNotification(null);
            }}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#60a5fa', 
              cursor: 'pointer', 
              fontWeight: 600,
              fontSize: '0.875rem',
              padding: '0.2rem 0.4rem',
              borderRadius: '0.25rem',
              transition: 'color 0.2s'
            }}
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
