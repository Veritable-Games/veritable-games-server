/**
 * Forum Repositories Index
 *
 * Central export point for all forum repository classes and instances.
 * Provides a clean API for importing repositories throughout the application.
 *
 * Usage:
 * ```typescript
 * import { topicRepository, replyRepository } from '@/lib/forums/repositories';
 *
 * // Use singleton instances
 * const topicsResult = await topicRepository.findByCategory(categoryId);
 *
 * // Or create custom instances if needed
 * import { TopicRepository } from '@/lib/forums/repositories';
 * const customRepo = new TopicRepository();
 * ```
 *
 * Architecture:
 * - All repositories extend BaseRepository
 * - Use Result pattern for error handling
 * - Automatic cross-database user fetching (auth.db)
 * - Singleton instances exported for convenience
 * - Type-safe with branded types (TopicId, ReplyId, etc.)
 */

// Base repository and types
export { BaseRepository } from './base-repository';
export type { RepositoryError } from './base-repository';

// Category repository
export { CategoryRepository, categoryRepository } from './category-repository';
export type { CategoryStats } from './category-repository';

// Topic repository
export { TopicRepository, topicRepository } from './topic-repository';
export type { CreateTopicData, UpdateTopicData } from './topic-repository';

// Reply repository
export { ReplyRepository, replyRepository } from './reply-repository';
export type { CreateReplyData, UpdateReplyData } from './reply-repository';

// Search repository
export { SearchRepository, searchRepository } from './search-repository';
export type { SearchOptions } from './search-repository';

// Import the classes and instances for the convenience object
import { CategoryRepository, categoryRepository } from './category-repository';
import { TopicRepository, topicRepository } from './topic-repository';
import { ReplyRepository, replyRepository } from './reply-repository';
import { SearchRepository, searchRepository } from './search-repository';

/**
 * Convenience object containing all repository instances
 *
 * Usage:
 * ```typescript
 * import { repositories } from '@/lib/forums/repositories';
 *
 * const topics = await repositories.topics.findByCategory(categoryId);
 * const replies = await repositories.replies.findByTopic(topicId);
 * ```
 */
export const repositories = {
  categories: categoryRepository,
  topics: topicRepository,
  replies: replyRepository,
  search: searchRepository,
} as const;

/**
 * Type for the repositories object
 */
export type ForumRepositories = typeof repositories;
