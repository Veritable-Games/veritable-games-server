/**
 * Advanced Cache Manager with TTL Policies
 *
 * Provides intelligent caching with:
 * - LRU cache with automatic eviction
 * - Smart TTL policies based on data access patterns
 * - Tag-based invalidation
 * - Performance analytics and optimization
 */

import { LRUCache } from 'lru-cache';
import { logger } from '@/lib/utils/logger';

export interface CacheStrategy {
  enabled: boolean;
  maxSize: number;
  ttl: number;
  tags?: string[];
  warming?: {
    enabled: boolean;
    factory?: () => Promise<any>;
    dependencies?: string[];
  };
}

export interface CachePolicyConfig {
  // Session data - short TTL
  session: CacheStrategy;

  // API responses - medium TTL
  api: CacheStrategy;

  // Static content - long TTL
  static: CacheStrategy;

  // User-specific data - short TTL, tagged
  user: CacheStrategy;

  // Search results - medium TTL, tag-based invalidation
  search: CacheStrategy;

  // Content data - adaptive TTL
  content: CacheStrategy;
}

export const DEFAULT_CACHE_POLICIES: CachePolicyConfig = {
  session: {
    enabled: true,
    maxSize: 2000, // Increased for better user experience
    ttl: 900, // 15 minutes - longer for better performance
    warming: { enabled: false },
  },

  api: {
    enabled: true,
    maxSize: 5000, // Increased for more API responses
    ttl: 600, // 10 minutes - optimized for API freshness
    tags: ['api'],
    warming: { enabled: true }, // Enable warming for critical APIs
  },

  static: {
    enabled: true,
    maxSize: 1000, // Increased for more static content
    ttl: 86400, // 24 hours
    tags: ['static'],
    warming: { enabled: true },
  },

  user: {
    enabled: true,
    maxSize: 3000, // Increased for more user data
    ttl: 1800, // 30 minutes - longer for user profiles
    tags: ['user'],
    warming: { enabled: false },
  },

  search: {
    enabled: true,
    maxSize: 3000, // Increased for more search results
    ttl: 1800, // 30 minutes - longer for search results
    tags: ['search'],
    warming: { enabled: true }, // Pre-warm popular searches
  },

  content: {
    enabled: true,
    maxSize: 2000, // Increased for more content
    ttl: 10, // 10 seconds - aggressive refresh for category changes and breadcrumb updates
    tags: ['content'],
    warming: { enabled: true },
  },
};

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  maxSize: number;
  hitRate: number;
}

export interface CacheKey {
  category: keyof CachePolicyConfig;
  identifier: string;
  version?: string;
  userId?: string;
}

export class CacheManager {
  private caches: Map<string, LRUCache<string, any>>;
  private policies: CachePolicyConfig;
  private stats: {
    [category: string]: { hits: number; misses: number; sets: number; deletes: number };
  };
  private tagIndex: Map<string, Set<string>>; // tag -> cache keys

  constructor(policies: CachePolicyConfig = DEFAULT_CACHE_POLICIES) {
    this.policies = policies;
    this.caches = new Map();
    this.stats = {};
    this.tagIndex = new Map();

    this.initializeCaches();
    this.setupCacheWarming();
  }

