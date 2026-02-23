'use client';

import type { UnifiedDocument } from '@/lib/documents/types';

interface SelectionToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onUnlinkSelected?: () => void;
  isUnlinking?: boolean;
}

export function SelectionToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onUnlinkSelected,
  isUnlinking = false,
}: SelectionToolbarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="sticky bottom-0 left-0 right-0 z-40 mb-4 rounded-lg border border-blue-500/50 bg-blue-900/30 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        {/* Selection info */}
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium text-blue-200">
            {selectedCount} of {totalCount} selected
          </div>

          {selectedCount < totalCount && (
            <button
              onClick={onSelectAll}
              className="text-xs text-blue-400 underline transition-colors hover:text-blue-300"
            >
              Select all
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Unlink button */}
          {onUnlinkSelected && (
            <button
              onClick={onUnlinkSelected}
              disabled={isUnlinking}
              className="inline-flex items-center gap-1.5 rounded border border-orange-500/50 bg-orange-900/30 px-3 py-1.5 text-xs font-medium text-orange-200 transition-colors hover:border-orange-400 hover:bg-orange-900/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUnlinking ? (
                <>
                  <svg
                    className="h-3 w-3 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  Unlinking...
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  Unlink
                </>
              )}
            </button>
          )}

          {/* Clear selection */}
          <button
            onClick={onClearSelection}
            className="inline-flex items-center gap-1.5 rounded border border-gray-600/50 bg-gray-800/30 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-gray-500 hover:bg-gray-800/50"
          >
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            Clear (Esc)
          </button>
        </div>
      </div>

      {/* Helper text */}
      <div className="mt-2 flex items-center gap-2 text-xs text-blue-300/70">
        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <span>Use Ctrl+Click to select multiple documents. Press Escape to clear selection.</span>
      </div>
    </div>
  );
}
