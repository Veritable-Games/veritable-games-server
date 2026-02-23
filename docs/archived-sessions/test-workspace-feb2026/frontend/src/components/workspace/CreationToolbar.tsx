'use client';

import React from 'react';

/**
 * SVG Icon Components for Top Toolbar
 */
const TextIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
  </svg>
);

interface CreationToolbarProps {
  onAddText: () => void;
  disabled?: boolean;
}

/**
 * Creation Toolbar - Top toolbar for creating nodes
 *
 * Provides quick access to creation tools without requiring right-click.
 * Improves discoverability for new users.
 */
export default function CreationToolbar({ onAddText, disabled = false }: CreationToolbarProps) {
  return (
    <div className="absolute left-4 top-4">
      <button
        onClick={onAddText}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-300 shadow-lg transition-colors hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        title="Add Text Node (Double-click canvas)"
        aria-label="Add text node to workspace"
      >
        <TextIcon />
        <span>Text</span>
      </button>
    </div>
  );
}
