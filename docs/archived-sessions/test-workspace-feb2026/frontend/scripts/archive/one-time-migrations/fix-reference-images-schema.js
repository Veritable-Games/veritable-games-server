#!/usr/bin/env node
/**
 * Fix Reference Images Schema - Critical Bug Fix
 *
 * Problem: project_id column is TEXT but should be INTEGER
 * Impact: Images not displaying because WHERE project_id = 2 doesn't match '2'
 *
 * This script:
 * 1. Creates new table with correct INTEGER type for project_id
 * 2. Migrates all data with type conversion
 * 3. Preserves all relationships and constraints
 * 4. Adds proper foreign key to projects table
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/content.db');
const db = new Database(dbPath);

console.log('🔧 Starting Reference Images Schema Migration\n');

try {
  // Begin transaction
  db.exec('BEGIN TRANSACTION');

  // Step 1: Check current schema
  console.log('📊 Checking current schema...');
  const currentSchema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='project_reference_images'")
    .get();

  console.log('Current schema:');
  console.log(currentSchema.sql.substring(0, 200) + '...\n');

  // Step 2: Get current data count
  const currentCount = db.prepare('SELECT COUNT(*) as count FROM project_reference_images').get();
  console.log(`📈 Current images: ${currentCount.count}\n`);

  // Step 3: Check project_id types
  const projectIdTypes = db
    .prepare(
      `
    SELECT DISTINCT typeof(project_id) as type, COUNT(*) as count
    FROM project_reference_images
    GROUP BY typeof(project_id)
  `
    )
    .all();

  console.log('📋 Current project_id types:');
  projectIdTypes.forEach(t => console.log(`   ${t.type}: ${t.count} rows`));
  console.log('');

  // Step 4: Create new table with correct schema
  console.log('🔨 Creating new table with INTEGER project_id...');
  db.exec(`
    CREATE TABLE project_reference_images_new (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
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

      -- Foreign keys (users table is in separate database, can't use FK)
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ New table created\n');

  // Step 5: Migrate data with type conversion
  console.log('📦 Migrating data with type conversion...');
  db.exec(`
    INSERT INTO project_reference_images_new
    SELECT
      id,
      CAST(project_id AS INTEGER) as project_id,
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
  `);

  const migratedCount = db
    .prepare('SELECT COUNT(*) as count FROM project_reference_images_new')
    .get();
  console.log(`✅ Migrated ${migratedCount.count} images\n`);

  // Step 6: Verify data integrity
  console.log('🔍 Verifying data integrity...');

  const verifyQuery = `
    SELECT
      p.slug,
      COUNT(*) as count,
      typeof(img.project_id) as type
    FROM project_reference_images_new img
    JOIN projects p ON img.project_id = p.id
    GROUP BY p.slug, typeof(img.project_id)
  `;

  const verification = db.prepare(verifyQuery).all();
  console.log('Project breakdown (new table):');
  verification.forEach(v => console.log(`   ${v.slug}: ${v.count} images (type: ${v.type})`));
  console.log('');

  // Step 7: Drop old table and rename
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

  // Step 9: Test the fix
  console.log('🧪 Testing the fix...');

  // Test with integer (should work now)
  const testInteger = db
    .prepare('SELECT COUNT(*) as count FROM project_reference_images WHERE project_id = 2')
    .get();
  console.log(`   Query with INTEGER 2: ${testInteger.count} results ✅`);

  // Test with string (should also work due to type affinity)
  const testString = db
    .prepare("SELECT COUNT(*) as count FROM project_reference_images WHERE project_id = '2'")
    .get();
  console.log(`   Query with STRING '2': ${testString.count} results ✅`);

  // Verify they match
  if (testInteger.count === testString.count) {
    console.log(`   ✅ Both queries return same results!\n`);
  } else {
    throw new Error('Integer and string queries return different results!');
  }

  // Step 10: Commit transaction
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

  console.log('\n🎉 Schema migration complete!');
  console.log('   • project_id is now INTEGER (was TEXT)');
  console.log('   • All data preserved and migrated');
  console.log('   • Foreign key constraint added to projects table');
  console.log('   • Images should now display correctly');
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
