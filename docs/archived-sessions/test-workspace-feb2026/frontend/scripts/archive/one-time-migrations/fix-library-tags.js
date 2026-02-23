#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

// Connect to library database
const dbPath = path.join(process.cwd(), 'data', 'library.db');
const db = new Database(dbPath);

console.log('\n📚 Library Tag System Analysis & Fix\n');
console.log('='.repeat(50));

// 1. Check the database schema
console.log('\n1️⃣  Checking database schema...');

// Get library_tags schema
const tagSchema = db
  .prepare(
    `
  SELECT sql FROM sqlite_master
  WHERE type='table' AND name='library_tags'
`
  )
  .get();

console.log('\nlibrary_tags schema:');
console.log(tagSchema?.sql || 'Table not found');

// Get library_tag_categories schema
const categorySchema = db
  .prepare(
    `
  SELECT sql FROM sqlite_master
  WHERE type='table' AND name='library_tag_categories'
`
  )
  .get();

console.log('\nlibrary_tag_categories schema:');
console.log(categorySchema?.sql || 'Table not found');

// 2. Check for existing categories
console.log('\n2️⃣  Checking existing categories...');

const categories = db
  .prepare(
    `
  SELECT id, name, type, description
  FROM library_tag_categories
  ORDER BY name
`
  )
  .all();

console.log(`\nFound ${categories.length} categories:`);
categories.forEach(cat => {
  console.log(`  - [${cat.id}] ${cat.name} (${cat.type})`);
});

// 3. Check for "unsorted" category
const unsortedCategory = categories.find(
  cat => cat.name.toLowerCase() === 'unsorted' || cat.name.toLowerCase() === 'uncategorized'
);

if (!unsortedCategory) {
  console.log('\n⚠️  No "Unsorted" category found. Creating one...');

  const result = db
    .prepare(
      `
    INSERT INTO library_tag_categories (name, type, description, created_at)
    VALUES ('Unsorted', 'general', 'Tags that have not been categorized yet', datetime('now'))
  `
    )
    .run();

  const newCategory = db
    .prepare('SELECT * FROM library_tag_categories WHERE id = ?')
    .get(result.lastInsertRowid);

  console.log('✅ Created "Unsorted" category with ID:', newCategory.id);
} else {
  console.log('\n✅ "Unsorted" category exists with ID:', unsortedCategory.id);
}

// 4. Check for uncategorized tags
console.log('\n3️⃣  Checking for uncategorized tags...');

const uncategorizedTags = db
  .prepare(
    `
  SELECT id, name, category_id, usage_count
  FROM library_tags
  WHERE category_id IS NULL
`
  )
  .all();

console.log(`\nFound ${uncategorizedTags.length} uncategorized tags:`);
uncategorizedTags.forEach(tag => {
  console.log(`  - [${tag.id}] ${tag.name} (used ${tag.usage_count || 0} times)`);
});

// 5. Move uncategorized tags to "Unsorted" category
if (uncategorizedTags.length > 0) {
  // Get the unsorted category ID
  const unsorted = db
    .prepare(
      `
    SELECT id FROM library_tag_categories
    WHERE LOWER(name) IN ('unsorted', 'uncategorized')
    LIMIT 1
  `
    )
    .get();

  if (unsorted) {
    console.log(`\n4️⃣  Moving uncategorized tags to "Unsorted" category (ID: ${unsorted.id})...`);

    const result = db
      .prepare(
        `
      UPDATE library_tags
      SET category_id = ?
      WHERE category_id IS NULL
    `
      )
      .run(unsorted.id);

    console.log(`✅ Moved ${result.changes} tags to "Unsorted" category`);
  }
}

// 6. Check all tags and their categories
console.log('\n5️⃣  Current tag distribution by category:');

const tagsByCategory = db
  .prepare(
    `
  SELECT
    COALESCE(c.name, 'No Category') as category_name,
    COUNT(t.id) as tag_count,
    GROUP_CONCAT(t.name, ', ') as tag_names
  FROM library_tags t
  LEFT JOIN library_tag_categories c ON t.category_id = c.id
  GROUP BY c.id
  ORDER BY c.name
`
  )
  .all();

tagsByCategory.forEach(group => {
  console.log(`\n${group.category_name}: ${group.tag_count} tags`);
  if (group.tag_count <= 5) {
    console.log(`  Tags: ${group.tag_names}`);
  } else {
    const tags = group.tag_names.split(', ').slice(0, 5).join(', ');
    console.log(`  Tags: ${tags}, ...`);
  }
});

// 7. Fix the library service to handle tags properly
console.log('\n6️⃣  Recommendations for fixing tag creation:');
console.log('  1. Update library service createDocument to assign new tags to "Unsorted" category');
console.log('  2. Update library service updateDocument to handle tag updates');
console.log('  3. Ensure tag-categories API includes uncategorized tags in response');
console.log('  4. Update UnifiedTagManager to show "Unsorted" category when it has tags');

db.close();
console.log('\n' + '='.repeat(50));
console.log('✅ Analysis complete!\n');
