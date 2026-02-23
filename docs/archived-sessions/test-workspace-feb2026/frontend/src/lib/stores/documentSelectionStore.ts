import { create } from 'zustand';
import type { UnifiedDocument } from '@/lib/documents/types';

/**
 * Zustand store for document grid selection
 * Manages client-side state for multi-select operations in library grid view
 * Similar to referencesStore but specialized for document cards
 */

export interface DocumentSelectionState {
  // Selection (multi-select for batch operations)
  selectedDocumentIds: Set<string>; // Store as Set for O(1) lookups
  lastSelectedIndex: number | null; // Anchor point for shift+click range selection

  // Actions - Selection
  toggleDocumentSelection: (docId: string, index?: number) => void;
  selectWithShift: (clickedIndex: number, documents: UnifiedDocument[]) => void;
  clearSelection: () => void;
  selectMultipleDocuments: (docIds: string[]) => void;
  selectAllDocuments: (documents: UnifiedDocument[]) => void;
  setLastSelectedIndex: (index: number | null) => void;

  // Actions - Delete
  removeDocuments: (docIds: string[]) => void;

  // Computed
  hasSelection: () => boolean;
  selectionCount: () => number;
  getSelectedDocumentIds: () => string[];
}

export const useDocumentSelectionStore = create<DocumentSelectionState>((set, get) => ({
  // Initial State
  selectedDocumentIds: new Set(),
  lastSelectedIndex: null,

  // Selection Actions
  toggleDocumentSelection: (docId: string, index?: number) =>
    set(state => {
      const newSelection = new Set(state.selectedDocumentIds);
      if (newSelection.has(docId)) {
        newSelection.delete(docId);
      } else {
        newSelection.add(docId);
      }
      return {
        selectedDocumentIds: newSelection,
        // Track the anchor point for shift+click range selection
        lastSelectedIndex: index ?? state.lastSelectedIndex,
      };
    }),

  // Shift+click range selection
  selectWithShift: (clickedIndex: number, documents: UnifiedDocument[]) =>
    set(state => {
      const anchor = state.lastSelectedIndex ?? clickedIndex;
      const start = Math.min(anchor, clickedIndex);
      const end = Math.max(anchor, clickedIndex);

      // Add all documents in range to selection
      const newSelection = new Set(state.selectedDocumentIds);
      for (let i = start; i <= end; i++) {
        const doc = documents[i];
        if (doc) {
          newSelection.add(String(doc.id));
        }
      }

      return {
        selectedDocumentIds: newSelection,
        lastSelectedIndex: clickedIndex,
      };
    }),

  clearSelection: () =>
    set({
      selectedDocumentIds: new Set(),
      lastSelectedIndex: null,
    }),

  selectMultipleDocuments: (docIds: string[]) =>
    set({
      selectedDocumentIds: new Set(docIds),
      lastSelectedIndex: null,
    }),

  selectAllDocuments: (documents: UnifiedDocument[]) =>
    set({
      selectedDocumentIds: new Set(documents.map(doc => String(doc.id))),
      lastSelectedIndex: null,
    }),

  setLastSelectedIndex: (index: number | null) => set({ lastSelectedIndex: index }),

  // Delete Action (removes from selection, actual deletion handled by parent)
  removeDocuments: (docIds: string[]) =>
    set(state => {
      const newSelection = new Set(state.selectedDocumentIds);
      docIds.forEach(id => newSelection.delete(id));
      return { selectedDocumentIds: newSelection };
    }),

  // Computed
  hasSelection: () => {
    const { selectedDocumentIds } = get();
    return selectedDocumentIds.size > 0;
  },

  selectionCount: () => {
    const { selectedDocumentIds } = get();
    return selectedDocumentIds.size;
  },

  getSelectedDocumentIds: () => {
    const { selectedDocumentIds } = get();
    return Array.from(selectedDocumentIds);
  },
}));
