/**
 * Permission Service
 *
 * Centralized service for permission checking with caching and audit logging.
 * Handles role-based permissions with contextual checks for ownership,
 * topic lock status, user bans, and category-level permissions.
 */

import { dbAdapter } from '@/lib/database/adapter';
import { cacheManager, type CacheKey } from '@/lib/cache/manager';
import type { UserId, TopicId, ReplyId, CategoryId } from '@/lib/database/schema-types';
import type { User } from '@/lib/users/types';
import type { ForumTopic, ForumReply } from '@/lib/forums/types';
import { hasFlag, TopicStatusFlags } from '@/lib/forums/status-flags';
import { logger } from '@/lib/utils/logger';
import {
  Permission,
  RolePermissions,
  type PermissionContext,
  type PermissionCheckResult,
  type PermissionServiceConfig,
  type PermissionAuditEntry,
  PermissionError,
  PermissionErrorCode,
  requiresOwnership,
} from './types';

const DEFAULT_CONFIG: PermissionServiceConfig = {
  enableCaching: true,
  cacheTTL: 300, // 5 minutes
  enableAuditing: false, // Disabled by default for performance
  strictMode: false,
};

export class PermissionService {
  private config: PermissionServiceConfig;
  private auditLog: PermissionAuditEntry[] = [];

