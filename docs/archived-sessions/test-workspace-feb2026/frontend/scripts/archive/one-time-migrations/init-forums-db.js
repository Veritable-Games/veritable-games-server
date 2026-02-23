#!/usr/bin/env node

/**
 * Forums Database Initialization Script
 *
 * Creates a clean, optimized forum database schema following the design from NEW_DATABASE_SCHEMA.md
 *
 * Features:
 * - 5 core tables (categories, topics, replies, tags, topic_tags)
 * - FTS5 full-text search with porter stemming
 * - Nested reply support (up to 5 levels deep)
 * - Comprehensive triggers for automatic data maintenance
 * - Strategic indexes for query optimization
 * - Default categories with color-coding
 *
 * Usage:
 *   node scripts/init-forums-db.js [--force]
 *
 * Options:
 *   --force    Drop existing tables and recreate (WARNING: destroys data)
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'forums.db');

// Default categories with colors matching Tailwind palette
const DEFAULT_CATEGORIES = [
  {
    name: 'General Discussion',
    slug: 'general-discussion',
    description: 'General gaming and community discussion',
    color: '#3B82F6', // Blue
    icon: 'chat',
    section: 'general',
    sort_order: 1,
  },
  {
    name: 'Bug Reports',
    slug: 'bug-reports',
    description: 'Report bugs and technical issues',
    color: '#EF4444', // Red
    icon: 'bug',
    section: 'support',
    sort_order: 2,
  },
  {
    name: 'Feature Requests',
    slug: 'feature-requests',
    description: 'Suggest new features and improvements',
    color: '#8B5CF6', // Purple
    icon: 'lightbulb',
    section: 'feedback',
    sort_order: 3,
  },
  {
    name: 'Questions',
    slug: 'questions',
    description: 'Ask questions and get help from the community',
    color: '#10B981', // Green
    icon: 'help',
    section: 'support',
    sort_order: 4,
  },
  {
    name: 'Announcements',
    slug: 'announcements',
    description: 'Official announcements and news',
    color: '#F59E0B', // Yellow
    icon: 'megaphone',
    section: 'general',
    sort_order: 5,
  },
  {
    name: 'Off-Topic',
    slug: 'off-topic',
    description: 'Non-gaming discussions and casual chat',
    color: '#6B7280', // Gray
    icon: 'coffee',
    section: 'community',
    sort_order: 6,
  },
];

const args = process.argv.slice(2);
const forceRecreate = args.includes('--force');

function initializeForumsDatabase() {
  console.log('Forums Database Initialization');
  console.log('==============================\n');

  // Check if database exists
  const dbExists = fs.existsSync(DB_PATH);

  if (dbExists && !forceRecreate) {
    console.log('⚠️  Database already exists at:', DB_PATH);
    console.log('   Use --force to drop and recreate (WARNING: destroys all data)');
    console.log('   Exiting without changes.\n');
    return;
  }

  if (dbExists && forceRecreate) {
    console.log('⚠️  FORCE MODE: Dropping existing database...');
    fs.unlinkSync(DB_PATH);
    console.log('   ✓ Existing database removed\n');
  }

  console.log(`Creating new database at: ${DB_PATH}\n`);

  const db = new Database(DB_PATH);

  try {
    // Configure database for optimal performance
    console.log('[1/6] Configuring database...');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 10000');
    db.pragma('temp_store = MEMORY');
    console.log('      ✓ WAL mode enabled');
    console.log('      ✓ Foreign keys enabled');
    console.log('      ✓ Performance pragmas set\n');

    // Create core tables
    console.log('[2/6] Creating core tables...');
    createCoreTables(db);
    console.log('      ✓ forum_categories');
    console.log('      ✓ forum_topics');
    console.log('      ✓ forum_replies');
    console.log('      ✓ forum_tags');
    console.log('      ✓ forum_topic_tags\n');

    // Create FTS5 search table
    console.log('[3/6] Creating FTS5 search index...');
    createFTS5Table(db);
    console.log('      ✓ forum_search_fts (contentless FTS5)\n');

    // Create indexes
    console.log('[4/6] Creating performance indexes...');
    createIndexes(db);
    console.log('      ✓ 17 strategic indexes created\n');

    // Create triggers
    console.log('[5/6] Creating triggers...');
    createTriggers(db);
    console.log('      ✓ 19 automatic maintenance triggers\n');

    // Insert default categories
    console.log('[6/6] Inserting default categories...');
    insertDefaultCategories(db);
    console.log(`      ✓ ${DEFAULT_CATEGORIES.length} categories inserted\n`);

    // Verify schema
    console.log('Verifying schema...');
    const tables = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `
      )
      .all();

    console.log(`   Tables created: ${tables.length}`);
    tables.forEach(({ name }) => console.log(`      - ${name}`));

    const indexes = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM sqlite_master
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
    `
      )
      .get();
    console.log(`   Indexes created: ${indexes.count}`);

    const triggers = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger'
    `
      )
      .get();
    console.log(`   Triggers created: ${triggers.count}\n`);

    console.log('✅ Forums database initialized successfully!\n');
    console.log('Next steps:');
    console.log('  1. Start the development server: npm run dev');
    console.log('  2. Navigate to /forums to test the forum system');
    console.log('  3. Create a test topic to verify functionality\n');
  } catch (error) {
    console.error('\n❌ Error initializing database:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    db.close();
  }
}

/**
 * Create core forum tables
 */
