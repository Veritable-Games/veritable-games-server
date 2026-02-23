/**
 * Accessible Textarea Component
 * Provides WCAG 2.1 AA compliant textarea fields with proper labeling and error handling
 */

import React, { forwardRef, useState, useId } from 'react';

interface AccessibleTextareaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id'
> {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  showRequiredIndicator?: boolean;
  hideLabel?: boolean;
  showCharacterCount?: boolean;
  maxLength?: number;
  minRows?: number;
}

export const AccessibleTextarea = forwardRef<HTMLTextAreaElement, AccessibleTextareaProps>(
  (
    {
      label,
      error,
      helperText,
      required = false,
      showRequiredIndicator = true,
      hideLabel = false,
      showCharacterCount = false,
      maxLength,
      minRows = 3,
      className = '',
      value,
      ...props
    },
    ref
  ) => {
    const textareaId = useId();
    const errorId = useId();
    const helperTextId = useId();
    const countId = useId();
    const [isFocused, setIsFocused] = useState(false);

    const currentLength = typeof value === 'string' ? value.length : 0;
    const remainingChars = maxLength ? maxLength - currentLength : null;

    const baseTextareaClasses =
      'w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed resize-vertical';

    const textareaStateClasses = error
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
      : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500';

    const textareaClasses = `${baseTextareaClasses} ${textareaStateClasses} ${className}`.trim();

    const describedBy = [
      error && errorId,
      helperText && helperTextId,
      showCharacterCount && maxLength && countId,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="space-y-1">
        {/* Label */}
        <label
          htmlFor={textareaId}
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

        {/* Textarea */}
        <textarea
          ref={ref}
          id={textareaId}
          required={required}
          maxLength={maxLength}
          rows={minRows}
          className={textareaClasses}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy || undefined}
          value={value}
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

        {/* Helper Text and Character Count Row */}
        {(helperText || (showCharacterCount && maxLength)) && !error && (
          <div className="flex items-center justify-between">
            {helperText && (
              <p id={helperTextId} className="text-sm text-gray-500 dark:text-gray-400">
                {helperText}
              </p>
            )}
            {showCharacterCount && maxLength && (
              <p
                id={countId}
                className={`text-sm ${
                  remainingChars !== null && remainingChars < 20
                    ? 'text-orange-600 dark:text-orange-400'
                    : remainingChars !== null && remainingChars < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-500 dark:text-gray-400'
                }`}
                aria-live="polite"
              >
                {currentLength}/{maxLength}
              </p>
            )}
          </div>
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

        {/* Character count warning for screen readers */}
        {showCharacterCount && maxLength && remainingChars !== null && remainingChars < 20 && (
          <div className="sr-only" aria-live="polite">
            {remainingChars < 0
              ? `Character limit exceeded by ${Math.abs(remainingChars)} characters`
              : `${remainingChars} characters remaining`}
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

AccessibleTextarea.displayName = 'AccessibleTextarea';
