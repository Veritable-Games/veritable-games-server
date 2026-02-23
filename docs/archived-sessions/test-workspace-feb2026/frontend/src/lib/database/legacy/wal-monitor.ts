/**
 * WAL Monitoring and Auto-Checkpoint System
 *
 * ⚠️ DEVELOPMENT/TESTING ONLY - SQLite NOT SUPPORTED IN PRODUCTION
 *
 * This module provides comprehensive WAL file monitoring and automatic
 * checkpointing for SQLite. It is only available in development and testing
 * environments. Production deployments use PostgreSQL exclusively.
 */

import { promises as fs } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { dbPool } from './pool';
import { logger } from '@/lib/utils/logger';

// Safety guard: Prevent usage in production environments
const isProduction =
  process.env.NODE_ENV === 'production' ||
  (process.env.NODE_ENV !== 'development' &&
    process.env.NODE_ENV !== 'test' &&
    !process.env.LOCALHOST);

if (isProduction && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
  logger.warn(
    '[WARNING] SQLite WAL Monitor Loaded in Production Environment\n' +
      'This module should only be used in development/testing.\n' +
      'Production must use PostgreSQL via the database adapter.\n' +
      'If this is intentional, set ALLOW_SQLITE_IN_PRODUCTION=true'
  );
}

interface WALStats {
  walSizeBytes: number;
  walSizeMB: number;
  dbSizeBytes: number;
  dbSizeMB: number;
  walToDbRatio: number;
  lastModified: Date;
  ageMinutes: number;
}

interface CheckpointResult {
  success: boolean;
  method: 'PASSIVE' | 'RESTART' | 'TRUNCATE';
  pagesCheckpointed: number;
  walSizeReduction: number;
  error?: string;
}

export class WALMonitor {
  private static instance: WALMonitor;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly dataDir: string;

  // Configuration thresholds
  private readonly config = {
    // WAL size thresholds
    maxWalSizeMB: 1, // Alert threshold
    criticalWalSizeMB: 2, // Force checkpoint threshold
    maxWalToDbRatio: 25, // Maximum acceptable WAL/DB ratio (%)

    // Monitoring intervals
    checkIntervalMs: 30000, // Check every 30 seconds
    forceCheckpointMinutes: 15, // Force checkpoint if WAL older than this

    // Checkpoint configuration
    autoCheckpointPages: 500, // Reduced from default 1000
    maxRetries: 3,
  };

