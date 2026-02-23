/**
 * useAlertDialog Hook
 *
 * Hook for displaying alert dialogs (replaces system alert())
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { showAlert, AlertDialog } = useAlertDialog();
 *
 *   const handleError = () => {
 *     showAlert('Failed to save changes', 'error');
 *   };
 *
 *   const handleSuccess = () => {
 *     showAlert('Changes saved successfully!', 'success');
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleError}>Show Error</button>
 *       <button onClick={handleSuccess}>Show Success</button>
 *       {AlertDialog}
 *     </div>
 *   );
 * }
 * ```
 *
 * @module hooks/useAlertDialog
 */

'use client';

import React, { useState, useCallback } from 'react';
import { AlertDialog as AlertDialogComponent, AlertType } from '@/components/ui/AlertDialog';

interface AlertState {
  isOpen: boolean;
  title?: string;
  message: string;
  type: AlertType;
}

export interface UseAlertDialogReturn {
  /**
   * Show an alert dialog
   * @param message - Message to display
   * @param type - Alert type (error, success, info, warning)
   * @param title - Optional custom title
   */
  showAlert: (message: string, type?: AlertType, title?: string) => void;

  /**
   * Close the alert dialog
   */
  closeAlert: () => void;

  /**
   * Alert dialog component to render
   */
  AlertDialog: React.ReactElement;
}

/**
 * Hook for managing alert dialogs
 */
export function useAlertDialog(): UseAlertDialogReturn {
  const [alert, setAlert] = useState<AlertState>({
    isOpen: false,
    message: '',
    type: 'info',
  });

  const showAlert = useCallback((message: string, type: AlertType = 'info', title?: string) => {
    setAlert({
      isOpen: true,
      message,
      type,
      title,
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlert(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const AlertDialog = (
    <AlertDialogComponent
      isOpen={alert.isOpen}
      title={alert.title}
      message={alert.message}
      type={alert.type}
      onClose={closeAlert}
    />
  );

  return {
    showAlert,
    closeAlert,
    AlertDialog,
  };
}
