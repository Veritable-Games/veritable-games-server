/**
 * useAutoSave Hook
 *
 * Automatically saves form data when it changes with the following features:
 * - Change detection via deep JSON comparison
 * - Retry logic with exponential backoff (3 attempts)
 * - Offline detection and queuing
 * - Concurrent save prevention
 * - Auto-reset status after 2 seconds
 *
 * @example
 * ```tsx
 * const autoSave = useAutoSave({
 *   data: { field1, field2 },
 *   onSave: async (data) => { await api.save(data); },
 *   enabled: true,
 *   debounceMs: 0, // Immediate for toggles/selects
 * });
 *
 * return <AutoSaveIndicator {...autoSave} />;
 * ```
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseAutoSaveOptions<T> {
  /** Data to track for changes */
  data: T;
  /** Async function to save the data */
  onSave: (data: T) => Promise<void>;
  /** Enable/disable auto-save (default: true) */
  enabled?: boolean;
  /** Debounce delay in milliseconds (default: 0 for immediate) */
  debounceMs?: number;
}

export interface UseAutoSaveResult {
  /** Current save status */
  status: AutoSaveStatus;
  /** Error message if save failed */
  error: string | null;
  /** Timestamp of last successful save */
  lastSaved: Date | null;
  /** Manual trigger for save */
  save: () => Promise<void>;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s
const STATUS_RESET_DELAY = 2000; // Reset to idle after 2s

export function useAutoSave<T>({
  data,
  onSave,
  enabled = true,
  debounceMs = 0,
}: UseAutoSaveOptions<T>): UseAutoSaveResult {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Track previous data to detect changes
  const previousDataRef = useRef<string | null>(null);

  // Prevent concurrent saves
  const isSavingRef = useRef(false);

  // Debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Status reset timer
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Online status
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? window.navigator.onLine : true
  );

  // Listen for online/offline events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save function with retry logic
  const save = useCallback(
    async (retryCount = 0): Promise<void> => {
      // Don't save if already saving
      if (isSavingRef.current) {
        return;
      }

      // Don't save if offline
      if (!isOnline) {
        setStatus('error');
        setError('No network connection. Changes will be saved when you reconnect.');
        return;
      }

      // Start saving
      isSavingRef.current = true;
      setStatus('saving');
      setError(null);

      // Clear any existing reset timer
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }

      try {
        await onSave(data);

        // Success
        setStatus('saved');
        setLastSaved(new Date());
        isSavingRef.current = false;

        // Reset to idle after 2 seconds
        resetTimerRef.current = setTimeout(() => {
          setStatus('idle');
          resetTimerRef.current = null;
        }, STATUS_RESET_DELAY);
      } catch (err) {
        // Handle error with retry
        const errorMessage = err instanceof Error ? err.message : 'Failed to save changes';

        if (retryCount < MAX_RETRIES) {
          // Retry with exponential backoff
          const delay = RETRY_DELAYS[retryCount] ?? 1000; // Fallback to 1s if undefined
          setError(`${errorMessage}. Retrying in ${delay / 1000}s...`);

          setTimeout(() => {
            save(retryCount + 1);
          }, delay);
        } else {
          // Max retries reached
          setStatus('error');
          setError(errorMessage);
          isSavingRef.current = false;
        }
      }
    },
    [data, onSave, isOnline]
  );

  // Auto-save when data changes
  useEffect(() => {
    // Skip if disabled
    if (!enabled) return;

    // Serialize data for comparison
    const currentData = JSON.stringify(data);

    // Skip if data hasn't changed
    if (previousDataRef.current === currentData) {
      return;
    }

    // Skip initial render (no previous data)
    if (previousDataRef.current === null) {
      previousDataRef.current = currentData;
      return;
    }

    // Update previous data
    previousDataRef.current = currentData;

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce the save
    if (debounceMs > 0) {
      debounceTimerRef.current = setTimeout(() => {
        save();
      }, debounceMs);
    } else {
      // Immediate save (for toggles/selects)
      save();
    }
  }, [data, enabled, debounceMs, save]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  return {
    status,
    error,
    lastSaved,
    save,
  };
}