  private initializeCaches(): void {
    for (const [category, policy] of Object.entries(this.policies)) {
      if (policy.enabled) {
        const cache = new LRUCache<string, any>({
          max: policy.maxSize,
          ttl: policy.ttl * 1000, // Convert to milliseconds
          updateAgeOnGet: true,
          updateAgeOnHas: true,
        });

        this.caches.set(category, cache);
      }

      // Initialize stats
      this.stats[category] = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
      };
    }
  }

  private setupCacheWarming(): void {
    // Warm critical caches on startup
    setTimeout(async () => {
      await this.warmCriticalCaches();
    }, 5000); // Wait 5 seconds after startup

    // Schedule periodic cache warming
    setInterval(async () => {
      await this.warmCriticalCaches();
    }, 3600000); // Every hour
  }

  /**
   * Generate cache key from components
   */
  private generateKey(key: CacheKey): string {
    const parts = [key.category, key.identifier];
    if (key.version) parts.push(`v:${key.version}`);
    if (key.userId) parts.push(`u:${key.userId}`);
    return parts.join(':');
  }

  /**
   * Update tag index
   */
  private updateTagIndex(cacheKey: string, tags?: string[]): void {
    if (!tags) return;

    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(cacheKey);
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: CacheKey): Promise<T | null> {
    const cacheKey = this.generateKey(key);
    const policy = this.policies[key.category];

    if (!policy || !policy.enabled) return null;

    const cache = this.caches.get(key.category);
    const value = cache?.get(cacheKey);

    if (value !== undefined) {
      if (this.stats[key.category]) {
        this.stats[key.category]!.hits++;
      }
      return value;
    } else {
      if (this.stats[key.category]) {
        this.stats[key.category]!.misses++;
      }
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: CacheKey, value: T): Promise<boolean> {
    const cacheKey = this.generateKey(key);
    const policy = this.policies[key.category];

    if (!policy || !policy.enabled) return false;

    const cache = this.caches.get(key.category);
    cache?.set(cacheKey, value);
    if (this.stats[key.category]) {
      this.stats[key.category]!.sets++;
    }

    // Update tag index
    this.updateTagIndex(cacheKey, policy.tags);

    return true;
  }

  /**
   * Delete from cache
   */
  async delete(key: CacheKey): Promise<boolean> {
    const cacheKey = this.generateKey(key);
    const policy = this.policies[key.category];

    if (!policy || !policy.enabled) return false;

    const cache = this.caches.get(key.category);
    const deleted = cache?.delete(cacheKey) || false;

    if (deleted && this.stats[key.category]) {
      this.stats[key.category]!.deletes++;
    }

    return deleted;
  }

  /**
   * Get or set pattern with cache-aside strategy
   */
  async getOrSet<T>(key: CacheKey, factory: () => Promise<T>, customTtl?: number): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Generate fresh data
    const value = await factory();

    // Store in cache
    await this.set(key, value);

    return value;
  }

  /**
   * Invalidate cache by category
   */
  async invalidateCategory(category: keyof CachePolicyConfig): Promise<void> {
    const cache = this.caches.get(category);
    cache?.clear();
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    const keysToInvalidate = new Set<string>();

    // Collect all keys with matching tags
    for (const tag of tags) {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        keys.forEach(key => keysToInvalidate.add(key));
      }
    }

    // Delete keys from all caches
    for (const [category, cache] of this.caches) {
      for (const key of keysToInvalidate) {
        if (key.startsWith(`${category}:`)) {
          cache.delete(key);
        }
      }
    }

    // Clean up tag index
    for (const tag of tags) {
      this.tagIndex.delete(tag);
    }
  }

  /**
   * Invalidate user-specific cache
   */
  async invalidateUser(userId: string): Promise<void> {
    // Clear cache entries for user
    for (const [category, cache] of this.caches) {
      const keys = Array.from(cache.keys()).filter(key => key.includes(`u:${userId}`));
      keys.forEach(key => cache.delete(key));
    }
  }

  /**
   * Warm critical caches
   */
  private async warmCriticalCaches(): Promise<void> {
    // Check policies for warming configuration
    for (const [category, policy] of Object.entries(this.policies)) {
      if (policy.warming?.enabled && policy.warming.factory) {
        try {
          const data = await policy.warming.factory();
          const key: CacheKey = {
            category: category as keyof CachePolicyConfig,
            identifier: 'warmed-data',
          };
          await this.set(key, data);
          logger.info(`Warmed cache for ${category}`);
        } catch (error) {
          logger.error(`Failed to warm cache for ${category}:`, error);
        }
      }
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    const totalHits = Object.values(this.stats).reduce((sum, stat) => sum + stat.hits, 0);
    const totalMisses = Object.values(this.stats).reduce((sum, stat) => sum + stat.misses, 0);
    const totalSets = Object.values(this.stats).reduce((sum, stat) => sum + stat.sets, 0);
    const totalDeletes = Object.values(this.stats).reduce((sum, stat) => sum + stat.deletes, 0);
    const totalSize = Array.from(this.caches.values()).reduce((sum, cache) => sum + cache.size, 0);
    const maxSize = Array.from(this.caches.values()).reduce((sum, cache) => sum + cache.max, 0);
    const total = totalHits + totalMisses;

    return {
      hits: totalHits,
      misses: totalMisses,
      sets: totalSets,
      deletes: totalDeletes,
      size: totalSize,
      maxSize,
      hitRate: total > 0 ? (totalHits / total) * 100 : 0,
    };
  }

  /**
   * Health check for cache system
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded';
    cacheCount: number;
    stats: CacheStats;
  }> {
    const cacheCount = this.caches.size;
    const stats = this.getStats();
    const status = cacheCount > 0 && stats.hitRate > 30 ? 'healthy' : 'degraded';

    return {
      status,
      cacheCount,
      stats,
    };
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    // Clear all caches
    for (const cache of this.caches.values()) {
      cache.clear();
    }

    // Clear tag index
    this.tagIndex.clear();

    // Reset stats
    for (const category of Object.keys(this.stats)) {
      this.stats[category] = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
      };
    }
  }

  /**
   * API compatibility methods
   */
  async getStatsAlias() {
    return this.getStats();
  }

  async health() {
    return this.healthCheck();
  }

  async invalidateTag(tag: string): Promise<void> {
    return this.invalidateByTags([tag]);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // Invalidate keys matching pattern
    for (const [category, cache] of this.caches) {
      const keys = Array.from(cache.keys()).filter(key => key.includes(pattern));
      keys.forEach(key => cache.delete(key));
    }
  }

  async warmup(): Promise<void> {
    return this.warmCriticalCaches();
  }

  async clear(): Promise<void> {
    return this.clearAll();
  }

  async invalidateByTag(tag: string): Promise<number> {
    const keysToInvalidate = new Set<string>();
    const keys = this.tagIndex.get(tag);

    if (keys) {
      keys.forEach(key => keysToInvalidate.add(key));
    }

    let invalidated = 0;
    for (const [category, cache] of this.caches) {
      for (const key of keysToInvalidate) {
        if (key.startsWith(`${category}:`)) {
          if (cache.delete(key)) {
            invalidated++;
          }
        }
      }
    }

    this.tagIndex.delete(tag);
    return invalidated;
  }

  async maintenance(): Promise<void> {
    // Perform cache maintenance operations
    let cleaned = 0;

    // Clean up expired entries and optimize cache sizes
    for (const [category, cache] of this.caches) {
      const sizeBefore = cache.size;
      // Force garbage collection of expired entries
      cache.purgeStale();
      const sizeAfter = cache.size;
      cleaned += sizeBefore - sizeAfter;
    }

    // Clean up orphaned tag index entries
    for (const [tag, keys] of this.tagIndex) {
      const validKeys = new Set<string>();
      for (const key of keys) {
        const category = key.split(':')[0];
        if (!category) continue; // Skip if category is undefined
        const cache = this.caches.get(category);
        if (cache && key && cache.has(key)) {
          validKeys.add(key);
        }
      }

      if (validKeys.size === 0) {
        this.tagIndex.delete(tag);
      } else {
        this.tagIndex.set(tag, validKeys);
      }
    }

    logger.info(`Cache maintenance completed. Cleaned ${cleaned} expired entries.`);
  }

  setEnabled(enabled: boolean): void {
    // Enable/disable all cache policies
    for (const policy of Object.values(this.policies)) {
      policy.enabled = enabled;
    }

    if (!enabled) {
      // Clear all caches when disabled
      this.clearAll();
    } else {
      // Reinitialize caches when enabled
      this.initializeCaches();
    }
  }
}

