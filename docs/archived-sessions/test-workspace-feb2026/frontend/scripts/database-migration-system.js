#!/usr/bin/env node

/**
 * Database Migration System
 * Handles versioned migrations for all 8 SQLite databases
 * Supports rollback, validation, and backup before migration
 */

const Database = require('better-sqlite3');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class MigrationSystem {
  constructor() {
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

    this.migrationsDir = path.join(__dirname, '../migrations');
    this.backupsDir = path.join(__dirname, '../backups');
  }

  async initialize() {
    // Create directories if they don't exist
    await fs.mkdir(this.migrationsDir, { recursive: true });
    await fs.mkdir(this.backupsDir, { recursive: true });

    // Ensure migration tracking table exists in system.db
    const systemDb = new Database(this.databases.system);
    systemDb.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        database_name TEXT NOT NULL,
        version INTEGER NOT NULL,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        rollback_sql TEXT,
        execution_time_ms INTEGER,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        UNIQUE(database_name, version)
      );

      CREATE INDEX IF NOT EXISTS idx_migrations_status
        ON migrations(database_name, status);
    `);
    systemDb.close();

    console.log('Migration system initialized');
  }

  /**
   * Create a new migration file
   */
  async createMigration(databaseName, name) {
    if (!this.databases[databaseName]) {
      throw new Error(`Unknown database: ${databaseName}`);
    }

    const timestamp = Date.now();
    const version = Math.floor(timestamp / 1000);
    const filename = `${version}_${databaseName}_${name}.js`;
    const filepath = path.join(this.migrationsDir, filename);

    const template = `/**
 * Migration: ${name}
 * Database: ${databaseName}
 * Version: ${version}
 * Created: ${new Date().toISOString()}
 */

module.exports = {
  version: ${version},
  database: '${databaseName}',
  name: '${name}',

  /**
   * Run the migration
   * @param {Database} db - better-sqlite3 database instance
   */
  up(db) {
    db.transaction(() => {
      // Add your migration SQL here
      db.exec(\`
        -- Example: CREATE TABLE IF NOT EXISTS new_table (
        --   id INTEGER PRIMARY KEY AUTOINCREMENT,
        --   created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        -- );
      \`);
    })();
  },

  /**
   * Rollback the migration
   * @param {Database} db - better-sqlite3 database instance
   */
  down(db) {
    db.transaction(() => {
      // Add your rollback SQL here
      db.exec(\`
        -- Example: DROP TABLE IF EXISTS new_table;
      \`);
    })();
  },

  /**
   * Validate the migration was applied correctly
   * @param {Database} db - better-sqlite3 database instance
   * @returns {boolean}
   */
  validate(db) {
    try {
      // Add validation logic here
      // Example: const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='new_table'").get();
      // return !!result;
      return true;
    } catch (error) {
      console.error('Validation failed:', error);
      return false;
    }
  }
};`;

    await fs.writeFile(filepath, template);
    console.log(`Created migration: ${filepath}`);
    return filename;
  }

  /**
   * Get pending migrations for a database
   */
  async getPendingMigrations(databaseName) {
    const systemDb = new Database(this.databases.system);

    try {
      // Get applied migrations
      const applied = systemDb
        .prepare(
          `
        SELECT version FROM migrations
        WHERE database_name = ? AND status = 'completed'
      `
        )
        .all(databaseName)
        .map(m => m.version);

      // Get all migration files for this database
      const files = await fs.readdir(this.migrationsDir);
      const migrations = [];

      for (const file of files) {
        if (file.endsWith('.js') && file.includes(`_${databaseName}_`)) {
          const migration = require(path.join(this.migrationsDir, file));

          if (!applied.includes(migration.version)) {
            migrations.push({
              file,
              ...migration,
              checksum: await this.calculateChecksum(path.join(this.migrationsDir, file)),
            });
          }
        }
      }

      return migrations.sort((a, b) => a.version - b.version);
    } finally {
      systemDb.close();
    }
  }

  /**
   * Backup a database before migration
   */
  async backupDatabase(databaseName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupsDir, `${databaseName}_${timestamp}.db`);

    const sourceDb = new Database(this.databases[databaseName]);

    try {
      // Use SQLite backup API
      await sourceDb.backup(backupPath);

      // Also backup WAL if it exists
      const walPath = `${this.databases[databaseName]}-wal`;
      const walBackupPath = `${backupPath}-wal`;

      try {
        await fs.copyFile(walPath, walBackupPath);
      } catch (err) {
        // WAL might not exist, which is fine
      }

      console.log(`Backed up ${databaseName} to ${backupPath}`);
      return backupPath;
    } finally {
      sourceDb.close();
    }
  }

  /**
   * Run pending migrations for a database
   */
  async migrate(databaseName, options = {}) {
    const { dryRun = false, backup = true } = options;

    console.log(`\nMigrating database: ${databaseName}`);
    console.log('='.repeat(50));

    // Get pending migrations
    const pending = await this.getPendingMigrations(databaseName);

    if (pending.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Found ${pending.length} pending migration(s)`);

    // Backup before migration
    let backupPath = null;
    if (backup && !dryRun) {
      backupPath = await this.backupDatabase(databaseName);
    }

    const db = new Database(this.databases[databaseName]);
    const systemDb = new Database(this.databases.system);

    try {
      // Enable foreign keys and WAL mode
      db.pragma('foreign_keys = ON');
      db.pragma('journal_mode = WAL');

      for (const migration of pending) {
        console.log(`\nRunning migration ${migration.version}: ${migration.name}`);

        if (dryRun) {
          console.log('  [DRY RUN] Would apply migration');
          continue;
        }

        const startTime = Date.now();
        let status = 'completed';
        let errorMessage = null;

        try {
          // Begin transaction
          db.exec('BEGIN TRANSACTION');

          // Run migration
          migration.up(db);

          // Validate
          if (migration.validate && !migration.validate(db)) {
            throw new Error('Migration validation failed');
          }

          // Commit
          db.exec('COMMIT');

          console.log(`  ✓ Migration completed in ${Date.now() - startTime}ms`);
        } catch (error) {
          // Rollback on error
          db.exec('ROLLBACK');
          status = 'failed';
          errorMessage = error.message;

          console.error(`  ✗ Migration failed: ${error.message}`);

          // Restore from backup if available
          if (backupPath) {
            console.log(`  Restoring from backup: ${backupPath}`);
            db.close();
            await fs.copyFile(backupPath, this.databases[databaseName]);
            throw error;
          }
        }

        // Record migration in system database
        systemDb
          .prepare(
            `
          INSERT INTO migrations (
            database_name, version, name, checksum,
            execution_time_ms, status, error_message
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            databaseName,
            migration.version,
            migration.name,
            migration.checksum,
            Date.now() - startTime,
            status,
            errorMessage
          );

        if (status === 'failed') {
          throw new Error(`Migration ${migration.version} failed: ${errorMessage}`);
        }
      }

      // Optimize database after migrations
      console.log('\nOptimizing database...');
      db.pragma('optimize');
      db.pragma('wal_checkpoint(TRUNCATE)');
    } finally {
      db.close();
      systemDb.close();
    }

    console.log(`\n✓ Successfully applied ${pending.length} migration(s)`);
  }

  /**
   * Rollback the last migration
   */
  async rollback(databaseName, version = null) {
    const systemDb = new Database(this.databases.system);

    try {
      // Get the last applied migration or specific version
      const migration = version
        ? systemDb
            .prepare(
              `
            SELECT * FROM migrations
            WHERE database_name = ? AND version = ? AND status = 'completed'
          `
            )
            .get(databaseName, version)
        : systemDb
            .prepare(
              `
            SELECT * FROM migrations
            WHERE database_name = ? AND status = 'completed'
            ORDER BY version DESC LIMIT 1
          `
            )
            .get(databaseName);

      if (!migration) {
        console.log('No migration to rollback');
        return;
      }

      console.log(`Rolling back migration ${migration.version}: ${migration.name}`);

      // Load migration file
      const files = await fs.readdir(this.migrationsDir);
      const file = files.find(f => f.includes(`${migration.version}_${databaseName}_`));

      if (!file) {
        throw new Error(`Migration file not found for version ${migration.version}`);
      }

      const migrationModule = require(path.join(this.migrationsDir, file));

      // Backup before rollback
      await this.backupDatabase(databaseName);

      // Execute rollback
      const db = new Database(this.databases[databaseName]);

      try {
        db.transaction(() => {
          migrationModule.down(db);
        })();

        // Update migration status
        systemDb
          .prepare(
            `
          UPDATE migrations
          SET status = 'rolled_back'
          WHERE database_name = ? AND version = ?
        `
          )
          .run(databaseName, migration.version);

        console.log('✓ Rollback completed');
      } finally {
        db.close();
      }
    } finally {
      systemDb.close();
    }
  }

  /**
   * Get migration status for all databases
   */
  async status() {
    const systemDb = new Database(this.databases.system);

    try {
      console.log('\nMigration Status');
      console.log('='.repeat(50));

      for (const [name, dbPath] of Object.entries(this.databases)) {
        const applied = systemDb
          .prepare(
            `
          SELECT version, name, applied_at, status
          FROM migrations
          WHERE database_name = ?
          ORDER BY version DESC
          LIMIT 5
        `
          )
          .all(name);

        const pending = await this.getPendingMigrations(name);

        console.log(`\n${name.toUpperCase()} Database:`);
        console.log(`  Applied: ${applied.filter(m => m.status === 'completed').length}`);
        console.log(`  Pending: ${pending.length}`);

        if (applied.length > 0) {
          console.log('  Recent migrations:');
          applied.forEach(m => {
            const status = m.status === 'completed' ? '✓' : '✗';
            console.log(`    ${status} ${m.version} - ${m.name} (${m.applied_at})`);
          });
        }
      }
    } finally {
      systemDb.close();
    }
  }

  /**
   * Calculate checksum of a file
   */
  async calculateChecksum(filepath) {
    const content = await fs.readFile(filepath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Validate database integrity
   */
  async validateIntegrity(databaseName) {
    const db = new Database(this.databases[databaseName]);

    try {
      console.log(`\nValidating ${databaseName} database integrity...`);

      // Run integrity check
      const result = db.pragma('integrity_check');

      if (result[0].integrity_check !== 'ok') {
        throw new Error(`Integrity check failed: ${JSON.stringify(result)}`);
      }

      // Check foreign key constraints
      const fkViolations = db.pragma('foreign_key_check');

      if (fkViolations.length > 0) {
        console.warn('Foreign key violations found:', fkViolations);
      }

      // Get database stats
      const stats = {
        pageCount: db.pragma('page_count')[0].page_count,
        pageSize: db.pragma('page_size')[0].page_size,
        journalMode: db.pragma('journal_mode')[0].journal_mode,
        walSize: db.pragma('wal_checkpoint(PASSIVE)')[0],
      };

      console.log('Database stats:', stats);
      console.log('✓ Integrity check passed');

      return true;
    } catch (error) {
      console.error('✗ Integrity check failed:', error.message);
      return false;
    } finally {
      db.close();
    }
  }
}

// CLI Interface
async function main() {
  const system = new MigrationSystem();
  await system.initialize();

  const command = process.argv[2];
  const args = process.argv.slice(3);

  try {
    switch (command) {
      case 'create':
        if (args.length < 2) {
          console.error('Usage: npm run migrate create <database> <name>');
          process.exit(1);
        }
        await system.createMigration(args[0], args[1]);
        break;

      case 'up':
      case 'migrate':
        const database = args[0] || 'all';
        const options = {
          dryRun: args.includes('--dry-run'),
          backup: !args.includes('--no-backup'),
        };

        if (database === 'all') {
          for (const dbName of Object.keys(system.databases)) {
            await system.migrate(dbName, options);
          }
        } else {
          await system.migrate(database, options);
        }
        break;

      case 'rollback':
        if (args.length < 1) {
          console.error('Usage: npm run migrate rollback <database> [version]');
          process.exit(1);
        }
        await system.rollback(args[0], args[1] ? parseInt(args[1]) : null);
        break;

      case 'status':
        await system.status();
        break;

      case 'validate':
        const dbToValidate = args[0] || 'all';
        if (dbToValidate === 'all') {
          for (const dbName of Object.keys(system.databases)) {
            await system.validateIntegrity(dbName);
          }
        } else {
          await system.validateIntegrity(dbToValidate);
        }
        break;

      default:
        console.log(`
Database Migration System

Commands:
  create <database> <name>   Create a new migration
  migrate [database]         Run pending migrations (default: all)
    --dry-run               Show what would be migrated
    --no-backup            Skip backup before migration
  rollback <database> [ver]  Rollback last migration or specific version
  status                     Show migration status
  validate [database]        Validate database integrity

Examples:
  npm run migrate create forums add_user_badges
  npm run migrate up forums
  npm run migrate up all --dry-run
  npm run migrate rollback forums
  npm run migrate status
        `);
        break;
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = MigrationSystem;
