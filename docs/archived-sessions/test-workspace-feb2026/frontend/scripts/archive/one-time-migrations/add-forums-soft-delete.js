#!/usr/bin/env node

/**
 * Add soft deletion columns to forum tables
 * Fixes "no such column: deleted_at" error
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'forums.db');

console.log('Adding soft deletion columns to forums database...');
console.log('Database path:', dbPath);

try {
  const db = new Database(dbPath, { verbose: console.log });

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Start transaction
  const migrate = db.transaction(() => {
    // Add deleted_at to forum_topics if it doesn't exist
    const topicsColumns = db.prepare('PRAGMA table_info(forum_topics)').all();
    const hasDeletedAt = topicsColumns.some(col => col.name === 'deleted_at');

    if (!hasDeletedAt) {
      console.log('Adding deleted_at column to forum_topics...');
      db.prepare(
        `
        ALTER TABLE forum_topics
        ADD COLUMN deleted_at DATETIME DEFAULT NULL
      `
      ).run();

      console.log('Adding deleted_by column to forum_topics...');
      db.prepare(
        `
        ALTER TABLE forum_topics
        ADD COLUMN deleted_by INTEGER DEFAULT NULL
      `
      ).run();

      console.log('✓ Added soft deletion columns to forum_topics');
    } else {
      console.log('✓ forum_topics already has deleted_at column');
    }

    // Add deleted_at to forum_replies if it doesn't exist
    const repliesColumns = db.prepare('PRAGMA table_info(forum_replies)').all();
    const hasReplyDeletedAt = repliesColumns.some(col => col.name === 'deleted_at');

    if (!hasReplyDeletedAt) {
      console.log('Adding deleted_at column to forum_replies...');
      db.prepare(
        `
        ALTER TABLE forum_replies
        ADD COLUMN deleted_at DATETIME DEFAULT NULL
      `
      ).run();

      console.log('Adding deleted_by column to forum_replies...');
      db.prepare(
        `
        ALTER TABLE forum_replies
        ADD COLUMN deleted_by INTEGER DEFAULT NULL
      `
      ).run();

      // Migrate existing is_deleted flag to deleted_at
      const deletedReplies = db
        .prepare(
          `
        SELECT id FROM forum_replies WHERE is_deleted = 1
      `
        )
        .all();

      if (deletedReplies.length > 0) {
        console.log(`Migrating ${deletedReplies.length} deleted replies...`);
        const updateStmt = db.prepare(`
          UPDATE forum_replies
          SET deleted_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);

        for (const reply of deletedReplies) {
          updateStmt.run(reply.id);
        }
      }

      console.log('✓ Added soft deletion columns to forum_replies');
    } else {
      console.log('✓ forum_replies already has deleted_at column');
    }

    // Create indexes for better query performance
    console.log('Creating indexes for soft deletion queries...');

    // Index for finding non-deleted topics
    try {
      db.prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_forum_topics_deleted
        ON forum_topics(deleted_at)
      `
      ).run();
      console.log('✓ Created index on forum_topics.deleted_at');
    } catch (e) {
      console.log('Index already exists or error:', e.message);
    }

    // Index for finding non-deleted replies
    try {
      db.prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_forum_replies_deleted
        ON forum_replies(deleted_at)
      `
      ).run();
      console.log('✓ Created index on forum_replies.deleted_at');
    } catch (e) {
      console.log('Index already exists or error:', e.message);
    }
  });

  // Execute migration
  migrate();

  // Verify the changes
  console.log('\nVerifying changes...');

  const topicsInfo = db.prepare('PRAGMA table_info(forum_topics)').all();
  const hasTopicsDeletedAt = topicsInfo.some(col => col.name === 'deleted_at');
  console.log(`✓ forum_topics.deleted_at exists: ${hasTopicsDeletedAt}`);

  const repliesInfo = db.prepare('PRAGMA table_info(forum_replies)').all();
  const hasRepliesDeletedAt = repliesInfo.some(col => col.name === 'deleted_at');
  console.log(`✓ forum_replies.deleted_at exists: ${hasRepliesDeletedAt}`);

  // Show current stats
  const stats = {
    total_topics: db.prepare('SELECT COUNT(*) as count FROM forum_topics').get().count,
    deleted_topics: db
      .prepare('SELECT COUNT(*) as count FROM forum_topics WHERE deleted_at IS NOT NULL')
      .get().count,
    total_replies: db.prepare('SELECT COUNT(*) as count FROM forum_replies').get().count,
    deleted_replies: db
      .prepare('SELECT COUNT(*) as count FROM forum_replies WHERE deleted_at IS NOT NULL')
      .get().count,
  };

  console.log('\nDatabase stats:');
  console.log(`  Topics: ${stats.total_topics} total, ${stats.deleted_topics} deleted`);
  console.log(`  Replies: ${stats.total_replies} total, ${stats.deleted_replies} deleted`);

  db.close();
  console.log('\n✅ Migration completed successfully!');
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
