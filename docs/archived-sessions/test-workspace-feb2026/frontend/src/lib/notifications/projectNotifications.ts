/**
 * Project Notification Service
 *
 * Extends the existing notification system with project-specific functionality.
 * Integrates with collaborative project features and respects user preferences.
 *
 * Features:
 * - Project-specific notification types
 * - User preference management
 * - Batch notification creation
 * - Integration with existing notification infrastructure
 */

import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

// Project notification types that extend the base notification system
export const PROJECT_NOTIFICATION_TYPES = {
  // Revision-related notifications
  REVISION_CREATED: 'project_revision_created',
  REVISION_UPDATED: 'project_revision_updated',

  // Discussion notifications
  DISCUSSION_CREATED: 'project_discussion_created',
  DISCUSSION_REPLY: 'project_discussion_reply',
  DISCUSSION_MENTIONED: 'project_discussion_mentioned',

  // Annotation notifications
  ANNOTATION_ADDED: 'project_annotation_added',
  ANNOTATION_REPLY: 'project_annotation_reply',
  ANNOTATION_RESOLVED: 'project_annotation_resolved',

  // Review workflow notifications
  REVIEW_REQUESTED: 'project_review_requested',
  REVIEW_SUBMITTED: 'project_review_submitted',
  REVIEW_COMPLETED: 'project_review_completed',
  REVIEW_DEADLINE_APPROACHING: 'project_review_deadline_approaching',

  // Collaboration notifications
  COLLABORATOR_ADDED: 'project_collaborator_added',
  COLLABORATOR_REMOVED: 'project_collaborator_removed',
  COLLABORATOR_ROLE_CHANGED: 'project_collaborator_role_changed',

  // Project milestone notifications
  MILESTONE_CREATED: 'project_milestone_created',
  MILESTONE_COMPLETED: 'project_milestone_completed',
  MILESTONE_OVERDUE: 'project_milestone_overdue',

  // General project notifications
  PROJECT_SHARED: 'project_shared',
  PROJECT_ARCHIVED: 'project_archived',
  PROJECT_DELETED: 'project_deleted',
} as const;

export type ProjectNotificationType =
  (typeof PROJECT_NOTIFICATION_TYPES)[keyof typeof PROJECT_NOTIFICATION_TYPES];

// Default notification preferences for project notifications
export const DEFAULT_PROJECT_NOTIFICATION_PREFERENCES = {
  [PROJECT_NOTIFICATION_TYPES.REVISION_CREATED]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'in_app',
  },
  [PROJECT_NOTIFICATION_TYPES.REVISION_UPDATED]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'in_app',
  },
  [PROJECT_NOTIFICATION_TYPES.DISCUSSION_CREATED]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'in_app',
  },
  [PROJECT_NOTIFICATION_TYPES.DISCUSSION_REPLY]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'in_app',
  },
  [PROJECT_NOTIFICATION_TYPES.DISCUSSION_MENTIONED]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'in_app',
  },
  [PROJECT_NOTIFICATION_TYPES.ANNOTATION_ADDED]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'in_app',
  },
  [PROJECT_NOTIFICATION_TYPES.ANNOTATION_REPLY]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'in_app',
  },
  [PROJECT_NOTIFICATION_TYPES.ANNOTATION_RESOLVED]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'in_app',
  },
  [PROJECT_NOTIFICATION_TYPES.REVIEW_REQUESTED]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'both',
  },
  [PROJECT_NOTIFICATION_TYPES.REVIEW_SUBMITTED]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'both',
  },
  [PROJECT_NOTIFICATION_TYPES.REVIEW_COMPLETED]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'both',
  },
  [PROJECT_NOTIFICATION_TYPES.REVIEW_DEADLINE_APPROACHING]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'both',
  },
  [PROJECT_NOTIFICATION_TYPES.COLLABORATOR_ADDED]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'both',
  },
  [PROJECT_NOTIFICATION_TYPES.COLLABORATOR_REMOVED]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'both',
  },
  [PROJECT_NOTIFICATION_TYPES.COLLABORATOR_ROLE_CHANGED]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'both',
  },
  [PROJECT_NOTIFICATION_TYPES.MILESTONE_CREATED]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'in_app',
  },
  [PROJECT_NOTIFICATION_TYPES.MILESTONE_COMPLETED]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'in_app',
  },
  [PROJECT_NOTIFICATION_TYPES.MILESTONE_OVERDUE]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'both',
  },
  [PROJECT_NOTIFICATION_TYPES.PROJECT_SHARED]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'both',
  },
  [PROJECT_NOTIFICATION_TYPES.PROJECT_ARCHIVED]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'in_app',
  },
  [PROJECT_NOTIFICATION_TYPES.PROJECT_DELETED]: {
    enabled: true,
    frequency: 'immediate',
    delivery_method: 'in_app',
  },
} as const;

