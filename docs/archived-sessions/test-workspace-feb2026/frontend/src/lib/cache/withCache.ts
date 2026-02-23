import { LRUCache } from './lru';
import { logger } from '@/lib/utils/logger';

/**
 * Higher-order function to wrap database queries with caching
 */
export function withCache<T extends (...args: any[]) => any>(
  fn: T,
  cache: LRUCache<string, any>,
  keyGenerator: (...args: Parameters<T>) => string,
  ttl?: number
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const key = keyGenerator(...args);

    // Check cache first
    const cached = cache.get(key);
    if (cached !== null) {
      if (process.env.NODE_ENV === 'development') {
        logger.info(`Cache hit: ${key}`);
      }
      return cached as ReturnType<T>;
    }

    // Execute the original function
    const result = await fn(...args);

    // Cache the result
    cache.set(key, result);

    if (process.env.NODE_ENV === 'development') {
      logger.info(`Cache miss: ${key} - cached for ${ttl || 60000}ms`);
    }

    return result;
  }) as T;
}

/**
 * Cache invalidation helper
 */
export function invalidateCache(cache: LRUCache<string, any>, pattern?: string | RegExp): void {
  if (!pattern) {
    // Clear entire cache
    cache.clear();
    return;
  }

  // Note: This is a simple implementation. In production, you might want
  // to use a more sophisticated pattern matching or tagging system
  if (typeof pattern === 'string') {
    cache.delete(pattern);
  }
}

/**
 * Decorator for caching class methods
 */
export function Cached(
  cacheGetter: () => LRUCache<string, any>,
  keyGenerator?: (...args: any[]) => string,
  ttl?: number
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cache = cacheGetter();
      const key = keyGenerator ? keyGenerator(...args) : `${propertyName}:${JSON.stringify(args)}`;

      // Check cache
      const cached = cache.get(key);
      if (cached !== null) {
        return cached;
      }

      // Call original method
      const result = await originalMethod.apply(this, args);

      // Cache result
      cache.set(key, result);

      return result;
    };

    return descriptor;
  };
}
