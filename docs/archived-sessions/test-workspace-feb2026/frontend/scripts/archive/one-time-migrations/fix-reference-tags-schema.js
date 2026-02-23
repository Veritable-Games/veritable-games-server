#!/usr/bin/env node

/**
 * Fix reference tags schema by removing old incompatible tables
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'content.db');
const db = new Database(dbPath);

console.log('🔧 Fixing reference tags schema...\n');

try {
  db.pragma('foreign_keys = OFF');

  // Drop the old project_reference_image_tags table (has broken FK constraint)
  console.log('Dropping old project_reference_image_tags table...');
  db.exec('DROP TABLE IF EXISTS project_reference_image_tags');
  console.log('✓ Dropped\n');

  // Create the correct junction table for reference images
  console.log('Creating project_reference_image_tags table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_reference_image_tags (
      reference_id INTEGER NOT NULL,
      tag_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (reference_id, tag_id),
      FOREIGN KEY (reference_id) REFERENCES project_reference_images(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES reference_tags(id) ON DELETE CASCADE
    )
  `);
  console.log('✓ Created\n');

  db.pragma('foreign_keys = ON');

  // Verify
  console.log('✅ Verification:');
  const tables = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name LIKE '%reference%tag%'
    ORDER BY name
  `
    )
    .all();

  console.log('Remaining tables:');
  tables.forEach(t => console.log(`  - ${t.name}`));

  console.log('\n✅ Schema fixed successfully!');
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
} finally {
  db.close();
}
