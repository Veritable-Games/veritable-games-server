-- Content Tracing System Migration
-- Enables "tracing paper" editing where AI content becomes background
-- and human-written content overlays at character-level positions

-- Add tracing columns to projects table
ALTER TABLE content.projects
  ADD COLUMN IF NOT EXISTS background_content TEXT,
  ADD COLUMN IF NOT EXISTS tracing_enabled BOOLEAN DEFAULT FALSE;

-- Create traced content table for storing human-written overlays
CREATE TABLE IF NOT EXISTS content.project_traced_content (
  id SERIAL PRIMARY KEY,
  project_slug TEXT NOT NULL,

  -- Anchor positioning (where in background this trace is positioned)
  anchor_type TEXT NOT NULL DEFAULT 'character',  -- 'character' | 'freeform'
  anchor_start_offset INTEGER,  -- Character offset in background content
  anchor_end_offset INTEGER,    -- End of anchor range
  anchor_text TEXT,             -- Cached original text being traced

  -- Freeform positioning (for traces not anchored to specific text)
  freeform_x FLOAT,  -- 0-100 percentage from left
  freeform_y FLOAT,  -- 0-100 percentage from top

  -- The traced (human-written) content
  traced_content TEXT NOT NULL,

  -- Metadata
  author_id INTEGER,
  author_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'published' | 'archived'
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT fk_traced_project FOREIGN KEY (project_slug)
    REFERENCES content.projects(slug) ON DELETE CASCADE,
  CONSTRAINT valid_anchor_type CHECK(anchor_type IN ('character', 'freeform')),
  CONSTRAINT valid_status CHECK(status IN ('draft', 'published', 'archived'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_traced_content_project
  ON content.project_traced_content(project_slug);

CREATE INDEX IF NOT EXISTS idx_traced_content_status
  ON content.project_traced_content(status);

CREATE INDEX IF NOT EXISTS idx_traced_content_anchor
  ON content.project_traced_content(project_slug, anchor_start_offset, anchor_end_offset)
  WHERE anchor_type = 'character';

-- Traced content revisions table (only human content gets versioned)
CREATE TABLE IF NOT EXISTS content.project_traced_content_revisions (
  id SERIAL PRIMARY KEY,
  traced_content_id INTEGER NOT NULL,
  traced_content TEXT NOT NULL,
  author_id INTEGER,
  author_name TEXT NOT NULL,
  summary TEXT,
  revision_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  size_bytes INTEGER NOT NULL,

  CONSTRAINT fk_traced_revision FOREIGN KEY (traced_content_id)
    REFERENCES content.project_traced_content(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_traced_revisions_content
  ON content.project_traced_content_revisions(traced_content_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION content.update_traced_content_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS traced_content_updated ON content.project_traced_content;

CREATE TRIGGER traced_content_updated
  BEFORE UPDATE ON content.project_traced_content
  FOR EACH ROW
  EXECUTE FUNCTION content.update_traced_content_timestamp();

-- Trigger to create revision on update
CREATE OR REPLACE FUNCTION content.create_traced_content_revision()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.traced_content IS DISTINCT FROM NEW.traced_content THEN
    INSERT INTO content.project_traced_content_revisions (
      traced_content_id,
      traced_content,
      author_id,
      author_name,
      summary,
      size_bytes
    ) VALUES (
      OLD.id,
      OLD.traced_content,
      OLD.author_id,
      OLD.author_name,
      'Auto-saved previous version',
      LENGTH(OLD.traced_content)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS traced_content_revision_trigger ON content.project_traced_content;

CREATE TRIGGER traced_content_revision_trigger
  BEFORE UPDATE ON content.project_traced_content
  FOR EACH ROW
  EXECUTE FUNCTION content.create_traced_content_revision();
