/**
 * PHASE 2: Database Health Monitor
 *
 * Comprehensive monitoring for database performance, connection health,
 * and proactive alerting for performance degradation.
 */

import { optimizedDbPool } from './legacy/optimized-pool';
import { logger } from '@/lib/utils/logger';

interface DatabaseHealth {
  status: 'healthy' | 'warning' | 'critical';
  metrics: {
    connectionPool: {
      active: number;
      max: number;
      utilization: number;
    };
    performance: {
      avgQueryTime: number;
      slowQueries: number;
      errorRate: number;
      cacheHitRate: number;
    };
    storage: {
      sizeMB: number;
      growthRateMB: number;
      daysUntilLimit: number;
      walSizeMB: number;
    };
    tables: {
      largestTables: Array<{ name: string; sizeMB: number; rowCount: number }>;
      indexCoverage: number;
      fragmentationLevel: number;
    };
  };
  alerts: Array<{
    level: 'warning' | 'critical';
    message: string;
    recommendation: string;
  }>;
  lastCheck: Date;
}

interface QueryPerformanceMetric {
  query: string;
  count: number;
  totalTime: number;
  avgTime: number;
  maxTime: number;
}

export class DatabaseHealthMonitor {
  private static instance: DatabaseHealthMonitor;
  private healthHistory: DatabaseHealth[] = [];
  private alertCallbacks: Array<(health: DatabaseHealth) => void> = [];
  private monitoringInterval?: NodeJS.Timeout;

  private constructor() {
    this.startMonitoring();
  }

  static getInstance(): DatabaseHealthMonitor {
    if (!DatabaseHealthMonitor.instance) {
      DatabaseHealthMonitor.instance = new DatabaseHealthMonitor();
    }
    return DatabaseHealthMonitor.instance;
  }

