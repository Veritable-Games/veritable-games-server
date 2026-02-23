#!/usr/bin/env node

/**
 * Remove Soft Delete Implementation
 *
 * This script:
 * 1. Permanently deletes all soft-deleted content
 * 2. Removes soft delete columns from database schema
 * 3. Rebuilds indexes without soft delete filters
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'forums.db');

console.log('\n🗑️  REMOVING SOFT DELETE IMPLEMENTATION\n');
console.log('='.repeat(50));

const db = new Database(DB_PATH);

// Disable foreign keys for table recreation, enable WAL mode
db.pragma('foreign_keys = OFF');
db.pragma('journal_mode = WAL');

try {
  // Start transaction
  const transaction = db.transaction(() => {
    console.log('\n📊 Analyzing current soft-deleted content...\n');

    // Count soft-deleted replies
    const deletedReplies = db
      .prepare('SELECT COUNT(*) as count FROM forum_replies WHERE is_deleted = 1')
      .get();
    console.log(`   Soft-deleted replies: ${deletedReplies.count}`);

    // Count soft-deleted topics
    const deletedTopics = db
      .prepare('SELECT COUNT(*) as count FROM forum_topics WHERE is_deleted = 1')
      .get();
    console.log(`   Soft-deleted topics: ${deletedTopics.count}`);

    // Count total content
    const totalReplies = db.prepare('SELECT COUNT(*) as count FROM forum_replies').get();
    const totalTopics = db.prepare('SELECT COUNT(*) as count FROM forum_topics').get();
    console.log(`   Total replies: ${totalReplies.count}`);
    console.log(`   Total topics: ${totalTopics.count}`);

    console.log('\n🧹 Step 1: Permanently deleting soft-deleted content...\n');

    // Permanently delete soft-deleted replies
    const deleteRepliesResult = db.prepare('DELETE FROM forum_replies WHERE is_deleted = 1').run();
    console.log(`   ✅ Deleted ${deleteRepliesResult.changes} soft-deleted replies`);

    // Permanently delete soft-deleted topics
    const deleteTopicsResult = db.prepare('DELETE FROM forum_topics WHERE is_deleted = 1').run();
    console.log(`   ✅ Deleted ${deleteTopicsResult.changes} soft-deleted topics`);

    console.log('\n🔧 Step 2: Removing soft delete columns...\n');

    // SQLite doesn't support DROP COLUMN, so we need to recreate tables
    // We'll create new tables, copy data, drop old tables, rename new tables

    // ===== forum_replies =====
    console.log('   Processing forum_replies...');

    db.exec(`
      CREATE TABLE forum_replies_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        is_solution BOOLEAN DEFAULT 0,
        parent_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        vote_score INTEGER DEFAULT 0,
        last_edited_at DATETIME,
        last_edited_by INTEGER,
        conversation_id TEXT,
        reply_depth INTEGER,
        thread_root_id INTEGER,
        participant_hash TEXT,
        FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (parent_id) REFERENCES forum_replies(id)
      )
    `);

    db.exec(`
      INSERT INTO forum_replies_new (
        id, topic_id, user_id, content, is_solution, parent_id,
        created_at, updated_at, vote_score, last_edited_at, last_edited_by,
        conversation_id, reply_depth, thread_root_id, participant_hash
      )
      SELECT
        id, topic_id, user_id, content, is_solution, parent_id,
        created_at, updated_at, vote_score, last_edited_at, last_edited_by,
        conversation_id, reply_depth, thread_root_id, participant_hash
      FROM forum_replies
    `);

    db.exec('DROP TABLE forum_replies');
    db.exec('ALTER TABLE forum_replies_new RENAME TO forum_replies');

    console.log('   ✅ Removed soft delete columns from forum_replies');

    // ===== forum_topics =====
    console.log('   Processing forum_topics...');

    db.exec(`
      CREATE TABLE forum_topics_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        is_pinned BOOLEAN DEFAULT 0,
        is_locked BOOLEAN DEFAULT 0,
        is_solved BOOLEAN DEFAULT 0,
        reply_count INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'open',
        vote_score INTEGER DEFAULT 0,
        last_edited_at DATETIME,
        last_edited_by INTEGER,
        moderated_by INTEGER,
        moderated_at TEXT,
        FOREIGN KEY (category_id) REFERENCES forum_categories(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    db.exec(`
      INSERT INTO forum_topics_new (
        id, title, content, category_id, user_id, is_pinned, is_locked,
        is_solved, reply_count, view_count, created_at, updated_at,
        status, vote_score, last_edited_at, last_edited_by,
        moderated_by, moderated_at
      )
      SELECT
        id, title, content, category_id, user_id, is_pinned, is_locked,
        is_solved, reply_count, view_count, created_at, updated_at,
        status, vote_score, last_edited_at, last_edited_by,
        moderated_by, moderated_at
      FROM forum_topics
    `);

    db.exec('DROP TABLE forum_topics');
    db.exec('ALTER TABLE forum_topics_new RENAME TO forum_topics');

    console.log('   ✅ Removed soft delete columns from forum_topics');

    console.log('\n🔍 Step 3: Rebuilding indexes...\n');

    // Recreate essential indexes without soft delete filters
    db.exec(`
      -- Topics indexes
      CREATE INDEX idx_forum_topics_category ON forum_topics(category_id, updated_at DESC);
      CREATE INDEX idx_forum_topics_user ON forum_topics(user_id, created_at DESC);
      CREATE INDEX idx_forum_topics_updated ON forum_topics(updated_at DESC);
      CREATE INDEX idx_forum_topics_created ON forum_topics(created_at DESC);

      -- Replies indexes
      CREATE INDEX idx_forum_replies_topic ON forum_replies(topic_id, created_at ASC);
      CREATE INDEX idx_forum_replies_user ON forum_replies(user_id, created_at DESC);
      CREATE INDEX idx_forum_replies_parent ON forum_replies(parent_id, created_at ASC) WHERE parent_id IS NOT NULL;
      CREATE INDEX idx_forum_replies_conversation ON forum_replies(conversation_id);
    `);

    console.log('   ✅ Rebuilt all indexes');

    console.log('\n🔐 Step 4: Re-enabling foreign keys...\n');

    db.pragma('foreign_keys = ON');
    console.log('   ✅ Foreign keys re-enabled');

    console.log('\n📈 Step 5: Final statistics...\n');

    const finalReplies = db.prepare('SELECT COUNT(*) as count FROM forum_replies').get();
    const finalTopics = db.prepare('SELECT COUNT(*) as count FROM forum_topics').get();

    console.log(`   Active replies: ${finalReplies.count} (was ${totalReplies.count})`);
    console.log(`   Active topics: ${finalTopics.count} (was ${totalTopics.count})`);
    console.log(`   Space freed: ${deletedReplies.count + deletedTopics.count} records removed`);
  });

  // Execute transaction
  transaction();

  console.log('\n✅ Soft delete implementation removed successfully!');
  console.log('\n' + '='.repeat(50) + '\n');
} catch (error) {
  console.error('\n❌ Error removing soft delete:', error);
  process.exit(1);
} finally {
  db.close();
}
