import { create } from 'zustand';
import type { JournalNode, JournalCategory } from './types';

/**
 * Journals Data Store
 * Handles journals and categories CRUD operations
 * ~120 lines (vs 577 in monolithic store)
 */

interface JournalsDataState {
  // Data
  journals: JournalNode[];
  categories: JournalCategory[];

  // Journal CRUD actions
  setJournals: (journals: JournalNode[]) => void;
  addJournal: (journal: JournalNode) => void;
  updateJournal: (journalId: number, updates: Partial<JournalNode>) => void;
  updateJournalTitle: (journalId: number, newTitle: string) => void;
  updateJournalCategory: (journalId: number, categoryId: string) => void;
  removeJournals: (journalIds: number[]) => void;

  // Category CRUD actions
  setCategories: (categories: JournalCategory[]) => void;
  addCategory: (category: JournalCategory) => void;
  updateCategory: (categoryId: string, updates: Partial<JournalCategory>) => void;
  removeCategory: (categoryId: string) => void;

  // Helpers
  getJournalsByCategory: (categoryId: string) => JournalNode[];
  getUncategorizedId: () => string | undefined;
  reset: () => void;
}

const initialState = {
  journals: [] as JournalNode[],
  categories: [] as JournalCategory[],
};

export const useJournalsData = create<JournalsDataState>((set, get) => ({
  ...initialState,

  // Journal actions
  setJournals: journals => set({ journals }),

  addJournal: journal =>
    set(state => ({
      journals: [...state.journals, journal],
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
    })),

  // Category actions
  setCategories: categories => set({ categories }),

  addCategory: category =>
    set(state => ({
      categories: [...state.categories, category],
    })),

  updateCategory: (categoryId, updates) =>
    set(state => ({
      categories: state.categories.map(c => (c.id === categoryId ? { ...c, ...updates } : c)),
    })),

  removeCategory: categoryId =>
    set(state => ({
      categories: state.categories.filter(c => c.id !== categoryId),
    })),

  // Helpers
  getJournalsByCategory: categoryId => {
    const state = get();
    const uncategorizedId = state.categories.find(c => c.name === 'Uncategorized')?.id;

    // DEBUG: Log state for troubleshooting
    if (state.journals.length === 0) {
      console.warn('[getJournalsByCategory] STORE HAS 0 JOURNALS!');
    }
    if (state.categories.length === 0) {
      console.warn('[getJournalsByCategory] STORE HAS 0 CATEGORIES!');
    }
    // Log first call only to avoid spam
    if (categoryId && !((globalThis as any).__journalsDebugLogged)) {
      (globalThis as any).__journalsDebugLogged = true;
      console.log('[getJournalsByCategory] DEBUG:', {
        categoryId,
        uncategorizedId,
        journalsCount: state.journals.length,
        categoriesCount: state.categories.length,
        sampleJournal: state.journals[0] ? {
          id: state.journals[0].id,
          title: state.journals[0].title,
          journal_category_id: state.journals[0].journal_category_id,
        } : null,
        sampleCategory: state.categories[0] ? {
          id: state.categories[0].id,
          name: state.categories[0].name,
        } : null,
      });
    }

    const filtered = state.journals.filter(j => {
      const journalCategoryId = j.journal_category_id || uncategorizedId;
      return journalCategoryId === categoryId;
    });

    // Sort: active first, deleted last (each group sorted by updated_at desc)
    return filtered.sort((a, b) => {
      // Determine priority: 0 = active, 1 = deleted
      const getPriority = (j: JournalNode) => {
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

  reset: () => set(initialState),
}));
