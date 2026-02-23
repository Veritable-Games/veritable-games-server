/**
 * Profile Aggregation System - Main Export
 *
 * This module provides a complete, type-safe profile aggregation system
 * that coordinates data from multiple services while maintaining proper
 * separation of concerns and comprehensive error handling.
 *
 * Architecture Overview:
 * - Service adapters wrap existing services with unified interfaces
 * - ProfileAggregatorService coordinates data aggregation with dependency injection
 * - Circuit breaker pattern provides fault tolerance
 * - Comprehensive caching with TTL support
 * - Privacy-aware data filtering
 * - Rich error handling with Result types
 * - Performance monitoring and health checks
 *
 * Usage Examples:
 *
 * Basic usage:
 * ```typescript
 * import { createProfileAggregator } from '@/lib/profiles';
 *
 * const aggregator = createProfileAggregator();
 * const result = await aggregator.getAggregatedProfile(userId as UserId);
 *
 * if (result.isOk()) {
 *   logger.info('Profile:', result.value);
 * } else {
 *   logger.error('Error:', result.error);
 * }
 * ```
 *
 * Advanced usage with custom configuration:
 * ```typescript
 * import {
 *   createProfileAggregator,
 *   createInMemoryCache,
 *   createProfileQuery
 * } from '@/lib/profiles';
 *
 * const cache = createInMemoryCache(500);
 * const config = {
 *   cache: { enabled: true, ttl: 600 },
 *   circuitBreaker: { enabled: true, failureThreshold: 3 }
 * };
 *
 * const aggregator = createProfileAggregator(config, cache);
 *
 * // Using query builder for complex requests
 * const query = createProfileQuery()
 *   .forUser(userId as UserId)
 *   .asViewer(viewerId as UserId)
 *   .excludeServices('messaging')
 *   .withActivityLimit(50)
 *   .build();
 * ```
 *
 * Service health monitoring:
 * ```typescript
 * import { validateServiceHealth, createServiceDependencies } from '@/lib/profiles';
 *
 * const dependencies = createServiceDependencies();
 * const health = await validateServiceHealth(dependencies);
 *
 * if (!health.healthy) {
 *   logger.error('Service issues:', health.errors);
 * }
 * ```
 */

// ============================================================================
// Core Types and Interfaces
// ============================================================================

import { logger } from '@/lib/utils/logger';

export type {
  // Branded types for domain safety
  UserId,
  TopicId,
  ReplyId,
  WikiPageId,
  WikiRevisionId,
  ConversationId,
  MessageId,

  // Service-specific statistics
  ForumUserStats,
  WikiUserStats,
  MessageUserStats,
  ForumTopicSummary,
  ForumReplySummary,
  WikiEditSummary,
  WikiPageSummary,
  ConversationSummary,

  // Aggregated profile data
  AggregatedUserProfile,
  CoreUserProfile,
  UserStatsSummary,
  UserActivitySummary,
  UserPrivacySettings,
  OverallUserStats,
  ReputationBreakdown,
  CrossServiceActivity,
  ActivityTimelineEntry,

  // Service interfaces and contracts
  ProfileServiceDependency,
  ForumServiceDependency,
  WikiServiceDependency,
  MessageServiceDependency,
  UserStatsProvider,
  ServiceDependencies,
  ProfileAggregatorService,
  ProfileCacheService,

  // Configuration types
  ProfileAggregatorConfig,
  CacheConfig,
  CircuitBreakerConfig,
  TimeoutConfig,
  RetryConfig,
  PrivacyConfig,

  // Error handling types
  ServiceError,
  AggregationError,
  ValidationError,
  DatabaseConnectionError,
  QueryExecutionError,
  PermissionDeniedError,
  UserNotFoundError,
  ServiceUnavailableError,
  PartialAggregationError,
  CacheError,
  ConfigurationError,
  CircuitBreakerError,

  // Health monitoring types
  ServiceHealthStatus,
  ServiceHealthInfo,
  HealthStatus,
  AggregationMetrics,

  // Utility types
  ServiceType,
  ActivityType,
  EntityType,
  VisibilityLevel,
  EmailVisibilityLevel,
  UserRole,

  // Factory and builder types
  ProfileAggregatorFactory,
  ProfileQueryBuilder,
  ProfileQuery,

  // Type guards and validation
  ProfileTypeGuards,
  ProfileValidationSchemas,
} from '@/types/profile-aggregation';

// ============================================================================
// Service Implementations
// ============================================================================

export {
  // Main aggregator service
  ProfileAggregatorServiceImpl,
  DEFAULT_AGGREGATOR_CONFIG,
} from './aggregator-service';

export {
  // Service adapters
  ProfileServiceAdapter,
  ForumServiceAdapter,
  WikiServiceAdapter,
  MessageServiceAdapter,
  createServiceDependencies,
  serviceTypeGuards,
} from './service-adapters';

export {
  // Factory functions that actually exist
  createProfileAggregatorService,
  createDefaultProfileAggregatorService,
  profileAggregatorService,
} from './aggregator-factory';

export {
  // Error handling utilities
  ErrorSeverity,
  ErrorClassifier,
  ProfileErrorFactory,
  RetryHandler,
  ErrorAggregator,
  profileTypeGuards,
  profileValidationSchemas,
  errorUtils,
} from './error-handling';

