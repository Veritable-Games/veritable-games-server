'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/utils/logger';

interface UndoNotificationProps {
  message: string;
  onUndo: () => Promise<void>;
  onDismiss: () => void;
  duration?: number; // milliseconds, default 60000 (60 seconds)
}

/**
 * Undo Notification Component
 *
 * Shows a toast notification with undo button
 * Auto-dismisses after specified duration
 */
export function UndoNotification({
  message,
  onUndo,
  onDismiss,
  duration = 60000,
}: UndoNotificationProps) {
  const [isUndoing, setIsUndoing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(Math.floor(duration / 1000));

  useEffect(() => {
    // Auto-dismiss after duration
    const dismissTimer = setTimeout(() => {
      onDismiss();
    }, duration);

    // Update countdown every second
    const countdownTimer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearTimeout(dismissTimer);
      clearInterval(countdownTimer);
    };
  }, [duration, onDismiss]);

  const handleUndo = async () => {
    setIsUndoing(true);
    try {
      await onUndo();
      onDismiss();
    } catch (error) {
      logger.error('Failed to undo:', error);
      setIsUndoing(false);
    }
  };

  return (
    <div className="animate-in slide-in-from-bottom-4 fixed bottom-4 right-4 z-40 flex max-w-sm items-center gap-3 rounded-lg border border-gray-700 bg-gray-900 p-4 shadow-2xl duration-200">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-200">{message}</p>
        <p className="mt-1 text-xs text-gray-500">Undo available in {timeLeft}s</p>
      </div>

      <button
        onClick={handleUndo}
        disabled={isUndoing}
        className="flex-shrink-0 whitespace-nowrap rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isUndoing ? '...' : 'Undo'}
      </button>

      <button
        onClick={onDismiss}
        disabled={isUndoing}
        className="text-gray-400 hover:text-gray-300 disabled:opacity-50"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