export interface ProjectNotificationData {
  project_slug: string;
  recipient_ids: number[];
  type: ProjectNotificationType;
  title: string;
  message: string;
  entity_type: string;
  entity_id: number;
  actor_id?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, any>;
  expires_at?: string;
}

export interface NotificationPreferences {
  enabled: boolean;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly' | 'disabled';
  delivery_method: 'in_app' | 'email' | 'both';
}

/**
 * Enhanced project notification service
 */
export class ProjectNotificationService {
  /**
   * Create project-specific notifications with preference filtering
   */
  async createProjectNotification(data: ProjectNotificationData): Promise<number> {
    // Filter recipients based on their notification preferences
    const validRecipients = await this.filterRecipientsByPreferences(
      data.recipient_ids,
      data.project_slug,
      data.type
    );

    if (validRecipients.length === 0) {
      return 0; // No notifications to send
    }

    // Create notifications in batch
    const notificationCount = await dbAdapter.transaction(
      async adapter => {
        let count = 0;
        for (const recipient of validRecipients) {
          const enhancedMetadata = {
            ...data.metadata,
            project_slug: data.project_slug,
            actor_id: data.actor_id,
            notification_source: 'project_collaboration',
          };

          await adapter.query(
            `
          INSERT INTO notifications (
            user_id, type, title, message, entity_type, entity_id,
            priority, metadata, created_at, read_status, expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), FALSE, $9)
        `,
            [
              recipient.user_id,
              data.type,
              data.title,
              data.message,
              data.entity_type,
              data.entity_id,
              data.priority || 'normal',
              JSON.stringify(enhancedMetadata),
              data.expires_at || null,
            ],
            { schema: 'forums' }
          );

          count++;
        }

        return count;
      },
      { schema: 'forums' }
    );

    return notificationCount;
  }

  /**
   * Get user's notification preferences for project notifications
   */
  async getUserProjectNotificationPreferences(
    user_id: number,
    project_slug?: string
  ): Promise<Record<string, NotificationPreferences>> {
    let query = `
        SELECT notification_type, enabled, frequency, delivery_method
        FROM project_notification_preferences
        WHERE user_id = $1
      `;
    const params: any[] = [user_id];

    if (project_slug) {
      query += ` AND (project_slug = $2 OR project_slug IS NULL)`;
      params.push(project_slug);
    }

    query += ` ORDER BY project_slug NULLS LAST`;

    const result = await dbAdapter.query(query, params, { schema: 'forums' });
    const preferences = result.rows;

    // Build preferences map with defaults
    const preferencesMap: Record<string, NotificationPreferences> = {};

    // Start with defaults
    Object.entries(DEFAULT_PROJECT_NOTIFICATION_PREFERENCES).forEach(([type, defaultPref]) => {
      preferencesMap[type] = { ...defaultPref };
    });

    // Override with user's actual preferences
    preferences.forEach((pref: any) => {
      preferencesMap[pref.notification_type] = {
        enabled: Boolean(pref.enabled),
        frequency: pref.frequency,
        delivery_method: pref.delivery_method,
      };
    });

    return preferencesMap;
  }

  /**
   * Update user's project notification preferences
   */
  async updateProjectNotificationPreferences(
    user_id: number,
    project_slug: string | null,
    preferences: Record<string, Partial<NotificationPreferences>>
  ): Promise<{ success: boolean; updated_count: number }> {
    const updatedCount = await dbAdapter.transaction(
      async adapter => {
        let count = 0;
        for (const [type, pref] of Object.entries(preferences)) {
          // Get current preferences to merge with partial update
          const current = DEFAULT_PROJECT_NOTIFICATION_PREFERENCES[
            type as ProjectNotificationType
          ] || {
            enabled: true,
            frequency: 'immediate',
            delivery_method: 'in_app',
          };

          const merged = {
            enabled: pref.enabled ?? current.enabled,
            frequency: pref.frequency ?? current.frequency,
            delivery_method: pref.delivery_method ?? current.delivery_method,
          };

          // PostgreSQL uses ON CONFLICT for upsert
          await adapter.query(
            `
            INSERT INTO project_notification_preferences (
              user_id, project_slug, notification_type, enabled,
              frequency, delivery_method, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (user_id, project_slug, notification_type)
            DO UPDATE SET
              enabled = EXCLUDED.enabled,
              frequency = EXCLUDED.frequency,
              delivery_method = EXCLUDED.delivery_method,
              updated_at = NOW()
          `,
            [user_id, project_slug, type, merged.enabled, merged.frequency, merged.delivery_method],
            { schema: 'forums' }
          );

          count++;
        }

        return count;
      },
      { schema: 'forums' }
    );

    return { success: true, updated_count: updatedCount };
  }