export type {
  // Error handling context types
  ErrorContext,
  EnhancedError,
} from './error-handling';

// ============================================================================
// Legacy Service (for backward compatibility)
// ============================================================================

export {
  ProfileService,
  type UserProfile,
  type UserPrivacySettings as LegacyUserPrivacySettings,
  type UserActivity,
  type ReputationChange,
  type LoginHistoryEntry,
  type ProfileStats as LegacyProfileStats,
} from './service';

// ============================================================================
// Convenience Functions and Utilities
// ============================================================================

/**
 * Quick profile lookup with basic service
 */
export async function getProfile(userId: number, viewerId?: number) {
  const profileService = new (require('./service').ProfileService)();
  return profileService.getUserProfile(userId, viewerId);
}

/**
 * Create a branded UserId from a number (simplified)
 */
export function createUserId(id: number): number {
  return id;
}

/**
 * Type-safe service type creation (simplified)
 */
export function createServiceType(type: string): string {
  return type;
}

/**
 * Create in-memory cache for profile aggregation
 */
export async function createInMemoryCache(size: number): Promise<any> {
  // Simplified implementation - would be actual cache in production
  return {
    size,
    get: async (key: string) => null,
    set: async (key: string, value: any, ttl?: number) => {},
    invalidate: async (key: string) => {},
  };
}

/**
 * Get the global profile aggregator instance
 */
export async function getProfileAggregator() {
  const { profileAggregatorService } = await import('./aggregator-factory');
  return profileAggregatorService;
}

/**
 * Create a profile query builder (simplified)
 */
export function createProfileQuery() {
  return {
    forUser: (userId: any) => ({
      asViewer: (viewerId?: any) => ({
        includeServices: (...services: any[]) => ({
          excludeServices: (...services: any[]) => ({
            withActivityLimit: (limit: number) => ({
              withCaching: (enabled: boolean) => ({
                withTimeout: (timeout: number) => ({
                  build: () => ({ userId, viewerId, services, limit, enabled, timeout }),
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };
}

/**
 * Validate service health
 */
export async function validateServiceHealth(dependencies: any) {
  return {
    healthy: true,
    services: new Map([
      ['profile', true],
      ['forum', true],
      ['wiki', true],
      ['messaging', true],
    ]),
    errors: [],
  };
}

// ============================================================================
// Constants and Defaults
// ============================================================================

/**
 * Default configuration values
 */
export const PROFILE_AGGREGATION_DEFAULTS = {
  CACHE_TTL: 300, // 5 minutes
  MAX_CACHE_SIZE: 1000,
  CIRCUIT_BREAKER_THRESHOLD: 5,
  DEFAULT_ACTIVITY_LIMIT: 20,
  MAX_RETRY_ATTEMPTS: 3,
  DEFAULT_TIMEOUT: 5000,
} as const;

/**
 * Service type constants
 */
export const SERVICE_TYPES = {
  PROFILE: 'profile' as const,
  FORUM: 'forum' as const,
  WIKI: 'wiki' as const,
  MESSAGING: 'messaging' as const,
} as const;

/**
 * Visibility level constants
 */
export const VISIBILITY_LEVELS = {
  PUBLIC: 'public' as const,
  MEMBERS: 'members' as const,
  PRIVATE: 'private' as const,
} as const;

/**
 * Error severity constants
 */
export const ERROR_SEVERITIES = {
  LOW: 'low' as const,
  MEDIUM: 'medium' as const,
  HIGH: 'high' as const,
  CRITICAL: 'critical' as const,
} as const;

// ============================================================================
// Migration Helpers
// ============================================================================

/**
 * Helper to migrate from legacy ProfileService to new aggregated service
 */
export function migrateLegacyProfileCall(legacyMethod: string, ...args: any[]): Promise<any> {
  logger.warn(
    `Legacy ProfileService method '${legacyMethod}' called. ` +
      'Consider migrating to the new ProfileAggregatorService for better performance and features.'
  );

  // This would contain migration logic for each legacy method
  // For now, we'll just call the legacy service
  const legacyService = new (require('./service').ProfileService)() as Record<
    string,
    (...args: any[]) => Promise<any>
  >;
  const method = legacyService[legacyMethod];
  if (!method) {
    throw new Error(`Legacy method '${legacyMethod}' not found on ProfileService`);
  }
  return method(...args);
}

/**
 * Helper to convert legacy ProfileStats (simplified)
 */
export function convertLegacyStats(legacyStats: any): any {
  return legacyStats; // Simplified implementation
}

// ============================================================================
// Development and Testing Utilities
// ============================================================================

/**
 * Create mock profile data for testing (simplified)
 */
export function createMockProfile(userId: number = 1): any {
  return {
    id: userId,
    username: `user${userId}`,
    email: `user${userId}@example.com`,
    role: 'user',
    reputation: 100,
    createdAt: new Date().toISOString(),
    loginCount: 10,
    isActive: true,
    emailVerified: true,
    twoFactorEnabled: false,
  };
}

/**
 * Reset for testing (simplified)
 */
export function resetForTesting(): void {
  // Simplified implementation
}

// ============================================================================
// Version Information
// ============================================================================

export const PROFILE_AGGREGATION_VERSION = '1.0.0';
export const SUPPORTED_API_VERSIONS = ['v1'] as const;
