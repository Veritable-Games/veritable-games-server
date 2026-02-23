import { create } from 'zustand';
import { logger } from '@/lib/utils/logger';

export interface JournalCategory {
  id: string;
  user_id: number;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface JournalNode {
  id: number;
  slug: string;
  title: string;
  namespace: string;
  created_at: string;
  updated_at: string;
  journal_category_id?: string;
  children?: JournalNode[];
  // Deletion tracking
  is_deleted?: boolean;
  deleted_by?: number;
  deleted_at?: string;
}

export interface JournalSearchResult {
  pages: JournalNode[];
  total: number;
  has_more: boolean;
}

export interface HistoryAction {
  type: 'delete' | 'restore' | 'move' | 'rename';
  timestamp: number;
  journalIds: number[];
  previousState: Record<
    number,
    {
      categoryId?: string;
      title?: string;
      isDeleted?: boolean;
    }
  >;
  newState: Record<
    number,
    {
      categoryId?: string;
      title?: string;
      isDeleted?: boolean;
    }
  >;
}

interface JournalsState {
  // Tree state
  journals: JournalNode[];
  expandedNodes: Set<number>;
  selectedJournalId: number | null;

  // Category state
  categories: JournalCategory[];
  expandedCategories: Set<string>;

  // Search state
  searchQuery: string;
  searchResults: JournalSearchResult | null;
  isSearching: boolean;

  // Editor state
  currentContent: string;

  // Selection for batch operations
  selectedJournalsForDeletion: Set<number>;
  selectedCategoriesForDeletion: Set<string>;

  // UI state
  isPreviewMode: boolean;
  sidebarWidth: number;

  // Undo/Redo state
  undoRedoHistory: HistoryAction[];
  undoRedoIndex: number;
  maxHistorySize: number;

  // Journal actions
  setJournals: (journals: JournalNode[]) => void;
  addJournal: (journal: JournalNode) => void;
  updateJournal: (journalId: number, updates: Partial<JournalNode>) => void;
  updateJournalTitle: (journalId: number, newTitle: string) => void;
  updateJournalCategory: (journalId: number, categoryId: string) => void;
  removeJournals: (journalIds: number[]) => void;
  toggleNodeExpansion: (nodeId: number) => void;
  setSelectedJournal: (journalId: number | null) => void;

  // Category actions
  setCategories: (categories: JournalCategory[]) => void;
  addCategory: (category: JournalCategory) => void;
  updateCategory: (categoryId: string, updates: Partial<JournalCategory>) => void;
  removeCategory: (categoryId: string) => void;
  toggleCategoryExpansion: (categoryId: string) => void;
  expandAllCategories: () => void;
  collapseAllCategories: () => void;

  // Search actions
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: JournalSearchResult | null) => void;
  setIsSearching: (isSearching: boolean) => void;

  // Content actions
  setCurrentContent: (content: string) => void;

  // Selection actions
  toggleJournalSelection: (journalId: number) => void;
  clearSelections: () => void;
  selectAll: () => void;
  selectOnly: (journalId: number) => void;
  toggleCategorySelection: (categoryId: string) => void;
  clearCategorySelections: () => void;

  // UI actions
  setIsPreviewMode: (isPreview: boolean) => void;
  setSidebarWidth: (width: number) => void;

  // Undo/Redo actions
  pushHistory: (action: HistoryAction) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;

  // Helpers
  getJournalsByCategory: (categoryId: string) => JournalNode[];
  getUncategorizedId: () => string | undefined;

  // Reset state
  reset: () => void;
}

const initialState = {
  journals: [] as JournalNode[],
  expandedNodes: new Set<number>(),
  selectedJournalId: null as number | null,

  categories: [] as JournalCategory[],
  expandedCategories: new Set<string>(),

  searchQuery: '',
  searchResults: null as JournalSearchResult | null,
  isSearching: false,

  currentContent: '',

  selectedJournalsForDeletion: new Set<number>(),
  selectedCategoriesForDeletion: new Set<string>(),

  isPreviewMode: false,
  sidebarWidth: 320,

  undoRedoHistory: [] as HistoryAction[],
  undoRedoIndex: -1,
  maxHistorySize: 50,
};

