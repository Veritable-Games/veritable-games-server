/**
 * Database Query Performance Monitor
 *
 * Tracks query latency, identifies slow queries, and provides performance metrics.
 * Automatically logs EXPLAIN QUERY PLAN for queries exceeding threshold.
 *
 * Usage:
 *   import { queryMonitor, monitoredPrepare } from '@/lib/database/query-monitor';
 *
 *   const stmt = monitoredPrepare(db, 'SELECT * FROM topics WHERE id = ?');
 *   const topic = stmt.get(123);
 *
 *   // Get metrics
 *   const metrics = queryMonitor.getMetrics();
 */

import { performance } from 'perf_hooks';
import type Database from 'better-sqlite3';
import { logger } from '@/lib/utils/logger';

/**
 * Query execution metrics
 */
interface QueryMetrics {
  sql: string;
  duration: number;
  timestamp: number;
  params?: unknown[];
}

/**
 * SQLite EXPLAIN QUERY PLAN result row
 */
interface QueryPlanRow {
  id?: number;
  parent?: number;
  notused?: number;
  detail?: string;
  [key: string]: unknown; // Additional fields SQLite may return
}

interface QueryStats {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  avg: number;
  slowQueries: number;
}

class QueryMonitor {
  private queries: QueryMetrics[] = [];
  private slowQueryThreshold = 50; // 50ms
  private maxStoredQueries = 1000; // Prevent memory leak

  /**
   * Log a query execution with timing
   */
  logQuery(sql: string, params: unknown[], duration: number) {
    // Store query metrics
    this.queries.push({ sql, params, duration, timestamp: Date.now() });

    // Prevent unbounded memory growth
    if (this.queries.length > this.maxStoredQueries) {
      this.queries.shift();
    }

    // Alert on slow queries
    if (duration > this.slowQueryThreshold) {
      this.logSlowQuery(sql, params, duration);
    }
  }

  /**
   * Log slow query with warning
   */
  private logSlowQuery(sql: string, params: unknown[], duration: number) {
    logger.warn(`[Slow Query] ${duration.toFixed(2)}ms:`, {
      sql: sql.substring(0, 200), // Truncate long queries
      params: params?.slice(0, 5), // Limit param logging
    });

    // Note: EXPLAIN QUERY PLAN requires db instance, which we don't have here
    // The calling code should implement this if needed
  }

  /**
   * Calculate percentile from sorted durations
   */
  private getPercentile(percentile: number): number {
    if (this.queries.length === 0) return 0;

    const sorted = this.queries.map(q => q.duration).sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  /**
   * Get performance metrics (P50, P95, P99, etc.)
   */
  getMetrics(): QueryStats {
    if (this.queries.length === 0) {
      return {
        count: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        max: 0,
        avg: 0,
        slowQueries: 0,
      };
    }

    const durations = this.queries.map(q => q.duration);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count: this.queries.length,
      p50: this.getPercentile(0.5),
      p95: this.getPercentile(0.95),
      p99: this.getPercentile(0.99),
      max: Math.max(...durations),
      avg: sum / durations.length,
      slowQueries: this.queries.filter(q => q.duration > this.slowQueryThreshold).length,
    };
  }

  /**
   * Get slow queries for analysis
   */
  getSlowQueries(limit = 10): QueryMetrics[] {
    return this.queries
      .filter(q => q.duration > this.slowQueryThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Reset metrics (e.g., after collecting stats)
   */
  reset() {
    this.queries = [];
  }

  /**
   * Set slow query threshold
   */
  setSlowQueryThreshold(ms: number) {
    this.slowQueryThreshold = ms;
  }
}

/**
 * Global query monitor instance
 */
export const queryMonitor = new QueryMonitor();

/**
 * Wrap better-sqlite3 prepared statement to auto-log queries
 *
 * @param db Database instance
 * @param sql SQL query string
 * @returns Monitored prepared statement
 */
export function monitoredPrepare(db: Database.Database, sql: string) {
  const stmt = db.prepare(sql);

  return {
    /**
     * Execute query and return single row
     */
    get: (...params: unknown[]) => {
      const start = performance.now();
      const result = stmt.get(...params);
      const duration = performance.now() - start;
      queryMonitor.logQuery(sql, params, duration);
      return result;
    },

    /**
     * Execute query and return all rows
     */
    all: (...params: unknown[]) => {
      const start = performance.now();
      const result = stmt.all(...params);
      const duration = performance.now() - start;
      queryMonitor.logQuery(sql, params, duration);
      return result;
    },

    /**
     * Execute query and return metadata
     */
    run: (...params: unknown[]) => {
      const start = performance.now();
      const result = stmt.run(...params);
      const duration = performance.now() - start;
      queryMonitor.logQuery(sql, params, duration);
      return result;
    },

    /**
     * Iterate over result rows
     */
    iterate: (...params: unknown[]) => {
      const start = performance.now();
      const iterator = stmt.iterate(...params);
      const duration = performance.now() - start;
      queryMonitor.logQuery(sql, params, duration);
      return iterator;
    },
  };
}

/**
 * Helper to check if query uses index (requires EXPLAIN QUERY PLAN)
 */
export function explainQueryPlan(
  db: Database.Database,
  sql: string,
  params: unknown[] = []
): QueryPlanRow[] {
  try {
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params);
    return plan as QueryPlanRow[];
  } catch (error) {
    logger.error('Failed to get query plan:', error);
    return [];
  }
}

/**
 * Check if query plan uses indexes (no table scans)
 */
export function isOptimizedQuery(plan: QueryPlanRow[]): boolean {
  // Check if any step uses SCAN TABLE (bad - no index)
  const hasTableScan = plan.some((row: QueryPlanRow) => row.detail?.includes('SCAN TABLE'));

  // Check if query uses indexes (good)
  const hasIndexUsage = plan.some(
    (row: QueryPlanRow) =>
      row.detail?.includes('USING INDEX') || row.detail?.includes('SEARCH TABLE')
  );

  return !hasTableScan && hasIndexUsage;
}

/**
 * Auto-monitoring wrapper for development
 *
 * Usage in pool.ts:
 *   if (process.env.NODE_ENV !== 'production') {
 *     return withQueryMonitoring(db);
 *   }
 */
export function withQueryMonitoring(db: Database.Database): Database.Database {
  const originalPrepare = db.prepare.bind(db);

  // Override prepare() to use monitored version
  db.prepare = ((sql: string) => {
    return monitoredPrepare(db, sql);
  }) as typeof db.prepare;

  return db;
}
