/**
 * Database Encryption Migration Script
 *
 * Migrates existing unencrypted SQLite databases to encrypted format using SQLCipher.
 * Provides zero-downtime migration with automatic rollback on failure.
 *
 * Features:
 * - Safe migration with automatic backups
 * - Progress tracking and ETA calculation
 * - Verification of encrypted databases
 * - Rollback capability on failure
 * - Detailed logging and reporting
 *
 * Usage:
 *   node scripts/encrypt-existing-databases.js [options]
 *
 * Options:
 *   --database=<name>    Encrypt specific database only
 *   --dry-run           Show what would be done without making changes
 *   --force             Force encryption even if already encrypted
 *   --backup-dir=<path> Custom backup directory
 *   --verbose           Detailed progress output
 */

const fs = require('fs');
const path = require('path');
const Database = require('@journeyapps/sqlcipher');
const crypto = require('crypto');

// Configuration
const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');
const LOG_FILE = path.join(process.cwd(), 'logs', 'encryption-migration.log');

const DATABASES = ['forums', 'wiki', 'users', 'system', 'content', 'library', 'auth', 'messaging'];

const CIPHER_CONFIG = {
  compatibility: 'sqlcipher_4_5_x',
  pageSize: 4096,
  kdfIterations: 256000,
};

class DatabaseEncryptionMigrator {
  constructor(options = {}) {
    this.options = {
      dryRun: false,
      force: false,
      database: null,
      backupDir: BACKUP_DIR,
      verbose: false,
      ...options,
    };

    this.migrationResults = [];
    this.totalDatabases = 0;
    this.completedDatabases = 0;
    this.startTime = null;

    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    const dirs = [DATA_DIR, this.options.backupDir, path.dirname(LOG_FILE)];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.log('info', `Created directory: ${dir}`);
      }
    });
  }

  /**
   * Main migration entry point
   */
  async migrate() {
    this.startTime = Date.now();
    this.log('info', 'Starting database encryption migration...');

    try {
      // Validate environment
      await this.validateEnvironment();

      // Get databases to migrate
      const databasesToMigrate = this.getDatabaseList();
      this.totalDatabases = databasesToMigrate.length;

      if (this.totalDatabases === 0) {
        this.log('info', 'No databases to migrate');
        return { success: true, results: [] };
      }

      this.log('info', `Migrating ${this.totalDatabases} database(s)...`);

      // Migrate each database
      for (const dbName of databasesToMigrate) {
        await this.migrateDatabase(dbName);
        this.completedDatabases++;
        this.logProgress();
      }

      // Generate migration report
      const report = this.generateMigrationReport();
      this.log('info', 'Migration completed successfully');

      return report;
    } catch (error) {
      this.log('error', `Migration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate environment before migration
   */
  async validateEnvironment() {
    // Check if encryption is enabled
    if (process.env.DATABASE_ENCRYPTION_ENABLED !== 'true') {
      throw new Error('DATABASE_ENCRYPTION_ENABLED must be set to "true"');
    }

    // Check for master key
    if (!process.env.DATABASE_MASTER_KEY && !process.env.SESSION_SECRET) {
      throw new Error('DATABASE_MASTER_KEY or SESSION_SECRET must be provided');
    }

    // Check data directory
    if (!fs.existsSync(DATA_DIR)) {
      throw new Error(`Data directory not found: ${DATA_DIR}`);
    }

    // Check SQLCipher availability
    try {
      const testDb = new Database(':memory:');
      testDb.pragma('cipher_version');
      testDb.close();
    } catch (error) {
      throw new Error('SQLCipher not available or not properly installed');
    }

    this.log('info', 'Environment validation passed');
  }

  /**
   * Get list of databases to migrate
   */
  getDatabaseList() {
    let databases = DATABASES;

    // Filter by specific database if requested
    if (this.options.database) {
      databases = databases.filter(db => db === this.options.database);
      if (databases.length === 0) {
        throw new Error(`Database not found: ${this.options.database}`);
      }
    }

    // Filter out already encrypted databases (unless forced)
    if (!this.options.force) {
      databases = databases.filter(dbName => {
        const dbPath = path.join(DATA_DIR, `${dbName}.db`);
        if (!fs.existsSync(dbPath)) {
          this.log('warn', `Database file not found: ${dbPath}`);
          return false;
        }

        return !this.isDatabaseEncrypted(dbPath);
      });
    }

    return databases;
  }

  /**
   * Check if database is already encrypted
   */
  isDatabaseEncrypted(dbPath) {
    try {
      // Try to open without encryption key
      const testDb = new Database(dbPath);
      testDb.prepare('SELECT COUNT(*) FROM sqlite_master').get();
      testDb.close();
      return false; // Successfully opened without key = not encrypted
    } catch (error) {
      // If we can't read it, it's likely encrypted
      return error.message.includes('file is not a database');
    }
  }

  /**
   * Migrate individual database to encrypted format
   */
  async migrateDatabase(dbName) {
    const dbPath = path.join(DATA_DIR, `${dbName}.db`);
    const tempPath = path.join(DATA_DIR, `${dbName}_encrypted_temp.db`);
    const backupPath = path.join(this.options.backupDir, `${dbName}_backup_${Date.now()}.db`);

    const migrationStart = Date.now();
    let migrationResult = {
      database: dbName,
      success: false,
      startTime: new Date(),
      duration: 0,
      originalSize: 0,
      encryptedSize: 0,
      compressionRatio: 0,
      error: null,
    };

    try {
      this.log('info', `Starting migration of ${dbName} database...`);

      // Get original file size
      const stats = fs.statSync(dbPath);
      migrationResult.originalSize = stats.size;

      if (this.options.dryRun) {
        this.log('info', `[DRY RUN] Would migrate ${dbName} (${this.formatBytes(stats.size)})`);
        migrationResult.success = true;
        migrationResult.duration = 0;
        this.migrationResults.push(migrationResult);
        return;
      }

      // Create backup
      this.log('info', `Creating backup: ${backupPath}`);
      fs.copyFileSync(dbPath, backupPath);

      // Generate encryption key
      const encryptionKey = this.generateEncryptionKey(dbName);

      // Open source (unencrypted) database
      const sourceDb = new Database(dbPath);

      // Create encrypted database
      this.log('info', `Creating encrypted database: ${tempPath}`);
      sourceDb
        .prepare(`ATTACH DATABASE '${tempPath}' AS encrypted KEY "x'${encryptionKey}'"`)
        .run();

      // Configure encryption settings
      sourceDb.pragma('encrypted.cipher_compatibility = sqlcipher_4_5_x');
      sourceDb.pragma(`encrypted.cipher_page_size = ${CIPHER_CONFIG.pageSize}`);
      sourceDb.pragma(`encrypted.kdf_iter = ${CIPHER_CONFIG.kdfIterations}`);

      // Get all tables
      const tables = sourceDb
        .prepare(
          `
        SELECT name, sql FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `
        )
        .all();

      this.log('info', `Copying ${tables.length} tables...`);

      // Copy schema first
      for (const table of tables) {
        if (table.sql) {
          const createSql = table.sql.replace(/CREATE TABLE (\w+)/, 'CREATE TABLE encrypted.$1');
          sourceDb.prepare(createSql).run();
        }
      }

      // Copy data
      for (const table of tables) {
        const rowCount = sourceDb
          .prepare(`SELECT COUNT(*) as count FROM ${table.name}`)
          .get().count;

        if (rowCount > 0) {
          this.log('info', `Copying ${rowCount} rows from ${table.name}...`);
          sourceDb
            .prepare(`INSERT INTO encrypted.${table.name} SELECT * FROM main.${table.name}`)
            .run();
        }
      }

      // Copy indexes
      const indexes = sourceDb
        .prepare(
          `
        SELECT sql FROM sqlite_master
        WHERE type='index' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL
      `
        )
        .all();

      for (const index of indexes) {
        try {
          const indexSql = index.sql.replace(/CREATE INDEX/, 'CREATE INDEX encrypted.');
          sourceDb.prepare(indexSql).run();
        } catch (error) {
          this.log('warn', `Failed to copy index: ${error.message}`);
        }
      }

      // Copy triggers
      const triggers = sourceDb
        .prepare(
          `
        SELECT sql FROM sqlite_master
        WHERE type='trigger' AND sql IS NOT NULL
      `
        )
        .all();

      for (const trigger of triggers) {
        try {
          const triggerSql = trigger.sql.replace(/ON (\w+)/, 'ON encrypted.$1');
          sourceDb.prepare(triggerSql).run();
        } catch (error) {
          this.log('warn', `Failed to copy trigger: ${error.message}`);
        }
      }

      // Detach encrypted database
      sourceDb.prepare('DETACH DATABASE encrypted').run();
      sourceDb.close();

      // Verify encrypted database
      await this.verifyEncryptedDatabase(tempPath, encryptionKey, tables.length);

      // Replace original with encrypted version
      fs.renameSync(dbPath, `${dbPath}.original`);
      fs.renameSync(tempPath, dbPath);

      // Get encrypted file size
      const encryptedStats = fs.statSync(dbPath);
      migrationResult.encryptedSize = encryptedStats.size;
      migrationResult.compressionRatio = ((stats.size - encryptedStats.size) / stats.size) * 100;

      // Clean up original file
      fs.unlinkSync(`${dbPath}.original`);

      migrationResult.success = true;
      migrationResult.duration = Date.now() - migrationStart;

      this.log('info', `Successfully migrated ${dbName} in ${migrationResult.duration}ms`);
      this.log(
        'info',
        `Size: ${this.formatBytes(stats.size)} → ${this.formatBytes(encryptedStats.size)}`
      );
    } catch (error) {
      migrationResult.error = error.message;
      this.log('error', `Failed to migrate ${dbName}: ${error.message}`);

      // Cleanup on failure
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }

        // Restore from backup if original was moved
        if (fs.existsSync(`${dbPath}.original`)) {
          if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
          }
          fs.renameSync(`${dbPath}.original`, dbPath);
        } else if (fs.existsSync(backupPath) && !fs.existsSync(dbPath)) {
          fs.copyFileSync(backupPath, dbPath);
        }
      } catch (cleanupError) {
        this.log('error', `Cleanup failed: ${cleanupError.message}`);
      }

      throw error;
    }

    this.migrationResults.push(migrationResult);
  }

  /**
   * Generate encryption key for database
   */
  generateEncryptionKey(dbName) {
    // Use same key derivation as the key manager
    const masterKey = this.getMasterKey();
    const salt = crypto
      .createHash('sha256')
      .update(`${dbName}:1:veritable-games`)
      .digest()
      .slice(0, 16);

    const derivedKey = crypto.pbkdf2Sync(masterKey, salt, 100000, 32, 'sha256');
    return derivedKey.toString('hex');
  }

  /**
   * Get master key from environment
   */
  getMasterKey() {
    if (process.env.DATABASE_MASTER_KEY) {
      return Buffer.from(process.env.DATABASE_MASTER_KEY, 'hex');
    }

    // Fallback to session secret
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret) {
      throw new Error('No master key or session secret available');
    }

    const salt = Buffer.from('veritable-games-db-encryption', 'utf8');
    return crypto.pbkdf2Sync(sessionSecret, salt, 100000, 32, 'sha256');
  }

  /**
   * Verify encrypted database integrity
   */
  async verifyEncryptedDatabase(dbPath, encryptionKey, expectedTables) {
    this.log('info', 'Verifying encrypted database...');

    const db = new Database(dbPath);
    db.pragma(`key = "x'${encryptionKey}'"`);
    db.pragma('cipher_compatibility = sqlcipher_4_5_x');

    try {
      // Check if we can read the schema
      const tables = db
        .prepare(
          `
        SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'
      `
        )
        .get();

      if (tables.count < expectedTables) {
        throw new Error(`Expected ${expectedTables} tables, found ${tables.count}`);
      }

      // Test data integrity by reading from each table
      const tableNames = db
        .prepare(
          `
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `
        )
        .all();

      for (const table of tableNames) {
        try {
          db.prepare(`SELECT COUNT(*) FROM ${table.name}`).get();
        } catch (error) {
          throw new Error(`Failed to read table ${table.name}: ${error.message}`);
        }
      }

      this.log('info', 'Database verification successful');
    } finally {
      db.close();
    }
  }

  /**
   * Log progress and ETA
   */
  logProgress() {
    if (!this.options.verbose) return;

    const elapsed = Date.now() - this.startTime;
    const avgTimePerDb = elapsed / this.completedDatabases;
    const remaining = this.totalDatabases - this.completedDatabases;
    const eta = remaining * avgTimePerDb;

    const progress = ((this.completedDatabases / this.totalDatabases) * 100).toFixed(1);

    this.log('info', `Progress: ${this.completedDatabases}/${this.totalDatabases} (${progress}%)`);
    if (remaining > 0) {
      this.log('info', `ETA: ${this.formatDuration(eta)}`);
    }
  }

  /**
   * Generate migration report
   */
  generateMigrationReport() {
    const totalDuration = Date.now() - this.startTime;
    const successful = this.migrationResults.filter(r => r.success);
    const failed = this.migrationResults.filter(r => !r.success);

    const totalOriginalSize = this.migrationResults.reduce((sum, r) => sum + r.originalSize, 0);
    const totalEncryptedSize = this.migrationResults.reduce((sum, r) => sum + r.encryptedSize, 0);
    const totalCompressionRatio =
      totalOriginalSize > 0
        ? ((totalOriginalSize - totalEncryptedSize) / totalOriginalSize) * 100
        : 0;

    const report = {
      success: failed.length === 0,
      startTime: new Date(this.startTime),
      duration: totalDuration,
      totalDatabases: this.totalDatabases,
      successful: successful.length,
      failed: failed.length,
      totalOriginalSize,
      totalEncryptedSize,
      compressionRatio: totalCompressionRatio,
      results: this.migrationResults,
    };

    // Log summary
    this.log('info', '=== MIGRATION REPORT ===');
    this.log('info', `Total databases: ${this.totalDatabases}`);
    this.log('info', `Successful: ${successful.length}`);
    this.log('info', `Failed: ${failed.length}`);
    this.log('info', `Total duration: ${this.formatDuration(totalDuration)}`);
    this.log('info', `Size reduction: ${totalCompressionRatio.toFixed(2)}%`);

    if (failed.length > 0) {
      this.log('error', 'Failed databases:');
      failed.forEach(result => {
        this.log('error', `  ${result.database}: ${result.error}`);
      });
    }

    return report;
  }

  /**
   * Log message with timestamp
   */
  log(level, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

    console.log(logMessage);

    // Write to log file
    try {
      fs.appendFileSync(LOG_FILE, logMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Format duration for display
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  args.forEach(arg => {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg.startsWith('--database=')) {
      options.database = arg.split('=')[1];
    } else if (arg.startsWith('--backup-dir=')) {
      options.backupDir = arg.split('=')[1];
    }
  });

  const migrator = new DatabaseEncryptionMigrator(options);

  migrator
    .migrate()
    .then(report => {
      if (report.success) {
        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Migration completed with errors');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Migration failed:', error.message);
      process.exit(1);
    });
}

module.exports = DatabaseEncryptionMigrator;
