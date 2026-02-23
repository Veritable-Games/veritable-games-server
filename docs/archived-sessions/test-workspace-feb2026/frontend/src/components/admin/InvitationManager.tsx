'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

// Invitation type matching service
interface Invitation {
  id: number;
  token: string;
  created_by: number;
  email: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by: number | null;
  is_revoked: number;
  revoked_at: string | null;
  revoked_by: number | null;
  notes: string | null;
  max_uses: number;
  use_count: number;
}

// Form validation schema
const invitationFormSchema = z.object({
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  expires_in_days: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Must be at least 1 day')
    .max(365, 'Cannot exceed 365 days')
    .default(7),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional().or(z.literal('')),
  max_uses: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Must allow at least 1 use')
    .max(100, 'Cannot exceed 100 uses')
    .default(1),
});

type InvitationFormData = z.infer<typeof invitationFormSchema>;

interface InvitationManagerProps {
  className?: string;
}

export default function InvitationManager({ className }: InvitationManagerProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [includeUsed, setIncludeUsed] = useState(true);
  const [includeRevoked, setIncludeRevoked] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InvitationFormData>({
    resolver: zodResolver(invitationFormSchema),
    defaultValues: {
      email: '',
      expires_in_days: 7,
      notes: '',
      max_uses: 1,
    },
  });

  // Load invitations
  const loadInvitations = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchJSON(
        `/api/admin/invitations?include_used=${includeUsed}&include_revoked=${includeRevoked}`,
        { method: 'GET' }
      );

      if (result.success) {
        setInvitations(result.data || []);
      } else {
        setError(result.error || 'Failed to load invitations');
      }
    } catch (err: any) {
      logger.error('Error loading invitations:', err);
      setError(err.message || 'Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  // Load invitations on mount and when filters change
  useEffect(() => {
    loadInvitations();
  }, [includeUsed, includeRevoked]);

  // Create invitation
  const onSubmit = async (data: InvitationFormData) => {
    try {
      const payload = {
        email: data.email || undefined,
        expires_in_days: data.expires_in_days,
        notes: data.notes || undefined,
        max_uses: data.max_uses,
      };

      const result = await fetchJSON('/api/admin/invitations', {
        method: 'POST',
        body: payload,
      });

      if (result.success) {
        reset(); // Reset form
        await loadInvitations(); // Reload list
        // Auto-copy the new token
        copyToClipboard(result.data.token);
      } else {
        setError(result.error || 'Failed to create invitation');
      }
    } catch (err: any) {
      logger.error('Error creating invitation:', err);
      setError(err.message || 'Failed to create invitation');
    }
  };

  // Revoke invitation
  const revokeInvitation = async (id: number) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) {
      return;
    }

    try {
      const result = await fetchJSON(`/api/admin/invitations/${id}`, {
        method: 'DELETE',
      });

      if (result.success) {
        await loadInvitations(); // Reload list
      } else {
        setError(result.error || 'Failed to revoke invitation');
      }
    } catch (err: any) {
      logger.error('Error revoking invitation:', err);
      setError(err.message || 'Failed to revoke invitation');
    }
  };

  // Copy token to clipboard
  const copyToClipboard = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000); // Clear after 2 seconds
    } catch (err) {
      logger.error('Failed to copy token:', err);
    }
  };

  // Get invitation status
  const getStatus = (inv: Invitation): 'active' | 'used' | 'expired' | 'revoked' => {
    if (inv.is_revoked) return 'revoked';
    if (inv.use_count >= inv.max_uses) return 'used';
    if (new Date(inv.expires_at) < new Date()) return 'expired';
    return 'active';
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const colors = {
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      used: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
      expired: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      revoked: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    return (
      <span
        className={`rounded-full border px-2 py-1 text-xs font-medium ${
          colors[status as keyof typeof colors]
        }`}
      >
        {status.toUpperCase()}
      </span>
    );
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div>
        <h2 className="mb-2 text-2xl font-bold text-white">Invitation Manager</h2>
        <p className="text-neutral-400">
          Create and manage invitation tokens for user registration.
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/20 px-4 py-3 text-red-400">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Create Invitation Form */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Create New Invitation</h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Email (optional) */}
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-neutral-300">
                Email (Optional)
              </label>
              <input
                type="email"
                id="email"
                {...register('email')}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-white placeholder-neutral-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-500"
                placeholder="Restrict to specific email (leave blank for any)"
                disabled={isSubmitting}
              />
              {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>}
              <p className="mt-1 text-xs text-neutral-500">
                If specified, only this email can use the invitation
              </p>
            </div>

            {/* Expiration Days */}
            <div>
              <label
                htmlFor="expires_in_days"
                className="mb-2 block text-sm font-medium text-neutral-300"
              >
                Expires In (Days)
              </label>
              <input
                type="number"
                id="expires_in_days"
                {...register('expires_in_days', { valueAsNumber: true })}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-500"
                min="1"
                max="365"
                disabled={isSubmitting}
              />
              {errors.expires_in_days && (
                <p className="mt-1 text-sm text-red-400">{errors.expires_in_days.message}</p>
              )}
            </div>

            {/* Max Uses */}
            <div>
              <label htmlFor="max_uses" className="mb-2 block text-sm font-medium text-neutral-300">
                Maximum Uses
              </label>
              <input
                type="number"
                id="max_uses"
                {...register('max_uses', { valueAsNumber: true })}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-500"
                min="1"
                max="100"
                disabled={isSubmitting}
              />
              {errors.max_uses && (
                <p className="mt-1 text-sm text-red-400">{errors.max_uses.message}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="mb-2 block text-sm font-medium text-neutral-300">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              {...register('notes')}
              rows={2}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-white placeholder-neutral-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-500"
              placeholder="Internal notes about this invitation (not shown to users)"
              disabled={isSubmitting}
            />
            {errors.notes && <p className="mt-1 text-sm text-red-400">{errors.notes.message}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-neutral-700 px-6 py-2 font-medium text-white transition-colors hover:bg-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Invitation'}
          </button>
        </form>
      </div>

      {/* Invitations List */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Invitations</h3>

          {/* Filters */}
          <div className="flex gap-4 text-sm">
            <label className="flex cursor-pointer items-center text-neutral-300">
              <input
                type="checkbox"
                checked={includeUsed}
                onChange={e => setIncludeUsed(e.target.checked)}
                className="mr-2 rounded border-neutral-700 bg-neutral-900 text-neutral-500 focus:ring-2 focus:ring-neutral-500"
              />
              Show Used
            </label>
            <label className="flex cursor-pointer items-center text-neutral-300">
              <input
                type="checkbox"
                checked={includeRevoked}
                onChange={e => setIncludeRevoked(e.target.checked)}
                className="mr-2 rounded border-neutral-700 bg-neutral-900 text-neutral-500 focus:ring-2 focus:ring-neutral-500"
              />
              Show Revoked
            </label>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-neutral-400">Loading invitations...</div>
        ) : invitations.length === 0 ? (
          <div className="py-8 text-center text-neutral-400">
            No invitations found. Create one above.
          </div>
        ) : (
          <div className="space-y-4">
            {invitations.map(inv => {
              const status = getStatus(inv);
              const isActive = status === 'active';

              return (
                <div
                  key={inv.id}
                  className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 transition-colors hover:border-neutral-700"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <StatusBadge status={status} />
                        {inv.email && (
                          <span className="text-sm text-neutral-400">
                            For: <span className="text-neutral-300">{inv.email}</span>
                          </span>
                        )}
                      </div>

                      {/* Token */}
                      <div className="mb-2 flex items-center gap-2">
                        <code className="max-w-md truncate rounded border border-neutral-800 bg-neutral-900 px-3 py-1 font-mono text-xs text-neutral-300">
                          {inv.token}
                        </code>
                        <button
                          onClick={() => copyToClipboard(inv.token)}
                          className="rounded bg-neutral-800 px-3 py-1 text-xs text-neutral-300 transition-colors hover:bg-neutral-700"
                          title="Copy token"
                        >
                          {copiedToken === inv.token ? '✓ Copied!' : 'Copy'}
                        </button>
                      </div>

                      {/* Metadata */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-neutral-400 md:grid-cols-4">
                        <div>
                          <span className="text-neutral-500">Created:</span>{' '}
                          {formatDate(inv.created_at)}
                        </div>
                        <div>
                          <span className="text-neutral-500">Expires:</span>{' '}
                          {formatDate(inv.expires_at)}
                        </div>
                        <div>
                          <span className="text-neutral-500">Uses:</span> {inv.use_count} /{' '}
                          {inv.max_uses}
                        </div>
                        {inv.used_at && (
                          <div>
                            <span className="text-neutral-500">Used:</span>{' '}
                            {formatDate(inv.used_at)}
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      {inv.notes && (
                        <div className="mt-2 text-sm text-neutral-400">
                          <span className="text-neutral-500">Notes:</span> {inv.notes}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="ml-4">
                      {isActive && (
                        <button
                          onClick={() => revokeInvitation(inv.id)}
                          className="rounded border border-red-500/30 bg-red-600/20 px-3 py-1 text-xs text-red-400 transition-colors hover:bg-red-600/30"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
