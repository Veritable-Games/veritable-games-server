/**
 * Profile Aggregation Type System
 *
 * This module defines TypeScript interfaces and contracts for the ProfileAggregatorService
 * architecture that aggregates user data across multiple services while maintaining
 * proper separation of concerns and type safety.
 *
 * Architecture Overview:
 * - ProfileService: Core user profile data (users.db)
 * - ForumService: Forum statistics and activities (forums.db)
 * - WikiService: Wiki contributions and statistics (wiki.db)
 * - MessagingService: Message counts and conversation stats (messaging.db)
 * - ProfileAggregatorService: Coordinates data aggregation with dependency injection
 */

import { Result } from './error-handling';
import { Branded } from './branded';

// ============================================================================
// Branded Types for Domain Safety
// ============================================================================

export type UserId = Branded<number, 'UserId'>;
export type TopicId = Branded<number, 'TopicId'>;
export type ReplyId = Branded<number, 'ReplyId'>;
export type WikiPageId = Branded<number, 'WikiPageId'>;
export type WikiRevisionId = Branded<number, 'WikiRevisionId'>;
export type ConversationId = Branded<number, 'ConversationId'>;
export type MessageId = Branded<number, 'MessageId'>;

// ============================================================================
// Service-Specific Statistics Interfaces
// ============================================================================

/**
 * Forum-specific user statistics
 * Sourced from ForumService (forums.db)
 */
export interface ForumUserStats {
  readonly userId: UserId;
  readonly totalTopics: number;
  readonly totalReplies: number;
  readonly totalVotesReceived: number;
  readonly solutionsProvided: number;
  readonly recentTopics: readonly ForumTopicSummary[];
  readonly recentReplies: readonly ForumReplySummary[];
  readonly averageReplyTime?: number; // in minutes
  readonly mostActiveCategory?: string;
  readonly lastForumActivity?: string; // ISO timestamp
}

export interface ForumTopicSummary {
  readonly id: TopicId;
  readonly title: string;
  readonly replyCount: number;
  readonly viewCount: number;
  readonly createdAt: string; // ISO timestamp
  readonly isSolved: boolean;
  readonly categoryName?: string;
}

export interface ForumReplySummary {
  readonly id: ReplyId;
  readonly topicId: TopicId;
  readonly topicTitle: string;
  readonly createdAt: string; // ISO timestamp
  readonly isSolution: boolean;
  readonly voteScore?: number;
}

/**
 * Wiki-specific user statistics
 * Sourced from WikiService (wiki.db)
 */
export interface WikiUserStats {
  readonly userId: UserId;
  readonly totalPagesCreated: number;
  readonly totalEdits: number;
  readonly totalRevisions: number;
  readonly pagesViewed: number;
  readonly recentEdits: readonly WikiEditSummary[];
  readonly createdPages: readonly WikiPageSummary[];
  readonly mostEditedPages: readonly WikiPageSummary[];
  readonly averageEditSize?: number; // in characters
  readonly lastWikiActivity?: string; // ISO timestamp
}

export interface WikiEditSummary {
  readonly id: WikiRevisionId;
  readonly pageId: WikiPageId;
  readonly pageTitle: string;
  readonly pageSlug: string;
  readonly summary: string;
  readonly revisionTimestamp: string; // ISO timestamp
  readonly changeSize: number; // characters added/removed
}

export interface WikiPageSummary {
  readonly id: WikiPageId;
  readonly title: string;
  readonly slug: string;
  readonly viewCount: number;
  readonly revisionCount: number;
  readonly createdAt: string; // ISO timestamp
  readonly lastEditAt?: string; // ISO timestamp
}

/**
 * Messaging-specific user statistics
 * Sourced from MessagingService (messaging.db)
 */
export interface MessageUserStats {
  readonly userId: UserId;
  readonly totalConversations: number;
  readonly totalMessages: number;
  readonly unreadCount: number;
  readonly recentConversations: readonly ConversationSummary[];
  readonly averageResponseTime?: number; // in minutes
  readonly lastMessageActivity?: string; // ISO timestamp
}