  /**
   * Start continuous health monitoring
   */
  private startMonitoring(): void {
    // Check health every 5 minutes
    this.monitoringInterval = setInterval(
      () => {
        this.checkHealth().catch(error => {
          logger.error('Health monitoring error:', error);
        });
      },
      5 * 60 * 1000
    );

    // Initial health check
    this.checkHealth().catch(error => {
      logger.error('Initial health check failed:', error);
    });
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth(): Promise<DatabaseHealth> {
    const health: DatabaseHealth = {
      status: 'healthy',
      metrics: {
        connectionPool: await this.getConnectionPoolMetrics(),
        performance: await this.getPerformanceMetrics(),
        storage: await this.getStorageMetrics(),
        tables: await this.getTableMetrics(),
      },
      alerts: [],
      lastCheck: new Date(),
    };

    // Analyze metrics and generate alerts
    this.analyzeHealth(health);

    // Store history (keep last 24 hours)
    this.healthHistory.push(health);
    if (this.healthHistory.length > 288) {
      // 24 hours * 12 checks per hour
      this.healthHistory.shift();
    }

    // Trigger alert callbacks if needed
    if (health.status !== 'healthy') {
      this.triggerAlerts(health);
    }

    // Log health status
    this.logHealthStatus(health);

    return health;
  }

  /**
   * Get connection pool metrics
   */
  private async getConnectionPoolMetrics() {
    const poolHealth = optimizedDbPool.getPoolHealth();

    return {
      active: poolHealth.activeConnections,
      max: poolHealth.maxConnections,
      utilization: poolHealth.activeConnections / poolHealth.maxConnections,
    };
  }

  /**
   * Get performance metrics from database
   */
  private async getPerformanceMetrics() {
    try {
      const poolHealth = optimizedDbPool.getPoolHealth();

      // Get slow query count from recent metrics
      const slowQueries = await optimizedDbPool.executeQuery<any[]>(
        'forums',
        `
        SELECT COUNT(*) as count
        FROM connection_pool_metrics
        WHERE timestamp > datetime('now', '-1 hour')
          AND avg_query_time_ms > 100
      `,
        [],
        false
      );

      return {
        avgQueryTime: poolHealth.avgQueryTime,
        slowQueries: slowQueries[0]?.count || 0,
        errorRate: poolHealth.errorRate,
        cacheHitRate: poolHealth.cacheHitRate,
      };
    } catch (error) {
      logger.warn('Error getting performance metrics:', error);
      return {
        avgQueryTime: 0,
        slowQueries: 0,
        errorRate: 0,
        cacheHitRate: 0,
      };
    }
  }

  /**
   * Get storage metrics
   */
  private async getStorageMetrics() {
    try {
      const fs = require('fs');
      const path = require('path');

      const dbPath = path.join(process.cwd(), 'data', 'forums.db');
      const walPath = path.join(process.cwd(), 'data', 'forums.db-wal');

      const dbStats = fs.statSync(dbPath);
      const dbSizeMB = dbStats.size / (1024 * 1024);

      let walSizeMB = 0;
      try {
        const walStats = fs.statSync(walPath);
        walSizeMB = walStats.size / (1024 * 1024);
      } catch (error) {
        // WAL file might not exist
      }

      // Calculate growth rate from history
      let growthRateMB = 0;
      if (this.healthHistory.length > 0) {
        const previousSize =
          this.healthHistory[this.healthHistory.length - 1]?.metrics.storage.sizeMB || dbSizeMB;
        growthRateMB = dbSizeMB - previousSize;
      }

      // Estimate days until 2GB limit
      const remainingMB = 2048 - dbSizeMB;
      const dailyGrowthMB = growthRateMB * 288; // Assuming 5-minute intervals
      const daysUntilLimit = dailyGrowthMB > 0 ? Math.floor(remainingMB / dailyGrowthMB) : 9999;

      return {
        sizeMB: dbSizeMB,
        growthRateMB,
        daysUntilLimit,
        walSizeMB,
      };
    } catch (error) {
      logger.warn('Error getting storage metrics:', error);
      return {
        sizeMB: 0,
        growthRateMB: 0,
        daysUntilLimit: 9999,
        walSizeMB: 0,
      };
    }
  }

  /**
   * Get table metrics
   */
  private async getTableMetrics() {
    try {
      // Get table sizes
      const tableSizes = await optimizedDbPool.executeQuery<any[]>(
        'forums',
        `
        SELECT
          name,
          (SELECT COUNT(*) FROM pragma_table_info(name)) as column_count
        FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `,
        [],
        false
      );

      // Get index coverage
      const indexStats = await optimizedDbPool.executeQuery<any[]>(
        'forums',
        `
        SELECT
          COUNT(DISTINCT tbl_name) as tables_with_indexes,
          COUNT(*) as total_indexes
        FROM sqlite_master
        WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
      `,
        [],
        false
      );

      const totalTables = tableSizes.length;
      const tablesWithIndexes = indexStats[0]?.tables_with_indexes || 0;
      const indexCoverage = totalTables > 0 ? tablesWithIndexes / totalTables : 0;

      // Mock table sizes (actual implementation would need PRAGMA table_info)
      const largestTables = tableSizes.slice(0, 5).map(table => ({
        name: table.name,
        sizeMB: Math.random() * 10, // Mock data
        rowCount: Math.floor(Math.random() * 10000), // Mock data
      }));

      return {
        largestTables,
        indexCoverage,
        fragmentationLevel: 0.1, // Mock fragmentation level
      };
    } catch (error) {
      logger.warn('Error getting table metrics:', error);
      return {
        largestTables: [],
        indexCoverage: 0,
        fragmentationLevel: 0,
      };
    }
  }

  /**
   * Analyze health metrics and generate alerts
   */
  private analyzeHealth(health: DatabaseHealth): void {
    const { metrics } = health;

    // Connection pool utilization
    if (metrics.connectionPool.utilization > 0.9) {
      health.alerts.push({
        level: 'critical',
        message: `Connection pool utilization at ${(metrics.connectionPool.utilization * 100).toFixed(1)}%`,
        recommendation: 'Consider increasing max connections or optimizing query patterns',
      });
      health.status = 'critical';
    } else if (metrics.connectionPool.utilization > 0.75) {
      health.alerts.push({
        level: 'warning',
        message: `Connection pool utilization at ${(metrics.connectionPool.utilization * 100).toFixed(1)}%`,
        recommendation: 'Monitor query patterns and consider optimization',
      });
      if (health.status === 'healthy') health.status = 'warning';
    }

    // Query performance
    if (metrics.performance.avgQueryTime > 500) {
      health.alerts.push({
        level: 'critical',
        message: `Average query time: ${metrics.performance.avgQueryTime.toFixed(2)}ms`,
        recommendation: 'Optimize slow queries and add missing indexes',
      });
      health.status = 'critical';
    } else if (metrics.performance.avgQueryTime > 200) {
      health.alerts.push({
        level: 'warning',
        message: `Average query time: ${metrics.performance.avgQueryTime.toFixed(2)}ms`,
        recommendation: 'Review query performance and indexing strategy',
      });
      if (health.status === 'healthy') health.status = 'warning';
    }

    // Error rate
    if (metrics.performance.errorRate > 0.05) {
      health.alerts.push({
        level: 'critical',
        message: `Database error rate: ${(metrics.performance.errorRate * 100).toFixed(2)}%`,
        recommendation: 'Investigate database errors and connection issues',
      });
      health.status = 'critical';
    } else if (metrics.performance.errorRate > 0.01) {
      health.alerts.push({
        level: 'warning',
        message: `Database error rate: ${(metrics.performance.errorRate * 100).toFixed(2)}%`,
        recommendation: 'Monitor error patterns and connection stability',
      });
      if (health.status === 'healthy') health.status = 'warning';
    }

    // Cache hit rate
    if (metrics.performance.cacheHitRate < 0.5) {
      health.alerts.push({
        level: 'warning',
        message: `Low cache hit rate: ${(metrics.performance.cacheHitRate * 100).toFixed(1)}%`,
        recommendation: 'Review caching strategy and cache TTL settings',
      });
      if (health.status === 'healthy') health.status = 'warning';
    }

    // Storage growth
    if (metrics.storage.daysUntilLimit < 30) {
      health.alerts.push({
        level: 'critical',
        message: `Database approaching 2GB limit in ${metrics.storage.daysUntilLimit} days`,
        recommendation: 'Plan PostgreSQL migration immediately',
      });
      health.status = 'critical';
    } else if (metrics.storage.daysUntilLimit < 90) {
      health.alerts.push({
        level: 'warning',
        message: `Database will reach 2GB limit in ${metrics.storage.daysUntilLimit} days`,
        recommendation: 'Begin planning PostgreSQL migration',
      });
      if (health.status === 'healthy') health.status = 'warning';
    }

    // WAL file size
    if (metrics.storage.walSizeMB > 100) {
      health.alerts.push({
        level: 'warning',
        message: `Large WAL file: ${metrics.storage.walSizeMB.toFixed(2)}MB`,
        recommendation: 'Consider checkpoint frequency tuning',
      });
      if (health.status === 'healthy') health.status = 'warning';
    }

    // Index coverage
    if (metrics.tables.indexCoverage < 0.5) {
      health.alerts.push({
        level: 'warning',
        message: `Low index coverage: ${(metrics.tables.indexCoverage * 100).toFixed(1)}%`,
        recommendation: 'Add indexes for frequently queried tables',
      });
      if (health.status === 'healthy') health.status = 'warning';
    }
  }

  /**
   * Trigger alert callbacks
   */
  private triggerAlerts(health: DatabaseHealth): void {
    this.alertCallbacks.forEach(callback => {
      try {
        callback(health);
      } catch (error) {
        logger.error('Error in alert callback:', error);
      }
    });
  }

  /**
   * Log health status
   */
  private logHealthStatus(health: DatabaseHealth): void {
    const { status, metrics, alerts } = health;

    if (status === 'critical') {
      logger.error('🚨 CRITICAL DATABASE HEALTH ISSUES:', {
        status,
        connectionUtilization: `${(metrics.connectionPool.utilization * 100).toFixed(1)}%`,
        avgQueryTime: `${metrics.performance.avgQueryTime.toFixed(2)}ms`,
        errorRate: `${(metrics.performance.errorRate * 100).toFixed(2)}%`,
        alerts: alerts.length,
      });
    } else if (status === 'warning') {
      logger.warn('⚠️  Database health warnings detected:', {
        status,
        connectionUtilization: `${(metrics.connectionPool.utilization * 100).toFixed(1)}%`,
        avgQueryTime: `${metrics.performance.avgQueryTime.toFixed(2)}ms`,
        cacheHitRate: `${(metrics.performance.cacheHitRate * 100).toFixed(1)}%`,
        alerts: alerts.length,
      });
    } else {
      logger.info('✅ Database health check passed:', {
        connectionUtilization: `${(metrics.connectionPool.utilization * 100).toFixed(1)}%`,
        avgQueryTime: `${metrics.performance.avgQueryTime.toFixed(2)}ms`,
        cacheHitRate: `${(metrics.performance.cacheHitRate * 100).toFixed(1)}%`,
      });
    }
  }

  /**
   * Get current health status
   */
  getCurrentHealth(): DatabaseHealth | null {
    return this.healthHistory.length > 0
      ? (this.healthHistory[this.healthHistory.length - 1] ?? null)
      : null;
  }

  /**
   * Get health history
   */
  getHealthHistory(hours: number = 24): DatabaseHealth[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.healthHistory.filter(health => health.lastCheck >= cutoff);
  }

  /**
   * Add alert callback
   */
  onAlert(callback: (health: DatabaseHealth) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Remove alert callback
   */
  removeAlert(callback: (health: DatabaseHealth) => void): void {
    const index = this.alertCallbacks.indexOf(callback);
    if (index > -1) {
      this.alertCallbacks.splice(index, 1);
    }
  }

  /**
   * Force health check
   */
  async forceHealthCheck(): Promise<DatabaseHealth> {
    return await this.checkHealth();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations(): string[] {
    const currentHealth = this.getCurrentHealth();
    if (!currentHealth) return [];

    const recommendations: string[] = [];

    if (currentHealth.metrics.performance.avgQueryTime > 100) {
      recommendations.push('Optimize slow queries and add missing indexes');
    }

    if (currentHealth.metrics.performance.cacheHitRate < 0.7) {
      recommendations.push('Improve caching strategy for frequently accessed data');
    }

    if (currentHealth.metrics.connectionPool.utilization > 0.8) {
      recommendations.push('Optimize connection usage and implement connection pooling');
    }

    if (currentHealth.metrics.storage.daysUntilLimit < 180) {
      recommendations.push('Plan migration to PostgreSQL for better scalability');
    }

    if (currentHealth.metrics.tables.indexCoverage < 0.8) {
      recommendations.push('Add indexes for frequently queried columns');
    }

    return recommendations;
  }
}

// Export singleton instance
export const dbHealthMonitor = DatabaseHealthMonitor.getInstance();
