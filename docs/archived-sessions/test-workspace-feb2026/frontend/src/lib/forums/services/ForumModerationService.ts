/**
 * ForumModerationService - Moderation features for forums
 *
 * Provides moderation functionality including:
 * - Pin/unpin topics
 * - Lock/unlock topics
 * - Mark topics as solved
 * - Delete topics/replies (with cascade)
 * - Permission validation for moderator actions
 *
 * Architecture:
 * - All operations require moderator or admin permissions
 * - Logs all moderation actions for audit trail
 * - Validates permissions before executing operations
 * - Uses repository layer for data access
 *
 * @module lib/forums/services/ForumModerationService
 */

import { Result, Ok, Err } from '@/lib/utils/result';
import { authService } from '@/lib/auth/service';
import { repositories } from '../repositories';
import { TopicStatusFlags, addFlag, removeFlag, hasFlag } from '../status-flags';
import { forumEventBroadcaster, createTopicStatusEvent } from '../events';
import type { ForumTopic, ForumReply, TopicId, ReplyId, UserId, ModerationAction } from '../types';
import { logger } from '@/lib/utils/logger';

// Service error type (discriminated union of error objects)
type ServiceError =
  | { type: 'not_found'; entity: string; id: number | string }
  | { type: 'database'; operation: string; message: string }
  | { type: 'validation'; field: string; message: string }
  | { type: 'forbidden'; reason: string };

// ============================================================================
// ForumModerationService Class
// ============================================================================

export class ForumModerationService {
  // ==========================================================================
  // Topic Moderation
  // ==========================================================================

