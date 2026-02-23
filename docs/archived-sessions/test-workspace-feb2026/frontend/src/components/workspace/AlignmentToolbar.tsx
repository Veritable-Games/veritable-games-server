'use client';

/**
 * Alignment Toolbar Component
 *
 * Floating toolbar that appears above 2+ selected nodes.
 * Provides alignment and distribution controls similar to Figma/Miro.
 *
 * Features:
 * - Align Left/Right/Top/Bottom
 * - Center Horizontally/Vertically
 * - Distribute Horizontally/Vertically (3+ nodes)
 * - Skips locked nodes automatically
 * - Shows warning if locked nodes are present
 */

import { useRef, useEffect } from 'react';
import { AlignmentType, DistributionType } from '@/lib/workspace/alignment-utils';

interface AlignmentToolbarProps {
  visible: boolean;
  position?: { x: number; y: number } | null; // Screen coordinates for positioning
  nodeCount: number; // Total selected nodes
  lockedCount: number; // Count of locked nodes (shown as warning)
  onAlign: (alignmentType: AlignmentType) => void;
  onDistribute: (distributionType: DistributionType) => void;
}

export default function AlignmentToolbar({
  visible,
  position,
  nodeCount,
  lockedCount,
  onAlign,
  onDistribute,
}: AlignmentToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  if (!visible || nodeCount < 2) {
    return null;
  }

  // Calculate toolbar position (centered above selection)
  const toolbarStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y - 10}px`, // 10px above selection
        transform: 'translate(-50%, -100%)', // Center horizontally, position above
      }
    : {
        // Fallback to top-center
        position: 'fixed',
        top: '64px',
        left: '50%',
        transform: 'translateX(-50%)',
      };

  const canDistribute = nodeCount >= 3; // Need 3+ nodes for distribution

  return (
    <div
      ref={toolbarRef}
      style={{ ...toolbarStyle, fontFamily: 'Arial, sans-serif' }}
      className="z-50 flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 p-1.5 shadow-2xl"
    >
      {/* Locked nodes warning */}
      {lockedCount > 0 && (
        <div
          className="mr-1 flex items-center gap-1 rounded bg-amber-900/30 px-2 py-1 text-xs text-amber-200"
          title={`${lockedCount} locked node${lockedCount > 1 ? 's' : ''} will be skipped`}
        >
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          <span>{lockedCount}</span>
        </div>
      )}

      {/* Divider */}
      {lockedCount > 0 && <div className="h-6 w-px bg-neutral-600" />}

      {/* Align Left */}
      <button
        onClick={() => onAlign('left')}
        className="rounded p-1.5 text-neutral-200 transition-colors hover:bg-neutral-700"
        title="Align Left (Ctrl+Shift+L)"
        type="button"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
          <line x1="4" y1="4" x2="4" y2="20" strokeWidth={3} strokeLinecap="round" />
        </svg>
      </button>

      {/* Align Right */}
      <button
        onClick={() => onAlign('right')}
        className="rounded p-1.5 text-neutral-200 transition-colors hover:bg-neutral-700"
        title="Align Right (Ctrl+Shift+R)"
        type="button"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
          <line x1="20" y1="4" x2="20" y2="20" strokeWidth={3} strokeLinecap="round" />
        </svg>
      </button>

      {/* Align Top */}
      <button
        onClick={() => onAlign('top')}
        className="rounded p-1.5 text-neutral-200 transition-colors hover:bg-neutral-700"
        title="Align Top (Ctrl+Shift+T)"
        type="button"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 4h12M12 4v16M18 4v16"
            transform="rotate(90 12 12)"
          />
          <line x1="4" y1="4" x2="20" y2="4" strokeWidth={3} strokeLinecap="round" />
        </svg>
      </button>

      {/* Align Bottom */}
      <button
        onClick={() => onAlign('bottom')}
        className="rounded p-1.5 text-neutral-200 transition-colors hover:bg-neutral-700"
        title="Align Bottom (Ctrl+Shift+B)"
        type="button"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 4h12M12 4v16M18 4v16"
            transform="rotate(90 12 12)"
          />
          <line x1="4" y1="20" x2="20" y2="20" strokeWidth={3} strokeLinecap="round" />
        </svg>
      </button>

      {/* Divider */}
      <div className="h-6 w-px bg-neutral-600" />

      {/* Center Horizontally */}
      <button
        onClick={() => onAlign('center-horizontal')}
        className="rounded p-1.5 text-neutral-200 transition-colors hover:bg-neutral-700"
        title="Center Horizontally (Ctrl+Shift+H)"
        type="button"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <line x1="12" y1="4" x2="12" y2="20" strokeWidth={2} strokeLinecap="round" />
          <rect x="6" y="8" width="5" height="3" strokeWidth={2} fill="none" />
          <rect x="13" y="13" width="5" height="3" strokeWidth={2} fill="none" />
        </svg>
      </button>

      {/* Center Vertically */}
      <button
        onClick={() => onAlign('center-vertical')}
        className="rounded p-1.5 text-neutral-200 transition-colors hover:bg-neutral-700"
        title="Center Vertically (Ctrl+Shift+V)"
        type="button"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <line x1="4" y1="12" x2="20" y2="12" strokeWidth={2} strokeLinecap="round" />
          <rect x="8" y="6" width="3" height="5" strokeWidth={2} fill="none" />
          <rect x="13" y="13" width="3" height="5" strokeWidth={2} fill="none" />
        </svg>
      </button>

      {/* Distribute controls (only shown if 3+ nodes) */}
      {canDistribute && (
        <>
          {/* Divider */}
          <div className="h-6 w-px bg-neutral-600" />

          {/* Distribute Horizontally */}
          <button
            onClick={() => onDistribute('horizontal')}
            className="rounded p-1.5 text-neutral-200 transition-colors hover:bg-neutral-700"
            title="Distribute Horizontally (Ctrl+Shift+[)"
            type="button"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="4" y="8" width="4" height="8" strokeWidth={2} fill="none" />
              <rect x="10" y="8" width="4" height="8" strokeWidth={2} fill="none" />
              <rect x="16" y="8" width="4" height="8" strokeWidth={2} fill="none" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h1M14 12h1"
                strokeDasharray="2 2"
              />
            </svg>
          </button>

          {/* Distribute Vertically */}
          <button
            onClick={() => onDistribute('vertical')}
            className="rounded p-1.5 text-neutral-200 transition-colors hover:bg-neutral-700"
            title="Distribute Vertically (Ctrl+Shift+])"
            type="button"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="8" y="4" width="8" height="4" strokeWidth={2} fill="none" />
              <rect x="8" y="10" width="8" height="4" strokeWidth={2} fill="none" />
              <rect x="8" y="16" width="8" height="4" strokeWidth={2} fill="none" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v1M12 14v1"
                strokeDasharray="2 2"
              />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
