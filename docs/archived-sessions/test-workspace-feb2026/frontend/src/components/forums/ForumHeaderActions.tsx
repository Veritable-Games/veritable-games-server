'use client';

import Link from 'next/link';
import { Users } from 'lucide-react';
import { LoginWidget } from './LoginWidget';
import { useAuth } from '@/contexts/AuthContext';

export function ForumHeaderActions() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <LoginWidget />
      {user && (
        <Link
          href="/users"
          className="header-action-btn flex h-8 items-center gap-1.5 rounded border border-blue-600 px-3 py-1.5 text-sm text-blue-400 transition-colors hover:border-blue-500 hover:text-blue-300"
        >
          <Users className="h-4 w-4 md:hidden" />
          <span className="hidden md:inline">User List</span>
        </Link>
      )}
    </div>
  );
}
