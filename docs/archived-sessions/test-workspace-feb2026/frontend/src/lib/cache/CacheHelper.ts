/**
 * CacheHelper - Simple wrapper around CacheManager for API caching
 *
 * Provides a simplified interface for the api-cache module that's compatible
 * with the existing CacheManager implementation.
 */

import { cacheManager, type CacheKey } from './manager';
import { logger } from '@/lib/utils/logger';

export class CacheHelper {
  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const cacheKey: CacheKey = {
        category: 'api',
        identifier: key,
      };

      const value = await cacheManager.get(cacheKey);
      return (value as T) || null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttl?: number, tags?: string[]): Promise<boolean> {
    try {
      const cacheKey: CacheKey = {
        category: 'api',
        identifier: key,
      };

      // TODO: Handle custom TTL and tags if needed in the future
      // For now, the CacheManager uses policy-based tags and TTL
      return await cacheManager.set(cacheKey, value);
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const cacheKey: CacheKey = {
        category: 'api',
        identifier: key,
      };

      return await cacheManager.delete(cacheKey);
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      await cacheManager.invalidateByTags(tags);
    } catch (error) {
      logger.error('Cache invalidateByTags error:', error);
    }
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    try {
      await cacheManager.clearAll();
    } catch (error) {
      logger.error('Cache clearAll error:', error);
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Get cache size for API category
   */
  getSize(): number {
    return cacheManager.getStats()?.size || 0;
  }

  /**
   * Get cache stats for API category
   */
  getStats() {
    return cacheManager.getStats();
  }
}
