import { NextRequest, NextResponse } from 'next/server';
import { CacheHelper } from './CacheHelper';
import { logger } from '@/lib/utils/logger';

interface CachedResponse {
  body: string;
  status: number;
  headers: Record<string, string>;
  timestamp: number;
}

interface ApiCacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
  revalidate?: boolean; // Allow stale-while-revalidate
  excludeHeaders?: string[]; // Headers to exclude from cache key
}

/**
 * API Response Caching Middleware
 *
 * Provides intelligent caching for API routes with:
 * - Configurable TTL
 * - Tag-based invalidation
 * - Stale-while-revalidate support
 * - Automatic cache key generation
 *
 * @example
 * ```typescript
 * export const GET = withApiCache(
 *   async (request) => {
 *     const data = await expensive Operation();
 *     return NextResponse.json(data);
 *   },
 *   { ttl: 300, tags: ['forums', 'topics'] }
 * );
 * ```
 */
export function withApiCache<T extends NextRequest>(
  handler: (request: T) => Promise<NextResponse>,
  options: ApiCacheOptions = {}
) {
  const {
    ttl = 300, // Default 5 minutes
    tags = [],
    revalidate = true,
    excludeHeaders = ['cookie', 'authorization'],
  } = options;

  return async (request: T): Promise<NextResponse> => {
    // Only cache GET requests
    if (request.method !== 'GET') {
      return handler(request);
    }

    // Generate cache key
    const cacheKey = generateCacheKey(request, excludeHeaders);
    const cache = new CacheHelper();

    // Try to get from cache
    try {
      const cached = await cache.get<CachedResponse>(cacheKey);

      if (cached) {
        const age = Date.now() - cached.timestamp;
        const isExpired = age > ttl * 1000;

        if (!isExpired) {
          // Cache hit - return cached response
          return new NextResponse(cached.body, {
            status: cached.status,
            headers: {
              ...cached.headers,
              'X-Cache': 'HIT',
              'X-Cache-Age': Math.floor(age / 1000).toString(),
              'Cache-Control': `public, max-age=${ttl}, stale-while-revalidate=${ttl}`,
            },
          });
        } else if (revalidate) {
          // Serve stale while revalidating
          revalidateInBackground(request, handler, cacheKey, cache, ttl, tags);

          return new NextResponse(cached.body, {
            status: cached.status,
            headers: {
              ...cached.headers,
              'X-Cache': 'STALE',
              'X-Cache-Age': Math.floor(age / 1000).toString(),
            },
          });
        }
      }
    } catch (error) {
      logger.error('Cache retrieval error:', error);
    }

    // Cache miss - execute handler
    try {
      const response = await handler(request);

      // Only cache successful responses
      if (response.ok && response.status === 200) {
        const body = await response.text();
        const headers = Object.fromEntries(response.headers.entries());

        // Store in cache
        const cacheData: CachedResponse = {
          body,
          status: response.status,
          headers: sanitizeHeaders(headers, excludeHeaders),
          timestamp: Date.now(),
        };

        await cache.set(cacheKey, cacheData, ttl, tags);

        // Return new response with cache headers
        return new NextResponse(body, {
          status: response.status,
          headers: {
            ...headers,
            'X-Cache': 'MISS',
            'Cache-Control': `public, max-age=${ttl}, stale-while-revalidate=${ttl}`,
          },
        });
      }

      return response;
    } catch (error) {
      logger.error('Handler execution error:', error);
      throw error;
    }
  };
}

/**
 * Generate a cache key from request properties
 */
function generateCacheKey(request: NextRequest, excludeHeaders: string[]): string {
  const url = request.url;
  const method = request.method;

  // Include relevant headers in cache key
  const headerParts: string[] = [];
  request.headers.forEach((value, key) => {
    if (!excludeHeaders.includes(key.toLowerCase())) {
      headerParts.push(`${key}:${value}`);
    }
  });

  return `api:${method}:${url}:${headerParts.join(',')}`;
}

/**
 * Sanitize headers for caching (remove sensitive headers)
 */
function sanitizeHeaders(
  headers: Record<string, string>,
  excludeHeaders: string[]
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (
      !excludeHeaders.includes(lowerKey) &&
      !lowerKey.startsWith('x-') &&
      lowerKey !== 'set-cookie'
    ) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Revalidate cache in background
 */
async function revalidateInBackground<T extends NextRequest>(
  request: T,
  handler: (request: T) => Promise<NextResponse>,
  cacheKey: string,
  cache: CacheHelper,
  ttl: number,
  tags: string[]
): Promise<void> {
  // Execute in background without blocking
  setImmediate(async () => {
    try {
      const response = await handler(request);

      if (response.ok && response.status === 200) {
        const body = await response.text();
        const headers = Object.fromEntries(response.headers.entries());

        const cacheData: CachedResponse = {
          body,
          status: response.status,
          headers: sanitizeHeaders(headers, ['cookie', 'authorization']),
          timestamp: Date.now(),
        };

        await cache.set(cacheKey, cacheData, ttl, tags);
      }
    } catch (error) {
      logger.error('Background revalidation error:', error);
    }
  });
}

/**
 * Invalidate cache by tags
 */
export async function invalidateCacheByTags(tags: string[]): Promise<void> {
  const cache = new CacheHelper();
  await cache.invalidateByTags(tags);
}

/**
 * Clear entire API cache
 */
export async function clearApiCache(): Promise<void> {
  const cache = new CacheHelper();
  await cache.clearAll();
}

// Export cache presets for common use cases
export const CachePresets = {
  // Very short cache for dynamic content
  DYNAMIC: { ttl: 30, revalidate: true },

  // Standard API caching
  STANDARD: { ttl: 300, revalidate: true },

  // Longer cache for semi-static content
  SEMI_STATIC: { ttl: 900, revalidate: true },

  // Long cache for static content
  STATIC: { ttl: 3600, revalidate: false },

  // User-specific content (exclude auth headers from key)
  USER_SPECIFIC: { ttl: 60, excludeHeaders: [], revalidate: true },

  // Public content
  PUBLIC: { ttl: 600, excludeHeaders: ['cookie', 'authorization'], revalidate: true },
};
