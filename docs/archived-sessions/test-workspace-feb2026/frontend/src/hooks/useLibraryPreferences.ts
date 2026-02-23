/**
 * Hook: useLibraryPreferences
 *
 * Manages library preferences in localStorage for persistence across browser sessions
 * Handles scroll position (index-based for virtual scrolling) and sort preferences
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/lib/utils/logger';

const STORAGE_KEY = 'library-preferences';
const DEBOUNCE_DELAY = 500; // ms - debounce scroll position saves

interface ScrollPosition {
  viewMode: 'grid' | 'list';
  index: number;
  offset?: number;
}

interface LibraryPreferences {
  scrollPosition?: ScrollPosition;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  savedAt: string;
}

interface UseLibraryPreferencesReturn {
  // Scroll position
  scrollPosition: ScrollPosition | null;
  saveScrollPosition: (viewMode: 'grid' | 'list', index: number, offset?: number) => void;
  clearScrollPosition: () => void;

  // Sort preferences
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  saveSortPreferences: (sortBy: string, sortOrder: 'asc' | 'desc') => void;

  // Clear all preferences
  clearPreferences: () => void;
}

/**
 * Load preferences from localStorage with error handling
 */
function loadPreferences(): LibraryPreferences | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as LibraryPreferences;

    // Validate structure
    if (typeof parsed !== 'object' || !parsed.sortBy || !parsed.sortOrder) {
      logger.warn('[useLibraryPreferences] Invalid preferences structure, clearing');
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch (error) {
    logger.error('[useLibraryPreferences] Failed to load preferences:', error);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Save preferences to localStorage with error handling
 */
function savePreferences(preferences: LibraryPreferences): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    // Handle quota exceeded or other localStorage errors
    logger.error('[useLibraryPreferences] Failed to save preferences:', error);
  }
}

/**
 * Hook for managing library preferences
 */
export function useLibraryPreferences(): UseLibraryPreferencesReturn {
  // Initialize state from localStorage
  const [preferences, setPreferences] = useState<LibraryPreferences>(() => {
    const loaded = loadPreferences();
    return (
      loaded || {
        sortBy: 'title',
        sortOrder: 'asc',
        savedAt: new Date().toISOString(),
      }
    );
  });

  // Debounce timer for scroll position saves
  const scrollDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Save to localStorage whenever preferences change
  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  // Cleanup debounce timer on unmount to prevent state updates after unmount
  useEffect(() => {
    return () => {
      if (scrollDebounceTimer.current) {
        clearTimeout(scrollDebounceTimer.current);
      }
    };
  }, []);

  /**
   * Save scroll position (debounced to avoid excessive writes)
   *
   * HOW IT WORKS:
   * 1. User scrolls → rangeChanged fires in VirtuosoGridView/VirtuosoListView
   * 2. handleRangeChanged calls saveScrollPosition('grid', rowIndex) or ('list', docIndex)
   * 3. Debounce timer starts (500ms delay)
   * 4. If user keeps scrolling, timer resets
   * 5. When user stops, timer completes → localStorage updated
   * 6. On page reload, scroll position restored via scrollToIndex()
   *
   * SAVED DATA:
   * - viewMode: 'grid' | 'list' (which view was active)
   * - index: row number (grid) or document number (list)
   * - offset: pixel offset within row (optional, rarely used)
   *
   * DEBOUNCE RATIONALE:
   * - Prevents localStorage thrashing during rapid scrolling
   * - Reduces write operations from 100+/sec to 1 per scroll session
   * - Only saves final position when user stops scrolling
   */
  const saveScrollPosition = useCallback(
    (viewMode: 'grid' | 'list', index: number, offset?: number) => {
      // Clear existing timer
      if (scrollDebounceTimer.current) {
        clearTimeout(scrollDebounceTimer.current);
      }

      // Debounce the save operation
      scrollDebounceTimer.current = setTimeout(() => {
        setPreferences(prev => ({
          ...prev,
          scrollPosition: { viewMode, index, offset },
          savedAt: new Date().toISOString(),
        }));
      }, DEBOUNCE_DELAY);
    },
    []
  );

  /**
   * Clear scroll position only (keep sort preferences)
   */
  const clearScrollPosition = useCallback(() => {
    setPreferences(prev => ({
      ...prev,
      scrollPosition: undefined,
      savedAt: new Date().toISOString(),
    }));
  }, []);

  /**
   * Save sort preferences (immediate, not debounced)
   */
  const saveSortPreferences = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
    setPreferences(prev => ({
      ...prev,
      sortBy,
      sortOrder,
      savedAt: new Date().toISOString(),
    }));
  }, []);

  /**
   * Clear all preferences
   */
  const clearPreferences = useCallback(() => {
    const defaultPreferences: LibraryPreferences = {
      sortBy: 'title',
      sortOrder: 'asc',
      savedAt: new Date().toISOString(),
    };
    setPreferences(defaultPreferences);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    scrollPosition: preferences.scrollPosition || null,
    saveScrollPosition,
    clearScrollPosition,
    sortBy: preferences.sortBy,
    sortOrder: preferences.sortOrder,
    saveSortPreferences,
    clearPreferences,
  };
}
