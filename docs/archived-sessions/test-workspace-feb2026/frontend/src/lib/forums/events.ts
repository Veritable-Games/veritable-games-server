/**
 * Forum Real-time Events System
 *
 * Provides Server-Sent Events (SSE) infrastructure for real-time forum updates.
 * Broadcasts moderation actions, status changes, and topic updates to all connected clients.
 *
 * Architecture:
 * - Server-side event broadcaster (ForumEventBroadcaster)
 * - SSE API endpoint (/api/forums/events)
 * - Client-side hook (useForumEvents)
 * - Integration with ForumModerationService
 *
 * Event Types:
 * - topic:locked / topic:unlocked
 * - topic:pinned / topic:unpinned
 * - topic:solved / topic:unsolved
 * - topic:created / topic:updated / topic:deleted
 * - reply:created / reply:updated / reply:deleted
 *
 * @module lib/forums/events
 */

import { logger } from '@/lib/utils/logger';

// Using simple number types here since this is an event utility file
// Branded types are available in ./branded-types.ts but not needed for event emission
type TopicId = number;
type ReplyId = number;
type UserId = number;
type CategoryId = number;

// ============================================================================
// Event Types
// ============================================================================

/**
 * Base event interface
 */
export interface ForumEvent {
  id: string; // Unique event ID
  type: ForumEventType;
  timestamp: number;
  data: ForumEventData;
}

/**
 * Forum event types
 */
export type ForumEventType =
  | 'topic:locked'
  | 'topic:unlocked'
  | 'topic:pinned'
  | 'topic:unpinned'
  | 'topic:solved'
  | 'topic:unsolved'
  | 'topic:archived'
  | 'topic:unarchived'
  | 'topic:created'
  | 'topic:updated'
  | 'topic:deleted'
  | 'reply:created'
  | 'reply:updated'
  | 'reply:deleted'
  | 'reply:solution';

/**
 * Event data payloads
 */
export type ForumEventData =
  | TopicStatusChangedData
  | TopicCreatedData
  | TopicUpdatedData
  | TopicDeletedData
  | ReplyCreatedData
  | ReplyUpdatedData
  | ReplyDeletedData
  | ReplySolutionData;

/**
 * Topic status changed event data
 */
export interface TopicStatusChangedData {
  topic_id: TopicId;
  category_id: CategoryId;
  status: number; // New status bit flags
  is_locked?: boolean;
  is_pinned?: boolean;
  is_solved?: boolean;
  is_archived?: boolean;
  moderator_id: UserId;
  moderator_username?: string;
}

/**
 * Topic created event data
 */
export interface TopicCreatedData {
  topic_id: TopicId;
  category_id: CategoryId;
  title: string;
  author_id: UserId;
  author_username?: string;
}

/**
 * Topic updated event data
 */
export interface TopicUpdatedData {
  topic_id: TopicId;
  category_id: CategoryId;
  title?: string;
  editor_id: UserId;
  editor_username?: string;
}

/**
 * Topic deleted event data
 */
export interface TopicDeletedData {
  topic_id: TopicId;
  category_id: CategoryId;
  moderator_id: UserId;
  moderator_username?: string;
}

/**
 * Reply created event data
 */
export interface ReplyCreatedData {
  reply_id: ReplyId;
  topic_id: TopicId;
  author_id: UserId;
  author_username?: string;
  parent_id?: ReplyId;
}

/**
 * Reply updated event data
 */
export interface ReplyUpdatedData {
  reply_id: ReplyId;
  topic_id: TopicId;
  editor_id: UserId;
  editor_username?: string;
}

/**
 * Reply deleted event data
 */
export interface ReplyDeletedData {
  reply_id: ReplyId;
  topic_id: TopicId;
  moderator_id: UserId;
  moderator_username?: string;
}

/**
 * Reply marked as solution event data
 */
export interface ReplySolutionData {
  reply_id: ReplyId;
  topic_id: TopicId;
  is_solution: boolean;
  marked_by: UserId;
  marked_by_username?: string;
}

// ============================================================================
// Event Broadcaster
// ============================================================================

/**
 * SSE client connection
 */
interface SSEClient {
  id: string;
  response: any; // Next.js response object
  categoryFilter?: CategoryId; // Optional filter to only receive events for specific category
  topicFilter?: TopicId; // Optional filter to only receive events for specific topic
}

