/**
 * OptimisticTopicWrapper Component
 *
 * Wrapper component that provides optimistic UI updates for topic moderation actions.
 * Integrates React 19's useOptimistic with real-time SSE events.
 *
 * Usage:
 * ```tsx
 * <OptimisticTopicWrapper initialTopic={topic}>
 *   {({ optimisticTopic, actions, isPending }) => (
 *     <TopicView
 *       topic={optimisticTopic}
 *       onLock={actions.toggleLock}
 *       onPin={actions.togglePin}
 *       isPending={isPending}
 *     />
 *   )}
 * </OptimisticTopicWrapper>
 * ```
 *
 * @module components/forums/OptimisticTopicWrapper
 */

'use client';

import { ReactNode } from 'react';
import { useOptimisticModeration, OptimisticTopic } from '@/hooks/useOptimisticModeration';
import { logger } from '@/lib/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface OptimisticActions {
  toggleLock: () => Promise<void>;
  togglePin: () => Promise<void>;
  toggleSolved: () => Promise<void>;
}

export interface OptimisticTopicWrapperProps {
  initialTopic: OptimisticTopic;
  children: (props: {
    topic: OptimisticTopic;
    actions: OptimisticActions;
    isPending: boolean;
  }) => ReactNode;
  onSuccess?: (action: string) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Component
// ============================================================================

export function OptimisticTopicWrapper({
  initialTopic,
  children,
  onSuccess,
  onError,
}: OptimisticTopicWrapperProps) {
  const { topic, isPending, toggleLock, togglePin, toggleSolved } = useOptimisticModeration({
    initialTopic,
    onSuccess,
    onError,
    autoRefresh: true,
  });

  const actions: OptimisticActions = {
    toggleLock,
    togglePin,
    toggleSolved,
  };

  return <>{children({ topic, actions, isPending })}</>;
}

/**
 * Example usage component showing integration with TopicView
 */
export function OptimisticTopicViewExample({ topic: serverTopic }: { topic: any }) {
  const handleSuccess = (action: string) => {
    logger.info(`Success: ${action}`);
    // Could show a toast notification here
  };

  const handleError = (error: Error) => {
    logger.error('Moderation error:', error);
    // Could show an error toast here
  };

  return (
    <OptimisticTopicWrapper
      initialTopic={serverTopic}
      onSuccess={handleSuccess}
      onError={handleError}
    >
      {({ topic, actions, isPending }) => (
        <div className="space-y-4">
          {/* Status badges with optimistic state */}
          <div className="flex gap-2">
            {topic.is_locked && (
              <span className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-400">
                🔒 Locked
              </span>
            )}
            {topic.is_pinned && (
              <span className="rounded bg-blue-500/20 px-2 py-1 text-xs text-blue-400">
                📌 Pinned
              </span>
            )}
            {topic.is_solved && (
              <span className="rounded bg-green-500/20 px-2 py-1 text-xs text-green-400">
                ✓ Solved
              </span>
            )}
            {topic.is_archived && (
              <span className="rounded bg-gray-500/20 px-2 py-1 text-xs text-gray-400">
                📦 Archived
              </span>
            )}
            {isPending && (
              <span className="animate-pulse rounded bg-yellow-500/20 px-2 py-1 text-xs text-yellow-400">
                ⏳ Updating...
              </span>
            )}
          </div>

          {/* Moderation buttons */}
          <div className="flex gap-2">
            <button
              onClick={actions.toggleLock}
              disabled={isPending}
              className="rounded bg-gray-700 px-3 py-1.5 text-sm hover:bg-gray-600 disabled:opacity-50"
            >
              {topic.is_locked ? '🔓 Unlock' : '🔒 Lock'}
            </button>

            <button
              onClick={actions.togglePin}
              disabled={isPending}
              className="rounded bg-gray-700 px-3 py-1.5 text-sm hover:bg-gray-600 disabled:opacity-50"
            >
              {topic.is_pinned ? '📍 Unpin' : '📌 Pin'}
            </button>

            <button
              onClick={actions.toggleSolved}
              disabled={isPending}
              className="rounded bg-gray-700 px-3 py-1.5 text-sm hover:bg-gray-600 disabled:opacity-50"
            >
              {topic.is_solved ? '❌ Unsolved' : '✓ Mark Solved'}
            </button>
          </div>

          {/* Topic content would go here */}
          <div className="rounded bg-gray-800 p-4">
            <h2 className="text-xl font-bold">{topic.title || 'Topic Title'}</h2>
            <p className="mt-2 text-gray-400">{topic.content || 'Topic content...'}</p>
          </div>
        </div>
      )}
    </OptimisticTopicWrapper>
  );
}
