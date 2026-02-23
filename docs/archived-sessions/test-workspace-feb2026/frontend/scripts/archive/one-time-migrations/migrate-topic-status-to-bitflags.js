/**
 * Database Migration: Convert Topic Status to Bit Flags
 *
 * This script migrates the forum_topics table from using separate boolean columns
 * (is_locked, is_pinned, is_solved) to a single INTEGER status column with bit flags.
 *
 * ⚠️  CRITICAL: This migration is IRREVERSIBLE without a backup!
 *
 * What this script does:
 * 1. Creates a backup of forum_topics table
 * 2. Adds new status_flags INTEGER column
 * 3. Converts existing boolean values to bit flags
 * 4. Verifies data integrity
 * 5. Drops old boolean columns
 * 6. Renames status_flags to status
 * 7. Creates index on status column for performance
 *
 * Usage:
 *   npm run migrate:status-flags
 *   or
 *   npm run migrate:status-flags --dry-run  (test without applying changes)
 *   npm run migrate:status-flags --rollback (restore from backup)
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'forums.db');
const BACKUP_PATH = path.join(process.cwd(), 'data', 'forums_backup_before_bitflags.db');

// Bit flag constants
const TopicStatusFlags = {
  LOCKED: 1, // 0001
  PINNED: 2, // 0010
  SOLVED: 4, // 0100
  ARCHIVED: 8, // 1000
  DELETED: 16, // 10000
  FEATURED: 32, // 100000
};

/**
 * Convert boolean values to bit flags
 */
function fromBooleans(is_locked = false, is_pinned = false, is_solved = false) {
  let status = 0;
  if (is_locked) status |= TopicStatusFlags.LOCKED;
  if (is_pinned) status |= TopicStatusFlags.PINNED;
  if (is_solved) status |= TopicStatusFlags.SOLVED;
  return status;
}

/**
 * Check if status has a specific flag
 */
function hasFlag(status, flag) {
  return (status & flag) !== 0;
}

/**
 * Validate status integer
 */
function isValidStatus(status) {
  const maxValid = Object.values(TopicStatusFlags).reduce((acc, val) => acc | val, 0);
  return (status & ~maxValid) === 0 && status >= 0;
}

/**
 * Create a backup of the database
 */
function createBackup() {
  console.log('\n📦 Creating database backup...');

  // Copy database file
  fs.copyFileSync(DB_PATH, BACKUP_PATH);

  console.log(`✅ Backup created: ${BACKUP_PATH}`);
  console.log(`   Size: ${(fs.statSync(BACKUP_PATH).size / 1024).toFixed(2)} KB`);
}

/**
 * Verify backup can be restored
 */
function verifyBackup() {
  if (!fs.existsSync(BACKUP_PATH)) {
    console.error('❌ Backup file not found!');
    return false;
  }

  try {
    const backupDb = new Database(BACKUP_PATH, { readonly: true });
    const count = backupDb.prepare('SELECT COUNT(*) as count FROM forum_topics').get();
    backupDb.close();

    console.log(`✅ Backup verified: ${count.count} topics backed up`);
    return true;
  } catch (error) {
    console.error('❌ Backup verification failed:', error);
    return false;
  }
}

/**
 * Add new status_flags column (temporary during migration)
 */
function addStatusFlagsColumn(db) {
  console.log('\n📝 Adding status_flags column...');

  // Check if column already exists
  const columns = db.prepare('PRAGMA table_info(forum_topics)').all();
  const hasStatusFlags = columns.some(col => col.name === 'status_flags');

  if (hasStatusFlags) {
    console.log('   Column already exists, skipping...');
    return;
  }

  db.prepare(
    `
    ALTER TABLE forum_topics
    ADD COLUMN status_flags INTEGER DEFAULT 0 NOT NULL
  `
  ).run();

  console.log('✅ Column added');
}

/**
 * Convert boolean values to bit flags
 */
