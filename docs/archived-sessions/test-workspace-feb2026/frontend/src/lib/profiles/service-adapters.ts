/**
 * Service Adapters for Profile Aggregation
 *
 * These adapters wrap existing services to implement the ProfileAggregation
 * interfaces, providing a clean abstraction layer between the aggregator
 * and the domain services while maintaining type safety.
 *
 * Key Features:
 * - Type-safe adaptation of existing services
 * - Error handling and Result type conversion
 * - Health check implementations
 * - Data transformation and mapping
 * - Cache timestamp tracking
 */

import {
  UserId,
  ServiceType,
  ProfileServiceDependency,
  ForumServiceDependency,
  WikiServiceDependency,
  MessageServiceDependency,
  CoreUserProfile,
  UserPrivacySettings,
  ForumUserStats,
  WikiUserStats,
  MessageUserStats,
  CrossServiceActivity,
  ForumTopicSummary,
  ForumReplySummary,
  WikiEditSummary,
  WikiPageSummary,
  ConversationSummary,
  ServiceError,
  TopicId,
  ReplyId,
  WikiPageId,
  WikiRevisionId,
  ConversationId,
  ActivityType,
  EntityType,
} from '@/types/profile-aggregation';
import { Result } from '@/types/error-handling';

// Import existing services
import { ProfileService } from './service';
// import { ForumService } from '../forums/service'; // Deleted in Phase 1
import { WikiService } from '../wiki/service';
import { MessagingService } from '../messaging/service';

/**
 * Type-safe helper functions for branded type conversions
 */

/**
 * Convert branded UserId to plain number for service calls
 * Since UserId is Branded<number, 'UserId'>, it's structurally a number at runtime
 */
function toNumber(userId: UserId): number {
  return Number(userId);
}

/**
 * Type guard to check if a value is a valid database row result
 */
interface DatabaseRow {
  [key: string]: unknown;
}

/**
 * Type-safe helper to access database row properties
 */
function getRowProperty<T = unknown>(row: DatabaseRow, key: string, defaultValue?: T): T {
  const value = row[key];
  return (value !== undefined && value !== null ? value : defaultValue) as T;
}

/**
 * Adapter for ProfileService to implement ProfileServiceDependency
 */
export class ProfileServiceAdapter implements ProfileServiceDependency {
  readonly serviceName: ServiceType = 'profile';
  private readonly profileService: ProfileService;
  private readonly healthCheckInterval = 30000; // 30 seconds
  private lastHealthCheck = 0;
  private isHealthyCache = true;

  constructor(profileService?: ProfileService) {
    this.profileService = profileService || new ProfileService();
  }

  async getUserProfile(
    userId: UserId,
    viewerId?: UserId
  ): Promise<Result<CoreUserProfile, ServiceError>> {
    try {
      const profileResult = await this.profileService.getUserProfile(userId, viewerId);

      if (!profileResult.isOk()) {
        return Result.error({
          type: 'user_not_found',
          service: 'profile',
          userId,
          message: `User profile not found for ID: ${userId}`,
          retryable: false,
        });
      }

      // The profile service already returns a CoreUserProfile, so we can return it directly
      return Result.ok(profileResult.value);
    } catch (error) {
      return Result.error({
        type: 'query_execution',
        service: 'profile',
        query: 'getUserProfile',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      });
    }
  }

  async getUserPrivacySettings(userId: UserId): Promise<Result<UserPrivacySettings, ServiceError>> {
    try {
      const settings = await this.profileService.getUserPrivacySettings(userId);

      // Type the settings response from ProfileService
      interface PrivacySettingsRow {
        profile_visibility?: 'public' | 'members' | 'private';
        activity_visibility?: 'public' | 'members' | 'private';
        email_visibility?: 'public' | 'members' | 'admin' | 'private';
        show_online_status?: boolean;
        show_last_active?: boolean;
        allow_messages?: boolean;
        show_reputation_details?: boolean;
        show_forum_activity?: boolean;
        show_wiki_activity?: boolean;
      }

      const typedSettings = settings as PrivacySettingsRow;

      const privacySettings: UserPrivacySettings = {
        profileVisibility: typedSettings.profile_visibility || 'public',
        activityVisibility: typedSettings.activity_visibility || 'public',
        emailVisibility: typedSettings.email_visibility || 'private',
        showOnlineStatus: typedSettings.show_online_status || false,
        showLastActive: typedSettings.show_last_active || false,
        allowMessages: typedSettings.allow_messages || true,
        showReputationDetails: typedSettings.show_reputation_details || true,
        showForumActivity: typedSettings.show_forum_activity || true,
        showWikiActivity: typedSettings.show_wiki_activity || true,
        showMessagingActivity: true, // Default since not in original interface
      };

      return Result.ok(privacySettings);
    } catch (error) {
      return Result.error({
        type: 'query_execution',
        service: 'profile',
        query: 'getUserPrivacySettings',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      });
    }
  }

