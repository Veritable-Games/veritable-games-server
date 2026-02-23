#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'forums.db');

console.log('Fixing FTS5 triggers...\n');

const db = new Database(DB_PATH);

try {
  // Drop old triggers
  console.log('Dropping old triggers...');
  db.exec(`
    DROP TRIGGER IF EXISTS forum_fts_topic_insert;
    DROP TRIGGER IF EXISTS forum_fts_topic_update;
    DROP TRIGGER IF EXISTS forum_fts_reply_insert;
    DROP TRIGGER IF EXISTS forum_fts_reply_update;
  `);

  // Recreate triggers with correct JOIN to users table
  console.log('Creating new triggers...');
  db.exec(`
    CREATE TRIGGER forum_fts_topic_insert
    AFTER INSERT ON forum_topics
    BEGIN
      INSERT INTO forum_search_fts (
        content_id, content_type, title, content, author_username,
        category_name, category_id, created_at, vote_score,
        topic_id, is_locked, is_pinned
      )
      SELECT
        new.id, 'topic', new.title, new.content,
        COALESCE(u.username, 'anonymous'),
        c.name, new.category_id, new.created_at, new.vote_score,
        new.id, new.is_locked, new.is_pinned
      FROM forum_categories c
      LEFT JOIN users u ON u.id = new.user_id
      WHERE c.id = new.category_id;
    END;

    CREATE TRIGGER forum_fts_topic_update
    AFTER UPDATE ON forum_topics
    BEGIN
      DELETE FROM forum_search_fts WHERE content_id = old.id AND content_type = 'topic';

      INSERT INTO forum_search_fts (
        content_id, content_type, title, content, author_username,
        category_name, category_id, created_at, vote_score,
        topic_id, is_locked, is_pinned
      )
      SELECT
        new.id, 'topic', new.title, new.content,
        COALESCE(u.username, 'anonymous'),
        c.name, new.category_id, new.created_at, new.vote_score,
        new.id, new.is_locked, new.is_pinned
      FROM forum_categories c
      LEFT JOIN users u ON u.id = new.user_id
      WHERE c.id = new.category_id;
    END;

    CREATE TRIGGER forum_fts_reply_insert
    AFTER INSERT ON forum_replies
    BEGIN
      INSERT INTO forum_search_fts (
        content_id, content_type, title, content, author_username,
        category_name, category_id, created_at, vote_score,
        topic_id, is_locked, is_pinned
      )
      SELECT
        new.id, 'reply', NULL, new.content,
        COALESCE(u.username, 'anonymous'),
        c.name, t.category_id, new.created_at, new.vote_score,
        new.topic_id, 0, 0
      FROM forum_topics t
      LEFT JOIN forum_categories c ON t.category_id = c.id
      LEFT JOIN users u ON u.id = new.user_id
      WHERE t.id = new.topic_id;
    END;

    CREATE TRIGGER forum_fts_reply_update
    AFTER UPDATE ON forum_replies
    BEGIN
      DELETE FROM forum_search_fts WHERE content_id = old.id AND content_type = 'reply';

      INSERT INTO forum_search_fts (
        content_id, content_type, title, content, author_username,
        category_name, category_id, created_at, vote_score,
        topic_id, is_locked, is_pinned
      )
      SELECT
        new.id, 'reply', NULL, new.content,
        COALESCE(u.username, 'anonymous'),
        c.name, t.category_id, new.created_at, new.vote_score,
        new.topic_id, 0, 0
      FROM forum_topics t
      LEFT JOIN forum_categories c ON t.category_id = c.id
      LEFT JOIN users u ON u.id = new.user_id
      WHERE t.id = new.topic_id;
    END;
  `);

  // Rebuild FTS5 data with correct usernames
  console.log('Rebuilding FTS5 search index...');
  db.exec(`DELETE FROM forum_search_fts;`);

  db.exec(`
    INSERT INTO forum_search_fts (
      content_id, content_type, title, content, author_username,
      category_name, category_id, created_at, vote_score,
      topic_id, is_locked, is_pinned
    )
    SELECT
      t.id, 'topic', t.title, t.content,
      COALESCE(u.username, 'anonymous'),
      c.name, t.category_id, t.created_at, t.vote_score,
      t.id, t.is_locked, t.is_pinned
    FROM forum_topics t
    LEFT JOIN forum_categories c ON t.category_id = c.id
    LEFT JOIN users u ON u.id = t.user_id;
  `);

  db.exec(`
    INSERT INTO forum_search_fts (
      content_id, content_type, title, content, author_username,
      category_name, category_id, created_at, vote_score,
      topic_id, is_locked, is_pinned
    )
    SELECT
      r.id, 'reply', NULL, r.content,
      COALESCE(u.username, 'anonymous'),
      c.name, t.category_id, r.created_at, r.vote_score,
      r.topic_id, 0, 0
    FROM forum_replies r
    LEFT JOIN forum_topics t ON r.topic_id = t.id
    LEFT JOIN forum_categories c ON t.category_id = c.id
    LEFT JOIN users u ON u.id = r.user_id;
  `);

  const count = db.prepare('SELECT COUNT(*) as count FROM forum_search_fts').get();
  console.log(`\n✅ Fixed! FTS5 index now has ${count.count} entries.`);
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  db.close();
}
