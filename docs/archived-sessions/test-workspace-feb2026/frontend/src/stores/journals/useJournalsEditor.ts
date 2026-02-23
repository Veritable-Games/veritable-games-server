import { create } from 'zustand';

/**
 * Journals Editor Store
 * Handles editor content state
 * ~40 lines (vs 577 in monolithic store)
 */

interface JournalsEditorState {
  // Editor state
  currentContent: string;

  // Editor actions
  setCurrentContent: (content: string) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  currentContent: '',
};

export const useJournalsEditor = create<JournalsEditorState>(set => ({
  ...initialState,

  // Editor actions
  setCurrentContent: content => set({ currentContent: content }),

  // Reset
  reset: () => set(initialState),
}));