function convertToFlags(db) {
  console.log('\n🔄 Converting boolean values to bit flags...');

  // Check if boolean columns still exist
  const columns = db.prepare('PRAGMA table_info(forum_topics)').all();
  const hasLocked = columns.some(col => col.name === 'is_locked');
  const hasPinned = columns.some(col => col.name === 'is_pinned');
  const hasSolved = columns.some(col => col.name === 'is_solved');

  if (!hasLocked || !hasPinned || !hasSolved) {
    console.log('   Boolean columns already removed, skipping conversion...');
    const count = db.prepare('SELECT COUNT(*) as count FROM forum_topics').get();
    return { converted: count.count, errors: 0 };
  }

  const topics = db
    .prepare(
      `
    SELECT id, is_locked, is_pinned, is_solved
    FROM forum_topics
  `
    )
    .all();

  console.log(`   Found ${topics.length} topics to convert`);

  let converted = 0;
  let errors = 0;

  for (const topic of topics) {
    try {
      const statusFlags = fromBooleans(
        Boolean(topic.is_locked),
        Boolean(topic.is_pinned),
        Boolean(topic.is_solved)
      );

      db.prepare(
        `
        UPDATE forum_topics
        SET status_flags = ?
        WHERE id = ?
      `
      ).run(statusFlags, topic.id);

      converted++;

      if (converted % 100 === 0) {
        console.log(`   Progress: ${converted}/${topics.length}`);
      }
    } catch (error) {
      console.error(`   ❌ Error converting topic ${topic.id}:`, error);
      errors++;
    }
  }

  console.log(`✅ Converted ${converted} topics (${errors} errors)`);
  return { converted, errors };
}

/**
 * Verify data integrity after conversion
 */
function verifyConversion(db) {
  console.log('\n🔍 Verifying data integrity...');

  // Check if boolean columns still exist
  const columns = db.prepare('PRAGMA table_info(forum_topics)').all();
  const hasLocked = columns.some(col => col.name === 'is_locked');

  if (!hasLocked) {
    // Boolean columns already removed, verify status_flags are valid
    console.log('   Verifying status_flags values...');
    const topics = db.prepare('SELECT id, status_flags FROM forum_topics').all();

    let errors = 0;
    for (const topic of topics) {
      if (!isValidStatus(topic.status_flags)) {
        console.error(`   ❌ Invalid status for topic ${topic.id}: ${topic.status_flags}`);
        errors++;
      }
    }

    if (errors === 0) {
      console.log(`✅ All ${topics.length} topics have valid status flags`);
      return true;
    } else {
      console.error(`❌ Found ${errors} integrity errors`);
      return false;
    }
  }

  // Boolean columns exist, verify conversion matches
  const topics = db
    .prepare(
      `
    SELECT id, is_locked, is_pinned, is_solved, status_flags
    FROM forum_topics
  `
    )
    .all();

  let errors = 0;

  for (const topic of topics) {
    const expected = fromBooleans(
      Boolean(topic.is_locked),
      Boolean(topic.is_pinned),
      Boolean(topic.is_solved)
    );

    if (topic.status_flags !== expected) {
      console.error(`   ❌ Mismatch for topic ${topic.id}:`);
      console.error(`      Expected: ${expected}, Got: ${topic.status_flags}`);
      errors++;
    }

    if (!isValidStatus(topic.status_flags)) {
      console.error(`   ❌ Invalid status for topic ${topic.id}: ${topic.status_flags}`);
      errors++;
    }
  }

  if (errors === 0) {
    console.log(`✅ All ${topics.length} topics verified successfully`);
    return true;
  } else {
    console.error(`❌ Found ${errors} integrity errors`);
    return false;
  }
}

/**
 * Drop triggers before schema changes
 * Drops ALL triggers that reference forum_topics (not just those on the table)
 */