  /**
   * Get project collaborators who should receive notifications
   */
  async getProjectNotificationRecipients(
    project_slug: string,
    notification_type: ProjectNotificationType,
    exclude_user_id?: number
  ): Promise<number[]> {
    try {
      // Get project collaborators (checking if table exists)
      let collaborators = [];
      try {
        const result = await dbAdapter.query(
          `
          SELECT DISTINCT pc.user_id
          FROM project_collaborators pc
          JOIN projects p ON pc.project_id = p.id
          WHERE p.slug = $1 AND pc.status = 'active'
            AND ($2 IS NULL OR pc.user_id != $3)
        `,
          [project_slug, exclude_user_id, exclude_user_id],
          { schema: 'content' }
        );
        collaborators = result.rows;
      } catch (error: any) {
        // Table might not exist or is not migrated yet - return empty array
        if (error.code === '42P01') {
          // PostgreSQL error code for undefined table
          logger.info('project_collaborators table does not exist yet, skipping notifications');
          return [];
        }
        throw error;
      }

      return collaborators.map((c: any) => c.user_id);
    } catch (error) {
      logger.error('Error getting project notification recipients:', error);
      return [];
    }
  }

  /**
   * Create notification for revision-related events
   */
  async notifyRevisionEvent(
    project_slug: string,
    revision_id: number,
    event_type: 'created' | 'updated',
    actor_id: number,
    data: {
      revision_summary?: string;
      changes_count?: number;
    } = {}
  ): Promise<number> {
    const recipients = await this.getProjectNotificationRecipients(
      project_slug,
      event_type === 'created'
        ? PROJECT_NOTIFICATION_TYPES.REVISION_CREATED
        : PROJECT_NOTIFICATION_TYPES.REVISION_UPDATED,
      actor_id
    );

    if (recipients.length === 0) return 0;

    const actorInfo = await this.getUserInfo(actor_id);
    const title = event_type === 'created' ? 'New Revision' : 'Revision Updated';
    const message = `${actorInfo.username} ${event_type} a revision for ${project_slug}${data.revision_summary ? ': ' + data.revision_summary : ''}`;

    return this.createProjectNotification({
      project_slug,
      recipient_ids: recipients,
      type:
        event_type === 'created'
          ? PROJECT_NOTIFICATION_TYPES.REVISION_CREATED
          : PROJECT_NOTIFICATION_TYPES.REVISION_UPDATED,
      title,
      message,
      entity_type: 'wiki_revision',
      entity_id: revision_id,
      actor_id,
      priority: 'normal',
      metadata: {
        revision_id,
        revision_summary: data.revision_summary,
        changes_count: data.changes_count,
      },
    });
  }

  /**
   * Create notification for discussion events
   */
  async notifyDiscussionEvent(
    project_slug: string,
    discussion_id: number,
    event_type: 'created' | 'reply',
    actor_id: number,
    data: {
      discussion_title?: string;
      reply_content?: string;
      mentioned_users?: number[];
    } = {}
  ): Promise<number> {
    const baseRecipients = await this.getProjectNotificationRecipients(
      project_slug,
      event_type === 'created'
        ? PROJECT_NOTIFICATION_TYPES.DISCUSSION_CREATED
        : PROJECT_NOTIFICATION_TYPES.DISCUSSION_REPLY,
      actor_id
    );

    // Add mentioned users for replies
    const recipients =
      event_type === 'reply' && data.mentioned_users?.length
        ? [...new Set([...baseRecipients, ...data.mentioned_users])]
        : baseRecipients;

    if (recipients.length === 0) return 0;

    const actorInfo = await this.getUserInfo(actor_id);
    const title = event_type === 'created' ? 'New Discussion' : 'Discussion Reply';
    const message =
      event_type === 'created'
        ? `${actorInfo.username} started a discussion "${data.discussion_title}" in ${project_slug}`
        : `${actorInfo.username} replied to a discussion in ${project_slug}`;

    return this.createProjectNotification({
      project_slug,
      recipient_ids: recipients,
      type:
        event_type === 'created'
          ? PROJECT_NOTIFICATION_TYPES.DISCUSSION_CREATED
          : PROJECT_NOTIFICATION_TYPES.DISCUSSION_REPLY,
      title,
      message,
      entity_type: 'project_discussion',
      entity_id: discussion_id,
      actor_id,
      priority: data.mentioned_users?.length ? 'high' : 'normal',
      metadata: {
        discussion_id,
        discussion_title: data.discussion_title,
        mentioned_users: data.mentioned_users,
      },
    });
  }

