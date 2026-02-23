#!/usr/bin/env node
/**
 * Remove filename_original Column from Reference Images
 *
 * Purpose: Remove the filename_original column that stores the original upload name.
 * We're using standardized storage names (filename_storage) only.
 *
 * This script:
 * 1. Creates new table without filename_original column
 * 2. Migrates all data preserving other columns
 * 3. Drops old table and renames new table
 * 4. Recreates indexes
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/content.db');
const db = new Database(dbPath);

console.log('🔧 Removing filename_original Column\n');

try {
  db.exec('BEGIN TRANSACTION');

  // Step 1: Check current schema
  console.log('📊 Checking current schema...');
  const currentSchema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='project_reference_images'")
    .get();

  if (!currentSchema.sql.includes('filename_original')) {
    console.log('✅ Column already removed - no migration needed');
    db.exec('ROLLBACK');
    process.exit(0);
  }

  console.log('Current schema includes filename_original column\n');

  // Step 2: Get current count
  const currentCount = db.prepare('SELECT COUNT(*) as count FROM project_reference_images').get();
  console.log(`📈 Current images: ${currentCount.count}\n`);

  // Step 3: Create new table without filename_original
  console.log('🔨 Creating new table without filename_original...');
  db.exec(`
    CREATE TABLE project_reference_images_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,

      -- File metadata (no filename_original)
      filename_storage TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,

      -- Image dimensions
      width INTEGER,
      height INTEGER,
      aspect_ratio REAL,

      -- Metadata
      uploaded_by TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,

      -- Soft delete
      is_deleted INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      deleted_by TEXT,

      -- Timestamps
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),

      -- Foreign keys
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ New table created\n');

  // Step 4: Migrate data (excluding filename_original)
  console.log('📦 Migrating data...');
  db.exec(`
    INSERT INTO project_reference_images_new (
      id,
      project_id,
      filename_storage,
      file_path,
      file_size,
      mime_type,
      width,
      height,
      aspect_ratio,
      uploaded_by,
      sort_order,
      is_deleted,
      deleted_at,
      deleted_by,
      created_at,
      updated_at
    )
    SELECT
      id,
      project_id,
      filename_storage,
      file_path,
      file_size,
      mime_type,
      width,
      height,
      aspect_ratio,
      uploaded_by,
      sort_order,
      is_deleted,
      deleted_at,
      deleted_by,
      created_at,
      updated_at
    FROM project_reference_images
  `);

  const migratedCount = db
    .prepare('SELECT COUNT(*) as count FROM project_reference_images_new')
    .get();
  console.log(`✅ Migrated ${migratedCount.count} images\n`);

  // Step 5: Verify migration
  console.log('🔍 Verifying data integrity...');
  if (currentCount.count !== migratedCount.count) {
    throw new Error(
      `Count mismatch! Original: ${currentCount.count}, Migrated: ${migratedCount.count}`
    );
  }
  console.log('✅ All images migrated successfully\n');

  // Step 6: Drop views that depend on the table
  console.log('📋 Dropping dependent views...');
  db.exec('DROP VIEW IF EXISTS v_reference_tag_counts');
  db.exec('DROP VIEW IF EXISTS v_category_stats');
  console.log('✅ Views dropped\n');

  // Step 7: Replace old table
  console.log('🔄 Replacing old table...');
  db.exec('DROP TABLE project_reference_images');
  db.exec('ALTER TABLE project_reference_images_new RENAME TO project_reference_images');
  console.log('✅ Table replaced\n');

  // Step 8: Recreate indexes
  console.log('📑 Creating indexes...');
  db.exec(`
    CREATE INDEX idx_reference_images_project_id
    ON project_reference_images(project_id)
  `);
  db.exec(`
    CREATE INDEX idx_reference_images_deleted
    ON project_reference_images(is_deleted)
  `);
  db.exec(`
    CREATE INDEX idx_reference_images_created_at
    ON project_reference_images(created_at DESC)
  `);
  console.log('✅ Indexes created\n');

  // Step 9: Recreate views
  console.log('📋 Recreating views...');
  db.exec(`
    CREATE VIEW v_reference_tag_counts AS
    SELECT
      t.id as tag_id,
      t.name as tag_name,
      t.color as tag_color,
      t.project_id,
      t.category_id,
      c.name as category_name,
      COUNT(DISTINCT prit.reference_id) as usage_count
    FROM reference_tags t
    LEFT JOIN reference_categories c ON t.category_id = c.id
    LEFT JOIN project_reference_image_tags prit ON t.id = prit.tag_id
    GROUP BY t.id
  `);

  db.exec(`
    CREATE VIEW v_category_stats AS
    SELECT
      c.id as category_id,
      c.name as category_name,
      c.visibility,
      rt.project_id,
      COUNT(DISTINCT rt.id) as tag_count,
      COUNT(DISTINCT prit.reference_id) as reference_count
    FROM reference_categories c
    LEFT JOIN reference_tags rt ON c.id = rt.category_id
    LEFT JOIN project_reference_image_tags prit ON rt.id = prit.tag_id
    GROUP BY c.id, rt.project_id
  `);
  console.log('✅ Views recreated\n');

  // Step 10: Commit
  db.exec('COMMIT');
  console.log('✅ Migration completed successfully!\n');

  // Final report
  console.log('📊 Final Report:');
  const finalStats = db
    .prepare(
      `
    SELECT
      p.slug,
      COUNT(CASE WHEN img.is_deleted = 0 THEN 1 END) as active,
      COUNT(CASE WHEN img.is_deleted = 1 THEN 1 END) as deleted,
      COUNT(*) as total
    FROM project_reference_images img
    JOIN projects p ON img.project_id = p.id
    GROUP BY p.slug
    ORDER BY p.slug
  `
    )
    .all();

  finalStats.forEach(stat => {
    console.log(
      `   ${stat.slug}: ${stat.active} active, ${stat.deleted} deleted (${stat.total} total)`
    );
  });

  console.log('\n🎉 Column removal complete!');
  console.log('   • filename_original column removed ✅');
  console.log('   • Using filename_storage (standardized names) only ✅');
  console.log('   • All data preserved ✅');
  console.log('   • Views recreated ✅');
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error(error);

  try {
    db.exec('ROLLBACK');
    console.log('🔄 Transaction rolled back - no changes made');
  } catch (rollbackError) {
    console.error('❌ Rollback failed:', rollbackError.message);
  }

  process.exit(1);
} finally {
  db.close();
}
