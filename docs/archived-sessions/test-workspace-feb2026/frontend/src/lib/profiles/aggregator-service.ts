/**
 * ProfileAggregatorService - Service Coordination and Data Aggregation
 *
 * This service coordinates data aggregation across multiple domain services
 * while maintaining proper separation of concerns and type safety. It uses
 * dependency injection to avoid direct database access and implements
 * the circuit breaker pattern for resilience.
 *
 * Key Features:
 * - Type-safe service coordination
 * - Circuit breaker pattern for fault tolerance
 * - Caching with TTL support
 * - Privacy-aware data aggregation
 * - Comprehensive error handling
 * - Performance monitoring and metrics
 */

import {
  UserId,
  AggregatedUserProfile,
  UserStatsSummary,
  UserActivitySummary,
  ServiceDependencies,
  ProfileAggregatorService,
  ProfileAggregatorConfig,
  AggregationError,
  ServiceError,
  ServiceType,
  ProfileCacheService,
  ServiceHealthStatus,
  AggregationMetrics,
  PartialAggregationError,
  CircuitBreakerError,
  CoreUserProfile,
  UserPrivacySettings,
  ForumUserStats,
  WikiUserStats,
  MessageUserStats,
  OverallUserStats,
  CrossServiceActivity,
  ActivityTimelineEntry,
} from '@/types/profile-aggregation';
import { Result, Ok, Err } from '@/types/error-handling';

/**
 * Default configuration for the ProfileAggregatorService
 */
export const DEFAULT_AGGREGATOR_CONFIG: ProfileAggregatorConfig = {
  cache: {
    enabled: true,
    ttl: 300, // 5 minutes
    maxSize: 1000,
    compression: true,
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    timeoutThreshold: 5000, // 5 seconds
    resetTimeout: 30, // 30 seconds
  },
  timeout: {
    profile: 2000, // 2 seconds
    forum: 3000, // 3 seconds
    wiki: 3000, // 3 seconds
    messaging: 2000, // 2 seconds
    aggregation: 10000, // 10 seconds total
  },
  retry: {
    enabled: true,
    maxAttempts: 3,
    backoffMultiplier: 2,
    jitter: true,
  },
  privacy: {
    respectPrivacySettings: true,
    defaultVisibility: 'public',
    adminOverride: false,
  },
};

/**
 * Circuit breaker state management
 */
interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

/**
 * Performance metrics tracking
 */
interface MetricsCollector {
  recordRequest(service: ServiceType): void;
  recordSuccess(service: ServiceType, duration: number): void;
  recordFailure(service: ServiceType, error: ServiceError): void;
  recordCacheHit(): void;
  recordCacheMiss(): void;
  getMetrics(): AggregationMetrics;
  reset(): void;
}

/**
 * Main ProfileAggregatorService implementation
 */
export class ProfileAggregatorServiceImpl implements ProfileAggregatorService {
  private readonly dependencies: ServiceDependencies;
  private readonly config: ProfileAggregatorConfig;
  private readonly cache?: ProfileCacheService;
  private readonly circuitBreakers: Map<ServiceType, CircuitBreakerState>;
  private readonly metrics: MetricsCollector;

  constructor(
    dependencies: ServiceDependencies,
    config: Partial<ProfileAggregatorConfig> = {},
    cache?: ProfileCacheService
  ) {
    this.dependencies = dependencies;
    this.config = { ...DEFAULT_AGGREGATOR_CONFIG, ...config };
    this.cache = cache;
    this.circuitBreakers = new Map();
    this.metrics = new MetricsCollectorImpl();

    // Initialize circuit breakers
    this.initializeCircuitBreakers();
  }

