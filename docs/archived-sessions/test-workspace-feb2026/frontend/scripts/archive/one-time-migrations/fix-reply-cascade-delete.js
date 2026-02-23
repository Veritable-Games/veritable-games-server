#!/usr/bin/env node

/**
 * Fix forum_replies foreign key to allow CASCADE delete for nested replies
 * This allows deleting a reply that has child replies
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/forums.db');

console.log('\n🔧 FIXING REPLY CASCADE DELETE\n');
console.log('='.repeat(50));

const db = new Database(DB_PATH);
db.pragma('foreign_keys = OFF');
db.pragma('journal_mode = WAL');

try {
  const transaction = db.transaction(() => {
    console.log('📋 Step 1: Get current forum_replies schema...');
    const currentSchema = db
      .prepare(
        `
      SELECT sql FROM sqlite_master WHERE type='table' AND name='forum_replies'
    `
      )
      .get();

    if (!currentSchema) {
      throw new Error('forum_replies table not found');
    }

    console.log('Current schema:', currentSchema.sql.substring(0, 100) + '...');

    // Count existing replies with children
    const repliesWithChildren = db
      .prepare(
        `
      SELECT COUNT(DISTINCT parent_id) as count
      FROM forum_replies
      WHERE parent_id IS NOT NULL
    `
      )
      .get();

    console.log(`\n📊 Found ${repliesWithChildren.count} replies with child replies`);

    console.log('\n📋 Step 2: Create new table with CASCADE delete...');

    // Create new table with CASCADE on parent_id
    db.exec(`
      CREATE TABLE forum_replies_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        parent_id INTEGER,
        is_solution INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        vote_score INTEGER DEFAULT 0,
        last_edited_at DATETIME,
        last_edited_by INTEGER,
        conversation_id TEXT,
        reply_depth INTEGER DEFAULT 0,
        thread_root_id INTEGER,
        participant_hash TEXT,
        FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (parent_id) REFERENCES forum_replies_new(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ New table created');

    console.log('\n📋 Step 3: Copy all data...');
    const copyResult = db
      .prepare(
        `
      INSERT INTO forum_replies_new (
        id, topic_id, user_id, content, parent_id, is_solution,
        created_at, updated_at, vote_score, last_edited_at, last_edited_by,
        conversation_id, reply_depth, thread_root_id, participant_hash
      )
      SELECT
        id, topic_id, user_id, content, parent_id, is_solution,
        created_at, updated_at, vote_score, last_edited_at, last_edited_by,
        conversation_id, reply_depth, thread_root_id, participant_hash
      FROM forum_replies
    `
      )
      .run();

    console.log(`✅ Copied ${copyResult.changes} replies`);

    console.log('\n📋 Step 4: Drop old table and rename...');
    db.exec('DROP TABLE forum_replies');
    db.exec('ALTER TABLE forum_replies_new RENAME TO forum_replies');
    console.log('✅ Table renamed');

    console.log('\n📋 Step 5: Recreate indexes...');
    db.exec(`
      CREATE INDEX idx_forum_replies_topic ON forum_replies(topic_id);
      CREATE INDEX idx_forum_replies_user ON forum_replies(user_id);
      CREATE INDEX idx_forum_replies_parent ON forum_replies(parent_id);
      CREATE INDEX idx_forum_replies_created ON forum_replies(created_at);
      CREATE INDEX idx_forum_replies_conversation ON forum_replies(conversation_id);
      CREATE INDEX idx_forum_replies_thread_root ON forum_replies(thread_root_id);
    `);
    console.log('✅ Indexes recreated');

    // Verify foreign keys
    console.log('\n📋 Step 6: Verify foreign keys...');
    const fks = db.prepare('PRAGMA foreign_key_list(forum_replies)').all();
    const parentFk = fks.find(fk => fk.from === 'parent_id');

    if (parentFk && parentFk.on_delete === 'CASCADE') {
      console.log('✅ parent_id CASCADE verified');
    } else {
      throw new Error('CASCADE not properly set');
    }
  });

  transaction();

  // Re-enable foreign keys
  db.pragma('foreign_keys = ON');

  // Verify integrity
  console.log('\n📋 Step 7: Verify database integrity...');
  const integrityCheck = db.pragma('integrity_check');
  if (integrityCheck[0].integrity_check === 'ok') {
    console.log('✅ Database integrity check passed');
  } else {
    console.error('❌ Integrity check failed:', integrityCheck);
    throw new Error('Database integrity check failed');
  }

  // Final count
  const finalCount = db.prepare('SELECT COUNT(*) as count FROM forum_replies').get();
  console.log(`\n📊 Final reply count: ${finalCount.count}`);

  console.log('\n' + '='.repeat(50));
  console.log('✅ CASCADE DELETE FIX COMPLETE!\n');
  console.log('Replies can now be deleted even if they have child replies.');
  console.log('Child replies will be automatically deleted (CASCADE).\n');
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
} finally {
  db.close();
}
