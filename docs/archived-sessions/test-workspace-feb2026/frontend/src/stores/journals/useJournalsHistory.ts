import { create } from 'zustand';
import { logger } from '@/lib/utils/logger';
import type { HistoryAction } from './types';

/**
 * Journals History Store (Undo/Redo)
 * Handles undo/redo for journal operations
 * ~150 lines (vs 577 in monolithic store)
 *
 * NOTE: This functionality may be removed in future phases.
 * Current plan recommends removing client-side undo/redo
 * in favor of relying on soft-delete system. Kept for now
 * to maintain feature parity during Phase 2 store split.
 */

interface JournalsHistoryState {
  // History state
  undoRedoHistory: HistoryAction[];
  undoRedoIndex: number;
  maxHistorySize: number;

  // History actions
  pushHistory: (action: HistoryAction) => void;
  undo: (currentJournals: any[]) => any[];
  redo: (currentJournals: any[]) => any[];
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;

  // Reset
  reset: () => void;
}

const initialState = {
  undoRedoHistory: [] as HistoryAction[],
  undoRedoIndex: -1,
  maxHistorySize: 50,
};

export const useJournalsHistory = create<JournalsHistoryState>((set, get) => ({
  ...initialState,

  // Push new action to history
  pushHistory: action => {
    set(state => {
      // Truncate history if we're not at the end
      const newHistory =
        state.undoRedoIndex < state.undoRedoHistory.length - 1
          ? state.undoRedoHistory.slice(0, state.undoRedoIndex + 1)
          : [...state.undoRedoHistory];

      // Add new action
      newHistory.push(action);

      // Trim to max size
      if (newHistory.length > state.maxHistorySize) {
        newHistory.shift();
      }

      const newState = {
        undoRedoHistory: newHistory,
        undoRedoIndex: newHistory.length - 1,
      };

      // Persist to localStorage
      try {
        localStorage.setItem('journals-undo-history', JSON.stringify(newHistory));
        localStorage.setItem('journals-undo-index', String(newState.undoRedoIndex));
      } catch (error) {
        logger.error('Failed to persist undo history:', error);
      }

      return newState;
    });
  },

  // Undo last action
  undo: currentJournals => {
    const state = get();
    if (!state.canUndo()) return currentJournals;

    const action = state.undoRedoHistory[state.undoRedoIndex];
    if (!action) return currentJournals;

    const newIndex = state.undoRedoIndex - 1;
    let updatedJournals = [...currentJournals];

    // Revert the action based on type
    switch (action.type) {
      case 'delete':
        // Restore deleted journals
        action.journalIds.forEach(id => {
          const journal = updatedJournals.find(j => j.id === id);
          if (journal && action.previousState[id]) {
            journal.is_deleted = action.previousState[id].isDeleted;
          }
        });
        break;

      case 'restore':
        // Re-delete restored journals
        action.journalIds.forEach(id => {
          const journal = updatedJournals.find(j => j.id === id);
          if (journal && action.previousState[id]) {
            journal.is_deleted = action.previousState[id].isDeleted;
          }
        });
        break;

      case 'move':
        // Restore previous category
        action.journalIds.forEach(id => {
          const journal = updatedJournals.find(j => j.id === id);
          if (journal && action.previousState[id]) {
            journal.journal_category_id = action.previousState[id].categoryId;
          }
        });
        break;

      case 'rename':
        // Restore previous title
        action.journalIds.forEach(id => {
          const journal = updatedJournals.find(j => j.id === id);
          if (journal && action.previousState[id]) {
            journal.title = action.previousState[id].title || journal.title;
          }
        });
        break;
    }

    // Persist to localStorage
    try {
      localStorage.setItem('journals-undo-index', String(newIndex));
    } catch (error) {
      logger.error('Failed to persist undo index:', error);
    }

    set({ undoRedoIndex: newIndex });
    return updatedJournals;
  },

  // Redo last undone action
  redo: currentJournals => {
    const state = get();
    if (!state.canRedo()) return currentJournals;

    const newIndex = state.undoRedoIndex + 1;
    const action = state.undoRedoHistory[newIndex];
    if (!action) return currentJournals;

    let updatedJournals = [...currentJournals];

    // Re-apply the action using newState
    action.journalIds.forEach(id => {
      const journal = updatedJournals.find(j => j.id === id);
      if (journal && action.newState[id]) {
        if (action.newState[id].isDeleted !== undefined) {
          journal.is_deleted = action.newState[id].isDeleted;
        }
        if (action.newState[id].categoryId !== undefined) {
          journal.journal_category_id = action.newState[id].categoryId;
        }
        if (action.newState[id].title !== undefined) {
          journal.title = action.newState[id].title || journal.title;
        }
      }
    });

    // Persist to localStorage
    try {
      localStorage.setItem('journals-undo-index', String(newIndex));
    } catch (error) {
      logger.error('Failed to persist undo index:', error);
    }

    set({ undoRedoIndex: newIndex });
    return updatedJournals;
  },

  // Check if can undo
  canUndo: () => {
    const state = get();
    return state.undoRedoIndex >= 0;
  },

  // Check if can redo
  canRedo: () => {
    const state = get();
    return state.undoRedoIndex < state.undoRedoHistory.length - 1;
  },

  // Clear history
  clearHistory: () => {
    set({
      undoRedoHistory: [],
      undoRedoIndex: -1,
    });
    try {
      localStorage.removeItem('journals-undo-history');
      localStorage.removeItem('journals-undo-index');
    } catch (error) {
      logger.error('Failed to clear undo history:', error);
    }
  },

  // Reset
  reset: () => {
    set({
      ...initialState,
      undoRedoHistory: [],
      undoRedoIndex: -1,
    });
  },
}));
