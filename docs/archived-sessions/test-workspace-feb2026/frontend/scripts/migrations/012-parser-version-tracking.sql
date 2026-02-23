-- Phase 4: Parser Version Tracking
-- Adds support for tracking which parser version indexed each Godot version
-- Enables automatic detection of stale versions that need re-indexing

-- Add parser_version column to track which parser indexed the graph
ALTER TABLE content.godot_dependency_graph
ADD COLUMN IF NOT EXISTS parser_version TEXT;

-- Create index for efficient stale version queries
CREATE INDEX IF NOT EXISTS idx_godot_dependency_graph_parser_version
ON content.godot_dependency_graph(parser_version);

-- Helper function to find versions indexed with a specific parser version
CREATE OR REPLACE FUNCTION content.get_versions_by_parser_version(target_parser TEXT)
RETURNS TABLE(version_id INTEGER, project_slug TEXT, version_tag TEXT, parser_version TEXT, indexed_at TIMESTAMP)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.project_slug,
    v.version_tag,
    g.parser_version,
    g.parsed_at
  FROM content.godot_versions v
  LEFT JOIN content.godot_dependency_graph g ON v.id = g.version_id
  WHERE g.parser_version = target_parser
  ORDER BY v.project_slug, v.version_tag;
END;
$$ LANGUAGE plpgsql;

-- Helper function to find stale versions (indexed with old or no parser)
CREATE OR REPLACE FUNCTION content.get_stale_godot_versions(current_parser_version TEXT)
RETURNS TABLE(version_id INTEGER, project_slug TEXT, version_tag TEXT, target_parser TEXT, indexed_with TEXT, is_stale BOOLEAN)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.project_slug,
    v.version_tag,
    current_parser_version::TEXT,
    g.parser_version,
    (g.parser_version IS NULL OR g.parser_version != current_parser_version) AS is_stale
  FROM content.godot_versions v
  LEFT JOIN content.godot_dependency_graph g ON v.id = g.version_id
  WHERE g.parser_version IS NULL OR g.parser_version != current_parser_version
  ORDER BY v.project_slug, v.version_tag;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for quick stale version reporting
CREATE MATERIALIZED VIEW IF NOT EXISTS content.stale_godot_versions AS
SELECT
  v.id AS version_id,
  v.project_slug,
  v.version_tag,
  g.parser_version,
  g.parsed_at,
  CASE
    WHEN g.parser_version IS NULL THEN 'never_indexed'
    WHEN g.parser_version < '2025-12-28' THEN 'old_parser'
    ELSE 'current'
  END AS staleness_reason
FROM content.godot_versions v
LEFT JOIN content.godot_dependency_graph g ON v.id = g.version_id
ORDER BY v.project_slug, v.version_tag;

-- Index for efficient lookups on materialized view
CREATE INDEX IF NOT EXISTS idx_stale_godot_versions_staleness
ON content.stale_godot_versions(staleness_reason);