  /**
   * Get aggregated user profile with data from all services
   */
  async getAggregatedProfile(
    userId: UserId,
    viewerId?: UserId
  ): Promise<Result<AggregatedUserProfile, AggregationError>> {
    const startTime = performance.now();

    try {
      // Check cache first
      if (this.cache && this.config.cache.enabled) {
        const cached = await this.cache.get(userId);
        if (cached && !this.isCacheExpired(cached)) {
          this.metrics.recordCacheHit();
          return Ok(cached);
        }
        this.metrics.recordCacheMiss();
      }

      // Aggregate data from all services
      const aggregationResult = await this.aggregateProfileData(userId, viewerId);

      if (aggregationResult.isError()) {
        return Err(aggregationResult.error);
      }

      const profile = aggregationResult.value;

      // Cache the result
      if (this.cache && this.config.cache.enabled) {
        await this.cache.set(userId, profile, this.config.cache.ttl);
      }

      const duration = performance.now() - startTime;
      this.recordAggregationMetrics('success', duration);

      return Ok(profile);
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordAggregationMetrics('error', duration);

      return Err({
        type: 'partial_aggregation' as const,
        successfulServices: [],
        failedServices: new Map(),
        message: `Profile aggregation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      } as AggregationError);
    }
  }

  /**
   * Refresh cached profile data
   */
  async refreshProfileCache(userId: UserId): Promise<Result<void, AggregationError>> {
    try {
      if (this.cache) {
        await this.cache.invalidate(userId);
      }

      // Force refresh by getting new data
      const result = await this.getAggregatedProfile(userId);

      if (result.isError()) {
        return Err(result.error);
      }

      return Ok(void 0);
    } catch (error) {
      return Err({
        type: 'cache_error' as const,
        operation: 'invalidate',
        message: `Failed to refresh cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryable: true,
      });
    }
  }

  /**
   * Get aggregated statistics summary
   */
  async getProfileStats(
    userId: UserId,
    viewerId?: UserId
  ): Promise<Result<UserStatsSummary, AggregationError>> {
    const profileResult = await this.getAggregatedProfile(userId, viewerId);

    if (profileResult.isError()) {
      return Err(profileResult.error);
    }

    return Ok(profileResult.value.stats);
  }

  /**
   * Get aggregated activity summary
   */
  async getProfileActivities(
    userId: UserId,
    viewerId?: UserId,
    limit = 20
  ): Promise<Result<UserActivitySummary, AggregationError>> {
    const profileResult = await this.getAggregatedProfile(userId, viewerId);

    if (profileResult.isError()) {
      return Err(profileResult.error);
    }

    return Ok(profileResult.value.activities);
  }

