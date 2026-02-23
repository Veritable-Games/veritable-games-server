#!/usr/bin/env node
/**
 * Migration: Update FTS5 Table for All Status Flags
 *
 * Adds is_solved and is_archived columns to forum_search_fts table
 * and updates triggers to extract these values from the status bit field.
 *
 * Run: node scripts/migrations/update-fts-for-all-status-flags.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database path
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/forums.db');

console.log('🔍 FTS Status Flags Migration');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Database: ${DB_PATH}`);
console.log('');

// Check if database exists
if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ Database not found at: ${DB_PATH}`);
  process.exit(1);
}

// Open database connection
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

try {
  console.log('📊 Current FTS table schema:');
  const currentSchema = db
    .prepare("SELECT sql FROM sqlite_master WHERE name = 'forum_search_fts'")
    .get();
  console.log(currentSchema.sql);
  console.log('');

  // Check if migration is needed
  if (currentSchema.sql.includes('is_solved') && currentSchema.sql.includes('is_archived')) {
    console.log('✅ FTS table already has is_solved and is_archived columns');
    console.log('No migration needed.');
    process.exit(0);
  }

  console.log('🔧 Starting migration...');
  console.log('');

  // Step 1: Drop existing FTS table and triggers
  console.log('Step 1: Dropping existing FTS triggers...');
  db.exec(`
    DROP TRIGGER IF EXISTS forum_fts_topic_insert;
    DROP TRIGGER IF EXISTS forum_fts_topic_update;
    DROP TRIGGER IF EXISTS forum_fts_topic_delete;
    DROP TRIGGER IF EXISTS forum_fts_reply_insert;
    DROP TRIGGER IF EXISTS forum_fts_reply_update;
    DROP TRIGGER IF EXISTS forum_fts_reply_delete;
  `);
  console.log('  ✓ Triggers dropped');

  console.log('Step 2: Dropping existing FTS table...');
  db.exec('DROP TABLE IF EXISTS forum_search_fts;');
  console.log('  ✓ FTS table dropped');

  // Step 2: Recreate FTS table with new columns
  console.log('Step 3: Creating new FTS table with all status columns...');
  db.exec(`
    CREATE VIRTUAL TABLE forum_search_fts USING fts5(
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
      is_solved UNINDEXED,
      is_archived UNINDEXED,
      tokenize='porter unicode61 remove_diacritics 2'
    );
  `);
  console.log('  ✓ FTS table created with 4 status columns');

  // Step 3: Recreate triggers with bit flag extraction
  console.log('Step 4: Creating FTS triggers with bit flag extraction...');

  // Topic INSERT trigger
  db.exec(`
    CREATE TRIGGER forum_fts_topic_insert
    AFTER INSERT ON forum_topics
    BEGIN
      INSERT INTO forum_search_fts (
        content_id, content_type, title, content, author_username,
        category_name, category_id, created_at, vote_score,
        topic_id, is_locked, is_pinned, is_solved, is_archived
      )
      SELECT
        new.id, 'topic', new.title, new.content,
        'unknown',
        c.name, new.category_id, new.created_at, new.vote_score,
        new.id,
        (new.status & 1) > 0 AS is_locked,    -- Bit 0: LOCKED
        (new.status & 2) > 0 AS is_pinned,    -- Bit 1: PINNED
        (new.status & 4) > 0 AS is_solved,    -- Bit 2: SOLVED
        (new.status & 8) > 0 AS is_archived   -- Bit 3: ARCHIVED
      FROM forum_categories c
      WHERE c.id = new.category_id;
    END;
  `);
  console.log('  ✓ Topic INSERT trigger created');

  // Topic UPDATE trigger
  db.exec(`
    CREATE TRIGGER forum_fts_topic_update
    AFTER UPDATE ON forum_topics
    BEGIN
      DELETE FROM forum_search_fts WHERE content_id = old.id AND content_type = 'topic';

      INSERT INTO forum_search_fts (
        content_id, content_type, title, content, author_username,
        category_name, category_id, created_at, vote_score,
        topic_id, is_locked, is_pinned, is_solved, is_archived
      )
      SELECT
        new.id, 'topic', new.title, new.content,
        'unknown',
        c.name, new.category_id, new.created_at, new.vote_score,
        new.id,
        (new.status & 1) > 0 AS is_locked,
        (new.status & 2) > 0 AS is_pinned,
        (new.status & 4) > 0 AS is_solved,
        (new.status & 8) > 0 AS is_archived
      FROM forum_categories c
      WHERE c.id = new.category_id;
    END;
  `);
  console.log('  ✓ Topic UPDATE trigger created');

  // Topic DELETE trigger
  db.exec(`
    CREATE TRIGGER forum_fts_topic_delete
    AFTER DELETE ON forum_topics
    BEGIN
      DELETE FROM forum_search_fts WHERE content_id = old.id AND content_type = 'topic';
    END;
  `);
  console.log('  ✓ Topic DELETE trigger created');

  // Reply INSERT trigger
  db.exec(`
    CREATE TRIGGER forum_fts_reply_insert
    AFTER INSERT ON forum_replies
    BEGIN
      INSERT INTO forum_search_fts (
        content_id, content_type, title, content, author_username,
        category_name, category_id, created_at, vote_score,
        topic_id, is_locked, is_pinned, is_solved, is_archived
      )
      SELECT
        new.id, 'reply', NULL, new.content,
        'unknown',
        c.name, t.category_id, new.created_at, new.vote_score,
        new.topic_id,
        (t.status & 1) > 0 AS is_locked,    -- Inherit from topic
        (t.status & 2) > 0 AS is_pinned,
        (t.status & 4) > 0 AS is_solved,
        (t.status & 8) > 0 AS is_archived
      FROM forum_topics t
      LEFT JOIN forum_categories c ON t.category_id = c.id
      WHERE t.id = new.topic_id;
    END;
  `);
  console.log('  ✓ Reply INSERT trigger created');

  // Reply UPDATE trigger
  db.exec(`
    CREATE TRIGGER forum_fts_reply_update
    AFTER UPDATE ON forum_replies
    BEGIN
      DELETE FROM forum_search_fts WHERE content_id = old.id AND content_type = 'reply';

      INSERT INTO forum_search_fts (
        content_id, content_type, title, content, author_username,
        category_name, category_id, created_at, vote_score,
        topic_id, is_locked, is_pinned, is_solved, is_archived
      )
      SELECT
        new.id, 'reply', NULL, new.content,
        'unknown',
        c.name, t.category_id, new.created_at, new.vote_score,
        new.topic_id,
        (t.status & 1) > 0 AS is_locked,
        (t.status & 2) > 0 AS is_pinned,
        (t.status & 4) > 0 AS is_solved,
        (t.status & 8) > 0 AS is_archived
      FROM forum_topics t
      LEFT JOIN forum_categories c ON t.category_id = c.id
      WHERE t.id = new.topic_id;
    END;
  `);
  console.log('  ✓ Reply UPDATE trigger created');

  // Reply DELETE trigger
  db.exec(`
    CREATE TRIGGER forum_fts_reply_delete
    AFTER DELETE ON forum_replies
    BEGIN
      DELETE FROM forum_search_fts WHERE content_id = old.id AND content_type = 'reply';
    END;
  `);
  console.log('  ✓ Reply DELETE trigger created');

  // Step 4: Rebuild FTS index with existing data
  console.log('Step 5: Rebuilding FTS index with existing topics and replies...');

  const topicsCount = db.prepare('SELECT COUNT(*) as count FROM forum_topics').get().count;
  const repliesCount = db.prepare('SELECT COUNT(*) as count FROM forum_replies').get().count;

  console.log(`  Found ${topicsCount} topics and ${repliesCount} replies`);

  // Populate topics
  db.exec(`
    INSERT INTO forum_search_fts (
      content_id, content_type, title, content, author_username,
      category_name, category_id, created_at, vote_score,
      topic_id, is_locked, is_pinned, is_solved, is_archived
    )
    SELECT
      t.id, 'topic', t.title, t.content,
      'unknown',
      c.name, t.category_id, t.created_at, t.vote_score,
      t.id,
      (t.status & 1) > 0 AS is_locked,
      (t.status & 2) > 0 AS is_pinned,
      (t.status & 4) > 0 AS is_solved,
      (t.status & 8) > 0 AS is_archived
    FROM forum_topics t
    LEFT JOIN forum_categories c ON t.category_id = c.id
    WHERE t.deleted_at IS NULL;
  `);
  console.log(`  ✓ Indexed ${topicsCount} topics`);

  // Populate replies
  db.exec(`
    INSERT INTO forum_search_fts (
      content_id, content_type, title, content, author_username,
      category_name, category_id, created_at, vote_score,
      topic_id, is_locked, is_pinned, is_solved, is_archived
    )
    SELECT
      r.id, 'reply', NULL, r.content,
      'unknown',
      c.name, t.category_id, r.created_at, r.vote_score,
      r.topic_id,
      (t.status & 1) > 0 AS is_locked,
      (t.status & 2) > 0 AS is_pinned,
      (t.status & 4) > 0 AS is_solved,
      (t.status & 8) > 0 AS is_archived
    FROM forum_replies r
    JOIN forum_topics t ON r.topic_id = t.id
    LEFT JOIN forum_categories c ON t.category_id = c.id
    WHERE r.deleted_at IS NULL;
  `);
  console.log(`  ✓ Indexed ${repliesCount} replies`);

  // Verify final state
  console.log('');
  console.log('📊 Verification:');
  const newSchema = db
    .prepare("SELECT sql FROM sqlite_master WHERE name = 'forum_search_fts'")
    .get();
  console.log('New FTS table schema:');
  console.log(newSchema.sql);

  const ftsCount = db.prepare('SELECT COUNT(*) as count FROM forum_search_fts').get().count;
  console.log('');
  console.log(`✅ FTS index contains ${ftsCount} entries`);
  console.log('');

  // Show trigger names
  const triggers = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type = 'trigger' AND (name LIKE 'forum_fts_%')
    ORDER BY name
  `
    )
    .all();

  console.log('Triggers created:');
  triggers.forEach(t => console.log(`  - ${t.name}`));

  console.log('');
  console.log('✅ Migration completed successfully!');
  console.log('');
  console.log('Summary:');
  console.log('  - Added is_solved and is_archived to FTS table');
  console.log('  - Updated all triggers to extract bit flags');
  console.log('  - Rebuilt FTS index with existing data');
  console.log('  - Search now supports all 4 status filters');
} catch (error) {
  console.error('');
  console.error('❌ Migration failed:');
  console.error(error.message);
  console.error('');
  console.error('Stack trace:');
  console.error(error.stack);
  process.exit(1);
} finally {
  db.close();
}