function createCoreTables(db) {
  db.exec(`
    -- ========================================
    -- FORUM CATEGORIES
    -- ========================================
    CREATE TABLE IF NOT EXISTS forum_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT DEFAULT '#6366f1',
      icon TEXT,
      section TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,

      -- Materialized counts (updated via triggers)
      topic_count INTEGER DEFAULT 0 NOT NULL,
      reply_count INTEGER DEFAULT 0 NOT NULL,

      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,

      -- Constraints
      CHECK (sort_order >= 0),
      CHECK (topic_count >= 0),
      CHECK (reply_count >= 0),
      CHECK (color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
    );

    -- ========================================
    -- FORUM TOPICS
    -- ========================================
    CREATE TABLE IF NOT EXISTS forum_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,

      -- Content
      title TEXT NOT NULL CHECK(length(title) >= 3 AND length(title) <= 200),
      content TEXT NOT NULL CHECK(length(content) >= 10),

      -- Cached user data (avoid cross-DB joins)
      username TEXT,
      user_display_name TEXT,

      -- Status flags
      status TEXT DEFAULT 'open' NOT NULL CHECK(status IN ('open', 'closed', 'solved')),
      is_pinned INTEGER DEFAULT 0 NOT NULL CHECK(is_pinned IN (0, 1)),
      is_locked INTEGER DEFAULT 0 NOT NULL CHECK(is_locked IN (0, 1)),

      -- Materialized counts
      reply_count INTEGER DEFAULT 0 NOT NULL CHECK(reply_count >= 0),
      view_count INTEGER DEFAULT 0 NOT NULL CHECK(view_count >= 0),
      vote_score INTEGER DEFAULT 0 NOT NULL,

      -- Timestamps
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      last_reply_at DATETIME,
      last_reply_user_id INTEGER,
      last_reply_username TEXT,

      -- Edit tracking
      last_edited_at DATETIME,
      last_edited_by INTEGER,

      -- Moderation
      moderated_at DATETIME,
      moderated_by INTEGER,
      moderation_reason TEXT,

      -- Foreign keys
      FOREIGN KEY (category_id) REFERENCES forum_categories(id) ON DELETE CASCADE
    );

    -- ========================================
    -- FORUM REPLIES
    -- ========================================
    CREATE TABLE IF NOT EXISTS forum_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL,
      parent_id INTEGER,
      user_id INTEGER NOT NULL,

      -- Content
      content TEXT NOT NULL CHECK(length(content) >= 1),

      -- Cached user data
      username TEXT,
      user_display_name TEXT,

      -- Nesting metadata (materialized for performance)
      depth INTEGER DEFAULT 0 NOT NULL CHECK(depth >= 0 AND depth <= 5),
      path TEXT,
      thread_root_id INTEGER,

      -- Status flags
      is_solution INTEGER DEFAULT 0 NOT NULL CHECK(is_solution IN (0, 1)),
      is_deleted INTEGER DEFAULT 0 NOT NULL CHECK(is_deleted IN (0, 1)),

      -- Scoring
      vote_score INTEGER DEFAULT 0 NOT NULL,

      -- Timestamps
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,

      -- Edit tracking
      last_edited_at DATETIME,
      last_edited_by INTEGER,

      -- Foreign keys
      FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES forum_replies(id) ON DELETE CASCADE
    );

    -- ========================================
    -- FORUM TAGS
    -- ========================================
    CREATE TABLE IF NOT EXISTS forum_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT DEFAULT '#64748b',
      usage_count INTEGER DEFAULT 0 NOT NULL CHECK(usage_count >= 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,

      CHECK (color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
    );

    -- ========================================
    -- FORUM TOPIC TAGS (Junction Table)
    -- ========================================
    CREATE TABLE IF NOT EXISTS forum_topic_tags (
      topic_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,

      PRIMARY KEY (topic_id, tag_id),
      FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES forum_tags(id) ON DELETE CASCADE
    );
  `);
}

