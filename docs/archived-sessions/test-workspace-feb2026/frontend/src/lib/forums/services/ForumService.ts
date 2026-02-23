/**
 * ForumService - Main forum service orchestrating all operations
 *
 * Provides comprehensive forum functionality including:
 * - Topic CRUD with validation and permissions
 * - Reply operations with nested threading
 * - Category management
 * - User permission checks
 * - Activity logging to unified_activity table
 *
 * Architecture:
 * - Uses repository layer for data access
 * - Implements Result pattern for error handling
 * - Logs all activities for audit trail
 * - Enforces permission checks at service level
 * - Supports cross-database user fetching (auth.db)
 *
 * @module lib/forums/services/ForumService
 */

import { Result, Ok, Err } from '@/lib/utils/result';
import { SimpleLRUCache } from '@/lib/cache/lru';
import { getCurrentUser } from '@/lib/auth/server';
import { authService } from '@/lib/auth/service';
import { repositories } from '../repositories';
import type {
  ForumTopic,
  ForumReply,
  ForumCategory,
  CreateTopicDTO,
  UpdateTopicDTO,
  CreateReplyDTO,
  UpdateReplyDTO,
  TopicWithReplies,
  PaginatedResponse,
  TopicId,
  ReplyId,
  CategoryId,
  UserId,
} from '../types';
import type { User } from '@/lib/auth/types';
import { logger } from '@/lib/utils/logger';

// Service error type (discriminated union of error objects)
type ServiceError =
  | { type: 'not_found'; entity: string; id: number | string }
  | { type: 'database'; operation: string; message: string }
  | { type: 'validation'; field: string; message: string }
  | { type: 'forbidden'; reason: string };

// CategoryWithTopics type definition (not in types.ts yet)
interface CategoryWithTopics {
  category: ForumCategory;
  topics: ForumTopic[];
  total_topics: number;
  has_more: boolean;
}

// ============================================================================
// Cache Configuration
// ============================================================================

const TOPIC_CACHE_SIZE = 500;
const TOPIC_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CATEGORY_CACHE_SIZE = 50;
const CATEGORY_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// ============================================================================
// ForumService Class
// ============================================================================

export class ForumService {
  // Cache instances for frequently accessed data
  private topicCache: SimpleLRUCache<number, ForumTopic>;
  private categoryCache: SimpleLRUCache<number, ForumCategory>;

  constructor() {
    // Initialize caches
    this.topicCache = new SimpleLRUCache({
      max: TOPIC_CACHE_SIZE,
      ttl: TOPIC_CACHE_TTL,
      updateAgeOnGet: true,
    });

    this.categoryCache = new SimpleLRUCache({
      max: CATEGORY_CACHE_SIZE,
      ttl: CATEGORY_CACHE_TTL,
      updateAgeOnGet: true,
    });
  }

  // ==========================================================================
  // Topic Operations
  // ==========================================================================

