/**
 * OptimisticModerationDropdown Component
 *
 * Optimistic UI version of TopicModerationDropdown.
 * Provides instant feedback using optimistic actions from useOptimisticModeration.
 *
 * Features:
 * - Instant UI updates (no waiting for server)
 * - Automatic rollback on errors
 * - Loading states during server sync
 * - Real-time updates from SSE
 *
 * Usage:
 * ```tsx
 * <OptimisticModerationDropdown
 *   topic={optimisticTopic}
 *   actions={optimisticActions}
 *   isPending={isPending}
 * />
 * ```
 *
 * @module components/forums/OptimisticModerationDropdown
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { OptimisticActions } from './OptimisticTopicWrapper';

// ============================================================================
// Types
// ============================================================================

export interface OptimisticModerationDropdownProps {
  topic: {
    is_locked?: boolean;
    is_pinned?: boolean;
    is_solved?: boolean;
    is_archived?: boolean;
  };
  actions: OptimisticActions;
  isPending: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function OptimisticModerationDropdown({
  topic,
  actions,
  isPending,
}: OptimisticModerationDropdownProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleAction = async (actionFn: () => Promise<void>) => {
    setShowDropdown(false);
    await actionFn();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown trigger button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-1 rounded border border-red-600/50 px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-900/20 hover:text-red-300"
        aria-label="Moderation actions"
        aria-expanded={showDropdown}
      >
        {/* Icon */}
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
          />
        </svg>

        {/* Label */}
        <span>Moderate</span>

        {/* Dropdown arrow */}
        <svg
          className={`h-3 w-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {showDropdown && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
          <div className="py-1">
            {/* Lock/Unlock */}
            <button
              onClick={() => handleAction(actions.toggleLock)}
              className="flex w-full items-center space-x-2 px-3 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {topic.is_locked ? (
                  // Unlock icon
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                  />
                ) : (
                  // Lock icon
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                )}
              </svg>
              <span>{topic.is_locked ? 'Unlock Topic' : 'Lock Topic'}</span>
            </button>

            {/* Pin/Unpin */}
            <button
              onClick={() => handleAction(actions.togglePin)}
              className="flex w-full items-center space-x-2 px-3 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
              <span>{topic.is_pinned ? 'Unpin Topic' : 'Pin Topic'}</span>
            </button>

            {/* Mark Solved/Unsolved */}
            <button
              onClick={() => handleAction(actions.toggleSolved)}
              className="flex w-full items-center space-x-2 px-3 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{topic.is_solved ? 'Mark as Unsolved' : 'Mark as Solved'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
