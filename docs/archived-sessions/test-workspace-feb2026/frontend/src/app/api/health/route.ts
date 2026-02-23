import { NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import { searchManager } from '@/lib/search/searchManager';
// import * as Sentry from '@sentry/nextjs'; // Removed - Sentry not configured
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/health - Health check endpoint
 * Returns service status and database connectivity
 *
 * Logging policy:
 * - Logs only slow responses (>1000ms) or errors
 * - Reduces noise in production logs
 */
async function GETHandler() {
  try {
    const startTime = Date.now();

    // Database connectivity test (PostgreSQL only)
    let dbStatus = 'unknown';
    let connectionPoolStats: any = {};

    try {
      // Test PostgreSQL connectivity
      const result = await dbAdapter.query('SELECT 1 as test', [], { schema: 'system' });
      if (result.rows && result.rows[0]?.test === 1) {
        dbStatus = 'connected';
        const adapterStats = dbAdapter.getStats();
        connectionPoolStats = {
          mode: 'postgresql',
          totalConnections: adapterStats.pgPoolStats.totalCount,
          idleConnections: adapterStats.pgPoolStats.idleCount,
          waitingClients: adapterStats.pgPoolStats.waitingCount,
        };
      } else {
        dbStatus = 'error';
      }
    } catch (error) {
      dbStatus = 'error';
      logger.error('Health check database error:', error);
    }

    const responseTime = Date.now() - startTime;

    // Log slow health checks (performance monitoring)
    if (responseTime > 1000) {
      logger.warn(`[Health Check] Slow response: ${responseTime}ms (dbStatus: ${dbStatus})`);
    }

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      service: {
        name: 'veritable-games-main',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        features: {
          // forums: true, // Forums removed
          wiki: true,
          user_management: true,
          search: true,
        },
      },
      database: {
        status: dbStatus,
        connectionPool: connectionPoolStats,
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
    };

    // Determine overall status
    if (dbStatus === 'error') {
      health.status = 'unhealthy';
      logger.error(`[Health Check] Database error detected (responseTime: ${responseTime}ms)`);
      return NextResponse.json(health, { status: 503 });
    }

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    logger.error('[Health Check] Unexpected error:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        service: {
          name: 'veritable-games-main',
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
        },
      },
      { status: 503 }
    );
  }
}

// Apply security middleware
export const GET = withSecurity(GETHandler, {});
