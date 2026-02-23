'use client';

import { useState } from 'react';
import { User } from '@/lib/auth/utils';
import { useLoginForm } from '@/lib/forms/hooks';
import { TypedInput, TypedPasswordInput, FormSubmit } from '@/lib/forms/components';
import type { LoginFormData } from '@/lib/forms/schemas';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';
import {
  authCardClass,
  authTitleClass,
  authSubtitleClass,
  authErrorClass,
  authButtonClass,
  authLinkClass,
  authBackButtonClass,
  authFooterClass,
  authFormSpacingClass,
  auth2FAInputClass,
  auth2FATitleClass,
} from './auth-styles';

interface LoginFormProps {
  onLogin: (user: User) => void;
  onSwitchToRegister: () => void;
  onForgotPassword?: () => void;
}

export default function LoginForm({
  onLogin,
  onSwitchToRegister,
  onForgotPassword,
}: LoginFormProps) {
  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);
  // Store credentials for 2FA re-submission
  const [pendingCredentials, setPendingCredentials] = useState<LoginFormData | null>(null);

  const form = useLoginForm();
  const {
    handleSubmit,
    formState: { errors, isSubmitting },
    setError: setFormError,
  } = form;

  const onSubmit = async (data: LoginFormData) => {
    try {
      const result = await fetchJSON('/api/auth/login', {
        method: 'POST',
        body: data,
      });

      if (result.success) {
        onLogin(result.data.user);
      } else if (result.requires2FA) {
        // 2FA required - store state and show 2FA input
        setRequires2FA(true);
        setPendingUserId(result.userId);
        setPendingCredentials(data);
        setTwoFactorError(null);
      } else {
        setFormError('root', {
          type: 'api',
          message: result.error || 'Login failed',
        });
      }
    } catch (error: any) {
      logger.error('Login error:', error);
      setFormError('root', {
        type: 'network',
        message: error.message || 'Login failed. Please try again.',
      });
    }
  };

  const handleVerify2FA = async () => {
    if (!pendingCredentials || !pendingUserId) return;

    setIsVerifying2FA(true);
    setTwoFactorError(null);

    try {
      const result = await fetchJSON('/api/auth/login', {
        method: 'POST',
        body: {
          ...pendingCredentials,
          twoFactorToken: twoFactorToken.trim(),
          twoFactorType: useBackupCode ? 'backup' : 'totp',
        },
      });

      if (result.success) {
        // Reset 2FA state and complete login
        setRequires2FA(false);
        setPendingUserId(null);
        setPendingCredentials(null);
        setTwoFactorToken('');
        onLogin(result.data.user);
      } else {
        setTwoFactorError(result.error || 'Invalid verification code');
      }
    } catch (error: any) {
      logger.error('2FA verification error:', error);
      setTwoFactorError(error.message || 'Verification failed. Please try again.');
    } finally {
      setIsVerifying2FA(false);
    }
  };

  const handleCancel2FA = () => {
    setRequires2FA(false);
    setPendingUserId(null);
    setPendingCredentials(null);
    setTwoFactorToken('');
    setTwoFactorError(null);
    setUseBackupCode(false);
  };

  // 2FA Verification Step
  if (requires2FA) {
    return (
      <div className={authCardClass}>
        <div className="mb-4 flex items-center">
          <button
            onClick={handleCancel2FA}
            className={authBackButtonClass}
            title="Back to login"
            aria-label="Back to login"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h2 className={auth2FATitleClass}>Two-Factor Authentication</h2>
        </div>

        <p className={authSubtitleClass}>
          {useBackupCode
            ? 'Enter one of your backup codes to continue.'
            : 'Enter the 6-digit code from your authenticator app.'}
        </p>

        {twoFactorError && (
          <div className={authErrorClass}>
            <p className="text-sm">{twoFactorError}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="twoFactorToken" className="mb-2 block text-sm font-medium leading-none">
              {useBackupCode ? 'Backup Code' : 'Verification Code'}
            </label>
            <input
              id="twoFactorToken"
              type="text"
              value={twoFactorToken}
              onChange={e => setTwoFactorToken(e.target.value)}
              placeholder={useBackupCode ? 'XXXX-XXXX' : '000000'}
              disabled={isVerifying2FA}
              autoComplete="one-time-code"
              autoFocus
              className={auth2FAInputClass}
              onKeyDown={e => {
                if (e.key === 'Enter' && twoFactorToken.trim()) {
                  handleVerify2FA();
                }
              }}
            />
          </div>

          <button
            onClick={handleVerify2FA}
            disabled={isVerifying2FA || !twoFactorToken.trim()}
            className={authButtonClass}
          >
            {isVerifying2FA ? (
              <span className="flex items-center justify-center">
                <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Verifying...
              </span>
            ) : (
              'Verify'
            )}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setUseBackupCode(!useBackupCode);
                setTwoFactorToken('');
                setTwoFactorError(null);
              }}
              className={authLinkClass}
            >
              {useBackupCode ? 'Use authenticator app instead' : 'Use a backup code instead'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal Login Form
  return (
    <div className={authCardClass}>
      <h2 className={authTitleClass}>Sign In</h2>

      {errors.root && (
        <div className={authErrorClass}>
          <p className="text-sm">{errors.root.message}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className={authFormSpacingClass}>
        <TypedInput
          form={form}
          name="username"
          label="Username or Email"
          placeholder="Enter your username or email"
          disabled={isSubmitting}
          validateOnChange={false}
          showValidationIcon={false}
        />

        <div className="pt-2">
          <TypedPasswordInput
            form={form}
            name="password"
            label="Password"
            labelAction={
              onForgotPassword && (
                <button type="button" onClick={onForgotPassword} className={authLinkClass}>
                  Forgot password?
                </button>
              )
            }
            id="password"
            placeholder="Enter your password"
            disabled={isSubmitting}
            validateOnChange={false}
          />
        </div>

        <FormSubmit
          isLoading={isSubmitting}
          disabled={isSubmitting}
          loadingText="Logging in..."
          className={`mt-3 ${authButtonClass}`}
          data-testid="login-submit-button"
        >
          Login
        </FormSubmit>
      </form>

      <div className={authFooterClass}>
        <p>
          Don&apos;t have an account?{' '}
          <button onClick={onSwitchToRegister} className={`font-medium ${authLinkClass}`}>
            Sign up here
          </button>
        </p>
      </div>
    </div>
  );
}
