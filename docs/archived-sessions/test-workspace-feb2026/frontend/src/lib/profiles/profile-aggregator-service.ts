import {
  ProfileAggregatorService,
  ProfileAggregatorFactory,
  ServiceDependencies,
  ProfileAggregatorConfig,
  AggregatedUserProfile,
  UserStatsSummary,
  UserActivitySummary,
  ServiceHealthStatus,
  UserId,
  AggregationError,
  ServiceHealthInfo,
  HealthStatus,
  ServiceType,
  OverallUserStats,
  ReputationBreakdown,
  CrossServiceActivity,
  ActivityTimelineEntry,
  ForumUserStats,
  WikiUserStats,
  MessageUserStats,
} from '@/types/profile-aggregation';
import { Result, Ok, Err } from '@/types/error-handling';
import { logger } from '@/lib/utils/logger';

/**
 * Default configuration for the ProfileAggregatorService
 */
const DEFAULT_CONFIG: ProfileAggregatorConfig = {
  cache: {
    enabled: true,
    ttl: 300, // 5 minutes
    maxSize: 1000,
    compression: false,
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    timeoutThreshold: 10000, // 10 seconds
    resetTimeout: 60, // 1 minute
  },
  timeout: {
    profile: 5000,
    forum: 3000,
    wiki: 3000,
    messaging: 3000,
    aggregation: 15000,
  },
  retry: {
    enabled: true,
    maxAttempts: 3,
    backoffMultiplier: 1.5,
    jitter: true,
  },
  privacy: {
    respectPrivacySettings: true,
    defaultVisibility: 'public',
    adminOverride: false,
  },
};

/**
 * ProfileAggregatorServiceImpl - Main implementation of profile data aggregation
 */
export class ProfileAggregatorServiceImpl implements ProfileAggregatorService {
  private dependencies: ServiceDependencies;
  private config: ProfileAggregatorConfig;