/**
 * Forum Event Broadcaster
 *
 * Manages SSE connections and broadcasts events to all connected clients.
 * Supports filtering by category or topic.
 */
export class ForumEventBroadcaster {
  private clients: Map<string, SSEClient> = new Map();
  private eventHistory: ForumEvent[] = []; // Last 50 events for reconnecting clients
  private readonly MAX_HISTORY = 50;

  /**
   * Add a new SSE client connection
   */
  addClient(client: SSEClient): void {
    this.clients.set(client.id, client);
    logger.info(`[SSE] Client connected: ${client.id} (total: ${this.clients.size})`);

    // Send connection confirmation with dummy TopicCreatedData
    const dummyData: TopicCreatedData = {
      topic_id: 0,
      category_id: 0,
      title: '',
      author_id: 0,
    };

    this.sendToClient(
      client.id,
      {
        id: this.generateEventId(),
        type: 'topic:created', // Dummy type, client should ignore
        timestamp: Date.now(),
        data: dummyData,
      },
      'connected'
    );
  }

  /**
   * Remove a client connection
   */
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
    logger.info(`[SSE] Client disconnected: ${clientId} (total: ${this.clients.size})`);
  }

  /**
   * Broadcast an event to all relevant clients
   */
  broadcast(event: ForumEvent): void {
    logger.info(`[SSE] Broadcasting event: ${event.type} (clients: ${this.clients.size})`);

    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.MAX_HISTORY) {
      this.eventHistory.shift();
    }

    // Send to all matching clients
    for (const [clientId, client] of this.clients.entries()) {
      if (this.shouldSendToClient(client, event)) {
        this.sendToClient(clientId, event);
      }
    }
  }

  /**
   * Send an event to a specific client
   */
  private sendToClient(clientId: string, event: ForumEvent, eventType: string = 'message'): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      // SSE format: event: <type>\ndata: <json>\n\n
      const sseData = `event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`;
      client.response.write(sseData);
    } catch (error) {
      logger.error(`[SSE] Error sending to client ${clientId}:`, error);
      this.removeClient(clientId);
    }
  }

  /**
   * Check if an event should be sent to a client based on filters
   */
  private shouldSendToClient(client: SSEClient, event: ForumEvent): boolean {
    // No filters = send all events
    if (!client.categoryFilter && !client.topicFilter) {
      return true;
    }

    // Topic filter takes precedence
    if (client.topicFilter) {
      const topicId = this.getTopicIdFromEvent(event);
      return topicId === client.topicFilter;
    }

    // Category filter
    if (client.categoryFilter) {
      const categoryId = this.getCategoryIdFromEvent(event);
      return categoryId === client.categoryFilter;
    }

    return true;
  }

  /**
   * Extract topic ID from event data
   */
  private getTopicIdFromEvent(event: ForumEvent): TopicId | null {
    const data = event.data;
    // Type guard: check if data has topic_id property
    if ('topic_id' in data && typeof data.topic_id === 'number') {
      return data.topic_id;
    }
    return null;
  }

  /**
   * Extract category ID from event data
   */
  private getCategoryIdFromEvent(event: ForumEvent): CategoryId | null {
    const data = event.data;
    // Type guard: check if data has category_id property
    if ('category_id' in data && typeof data.category_id === 'number') {
      return data.category_id;
    }
    return null;
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get event history since a specific timestamp
   */
  getEventsSince(timestamp: number): ForumEvent[] {
    return this.eventHistory.filter(event => event.timestamp > timestamp);
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global event broadcaster instance
 * Shared across all API routes and services
 */
export const forumEventBroadcaster = new ForumEventBroadcaster();

// ============================================================================
// Event Builder Helpers
// ============================================================================

/**
 * Create a topic status changed event
 */
export function createTopicStatusEvent(
  type: ForumEventType,
  data: TopicStatusChangedData
): ForumEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    timestamp: Date.now(),
    data,
  };
}

/**
 * Create a topic created event
 */
export function createTopicCreatedEvent(data: TopicCreatedData): ForumEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'topic:created',
    timestamp: Date.now(),
    data,
  };
}

/**
 * Create a reply created event
 */
export function createReplyCreatedEvent(data: ReplyCreatedData): ForumEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'reply:created',
    timestamp: Date.now(),
    data,
  };
}
