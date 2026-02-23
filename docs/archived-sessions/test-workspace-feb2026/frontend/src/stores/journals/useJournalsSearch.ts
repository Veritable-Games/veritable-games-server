import { create } from 'zustand';
import type { JournalSearchResult } from './types';

/**
 * Journals Search Store
 * Handles search query, results, and loading state
 * ~60 lines (vs 577 in monolithic store)
 */

interface JournalsSearchState {
  // Search state
  searchQuery: string;
  searchResults: JournalSearchResult | null;
  isSearching: boolean;

  // Search actions
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: JournalSearchResult | null) => void;
  setIsSearching: (isSearching: boolean) => void;
  clearSearch: () => void;

  // Reset
  reset: () => void;
}

const initialState = {
  searchQuery: '',
  searchResults: null as JournalSearchResult | null,
  isSearching: false,
};

export const useJournalsSearch = create<JournalsSearchState>(set => ({
  ...initialState,

  // Search actions
  setSearchQuery: query => set({ searchQuery: query }),

  setSearchResults: results => set({ searchResults: results }),

  setIsSearching: isSearching => set({ isSearching }),

  clearSearch: () =>
    set({
      searchQuery: '',
      searchResults: null,
      isSearching: false,
    }),

  // Reset
  reset: () => set(initialState),
}));
