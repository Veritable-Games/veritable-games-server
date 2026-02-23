/**
 * useForumEvents Hook
 *
 * React hook for consuming real-time forum events via Server-Sent Events (SSE).
 * Automatically handles connection, reconnection, and event dispatching.
 *
 * Usage:
 * ```tsx
 * const { connected, error } = useForumEvents({
 *   onTopicLocked: (data) => logger.info('Topic locked:', data),
 *   onTopicPinned: (data) => logger.info('Topic pinned:', data),
 *   categoryId: 5, // Optional: only receive events for category 5
 *   topicId: 123,  // Optional: only receive events for topic 123
 * });
 * ```
 *
 * Features:
 * - Automatic reconnection on disconnect
 * - Optional filtering by category or topic
 * - Type-safe event callbacks
 * - Connection status tracking
 *
 * @module hooks/useForumEvents
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { logger } from '@/lib/utils/logger';
import type {
  ForumEvent,
  TopicStatusChangedData,
  TopicCreatedData,
  TopicDeletedData,
  ReplyCreatedData,
  ReplyDeletedData,
  ReplySolutionData,
} from '@/lib/forums/events';

// ============================================================================
// Hook Options
// ============================================================================

export interface UseForumEventsOptions {
  // Event callbacks
  onTopicLocked?: (data: TopicStatusChangedData) => void;
  onTopicUnlocked?: (data: TopicStatusChangedData) => void;
  onTopicPinned?: (data: TopicStatusChangedData) => void;
  onTopicUnpinned?: (data: TopicStatusChangedData) => void;
  onTopicSolved?: (data: TopicStatusChangedData) => void;
  onTopicUnsolved?: (data: TopicStatusChangedData) => void;
  onTopicArchived?: (data: TopicStatusChangedData) => void;
  onTopicUnarchived?: (data: TopicStatusChangedData) => void;
  onTopicCreated?: (data: TopicCreatedData) => void;
  onTopicDeleted?: (data: TopicDeletedData) => void;
  onReplyCreated?: (data: ReplyCreatedData) => void;
  onReplyDeleted?: (data: ReplyDeletedData) => void;
  onReplySolution?: (data: ReplySolutionData) => void;

  // Filters
  categoryId?: number; // Only receive events for this category
  topicId?: number; // Only receive events for this topic

  // Options
  enabled?: boolean; // Enable/disable the hook (default: true)
  reconnect?: boolean; // Auto-reconnect on disconnect (default: true)
  reconnectDelay?: number; // Delay before reconnecting in ms (default: 3000)
}

export interface UseForumEventsReturn {
  connected: boolean;
  error: string | null;
  reconnecting: boolean;
  disconnect: () => void;
  reconnect: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useForumEvents(options: UseForumEventsOptions = {}): UseForumEventsReturn {
  const {
    enabled = true,
    reconnect: autoReconnect = true,
    reconnectDelay = 3000,
    categoryId,
    topicId,
    ...callbacks
  } = options;

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const callbacksRef = useRef(callbacks);

  // Update callbacks ref on every render (avoid stale closures)
  callbacksRef.current = callbacks;

  /**
   * Connect to SSE endpoint
   */
  const connect = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Build URL with filters
    const params = new URLSearchParams();
    if (categoryId) params.append('category', categoryId.toString());
    if (topicId) params.append('topic', topicId.toString());
    if (lastEventIdRef.current) params.append('lastEventId', lastEventIdRef.current);

    const url = `/api/forums/events?${params.toString()}`;

    logger.info('[SSE] Connecting to:', url);

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      // Connection opened
      eventSource.addEventListener('connected', e => {
        if (!mountedRef.current) return;
        logger.info('[SSE] Connected:', e.data);
        setConnected(true);
        setError(null);
        setReconnecting(false);
      });

      // Generic message handler
      eventSource.addEventListener('message', e => {
        if (!mountedRef.current) return;

        try {
          const event: ForumEvent = JSON.parse(e.data);
          lastEventIdRef.current = event.id;

          // Dispatch to appropriate callback (use ref to avoid closure issues)
          handleEvent(event, callbacksRef.current);
        } catch (err) {
          logger.error('[SSE] Error parsing event:', err);
        }
      });

      // Error handler
      eventSource.onerror = e => {
        if (!mountedRef.current) return;

        logger.error('[SSE] Connection error:', e);
        setConnected(false);
        setError('Connection lost');

        // Auto-reconnect if enabled
        if (autoReconnect && !reconnectTimeoutRef.current) {
          setReconnecting(true);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            if (mountedRef.current) {
              logger.info('[SSE] Attempting reconnection...');
              connect();
            }
          }, reconnectDelay);
        }
      };
    } catch (err) {
      logger.error('[SSE] Error creating EventSource:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, [enabled, categoryId, topicId, autoReconnect, reconnectDelay, callbacks]);

  /**
   * Disconnect from SSE endpoint
   */
  const disconnect = useCallback(() => {
    logger.info('[SSE] Disconnecting...');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnected(false);
    setReconnecting(false);
  }, []);

  /**
   * Manual reconnect
   */
  const manualReconnect = useCallback(() => {
    disconnect();
    setReconnecting(true);
    setTimeout(connect, 100);
  }, [disconnect, connect]);

  // Connect on mount (only once)
  useEffect(() => {
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, categoryId, topicId]); // Only reconnect if filters change

  return {
    connected,
    error,
    reconnecting,
    disconnect,
    reconnect: manualReconnect,
  };
}

// ============================================================================
// Event Handler
// ============================================================================

/**
 * Dispatch event to appropriate callback
 */
function handleEvent(
  event: ForumEvent,
  callbacks: Omit<
    UseForumEventsOptions,
    'categoryId' | 'topicId' | 'enabled' | 'reconnect' | 'reconnectDelay'
  >
) {
  switch (event.type) {
    case 'topic:locked':
      callbacks.onTopicLocked?.(event.data as TopicStatusChangedData);
      break;
    case 'topic:unlocked':
      callbacks.onTopicUnlocked?.(event.data as TopicStatusChangedData);
      break;
    case 'topic:pinned':
      callbacks.onTopicPinned?.(event.data as TopicStatusChangedData);
      break;
    case 'topic:unpinned':
      callbacks.onTopicUnpinned?.(event.data as TopicStatusChangedData);
      break;
    case 'topic:solved':
      callbacks.onTopicSolved?.(event.data as TopicStatusChangedData);
      break;
    case 'topic:unsolved':
      callbacks.onTopicUnsolved?.(event.data as TopicStatusChangedData);
      break;
    case 'topic:archived':
      callbacks.onTopicArchived?.(event.data as TopicStatusChangedData);
      break;
    case 'topic:unarchived':
      callbacks.onTopicUnarchived?.(event.data as TopicStatusChangedData);
      break;
    case 'topic:created':
      callbacks.onTopicCreated?.(event.data as TopicCreatedData);
      break;
    case 'topic:deleted':
      callbacks.onTopicDeleted?.(event.data as TopicDeletedData);
      break;
    case 'reply:created':
      callbacks.onReplyCreated?.(event.data as ReplyCreatedData);
      break;
    case 'reply:deleted':
      callbacks.onReplyDeleted?.(event.data as ReplyDeletedData);
      break;
    case 'reply:solution':
      callbacks.onReplySolution?.(event.data as ReplySolutionData);
      break;
    default:
      logger.warn('[SSE] Unknown event type:', event.type);
  }
}
