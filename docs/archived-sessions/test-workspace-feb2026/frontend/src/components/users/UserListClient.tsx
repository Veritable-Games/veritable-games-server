'use client';

import { useState, useEffect } from 'react';
import { User } from '@/lib/users/types';
import UserCard from './UserCard';
import BanUserDialog from './BanUserDialog';

interface UserListClientProps {
  users: User[];
  isAdmin: boolean;
  showAdminHints?: boolean;
  selectedUsers: Set<number>;
  setSelectedUsers: (users: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
  onUserStatusChange?: (userIds: number[], isActive: boolean) => void;
}

export default function UserListClient({
  users,
  isAdmin,
  showAdminHints = false,
  selectedUsers,
  setSelectedUsers,
  onUserStatusChange,
}: UserListClientProps) {
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [showHardBanDialog, setShowHardBanDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Toggle user selection
  const handleToggleSelect = (userId: number) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // Handle user card click
  const handleUserClick = (user: User, event: React.MouseEvent) => {
    if (!isAdmin) return;
    if (processing) return;

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      handleToggleSelect(user.id);
      return;
    }
  };

  // Handle soft ban (Tab key)
  const handleBatchBan = () => {
    if (selectedUsers.size === 0) return;
    setShowBanDialog(true);
  };

  // Handle hard ban (Delete key)
  const handleBatchHardBan = () => {
    if (selectedUsers.size === 0) return;
    setShowHardBanDialog(true);
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === 'Escape' && selectedUsers.size > 0) {
        setSelectedUsers(new Set());
        return;
      }

      if (e.key === 'Tab' && selectedUsers.size > 0) {
        e.preventDefault();
        handleBatchBan();
        return;
      }

      if (e.key === 'Delete' && selectedUsers.size > 0) {
        e.preventDefault();
        handleBatchHardBan();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin, selectedUsers]);

  // Get selected user objects
  const selectedUserObjects = Array.from(selectedUsers)
    .map(id => users.find(u => u.id === id))
    .filter((u): u is User => u !== undefined);

  return (
    <>
      {/* User Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {users.map(user => (
          <UserCard
            key={user.id}
            user={user}
            isSelected={selectedUsers.has(user.id)}
            isAdmin={isAdmin}
            onClick={handleUserClick}
          />
        ))}
      </div>

      {/* Dialogs */}
      {showBanDialog && (
        <BanUserDialog
          users={selectedUserObjects}
          isSoftBan={true}
          onClose={() => {
            setShowBanDialog(false);
            setSelectedUsers(new Set());
          }}
          onSuccess={(newIsActive: boolean) => {
            const userIds = Array.from(selectedUsers);
            onUserStatusChange?.(userIds, newIsActive);
            setShowBanDialog(false);
            setSelectedUsers(new Set());
          }}
        />
      )}

      {showHardBanDialog && (
        <BanUserDialog
          users={selectedUserObjects}
          isSoftBan={false}
          onClose={() => {
            setShowHardBanDialog(false);
            setSelectedUsers(new Set());
          }}
          onSuccess={() => {
            // Users were deleted - reload the page to refresh the list
            window.location.reload();
          }}
        />
      )}
    </>
  );
}
