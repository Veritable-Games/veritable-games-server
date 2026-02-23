'use client';

/**
 * Selection Counter Bar Component
 * Displays count of selected images and albums with action buttons
 * Only appears when items are selected (Ctrl+Click or Ctrl+A)
 */

interface SelectionCounterBarProps {
  imageCount: number;
  albumCount: number;
  onClearSelection: () => void;
  onSelectAll?: () => void;
}

export function SelectionCounterBar({
  imageCount,
  albumCount,
  onClearSelection,
  onSelectAll,
}: SelectionCounterBarProps) {
  // Don't show if nothing selected
  if (imageCount === 0 && albumCount === 0) {
    return null;
  }

  const totalSelected = imageCount + albumCount;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-blue-700 bg-gradient-to-t from-blue-950 to-blue-900 px-4 py-4 shadow-2xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Selection Count */}
          <div className="font-semibold text-white">
            <span className="text-lg text-blue-300">{totalSelected}</span>
            <span className="ml-2">
              {imageCount > 0 && (
                <span>
                  {imageCount} image{imageCount !== 1 ? 's' : ''}
                </span>
              )}
              {imageCount > 0 && albumCount > 0 && <span className="mx-2 text-blue-400">•</span>}
              {albumCount > 0 && (
                <span>
                  {albumCount} album{albumCount !== 1 ? 's' : ''}
                </span>
              )}
            </span>
          </div>

          {/* Keyboard Hint */}
          <div className="ml-4 rounded bg-blue-800/30 px-2 py-1 text-xs text-blue-300">
            Press <kbd className="rounded bg-blue-700 px-1.5 font-mono text-blue-100">ESC</kbd> to
            clear
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onSelectAll}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            Select All Visible
          </button>
          <button
            onClick={onClearSelection}
            className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
