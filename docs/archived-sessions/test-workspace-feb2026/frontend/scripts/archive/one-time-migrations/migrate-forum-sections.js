#!/usr/bin/env node

/**
 * Migration: Create forum_sections table
 *
 * Creates a new table to manage forum section metadata (display names and ordering).
 * Migrates from hardcoded sections to database-backed sections.
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/forums.db');

console.log('🔄 Starting forum sections migration...\n');

try {
  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Check if table already exists
  const tableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='forum_sections'")
    .get();

  if (tableExists) {
    console.log('ℹ️  Table forum_sections already exists. Skipping creation.');
  } else {
    console.log('📦 Creating forum_sections table...');

    db.exec(`
      CREATE TABLE forum_sections (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_sections_sort_order ON forum_sections(sort_order);
    `);

    console.log('✅ Table created successfully');
  }

  // Check if data already exists
  const existingData = db.prepare('SELECT COUNT(*) as count FROM forum_sections').get();

  if (existingData.count > 0) {
    console.log(`ℹ️  Found ${existingData.count} existing sections. Skipping seed data.`);
  } else {
    console.log('🌱 Seeding initial section data...');

    const insert = db.prepare(`
      INSERT INTO forum_sections (id, display_name, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const sections = [
      { id: 'general', display_name: 'Social Contract', sort_order: 0 },
      { id: 'games', display_name: 'Noxii Game', sort_order: 1 },
      { id: 'autumn', display_name: 'Autumn Project', sort_order: 2 },
      { id: 'misc', display_name: 'Miscellaneous', sort_order: 3 },
    ];

    const insertMany = db.transaction(sections => {
      for (const section of sections) {
        insert.run(section.id, section.display_name, section.sort_order);
      }
    });

    insertMany(sections);

    console.log(`✅ Seeded ${sections.length} sections`);
  }

  // Display current sections
  console.log('\n📋 Current sections:');
  const allSections = db
    .prepare('SELECT id, display_name, sort_order FROM forum_sections ORDER BY sort_order')
    .all();

  allSections.forEach(section => {
    console.log(`  ${section.sort_order}. [${section.id}] ${section.display_name}`);
  });

  db.close();

  console.log('\n✅ Migration completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
