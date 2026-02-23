import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import type { User } from '@/lib/auth/types';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

/**
 * Database row types for query results
 */
interface ConversationRow {
  id: number;
  subject: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  latest_message_content?: string;
  latest_message_at?: string;
  latest_sender_id?: number;
  unread_count?: number;
  sort_order?: string;
}

interface ParticipantRow {
  id?: number;
  conversation_id?: number;
  user_id: number;
  joined_at: string;
  last_read_at: string;
  is_active: boolean;
}

interface MessageRow {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  message_type: string;
  created_at: string;
  updated_at: string;
  edited_at?: string;
  is_deleted: boolean;
}

interface CountRow {
  count: number;
}

interface ResponseTimeRow {
  avg_response_time_minutes?: number;
}

interface LastActivityRow {
  created_at?: string;
}

interface ConversationWithStatsRow {
  id: number;
  subject: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  latest_message_content?: string;
  latest_message_at?: string;
  latest_sender_id?: number;
  latest_sender_username?: string | null;
  unread_count?: number;
  message_count?: number;
  participant_count?: number;
  sort_order?: string;
}

interface UserDataRow {
  id: number;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

interface ConversationSummary {
  id: number;
  subject: string;
  participantCount: number;
  messageCount: number;
  lastActivity: string;
  isArchived: boolean;
  unreadCount: number;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  message_type: 'text';
  created_at: string;
  updated_at: string;
  edited_at?: string;
  is_deleted: boolean;
  sender?: {
    id: number;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface Conversation {
  id: number;
  subject: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  participants?: ConversationParticipant[];
  latest_message?: Message;
  unread_count?: number;
}

export interface ConversationParticipant {
  id: number;
  conversation_id: number;
  user_id: number;
  joined_at: string;
  last_read_at: string;
  is_active: boolean;
  user?: {
    id: number;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface CreateConversationParams {
  subject: string;
  participant_ids: number[];
  initial_message: string;
}

export interface SendMessageParams {
  conversation_id: number;
  content: string;
  message_type?: 'text';
}

export class MessagingService {
  async getUserConversations(
    userId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<Conversation[]> {
    try {
      const result = await dbAdapter.query(
        `
        SELECT DISTINCT c.*,
               latest.content as latest_message_content,
               latest.created_at as latest_message_at,
               latest.sender_id as latest_sender_id,
               COALESCE(unread.unread_count, 0) as unread_count,
               COALESCE(latest.created_at, c.updated_at) as sort_order
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        LEFT JOIN (
          SELECT m1.conversation_id, m1.content, m1.created_at, m1.sender_id
          FROM messages m1
          WHERE m1.id = (
            SELECT m2.id FROM messages m2
            WHERE m2.conversation_id = m1.conversation_id
              AND m2.is_deleted = FALSE
            ORDER BY m2.created_at DESC LIMIT 1
          )
        ) latest ON c.id = latest.conversation_id
        LEFT JOIN (
          SELECT conversation_id, COUNT(*) as unread_count
          FROM messages m
          WHERE m.created_at > (
            SELECT cp2.last_read_at FROM conversation_participants cp2
            WHERE cp2.conversation_id = m.conversation_id AND cp2.user_id = ?
          ) AND m.sender_id != ? AND m.is_deleted = FALSE
          GROUP BY conversation_id
        ) unread ON c.id = unread.conversation_id
        WHERE cp.user_id = ? AND cp.is_active = TRUE AND c.is_archived = FALSE
        ORDER BY sort_order DESC
        LIMIT ? OFFSET ?
      `,
        [userId, userId, userId, limit, offset],
        { schema: 'messaging' }
      );

      const rows = result.rows as ConversationRow[];

      // Get participants for each conversation
      const conversationsWithParticipants = await Promise.all(
        rows.map(async row => {
          const participantsResult = await dbAdapter.query(
            `
            SELECT user_id, joined_at, last_read_at, is_active
            FROM conversation_participants
            WHERE conversation_id = ? AND is_active = TRUE
          `,
            [row.id],
            { schema: 'messaging' }
          );
          const participants = participantsResult.rows as ParticipantRow[];
          return { ...row, participantIds: participants.map(p => p.user_id) };
        })
      );

      // Collect all user IDs that need data (senders and participants)
      const allUserIds = new Set<number>();
      conversationsWithParticipants.forEach(conv => {
        if (conv.latest_sender_id) allUserIds.add(conv.latest_sender_id);
        conv.participantIds.forEach((id: number) => allUserIds.add(id));
      });

      // Fetch user data for all users
      const userData = allUserIds.size > 0 ? await this.fetchUserData(Array.from(allUserIds)) : [];
      const userMap = new Map(userData.map(u => [u.id, u]));

      return conversationsWithParticipants.map(row => {
        // Get participant data
        const participants = row.participantIds.map((participantId: number) => {
          const user = userMap.get(participantId);
          return {
            id: participantId,
            conversation_id: row.id,
            user_id: participantId,
            joined_at: '',
            last_read_at: '',
            is_active: true,
            user: user
              ? {
                  id: user.id,
                  username: user.username,
                  display_name: user.display_name,
                  avatar_url: user.avatar_url,
                }
              : {
                  id: participantId,
                  username: `user_${participantId}`,
                  display_name: undefined,
                  avatar_url: undefined,
                },
          };
        });

        return {
          id: row.id,
          subject: row.subject,
          created_by: row.created_by,
          created_at: row.created_at,
          updated_at: row.updated_at,
          is_archived: Boolean(row.is_archived),
          participants, // Now includes participant data
          latest_message:
            row.latest_message_content && row.latest_sender_id !== undefined
              ? {
                  id: 0, // We don't have the message ID in this query
                  conversation_id: row.id,
                  sender_id: row.latest_sender_id,
                  content: row.latest_message_content,
                  message_type: 'text' as const,
                  created_at: row.latest_message_at || '',
                  updated_at: row.latest_message_at || '',
                  is_deleted: false,
                  sender: (() => {
                    const senderData = userMap.get(row.latest_sender_id);
                    return senderData
                      ? {
                          id: row.latest_sender_id,
                          username: senderData.username,
                          display_name: senderData.display_name,
                          avatar_url: senderData.avatar_url,
                        }
                      : {
                          id: row.latest_sender_id,
                          username: `user_${row.latest_sender_id}`,
                          display_name: undefined,
                          avatar_url: undefined,
                        };
                  })(),
                }
              : undefined,
          unread_count: row.unread_count || 0,
        };
      });
    } catch (error) {
      throw error;
    }
  }

  async getConversation(conversationId: number, userId: number): Promise<Conversation | null> {
    try {
      // Check if user is a participant
      const participantCheckResult = await dbAdapter.query(
        `
        SELECT 1 FROM conversation_participants
        WHERE conversation_id = ? AND user_id = ? AND is_active = TRUE
      `,
        [conversationId, userId],
        { schema: 'messaging' }
      );

      if (participantCheckResult.rows.length === 0) {
        return null;
      }

      // Get conversation details
      const conversationResult = await dbAdapter.query(
        `
        SELECT * FROM conversations WHERE id = ? AND is_archived = FALSE
      `,
        [conversationId],
        { schema: 'messaging' }
      );
      const conversation = conversationResult.rows[0] as ConversationRow | undefined;

      if (!conversation) {
        return null;
      }

      // Get participants (without user data - will be fetched separately)
      const participantsResult = await dbAdapter.query(
        `
        SELECT cp.*
        FROM conversation_participants cp
        WHERE cp.conversation_id = ? AND cp.is_active = TRUE
      `,
        [conversationId],
        { schema: 'messaging' }
      );
      const participants = participantsResult.rows as ParticipantRow[];

      // Fetch user data separately from users database
      const userIds = participants.map(p => p.user_id);
      const userData = await this.fetchUserData(userIds);
      const userMap = new Map(userData.map(u => [u.id, u]));

      return {
        id: conversation.id,
        subject: conversation.subject,
        created_by: conversation.created_by,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        is_archived: Boolean(conversation.is_archived),
        participants: participants.map(p => {
          const user = userMap.get(p.user_id);
          return {
            id: p.id ?? 0,
            conversation_id: p.conversation_id ?? conversationId,
            user_id: p.user_id,
            joined_at: p.joined_at,
            last_read_at: p.last_read_at,
            is_active: Boolean(p.is_active),
            user: user
              ? {
                  id: user.id,
                  username: user.username,
                  display_name: user.display_name,
                  avatar_url: user.avatar_url,
                }
              : {
                  id: p.user_id,
                  username: `user_${p.user_id}`,
                  display_name: undefined,
                  avatar_url: undefined,
                },
          };
        }),
      };
    } catch (error) {
      throw error;
    }
  }

  async getConversationMessages(
    conversationId: number,
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> {
    try {
      // Verify user is a participant
      const participantCheckResult = await dbAdapter.query(
        `
        SELECT 1 FROM conversation_participants
        WHERE conversation_id = ? AND user_id = ? AND is_active = TRUE
      `,
        [conversationId, userId],
        { schema: 'messaging' }
      );

      if (participantCheckResult.rows.length === 0) {
        return [];
      }

      const result = await dbAdapter.query(
        `
        SELECT m.*
        FROM messages m
        WHERE m.conversation_id = ? AND m.is_deleted = FALSE
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
      `,
        [conversationId, limit, offset],
        { schema: 'messaging' }
      );

      const messages = result.rows as MessageRow[];

      // Fetch user data for all senders
      const senderIds = [...new Set(messages.map(m => m.sender_id))];
      const userData = senderIds.length > 0 ? await this.fetchUserData(senderIds) : [];
      const userMap = new Map(userData.map(u => [u.id, u]));

      return messages.reverse().map(msg => {
        const sender = userMap.get(msg.sender_id);
        return {
          id: msg.id,
          conversation_id: msg.conversation_id,
          sender_id: msg.sender_id,
          content: msg.content,
          message_type: (msg.message_type || 'text') as 'text',
          created_at: msg.created_at,
          updated_at: msg.updated_at,
          edited_at: msg.edited_at,
          is_deleted: Boolean(msg.is_deleted),
          sender: sender
            ? {
                id: sender.id,
                username: sender.username,
                display_name: sender.display_name,
                avatar_url: sender.avatar_url,
              }
            : {
                id: msg.sender_id,
                username: `user_${msg.sender_id}`,
                display_name: undefined,
                avatar_url: undefined,
              },
        };
      });
    } catch (error) {
      throw error;
    }
  }

  async createConversation(
    params: CreateConversationParams,
    createdBy: number
  ): Promise<Conversation> {
    try {
      const conversationId = await dbAdapter.transaction<number>(
        async adapter => {
          // Create conversation
          const insertConversationResult = await adapter.query(
            `
            INSERT INTO conversations (subject, created_by)
            VALUES (?, ?)
            RETURNING id
          `,
            [params.subject, createdBy],
            { schema: 'messaging', returnLastId: true }
          );
          const conversationId = insertConversationResult.rows[0].id as number;

          // Add creator as participant
          await adapter.query(
            `
            INSERT INTO conversation_participants (conversation_id, user_id)
            VALUES (?, ?)
          `,
            [conversationId, createdBy],
            { schema: 'messaging' }
          );

          // Add other participants
          for (const participantId of params.participant_ids) {
            if (participantId !== createdBy) {
              await adapter.query(
                `
                INSERT INTO conversation_participants (conversation_id, user_id)
                VALUES (?, ?)
              `,
                [conversationId, participantId],
                { schema: 'messaging' }
              );
            }
          }

          // Send initial message
          await adapter.query(
            `
            INSERT INTO messages (conversation_id, sender_id, content)
            VALUES (?, ?, ?)
          `,
            [conversationId, createdBy, params.initial_message],
            { schema: 'messaging' }
          );

          return conversationId;
        },
        { schema: 'messaging' }
      );

      // Return the created conversation
      const conversation = await this.getConversation(conversationId, createdBy);
      if (!conversation) {
        throw new Error('Failed to retrieve created conversation');
      }

      return conversation;
    } catch (error) {
      throw error;
    }
  }

  async sendMessage(params: SendMessageParams, senderId: number): Promise<Message> {
    try {
      // Verify sender is a participant
      const participantCheckResult = await dbAdapter.query(
        `
        SELECT 1 FROM conversation_participants
        WHERE conversation_id = ? AND user_id = ? AND is_active = TRUE
      `,
        [params.conversation_id, senderId],
        { schema: 'messaging' }
      );

      if (participantCheckResult.rows.length === 0) {
        throw new Error('User is not a participant in this conversation');
      }

      const messageId = await dbAdapter.transaction<number>(
        async adapter => {
          // Insert message
          const insertMessageResult = await adapter.query(
            `
            INSERT INTO messages (conversation_id, sender_id, content, message_type)
            VALUES (?, ?, ?, ?)
            RETURNING id
          `,
            [params.conversation_id, senderId, params.content, params.message_type || 'text'],
            { schema: 'messaging', returnLastId: true }
          );

          // Update conversation timestamp
          await adapter.query(
            `
            UPDATE conversations SET updated_at = NOW() WHERE id = ?
          `,
            [params.conversation_id],
            { schema: 'messaging' }
          );

          return insertMessageResult.rows[0].id as number;
        },
        { schema: 'messaging' }
      );

      // Return the created message
      const messageResult = await dbAdapter.query(
        `
        SELECT m.*
        FROM messages m
        WHERE m.id = ?
      `,
        [messageId],
        { schema: 'messaging' }
      );
      const message = messageResult.rows[0] as MessageRow;

      // Fetch sender user data
      const senderData = (await this.fetchUserData([message.sender_id]))[0];

      return {
        id: message.id,
        conversation_id: message.conversation_id,
        sender_id: message.sender_id,
        content: message.content,
        message_type: (message.message_type || 'text') as 'text',
        created_at: message.created_at,
        updated_at: message.updated_at,
        edited_at: message.edited_at,
        is_deleted: Boolean(message.is_deleted),
        sender: senderData
          ? {
              id: senderData.id,
              username: senderData.username,
              display_name: senderData.display_name,
              avatar_url: senderData.avatar_url,
            }
          : {
              id: message.sender_id,
              username: `user_${message.sender_id}`,
              display_name: undefined,
              avatar_url: undefined,
            },
      };
    } catch (error) {
      throw error;
    }
  }

  async markConversationAsRead(conversationId: number, userId: number): Promise<void> {
    try {
      await dbAdapter.query(
        `
        UPDATE conversation_participants
        SET last_read_at = NOW()
        WHERE conversation_id = ? AND user_id = ?
      `,
        [conversationId, userId],
        { schema: 'messaging' }
      );
    } catch (error) {
      throw error;
    }
  }

  async getUserFromRequest(request: NextRequest): Promise<User | null> {
    return await getCurrentUser(request);
  }

  /**
   * Get comprehensive messaging statistics for a user
   * Returns aggregated data about user's messaging activity for ProfileAggregatorService
   */
  async getUserMessagingStats(userId: number): Promise<{
    totalConversations: number;
    totalMessages: number;
    unreadCount: number;
    averageResponseTime?: number;
    recentConversations: ConversationSummary[];
    lastMessageActivity?: string;
  }> {
    try {
      // Get total conversations where user is a participant
      const totalConversationsResult = await dbAdapter.query(
        `
        SELECT COUNT(*) as count
        FROM conversation_participants cp
        WHERE cp.user_id = ? AND cp.is_active = TRUE
      `,
        [userId],
        { schema: 'messaging' }
      );
      const totalConversations =
        (totalConversationsResult.rows[0] as CountRow | undefined)?.count || 0;

      // Get total messages sent by user
      const totalMessagesResult = await dbAdapter.query(
        `
        SELECT COUNT(*) as count
        FROM messages m
        WHERE m.sender_id = ? AND m.is_deleted = FALSE
      `,
        [userId],
        { schema: 'messaging' }
      );
      const totalMessages = (totalMessagesResult.rows[0] as CountRow | undefined)?.count || 0;

      // Get unread message count for user
      const unreadCountResult = await dbAdapter.query(
        `
        SELECT COUNT(*) as count
        FROM messages m
        INNER JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
        WHERE cp.user_id = ?
          AND cp.is_active = TRUE
          AND m.sender_id != ?
          AND m.is_deleted = FALSE
          AND m.created_at > cp.last_read_at
      `,
        [userId, userId],
        { schema: 'messaging' }
      );
      const unreadCount = (unreadCountResult.rows[0] as CountRow | undefined)?.count || 0;

      // Get recent conversations for this user
      const recentConversationsResult = await dbAdapter.query(
        `
        SELECT DISTINCT c.*,
               latest.content as latest_message_content,
               latest.created_at as latest_message_at,
               latest.sender_id as latest_sender_id,
               NULL as latest_sender_username,
               COALESCE(unread.unread_count, 0) as unread_count,
               (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND is_deleted = FALSE) as message_count,
               (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = c.id AND is_active = TRUE) as participant_count,
               COALESCE(latest.created_at, c.updated_at) as sort_order
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        LEFT JOIN (
          SELECT m1.conversation_id, m1.content, m1.created_at, m1.sender_id
          FROM messages m1
          WHERE m1.id = (
            SELECT m2.id FROM messages m2
            WHERE m2.conversation_id = m1.conversation_id
              AND m2.is_deleted = FALSE
            ORDER BY m2.created_at DESC LIMIT 1
          )
        ) latest ON c.id = latest.conversation_id
        LEFT JOIN (
          SELECT conversation_id, COUNT(*) as unread_count
          FROM messages m
          WHERE m.created_at > (
            SELECT cp2.last_read_at FROM conversation_participants cp2
            WHERE cp2.conversation_id = m.conversation_id AND cp2.user_id = ?
          ) AND m.sender_id != ? AND m.is_deleted = FALSE
          GROUP BY conversation_id
        ) unread ON c.id = unread.conversation_id
        WHERE cp.user_id = ? AND cp.is_active = TRUE AND c.is_archived = FALSE
        ORDER BY sort_order DESC
        LIMIT 10
      `,
        [userId, userId, userId],
        { schema: 'messaging' }
      );

      const recentConversations = recentConversationsResult.rows as ConversationWithStatsRow[];

      // Calculate average response time
      let averageResponseTime: number | undefined;
      const responseTimeResult = await dbAdapter.query(
        `
        SELECT
          AVG(EXTRACT(EPOCH FROM (response.created_at - original.created_at)) / 60) as avg_response_time_minutes
        FROM messages original
        INNER JOIN messages response ON original.conversation_id = response.conversation_id
        WHERE response.sender_id = ?
          AND original.sender_id != ?
          AND response.created_at > original.created_at
          AND response.is_deleted = FALSE
          AND original.is_deleted = FALSE
          AND response.created_at = (
            SELECT MIN(created_at)
            FROM messages
            WHERE conversation_id = original.conversation_id
              AND sender_id = ?
              AND created_at > original.created_at
              AND is_deleted = FALSE
          )
      `,
        [userId, userId, userId],
        { schema: 'messaging' }
      );

      const responseTimeData = responseTimeResult.rows[0] as ResponseTimeRow | undefined;
      if (responseTimeData?.avg_response_time_minutes) {
        averageResponseTime = Math.round(responseTimeData.avg_response_time_minutes);
      }

      // Get last message activity timestamp
      let lastMessageActivity: string | undefined;
      const lastActivityResult = await dbAdapter.query(
        `
        SELECT created_at
        FROM messages
        WHERE sender_id = ? AND is_deleted = FALSE
        ORDER BY created_at DESC
        LIMIT 1
      `,
        [userId],
        { schema: 'messaging' }
      );
      const lastActivity = lastActivityResult.rows[0] as LastActivityRow | undefined;
      if (lastActivity) {
        lastMessageActivity = lastActivity.created_at;
      }

      // Format recent conversations
      const formattedRecentConversations = recentConversations.map(
        (conv: ConversationWithStatsRow) => ({
          id: conv.id,
          subject: conv.subject,
          participantCount: conv.participant_count || 0,
          messageCount: conv.message_count || 0,
          lastActivity: conv.latest_message_at || conv.updated_at,
          isArchived: Boolean(conv.is_archived),
          unreadCount: conv.unread_count || 0,
        })
      );

      return {
        totalConversations,
        totalMessages,
        unreadCount,
        averageResponseTime,
        recentConversations: formattedRecentConversations,
        lastMessageActivity,
      };
    } catch (error) {
      logger.error('Error getting user messaging stats:', error);
      throw error;
    }
  }

  /**
   * Fetch user data from the users database
   * @private
   */
  private async fetchUserData(userIds: number[]): Promise<
    Array<{
      id: number;
      username: string;
      display_name?: string;
      avatar_url?: string;
    }>
  > {
    if (userIds.length === 0) return [];

    try {
      // Use ? placeholders for SQLite - adapter converts to $1, $2, etc. for PostgreSQL
      const placeholders = userIds.map(() => '?').join(',');
      const result = await dbAdapter.query(
        `
        SELECT id, username, display_name, avatar_url
        FROM users
        WHERE id IN (${placeholders})
      `,
        userIds,
        { schema: 'users' }
      );
      return result.rows as UserDataRow[];
    } catch (error) {
      logger.error('Error fetching user data:', error);
      // Return minimal user data on error
      return userIds.map(id => ({
        id,
        username: `user_${id}`,
        display_name: undefined,
        avatar_url: undefined,
      }));
    }
  }
}
