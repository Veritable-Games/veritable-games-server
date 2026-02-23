/**
 * Type-Safe Services Index
 * Provides centralized access to all type-safe service implementations
 */

// Base service utilities
export { BaseService, ServiceError, createService } from './BaseService';
export type { ServiceOptions } from './BaseService';

// Database utilities
export {
  TypeSafeQueryBuilder,
  DatabaseError,
  createQueryBuilder,
  QueryBuilders,
} from '@/lib/database/legacy/query-builder';
export type {
  QueryConfig,
  SelectOptions,
  InsertOptions,
  UpdateOptions,
} from '@/lib/database/legacy/query-builder';

// Result pattern utilities
export type { Result, OkResult, ErrResult } from '@/lib/utils/result';
export { Ok, Err, ResultUtils, AsyncResult, isOk, isErr } from '@/lib/utils/result';

// Import Result, Ok, Err, ServiceError, and createService for internal usage
import { Result, Ok, Err } from '@/lib/utils/result';
import { ServiceError, createService } from './BaseService';
import { logger } from '@/lib/utils/logger';

// Schema types
export * from '@/lib/database/schema-types';

// Type-safe service implementations
// Note: TypeSafeWikiPageService is not currently used - using WikiPageService instead
// export {
//   TypeSafeWikiPageService,
//   typeSafeWikiPageService,
// } from '@/lib/wiki/services/TypeSafeWikiPageService';
// export type {
//   CreateWikiPageData,
//   UpdateWikiPageData,
//   WikiPageWithContent,
// } from '@/lib/wiki/services/TypeSafeWikiPageService';

// Forum services - DISABLED (forums removed)
// export { TypeSafeForumService, typeSafeForumService } from '@/lib/forums/services/TypeSafeForumService';
// export type {
//   CreateTopicData,
//   UpdateTopicData,
//   CreateReplyData,
//   ForumTopicWithDetails,
//   ForumReplyWithDetails,
//   ForumCategoryWithStats,
//   PaginatedTopics,
//   PaginatedReplies,
// } from '@/lib/forums/services/TypeSafeForumService';

/**
 * Service Factory for creating new type-safe services
 *
 * Usage:
 * ```typescript
 * const userService = ServiceFactory.create('users', 'users');
 * const result = await userService.findOne({ id: userId });
 * ```
 */
export const ServiceFactory = {
  /**
   * Create a type-safe service for any database/table combination
   */
  create: createService,

  /**
   * Pre-configured service creators for common use cases
   */
  users: {
    users: () => createService('users', 'users'),
    profiles: () => createService('users', 'user_profiles'),
  },

  // Forums removed
  // forums: {
  //   categories: () => createService('forums', 'categories'),
  //   topics: () => createService('forums', 'topics'),
  //   replies: () => createService('forums', 'replies'),
  //   tags: () => createService('forums', 'tags'),
  // },

  wiki: {
    pages: () => createService('wiki', 'wiki_pages'),
    revisions: () => createService('wiki', 'wiki_revisions'),
    categories: () => createService('wiki', 'wiki_categories'),
    tags: () => createService('wiki', 'wiki_tags'),
  },

  content: {
    projects: () => createService('content', 'projects'),
    revisions: () => createService('content', 'project_revisions'),
    collaborators: () => createService('content', 'project_collaborators'),
  },

  messaging: {
    messages: () => createService('messaging', 'messages'),
    conversations: () => createService('messaging', 'conversations'),
  },

  library: {
    documents: () => createService('library', 'library_documents'),
    annotations: () => createService('library', 'library_annotations'),
  },

  auth: {
    sessions: () => createService('auth', 'sessions'),
    tokens: () => createService('auth', 'tokens'),
  },

  system: {
    config: () => createService('system', 'system_config'),
    activity: () => createService('system', 'activity_log'),
    notifications: () => createService('system', 'notifications'),
  },
};

/**
 * Migration helpers for converting legacy services
 */
export const MigrationHelpers = {
  /**
   * Convert legacy any-based service calls to type-safe Result pattern
   */
  async convertLegacyCall<T>(legacyCall: () => Promise<T>): Promise<Result<T, ServiceError>> {
    try {
      const result = await legacyCall();
      return Ok(result);
    } catch (error) {
      return Err(
        new ServiceError(
          error instanceof Error ? error.message : 'Unknown error',
          'LEGACY_CONVERSION_ERROR',
          {},
          error instanceof Error ? error : undefined
        )
      );
    }
  },

  /**
   * Type-safe wrapper for existing database operations
   */
  wrapDatabaseOperation<T>(operation: () => T, errorContext: string): Result<T, ServiceError> {
    try {
      const result = operation();
      return Ok(result);
    } catch (error) {
      return Err(
        new ServiceError(
          `${errorContext}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'DATABASE_OPERATION_ERROR',
          { context: errorContext },
          error instanceof Error ? error : undefined
        )
      );
    }
  },
};

/**
 * Type-safe service registry for dependency injection
 */
export class ServiceRegistry {
  private services = new Map<string, any>();

  /**
   * Register a service instance
   */
  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  /**
   * Get a registered service
   */
  get<T>(name: string): T | undefined {
    return this.services.get(name);
  }

  /**
   * Check if service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Clear all registered services
   */
  clear(): void {
    this.services.clear();
  }
}

// Global service registry instance
export const serviceRegistry = new ServiceRegistry();

// Pre-register common services (conditional to avoid import issues)
try {
  const { typeSafeWikiPageService } = require('@/lib/wiki/services/TypeSafeWikiPageService');
  // const { typeSafeForumService } = require('@/lib/forums/services/TypeSafeForumService'); // Forums disabled
  serviceRegistry.register('wikiPageService', typeSafeWikiPageService);
  // serviceRegistry.register('forumService', typeSafeForumService); // Forums disabled
} catch (error) {
  // Services not available, register later
  logger.warn('Type-safe services not available during initialization');
}

export default {
  ServiceFactory,
  MigrationHelpers,
  serviceRegistry,
};
