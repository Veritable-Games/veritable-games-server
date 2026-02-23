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
  max_uses: number;
  use_count: number;
  email_sent?: boolean; // Added by API when email is sent
}

// Simplified form schema (no notes field)
const invitationFormSchema = z.object({
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  expires_in_days: z
    .union([z.number().int().min(1).max(365), z.literal(0)]) // 0 = Never
    .default(7),
  max_uses: z
    .union([z.number().int().min(1).max(1000), z.literal(0)]) // 0 = Unlimited
    .default(0), // Changed from 1 to 0 (Unlimited)
});

type InvitationFormData = z.infer<typeof invitationFormSchema>;

interface InviteUserDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function InviteUserDialog({ onClose, onSuccess }: InviteUserDialogProps) {
  // State for created invitation (success view)
  const [createdInvitation, setCreatedInvitation] = useState<Invitation | null>(null);

  // State for all invitations list
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);

  // Copy state
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Form state
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InvitationFormData>({
    resolver: zodResolver(invitationFormSchema),
    defaultValues: {
      email: '',
      expires_in_days: 7, // Keep 7 days (matches research)
      max_uses: 0, // Changed to 0 = Unlimited (matches research)
    },
  });

  // Load all invitations on mount
  useEffect(() => {
    loadAllInvitations();
  }, []);

  // Load all invitations (including used and revoked)
  const loadAllInvitations = async () => {
    try {
      setLoadingInvitations(true);
      setInvitationsError(null);
      const result = await fetchJSON(
        '/api/admin/invitations?include_used=true&include_revoked=true',
        { method: 'GET' }
      );

      if (result.success) {
        // Show all invitations (complete history)
        setInvitations(result.data || []);
      } else {
        setInvitationsError(result.error || 'Failed to load invitations');
      }
    } catch (err: any) {
      logger.error('Error loading invitations:', err);
      setInvitationsError(err.message || 'Failed to load invitations');
    } finally {
      setLoadingInvitations(false);
    }
  };

  // Form submission handler
  const onSubmit = async (data: InvitationFormData) => {
    try {
      const result = await fetchJSON('/api/admin/invitations', {
        method: 'POST',
        body: {
          email: data.email || null,
          expires_in_days: data.expires_in_days,
          max_uses: data.max_uses,
        },
      });

      if (result.success && result.data) {
        setCreatedInvitation(result.data);
        // Auto-copy token to clipboard
        await copyToClipboard(result.data.token, 'token');
        // Reload all invitations
        loadAllInvitations();
      } else {
        throw new Error(result.error || 'Failed to create invitation');
      }
    } catch (err: any) {
      logger.error('Create invitation error:', err);
      alert(err.message || 'Failed to create invitation');
    }
  };

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, type: 'token' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'token') {
        setCopiedToken(text);
        setTimeout(() => setCopiedToken(null), 2000);
      } else {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      }
    } catch (err) {
      logger.error('Failed to copy:', err);
    }
  };

  // Get status badge info
  const getStatusBadge = (invitation: Invitation) => {
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);

    if (invitation.is_revoked) {
      return { text: 'Revoked', className: 'bg-red-900/30 text-red-400 border-red-700' };
    } else if (invitation.use_count >= invitation.max_uses) {
      return { text: 'Used', className: 'bg-blue-900/30 text-blue-400 border-blue-700' };
    } else if (now > expiresAt) {
      return { text: 'Expired', className: 'bg-gray-700/50 text-gray-400 border-gray-600' };
    } else {
      return { text: 'Active', className: 'bg-green-900/30 text-green-400 border-green-700' };
    }
  };

  // Reset to form view
  const handleCreateAnother = () => {
    setCreatedInvitation(null);
    reset();
  };

  // Close and trigger success callback
  const handleDone = () => {
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-gray-700 bg-gray-800 p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            {createdInvitation ? 'Invitation Created' : 'Invite User'}
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
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

        {/* Conditional rendering based on state */}
        {!createdInvitation ? (
          <>
            {/* Description */}
            <div className="mb-4">
              <p className="text-sm text-gray-300">
                Create an invitation token to share with a user. They will use this token to
                register and set their own password.
              </p>
            </div>

            {/* Creation Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email field (optional) */}
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-400">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  id="email"
                  {...register('email')}
                  disabled={isSubmitting}
                  placeholder="Leave blank for any email"
                  className={`w-full rounded border bg-gray-900/50 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                    errors.email ? 'border-red-500' : 'border-gray-700'
                  }`}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  If specified, only this email can use the invitation
                </p>
              </div>

              {/* Expires In field */}
              <div>
                <label
                  htmlFor="expires_in_days"
                  className="mb-2 block text-sm font-medium text-gray-400"
                >
                  Expires In
                </label>
                <select
                  id="expires_in_days"
                  {...register('expires_in_days', { valueAsNumber: true })}
                  disabled={isSubmitting}
                  className={`w-full rounded border bg-gray-800 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500 ${
                    errors.expires_in_days ? 'border-red-500' : 'border-gray-600'
                  }`}
                >
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="0">Never</option>
                </select>
                {errors.expires_in_days && (
                  <p className="mt-1 text-xs text-red-400">{errors.expires_in_days.message}</p>
                )}
              </div>

              {/* Max Uses field */}
              <div>
                <label htmlFor="max_uses" className="mb-2 block text-sm font-medium text-gray-400">
                  Maximum Uses
                </label>
                <select
                  id="max_uses"
                  {...register('max_uses', { valueAsNumber: true })}
                  disabled={isSubmitting}
                  className={`w-full rounded border bg-gray-800 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500 ${
                    errors.max_uses ? 'border-red-500' : 'border-gray-600'
                  }`}
                >
                  <option value="0">Unlimited</option>
                  <option value="1">1 use</option>
                  <option value="5">5 uses</option>
                  <option value="10">10 uses</option>
                  <option value="25">25 uses</option>
                  <option value="100">100 uses</option>
                </select>
                {errors.max_uses && (
                  <p className="mt-1 text-xs text-red-400">{errors.max_uses.message}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 rounded bg-gray-700 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Invitation'}
                </button>
              </div>
            </form>

            {/* All Invitations List (Scrollable) */}
            <div className="mt-6 border-t border-gray-700 pt-6">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-white">Invitation History</h3>
                <p className="mt-1 text-xs text-gray-400">
                  All invitations (active, used, expired, and revoked)
                </p>
              </div>

              {loadingInvitations ? (
                <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
              ) : invitationsError ? (
                <div className="rounded border border-red-700 bg-red-900/20 p-3 text-sm text-red-400">
                  {invitationsError}
                </div>
              ) : invitations.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  No invitations yet. Create one above.
                </div>
              ) : (
                <div className="max-h-96 space-y-2 overflow-y-auto pr-2 [scrollbar-color:rgb(75_85_99)_transparent] [scrollbar-width:thin]">
                  {invitations.map(invitation => {
                    const status = getStatusBadge(invitation);
                    return (
                      <div
                        key={invitation.id}
                        className="flex items-center gap-3 rounded border border-gray-700 bg-gray-900/50 p-3 text-sm"
                      >
                        {/* Status Badge */}
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${status.className}`}
                        >
                          {status.text}
                        </span>

                        {/* Token (truncated) */}
                        <code className="flex-1 truncate font-mono text-xs text-gray-300">
                          {invitation.token.substring(0, 16)}...
                        </code>

                        {/* Copy Button */}
                        <button
                          onClick={() => copyToClipboard(invitation.token, 'token')}
                          className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700"
                          title="Copy token"
                        >
                          {copiedToken === invitation.token ? '✓ Copied' : 'Copy'}
                        </button>

                        {/* Uses */}
                        <span className="text-xs text-gray-500">
                          {invitation.use_count}/{invitation.max_uses}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Success View */}
            <div className="space-y-4">
              {/* Success Banner */}
              <div className="rounded border border-green-700 bg-green-900/20 p-4">
                <p className="text-sm text-green-400">
                  ✓ Invitation created successfully! Token has been copied to your clipboard.
                </p>
                {createdInvitation.email && (
                  <p className="mt-2 text-sm">
                    {createdInvitation.email_sent ? (
                      <span className="text-green-400">
                        ✓ Invitation email sent to {createdInvitation.email}
                      </span>
                    ) : (
                      <span className="text-amber-400">
                        ⚠ Email could not be sent - share the link manually
                      </span>
                    )}
                  </p>
                )}
                {!createdInvitation.email && (
                  <p className="mt-2 text-sm text-gray-400">
                    No email address specified - share the link manually
                  </p>
                )}
              </div>

              {/* Token Display */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-400">
                  Invitation Token
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdInvitation.token}
                    className="flex-1 rounded border border-gray-700 bg-gray-900/50 px-3 py-2 font-mono text-sm text-white"
                  />
                  <button
                    onClick={() => copyToClipboard(createdInvitation.token, 'token')}
                    className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-600"
                  >
                    {copiedToken === createdInvitation.token ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Registration URL Display */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-400">
                  Registration Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/login?token=${createdInvitation.token}`}
                    className="flex-1 rounded border border-gray-700 bg-gray-900/50 px-3 py-2 font-mono text-sm text-white"
                  />
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `${window.location.origin}/auth/login?token=${createdInvitation.token}`,
                        'url'
                      )
                    }
                    className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-600"
                  >
                    {copiedUrl ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Metadata */}
              <div className="rounded border border-gray-700 bg-gray-900/50 p-3 text-sm text-gray-400">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium text-gray-300">Expires:</span>{' '}
                    {(() => {
                      const expiryDate = new Date(createdInvitation.expires_at);
                      const farFuture = new Date();
                      farFuture.setFullYear(farFuture.getFullYear() + 50);
                      return expiryDate > farFuture ? 'Never' : expiryDate.toLocaleDateString();
                    })()}
                  </div>
                  <div>
                    <span className="font-medium text-gray-300">Max Uses:</span>{' '}
                    {createdInvitation.max_uses >= 999999
                      ? 'Unlimited'
                      : createdInvitation.max_uses}
                  </div>
                  {createdInvitation.email && (
                    <div className="col-span-2">
                      <span className="font-medium text-gray-300">Email Restriction:</span>{' '}
                      {createdInvitation.email}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3">
                <button
                  onClick={handleCreateAnother}
                  className="flex-1 rounded border border-gray-600 bg-gray-700 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-600"
                >
                  Create Another
                </button>
                <button
                  onClick={handleDone}
                  className="flex-1 rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
