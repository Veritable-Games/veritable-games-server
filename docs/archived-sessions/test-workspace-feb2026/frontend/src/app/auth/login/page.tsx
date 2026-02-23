'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import RegisterForm from '@/components/auth/RegisterForm';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import type { User } from '@/lib/auth/utils';
import { logger } from '@/lib/utils/logger';

/**
 * Login/Register Page Content Component
 *
 * Separated from page to allow Suspense boundary wrapping for useSearchParams()
 * Required by Next.js 15 to prevent blocking during static page generation.
 */
function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<'login' | 'register' | 'forgot-password'>('login');
  const [isLoading, setIsLoading] = useState(true);

  // Extract token from URL for registration
  const tokenFromUrl = searchParams.get('token');

  // Initialize CSRF token and check if user is already logged in
  useEffect(() => {
    async function initialize() {
      try {
        // Step 1: Initialize CSRF token (required for login/register)
        logger.info('[Login Page] Initializing CSRF token...');
        const csrfResponse = await fetch('/api/csrf', { credentials: 'include' });
        if (!csrfResponse.ok) {
          logger.warn('[Login Page] CSRF initialization returned:', csrfResponse.status);
        } else {
          logger.info('[Login Page] ✅ CSRF token initialized');
        }
      } catch (error) {
        logger.error('[Login Page] CSRF initialization failed:', error);
        // Continue anyway - login might still work with the fallback
      }

      // Step 2: Check if user is already logged in
      try {
        const response = await fetch('/api/auth/me');
        const result = await response.json();

        if (result.success && result.data?.user) {
          // User is already logged in, redirect
          const redirectTo = searchParams.get('redirect') || '/';
          router.push(redirectTo);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        logger.error('Auth check error:', error);
        setIsLoading(false);
      }
    }

    initialize();
  }, [router, searchParams]);

  // Auto-switch to register tab if token is present in URL
  useEffect(() => {
    if (tokenFromUrl) {
      setView('register');
    }
  }, [tokenFromUrl]);

  const handleLogin = async (user: User) => {
    logger.info('Login successful:', user.username);

    // Wait a brief moment for session cookie to be fully established
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get redirect destination
    const redirectTo = searchParams.get('redirect') || '/';

    // Use hard redirect to ensure page fully reloads with new auth state
    // This is necessary because Next.js soft navigation doesn't re-fetch
    // server components and the cached auth state would be stale
    window.location.href = redirectTo;
  };

  const handleRegister = (user: User) => {
    logger.info('Registration successful:', user.username);

    // Use hard redirect to ensure page fully reloads with new auth state
    window.location.href = '/';
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <div className="flex items-center space-x-2 text-white">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
          <span className="text-lg">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 px-4 pb-6 pt-12">
      {/* Site header */}
      <div className="mb-4 text-center">
        <h1 className="mb-2 text-4xl font-bold text-white">Veritable Games</h1>
        <p className="text-gray-300">Developer Testing Phase - Authentication Required</p>
      </div>

      {/* Redirect notice */}
      {searchParams.get('redirect') && (
        <div className="mb-4 w-full max-w-md rounded border border-blue-700 bg-blue-900/50 px-4 py-3 text-blue-200">
          <p className="text-sm">
            Please sign in to continue to{' '}
            <span className="font-mono font-bold">{searchParams.get('redirect')}</span>
          </p>
        </div>
      )}

      {/* Tab switcher - hide when on forgot password */}
      {view !== 'forgot-password' && (
        <div className="mb-3 w-full max-w-md">
          <div className="flex rounded-lg bg-gray-800 p-1">
            <button
              onClick={() => setView('login')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                view === 'login'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setView('register')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                view === 'register'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Create Account
            </button>
          </div>
        </div>
      )}

      {/* Forms */}
      {view === 'login' && (
        <LoginForm
          onLogin={handleLogin}
          onSwitchToRegister={() => setView('register')}
          onForgotPassword={() => setView('forgot-password')}
        />
      )}
      {view === 'register' && (
        <RegisterForm
          onRegister={handleRegister}
          onSwitchToLogin={() => setView('login')}
          initialToken={tokenFromUrl || undefined}
        />
      )}
      {view === 'forgot-password' && <ForgotPasswordForm onBackToLogin={() => setView('login')} />}

      {/* Footer info */}
      <div className="mt-4 max-w-md text-center text-sm text-gray-400">
        <p>🔒 This site is currently in closed testing.</p>
        <p className="mt-1">Registration requires an invitation token.</p>
      </div>
    </div>
  );
}

/**
 * Login/Register Page
 *
 * Combined authentication page with tab switching.
 * Supports redirect parameter for post-login navigation.
 *
 * Wrapped in Suspense to support useSearchParams() in Next.js 15.
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
          <div className="flex items-center space-x-2 text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
            <span className="text-lg">Loading...</span>
          </div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
