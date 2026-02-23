#!/usr/bin/env node

/**
 * Seed the forums database with test data
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'forums.db');

console.log('Seeding forums database with test data...');
console.log('Database path:', dbPath);

try {
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Start transaction
  const seed = db.transaction(() => {
    // Check if categories already exist
    const existingCategories = db.prepare('SELECT COUNT(*) as count FROM forum_categories').get();

    if (existingCategories.count > 0) {
      console.log(`Database already has ${existingCategories.count} categories. Skipping seed.`);
      return;
    }

    // Insert categories
    console.log('Creating forum categories...');
    const insertCategory = db.prepare(`
      INSERT INTO forum_categories (slug, name, description, color, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    const categories = [
      {
        slug: 'general',
        name: 'General Discussion',
        description: 'General community discussions and conversations',
        color: '#3B82F6',
        sort_order: 1,
      },
      {
        slug: 'game-dev',
        name: 'Game Development',
        description: 'Technical discussions about game development, engines, and tools',
        color: '#8B5CF6',
        sort_order: 2,
      },
      {
        slug: 'showcase',
        name: 'Project Showcase',
        description: 'Share your projects, get feedback, and celebrate achievements',
        color: '#10B981',
        sort_order: 3,
      },
      {
        slug: 'help',
        name: 'Help & Support',
        description: 'Get help with technical issues and ask questions',
        color: '#F59E0B',
        sort_order: 4,
      },
      {
        slug: 'off-topic',
        name: 'Off Topic',
        description: 'Casual conversations about anything and everything',
        color: '#EC4899',
        sort_order: 5,
      },
    ];

    for (const cat of categories) {
      const result = insertCategory.run(
        cat.slug,
        cat.name,
        cat.description,
        cat.color,
        cat.sort_order
      );
      console.log(`  ✓ Created category: ${cat.name} (ID: ${result.lastInsertRowid})`);
    }

    // Create some test topics (optional)
    console.log('\nCreating sample topics...');
    const insertTopic = db.prepare(`
      INSERT INTO forum_topics (
        category_id, user_id, title, content,
        username, user_display_name,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const generalCategoryId = db
      .prepare("SELECT id FROM forum_categories WHERE slug = 'general'")
      .get().id;
    const gameDevCategoryId = db
      .prepare("SELECT id FROM forum_categories WHERE slug = 'game-dev'")
      .get().id;

    const topics = [
      {
        category_id: generalCategoryId,
        user_id: 1,
        title: 'Welcome to Veritable Games Forums!',
        content:
          'Welcome everyone! This is the new forums system for our community. Feel free to introduce yourself and start discussions!',
        username: 'admin',
        user_display_name: 'Administrator',
        is_pinned: true,
      },
      {
        category_id: generalCategoryId,
        user_id: 2,
        title: 'Community Guidelines and Rules',
        content:
          'Please read through our community guidelines to ensure a positive experience for everyone.',
        username: 'moderator',
        user_display_name: 'Community Mod',
      },
      {
        category_id: gameDevCategoryId,
        user_id: 3,
        title: 'Best game engines for beginners?',
        content:
          "I'm new to game development and wondering what engine would be best to start with. Any recommendations?",
        username: 'gamedev123',
        user_display_name: null,
      },
    ];

    for (const topic of topics) {
      const result = insertTopic.run(
        topic.category_id,
        topic.user_id,
        topic.title,
        topic.content,
        topic.username,
        topic.user_display_name
      );

      // Update pinned status if needed
      if (topic.is_pinned) {
        db.prepare('UPDATE forum_topics SET is_pinned = 1 WHERE id = ?').run(
          result.lastInsertRowid
        );
      }

      console.log(`  ✓ Created topic: ${topic.title} (ID: ${result.lastInsertRowid})`);
    }

    // Add some sample replies
    console.log('\nCreating sample replies...');
    const insertReply = db.prepare(`
      INSERT INTO forum_replies (
        topic_id, user_id, content,
        username, user_display_name,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const firstTopicId = db.prepare('SELECT id FROM forum_topics ORDER BY id LIMIT 1').get().id;

    const replies = [
      {
        topic_id: firstTopicId,
        user_id: 4,
        content: 'Great to see the new forums up and running!',
        username: 'user1',
        user_display_name: 'Excited User',
      },
      {
        topic_id: firstTopicId,
        user_id: 5,
        content: 'Looking forward to participating in the community!',
        username: 'newbie',
        user_display_name: null,
      },
    ];

    for (const reply of replies) {
      const result = insertReply.run(
        reply.topic_id,
        reply.user_id,
        reply.content,
        reply.username,
        reply.user_display_name
      );
      console.log(`  ✓ Created reply (ID: ${result.lastInsertRowid})`);

      // Update topic's reply count and last_reply_at
      db.prepare(
        `
        UPDATE forum_topics
        SET reply_count = reply_count + 1,
            last_reply_at = datetime('now'),
            last_reply_user_id = ?,
            last_reply_username = ?
        WHERE id = ?
      `
      ).run(reply.user_id, reply.username, reply.topic_id);
    }

    // Update category counts
    console.log('\nUpdating category statistics...');
    db.prepare(
      `
      UPDATE forum_categories
      SET topic_count = (
        SELECT COUNT(*) FROM forum_topics
        WHERE category_id = forum_categories.id
        AND deleted_at IS NULL
      ),
      reply_count = (
        SELECT COUNT(*) FROM forum_replies
        WHERE topic_id IN (
          SELECT id FROM forum_topics
          WHERE category_id = forum_categories.id
          AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
      )
    `
    ).run();
  });

  // Execute seeding
  seed();

  // Show final stats
  const stats = {
    categories: db.prepare('SELECT COUNT(*) as count FROM forum_categories').get().count,
    topics: db.prepare('SELECT COUNT(*) as count FROM forum_topics WHERE deleted_at IS NULL').get()
      .count,
    replies: db
      .prepare('SELECT COUNT(*) as count FROM forum_replies WHERE deleted_at IS NULL')
      .get().count,
  };

  console.log('\n✅ Seeding completed!');
  console.log('\nDatabase now contains:');
  console.log(`  - ${stats.categories} categories`);
  console.log(`  - ${stats.topics} topics`);
  console.log(`  - ${stats.replies} replies`);

  // List categories
  console.log('\nAvailable categories:');
  const categories = db
    .prepare('SELECT slug, name FROM forum_categories ORDER BY sort_order')
    .all();
  for (const cat of categories) {
    console.log(`  - /forums/category/${cat.slug} - ${cat.name}`);
  }

  db.close();
} catch (error) {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
}
