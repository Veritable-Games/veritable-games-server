#!/usr/bin/env node

/**
 * Migrate Forum Data from Backup to New Database
 *
 * This script restores forum topics and replies from the backup database
 * to the newly created forums.db with the correct schema.
 */

const Database = require('better-sqlite3');
const path = require('path');

// Use the v0.36 database as the source
const BACKUP_PATH = '/home/user/Projects/web/web-0.36/veritable-games-main/frontend/data/forums.db';
const NEW_DB_PATH = path.join(__dirname, '../data/forums.db');

console.log('=== FORUM DATA MIGRATION ===\n');

// Open databases
const backupDb = new Database(BACKUP_PATH, { readonly: true });
const newDb = new Database(NEW_DB_PATH);

try {
  // Get category ID mapping (old slug -> new ID)
  console.log('Building category mapping...');
  const oldCategories = backupDb.prepare('SELECT id, slug FROM forum_categories').all();
  const categoryMap = new Map();

  oldCategories.forEach(oldCat => {
    const newCat = newDb.prepare('SELECT id FROM forum_categories WHERE slug = ?').get(oldCat.slug);
    if (newCat) {
      categoryMap.set(oldCat.id, newCat.id);
      console.log(`  ${oldCat.slug}: ${oldCat.id} -> ${newCat.id}`);
    } else {
      console.warn(`  Warning: Category ${oldCat.slug} not found in new database`);
    }
  });

  console.log('');

  // Migrate topics
  console.log('Migrating topics...');
  const topics = backupDb
    .prepare(
      `
    SELECT * FROM forum_topics
    WHERE deleted_at IS NULL
    ORDER BY id
  `
    )
    .all();

  const topicIdMap = new Map();
  let migratedTopics = 0;

  topics.forEach(topic => {
    const newCategoryId = categoryMap.get(topic.category_id);
    if (!newCategoryId) {
      console.warn(`  Skipping topic #${topic.id} - category not found`);
      return;
    }

    try {
      const result = newDb
        .prepare(
          `
        INSERT INTO forum_topics (
          category_id, user_id, title, content, content_format,
          is_locked, is_pinned, is_solved, status, vote_score,
          reply_count, view_count, created_at, updated_at, last_activity_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          newCategoryId,
          topic.user_id,
          topic.title,
          topic.content,
          topic.content_format || 'markdown',
          topic.is_locked || 0,
          topic.is_pinned || 0,
          topic.is_solved || 0,
          topic.status || 'open',
          topic.vote_score || 0,
          topic.reply_count || 0,
          topic.view_count || 0,
          topic.created_at,
          topic.updated_at,
          topic.last_activity_at || topic.created_at
        );

      topicIdMap.set(topic.id, result.lastInsertRowid);
      migratedTopics++;
      console.log(`  ✓ Topic #${topic.id} -> #${result.lastInsertRowid}: ${topic.title}`);
    } catch (error) {
      console.error(`  ✗ Failed to migrate topic #${topic.id}:`, error.message);
    }
  });

  console.log(`\nMigrated ${migratedTopics}/${topics.length} topics\n`);

  // Migrate replies
  console.log('Migrating replies...');
  const replies = backupDb
    .prepare(
      `
    SELECT * FROM forum_replies
    WHERE deleted_at IS NULL
    ORDER BY id
  `
    )
    .all();

  let migratedReplies = 0;
  const replyIdMap = new Map();

  replies.forEach(reply => {
    const newTopicId = topicIdMap.get(reply.topic_id);
    if (!newTopicId) {
      console.warn(`  Skipping reply #${reply.id} - topic not found`);
      return;
    }

    const newParentId = reply.parent_id ? replyIdMap.get(reply.parent_id) : null;

    try {
      const result = newDb
        .prepare(
          `
        INSERT INTO forum_replies (
          topic_id, parent_id, user_id, content, content_format,
          reply_depth, path, is_solution, vote_score,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          newTopicId,
          newParentId,
          reply.user_id,
          reply.content,
          reply.content_format || 'markdown',
          reply.reply_depth || 0,
          reply.path || '',
          reply.is_solution || 0,
          reply.vote_score || 0,
          reply.created_at,
          reply.updated_at
        );

      replyIdMap.set(reply.id, result.lastInsertRowid);
      migratedReplies++;
      console.log(`  ✓ Reply #${reply.id} -> #${result.lastInsertRowid}`);
    } catch (error) {
      console.error(`  ✗ Failed to migrate reply #${reply.id}:`, error.message);
    }
  });

  console.log(`\nMigrated ${migratedReplies}/${replies.length} replies\n`);

  // Update category counts
  console.log('Updating category counts...');
  newDb.exec(`
    UPDATE forum_categories SET topic_count = (
      SELECT COUNT(*) FROM forum_topics
      WHERE category_id = forum_categories.id AND deleted_at IS NULL
    );

    UPDATE forum_categories SET reply_count = (
      SELECT COUNT(DISTINCT r.id)
      FROM forum_replies r
      JOIN forum_topics t ON r.topic_id = t.id
      WHERE t.category_id = forum_categories.id
        AND r.deleted_at IS NULL
        AND t.deleted_at IS NULL
    );
  `);
  console.log('  ✓ Category counts updated\n');

  // Summary
  console.log('=== MIGRATION COMPLETE ===');
  console.log(`Categories: ${categoryMap.size}`);
  console.log(`Topics: ${migratedTopics}/${topics.length}`);
  console.log(`Replies: ${migratedReplies}/${replies.length}`);

  // Show final stats
  const finalStats = newDb
    .prepare(
      `
    SELECT
      (SELECT COUNT(*) FROM forum_categories) as categories,
      (SELECT COUNT(*) FROM forum_topics WHERE deleted_at IS NULL) as topics,
      (SELECT COUNT(*) FROM forum_replies WHERE deleted_at IS NULL) as replies
  `
    )
    .get();

  console.log('\nFinal database state:');
  console.log(`  Categories: ${finalStats.categories}`);
  console.log(`  Topics: ${finalStats.topics}`);
  console.log(`  Replies: ${finalStats.replies}`);
} catch (error) {
  console.error('\n✗ Migration failed:', error.message);
  console.error(error.stack);
  process.exit(1);
} finally {
  backupDb.close();
  newDb.close();
}

console.log('\n✓ Migration script finished successfully!\n');
