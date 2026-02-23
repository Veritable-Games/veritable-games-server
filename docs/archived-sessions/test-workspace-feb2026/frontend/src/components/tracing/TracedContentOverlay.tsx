'use client';

import React from 'react';
import { HybridMarkdownRenderer } from '@/components/ui/HybridMarkdownRenderer';
import type { TracedContent } from '@/lib/tracing/types';

interface TracedContentOverlayProps {
  /** The traced content to display */
  trace: TracedContent;
  /** Position relative to scroll container */
  position: { top: number; left: number };
  /** Whether this trace is currently active (being edited) */
  isActive?: boolean;
  /** Whether this trace is being hovered */
  isHovered?: boolean;
  /** Mouse enter handler */
  onMouseEnter?: () => void;
  /** Mouse leave handler */
  onMouseLeave?: () => void;
  /** Click handler */
  onClick?: () => void;
}

/**
 * TracedContentOverlay - Renders a single piece of traced content
 * positioned absolutely within the scroll container.
 */
export function TracedContentOverlay({
  trace,
  position,
  isActive = false,
  isHovered = false,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: TracedContentOverlayProps) {
  const statusColors = {
    draft: 'border-yellow-500/50 bg-yellow-500/5',
    published: 'border-purple-500/50 bg-purple-500/10',
    archived: 'border-gray-500/50 bg-gray-500/5',
  };

  const statusColor = statusColors[trace.status] || statusColors.draft;

  return (
    <div
      className={`absolute z-20 max-w-md cursor-pointer rounded border-l-2 px-3 py-1 transition-all ${statusColor} ${
        isActive
          ? 'ring-2 ring-purple-500'
          : isHovered
            ? 'ring-1 ring-purple-400/50'
            : 'hover:ring-1 hover:ring-purple-400/30'
      }`}
      style={{
        top: position.top,
        left: position.left,
        // Ensure overlay doesn't extend beyond container
        maxWidth: 'calc(100% - 2rem)',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {/* Status indicator */}
      <div className="mb-1 flex items-center gap-2">
        <span
          className={`text-[10px] font-medium uppercase tracking-wider ${
            trace.status === 'published'
              ? 'text-purple-400'
              : trace.status === 'draft'
                ? 'text-yellow-400'
                : 'text-gray-400'
          }`}
        >
          {trace.status}
        </span>
        {trace.anchor.anchorText && (
          <span
            className="max-w-[150px] truncate text-[10px] text-gray-500"
            title={trace.anchor.anchorText}
          >
            tracing: "{trace.anchor.anchorText.slice(0, 30)}..."
          </span>
        )}
      </div>

      {/* Traced content */}
      <div className="prose prose-sm prose-invert max-w-none">
        <HybridMarkdownRenderer content={trace.tracedContent} />
      </div>

      {/* Author and timestamp */}
      <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-500">
        <span>{trace.authorName}</span>
        <span>-</span>
        <span>{new Date(trace.updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