  constructor(config?: Partial<PermissionServiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main permission check method
   * Checks if a user has a specific permission with optional context
   */
  async hasPermission(
    userId: UserId,
    permission: Permission,
    context?: PermissionContext
  ): Promise<boolean> {
    try {
      const result = await this.checkPermission(userId, permission, context);
      return result.granted;
    } catch (error) {
      logger.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * Detailed permission check with result information
   */
  async checkPermission(
    userId: UserId,
    permission: Permission,
    context?: PermissionContext
  ): Promise<PermissionCheckResult> {
    // Check cache first
    if (this.config.enableCaching) {
      const cached = await this.getCachedPermission(userId, permission, context);
      if (cached !== null) {
        return cached;
      }
    }

    // Get user from database
    const user = await this.getUser(userId);
    if (!user) {
      return this.denyPermission('User not found', context);
    }

    // Check if user is banned (is_active = false)
    if (!user.is_active) {
      return this.denyPermission('User is banned', context);
    }

    // Get user's role-based permissions
    const rolePermissions = RolePermissions[user.role] || [];

    // Check if user has the base permission
    if (!rolePermissions.includes(permission)) {
      return this.denyPermission('Permission not granted to role', context);
    }

    // Contextual checks
    const contextualCheck = await this.performContextualChecks(user, permission, context);

    // Cache the result
    if (this.config.enableCaching && contextualCheck.granted) {
      await this.cachePermission(userId, permission, context, contextualCheck);
    }

    // Audit logging
    if (this.config.enableAuditing) {
      this.logPermissionCheck(userId, permission, contextualCheck, context);
    }

    return contextualCheck;
  }

  /**
   * Perform contextual permission checks
   * Handles ownership, topic locks, and other special cases
   */
  private async performContextualChecks(
    user: User,
    permission: Permission,
    context?: PermissionContext
  ): Promise<PermissionCheckResult> {
    // No context needed for general permissions
    if (!context) {
      return { granted: true };
    }

    // Check topic locked status for reply permissions
    if (permission === Permission.FORUM_REPLY_TO_TOPIC && context.topicIsLocked) {
      // Only moderators/admins can reply to locked topics
      if (!['admin', 'moderator'].includes(user.role)) {
        return this.denyPermission('Topic is locked', context);
      }
    }

    // Check ownership for "own" permissions
    if (requiresOwnership(permission)) {
      const isOwner = await this.checkOwnership(user.id as UserId, permission, context);
      if (!isOwner) {
        return this.denyPermission('User is not the owner', context);
      }
    }

    // Check category privacy
    if (context.categoryIsPrivate) {
      const canViewPrivate = RolePermissions[user.role].includes(
        Permission.FORUM_VIEW_PRIVATE_CATEGORY
      );
      if (!canViewPrivate) {
        return this.denyPermission('Category is private', context);
      }
    }

    // All checks passed
    return { granted: true, context };
  }

  /**
   * Check ownership for ownership-based permissions
   */
  private async checkOwnership(
    userId: UserId,
    permission: Permission,
    context: PermissionContext
  ): Promise<boolean> {
    // If ownership is explicitly provided in context
    if (context.isOwner !== undefined) {
      return context.isOwner;
    }

    // Check topic ownership
    if ([Permission.FORUM_EDIT_OWN_TOPIC, Permission.FORUM_DELETE_OWN_TOPIC].includes(permission)) {
      if (context.topicUserId) {
        return context.topicUserId === userId;
      }
      if (context.topicId) {
        const topic = await this.getTopic(context.topicId);
        return topic !== null && (topic.user_id as unknown as UserId) === userId;
      }
    }

    // Check reply ownership
    if ([Permission.FORUM_EDIT_OWN_REPLY, Permission.FORUM_DELETE_OWN_REPLY].includes(permission)) {
      if (context.replyUserId) {
        return context.replyUserId === userId;
      }
      if (context.replyId) {
        const reply = await this.getReply(context.replyId);
        return reply !== null && (reply.user_id as unknown as UserId) === userId;
      }
    }

    // Check if topic author for solution marking
    if (permission === Permission.FORUM_MARK_SOLUTION) {
      if (context.topicUserId) {
        return context.topicUserId === userId;
      }
      if (context.topicId) {
        const topic = await this.getTopic(context.topicId);
        return topic !== null && (topic.user_id as unknown as UserId) === userId;
      }
    }

    return false;
  }

  /**
   * Convenience method: Check if user can edit a topic
   */
  async canEditTopic(userId: UserId, topic: ForumTopic): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;

    // Admins and moderators can edit any topic
    if (['admin', 'moderator'].includes(user.role)) {
      return this.hasPermission(userId, Permission.FORUM_EDIT_ANY_TOPIC);
    }

    // Regular users can only edit their own topics
    return this.hasPermission(userId, Permission.FORUM_EDIT_OWN_TOPIC, {
      topicId: topic.id as unknown as TopicId,
      topicUserId: topic.user_id as unknown as UserId,
      isOwner: (topic.user_id as unknown as number) === (userId as unknown as number),
    });
  }

  /**
   * Convenience method: Check if user can delete a topic
   */
  async canDeleteTopic(userId: UserId, topic: ForumTopic): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;

    // Admins and moderators can delete any topic
    if (['admin', 'moderator'].includes(user.role)) {
      return this.hasPermission(userId, Permission.FORUM_DELETE_ANY_TOPIC);
    }

    // Regular users can only delete their own topics
    return this.hasPermission(userId, Permission.FORUM_DELETE_OWN_TOPIC, {
      topicId: topic.id as unknown as TopicId,
      topicUserId: topic.user_id as unknown as UserId,
      isOwner: (topic.user_id as unknown as number) === (userId as unknown as number),
    });
  }

  /**
   * Convenience method: Check if user can reply to a topic
   */
  async canReplyToTopic(userId: UserId, topic: ForumTopic): Promise<boolean> {
    const isLocked = hasFlag(topic.status, TopicStatusFlags.LOCKED) || topic.is_pinned === true;

    return this.hasPermission(userId, Permission.FORUM_REPLY_TO_TOPIC, {
      topicId: topic.id as unknown as TopicId,
      topicIsLocked: isLocked,
    });
  }

  /**
   * Convenience method: Check if user can edit a reply
   */
  async canEditReply(userId: UserId, reply: ForumReply): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;

    // Admins and moderators can edit any reply
    if (['admin', 'moderator'].includes(user.role)) {
      return this.hasPermission(userId, Permission.FORUM_EDIT_ANY_REPLY);
    }

    // Regular users can only edit their own replies
    return this.hasPermission(userId, Permission.FORUM_EDIT_OWN_REPLY, {
      replyId: reply.id as unknown as ReplyId,
      replyUserId: reply.user_id as unknown as UserId,
      isOwner: (reply.user_id as unknown as number) === (userId as unknown as number),
    });
  }

  /**
   * Convenience method: Check if user can delete a reply
   */
  async canDeleteReply(userId: UserId, reply: ForumReply): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;

    // Admins and moderators can delete any reply
    if (['admin', 'moderator'].includes(user.role)) {
      return this.hasPermission(userId, Permission.FORUM_DELETE_ANY_REPLY);
    }

