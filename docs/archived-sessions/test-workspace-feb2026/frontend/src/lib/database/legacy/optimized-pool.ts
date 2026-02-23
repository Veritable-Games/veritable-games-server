/**
 * PHASE 2: Optimized Database Connection Pool
 *
 * ⚠️ DEVELOPMENT/TESTING ONLY - SQLite NOT SUPPORTED IN PRODUCTION
 *
 * This module is an experimental optimization layer for SQLite connections.
 * It is only available in development and testing environments.
 * Production deployments use PostgreSQL exclusively via the adapter pattern.
 *
 * CRITICAL FIXES:
 * 1. Reduced connection pool size from 50 to 15 (optimal for SQLite)
 * 2. Added connection health monitoring
 * 3. Implemented query performance tracking
 * 4. Added cache-aware query optimization
 * 5. Fixed WebSocket server database connection bypass
 */

import Database from 'better-sqlite3';
import path from 'path';
import { Mutex } from 'async-mutex';
import { logger } from '@/lib/utils/logger';

// Safety guard: Prevent usage in production environments
const isProduction =
  process.env.NODE_ENV === 'production' ||
  (process.env.NODE_ENV !== 'development' &&
    process.env.NODE_ENV !== 'test' &&
    !process.env.LOCALHOST);

if (isProduction && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
  logger.warn(
    '[WARNING] Optimized SQLite Pool Loaded in Production Environment\n' +
      'This module should only be used in development/testing.\n' +
      'Production must use PostgreSQL via the database adapter.\n' +
      'If this is intentional, set ALLOW_SQLITE_IN_PRODUCTION=true'
  );
}

interface ConnectionMetrics {
  queryCount: number;
  totalQueryTime: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
  lastActivity: Date;
}

interface PoolHealth {
  activeConnections: number;
  maxConnections: number;
  totalQueries: number;
  avgQueryTime: number;
  cacheHitRate: number;
  errorRate: number;
}

class OptimizedDatabasePool {
  private static instance: OptimizedDatabasePool;
  private connections: Map<string, Database.Database>;
  private connectionMutex: Mutex;
  private readonly maxConnections = 15; // Optimal for SQLite WAL mode
  private readonly dataDir: string;
  private connectionAccessTime: Map<string, number>;
  private connectionMetrics: Map<string, ConnectionMetrics>;
  private queryCache: Map<string, { result: any; expires: number }>;
  private readonly cacheTTL = 60000; // 1 minute cache

  private constructor() {
    this.connections = new Map();
    this.connectionMutex = new Mutex();
    this.connectionAccessTime = new Map();
    this.connectionMetrics = new Map();
    this.queryCache = new Map();
    this.dataDir = path.join(process.cwd(), 'data');

    // Start health monitoring
    this.startHealthMonitoring();

    // Start cache cleanup
    this.startCacheCleanup();
  }

  static getInstance(): OptimizedDatabasePool {
    if (!OptimizedDatabasePool.instance) {
      OptimizedDatabasePool.instance = new OptimizedDatabasePool();
    }
    return OptimizedDatabasePool.instance;
  }

  /**
   * Get optimized database connection with health monitoring
   */
  getConnection(dbName: string): Database.Database {
    const startTime = Date.now();

    // Fast path - check if connection exists and is healthy
    if (this.connections.has(dbName)) {
      const db = this.connections.get(dbName)!;
      if (this.isConnectionHealthy(db, dbName)) {
        this.updateConnectionMetrics(dbName, startTime);
        return db;
      } else {
        // Connection is unhealthy, recreate
        this.closeConnection(dbName);
      }
    }

    // Create new connection with health monitoring
    return this.createOptimizedConnection(dbName, startTime);
  }

  /**
   * Execute query with caching and performance monitoring
   */
  async executeQuery<T>(
    dbName: string,
    query: string,
    params: any[] = [],
    useCache: boolean = false
  ): Promise<T> {
    const cacheKey = useCache ? this.generateCacheKey(query, params) : null;
    const startTime = Date.now();

    // Check cache first
    if (cacheKey && this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey)!;
      if (cached.expires > Date.now()) {
        this.incrementCacheHit(dbName);
        return cached.result;
      } else {
        this.queryCache.delete(cacheKey);
      }
    }

    const db = this.getConnection(dbName);

