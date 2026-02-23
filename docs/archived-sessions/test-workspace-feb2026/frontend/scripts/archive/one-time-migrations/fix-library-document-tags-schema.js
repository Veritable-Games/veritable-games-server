#!/usr/bin/env node

/**
 * Migration: Fix library_document_tags schema
 *
 * Adds missing columns:
 * - added_by INTEGER (user who added the tag)
 * - added_at DATETIME (when the tag was added)
 *
 * Since the table currently has zero data, we can safely recreate it.
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'library.db');

console.log('📦 Library Document Tags Schema Migration');
console.log('==========================================\n');

try {
  const db = new Database(DB_PATH);

  console.log('🔍 Checking current schema...');

  // Check if table exists and get current structure
  const tableInfo = db.prepare(`PRAGMA table_info(library_document_tags)`).all();

  if (tableInfo.length === 0) {
    console.log(
      '⚠️  Table does not exist yet. It will be created with correct schema on next app start.'
    );
    db.close();
    process.exit(0);
  }

  console.log('Current columns:', tableInfo.map(col => col.name).join(', '));

  // Check if columns already exist
  const hasAddedBy = tableInfo.some(col => col.name === 'added_by');
  const hasAddedAt = tableInfo.some(col => col.name === 'added_at');

  if (hasAddedBy && hasAddedAt) {
    console.log('✅ Schema already up to date!');
    db.close();
    process.exit(0);
  }

  console.log('\n🔧 Migrating schema...');

  // Check if table has any data
  const count = db.prepare('SELECT COUNT(*) as count FROM library_document_tags').get();
  console.log(`Current rows: ${count.count}`);

  db.transaction(() => {
    // Drop old table
    console.log('  - Dropping old table...');
    db.prepare('DROP TABLE IF EXISTS library_document_tags').run();

    // Create new table with correct schema
    console.log('  - Creating new table with correct schema...');
    db.prepare(
      `
      CREATE TABLE library_document_tags (
        document_id INTEGER,
        tag_id INTEGER,
        added_by INTEGER,
        added_at DATETIME,
        PRIMARY KEY (document_id, tag_id),
        FOREIGN KEY (document_id) REFERENCES library_documents(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES library_tags(id) ON DELETE CASCADE,
        FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `
    ).run();

    console.log('  - Creating indexes...');
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_library_document_tags_document ON library_document_tags(document_id)'
    ).run();
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_library_document_tags_tag ON library_document_tags(tag_id)'
    ).run();
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_library_document_tags_user ON library_document_tags(added_by)'
    ).run();
  })();

  // Verify new schema
  const newTableInfo = db.prepare(`PRAGMA table_info(library_document_tags)`).all();
  console.log('\n✅ Migration complete!');
  console.log('New columns:', newTableInfo.map(col => col.name).join(', '));

  db.close();

  console.log('\n🎉 Schema migration successful!');
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error(error);
  process.exit(1);
}