  /**
   * Pin a topic to the top of its category
   *
   * @param topicId - Topic ID
   * @param userId - Moderator user ID
   * @returns Result with updated topic or error
   */
  async pinTopic(topicId: TopicId, userId: UserId): Promise<Result<ForumTopic, ServiceError>> {
    try {
      // Check moderator permissions
      const hasPermission = await this.checkModeratorPermission(userId);
      if (!hasPermission) {
        return Err({
          type: 'forbidden',
          reason: 'Moderator or admin access required',
        });
      }

      // Get existing topic
      const topicResult = await repositories.topics.findById(topicId);
      if (topicResult.isErr()) {
        const err = topicResult.error;
        return Err({
          type: 'database',
          operation: 'pin_topic',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      const topic = topicResult.value;
      if (!topic) {
        return Err({
          type: 'not_found',
          entity: 'topic',
          id: topicId,
        });
      }

      // Already pinned?
      if (topic.is_pinned) {
        return Ok(topic);
      }

      // Add PINNED bit flag
      const newStatus = addFlag(topic.status, TopicStatusFlags.PINNED);

      // Update topic
      const updateResult = await repositories.topics.update(topicId, {
        status: newStatus,
      });

      if (updateResult.isErr()) {
        const err = updateResult.error;
        return Err({
          type: 'database',
          operation: 'pin_topic',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      // Log moderation action
      this.logModerationAction(userId, 'pin', 'topic', topicId.toString(), {
        topic_title: topic.title,
      });

      // Broadcast real-time event
      forumEventBroadcaster.broadcast(
        createTopicStatusEvent('topic:pinned', {
          topic_id: topicId,
          category_id: topic.category_id,
          status: updateResult.value.status,
          is_pinned: hasFlag(updateResult.value.status, TopicStatusFlags.PINNED),
          is_locked: hasFlag(updateResult.value.status, TopicStatusFlags.LOCKED),
          is_solved: hasFlag(updateResult.value.status, TopicStatusFlags.SOLVED),
          is_archived: hasFlag(updateResult.value.status, TopicStatusFlags.ARCHIVED),
          moderator_id: userId,
        })
      );

      return Ok(updateResult.value);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'pin_topic',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Unpin a topic
   *
   * @param topicId - Topic ID
   * @param userId - Moderator user ID
   * @returns Result with updated topic or error
   */
  async unpinTopic(topicId: TopicId, userId: UserId): Promise<Result<ForumTopic, ServiceError>> {
    try {
      // Check moderator permissions
      const hasPermission = await this.checkModeratorPermission(userId);
      if (!hasPermission) {
        return Err({
          type: 'forbidden',
          reason: 'Moderator or admin access required',
        });
      }

      // Get existing topic
      const topicResult = await repositories.topics.findById(topicId);
      if (topicResult.isErr()) {
        const err = topicResult.error;
        return Err({
          type: 'database',
          operation: 'unpin_topic',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      const topic = topicResult.value;
      if (!topic) {
        return Err({
          type: 'not_found',
          entity: 'topic',
          id: topicId,
        });
      }

      // Already unpinned?
      if (!topic.is_pinned) {
        return Ok(topic);
      }

      // Remove PINNED bit flag
      const newStatus = removeFlag(topic.status, TopicStatusFlags.PINNED);

      // Update topic
      const updateResult = await repositories.topics.update(topicId, {
        status: newStatus,
      });

      if (updateResult.isErr()) {
        const err = updateResult.error;
        return Err({
          type: 'database',
          operation: 'unpin_topic',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      // Log moderation action
      this.logModerationAction(userId, 'unpin', 'topic', topicId.toString(), {
        topic_title: topic.title,
      });

      // Broadcast real-time event
      forumEventBroadcaster.broadcast(
        createTopicStatusEvent('topic:unpinned', {
          topic_id: topicId,
          category_id: topic.category_id,
          status: updateResult.value.status,
          is_pinned: hasFlag(updateResult.value.status, TopicStatusFlags.PINNED),
          is_locked: hasFlag(updateResult.value.status, TopicStatusFlags.LOCKED),
          is_solved: hasFlag(updateResult.value.status, TopicStatusFlags.SOLVED),
          is_archived: hasFlag(updateResult.value.status, TopicStatusFlags.ARCHIVED),
          moderator_id: userId,
        })
      );

      return Ok(updateResult.value);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'unpin_topic',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Lock a topic (prevent new replies)
   *
   * @param topicId - Topic ID
   * @param userId - Moderator user ID
   * @returns Result with updated topic or error
   */
  async lockTopic(topicId: TopicId, userId: UserId): Promise<Result<ForumTopic, ServiceError>> {
    try {
      // Check moderator permissions
      const hasPermission = await this.checkModeratorPermission(userId);
      if (!hasPermission) {
        return Err({
          type: 'forbidden',
          reason: 'Moderator or admin access required',
        });
      }

      // Get existing topic
      const topicResult = await repositories.topics.findById(topicId);
      if (topicResult.isErr()) {
        const err = topicResult.error;
        return Err({
          type: 'database',
          operation: 'lock_topic',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      const topic = topicResult.value;
      if (!topic) {
        return Err({
          type: 'not_found',
          entity: 'topic',
          id: topicId,
        });
      }

      // Already locked?
      if (topic.is_locked) {
        return Ok(topic);
      }

      // Add LOCKED bit flag
      const newStatus = addFlag(topic.status, TopicStatusFlags.LOCKED);

      // Update topic
      const updateResult = await repositories.topics.update(topicId, {
        status: newStatus,
      });

      if (updateResult.isErr()) {
        const err = updateResult.error;
        return Err({
          type: 'database',
          operation: 'lock_topic',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      // Log moderation action
      this.logModerationAction(userId, 'lock', 'topic', topicId.toString(), {
        topic_title: topic.title,
      });

      // Broadcast real-time event
      forumEventBroadcaster.broadcast(
        createTopicStatusEvent('topic:locked', {
          topic_id: topicId,
          category_id: topic.category_id,
          status: updateResult.value.status,
          is_pinned: hasFlag(updateResult.value.status, TopicStatusFlags.PINNED),
          is_locked: hasFlag(updateResult.value.status, TopicStatusFlags.LOCKED),
          is_solved: hasFlag(updateResult.value.status, TopicStatusFlags.SOLVED),
          is_archived: hasFlag(updateResult.value.status, TopicStatusFlags.ARCHIVED),
          moderator_id: userId,
        })
      );

      return Ok(updateResult.value);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'lock_topic',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Unlock a topic (allow new replies)
   *
   * @param topicId - Topic ID
   * @param userId - Moderator user ID
   * @returns Result with updated topic or error
   */
  async unlockTopic(topicId: TopicId, userId: UserId): Promise<Result<ForumTopic, ServiceError>> {
    try {
      // Check moderator permissions
      const hasPermission = await this.checkModeratorPermission(userId);
      if (!hasPermission) {
        return Err({
          type: 'forbidden',
          reason: 'Moderator or admin access required',
        });
      }

      // Get existing topic
      const topicResult = await repositories.topics.findById(topicId);
      if (topicResult.isErr()) {
        const err = topicResult.error;
        return Err({
          type: 'database',
          operation: 'unlock_topic',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      const topic = topicResult.value;
      if (!topic) {
        return Err({
          type: 'not_found',
          entity: 'topic',
          id: topicId,
        });
      }

      // Already unlocked?
      if (!topic.is_locked) {
        return Ok(topic);
      }

      // Remove LOCKED bit flag
      const newStatus = removeFlag(topic.status, TopicStatusFlags.LOCKED);

      // Update topic
      const updateResult = await repositories.topics.update(topicId, {
        status: newStatus,
      });

      if (updateResult.isErr()) {
        const err = updateResult.error;
        return Err({
          type: 'database',
          operation: 'unlock_topic',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      // Log moderation action
      this.logModerationAction(userId, 'unlock', 'topic', topicId.toString(), {
        topic_title: topic.title,
      });

      // Broadcast real-time event
      forumEventBroadcaster.broadcast(
        createTopicStatusEvent('topic:unlocked', {
          topic_id: topicId,
          category_id: topic.category_id,
          status: updateResult.value.status,
          is_pinned: hasFlag(updateResult.value.status, TopicStatusFlags.PINNED),
          is_locked: hasFlag(updateResult.value.status, TopicStatusFlags.LOCKED),
          is_solved: hasFlag(updateResult.value.status, TopicStatusFlags.SOLVED),
          is_archived: hasFlag(updateResult.value.status, TopicStatusFlags.ARCHIVED),
          moderator_id: userId,
        })
      );

      return Ok(updateResult.value);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'unlock_topic',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Mark topic as solved
   *
   * @param topicId - Topic ID
   * @param userId - User ID (topic author or moderator)
   * @returns Result with updated topic or error
   */
  async markTopicAsSolved(
    topicId: TopicId,
    userId: UserId
  ): Promise<Result<ForumTopic, ServiceError>> {
    try {
      // Get existing topic
      const topicResult = await repositories.topics.findById(topicId);
      if (topicResult.isErr()) {
        const err = topicResult.error;
        return Err({
          type: 'database',
          operation: 'mark_solved',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      const topic = topicResult.value;
      if (!topic) {
        return Err({
          type: 'not_found',
          entity: 'topic',
          id: topicId,
        });
      }

      // Check permissions (topic author or moderator)
      const isModerator = await this.checkModeratorPermission(userId);
      const isAuthor = topic.user_id === userId;

      if (!isModerator && !isAuthor) {
        return Err({
          type: 'forbidden',
          reason: 'Only topic author or moderators can mark topic as solved',
        });
      }

      // Already solved?
      if (topic.is_solved) {
        return Ok(topic);
      }

      // Add SOLVED bit flag
      const newStatus = addFlag(topic.status, TopicStatusFlags.SOLVED);

      // Update topic
      const updateResult = await repositories.topics.update(topicId, {
        status: newStatus,
      });

      if (updateResult.isErr()) {
        const err = updateResult.error;
        return Err({
          type: 'database',
          operation: 'mark_solved',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      // Log moderation action
      this.logModerationAction(userId, 'mark_solved', 'topic', topicId.toString(), {
        topic_title: topic.title,
      });

      // Broadcast real-time event
      forumEventBroadcaster.broadcast(
        createTopicStatusEvent('topic:solved', {
          topic_id: topicId,
          category_id: topic.category_id,
          status: updateResult.value.status,
          is_pinned: hasFlag(updateResult.value.status, TopicStatusFlags.PINNED),
          is_locked: hasFlag(updateResult.value.status, TopicStatusFlags.LOCKED),
          is_solved: hasFlag(updateResult.value.status, TopicStatusFlags.SOLVED),
          is_archived: hasFlag(updateResult.value.status, TopicStatusFlags.ARCHIVED),
          moderator_id: userId,
        })
      );

      return Ok(updateResult.value);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'mark_solved',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Unmark topic as solved (remove solved status)
   *
   * @param topicId - Topic ID
   * @param userId - User ID (topic author or moderator)
   * @returns Result with updated topic or error
   */
  async unmarkTopicAsSolved(
    topicId: TopicId,
    userId: UserId
  ): Promise<Result<ForumTopic, ServiceError>> {
    try {
      // Get existing topic
      const topicResult = await repositories.topics.findById(topicId);
      if (topicResult.isErr()) {
        const err = topicResult.error;
        return Err({
          type: 'database',
          operation: 'unmark_solved',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      const topic = topicResult.value;
      if (!topic) {
        return Err({
          type: 'not_found',
          entity: 'topic',
          id: topicId,
        });
      }

      // Check permissions (topic author or moderator)
      const isModerator = await this.checkModeratorPermission(userId);
      const isAuthor = topic.user_id === userId;

      if (!isModerator && !isAuthor) {
        return Err({
          type: 'forbidden',
          reason: 'Only topic author or moderators can unmark topic as solved',
        });
      }

      // Not solved?
      if (!topic.is_solved) {
        return Ok(topic);
      }

      // Remove SOLVED bit flag
      const newStatus = removeFlag(topic.status, TopicStatusFlags.SOLVED);

      // Update topic
      const updateResult = await repositories.topics.update(topicId, {
        status: newStatus,
      });

      if (updateResult.isErr()) {
        const err = updateResult.error;
        return Err({
          type: 'database',
          operation: 'unmark_solved',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      // Log moderation action
      this.logModerationAction(userId, 'unmark_solved', 'topic', topicId.toString(), {
        topic_title: topic.title,
      });

      // Broadcast real-time event
      forumEventBroadcaster.broadcast(
        createTopicStatusEvent('topic:unsolved', {
          topic_id: topicId,
          category_id: topic.category_id,
          status: updateResult.value.status,
          is_pinned: hasFlag(updateResult.value.status, TopicStatusFlags.PINNED),
          is_locked: hasFlag(updateResult.value.status, TopicStatusFlags.LOCKED),
          is_solved: hasFlag(updateResult.value.status, TopicStatusFlags.SOLVED),
          is_archived: hasFlag(updateResult.value.status, TopicStatusFlags.ARCHIVED),
          moderator_id: userId,
        })
      );

      return Ok(updateResult.value);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'unmark_solved',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Mark reply as solution to a topic
   *
   * @param replyId - Reply ID
   * @param topicId - Topic ID
   * @param userId - User ID (topic author or moderator)
   * @returns Result with updated reply or error
   */
  async markReplyAsSolution(
    replyId: ReplyId,
    topicId: TopicId,
    userId: UserId
  ): Promise<Result<ForumReply, ServiceError>> {
    try {
      // Get existing topic
      const topicResult = await repositories.topics.findById(topicId);
      if (topicResult.isErr()) {
        const err = topicResult.error;
        return Err({
          type: 'database',
          operation: 'mark_solution',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      const topic = topicResult.value;
      if (!topic) {
        return Err({
          type: 'not_found',
          entity: 'topic',
          id: topicId,
        });
      }

      // Check permissions (topic author or moderator)
      const isModerator = await this.checkModeratorPermission(userId);
      const isAuthor = topic.user_id === userId;

      if (!isModerator && !isAuthor) {
        return Err({
          type: 'forbidden',
          reason: 'Only topic author or moderators can mark solutions',
        });
      }

      // Get existing reply
      const replyResult = await repositories.replies.findById(replyId);
      if (replyResult.isErr()) {
        const err = replyResult.error;
        return Err({
          type: 'database',
          operation: 'mark_solution',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      const reply = replyResult.value;
      if (!reply) {
        return Err({
          type: 'not_found',
          entity: 'reply',
          id: replyId,
        });
      }

      // Verify reply belongs to topic
      if (reply.topic_id !== topicId) {
        return Err({
          type: 'validation',
          field: 'reply_id',
          message: 'Reply does not belong to specified topic',
        });
      }

      // Check for existing solution and unmark it before marking new one
      // This prevents multiple solutions on the same topic (Bug #3 fix)
      const existingSolutionResult = await repositories.replies.findByTopic(topicId);
      if (existingSolutionResult.isOk() && existingSolutionResult.value) {
        const existingSolution = existingSolutionResult.value.find(
          r => r.is_solution && r.id !== replyId
        );
        if (existingSolution) {
          // Unmark previous solution
          await repositories.replies.update(existingSolution.id, {
            is_solution: false,
          });
          logger.info(
            `Unmarked previous solution (reply ${existingSolution.id}) for topic ${topicId}`
          );
        }
      }

      // Update reply
      const updateResult = await repositories.replies.update(replyId, {
        is_solution: true,
      });

      if (updateResult.isErr()) {
        const err = updateResult.error;
        return Err({
          type: 'database',
          operation: 'mark_solution',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      // Mark topic as solved by adding SOLVED flag
      const topicStatusResult = await repositories.topics.findById(topicId);
      if (topicStatusResult.isOk() && topicStatusResult.value) {
        const currentTopic = topicStatusResult.value;
        const newStatus = addFlag(currentTopic.status, TopicStatusFlags.SOLVED);
        await repositories.topics.update(topicId, {
          status: newStatus,
        });
      }

      // Log moderation action
      this.logModerationAction(userId, 'mark_solution', 'reply', replyId.toString(), {
        topic_id: topicId,
        reply_author: reply.user_id,
      });

      return Ok(updateResult.value);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'mark_solution',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Unmark reply as solution to a topic
   *
   * @param replyId - Reply ID
   * @param topicId - Topic ID
   * @param userId - User ID (topic author or moderator)
   * @returns Result with updated reply or error
   */
  async unmarkReplyAsSolution(
    replyId: ReplyId,
    topicId: TopicId,
    userId: UserId
  ): Promise<Result<ForumReply, ServiceError>> {
    try {
      // Get existing topic
      const topicResult = await repositories.topics.findById(topicId);
      if (topicResult.isErr()) {
        const err = topicResult.error;
        return Err({
          type: 'database',
          operation: 'unmark_solution',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      const topic = topicResult.value;
      if (!topic) {
        return Err({
          type: 'not_found',
          entity: 'topic',
          id: topicId,
        });
      }

      // Check permissions (topic author or moderator)
      const isModerator = await this.checkModeratorPermission(userId);
      const isAuthor = topic.user_id === userId;

      if (!isModerator && !isAuthor) {
        return Err({
          type: 'forbidden',
          reason: 'Only topic author or moderators can unmark solutions',
        });
      }

      // Get existing reply
      const replyResult = await repositories.replies.findById(replyId);
      if (replyResult.isErr()) {
        const err = replyResult.error;
        return Err({
          type: 'database',
          operation: 'unmark_solution',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      const reply = replyResult.value;
      if (!reply) {
        return Err({
          type: 'not_found',
          entity: 'reply',
          id: replyId,
        });
      }

      // Verify reply belongs to topic
      if (reply.topic_id !== topicId) {
        return Err({
          type: 'validation',
          field: 'reply_id',
          message: 'Reply does not belong to specified topic',
        });
      }

      // Update reply
      const updateResult = await repositories.replies.update(replyId, {
        is_solution: false,
      });

      if (updateResult.isErr()) {
        const err = updateResult.error;
        return Err({
          type: 'database',
          operation: 'unmark_solution',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      // Unmark topic as solved by removing SOLVED flag
      const topicStatusResult = await repositories.topics.findById(topicId);
      if (topicStatusResult.isOk() && topicStatusResult.value) {
        const currentTopic = topicStatusResult.value;
        const newStatus = removeFlag(currentTopic.status, TopicStatusFlags.SOLVED);
        await repositories.topics.update(topicId, {
          status: newStatus,
        });
      }

      // Log moderation action
      this.logModerationAction(userId, 'unmark_solution', 'reply', replyId.toString(), {
        topic_id: topicId,
        reply_author: reply.user_id,
      });

      return Ok(updateResult.value);
    } catch (error) {
      return Err({
        type: 'database',
        operation: 'unmark_solution',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete a topic (moderator action with cascade)
   *
   * @param topicId - Topic ID
   * @param userId - Moderator user ID
   * @param reason - Deletion reason
   * @returns Result with success or error
   */
  async deleteTopic(
    topicId: TopicId,
    userId: UserId,
    reason?: string
  ): Promise<Result<void, ServiceError>> {
    try {
      // Check moderator permissions
      const hasPermission = await this.checkModeratorPermission(userId);
      if (!hasPermission) {
        return Err({
          type: 'forbidden',
          reason: 'Moderator or admin access required',
        });
      }

      // Get existing topic
      const topicResult = await repositories.topics.findById(topicId);
      if (topicResult.isErr()) {
        const err = topicResult.error;
        return Err({
          type: 'database',
          operation: 'delete_topic',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      const topic = topicResult.value;
      if (!topic) {
        return Err({
          type: 'not_found',
          entity: 'topic',
          id: topicId,
        });
      }

      // Delete topic (cascades to replies, tags)
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

      // Log moderation action
      this.logModerationAction(userId, 'delete', 'topic', topicId.toString(), {
        topic_title: topic.title,
        topic_author: topic.user_id,
        reason: reason || 'No reason provided',
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
   * Delete a reply (moderator action with cascade)
   *
   * @param replyId - Reply ID
   * @param userId - Moderator user ID
   * @param reason - Deletion reason
   * @returns Result with success or error
   */
  async deleteReply(
    replyId: ReplyId,
    userId: UserId,
    reason?: string
  ): Promise<Result<void, ServiceError>> {
    try {
      // Check moderator permissions
      const hasPermission = await this.checkModeratorPermission(userId);
      if (!hasPermission) {
        return Err({
          type: 'forbidden',
          reason: 'Moderator or admin access required',
        });
      }

      // Get existing reply
      const replyResult = await repositories.replies.findById(replyId);
      if (replyResult.isErr()) {
        const err = replyResult.error;
        return Err({
          type: 'database',
          operation: 'delete_reply',
          message: err.type === 'database' ? err.message : `Repository error: ${err.type}`,
        });
      }

      const reply = replyResult.value;
      if (!reply) {
        return Err({
          type: 'not_found',
          entity: 'reply',
          id: replyId,
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

      // Log moderation action
      this.logModerationAction(userId, 'delete', 'reply', replyId.toString(), {
        topic_id: reply.topic_id,
        reply_author: reply.user_id,
        reason: reason || 'No reason provided',
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
  // Permission Validation
  // ==========================================================================

  /**
   * Check if user has moderator or admin permissions
   *
   * @param userId - User ID
   * @returns True if user is moderator or admin
   */
  private async checkModeratorPermission(userId: UserId): Promise<boolean> {
    const user = await authService.getUserById(userId);
    if (!user) return false;
    return user.role === 'moderator' || user.role === 'admin';
  }

  /**
   * Check if user has admin permissions
   *
   * @param userId - User ID
   * @returns True if user is admin
   */
  private async checkAdminPermission(userId: UserId): Promise<boolean> {
    const user = await authService.getUserById(userId);
    if (!user) return false;
    return user.role === 'admin';
  }

  // ==========================================================================
  // Activity Logging
  // ==========================================================================

  /**
   * Log moderation action to unified_activity table
   *
   * @param userId - Moderator user ID
   * @param action - Moderation action
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @param metadata - Optional metadata
   */
  private logModerationAction(
    userId: number,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: any
  ): void {
    try {
      const service = authService as unknown as { logActivity?: (...args: any[]) => void };
      const logMethod = service.logActivity;
      if (logMethod) {
        logMethod.call(
          authService,
          userId,
          'forum_moderation',
          entityType,
          entityId,
          action,
          metadata
        );
      }
    } catch (error) {
      logger.error('Failed to log moderation action:', error);
    }
  }
}

// Export singleton instance
export const forumModerationService = new ForumModerationService();
