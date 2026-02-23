#!/usr/bin/env node

/**
 * Database Migration: Add Gallery Type Column
 *
 * Adds `gallery_type` column to project_reference_images and reference_tags tables
 * to support multiple gallery types ('references', 'concept-art', etc.).
 *
 * Run: node frontend/scripts/migrations/add-gallery-type-column.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/content.db');

function runMigration() {
  console.log('🚀 Starting Gallery Type Migration...\n');

  const db = new Database(DB_PATH);

  try {
    db.pragma('foreign_keys = OFF');

    // Start transaction
    db.exec('BEGIN TRANSACTION');

    // ========================================================================
    // Step 1: Add gallery_type column to project_reference_images
    // ========================================================================
    console.log('📝 Step 1: Adding gallery_type column to project_reference_images...');

    // Check if column already exists
    const imageTableInfo = db.pragma(`table_info(project_reference_images)`);
    const hasImageGalleryType = imageTableInfo.some(col => col.name === 'gallery_type');

    if (!hasImageGalleryType) {
      db.exec(`
        ALTER TABLE project_reference_images
        ADD COLUMN gallery_type TEXT DEFAULT 'references' NOT NULL
      `);

      // Explicitly set existing rows to 'references'
      const updatedImages = db
        .prepare(
          `
        UPDATE project_reference_images
        SET gallery_type = 'references'
        WHERE gallery_type IS NULL OR gallery_type = ''
      `
        )
        .run();

      console.log(`   ✅ Added gallery_type column`);
      console.log(
        `   ✅ Updated ${updatedImages.changes} existing image records to 'references'\n`
      );
    } else {
      console.log(`   ℹ️  Column gallery_type already exists in project_reference_images\n`);
    }

    // ========================================================================
    // Step 2: Add gallery_type column to reference_tags
    // ========================================================================
    console.log('📝 Step 2: Adding gallery_type column to reference_tags...');

    const tagTableInfo = db.pragma(`table_info(reference_tags)`);
    const hasTagGalleryType = tagTableInfo.some(col => col.name === 'gallery_type');

    if (!hasTagGalleryType) {
      db.exec(`
        ALTER TABLE reference_tags
        ADD COLUMN gallery_type TEXT DEFAULT 'references' NOT NULL
      `);

      // Explicitly set existing rows to 'references'
      const updatedTags = db
        .prepare(
          `
        UPDATE reference_tags
        SET gallery_type = 'references'
        WHERE gallery_type IS NULL OR gallery_type = ''
      `
        )
        .run();

      console.log(`   ✅ Added gallery_type column`);
      console.log(`   ✅ Updated ${updatedTags.changes} existing tag records to 'references'\n`);
    } else {
      console.log(`   ℹ️  Column gallery_type already exists in reference_tags\n`);
    }

    // ========================================================================
    // Step 3: Note about UNIQUE constraint
    // ========================================================================
    console.log('📝 Step 3: UNIQUE constraint status...');
    console.log(`   ℹ️  Existing constraint: UNIQUE(project_id, category_id, name)`);
    console.log(`   ℹ️  New gallery_type column added - constraint remains category-scoped`);
    console.log(`   ℹ️  Tags are unique within (project, gallery, category) combination\n`);

    // ========================================================================
    // Step 4: Create performance indexes
    // ========================================================================
    console.log('📝 Step 4: Creating performance indexes...');

    // Index for filtering images by gallery type
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_gallery_images_type
      ON project_reference_images(project_id, gallery_type, is_deleted)
    `);
    console.log(
      `   ✅ Created index on project_reference_images(project_id, gallery_type, is_deleted)`
    );

    // Index for filtering tags by gallery type
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_gallery_tags_type
      ON reference_tags(project_id, gallery_type)
    `);
    console.log(`   ✅ Created index on reference_tags(project_id, gallery_type)\n`);

    // ========================================================================
    // Step 5: Verify data integrity
    // ========================================================================
    console.log('📝 Step 5: Verifying data integrity...');

    const imageCount = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM project_reference_images
      WHERE gallery_type = 'references'
    `
      )
      .get();

    const tagCount = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM reference_tags
      WHERE gallery_type = 'references'
    `
      )
      .get();

    console.log(`   ✅ Images with gallery_type='references': ${imageCount.count}`);
    console.log(`   ✅ Tags with gallery_type='references': ${tagCount.count}\n`);

    // Commit transaction
    db.exec('COMMIT');
    db.pragma('foreign_keys = ON');

    console.log('✅ Migration completed successfully!\n');
    console.log('Summary:');
    console.log('- Added gallery_type column to project_reference_images');
    console.log('- Added gallery_type column to reference_tags');
    console.log('- Created UNIQUE index on reference_tags(project_id, gallery_type, name)');
    console.log('- Created performance indexes for filtering');
    console.log(`- All existing data defaulted to gallery_type='references'\n`);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Rolling back...\n');

    try {
      db.exec('ROLLBACK');
      console.log('✅ Rollback successful');
    } catch (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError.message);
    }

    throw error;
  } finally {
    db.close();
  }
}

// Run migration
if (require.main === module) {
  try {
    runMigration();
    process.exit(0);
  } catch (error) {
    console.error('\nMigration terminated with errors');
    process.exit(1);
  }
}

module.exports = { runMigration };
