'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { fetchJSON } from '@/lib/utils/csrf';

interface User {
  id: number;
  username: string;
  display_name: string | null;
}

interface AddTeamMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
  existingMemberUserIds: number[];
}

export function AddTeamMemberDialog({
  isOpen,
  onClose,
  onAdded,
  existingMemberUserIds,
}: AddTeamMemberDialogProps) {
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAvailableUsers();
    }
  }, [isOpen]);

  const loadAvailableUsers = async () => {
    try {
      const response = await fetchJSON<{ users: User[] }>('/api/users?roles=admin,developer');
      const users = response.users.filter(u => !existingMemberUserIds.includes(u.id));
      setAvailableUsers(users);
    } catch (err) {
      setError('Failed to load users');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    setIsLoading(true);
    setError(null);

    try {
      await fetchJSON('/api/about/team-members', {
        method: 'POST',
        body: { user_id: selectedUserId, title: title || null },
      });

      onAdded();
      onClose();
      setSelectedUserId(null);
      setTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add team member');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Add Team Member</h2>
          <button
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-white"
            disabled={isLoading}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-700 bg-red-900/20 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Select User</label>
            <select
              value={selectedUserId || ''}
              onChange={e => setSelectedUserId(parseInt(e.target.value))}
              required
              disabled={isLoading}
              className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-600 focus:outline-none disabled:opacity-50"
            >
              <option value="">Choose a user...</option>
              {availableUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.display_name || user.username}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Title (Optional)</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={isLoading}
              placeholder="e.g., Lead Developer"
              className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-600 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={!selectedUserId || isLoading}
              className="flex-1 rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Adding...' : 'Add Member'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded border border-gray-700 bg-gray-800 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