export const useJournalsStore = create<JournalsState>((set, get) => ({
  ...initialState,

  // Journal actions
  setJournals: journals => set({ journals }),

  addJournal: journal =>
    set(state => ({
      journals: [journal, ...state.journals],
    })),

  updateJournal: (journalId, updates) =>
    set(state => ({
      journals: state.journals.map(j => (j.id === journalId ? { ...j, ...updates } : j)),
    })),

  updateJournalTitle: (journalId, newTitle) =>
    set(state => ({
      journals: state.journals.map(j => (j.id === journalId ? { ...j, title: newTitle } : j)),
    })),

  updateJournalCategory: (journalId, categoryId) =>
    set(state => ({
      journals: state.journals.map(j =>
        j.id === journalId ? { ...j, journal_category_id: categoryId } : j
      ),
    })),

  removeJournals: journalIds =>
    set(state => ({
      journals: state.journals.filter(j => !journalIds.includes(j.id)),
      selectedJournalsForDeletion: new Set<number>(),
      selectedJournalId: journalIds.includes(state.selectedJournalId || -1)
        ? null
        : state.selectedJournalId,
    })),

  toggleNodeExpansion: nodeId =>
    set(state => {
      const newExpanded = new Set(state.expandedNodes);
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId);
      } else {
        newExpanded.add(nodeId);
      }
      return { expandedNodes: newExpanded };
    }),

  setSelectedJournal: journalId => set({ selectedJournalId: journalId }),

  // Category actions
  setCategories: categories =>
    set(state => {
      // When setting categories for the first time, expand all by default
      const expandedCategories =
        state.expandedCategories.size === 0
          ? new Set(categories.map(c => c.id))
          : state.expandedCategories;
      return { categories, expandedCategories };
    }),

  addCategory: category =>
    set(state => ({
      categories: [...state.categories, category],
      expandedCategories: new Set([...state.expandedCategories, category.id]),
    })),

  updateCategory: (categoryId, updates) =>
    set(state => ({
      categories: state.categories.map(c => (c.id === categoryId ? { ...c, ...updates } : c)),
    })),

  removeCategory: categoryId =>
    set(state => ({
      categories: state.categories.filter(c => c.id !== categoryId),
      expandedCategories: (() => {
        const newExpanded = new Set(state.expandedCategories);
        newExpanded.delete(categoryId);
        return newExpanded;
      })(),
    })),

  toggleCategoryExpansion: categoryId =>
    set(state => {
      const newExpanded = new Set(state.expandedCategories);
      if (newExpanded.has(categoryId)) {
        newExpanded.delete(categoryId);
      } else {
        newExpanded.add(categoryId);
      }
      return { expandedCategories: newExpanded };
    }),

  expandAllCategories: () =>
    set(state => ({
      expandedCategories: new Set(state.categories.map(c => c.id)),
    })),

  collapseAllCategories: () =>
    set({
      expandedCategories: new Set<string>(),
    }),

  // Search actions
  setSearchQuery: query => set({ searchQuery: query }),
  setSearchResults: results => set({ searchResults: results }),
  setIsSearching: isSearching => set({ isSearching }),

  // Content actions
  setCurrentContent: content => set({ currentContent: content }),

  // Selection actions
  toggleJournalSelection: journalId =>
    set(state => {
      const newSelections = new Set(state.selectedJournalsForDeletion);
      if (newSelections.has(journalId)) {
        newSelections.delete(journalId);
      } else {
        newSelections.add(journalId);
      }
      return { selectedJournalsForDeletion: newSelections };
    }),

  clearSelections: () => set({ selectedJournalsForDeletion: new Set<number>() }),

  selectAll: () =>
    set(state => ({
      selectedJournalsForDeletion: new Set(state.journals.map(j => j.id)),
    })),

  selectOnly: journalId =>
    set({
      selectedJournalsForDeletion: new Set([journalId]),
    }),

  toggleCategorySelection: (categoryId: string) =>
    set(state => {
      const newSet = new Set(state.selectedCategoriesForDeletion);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return { selectedCategoriesForDeletion: newSet };
    }),

  clearCategorySelections: () => set({ selectedCategoriesForDeletion: new Set<string>() }),

  // UI actions
  setIsPreviewMode: isPreview => set({ isPreviewMode: isPreview }),
  setSidebarWidth: width => set({ sidebarWidth: width }),

  // Undo/Redo actions
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

  undo: () => {
    const state = get();
    if (!state.canUndo()) return;

    const action = state.undoRedoHistory[state.undoRedoIndex];
    if (!action) return;

    const newIndex = state.undoRedoIndex - 1;

    // Revert the action based on type
    set(currentState => {
      let updatedJournals = [...currentState.journals];

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

      return {
        journals: updatedJournals,
        undoRedoIndex: newIndex,
      };
    });
  },

  redo: () => {
    const state = get();
    if (!state.canRedo()) return;

    const newIndex = state.undoRedoIndex + 1;
    const action = state.undoRedoHistory[newIndex];
    if (!action) return;

    // Re-apply the action using newState
    set(currentState => {
      let updatedJournals = [...currentState.journals];

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

      return {
        journals: updatedJournals,
        undoRedoIndex: newIndex,
      };
    });
  },

  canUndo: () => {
    const state = get();
    return state.undoRedoIndex >= 0;
  },

  canRedo: () => {
    const state = get();
    return state.undoRedoIndex < state.undoRedoHistory.length - 1;
  },

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

  // Helpers (use get() for reading state)
  getJournalsByCategory: categoryId => {
    const state = get();
    const uncategorizedId = state.categories.find(c => c.name === 'Uncategorized')?.id;

    const filtered = state.journals.filter(j => {
      const journalCategoryId = j.journal_category_id || uncategorizedId;
      return journalCategoryId === categoryId;
    });

    // Sort: active first, deleted last (each group sorted by updated_at desc)
    return filtered.sort((a, b) => {
      // Determine priority: 0 = active, 1 = deleted
      const getPriority = (j: any) => {
        if (j.is_deleted) return 1;
        return 0;
      };

      const aPriority = getPriority(a);
      const bPriority = getPriority(b);

      // Sort by priority first
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // Within same priority, sort by updated_at (most recent first)
      const aTime = new Date(a.updated_at).getTime();
      const bTime = new Date(b.updated_at).getTime();
      return bTime - aTime;
    });
  },

  getUncategorizedId: () => {
    const state = get();
    return state.categories.find(c => c.name === 'Uncategorized')?.id;
  },

  reset: () =>
    set({
      ...initialState,
      expandedNodes: new Set<number>(),
      expandedCategories: new Set<string>(),
      selectedJournalsForDeletion: new Set<number>(),
      selectedCategoriesForDeletion: new Set<string>(),
      undoRedoHistory: [],
      undoRedoIndex: -1,
    }),
}));
