'use client';

import { useState, useMemo } from 'react';
import { User } from '@/lib/users/types';
import UserIndexFilters from './UserIndexFilters';
import UserListClient from './UserListClient';
import InviteUserDialog from './InviteUserDialog';

interface UsersPageClientProps {
  users: User[];
  isAdmin: boolean;
  selectedCount?: number;
}

export default function UsersPageClient({ users: initialUsers, isAdmin }: UsersPageClientProps) {
  // Stateful users list for real-time updates without page refresh
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());

  // Filter state (client-side filtering like Library)
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'username' | 'active'>('recent');
  const [roleFilter, setRoleFilter] = useState<string>('');

  // Callback to update user ban status without page refresh
  const handleUserStatusChange = (userIds: number[], isActive: boolean) => {
    setUsers(prev =>
      prev.map(user => (userIds.includes(user.id) ? { ...user, is_active: isActive } : user))
    );
  };

  // Calculate banned user count for admin display
  // Users are considered banned if is_active = false
  const bannedCount = useMemo(() => {
    return users.filter(user => !user.is_active).length;
  }, [users]);

  // Client-side filtering with useMemo (instant updates)
  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        user =>
          user.username.toLowerCase().includes(query) ||
          user.display_name?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query)
      );
    }

    // Filter by role
    if (roleFilter) {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Sort results
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'username':
          return a.username.localeCompare(b.username);
        case 'active':
          const aActive = a.last_login_at ? new Date(a.last_login_at).getTime() : 0;
          const bActive = b.last_login_at ? new Date(b.last_login_at).getTime() : 0;
          return bActive - aActive;
        case 'recent':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return sorted;
  }, [users, searchQuery, sortBy, roleFilter]);

  return (
    <>
      {/* Search Filters with embedded hints */}
      <div className="mb-6 flex-shrink-0">
        <UserIndexFilters
          isAdmin={isAdmin}
          onInviteUser={() => setShowInviteDialog(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          roleFilter={roleFilter}
          onRoleChange={setRoleFilter}
          resultCount={filteredUsers.length}
          bannedCount={bannedCount}
          adminHints={
            isAdmin ? (
              <div className="text-xs text-gray-500">
                {selectedUsers.size > 0 ? (
                  <span className="text-blue-400">
                    {selectedUsers.size} selected · Tab: Soft Ban/Unban · Delete: Hard Ban · Esc to
                    cancel
                  </span>
                ) : (
                  <span>Ctrl+click to select users · Tab: Ban/Unban · Delete: Hard Ban</span>
                )}
              </div>
            ) : undefined
          }
        />
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-y-auto pr-0 [scrollbar-width:none] md:pr-4 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
        {filteredUsers.length > 0 ? (
          <UserListClient
            users={filteredUsers}
            isAdmin={isAdmin}
            showAdminHints={isAdmin}
            selectedUsers={selectedUsers}
            setSelectedUsers={setSelectedUsers}
            onUserStatusChange={handleUserStatusChange}
          />
        ) : (
          <div className="py-12 text-center">
            <div className="mb-4 text-gray-400">
              <svg
                className="mx-auto mb-4 h-16 w-16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-medium text-white">No users found</h3>
            <p className="text-gray-400">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Invite User Dialog */}
      {showInviteDialog && (
        <InviteUserDialog
          onClose={() => setShowInviteDialog(false)}
          onSuccess={() => {
            setShowInviteDialog(false);
            window.location.reload();
          }}
        />
      )}
    </>
  );
}