/**
 * Create FTS5 full-text search table
 */
function createFTS5Table(db) {
  db.exec(`
    -- ========================================
    -- FTS5 FULL-TEXT SEARCH
    -- ========================================
    CREATE VIRTUAL TABLE IF NOT EXISTS forum_search_fts USING fts5(
      -- Indexed columns (searchable)
      title,
      content,
      username,
      category_name,
      tag_names,

      -- Metadata (UNINDEXED - stored but not searchable)
      content_id UNINDEXED,
      content_type UNINDEXED,
      category_id UNINDEXED,
      topic_id UNINDEXED,
      user_id UNINDEXED,
      created_at UNINDEXED,
      vote_score UNINDEXED,
      is_pinned UNINDEXED,
      is_locked UNINDEXED,
      reply_count UNINDEXED,

      -- Configuration
      content='',
      contentless_delete=1,
      tokenize='porter unicode61 remove_diacritics 2'
    );
  `);
}

/**
 * Create strategic indexes for query optimization
 */
function createIndexes(db) {
  db.exec(`
    -- ========================================
    -- CATEGORY INDEXES (2)
    -- ========================================
    CREATE INDEX IF NOT EXISTS idx_categories_section_order
      ON forum_categories(section, sort_order);

    CREATE INDEX IF NOT EXISTS idx_categories_slug
      ON forum_categories(slug);

    -- ========================================
    -- TOPIC INDEXES (5)
    -- ========================================
    CREATE INDEX IF NOT EXISTS idx_topics_category
      ON forum_topics(category_id, is_pinned DESC, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_topics_user
      ON forum_topics(user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_topics_status
      ON forum_topics(status, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_topics_last_reply
      ON forum_topics(last_reply_at DESC);

    CREATE INDEX IF NOT EXISTS idx_topics_category_status
      ON forum_topics(category_id, status, is_pinned DESC, updated_at DESC);

    -- ========================================
    -- REPLY INDEXES (6)
    -- ========================================
    CREATE INDEX IF NOT EXISTS idx_replies_topic
      ON forum_replies(topic_id, parent_id, created_at ASC);

    CREATE INDEX IF NOT EXISTS idx_replies_user
      ON forum_replies(user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_replies_parent
      ON forum_replies(parent_id, created_at ASC);

    CREATE INDEX IF NOT EXISTS idx_replies_path
      ON forum_replies(path);

    CREATE INDEX IF NOT EXISTS idx_replies_thread_root
      ON forum_replies(thread_root_id, created_at ASC);

    CREATE INDEX IF NOT EXISTS idx_replies_solution
      ON forum_replies(topic_id, is_solution DESC, vote_score DESC);

    -- ========================================
    -- TAG INDEXES (2)
    -- ========================================
    CREATE INDEX IF NOT EXISTS idx_tags_slug
      ON forum_tags(slug);

    CREATE INDEX IF NOT EXISTS idx_tags_usage
      ON forum_tags(usage_count DESC);

    -- ========================================
    -- TOPIC-TAG JUNCTION INDEXES (2)
    -- ========================================
    CREATE INDEX IF NOT EXISTS idx_topic_tags_tag
      ON forum_topic_tags(tag_id, topic_id);

    CREATE INDEX IF NOT EXISTS idx_topic_tags_topic
      ON forum_topic_tags(topic_id, tag_id);
  `);
}