  async getUserActivities(
    userId: UserId,
    limit = 20
  ): Promise<Result<readonly CrossServiceActivity[], ServiceError>> {
    try {
      const activities = await this.profileService.getUserActivities(userId, limit);

      // Type the activity rows from ProfileService
      interface ActivityRow {
        id: number;
        action: string;
        entity_type: string;
        entity_id: string;
        entity_title?: string | null;
        entity_url?: string | null;
        timestamp: string;
        metadata?: Record<string, unknown>;
      }

      const typedActivities = activities as unknown as ActivityRow[];

      const crossServiceActivities: CrossServiceActivity[] = typedActivities.map(activity => ({
        id: `profile:${activity.id}`,
        service: 'profile' as const,
        activityType: this.mapActivityType(activity.action),
        entityType: this.mapEntityType(activity.entity_type),
        entityId: activity.entity_id,
        entityTitle: activity.entity_title || undefined,
        entityUrl: activity.entity_url || undefined,
        action: activity.action,
        timestamp: activity.timestamp,
        metadata: activity.metadata,
      }));

      return Result.ok(crossServiceActivities);
    } catch (error) {
      return Result.error({
        type: 'query_execution',
        service: 'profile',
        query: 'getUserActivities',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      });
    }
  }

  async getUserStats(userId: UserId): Promise<Result<CoreUserProfile, ServiceError>> {
    return this.getUserProfile(userId);
  }

  async isHealthy(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.isHealthyCache;
    }

