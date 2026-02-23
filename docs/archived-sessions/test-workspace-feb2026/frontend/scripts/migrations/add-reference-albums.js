#!/usr/bin/env node

/**
 * Migration: Add Reference Albums Tables
 *
 * Adds support for grouping reference images and concept art into albums.
 *
 * Changes:
 * - Creates reference_albums table
 * - Creates reference_album_images junction table with position ordering
 * - Adds indexes for performance
 *
 * Run: node scripts/migrations/add-reference-albums.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const CONTENT_DB_PATH = path.join(__dirname, '../../data/content.db');

function runMigration() {
  console.log('Starting reference albums migration...\n');

  const db = new Database(CONTENT_DB_PATH);
  db.pragma('foreign_keys = ON');

  try {
    db.exec('BEGIN TRANSACTION');

    // Check if tables already exist
    const albumsTableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reference_albums'")
      .get();

    if (albumsTableExists) {
      console.log('✓ Migration already applied - reference_albums table exists');
      db.exec('ROLLBACK');
      db.close();
      return;
    }

    console.log('Creating reference_albums table...');
    db.exec(`
      CREATE TABLE reference_albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        gallery_type TEXT NOT NULL CHECK(gallery_type IN ('references', 'concept-art')),
        name TEXT,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ reference_albums table created');

    console.log('Creating reference_album_images junction table...');
    db.exec(`
      CREATE TABLE reference_album_images (
        album_id INTEGER NOT NULL,
        image_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (album_id, image_id),
        FOREIGN KEY (album_id) REFERENCES reference_albums(id) ON DELETE CASCADE,
        FOREIGN KEY (image_id) REFERENCES project_reference_images(id) ON DELETE CASCADE,
        UNIQUE(image_id)
      )
    `);
    console.log('✓ reference_album_images table created');

    console.log('Creating indexes...');
    db.exec(`
      CREATE INDEX idx_album_images_album ON reference_album_images(album_id);
      CREATE INDEX idx_album_images_position ON reference_album_images(album_id, position);
      CREATE INDEX idx_albums_project ON reference_albums(project_id, gallery_type);
    `);
    console.log('✓ Indexes created');

    db.exec('COMMIT');
    console.log('\n✅ Migration completed successfully!');

    // Verify tables
    console.log('\nVerifying tables...');
    const albumsCount = db.prepare('SELECT COUNT(*) as count FROM reference_albums').get().count;
    const junctionCount = db
      .prepare('SELECT COUNT(*) as count FROM reference_album_images')
      .get().count;

    console.log(`✓ reference_albums: ${albumsCount} rows`);
    console.log(`✓ reference_album_images: ${junctionCount} rows`);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

// Run migration
try {
  runMigration();
  process.exit(0);
} catch (error) {
  console.error('\nMigration aborted due to errors.');
  process.exit(1);
}
