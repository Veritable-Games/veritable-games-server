/**
 * DocumentCardSkeleton Component
 *
 * Skeleton loader displayed while document data is being fetched
 * for virtual scrolling placeholder slots
 *
 * CRITICAL: This skeleton MUST match DocumentCard dimensions exactly
 * to prevent layout shift when documents load. Any height mismatch
 * causes Virtuoso to recalculate scroll positions, resulting in jitter.
 *
 * Fixed height: 240px (matches DocumentCard with CSS containment)
 */

// Fixed card height - MUST match DocumentCard exactly
const CARD_HEIGHT = 240;

export function DocumentCardSkeleton() {
  return (
    <div
      className="flex animate-pulse flex-col rounded-lg border border-gray-700/50 bg-gray-900/50 p-5"
      style={{
        height: `${CARD_HEIGHT}px`,
        minHeight: `${CARD_HEIGHT}px`,
        maxHeight: `${CARD_HEIGHT}px`,
        contain: 'strict',
        contentVisibility: 'auto',
        containIntrinsicBlockSize: `${CARD_HEIGHT}px`,
      }}
    >
      {/* Title - top left, matches DocumentCard line-clamp-2 text-base */}
      <div className="h-10 w-3/4 rounded bg-gray-700/50" />

      {/* Preview text - matches DocumentCard line-clamp-4 (4 lines) */}
      <div className="mt-2 space-y-2">
        <div className="h-3 w-full rounded bg-gray-700/50" />
        <div className="h-3 w-full rounded bg-gray-700/50" />
        <div className="h-3 w-full rounded bg-gray-700/50" />
        <div className="h-3 w-5/6 rounded bg-gray-700/50" />
      </div>

      {/* Author and date - matches DocumentCard mt-3 */}
      <div className="mt-3 flex items-center gap-2">
        <div className="h-3 w-24 rounded bg-gray-700/50" />
        <div className="h-3 w-3 rounded-full bg-gray-700/50" /> {/* separator dot */}
        <div className="h-3 w-12 rounded bg-gray-700/50" />
      </div>

      {/* Tags - Bottom Left, matches DocumentCard mt-auto pt-3 */}
      <div className="mt-auto flex flex-wrap gap-1 pt-3">
        <div className="h-5 w-16 rounded bg-gray-700/50" />
        <div className="h-5 w-20 rounded bg-gray-700/50" />
        <div className="h-5 w-14 rounded bg-gray-700/50" />
      </div>
    </div>
  );
}

/**
 * DocumentListRowSkeleton Component
 *
 * Skeleton loader for list view table rows
 */
// Fixed list row height - MUST match list view row exactly
const LIST_ROW_HEIGHT = 36;

export function DocumentListRowSkeleton() {
  return (
    <div
      className="grid grid-cols-12 gap-2 border-b border-gray-700/30 px-3 py-1.5"
      style={{
        height: `${LIST_ROW_HEIGHT}px`,
        minHeight: `${LIST_ROW_HEIGHT}px`,
        maxHeight: `${LIST_ROW_HEIGHT}px`,
      }}
    >
      {/* Title column (5 cols) */}
      <div className="col-span-5">
        <div className="h-5 w-3/4 animate-pulse rounded bg-gray-700/50" />
      </div>

      {/* Author column (3 cols) */}
      <div className="col-span-3">
        <div className="h-5 w-2/3 animate-pulse rounded bg-gray-700/50" />
      </div>

      {/* Year column (1 col) */}
      <div className="col-span-1">
        <div className="h-5 w-full animate-pulse rounded bg-gray-700/50" />
      </div>

      {/* Tags column (3 cols) */}
      <div className="col-span-3 flex gap-2">
        <div className="h-5 w-12 animate-pulse rounded-full bg-gray-700/50" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-gray-700/50" />
      </div>
    </div>
  );
}
