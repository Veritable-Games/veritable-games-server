/**
 * useOptimisticModeration Hook
 *
 * React 19 hook for optimistic UI updates during forum moderation actions.
 * Provides instant feedback while waiting for server confirmation.
 *
 * Features:
 * - Instant UI updates using React 19's useOptimistic
 * - Automatic rollback on error
 * - Integration with SSE for real-time updates from other moderators
 * - Type-safe moderation actions
 *
 * Usage:
 * ```tsx
 * const { topic, isPending, toggleLock, togglePin } = useOptimisticModeration({
 *   initialTopic: serverTopic,
 *   onError: (error) => toast.error(error.message),
 * });
 * ```
 *
 * @module hooks/useOptimisticModeration
 */

'use client';

import { useOptimistic, useTransition, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForumEvents } from './useForumEvents';
import { logger } from '@/lib/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface OptimisticTopic {
  id: number;
  status: number; // Bit flags
  is_locked?: boolean;
  is_pinned?: boolean;
  is_solved?: boolean;
  is_archived?: boolean;
  category_id: number;
  [key: string]: any; // Allow other topic properties
}

export interface UseOptimisticModerationOptions {
  initialTopic: OptimisticTopic;
  onSuccess?: (action: string) => void;
  onError?: (error: Error) => void;
  autoRefresh?: boolean; // Auto-refresh on SSE events (default: true)
}

export interface UseOptimisticModerationReturn {
  topic: OptimisticTopic;
  isPending: boolean;
  toggleLock: () => Promise<void>;
  togglePin: () => Promise<void>;
  toggleSolved: () => Promise<void>;
}

type ModerationAction =
  | { type: 'lock' }
  | { type: 'unlock' }
  | { type: 'pin' }
  | { type: 'unpin' }
  | { type: 'solve' }
  | { type: 'unsolve' }
  | { type: 'archive' }
  | { type: 'unarchive' }
  | { type: 'update'; payload: Partial<OptimisticTopic> };

// ============================================================================
// Hook Implementation
// ============================================================================

