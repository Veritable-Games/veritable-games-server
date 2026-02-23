/**
 * Accessible Input Component
 * Provides WCAG 2.1 AA compliant input fields with proper labeling and error handling
 */

import React, { forwardRef, useState, useId } from 'react';

interface AccessibleInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  showRequiredIndicator?: boolean;
  hideLabel?: boolean;
}

export const AccessibleInput = forwardRef<HTMLInputElement, AccessibleInputProps>(
  (
    {
      label,
      error,
      helperText,
      required = false,
      showRequiredIndicator = true,
      hideLabel = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const inputId = useId();
    const errorId = useId();
    const helperTextId = useId();
    const [isFocused, setIsFocused] = useState(false);

    const baseInputClasses =
      'w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]';

    const inputStateClasses = error
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
      : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500';

    const inputClasses = `${baseInputClasses} ${inputStateClasses} ${className}`.trim();

    const describedBy = [error && errorId, helperText && helperTextId].filter(Boolean).join(' ');

    return (
      <div className="space-y-1">
        {/* Label */}
        <label
          htmlFor={inputId}
          className={`block text-sm font-medium text-gray-700 dark:text-gray-300 ${
            hideLabel ? 'sr-only' : ''
          }`}
        >
          {label}
          {required && showRequiredIndicator && (
            <span className="ml-1 text-red-500" aria-label="required">
              *
            </span>
          )}
        </label>

        {/* Input */}
        <input
          ref={ref}
          id={inputId}
          required={required}
          className={inputClasses}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy || undefined}
          onFocus={e => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={e => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />

        {/* Helper Text */}
        {helperText && !error && (
          <p id={helperTextId} className="text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}

        {/* Error Message */}
        {error && (
          <div
            id={errorId}
            role="alert"
            aria-live="polite"
            className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400"
          >
            <svg
              className="h-4 w-4 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </div>
        )}

        {/* Focus indicator for screen readers */}
        {isFocused && (
          <div className="sr-only" aria-live="polite">
            {`${label} field is focused`}
          </div>
        )}
      </div>
    );
  }
);

AccessibleInput.displayName = 'AccessibleInput';
