/**
 * Cache Health Check API
 *
 * Provides health status for the caching infrastructure:
 * - Redis cluster health
 * - L1 cache status
 * - Performance metrics
 * - Connection statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { cache } from '@/lib/cache';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

/**
 * Cache health check result interface
 */
interface CacheHealthCheck {
  status: 'healthy' | 'degraded';
  cacheCount: number;
  overall?: boolean;
  l1?: {
    status: string;
    size: number;
    maxSize: number;
    evictions: number;
  };
  l2?: {
    status: string;
    connected: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Cache statistics interface
 */
interface CacheStats {
  hitRate: number;
  hits: number;
  misses: number;
  l1Stats?: {
    size: number;
    maxSize: number;
    evictions: number;
    [key: string]: unknown;
  };
  l2Stats?: {
    keys: number;
    memory: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function GETHandler(request: NextRequest) {
  try {
    // Get cache health information
    const [healthCheckResult, statsResult] = await Promise.all([
      cache.healthCheck(),
      cache.getStats(),
    ]);

    const healthCheck = healthCheckResult as unknown as CacheHealthCheck;
    const stats = statsResult as unknown as CacheStats;

    // Test cache functionality
    const testKey = 'health-check-test';
    const testValue = { timestamp: Date.now(), test: 'cache-health' };

    const cacheKey = { category: 'session' as const, identifier: testKey };
    const setSuccess = await cache.set(cacheKey, testValue);
    const getValue = await cache.get(cacheKey);
    const deleteSuccess = await cache.delete(cacheKey);

    const functionalityTest = {
      canSet: setSuccess,
      canGet: getValue !== null && (getValue as { test?: string })?.test === 'cache-health',
      canDelete: deleteSuccess,
    };

    const overallHealth =
      (healthCheck.overall ?? healthCheck.status === 'healthy') &&
      functionalityTest.canSet &&
      functionalityTest.canGet &&
      functionalityTest.canDelete;

    return NextResponse.json({
      success: true,
      data: {
        status: overallHealth ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        caches: {
          l1: healthCheck.l1,
          l2: healthCheck.l2,
        },
        performance: {
          hitRate: stats.hitRate,
          totalRequests: (stats.hits || 0) + (stats.misses || 0),
          l1Stats: stats.l1Stats,
          l2Stats: stats.l2Stats,
        },
        functionality: functionalityTest,
      },
    });
  } catch (error) {
    logger.error('Cache health check failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Cache health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Apply security middleware
export const GET = withSecurity(GETHandler, {});
