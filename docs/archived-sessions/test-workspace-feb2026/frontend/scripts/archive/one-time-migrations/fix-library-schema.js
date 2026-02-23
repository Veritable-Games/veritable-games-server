#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

console.log('🔧 Fixing Library Database Schema...\n');

const dbPath = path.join(__dirname, '../data/library.db');
const db = new Database(dbPath);

try {
  // Enable WAL mode
  db.pragma('journal_mode = WAL');

  // Check if table exists
  const tableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='library_document_tags'")
    .get();

  if (tableExists) {
    console.log('✅ library_document_tags table already exists');
  } else {
    console.log('➕ Creating library_document_tags table...');
    db.exec(`
      CREATE TABLE library_document_tags (
        document_id INTEGER,
        tag_id INTEGER,
        PRIMARY KEY (document_id, tag_id)
      )
    `);
    console.log('✅ Created library_document_tags table');
  }

  // Check all tables
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all();
  console.log('\n📊 Current tables in library.db:');
  tables.forEach(t => console.log(`  - ${t.name}`));

  console.log('\n✅ Library database schema fixed!');
} catch (error) {
  console.error('❌ Error fixing schema:', error);
  process.exit(1);
} finally {
  db.close();
}
