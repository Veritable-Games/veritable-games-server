/**
 * Performance Monitoring Utilities
 *
 * Provides lightweight performance tracking for:
 * - Database query performance
 * - API request duration
 * - Cache hit/miss rates
 * - Memory usage
 *
 * Usage:
 *   import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
 *
 *   // Track database query
 *   const result = await performanceMonitor.trackQuery('getTopics', () => {
 *     return db.prepare('SELECT * FROM topics').all();
 *   });
 *
 *   // Track API request
 *   const handler = performanceMonitor.trackRequest('GET /api/topics', async () => {
 *     // Your handler logic
 *   });
 */

import { LRUCache } from 'lru-cache';
import { logger } from '@/lib/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface QueryMetric {
  name: string;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

export interface RequestMetric {
  method: string;
  path: string;
  duration: number;
  statusCode: number;
  timestamp: number;
}

export interface CacheMetric {
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

export interface PerformanceStats {
  queries: {
    total: number;
    slow: number; // > 100ms
    failed: number;
    averageDuration: number;
    slowest: QueryMetric[];
  };
  requests: {
    total: number;
    slow: number; // > 1000ms
    failed: number;
    averageDuration: number;
    slowest: RequestMetric[];
  };
  cache: CacheMetric;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

// ============================================================================
// Performance Monitor Class
// ============================================================================

class PerformanceMonitor {
  private queryMetrics: LRUCache<string, QueryMetric>;
  private requestMetrics: LRUCache<string, RequestMetric>;
  private cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  // Thresholds
  private readonly SLOW_QUERY_MS = 100;
  private readonly SLOW_REQUEST_MS = 1000;
  private readonly MAX_STORED_METRICS = 1000;

  constructor() {
    this.queryMetrics = new LRUCache<string, QueryMetric>({
      max: this.MAX_STORED_METRICS,
      ttl: 1000 * 60 * 60, // 1 hour
    });

    this.requestMetrics = new LRUCache<string, RequestMetric>({
      max: this.MAX_STORED_METRICS,
      ttl: 1000 * 60 * 60, // 1 hour
    });
  }

  // ==========================================================================
  // Query Performance Tracking
  // ==========================================================================

  /**
   * Track a database query's performance
   */
  async trackQuery<T>(name: string, queryFn: () => T | Promise<T>): Promise<T> {
    const startTime = performance.now();
    let success = true;
    let error: string | undefined;

    try {
      const result = await queryFn();
      return result;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const duration = performance.now() - startTime;

      const metric: QueryMetric = {
        name,
        duration,
        timestamp: Date.now(),
        success,
        error,
      };

      this.queryMetrics.set(`${name}-${Date.now()}`, metric);

      // Log slow queries in development
      if (duration > this.SLOW_QUERY_MS && process.env.NODE_ENV === 'development') {
        logger.warn(`[SLOW QUERY] ${name} took ${duration.toFixed(2)}ms`);
      }
    }
  }

  /**
   * Track a database query synchronously
   */
  trackQuerySync<T>(name: string, queryFn: () => T): T {
    const startTime = performance.now();
    let success = true;
    let error: string | undefined;

    try {
      const result = queryFn();
      return result;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const duration = performance.now() - startTime;

      const metric: QueryMetric = {
        name,
        duration,
        timestamp: Date.now(),
        success,
        error,
      };

      this.queryMetrics.set(`${name}-${Date.now()}`, metric);

      if (duration > this.SLOW_QUERY_MS && process.env.NODE_ENV === 'development') {
        logger.warn(`[SLOW QUERY] ${name} took ${duration.toFixed(2)}ms`);
      }
    }
  }

  // ==========================================================================
  // Request Performance Tracking
  // ==========================================================================

  /**
   * Track an API request's performance
   */
  async trackRequest<T>(
    method: string,
    path: string,
    handler: () => T | Promise<T>,
    statusCode: number = 200
  ): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await handler();
      return result;
    } finally {
      const duration = performance.now() - startTime;

      const metric: RequestMetric = {
        method,
        path,
        duration,
        statusCode,
        timestamp: Date.now(),
      };

      this.requestMetrics.set(`${method}-${path}-${Date.now()}`, metric);

      if (duration > this.SLOW_REQUEST_MS && process.env.NODE_ENV === 'development') {
        logger.warn(`[SLOW REQUEST] ${method} ${path} took ${duration.toFixed(2)}ms`);
      }
    }
  }

