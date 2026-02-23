#!/usr/bin/env node
/**
 * Migration: Make reference tags project-specific
 *
 * Changes:
 * - Add project_id column to reference_tags
 * - Update UNIQUE constraint to include project_id
 * - Migrate existing tags to be associated with their projects
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'content.db');
const db = new Database(dbPath);

console.log('Starting migration: Make reference tags project-specific\n');

try {
  // Disable foreign keys for migration
  db.pragma('foreign_keys = OFF');
  db.exec('BEGIN TRANSACTION');

  // Step 1: Drop views that depend on reference_tags
  console.log('Step 1: Dropping dependent views...');
  db.exec('DROP VIEW IF EXISTS v_reference_tag_counts');
  db.exec('DROP VIEW IF EXISTS v_category_stats');
  console.log('✓ Views dropped');

  // Step 2: Check current schema
  console.log('\nStep 2: Checking current schema...');
  const currentSchema = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='reference_tags'`)
    .get();
  console.log('Current schema:', currentSchema.sql);

  // Step 3: Create new table with project_id
  console.log('\nStep 3: Creating new table with project_id...');
  db.exec(`
    CREATE TABLE reference_tags_new (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      project_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6B7280' CHECK (color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES reference_categories(id) ON DELETE CASCADE,
      UNIQUE(project_id, category_id, name)
    )
  `);
  console.log('✓ New table created');

  // Step 4: Migrate existing tags - associate with ALL projects that use them
  console.log('\nStep 4: Migrating existing tags...');

  // Get all unique combinations of (tag_id, project_id) from image_tags
  const tagProjectCombos = db
    .prepare(
      `
    SELECT DISTINCT
      rt.id as tag_id,
      img.project_id,
      rt.category_id,
      rt.name,
      rt.color,
      rt.display_order,
      rt.created_at
    FROM reference_tags rt
    JOIN project_reference_image_tags prit ON rt.id = prit.tag_id
    JOIN project_reference_images img ON prit.reference_id = img.id
    ORDER BY img.project_id, rt.category_id, rt.display_order
  `
    )
    .all();

  console.log(`Found ${tagProjectCombos.length} tag-project combinations to migrate`);

  // Map old tag IDs to new tag IDs per project
  const tagIdMapping = new Map(); // Key: "oldTagId-projectId", Value: newTagId

  // Insert migrated tags
  const insertStmt = db.prepare(`
    INSERT INTO reference_tags_new (id, project_id, category_id, name, color, display_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const combo of tagProjectCombos) {
    const projectIdStr = String(combo.project_id);
    const tagIdStr = String(combo.tag_id);
    const newTagId = `${projectIdStr.substring(0, 8)}-${tagIdStr}`;
    const mapKey = `${tagIdStr}-${projectIdStr}`;

    insertStmt.run(
      newTagId,
      combo.project_id,
      combo.category_id,
      combo.name,
      combo.color,
      combo.display_order,
      combo.created_at
    );

    tagIdMapping.set(mapKey, newTagId);
  }

  console.log(`✓ Migrated ${tagProjectCombos.length} tag entries`);

  // Step 5: Update project_reference_image_tags to use new tag IDs
  console.log('\nStep 5: Updating image-tag relationships...');

  const imageTagRelations = db
    .prepare(
      `
    SELECT
      prit.reference_id,
      prit.tag_id as old_tag_id,
      img.project_id
    FROM project_reference_image_tags prit
    JOIN project_reference_images img ON prit.reference_id = img.id
  `
    )
    .all();

  // Create temporary mapping table
  db.exec(`
    CREATE TEMP TABLE tag_id_mapping (
      old_tag_id TEXT,
      project_id TEXT,
      new_tag_id TEXT,
      PRIMARY KEY (old_tag_id, project_id)
    )
  `);

  const insertMappingStmt = db.prepare(`
    INSERT INTO tag_id_mapping (old_tag_id, project_id, new_tag_id)
    VALUES (?, ?, ?)
  `);

  for (const [mapKey, newTagId] of tagIdMapping.entries()) {
    const [oldTagId, projectId] = mapKey.split('-');
    insertMappingStmt.run(oldTagId, projectId, newTagId);
  }

  // Update image tags with new IDs
  db.exec(`
    UPDATE project_reference_image_tags
    SET tag_id = (
      SELECT new_tag_id
      FROM tag_id_mapping m
      JOIN project_reference_images img ON img.id = project_reference_image_tags.reference_id
      WHERE m.old_tag_id = project_reference_image_tags.tag_id
      AND m.project_id = img.project_id
    )
  `);

  console.log(`✓ Updated ${imageTagRelations.length} image-tag relationships`);

  // Step 6: Replace old table with new table
  console.log('\nStep 6: Replacing old table...');
  db.exec('DROP TABLE reference_tags');
  db.exec('ALTER TABLE reference_tags_new RENAME TO reference_tags');
  console.log('✓ Table replaced');

  // Step 7: Recreate indexes
  console.log('\nStep 7: Recreating indexes...');
  db.exec(`
    CREATE INDEX idx_reference_tags_project_id ON reference_tags(project_id);
    CREATE INDEX idx_reference_tags_category_id ON reference_tags(category_id);
  `);
  console.log('✓ Indexes created');

  // Step 8: Recreate views with corrected table names
  console.log('\nStep 8: Recreating views...');
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
  console.log('✓ Views recreated');

  // Commit transaction
  db.exec('COMMIT');

  // Re-enable foreign keys
  db.pragma('foreign_keys = ON');

  console.log('\n✅ Migration completed successfully!');

  // Show summary
  const newTagCount = db.prepare('SELECT COUNT(*) as count FROM reference_tags').get();
  console.log(`\nTotal project-specific tags: ${newTagCount.count}`);

  // Show tags per project
  const projectTags = db
    .prepare(
      `
    SELECT
      p.title,
      COUNT(rt.id) as tag_count
    FROM projects p
    LEFT JOIN reference_tags rt ON p.id = rt.project_id
    GROUP BY p.id, p.title
    ORDER BY p.title
  `
    )
    .all();

  console.log('\nTags per project:');
  projectTags.forEach(pt => {
    console.log(`  ${pt.title}: ${pt.tag_count} tags`);
  });
} catch (error) {
  db.exec('ROLLBACK');
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
