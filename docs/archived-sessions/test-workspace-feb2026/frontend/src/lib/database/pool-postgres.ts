/**
 * PostgreSQL Connection Pool Manager
 *
 * Provides type-safe database connections using pg-pool
 * Supports Vercel Postgres (Neon) and standard PostgreSQL
 *
 * Features:
 * - Connection pooling with automatic management
 * - Schema-based database organization
 * - Graceful shutdown handling
 * - Connection health monitoring
 * - Transaction support
 */

import { Pool, PoolClient, PoolConfig, QueryResult } from 'pg';
import { logger } from '@/lib/utils/logger';

/**
 * Database schema names - maps to SQLite database names
 */
export type DatabaseSchema =
  | 'forums'
  | 'wiki'
  | 'users'
  | 'auth'
  | 'content'
  | 'library'
  | 'messaging'
  | 'system'
  | 'cache'
  | 'main'
  | 'anarchist'
  | 'shared'
  | 'donations'
  | 'x402_payments';

/**
 * Query execution result
 */
export interface PostgresQueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
}

/**
 * PostgreSQL Connection Pool Manager
 */
class PostgreSQLPool {
  private static instance: PostgreSQLPool;
  private pool: Pool | null = null;
  private isInitialized = false;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PostgreSQLPool {
    if (!PostgreSQLPool.instance) {
      PostgreSQLPool.instance = new PostgreSQLPool();
    }
    return PostgreSQLPool.instance;
  }

  /**
   * Initialize connection pool
   */
  private initialize(): void {
    if (this.isInitialized) return;

    // Detect serverless environment (Vercel, AWS Lambda, etc.)
    const isServerless = !!(
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.VERCEL_ENV
    );

    const poolConfig: PoolConfig = {
      // Vercel Postgres provides POSTGRES_URL with connection pooling
      // Fallback to DATABASE_URL for compatibility
      connectionString:
        process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL,

      // Connection pool settings (optimized for serverless)
      // Serverless: 1 connection per instance (ephemeral, short-lived)
      // Traditional: 20 connections shared across long-running process
      max: isServerless ? 1 : parseInt(process.env.POSTGRES_POOL_MAX || '20'),
      min: isServerless ? 0 : parseInt(process.env.POSTGRES_POOL_MIN || '2'),
      idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
      // Increased from 5s to 10s for serverless cold starts
      connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '10000'),

      // SSL configuration (required for Vercel Postgres)
      ssl:
        process.env.POSTGRES_SSL === 'true'
          ? {
              rejectUnauthorized: false,
            }
          : undefined,
    };

    logger.info(
      `[PostgreSQL Pool] Initializing in ${isServerless ? 'SERVERLESS' : 'traditional'} mode ` +
        `(max: ${poolConfig.max}, min: ${poolConfig.min})`
    );

    this.pool = new Pool(poolConfig);

    // Error handling
    this.pool.on('error', err => {
      logger.error('[PostgreSQL Pool] Unexpected error:', err);
    });

    // Connection event logging (only in development)
    if (process.env.NODE_ENV === 'development') {
      this.pool.on('connect', () => {
        logger.info('[PostgreSQL Pool] New client connected');
      });
      this.pool.on('acquire', () => {
        logger.info('[PostgreSQL Pool] Client acquired from pool');
      });
      this.pool.on('remove', () => {
        logger.info('[PostgreSQL Pool] Client removed from pool');
      });
    }

