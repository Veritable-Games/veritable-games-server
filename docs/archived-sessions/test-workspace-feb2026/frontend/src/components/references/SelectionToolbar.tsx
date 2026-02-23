'use client';

import { useReferencesStore } from '@/lib/stores/referencesStore';

/**
 * SelectionToolbar Component
 * Floating toolbar that appears at bottom of screen when items are selected
 * Shows selection count and provides quick actions (Clear, Delete)
 */

interface SelectionToolbarProps {
  onDelete?: () => void; // Called when Delete button clicked
}

export function SelectionToolbar({ onDelete }: SelectionToolbarProps) {
  // Use raw state values instead of computed functions to avoid infinite loops
  const selectedImageIds = useReferencesStore(state => state.selectedImageIds);
  const selectedAlbumIds = useReferencesStore(state => state.selectedAlbumIds);
  const clearSelection = useReferencesStore(state => state.clearSelection);

  const images = selectedImageIds.size;
  const albums = selectedAlbumIds.size;
  const hasSelection = images > 0 || albums > 0;

  // Don't render if no selection
  if (!hasSelection) {
    return null;
  }

  // Build selection text
  const parts: string[] = [];
  if (images > 0) parts.push(`${images} image${images !== 1 ? 's' : ''}`);
  if (albums > 0) parts.push(`${albums} album${albums !== 1 ? 's' : ''}`);
  const selectionText = parts.join(', ') + ' selected';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 fixed bottom-8 left-1/2 z-50 -translate-x-1/2 duration-200">
      <div className="flex items-center gap-4 rounded-lg border border-gray-700 bg-gray-800/95 px-6 py-3 shadow-2xl backdrop-blur-md">
        {/* Selection Count */}
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          <span className="font-medium text-gray-200">{selectionText}</span>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-600" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Delete Button (only if callback provided) */}
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
              title="Delete selected items (Del)"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete
              <span className="text-xs opacity-70">(Del)</span>
            </button>
          )}

          {/* Clear Selection Button */}
          <button
            onClick={clearSelection}
            className="flex items-center gap-1.5 rounded bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-600"
            title="Clear selection (Esc)"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Clear
            <span className="text-xs opacity-70">(Esc)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
