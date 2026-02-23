'use client';

import { useState } from 'react';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';
import { useForgotPasswordForm } from '@/lib/forms/hooks';
import { TypedInput, FormSubmit } from '@/lib/forms/components';
import {
  authCardClass,
  authSubtitleClass,
  authErrorClass,
  authSuccessClass,
  authButtonClass,
  authSecondaryButtonClass,
  authLinkClass,
  authBackButtonClass,
  auth2FATitleClass,
} from './auth-styles';

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

export default function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const [success, setSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const form = useForgotPasswordForm();
  const {
    handleSubmit,
    formState: { errors, isSubmitting },
    setError: setFormError,
    getValues,
  } = form;

  const onSubmit = async (data: { email: string }) => {
    try {
      const result = await fetchJSON('/api/auth/password-reset', {
        method: 'POST',
        body: { email: data.email.trim().toLowerCase() },
      });

      if (result.success) {
        setSubmittedEmail(data.email);
        setSuccess(true);
      } else {
        setFormError('root', {
          type: 'api',
          message: result.error || 'Failed to send reset email',
        });
      }
    } catch (err: any) {
      logger.error('Password reset request error:', err);
      setFormError('root', {
        type: 'network',
        message: err.message || 'An error occurred. Please try again.',
      });
    }
  };

  if (success) {
    return (
      <div className={authCardClass}>
        <div className="mb-4 flex items-center">
          <button
            onClick={onBackToLogin}
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
          <h2 className={auth2FATitleClass}>Check Your Email</h2>
        </div>

        <div className={authSuccessClass}>
          <div className="flex">
            <svg
              className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm">
                If an account exists with the email <strong>{submittedEmail}</strong>, you will
                receive a password reset link shortly.
              </p>
              <p className="mt-2 text-xs opacity-70">
                The link will expire in 1 hour. Check your spam folder if you don&apos;t see it.
              </p>
            </div>
          </div>
        </div>

        <button onClick={onBackToLogin} className={`mt-4 ${authSecondaryButtonClass}`}>
          Return to Login
        </button>
      </div>
    );
  }

  return (
    <div className={authCardClass}>
      <div className="mb-4 flex items-center">
        <button
          onClick={onBackToLogin}
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
        <h2 className={auth2FATitleClass}>Forgot Password</h2>
      </div>

      <p className={authSubtitleClass}>
        Enter your email address and we&apos;ll send you a link to reset your password.
      </p>

      {errors.root && (
        <div className={authErrorClass}>
          <p className="text-sm">{errors.root.message}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <TypedInput
          form={form}
          name="email"
          label="Email Address"
          type="email"
          placeholder="Enter your email"
          disabled={isSubmitting}
          autoComplete="email"
          autoFocus
          validateOnChange={false}
          showValidationIcon={false}
          required
        />

        <FormSubmit
          isLoading={isSubmitting}
          disabled={isSubmitting}
          loadingText="Sending..."
          className={authButtonClass}
        >
          Send Reset Link
        </FormSubmit>
      </form>

      <div className="mt-4 text-center">
        <button onClick={onBackToLogin} className={authLinkClass}>
          Back to Login
        </button>
      </div>
    </div>
  );
}
