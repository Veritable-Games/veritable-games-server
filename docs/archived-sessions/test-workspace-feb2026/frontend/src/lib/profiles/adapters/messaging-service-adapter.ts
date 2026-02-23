import { MessagingService } from '@/lib/messaging/service';
import {
  MessageServiceDependency,
  MessageUserStats,
  ConversationSummary,
  UserId,
  ServiceError,
  ServiceType,
} from '@/types/profile-aggregation';
import { Result, Ok, Err } from '@/lib/utils/result';
import { Result as ResultClass } from '@/types/error-handling';
import { logger } from '@/lib/utils/logger';

/**
 * MessagingServiceAdapter - Adapter that wraps existing MessagingService
 *
 * This adapter implements the MessageServiceDependency interface by wrapping
 * the existing MessagingService and converting its data formats to match the
 * ProfileAggregatorService contracts.
 */
export class MessagingServiceAdapter implements MessageServiceDependency {
  readonly serviceName: ServiceType = 'messaging';
  private messagingService: MessagingService;

  constructor() {
    this.messagingService = new MessagingService();
  }

  /**
   * Health check implementation
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Test basic messaging service functionality by creating a test instance
      const service = new MessagingService();
      return true; // If instantiation succeeds, service is healthy
    } catch (error) {
      logger.error('MessagingServiceAdapter health check failed:', error);
      return false;
    }
  }

  /**
   * Get last update time for user's messaging data
   */
  async getLastUpdateTime(userId: UserId): Promise<string | null> {
    try {
      const userIdNum = Number(userId);

      // Get user's conversations to find most recent activity
      const conversations = await this.messagingService.getUserConversations(userIdNum, 1);

      if (conversations.length > 0 && conversations[0]?.latest_message) {
        return conversations[0].latest_message.created_at;
      }

      return null;
    } catch (error) {
      logger.error('Error getting messaging last update time:', error);
      return null;
    }
  }

  /**
   * Get user stats (delegates to getUserMessageStats)
   */
  async getUserStats(userId: UserId): Promise<ResultClass<MessageUserStats, ServiceError>> {
    const result = await this.getUserMessageStats(userId);
    if (result.isOk()) {
      return ResultClass.ok(result.value);
    } else {
      return ResultClass.error(result.error);
    }
  }

  /**
   * Get comprehensive messaging statistics for a user
   */
  async getUserMessageStats(userId: UserId): Promise<ResultClass<MessageUserStats, ServiceError>> {
    try {
      const userIdNum = Number(userId);

      // Get user's conversations
      const conversations = await this.messagingService.getUserConversations(userIdNum, 50);

      // Calculate total conversations
      const totalConversations = conversations.length;

      // Calculate total messages (sum of messages in each conversation)
      let totalMessages = 0;
      let unreadCount = 0;

      for (const conversation of conversations) {
        // Get messages count for each conversation
        try {
          const messages = await this.messagingService.getConversationMessages(
            conversation.id,
            userIdNum,
            1000 // Large limit to count all messages
          );
          totalMessages += messages.length;
        } catch (error) {
          logger.error(`Error counting messages for conversation ${conversation.id}:`, error);
        }

        // Add unread count
        unreadCount += conversation.unread_count || 0;
      }

      // Get recent conversations
      const recentConversationsResult = await this.getRecentConversations(userId, 10);
      const recentConversations = recentConversationsResult.isOk()
        ? recentConversationsResult.value
        : [];

      // Calculate average response time (simplified)
      let averageResponseTime: number | undefined;
      if (conversations.length > 1) {
        const times = conversations
          .filter(conv => conv.latest_message)
          .map(conv => new Date(conv.latest_message?.created_at || '').getTime())
          .filter(time => !isNaN(time))
          .sort((a, b) => a - b);

        if (times.length > 1) {
          const lastTime = times[times.length - 1];
          const firstTime = times[0];
          if (lastTime !== undefined && firstTime !== undefined) {
            const totalTime = lastTime - firstTime;
            averageResponseTime = Math.round(totalTime / (times.length - 1) / (1000 * 60)); // minutes
          }
        }
      }

      // Get last message activity timestamp
      let lastMessageActivity: string | undefined;
      if (conversations.length > 0 && conversations[0]?.latest_message) {
        lastMessageActivity = conversations[0].latest_message.created_at;
      }

      const messageStats: MessageUserStats = {
        userId,
        totalConversations,
        totalMessages,
        unreadCount,
        recentConversations,
        averageResponseTime,
        lastMessageActivity,
      };

      return ResultClass.ok(messageStats);
    } catch (error) {
      logger.error('Error getting messaging user stats:', error);
      return ResultClass.error({
        type: 'database_connection' as const,
        service: 'messaging' as const,
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryable: true,
      } as ServiceError);
    }
  }

  /**
   * Get recent conversations for user
   */
  async getRecentConversations(
    userId: UserId,
    limit = 10
  ): Promise<ResultClass<readonly ConversationSummary[], ServiceError>> {
    try {
      const userIdNum = Number(userId);

      const conversations = await this.messagingService.getUserConversations(userIdNum, limit);

      const conversationSummaries: ConversationSummary[] = await Promise.all(
        conversations.map(async conversation => {
          // Get message count for this conversation
          let messageCount = 0;
          try {
            const messages = await this.messagingService.getConversationMessages(
              conversation.id,
              userIdNum,
              1000 // Large limit to count all
            );
            messageCount = messages.length;
          } catch (error) {
            logger.error(`Error counting messages for conversation ${conversation.id}:`, error);
          }

          // Get participant count
          const participantCount = conversation.participants?.length || 0;

          // Determine last activity timestamp
          const lastActivity = conversation.latest_message?.created_at || conversation.updated_at;

          return {
            id: conversation.id as ConversationSummary['id'],
            subject: conversation.subject,
            participantCount,
            messageCount,
            lastActivity,
            isArchived: conversation.is_archived,
            unreadCount: conversation.unread_count || 0,
          };
        })
      );

      return ResultClass.ok(conversationSummaries);
    } catch (error) {
      logger.error('Error getting recent conversations:', error);
      return ResultClass.error({
        type: 'database_connection' as const,
        service: 'messaging' as const,
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryable: true,
      } as ServiceError);
    }
  }
}
