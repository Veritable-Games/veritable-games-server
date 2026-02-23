/**
 * Performance Metrics API Endpoint
 *
 * Exposes database query performance, cache hit rates, and system metrics.
 * Used for monitoring dashboard and alerting.
 *
 * GET /api/metrics
 *
 * Response:
 * {
 *   timestamp: "2025-10-08T12:00:00.000Z",
 *   queries: { count, p50, p95, p99, max, avg, slowQueries },
 *   slowQueries: [ { sql, duration, timestamp, params } ],
 *   database: { size, tableCount, indexCount }
 * }
 */

import { NextResponse } from 'next/server';
import { queryMonitor } from '@/lib/database/query-monitor';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * Get database schema statistics (PostgreSQL)
 */
async function getDatabaseStats(
  schemaName: 'forums' | 'wiki' | 'library' | 'content' | 'users' | 'auth' | 'system'
) {
  try {
    // Get table and index counts for schema
    const tableResult = await dbAdapter.query(
      `SELECT COUNT(*) as count
       FROM information_schema.tables
       WHERE table_schema = $1
       AND table_type = 'BASE TABLE'`,
      [schemaName],
      { schema: schemaName }
    );

    const indexResult = await dbAdapter.query(
      `SELECT COUNT(*) as count
       FROM pg_indexes
       WHERE schemaname = $1`,
      [schemaName],
      { schema: schemaName }
    );

    // Get approximate schema size
    const sizeResult = await dbAdapter.query(
      `SELECT
         pg_size_pretty(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)::regclass))::bigint) as size,
         SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)::regclass))::bigint as size_bytes
       FROM pg_tables
       WHERE schemaname = $1`,
      [schemaName],
      { schema: schemaName }
    );

    return {
      name: schemaName,
      size: sizeResult.rows[0]?.size || '0 bytes',
      sizeBytes: sizeResult.rows[0]?.size_bytes || 0,
      tables: tableResult.rows[0]?.count || 0,
      indexes: indexResult.rows[0]?.count || 0,
    };
  } catch (error) {
    return {
      name: schemaName,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * GET /api/metrics
 */
export async function GET() {
  try {
    // Query performance metrics
    const queryMetrics = queryMonitor.getMetrics();
    const slowQueries = queryMonitor.getSlowQueries(10);

    // Database statistics (PostgreSQL schemas)
    const schemas: Array<'forums' | 'wiki' | 'library' | 'content' | 'users' | 'auth' | 'system'> =
      ['forums', 'wiki', 'library', 'content', 'users', 'auth', 'system'];
    const dbStatsPromises = schemas.map(getDatabaseStats);
    const dbStats = await Promise.all(dbStatsPromises);

    // Calculate total database size
    const totalSize = dbStats.reduce((sum, db) => sum + (db.sizeBytes || 0), 0);

    // Get PostgreSQL connection pool stats
    const adapterStats = dbAdapter.getStats();

    return NextResponse.json({
      timestamp: new Date().toISOString(),

      // Query performance
      queries: {
        count: queryMetrics.count,
        p50: parseFloat(queryMetrics.p50.toFixed(2)),
        p95: parseFloat(queryMetrics.p95.toFixed(2)),
        p99: parseFloat(queryMetrics.p99.toFixed(2)),
        max: parseFloat(queryMetrics.max.toFixed(2)),
        avg: parseFloat(queryMetrics.avg.toFixed(2)),
        slowQueries: queryMetrics.slowQueries,
      },

      // Slow queries for debugging
      slowQueries: slowQueries.map(q => ({
        sql: q.sql.substring(0, 200), // Truncate long queries
        duration: parseFloat(q.duration.toFixed(2)),
        timestamp: new Date(q.timestamp).toISOString(),
        params: q.params?.slice(0, 5), // Limit params for security
      })),

      // Database statistics (PostgreSQL schemas)
      databases: dbStats,
      totalSize: totalSize > 0 ? `${(totalSize / 1024 / 1024).toFixed(2)} MB` : '0 MB',
      totalSizeBytes: totalSize,

      // Connection pool statistics
      connectionPool: {
        totalConnections: adapterStats.pgPoolStats.totalCount,
        idleConnections: adapterStats.pgPoolStats.idleCount,
        waitingClients: adapterStats.pgPoolStats.waitingCount,
      },
    });
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    return NextResponse.json(
      {
        error: 'Failed to get metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/metrics/reset
 * Reset query metrics (for testing)
 */
export async function POST() {
  try {
    queryMonitor.reset();
    return NextResponse.json({ success: true, message: 'Metrics reset' });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to reset metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
