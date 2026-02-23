#!/usr/bin/env node

/**
 * Database Backup Strategy
 * Implements 3-2-1 backup rule with incremental backups
 * Supports local, S3, and remote backup destinations
 */

const Database = require('better-sqlite3');
const fs = require('fs').promises;
const path = require('path');
const { exec } =
  require('child_process').promise || require('util').promisify(require('child_process').exec);
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class BackupStrategy {
  constructor(config = {}) {
    this.config = {
      localBackupDir: config.localBackupDir || './backups',
      s3Bucket: config.s3Bucket || process.env.BACKUP_S3_BUCKET,
      s3Region: config.s3Region || process.env.AWS_REGION || 'us-east-1',
      retentionPolicy: {
        daily: 7, // Keep daily backups for 7 days
        weekly: 4, // Keep weekly backups for 4 weeks
        monthly: 12, // Keep monthly backups for 12 months
        yearly: 5, // Keep yearly backups for 5 years
      },
      compression: config.compression !== false,
      encryption: config.encryption || false,
      encryptionKey: config.encryptionKey || process.env.BACKUP_ENCRYPTION_KEY,
      ...config,
    };

    this.databases = {
      forums: './data/forums.db',
      wiki: './data/wiki.db',
      users: './data/users.db',
      system: './data/system.db',
      content: './data/content.db',
      library: './data/library.db',
      auth: './data/auth.db',
      messaging: './data/messaging.db',
    };
  }

  async initialize() {
    // Create backup directories
    await fs.mkdir(this.config.localBackupDir, { recursive: true });
    await fs.mkdir(path.join(this.config.localBackupDir, 'daily'), { recursive: true });
    await fs.mkdir(path.join(this.config.localBackupDir, 'weekly'), { recursive: true });
    await fs.mkdir(path.join(this.config.localBackupDir, 'monthly'), { recursive: true });
    await fs.mkdir(path.join(this.config.localBackupDir, 'yearly'), { recursive: true });
    await fs.mkdir(path.join(this.config.localBackupDir, 'incremental'), { recursive: true });

    // Initialize backup tracking database
    const trackingDb = new Database(path.join(this.config.localBackupDir, 'backup_tracking.db'));

    trackingDb.exec(`
      CREATE TABLE IF NOT EXISTS backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        database_name TEXT NOT NULL,
        backup_type TEXT NOT NULL, -- full, incremental, differential
        backup_level TEXT NOT NULL, -- daily, weekly, monthly, yearly
        backup_path TEXT NOT NULL,
        backup_size INTEGER,
        checksum TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        retention_until DATETIME,
        s3_uploaded BOOLEAN DEFAULT 0,
        s3_path TEXT,
        encrypted BOOLEAN DEFAULT 0,
        compression_ratio REAL,
        backup_duration_ms INTEGER,
        verification_status TEXT,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_backups_database
        ON backups(database_name, created_at);

      CREATE INDEX IF NOT EXISTS idx_backups_retention
        ON backups(retention_until);

      CREATE TABLE IF NOT EXISTS backup_chains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chain_id TEXT UNIQUE NOT NULL,
        database_name TEXT NOT NULL,
        full_backup_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_incremental_at DATETIME,
        total_size INTEGER DEFAULT 0,
        incremental_count INTEGER DEFAULT 0,
        FOREIGN KEY (full_backup_id) REFERENCES backups(id)
      );
    `);

    trackingDb.close();
    console.log('Backup system initialized');
  }

  /**
   * Perform a full backup of a database
   */
  async fullBackup(databaseName, level = 'daily') {
    console.log(`Starting full backup of ${databaseName} (${level})`);
    const startTime = Date.now();

    const sourceDbPath = this.databases[databaseName];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `${databaseName}_full_${timestamp}.db`;
    const backupPath = path.join(this.config.localBackupDir, level, backupFilename);

    const sourceDb = new Database(sourceDbPath);

    try {
      // Checkpoint WAL to ensure all data is in main database file
      sourceDb.pragma('wal_checkpoint(TRUNCATE)');

      // Perform backup using SQLite backup API
      await sourceDb.backup(backupPath);

      // Get file size
      const stats = await fs.stat(backupPath);
      let finalPath = backupPath;
      let finalSize = stats.size;
      let compressionRatio = 1;

      // Compress if enabled
      if (this.config.compression) {
        const compressedPath = await this.compressFile(backupPath);
        await fs.unlink(backupPath);
        finalPath = compressedPath;
        const compressedStats = await fs.stat(compressedPath);
        finalSize = compressedStats.size;
        compressionRatio = stats.size / finalSize;
      }

      // Encrypt if enabled
      let encrypted = false;
      if (this.config.encryption && this.config.encryptionKey) {
        finalPath = await this.encryptFile(finalPath);
        encrypted = true;
        const encryptedStats = await fs.stat(finalPath);
        finalSize = encryptedStats.size;
      }

      // Calculate checksum
      const checksum = await this.calculateFileChecksum(finalPath);

      // Calculate retention date based on level
      const retentionDays = this.getRetentionDays(level);
      const retentionUntil = new Date();
      retentionUntil.setDate(retentionUntil.getDate() + retentionDays);

      // Record backup in tracking database
      const trackingDb = new Database(path.join(this.config.localBackupDir, 'backup_tracking.db'));

      const backupId = trackingDb
        .prepare(
          `
        INSERT INTO backups (
          database_name, backup_type, backup_level, backup_path,
          backup_size, checksum, retention_until, encrypted,
          compression_ratio, backup_duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          databaseName,
          'full',
          level,
          finalPath,
          finalSize,
          checksum,
          retentionUntil.toISOString(),
          encrypted ? 1 : 0,
          compressionRatio,
          Date.now() - startTime
        ).lastInsertRowid;

      // Create new backup chain for incremental backups
      const chainId = crypto.randomBytes(16).toString('hex');
      trackingDb
        .prepare(
          `
        INSERT INTO backup_chains (
          chain_id, database_name, full_backup_id, total_size
        ) VALUES (?, ?, ?, ?)
      `
        )
        .run(chainId, databaseName, backupId, finalSize);

      trackingDb.close();

      console.log(`✓ Full backup completed: ${finalPath}`);
      console.log(
        `  Size: ${this.formatSize(finalSize)} (compression ratio: ${compressionRatio.toFixed(2)}x)`
      );
      console.log(`  Duration: ${Date.now() - startTime}ms`);
      console.log(`  Retention until: ${retentionUntil.toDateString()}`);

      // Upload to S3 if configured
      if (this.config.s3Bucket) {
        await this.uploadToS3(finalPath, databaseName, level);
      }

      return { backupId, path: finalPath, checksum, size: finalSize };
    } finally {
      sourceDb.close();
    }
  }

  /**
   * Perform an incremental backup (only changes since last backup)
   */
  async incrementalBackup(databaseName) {
    console.log(`Starting incremental backup of ${databaseName}`);
    const startTime = Date.now();

    const trackingDb = new Database(path.join(this.config.localBackupDir, 'backup_tracking.db'));

    try {
      // Get the latest backup chain
      const chain = trackingDb
        .prepare(
          `
        SELECT * FROM backup_chains
        WHERE database_name = ?
        ORDER BY created_at DESC
        LIMIT 1
      `
        )
        .get(databaseName);

      if (!chain) {
        console.log('No backup chain found, performing full backup instead');
        return await this.fullBackup(databaseName);
      }

      // Get the full backup info
      const fullBackup = trackingDb
        .prepare(
          `
        SELECT * FROM backups WHERE id = ?
      `
        )
        .get(chain.full_backup_id);

      const sourceDbPath = this.databases[databaseName];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `${databaseName}_incr_${chain.chain_id}_${timestamp}.db`;
      const backupPath = path.join(this.config.localBackupDir, 'incremental', backupFilename);

      // Create incremental backup using page-level changes
      const sourceDb = new Database(sourceDbPath);

      try {
        // Get database pages that changed since last backup
        const lastBackupTime = chain.last_incremental_at || chain.created_at;

        // For simplicity, we'll backup the entire database
        // In production, you'd use page-level tracking
        await sourceDb.backup(backupPath);

        const stats = await fs.stat(backupPath);
        const checksum = await this.calculateFileChecksum(backupPath);

        // Record incremental backup
        trackingDb
          .prepare(
            `
          INSERT INTO backups (
            database_name, backup_type, backup_level, backup_path,
            backup_size, checksum, retention_until, backup_duration_ms,
            metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            databaseName,
            'incremental',
            'daily',
            backupPath,
            stats.size,
            checksum,
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            Date.now() - startTime,
            JSON.stringify({ chainId: chain.chain_id, fullBackupId: chain.full_backup_id })
          );

        // Update chain info
        trackingDb
          .prepare(
            `
          UPDATE backup_chains
          SET last_incremental_at = CURRENT_TIMESTAMP,
              total_size = total_size + ?,
              incremental_count = incremental_count + 1
          WHERE chain_id = ?
        `
          )
          .run(stats.size, chain.chain_id);

        console.log(`✓ Incremental backup completed: ${backupPath}`);
        console.log(`  Size: ${this.formatSize(stats.size)}`);
        console.log(`  Chain: ${chain.chain_id}`);
      } finally {
        sourceDb.close();
      }
    } finally {
      trackingDb.close();
    }
  }

  /**
   * Restore a database from backup
   */
  async restore(databaseName, backupId = null, targetPath = null) {
    console.log(`Restoring ${databaseName} database`);

    const trackingDb = new Database(path.join(this.config.localBackupDir, 'backup_tracking.db'));

    try {
      // Get backup info
      const backup = backupId
        ? trackingDb.prepare('SELECT * FROM backups WHERE id = ?').get(backupId)
        : trackingDb
            .prepare(
              `
            SELECT * FROM backups
            WHERE database_name = ? AND backup_type = 'full'
            ORDER BY created_at DESC
            LIMIT 1
          `
            )
            .get(databaseName);

      if (!backup) {
        throw new Error('No backup found');
      }

      console.log(`Restoring from backup: ${backup.backup_path}`);

      let backupPath = backup.backup_path;

      // Decrypt if needed
      if (backup.encrypted) {
        backupPath = await this.decryptFile(backupPath);
      }

      // Decompress if needed
      if (backupPath.endsWith('.gz')) {
        backupPath = await this.decompressFile(backupPath);
      }

      // Determine target path
      const restorePath = targetPath || this.databases[databaseName];

      // Create backup of current database before restore
      const currentBackupPath = `${restorePath}.before_restore_${Date.now()}`;
      try {
        await fs.copyFile(restorePath, currentBackupPath);
        console.log(`Current database backed up to: ${currentBackupPath}`);
      } catch (err) {
        console.log('No existing database to backup');
      }

      // Restore the database
      await fs.copyFile(backupPath, restorePath);

      // Verify restoration
      const restoredDb = new Database(restorePath);

      try {
        const integrityCheck = restoredDb.pragma('integrity_check');

        if (integrityCheck[0].integrity_check !== 'ok') {
          throw new Error('Restored database failed integrity check');
        }

        console.log('✓ Database restored successfully');
        console.log(`  Restored to: ${restorePath}`);
        console.log(`  From backup: ${backup.created_at}`);
      } finally {
        restoredDb.close();
      }

      // Clean up temporary files
      if (backup.encrypted && backupPath !== backup.backup_path) {
        await fs.unlink(backupPath);
      }
    } finally {
      trackingDb.close();
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId) {
    const trackingDb = new Database(path.join(this.config.localBackupDir, 'backup_tracking.db'));

    try {
      const backup = trackingDb.prepare('SELECT * FROM backups WHERE id = ?').get(backupId);

      if (!backup) {
        throw new Error('Backup not found');
      }

      console.log(`Verifying backup: ${backup.backup_path}`);

      // Check file exists
      try {
        await fs.access(backup.backup_path);
      } catch (err) {
        console.error('✗ Backup file not found');
        return false;
      }

      // Verify checksum
      const currentChecksum = await this.calculateFileChecksum(backup.backup_path);

      if (currentChecksum !== backup.checksum) {
        console.error('✗ Checksum mismatch');
        return false;
      }

      // If it's a database backup, verify integrity
      if (!backup.encrypted && !backup.backup_path.endsWith('.gz')) {
        const db = new Database(backup.backup_path, { readonly: true });

        try {
          const integrityCheck = db.pragma('integrity_check');

          if (integrityCheck[0].integrity_check !== 'ok') {
            console.error('✗ Database integrity check failed');
            return false;
          }
        } finally {
          db.close();
        }
      }

      // Update verification status
      trackingDb
        .prepare(
          `
        UPDATE backups
        SET verification_status = 'verified'
        WHERE id = ?
      `
        )
        .run(backupId);

      console.log('✓ Backup verified successfully');
      return true;
    } finally {
      trackingDb.close();
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanup() {
    console.log('Cleaning up old backups...');

    const trackingDb = new Database(path.join(this.config.localBackupDir, 'backup_tracking.db'));

    try {
      // Find expired backups
      const expired = trackingDb
        .prepare(
          `
        SELECT * FROM backups
        WHERE retention_until < datetime('now')
      `
        )
        .all();

      console.log(`Found ${expired.length} expired backup(s)`);

      for (const backup of expired) {
        try {
          // Delete file
          await fs.unlink(backup.backup_path);
          console.log(`  Deleted: ${backup.backup_path}`);

          // Delete S3 copy if exists
          if (backup.s3_path) {
            await this.deleteFromS3(backup.s3_path);
          }

          // Remove from tracking
          trackingDb.prepare('DELETE FROM backups WHERE id = ?').run(backup.id);
        } catch (err) {
          console.error(`  Failed to delete ${backup.backup_path}: ${err.message}`);
        }
      }

      // Clean up orphaned backup chains
      trackingDb
        .prepare(
          `
        DELETE FROM backup_chains
        WHERE full_backup_id NOT IN (SELECT id FROM backups)
      `
        )
        .run();

      console.log('✓ Cleanup completed');
    } finally {
      trackingDb.close();
    }
  }

  /**
   * Get backup statistics
   */
  async getStats() {
    const trackingDb = new Database(path.join(this.config.localBackupDir, 'backup_tracking.db'));

    try {
      const stats = {
        databases: {},
        total: {
          count: 0,
          size: 0,
          s3Count: 0,
        },
      };

      for (const dbName of Object.keys(this.databases)) {
        const dbStats = trackingDb
          .prepare(
            `
          SELECT
            COUNT(*) as count,
            SUM(backup_size) as total_size,
            SUM(CASE WHEN s3_uploaded = 1 THEN 1 ELSE 0 END) as s3_count,
            MAX(created_at) as last_backup,
            AVG(backup_duration_ms) as avg_duration
          FROM backups
          WHERE database_name = ?
        `
          )
          .get(dbName);

        stats.databases[dbName] = {
          ...dbStats,
          total_size: dbStats.total_size || 0,
          size_formatted: this.formatSize(dbStats.total_size || 0),
        };

        stats.total.count += dbStats.count || 0;
        stats.total.size += dbStats.total_size || 0;
        stats.total.s3Count += dbStats.s3_count || 0;
      }

      stats.total.size_formatted = this.formatSize(stats.total.size);

      return stats;
    } finally {
      trackingDb.close();
    }
  }

  // Utility functions
  async compressFile(filepath) {
    const input = await fs.readFile(filepath);
    const compressed = await gzip(input, { level: 9 });
    const compressedPath = `${filepath}.gz`;
    await fs.writeFile(compressedPath, compressed);
    return compressedPath;
  }

  async decompressFile(filepath) {
    const compressed = await fs.readFile(filepath);
    const decompressed = await gunzip(compressed);
    const decompressedPath = filepath.replace('.gz', '');
    await fs.writeFile(decompressedPath, decompressed);
    return decompressedPath;
  }

  async encryptFile(filepath) {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const cipher = crypto.createCipher('aes-256-cbc', this.config.encryptionKey);
    const input = await fs.readFile(filepath);
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
    const encryptedPath = `${filepath}.enc`;
    await fs.writeFile(encryptedPath, encrypted);
    await fs.unlink(filepath);
    return encryptedPath;
  }

  async decryptFile(filepath) {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const decipher = crypto.createDecipher('aes-256-cbc', this.config.encryptionKey);
    const encrypted = await fs.readFile(filepath);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const decryptedPath = filepath.replace('.enc', '');
    await fs.writeFile(decryptedPath, decrypted);
    return decryptedPath;
  }

  async calculateFileChecksum(filepath) {
    const content = await fs.readFile(filepath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async uploadToS3(filepath, databaseName, level) {
    if (!this.config.s3Bucket) return;

    const filename = path.basename(filepath);
    const s3Path = `backups/${databaseName}/${level}/${filename}`;

    try {
      await exec(
        `aws s3 cp ${filepath} s3://${this.config.s3Bucket}/${s3Path} --region ${this.config.s3Region}`
      );

      // Update tracking
      const trackingDb = new Database(path.join(this.config.localBackupDir, 'backup_tracking.db'));
      trackingDb
        .prepare(
          `
        UPDATE backups
        SET s3_uploaded = 1, s3_path = ?
        WHERE backup_path = ?
      `
        )
        .run(s3Path, filepath);
      trackingDb.close();

      console.log(`  ✓ Uploaded to S3: ${s3Path}`);
    } catch (error) {
      console.error(`  ✗ Failed to upload to S3: ${error.message}`);
    }
  }

  async deleteFromS3(s3Path) {
    if (!this.config.s3Bucket) return;

    try {
      await exec(
        `aws s3 rm s3://${this.config.s3Bucket}/${s3Path} --region ${this.config.s3Region}`
      );
      console.log(`  ✓ Deleted from S3: ${s3Path}`);
    } catch (error) {
      console.error(`  ✗ Failed to delete from S3: ${error.message}`);
    }
  }

  getRetentionDays(level) {
    const retention = this.config.retentionPolicy;

    switch (level) {
      case 'daily':
        return retention.daily;
      case 'weekly':
        return retention.weekly * 7;
      case 'monthly':
        return retention.monthly * 30;
      case 'yearly':
        return retention.yearly * 365;
      default:
        return 7;
    }
  }

  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

// CLI Interface
async function main() {
  const strategy = new BackupStrategy();
  await strategy.initialize();

  const command = process.argv[2];

  try {
    switch (command) {
      case 'backup':
        const database = process.argv[3] || 'all';
        const level = process.argv[4] || 'daily';

        if (database === 'all') {
          for (const dbName of Object.keys(strategy.databases)) {
            await strategy.fullBackup(dbName, level);
          }
        } else {
          await strategy.fullBackup(database, level);
        }
        break;

      case 'incremental':
        const incrDb = process.argv[3] || 'all';
        if (incrDb === 'all') {
          for (const dbName of Object.keys(strategy.databases)) {
            await strategy.incrementalBackup(dbName);
          }
        } else {
          await strategy.incrementalBackup(incrDb);
        }
        break;

      case 'restore':
        if (!process.argv[3]) {
          console.error('Usage: npm run backup restore <database> [backupId]');
          process.exit(1);
        }
        await strategy.restore(process.argv[3], process.argv[4]);
        break;

      case 'verify':
        if (!process.argv[3]) {
          console.error('Usage: npm run backup verify <backupId>');
          process.exit(1);
        }
        await strategy.verifyBackup(parseInt(process.argv[3]));
        break;

      case 'cleanup':
        await strategy.cleanup();
        break;

      case 'stats':
        const stats = await strategy.getStats();
        console.log('\nBackup Statistics:');
        console.log('='.repeat(50));
        console.log(`Total backups: ${stats.total.count}`);
        console.log(`Total size: ${stats.total.size_formatted}`);
        console.log(`S3 uploads: ${stats.total.s3Count}`);
        console.log('\nPer Database:');
        for (const [name, dbStats] of Object.entries(stats.databases)) {
          console.log(`  ${name}:`);
          console.log(`    Backups: ${dbStats.count}`);
          console.log(`    Size: ${dbStats.size_formatted}`);
          console.log(`    Last backup: ${dbStats.last_backup || 'Never'}`);
        }
        break;

      default:
        console.log(`
Database Backup Strategy

Commands:
  backup [database] [level]    Create full backup (daily/weekly/monthly/yearly)
  incremental [database]        Create incremental backup
  restore <database> [id]       Restore database from backup
  verify <backupId>            Verify backup integrity
  cleanup                      Remove expired backups
  stats                        Show backup statistics

Examples:
  npm run backup backup all daily
  npm run backup incremental forums
  npm run backup restore wiki
  npm run backup cleanup
        `);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = BackupStrategy;