    // Regular users can only delete their own replies
    return this.hasPermission(userId, Permission.FORUM_DELETE_OWN_REPLY, {
      replyId: reply.id as unknown as ReplyId,
      replyUserId: reply.user_id as unknown as UserId,
      isOwner: (reply.user_id as unknown as number) === (userId as unknown as number),
    });
  }

  /**
   * Convenience method: Check if user can moderate
   */
  async canModerate(userId: UserId, categoryId?: CategoryId): Promise<boolean> {
    return this.hasPermission(userId, Permission.FORUM_MODERATE, {
      categoryId,
    });
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: UserId): Promise<Permission[]> {
    const user = await this.getUser(userId);
    if (!user) return [];

    return RolePermissions[user.role] || [];
  }

  /**
   * Require permission or throw error
   * Useful for enforcing permissions in API routes
   */
  async requirePermission(
    userId: UserId,
    permission: Permission,
    context?: PermissionContext
  ): Promise<void> {
    const result = await this.checkPermission(userId, permission, context);

    if (!result.granted) {
      throw new PermissionError(
        PermissionErrorCode.FORBIDDEN,
        result.reason || 'Permission denied',
        context
      );
    }
  }

  // ===== Private Helper Methods =====

  /**
   * Get user from database
   */
  private async getUser(userId: UserId): Promise<User | null> {
    try {
      const result = await dbAdapter.query(
        `SELECT id, username, email, display_name, role, status, is_active
         FROM users WHERE id = $1`,
        [userId],
        { schema: 'users' }
      );

      return (result.rows[0] as User) || null;
    } catch (error) {
      logger.error('Error fetching user:', error);
      return null;
    }
  }

  /**
   * Get topic from database
   */
  private async getTopic(topicId: TopicId): Promise<ForumTopic | null> {
    try {
      const result = await dbAdapter.query(
        `SELECT id, user_id, category_id, title, status, is_pinned
         FROM topics WHERE id = $1`,
        [topicId],
        { schema: 'forums' }
      );

      return (result.rows[0] as ForumTopic) || null;
    } catch (error) {
      logger.error('Error fetching topic:', error);
      return null;
    }
  }

  /**
   * Get reply from database
   */
  private async getReply(replyId: ReplyId): Promise<ForumReply | null> {
    try {
      const result = await dbAdapter.query(
        `SELECT id, user_id, topic_id, content, parent_id
         FROM replies WHERE id = $1`,
        [replyId],
        { schema: 'forums' }
      );

      return (result.rows[0] as ForumReply) || null;
    } catch (error) {
      logger.error('Error fetching reply:', error);
      return null;
    }
  }

  /**
   * Deny permission with reason
   */
  private denyPermission(reason: string, context?: PermissionContext): PermissionCheckResult {
    return { granted: false, reason, context };
  }

  /**
   * Get cached permission check result
   */
  private async getCachedPermission(
    userId: UserId,
    permission: Permission,
    context?: PermissionContext
  ): Promise<PermissionCheckResult | null> {
    const cacheKey: CacheKey = {
      category: 'user',
      identifier: `permissions:${userId}:${permission}:${this.hashContext(context)}`,
    };

    return cacheManager.get<PermissionCheckResult>(cacheKey);
  }

  /**
   * Cache permission check result
   */
  private async cachePermission(
    userId: UserId,
    permission: Permission,
    context: PermissionContext | undefined,
    result: PermissionCheckResult
  ): Promise<void> {
    const cacheKey: CacheKey = {
      category: 'user',
      identifier: `permissions:${userId}:${permission}:${this.hashContext(context)}`,
    };

    await cacheManager.set(cacheKey, result);
  }

  /**
   * Hash context for cache key
   */
  private hashContext(context?: PermissionContext): string {
    if (!context) return 'no-context';

    return JSON.stringify({
      topicId: context.topicId,
      replyId: context.replyId,
      categoryId: context.categoryId,
      isOwner: context.isOwner,
    });
  }

  /**
   * Log permission check for audit trail
   */
  private logPermissionCheck(
    userId: UserId,
    permission: Permission,
    result: PermissionCheckResult,
    context?: PermissionContext
  ): void {
    const entry: PermissionAuditEntry = {
      userId,
      permission,
      granted: result.granted,
      context,
      timestamp: new Date(),
      reason: result.reason,
    };

    this.auditLog.push(entry);

    // Keep audit log bounded (last 1000 entries)
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
  }

  /**
   * Get audit log entries
   */
  getAuditLog(limit = 100): PermissionAuditEntry[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * Clear permission cache for a user
   * Call this when user role or status changes
   */
  async clearUserPermissionCache(userId: UserId): Promise<void> {
    await cacheManager.invalidatePattern(`permissions:${userId}`);
  }

  /**
   * Clear all permission caches
   */
  async clearAllPermissionCaches(): Promise<void> {
    await cacheManager.invalidatePattern('permissions:');
  }
}

// Export singleton instance
export const permissionService = new PermissionService();

// Export convenience functions
export const hasPermission = permissionService.hasPermission.bind(permissionService);
export const canEditTopic = permissionService.canEditTopic.bind(permissionService);
export const canDeleteTopic = permissionService.canDeleteTopic.bind(permissionService);
export const canReplyToTopic = permissionService.canReplyToTopic.bind(permissionService);
export const canEditReply = permissionService.canEditReply.bind(permissionService);
export const canDeleteReply = permissionService.canDeleteReply.bind(permissionService);
export const canModerate = permissionService.canModerate.bind(permissionService);
export const getUserPermissions = permissionService.getUserPermissions.bind(permissionService);
export const requirePermission = permissionService.requirePermission.bind(permissionService);
