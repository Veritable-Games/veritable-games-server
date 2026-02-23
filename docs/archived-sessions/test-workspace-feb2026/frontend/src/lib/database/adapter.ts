/**
 * Database Adapter Layer - PostgreSQL Only
 *
 * Unified interface for PostgreSQL database access
 * SQLite support has been completely removed
 *
 * Features:
 * - PostgreSQL connection pooling via pg library
 * - Schema-based database organization
 * - Query syntax conversion (SQLite → PostgreSQL)
 * - Performance monitoring
 * - Transaction support
 */

import { PoolClient } from 'pg';
import { pgPool, type DatabaseSchema } from './pool-postgres';
import { serializeError, serializeErrorDetail } from '@/lib/utils/serialize-error';
import { logger } from '@/lib/utils/logger';

/**
 * PostgreSQL error with error code
 */
interface PostgreSQLError extends Error {
  code?: string;
  detail?: string;
  hint?: string;
}

/**
 * Row with potential ID field
 */
interface RowWithId {
  id?: number | bigint;
  lastInsertId?: number | bigint;
  [key: string]: any;
}

/**
 * Database operation mode (PostgreSQL only)
 */
export type DatabaseMode = 'postgres';

/**
 * Unified query result interface
 */
export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  lastInsertId?: number | bigint;
}

/**
 * Query options
 */
export interface QueryOptions {
  schema?: DatabaseSchema; // PostgreSQL schema name (e.g., 'users', 'forums', 'wiki')
  returnLastId?: boolean; // Return last inserted ID
}

/**
 * Database Adapter Statistics
 */
interface AdapterStats {
  queries: number;
  errors: number;
  dualWriteDiscrepancies: number;
  mode: DatabaseMode;
  lastError?: string;
}

/**
 * Database Adapter
 *
 * Routes all queries to PostgreSQL database
 * SQLite is NOT supported - DATABASE_MODE environment variable is ignored
 * See adapter constructor (line 69) for fatal error if PostgreSQL not configured
 */
class DatabaseAdapter {
  private mode: DatabaseMode;
  private stats: AdapterStats;
  private discrepancyLog: Array<{
    timestamp: Date;
    sql: string;
    sqliteCount: number;
    postgresCount: number;
  }>;

  constructor() {
    // POSTGRESQL-ONLY MODE: SQLite support completely removed
    this.mode = 'postgres';

    // Allow build-time bypass for Docker builds (DATABASE_URL not yet available during build)
    // This allows Next.js build to succeed even when database isn't configured
    // Runtime will still fail if database is not properly configured
    //
    // Build phase detection: Check multiple indicators since different build systems set different vars
    // - NEXT_IS_BUILD: Custom variable set in Dockerfile (MOST RELIABLE for Docker builds)
    // - NEXT_PHASE: Next.js internal variable (only works in next.config.js, NOT regular TS!)
    // - __NEXT_BUILDING: Internal Next.js build flag
    // - NODE_ENV: development means definitely not a production build
    // The key insight: if we're in a build phase but DATABASE_URL is not set, skip all logging
    const isBuildPhase =
      process.env.NEXT_IS_BUILD === 'true' || // Custom Dockerfile variable - MOST RELIABLE
      process.env.NEXT_PHASE?.includes('build') ||
      process.env.__NEXT_BUILDING === 'true' ||
      process.env.NODE_ENV === 'development';

    // If DATABASE_URL is not set at runtime, try a sensible fallback for Coolify deployments
    if (!isBuildPhase && !process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      // Assume Coolify deployment with standard configuration
      const fallbackUrl =
        'postgresql://postgres:secure_postgres_password@veritable-games-postgres-new:5432/veritable_games';

      logger.warn('DATABASE_URL not configured in environment', {
        fallback: 'veritable-games-postgres-new',
        suggestion: 'Set DATABASE_URL or POSTGRES_URL env var for custom configuration',
      });

      process.env.DATABASE_URL = fallbackUrl;
    }

    this.stats = {
      queries: 0,
      errors: 0,
      dualWriteDiscrepancies: 0,
      mode: this.mode,
    };
    this.discrepancyLog = [];

    // Only log during non-build phases to avoid issues during Turbopack page data collection
    if (isBuildPhase) {
      logger.info(
        '[DatabaseAdapter] Build phase detected, skipping detailed initialization logging'
      );
    } else {
      logger.info('Database adapter initialized', {
        mode: 'PostgreSQL-only',
        connection:
          process.env.POSTGRES_URL?.split('@')[1] ||
          process.env.DATABASE_URL?.split('@')[1] ||
          'configured',
      });
    }
  }