export interface ConversationSummary {
  readonly id: ConversationId;
  readonly subject: string;
  readonly participantCount: number;
  readonly messageCount: number;
  readonly lastActivity: string; // ISO timestamp
  readonly isArchived: boolean;
  readonly unreadCount: number;
}

// ============================================================================
// Aggregated Profile Data Interfaces
// ============================================================================

/**
 * Complete aggregated user profile with statistics from all services
 */
export interface AggregatedUserProfile {
  readonly core: CoreUserProfile;
  readonly stats: UserStatsSummary;
  readonly activities: UserActivitySummary;
  readonly privacy: UserPrivacySettings;
  readonly aggregatedAt: string; // ISO timestamp
  readonly cacheExpiry?: string; // ISO timestamp
}

/**
 * Core user profile data (from ProfileService)
 */
export interface CoreUserProfile {
  readonly id: UserId;
  readonly username: string;
  readonly email: string;
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly avatarPosition?: AvatarPosition;
  readonly bio?: string;
  readonly location?: string;
  readonly socialLinks: SocialLinks;
  readonly role: UserRole;
  readonly reputation: number;
  readonly createdAt: string; // ISO timestamp
  readonly lastActive?: string; // ISO timestamp
  readonly lastLogin?: string; // ISO timestamp
  readonly loginCount: number;
  readonly isActive: boolean;
  readonly emailVerified: boolean;
  readonly twoFactorEnabled: boolean;
}