  /**
   * Create notification for review events
   */
  async notifyReviewEvent(
    project_slug: string,
    review_id: number,
    event_type: 'requested' | 'submitted' | 'completed',
    actor_id: number,
    data: {
      reviewer_ids?: number[];
      review_decision?: string;
      review_type?: string;
    } = {}
  ): Promise<number> {
    let recipients: number[] = [];

    if (event_type === 'requested' && data.reviewer_ids) {
      recipients = data.reviewer_ids;
    } else {
      // For submitted/completed, notify the review author
      try {
        const result = await dbAdapter.query(
          'SELECT author_id FROM project_reviews WHERE id = $1',
          [review_id],
          { schema: 'content' }
        );
        const review = result.rows[0] as { author_id: number } | undefined;
        if (review) {
          recipients = [review.author_id];
        }
      } catch (error) {
        logger.error('Error fetching review author:', error);
      }
    }

    if (recipients.length === 0) return 0;

    const actorInfo = await this.getUserInfo(actor_id);
    let title: string;
    let message: string;
    let priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';

    switch (event_type) {
      case 'requested':
        title = 'Review Request';
        message = `${actorInfo.username} requested your review for ${project_slug}`;
        priority = 'high';
        break;
      case 'submitted':
        title = 'Review Submitted';
        message = `${actorInfo.username} submitted a review for ${project_slug}`;
        break;
      case 'completed':
        title = 'Review Completed';
        message = `Your review request for ${project_slug} has been ${data.review_decision || 'completed'}`;
        priority = data.review_decision === 'rejected' ? 'high' : 'normal';
        break;
    }

    const notificationType =
      event_type === 'requested'
        ? PROJECT_NOTIFICATION_TYPES.REVIEW_REQUESTED
        : event_type === 'submitted'
          ? PROJECT_NOTIFICATION_TYPES.REVIEW_SUBMITTED
          : PROJECT_NOTIFICATION_TYPES.REVIEW_COMPLETED;

    return this.createProjectNotification({
      project_slug,
      recipient_ids: recipients,
      type: notificationType,
      title,
      message,
      entity_type: 'project_review',
      entity_id: review_id,
      actor_id,
      priority,
      metadata: {
        review_id,
        review_type: data.review_type,
        review_decision: data.review_decision,
      },
    });
  }

  /**
   * Helper method to filter recipients by their notification preferences
   */
  private async filterRecipientsByPreferences(
    recipient_ids: number[],
    project_slug: string,
    notification_type: ProjectNotificationType
  ): Promise<Array<{ user_id: number; preferences: NotificationPreferences }>> {
    if (recipient_ids.length === 0) return [];

    const validRecipients: Array<{ user_id: number; preferences: NotificationPreferences }> = [];

    // Get preferences for all recipients in batch
    const preferencePromises = recipient_ids.map(async user_id => {
      const preferences = await this.getUserProjectNotificationPreferences(user_id, project_slug);
      return { user_id, preferences: preferences[notification_type] };
    });

    const allPreferences = await Promise.all(preferencePromises);

    // Filter only those who have notifications enabled
    allPreferences.forEach(({ user_id, preferences }) => {
      if (preferences?.enabled && preferences.frequency !== 'disabled') {
        validRecipients.push({ user_id, preferences });
      }
    });

    return validRecipients;
  }

  /**
   * Helper method to get user info
   */
  private async getUserInfo(user_id: number): Promise<{ username: string; display_name?: string }> {
    try {
      const result = await dbAdapter.query(
        'SELECT username, display_name FROM users WHERE id = $1',
        [user_id],
        { schema: 'users' }
      );

      const user = result.rows[0] as
        | {
            username: string;
            display_name?: string;
          }
        | undefined;

      return user || { username: 'Unknown User' };
    } catch (error) {
      logger.error('Error fetching user info:', error);
      return { username: 'Unknown User' };
    }
  }
}

// Singleton instance
export const projectNotificationService = new ProjectNotificationService();

// Convenience function for backward compatibility
export async function createProjectNotification(data: ProjectNotificationData): Promise<number> {
  return projectNotificationService.createProjectNotification(data);
}
