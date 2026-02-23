#!/usr/bin/env node

/**
 * Migration Script: Add Project Reference Images System
 *
 * Adds tables for project reference image management to content.db
 * Run: node scripts/add-project-reference-images.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/content.db');

function runMigration() {
  console.log('Starting project reference images migration...');

  // Check if database exists
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Error: Database not found at ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH);

  try {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    console.log('Creating tables...');

    // Create tables
    db.exec(`
      -- Reference images table
      CREATE TABLE IF NOT EXISTS project_reference_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,

        -- File metadata
        filename_original TEXT NOT NULL,
        filename_storage TEXT NOT NULL UNIQUE,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,

        -- Image dimensions
        width INTEGER,
        height INTEGER,
        aspect_ratio REAL,

        -- Metadata
        title TEXT,
        description TEXT,
        uploaded_by INTEGER NOT NULL,
        sort_order INTEGER DEFAULT 0,

        -- Soft delete
        is_deleted INTEGER DEFAULT 0,
        deleted_at DATETIME,
        deleted_by INTEGER,

        -- Timestamps
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      -- Tags table for reference images
      CREATE TABLE IF NOT EXISTS project_reference_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        color TEXT,
        usage_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Junction table for many-to-many relationship
      CREATE TABLE IF NOT EXISTS project_reference_image_tags (
        image_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        added_by INTEGER NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (image_id, tag_id),
        FOREIGN KEY (image_id) REFERENCES project_reference_images(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES project_reference_tags(id) ON DELETE CASCADE
      );
    `);

    console.log('Creating indexes...');

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ref_images_project_id
        ON project_reference_images(project_id);

      CREATE INDEX IF NOT EXISTS idx_ref_images_deleted
        ON project_reference_images(is_deleted);

      CREATE INDEX IF NOT EXISTS idx_ref_images_project_active
        ON project_reference_images(project_id, is_deleted, sort_order);

      CREATE INDEX IF NOT EXISTS idx_ref_images_uploaded_by
        ON project_reference_images(uploaded_by);

      CREATE INDEX IF NOT EXISTS idx_ref_tags_slug
        ON project_reference_tags(slug);

      CREATE INDEX IF NOT EXISTS idx_ref_image_tags_image
        ON project_reference_image_tags(image_id);

      CREATE INDEX IF NOT EXISTS idx_ref_image_tags_tag
        ON project_reference_image_tags(tag_id);

      CREATE INDEX IF NOT EXISTS idx_ref_image_tags_tag_image
        ON project_reference_image_tags(tag_id, image_id);
    `);

    console.log('Creating triggers...');

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_ref_images_timestamp
      AFTER UPDATE ON project_reference_images
      FOR EACH ROW
      BEGIN
        UPDATE project_reference_images
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS update_ref_tags_timestamp
      AFTER UPDATE ON project_reference_tags
      FOR EACH ROW
      BEGIN
        UPDATE project_reference_tags
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS increment_ref_tag_usage
      AFTER INSERT ON project_reference_image_tags
      FOR EACH ROW
      BEGIN
        UPDATE project_reference_tags
        SET usage_count = usage_count + 1
        WHERE id = NEW.tag_id;
      END;

      CREATE TRIGGER IF NOT EXISTS decrement_ref_tag_usage
      AFTER DELETE ON project_reference_image_tags
      FOR EACH ROW
      BEGIN
        UPDATE project_reference_tags
        SET usage_count = usage_count - 1
        WHERE id = OLD.tag_id;
      END;
    `);

    console.log('Seeding default tags...');

    // Insert reference-specific tags
    const insertTag = db.prepare(`
      INSERT OR IGNORE INTO project_reference_tags (name, slug, color, description)
      VALUES (?, ?, ?, ?)
    `);

    const defaultTags = [
      // Subject matter tags
      ['Characters', 'characters', '#ec4899', 'Character designs and portraits'],
      ['Nature', 'nature', '#10b981', 'Natural environments, plants, landscapes'],
      ['Architecture', 'architecture', '#6366f1', 'Buildings, structures, interior spaces'],
      ['Technology', 'technology', '#0ea5e9', 'Vehicles, weapons, tech devices'],
      ['Creatures', 'creatures', '#f59e0b', 'Animals, monsters, alien life'],
      ['Props', 'props', '#8b5cf6', 'Objects, items, equipment'],

      // Style/type tags
      ['Concept Art', 'concept-art', '#a855f7', 'Early concept and ideation'],
      ['Reference Photo', 'reference-photo', '#84cc16', 'Real-world photographic reference'],
      ['Color Study', 'color-study', '#f97316', 'Color palette and mood studies'],
      ['Lighting', 'lighting', '#fbbf24', 'Lighting reference and studies'],
      ['Composition', 'composition', '#14b8a6', 'Layout and framing reference'],
      ['Materials', 'materials', '#78716c', 'Texture and material reference'],
    ];

    for (const tag of defaultTags) {
      insertTag.run(...tag);
    }

    // Verify migration
    const imageTableCheck = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='project_reference_images'"
      )
      .get();

    const tagTableCheck = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='project_reference_tags'"
      )
      .get();

    if (!imageTableCheck || !tagTableCheck) {
      throw new Error('Migration verification failed - tables not created');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log(`
Summary:
- Created 3 tables (images, tags, junction)
- Created 8 indexes for performance
- Created 4 triggers for data integrity
- Seeded 12 reference-specific tags

Tags created:
- Characters, Nature, Architecture, Technology, Creatures, Props
- Concept Art, Reference Photo, Color Study, Lighting, Composition, Materials

Next steps:
1. Create upload directory: mkdir -p public/uploads/references
2. Add API routes for image upload/management
3. Build UI components for reference image gallery
    `);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run migration
runMigration();
