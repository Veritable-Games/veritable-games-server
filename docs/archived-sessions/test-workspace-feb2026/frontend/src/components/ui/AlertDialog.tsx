/**
 * AlertDialog Component
 *
 * Internal modal for displaying alerts and messages.
 * Replaces system alert() calls for better UX and control.
 *
 * Usage:
 * ```tsx
 * const { showAlert, AlertDialog } = useAlertDialog();
 *
 * // Error alert
 * showAlert('Failed to save changes', 'error');
 *
 * // Success alert
 * showAlert('Changes saved successfully', 'success');
 *
 * // Info alert
 * showAlert('Please review your settings', 'info');
 *
 * return <>{AlertDialog}</>;
 * ```
 *
 * @module components/ui/AlertDialog
 */

'use client';

import { useEffect } from 'react';

export type AlertType = 'error' | 'success' | 'info' | 'warning';

interface AlertDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  type?: AlertType;
  onClose: () => void;
}

/**
 * Get icon and colors based on alert type
 */
function getAlertStyles(type: AlertType) {
  switch (type) {
    case 'error':
      return {
        iconBg: 'bg-red-500/10',
        iconColor: 'text-red-500',
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        ),
        buttonColor: 'bg-red-600 hover:bg-red-700',
      };
    case 'success':
      return {
        iconBg: 'bg-emerald-500/10',
        iconColor: 'text-emerald-500',
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        ),
        buttonColor: 'bg-emerald-600 hover:bg-emerald-700',
      };
    case 'warning':
      return {
        iconBg: 'bg-amber-500/10',
        iconColor: 'text-amber-500',
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        ),
        buttonColor: 'bg-amber-600 hover:bg-amber-700',
      };
    case 'info':
    default:
      return {
        iconBg: 'bg-blue-500/10',
        iconColor: 'text-blue-500',
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        ),
        buttonColor: 'bg-blue-600 hover:bg-blue-700',
      };
  }
}

/**
 * Alert Dialog Component
 *
 * Internal modal for displaying alerts (replaces system alert())
 */
export function AlertDialog({ isOpen, title, message, type = 'info', onClose }: AlertDialogProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const styles = getAlertStyles(type);
  const defaultTitle =
    type === 'error'
      ? 'Error'
      : type === 'success'
        ? 'Success'
        : type === 'warning'
          ? 'Warning'
          : 'Information';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-md rounded-lg bg-gray-900 p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${styles.iconBg}`}
        >
          <svg
            className={`h-6 w-6 ${styles.iconColor}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {styles.icon}
          </svg>
        </div>

        {/* Title */}
        <h3 className="mb-2 text-center text-lg font-semibold text-white">
          {title || defaultTitle}
        </h3>

        {/* Message */}
        <p className="mb-6 text-center text-gray-400">{message}</p>

        {/* Action */}
        <button
          type="button"
          onClick={onClose}
          className={`w-full rounded px-4 py-2 font-medium text-white transition-colors ${styles.buttonColor}`}
        >
          OK
        </button>
      </div>
    </div>
  );
}
