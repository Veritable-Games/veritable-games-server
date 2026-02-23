import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

export interface MentionMatch {
  username: string;
  user_id: number;
  display_name: string;
  position: number;
  length: number;
}

export class MentionService {
  /**
   * Extract @username mentions from text content
   * @param content - Text content to scan for mentions
   * @returns Array of mention matches with user information
   */
  static async extractMentions(content: string): Promise<MentionMatch[]> {
    if (!content) return [];

    // Regex to match @username patterns (alphanumeric, underscores, hyphens)
    const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
    const matches: MentionMatch[] = [];
    let match;

    // Extract all potential mentions
    const potentialMentions: Array<{ username: string; position: number; length: number }> = [];

    while ((match = mentionRegex.exec(content)) !== null) {
      potentialMentions.push({
        username: match[1] ?? '',
        position: match.index!,
        length: match[0].length,
      });
    }

    if (potentialMentions.length === 0) return [];

    try {
      const usernames = potentialMentions.map(m => m.username);
      const placeholders = usernames.map((_, i) => `$${i + 1}`).join(',');

      const result = await dbAdapter.query(
        `
        SELECT id, username, display_name
        FROM users
        WHERE LOWER(username) IN (${placeholders})
          AND is_active = true
      `,
        usernames.map(u => u.toLowerCase()),
        { schema: 'users' }
      );

      const users = result.rows as Array<{
        id: number;
        username: string;
        display_name: string | null;
      }>;

      // Match found users with mention positions
      for (const user of users) {
        const mentionMatch = potentialMentions.find(
          m => m.username.toLowerCase() === user.username.toLowerCase()
        );

        if (mentionMatch) {
          matches.push({
            username: user.username,
            user_id: user.id,
            display_name: user.display_name || user.username,
            position: mentionMatch.position,
            length: mentionMatch.length,
          });
        }
      }

      return matches.sort((a, b) => a.position - b.position);
    } catch (error) {
      logger.error('Error extracting mentions:', error);
      return [];
    }
  }

  /**
   * Create mention notifications for users mentioned in content
   */
  static async createMentionNotifications(
    mentionedUserIds: number[],
    mentionerUserId: number,
    entityType: 'topic' | 'reply',
    entityId: number,
    contextTitle: string,
    contentPreview: string
  ): Promise<void> {
    if (mentionedUserIds.length === 0) return;

    try {
      await dbAdapter.transaction(
        async adapter => {
          for (const userId of mentionedUserIds) {
            // Don't notify users who mention themselves
            if (userId === mentionerUserId) continue;

            // Get mentioner's info for the notification
            const mentionerResult = await adapter.query(
              `
            SELECT username, display_name FROM users WHERE id = $1
          `,
              [mentionerUserId],
              { schema: 'users' }
            );

            const mentioner = mentionerResult.rows[0] as
              | { username: string; display_name: string | null }
              | undefined;

            if (!mentioner) continue;

            const displayName = mentioner.display_name || mentioner.username;

            // Create action URL based on entity type
            let actionUrl = '/forums';
            let topicId = entityId;

            if (entityType === 'topic') {
              actionUrl = `/forums/topic/${entityId}`;
            } else if (entityType === 'reply') {
              // For replies, we need to get the topic_id
              const replyResult = await adapter.query(
                `
              SELECT topic_id FROM forum_replies WHERE id = $1
            `,
                [entityId],
                { schema: 'forums' }
              );

              const replyRecord = replyResult.rows[0] as { topic_id: number } | undefined;
              if (replyRecord) {
                topicId = replyRecord.topic_id;
                actionUrl = `/forums/topic/${replyRecord.topic_id}#reply-${entityId}`;
              }
            }

            const title = `${displayName} mentioned you in "${contextTitle}"`;
            const content = `${displayName} mentioned you: "${contentPreview.substring(0, 100)}${contentPreview.length > 100 ? '...' : ''}"`;

            const metadata = JSON.stringify({
              mentioner_id: mentionerUserId,
              mentioner_username: mentioner.username,
              mentioner_display_name: displayName,
              entity_type: entityType,
              entity_id: entityId,
              topic_id: topicId,
            });

            await adapter.query(
              `
          INSERT INTO notifications (
            user_id, type, title, content, entity_type, entity_id,
            action_url, read_status, priority, created_at, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
        `,
              [
                userId,
                'mention',
                title,
                content,
                entityType,
                entityId,
                actionUrl,
                false,
                'normal',
                metadata,
              ],
              { schema: 'main' }
            );
          }
        },
        { schema: 'main' }
      );

      logger.info(
        `Created ${mentionedUserIds.length} mention notifications for ${entityType} ${entityId}`
      );
    } catch (error) {
      logger.error('Error creating mention notifications:', error);
      throw error;
    }
  }

  /**
   * Process mentions in content and create notifications
   * This is the main method to call from forum service
   */
  static async processMentions(
    content: string,
    authorUserId: number,
    entityType: 'topic' | 'reply',
    entityId: number,
    contextTitle: string
  ): Promise<MentionMatch[]> {
    try {
      // Extract mentions from content
      const mentions = await this.extractMentions(content);

      if (mentions.length === 0) {
        return [];
      }

      // Get unique user IDs (in case someone is mentioned multiple times)
      const uniqueUserIds = [...new Set(mentions.map(m => m.user_id))];

      // Create notifications
      await this.createMentionNotifications(
        uniqueUserIds,
        authorUserId,
        entityType,
        entityId,
        contextTitle,
        content
      );

      return mentions;
    } catch (error) {
      logger.error('Error processing mentions:', error);
      // Don't throw - mentions are a nice-to-have feature
      // The main content creation should still succeed
      return [];
    }
  }

  /**
   * Get users who were mentioned in specific content
   * Useful for editing content to compare old vs new mentions
   */
  static async getExistingMentionNotifications(
    entityType: 'topic' | 'reply',
    entityId: number
  ): Promise<number[]> {
    try {
      const result = await dbAdapter.query(
        `
        SELECT DISTINCT user_id
        FROM notifications
        WHERE type = 'mention'
          AND entity_type = $1
          AND entity_id = $2
      `,
        [entityType, entityId],
        { schema: 'main' }
      );

      return result.rows.map((n: any) => n.user_id);
    } catch (error) {
      logger.error('Error getting existing mention notifications:', error);
      return [];
    }
  }

  /**
   * Clean up mention notifications when content is deleted
   */
  static async cleanupMentionNotifications(
    entityType: 'topic' | 'reply',
    entityId: number
  ): Promise<void> {
    try {
      const result = await dbAdapter.query(
        `
        DELETE FROM notifications
        WHERE type = 'mention'
          AND entity_type = $1
          AND entity_id = $2
      `,
        [entityType, entityId],
        { schema: 'main' }
      );

      logger.info(
        `Cleaned up ${result.rowCount || 0} mention notifications for ${entityType} ${entityId}`
      );
    } catch (error) {
      logger.error('Error cleaning up mention notifications:', error);
      // Don't throw - cleanup is best effort
    }
  }
}
