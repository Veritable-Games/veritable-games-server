/**
 * ScrollPositionIndicator Component
 *
 * Displays current visible range and scroll progress
 * Shows "Viewing 1,500-1,700 of 24,743 (6%)"
 */

'use client';

interface ScrollPositionIndicatorProps {
  visibleRange: { start: number; end: number };
  totalCount: number;
  viewMode: 'grid' | 'list';
}

export function ScrollPositionIndicator({
  visibleRange,
  totalCount,
  viewMode,
}: ScrollPositionIndicatorProps) {
  // Don't show if no documents
  if (totalCount === 0) {
    return null;
  }

  // Calculate actual document indices based on view mode
  // Grid view: Each row has 2 docs, so multiply by 2
  const startDoc = viewMode === 'grid' ? visibleRange.start * 2 : visibleRange.start;
  const endDoc =
    viewMode === 'grid'
      ? Math.min((visibleRange.end + 1) * 2 - 1, totalCount - 1)
      : Math.min(visibleRange.end, totalCount - 1);

  // Calculate progress percentage
  const progress = totalCount > 0 ? Math.round((endDoc / totalCount) * 100) : 0;

  return (
    <div className="fixed bottom-4 right-4 z-10 rounded-lg border border-gray-700 bg-gray-800/95 px-4 py-2 shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5">
          <svg
            className="h-4 w-4 text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          <span className="text-white">Viewing:</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-blue-300">{startDoc.toLocaleString()}</span>
          <span className="text-gray-400">-</span>
          <span className="font-mono text-blue-300">{endDoc.toLocaleString()}</span>
          <span className="text-gray-500">of</span>
          <span className="font-mono text-gray-300">{totalCount.toLocaleString()}</span>
          <span className="text-gray-500">({progress}%)</span>
        </div>
      </div>
    </div>
  );
}
