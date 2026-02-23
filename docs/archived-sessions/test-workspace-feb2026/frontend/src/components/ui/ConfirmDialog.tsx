/**
 * ConfirmDialog Component
 *
 * Internal modal for confirmation dialogs.
 * Replaces system confirm() calls for better UX and control.
 *
 * Usage:
 * ```tsx
 * const { showConfirm, ConfirmDialog } = useConfirmDialog();
 *
 * const handleDelete = async () => {
 *   const confirmed = await showConfirm(
 *     'Delete this item?',
 *     'This action cannot be undone.'
 *   );
 *
 *   if (confirmed) {
 *     // Proceed with deletion
 *   }
 * };
 *
 * return <>{ConfirmDialog}</>;
 * ```
 *
 * @module components/ui/ConfirmDialog
 */

'use client';

import { useEffect } from 'react';

export type ConfirmType = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: ConfirmType;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Get button colors based on confirmation type
 */
function getConfirmStyles(type: ConfirmType) {
  switch (type) {
    case 'danger':
      return {
        iconBg: 'bg-red-500/10',
        iconColor: 'text-red-500',
        confirmButton: 'bg-red-600 hover:bg-red-700',
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        ),
      };
    case 'warning':
      return {
        iconBg: 'bg-amber-500/10',
        iconColor: 'text-amber-500',
        confirmButton: 'bg-amber-600 hover:bg-amber-700',
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        ),
      };
    case 'info':
    default:
      return {
        iconBg: 'bg-blue-500/10',
        iconColor: 'text-blue-500',
        confirmButton: 'bg-blue-600 hover:bg-blue-700',
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        ),
      };
  }
}

/**
 * Confirm Dialog Component
 *
 * Internal modal for confirmations (replaces system confirm())
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  type = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const styles = getConfirmStyles(type);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onCancel}
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
        <h3 className="mb-2 text-center text-lg font-semibold text-white">{title}</h3>

        {/* Message */}
        <p className="mb-6 text-center text-gray-400">{message}</p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded bg-gray-700 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-600"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded px-4 py-2 font-medium text-white transition-colors ${styles.confirmButton}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
