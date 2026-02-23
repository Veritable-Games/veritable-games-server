'use client';

import { useState, useMemo, useEffect } from 'react';
import { User } from '@/lib/users/types';
import { fetchJSON } from '@/lib/utils/csrf';
import {
  SettingsSection,
  SettingsInput,
  SettingsPasswordInput,
  SettingsSaveButton,
  SettingsErrorDisplay,
  SettingsToggle,
  AutoSaveIndicator,
} from '@/components/settings/ui';
import { useAutoSave } from '@/hooks/useAutoSave';
import { logger } from '@/lib/utils/logger';

interface EmailPreferencesData {
  email_notifications_enabled: boolean;
  email_message_notifications: boolean;
  email_reply_notifications: boolean;
}

interface AccountSettingsFormProps {
  user: User;
}

export function AccountSettingsForm({ user }: AccountSettingsFormProps) {
  // Unified state
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form data
  const [username, setUsername] = useState(user.username || '');
  const [savedUsername, setSavedUsername] = useState(user.username || '');
  const [currentPasswordForUsername, setCurrentPasswordForUsername] = useState('');

  const [displayName, setDisplayName] = useState(user.display_name || '');

  const [email, setEmail] = useState(user.email || '');
  const [savedEmail, setSavedEmail] = useState(user.email || '');
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Email preferences (auto-save)
  const [preferences, setPreferences] = useState<EmailPreferencesData>({
    email_notifications_enabled: user.email_notifications_enabled !== false,
    email_message_notifications: user.email_message_notifications !== false,
    email_reply_notifications: user.email_reply_notifications !== false,
  });

  // Auto-save hook for email preferences
  const autoSave = useAutoSave({
    data: preferences,
    onSave: async (data: EmailPreferencesData) => {
      await fetchJSON('/api/settings/email', {
        method: 'PUT',
        body: data,
      });
    },
    enabled: !isLoadingPreferences, // Only enable after initial load
    debounceMs: 0, // Immediate save for toggles
  });

  // Fetch current email preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await fetch('/api/settings/email', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setPreferences({
            email_notifications_enabled: data.email_notifications_enabled !== false,
            email_message_notifications: data.email_message_notifications !== false,
            email_reply_notifications: data.email_reply_notifications !== false,
          });
        }
      } catch (error) {
        logger.error('Failed to fetch email preferences:', error);
      } finally {
        setIsLoadingPreferences(false);
      }
    };

    fetchPreferences();
  }, []);

  // Track initial values for change detection (email and password only)
  const initialValues = useMemo(
    () => ({
      email: user.email || '',
    }),
    [user]
  );

  // Auto-save display name
  const displayNameAutoSave = useAutoSave({
    data: { display_name: displayName },
    onSave: async (data: { display_name: string }) => {
      await fetchJSON('/api/settings/profile', {
        method: 'PUT',
        body: data,
      });
    },
    enabled: true,
    debounceMs: 500, // Wait 500ms after typing stops
  });

  // Check what has changed (exclude preferences and display_name from manual save)
  const usernameChanged = username !== savedUsername;
  const emailChanged = email !== savedEmail;
  const passwordEntered = currentPassword && newPassword && confirmPassword;

  const hasChanges = usernameChanged || emailChanged || passwordEntered;

  // Manual save handler (email and password only)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const results: string[] = [];
    let hasError = false;

    try {
      // Save username if changed
      if (usernameChanged) {
        if (!currentPasswordForUsername) {
          setError('Current password is required to change username.');
          setIsLoading(false);
          return;
        }

        // Validate username
        if (username.length < 3 || username.length > 30) {
          setError('Username must be between 3 and 30 characters.');
          setIsLoading(false);
          return;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
          setError('Username can only contain letters, numbers, hyphens, and underscores.');
          setIsLoading(false);
          return;
        }

        try {
          await fetchJSON('/api/settings/account', {
            method: 'PUT',
            body: {
              action: 'change-username',
              username: username,
              currentPassword: currentPasswordForUsername,
            },
          });
          results.push('username updated');
          setCurrentPasswordForUsername('');
          setSavedUsername(username); // Update saved username so form resets unsaved state
        } catch (err) {
          hasError = true;
          throw new Error(
            `Username update failed: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }
      }

      // Save email if changed
      if (emailChanged) {
        if (!currentPasswordForEmail) {
          setError('Current password is required to change email address.');
          setIsLoading(false);
          return;
        }

        try {
          await fetchJSON('/api/settings/account/email', {
            method: 'PUT',
            body: {
              email: email,
              current_password: currentPasswordForEmail,
            },
          });
          results.push('email updated');
          setCurrentPasswordForEmail('');
          setSavedEmail(email); // Update saved email so form resets unsaved state
        } catch (err) {
          hasError = true;
          throw new Error(
            `Email update failed: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }
      }

      // Save password if entered
      if (passwordEntered) {
        if (newPassword !== confirmPassword) {
          setError('New password and confirmation do not match.');
          setIsLoading(false);
          return;
        }

        if (newPassword.length < 12) {
          setError('New password must be at least 12 characters long.');
          setIsLoading(false);
          return;
        }

        try {
          await fetchJSON('/api/settings/account/password', {
            method: 'PUT',
            body: {
              current_password: currentPassword,
              new_password: newPassword,
              confirmPassword: confirmPassword,
            },
          });
          results.push('password updated');
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        } catch (err) {
          hasError = true;
          throw new Error(
            `Password update failed: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }
      }

      if (results.length > 0) {
        setSuccess(`Settings saved successfully: ${results.join(', ')}`);
      } else {
        setSuccess('No changes to save');
      }
    } catch (err) {
      logger.error('Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  // Format date (date only, no time)
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format UUID for display (use full UUID for permanent identification)
  const getUserIdentifier = () => {
    return user.uuid || 'No UUID';
  };

  // Email verification state
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);

  // Handle resending verification email
  const handleResendVerification = async () => {
    setIsResendingVerification(true);
    setVerificationMessage(null);
    setError(null);

    try {
      await fetchJSON('/api/email/resend', {
        method: 'POST',
        body: { email: user.email },
      });
      setVerificationMessage('Verification email sent! Please check your inbox.');
    } catch (err) {
      setError('Failed to send verification email. Please try again later.');
    } finally {
      setIsResendingVerification(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Global Error/Success Display */}
      <SettingsErrorDisplay
        error={error}
        success={success}
        onDismissError={() => setError(null)}
        onDismissSuccess={() => setSuccess(null)}
      />

      {/* Account Information */}
      <SettingsSection
        title="Account Information"
        description="Update your username and display name"
      >
        <div className="space-y-4">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-400">Display Name (Auto-saved)</h3>
              <AutoSaveIndicator
                status={displayNameAutoSave.status}
                error={displayNameAutoSave.error}
                lastSaved={displayNameAutoSave.lastSaved}
              />
            </div>
            <SettingsInput
              label="Display Name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your display name"
              helperText="This is how your name will appear to other users (auto-saved)"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <SettingsInput
                label="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="username"
                helperText="3-30 characters, letters, numbers, hyphens, underscores only"
              />
            </div>

            <div>
              <SettingsInput
                label="Role"
                value={user.role}
                disabled
                helperText="Role is assigned by administrators"
                className="cursor-not-allowed capitalize"
              />
            </div>
          </div>

          {usernameChanged && (
            <SettingsPasswordInput
              label="Current Password"
              value={currentPasswordForUsername}
              onChange={e => setCurrentPasswordForUsername(e.target.value)}
              placeholder="Enter your current password to confirm"
              helperText="Required to change username for security"
            />
          )}

          <div>
            <SettingsInput
              label="Account Created"
              value={formatDate(user.created_at)}
              disabled
              className="cursor-not-allowed"
            />
          </div>

          {/* User UUID - subtle and out of the way */}
          <div className="pt-2">
            <p className="text-xs text-gray-600 dark:text-gray-500">
              User ID:{' '}
              <span className="font-mono text-gray-500 dark:text-gray-600">
                {getUserIdentifier()}
              </span>
            </p>
          </div>
        </div>
      </SettingsSection>

      {/* Email Settings */}
      <SettingsSection
        title="Email Address"
        description="Update your email address for account notifications and recovery"
      >
        <div className="space-y-4">
          <div>
            <SettingsInput
              label="Email Address"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your.email@example.com"
            />

            {/* Email Verification Status */}
            <div className="mt-2 flex items-center gap-2">
              {user.email_verified ? (
                <div className="flex items-center gap-1.5 text-sm text-green-400">
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Email verified</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-sm text-yellow-400">
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Email not verified</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={isResendingVerification}
                      className="text-sm text-blue-400 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isResendingVerification ? 'Sending...' : 'Resend verification email'}
                    </button>
                  </div>
                  {verificationMessage && (
                    <div className="text-sm text-green-400">{verificationMessage}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {emailChanged && (
            <SettingsPasswordInput
              label="Current Password"
              value={currentPasswordForEmail}
              onChange={e => setCurrentPasswordForEmail(e.target.value)}
              placeholder="Enter your current password to confirm"
              helperText="Required to change email address for security"
            />
          )}
        </div>
      </SettingsSection>

      {/* Password Settings */}
      <SettingsSection
        title="Change Password"
        description="Update your password to keep your account secure"
      >
        <div className="space-y-4">
          <SettingsPasswordInput
            label="Current Password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            placeholder="Enter your current password"
          />

          <SettingsPasswordInput
            label="New Password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Enter new password (minimum 12 characters)"
            helperText="Must be at least 12 characters long"
          />

          <SettingsPasswordInput
            label="Confirm New Password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirm your new password"
            error={
              confirmPassword && newPassword !== confirmPassword
                ? 'Passwords do not match'
                : undefined
            }
          />
        </div>
      </SettingsSection>

      {/* Email Preferences */}
      <SettingsSection
        title="Email Notifications"
        description="Control how and when you receive email notifications"
      >
        {/* Auto-Save Status Indicator */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-400">Notification Settings</h3>
          <AutoSaveIndicator
            status={autoSave.status}
            error={autoSave.error}
            lastSaved={autoSave.lastSaved}
          />
        </div>

        {isLoadingPreferences ? (
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex-1">
                  <div className="mb-1 h-4 w-48 rounded bg-gray-700"></div>
                  <div className="h-3 w-64 rounded bg-gray-700"></div>
                </div>
                <div className="h-6 w-11 rounded-full bg-gray-700"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <SettingsToggle
              label="Enable Email Notifications"
              description="Receive email notifications for important account activities"
              checked={preferences.email_notifications_enabled}
              onChange={checked =>
                setPreferences({
                  ...preferences,
                  email_notifications_enabled: checked,
                })
              }
            />

            {preferences.email_notifications_enabled && (
              <>
                <SettingsToggle
                  label="Message Notifications"
                  description="Receive email when someone sends you a message"
                  checked={preferences.email_message_notifications}
                  onChange={checked =>
                    setPreferences({
                      ...preferences,
                      email_message_notifications: checked,
                    })
                  }
                  className="ml-4"
                />

                <SettingsToggle
                  label="Reply Notifications"
                  description="Receive email when someone replies to your posts or comments"
                  checked={preferences.email_reply_notifications}
                  onChange={checked =>
                    setPreferences({
                      ...preferences,
                      email_reply_notifications: checked,
                    })
                  }
                  className="ml-4"
                />
              </>
            )}

            <p className="text-sm text-gray-500">Notification changes are saved automatically.</p>
          </div>
        )}
      </SettingsSection>

      {/* Single Master Save Button (Username, Email & Password) */}
      <div className="flex items-center justify-between border-t border-gray-700/50 pt-6">
        <div className="text-sm text-gray-400">
          {hasChanges
            ? 'You have unsaved changes to username, email, or password.'
            : 'No changes to save.'}
        </div>

        <SettingsSaveButton
          type="submit"
          disabled={isLoading || !hasChanges}
          isLoading={isLoading}
          loadingText="Saving..."
          data-testid="save-account-settings"
        >
          {hasChanges ? 'Save Changes' : 'No Changes'}
        </SettingsSaveButton>
      </div>
    </form>
  );
}
