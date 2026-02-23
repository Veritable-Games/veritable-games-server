'use client';
// Force Turbopack recompile: 2026-02-11T09:16

import { useEffect, useState } from 'react';
import { User } from '@/lib/auth/utils';
import { useRegisterForm } from '@/lib/forms/hooks';
import { TypedInput, TypedPasswordInput, FormSubmit } from '@/lib/forms/components';
import { registerSchema, emailSchema, passwordSchema } from '@/lib/forms/schemas';
import { z } from 'zod';

// Step 1 schema for partial validation (avoids full schema .refine() issue)
const step1Schema = z.object({
  email: emailSchema,
  password: passwordSchema,
  invitation_token: z
    .string()
    .min(1, 'Invitation token is required')
    .max(100, 'Invalid invitation token'),
});
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';
import {
  authCardClass,
  authTitleClass,
  authSubtitleClass,
  authErrorClass,
  authButtonClass,
  authSecondaryButtonClass,
  authLinkClass,
  authFooterClass,
  authFormSpacingClass,
  authBackButtonClass,
} from './auth-styles';

interface RegisterFormProps {
  onRegister: (user: User) => void;
  onSwitchToLogin: () => void;
  initialToken?: string;
}

// Step indicator component
function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="mb-4 flex items-center justify-center gap-3">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <div key={stepNum} className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : isCompleted
                    ? 'bg-blue-600/30 text-blue-300'
                    : 'bg-gray-700 text-gray-400'
              }`}
            >
              {isCompleted ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                stepNum
              )}
            </div>
            {stepNum < totalSteps && (
              <div
                className={`h-0.5 w-8 transition-colors ${
                  isCompleted ? 'bg-blue-600/50' : 'bg-gray-700'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function RegisterForm({
  onRegister,
  onSwitchToLogin,
  initialToken,
}: RegisterFormProps) {
  logger.info('Multi-step register form loaded - Step 1 of 2');
  const [step, setStep] = useState(1);
  const form = useRegisterForm();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError: setFormError,
    setValue,
    clearErrors,
  } = form;

  // Pre-fill token from URL if provided
  useEffect(() => {
    if (initialToken) {
      setValue('invitation_token', initialToken);
    }
  }, [initialToken, setValue]);

  // Handle Step 1 validation and continue
  const handleContinue = async () => {
    clearErrors('root');
    clearErrors('email');
    clearErrors('password');
    clearErrors('invitation_token');

    // Use step1Schema for partial validation (avoids full schema .refine() issue with trigger())
    const data = form.getValues();
    const result = step1Schema.safeParse({
      email: data.email,
      password: data.password,
      invitation_token: data.invitation_token,
    });

    if (result.success) {
      setStep(2);
    } else {
      // Set field-specific errors
      result.error.issues.forEach(err => {
        const field = err.path[0];
        if (field === 'email' || field === 'password' || field === 'invitation_token') {
          setFormError(field, { type: 'validation', message: err.message });
        }
      });
    }
  };

  // Handle back navigation
  const handleBack = () => {
    clearErrors('root');
    setStep(1);
  };

  const onSubmit = async (data: any) => {
    try {
      // Validate against strict schema before submitting
      const validationResult = registerSchema.safeParse(data);
      if (!validationResult.success) {
        // Set field errors from validation
        validationResult.error.issues.forEach(err => {
          const path = err.path[0];
          if (typeof path === 'string') {
            setFormError(
              path as 'username' | 'email' | 'password' | 'display_name' | 'invitation_token',
              { type: 'validation', message: err.message }
            );
          }
        });
        return;
      }

      const result = await fetchJSON('/api/auth/register', {
        method: 'POST',
        body: {
          ...data,
          username: data.username.trim(),
          email: data.email.trim(),
          display_name: data.display_name.trim(),
          invitation_token: data.invitation_token.trim(),
        },
      });

      if (result.success) {
        onRegister(result.data.user);
      } else {
        if (result.details && Array.isArray(result.details)) {
          // Set individual field errors from server validation
          result.details.forEach((error: string) => {
            if (error.includes('username')) {
              setFormError('username', { type: 'api', message: error });
            } else if (error.includes('email')) {
              setFormError('email', { type: 'api', message: error });
              // Go back to step 1 if email error
              setStep(1);
            } else if (error.includes('password')) {
              setFormError('password', { type: 'api', message: error });
              setStep(1);
            } else if (error.includes('token') || error.includes('invitation')) {
              setFormError('invitation_token', { type: 'api', message: error });
              setStep(1);
            } else {
              setFormError('root', { type: 'api', message: error });
            }
          });
        } else {
          setFormError('root', {
            type: 'api',
            message: result.error || 'Registration failed',
          });
        }
      }
    } catch (error: any) {
      logger.error('Registration error:', error);
      setFormError('root', {
        type: 'network',
        message: error.message || 'Registration failed. Please try again.',
      });
    }
  };

  return (
    <div className={authCardClass}>
      <StepIndicator currentStep={step} totalSteps={2} />

      <h2 className={authTitleClass}>
        {step === 1 ? 'Create Your Account' : 'Set Up Your Profile'}
      </h2>

      <p className={authSubtitleClass}>
        {step === 1 ? 'Enter your credentials to get started' : 'Choose how you want to be known'}
      </p>

      {errors.root && (
        <div className={authErrorClass}>
          <p className="text-sm">{errors.root.message}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className={authFormSpacingClass}>
        {step === 1 ? (
          <>
            {/* Step 1: Credentials */}
            <TypedInput
              form={form}
              name="email"
              label="Email Address"
              type="email"
              placeholder="Enter your email"
              disabled={isSubmitting}
              validateOnChange={false}
              showValidationIcon={false}
              autoFocus
              required
            />

            <TypedPasswordInput
              form={form}
              name="password"
              label="Password"
              placeholder="Create a password"
              disabled={isSubmitting}
              validateOnChange={false}
              helperText="Must be 12+ characters with uppercase, lowercase, number, and special character"
              autoComplete="new-password"
              required
            />

            <TypedInput
              form={form}
              name="invitation_token"
              label="Invitation Token"
              placeholder="Enter your invitation token"
              disabled={isSubmitting}
              validateOnChange={false}
              showValidationIcon={false}
              helperText="Required for registration during closed testing"
              required
            />

            <button
              type="button"
              onClick={handleContinue}
              disabled={isSubmitting}
              className={`mt-3 ${authButtonClass}`}
            >
              Continue
            </button>
          </>
        ) : (
          <>
            {/* Step 2: Profile */}
            <TypedInput
              form={form}
              name="username"
              label="Username"
              placeholder="Choose a username"
              disabled={isSubmitting}
              validateOnChange={false}
              showValidationIcon={false}
              helperText="3-20 characters, letters, numbers, underscores, and hyphens only"
              autoFocus
              required
            />

            <TypedInput
              form={form}
              name="display_name"
              label="Display Name"
              placeholder="Your public display name"
              disabled={isSubmitting}
              validateOnChange={false}
              showValidationIcon={false}
              helperText="This is how others will see you"
              required
            />

            <div className="flex items-start space-x-2">
              <input
                type="checkbox"
                id="acceptTerms"
                disabled={isSubmitting}
                {...register('acceptTerms')}
                className="border-input text-primary focus:ring-ring mt-1 h-4 w-4 rounded border focus:ring-2 focus:ring-offset-2"
              />
              <label htmlFor="acceptTerms" className="text-sm text-gray-300">
                I accept the{' '}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`underline ${authLinkClass}`}
                >
                  terms and conditions
                </a>{' '}
                <span className="text-destructive">*</span>
              </label>
            </div>
            {errors.acceptTerms && (
              <p className="text-destructive text-sm">{errors.acceptTerms.message}</p>
            )}

            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className={`flex-1 ${authSecondaryButtonClass}`}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Back
                </span>
              </button>
              <FormSubmit
                isLoading={isSubmitting}
                disabled={isSubmitting}
                loadingText="Creating..."
                className={`flex-1 ${authButtonClass}`}
              >
                Create Account
              </FormSubmit>
            </div>
          </>
        )}
      </form>

      <div className={authFooterClass}>
        <p>
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className={`font-medium ${authLinkClass}`}>
            Login here
          </button>
        </p>
      </div>
    </div>
  );
}
