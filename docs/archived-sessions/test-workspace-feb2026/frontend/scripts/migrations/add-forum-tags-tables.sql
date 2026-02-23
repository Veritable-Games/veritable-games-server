-- ============================================================================
-- Add Forum Tags Tables to PostgreSQL
-- ============================================================================
-- This migration adds the forum_tags and forum_topic_tags tables that were
-- defined in the SQLite schema but not migrated to PostgreSQL.
--
-- These tables support tagging functionality for forum topics.
--
-- Run this migration when ready to enable tags feature:
--   psql -U postgres -d veritable_games -f scripts/migrations/add-forum-tags-tables.sql
-- ============================================================================

BEGIN;

-- ========================================
-- FORUM TAGS
-- ========================================
CREATE TABLE IF NOT EXISTS forums.forum_tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#64748b',
  usage_count INTEGER DEFAULT 0 NOT NULL CHECK (usage_count >= 0),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,

  CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

-- ========================================
-- FORUM TOPIC TAGS (Junction Table)
-- ========================================
CREATE TABLE IF NOT EXISTS forums.topic_tags (
  topic_id BIGINT NOT NULL,
  tag_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,

  PRIMARY KEY (topic_id, tag_id),
  FOREIGN KEY (topic_id) REFERENCES forums.forum_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES forums.forum_tags(id) ON DELETE CASCADE
);

-- ========================================
-- INDEXES
-- ========================================
CREATE INDEX IF NOT EXISTS idx_tags_slug
  ON forums.forum_tags(slug);

CREATE INDEX IF NOT EXISTS idx_tags_usage
  ON forums.forum_tags(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_topic_tags_tag
  ON forums.topic_tags(tag_id, topic_id);

CREATE INDEX IF NOT EXISTS idx_topic_tags_topic
  ON forums.topic_tags(topic_id, tag_id);

-- ========================================
-- TRIGGERS
-- ========================================

-- Increment tag usage on insert
CREATE OR REPLACE FUNCTION forums.increment_tag_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE forums.forum_tags
  SET usage_count = usage_count + 1
  WHERE id = NEW.tag_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER topic_tags_insert_count
AFTER INSERT ON forums.topic_tags
FOR EACH ROW
EXECUTE FUNCTION forums.increment_tag_usage();

-- Decrement tag usage on delete
CREATE OR REPLACE FUNCTION forums.decrement_tag_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE forums.forum_tags
  SET usage_count = usage_count - 1
  WHERE id = OLD.tag_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER topic_tags_delete_count
AFTER DELETE ON forums.topic_tags
FOR EACH ROW
EXECUTE FUNCTION forums.decrement_tag_usage();

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
-- Verify tables were created:
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'forums'
  AND table_name IN ('forum_tags', 'topic_tags')
ORDER BY table_name;
