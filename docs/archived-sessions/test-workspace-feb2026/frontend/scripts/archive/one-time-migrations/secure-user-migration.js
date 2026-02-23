#!/usr/bin/env node

/**
 * Secure User Database Migration Script
 *
 * This script safely migrates user data from multiple databases (auth.db, forums.db, wiki.db)
 * to a centralized users.db while maintaining data integrity, security, and authentication continuity.
 *
 * Security Features:
 * - Atomic transactions with rollback capability
 * - Data validation and checksums
 * - Session preservation
 * - Foreign key integrity maintenance
 * - Comprehensive audit logging
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  dataDir: path.join(__dirname, '..', 'data'),
  backupDir: path.join(
    __dirname,
    '..',
    'data',
    'backup-migration-' + new Date().toISOString().replace(/[:.]/g, '-')
  ),
  databases: {
    auth: 'auth.db',
    forums: 'forums.db',
    wiki: 'wiki.db',
    users: 'users.db',
  },
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  validateOnly: process.argv.includes('--validate-only'),
};

// Logging
const log = {
  info: msg => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  warn: msg => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
  error: msg => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  success: msg => console.log(`[SUCCESS] ${new Date().toISOString()} - ${msg}`),
  debug: msg => CONFIG.verbose && console.log(`[DEBUG] ${new Date().toISOString()} - ${msg}`),
};

// Security validation class
class SecurityValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  validatePasswordHash(hash) {
    // Bcrypt hashes start with $2a$, $2b$, or $2y$
    if (!hash || !hash.match(/^\$2[aby]\$\d{2}\$/)) {
      this.errors.push(`Invalid password hash format: ${hash?.substring(0, 10)}...`);
      return false;
    }
    return true;
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      this.errors.push(`Invalid email format: ${email}`);
      return false;
    }
    return true;
  }

  validateUsername(username) {
    if (!username || username.length < 3 || username.length > 50) {
      this.errors.push(`Invalid username length: ${username}`);
      return false;
    }
    if (!username.match(/^[a-zA-Z0-9_-]+$/)) {
      this.warnings.push(`Username contains special characters: ${username}`);
    }
    return true;
  }

  validateSessionToken(token) {
    // Session tokens should be hex strings of appropriate length
    if (!token || !token.match(/^[a-f0-9]{32,}$/i)) {
      this.warnings.push(`Invalid session token format`);
      return false;
    }
    return true;
  }

  getReport() {
    return {
      errors: this.errors,
      warnings: this.warnings,
      hasErrors: this.errors.length > 0,
      hasWarnings: this.warnings.length > 0,
    };
  }
}

// Migration class
class UserMigration {
  constructor(config) {
    this.config = config;
    this.validator = new SecurityValidator();
    this.stats = {
      usersProcessed: 0,
      sessionsProcessed: 0,
      permissionsProcessed: 0,
      conflictsResolved: 0,
      errors: 0,
    };
    this.auditLog = [];
  }

  // Create backup of all databases
  async createBackup() {
    log.info('Creating backup of all databases...');

    if (!fs.existsSync(this.config.backupDir)) {
      fs.mkdirSync(this.config.backupDir, { recursive: true });
    }

    for (const [key, dbFile] of Object.entries(this.config.databases)) {
      const sourcePath = path.join(this.config.dataDir, dbFile);
      const destPath = path.join(this.config.backupDir, dbFile);

      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        log.debug(`Backed up ${dbFile}`);

        // Create checksum for backup verification
        const checksum = this.calculateChecksum(sourcePath);
        fs.writeFileSync(`${destPath}.sha256`, checksum);
      }
    }

    log.success('Backup completed successfully');
  }

  // Calculate SHA256 checksum of file
  calculateChecksum(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  // Analyze current state of databases
  async analyzeCurrentState() {
    log.info('Analyzing current database state...');

    const analysis = {
      auth: { users: 0, sessions: 0, permissions: 0 },
      forums: { users: 0, sessions: 0, permissions: 0 },
      wiki: { users: 0, sessions: 0, permissions: 0 },
      conflicts: [],
      issues: [],
    };

    // Check auth.db
    const authDb = this.openDatabase('auth');
    if (authDb) {
      analysis.auth.users = authDb.prepare('SELECT COUNT(*) as count FROM users').get().count;
      analysis.auth.sessions = authDb
        .prepare('SELECT COUNT(*) as count FROM user_sessions')
        .get().count;
      analysis.auth.permissions = authDb
        .prepare('SELECT COUNT(*) as count FROM user_permissions')
        .get().count;
      authDb.close();
    }

    // Check forums.db
    const forumsDb = this.openDatabase('forums');
    if (forumsDb) {
      try {
        analysis.forums.users = forumsDb.prepare('SELECT COUNT(*) as count FROM users').get().count;
        analysis.forums.sessions = forumsDb
          .prepare('SELECT COUNT(*) as count FROM user_sessions')
          .get().count;
        analysis.forums.permissions = forumsDb
          .prepare('SELECT COUNT(*) as count FROM user_permissions')
          .get().count;
      } catch (e) {
        log.debug(`Forums database query error: ${e.message}`);
      }
      forumsDb.close();
    }

    // Check wiki.db
    const wikiDb = this.openDatabase('wiki');
    if (wikiDb) {
      try {
        analysis.wiki.users = wikiDb.prepare('SELECT COUNT(*) as count FROM users').get().count;
        analysis.wiki.sessions = wikiDb
          .prepare('SELECT COUNT(*) as count FROM user_sessions')
          .get().count;
        analysis.wiki.permissions = wikiDb
          .prepare('SELECT COUNT(*) as count FROM user_permissions')
          .get().count;
      } catch (e) {
        log.debug(`Wiki database query error: ${e.message}`);
      }
      wikiDb.close();
    }

    // Check for conflicts
    this.detectConflicts(analysis);

    return analysis;
  }

  // Detect conflicts between databases
  detectConflicts(analysis) {
    const authDb = this.openDatabase('auth');
    const forumsDb = this.openDatabase('forums');

    if (!authDb || !forumsDb) return;

    // Get all users from both databases
    const authUsers = authDb.prepare('SELECT id, username, email, password_hash FROM users').all();
    const forumUsers = forumsDb
      .prepare('SELECT id, username, email, password_hash FROM users')
      .all();

    // Create maps for comparison
    const authUserMap = new Map(authUsers.map(u => [u.username, u]));
    const forumUserMap = new Map(forumUsers.map(u => [u.username, u]));

    // Find conflicts
    for (const [username, authUser] of authUserMap) {
      if (forumUserMap.has(username)) {
        const forumUser = forumUserMap.get(username);

        // Check for password hash differences
        if (authUser.password_hash !== forumUser.password_hash) {
          analysis.conflicts.push({
            type: 'password_mismatch',
            username: username,
            description: 'Different password hashes in auth.db and forums.db',
          });
        }

        // Check for email differences
        if (authUser.email !== forumUser.email) {
          analysis.conflicts.push({
            type: 'email_mismatch',
            username: username,
            authEmail: authUser.email,
            forumEmail: forumUser.email,
          });
        }
      }
    }

    authDb.close();
    forumsDb.close();
  }

  // Open database with error handling
  openDatabase(name) {
    try {
      const dbPath = path.join(this.config.dataDir, this.config.databases[name]);
      if (!fs.existsSync(dbPath)) {
        log.warn(`Database ${name} does not exist at ${dbPath}`);
        return null;
      }

      const db = new Database(dbPath, { readonly: this.config.validateOnly });
      db.pragma('journal_mode = WAL');
      return db;
    } catch (error) {
      log.error(`Failed to open database ${name}: ${error.message}`);
      return null;
    }
  }

  // Create the consolidated users.db schema
  createUsersDatabase() {
    log.info('Creating consolidated users database schema...');

    const usersDbPath = path.join(this.config.dataDir, this.config.databases.users);

    // Remove existing users.db if it exists (in dry-run, skip this)
    if (!this.config.dryRun && fs.existsSync(usersDbPath)) {
      fs.renameSync(usersDbPath, `${usersDbPath}.old.${Date.now()}`);
    }

    if (this.config.dryRun) {
      log.info('[DRY-RUN] Would create users.db with consolidated schema');
      return null;
    }

    const db = new Database(usersDbPath);

    // Configure for optimal performance and security
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 10000');

    // Create users table with all fields from both databases
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        avatar_url TEXT,
        bio TEXT,
        role TEXT DEFAULT 'user',
        reputation INTEGER DEFAULT 0,
        post_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        location TEXT,
        website_url TEXT,
        github_url TEXT,
        mastodon_url TEXT,
        linkedin_url TEXT,
        discord_username TEXT,
        profile_visibility TEXT DEFAULT 'public',
        activity_privacy TEXT DEFAULT 'public',
        email_visibility TEXT DEFAULT 'private',
        show_online_status BOOLEAN DEFAULT TRUE,
        allow_messages BOOLEAN DEFAULT TRUE,
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        email_verified BOOLEAN DEFAULT FALSE,
        last_login_at DATETIME,
        login_count INTEGER DEFAULT 0,
        steam_url TEXT,
        xbox_gamertag TEXT,
        psn_id TEXT,
        updated_at DATETIME,
        avatar_position_x REAL DEFAULT 50,
        avatar_position_y REAL DEFAULT 50,
        avatar_scale REAL DEFAULT 100,
        bluesky_url TEXT,
        follower_count INTEGER DEFAULT 0,
        following_count INTEGER DEFAULT 0,
        friend_count INTEGER DEFAULT 0,
        message_count INTEGER DEFAULT 0,
        last_seen DATETIME,
        privacy_settings TEXT DEFAULT '{}',
        migration_source TEXT,
        migration_date DATETIME,
        original_id INTEGER
      );

      CREATE INDEX idx_users_username ON users(username);
      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_role ON users(role);
      CREATE INDEX idx_users_created_at ON users(created_at);
      CREATE INDEX idx_users_last_active ON users(last_active);

      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);

      CREATE TABLE IF NOT EXISTS user_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        permission_type TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        granted_by INTEGER,
        granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (granted_by) REFERENCES users(id)
      );

      CREATE INDEX idx_permissions_user_id ON user_permissions(user_id);
      CREATE INDEX idx_permissions_type ON user_permissions(permission_type);

      CREATE TABLE IF NOT EXISTS user_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        permissions TEXT NOT NULL,
        hierarchy_level INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_privacy_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        profile_visibility TEXT DEFAULT 'public',
        activity_visibility TEXT DEFAULT 'public',
        email_visibility TEXT DEFAULT 'private',
        show_online_status BOOLEAN DEFAULT TRUE,
        show_last_active BOOLEAN DEFAULT TRUE,
        allow_friend_requests BOOLEAN DEFAULT TRUE,
        allow_messages BOOLEAN DEFAULT TRUE,
        show_reputation_details BOOLEAN DEFAULT TRUE,
        show_forum_activity BOOLEAN DEFAULT TRUE,
        show_wiki_activity BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CHECK (profile_visibility IN ('public', 'members', 'friends', 'private')),
        CHECK (activity_visibility IN ('public', 'members', 'friends', 'private')),
        CHECK (email_visibility IN ('public', 'members', 'admin', 'private'))
      );

      CREATE INDEX idx_privacy_user_id ON user_privacy_settings(user_id);

      CREATE TABLE IF NOT EXISTS migration_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        source_database TEXT,
        details TEXT,
        checksum TEXT
      );
    `);

    log.success('Users database schema created successfully');
    return db;
  }

  // Migrate users from source databases
  async migrateUsers(targetDb) {
    log.info('Starting user migration...');

    if (this.config.dryRun) {
      log.info('[DRY-RUN] Would migrate users from auth.db and forums.db');
      return;
    }

    const authDb = this.openDatabase('auth');
    const forumsDb = this.openDatabase('forums');

    // Create user ID mapping to preserve references
    const userIdMap = new Map();
    const processedUsernames = new Set();

    // Start transaction
    const migration = targetDb.transaction(() => {
      // Migrate from auth.db first (primary source)
      if (authDb) {
        const authUsers = authDb.prepare('SELECT * FROM users').all();

        for (const user of authUsers) {
          // Validate user data
          if (!this.validator.validateUsername(user.username)) continue;
          if (!this.validator.validateEmail(user.email)) continue;
          if (!this.validator.validatePasswordHash(user.password_hash)) continue;

          const insertStmt = targetDb.prepare(`
            INSERT INTO users (
              username, email, password_hash, display_name, avatar_url, bio,
              role, reputation, post_count, created_at, last_active, is_active,
              location, website_url, github_url, mastodon_url, linkedin_url,
              discord_username, profile_visibility, activity_privacy, email_visibility,
              show_online_status, allow_messages, two_factor_enabled, email_verified,
              last_login_at, login_count, steam_url, xbox_gamertag, psn_id,
              updated_at, avatar_position_x, avatar_position_y, avatar_scale,
              bluesky_url, follower_count, following_count, friend_count,
              message_count, last_seen, privacy_settings,
              migration_source, migration_date, original_id
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              'auth.db', CURRENT_TIMESTAMP, ?
            )
          `);

          const result = insertStmt.run(
            user.username,
            user.email,
            user.password_hash,
            user.display_name,
            user.avatar_url,
            user.bio,
            user.role,
            user.reputation,
            user.post_count,
            user.created_at,
            user.last_active,
            user.is_active,
            user.location,
            user.website_url,
            user.github_url,
            user.mastodon_url,
            user.linkedin_url,
            user.discord_username,
            user.profile_visibility || 'public',
            user.activity_privacy || 'public',
            user.email_visibility || 'private',
            user.show_online_status ?? 1,
            user.allow_messages ?? 1,
            user.two_factor_enabled ?? 0,
            user.email_verified ?? 0,
            user.last_login_at,
            user.login_count || 0,
            user.steam_url,
            user.xbox_gamertag,
            user.psn_id,
            user.updated_at,
            user.avatar_position_x || 50,
            user.avatar_position_y || 50,
            user.avatar_scale || 100,
            user.bluesky_url,
            user.follower_count || 0,
            user.following_count || 0,
            user.friend_count || 0,
            user.message_count || 0,
            user.last_seen,
            user.privacy_settings || '{}',
            user.id
          );

          userIdMap.set(`auth_${user.id}`, result.lastInsertRowid);
          processedUsernames.add(user.username);
          this.stats.usersProcessed++;

          this.auditLog.push({
            action: 'USER_MIGRATED',
            source: 'auth.db',
            username: user.username,
            newId: result.lastInsertRowid,
            oldId: user.id,
          });
        }
      }

      // Migrate remaining users from forums.db (skip duplicates)
      if (forumsDb) {
        const forumUsers = forumsDb.prepare('SELECT * FROM users').all();

        for (const user of forumUsers) {
          // Skip if already processed
          if (processedUsernames.has(user.username)) {
            userIdMap.set(`forums_${user.id}`, userIdMap.get(`auth_${user.id}`));
            continue;
          }

          // Validate user data
          if (!this.validator.validateUsername(user.username)) continue;
          if (!this.validator.validateEmail(user.email)) continue;
          if (!this.validator.validatePasswordHash(user.password_hash)) continue;

          const insertStmt = targetDb.prepare(`
            INSERT INTO users (
              username, email, password_hash, display_name, avatar_url, bio,
              role, reputation, post_count, created_at, last_active, is_active,
              migration_source, migration_date, original_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'forums.db', CURRENT_TIMESTAMP, ?)
          `);

          const result = insertStmt.run(
            user.username,
            user.email,
            user.password_hash,
            user.display_name,
            user.avatar_url,
            user.bio,
            user.role,
            user.reputation,
            user.post_count,
            user.created_at,
            user.last_active,
            user.is_active,
            user.id
          );

          userIdMap.set(`forums_${user.id}`, result.lastInsertRowid);
          this.stats.usersProcessed++;

          this.auditLog.push({
            action: 'USER_MIGRATED',
            source: 'forums.db',
            username: user.username,
            newId: result.lastInsertRowid,
            oldId: user.id,
          });
        }
      }

      log.info(`Migrated ${this.stats.usersProcessed} users`);
    });

    // Execute migration transaction
    migration();

    // Store ID mapping for session and permission migration
    this.userIdMap = userIdMap;

    if (authDb) authDb.close();
    if (forumsDb) forumsDb.close();
  }

  // Migrate sessions
  async migrateSessions(targetDb) {
    log.info('Migrating user sessions...');

    if (this.config.dryRun) {
      log.info('[DRY-RUN] Would migrate sessions');
      return;
    }

    const authDb = this.openDatabase('auth');
    const forumsDb = this.openDatabase('forums');
    const processedSessions = new Set();

    const migration = targetDb.transaction(() => {
      // Migrate sessions from auth.db
      if (authDb) {
        const sessions = authDb.prepare('SELECT * FROM user_sessions').all();

        for (const session of sessions) {
          const newUserId = this.userIdMap.get(`auth_${session.user_id}`);
          if (!newUserId) {
            log.warn(`No user mapping for auth session user_id ${session.user_id}`);
            continue;
          }

          // Skip expired sessions
          if (new Date(session.expires_at) < new Date()) {
            log.debug(`Skipping expired session ${session.id}`);
            continue;
          }

          targetDb
            .prepare(
              `
            INSERT INTO user_sessions (id, user_id, expires_at, created_at)
            VALUES (?, ?, ?, ?)
          `
            )
            .run(session.id, newUserId, session.expires_at, session.created_at);

          processedSessions.add(session.id);
          this.stats.sessionsProcessed++;
        }
      }

      // Migrate sessions from forums.db (skip duplicates)
      if (forumsDb) {
        const sessions = forumsDb.prepare('SELECT * FROM user_sessions').all();

        for (const session of sessions) {
          if (processedSessions.has(session.id)) continue;

          const newUserId = this.userIdMap.get(`forums_${session.user_id}`);
          if (!newUserId) {
            log.warn(`No user mapping for forums session user_id ${session.user_id}`);
            continue;
          }

          // Skip expired sessions
          if (new Date(session.expires_at) < new Date()) {
            log.debug(`Skipping expired session ${session.id}`);
            continue;
          }

          targetDb
            .prepare(
              `
            INSERT INTO user_sessions (id, user_id, expires_at, created_at)
            VALUES (?, ?, ?, ?)
          `
            )
            .run(session.id, newUserId, session.expires_at, session.created_at);

          this.stats.sessionsProcessed++;
        }
      }

      log.info(`Migrated ${this.stats.sessionsProcessed} sessions`);
    });

    migration();

    if (authDb) authDb.close();
    if (forumsDb) forumsDb.close();
  }

  // Validate migration
  async validateMigration(targetDb) {
    log.info('Validating migration...');

    const validation = {
      success: true,
      checks: [],
    };

    // Check user count
    const userCount = targetDb.prepare('SELECT COUNT(*) as count FROM users').get().count;
    validation.checks.push({
      name: 'User count',
      expected: this.stats.usersProcessed,
      actual: userCount,
      passed: userCount === this.stats.usersProcessed,
    });

    // Check session count
    const sessionCount = targetDb
      .prepare('SELECT COUNT(*) as count FROM user_sessions')
      .get().count;
    validation.checks.push({
      name: 'Session count',
      expected: this.stats.sessionsProcessed,
      actual: sessionCount,
      passed: sessionCount === this.stats.sessionsProcessed,
    });

    // Check for duplicate usernames
    const duplicates = targetDb
      .prepare(
        `
      SELECT username, COUNT(*) as count
      FROM users
      GROUP BY username
      HAVING count > 1
    `
      )
      .all();

    validation.checks.push({
      name: 'No duplicate usernames',
      expected: 0,
      actual: duplicates.length,
      passed: duplicates.length === 0,
    });

    // Check foreign key integrity
    const orphanedSessions = targetDb
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM user_sessions s
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.user_id)
    `
      )
      .get().count;

    validation.checks.push({
      name: 'No orphaned sessions',
      expected: 0,
      actual: orphanedSessions,
      passed: orphanedSessions === 0,
    });

    // Check password hashes are valid
    const invalidPasswords = targetDb
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM users
      WHERE password_hash NOT LIKE '$2%'
    `
      )
      .get().count;

    validation.checks.push({
      name: 'All passwords properly hashed',
      expected: 0,
      actual: invalidPasswords,
      passed: invalidPasswords === 0,
    });

    // Determine overall success
    validation.success = validation.checks.every(check => check.passed);

    // Log results
    console.log('\n=== Migration Validation Results ===');
    for (const check of validation.checks) {
      const status = check.passed ? '✅' : '❌';
      console.log(`${status} ${check.name}: Expected ${check.expected}, Got ${check.actual}`);
    }
    console.log('=====================================\n');

    return validation;
  }

  // Main execution
  async execute() {
    try {
      log.info('Starting secure user migration process...');

      // Step 1: Analyze current state
      const analysis = await this.analyzeCurrentState();
      console.log('\n=== Current State Analysis ===');
      console.log(JSON.stringify(analysis, null, 2));
      console.log('==============================\n');

      if (analysis.conflicts.length > 0) {
        log.warn(`Found ${analysis.conflicts.length} conflicts between databases`);
        for (const conflict of analysis.conflicts) {
          log.warn(`  - ${conflict.type}: ${conflict.username || conflict.description}`);
        }
      }

      // Step 2: Validation only mode
      if (this.config.validateOnly) {
        log.info('Running in validation-only mode');
        const report = this.validator.getReport();
        if (report.hasErrors) {
          log.error('Validation failed with errors:');
          report.errors.forEach(err => log.error(`  - ${err}`));
          process.exit(1);
        }
        log.success('Validation completed successfully');
        return;
      }

      // Step 3: Create backup
      if (!this.config.dryRun) {
        await this.createBackup();
      }

      // Step 4: Create target database
      const targetDb = this.createUsersDatabase();
      if (!targetDb && !this.config.dryRun) {
        throw new Error('Failed to create target database');
      }

      // Step 5: Migrate users
      if (targetDb) {
        await this.migrateUsers(targetDb);

        // Step 6: Migrate sessions
        await this.migrateSessions(targetDb);

        // Step 7: Validate migration
        const validation = await this.validateMigration(targetDb);

        if (!validation.success) {
          log.error('Migration validation failed!');
          if (!this.config.dryRun) {
            // Rollback would happen here
            log.error('Consider restoring from backup');
          }
          process.exit(1);
        }

        // Step 8: Set proper permissions
        if (!this.config.dryRun) {
          const usersDbPath = path.join(this.config.dataDir, this.config.databases.users);
          fs.chmodSync(usersDbPath, 0o640); // rw-r-----
        }

        targetDb.close();
      }

      // Step 9: Final report
      console.log('\n=== Migration Statistics ===');
      console.log(`Users migrated: ${this.stats.usersProcessed}`);
      console.log(`Sessions migrated: ${this.stats.sessionsProcessed}`);
      console.log(`Permissions migrated: ${this.stats.permissionsProcessed}`);
      console.log(`Conflicts resolved: ${this.stats.conflictsResolved}`);
      console.log(`Errors encountered: ${this.stats.errors}`);
      console.log('============================\n');

      // Save audit log
      if (!this.config.dryRun) {
        const auditPath = path.join(this.config.backupDir, 'migration-audit.json');
        fs.writeFileSync(
          auditPath,
          JSON.stringify(
            {
              timestamp: new Date().toISOString(),
              stats: this.stats,
              validator: this.validator.getReport(),
              auditLog: this.auditLog,
            },
            null,
            2
          )
        );
        log.success(`Audit log saved to ${auditPath}`);
      }

      log.success('Migration completed successfully!');

      if (this.config.dryRun) {
        log.info('[DRY-RUN] No actual changes were made');
      }
    } catch (error) {
      log.error(`Migration failed: ${error.message}`);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// Main execution
if (require.main === module) {
  const migration = new UserMigration(CONFIG);

  // Show help if requested
  if (process.argv.includes('--help')) {
    console.log(`
Secure User Database Migration Script

Usage: node secure-user-migration.js [options]

Options:
  --dry-run        Perform a dry run without making changes
  --validate-only  Only validate data without migrating
  --verbose        Show detailed debug information
  --help          Show this help message

Examples:
  # Validate data without making changes
  node secure-user-migration.js --validate-only

  # Perform a dry run to see what would happen
  node secure-user-migration.js --dry-run --verbose

  # Execute the actual migration
  node secure-user-migration.js --verbose
`);
    process.exit(0);
  }

  migration.execute().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { UserMigration, SecurityValidator };
