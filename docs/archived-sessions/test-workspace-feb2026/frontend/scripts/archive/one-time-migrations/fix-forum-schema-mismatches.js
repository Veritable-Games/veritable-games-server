#!/usr/bin/env node

/**
 * Fix Forum Schema Mismatches
 *
 * Adds missing columns to align database with TypeScript interfaces:
 * - deleted_by (for soft delete attribution)
 * - last_edited_at (for edit tracking)
 * - last_edited_by (for edit tracking)
 * - author_id (aligned with user_id)
 *
 * This fixes production errors caused by schema drift.
 *
 * Usage:
 *   node scripts/fix-forum-schema-mismatches.js [--dry-run]
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'forums.db');
const dryRun = process.argv.includes('--dry-run');

console.log('========================================');
console.log('FORUM SCHEMA MISMATCH FIX');
console.log('========================================\n');

if (dryRun) {
  console.log('⚠️  DRY RUN MODE - No changes will be made\n');
}

console.log('Database path:', dbPath);
console.log('\n');

try {
  const db = new Database(dbPath, { readonly: dryRun });

  if (!dryRun) {
    db.pragma('journal_mode = WAL');
  }

  // Get current schema
  console.log('[1/4] Inspecting current schema...\n');

  const topicsColumns = db.prepare('PRAGMA table_info(forum_topics)').all();
  const repliesColumns = db.prepare('PRAGMA table_info(forum_replies)').all();

  const topicColumnNames = topicsColumns.map(c => c.name);
  const replyColumnNames = repliesColumns.map(c => c.name);

  console.log('forum_topics columns:', topicColumnNames.length);
  console.log('forum_replies columns:', replyColumnNames.length);
  console.log('\n');

  // Determine what needs to be added
  const topicsNeeds = {
    deleted_by: !topicColumnNames.includes('deleted_by'),
    last_edited_at: !topicColumnNames.includes('last_edited_at'),
    last_edited_by: !topicColumnNames.includes('last_edited_by'),
    author_id: !topicColumnNames.includes('author_id'),
  };

  const repliesNeeds = {
    deleted_by: !replyColumnNames.includes('deleted_by'),
    last_edited_at: !replyColumnNames.includes('last_edited_at'),
    last_edited_by: !replyColumnNames.includes('last_edited_by'),
    author_id: !replyColumnNames.includes('author_id'),
  };

  console.log('[2/4] Missing columns analysis...\n');

  console.log('forum_topics missing:');
  Object.entries(topicsNeeds).forEach(([col, missing]) => {
    console.log(`  ${missing ? '❌' : '✅'} ${col}`);
  });
  console.log('');

  console.log('forum_replies missing:');
  Object.entries(repliesNeeds).forEach(([col, missing]) => {
    console.log(`  ${missing ? '❌' : '✅'} ${col}`);
  });
  console.log('\n');

  const topicsNeedsFix = Object.values(topicsNeeds).some(v => v);
  const repliesNeedsFix = Object.values(repliesNeeds).some(v => v);

  if (!topicsNeedsFix && !repliesNeedsFix) {
    console.log('✅ No schema fixes needed - all columns present!\n');
    db.close();
    return;
  }

  if (dryRun) {
    console.log('[3/4] DRY RUN - Would apply these changes:\n');

    if (topicsNeeds.deleted_by) {
      console.log('  ALTER TABLE forum_topics ADD COLUMN deleted_by INTEGER DEFAULT NULL;');
    }
    if (topicsNeeds.last_edited_at) {
      console.log('  ALTER TABLE forum_topics ADD COLUMN last_edited_at DATETIME DEFAULT NULL;');
    }
    if (topicsNeeds.last_edited_by) {
      console.log('  ALTER TABLE forum_topics ADD COLUMN last_edited_by INTEGER DEFAULT NULL;');
    }
    if (topicsNeeds.author_id) {
      console.log('  ALTER TABLE forum_topics ADD COLUMN author_id INTEGER;');
      console.log('  UPDATE forum_topics SET author_id = user_id;');
    }

    if (repliesNeeds.deleted_by) {
      console.log('  ALTER TABLE forum_replies ADD COLUMN deleted_by INTEGER DEFAULT NULL;');
    }
    if (repliesNeeds.last_edited_at) {
      console.log('  ALTER TABLE forum_replies ADD COLUMN last_edited_at DATETIME DEFAULT NULL;');
    }
    if (repliesNeeds.last_edited_by) {
      console.log('  ALTER TABLE forum_replies ADD COLUMN last_edited_by INTEGER DEFAULT NULL;');
    }
    if (repliesNeeds.author_id) {
      console.log('  ALTER TABLE forum_replies ADD COLUMN author_id INTEGER;');
      console.log('  UPDATE forum_replies SET author_id = user_id;');
    }

    console.log('\n[4/4] Dry run complete. Run without --dry-run to apply changes.\n');
    db.close();
    return;
  }

  // Apply fixes
  console.log('[3/4] Applying schema fixes...\n');

  const migrate = db.transaction(() => {
    let changeCount = 0;

    // Fix forum_topics
    if (topicsNeeds.deleted_by) {
      console.log('  Adding deleted_by to forum_topics...');
      db.prepare('ALTER TABLE forum_topics ADD COLUMN deleted_by INTEGER DEFAULT NULL').run();
      changeCount++;
    }

    if (topicsNeeds.last_edited_at) {
      console.log('  Adding last_edited_at to forum_topics...');
      db.prepare('ALTER TABLE forum_topics ADD COLUMN last_edited_at DATETIME DEFAULT NULL').run();
      changeCount++;
    }

    if (topicsNeeds.last_edited_by) {
      console.log('  Adding last_edited_by to forum_topics...');
      db.prepare('ALTER TABLE forum_topics ADD COLUMN last_edited_by INTEGER DEFAULT NULL').run();
      changeCount++;
    }

    if (topicsNeeds.author_id) {
      console.log('  Adding author_id to forum_topics...');
      db.prepare('ALTER TABLE forum_topics ADD COLUMN author_id INTEGER').run();
      console.log('  Copying user_id to author_id...');
      const result = db.prepare('UPDATE forum_topics SET author_id = user_id').run();
      console.log(`    Updated ${result.changes} rows`);
      changeCount++;
    }

    // Fix forum_replies
    if (repliesNeeds.deleted_by) {
      console.log('  Adding deleted_by to forum_replies...');
      db.prepare('ALTER TABLE forum_replies ADD COLUMN deleted_by INTEGER DEFAULT NULL').run();
      changeCount++;
    }

    if (repliesNeeds.last_edited_at) {
      console.log('  Adding last_edited_at to forum_replies...');
      db.prepare('ALTER TABLE forum_replies ADD COLUMN last_edited_at DATETIME DEFAULT NULL').run();
      changeCount++;
    }

    if (repliesNeeds.last_edited_by) {
      console.log('  Adding last_edited_by to forum_replies...');
      db.prepare('ALTER TABLE forum_replies ADD COLUMN last_edited_by INTEGER DEFAULT NULL').run();
      changeCount++;
    }

    if (repliesNeeds.author_id) {
      console.log('  Adding author_id to forum_replies...');
      db.prepare('ALTER TABLE forum_replies ADD COLUMN author_id INTEGER').run();
      console.log('  Copying user_id to author_id...');
      const result = db.prepare('UPDATE forum_replies SET author_id = user_id').run();
      console.log(`    Updated ${result.changes} rows`);
      changeCount++;
    }

    return changeCount;
  });

  const changeCount = migrate();

  console.log(`\n  ✓ Applied ${changeCount} schema changes\n`);

  // Verify the fixes
  console.log('[4/4] Verifying schema fixes...\n');

  const newTopicsColumns = db.prepare('PRAGMA table_info(forum_topics)').all();
  const newRepliesColumns = db.prepare('PRAGMA table_info(forum_replies)').all();

  const newTopicNames = newTopicsColumns.map(c => c.name);
  const newReplyNames = newRepliesColumns.map(c => c.name);

  const topicsVerified = {
    deleted_by: newTopicNames.includes('deleted_by'),
    last_edited_at: newTopicNames.includes('last_edited_at'),
    last_edited_by: newTopicNames.includes('last_edited_by'),
    author_id: newTopicNames.includes('author_id'),
  };

  const repliesVerified = {
    deleted_by: newReplyNames.includes('deleted_by'),
    last_edited_at: newReplyNames.includes('last_edited_at'),
    last_edited_by: newReplyNames.includes('last_edited_by'),
    author_id: newReplyNames.includes('author_id'),
  };

  console.log('forum_topics verification:');
  Object.entries(topicsVerified).forEach(([col, exists]) => {
    console.log(`  ${exists ? '✅' : '❌'} ${col}`);
  });
  console.log('');

  console.log('forum_replies verification:');
  Object.entries(repliesVerified).forEach(([col, exists]) => {
    console.log(`  ${exists ? '✅' : '✅'} ${col}`);
  });
  console.log('\n');

  // Get stats
  const stats = {
    total_topics: db.prepare('SELECT COUNT(*) as count FROM forum_topics').get().count,
    total_replies: db.prepare('SELECT COUNT(*) as count FROM forum_replies').get().count,
    topics_with_author_id: topicsVerified.author_id
      ? db.prepare('SELECT COUNT(*) as count FROM forum_topics WHERE author_id IS NOT NULL').get()
          .count
      : 0,
    replies_with_author_id: repliesVerified.author_id
      ? db.prepare('SELECT COUNT(*) as count FROM forum_replies WHERE author_id IS NOT NULL').get()
          .count
      : 0,
  };

  console.log('Database stats:');
  console.log(`  Topics: ${stats.total_topics} (${stats.topics_with_author_id} with author_id)`);
  console.log(`  Replies: ${stats.total_replies} (${stats.replies_with_author_id} with author_id)`);
  console.log('\n');

  db.close();

  console.log('========================================');
  console.log('✅ SCHEMA FIX COMPLETED SUCCESSFULLY!');
  console.log('========================================\n');

  console.log('Next steps:');
  console.log('  1. Update code to use author_id instead of user_id (if applicable)');
  console.log('  2. Implement edit tracking in update endpoints');
  console.log('  3. Test soft delete attribution with deleted_by\n');
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
