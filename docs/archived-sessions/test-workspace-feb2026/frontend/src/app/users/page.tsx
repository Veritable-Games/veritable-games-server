import { UserService } from '@/lib/users/service';
import { UserSearchOptions } from '@/lib/users/types';
import Link from 'next/link';
import React, { Suspense } from 'react';
import UsersPageClient from '@/components/users/UsersPageClient';
import { getCurrentUser } from '@/lib/auth/server';
import { logger } from '@/lib/utils/logger';

interface MembersPageProps {
  searchParams: Promise<{
    q?: string;
    page?: string;
    sort?: string;
    role?: string;
  }>;
}

async function getUsersData(
  searchOptions: UserSearchOptions,
  viewerRole?: 'user' | 'moderator' | 'developer' | 'admin'
) {
  const userService = new UserService();

  try {
    const users = await userService.searchUsers({ ...searchOptions, viewerRole });
    return users;
  } catch (error) {
    logger.error('Error fetching users:', error);
    return [];
  }
}

async function MembersListContent({ searchParams }: MembersPageProps) {
  const resolvedParams = await searchParams;
  const query = resolvedParams.q || '';
  const page = parseInt(resolvedParams.page || '1');
  const sort = resolvedParams.sort || 'recent';
  const role = resolvedParams.role || '';

  // Get current user to check if admin and for filtering
  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'moderator';

  const searchOptions: UserSearchOptions = {
    query: query.trim() || undefined,
    limit: 20,
    offset: (page - 1) * 20,
    sort: sort as UserSearchOptions['sort'],
    role: role as 'user' | 'moderator' | 'developer' | 'admin' | undefined,
  };

  const users = await getUsersData(searchOptions, currentUser?.role);

  const breadcrumbs = [{ label: 'Forums', href: '/forums' }, { label: 'Users' }];

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col px-6 py-4">
      {/* Header */}
      <div className="mb-6 flex-shrink-0">
        <nav className="mb-4 text-sm text-gray-400" aria-label="Breadcrumb">
          <ol className="flex items-center">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                <li>
                  {crumb.href ? (
                    <Link href={crumb.href} className="transition-colors hover:text-blue-400">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-white">{crumb.label}</span>
                  )}
                </li>
                {index < breadcrumbs.length - 1 && (
                  <li>
                    <span className="mx-2">›</span>
                  </li>
                )}
              </React.Fragment>
            ))}
          </ol>
        </nav>

        <h1 className="mb-2 text-2xl font-bold text-white">User Index</h1>
        <p className="hidden text-gray-400 md:block">
          Discover and connect with other community users
        </p>
      </div>

      {/* Users Page Client (Filters + List + Dialogs) */}
      <UsersPageClient users={users} isAdmin={isAdmin} />

      {/* Pagination */}
      {users.length === 20 && (
        <div className="mt-6 flex-shrink-0 border-t border-gray-700 pt-4">
          <div className="flex justify-center">
            <div className="flex space-x-2">
              {page > 1 && (
                <Link
                  href={`/users?${new URLSearchParams({
                    ...(query && { q: query }),
                    ...(sort !== 'recent' && { sort }),
                    ...(role && { role }),
                    page: (page - 1).toString(),
                  }).toString()}`}
                  className="rounded bg-gray-800 px-4 py-2 text-white transition-colors hover:bg-gray-700"
                >
                  Previous
                </Link>
              )}
              <span className="rounded bg-gray-700 px-4 py-2 text-white">Page {page}</span>
              <Link
                href={`/users?${new URLSearchParams({
                  ...(query && { q: query }),
                  ...(sort !== 'recent' && { sort }),
                  ...(role && { role }),
                  page: (page + 1).toString(),
                }).toString()}`}
                className="rounded bg-gray-800 px-4 py-2 text-white transition-colors hover:bg-gray-700"
              >
                Next
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MembersPage(props: MembersPageProps) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex h-full max-w-6xl flex-col px-6 py-4">
          <div className="text-gray-400">Loading users...</div>
        </div>
      }
    >
      <MembersListContent {...props} />
    </Suspense>
  );
}