// Export singleton instance with backward compatibility wrapper
class BackwardCompatibleCacheManager extends CacheManager {
  // Backward compatibility for array-based API
  override async get<T>(key: CacheKey | string[]): Promise<T | null> {
    if (Array.isArray(key)) {
      const [category, ...parts] = key;
      return super.get<T>({
        category: category as keyof CachePolicyConfig,
        identifier: parts.join(':'),
      });
    }
    return super.get<T>(key);
  }

  override async set(key: CacheKey | string[], value: any): Promise<boolean> {
    if (Array.isArray(key)) {
      const [category, ...parts] = key;
      return super.set(
        {
          category: category as keyof CachePolicyConfig,
          identifier: parts.join(':'),
        },
        value
      );
    }
    return super.set(key, value);
  }

  override async delete(key: CacheKey | string[]): Promise<boolean> {
    if (Array.isArray(key)) {
      const [category, ...parts] = key;
      return super.delete({
        category: category as keyof CachePolicyConfig,
        identifier: parts.join(':'),
      });
    }
    return super.delete(key);
  }

  override async getOrSet<T>(
    key: CacheKey | string[],
    factory: () => Promise<T>,
    customTtl?: number
  ): Promise<T> {
    if (Array.isArray(key)) {
      const [category, ...parts] = key;
      return super.getOrSet(
        {
          category: category as keyof CachePolicyConfig,
          identifier: parts.join(':'),
        },
        factory,
        customTtl
      );
    }
    return super.getOrSet(key, factory, customTtl);
  }
}

export const cacheManager = new BackwardCompatibleCacheManager();
