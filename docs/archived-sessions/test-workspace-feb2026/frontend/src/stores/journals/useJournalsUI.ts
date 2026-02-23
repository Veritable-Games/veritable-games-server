import { create } from 'zustand';

/**
 * Journals UI Store
 * Handles UI state: expansion, selection, sidebar, preview mode
 * ~100 lines (vs 577 in monolithic store)
 */

interface JournalsUIState {
  // Tree expansion state
  expandedNodes: Set<number>;
  selectedJournalId: number | null;

  // Category expansion state
  expandedCategories: Set<string>;

  // UI state
  isPreviewMode: boolean;
  sidebarWidth: number;

  // Node expansion actions
  toggleNodeExpansion: (nodeId: number) => void;
  setSelectedJournal: (journalId: number | null) => void;

  // Category expansion actions
  toggleCategoryExpansion: (categoryId: string) => void;
  expandAllCategories: (categoryIds: string[]) => void;
  collapseAllCategories: () => void;

  // UI actions
  setIsPreviewMode: (isPreview: boolean) => void;
  setSidebarWidth: (width: number) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  expandedNodes: new Set<number>(),
  selectedJournalId: null as number | null,
  expandedCategories: new Set<string>(),
  isPreviewMode: false,
  sidebarWidth: 320,
};

export const useJournalsUI = create<JournalsUIState>((set, get) => ({
  ...initialState,

  // Node expansion actions
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

  // Category expansion actions
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

  expandAllCategories: categoryIds =>
    set({
      expandedCategories: new Set(categoryIds),
    }),

  collapseAllCategories: () =>
    set({
      expandedCategories: new Set<string>(),
    }),

  // UI actions
  setIsPreviewMode: isPreview => set({ isPreviewMode: isPreview }),
  setSidebarWidth: width => set({ sidebarWidth: width }),

  // Reset
  reset: () =>
    set({
      ...initialState,
      expandedNodes: new Set<number>(),
      expandedCategories: new Set<string>(),
    }),
}));
