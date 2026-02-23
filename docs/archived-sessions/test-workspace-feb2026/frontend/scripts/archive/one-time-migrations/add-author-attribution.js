#!/usr/bin/env node

/**
 * Migration Script: Add Author Attribution to Reference Images
 *
 * Adds author_name and author_url columns to project_reference_images table
 * for crediting artists and linking to their portfolios.
 *
 * Run: node scripts/add-author-attribution.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/content.db');

function runMigration() {
  console.log('🚀 Starting author attribution migration...\n');

  // Check if database exists
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Error: Database not found at ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH);

  try {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Check if columns already exist
    const tableInfo = db.prepare('PRAGMA table_info(project_reference_images)').all();
    const hasAuthorName = tableInfo.some(col => col.name === 'author_name');
    const hasAuthorUrl = tableInfo.some(col => col.name === 'author_url');

    if (hasAuthorName && hasAuthorUrl) {
      console.log('✅ Author columns already exist. Migration not needed.');
      db.close();
      return;
    }

    console.log('📝 Adding author attribution columns...');

    // Add author_name column
    if (!hasAuthorName) {
      db.exec(`
        ALTER TABLE project_reference_images
        ADD COLUMN author_name TEXT;
      `);
      console.log('  ✓ Added author_name column');
    }

    // Add author_url column
    if (!hasAuthorUrl) {
      db.exec(`
        ALTER TABLE project_reference_images
        ADD COLUMN author_url TEXT;
      `);
      console.log('  ✓ Added author_url column');
    }

    console.log('\n📊 Creating indexes...');

    // Create index on author_name for efficient filtering
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ref_images_author_name
        ON project_reference_images(author_name)
        WHERE author_name IS NOT NULL;
    `);
    console.log('  ✓ Created index on author_name');

    // Create index on author_url for efficient lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ref_images_author_url
        ON project_reference_images(author_url)
        WHERE author_url IS NOT NULL;
    `);
    console.log('  ✓ Created index on author_url');

    // Verify migration
    const updatedTableInfo = db.prepare('PRAGMA table_info(project_reference_images)').all();
    const verifyAuthorName = updatedTableInfo.some(col => col.name === 'author_name');
    const verifyAuthorUrl = updatedTableInfo.some(col => col.name === 'author_url');

    if (!verifyAuthorName || !verifyAuthorUrl) {
      throw new Error('Migration verification failed - columns not created');
    }

    // Verify indexes
    const indexes = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='index'
      AND tbl_name='project_reference_images'
      AND (name='idx_ref_images_author_name' OR name='idx_ref_images_author_url')
    `
      )
      .all();

    if (indexes.length !== 2) {
      throw new Error('Migration verification failed - indexes not created');
    }

    console.log('\n✅ Migration completed successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Summary:');
    console.log('  • Added author_name TEXT column');
    console.log('  • Added author_url TEXT column');
    console.log('  • Created 2 partial indexes for performance');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Next steps:');
    console.log('  1. Update TypeScript type definitions');
    console.log('  2. Update ReferenceImagesService to handle author fields');
    console.log('  3. Update API routes to accept author data');
    console.log('  4. Update UI components for author attribution\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run migration
runMigration();
