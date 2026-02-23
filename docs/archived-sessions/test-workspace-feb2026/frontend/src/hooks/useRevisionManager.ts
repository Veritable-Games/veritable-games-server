'use client';

import { useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/utils/logger';

// Enhanced types for better UX
export interface Revision {
  id: number;
  content: string;
  summary: string;
  revision_timestamp: string;
  author_name: string;
  size: number;
}

export interface ComparisonData {
  project_slug: string;
  from: {
    id: number;
    timestamp: string;
    summary: string;
  };
  to: {
    id: number;
    timestamp: string;
    summary: string;
  };
  diff: Array<{
    type: 'added' | 'removed' | 'modified';
    line: number;
    content?: string;
    old?: string;
    new?: string;
  }>;
}

// Enhanced UI states for better UX
export interface RevisionUIState {
  viewMode: 'list' | 'comparison' | 'focused';
  sortBy: 'date' | 'size' | 'author';
  sortOrder: 'asc' | 'desc';
  filterBy: 'all' | 'recent' | 'large-changes' | 'by-author';
  searchQuery: string;
  showMinimap: boolean;
  diffViewMode: 'side-by-side' | 'inline';
  hideUnchanged: boolean;
  focusedRevision: number | null;
}

// User preferences for persistent UX improvements
export interface UserPreferences {
  defaultSortBy: 'date' | 'size' | 'author';
  defaultSortOrder: 'asc' | 'desc';
  defaultDiffViewMode: 'side-by-side' | 'inline';
  autoSelectLatest: boolean;
  keyboardShortcuts: boolean;
}

// Action types for reducer
type RevisionAction =
  | { type: 'SET_REVISIONS'; payload: Revision[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_COMPARING'; payload: boolean }
  | { type: 'SET_COMPARISON'; payload: ComparisonData | null }
  | { type: 'SELECT_REVISION'; payload: number }
  | { type: 'DESELECT_REVISION'; payload: number }
  | { type: 'CLEAR_SELECTIONS' }
  | { type: 'SET_UI_STATE'; payload: Partial<RevisionUIState> }
  | { type: 'FOCUS_REVISION'; payload: number | null }
  | { type: 'SET_SEARCH'; payload: string };

// State structure
interface RevisionState {
  revisions: Revision[];
  selectedRevisions: number[];
  comparison: ComparisonData | null;
  loading: boolean;
  comparing: boolean;
  error: string | null;
  ui: RevisionUIState;
}

// Reducer for complex state management
function revisionReducer(state: RevisionState, action: RevisionAction): RevisionState {
  switch (action.type) {
    case 'SET_REVISIONS':
      return {
        ...state,
        revisions: action.payload,
        error: null,
      };

    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };

    case 'SET_COMPARING':
      return { ...state, comparing: action.payload };

    case 'SET_COMPARISON':
      return { ...state, comparison: action.payload };

    case 'SELECT_REVISION':
      return {
        ...state,
        selectedRevisions: state.selectedRevisions.includes(action.payload)
          ? state.selectedRevisions
          : state.selectedRevisions.length < 2
            ? [...state.selectedRevisions, action.payload]
            : [state.selectedRevisions[1]!, action.payload], // Replace oldest
        ui: {
          ...state.ui,
          viewMode: state.selectedRevisions.length === 1 ? 'comparison' : state.ui.viewMode,
        },
      };

    case 'DESELECT_REVISION':
      return {
        ...state,
        selectedRevisions: state.selectedRevisions.filter(id => id !== action.payload),
        ui: {
          ...state.ui,
          viewMode:
            state.selectedRevisions.filter(id => id !== action.payload).length === 0
              ? 'list'
              : state.ui.viewMode,
        },
      };

    case 'CLEAR_SELECTIONS':
      return {
        ...state,
        selectedRevisions: [],
        comparison: null,
        ui: { ...state.ui, viewMode: 'list' },
      };

    case 'SET_UI_STATE':
      return {
        ...state,
        ui: { ...state.ui, ...action.payload },
      };

    case 'FOCUS_REVISION':
      return {
        ...state,
        ui: {
          ...state.ui,
          focusedRevision: action.payload,
          viewMode: action.payload ? 'focused' : 'list',
        },
      };

    case 'SET_SEARCH':
      return {
        ...state,
        ui: { ...state.ui, searchQuery: action.payload },
      };

    default:
      return state;
  }
}

// Initial state
const initialUIState: RevisionUIState = {
  viewMode: 'list',
  sortBy: 'date',
  sortOrder: 'desc',
  filterBy: 'all',
  searchQuery: '',
  showMinimap: false,
  diffViewMode: 'side-by-side',
  hideUnchanged: true,
  focusedRevision: null,
};

const initialState: RevisionState = {
  revisions: [],
  selectedRevisions: [],
  comparison: null,
  loading: false,
  comparing: false,
  error: null,
  ui: initialUIState,
};

// Main hook for individual productivity
export function useRevisionManager(projectSlug: string) {
  const [state, dispatch] = useReducer(revisionReducer, initialState);
  const [preferences, setPreferences] = useState<UserPreferences>({
    defaultSortBy: 'date',
    defaultSortOrder: 'desc',
    defaultDiffViewMode: 'side-by-side',
    autoSelectLatest: false,
    keyboardShortcuts: true,
  });

  // Load user preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`revision-preferences-${projectSlug}`);
    if (saved) {
      try {
        const savedPrefs = JSON.parse(saved);
        setPreferences(prev => ({ ...prev, ...savedPrefs }));
        dispatch({
          type: 'SET_UI_STATE',
          payload: {
            sortBy: savedPrefs.defaultSortBy,
            sortOrder: savedPrefs.defaultSortOrder,
            diffViewMode: savedPrefs.defaultDiffViewMode,
          },
        });
      } catch (e) {
        logger.error('Failed to load revision preferences:', e);
      }
    }
  }, [projectSlug]);

  // Save preferences to localStorage
  const updatePreferences = useCallback(
    (newPrefs: Partial<UserPreferences>) => {
      const updated = { ...preferences, ...newPrefs };
      setPreferences(updated);
      localStorage.setItem(`revision-preferences-${projectSlug}`, JSON.stringify(updated));
    },
    [preferences, projectSlug]
  );

  // Fetch revisions with enhanced error handling
  const fetchRevisions = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/revisions`);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch revision history: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const revisions = data.revisions || [];

      dispatch({ type: 'SET_REVISIONS', payload: revisions });

      // Auto-select latest if preference is set and we have revisions
      if (
        preferences.autoSelectLatest &&
        revisions.length > 0 &&
        state.selectedRevisions.length === 0
      ) {
        dispatch({ type: 'SELECT_REVISION', payload: revisions[0].id });
      }
    } catch (err) {
      logger.error('Error fetching revisions:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load revision history';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [projectSlug, preferences.autoSelectLatest, state.selectedRevisions.length]);

  // Enhanced comparison with better error handling
  const compareRevisions = useCallback(async () => {
    if (state.selectedRevisions.length !== 2) return;

    dispatch({ type: 'SET_COMPARING', payload: true });
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectSlug)}/revisions/compare`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromRevisionId: state.selectedRevisions[0],
            toRevisionId: state.selectedRevisions[1],
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Comparison failed: ${response.status}`);
      }

      const comparison = await response.json();
      dispatch({ type: 'SET_COMPARISON', payload: comparison });
      dispatch({ type: 'SET_UI_STATE', payload: { viewMode: 'comparison' } });
    } catch (err) {
      logger.error('Error comparing revisions:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown comparison error';
      dispatch({ type: 'SET_ERROR', payload: `Failed to compare revisions: ${errorMessage}` });
    } finally {
      dispatch({ type: 'SET_COMPARING', payload: false });
    }
  }, [state.selectedRevisions, projectSlug]);

  // Smart revision selection with productivity enhancements
  const selectRevision = useCallback(
    (revisionId: number) => {
      if (state.selectedRevisions.includes(revisionId)) {
        dispatch({ type: 'DESELECT_REVISION', payload: revisionId });
      } else {
        dispatch({ type: 'SELECT_REVISION', payload: revisionId });
      }
    },
    [state.selectedRevisions]
  );

  // Quick actions for productivity
  const quickCompareWithLatest = useCallback(
    (revisionId: number) => {
      if (state.revisions.length > 0) {
        const latestId = state.revisions[0]?.id;
        if (latestId !== undefined && latestId !== revisionId) {
          dispatch({ type: 'CLEAR_SELECTIONS' });
          dispatch({ type: 'SELECT_REVISION', payload: latestId });
          dispatch({ type: 'SELECT_REVISION', payload: revisionId });
        }
      }
    },
    [state.revisions]
  );

  const quickCompareWithPrevious = useCallback(
    (revisionId: number) => {
      const currentIndex = state.revisions.findIndex(r => r.id === revisionId);
      if (currentIndex >= 0 && currentIndex < state.revisions.length - 1) {
        const previousId = state.revisions[currentIndex + 1]?.id;
        if (previousId === undefined) return;
        dispatch({ type: 'CLEAR_SELECTIONS' });
        dispatch({ type: 'SELECT_REVISION', payload: previousId });
        dispatch({ type: 'SELECT_REVISION', payload: revisionId });
      }
    },
    [state.revisions]
  );

  // Bulk selection operations
  const selectRevisionRange = useCallback(
    (startId: number, endId: number) => {
      const startIndex = state.revisions.findIndex(r => r.id === startId);
      const endIndex = state.revisions.findIndex(r => r.id === endId);

      if (startIndex !== -1 && endIndex !== -1) {
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);
        const rangeIds = state.revisions.slice(minIndex, maxIndex + 1).map(r => r.id);

        dispatch({ type: 'CLEAR_SELECTIONS' });
        rangeIds.forEach(id => {
          dispatch({ type: 'SELECT_REVISION', payload: id });
        });
      }
    },
    [state.revisions]
  );

  const toggleRevisionSelection = useCallback(
    (revisionId: number, multiSelect: boolean = false) => {
      if (!multiSelect) {
        dispatch({ type: 'CLEAR_SELECTIONS' });
      }

      if (state.selectedRevisions.includes(revisionId)) {
        dispatch({ type: 'DESELECT_REVISION', payload: revisionId });
      } else {
        dispatch({ type: 'SELECT_REVISION', payload: revisionId });
      }
    },
    [state.selectedRevisions]
  );

  // Revision navigation helpers
  const navigateToRevision = useCallback(
    (direction: 'next' | 'previous', fromRevisionId?: number) => {
      const currentIndex = fromRevisionId
        ? state.revisions.findIndex(r => r.id === fromRevisionId)
        : 0;

      if (direction === 'next' && currentIndex < state.revisions.length - 1) {
        const nextRevision = state.revisions[currentIndex + 1];
        if (nextRevision) {
          dispatch({ type: 'FOCUS_REVISION', payload: nextRevision.id });
          return nextRevision.id;
        }
      } else if (direction === 'previous' && currentIndex > 0) {
        const prevRevision = state.revisions[currentIndex - 1];
        if (prevRevision) {
          dispatch({ type: 'FOCUS_REVISION', payload: prevRevision.id });
          return prevRevision.id;
        }
      }
      return null;
    },
    [state.revisions]
  );

  // Enhanced filtering and sorting with memoization
  const processedRevisions = useMemo(() => {
    let filtered = [...state.revisions];

    // Apply search filter
    if (state.ui.searchQuery.trim()) {
      const query = state.ui.searchQuery.toLowerCase();
      filtered = filtered.filter(
        revision =>
          revision.summary.toLowerCase().includes(query) ||
          revision.author_name.toLowerCase().includes(query) ||
          revision.id.toString().includes(query)
      );
    }

    // Apply category filters
    switch (state.ui.filterBy) {
      case 'recent':
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(r => new Date(r.revision_timestamp) > oneWeekAgo);
        break;
      case 'large-changes':
        const averageSize = filtered.reduce((sum, r) => sum + r.size, 0) / filtered.length;
        filtered = filtered.filter(r => r.size > averageSize * 1.5);
        break;
      case 'by-author':
        // Could implement author selection in future
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (state.ui.sortBy) {
        case 'date':
          comparison =
            new Date(a.revision_timestamp).getTime() - new Date(b.revision_timestamp).getTime();
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'author':
          comparison = a.author_name.localeCompare(b.author_name);
          break;
      }
      return state.ui.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [
    state.revisions,
    state.ui.searchQuery,
    state.ui.filterBy,
    state.ui.sortBy,
    state.ui.sortOrder,
  ]);

  // Utility functions
  const getRevisionContent = useCallback(
    (revisionId: number): string => {
      const revision = state.revisions.find(r => r.id === revisionId);
      return revision?.content || '';
    },
    [state.revisions]
  );

  const getRevisionStats = useMemo(() => {
    if (state.revisions.length === 0) return null;

    const totalSize = state.revisions.reduce((sum, r) => sum + r.size, 0);
    const averageSize = totalSize / state.revisions.length;
    const authors = [...new Set(state.revisions.map(r => r.author_name))];

    return {
      total: state.revisions.length,
      totalSize,
      averageSize,
      uniqueAuthors: authors.length,
      authors,
    };
  }, [state.revisions]);

  // Keyboard shortcuts for power users
  useEffect(() => {
    if (!preferences.keyboardShortcuts) return;

    const handleKeyboard = (e: KeyboardEvent) => {
      // Only handle when not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'c':
          if (e.ctrlKey || e.metaKey) return; // Don't interfere with copy
          if (state.selectedRevisions.length === 2) {
            e.preventDefault();
            compareRevisions();
          }
          break;
        case 'Escape':
          dispatch({ type: 'CLEAR_SELECTIONS' });
          dispatch({ type: 'SET_UI_STATE', payload: { viewMode: 'list', focusedRevision: null } });
          break;
        case '/':
          e.preventDefault();
          // Focus search box (would need ref to implement)
          break;
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    return () => document.removeEventListener('keydown', handleKeyboard);
  }, [preferences.keyboardShortcuts, state.selectedRevisions.length, compareRevisions]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchRevisions();
  }, [fetchRevisions]);

  // Actions for UI updates
  const actions = {
    setViewMode: (mode: RevisionUIState['viewMode']) =>
      dispatch({ type: 'SET_UI_STATE', payload: { viewMode: mode } }),

    setSorting: (sortBy: RevisionUIState['sortBy'], sortOrder: RevisionUIState['sortOrder']) =>
      dispatch({ type: 'SET_UI_STATE', payload: { sortBy, sortOrder } }),

    setFilter: (filterBy: RevisionUIState['filterBy']) =>
      dispatch({ type: 'SET_UI_STATE', payload: { filterBy } }),

    setSearch: (searchQuery: string) => dispatch({ type: 'SET_SEARCH', payload: searchQuery }),

    setDiffViewMode: (diffViewMode: RevisionUIState['diffViewMode']) =>
      dispatch({ type: 'SET_UI_STATE', payload: { diffViewMode } }),

    toggleMinimap: () =>
      dispatch({ type: 'SET_UI_STATE', payload: { showMinimap: !state.ui.showMinimap } }),

    toggleHideUnchanged: () =>
      dispatch({ type: 'SET_UI_STATE', payload: { hideUnchanged: !state.ui.hideUnchanged } }),

    focusRevision: (revisionId: number | null) =>
      dispatch({ type: 'FOCUS_REVISION', payload: revisionId }),

    clearSelections: () => dispatch({ type: 'CLEAR_SELECTIONS' }),

    retryFetch: fetchRevisions,
  };

  return {
    // State
    ...state,
    processedRevisions,
    preferences,

    // Actions
    selectRevision,
    compareRevisions,
    quickCompareWithLatest,
    quickCompareWithPrevious,
    selectRevisionRange,
    toggleRevisionSelection,
    navigateToRevision,
    updatePreferences,
    getRevisionContent,
    ...actions,

    // Computed values
    canCompare: state.selectedRevisions.length === 2,
    hasSelections: state.selectedRevisions.length > 0,
    isRevisionSelected: (id: number) => state.selectedRevisions.includes(id),
    getRevisionStats,

    // Status helpers
    isEmpty: !state.loading && state.revisions.length === 0,
    hasError: !!state.error,
    isReady: !state.loading && !state.error && state.revisions.length > 0,
  };
}

// Helper hook for formatting utilities
export function useRevisionFormatting() {
  const formatDate = useCallback((dateString: string, relative: boolean = false) => {
    const date = new Date(dateString);

    if (relative) {
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days} days ago`;
      if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
      if (days < 365) return `${Math.floor(days / 30)} months ago`;
      return `${Math.floor(days / 365)} years ago`;
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const formatSize = useCallback((bytes: number, detailed: boolean = false) => {
    if (bytes < 1024) return detailed ? `${bytes} bytes` : `${bytes}B`;
    if (bytes < 1024 * 1024) {
      const kb = Math.round(bytes / 1024);
      return detailed ? `${kb} KB` : `${kb}KB`;
    }
    const mb = Math.round(bytes / (1024 * 1024));
    return detailed ? `${mb} MB` : `${mb}MB`;
  }, []);

  const formatChangesCount = useCallback((diff: ComparisonData['diff']) => {
    const added = diff.filter(d => d.type === 'added').length;
    const removed = diff.filter(d => d.type === 'removed').length;
    const modified = diff.filter(d => d.type === 'modified').length;

    return {
      added,
      removed,
      modified,
      total: added + removed + modified,
      summary: `+${added} -${removed} ~${modified}`,
    };
  }, []);

  return {
    formatDate,
    formatSize,
    formatChangesCount,
  };
}
