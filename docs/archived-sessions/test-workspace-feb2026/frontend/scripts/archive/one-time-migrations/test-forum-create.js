#!/usr/bin/env node

/**
 * Test creating a forum topic to verify soft deletion works
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'forums.db');

console.log('Testing forum topic creation with soft deletion support...\n');

try {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Get first category
  const category = db.prepare('SELECT * FROM forum_categories LIMIT 1').get();

  if (!category) {
    console.error('No categories found. Run seed script first.');
    process.exit(1);
  }

  console.log(`Using category: ${category.name} (${category.slug})`);

  // Create a test topic
  const insertTopic = db.prepare(`
    INSERT INTO forum_topics (
      category_id, user_id, title, content,
      username, user_display_name,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    RETURNING *
  `);

  const newTopic = insertTopic.get(
    category.id,
    1,
    'Test Topic with Soft Delete Support',
    'This is a test topic to verify that soft deletion columns work correctly.',
    'testuser',
    'Test User'
  );

  console.log(`\n✓ Created topic ID ${newTopic.id}: "${newTopic.title}"`);

  // Query non-deleted topics (should work now)
  const nonDeletedTopics = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM forum_topics
    WHERE category_id = ? AND deleted_at IS NULL
  `
    )
    .get(category.id);

  console.log(`\n✓ Found ${nonDeletedTopics.count} non-deleted topics in category`);

  // Test soft deletion
  console.log('\nTesting soft deletion...');

  const softDelete = db.prepare(`
    UPDATE forum_topics
    SET deleted_at = datetime('now'), deleted_by = ?
    WHERE id = ?
  `);

  softDelete.run(1, newTopic.id);
  console.log(`✓ Soft deleted topic ${newTopic.id}`);

  // Verify soft deleted topic is excluded
  const activeTopics = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM forum_topics
    WHERE category_id = ? AND deleted_at IS NULL
  `
    )
    .get(category.id);

  console.log(`✓ Active topics after soft delete: ${activeTopics.count}`);

  // Show all topics including soft deleted
  const allTopics = db
    .prepare(
      `
    SELECT id, title, deleted_at
    FROM forum_topics
    WHERE category_id = ?
    ORDER BY created_at DESC
  `
    )
    .all(category.id);

  console.log('\nAll topics in category (including soft deleted):');
  for (const topic of allTopics) {
    const status = topic.deleted_at ? ` [DELETED at ${topic.deleted_at}]` : '';
    console.log(`  - ID ${topic.id}: ${topic.title}${status}`);
  }

  db.close();
  console.log('\n✅ Soft deletion test completed successfully!');
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}
