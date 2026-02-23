-- Migration: Add Forum Tags System
-- Purpose: Create tables for topic tagging functionality
-- Date: 2025-10-13
-- Part of: Forum v0.36 restoration (Phase 1.3)

-- ============================================================================
-- Tags Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS tags (
  -- Primary Key
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Tag Information
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT, -- Hex color code (optional, inherits from category if null)

  -- Usage Statistics
  usage_count INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- Topic-Tags Junction Table (Many-to-Many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS topic_tags (
  -- Composite Primary Key
  topic_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Primary Key
  PRIMARY KEY (topic_id, tag_id),

  -- Foreign Keys
  FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Tag lookup by name (for autocomplete)
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Tag lookup by slug (for URLs)
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);

-- Tag popularity (for trending tags)
CREATE INDEX IF NOT EXISTS idx_tags_usage_count ON tags(usage_count DESC);

-- Topic lookup by tag
CREATE INDEX IF NOT EXISTS idx_topic_tags_tag_id ON topic_tags(tag_id);

-- Tag lookup by topic
CREATE INDEX IF NOT EXISTS idx_topic_tags_topic_id ON topic_tags(topic_id);

-- ============================================================================
-- Triggers for Data Integrity
-- ============================================================================

-- Update tag usage_count when topic_tags row is added
CREATE TRIGGER IF NOT EXISTS trg_topic_tags_insert_update_usage
AFTER INSERT ON topic_tags
BEGIN
  UPDATE tags
  SET usage_count = (
    SELECT COUNT(*)
    FROM topic_tags
    WHERE tag_id = NEW.tag_id
  )
  WHERE id = NEW.tag_id;
END;

-- Update tag usage_count when topic_tags row is deleted
CREATE TRIGGER IF NOT EXISTS trg_topic_tags_delete_update_usage
AFTER DELETE ON topic_tags
BEGIN
  UPDATE tags
  SET usage_count = (
    SELECT COUNT(*)
    FROM topic_tags
    WHERE tag_id = OLD.tag_id
  )
  WHERE id = OLD.tag_id;
END;

-- Update tags.updated_at timestamp on modification
CREATE TRIGGER IF NOT EXISTS trg_tags_update_timestamp
AFTER UPDATE ON tags
BEGIN
  UPDATE tags
  SET updated_at = datetime('now')
  WHERE id = NEW.id;
END;

-- ============================================================================
-- Seed Data (Common Forum Tags)
-- ============================================================================

INSERT OR IGNORE INTO tags (name, slug, description) VALUES
  ('question', 'question', 'Questions seeking answers or advice'),
  ('discussion', 'discussion', 'General discussions and conversations'),
  ('bug', 'bug', 'Bug reports and technical issues'),
  ('feature-request', 'feature-request', 'Suggestions for new features'),
  ('help', 'help', 'Requests for assistance'),
  ('tutorial', 'tutorial', 'Guides and how-to content'),
  ('announcement', 'announcement', 'Official announcements'),
  ('feedback', 'feedback', 'User feedback and suggestions'),
  ('showcase', 'showcase', 'Show off your work'),
  ('meta', 'meta', 'Discussion about the forum itself');

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check tables exist
-- SELECT name FROM sqlite_master WHERE type='table' AND name IN ('tags', 'topic_tags');

-- Check indexes exist
-- SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_tag%';

-- Check triggers exist
-- SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_%tag%';

-- Count tags
-- SELECT COUNT(*) as tag_count FROM tags;

-- Count topic-tag relationships
-- SELECT COUNT(*) as relationship_count FROM topic_tags;