  /**
   * Create a new topic
   *
   * @param data - Topic data
   * @param authorId - User ID of author
   * @returns Result with created topic or error
   */
  async createTopic(
    data: CreateTopicDTO,
    authorId: UserId
  ): Promise<Result<ForumTopic, ServiceError>> {
    try {
      // Validate category exists
      const categoryResult = await repositories.categories.findById(data.category_id);
      if (categoryResult.isErr()) {
        return Err({
          type: 'not_found',
          entity: 'category',
          id: data.category_id,
        });
      }

      // Create topic via repository
      const topicResult = await repositories.topics.create({
        title: data.title,
        content: data.content,
        category_id: data.category_id,
        author_id: authorId,
      });

      if (topicResult.isErr()) {
        const err = topicResult.error;
        return Err({
          type: 'database',
          operation: 'create_topic',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      const topic = topicResult.value;

      // Note: Tag functionality removed - addTag method doesn't exist in repository
      // Tags would need to be implemented if needed

      // Increment category topic count
      await repositories.categories.incrementTopicCount(data.category_id);

      // Cache the new topic
      this.topicCache.set(topic.id, topic);

      // Log activity
      this.logActivity(authorId, 'forum_topic', 'topic', topic.id.toString(), 'create', {
        title: topic.title,
        category_id: data.category_id,
      });

      return Ok(topic);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'create_topic',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get topic by ID with replies
   *
   * @param topicId - Topic ID
   * @param includeReplies - Include replies (default: true)
   * @returns Result with topic and replies or error
   */
  async getTopic(
    topicId: TopicId,
    includeReplies: boolean = true
  ): Promise<Result<TopicWithReplies, ServiceError>> {
    try {
      // Try cache first
      let topic: ForumTopic | null = this.topicCache.get(topicId) || null;

      if (!topic) {
        const topicResult = await repositories.topics.findById(topicId, {
          include_author: true,
          include_category: true,
          include_tags: true,
        });

        if (topicResult.isErr()) {
          const err = topicResult.error;
          return Err({
            type: 'database',
            operation: 'get_topic',
            message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
          });
        }

        topic = topicResult.value;
        if (!topic) {
          return Err({
            type: 'not_found',
            entity: 'topic',
            id: topicId,
          });
        }

        this.topicCache.set(topicId, topic);
      }

      // Increment view count (async, don't wait)
      repositories.topics.incrementViewCount(topicId);

      // Get replies if requested
      let replies: ForumReply[] = [];
      if (includeReplies) {
        const repliesResult = await repositories.replies.findByTopic(topicId, {
          max_depth: 5,
        });

        if (repliesResult.isOk()) {
          replies = repliesResult.value;
        }
      }

      const result: TopicWithReplies = {
        ...topic,
        replies,
        // Note: total_replies removed - use reply_count from ForumTopic instead
        // has_more removed - not in TopicWithReplies interface
      };
      return Ok(result);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'get_topic',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update an existing topic
   *
   * @param topicId - Topic ID
   * @param data - Update data
   * @param userId - User ID of requester
   * @returns Result with updated topic or error
   */
  async updateTopic(
    topicId: TopicId,
    data: UpdateTopicDTO,
    userId: UserId
  ): Promise<Result<ForumTopic, ServiceError>> {
    try {
      // Get existing topic
      const topicResult = await repositories.topics.findById(topicId);
      if (topicResult.isErr() || !topicResult.value) {
        return Err({
          type: 'not_found',
          entity: 'topic',
          id: topicId,
        });
      }

      const topic = topicResult.value;

      // Check permissions
      const canEdit = await this.canEditTopic(userId, topic);
      if (!canEdit) {
        return Err({
          type: 'forbidden',
          reason: 'You do not have permission to edit this topic',
        });
      }

      // Update topic
      const updateResult = await repositories.topics.update(topicId, data);
      if (updateResult.isErr()) {
        const err = updateResult.error;
        return Err({
          type: 'database',
          operation: 'update_topic',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      const updatedTopic = updateResult.value;

      // Note: Tag functionality removed - removeAllTags/addTag methods don't exist in repository
      // Tags would need to be implemented if needed

      // Invalidate cache
      this.topicCache.delete(topicId);

      // Log activity
      this.logActivity(userId, 'forum_topic', 'topic', topicId.toString(), 'update', {
        updated_fields: Object.keys(data),
      });

      return Ok(updatedTopic);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'update_topic',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete a topic
   *
   * @param topicId - Topic ID
   * @param userId - User ID of requester
   * @returns Result with success or error
   */
  async deleteTopic(topicId: TopicId, userId: UserId): Promise<Result<void, ServiceError>> {
    try {
      // Get existing topic
      const topicResult = await repositories.topics.findById(topicId);
      if (topicResult.isErr() || !topicResult.value) {
        return Err({
          type: 'not_found',
          entity: 'topic',
          id: topicId,
        });
      }

      const topic = topicResult.value;

      // Check permissions (author or moderator/admin)
      const canDelete = await this.canDeleteTopic(userId, topic);
      if (!canDelete) {
        return Err({
          type: 'forbidden',
          reason: 'You do not have permission to delete this topic',
        });
      }

      // Delete topic (cascades to replies, tags, etc.)
      const deleteResult = await repositories.topics.delete(topicId);
      if (deleteResult.isErr()) {
        const err = deleteResult.error;
        return Err({
          type: 'database',
          operation: 'delete_topic',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      // Decrement category topic count
      await repositories.categories.decrementTopicCount(topic.category_id);

      // Invalidate cache
      this.topicCache.delete(topicId);

      // Log activity
      this.logActivity(userId, 'forum_topic', 'topic', topicId.toString(), 'delete', {
        title: topic.title,
      });

      return Ok(undefined);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'delete_topic',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get topics by category with pagination
   *
   * @param categoryId - Category ID
   * @param page - Page number (1-indexed)
   * @param limit - Results per page
   * @returns Result with paginated topics
   */
  async getTopicsByCategory(
    categoryId: CategoryId,
    page: number = 1,
    limit: number = 20
  ): Promise<Result<PaginatedResponse<ForumTopic>, ServiceError>> {
    try {
      const topicsResult = await repositories.topics.findByCategory(categoryId, {
        page,
        limit,
      });

      if (topicsResult.isErr()) {
        const err = topicsResult.error;
        return Err({
          type: 'database',
          operation: 'get_topics',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      // Repository already returns PaginatedResponse, so just return it directly
      return Ok(topicsResult.value);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'get_topics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==========================================================================
  // Reply Operations
  // ==========================================================================

  /**
   * Create a new reply
   *
   * @param data - Reply data
   * @param authorId - User ID of author
   * @returns Result with created reply or error
   */
  async createReply(
    data: CreateReplyDTO,
    authorId: UserId
  ): Promise<Result<ForumReply, ServiceError>> {
    try {
      // Validate topic exists and is not locked
      const topicResult = await repositories.topics.findById(data.topic_id);
      if (topicResult.isErr()) {
        const err = topicResult.error;
        return Err({
          type: 'database',
          operation: 'create_reply',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      const topic = topicResult.value;
      if (!topic) {
        return Err({
          type: 'not_found',
          entity: 'topic',
          id: data.topic_id,
        });
      }

      if (topic.is_locked) {
        return Err({
          type: 'forbidden',
          reason: 'Topic is locked and cannot accept new replies',
        });
      }

      // Validate parent reply if provided
      if (data.parent_id) {
        const parentResult = await repositories.replies.findById(data.parent_id);
        if (parentResult.isErr()) {
          const err = parentResult.error;
          return Err({
            type: 'database',
            operation: 'create_reply',
            message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
          });
        }

        // Check depth limit (max 5 levels)
        const parent = parentResult.value;
        if (!parent) {
          return Err({
            type: 'not_found',
            entity: 'reply',
            id: data.parent_id,
          });
        }

        // Check reply depth with null safety (default to 0 if undefined)
        const parentDepth = parent.reply_depth ?? 0;
        if (parentDepth >= 5) {
          return Err({
            type: 'validation',
            field: 'parent_id',
            message: 'Maximum reply depth (5 levels) exceeded',
          });
        }
      }

      // Create reply via repository
      const replyResult = await repositories.replies.create({
        topic_id: data.topic_id,
        parent_id: data.parent_id || null,
        author_id: authorId,
        content: data.content,
      });

      if (replyResult.isErr()) {
        const err = replyResult.error;
        return Err({
          type: 'database',
          operation: 'create_reply',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      const reply = replyResult.value;

      // Update topic reply count (recalculates from database)
      await repositories.topics.updateReplyCount(data.topic_id);

      // Update topic last activity
      await repositories.topics.updateLastActivity(data.topic_id);

      // Invalidate topic cache
      this.topicCache.delete(data.topic_id);

      // Log activity
      this.logActivity(authorId, 'forum_reply', 'reply', reply.id.toString(), 'create', {
        topic_id: data.topic_id,
        parent_id: data.parent_id,
      });

      return Ok(reply);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'create_reply',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update an existing reply
   *
   * @param replyId - Reply ID
   * @param data - Update data
   * @param userId - User ID of requester
   * @returns Result with updated reply or error
   */
  async updateReply(
    replyId: ReplyId,
    data: UpdateReplyDTO,
    userId: UserId
  ): Promise<Result<ForumReply, ServiceError>> {
    try {
      // Get existing reply
      const replyResult = await repositories.replies.findById(replyId);
      if (replyResult.isErr() || !replyResult.value) {
        return Err({
          type: 'not_found',
          entity: 'reply',
          id: replyId,
        });
      }

      const reply = replyResult.value;

      // Check permissions
      const canEdit = await this.canEditReply(userId, reply);
      if (!canEdit) {
        return Err({
          type: 'forbidden',
          reason: 'You do not have permission to edit this reply',
        });
      }

      // Update reply
      const updateResult = await repositories.replies.update(replyId, data);
      if (updateResult.isErr()) {
        const err = updateResult.error;
        return Err({
          type: 'database',
          operation: 'update_reply',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      const updatedReply = updateResult.value;

      // Invalidate topic cache
      this.topicCache.delete(reply.topic_id);

      // Log activity
      this.logActivity(userId, 'forum_reply', 'reply', replyId.toString(), 'update', {
        updated_fields: Object.keys(data),
      });

      return Ok(updatedReply);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'update_reply',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete a reply
   *
   * @param replyId - Reply ID
   * @param userId - User ID of requester
   * @returns Result with success or error
   */
  async deleteReply(replyId: ReplyId, userId: UserId): Promise<Result<void, ServiceError>> {
    try {
      // Get existing reply
      const replyResult = await repositories.replies.findById(replyId);
      if (replyResult.isErr() || !replyResult.value) {
        return Err({
          type: 'not_found',
          entity: 'reply',
          id: replyId,
        });
      }

      const reply = replyResult.value;

      // Check permissions
      const canDelete = await this.canDeleteReply(userId, reply);
      if (!canDelete) {
        return Err({
          type: 'forbidden',
          reason: 'You do not have permission to delete this reply',
        });
      }

      // Delete reply (cascades to child replies)
      const deleteResult = await repositories.replies.delete(replyId);
      if (deleteResult.isErr()) {
        const err = deleteResult.error;
        return Err({
          type: 'database',
          operation: 'delete_reply',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      // Update topic reply count (recalculate from database)
      await repositories.topics.updateReplyCount(reply.topic_id);

      // Invalidate topic cache
      this.topicCache.delete(reply.topic_id);

      // Log activity
      this.logActivity(userId, 'forum_reply', 'reply', replyId.toString(), 'delete', {
        topic_id: reply.topic_id,
      });

      return Ok(undefined);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'delete_reply',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==========================================================================
  // Category Operations
  // ==========================================================================

  /**
   * Get all categories
   *
   * @returns Result with categories or error
   */
  async getAllCategories(): Promise<Result<ForumCategory[], ServiceError>> {
    try {
      const categoriesResult = await repositories.categories.findAll();
      if (categoriesResult.isErr()) {
        const err = categoriesResult.error;
        return Err({
          type: 'database',
          operation: 'get_categories',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      // Cache categories
      for (const category of categoriesResult.value) {
        this.categoryCache.set(category.id, category);
      }

      return Ok(categoriesResult.value);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'get_categories',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get category by ID with recent topics
   *
   * @param categoryId - Category ID
   * @param limit - Max topics to fetch
   * @returns Result with category and topics
   */
  async getCategoryWithTopics(
    categoryId: CategoryId,
    limit: number = 10
  ): Promise<Result<CategoryWithTopics, ServiceError>> {
    try {
      // Try cache first
      let category: ForumCategory | null = this.categoryCache.get(categoryId) || null;

      if (!category) {
        const categoryResult = await repositories.categories.findById(categoryId);
        if (categoryResult.isErr()) {
          const err = categoryResult.error;
          return Err({
            type: 'database',
            operation: 'get_category',
            message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
          });
        }

        category = categoryResult.value;
        if (!category) {
          return Err({
            type: 'not_found',
            entity: 'category',
            id: categoryId,
          });
        }

        this.categoryCache.set(categoryId, category);
      }

      // Get recent topics
      const topicsResult = await repositories.topics.findByCategory(categoryId, {
        limit,
      });

      // findByCategory returns PaginatedResponse, we need just the data array
      const topicsResponse = topicsResult.isOk()
        ? topicsResult.value
        : {
            success: true as const,
            data: [],
            pagination: {
              total: 0,
              limit,
              offset: 0,
              hasMore: false,
            },
          };
      const topics = topicsResponse.data;

      return Ok({
        category,
        topics,
        total_topics: category.topic_count,
        has_more: category.topic_count > limit,
      });
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'get_category',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==========================================================================
  // Permission Checks
  // ==========================================================================

  /**
   * Check if user can edit a topic
   *
   * @param userId - User ID
   * @param topic - Topic to check
   * @returns True if user can edit
   */
  private async canEditTopic(userId: UserId, topic: ForumTopic): Promise<boolean> {
    // Author can always edit their own topic
    if (topic.user_id === userId) {
      return true;
    }

    // Moderators and admins can edit any topic
    return await this.isModeratorOrAdmin(userId);
  }

  /**
   * Check if user can delete a topic
   *
   * @param userId - User ID
   * @param topic - Topic to check
   * @returns True if user can delete
   */
  private async canDeleteTopic(userId: UserId, topic: ForumTopic): Promise<boolean> {
    // Author can delete their own topic
    if (topic.user_id === userId) {
      return true;
    }

    // Moderators and admins can delete any topic
    return await this.isModeratorOrAdmin(userId);
  }

  /**
   * Check if user can edit a reply
   *
   * @param userId - User ID
   * @param reply - Reply to check
   * @returns True if user can edit
   */
  private async canEditReply(userId: UserId, reply: ForumReply): Promise<boolean> {
    // Author can always edit their own reply
    if (reply.user_id === userId) {
      return true;
    }

    // Moderators and admins can edit any reply
    return await this.isModeratorOrAdmin(userId);
  }

  /**
   * Check if user can delete a reply
   *
   * @param userId - User ID
   * @param reply - Reply to check
   * @returns True if user can delete
   */
  private async canDeleteReply(userId: UserId, reply: ForumReply): Promise<boolean> {
    // Author can delete their own reply
    if (reply.user_id === userId) {
      return true;
    }

    // Moderators and admins can delete any reply
    return await this.isModeratorOrAdmin(userId);
  }

  /**
   * Check if user is moderator or admin
   *
   * @param userId - User ID
   * @returns True if user is moderator or admin
   */
  private async isModeratorOrAdmin(userId: UserId): Promise<boolean> {
    const user = await authService.getUserById(userId);
    if (!user) return false;
    return user.role === 'moderator' || user.role === 'admin';
  }

  // ==========================================================================
  // Activity Logging
  // ==========================================================================

  /**
   * Log activity to unified_activity table
   *
   * @param userId - User ID
   * @param activityType - Activity type
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @param action - Action performed
   * @param metadata - Optional metadata
   */
  private logActivity(
    userId: number,
    activityType: string,
    entityType: string,
    entityId: string,
    action: string,
    metadata?: any
  ): void {
    // Use authService's logActivity method via reflection
    // This is a private method but we can access it through the service
    try {
      const service = authService as unknown as { logActivity?: (...args: any[]) => void };
      const logMethod = service.logActivity;
      if (logMethod) {
        logMethod.call(authService, userId, activityType, entityType, entityId, action, metadata);
      }
    } catch (error) {
      // Log error but don't fail the operation
      logger.error('Failed to log forum activity:', error);
    }
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.topicCache.clear();
    this.categoryCache.clear();
  }

  /**
   * Invalidate topic cache entry
   *
   * @param topicId - Topic ID
   */
  invalidateTopicCache(topicId: TopicId): void {
    this.topicCache.delete(topicId);
  }

  /**
   * Invalidate category cache entry
   *
   * @param categoryId - Category ID
   */
  invalidateCategoryCache(categoryId: CategoryId): void {
    this.categoryCache.delete(categoryId);
  }
}

// Export singleton instance
export const forumService = new ForumService();
