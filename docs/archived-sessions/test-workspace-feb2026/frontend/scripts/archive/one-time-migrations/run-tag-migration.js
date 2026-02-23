#!/usr/bin/env node
/**
 * Run forum tags migration
 * Creates tags and topic_tags tables with indexes and triggers
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/forums.db');
const migrationPath = path.join(__dirname, 'migrations/add-forum-tags.sql');

console.log('=== Forum Tags Migration ===\n');
console.log(`Database: ${dbPath}`);
console.log(`Migration: ${migrationPath}\n`);

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error('❌ Error: forums.db not found!');
  console.error(`   Expected at: ${dbPath}`);
  process.exit(1);
}

// Check if migration file exists
if (!fs.existsSync(migrationPath)) {
  console.error('❌ Error: Migration file not found!');
  console.error(`   Expected at: ${migrationPath}`);
  process.exit(1);
}

// Read migration SQL
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Open database
const db = new Database(dbPath);

// Check current state
console.log('📋 Pre-migration state:');
const preCheckTables = db
  .prepare(
    `
  SELECT name FROM sqlite_master
  WHERE type='table' AND name IN ('tags', 'topic_tags')
`
  )
  .all();

if (preCheckTables.length === 0) {
  console.log('  ⚠️  No tag tables exist (will be created)');
} else {
  console.log('  ✓ Tag tables already exist:');
  preCheckTables.forEach(({ name }) => {
    console.log(`    - ${name}`);
  });
}

// Run migration in a transaction
console.log('\n⚡ Running migration...');

try {
  db.exec('BEGIN TRANSACTION');
  db.exec(migrationSQL);
  db.exec('COMMIT');
  console.log('  ✅ Migration completed successfully');
} catch (error) {
  db.exec('ROLLBACK');
  console.error('  ❌ Migration failed:', error.message);
  db.close();
  process.exit(1);
}

// Verify results
console.log('\n📋 Post-migration state:');

// Check tables
const tables = db
  .prepare(
    `
  SELECT name FROM sqlite_master
  WHERE type='table' AND name IN ('tags', 'topic_tags')
`
  )
  .all();

console.log(`  Tables: ${tables.length}/2`);
tables.forEach(({ name }) => {
  const count = db.prepare(`SELECT COUNT(*) as count FROM ${name}`).get();
  console.log(`    ✓ ${name} (${count.count} rows)`);
});

// Check indexes
const indexes = db
  .prepare(
    `
  SELECT name FROM sqlite_master
  WHERE type='index' AND name LIKE 'idx_tag%'
`
  )
  .all();

console.log(`  Indexes: ${indexes.length} created`);
indexes.forEach(({ name }) => {
  console.log(`    ✓ ${name}`);
});

// Check triggers
const triggers = db
  .prepare(
    `
  SELECT name FROM sqlite_master
  WHERE type='trigger' AND name LIKE '%tag%'
`
  )
  .all();

console.log(`  Triggers: ${triggers.length} created`);
triggers.forEach(({ name }) => {
  console.log(`    ✓ ${name}`);
});

// Show sample tags
const sampleTags = db
  .prepare(
    `
  SELECT name, slug, usage_count FROM tags
  ORDER BY name
  LIMIT 5
`
  )
  .all();

if (sampleTags.length > 0) {
  console.log('\n🏷️  Sample tags:');
  sampleTags.forEach(({ name, slug, usage_count }) => {
    console.log(`    ${name} (${slug}) - ${usage_count} uses`);
  });
}

db.close();

console.log('\n✅ Migration complete!\n');