  private constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
  }

  static getInstance(): WALMonitor {
    if (!WALMonitor.instance) {
      WALMonitor.instance = new WALMonitor();
    }
    return WALMonitor.instance;
  }

  /**
   * Get comprehensive WAL statistics for a database
   */
  async getWALStats(dbName: string = 'forums'): Promise<WALStats | null> {
    try {
      const dbPath = path.join(this.dataDir, `${dbName}.db`);
      const walPath = path.join(this.dataDir, `${dbName}.db-wal`);

      // Check if files exist
      const [dbStat, walStat] = await Promise.all([
        fs.stat(dbPath).catch(() => null),
        fs.stat(walPath).catch(() => null),
      ]);

      if (!dbStat || !walStat) {
        return null;
      }

      const walSizeBytes = walStat.size;
      const dbSizeBytes = dbStat.size;
      const walToDbRatio = (walSizeBytes / dbSizeBytes) * 100;
      const ageMinutes = (Date.now() - walStat.mtime.getTime()) / (1000 * 60);

      return {
        walSizeBytes,
        walSizeMB: walSizeBytes / (1024 * 1024),
        dbSizeBytes,
        dbSizeMB: dbSizeBytes / (1024 * 1024),
        walToDbRatio,
        lastModified: walStat.mtime,
        ageMinutes,
      };
    } catch (error) {
      logger.error(`Error getting WAL stats for ${dbName}:`, error);
      return null;
    }
  }

  /**
   * Perform WAL checkpoint with progressive escalation
   */
  async performCheckpoint(dbName: string = 'forums'): Promise<CheckpointResult> {
    const db = dbPool.getConnection(dbName);

    try {
      // Get initial WAL info
      const initialStats = await this.getWALStats(dbName);
      const initialWalSize = initialStats?.walSizeBytes || 0;

      // Try PASSIVE checkpoint first (least disruptive)
      try {
        const passiveResult = db.pragma('wal_checkpoint(PASSIVE)') as
          | { checkpointed: number; busy: number }[]
          | undefined;
        const pagesCheckpointed = passiveResult?.[0]?.checkpointed || 0;

        if (pagesCheckpointed > 0) {
          const finalStats = await this.getWALStats(dbName);
          const finalWalSize = finalStats?.walSizeBytes || 0;

          return {
            success: true,
            method: 'PASSIVE',
            pagesCheckpointed,
            walSizeReduction: initialWalSize - finalWalSize,
          };
        }
      } catch (error) {
        logger.warn('PASSIVE checkpoint failed, trying RESTART');
      }

      // Try RESTART checkpoint (more aggressive)
      try {
        const restartResult = db.pragma('wal_checkpoint(RESTART)') as
          | { checkpointed: number; busy: number }[]
          | undefined;
        const pagesCheckpointed = restartResult?.[0]?.checkpointed || 0;

        const finalStats = await this.getWALStats(dbName);
        const finalWalSize = finalStats?.walSizeBytes || 0;

        return {
          success: true,
          method: 'RESTART',
          pagesCheckpointed,
          walSizeReduction: initialWalSize - finalWalSize,
        };
      } catch (error) {
        logger.warn('RESTART checkpoint failed, trying TRUNCATE');
      }

      // Last resort: TRUNCATE checkpoint (most aggressive)
      const truncateResult = db.pragma('wal_checkpoint(TRUNCATE)') as
        | { checkpointed: number; busy: number }[]
        | undefined;
      const pagesCheckpointed = truncateResult?.[0]?.checkpointed || 0;

      const finalStats = await this.getWALStats(dbName);
      const finalWalSize = finalStats?.walSizeBytes || 0;

      return {
        success: true,
        method: 'TRUNCATE',
        pagesCheckpointed,
        walSizeReduction: initialWalSize - finalWalSize,
      };
    } catch (error) {
      return {
        success: false,
        method: 'PASSIVE',
        pagesCheckpointed: 0,
        walSizeReduction: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if WAL checkpoint is needed based on thresholds
   */
  private async shouldCheckpoint(
    stats: WALStats
  ): Promise<{ needed: boolean; reason: string; critical: boolean }> {
    // Critical thresholds that require immediate action
    if (stats.walSizeMB > this.config.criticalWalSizeMB) {
      return {
        needed: true,
        reason: `WAL size ${stats.walSizeMB.toFixed(2)}MB exceeds critical threshold (${this.config.criticalWalSizeMB}MB)`,
        critical: true,
      };
    }

    if (stats.walToDbRatio > this.config.maxWalToDbRatio) {
      return {
        needed: true,
        reason: `WAL/DB ratio ${stats.walToDbRatio.toFixed(1)}% exceeds threshold (${this.config.maxWalToDbRatio}%)`,
        critical: true,
      };
    }

    // Warning thresholds
    if (stats.walSizeMB > this.config.maxWalSizeMB) {
      return {
        needed: true,
        reason: `WAL size ${stats.walSizeMB.toFixed(2)}MB exceeds warning threshold (${this.config.maxWalSizeMB}MB)`,
        critical: false,
      };
    }

    if (stats.ageMinutes > this.config.forceCheckpointMinutes) {
      return {
        needed: true,
        reason: `WAL age ${stats.ageMinutes.toFixed(1)} minutes exceeds threshold (${this.config.forceCheckpointMinutes} min)`,
        critical: false,
      };
    }

    return { needed: false, reason: '', critical: false };
  }

  /**
   * Monitor WAL file and perform automatic checkpoints
   */
  private async monitorWAL(): Promise<void> {
    try {
      const stats = await this.getWALStats('forums');

      if (!stats) {
        // No WAL file exists - this is normal
        return;
      }

      const checkpoint = await this.shouldCheckpoint(stats);

      if (checkpoint.needed) {
        logger.info(`🔧 WAL Monitor: ${checkpoint.reason}`);

        if (checkpoint.critical) {
          logger.info('🚨 CRITICAL: Performing immediate checkpoint');
        }

        const result = await this.performCheckpoint('forums');

        if (result.success) {
          logger.info(
            `✅ Checkpoint successful (${result.method}): ${result.pagesCheckpointed} pages, ${(result.walSizeReduction / 1024 / 1024).toFixed(2)}MB reduced`
          );
        } else {
          logger.error(`❌ Checkpoint failed: ${result.error}`);

          // If critical checkpoint fails, this is a production issue
          if (checkpoint.critical) {
            logger.error('🚨 CRITICAL CHECKPOINT FAILURE - REQUIRES IMMEDIATE ATTENTION');
          }
        }
      }
    } catch (error) {
      logger.error('WAL Monitor error:', error);
    }
  }

  /**
   * Start automatic WAL monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      logger.info('WAL monitoring already active');
      return;
    }

    logger.info(`🔍 Starting WAL monitoring (${this.config.checkIntervalMs / 1000}s intervals)`);

    // Initial check
    this.monitorWAL();

    // Set up interval monitoring
    this.monitoringInterval = setInterval(() => {
      this.monitorWAL();
    }, this.config.checkIntervalMs);

    // Set up automatic checkpoint configuration
    const db = dbPool.getConnection('forums');
    db.pragma(`wal_autocheckpoint = ${this.config.autoCheckpointPages}`);

    logger.info(
      `✅ WAL monitoring started with auto-checkpoint at ${this.config.autoCheckpointPages} pages`
    );
  }

  /**
   * Stop WAL monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('✅ WAL monitoring stopped');
    }
  }

  /**
   * Get monitoring health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    stats: WALStats | null;
    message: string;
    monitoringActive: boolean;
  }> {
    const stats = await this.getWALStats('forums');
    const monitoringActive = this.monitoringInterval !== null;

    if (!stats) {
      return {
        status: 'healthy',
        stats: null,
        message: 'No WAL file present',
        monitoringActive,
      };
    }

    const checkpoint = await this.shouldCheckpoint(stats);

    if (checkpoint.critical) {
      return {
        status: 'critical',
        stats,
        message: checkpoint.reason,
        monitoringActive,
      };
    }

    if (checkpoint.needed) {
      return {
        status: 'warning',
        stats,
        message: checkpoint.reason,
        monitoringActive,
      };
    }

    return {
      status: 'healthy',
      stats,
      message: `WAL: ${stats.walSizeMB.toFixed(2)}MB (${stats.walToDbRatio.toFixed(1)}% of DB)`,
      monitoringActive,
    };
  }
}

// Export singleton instance
export const walMonitor = WALMonitor.getInstance();

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_WAL_MONITORING === 'true') {
  // Delay startup to avoid conflicts during initialization
  setTimeout(() => {
    walMonitor.startMonitoring();
  }, 5000);
}
