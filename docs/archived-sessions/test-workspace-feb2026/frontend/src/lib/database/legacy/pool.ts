/**
 * Database Connection Pool Manager
 *
 * ⚠️ DEVELOPMENT/TESTING ONLY - SQLite NOT SUPPORTED IN PRODUCTION
 *
 * This module manages SQLite database connections and is only available
 * in development and testing environments. Production deployments use
 * PostgreSQL exclusively via the adapter pattern.
 *
 * CRITICAL FIX: This replaces 79+ separate database instantiations
 * that were creating new connections for every request.
 *
 * Before: Each service created its own Database instance
 * After: All services use this singleton pool
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
    '[WARNING] SQLite Pool Loaded in Production Environment\n' +
      'This module should only be used in development/testing.\n' +
      'Production must use PostgreSQL via the database adapter.\n' +
      'If this is intentional, set ALLOW_SQLITE_IN_PRODUCTION=true'
  );
}

class DatabasePool {
  private static instance: DatabasePool;
  private connections: Map<string, Database.Database>;
  private connectionMutex: Mutex;
  private readonly maxConnections = 50; // Increased from 15 to handle more concurrent users
  private readonly dataDir: string;
  private connectionAccessTime: Map<string, number>; // Track last access time for LRU

  private constructor() {
    this.connections = new Map();
    this.connectionMutex = new Mutex();
    this.connectionAccessTime = new Map();
    // Resolve data directory path - handle build-time gracefully
    this.dataDir = path.join(process.cwd(), 'data');
  }

  static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool();
    }
    return DatabasePool.instance;
  }

  /**
   * Get a database connection from the pool (thread-safe)
   *
   * Database mapping (as of October 2025):
   * - forums -> forums.db (forum discussions, topics, replies)
   * - wiki -> wiki.db (188 pages, 486 revisions)
   * - library -> library.db (19 documents)
   * - messaging -> messaging.db
   * - content -> content.db (projects with standalone revisions)
   * - users -> users.db (user profiles)
   * - auth -> auth.db (sessions, authentication)
   * - system -> system.db (configuration, monitoring)
   * - main -> main.db (⚠️ DEPRECATED - legacy backup, read-only)
   * - cache -> cache.db (optional, for future use)
   *
   * @param dbName - Name of the database (e.g., 'forums', 'wiki')
   * @returns Database connection
   */
  getConnection(dbName: string): Database.Database {
    // Map database names to their actual files
    const DATABASE_MAPPING: Record<string, string> = {
      forums: 'forums',
      wiki: 'wiki',
      library: 'library',
      messaging: 'messaging',
      content: 'content',
      users: 'users',
      auth: 'auth',
      system: 'system',
      main: 'main', // ⚠️ DEPRECATED: Keep for backward compatibility, but read-only
      cache: 'cache', // Optional: For future use
    };

    // Warn if deprecated databases are accessed
    if (dbName === 'main') {
      logger.warn(
        '[DatabasePool] ⚠️ main.db is DEPRECATED (legacy backup, read-only). Use specialized databases instead.'
      );
      logger.warn(
        '[DatabasePool] Data sources: wiki.db, content.db, library.db, users.db, auth.db, system.db'
      );
    }

    const actualDbName = DATABASE_MAPPING[dbName] || dbName;
    // Try to create a real connection first, fall back to mock if it fails
    try {
      // Check if data directory exists
      if (!require('fs').existsSync(this.dataDir)) {
        throw new Error('Data directory does not exist');
      }

      // Check if this is a build/test environment where we should use mocks
      // Note: USE_REAL_DB=true allows pool tests to use real databases
      const shouldUseMock =
        process.env.NEXT_PHASE === 'phase-production-build' ||
        process.env.npm_lifecycle_event === 'build' ||
        (process.env.NODE_ENV === 'test' && !process.env.USE_REAL_DB);

      if (shouldUseMock) {
        throw new Error('Build/test time - use mock');
      }
    } catch (error) {
      // Return a comprehensive mock database during build or when filesystem is unavailable
      const mockStatement = {
        get: (...args: any[]) => undefined,
        all: (...args: any[]) => [],
        run: (...args: any[]) => ({ changes: 0, lastInsertRowid: 0 }),
        pluck: (...args: any[]) => [],
        iterate: (...args: any[]) => [],
        bind: (...args: any[]) => mockStatement,
        columns: (...args: any[]) => [],
        raw: (...args: any[]) => mockStatement,
        safeIntegers: (...args: any[]) => mockStatement,
      };

      return {
        prepare: (...args: any[]) => mockStatement,
        exec: (...args: any[]) => {},
        close: (...args: any[]) => {},
        transaction: (fn: any) => () => fn(),
        pragma: (...args: any[]) => {},
        function: (...args: any[]) => {},
        aggregate: (...args: any[]) => {},
        loadExtension: (...args: any[]) => {},
        backup: (...args: any[]) => {},
        serialize: (...args: any[]) => Buffer.alloc(0),
        defaultSafeIntegers: false,
        memory: false,
        readonly: false,
        name: 'mock.db',
        open: true,
        inTransaction: false,
      } as unknown as Database.Database;
    }

    // Fast path - check if connection exists and is valid
    if (this.connections.has(actualDbName)) {
      const db = this.connections.get(actualDbName)!;
      try {
        db.exec('SELECT 1');
        this.connectionAccessTime.set(actualDbName, Date.now());
        return db;
      } catch (error) {
        // Connection is dead, will recreate below
        this.connections.delete(actualDbName);
        this.connectionAccessTime.delete(actualDbName);
      }
    }

    // Slow path - need to create connection (requires synchronization)
    return this.createConnectionSync(actualDbName);
  }

  /**
   * Create a new connection with proper synchronization to prevent race conditions
   * @param dbName - Name of the database
   * @returns Database connection
   */
  private createConnectionSync(dbName: string): Database.Database {
    // Use mutex to prevent race conditions during connection creation
    const release = this.connectionMutex.acquire();
    try {
      // Double-check pattern - connection might have been created while waiting
      if (this.connections.has(dbName)) {
        const db = this.connections.get(dbName)!;
        try {
          db.exec('SELECT 1');
          this.connectionAccessTime.set(dbName, Date.now());
          return db;
        } catch (error) {
          // Connection is dead, continue to create new one
          this.connections.delete(dbName);
          this.connectionAccessTime.delete(dbName);
        }
      }

      const dbPath = path.join(this.dataDir, `${dbName}.db`);

      // Check if we need to close an LRU connection
      if (this.connections.size >= this.maxConnections) {
        // Find least recently used connection
        let lruKey: string | null = null;
        let lruTime = Date.now();

        for (const [key, time] of this.connectionAccessTime.entries()) {
          if (time < lruTime) {
            lruTime = time;
            lruKey = key;
          }
        }

        if (lruKey) {
          const lruDb = this.connections.get(lruKey);
          lruDb?.close();
          this.connections.delete(lruKey);
          this.connectionAccessTime.delete(lruKey);
        }
      }

      // Create new connection
      const db = new Database(dbPath);

      // Configure for optimal performance
      db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
      db.pragma('busy_timeout = 5000'); // Wait up to 5 seconds for locks
      db.pragma('synchronous = NORMAL'); // Balance between safety and speed
      db.pragma('cache_size = 10000'); // Increase cache size (pages)

      // Database-specific foreign key configuration
      // Messaging database cannot enforce FKs due to cross-database references
      if (dbName === 'messaging') {
        db.pragma('foreign_keys = OFF'); // Disable for messaging database
      } else {
        db.pragma('foreign_keys = ON'); // Enforce for other databases
      }

      db.pragma('temp_store = MEMORY'); // Use memory for temp tables

      // WAL optimization - reduced to 100 for more frequent checkpoints
      // Prevents WAL file buildup with small frequent writes (category reordering, etc.)
      db.pragma('wal_autocheckpoint = 100'); // Auto-checkpoint every 100 pages

      // No longer need to ATTACH databases - everything consolidated into main.db

      // Initialize database schema if needed (including FTS5)
      this.initializeSchema(db, dbName);

      this.connections.set(dbName, db);
      this.connectionAccessTime.set(dbName, Date.now());
      return db;
    } finally {
      // Always release the mutex (acquire() returns Promise<() => void>)
      void release.then((releaseFn: () => void) => releaseFn());
    }
  }

  /**
   * Execute a query with automatic connection management
   * @param dbName - Database name
   * @param callback - Function to execute with the database connection
   */
  execute<T>(dbName: string, callback: (db: Database.Database) => T): T {
    const db = this.getConnection(dbName);
    try {
      return callback(db);
    } catch (error) {
      logger.error(`Database error in ${dbName}:`, error);
      throw error;
    }
  }

  /**
   * Execute a transaction with automatic rollback on error
   * @param dbName - Database name
   * @param callback - Transaction function
   */
  transaction<T>(dbName: string, callback: (db: Database.Database) => T): T {
    const db = this.getConnection(dbName);

    const transaction = db.transaction(callback);
    try {
      return transaction(db) as T;
    } catch (error) {
      logger.error(`Transaction failed in ${dbName}:`, error);
      throw error;
    }
  }

  /**
   * Close all connections (for graceful shutdown)
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
  }

  /**
   * Initialize database schema including FTS5 tables
   * This runs automatically when a database is first created
   */
  private initializeSchema(db: Database.Database, dbName: string): void {
    try {
      // Check if tables already exist (don't reinitialize)
      const tableCount = db
        .prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'")
        .get() as { count: number };

      // If database has tables (except sqlite internal ones), skip initialization
      if (tableCount.count > 0) {
        return;
      }

      logger.info(`Initializing schema for ${dbName} database...`);

      // Initialize based on database name
      switch (dbName) {
        case 'library':
          this.initializeLibrarySchema(db);
          break;
        case 'forums':
          this.initializeForumsSchema(db);
          break;
        case 'wiki':
          this.initializeWikiSchema(db);
          break;
        case 'users':
          this.initializeUsersSchema(db);
          break;
        case 'content':
          this.initializeContentSchema(db);
          break;
        // Add other database schemas as needed
      }
    } catch (error) {
      logger.error(`Failed to initialize schema for ${dbName}:`, error);
      // Don't throw - allow database to work even if schema init fails
    }
  }

  /**
   * Initialize Library database schema with FTS5
   */
  private initializeLibrarySchema(db: Database.Database): void {
    db.exec(`
      -- Main library documents table
      CREATE TABLE IF NOT EXISTS library_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        author TEXT,
        publication_date TEXT,
        document_type TEXT DEFAULT 'document',
        description TEXT,
        abstract TEXT,
        content TEXT NOT NULL,
        search_text TEXT,
        status TEXT DEFAULT 'published',
        page_count INTEGER DEFAULT NULL,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        view_count INTEGER DEFAULT 0
      );

      -- FTS5 virtual table for search
      CREATE VIRTUAL TABLE IF NOT EXISTS library_search_fts USING fts5(
        document_id UNINDEXED,
        title,
        author,
        description,
        abstract,
        content,
        tags,
        document_type,
        publication_date UNINDEXED,
        content='',
        contentless_delete=1,
        tokenize='porter unicode61 remove_diacritics 2'
      );

      -- Categories
      CREATE TABLE IF NOT EXISTS library_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT
      );

      -- Tag Categories
      CREATE TABLE IF NOT EXISTS library_tag_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'general',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Tags
      CREATE TABLE IF NOT EXISTS library_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        category_id INTEGER,
        description TEXT,
        usage_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES library_tag_categories(id) ON DELETE SET NULL
      );

      -- Junction tables
      CREATE TABLE IF NOT EXISTS library_document_categories (
        document_id INTEGER,
        category_id INTEGER,
        PRIMARY KEY (document_id, category_id)
      );

      CREATE TABLE IF NOT EXISTS library_document_tags (
        document_id INTEGER,
        tag_id INTEGER,
        added_by INTEGER,
        added_at DATETIME,
        PRIMARY KEY (document_id, tag_id),
        FOREIGN KEY (document_id) REFERENCES library_documents(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES library_tags(id) ON DELETE CASCADE
        -- Note: Cannot add FK to users(id) - users table is in different database (users.db)
        -- SQLite cannot enforce cross-database foreign keys
        -- Validation must be handled at application level (service layer)
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_library_documents_slug ON library_documents(slug);
      CREATE INDEX IF NOT EXISTS idx_library_documents_status ON library_documents(status);
      CREATE INDEX IF NOT EXISTS idx_library_documents_type ON library_documents(document_type);

      -- Triggers to keep FTS5 in sync with library_documents
      CREATE TRIGGER IF NOT EXISTS library_fts_insert
      AFTER INSERT ON library_documents
      BEGIN
        INSERT INTO library_search_fts (
          document_id, title, author, description, abstract, content,
          tags, document_type, publication_date
        ) VALUES (
          new.id, new.title, new.author, new.description, new.abstract, new.content,
          '', new.document_type, new.publication_date
        );
      END;

      CREATE TRIGGER IF NOT EXISTS library_fts_update
      AFTER UPDATE ON library_documents
      BEGIN
        DELETE FROM library_search_fts WHERE document_id = old.id;
        INSERT INTO library_search_fts (
          document_id, title, author, description, abstract, content,
          tags, document_type, publication_date
        ) VALUES (
          new.id, new.title, new.author, new.description, new.abstract, new.content,
          '', new.document_type, new.publication_date
        );
      END;

      CREATE TRIGGER IF NOT EXISTS library_fts_delete
      AFTER DELETE ON library_documents
      BEGIN
        DELETE FROM library_search_fts WHERE document_id = old.id;
      END;
    `);

    // Populate FTS5 with any existing data
    db.exec(`
      INSERT OR IGNORE INTO library_search_fts (
        document_id, title, author, description, abstract, content,
        tags, document_type, publication_date
      )
      SELECT
        id, title, author, description, abstract, content,
        '', document_type, publication_date
      FROM library_documents
      WHERE status = 'published';
    `);

    // Migration: Add page_count column if it doesn't exist (for existing databases)
    try {
      const columns = db.prepare('PRAGMA table_info(library_documents)').all() as Array<{
        name: string;
      }>;
      const hasPageCount = columns.some(col => col.name === 'page_count');

      if (!hasPageCount) {
        logger.info('[DatabasePool] Migrating library_documents: adding page_count column');
        db.exec('ALTER TABLE library_documents ADD COLUMN page_count INTEGER DEFAULT NULL');
      }
    } catch (error) {
      logger.error('[DatabasePool] Failed to add page_count column:', error);
    }
  }

  /**
   * Initialize Forums database schema with FTS5
   */
  private initializeForumsSchema(db: Database.Database): void {
    db.exec(`
      -- Categories
      CREATE TABLE IF NOT EXISTS forum_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#3B82F6',
        icon TEXT,
        section TEXT DEFAULT 'general',
        sort_order INTEGER DEFAULT 0,
        is_public INTEGER DEFAULT 1,
        topic_count INTEGER DEFAULT 0,
        reply_count INTEGER DEFAULT 0,
        last_post_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Topics
      CREATE TABLE IF NOT EXISTS forum_topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        user_id INTEGER,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        content_format TEXT DEFAULT 'markdown',
        is_locked INTEGER DEFAULT 0,
        is_pinned INTEGER DEFAULT 0,
        is_solved INTEGER DEFAULT 0,
        status TEXT DEFAULT 'open',
        vote_score INTEGER DEFAULT 0,
        reply_count INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        deleted_by INTEGER,
        last_edited_at DATETIME,
        last_edited_by INTEGER
      );

      -- Replies
      CREATE TABLE IF NOT EXISTS forum_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER NOT NULL,
        parent_id INTEGER,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        content_format TEXT DEFAULT 'markdown',
        reply_depth INTEGER DEFAULT 0,
        path TEXT DEFAULT '',
        is_solution INTEGER DEFAULT 0,
        vote_score INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        deleted_by INTEGER,
        last_edited_at DATETIME,
        last_edited_by INTEGER
      );

      -- FTS5 for forum search
      -- Note: Not using contentless so we can store and query column values
      CREATE VIRTUAL TABLE IF NOT EXISTS forum_search_fts USING fts5(
        content_id UNINDEXED,
        content_type UNINDEXED,
        title,
        content,
        author_username,
        category_name,
        category_id UNINDEXED,
        created_at UNINDEXED,
        vote_score UNINDEXED,
        topic_id UNINDEXED,
        is_locked UNINDEXED,
        is_pinned UNINDEXED,
        tokenize='porter unicode61 remove_diacritics 2'
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_topics_category ON forum_topics(category_id);
      CREATE INDEX IF NOT EXISTS idx_topics_user ON forum_topics(user_id);
      CREATE INDEX IF NOT EXISTS idx_topics_deleted ON forum_topics(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_replies_topic ON forum_replies(topic_id);
      CREATE INDEX IF NOT EXISTS idx_replies_parent ON forum_replies(parent_id);
      CREATE INDEX IF NOT EXISTS idx_replies_user ON forum_replies(user_id);
      CREATE INDEX IF NOT EXISTS idx_replies_deleted ON forum_replies(deleted_at);

      -- Triggers for automatic FTS5 updates on topics
      CREATE TRIGGER IF NOT EXISTS forum_fts_topic_insert
      AFTER INSERT ON forum_topics
      BEGIN
        INSERT INTO forum_search_fts (
          content_id, content_type, title, content, author_username,
          category_name, category_id, created_at, vote_score,
          topic_id, is_locked, is_pinned
        )
        SELECT
          new.id, 'topic', new.title, new.content,
          'unknown',
          c.name, new.category_id, new.created_at, new.vote_score,
          new.id, new.is_locked, new.is_pinned
        FROM forum_categories c
        WHERE c.id = new.category_id;
      END;

      CREATE TRIGGER IF NOT EXISTS forum_fts_topic_update
      AFTER UPDATE ON forum_topics
      BEGIN
        DELETE FROM forum_search_fts WHERE content_id = old.id AND content_type = 'topic';

        INSERT INTO forum_search_fts (
          content_id, content_type, title, content, author_username,
          category_name, category_id, created_at, vote_score,
          topic_id, is_locked, is_pinned
        )
        SELECT
          new.id, 'topic', new.title, new.content,
          'unknown',
          c.name, new.category_id, new.created_at, new.vote_score,
          new.id, new.is_locked, new.is_pinned
        FROM forum_categories c
        WHERE c.id = new.category_id;
      END;

      CREATE TRIGGER IF NOT EXISTS forum_fts_topic_delete
      AFTER DELETE ON forum_topics
      BEGIN
        DELETE FROM forum_search_fts WHERE content_id = old.id AND content_type = 'topic';
      END;

      -- Triggers for automatic FTS5 updates on replies
      CREATE TRIGGER IF NOT EXISTS forum_fts_reply_insert
      AFTER INSERT ON forum_replies
      BEGIN
        INSERT INTO forum_search_fts (
          content_id, content_type, title, content, author_username,
          category_name, category_id, created_at, vote_score,
          topic_id, is_locked, is_pinned
        )
        SELECT
          new.id, 'reply', NULL, new.content,
          'unknown',
          c.name, t.category_id, new.created_at, new.vote_score,
          new.topic_id, 0, 0
        FROM forum_topics t
        LEFT JOIN forum_categories c ON t.category_id = c.id
        WHERE t.id = new.topic_id;
      END;

      CREATE TRIGGER IF NOT EXISTS forum_fts_reply_update
      AFTER UPDATE ON forum_replies
      BEGIN
        DELETE FROM forum_search_fts WHERE content_id = old.id AND content_type = 'reply';

        INSERT INTO forum_search_fts (
          content_id, content_type, title, content, author_username,
          category_name, category_id, created_at, vote_score,
          topic_id, is_locked, is_pinned
        )
        SELECT
          new.id, 'reply', NULL, new.content,
          'unknown',
          c.name, t.category_id, new.created_at, new.vote_score,
          new.topic_id, 0, 0
        FROM forum_topics t
        LEFT JOIN forum_categories c ON t.category_id = c.id
        WHERE t.id = new.topic_id;
      END;

      CREATE TRIGGER IF NOT EXISTS forum_fts_reply_delete
      AFTER DELETE ON forum_replies
      BEGIN
        DELETE FROM forum_search_fts WHERE content_id = old.id AND content_type = 'reply';
      END;
    `);

    // Populate FTS5 with any existing forum data
    db.exec(`
      -- Populate existing topics
      INSERT OR IGNORE INTO forum_search_fts (
        content_id, content_type, title, content, author_username,
        category_name, category_id, created_at, vote_score,
        topic_id, is_locked, is_pinned
      )
      SELECT
        t.id, 'topic', t.title, t.content,
        'unknown',
        c.name, t.category_id, t.created_at, t.vote_score,
        t.id, t.is_locked, t.is_pinned
      FROM forum_topics t
      LEFT JOIN forum_categories c ON t.category_id = c.id;
    `);

    db.exec(`
      -- Populate existing replies
      INSERT OR IGNORE INTO forum_search_fts (
        content_id, content_type, title, content, author_username,
        category_name, category_id, created_at, vote_score,
        topic_id, is_locked, is_pinned
      )
      SELECT
        r.id, 'reply', NULL, r.content,
        'unknown',
        c.name, t.category_id, r.created_at, r.vote_score,
        r.topic_id, 0, 0
      FROM forum_replies r
      LEFT JOIN forum_topics t ON r.topic_id = t.id
      LEFT JOIN forum_categories c ON t.category_id = c.id;
    `);

    // Insert default categories if none exist (exact copy from v0.36)
    const categoryCount = db.prepare('SELECT COUNT(*) as count FROM forum_categories').get() as {
      count: number;
    };
    if (categoryCount.count === 0) {
      db.exec(`
        INSERT INTO forum_categories (slug, name, description, section, color, icon, sort_order) VALUES
          ('forum-rules', 'Forum Rules', 'Community guidelines and posting policies', 'Social Contract', '#DC2626', '📋', 1),
          ('noxii-general-discussion', 'Noxii General Discussion', 'General discussion about Noxii prototype, lore, gameplay', 'Noxii Game', '#2563EB', '🎮', 2),
          ('noxii-modding', 'Noxii Modding', 'Modding tools, tutorials, technical discussions', 'Noxii Game', '#7C3AED', '🔧', 3),
          ('maps-mods', 'Maps & Mods', 'Share Noxii maps and modifications', 'Noxii Game', '#059669', '🗺️', 4),
          ('autumn-development', 'Autumn Development', 'Project Autumn development updates and feedback', 'Autumn Project', '#D97706', '🍂', 5),
          ('off-topic', 'Off-Topic', 'General discussions not related to game development', 'Miscellaneous', '#6B7280', '💬', 6);
      `);
    }
  }

  /**
   * Initialize Wiki database schema
   */
  private initializeWikiSchema(db: Database.Database): void {
    // IMPORTANT: This schema must match the one in @/lib/wiki/database.ts
    // Any schema changes should be made in BOTH places
    db.exec(`
      -- Wiki pages table with all columns
      CREATE TABLE IF NOT EXISTS wiki_pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        namespace TEXT DEFAULT 'main',
        project_slug TEXT,
        template_type TEXT,
        category_id TEXT,
        status TEXT DEFAULT 'published',
        protection_level TEXT DEFAULT 'none',
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      -- Indexes for wiki_pages
      CREATE INDEX IF NOT EXISTS idx_wiki_pages_slug ON wiki_pages(slug);
      CREATE INDEX IF NOT EXISTS idx_wiki_pages_namespace ON wiki_pages(namespace);
      CREATE INDEX IF NOT EXISTS idx_wiki_pages_category ON wiki_pages(category_id);
      CREATE INDEX IF NOT EXISTS idx_wiki_pages_project ON wiki_pages(project_slug);
      CREATE INDEX IF NOT EXISTS idx_wiki_pages_status ON wiki_pages(status);
    `);
  }

  /**
   * Initialize Users database schema
   */
  private initializeUsersSchema(db: Database.Database): void {
    db.exec(`
      -- Users table
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
        privacy_settings TEXT DEFAULT '{}'
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_github ON users(github_url);
      CREATE INDEX IF NOT EXISTS idx_users_discord ON users(discord_username);
    `);
  }

  /**
   * Initialize Content database schema (projects, workspace, etc.)
   */
  private initializeContentSchema(db: Database.Database): void {
    db.exec(`
      -- Workspaces table (infinite canvas)
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        project_slug TEXT UNIQUE NOT NULL,
        settings TEXT DEFAULT '{}',
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Canvas nodes table (notes/text boxes on workspace)
      CREATE TABLE IF NOT EXISTS canvas_nodes (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        position_x REAL NOT NULL,
        position_y REAL NOT NULL,
        width REAL NOT NULL,
        height REAL NOT NULL,
        content TEXT NOT NULL,
        style TEXT,
        metadata TEXT,
        z_index INTEGER DEFAULT 0,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted INTEGER DEFAULT 0,
        deleted_at DATETIME,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      -- Node connections table (arrows between nodes)
      CREATE TABLE IF NOT EXISTS node_connections (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        source_node_id TEXT NOT NULL,
        source_anchor_side TEXT NOT NULL,
        source_anchor_offset REAL DEFAULT 0.5,
        target_node_id TEXT NOT NULL,
        target_anchor_side TEXT NOT NULL,
        target_anchor_offset REAL DEFAULT 0.5,
        label TEXT,
        style TEXT,
        z_index INTEGER DEFAULT 0,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted INTEGER DEFAULT 0,
        deleted_at DATETIME,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (source_node_id) REFERENCES canvas_nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (target_node_id) REFERENCES canvas_nodes(id) ON DELETE CASCADE
      );

      -- Viewport states table (per-user pan/zoom position)
      CREATE TABLE IF NOT EXISTS viewport_states (
        workspace_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        offset_x REAL DEFAULT 0,
        offset_y REAL DEFAULT 0,
        scale REAL DEFAULT 1.0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workspace_id, user_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_canvas_nodes_workspace ON canvas_nodes(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_canvas_nodes_deleted ON canvas_nodes(is_deleted);
      CREATE INDEX IF NOT EXISTS idx_canvas_nodes_position ON canvas_nodes(position_x, position_y);
      CREATE INDEX IF NOT EXISTS idx_canvas_nodes_z_index ON canvas_nodes(z_index);

      CREATE INDEX IF NOT EXISTS idx_node_connections_workspace ON node_connections(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_node_connections_source ON node_connections(source_node_id);
      CREATE INDEX IF NOT EXISTS idx_node_connections_target ON node_connections(target_node_id);
      CREATE INDEX IF NOT EXISTS idx_node_connections_deleted ON node_connections(is_deleted);

      CREATE INDEX IF NOT EXISTS idx_viewport_states_workspace ON viewport_states(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_viewport_states_user ON viewport_states(user_id);

      -- Triggers to auto-update timestamps
      CREATE TRIGGER IF NOT EXISTS workspaces_update_timestamp
      AFTER UPDATE ON workspaces
      BEGIN
        UPDATE workspaces SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS canvas_nodes_update_timestamp
      AFTER UPDATE ON canvas_nodes
      BEGIN
        UPDATE canvas_nodes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS node_connections_update_timestamp
      AFTER UPDATE ON node_connections
      BEGIN
        UPDATE node_connections SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS viewport_states_update_timestamp
      AFTER UPDATE ON viewport_states
      BEGIN
        UPDATE viewport_states SET updated_at = CURRENT_TIMESTAMP
        WHERE workspace_id = NEW.workspace_id AND user_id = NEW.user_id;
      END;
    `);

    logger.info(
      '[DatabasePool] Content database schema initialized (workspaces, canvas_nodes, node_connections, viewport_states)'
    );
  }

  /**
   * Get pool statistics for monitoring
   */
  getStats() {
    return {
      activeConnections: this.connections.size,
      maxConnections: this.maxConnections,
      databases: Array.from(this.connections.keys()),
    };
  }

  /**
   * Get active connection count (for monitoring compatibility)
   */
  getActiveConnections(): number {
    return this.connections.size;
  }

  /**
   * Release connection (no-op for compatibility - connections are auto-managed)
   * @deprecated Connections are automatically managed by the pool
   */
  releaseConnection(db: Database.Database): void {
    // No-op: connections are automatically managed by the pool
    // This method exists only for backward compatibility
    logger.warn('releaseConnection() is deprecated - connections are auto-managed');
  }
}

// Export singleton instance
export const dbPool = DatabasePool.getInstance();

// Helper function for backward compatibility
export function getDatabase(name: string = 'forums'): Database.Database {
  return dbPool.getConnection(name);
}

// Graceful shutdown handler with memory leak prevention
if (typeof process !== 'undefined') {
  // Increase max listeners to prevent warnings in dev mode
  process.setMaxListeners(15);

  let shutdownHandlers = false;

  const setupShutdownHandlers = () => {
    if (shutdownHandlers) return;
    shutdownHandlers = true;

    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}. Closing database connections...`);
      dbPool.closeAll();
      process.exit(0);
    };

    process.once('SIGINT', () => gracefulShutdown('SIGINT'));
    process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  };

  setupShutdownHandlers();
}
