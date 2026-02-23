/**
 * Performance Metrics API Endpoint
 *
 * GET /api/metrics/performance
 *
 * Returns comprehensive performance statistics including:
 * - Database query performance
 * - API request latency
 * - Cache hit/miss rates
 * - Memory usage
 *
 * Only available in development and staging environments for security.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  performanceMonitor,
  formatBytes,
  formatDuration,
} from '@/lib/monitoring/performance-monitor';
import { withSecurity } from '@/lib/security/middleware';

// Mark as dynamic - this endpoint requires runtime performance monitoring
export const dynamic = 'force-dynamic';

export const GET = withSecurity(
  async (request: NextRequest) => {
    // Security: Only allow in non-production environments
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_METRICS !== 'true') {
      return NextResponse.json(
        { error: 'Performance metrics are only available in development' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'json'; // json or text
    const reset = searchParams.get('reset') === 'true';

    // Get performance stats
    const stats = performanceMonitor.getStats();

    // Reset metrics if requested
    if (reset) {
      performanceMonitor.reset();
    }

    // Format response
    if (format === 'text') {
      const report = performanceMonitor.getReport();
      return new NextResponse(report, {
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    // JSON response with formatted values
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? `${process.uptime().toFixed(0)}s` : 'N/A',

      queries: {
        total: stats.queries.total,
        slow: stats.queries.slow,
        failed: stats.queries.failed,
        averageDuration: `${stats.queries.averageDuration.toFixed(2)}ms`,
        slowest: stats.queries.slowest.map(q => ({
          name: q.name,
          duration: formatDuration(q.duration),
          timestamp: new Date(q.timestamp).toISOString(),
          success: q.success,
          error: q.error,
        })),
      },

      requests: {
        total: stats.requests.total,
        slow: stats.requests.slow,
        failed: stats.requests.failed,
        averageDuration: `${stats.requests.averageDuration.toFixed(2)}ms`,
        slowest: stats.requests.slowest.map(r => ({
          method: r.method,
          path: r.path,
          duration: formatDuration(r.duration),
          statusCode: r.statusCode,
          timestamp: new Date(r.timestamp).toISOString(),
        })),
      },

      cache: {
        hits: stats.cache.hits,
        misses: stats.cache.misses,
        hitRate: `${stats.cache.hitRate}%`,
        evictions: stats.cache.evictions,
        total: stats.cache.hits + stats.cache.misses,
      },

      memory: {
        heapUsed: formatBytes(stats.memory.heapUsed),
        heapTotal: formatBytes(stats.memory.heapTotal),
        external: formatBytes(stats.memory.external),
        rss: formatBytes(stats.memory.rss),
        heapUtilization:
          stats.memory.heapTotal > 0
            ? `${((stats.memory.heapUsed / stats.memory.heapTotal) * 100).toFixed(1)}%`
            : 'N/A',
      },

      thresholds: {
        slowQuery: '100ms',
        slowRequest: '1000ms',
      },
    });
  },
  {
    // Read-only endpoint
  }
);