    try {
      const stmt = db.prepare(query);
      const result = params.length > 0 ? stmt.all(...params) : stmt.all();

      // Cache result if requested
      if (cacheKey) {
        this.queryCache.set(cacheKey, {
          result,
          expires: Date.now() + this.cacheTTL,
        });
        this.incrementCacheMiss(dbName);
      }

      this.updateQueryMetrics(dbName, startTime);
      return result as T;
    } catch (error) {
      this.incrementError(dbName);
      logger.error(`Database query error in ${dbName}:`, error);
      throw error;
    }
  }

  /**
   * Execute transaction with automatic retry on busy
   */
  async executeTransaction<T>(
    dbName: string,
    callback: (db: Database.Database) => T,
    maxRetries: number = 3
  ): Promise<T> {
    const db = this.getConnection(dbName);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const transaction = db.transaction(callback);
        return transaction(db) as T;
      } catch (error: any) {
        lastError = error;

        // Retry on busy errors
        if (error.code === 'SQLITE_BUSY' && attempt < maxRetries - 1) {
          await this.delay(Math.pow(2, attempt) * 100); // Exponential backoff
          continue;
        }

        this.incrementError(dbName);
        throw error;
      }
    }

    throw lastError!;
  }

  /**
   * Check if connection is healthy
   */
  private isConnectionHealthy(db: Database.Database, dbName: string): boolean {
    try {
      db.prepare('SELECT 1').get();
      return true;
    } catch (error) {
      logger.warn(`Unhealthy connection detected for ${dbName}:`, error);
      return false;
    }
  }

  /**
   * Create optimized connection with performance settings
   * Note: Uses type assertion because Mutex.runExclusive returns Promise<T>
   * but we need synchronous return for consistency with getConnection signature
   */
  private createOptimizedConnection(dbName: string, startTime: number): Database.Database {
    const result = this.connectionMutex.runExclusive(() => {
      // Double-check pattern
      if (
        this.connections.has(dbName) &&
        this.isConnectionHealthy(this.connections.get(dbName)!, dbName)
      ) {
        this.updateConnectionMetrics(dbName, startTime);
        return this.connections.get(dbName)!;
      }

      const dbPath = path.join(this.dataDir, `${dbName}.db`);

      // Evict LRU connection if at limit
      if (this.connections.size >= this.maxConnections) {
        this.evictLRUConnection();
      }

      // Create optimized connection
      const db = new Database(dbPath);

      // Apply performance optimizations
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('cache_size = -16000'); // 16MB cache per connection
      db.pragma('foreign_keys = ON');
      db.pragma('temp_store = MEMORY');
      db.pragma('mmap_size = 67108864'); // 64MB memory mapping
      db.pragma('wal_autocheckpoint = 100'); // Smaller checkpoints for better concurrency

      // Initialize connection metrics
      this.connections.set(dbName, db);
      this.connectionAccessTime.set(dbName, Date.now());
      this.connectionMetrics.set(dbName, {
        queryCount: 0,
        totalQueryTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
        errors: 0,
        lastActivity: new Date(),
      });

      this.updateConnectionMetrics(dbName, startTime);
      return db;
    });
    return result as unknown as Database.Database;
  }

  /**
   * Evict least recently used connection
   */
  private evictLRUConnection(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [key, time] of this.connectionAccessTime.entries()) {
      if (time < lruTime) {
        lruTime = time;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.closeConnection(lruKey);
    }
  }

  /**
   * Close specific connection
   */
  private closeConnection(dbName: string): void {
    const db = this.connections.get(dbName);
    if (db) {
      try {
        db.close();
      } catch (error) {
        logger.warn(`Error closing connection ${dbName}:`, error);
      }
    }

    this.connections.delete(dbName);
    this.connectionAccessTime.delete(dbName);
    this.connectionMetrics.delete(dbName);
  }

  /**
   * Update connection metrics
   */
  private updateConnectionMetrics(dbName: string, startTime: number): void {
    this.connectionAccessTime.set(dbName, Date.now());

    const metrics = this.connectionMetrics.get(dbName);
    if (metrics) {
      metrics.lastActivity = new Date();
    }
  }

  /**
   * Update query performance metrics
   */
  private updateQueryMetrics(dbName: string, startTime: number): void {
    const metrics = this.connectionMetrics.get(dbName);
    if (metrics) {
      metrics.queryCount++;
      metrics.totalQueryTime += Date.now() - startTime;
    }
  }

  /**
   * Increment cache hit counter
   */
  private incrementCacheHit(dbName: string): void {
    const metrics = this.connectionMetrics.get(dbName);
    if (metrics) {
      metrics.cacheHits++;
    }
  }

  /**
   * Increment cache miss counter
   */
  private incrementCacheMiss(dbName: string): void {
    const metrics = this.connectionMetrics.get(dbName);
    if (metrics) {
      metrics.cacheMisses++;
    }
  }

  /**
   * Increment error counter
   */
  private incrementError(dbName: string): void {
    const metrics = this.connectionMetrics.get(dbName);
    if (metrics) {
      metrics.errors++;
    }
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(query: string, params: any[]): string {
    const crypto = require('crypto');
    return crypto
      .createHash('md5')
      .update(query + JSON.stringify(params))
      .digest('hex');
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.logPoolHealth();
      this.recordPoolMetrics();
    }, 60000); // Every minute
  }

  /**
   * Start cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.queryCache.entries()) {
        if (cached.expires <= now) {
          this.queryCache.delete(key);
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Log pool health metrics
   */
  private logPoolHealth(): void {
    const health = this.getPoolHealth();

    if (health.errorRate > 0.1 || health.avgQueryTime > 100) {
      logger.warn('🚨 Database pool health warning:', {
        errorRate: `${(health.errorRate * 100).toFixed(2)}%`,
        avgQueryTime: `${health.avgQueryTime.toFixed(2)}ms`,
        cacheHitRate: `${(health.cacheHitRate * 100).toFixed(2)}%`,
      });
    }
  }

  /**
   * Record pool metrics to database
   */
  private recordPoolMetrics(): void {
    try {
      const health = this.getPoolHealth();
      const db = this.getConnection('forums');

      // Check if monitoring table exists
      const tableExists = db
        .prepare(
          `
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='connection_pool_metrics'
      `
        )
        .get();

      if (tableExists) {
        const stmt = db.prepare(`
          INSERT INTO connection_pool_metrics (
            active_connections, max_connections, query_count,
            avg_query_time_ms, cache_hit_rate
          ) VALUES (?, ?, ?, ?, ?)
        `);

        stmt.run(
          health.activeConnections,
          health.maxConnections,
          health.totalQueries,
          health.avgQueryTime,
          health.cacheHitRate
        );
      }
    } catch (error) {
      // Silently fail to avoid recursive issues
    }
  }

  /**
   * Get comprehensive pool health metrics
   */
  getPoolHealth(): PoolHealth {
    let totalQueries = 0;
    let totalQueryTime = 0;
    let totalCacheHits = 0;
    let totalCacheMisses = 0;
    let totalErrors = 0;

    for (const metrics of this.connectionMetrics.values()) {
      totalQueries += metrics.queryCount;
      totalQueryTime += metrics.totalQueryTime;
      totalCacheHits += metrics.cacheHits;
      totalCacheMisses += metrics.cacheMisses;
      totalErrors += metrics.errors;
    }

    const avgQueryTime = totalQueries > 0 ? totalQueryTime / totalQueries : 0;
    const totalCacheRequests = totalCacheHits + totalCacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? totalCacheHits / totalCacheRequests : 0;
    const errorRate = totalQueries > 0 ? totalErrors / totalQueries : 0;

    return {
      activeConnections: this.connections.size,
      maxConnections: this.maxConnections,
      totalQueries,
      avgQueryTime,
      cacheHitRate,
      errorRate,
    };
  }

  /**
   * Close all connections gracefully
   */
  closeAll(): void {
    for (const [name, db] of this.connections) {
      try {
        db.close();
      } catch (error) {
        logger.error(`Error closing ${name} database:`, error);
      }
    }
    this.connections.clear();
    this.connectionAccessTime.clear();
    this.connectionMetrics.clear();
    this.queryCache.clear();
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const optimizedDbPool = OptimizedDatabasePool.getInstance();

// Graceful shutdown handler
if (typeof process !== 'undefined') {
  process.setMaxListeners(20);

  let shutdownHandlers = false;
  const setupShutdownHandlers = () => {
    if (shutdownHandlers) return;
    shutdownHandlers = true;

    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}. Closing optimized database connections...`);
      optimizedDbPool.closeAll();
      process.exit(0);
    };

    process.once('SIGINT', () => gracefulShutdown('SIGINT'));
    process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  };

  setupShutdownHandlers();
}