function dropTriggers(db) {
  console.log('\n🔧 Dropping all triggers that reference forum_topics...');

  // Get ALL triggers that mention forum_topics in their SQL
  const triggers = db
    .prepare(
      `
    SELECT name, tbl_name FROM sqlite_master
    WHERE type='trigger' AND (
      tbl_name='forum_topics' OR
      sql LIKE '%forum_topics%'
    )
  `
    )
    .all();

  for (const trigger of triggers) {
    db.prepare(`DROP TRIGGER IF EXISTS ${trigger.name}`).run();
    console.log(`   Dropped trigger: ${trigger.name} (on ${trigger.tbl_name})`);
  }

  console.log(`✅ Dropped ${triggers.length} triggers`);
}

/**
 * Recreate triggers with new schema (using status bit flags)
 */
function recreateTriggers(db) {
  console.log('\n🔧 Recreating triggers...');

  // Insert trigger - uses status bit flags
  db.prepare(
    `
    CREATE TRIGGER forum_fts_topic_insert
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
        new.id,
        (new.status & 1) > 0 AS is_locked,
        (new.status & 2) > 0 AS is_pinned
      FROM forum_categories c
      WHERE c.id = new.category_id;
    END
  `
  ).run();

  // Update trigger - uses status bit flags
  db.prepare(
    `
    CREATE TRIGGER forum_fts_topic_update
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
        new.id,
        (new.status & 1) > 0 AS is_locked,
        (new.status & 2) > 0 AS is_pinned
      FROM forum_categories c
      WHERE c.id = new.category_id;
    END
  `
  ).run();

  // Delete trigger - no changes needed
  db.prepare(
    `
    CREATE TRIGGER forum_fts_topic_delete
    AFTER DELETE ON forum_topics
    BEGIN
      DELETE FROM forum_search_fts WHERE content_id = old.id AND content_type = 'topic';
    END
  `
  ).run();

  // Reply insert trigger - references forum_topics
  db.prepare(
    `
    CREATE TRIGGER forum_fts_reply_insert
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
    END
  `
  ).run();

  // Reply update trigger - references forum_topics
  db.prepare(
    `
    CREATE TRIGGER forum_fts_reply_update
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
    END
  `
  ).run();

  // Reply delete trigger - drop if exists first
  db.prepare('DROP TRIGGER IF EXISTS forum_fts_reply_delete').run();
  db.prepare(
    `
    CREATE TRIGGER forum_fts_reply_delete
    AFTER DELETE ON forum_replies
    BEGIN
      DELETE FROM forum_search_fts WHERE content_id = old.id AND content_type = 'reply';
    END
  `
  ).run();

  console.log('✅ Recreated 6 triggers');
}

/**
 * Drop old boolean columns
 */
function dropOldColumns(db) {
  console.log('\n🗑️  Removing old boolean columns...');

  // SQLite doesn't support DROP COLUMN directly, need to recreate table
  db.prepare('BEGIN TRANSACTION').run();

  try {
    // Create new table schema without boolean columns
    db.prepare(
      `
      CREATE TABLE forum_topics_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        user_id INTEGER,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        content_format TEXT DEFAULT 'markdown',
        status_flags INTEGER DEFAULT 0 NOT NULL,
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
      )
    `
    ).run();

    // Copy data to new table
    db.prepare(
      `
      INSERT INTO forum_topics_new
      SELECT
        id, category_id, user_id, title, content, content_format,
        status_flags, vote_score, reply_count, view_count,
        created_at, updated_at, last_activity_at,
        deleted_at, deleted_by, last_edited_at, last_edited_by
      FROM forum_topics
    `
    ).run();

    // Drop old table
    db.prepare('DROP TABLE forum_topics').run();

    // Rename new table
    db.prepare('ALTER TABLE forum_topics_new RENAME TO forum_topics').run();

    db.prepare('COMMIT').run();
    console.log('✅ Old columns removed');
  } catch (error) {
    db.prepare('ROLLBACK').run();
    throw error;
  }
}

