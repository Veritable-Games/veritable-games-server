-- Project Metadata Schema
-- Creates project_metadata and project_sections tables in content.db
-- Required by ProjectService for workspace integration

-- ===================================================
-- Project Metadata Table
-- ===================================================
CREATE TABLE IF NOT EXISTS project_metadata (
  project_slug TEXT PRIMARY KEY,
  main_wiki_page_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived', 'draft', 'on_hold')),
  category TEXT,
  color TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  edit_locked INTEGER NOT NULL DEFAULT 0,
  last_major_edit TEXT,
  content_structure TEXT, -- JSON metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===================================================
-- Project Sections Table
-- ===================================================
CREATE TABLE IF NOT EXISTS project_sections (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL,
  section_key TEXT NOT NULL,
  wiki_page_id TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_slug) REFERENCES project_metadata(project_slug) ON DELETE CASCADE,
  UNIQUE(project_slug, section_key)
);

-- ===================================================
-- Indexes for Performance
-- ===================================================

-- Project Metadata Indexes
CREATE INDEX IF NOT EXISTS idx_project_metadata_status
  ON project_metadata(status);

CREATE INDEX IF NOT EXISTS idx_project_metadata_category
  ON project_metadata(category);

CREATE INDEX IF NOT EXISTS idx_project_metadata_display_order
  ON project_metadata(display_order);

-- Project Sections Indexes
CREATE INDEX IF NOT EXISTS idx_project_sections_project_slug
  ON project_sections(project_slug);

CREATE INDEX IF NOT EXISTS idx_project_sections_section_key
  ON project_sections(section_key);

CREATE INDEX IF NOT EXISTS idx_project_sections_display_order
  ON project_sections(project_slug, display_order);

CREATE INDEX IF NOT EXISTS idx_project_sections_visibility
  ON project_sections(is_visible);

-- ===================================================
-- Triggers for Auto-Update Timestamps
-- ===================================================

-- Project Metadata Triggers
CREATE TRIGGER IF NOT EXISTS update_project_metadata_timestamp
AFTER UPDATE ON project_metadata
FOR EACH ROW
BEGIN
  UPDATE project_metadata
  SET updated_at = datetime('now')
  WHERE project_slug = NEW.project_slug;
END;

-- Project Sections Triggers
CREATE TRIGGER IF NOT EXISTS update_project_sections_timestamp
AFTER UPDATE ON project_sections
FOR EACH ROW
BEGIN
  UPDATE project_sections
  SET updated_at = datetime('now')
  WHERE id = NEW.id;
END;

-- ===================================================
-- Initial Data for Existing Projects
-- ===================================================

-- Insert metadata for existing projects
INSERT OR IGNORE INTO project_metadata (project_slug, status, category, display_order) VALUES
  ('noxii', 'active', 'game', 1),
  ('autumn', 'active', 'game', 2),
  ('dodec', 'active', 'game', 3),
  ('on-command', 'active', 'game', 4),
  ('cosmic-knights', 'active', 'game', 5),
  ('project-coalesce', 'active', 'meta', 6);
