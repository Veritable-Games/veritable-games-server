-- Schema export from forums.db
-- Generated: 2025-10-28T19:14:12.584Z
-- SQLite version: 0

CREATE INDEX idx_forum_topics_status
    ON forum_topics(status)
  ;

CREATE INDEX idx_replies_deleted ON forum_replies(deleted_at);

CREATE INDEX idx_replies_parent ON forum_replies(parent_id);

CREATE INDEX idx_replies_topic ON forum_replies(topic_id);

CREATE INDEX idx_replies_user ON forum_replies(user_id);

CREATE INDEX idx_sections_sort_order ON forum_sections(sort_order);

CREATE TABLE forum_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#3B82F6',
        icon TEXT,
        section TEXT DEFAULT 'general',
        sort_order INTEGER DEFAULT 0,
        topic_count INTEGER DEFAULT 0,
        reply_count INTEGER DEFAULT 0,
        last_post_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      , is_public INTEGER DEFAULT 1);

CREATE TABLE forum_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER NOT NULL,
        parent_id INTEGER,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        content_format TEXT DEFAULT 'markdown',
        reply_depth INTEGER DEFAULT 0,
        path TEXT DEFAULT '',
        is_solution INTEGER DEFAULT 0,
        vote_score INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        deleted_by INTEGER,
        last_edited_at DATETIME,
        last_edited_by INTEGER
      );

CREATE VIRTUAL TABLE forum_search_fts USING fts5(
      content_id UNINDEXED,
      content_type UNINDEXED,
      title,
      content,
      author_username,
      category_name,
      category_id UNINDEXED,
      created_at UNINDEXED,
      vote_score UNINDEXED,
      topic_id UNINDEXED,
      is_locked UNINDEXED,
      is_pinned UNINDEXED,
      is_solved UNINDEXED,
      is_archived UNINDEXED,
      tokenize='porter unicode61 remove_diacritics 2'
    );

CREATE TABLE 'forum_search_fts_config'(k PRIMARY KEY, v) WITHOUT ROWID;

CREATE TABLE 'forum_search_fts_content'(id INTEGER PRIMARY KEY, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13);

CREATE TABLE 'forum_search_fts_data'(id INTEGER PRIMARY KEY, block BLOB);

CREATE TABLE 'forum_search_fts_docsize'(id INTEGER PRIMARY KEY, sz BLOB);

CREATE TABLE 'forum_search_fts_idx'(segid, term, pgno, PRIMARY KEY(segid, term)) WITHOUT ROWID;

CREATE TABLE forum_sections (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

CREATE TABLE "forum_topics" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        user_id INTEGER,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        content_format TEXT DEFAULT 'markdown',
        status INTEGER DEFAULT 0 NOT NULL,
        vote_score INTEGER DEFAULT 0,
        reply_count INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        deleted_by INTEGER,
        last_edited_at DATETIME,
        last_edited_by INTEGER
      );

CREATE TABLE sqlite_sequence(name,seq);

CREATE TRIGGER forum_fts_reply_delete
    AFTER DELETE ON forum_replies
    BEGIN
      DELETE FROM forum_search_fts WHERE content_id = old.id AND content_type = 'reply';
    END;

CREATE TRIGGER forum_fts_reply_insert
    AFTER INSERT ON forum_replies
    BEGIN
      INSERT INTO forum_search_fts (
        content_id, content_type, title, content, author_username,
        category_name, category_id, created_at, vote_score,
        topic_id, is_locked, is_pinned, is_solved, is_archived
      )
      SELECT
        new.id, 'reply', NULL, new.content,
        'unknown',
        c.name, t.category_id, new.created_at, new.vote_score,
        new.topic_id,
        (t.status & 1) > 0 AS is_locked,    -- Inherit from topic
        (t.status & 2) > 0 AS is_pinned,
        (t.status & 4) > 0 AS is_solved,
        (t.status & 8) > 0 AS is_archived
      FROM forum_topics t
      LEFT JOIN forum_categories c ON t.category_id = c.id
      WHERE t.id = new.topic_id;
    END;

CREATE TRIGGER forum_fts_reply_update
    AFTER UPDATE ON forum_replies
    BEGIN
      DELETE FROM forum_search_fts WHERE content_id = old.id AND content_type = 'reply';

      INSERT INTO forum_search_fts (
        content_id, content_type, title, content, author_username,
        category_name, category_id, created_at, vote_score,
        topic_id, is_locked, is_pinned, is_solved, is_archived
      )
      SELECT
        new.id, 'reply', NULL, new.content,
        'unknown',
        c.name, t.category_id, new.created_at, new.vote_score,
        new.topic_id,
        (t.status & 1) > 0 AS is_locked,
        (t.status & 2) > 0 AS is_pinned,
        (t.status & 4) > 0 AS is_solved,
        (t.status & 8) > 0 AS is_archived
      FROM forum_topics t
      LEFT JOIN forum_categories c ON t.category_id = c.id
      WHERE t.id = new.topic_id;
    END;

CREATE TRIGGER forum_fts_topic_delete
    AFTER DELETE ON forum_topics
    BEGIN
      DELETE FROM forum_search_fts WHERE content_id = old.id AND content_type = 'topic';
    END;

CREATE TRIGGER forum_fts_topic_insert
    AFTER INSERT ON forum_topics
    BEGIN
      INSERT INTO forum_search_fts (
        content_id, content_type, title, content, author_username,
        category_name, category_id, created_at, vote_score,
        topic_id, is_locked, is_pinned, is_solved, is_archived
      )
      SELECT
        new.id, 'topic', new.title, new.content,
        'unknown',
        c.name, new.category_id, new.created_at, new.vote_score,
        new.id,
        (new.status & 1) > 0 AS is_locked,    -- Bit 0: LOCKED
        (new.status & 2) > 0 AS is_pinned,    -- Bit 1: PINNED
        (new.status & 4) > 0 AS is_solved,    -- Bit 2: SOLVED
        (new.status & 8) > 0 AS is_archived   -- Bit 3: ARCHIVED
      FROM forum_categories c
      WHERE c.id = new.category_id;
    END;

CREATE TRIGGER forum_fts_topic_update
    AFTER UPDATE ON forum_topics
    BEGIN
      DELETE FROM forum_search_fts WHERE content_id = old.id AND content_type = 'topic';

      INSERT INTO forum_search_fts (
        content_id, content_type, title, content, author_username,
        category_name, category_id, created_at, vote_score,
        topic_id, is_locked, is_pinned, is_solved, is_archived
      )
      SELECT
        new.id, 'topic', new.title, new.content,
        'unknown',
        c.name, new.category_id, new.created_at, new.vote_score,
        new.id,
        (new.status & 1) > 0 AS is_locked,
        (new.status & 2) > 0 AS is_pinned,
        (new.status & 4) > 0 AS is_solved,
        (new.status & 8) > 0 AS is_archived
      FROM forum_categories c
      WHERE c.id = new.category_id;
    END;