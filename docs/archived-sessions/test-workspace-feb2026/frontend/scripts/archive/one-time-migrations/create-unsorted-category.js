#!/usr/bin/env node

/**
 * Create "Unsorted" system category for library tags
 *
 * This category is used as a default for newly created tags
 * that haven't been categorized yet.
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'library.db');

console.log('📦 Creating "Unsorted" Tag Category');
console.log('===================================\n');

try {
  const db = new Database(DB_PATH);

  // Check if "Unsorted" category already exists
  const existing = db
    .prepare(
      `
    SELECT * FROM library_tag_categories
    WHERE name = 'unsorted' OR LOWER(name) = 'unsorted'
  `
    )
    .get();

  if (existing) {
    console.log('✅ "Unsorted" category already exists (ID: ' + existing.id + ')');
    db.close();
    process.exit(0);
  }

  console.log('🔧 Creating "Unsorted" category...');

  // Create the category
  const result = db
    .prepare(
      `
    INSERT INTO library_tag_categories (name, description, type, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `
    )
    .run(
      'unsorted',
      'Tags that have not been categorized yet',
      'general' // neutral color
    );

  console.log('✅ Created "Unsorted" category (ID: ' + result.lastInsertRowid + ')');

  // Now assign any existing tags without a category to "Unsorted"
  const orphanedTags = db
    .prepare(
      `
    SELECT id, name FROM library_tags WHERE category_id IS NULL
  `
    )
    .all();

  if (orphanedTags.length > 0) {
    console.log(`\n🔧 Found ${orphanedTags.length} orphaned tag(s), assigning to "Unsorted"...`);

    const updateStmt = db.prepare('UPDATE library_tags SET category_id = ? WHERE id = ?');

    db.transaction(() => {
      for (const tag of orphanedTags) {
        updateStmt.run(result.lastInsertRowid, tag.id);
        console.log(`   - "${tag.name}" → Unsorted`);
      }
    })();

    console.log('✅ Assigned orphaned tags to "Unsorted"');
  } else {
    console.log('\n✅ No orphaned tags found');
  }

  db.close();

  console.log('\n🎉 "Unsorted" category setup complete!');
} catch (error) {
  console.error('\n❌ Failed to create category:', error.message);
  console.error(error);
  process.exit(1);
}
