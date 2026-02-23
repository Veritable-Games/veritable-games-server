import { useRemoteCursors, useViewport } from '@/stores/workspace';

/**
 * RemoteCursors Component
 *
 * Renders cursors of other users collaborating on the workspace canvas.
 * Shows real-time cursor positions and user names with colored badges.
 *
 * Features:
 * - Animated cursor transitions (100ms for smooth movement)
 * - User-specific colors (generated from user ID)
 * - User name badges
 * - Pointer-events none (doesn't interfere with canvas interactions)
 * - Viewport-aware positioning (scales with zoom)
 */
export function RemoteCursors() {
  const remoteCursors = useRemoteCursors();
  const viewport = useViewport();

  if (remoteCursors.size === 0) {
    return null; // No remote users, don't render anything
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      {Array.from(remoteCursors.entries()).map(([userId, cursor]) => (
        <div
          key={userId}
          className="absolute transition-transform duration-100 ease-linear"
          style={{
            left: cursor.x * viewport.scale + viewport.offsetX,
            top: cursor.y * viewport.scale + viewport.offsetY,
            transform: 'translate(-2px, -2px)', // Offset so tip of cursor is at exact position
          }}
        >
          {/* Cursor SVG - Modern minimal cursor pointer */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-lg"
          >
            {/* Outer white stroke for visibility on any background */}
            <path
              d="M4 4L4 16L8.5 13L11 18.5L13 17.5L10.5 12L16 11L4 4Z"
              stroke="white"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* Inner colored fill */}
            <path
              d="M5.5 5.5L5.5 14L8.8 12L10.8 16.5L11.8 16L9.8 11.5L14.5 10.5L5.5 5.5Z"
              fill={cursor.color}
              strokeLinejoin="round"
            />
          </svg>

          {/* User name badge */}
          <div
            className="absolute left-4 top-6 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-white shadow-lg"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.name}
          </div>
        </div>
      ))}
    </div>
  );
}
