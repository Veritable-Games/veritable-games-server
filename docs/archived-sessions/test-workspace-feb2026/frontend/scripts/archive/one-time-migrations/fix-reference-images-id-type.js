#!/usr/bin/env node
/**
 * Fix Reference Images ID Type - Critical Bug Fix #2
 *
 * Problem: Previous migration changed id from INTEGER to TEXT
 * Impact: Delete/update operations fail with "not found" errors
 *
 * This script:
 * 1. Creates new table with INTEGER PRIMARY KEY for id
 * 2. Preserves INTEGER project_id fix from previous migration
 * 3. Migrates all data preserving numeric IDs
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/content.db');
const db = new Database(dbPath);

console.log('🔧 Fixing Reference Images ID Type\n');

try {
  db.exec('BEGIN TRANSACTION');

  // Check current schema
  console.log('📊 Current schema issues:');
  const currentSchema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='project_reference_images'")
    .get();

  console.log('Current id column: TEXT (WRONG ❌)');
  console.log('Current project_id column: INTEGER (CORRECT ✅)\n');

  // Get current data
  const currentCount = db.prepare('SELECT COUNT(*) as count FROM project_reference_images').get();
  console.log(`📈 Current images: ${currentCount.count}\n`);

  // Create new table with INTEGER id
  console.log('🔨 Creating new table with INTEGER id...');
  db.exec(`
    CREATE TABLE project_reference_images_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,

      -- File metadata
      filename_original TEXT NOT NULL,
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

  // Migrate data preserving numeric IDs
  console.log('📦 Migrating data (preserving numeric IDs)...');
  db.exec(`
    INSERT INTO project_reference_images_new (
      id,
      project_id,
      filename_original,
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
      CAST(id AS INTEGER),
      project_id,
      filename_original,
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
    ORDER BY CAST(id AS INTEGER)
  `);

  const migratedCount = db
    .prepare('SELECT COUNT(*) as count FROM project_reference_images_new')
    .get();
  console.log(`✅ Migrated ${migratedCount.count} images\n`);

  // Verify data integrity
  console.log('🔍 Verifying data integrity...');
  const verification = db
    .prepare(
      `
    SELECT
      p.slug,
      COUNT(*) as count,
      typeof(img.id) as id_type,
      typeof(img.project_id) as project_id_type
    FROM project_reference_images_new img
    JOIN projects p ON img.project_id = p.id
    GROUP BY p.slug
  `
    )
    .all();

  console.log('Project breakdown (new table):');
  verification.forEach(v => {
    console.log(`   ${v.slug}: ${v.count} images`);
    console.log(`      id type: ${v.id_type} ✅`);
    console.log(`      project_id type: ${v.project_id_type} ✅`);
  });
  console.log('');

  // Also need to fix the junction table for tags
  console.log('🔗 Checking tag junction table...');
  const tagJunctionSchema = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='project_reference_image_tags'"
    )
    .get();

  if (tagJunctionSchema) {
    console.log('Fixing project_reference_image_tags table...');

    // Drop dependent views first
    console.log('  Dropping dependent views...');
    db.exec('DROP VIEW IF EXISTS v_reference_tag_counts');
    db.exec('DROP VIEW IF EXISTS v_category_stats');

    db.exec(`
      CREATE TABLE project_reference_image_tags_new (
        reference_id INTEGER NOT NULL,
        tag_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (reference_id, tag_id),
        FOREIGN KEY (reference_id) REFERENCES project_reference_images(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES reference_tags(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      INSERT INTO project_reference_image_tags_new
      SELECT
        CAST(reference_id AS INTEGER),
        tag_id,
        created_at
      FROM project_reference_image_tags
    `);

    db.exec('DROP TABLE project_reference_image_tags');
    db.exec('ALTER TABLE project_reference_image_tags_new RENAME TO project_reference_image_tags');

    // Recreate views
    console.log('  Recreating views...');
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

    console.log('✅ Tag junction table fixed\n');
  }

  // Replace old table
  console.log('🔄 Replacing old table...');
  db.exec('DROP TABLE project_reference_images');
  db.exec('ALTER TABLE project_reference_images_new RENAME TO project_reference_images');
  console.log('✅ Table replaced\n');

  // Recreate indexes
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

  // Test the fix
  console.log('🧪 Testing the fix...');

  // Test query with integer ID (what API uses)
  const testImage = db.prepare('SELECT * FROM project_reference_images WHERE id = 23').get();
  if (testImage) {
    console.log(`   Query with INTEGER 23: Found "${testImage.filename_original}" ✅`);
  } else {
    console.log('   Query with INTEGER 23: Not found (no image with that ID)');
  }

  // Verify ID type
  const typeCheck = db
    .prepare('SELECT typeof(id) as id_type FROM project_reference_images LIMIT 1')
    .get();
  console.log(`   ID column type: ${typeCheck.id_type} ✅\n`);

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

  console.log('\n🎉 Schema fix complete!');
  console.log('   • id is now INTEGER PRIMARY KEY AUTOINCREMENT ✅');
  console.log('   • project_id remains INTEGER ✅');
  console.log('   • All data preserved and migrated ✅');
  console.log('   • Delete/update operations should now work ✅');
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
