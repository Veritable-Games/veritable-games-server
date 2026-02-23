#!/usr/bin/env node

/**
 * Migration: Add Video Support to Gallery
 *
 * Adds video-specific columns to project_reference_images table:
 * - duration (video length in seconds)
 * - poster_path (thumbnail/poster image path)
 *
 * This allows the existing table to handle both images and videos.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/content.db');

console.log('🎬 Migration: Add Video Support');
console.log('━'.repeat(50));

function main() {
  // Check if database exists
  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ Database not found:', DB_PATH);
    process.exit(1);
  }

  const db = new Database(DB_PATH);

  try {
    // Start transaction
    db.exec('BEGIN');

    console.log('📊 Checking current schema...');

    // Check if columns already exist
    const tableInfo = db.prepare('PRAGMA table_info(project_reference_images)').all();
    const columns = tableInfo.map(col => col.name);

    console.log('Current columns:', columns.join(', '));

    const hasDuration = columns.includes('duration');
    const hasPosterPath = columns.includes('poster_path');

    if (hasDuration && hasPosterPath) {
      console.log('✅ Video columns already exist - migration not needed');
      db.exec('ROLLBACK');
      db.close();
      return;
    }

    console.log('');
    console.log('🔧 Adding video support columns...');

    // Add duration column (for videos only)
    if (!hasDuration) {
      db.exec(`
        ALTER TABLE project_reference_images
        ADD COLUMN duration INTEGER
      `);
      console.log('  ✅ Added duration column');
    } else {
      console.log('  ⏭️  duration column already exists');
    }

    // Add poster_path column (thumbnail for videos)
    if (!hasPosterPath) {
      db.exec(`
        ALTER TABLE project_reference_images
        ADD COLUMN poster_path TEXT
      `);
      console.log('  ✅ Added poster_path column');
    } else {
      console.log('  ⏭️  poster_path column already exists');
    }

    // Commit transaction
    db.exec('COMMIT');

    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Updated schema:');
    const updatedInfo = db.prepare('PRAGMA table_info(project_reference_images)').all();
    updatedInfo
      .filter(col => ['duration', 'poster_path', 'mime_type'].includes(col.name))
      .forEach(col => {
        console.log(`  • ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}`);
      });
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Rolling back changes...');
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

main();
