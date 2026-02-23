#!/usr/bin/env node
const Database = require('better-sqlite3');
const db = new Database('data/content.db');

console.log('📋 Current Image Naming\n');

// Get some examples
const examples = db
  .prepare(
    `
  SELECT
    id,
    filename_original,
    filename_storage,
    file_path
  FROM project_reference_images
  WHERE project_id = 2
  ORDER BY id
  LIMIT 5
`
  )
  .all();

console.log('Examples from database:');
examples.forEach(img => {
  console.log(`\nID ${img.id}:`);
  console.log(`  Original:  ${img.filename_original}`);
  console.log(`  Storage:   ${img.filename_storage}`);
  console.log(`  Path:      ${img.file_path}`);
});

db.close();
