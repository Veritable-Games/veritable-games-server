#!/usr/bin/env node

/**
 * Cleanup Deprecated Reference Tables
 *
 * Drops old/deprecated tables that reference non-existent tables:
 * - reference_tag_assignments (references project_references)
 * - project_reference_tags (references project_references)
 * - project_references_backup (old backup table)
 *
 * These tables are no longer used. The current schema uses:
 * - project_reference_images (main table)
 * - project_reference_image_tags (junction table)
 * - reference_tags (tag definitions)
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'content.db');

console.log('🧹 Cleaning up deprecated reference tables...\n');

try {
  const db = new Database(dbPath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // List all reference-related tables
  const allTables = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name LIKE '%reference%'
    ORDER BY name
  `
    )
    .all();

  console.log('📋 Current reference-related tables:');
  allTables.forEach(t => console.log('  - ' + t.name));
  console.log('');

  // Check deprecated tables
  const deprecatedTables = [
    'reference_tag_assignments',
    'project_reference_tags',
    'project_references_backup',
  ];

  const existingDeprecated = deprecatedTables.filter(tableName => {
    const exists = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name = ?
    `
      )
      .get(tableName);
    return exists !== undefined;
  });

  if (existingDeprecated.length === 0) {
    console.log('✅ No deprecated tables found. Database is already clean!');
    db.close();
    process.exit(0);
  }

  console.log('🗑️  Found deprecated tables to remove:');
  existingDeprecated.forEach(t => console.log('  - ' + t));
  console.log('');

  // Check if any of these tables have data
  let hasData = false;
  existingDeprecated.forEach(tableName => {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
    if (count.count > 0) {
      console.log(`⚠️  ${tableName} has ${count.count} rows`);
      hasData = true;
    }
  });

  if (hasData) {
    console.log('');
    console.log('⚠️  WARNING: Some deprecated tables contain data.');
    console.log('   This script will drop them. Make sure you have a backup!');
    console.log('');
  }

  // Drop deprecated tables
  console.log('🔨 Dropping deprecated tables...\n');

  existingDeprecated.forEach(tableName => {
    try {
      console.log(`  Dropping ${tableName}...`);
      db.prepare(`DROP TABLE IF EXISTS ${tableName}`).run();
      console.log(`  ✅ ${tableName} dropped`);
    } catch (error) {
      console.error(`  ❌ Failed to drop ${tableName}:`, error.message);
    }
  });

  console.log('');

  // Verify cleanup
  const remainingTables = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name LIKE '%reference%'
    ORDER BY name
  `
    )
    .all();

  console.log('📋 Remaining reference-related tables:');
  remainingTables.forEach(t => console.log('  - ' + t.name));

  // Verify no broken FK constraints
  console.log('');
  console.log('🔍 Checking foreign key integrity...');
  const fkCheck = db.pragma('foreign_key_check');

  if (fkCheck.length === 0) {
    console.log('✅ All foreign key constraints are valid!');
  } else {
    console.log('⚠️  Found foreign key issues:');
    fkCheck.forEach(issue => console.log('  ', issue));
  }

  db.close();

  console.log('');
  console.log('✨ Cleanup complete!');
  console.log('');
  console.log('Expected schema:');
  console.log('  ✓ project_reference_images - Main reference images table');
  console.log('  ✓ project_reference_image_tags - Junction table (images ↔ tags)');
  console.log('  ✓ reference_tags - Tag definitions');
  console.log('  ✓ reference_categories - Tag categories');
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error);
  process.exit(1);
}
