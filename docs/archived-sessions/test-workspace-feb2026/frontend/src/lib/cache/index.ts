/**
 * Cache System - Main Export
 *
 * Exports the LRU-based cache manager for the application.
 * Provides a simple, performant caching solution without external dependencies.
 */

// Export the cache manager
export {
  CacheManager,
  cacheManager,
  DEFAULT_CACHE_POLICIES,
  type CacheStrategy,
  type CachePolicyConfig,
  type CacheKey,
} from './manager';

// Re-export types for backward compatibility
export { type CacheOptions, CACHE_CONFIGS } from './types';

// Default export for convenience
import { cacheManager } from './manager';
export { cacheManager as cache };
export default cacheManager;