  constructor(dependencies: ServiceDependencies, config: Partial<ProfileAggregatorConfig> = {}) {
    this.dependencies = dependencies;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get complete aggregated profile for a user
   */
  async getAggregatedProfile(
    userId: UserId,
    viewerId?: UserId
  ): Promise<Result<AggregatedUserProfile, AggregationError>> {
    try {
      const aggregatedAt = new Date().toISOString();

      // Get core profile data first
      const coreResult = await this.dependencies.profile.getUserProfile(userId, viewerId);
      if (!coreResult.isOk()) {
        return Err({
          type: 'partial_aggregation' as const,
          successfulServices: [],
          failedServices: new Map([['profile' as ServiceType, coreResult.error]]),
          message: 'Failed to get core profile data',
        } as AggregationError);
      }

      // Get privacy settings
      const privacyResult = await this.dependencies.profile.getUserPrivacySettings(userId);
      const privacy = privacyResult.isOk()
        ? privacyResult.value
        : {
            profileVisibility: 'public' as const,
            activityVisibility: 'public' as const,
            emailVisibility: 'private' as const,
            showOnlineStatus: true,
            showLastActive: true,
            allowMessages: true,
            showReputationDetails: true,
            showForumActivity: true,
            showWikiActivity: true,
            showMessagingActivity: true,
          };

      // Get stats from all services
      const statsResult = await this.getProfileStats(userId, viewerId);
      const stats = statsResult.isOk()
        ? statsResult.value
        : {
            forum: {
              userId,
              totalTopics: 0,
              totalReplies: 0,
              totalVotesReceived: 0,
              solutionsProvided: 0,
              recentTopics: [],
              recentReplies: [],
            },
            wiki: {
              userId,
              totalPagesCreated: 0,
              totalEdits: 0,
              totalRevisions: 0,
              pagesViewed: 0,
              recentEdits: [],
              createdPages: [],
              mostEditedPages: [],
            },
            messaging: {
              userId,
              totalConversations: 0,
              totalMessages: 0,
              unreadCount: 0,
              recentConversations: [],
            },
            overall: {
              totalContributions: 0,
              reputationBreakdown: {
                total: 0,
                forumPosts: 0,
                wikiEdits: 0,
                helpfulVotes: 0,
                solutions: 0,
                other: 0,
              },
              activityScore: 0,
              joinedDaysAgo: 0,
              averageDailyActivity: 0,
            },
          };

      // Get activities
      const activitiesResult = await this.getProfileActivities(userId, viewerId, 20);
      const activities = activitiesResult.isOk()
        ? activitiesResult.value
        : {
            recentActivities: [],
            activityTimeline: [],
            dailyActivityCounts: new Map(),
          };

      const aggregatedProfile: AggregatedUserProfile = {
        core: coreResult.value,
        stats,
        activities,
        privacy,
        aggregatedAt,
        cacheExpiry: new Date(Date.now() + this.config.cache.ttl * 1000).toISOString(),
      };

      return Ok(aggregatedProfile);
    } catch (error) {
      logger.error('Error aggregating profile:', error);
      return Err({
        type: 'partial_aggregation' as const,
        successfulServices: [],
        failedServices: new Map(),
        message: `Aggregation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      } as AggregationError);
    }
  }

  /**
   * Refresh profile cache (placeholder - no actual cache implementation yet)
   */
  async refreshProfileCache(userId: UserId): Promise<Result<void, AggregationError>> {
    // TODO: Implement cache invalidation when caching is added
    return Ok(undefined);
  }

  /**
   * Get aggregated statistics from all services
   * Note: Currently returns empty stats as UI components have been removed
   */
  async getProfileStats(
    userId: UserId,
    viewerId?: UserId
  ): Promise<Result<UserStatsSummary, AggregationError>> {
    try {
      const successfulServices: ServiceType[] = [];
      const failedServices = new Map<ServiceType, any>();

      // Get stats from each service
      const [forumResult, wikiResult, messagingResult] = await Promise.allSettled([
        this.dependencies.forum?.getUserForumStats(userId) ??
          Promise.resolve(
            Err({
              type: 'service_unavailable' as const,
              service: 'forum' as ServiceType,
              message: 'Forum service not available',
              retryable: false,
            })
          ),
        this.dependencies.wiki.getUserWikiStats(userId),
        this.dependencies.messaging.getUserMessageStats(userId),
      ]);

      // Process forum stats
      let forumStats: ForumUserStats = {
        userId,
        totalTopics: 0,
        totalReplies: 0,
        totalVotesReceived: 0,
        solutionsProvided: 0,
        recentTopics: [],
        recentReplies: [],
      };

      if (forumResult.status === 'fulfilled' && forumResult.value.isOk()) {
        const stats = forumResult.value.value;
        forumStats = {
          userId,
          totalTopics: stats.totalTopics || 0,
          totalReplies: stats.totalReplies || 0,
          totalVotesReceived: stats.totalVotesReceived || 0,
          solutionsProvided: stats.solutionsProvided || 0,
          recentTopics: stats.recentTopics || [],
          recentReplies: stats.recentReplies || [],
        };
        successfulServices.push('forum');
      } else {
        failedServices.set(
          'forum',
          forumResult.status === 'fulfilled' ? forumResult.value.error : forumResult.reason
        );
      }

      // Process wiki stats
      let wikiStats: WikiUserStats = {
        userId,
        totalPagesCreated: 0,
        totalEdits: 0,
        totalRevisions: 0,
        pagesViewed: 0,
        recentEdits: [],
        createdPages: [],
        mostEditedPages: [],
      };

      if (wikiResult.status === 'fulfilled' && wikiResult.value.isOk()) {
        const stats = wikiResult.value.value; // Unwrap the Result
        wikiStats = {
          userId,
          totalPagesCreated: stats.totalPagesCreated || 0,
          totalEdits: stats.totalEdits || 0,
          totalRevisions: stats.totalRevisions || 0,
          pagesViewed: stats.pagesViewed || 0,
          recentEdits: [...(stats.recentEdits || [])],
          createdPages: [...(stats.createdPages || [])],
          mostEditedPages: [...(stats.mostEditedPages || [])],
        };
        successfulServices.push('wiki');
      } else {
        const error =
          wikiResult.status === 'fulfilled' ? wikiResult.value.error : wikiResult.reason;
        failedServices.set('wiki', error);
      }

      // Process messaging stats
      let messagingStats: MessageUserStats = {
        userId,
        totalConversations: 0,
        totalMessages: 0,
        unreadCount: 0,
        recentConversations: [],
      };

      if (messagingResult.status === 'fulfilled' && messagingResult.value.isOk()) {
        const stats = messagingResult.value.value; // Unwrap the Result
        messagingStats = {
          userId,
          totalConversations: stats.totalConversations || 0,
          totalMessages: stats.totalMessages || 0,
          unreadCount: stats.unreadCount || 0,
          recentConversations: [...(stats.recentConversations || [])],
        };
        successfulServices.push('messaging');
      } else {
        const error =
          messagingResult.status === 'fulfilled'
            ? messagingResult.value.error
            : messagingResult.reason;
        failedServices.set('messaging', error);
      }

      // Calculate overall stats from aggregated data
      const totalContributions =
        forumStats.totalTopics + forumStats.totalReplies + wikiStats.totalEdits;

      const overallStats: OverallUserStats = {
        totalContributions,
        reputationBreakdown: {
          total: 0, // TODO: Implement reputation calculation
          forumPosts: forumStats.totalTopics + forumStats.totalReplies,
          wikiEdits: wikiStats.totalEdits,
          helpfulVotes: forumStats.totalVotesReceived,
          solutions: forumStats.solutionsProvided,
          other: 0,
        },
        activityScore: totalContributions, // Simple activity score based on contributions
        joinedDaysAgo: 0, // TODO: Calculate from user creation date
        averageDailyActivity: 0, // TODO: Calculate based on joinedDaysAgo
      };

      const statsSummary: UserStatsSummary = {
        forum: forumStats,
        wiki: wikiStats,
        messaging: messagingStats,
        overall: overallStats,
      };

      return Ok(statsSummary);
    } catch (error) {
      logger.error('Error getting profile stats:', error);
      return Err({
        type: 'partial_aggregation' as const,
        successfulServices: [],
        failedServices: new Map(),
        message: `Stats aggregation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      } as AggregationError);
    }
  }

  /**
   * Get aggregated activities from all services
   * Note: Currently returns empty activities as UI components have been removed
   */
  async getProfileActivities(
    userId: UserId,
    viewerId?: UserId,
    limit = 20
  ): Promise<Result<UserActivitySummary, AggregationError>> {
    try {
      // Skip actual service calls - components removed
      /*
      // Get activities from profile service (unified activity log)
      const activitiesResult = await this.dependencies.profile.getUserActivities(userId, limit);

      const activities = activitiesResult.isOk() ? activitiesResult.value : [];

      // Sort activities by timestamp
      const sortedActivities = [...activities].sort(
        (a, b) => {
          const aTime = new Date(a.timestamp ?? new Date().toISOString()).getTime();
          const bTime = new Date(b.timestamp ?? new Date().toISOString()).getTime();
          return bTime - aTime;
        }
      );

      // Create activity timeline
      const timelineMap = new Map<string, CrossServiceActivity[]>();
      const dailyCountsMap = new Map<string, number>();

      for (const activity of sortedActivities) {
        const timestamp = activity.timestamp ?? new Date().toISOString();
        const date = new Date(timestamp).toISOString().split('T')[0];

        // Add to timeline
        if (!timelineMap.has(date)) {
          timelineMap.set(date, []);
        }
        timelineMap.get(date)!.push(activity);

        // Count daily activities
        dailyCountsMap.set(date, (dailyCountsMap.get(date) || 0) + 1);
      }

      // Convert timeline map to array
      const activityTimeline: ActivityTimelineEntry[] = Array.from(timelineMap.entries())
        .map(([date, activities]) => ({
          date,
          activities,
          totalCount: activities.length,
          serviceBreakdown: activities.reduce((acc, activity) => {
            acc[activity.service] = (acc[activity.service] || 0) + 1;
            return acc;
          }, {} as Record<ServiceType, number>),
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
      */

      // Return empty activities - UI components removed
      const activitySummary: UserActivitySummary = {
        recentActivities: [],
        activityTimeline: [],
        dailyActivityCounts: new Map(),
      };

      return Ok(activitySummary);
    } catch (error) {
      logger.error('Error getting profile activities:', error);
      return Err({
        type: 'partial_aggregation' as const,
        successfulServices: [],
        failedServices: new Map(),
        message: `Activities aggregation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      } as AggregationError);
    }
  }

  /**
   * Validate health of all services
   */
  async validateServiceHealth(): Promise<ServiceHealthStatus> {
    const checkedAt = new Date().toISOString();
    const services = new Map<ServiceType, ServiceHealthInfo>();

    // Check each service health
    const healthChecks = await Promise.allSettled([
      this.checkServiceHealth('profile', this.dependencies.profile),
      ...(this.dependencies.forum
        ? [this.checkServiceHealth('forum', this.dependencies.forum)]
        : []),
      this.checkServiceHealth('wiki', this.dependencies.wiki),
      this.checkServiceHealth('messaging', this.dependencies.messaging),
    ]);

    for (const result of healthChecks) {
      if (result.status === 'fulfilled') {
        services.set(result.value.service, result.value.info);
      }
    }

    // Determine overall health
    const healthValues = Array.from(services.values());
    let overall: HealthStatus = 'healthy';

    if (healthValues.some(info => info.status === 'unhealthy')) {
      overall = 'unhealthy';
    } else if (healthValues.some(info => info.status === 'degraded')) {
      overall = 'degraded';
    } else if (healthValues.some(info => info.status === 'unknown')) {
      overall = 'unknown';
    }

    return {
      overall,
      services,
      checkedAt,
    };
  }

  /**
   * Check health of a specific service
   */
  private async checkServiceHealth(
    serviceName: ServiceType,
    service: any
  ): Promise<{ service: ServiceType; info: ServiceHealthInfo }> {
    const startTime = Date.now();

    try {
      const isHealthy = await service.isHealthy();
      const responseTime = Date.now() - startTime;

      return {
        service: serviceName,
        info: {
          status: isHealthy ? 'healthy' : 'unhealthy',
          responseTime,
          errorCount: 0,
          uptime: 100,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        service: serviceName,
        info: {
          status: 'unhealthy',
          responseTime,
          lastError: {
            type: 'service_unavailable',
            service: serviceName,
            message: error instanceof Error ? error.message : 'Unknown error',
            retryable: true,
          },
          errorCount: 1,
          uptime: 0,
        },
      };
    }
  }
}

/**
 * ProfileAggregatorFactory implementation
 */
export class ProfileAggregatorFactoryImpl implements ProfileAggregatorFactory {
  create(
    dependencies: ServiceDependencies,
    config?: Partial<ProfileAggregatorConfig>
  ): ProfileAggregatorService {
    return new ProfileAggregatorServiceImpl(dependencies, config);
  }

  createWithDefaults(dependencies: ServiceDependencies): ProfileAggregatorService {
    return new ProfileAggregatorServiceImpl(dependencies, DEFAULT_CONFIG);
  }
}

// Export factory instance
export const profileAggregatorFactory = new ProfileAggregatorFactoryImpl();