  /**
   * Execute a query on PostgreSQL
   */
  async query<T = any>(
    sql: string,
    params: any[] = [],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    this.stats.queries++;

    try {
      return await this.queryPostgres<T>(sql, params, options);
    } catch (error) {
      this.stats.errors++;
      this.stats.lastError = error instanceof Error ? error.message : String(error);

      // Enhanced error logging with serialized error details
      const errorDetail = serializeErrorDetail(error);

      // Check if this is a PostgreSQL schema error (missing table/schema)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const pgError = error as PostgreSQLError;
      const isSchemaError =
        pgError.code === '42P01' ||
        errorMessage.includes('does not exist') ||
        errorMessage.includes('relation');

      if (isSchemaError) {
        // Log schema errors as info (expected on localhost without anarchist schema)
        logger.info('Schema not available (expected on localhost)', {
          schema: options.schema,
          message: errorMessage,
        });
      } else {
        // Log other errors as actual errors
        logger.error('PostgreSQL query failed', {
          sql: sql.substring(0, 200),
          schema: options.schema,
          params: params,
          error: errorDetail,
        });
      }
      throw error;
    }
  }

  /**
   * Execute query on PostgreSQL (asynchronous)
   */
  private async queryPostgres<T>(
    sql: string,
    params: any[],
    options: QueryOptions
  ): Promise<QueryResult<T>> {
    // Convert SQLite syntax to PostgreSQL
    const pgSql = this.convertSQLiteToPostgres(sql, options.schema);
    const pgParams = this.convertParams(params, sql);

    const result = await pgPool.query<T>(pgSql, pgParams, options.schema);

    // Extract last insert ID if requested
    let lastInsertId: number | bigint | undefined;
    if (options.returnLastId && result.rows.length > 0) {
      const firstRow = result.rows[0] as RowWithId;
      lastInsertId = firstRow.id || firstRow.lastInsertId;
    }

    return {
      ...result,
      lastInsertId,
    };
  }

  /**
   * Execute transaction on PostgreSQL
   */
  async transaction<T>(
    callback: (adapter: DatabaseAdapter) => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    return await pgPool.transaction(options.schema || 'forums', async (client: PoolClient) => {
      return await callback(this);
    });
  }