export interface AvatarPosition {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export interface SocialLinks {
  readonly website?: string;
  readonly github?: string;
  readonly twitter?: string;
  readonly linkedin?: string;
  readonly discord?: string;
  readonly steam?: string;
  readonly xbox?: string;
  readonly psn?: string;
  readonly bluesky?: string;
  readonly mastodon?: string;
}

export type UserRole = 'user' | 'moderator' | 'developer' | 'admin' | 'banned';

/**
 * Aggregated statistics summary
 */
export interface UserStatsSummary {
  readonly forum: ForumUserStats;
  readonly wiki: WikiUserStats;
  readonly messaging: MessageUserStats;
  readonly overall: OverallUserStats;
}

export interface OverallUserStats {
  readonly totalContributions: number; // sum of forum posts + wiki edits
  readonly reputationBreakdown: ReputationBreakdown;
  readonly activityScore: number; // calculated engagement metric
  readonly joinedDaysAgo: number;
  readonly averageDailyActivity: number;
  readonly peakActivityPeriod?: string; // e.g., "evenings", "weekends"
}

export interface ReputationBreakdown {
  readonly total: number;
  readonly forumPosts: number;
  readonly wikiEdits: number;
  readonly helpfulVotes: number;
  readonly solutions: number;
  readonly other: number;
}

/**
 * Cross-service activity aggregation
 */
export interface UserActivitySummary {
  readonly recentActivities: readonly CrossServiceActivity[];
  readonly activityTimeline: readonly ActivityTimelineEntry[];
  readonly dailyActivityCounts: ReadonlyMap<string, number>; // date -> activity count
}

export interface CrossServiceActivity {
  readonly id: string; // composite ID: service_type:entity_id
  readonly service: ServiceType;
  readonly activityType: ActivityType;
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly entityTitle?: string;
  readonly entityUrl?: string;
  readonly action: string;
  readonly timestamp: string; // ISO timestamp
  readonly metadata?: Record<string, unknown>;
}

export type ServiceType = 'forum' | 'wiki' | 'messaging' | 'profile';
export type ActivityType = 'create' | 'update' | 'delete' | 'view' | 'vote' | 'reply' | 'edit';
export type EntityType =
  | 'topic'
  | 'reply'
  | 'wiki_page'
  | 'wiki_revision'
  | 'conversation'
  | 'message'
  | 'user';

export interface ActivityTimelineEntry {
  readonly date: string; // YYYY-MM-DD
  readonly activities: readonly CrossServiceActivity[];
  readonly totalCount: number;
  readonly serviceBreakdown: Record<ServiceType, number>;
}

/**
 * Privacy settings affecting data visibility
 */
export interface UserPrivacySettings {
  readonly profileVisibility: VisibilityLevel;
  readonly activityVisibility: VisibilityLevel;
  readonly emailVisibility: EmailVisibilityLevel;
  readonly showOnlineStatus: boolean;
  readonly showLastActive: boolean;
  readonly allowMessages: boolean;
  readonly showReputationDetails: boolean;
  readonly showForumActivity: boolean;
  readonly showWikiActivity: boolean;
  readonly showMessagingActivity: boolean;
}

export type VisibilityLevel = 'public' | 'members' | 'private';
export type EmailVisibilityLevel = 'public' | 'members' | 'admin' | 'private';

// ============================================================================
// Service Interface Contracts
// ============================================================================

/**
 * Interface contract for service providers
 * Each service must implement this interface to participate in aggregation
 */
export interface UserStatsProvider<T> {
  readonly serviceName: ServiceType;
  getUserStats(userId: UserId): Promise<Result<T, ServiceError>>;
  isHealthy(): Promise<boolean>;
  getLastUpdateTime(userId: UserId): Promise<string | null>;
}

/**
 * Service dependency injection interfaces
 */
export interface ProfileServiceDependency extends UserStatsProvider<CoreUserProfile> {
  getUserProfile(userId: UserId, viewerId?: UserId): Promise<Result<CoreUserProfile, ServiceError>>;
  getUserPrivacySettings(userId: UserId): Promise<Result<UserPrivacySettings, ServiceError>>;
  getUserActivities(
    userId: UserId,
    limit?: number
  ): Promise<Result<readonly CrossServiceActivity[], ServiceError>>;
}

export interface ForumServiceDependency extends UserStatsProvider<ForumUserStats> {
  getUserForumStats(userId: UserId): Promise<Result<ForumUserStats, ServiceError>>;
  getRecentTopics(
    userId: UserId,
    limit?: number
  ): Promise<Result<readonly ForumTopicSummary[], ServiceError>>;
  getRecentReplies(
    userId: UserId,
    limit?: number
  ): Promise<Result<readonly ForumReplySummary[], ServiceError>>;
}

export interface WikiServiceDependency extends UserStatsProvider<WikiUserStats> {
  getUserWikiStats(userId: UserId): Promise<Result<WikiUserStats, ServiceError>>;
  getRecentEdits(
    userId: UserId,
    limit?: number
  ): Promise<Result<readonly WikiEditSummary[], ServiceError>>;
  getCreatedPages(
    userId: UserId,
    limit?: number
  ): Promise<Result<readonly WikiPageSummary[], ServiceError>>;
}

export interface MessageServiceDependency extends UserStatsProvider<MessageUserStats> {
  getUserMessageStats(userId: UserId): Promise<Result<MessageUserStats, ServiceError>>;
  getRecentConversations(
    userId: UserId,
    limit?: number
  ): Promise<Result<readonly ConversationSummary[], ServiceError>>;
}

// ============================================================================
// Service Aggregation Interfaces
// ============================================================================

/**
 * Main ProfileAggregatorService interface
 */
export interface ProfileAggregatorService {
  getAggregatedProfile(
    userId: UserId,
    viewerId?: UserId
  ): Promise<Result<AggregatedUserProfile, AggregationError>>;
  refreshProfileCache(userId: UserId): Promise<Result<void, AggregationError>>;
  getProfileStats(
    userId: UserId,
    viewerId?: UserId
  ): Promise<Result<UserStatsSummary, AggregationError>>;
  getProfileActivities(
    userId: UserId,
    viewerId?: UserId,
    limit?: number
  ): Promise<Result<UserActivitySummary, AggregationError>>;
  validateServiceHealth(): Promise<ServiceHealthStatus>;
}

/**
 * Service configuration for dependency injection
 */
export interface ServiceDependencies {
  readonly profile: ProfileServiceDependency;
  readonly forum?: ForumServiceDependency; // Optional - forum system removed
  readonly wiki: WikiServiceDependency;
  readonly messaging: MessageServiceDependency;
}

/**
 * Cache interface for aggregated profile data
 */
export interface ProfileCacheService {
  get(userId: UserId): Promise<AggregatedUserProfile | null>;
  set(userId: UserId, profile: AggregatedUserProfile, ttl?: number): Promise<void>;
  invalidate(userId: UserId): Promise<void>;
  invalidateAll(): Promise<void>;
  getStats(): Promise<CacheStats>;
}

export interface CacheStats {
  readonly hitRate: number;
  readonly missRate: number;
  readonly totalRequests: number;
  readonly cacheSize: number;
  readonly avgResponseTime: number;
}

// ============================================================================
// Error Handling Types
// ============================================================================

/**
 * Service-specific error types
 */
export type ServiceError =
  | DatabaseConnectionError
  | QueryExecutionError
  | PermissionDeniedError
  | UserNotFoundError
  | ServiceUnavailableError;

export interface DatabaseConnectionError {
  readonly type: 'database_connection';
  readonly service: ServiceType;
  readonly message: string;
  readonly retryable: boolean;
}

export interface QueryExecutionError {
  readonly type: 'query_execution';
  readonly service: ServiceType;
  readonly query: string;
  readonly message: string;
  readonly retryable: boolean;
}

export interface PermissionDeniedError {
  readonly type: 'permission_denied';
  readonly service: ServiceType;
  readonly requiredPermission: string;
  readonly message: string;
  readonly retryable: false;
}

export interface UserNotFoundError {
  readonly type: 'user_not_found';
  readonly service: ServiceType;
  readonly userId: UserId;
  readonly message: string;
  readonly retryable: false;
}

export interface ServiceUnavailableError {
  readonly type: 'service_unavailable';
  readonly service: ServiceType;
  readonly message: string;
  readonly retryable: boolean;
  readonly retryAfter?: number; // seconds
}

/**
 * Aggregation-specific error types
 */
export type AggregationError =
  | PartialAggregationError
  | CacheError
  | ConfigurationError
  | CircuitBreakerError;

export interface PartialAggregationError {
  readonly type: 'partial_aggregation';
  readonly successfulServices: readonly ServiceType[];
  readonly failedServices: ReadonlyMap<ServiceType, ServiceError>;
  readonly partialResult?: Partial<AggregatedUserProfile>;
  readonly message: string;
}

export interface CacheError {
  readonly type: 'cache_error';
  readonly operation: 'get' | 'set' | 'invalidate';
  readonly message: string;
  readonly retryable: boolean;
}

export interface ConfigurationError {
  readonly type: 'configuration_error';
  readonly invalidService: ServiceType;
  readonly message: string;
  readonly retryable: false;
}

export interface CircuitBreakerError {
  readonly type: 'circuit_breaker';
  readonly service: ServiceType;
  readonly state: 'open' | 'half-open';
  readonly message: string;
  readonly retryAfter: number; // seconds
  readonly retryable: true;
}

// ============================================================================
// Health Monitoring and Observability
// ============================================================================

/**
 * Service health monitoring
 */
export interface ServiceHealthStatus {
  readonly overall: HealthStatus;
  readonly services: ReadonlyMap<ServiceType, ServiceHealthInfo>;
  readonly checkedAt: string; // ISO timestamp
}

export interface ServiceHealthInfo {
  readonly status: HealthStatus;
  readonly responseTime: number; // milliseconds
  readonly lastError?: ServiceError;
  readonly errorCount: number;
  readonly uptime: number; // percentage
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Performance metrics for monitoring
 */
export interface AggregationMetrics {
  readonly requestCount: number;
  readonly averageResponseTime: number; // milliseconds
  readonly errorRate: number; // percentage
  readonly cacheHitRate: number; // percentage
  readonly serviceLatencies: ReadonlyMap<ServiceType, number>; // milliseconds
  readonly circuitBreakerStates: ReadonlyMap<ServiceType, 'closed' | 'open' | 'half-open'>;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for ProfileAggregatorService
 */
export interface ProfileAggregatorConfig {
  readonly cache: CacheConfig;
  readonly circuitBreaker: CircuitBreakerConfig;
  readonly timeout: TimeoutConfig;
  readonly retry: RetryConfig;
  readonly privacy: PrivacyConfig;
}

export interface CacheConfig {
  readonly enabled: boolean;
  readonly ttl: number; // seconds
  readonly maxSize: number;
  readonly compression: boolean;
}

export interface CircuitBreakerConfig {
  readonly enabled: boolean;
  readonly failureThreshold: number;
  readonly timeoutThreshold: number; // milliseconds
  readonly resetTimeout: number; // seconds
}

export interface TimeoutConfig {
  readonly profile: number; // milliseconds
  readonly forum: number;
  readonly wiki: number;
  readonly messaging: number;
  readonly aggregation: number;
}

export interface RetryConfig {
  readonly enabled: boolean;
  readonly maxAttempts: number;
  readonly backoffMultiplier: number;
  readonly jitter: boolean;
}

export interface PrivacyConfig {
  readonly respectPrivacySettings: boolean;
  readonly defaultVisibility: VisibilityLevel;
  readonly adminOverride: boolean;
}

// ============================================================================
// Factory and Builder Types
// ============================================================================

/**
 * Factory interface for creating aggregator service instances
 */
export interface ProfileAggregatorFactory {
  create(
    dependencies: ServiceDependencies,
    config?: Partial<ProfileAggregatorConfig>
  ): ProfileAggregatorService;
  createWithDefaults(dependencies: ServiceDependencies): ProfileAggregatorService;
}

/**
 * Builder pattern for complex profile queries
 */
export interface ProfileQueryBuilder {
  forUser(userId: UserId): ProfileQueryBuilder;
  asViewer(viewerId: UserId): ProfileQueryBuilder;
  includeServices(...services: ServiceType[]): ProfileQueryBuilder;
  excludeServices(...services: ServiceType[]): ProfileQueryBuilder;
  withActivityLimit(limit: number): ProfileQueryBuilder;
  withCaching(enabled: boolean): ProfileQueryBuilder;
  withTimeout(milliseconds: number): ProfileQueryBuilder;
  build(): ProfileQuery;
}

export interface ProfileQuery {
  readonly userId: UserId;
  readonly viewerId?: UserId;
  readonly includedServices: readonly ServiceType[];
  readonly excludedServices: readonly ServiceType[];
  readonly activityLimit: number;
  readonly cachingEnabled: boolean;
  readonly timeoutMs: number;
}

// ============================================================================
// Type Guards and Validation
// ============================================================================

/**
 * Type guards for runtime validation
 */
export interface ProfileTypeGuards {
  isUserId(value: unknown): value is UserId;
  isServiceType(value: unknown): value is ServiceType;
  isVisibilityLevel(value: unknown): value is VisibilityLevel;
  isHealthStatus(value: unknown): value is HealthStatus;
  isValidProfile(value: unknown): value is AggregatedUserProfile;
  isServiceError(value: unknown): value is ServiceError;
  isAggregationError(value: unknown): value is AggregationError;
}

/**
 * Validation schemas for input data
 */
export interface ProfileValidationSchemas {
  readonly userIdSchema: (value: unknown) => Result<UserId, ValidationError>;
  readonly privacySettingsSchema: (value: unknown) => Result<UserPrivacySettings, ValidationError>;
  readonly configSchema: (value: unknown) => Result<ProfileAggregatorConfig, ValidationError>;
}

export interface ValidationError {
  readonly type: 'validation_error';
  readonly field: string;
  readonly message: string;
  readonly value: unknown;
}
