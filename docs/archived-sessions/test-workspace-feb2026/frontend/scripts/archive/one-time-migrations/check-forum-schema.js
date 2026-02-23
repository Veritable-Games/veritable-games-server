#!/usr/bin/env node
/**
 * Check forums.db schema
 * Verifies tables, indexes, and triggers exist
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/forums.db');
const db = new Database(dbPath, { readonly: true });

console.log('=== Forums Database Schema Check ===\n');

// Get all tables
console.log('📋 Tables:');
const tables = db
  .prepare(
    `
  SELECT name FROM sqlite_master
  WHERE type='table'
  ORDER BY name
`
  )
  .all();

tables.forEach(({ name }) => {
  console.log(`  ✓ ${name}`);
});

// Check for tag-related tables
console.log('\n🏷️  Tag System Tables:');
const tagTables = tables.filter(t => t.name.includes('tag'));
if (tagTables.length > 0) {
  tagTables.forEach(({ name }) => {
    console.log(`  ✓ ${name}`);
  });
} else {
  console.log('  ⚠️  No tag tables found');
}

// Get all indexes
console.log('\n📊 Indexes:');
const indexes = db
  .prepare(
    `
  SELECT name, tbl_name
  FROM sqlite_master
  WHERE type='index' AND name NOT LIKE 'sqlite_%'
  ORDER BY tbl_name, name
`
  )
  .all();

console.log(`  Total: ${indexes.length} indexes`);
const indexGroups = {};
indexes.forEach(({ name, tbl_name }) => {
  if (!indexGroups[tbl_name]) {
    indexGroups[tbl_name] = [];
  }
  indexGroups[tbl_name].push(name);
});

Object.entries(indexGroups).forEach(([table, indexNames]) => {
  console.log(`  ${table}: ${indexNames.length} indexes`);
});

// Get all triggers
console.log('\n⚡ Triggers:');
const triggers = db
  .prepare(
    `
  SELECT name, tbl_name
  FROM sqlite_master
  WHERE type='trigger'
  ORDER BY tbl_name, name
`
  )
  .all();

console.log(`  Total: ${triggers.length} triggers`);
const triggerGroups = {};
triggers.forEach(({ name, tbl_name }) => {
  if (!triggerGroups[tbl_name]) {
    triggerGroups[tbl_name] = [];
  }
  triggerGroups[tbl_name].push(name);
});

Object.entries(triggerGroups).forEach(([table, triggerNames]) => {
  console.log(`  ${table}: ${triggerNames.length} triggers`);
});

// Check FTS5 search table
console.log('\n🔍 Full-Text Search:');
const ftsTables = tables.filter(t => t.name.includes('fts'));
if (ftsTables.length > 0) {
  ftsTables.forEach(({ name }) => {
    console.log(`  ✓ ${name}`);
  });
} else {
  console.log('  ⚠️  No FTS tables found');
}

// Get sample row counts
console.log('\n📈 Row Counts:');
['categories', 'topics', 'replies'].forEach(table => {
  try {
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
    console.log(`  ${table}: ${result.count} rows`);
  } catch (error) {
    console.log(`  ${table}: Table not found`);
  }
});

// Check for tags table
console.log('\n🏷️  Tag Table Check:');
try {
  const tagCount = db.prepare(`SELECT COUNT(*) as count FROM tags`).get();
  console.log(`  ✓ tags table exists (${tagCount.count} rows)`);

  // Get sample tag
  const sampleTag = db.prepare(`SELECT * FROM tags LIMIT 1`).get();
  if (sampleTag) {
    console.log(`  Sample tag columns: ${Object.keys(sampleTag).join(', ')}`);
  }
} catch (error) {
  console.log(`  ⚠️  tags table does not exist`);
}

// Check for topic_tags junction table
console.log('\n🔗 Topic-Tag Relationship:');
try {
  const topicTagCount = db.prepare(`SELECT COUNT(*) as count FROM topic_tags`).get();
  console.log(`  ✓ topic_tags table exists (${topicTagCount.count} rows)`);
} catch (error) {
  console.log(`  ⚠️  topic_tags table does not exist`);
}

db.close();

console.log('\n✅ Schema check complete\n');
