/**
 * OptimisticStatusBadges Component
 *
 * Displays topic status badges with optimistic UI updates.
 * Shows loading animations during server synchronization.
 *
 * Features:
 * - Instant badge updates (no server wait)
 * - Pulse animation during pending state
 * - Smooth transitions between states
 * - Real-time updates from SSE
 *
 * Usage:
 * ```tsx
 * <OptimisticStatusBadges
 *   topic={optimisticTopic}
 *   isPending={isPending}
 * />
 * ```
 *
 * @module components/forums/OptimisticStatusBadges
 */

'use client';

import React from 'react';

// ============================================================================
// Types
// ============================================================================

export interface OptimisticStatusBadgesProps {
  topic: {
    is_locked?: boolean;
    is_pinned?: boolean;
    is_solved?: boolean;
    is_archived?: boolean;
  };
  isPending?: boolean;
  showIcons?: boolean; // Show emoji icons (default: true)
  size?: 'sm' | 'md' | 'lg'; // Badge size
}

// ============================================================================
// Component
// ============================================================================

export function OptimisticStatusBadges({
  topic,
  isPending = false,
  showIcons = true,
  size = 'sm',
}: OptimisticStatusBadgesProps) {
  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  const baseClasses = `inline-flex items-center space-x-1 rounded-full font-medium transition-colors ${sizeClasses[size]}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Locked Badge */}
      {topic.is_locked && (
        <span
          className={`${baseClasses} border border-red-500/30 bg-red-500/20 text-red-400`}
          title="Topic is locked"
        >
          {showIcons && <span aria-hidden="true">🔒</span>}
          <span>Locked</span>
        </span>
      )}

      {/* Pinned Badge */}
      {topic.is_pinned && (
        <span
          className={`${baseClasses} border border-blue-500/30 bg-blue-500/20 text-blue-400`}
          title="Topic is pinned"
        >
          {showIcons && <span aria-hidden="true">📌</span>}
          <span>Pinned</span>
        </span>
      )}

      {/* Solved Badge */}
      {topic.is_solved && (
        <span
          className={`${baseClasses} border border-green-500/30 bg-green-500/20 text-green-400`}
          title="Topic is solved"
        >
          {showIcons && <span aria-hidden="true">✓</span>}
          <span>Solved</span>
        </span>
      )}

      {/* Archived Badge */}
      {topic.is_archived && (
        <span
          className={`${baseClasses} border border-gray-500/30 bg-gray-500/20 text-gray-400`}
          title="Topic is archived"
        >
          {showIcons && <span aria-hidden="true">📦</span>}
          <span>Archived</span>
        </span>
      )}
    </div>
  );
}

/**
 * Compact version for use in topic lists
 */
export function CompactStatusBadges({
  topic,
  isPending = false,
}: Pick<OptimisticStatusBadgesProps, 'topic' | 'isPending'>) {
  const badgeClasses =
    'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs transition-colors';

  return (
    <div className="flex items-center gap-1">
      {/* Locked icon */}
      {topic.is_locked && (
        <span
          className={`${badgeClasses} bg-red-500/20 text-red-400`}
          title="Locked"
          aria-label="Topic is locked"
        >
          🔒
        </span>
      )}

      {/* Pinned icon */}
      {topic.is_pinned && (
        <span
          className={`${badgeClasses} bg-blue-500/20 text-blue-400`}
          title="Pinned"
          aria-label="Topic is pinned"
        >
          📌
        </span>
      )}

      {/* Solved icon */}
      {topic.is_solved && (
        <span
          className={`${badgeClasses} bg-green-500/20 text-green-400`}
          title="Solved"
          aria-label="Topic is solved"
        >
          ✓
        </span>
      )}

      {/* Archived icon */}
      {topic.is_archived && (
        <span
          className={`${badgeClasses} bg-gray-500/20 text-gray-400`}
          title="Archived"
          aria-label="Topic is archived"
        >
          📦
        </span>
      )}
    </div>
  );
}
