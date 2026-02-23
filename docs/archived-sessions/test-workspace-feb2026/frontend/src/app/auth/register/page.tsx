'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Register Page Redirect
 *
 * Redirects to /auth/login (which has both login and register forms)
 */
export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auth/login');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <div className="flex items-center space-x-2 text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
        <span className="text-lg">Redirecting...</span>
      </div>
    </div>
  );
}
