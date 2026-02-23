/**
 * AutoSaveIndicator Component
 *
 * Visual feedback component for auto-save status.
 * Shows loading spinner, success checkmark, or error message.
 *
 * @example
 * ```tsx
 * const autoSave = useAutoSave({ data, onSave });
 * return <AutoSaveIndicator {...autoSave} />;
 * ```
 */

import type { AutoSaveStatus } from '@/hooks/useAutoSave';

export interface AutoSaveIndicatorProps {
  /** Current save status */
  status: AutoSaveStatus;
  /** Error message if save failed */
  error?: string | null;
  /** Timestamp of last successful save */
  lastSaved?: Date | null;
  /** Optional className for custom positioning */
  className?: string;
}

export function AutoSaveIndicator({
  status,
  error,
  lastSaved,
  className = '',
}: AutoSaveIndicatorProps) {
  // Hide when idle
  if (status === 'idle') {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      {status === 'saving' && (
        <>
          {/* Spinner Icon */}
          <svg
            className="h-4 w-4 animate-spin text-blue-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-gray-400">Saving...</span>
        </>
      )}

      {status === 'saved' && (
        <>
          {/* Checkmark Icon */}
          <svg
            className="h-4 w-4 text-green-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-400">Saved</span>
          {lastSaved && <span className="text-xs text-gray-500">{formatTimeAgo(lastSaved)}</span>}
        </>
      )}

      {status === 'error' && (
        <>
          {/* Error X Icon */}
          <svg
            className="h-4 w-4 text-red-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          <span className="text-red-400">{error || 'Failed to save'}</span>
        </>
      )}
    </div>
  );
}

/**
 * Format timestamp as "just now", "1m ago", "2h ago", etc.
 */
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