    try {
      // Perform a simple query to check database connectivity
      const testResult = await this.profileService.getUserProfile(1 as UserId);
      this.isHealthyCache = true;
      this.lastHealthCheck = now;
      return true;
    } catch (error) {
      this.isHealthyCache = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  async getLastUpdateTime(userId: UserId): Promise<string | null> {
    try {
      const profileResult = await this.profileService.getUserProfile(userId);
      if (profileResult.isOk()) {
        const profile = profileResult.value;
        return profile.lastActive || null;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private mapActivityType(action: string): ActivityType {
    switch (action.toLowerCase()) {
      case 'create':
      case 'created':
        return 'create';
      case 'update':
      case 'updated':
      case 'edit':
      case 'edited':
        return 'update';
      case 'delete':
      case 'deleted':
        return 'delete';
      case 'view':
      case 'viewed':
        return 'view';
      default:
        return 'update';
    }
  }

  private mapEntityType(entityType: string): EntityType {
    switch (entityType.toLowerCase()) {
      case 'forum_topic':
        return 'topic';
      case 'forum_reply':
        return 'reply';
      case 'wiki_page':
        return 'wiki_page';
      case 'wiki_revision':
        return 'wiki_revision';
      case 'conversation':
        return 'conversation';
      case 'message':
        return 'message';
      default:
        return 'user';
    }
  }
}

/**
 * Adapter for ForumService to implement ForumServiceDependency
 * NOTE: ForumService was deleted in Phase 1, this adapter returns mock data
 */
export class ForumServiceAdapter implements ForumServiceDependency {
  readonly serviceName: ServiceType = 'forum';
  // private readonly forumService: ForumService; // Deleted in Phase 1
  private lastHealthCheck = 0;
  private isHealthyCache = true;

  constructor(_forumService?: never) {
    // ForumService was deleted in Phase 1
    // This parameter is kept for API compatibility but is unused
  }

  async getUserForumStats(userId: UserId): Promise<Result<ForumUserStats, ServiceError>> {
    // ForumService was deleted in Phase 1, return empty stats
    const forumStats: ForumUserStats = {
      userId,
      totalTopics: 0,
      totalReplies: 0,
      totalVotesReceived: 0,
      solutionsProvided: 0,
      recentTopics: [],
      recentReplies: [],
      averageReplyTime: undefined,
      mostActiveCategory: undefined,
      lastForumActivity: undefined,
    };

    return Result.ok(forumStats);
  }

  async getRecentTopics(
    userId: UserId,
    limit = 5
  ): Promise<Result<readonly ForumTopicSummary[], ServiceError>> {
    // ForumService was deleted in Phase 1, return empty array
    return Result.ok([]);
  }

  async getRecentReplies(
    userId: UserId,
    limit = 5
  ): Promise<Result<readonly ForumReplySummary[], ServiceError>> {
    try {
      // This would need to be implemented in the ForumService
      // For now, return empty array
      return Result.ok([]);
    } catch (error) {
      return Result.error({
        type: 'query_execution',
        service: 'forum',
        query: 'getRecentReplies',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      });
    }
  }

  async getUserStats(userId: UserId): Promise<Result<ForumUserStats, ServiceError>> {
    return this.getUserForumStats(userId);
  }

  async isHealthy(): Promise<boolean> {
    // ForumService was deleted in Phase 1
    return true;
  }

  async getLastUpdateTime(userId: UserId): Promise<string | null> {
    // ForumService was deleted in Phase 1
    return null;
  }

  private mapTopicSummary = (topic: DatabaseRow): ForumTopicSummary => ({
    id: getRowProperty<number>(topic, 'id') as TopicId,
    title: getRowProperty<string>(topic, 'title', ''),
    replyCount: getRowProperty<number>(topic, 'reply_count', 0),
    viewCount: getRowProperty<number>(topic, 'view_count', 0),
    createdAt: getRowProperty<string>(topic, 'created_at', ''),
    isSolved: Boolean(getRowProperty<boolean>(topic, 'is_solved', false)),
    categoryName: getRowProperty<string>(topic, 'category_name', ''),
  });

  private mapReplySummary = (reply: DatabaseRow): ForumReplySummary => ({
    id: getRowProperty<number>(reply, 'id') as ReplyId,
    topicId: getRowProperty<number>(reply, 'topic_id') as TopicId,
    topicTitle: getRowProperty<string>(reply, 'topic_title', ''),
    createdAt: getRowProperty<string>(reply, 'created_at', ''),
    isSolution: Boolean(getRowProperty<boolean>(reply, 'is_solution', false)),
    voteScore: getRowProperty<number>(reply, 'vote_score', 0),
  });
}

/**
 * Adapter for WikiService to implement WikiServiceDependency
 */
export class WikiServiceAdapter implements WikiServiceDependency {
  readonly serviceName: ServiceType = 'wiki';
  private readonly wikiService: WikiService;
  private lastHealthCheck = 0;
  private isHealthyCache = true;

  constructor(wikiService?: WikiService) {
    this.wikiService = wikiService || new WikiService();
  }

  async getUserWikiStats(userId: UserId): Promise<Result<WikiUserStats, ServiceError>> {
    try {
      // This would need to be implemented in the WikiService
      // For now, return basic stats
      const stats: WikiUserStats = {
        userId,
        totalPagesCreated: 0,
        totalEdits: 0,
        totalRevisions: 0,
        pagesViewed: 0,
        recentEdits: [],
        createdPages: [],
        mostEditedPages: [],
      };

      return Result.ok(stats);
    } catch (error) {
      return Result.error({
        type: 'query_execution',
        service: 'wiki',
        query: 'getUserWikiStats',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      });
    }
  }

  async getRecentEdits(
    userId: UserId,
    limit = 5
  ): Promise<Result<readonly WikiEditSummary[], ServiceError>> {
    try {
      // This would need to be implemented in the WikiService
      return Result.ok([]);
    } catch (error) {
      return Result.error({
        type: 'query_execution',
        service: 'wiki',
        query: 'getRecentEdits',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      });
    }
  }

  async getCreatedPages(
    userId: UserId,
    limit = 5
  ): Promise<Result<readonly WikiPageSummary[], ServiceError>> {
    try {
      // This would need to be implemented in the WikiService
      return Result.ok([]);
    } catch (error) {
      return Result.error({
        type: 'query_execution',
        service: 'wiki',
        query: 'getCreatedPages',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      });
    }
  }

  async getUserStats(userId: UserId): Promise<Result<WikiUserStats, ServiceError>> {
    return this.getUserWikiStats(userId);
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.wikiService.getWikiStats();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getLastUpdateTime(userId: UserId): Promise<string | null> {
    return null; // Would need to be implemented
  }
}

/**
 * Adapter for MessagingService to implement MessageServiceDependency
 */
export class MessageServiceAdapter implements MessageServiceDependency {
  readonly serviceName: ServiceType = 'messaging';
  private readonly messagingService: MessagingService;
  private lastHealthCheck = 0;
  private isHealthyCache = true;

  constructor(messagingService?: MessagingService) {
    this.messagingService = messagingService || new MessagingService();
  }

  async getUserMessageStats(userId: UserId): Promise<Result<MessageUserStats, ServiceError>> {
    try {
      const conversations = await this.messagingService.getUserConversations(toNumber(userId), 100);

      // Type the conversation response
      interface ConversationRow extends DatabaseRow {
        id: number;
        subject: string;
        participants?: unknown[];
        updated_at: string;
        is_archived?: boolean;
        unread_count?: number;
      }

      const typedConversations = conversations as unknown as ConversationRow[];

      let totalMessages = 0;
      let unreadCount = 0;

      for (const conversation of typedConversations) {
        // This is an approximation - would need proper message counting
        totalMessages += 1; // Each conversation contributes at least 1 message
        unreadCount += conversation.unread_count || 0;
      }

      const stats: MessageUserStats = {
        userId,
        totalConversations: typedConversations.length,
        totalMessages,
        unreadCount,
        recentConversations: typedConversations.slice(0, 5).map(this.mapConversationSummary),
      };

      return Result.ok(stats);
    } catch (error) {
      return Result.error({
        type: 'query_execution',
        service: 'messaging',
        query: 'getUserMessageStats',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      });
    }
  }

  async getRecentConversations(
    userId: UserId,
    limit = 5
  ): Promise<Result<readonly ConversationSummary[], ServiceError>> {
    try {
      const conversations = await this.messagingService.getUserConversations(
        toNumber(userId),
        limit
      );

      // Type the conversation response
      interface ConversationRow extends DatabaseRow {
        id: number;
        subject: string;
        participants?: unknown[];
        updated_at: string;
        is_archived?: boolean;
        unread_count?: number;
      }

      const typedConversations = conversations as unknown as ConversationRow[];
      const summaries = typedConversations.map(this.mapConversationSummary);
      return Result.ok(summaries);
    } catch (error) {
      return Result.error({
        type: 'query_execution',
        service: 'messaging',
        query: 'getRecentConversations',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      });
    }
  }

  async getUserStats(userId: UserId): Promise<Result<MessageUserStats, ServiceError>> {
    return this.getUserMessageStats(userId);
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Simple health check - try to get conversations for user 1
      await this.messagingService.getUserConversations(1, 1);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getLastUpdateTime(userId: UserId): Promise<string | null> {
    try {
      const conversations = await this.messagingService.getUserConversations(toNumber(userId), 1);

      // Type the conversation response
      interface ConversationRow {
        updated_at: string;
      }

      const typedConversations = conversations as unknown as ConversationRow[];
      return typedConversations.length > 0 ? (typedConversations[0]?.updated_at ?? null) : null;
    } catch (error) {
      return null;
    }
  }

  private mapConversationSummary = (conversation: DatabaseRow): ConversationSummary => {
    interface ParticipantArray {
      length: number;
    }

    return {
      id: getRowProperty<number>(conversation, 'id') as ConversationId,
      subject: getRowProperty<string>(conversation, 'subject', ''),
      participantCount: (conversation.participants as ParticipantArray | undefined)?.length || 2,
      messageCount: 1, // Would need proper implementation
      lastActivity: getRowProperty<string>(conversation, 'updated_at', ''),
      isArchived: Boolean(getRowProperty<boolean>(conversation, 'is_archived', false)),
      unreadCount: getRowProperty<number>(conversation, 'unread_count', 0),
    };
  };
}

/**
 * Factory function to create service dependencies with adapters
 */
export function createServiceDependencies(): {
  profile: ProfileServiceAdapter;
  forum: ForumServiceAdapter;
  wiki: WikiServiceAdapter;
  messaging: MessageServiceAdapter;
} {
  return {
    profile: new ProfileServiceAdapter(),
    forum: new ForumServiceAdapter(),
    wiki: new WikiServiceAdapter(),
    messaging: new MessageServiceAdapter(),
  };
}

/**
 * Type guard functions for service validation
 */
export const serviceTypeGuards = {
  isServiceType(value: unknown): value is ServiceType {
    return typeof value === 'string' && ['profile', 'forum', 'wiki', 'messaging'].includes(value);
  },

  isUserId(value: unknown): value is UserId {
    return typeof value === 'number' && value > 0;
  },

  isValidServiceDependencies(deps: unknown): deps is {
    profile: ProfileServiceAdapter;
    forum: ForumServiceAdapter;
    wiki: WikiServiceAdapter;
    messaging: MessageServiceAdapter;
  } {
    if (!deps || typeof deps !== 'object') return false;

    interface ServiceDependencies {
      profile?: {
        getUserProfile?: unknown;
      };
      forum?: {
        getUserForumStats?: unknown;
      };
      wiki?: {
        getUserWikiStats?: unknown;
      };
      messaging?: {
        getUserMessageStats?: unknown;
      };
    }

    const services = deps as ServiceDependencies;
    return (
      !!services.profile &&
      !!services.forum &&
      !!services.wiki &&
      !!services.messaging &&
      typeof services.profile.getUserProfile === 'function' &&
      typeof services.forum.getUserForumStats === 'function' &&
      typeof services.wiki.getUserWikiStats === 'function' &&
      typeof services.messaging.getUserMessageStats === 'function'
    );
  },
};
