'use client';

import { useEffect, useState } from 'react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastProps {
  message: string;
  action?: ToastAction;
  duration?: number; // milliseconds
  onClose?: () => void;
  type?: 'info' | 'success' | 'error' | 'warning';
}

/**
 * Toast Notification Component
 * Appears at bottom-right of screen with optional action button
 * Auto-dismisses after duration or can be manually closed
 */
export function Toast({ message, action, duration = 5000, onClose, type = 'info' }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 200); // Match animation duration
  };

  const handleAction = () => {
    action?.onClick();
    handleClose();
  };

  if (!isVisible) return null;

  const bgColors = {
    info: 'bg-gray-800 border-gray-700',
    success: 'bg-green-900 border-green-700',
    error: 'bg-red-900 border-red-700',
    warning: 'bg-yellow-900 border-yellow-700',
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-sm transform transition-all duration-200 ${
        isLeaving ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      }`}
      role="alert"
      aria-live="polite"
    >
      <div
        className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${bgColors[type]}`}
      >
        <p className="flex-1 text-sm text-gray-200">{message}</p>

        {action && (
          <button
            onClick={handleAction}
            className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {action.label}
          </button>
        )}

        <button
          onClick={handleClose}
          className="text-gray-400 transition-colors hover:text-gray-200"
          aria-label="Close notification"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Toast Container Hook
 * Manages multiple toast notifications
 */
export function useToast() {
  const [toasts, setToasts] = useState<Array<ToastProps & { id: string }>>([]);

  const showToast = (toast: ToastProps) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { ...toast, id }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const ToastContainer = () => (
    <>
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{ bottom: `${6 + index * 80}px` }}
          className="fixed right-6 z-50"
        >
          <Toast
            {...toast}
            onClose={() => {
              toast.onClose?.();
              removeToast(toast.id);
            }}
          />
        </div>
      ))}
    </>
  );

  return { showToast, ToastContainer };
}