  /**
   * Validate health of all dependent services
   */
  async validateServiceHealth(): Promise<ServiceHealthStatus> {
    const serviceHealthMap = new Map();
    const checkStartTime = Date.now();

    for (const [serviceType, service] of Object.entries(this.dependencies) as Array<
      [ServiceType, any]
    >) {
      try {
        const serviceStartTime = performance.now();
        const isHealthy = await service.isHealthy();
        const responseTime = performance.now() - serviceStartTime;

        const circuitBreaker = this.circuitBreakers.get(serviceType);

        serviceHealthMap.set(serviceType, {
          status: isHealthy ? 'healthy' : 'unhealthy',
          responseTime,
          errorCount: circuitBreaker?.failureCount || 0,
          uptime: this.calculateUptime(serviceType),
        });
      } catch (error) {
        serviceHealthMap.set(serviceType, {
          status: 'unhealthy',
          responseTime: this.config.timeout[serviceType] || 5000,
          lastError: this.createServiceError(serviceType, error),
          errorCount: this.circuitBreakers.get(serviceType)?.failureCount || 0,
          uptime: 0,
        });
      }
    }

    const overallStatus = this.determineOverallHealth(serviceHealthMap);

    return {
      overall: overallStatus,
      services: serviceHealthMap,
      checkedAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Private Implementation Methods
  // ============================================================================

  /**
   * Aggregate data from all services with circuit breaker protection
   */
  private async aggregateProfileData(
    userId: UserId,
    viewerId?: UserId
  ): Promise<Result<AggregatedUserProfile, AggregationError>> {
    const aggregationPromises = {
      core: this.executeWithCircuitBreaker('profile', async () => {
        const result = await this.dependencies.profile.getUserProfile(userId, viewerId);
        return this.convertResultClass(result);
      }),
      privacy: this.executeWithCircuitBreaker('profile', async () => {
        const result = await this.dependencies.profile.getUserPrivacySettings(userId);
        return this.convertResultClass(result);
      }),
      forumStats: this.executeWithCircuitBreaker('forum', async () => {
        const result = await this.dependencies.forum?.getUserForumStats(userId);
        return this.convertResultClass(result) as Result<ForumUserStats, ServiceError>;
      }),
      wikiStats: this.executeWithCircuitBreaker('wiki', async () => {
        const result = await this.dependencies.wiki.getUserWikiStats(userId);
        return this.convertResultClass(result);
      }),
      messageStats: this.executeWithCircuitBreaker('messaging', async () => {
        const result = await this.dependencies.messaging.getUserMessageStats(userId);
        return this.convertResultClass(result);
      }),
      activities: this.executeWithCircuitBreaker('profile', async () => {
        const result = await this.dependencies.profile.getUserActivities(userId, 50);
        return this.convertResultClass(result);
      }),
    };

    // Execute all requests concurrently
    const results = await Promise.allSettled(Object.values(aggregationPromises));

    // Process results
    const successfulServices: ServiceType[] = [];
    const failedServices = new Map<ServiceType, ServiceError>();

    const [coreResult, privacyResult, forumResult, wikiResult, messageResult, activitiesResult] =
      results;

    // Check core profile (required)
    if (
      !coreResult ||
      coreResult.status === 'rejected' ||
      (coreResult.status === 'fulfilled' &&
        (coreResult as PromiseFulfilledResult<any>).value.isErr())
    ) {
      return Err({
        type: 'partial_aggregation',
        successfulServices: [],
        failedServices: new Map([
          [
            'profile',
            this.extractServiceError(
              coreResult || { status: 'rejected', reason: new Error('Core result undefined') }
            ),
          ],
        ]),
        message: 'Core profile data is required but unavailable',
      });
    }

    const core = (coreResult as PromiseFulfilledResult<Result<CoreUserProfile, ServiceError>>).value
      .value;
    successfulServices.push('profile');

    // Check privacy settings (required for proper data filtering)
    if (
      !privacyResult ||
      privacyResult.status === 'rejected' ||
      (privacyResult.status === 'fulfilled' &&
        (privacyResult as PromiseFulfilledResult<any>).value.isErr())
    ) {
      return Err({
        type: 'partial_aggregation',
        successfulServices: ['profile'],
        failedServices: new Map([
          [
            'profile',
            this.extractServiceError(
              privacyResult || { status: 'rejected', reason: new Error('Privacy result undefined') }
            ),
          ],
        ]),
        message: 'Privacy settings are required but unavailable',
      });
    }

    const privacy = (
      privacyResult as PromiseFulfilledResult<Result<UserPrivacySettings, ServiceError>>
    ).value.value;

    // Process optional service results
    const forumStats = this.extractOptionalResult(
      forumResult as PromiseSettledResult<Result<ForumUserStats, ServiceError>>,
      'forum',
      successfulServices,
      failedServices
    );
    const wikiStats = this.extractOptionalResult(
      wikiResult as PromiseSettledResult<Result<WikiUserStats, ServiceError>>,
      'wiki',
      successfulServices,
      failedServices
    );
    const messageStats = this.extractOptionalResult(
      messageResult as PromiseSettledResult<Result<MessageUserStats, ServiceError>>,
      'messaging',
      successfulServices,
      failedServices
    );
    const activities =
      this.extractOptionalResult(
        activitiesResult as PromiseSettledResult<
          Result<readonly CrossServiceActivity[], ServiceError>
        >,
        'profile',
        successfulServices,
        failedServices
      ) || [];

    // Build aggregated profile
    const aggregatedProfile: AggregatedUserProfile = {
      core,
      stats: {
        forum: forumStats || this.createEmptyForumStats(userId),
        wiki: wikiStats || this.createEmptyWikiStats(userId),
        messaging: messageStats || this.createEmptyMessageStats(userId),
        overall: this.calculateOverallStats(core, forumStats, wikiStats, messageStats),
      },
      activities: this.aggregateActivities(
        activities as readonly CrossServiceActivity[],
        privacy,
        viewerId
      ),
      privacy,
      aggregatedAt: new Date().toISOString(),
      cacheExpiry: new Date(Date.now() + this.config.cache.ttl * 1000).toISOString(),
    };

    // Return partial result if some services failed
    if (failedServices.size > 0) {
      return Err({
        type: 'partial_aggregation' as const,
        successfulServices,
        failedServices,
        partialResult: aggregatedProfile,
        message: `Profile aggregated with ${failedServices.size} service failures`,
      } as AggregationError);
    }

    return Ok(aggregatedProfile);
  }

  /**
   * Execute service call with circuit breaker protection
   */
  private async executeWithCircuitBreaker<T>(
    service: ServiceType,
    operation: () => Promise<Result<T, ServiceError>>
  ): Promise<Result<T, ServiceError | CircuitBreakerError>> {
    const circuitBreaker = this.circuitBreakers.get(service);

    if (!circuitBreaker || !this.config.circuitBreaker.enabled) {
      return this.executeWithTimeout(service, operation);
    }

    // Check circuit breaker state
    if (circuitBreaker.state === 'open') {
      if (Date.now() < circuitBreaker.nextAttemptTime) {
        return Err({
          type: 'circuit_breaker' as const,
          service,
          state: 'open',
          message: `Circuit breaker is open for ${service} service`,
          retryAfter: Math.ceil((circuitBreaker.nextAttemptTime - Date.now()) / 1000),
          retryable: true,
        } as CircuitBreakerError);
      } else {
        // Transition to half-open
        circuitBreaker.state = 'half-open';
      }
    }

    this.metrics.recordRequest(service);
    const startTime = performance.now();

    try {
      const result = await this.executeWithTimeout(service, operation);
      const duration = performance.now() - startTime;

      if (result.isOk()) {
        this.metrics.recordSuccess(service, duration);
        this.onCircuitBreakerSuccess(service);
      } else {
        this.metrics.recordFailure(service, result.error);
        this.onCircuitBreakerFailure(service);
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      const serviceError = this.createServiceError(service, error);

      this.metrics.recordFailure(service, serviceError);
      this.onCircuitBreakerFailure(service);

      return Err(serviceError);
    }
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    service: ServiceType,
    operation: () => Promise<Result<T, ServiceError>>
  ): Promise<Result<T, ServiceError>> {
    const timeout = this.config.timeout[service] || 5000;

    return Promise.race([
      operation(),
      new Promise<Result<T, ServiceError>>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Service ${service} timeout after ${timeout}ms`));
        }, timeout);
      }),
    ]);
  }

  /**
   * Handle circuit breaker success
   */
  private onCircuitBreakerSuccess(service: ServiceType): void {
    const circuitBreaker = this.circuitBreakers.get(service);
    if (circuitBreaker) {
      if (circuitBreaker.state === 'half-open') {
        circuitBreaker.state = 'closed';
      }
      circuitBreaker.failureCount = 0;
    }
  }

  /**
   * Handle circuit breaker failure
   */
  private onCircuitBreakerFailure(service: ServiceType): void {
    const circuitBreaker = this.circuitBreakers.get(service);
    if (circuitBreaker) {
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailureTime = Date.now();

      if (circuitBreaker.failureCount >= this.config.circuitBreaker.failureThreshold) {
        circuitBreaker.state = 'open';
        circuitBreaker.nextAttemptTime =
          Date.now() + this.config.circuitBreaker.resetTimeout * 1000;
      }
    }
  }

  /**
   * Initialize circuit breakers for all services
   */
  private initializeCircuitBreakers(): void {
    const services: ServiceType[] = ['profile', 'forum', 'wiki', 'messaging'];

    for (const service of services) {
      this.circuitBreakers.set(service, {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
      });
    }
  }

  /**
   * Extract result from optional service call
   */
  private extractOptionalResult<T>(
    result: PromiseSettledResult<Result<T, ServiceError>>,
    service: ServiceType,
    successfulServices: ServiceType[],
    failedServices: Map<ServiceType, ServiceError>
  ): T | null {
    if (result.status === 'fulfilled' && result.value.isOk()) {
      successfulServices.push(service);
      return result.value.value;
    } else {
      failedServices.set(service, this.extractServiceError(result));
      return null;
    }
  }

  /**
   * Extract service error from promise result
   */
  private extractServiceError(result: PromiseSettledResult<any>): ServiceError {
    if (result.status === 'rejected') {
      return this.createServiceError('profile', result.reason);
    } else if (result.value.isErr()) {
      return result.value.error;
    } else {
      return {
        type: 'service_unavailable',
        service: 'profile',
        message: 'Unknown service error',
        retryable: false,
      };
    }
  }

  /**
   * Create service error from exception
   */
  private createServiceError(service: ServiceType, error: unknown): ServiceError {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return {
      type: 'service_unavailable',
      service,
      message,
      retryable: true,
    };
  }

  /**
   * Create empty forum stats
   */
  private createEmptyForumStats(userId: UserId): ForumUserStats {
    return {
      userId,
      totalTopics: 0,
      totalReplies: 0,
      totalVotesReceived: 0,
      solutionsProvided: 0,
      recentTopics: [],
      recentReplies: [],
    };
  }

  /**
   * Create empty wiki stats
   */
  private createEmptyWikiStats(userId: UserId): WikiUserStats {
    return {
      userId,
      totalPagesCreated: 0,
      totalEdits: 0,
      totalRevisions: 0,
      pagesViewed: 0,
      recentEdits: [],
      createdPages: [],
      mostEditedPages: [],
    };
  }

  /**
   * Create empty message stats
   */
  private createEmptyMessageStats(userId: UserId): MessageUserStats {
    return {
      userId,
      totalConversations: 0,
      totalMessages: 0,
      unreadCount: 0,
      recentConversations: [],
    };
  }

  /**
   * Calculate overall user statistics
   */
  private calculateOverallStats(
    core: CoreUserProfile,
    forum: ForumUserStats | null,
    wiki: WikiUserStats | null,
    messaging: MessageUserStats | null
  ): OverallUserStats {
    const totalContributions =
      (forum?.totalTopics || 0) + (forum?.totalReplies || 0) + (wiki?.totalEdits || 0);

    const joinedDate = new Date(core.createdAt);
    const joinedDaysAgo = Math.floor((Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24));
    const averageDailyActivity = joinedDaysAgo > 0 ? totalContributions / joinedDaysAgo : 0;

    return {
      totalContributions,
      reputationBreakdown: {
        total: core.reputation,
        forumPosts: Math.floor(core.reputation * 0.6),
        wikiEdits: Math.floor(core.reputation * 0.3),
        helpfulVotes: 0,
        solutions: forum?.solutionsProvided || 0,
        other: Math.floor(core.reputation * 0.1),
      },
      activityScore: this.calculateActivityScore(totalContributions, joinedDaysAgo),
      joinedDaysAgo,
      averageDailyActivity,
    };
  }

  /**
   * Calculate activity score
   */
  private calculateActivityScore(contributions: number, daysAgo: number): number {
    if (daysAgo === 0) return 0;

    const base = contributions / Math.max(daysAgo, 1);
    const recencyBonus = Math.max(0, 1 - daysAgo / 365); // Bonus for newer users

    return Math.round((base + recencyBonus) * 100);
  }

  /**
   * Aggregate activities from multiple services
   */
  private aggregateActivities(
    activities: readonly CrossServiceActivity[],
    privacy: UserPrivacySettings,
    viewerId?: UserId
  ): UserActivitySummary {
    // Apply privacy filtering
    const filteredActivities = activities.filter(activity =>
      this.shouldShowActivity(activity, privacy, viewerId)
    );

    // Create timeline
    const timeline = this.createActivityTimeline(filteredActivities);

    // Create daily counts
    const dailyCounts = this.createDailyActivityCounts(filteredActivities);

    return {
      recentActivities: filteredActivities.slice(0, 20),
      activityTimeline: timeline,
      dailyActivityCounts: dailyCounts,
    };
  }

  /**
   * Check if activity should be shown based on privacy settings
   */
  private shouldShowActivity(
    activity: CrossServiceActivity,
    privacy: UserPrivacySettings,
    viewerId?: UserId
  ): boolean {
    if (!this.config.privacy.respectPrivacySettings) {
      return true;
    }

    // Always show to self
    if (viewerId && activity.service === 'profile') {
      return true;
    }

    // Check service-specific privacy settings
    switch (activity.service) {
      case 'forum':
        return privacy.showForumActivity;
      case 'wiki':
        return privacy.showWikiActivity;
      case 'messaging':
        return privacy.showMessagingActivity;
      default:
        return privacy.activityVisibility === 'public';
    }
  }

  /**
   * Create activity timeline
   */
  private createActivityTimeline(
    activities: readonly CrossServiceActivity[]
  ): readonly ActivityTimelineEntry[] {
    const grouped = new Map<string, CrossServiceActivity[]>();

    for (const activity of activities) {
      const timestamp = activity.timestamp ?? new Date().toISOString();
      const date = timestamp.split('T')[0] ?? ''; // Get YYYY-MM-DD
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)?.push(activity);
    }

    return Array.from(grouped.entries())
      .map(([date, dayActivities]) => ({
        date,
        activities: dayActivities,
        totalCount: dayActivities.length,
        serviceBreakdown: this.createServiceBreakdown(dayActivities),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Create service breakdown for activities
   */
  private createServiceBreakdown(
    activities: readonly CrossServiceActivity[]
  ): Record<ServiceType, number> {
    const breakdown: Record<ServiceType, number> = {
      profile: 0,
      forum: 0,
      wiki: 0,
      messaging: 0,
    };

    for (const activity of activities) {
      breakdown[activity.service]++;
    }

    return breakdown;
  }

  /**
   * Create daily activity counts
   */
  private createDailyActivityCounts(
    activities: readonly CrossServiceActivity[]
  ): ReadonlyMap<string, number> {
    const counts = new Map<string, number>();

    for (const activity of activities) {
      const timestamp = activity.timestamp ?? new Date().toISOString();
      const date = timestamp.split('T')[0] ?? '';
      counts.set(date, (counts.get(date) || 0) + 1);
    }

    return counts;
  }

  /**
   * Check if cached profile is expired
   */
  private isCacheExpired(profile: AggregatedUserProfile): boolean {
    if (!profile.cacheExpiry) return true;
    return new Date(profile.cacheExpiry) < new Date();
  }

  /**
   * Calculate service uptime
   */
  private calculateUptime(service: ServiceType): number {
    const circuitBreaker = this.circuitBreakers.get(service);
    if (!circuitBreaker) return 100;

    // Simple uptime calculation based on circuit breaker state
    return circuitBreaker.state === 'closed' ? 100 : circuitBreaker.state === 'half-open' ? 50 : 0;
  }

  /**
   * Determine overall health from service health
   */
  private determineOverallHealth(
    serviceHealthMap: Map<ServiceType, any>
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const healthStatuses = Array.from(serviceHealthMap.values()).map(info => info.status);

    if (healthStatuses.every(status => status === 'healthy')) {
      return 'healthy';
    } else if (healthStatuses.some(status => status === 'healthy')) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  /**
   * Convert ResultClass to Result for compatibility
   */
  private convertResultClass<T, E>(result: any): Result<T, E> {
    if (result && typeof result.isOk === 'function') {
      if (result.isOk()) {
        return Ok(result.value);
      } else {
        return Err(result.error);
      }
    }
    // If it's already a Result type, return as-is
    return result;
  }

  /**
   * Record aggregation metrics
   */
  private recordAggregationMetrics(result: 'success' | 'error', duration: number): void {
    // Implementation would track overall aggregation metrics
    // This is a placeholder for the actual metrics recording
  }
}

/**
 * Metrics collector implementation
 */
class MetricsCollectorImpl implements MetricsCollector {
  private requests = new Map<ServiceType, number>();
  private successes = new Map<ServiceType, number>();
  private failures = new Map<ServiceType, number>();
  private latencies = new Map<ServiceType, number[]>();
  private cacheHits = 0;
  private cacheMisses = 0;

  recordRequest(service: ServiceType): void {
    this.requests.set(service, (this.requests.get(service) || 0) + 1);
  }

  recordSuccess(service: ServiceType, duration: number): void {
    this.successes.set(service, (this.successes.get(service) || 0) + 1);

    if (!this.latencies.has(service)) {
      this.latencies.set(service, []);
    }
    this.latencies.get(service)!.push(duration);
  }

  recordFailure(service: ServiceType, error: ServiceError): void {
    this.failures.set(service, (this.failures.get(service) || 0) + 1);
  }

  recordCacheHit(): void {
    this.cacheHits++;
  }

  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  getMetrics(): AggregationMetrics {
    const totalRequests = Array.from(this.requests.values()).reduce((sum, count) => sum + count, 0);
    const totalFailures = Array.from(this.failures.values()).reduce((sum, count) => sum + count, 0);
    const totalCacheRequests = this.cacheHits + this.cacheMisses;

    const serviceLatencies = new Map<ServiceType, number>();
    for (const [service, latencyArray] of this.latencies) {
      const avgLatency =
        latencyArray.length > 0
          ? latencyArray.reduce((sum, latency) => sum + latency, 0) / latencyArray.length
          : 0;
      serviceLatencies.set(service, avgLatency);
    }

    return {
      requestCount: totalRequests,
      averageResponseTime:
        Array.from(serviceLatencies.values()).reduce((sum, latency) => sum + latency, 0) /
          serviceLatencies.size || 0,
      errorRate: totalRequests > 0 ? (totalFailures / totalRequests) * 100 : 0,
      cacheHitRate: totalCacheRequests > 0 ? (this.cacheHits / totalCacheRequests) * 100 : 0,
      serviceLatencies,
      circuitBreakerStates: new Map(), // Would be populated from actual circuit breaker states
    };
  }

  reset(): void {
    this.requests.clear();
    this.successes.clear();
    this.failures.clear();
    this.latencies.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}
