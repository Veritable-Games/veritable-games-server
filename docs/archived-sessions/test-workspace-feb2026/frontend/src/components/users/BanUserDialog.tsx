'use client';

import { useState } from 'react';
import { User } from '@/lib/users/types';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

interface BanUserDialogProps {
  users: User[];
  isSoftBan: boolean;
  onClose: () => void;
  onSuccess: (newIsActive: boolean) => void; // true = unbanned, false = banned
}

export default function BanUserDialog({
  users,
  isSoftBan,
  onClose,
  onSuccess,
}: BanUserDialogProps) {
  const [reason, setReason] = useState('');
  const [confirmPermanent, setConfirmPermanent] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  // Determine if we're banning or unbanning (for soft ban)
  // Users are considered banned if is_active = false
  const allAlreadyBanned = users.every(u => !u.is_active);
  const hasHardBannedUsers = users.some(u => u.ban_type === 'hard');
  // Can only unban if all are soft-banned (not hard-banned)
  const isUnbanOperation = isSoftBan && allAlreadyBanned && !hasHardBannedUsers;

  const handleSubmit = async () => {
    // Hard ban requires confirmation checkbox
    if (!isSoftBan && !confirmPermanent) {
      setError('You must confirm that you understand this action is permanent');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const userIds = users.map(u => u.id);

      // Determine which endpoint to use
      let endpoint = '';
      if (isUnbanOperation) {
        // Batch unban
        endpoint = '/api/users/batch-unban';
      } else if (isSoftBan) {
        // Batch soft ban
        endpoint = '/api/users/batch-ban';
      } else {
        // Batch hard ban
        endpoint = '/api/users/batch-hard-ban';
      }

      const data = await fetchJSON(endpoint, {
        method: 'POST',
        body: {
          userIds,
          reason: reason || undefined,
        },
      });

      if (!data.success) {
        throw new Error(data.error || 'Failed to process ban operation');
      }

      // Pass the new is_active state: true if unbanned, false if banned
      onSuccess(isUnbanOperation);
    } catch (err) {
      logger.error('Ban operation error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setProcessing(false);
    }
  };

  const usernames = users.map(u => u.username).join(', ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="mx-4 w-full max-w-md rounded-lg border border-gray-700 bg-gray-800 p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            {isUnbanOperation
              ? 'Unban Users'
              : isSoftBan
                ? 'Soft Ban Users'
                : 'Delete Users (Permanent)'}
          </h2>
          <button
            onClick={onClose}
            disabled={processing}
            className="text-gray-400 transition-colors hover:text-white"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Description */}
        <div className="mb-4">
          {hasHardBannedUsers && isSoftBan ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-300">
                One or more selected users are <strong className="text-red-400">hard-banned</strong>
                . Hard bans are permanent and cannot be reversed.
              </p>
              <div className="rounded border border-red-700 bg-red-900/20 p-3">
                <p className="text-sm font-semibold text-red-400">
                  To manage these users, you must remove them from selection first.
                </p>
              </div>
            </div>
          ) : isUnbanOperation ? (
            <p className="text-sm text-gray-300">
              Restore access for the following users? They will be able to login and create content
              again.
            </p>
          ) : isSoftBan ? (
            <p className="text-sm text-gray-300">
              Soft ban prevents users from logging in or creating content, but retains full
              messaging access and keeps their data visible. This action is reversible.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-300">
                This will <strong className="text-red-400">permanently delete</strong> the selected
                users and all their associated data from the system.
              </p>
              <div className="rounded border border-red-700 bg-red-900/20 p-3">
                <p className="text-sm font-semibold text-red-400">
                  ⚠️ Warning: This action cannot be undone. All user data will be lost.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* User list */}
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-gray-400">Affected Users ({users.length}):</p>
          <div className="max-h-32 overflow-y-auto rounded border border-gray-700 bg-gray-900/50 p-3">
            <p className="text-sm text-gray-300">{usernames}</p>
          </div>
        </div>

        {/* Reason field (optional) */}
        {!isUnbanOperation && (
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-400">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              disabled={processing}
              placeholder="Enter reason for ban..."
              className="w-full resize-none rounded border border-gray-700 bg-gray-900/50 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              rows={3}
            />
          </div>
        )}

        {/* Permanent ban confirmation */}
        {!isSoftBan && !isUnbanOperation && (
          <div className="mb-4">
            <label className="flex cursor-pointer items-center space-x-2">
              <input
                type="checkbox"
                checked={confirmPermanent}
                onChange={e => setConfirmPermanent(e.target.checked)}
                disabled={processing}
                className="h-4 w-4 rounded border-gray-700 bg-gray-900/50 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-300">
                I understand these users will be permanently deleted
              </span>
            </label>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded border border-red-700 bg-red-900/20 p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            disabled={processing}
            className="flex-1 rounded bg-gray-700 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={processing || (hasHardBannedUsers && isSoftBan)}
            className={`flex-1 rounded px-4 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isUnbanOperation
                ? 'bg-green-600 text-white hover:bg-green-700'
                : isSoftBan
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {processing
              ? 'Processing...'
              : hasHardBannedUsers && isSoftBan
                ? 'Cannot Modify'
                : isUnbanOperation
                  ? 'Unban Users'
                  : isSoftBan
                    ? 'Soft Ban'
                    : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
