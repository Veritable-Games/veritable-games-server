/**
 * useConfirmDialog Hook
 *
 * Hook for displaying confirmation dialogs (replaces system confirm())
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { showConfirm, ConfirmDialog } = useConfirmDialog();
 *
 *   const handleDelete = async () => {
 *     const confirmed = await showConfirm(
 *       'Delete this item?',
 *       'This action cannot be undone.'
 *     );
 *
 *     if (confirmed) {
 *       // Proceed with deletion
 *       await deleteItem();
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleDelete}>Delete</button>
 *       {ConfirmDialog}
 *     </div>
 *   );
 * }
 * ```
 *
 * @module hooks/useConfirmDialog
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  ConfirmDialog as ConfirmDialogComponent,
  ConfirmType,
} from '@/components/ui/ConfirmDialog';

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type: ConfirmType;
}

export interface UseConfirmDialogReturn {
  /**
   * Show a confirmation dialog and wait for user response
   * @param title - Dialog title
   * @param message - Dialog message
   * @param options - Optional configuration
   * @returns Promise that resolves to true if confirmed, false if cancelled
   */
  showConfirm: (
    title: string,
    message: string,
    options?: {
      confirmLabel?: string;
      cancelLabel?: string;
      type?: ConfirmType;
    }
  ) => Promise<boolean>;

  /**
   * Confirmation dialog component to render
   */
  ConfirmDialog: React.ReactElement;
}

/**
 * Hook for managing confirmation dialogs
 */
export function useConfirmDialog(): UseConfirmDialogReturn {
  const [confirm, setConfirm] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger',
  });

  // Use ref to store resolve function for Promise
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      options?: {
        confirmLabel?: string;
        cancelLabel?: string;
        type?: ConfirmType;
      }
    ): Promise<boolean> => {
      return new Promise(resolve => {
        resolveRef.current = resolve;
        setConfirm({
          isOpen: true,
          title,
          message,
          confirmLabel: options?.confirmLabel,
          cancelLabel: options?.cancelLabel,
          type: options?.type || 'danger',
        });
      });
    },
    []
  );

  const handleConfirm = useCallback(() => {
    setConfirm(prev => ({ ...prev, isOpen: false }));
    if (resolveRef.current) {
      resolveRef.current(true);
      resolveRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    setConfirm(prev => ({ ...prev, isOpen: false }));
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
  }, []);

  const ConfirmDialog = (
    <ConfirmDialogComponent
      isOpen={confirm.isOpen}
      title={confirm.title}
      message={confirm.message}
      confirmLabel={confirm.confirmLabel}
      cancelLabel={confirm.cancelLabel}
      type={confirm.type}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return {
    showConfirm,
    ConfirmDialog,
  };
}
