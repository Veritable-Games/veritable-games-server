import { create } from 'zustand';

/**
 * Journals Selection Store
 * Handles batch selection for journals and categories
 * ~80 lines (vs 577 in monolithic store)
 */

interface JournalsSelectionState {
  // Selection state
  selectedJournalsForDeletion: Set<number>;
  selectedCategoriesForDeletion: Set<string>;

  // Journal selection actions
  toggleJournalSelection: (journalId: number) => void;
  clearSelections: () => void;
  selectAll: (journalIds: number[]) => void;
  selectOnly: (journalId: number) => void;

  // Category selection actions
  toggleCategorySelection: (categoryId: string) => void;
  clearCategorySelections: () => void;

  // Reset
  reset: () => void;
}

const initialState = {
  selectedJournalsForDeletion: new Set<number>(),
  selectedCategoriesForDeletion: new Set<string>(),
};

export const useJournalsSelection = create<JournalsSelectionState>(set => ({
  ...initialState,

  // Journal selection actions
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

  selectAll: journalIds =>
    set({
      selectedJournalsForDeletion: new Set(journalIds),
    }),

  selectOnly: journalId =>
    set({
      selectedJournalsForDeletion: new Set([journalId]),
    }),

  // Category selection actions
  toggleCategorySelection: categoryId =>
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

  // Reset
  reset: () =>
    set({
      ...initialState,
      selectedJournalsForDeletion: new Set<number>(),
      selectedCategoriesForDeletion: new Set<string>(),
    }),
}));