/**
 * Rename status_flags to status
 */
function renameColumn(db) {
  console.log('\n✏️  Renaming status_flags to status...');

  // SQLite doesn't support RENAME COLUMN in older versions, recreate table
  db.prepare('BEGIN TRANSACTION').run();

  try {
    db.prepare(
      `
      CREATE TABLE forum_topics_final (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        user_id INTEGER,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        content_format TEXT DEFAULT 'markdown',
        status INTEGER DEFAULT 0 NOT NULL,
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
      )
    `
    ).run();

    db.prepare(
      `
      INSERT INTO forum_topics_final SELECT * FROM forum_topics
    `
    ).run();

    db.prepare('DROP TABLE forum_topics').run();
    db.prepare('ALTER TABLE forum_topics_final RENAME TO forum_topics').run();

    db.prepare('COMMIT').run();
    console.log('✅ Column renamed to status');
  } catch (error) {
    db.prepare('ROLLBACK').run();
    throw error;
  }
}

/**
 * Create index on status column for performance
 */
function createIndex(db) {
  console.log('\n📊 Creating index on status column...');

  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_forum_topics_status
    ON forum_topics(status)
  `
  ).run();

  console.log('✅ Index created');
}

/**
 * Rollback migration from backup
 */
function rollback() {
  console.log('\n⏮️  Rolling back migration...');

  if (!fs.existsSync(BACKUP_PATH)) {
    console.error('❌ No backup found! Cannot rollback.');
    process.exit(1);
  }

  fs.copyFileSync(BACKUP_PATH, DB_PATH);
  console.log('✅ Database restored from backup');
  console.log(`   Backup preserved at: ${BACKUP_PATH}`);
}

/**
 * Main migration function
 */
async function migrate(dryRun = false) {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   FORUM TOPICS STATUS MIGRATION TO BIT FLAGS              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  if (dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be applied\n');
  }

  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH);

  try {
    // Step 1: Create backup
    if (!dryRun) {
      createBackup();
      verifyBackup();
    }

    // Step 2: Add new column
    if (!dryRun) {
      addStatusFlagsColumn(db);
    }

    // Step 3: Convert values
    const { converted, errors } = convertToFlags(db);

    if (errors > 0) {
      console.error('\n❌ Conversion errors detected. Aborting migration.');
      if (!dryRun) {
        console.log('   Rolling back...');
        db.close();
        rollback();
      }
      process.exit(1);
    }

    // Step 4: Verify integrity
    const verified = verifyConversion(db);

    if (!verified) {
      console.error('\n❌ Data integrity check failed. Aborting migration.');
      if (!dryRun) {
        console.log('   Rolling back...');
        db.close();
        rollback();
      }
      process.exit(1);
    }

    if (dryRun) {
      console.log('\n✅ Dry run completed successfully');
      console.log('   Run without --dry-run to apply changes');
      db.close();
      return;
    }

    // Step 5: Drop triggers (they reference old columns)
    dropTriggers(db);

    // Step 6: Drop old columns
    dropOldColumns(db);

    // Step 7: Rename column
    renameColumn(db);

    // Step 8: Recreate triggers (with new schema)
    recreateTriggers(db);

    // Step 9: Create index
    createIndex(db);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   ✅ MIGRATION COMPLETED SUCCESSFULLY                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n   Topics migrated: ${converted}`);
    console.log(`   Backup location: ${BACKUP_PATH}`);
    console.log('\n   To rollback: npm run migrate:status-flags --rollback');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    if (!dryRun) {
      console.log('   Attempting rollback...');
      db.close();
      rollback();
    }
    process.exit(1);
  } finally {
    db.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isRollback = args.includes('--rollback');

if (isRollback) {
  rollback();
  process.exit(0);
}

// Run migration
migrate(isDryRun).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
