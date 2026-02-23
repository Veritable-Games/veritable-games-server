#!/usr/bin/env node
/**
 * Add missing indexes to reference image tags junction table
 * This improves query performance when fetching tags for images
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/content.db');
const db = new Database(dbPath);

try {
  console.log('Checking and creating indexes for reference_image_tags...\n');

  // Check if index on reference_id already exists
  const existingRefIdx = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='index'
    AND name='idx_reference_image_tags_reference_id'
  `
    )
    .get();

  if (!existingRefIdx) {
    console.log('Creating index on reference_id...');
    db.exec(`
      CREATE INDEX idx_reference_image_tags_reference_id
      ON project_reference_image_tags(reference_id)
    `);
    console.log('✓ Index on reference_id created successfully');
  } else {
    console.log('✓ Index on reference_id already exists');
  }

  // Check if index on tag_id already exists
  const existingTagIdx = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='index'
    AND name='idx_reference_image_tags_tag_id'
  `
    )
    .get();

  if (!existingTagIdx) {
    console.log('Creating index on tag_id...');
    db.exec(`
      CREATE INDEX idx_reference_image_tags_tag_id
      ON project_reference_image_tags(tag_id)
    `);
    console.log('✓ Index on tag_id created successfully');
  } else {
    console.log('✓ Index on tag_id already exists');
  }

  console.log('\n=== All indexes on project_reference_image_tags ===');
  const allIndexes = db
    .prepare(
      `
    SELECT name, sql FROM sqlite_master
    WHERE type='index' AND tbl_name='project_reference_image_tags'
  `
    )
    .all();

  allIndexes.forEach(idx => {
    console.log(`${idx.name}:`);
    console.log(`  ${idx.sql || '(auto-generated primary key index)'}\n`);
  });

  console.log('✓ Database indexes optimized!');
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  db.close();
}
