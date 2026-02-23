/**
 * SettingsInput Component
 * Extends AccessibleInput with settings-specific dark theme styling
 */

import React, { forwardRef } from 'react';
import { AccessibleInput } from '@/components/ui/forms/AccessibleInput';

interface SettingsInputProps extends Omit<React.ComponentProps<typeof AccessibleInput>, 'size'> {
  /** Size variant for the input */
  variant?: 'sm' | 'md' | 'lg';
  /** Whether to show a subtle background on focus */
  highlightOnFocus?: boolean;
}

export const SettingsInput = forwardRef<HTMLInputElement, SettingsInputProps>(
  ({ className = '', variant = 'md', highlightOnFocus = true, ...props }, ref) => {
    // Size-specific padding classes
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-3 py-2',
      lg: 'px-4 py-3 text-lg',
    };

    // Dark theme optimized styles
    const settingsInputClasses = `
      bg-gray-800
      border-gray-600
      text-white
      placeholder:text-gray-400
      focus:bg-gray-800/80
      focus:border-blue-500
      focus:ring-2
      focus:ring-blue-500
      focus:ring-offset-0
      hover:border-gray-500
      transition-all
      duration-200
      ${highlightOnFocus ? 'focus:bg-gray-750' : ''}
      ${sizeClasses[variant]}
      ${className}
    `.trim();

    return <AccessibleInput ref={ref} className={settingsInputClasses} {...props} />;
  }
);

SettingsInput.displayName = 'SettingsInput';

// Password input variant with show/hide toggle
interface SettingsPasswordInputProps extends Omit<SettingsInputProps, 'type'> {
  showPasswordToggle?: boolean;
}

export const SettingsPasswordInput = forwardRef<HTMLInputElement, SettingsPasswordInputProps>(
  ({ showPasswordToggle = true, label, helperText, error, required, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const inputId = React.useId();

    const inputType = showPassword ? 'text' : 'password';

    // Render label separately so button can be positioned relative to just the input
    return (
      <div className="space-y-1">
        {/* Label */}
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-300">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>

        {/* Input with toggle button */}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            required={required}
            className={`min-h-[44px] w-full rounded-md border-gray-600 bg-gray-800 px-3 py-2 pr-10 text-white transition-all duration-200 placeholder:text-gray-400 hover:border-gray-500 focus:border-blue-500 focus:bg-gray-800/80 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border'} `.trim()}
            aria-invalid={error ? 'true' : 'false'}
            {...props}
          />
          {showPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Helper Text */}
        {helperText && !error && <p className="text-sm text-gray-400">{helperText}</p>}

        {/* Error Message */}
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

SettingsPasswordInput.displayName = 'SettingsPasswordInput';

// Textarea variant for longer text inputs
interface SettingsTextareaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id'
> {
  label: string;
  error?: string;
  helperText?: string;
  rows?: number;
  maxLength?: number;
  showCharCount?: boolean;
}

export const SettingsTextarea = forwardRef<HTMLTextAreaElement, SettingsTextareaProps>(
  (
    {
      label,
      error,
      helperText,
      rows = 4,
      maxLength,
      showCharCount = false,
      className = '',
      value = '',
      onChange,
      ...props
    },
    ref
  ) => {
    const [charCount, setCharCount] = React.useState(typeof value === 'string' ? value.length : 0);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      onChange?.(e);
    };

    const textareaClasses = `
      w-full
      bg-gray-800
      border-gray-600
      text-white
      placeholder:text-gray-400
      focus:bg-gray-800/80
      focus:border-blue-500
      focus:ring-2
      focus:ring-blue-500
      focus:ring-offset-0
      hover:border-gray-500
      transition-all
      duration-200
      px-3 py-2
      rounded-md
      resize-y
      min-h-[100px]
      ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
      ${className}
    `.trim();

    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-300">{label}</label>
        <textarea
          ref={ref}
          rows={rows}
          maxLength={maxLength}
          className={textareaClasses}
          value={value}
          onChange={handleChange}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? 'error-message' : helperText ? 'helper-text' : undefined}
          {...props}
        />
        <div className="flex items-center justify-between">
          <div>
            {helperText && !error && (
              <p id="helper-text" className="mt-1 text-sm text-gray-400">
                {helperText}
              </p>
            )}
            {error && (
              <p id="error-message" className="mt-1 text-sm text-red-400" role="alert">
                {error}
              </p>
            )}
          </div>
          {showCharCount && maxLength && (
            <span className="text-xs text-gray-400">
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
);

SettingsTextarea.displayName = 'SettingsTextarea';