export function useOptimisticModeration(
  options: UseOptimisticModerationOptions
): UseOptimisticModerationReturn {
  const { initialTopic, onSuccess, onError, autoRefresh = true } = options;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverTopic, setServerTopic] = useState(initialTopic);

  // Optimistic state using React 19's useOptimistic
  const [optimisticTopic, updateOptimisticTopic] = useOptimistic(
    serverTopic,
    (currentTopic, action: ModerationAction) => {
      switch (action.type) {
        case 'lock':
          return { ...currentTopic, is_locked: true };
        case 'unlock':
          return { ...currentTopic, is_locked: false };
        case 'pin':
          return { ...currentTopic, is_pinned: true };
        case 'unpin':
          return { ...currentTopic, is_pinned: false };
        case 'solve':
          return { ...currentTopic, is_solved: true };
        case 'unsolve':
          return { ...currentTopic, is_solved: false };
        case 'archive':
          return { ...currentTopic, is_archived: true };
        case 'unarchive':
          return { ...currentTopic, is_archived: false };
        case 'update':
          return { ...currentTopic, ...action.payload };
        default:
          return currentTopic;
      }
    }
  );

  /**
   * Listen for real-time updates from other moderators
   */
  useForumEvents({
    topicId: initialTopic.id,
    enabled: autoRefresh,

    onTopicLocked: data => {
      if (data.topic_id === initialTopic.id) {
        setServerTopic(prev => ({
          ...prev,
          status: data.status,
          is_locked: data.is_locked,
          is_pinned: data.is_pinned,
          is_solved: data.is_solved,
          is_archived: data.is_archived,
        }));
      }
    },

    onTopicUnlocked: data => {
      if (data.topic_id === initialTopic.id) {
        setServerTopic(prev => ({
          ...prev,
          status: data.status,
          is_locked: data.is_locked,
          is_pinned: data.is_pinned,
          is_solved: data.is_solved,
          is_archived: data.is_archived,
        }));
      }
    },

    onTopicPinned: data => {
      if (data.topic_id === initialTopic.id) {
        setServerTopic(prev => ({
          ...prev,
          status: data.status,
          is_locked: data.is_locked,
          is_pinned: data.is_pinned,
          is_solved: data.is_solved,
          is_archived: data.is_archived,
        }));
      }
    },

    onTopicUnpinned: data => {
      if (data.topic_id === initialTopic.id) {
        setServerTopic(prev => ({
          ...prev,
          status: data.status,
          is_locked: data.is_locked,
          is_pinned: data.is_pinned,
          is_solved: data.is_solved,
          is_archived: data.is_archived,
        }));
      }
    },

    onTopicSolved: data => {
      if (data.topic_id === initialTopic.id) {
        setServerTopic(prev => ({
          ...prev,
          status: data.status,
          is_locked: data.is_locked,
          is_pinned: data.is_pinned,
          is_solved: data.is_solved,
          is_archived: data.is_archived,
        }));
      }
    },

    onTopicUnsolved: data => {
      if (data.topic_id === initialTopic.id) {
        setServerTopic(prev => ({
          ...prev,
          status: data.status,
          is_locked: data.is_locked,
          is_pinned: data.is_pinned,
          is_solved: data.is_solved,
          is_archived: data.is_archived,
        }));
      }
    },

    onTopicArchived: data => {
      if (data.topic_id === initialTopic.id) {
        setServerTopic(prev => ({
          ...prev,
          status: data.status,
          is_locked: data.is_locked,
          is_pinned: data.is_pinned,
          is_solved: data.is_solved,
          is_archived: data.is_archived,
        }));
      }
    },

    onTopicUnarchived: data => {
      if (data.topic_id === initialTopic.id) {
        setServerTopic(prev => ({
          ...prev,
          status: data.status,
          is_locked: data.is_locked,
          is_pinned: data.is_pinned,
          is_solved: data.is_solved,
          is_archived: data.is_archived,
        }));
      }
    },
  });

  /**
   * Sync with server on mount to get latest status
   * This ensures the optimistic UI starts with the most current server state
   */
  useEffect(() => {
    async function syncWithServer() {
      try {
        const response = await fetch(`/api/forums/topics/${initialTopic.id}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.topic) {
            setServerTopic(result.data.topic);
          }
        }
      } catch (error) {
        logger.error('Failed to sync topic state:', error);
      }
    }
    syncWithServer();
  }, [initialTopic.id]);

  /**
   * Generic moderation action handler
   */
  const performAction = useCallback(
    async (
      optimisticAction: ModerationAction,
      apiEndpoint: string,
      payload: any,
      actionName: string
    ) => {
      // Apply optimistic update synchronously inside transition
      startTransition(() => {
        updateOptimisticTopic(optimisticAction);
      });

      // Perform async API call OUTSIDE transition
      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = errorData.error?.message || `Failed to ${actionName}`;

          logger.error(`Error during ${actionName}:`, errorMessage);

          // Rollback happens automatically - optimistic state reverts to serverTopic
          // because we didn't update serverTopic

          // Call error callback
          onError?.(new Error(errorMessage));
          return;
        }

        const result = await response.json();

        // Update server state with confirmed data (triggers optimistic state to sync)
        if (result.success && result.data?.topic) {
          setServerTopic(result.data.topic);
        }

        // Refresh the page to update SSR data (including ReplyList lock status)
        router.refresh();

        // Call success callback
        onSuccess?.(actionName);
      } catch (error) {
        logger.error(`Exception during ${actionName}:`, error);

        // Rollback happens automatically - optimistic state reverts to serverTopic
        // because we didn't update serverTopic

        // Call error callback
        onError?.(error instanceof Error ? error : new Error(`Failed to ${actionName}`));
      }
    },
    [updateOptimisticTopic, onSuccess, onError]
  );

  /**
   * Toggle lock status
   */
  const toggleLock = useCallback(async () => {
    const newLockState = !optimisticTopic.is_locked;
    await performAction(
      { type: newLockState ? 'lock' : 'unlock' },
      `/api/forums/topics/${initialTopic.id}/lock`,
      { locked: newLockState },
      newLockState ? 'lock topic' : 'unlock topic'
    );
  }, [optimisticTopic.is_locked, initialTopic.id, performAction]);

  /**
   * Toggle pin status
   */
  const togglePin = useCallback(async () => {
    const newPinState = !optimisticTopic.is_pinned;
    await performAction(
      { type: newPinState ? 'pin' : 'unpin' },
      `/api/forums/topics/${initialTopic.id}/pin`,
      { pinned: newPinState },
      newPinState ? 'pin topic' : 'unpin topic'
    );
  }, [optimisticTopic.is_pinned, initialTopic.id, performAction]);

  /**
   * Toggle solved status
   */
  const toggleSolved = useCallback(async () => {
    const newSolvedState = !optimisticTopic.is_solved;
    await performAction(
      { type: newSolvedState ? 'solve' : 'unsolve' },
      `/api/forums/topics/${initialTopic.id}/solved`,
      { solved: newSolvedState },
      newSolvedState ? 'mark as solved' : 'mark as unsolved'
    );
  }, [optimisticTopic.is_solved, initialTopic.id, performAction]);

  return {
    topic: optimisticTopic,
    isPending,
    toggleLock,
    togglePin,
    toggleSolved,
  };
}
