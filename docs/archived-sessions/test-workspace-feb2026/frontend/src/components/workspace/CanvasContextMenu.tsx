'use client';

/**
 * Canvas Context Menu Component
 *
 * Right-click context menu for canvas workspace.
 * Shows contextual actions based on what was clicked.
 */

import { useEffect, useRef } from 'react';

interface CanvasContextMenuProps {
  x: number; // Screen coordinates (clientX)
  y: number; // Screen coordinates (clientY)
  onAddText: () => void;
  onCreateNote: () => void;
  onClose: () => void;
}

export default function CanvasContextMenu({
  x,
  y,
  onAddText,
  onCreateNote,
  onClose,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or ESC key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Add listeners with slight delay to avoid immediate close
    // Use capture phase (true) to catch events before stopPropagation() in child elements
    const timerId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      clearTimeout(timerId);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-lg border border-neutral-700 bg-neutral-900 py-1 shadow-xl"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
      role="menu"
      aria-label="Canvas context menu"
    >
      <button
        onClick={() => {
          onAddText();
          onClose();
        }}
        className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm text-neutral-200 transition-colors hover:bg-neutral-800"
        role="menuitem"
        title="Add a text box"
      >
        <span className="flex items-center gap-2">
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h7"
            />
          </svg>
          <span>Add Text</span>
        </span>
        <span className="text-xs text-neutral-500">Double-click</span>
      </button>

      <button
        onClick={() => {
          onCreateNote();
          onClose();
        }}
        className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm text-neutral-200 transition-colors hover:bg-neutral-800"
        role="menuitem"
        title="Create a note with title"
      >
        <span className="flex items-center gap-2">
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span>Create Note</span>
        </span>
      </button>
    </div>
  );
}
