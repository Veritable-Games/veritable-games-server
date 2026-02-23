#!/usr/bin/env node
/**
 * Database Migration: Add title and description fields to project_reference_images
 *
 * This migration adds metadata fields to support video/image titles and descriptions.
 *
 * Changes:
 * - Add `title` TEXT column (optional)
 * - Add `description` TEXT column (optional)
 *
 * Usage:
 *   node scripts/migrations/add-video-metadata-fields.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/content.db');

console.log('🔧 Migration: Add video metadata fields');
console.log('Target database:', DB_PATH);

if (!fs.existsSync(DB_PATH)) {
  console.error('❌ Database not found:', DB_PATH);
  process.exit(1);
}

const db = new Database(DB_PATH);

try {
  // Check if columns already exist
  const tableInfo = db.prepare('PRAGMA table_info(project_reference_images)').all();
  const hasTitle = tableInfo.some(col => col.name === 'title');
  const hasDescription = tableInfo.some(col => col.name === 'description');

  if (hasTitle && hasDescription) {
    console.log('✅ Columns already exist. Migration not needed.');
    db.close();
    process.exit(0);
  }

  console.log('\n📝 Adding columns to project_reference_images table...');

  db.transaction(() => {
    // Add title column if it doesn't exist
    if (!hasTitle) {
      db.exec(`
        ALTER TABLE project_reference_images
        ADD COLUMN title TEXT;
      `);
      console.log('✅ Added column: title');
    }

    // Add description column if it doesn't exist
    if (!hasDescription) {
      db.exec(`
        ALTER TABLE project_reference_images
        ADD COLUMN description TEXT;
      `);
      console.log('✅ Added column: description');
    }
  })();

  // Verify changes
  const newTableInfo = db.prepare('PRAGMA table_info(project_reference_images)').all();
  const verifyTitle = newTableInfo.some(col => col.name === 'title');
  const verifyDescription = newTableInfo.some(col => col.name === 'description');

  if (verifyTitle && verifyDescription) {
    console.log('\n✅ Migration completed successfully!');
    console.log('   - title column added');
    console.log('   - description column added');
  } else {
    throw new Error('Verification failed - columns not found after migration');
  }

  db.close();
  process.exit(0);
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  db.close();
  process.exit(1);
}