    this.isInitialized = true;
  }

  /**
   * Get a client from the pool
   * Client must be released after use!
   */
  async getClient(): Promise<PoolClient> {
    if (!this.isInitialized) {
      this.initialize();
    }

    if (!this.pool) {
      throw new Error('PostgreSQL pool not initialized');
    }

    return this.pool.connect();
  }

  /**
   * Execute a query with automatic client management
   */
  async query<T = any>(
    sql: string,
    params?: any[],
    schema?: DatabaseSchema
  ): Promise<PostgresQueryResult<T>> {
    if (!this.isInitialized) {
      this.initialize();
    }

    if (!this.pool) {
      throw new Error('PostgreSQL pool not initialized');
    }

    // Prefix table names with schema if provided
    let finalSql = sql;
    if (schema) {
      finalSql = this.addSchemaPrefix(sql, schema);
      logger.info(`[PostgreSQL Pool] Schema prefix applied (${schema}):`, {
        original: sql.substring(0, 80),
        final: finalSql.substring(0, 80),
      });
    } else {
      logger.info(`[PostgreSQL Pool] No schema provided, using raw SQL:`, sql.substring(0, 80));
    }

    const result: QueryResult = await this.pool.query(finalSql, params);

    return {
      rows: result.rows as T[],
      rowCount: result.rowCount || 0,
      command: result.command,
    };
  }

  /**
   * Execute queries within a transaction
   */
  async transaction<T>(
    schema: DatabaseSchema,
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      // Set search path to schema
      await client.query(`SET search_path TO ${schema}, public`);

      // Begin transaction
      await client.query('BEGIN');

      // Execute callback
      const result = await callback(client);

      // Commit transaction
      await client.query('COMMIT');

      return result;
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Always release client
      client.release();
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    if (!this.pool) {
      return {
        totalCount: 0,
        idleCount: 0,
        waitingCount: 0,
      };
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Check if database is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health');
      return result.rows.length > 0 && result.rows[0].health === 1;
    } catch (error) {
      logger.error('[PostgreSQL Pool] Health check failed:', error);
      return false;
    }
  }

  /**
   * Close all connections gracefully
   */
  async close(): Promise<void> {
    if (!this.pool) return;

    try {
      await this.pool.end();
      logger.info('[PostgreSQL Pool] All connections closed');
    } catch (error) {
      logger.error('[PostgreSQL Pool] Error closing connections:', error);
    } finally {
      this.pool = null;
      this.isInitialized = false;
    }
  }

  /**
   * Add schema prefix to SQL queries
   * Converts: SELECT * FROM users → SELECT * FROM schema_name.users
   * Skips tables that already have a schema prefix (e.g., auth.sessions)
   * Skips CTE (Common Table Expression) names
   */
  private addSchemaPrefix(sql: string, schema: string): string {
    // Step 1: Extract CTE names to skip them during prefixing
    // Pattern: WITH cte_name AS (...), another_cte AS (...)
    const cteNames: string[] = [];
    // Match both "WITH cte_name AS" and ", cte_name AS" to capture all CTEs
    const ctePattern = /WITH\s+([\w]+)\s+AS|,\s+([\w]+)\s+AS/gi;
    let match;
    while ((match = ctePattern.exec(sql)) !== null) {
      const cteName = match[1] || match[2];
      if (cteName) cteNames.push(cteName);
    }

    // Step 2: Build negative lookahead pattern to skip:
    // - Tables already with schema prefix (e.g., auth.sessions)
    // - CTE names (e.g., tagged_images)
    const skipPattern =
      cteNames.length > 0 ? `(?![\\w]+\\.)(?!(?:${cteNames.join('|')})\\b)` : `(?![\\w]+\\.)`;

    // Step 3: Apply schema prefixes, skipping CTEs
    // IMPORTANT: Negative lookbehind to exclude FROM inside functions (EXTRACT, DATE_PART, etc.)
    const notInsideFunction = '(?<!EXTRACT\\([^)]{0,50})(?<!DATE_PART\\([^)]{0,50})';

    return sql
      .replace(
        new RegExp(`${notInsideFunction}FROM\\s+${skipPattern}([\\w]+)`, 'gi'),
        `FROM ${schema}.$1`
      )
      .replace(new RegExp(`JOIN\\s+${skipPattern}([\\w]+)`, 'gi'), `JOIN ${schema}.$1`)
      .replace(
        new RegExp(`INSERT\\s+INTO\\s+${skipPattern}([\\w]+)`, 'gi'),
        `INSERT INTO ${schema}.$1`
      )
      .replace(
        new RegExp(`UPDATE\\s+(?!SET\\s)${skipPattern}([\\w]+)`, 'gi'),
        `UPDATE ${schema}.$1`
      )
      .replace(
        new RegExp(`${notInsideFunction}DELETE\\s+FROM\\s+${skipPattern}([\\w]+)`, 'gi'),
        `DELETE FROM ${schema}.$1`
      );
  }
}

// Export singleton instance
export const pgPool = PostgreSQLPool.getInstance();

// Graceful shutdown handlers
if (typeof process !== 'undefined') {
  const gracefulShutdown = async (signal: string) => {
    logger.info(`[PostgreSQL Pool] Received ${signal}. Closing connections...`);
    await pgPool.close();
    process.exit(0);
  };

  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

/**
 * Helper function to execute a query
 *
 * @example
 * const users = await query<User>('SELECT * FROM users WHERE id = $1', [userId], 'users');
 */
export async function query<T = any>(
  sql: string,
  params?: any[],
  schema?: DatabaseSchema
): Promise<PostgresQueryResult<T>> {
  return pgPool.query<T>(sql, params, schema);
}

/**
 * Helper function to execute a transaction
 *
 * @example
 * const result = await transaction('users', async (client) => {
 *   await client.query('INSERT INTO users (name) VALUES ($1)', ['John']);
 *   await client.query('UPDATE stats SET user_count = user_count + 1');
 *   return { success: true };
 * });
 */
export async function transaction<T>(
  schema: DatabaseSchema,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  return pgPool.transaction(schema, callback);
}

// Graceful shutdown handling for serverless environments
if (typeof process !== 'undefined' && process.on) {
  process.on('SIGTERM', async () => {
    logger.info('[PostgreSQL Pool] SIGTERM received, closing pool...');
    await pgPool.close();
  });
}
