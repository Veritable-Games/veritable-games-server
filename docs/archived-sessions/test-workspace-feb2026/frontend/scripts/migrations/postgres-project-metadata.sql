-- PostgreSQL Migration: Project Metadata and Sections
-- Creates project_metadata and project_sections tables in content schema
-- Required by ProjectService for workspace integration
-- Date: 2025-11-27

-- ===================================================
-- Project Metadata Table
-- ===================================================
CREATE TABLE IF NOT EXISTS content.project_metadata (
  project_slug TEXT PRIMARY KEY,
  main_wiki_page_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived', 'draft', 'on_hold')),
  category TEXT,
  color TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  edit_locked BOOLEAN NOT NULL DEFAULT false,
  last_major_edit TEXT,
  content_structure TEXT, -- JSON metadata
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ===================================================
-- Project Sections Table
-- ===================================================
CREATE TABLE IF NOT EXISTS content.project_sections (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL,
  section_key TEXT NOT NULL,
  wiki_page_id TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_slug) REFERENCES content.project_metadata(project_slug) ON DELETE CASCADE,
  UNIQUE(project_slug, section_key)
);

-- ===================================================
-- Indexes for Performance
-- ===================================================

-- Project Metadata Indexes
CREATE INDEX IF NOT EXISTS idx_project_metadata_status
  ON content.project_metadata(status);

CREATE INDEX IF NOT EXISTS idx_project_metadata_category
  ON content.project_metadata(category);

CREATE INDEX IF NOT EXISTS idx_project_metadata_display_order
  ON content.project_metadata(display_order);

-- Project Sections Indexes
CREATE INDEX IF NOT EXISTS idx_project_sections_project_slug
  ON content.project_sections(project_slug);

CREATE INDEX IF NOT EXISTS idx_project_sections_section_key
  ON content.project_sections(section_key);

CREATE INDEX IF NOT EXISTS idx_project_sections_display_order
  ON content.project_sections(project_slug, display_order);

CREATE INDEX IF NOT EXISTS idx_project_sections_visibility
  ON content.project_sections(is_visible);

-- ===================================================
-- Triggers for Auto-Update Timestamps
-- ===================================================

-- Project Metadata Trigger
CREATE OR REPLACE FUNCTION update_project_metadata_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_project_metadata_timestamp ON content.project_metadata;
CREATE TRIGGER update_project_metadata_timestamp
BEFORE UPDATE ON content.project_metadata
FOR EACH ROW
EXECUTE FUNCTION update_project_metadata_timestamp();

-- Project Sections Trigger
CREATE OR REPLACE FUNCTION update_project_sections_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_project_sections_timestamp ON content.project_sections;
CREATE TRIGGER update_project_sections_timestamp
BEFORE UPDATE ON content.project_sections
FOR EACH ROW
EXECUTE FUNCTION update_project_sections_timestamp();

-- ===================================================
-- Initial Data for Existing Projects
-- ===================================================

-- Insert metadata for existing projects (only if they exist in content.projects)
INSERT INTO content.project_metadata (project_slug, status, category, display_order)
SELECT slug, 'active',
  CASE
    WHEN slug IN ('noxii', 'autumn', 'dodec', 'on-command', 'cosmic-knights') THEN 'game'
    WHEN slug = 'project-coalesce' THEN 'meta'
    ELSE 'other'
  END as category,
  CASE
    WHEN slug = 'noxii' THEN 1
    WHEN slug = 'autumn' THEN 2
    WHEN slug = 'dodec' THEN 3
    WHEN slug = 'on-command' THEN 4
    WHEN slug = 'cosmic-knights' THEN 5
    WHEN slug = 'project-coalesce' THEN 6
    ELSE 999
  END as display_order
FROM content.projects
WHERE slug IN ('noxii', 'autumn', 'dodec', 'on-command', 'cosmic-knights', 'project-coalesce')
ON CONFLICT (project_slug) DO NOTHING;
