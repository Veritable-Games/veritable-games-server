'use client';

import { useState, useEffect } from 'react';
import { User } from '@/lib/users/types';
import { SettingsSection, SettingsButton, SettingsErrorDisplay } from '@/components/settings/ui';
import { LoginHistorySection } from './LoginHistorySection';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

interface TwoFactorStatus {
  enabled: boolean;
  verifiedAt: string | null;
  backupCodesRemaining: number;
}

interface TwoFactorSetup {
  qrCode: string;
  secret: string;
  otpauthUrl: string;
}

interface SecuritySettingsFormProps {
  user: User;
}

export function SecuritySettingsForm({ user }: SecuritySettingsFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 2FA state
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [verificationToken, setVerificationToken] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState<string[] | null>(null);
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'verify' | 'backup'>('idle');

  // Load 2FA status on mount
  useEffect(() => {
    async function load2FAStatus() {
      try {
        const response = await fetch('/api/settings/2fa');
        const data = await response.json();
        if (data.success) {
          setTwoFactorStatus(data.data);
        }
      } catch (err) {
        logger.error('Failed to load 2FA status:', err);
      } finally {
        setIsLoadingStatus(false);
      }
    }
    load2FAStatus();
  }, []);

  // 2FA handler functions
  const handleStartSetup = async () => {
    setTwoFactorLoading(true);
    setError(null);

    try {
      const response = await fetchJSON<{
        success: boolean;
        data?: TwoFactorSetup;
        error?: string;
      }>('/api/settings/2fa', {
        method: 'POST',
        body: { action: 'setup' },
      });

      if (response.success && response.data) {
        setTwoFactorSetup(response.data);
        setSetupStep('qr');
      } else {
        setError(response.error || 'Failed to start 2FA setup');
      }
    } catch (err) {
      setError('Failed to start 2FA setup');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    if (!verificationToken || verificationToken.length !== 6) {
      setError('Please enter a 6-digit verification code');
      return;
    }

    setTwoFactorLoading(true);
    setError(null);

    try {
      const response = await fetchJSON<{
        success: boolean;
        data?: { backupCodes: string[] };
        error?: string;
      }>('/api/settings/2fa', {
        method: 'POST',
        body: { action: 'verify', token: verificationToken },
      });

      if (response.success && response.data) {
        setShowBackupCodes(response.data.backupCodes);
        setSetupStep('backup');
        setTwoFactorStatus({
          enabled: true,
          verifiedAt: new Date().toISOString(),
          backupCodesRemaining: response.data.backupCodes.length,
        });
        setSuccess('Two-factor authentication enabled successfully!');
      } else {
        setError(response.error || 'Invalid verification code');
      }
    } catch (err) {
      setError('Failed to verify code');
    } finally {
      setTwoFactorLoading(false);
      setVerificationToken('');
    }
  };

  const handleDisable2FA = async () => {
    if (
      !confirm(
        'Are you sure you want to disable two-factor authentication? This will make your account less secure.'
      )
    ) {
      return;
    }

    setTwoFactorLoading(true);
    setError(null);

    try {
      const response = await fetchJSON<{
        success: boolean;
        error?: string;
      }>('/api/settings/2fa', {
        method: 'POST',
        body: { action: 'disable' },
      });

      if (response.success) {
        setTwoFactorStatus({
          enabled: false,
          verifiedAt: null,
          backupCodesRemaining: 0,
        });
        setSetupStep('idle');
        setTwoFactorSetup(null);
        setShowBackupCodes(null);
        setSuccess('Two-factor authentication disabled');
      } else {
        setError(response.error || 'Failed to disable 2FA');
      }
    } catch (err) {
      setError('Failed to disable 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleGenerateBackupCodes = async () => {
    setTwoFactorLoading(true);
    setError(null);

    try {
      const response = await fetchJSON<{
        success: boolean;
        data?: { backupCodes: string[] };
        error?: string;
      }>('/api/settings/2fa', {
        method: 'POST',
        body: { action: 'generate-backup-codes' },
      });

      if (response.success && response.data) {
        setShowBackupCodes(response.data.backupCodes);
        setTwoFactorStatus(prev =>
          prev
            ? {
                ...prev,
                backupCodesRemaining: response.data!.backupCodes.length,
              }
            : null
        );
        setSuccess('New backup codes generated');
      } else {
        setError(response.error || 'Failed to generate backup codes');
      }
    } catch (err) {
      setError('Failed to generate backup codes');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleCancelSetup = () => {
    setSetupStep('idle');
    setTwoFactorSetup(null);
    setVerificationToken('');
    setShowBackupCodes(null);
  };

  return (
    <div className="space-y-6">
      {/* Error/Success Display */}
      <SettingsErrorDisplay
        error={error}
        success={success}
        onDismissError={() => setError(null)}
        onDismissSuccess={() => setSuccess(null)}
      />

      {/* Two-Factor Authentication */}
      <SettingsSection
        title="Two-Factor Authentication"
        description="Add an extra layer of security to your account"
      >
        {/* Loading State */}
        {isLoadingStatus && (
          <div className="animate-pulse rounded-lg border border-gray-700/50 bg-gray-800/30 p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-gray-700/50" />
              <div className="flex-1 space-y-3">
                <div className="h-5 w-32 rounded bg-gray-700/50" />
                <div className="h-4 w-64 rounded bg-gray-700/50" />
                <div className="h-8 w-40 rounded bg-gray-700/50" />
              </div>
            </div>
          </div>
        )}

        {/* 2FA Enabled State */}
        {!isLoadingStatus && twoFactorStatus?.enabled && setupStep === 'idle' && (
          <div className="rounded-lg border border-green-700/50 bg-green-900/20 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-green-900/30 p-3">
                <svg
                  className="h-6 w-6 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-base font-medium text-green-200">2FA Enabled</h4>
                <p className="mt-1 text-sm text-green-300/70">
                  Your account is protected with two-factor authentication.
                </p>
                {twoFactorStatus.verifiedAt && (
                  <p className="mt-2 text-xs text-gray-400">
                    Enabled on {new Date(twoFactorStatus.verifiedAt).toLocaleDateString()}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Backup codes remaining: {twoFactorStatus.backupCodesRemaining}
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <SettingsButton
                    variant="secondary"
                    buttonSize="sm"
                    onClick={handleGenerateBackupCodes}
                    isLoading={twoFactorLoading}
                  >
                    Generate New Backup Codes
                  </SettingsButton>
                  <SettingsButton
                    variant="ghost"
                    buttonSize="sm"
                    onClick={handleDisable2FA}
                    isLoading={twoFactorLoading}
                  >
                    Disable 2FA
                  </SettingsButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2FA Not Enabled - Setup Options */}
        {!isLoadingStatus && !twoFactorStatus?.enabled && setupStep === 'idle' && (
          <div className="rounded-lg border border-gray-700/50 bg-gray-800/30 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-yellow-900/30 p-3">
                <svg
                  className="h-6 w-6 text-yellow-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-base font-medium text-gray-200">2FA Not Enabled</h4>
                <p className="mt-1 text-sm text-gray-400">
                  Two-factor authentication adds an extra layer of security by requiring a code from
                  your authenticator app in addition to your password.
                </p>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <svg
                      className="h-4 w-4 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4"
                      />
                    </svg>
                    Works with Google Authenticator, Authy, 1Password, etc.
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <svg
                      className="h-4 w-4 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4"
                      />
                    </svg>
                    Backup recovery codes included
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <svg
                      className="h-4 w-4 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4"
                      />
                    </svg>
                    Protects against password theft
                  </div>
                </div>

                <div className="mt-6">
                  <SettingsButton
                    variant="primary"
                    onClick={handleStartSetup}
                    isLoading={twoFactorLoading}
                  >
                    Enable Two-Factor Authentication
                  </SettingsButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* QR Code Setup Step */}
        {setupStep === 'qr' && twoFactorSetup && (
          <div className="rounded-lg border border-blue-700/50 bg-blue-900/20 p-6">
            <h4 className="text-base font-medium text-gray-200">Step 1: Scan QR Code</h4>
            <p className="mt-1 text-sm text-gray-400">
              Open your authenticator app and scan this QR code:
            </p>

            <div className="mt-4 flex justify-center">
              <div className="rounded-lg bg-white p-4">
                <img src={twoFactorSetup.qrCode} alt="2FA QR Code" className="h-48 w-48" />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs text-gray-400">Can&apos;t scan? Enter this code manually:</p>
              <code className="mt-1 block rounded bg-gray-800 px-3 py-2 font-mono text-sm text-gray-300">
                {twoFactorSetup.secret}
              </code>
            </div>

            <div className="mt-6 flex gap-3">
              <SettingsButton variant="primary" onClick={() => setSetupStep('verify')}>
                Continue to Verification
              </SettingsButton>
              <SettingsButton variant="ghost" onClick={handleCancelSetup}>
                Cancel
              </SettingsButton>
            </div>
          </div>
        )}

        {/* Verification Step */}
        {setupStep === 'verify' && (
          <div className="rounded-lg border border-blue-700/50 bg-blue-900/20 p-6">
            <h4 className="text-base font-medium text-gray-200">Step 2: Verify Setup</h4>
            <p className="mt-1 text-sm text-gray-400">
              Enter the 6-digit code from your authenticator app:
            </p>

            <div className="mt-4">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={verificationToken}
                onChange={e => setVerificationToken(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-center font-mono text-2xl tracking-widest text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>

            <div className="mt-6 flex gap-3">
              <SettingsButton
                variant="primary"
                onClick={handleVerifySetup}
                isLoading={twoFactorLoading}
                disabled={verificationToken.length !== 6}
              >
                Verify and Enable
              </SettingsButton>
              <SettingsButton variant="ghost" onClick={() => setSetupStep('qr')}>
                Back
              </SettingsButton>
            </div>
          </div>
        )}

        {/* Backup Codes Display */}
        {(setupStep === 'backup' || showBackupCodes) && showBackupCodes && (
          <div className="rounded-lg border border-green-700/50 bg-green-900/20 p-6">
            <h4 className="text-base font-medium text-green-200">Save Your Backup Codes</h4>
            <p className="mt-1 text-sm text-green-300/70">
              Store these codes in a safe place. Each code can only be used once.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-gray-800 p-4">
              {showBackupCodes.map((code, index) => (
                <code key={index} className="font-mono text-sm text-gray-300">
                  {code}
                </code>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-yellow-700/50 bg-yellow-900/20 p-3">
              <div className="flex items-start gap-2">
                <svg
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p className="text-xs text-yellow-300/80">
                  These codes will not be shown again. Copy or write them down now.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <SettingsButton
                variant="primary"
                onClick={() => {
                  setShowBackupCodes(null);
                  setSetupStep('idle');
                }}
              >
                I&apos;ve Saved My Backup Codes
              </SettingsButton>
            </div>
          </div>
        )}
      </SettingsSection>

      {/* Account Recovery */}
      <SettingsSection
        title="Account Recovery"
        description="Recovery options to regain access if you forget your password"
      >
        <div className="space-y-4">
          {/* Recovery Email */}
          <div className="flex items-start justify-between rounded-lg border border-gray-700/50 bg-gray-800/30 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-gray-200">Recovery Email</h4>
                <p className="mt-0.5 text-xs text-gray-400">
                  {user.email ? `Current: ${user.email}` : 'No recovery email set'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user.email && (
                <span className="rounded bg-green-900/30 px-2 py-1 text-xs text-green-400">
                  Verified
                </span>
              )}
              <SettingsButton
                variant="ghost"
                buttonSize="sm"
                onClick={() => {
                  setSuccess(
                    'To update your recovery email, go to the Account tab and change your email address there.'
                  );
                }}
              >
                {user.email ? 'Update' : 'Add Email'}
              </SettingsButton>
            </div>
          </div>

          {/* Backup Codes (only show if 2FA enabled) */}
          {twoFactorStatus?.enabled && (
            <div className="flex items-start justify-between rounded-lg border border-gray-700/50 bg-gray-800/30 p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-gray-200">Backup Codes</h4>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {twoFactorStatus.backupCodesRemaining} codes remaining
                  </p>
                </div>
              </div>
              <SettingsButton
                variant="ghost"
                buttonSize="sm"
                onClick={handleGenerateBackupCodes}
                isLoading={twoFactorLoading}
              >
                Regenerate
              </SettingsButton>
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Login History */}
      <LoginHistorySection user={user} />
    </div>
  );
}