/**
 * Create triggers for automatic data maintenance
 */
function createTriggers(db) {
  db.exec(`
    -- ========================================
    -- CATEGORY COUNT TRIGGERS (3)
    -- ========================================

    -- Update topic count on insert
    CREATE TRIGGER IF NOT EXISTS forum_topics_insert_count
    AFTER INSERT ON forum_topics
    BEGIN
      UPDATE forum_categories
      SET topic_count = topic_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.category_id;
    END;

    -- Update topic count on delete
    CREATE TRIGGER IF NOT EXISTS forum_topics_delete_count
    AFTER DELETE ON forum_topics
    BEGIN
      UPDATE forum_categories
      SET topic_count = topic_count - 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = OLD.category_id;
    END;

    -- Update reply count when topic reply_count changes
    CREATE TRIGGER IF NOT EXISTS forum_topics_update_reply_count
    AFTER UPDATE OF reply_count ON forum_topics
    WHEN NEW.reply_count != OLD.reply_count
    BEGIN
      UPDATE forum_categories
      SET reply_count = reply_count + (NEW.reply_count - OLD.reply_count),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.category_id;
    END;

    -- ========================================
    -- TOPIC METADATA TRIGGERS (1)
    -- ========================================

    -- Auto-update timestamp
    CREATE TRIGGER IF NOT EXISTS forum_topics_auto_update
    AFTER UPDATE ON forum_topics
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE forum_topics
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.id;
    END;

    -- ========================================
    -- REPLY METADATA TRIGGERS (4)
    -- ========================================

    -- Update topic on reply insert
    CREATE TRIGGER IF NOT EXISTS forum_replies_insert_update_topic
    AFTER INSERT ON forum_replies
    WHEN NEW.is_deleted = 0
    BEGIN
      UPDATE forum_topics
      SET reply_count = reply_count + 1,
          updated_at = CURRENT_TIMESTAMP,
          last_reply_at = NEW.created_at,
          last_reply_user_id = NEW.user_id,
          last_reply_username = NEW.username
      WHERE id = NEW.topic_id;
    END;

    -- Update topic on reply delete
    CREATE TRIGGER IF NOT EXISTS forum_replies_delete_update_topic
    AFTER DELETE ON forum_replies
    WHEN OLD.is_deleted = 0
    BEGIN
      UPDATE forum_topics
      SET reply_count = reply_count - 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = OLD.topic_id;
    END;

    -- Calculate nesting metadata on insert
    CREATE TRIGGER IF NOT EXISTS forum_replies_calculate_nesting
    AFTER INSERT ON forum_replies
    BEGIN
      UPDATE forum_replies
      SET
        depth = COALESCE((SELECT depth + 1 FROM forum_replies WHERE id = NEW.parent_id), 0),
        path = COALESCE(
          (SELECT path || '.' || NEW.id FROM forum_replies WHERE id = NEW.parent_id),
          CAST(NEW.id AS TEXT)
        ),
        thread_root_id = COALESCE(
          (SELECT COALESCE(thread_root_id, id) FROM forum_replies WHERE id = NEW.parent_id),
          NEW.id
        )
      WHERE id = NEW.id;
    END;

    -- Prevent nesting beyond depth 5
    CREATE TRIGGER IF NOT EXISTS forum_replies_enforce_max_depth
    BEFORE INSERT ON forum_replies
    WHEN NEW.parent_id IS NOT NULL
    BEGIN
      SELECT RAISE(ABORT, 'Maximum reply depth (5) exceeded')
      WHERE (SELECT depth FROM forum_replies WHERE id = NEW.parent_id) >= 5;
    END;

    -- Auto-update timestamp
    CREATE TRIGGER IF NOT EXISTS forum_replies_auto_update
    AFTER UPDATE ON forum_replies
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE forum_replies
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.id;
    END;

    -- Mark topic as solved when reply marked as solution
    CREATE TRIGGER IF NOT EXISTS forum_replies_mark_solution
    AFTER UPDATE OF is_solution ON forum_replies
    WHEN NEW.is_solution = 1 AND OLD.is_solution = 0
    BEGIN
      UPDATE forum_replies
      SET is_solution = 0
      WHERE topic_id = NEW.topic_id AND id != NEW.id AND is_solution = 1;

      UPDATE forum_topics
      SET status = 'solved', updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.topic_id;
    END;

    -- ========================================
    -- TAG COUNT TRIGGERS (2)
    -- ========================================

    -- Increment tag usage on insert
    CREATE TRIGGER IF NOT EXISTS topic_tags_insert_count
    AFTER INSERT ON forum_topic_tags
    BEGIN
      UPDATE forum_tags
      SET usage_count = usage_count + 1
      WHERE id = NEW.tag_id;
    END;

    -- Decrement tag usage on delete
    CREATE TRIGGER IF NOT EXISTS topic_tags_delete_count
    AFTER DELETE ON forum_topic_tags
    BEGIN
      UPDATE forum_tags
      SET usage_count = usage_count - 1
      WHERE id = OLD.tag_id;
    END;

    -- ========================================
    -- FTS5 SYNC TRIGGERS - TOPICS (3)
    -- ========================================

    -- Insert topic into FTS
    CREATE TRIGGER IF NOT EXISTS forum_fts_topic_insert
    AFTER INSERT ON forum_topics
    BEGIN
      INSERT INTO forum_search_fts (
        content_id, content_type, title, content, username, category_name, tag_names,
        category_id, topic_id, user_id, created_at, vote_score, is_pinned, is_locked, reply_count
      )
      SELECT
        NEW.id,
        'topic',
        NEW.title,
        NEW.content,
        NEW.username,
        c.name,
        COALESCE((
          SELECT GROUP_CONCAT(t.name, ', ')
          FROM forum_topic_tags tt
          JOIN forum_tags t ON tt.tag_id = t.id
          WHERE tt.topic_id = NEW.id
        ), ''),
        NEW.category_id,
        NEW.id,
        NEW.user_id,
        NEW.created_at,
        NEW.vote_score,
        NEW.is_pinned,
        NEW.is_locked,
        NEW.reply_count
      FROM forum_categories c
      WHERE c.id = NEW.category_id;
    END;

    -- Update topic in FTS
    CREATE TRIGGER IF NOT EXISTS forum_fts_topic_update
    AFTER UPDATE ON forum_topics
    BEGIN
      DELETE FROM forum_search_fts
      WHERE content_id = OLD.id AND content_type = 'topic';

      INSERT INTO forum_search_fts (
        content_id, content_type, title, content, username, category_name, tag_names,
        category_id, topic_id, user_id, created_at, vote_score, is_pinned, is_locked, reply_count
      )
      SELECT
        NEW.id,
        'topic',
        NEW.title,
        NEW.content,
        NEW.username,
        c.name,
        COALESCE((
          SELECT GROUP_CONCAT(t.name, ', ')
          FROM forum_topic_tags tt
          JOIN forum_tags t ON tt.tag_id = t.id
          WHERE tt.topic_id = NEW.id
        ), ''),
        NEW.category_id,
        NEW.id,
        NEW.user_id,
        NEW.created_at,
        NEW.vote_score,
        NEW.is_pinned,
        NEW.is_locked,
        NEW.reply_count
      FROM forum_categories c
      WHERE c.id = NEW.category_id;
    END;

    -- Delete topic from FTS
    CREATE TRIGGER IF NOT EXISTS forum_fts_topic_delete
    AFTER DELETE ON forum_topics
    BEGIN
      DELETE FROM forum_search_fts
      WHERE content_id = OLD.id AND content_type = 'topic';
    END;

    -- ========================================
    -- FTS5 SYNC TRIGGERS - REPLIES (4)
    -- ========================================

    -- Insert reply into FTS
    CREATE TRIGGER IF NOT EXISTS forum_fts_reply_insert
    AFTER INSERT ON forum_replies
    WHEN NEW.is_deleted = 0
    BEGIN
      INSERT INTO forum_search_fts (
        content_id, content_type, title, content, username, category_name, tag_names,
        category_id, topic_id, user_id, created_at, vote_score, is_pinned, is_locked, reply_count
      )
      SELECT
        NEW.id,
        'reply',
        NULL,
        NEW.content,
        NEW.username,
        c.name,
        COALESCE((
          SELECT GROUP_CONCAT(tg.name, ', ')
          FROM forum_topic_tags tt
          JOIN forum_tags tg ON tt.tag_id = tg.id
          WHERE tt.topic_id = NEW.topic_id
        ), ''),
        t.category_id,
        NEW.topic_id,
        NEW.user_id,
        NEW.created_at,
        NEW.vote_score,
        0,
        t.is_locked,
        0
      FROM forum_topics t
      JOIN forum_categories c ON t.category_id = c.id
      WHERE t.id = NEW.topic_id;
    END;

    -- Update reply in FTS
    CREATE TRIGGER IF NOT EXISTS forum_fts_reply_update
    AFTER UPDATE ON forum_replies
    WHEN NEW.is_deleted = 0
    BEGIN
      DELETE FROM forum_search_fts
      WHERE content_id = OLD.id AND content_type = 'reply';

      INSERT INTO forum_search_fts (
        content_id, content_type, title, content, username, category_name, tag_names,
        category_id, topic_id, user_id, created_at, vote_score, is_pinned, is_locked, reply_count
      )
      SELECT
        NEW.id,
        'reply',
        NULL,
        NEW.content,
        NEW.username,
        c.name,
        COALESCE((
          SELECT GROUP_CONCAT(tg.name, ', ')
          FROM forum_topic_tags tt
          JOIN forum_tags tg ON tt.tag_id = tg.id
          WHERE tt.topic_id = NEW.topic_id
        ), ''),
        t.category_id,
        NEW.topic_id,
        NEW.user_id,
        NEW.created_at,
        NEW.vote_score,
        0,
        t.is_locked,
        0
      FROM forum_topics t
      JOIN forum_categories c ON t.category_id = c.id
      WHERE t.id = NEW.topic_id;
    END;

    -- Delete reply from FTS
    CREATE TRIGGER IF NOT EXISTS forum_fts_reply_delete
    AFTER DELETE ON forum_replies
    BEGIN
      DELETE FROM forum_search_fts
      WHERE content_id = OLD.id AND content_type = 'reply';
    END;

    -- Soft-delete reply from FTS
    CREATE TRIGGER IF NOT EXISTS forum_fts_reply_soft_delete
    AFTER UPDATE OF is_deleted ON forum_replies
    WHEN NEW.is_deleted = 1 AND OLD.is_deleted = 0
    BEGIN
      DELETE FROM forum_search_fts
      WHERE content_id = OLD.id AND content_type = 'reply';
    END;
  `);
}

/**
 * Insert default categories
 */
function insertDefaultCategories(db) {
  const insert = db.prepare(`
    INSERT INTO forum_categories (name, slug, description, color, icon, section, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const category of DEFAULT_CATEGORIES) {
      insert.run(
        category.name,
        category.slug,
        category.description,
        category.color,
        category.icon,
        category.section,
        category.sort_order
      );
    }
  });

  transaction();
}

// Run initialization
if (require.main === module) {
  initializeForumsDatabase();
}

module.exports = { initializeForumsDatabase };
