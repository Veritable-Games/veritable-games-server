/**
 * SettingsErrorDisplay Component
 * Consistent error and success message display for settings pages
 */

import React from 'react';

interface SettingsErrorDisplayProps {
  /** General error message */
  error?: string | null;
  /** Field-specific errors */
  fieldErrors?: Record<string, string>;
  /** CSRF or security error */
  securityError?: string | null;
  /** Success message */
  success?: string | null;
  /** Auto-hide success message after milliseconds */
  successTimeout?: number;
  /** Callback when error is dismissed */
  onDismissError?: () => void;
  /** Callback when success is dismissed */
  onDismissSuccess?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export function SettingsErrorDisplay({
  error,
  fieldErrors,
  securityError,
  success,
  successTimeout = 4000,
  onDismissError,
  onDismissSuccess,
  className = '',
}: SettingsErrorDisplayProps) {
  const hasErrors = error || securityError || (fieldErrors && Object.keys(fieldErrors).length > 0);

  // Auto-hide success message
  React.useEffect(() => {
    if (success && successTimeout > 0) {
      const timer = setTimeout(() => {
        onDismissSuccess?.();
      }, successTimeout);
      return () => clearTimeout(timer);
    }
  }, [success, successTimeout, onDismissSuccess]);

  if (!hasErrors && !success) return null;

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      {/* Success Message */}
      {success && (
        <div
          className="rounded-lg border border-green-600 bg-green-900/50 p-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center">
            <svg
              className="mr-3 h-5 w-5 flex-shrink-0 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div className="flex-1">
              <span className="font-medium text-green-200">{success}</span>
            </div>
            {onDismissSuccess && (
              <button
                onClick={onDismissSuccess}
                className="ml-3 rounded text-green-400 hover:text-green-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                aria-label="Dismiss success message"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Messages */}
      {hasErrors && (
        <div
          className="rounded-lg border border-red-600 bg-red-900/50 p-4"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center">
            <svg
              className="mr-3 h-5 w-5 flex-shrink-0 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1 space-y-2">
              {/* Security Error */}
              {securityError && (
                <div>
                  <p className="font-medium text-red-200">Security Error</p>
                  <p className="mt-1 text-sm text-red-300">{securityError}</p>
                </div>
              )}

              {/* General Error */}
              {error && (
                <div>
                  <p className="font-medium text-red-200">Error</p>
                  <p className="mt-1 text-sm text-red-300">{error}</p>
                </div>
              )}

              {/* Field Errors */}
              {fieldErrors && Object.keys(fieldErrors).length > 0 && (
                <div>
                  <p className="font-medium text-red-200">Please correct the following errors:</p>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    {Object.entries(fieldErrors).map(([field, message]) => (
                      <li key={field} className="text-sm text-red-300">
                        <span className="font-medium capitalize">{field.replace(/_/g, ' ')}</span>:{' '}
                        {message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {onDismissError && (
              <button
                onClick={onDismissError}
                className="ml-3 rounded text-red-400 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label="Dismiss error message"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Inline error display for individual fields
interface FieldErrorDisplayProps {
  error?: string;
  className?: string;
}

export function FieldErrorDisplay({ error, className = '' }: FieldErrorDisplayProps) {
  if (!error) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`mt-1 flex items-center gap-1 text-sm text-red-400 ${className}`.trim()}
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
  );
}

// Toast notification for transient messages
interface SettingsToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onDismiss?: () => void;
  autoHide?: boolean;
  autoHideDelay?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export function SettingsToast({
  message,
  type,
  onDismiss,
  autoHide = true,
  autoHideDelay = 3000,
  position = 'top-right',
}: SettingsToastProps) {
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    if (autoHide && autoHideDelay > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onDismiss?.(), 300); // Wait for animation
      }, autoHideDelay);
      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDelay, onDismiss]);

  if (!isVisible) return null;

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  const typeStyles = {
    success: 'bg-green-900/90 border-green-600 text-green-200',
    error: 'bg-red-900/90 border-red-600 text-red-200',
    warning: 'bg-yellow-900/90 border-yellow-600 text-yellow-200',
    info: 'bg-blue-900/90 border-blue-600 text-blue-200',
  };

  const icons = {
    success: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    ),
    warning: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
    info: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  };

  return (
    <div
      className={`fixed ${positionClasses[position]} animate-slide-in pointer-events-none z-50 w-full max-w-sm`}
    >
      <div
        className={` ${typeStyles[type]} pointer-events-auto rounded-lg border p-4 shadow-lg transition-all duration-300 ${isVisible ? 'transform-none opacity-100' : 'translate-x-full opacity-0'} `}
        role={type === 'error' ? 'alert' : 'status'}
        aria-live={type === 'error' ? 'assertive' : 'polite'}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0">{icons[type]}</div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium">{message}</p>
          </div>
          {onDismiss && (
            <button
              onClick={() => {
                setIsVisible(false);
                setTimeout(() => onDismiss(), 300);
              }}
              className="ml-3 flex-shrink-0 rounded hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-900"
              aria-label="Dismiss notification"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