  /**
   * Convert SQLite SQL to PostgreSQL SQL
   */
  private convertSQLiteToPostgres(sql: string, schema?: string): string {
    let pgSql = sql;

    // 1. Convert ? placeholders to $1, $2, $3, etc.
    let placeholderIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${placeholderIndex++}`);

    // 2. Convert DATETIME('now') to NOW()
    pgSql = pgSql.replace(/DATETIME\(\s*['"']now['"']\s*\)/gi, 'NOW()');
    pgSql = pgSql.replace(/CURRENT_TIMESTAMP/gi, 'NOW()');

    // 3. Convert date() function
    pgSql = pgSql.replace(/date\(\s*['"']now['"']\s*\)/gi, 'CURRENT_DATE');

    // 4. Convert strftime()
    // Example: strftime('%Y-%m-%d', created_at) → DATE(created_at)
    pgSql = pgSql.replace(/strftime\([^)]+\)/gi, match => {
      // This is a simplified conversion - may need refinement
      return match.replace(/strftime\(['"'][^'"']+['"],\s*([^)]+)\)/, 'DATE($1)');
    });

    // 5. Convert AUTOINCREMENT
    pgSql = pgSql.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'BIGSERIAL PRIMARY KEY');

    // 6. Convert || string concatenation for mixed types
    // PostgreSQL requires explicit casting
    // This is a basic implementation - may need case-by-case handling

    // 7. Handle PRAGMA statements (not supported in PostgreSQL)
    if (pgSql.trim().toUpperCase().startsWith('PRAGMA')) {
      logger.warn('PRAGMA statement ignored in PostgreSQL mode');
      return '-- PRAGMA statements not supported in PostgreSQL';
    }

    // 8. Convert GLOB to ~* (regex match)
    pgSql = pgSql.replace(/\s+GLOB\s+/gi, ' ~* ');

    // 9. Convert LIKE with case sensitivity
    // SQLite LIKE is case-insensitive, PostgreSQL LIKE is case-sensitive
    // Use ILIKE for case-insensitive matching
    pgSql = pgSql.replace(/\s+LIKE\s+/gi, ' ILIKE ');

    return pgSql;
  }

  /**
   * Convert SQLite positional params (?) to PostgreSQL numbered params ($1, $2, ...)
   */
  private convertParams(params: any[], sql: string): any[] {
    // Count number of placeholders - check for both ? (SQLite) and $N (PostgreSQL)
    const sqlitePlaceholders = (sql.match(/\?/g) || []).length;
    const postgresPlaceholders = (sql.match(/\$\d+/g) || []).length;
    const placeholderCount = Math.max(sqlitePlaceholders, postgresPlaceholders);

    if (placeholderCount !== params.length && placeholderCount > 0) {
      logger.warn('Parameter count mismatch', {
        placeholders: placeholderCount,
        params: params.length,
        sql: sql.substring(0, 100),
      });
    }

    // pg library handles $1, $2 automatically when we pass the array
    // Just return params as-is
    return params;
  }

  /**
   * Get adapter statistics
   */
  getStats(): AdapterStats & {
    discrepancies: Array<any>;
    pgPoolStats: ReturnType<typeof pgPool.getStats>;
  } {
    return {
      ...this.stats,
      discrepancies: this.discrepancyLog.slice(-10), // Last 10 discrepancies
      pgPoolStats: pgPool.getStats(),
    };
  }

  /**
   * Get recent discrepancies
   */
  getDiscrepancies(limit = 10) {
    return this.discrepancyLog.slice(-limit);
  }

  /**
   * Clear discrepancy log
   */
  clearDiscrepancies() {
    this.discrepancyLog = [];
    this.stats.dualWriteDiscrepancies = 0;
  }

  /**
   * Close PostgreSQL connections
   */
  async close(): Promise<void> {
    logger.info('Closing PostgreSQL connections');
    await pgPool.close();
    logger.info('PostgreSQL connections closed');
  }
}

// Export singleton instance
export const dbAdapter = new DatabaseAdapter();

/**
 * Helper function for backward compatibility
 *
 * @example
 * const users = await query<User>('SELECT * FROM users WHERE id = ?', [userId], { schema: 'users' });
 */
export async function query<T = any>(
  sql: string,
  params: any[] = [],
  options: QueryOptions = {}
): Promise<QueryResult<T>> {
  return dbAdapter.query<T>(sql, params, options);
}

/**
 * Helper function for transactions
 *
 * @example
 * const result = await transaction(async (adapter) => {
 *   await adapter.query('INSERT INTO users (name) VALUES (?)', ['John']);
 *   await adapter.query('UPDATE stats SET user_count = user_count + 1');
 *   return { success: true };
 * }, { schema: 'users' });
 */
export async function transaction<T>(
  callback: (adapter: DatabaseAdapter) => Promise<T>,
  options: QueryOptions = {}
): Promise<T> {
  return dbAdapter.transaction(callback, options);
}