  // ==========================================================================
  // Cache Performance Tracking
  // ==========================================================================

  /**
   * Record a cache hit
   */
  recordCacheHit(): void {
    this.cacheStats.hits++;
  }

  /**
   * Record a cache miss
   */
  recordCacheMiss(): void {
    this.cacheStats.misses++;
  }

  /**
   * Record a cache eviction
   */
  recordCacheEviction(): void {
    this.cacheStats.evictions++;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheMetric {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? (this.cacheStats.hits / total) * 100 : 0;

    return {
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      evictions: this.cacheStats.evictions,
    };
  }

  /**
   * Reset cache statistics
   */
  resetCacheStats(): void {
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  // ==========================================================================
  // Performance Statistics
  // ==========================================================================

  /**
   * Get comprehensive performance statistics
   */
  getStats(): PerformanceStats {
    // Query stats
    const allQueries = Array.from(this.queryMetrics.values());
    const totalQueries = allQueries.length;
    const slowQueries = allQueries.filter(q => q.duration > this.SLOW_QUERY_MS);
    const failedQueries = allQueries.filter(q => !q.success);
    const avgQueryDuration =
      totalQueries > 0 ? allQueries.reduce((sum, q) => sum + q.duration, 0) / totalQueries : 0;
    const slowestQueries = allQueries.sort((a, b) => b.duration - a.duration).slice(0, 10);

    // Request stats
    const allRequests = Array.from(this.requestMetrics.values());
    const totalRequests = allRequests.length;
    const slowRequests = allRequests.filter(r => r.duration > this.SLOW_REQUEST_MS);
    const failedRequests = allRequests.filter(r => r.statusCode >= 400);
    const avgRequestDuration =
      totalRequests > 0 ? allRequests.reduce((sum, r) => sum + r.duration, 0) / totalRequests : 0;
    const slowestRequests = allRequests.sort((a, b) => b.duration - a.duration).slice(0, 10);

    // Cache stats
    const cacheStats = this.getCacheStats();

    // Memory stats (only available server-side)
    let memoryStats = {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0,
    };

    if (typeof process !== 'undefined' && process.memoryUsage) {
      const mem = process.memoryUsage();
      memoryStats = {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
        rss: mem.rss,
      };
    }

    return {
      queries: {
        total: totalQueries,
        slow: slowQueries.length,
        failed: failedQueries.length,
        averageDuration: Math.round(avgQueryDuration * 100) / 100,
        slowest: slowestQueries,
      },
      requests: {
        total: totalRequests,
        slow: slowRequests.length,
        failed: failedRequests.length,
        averageDuration: Math.round(avgRequestDuration * 100) / 100,
        slowest: slowestRequests,
      },
      cache: cacheStats,
      memory: memoryStats,
    };
  }

  /**
   * Reset all performance metrics
   */
  reset(): void {
    this.queryMetrics.clear();
    this.requestMetrics.clear();
    this.resetCacheStats();
  }

  /**
   * Get a formatted performance report
   */
  getReport(): string {
    const stats = this.getStats();

    return `
═══════════════════════════════════════════════════════════
                  PERFORMANCE REPORT
═══════════════════════════════════════════════════════════

📊 QUERIES
  Total: ${stats.queries.total}
  Slow (>${this.SLOW_QUERY_MS}ms): ${stats.queries.slow}
  Failed: ${stats.queries.failed}
  Average Duration: ${stats.queries.averageDuration.toFixed(2)}ms

🌐 REQUESTS
  Total: ${stats.requests.total}
  Slow (>${this.SLOW_REQUEST_MS}ms): ${stats.requests.slow}
  Failed: ${stats.requests.failed}
  Average Duration: ${stats.requests.averageDuration.toFixed(2)}ms

💾 CACHE
  Hits: ${stats.cache.hits}
  Misses: ${stats.cache.misses}
  Hit Rate: ${stats.cache.hitRate}%
  Evictions: ${stats.cache.evictions}

🧠 MEMORY
  Heap Used: ${(stats.memory.heapUsed / 1024 / 1024).toFixed(2)} MB
  Heap Total: ${(stats.memory.heapTotal / 1024 / 1024).toFixed(2)} MB
  RSS: ${(stats.memory.rss / 1024 / 1024).toFixed(2)} MB

═══════════════════════════════════════════════════════════
`;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const performanceMonitor = new PerformanceMonitor();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format duration to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}
