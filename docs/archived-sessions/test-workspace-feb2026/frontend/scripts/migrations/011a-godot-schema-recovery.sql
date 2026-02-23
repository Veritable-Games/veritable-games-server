/**
 * Recovery Migration: Godot Schema Recovery
 *
 * This migration handles the case where migration 011 (godot-schema.sql)
 * may not have executed successfully in production. It ensures all required
 * godot tables exist before subsequent migrations try to modify them.
 *
 * Safe for production: Only creates tables if they don't exist (IF NOT EXISTS)
 */

-- Ensure content schema exists
CREATE SCHEMA IF NOT EXISTS content;

-- Check if godot_projects exists, create if missing
CREATE TABLE IF NOT EXISTS content.godot_projects (
  id SERIAL PRIMARY KEY,
  project_slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Check if godot_versions exists, create if missing
CREATE TABLE IF NOT EXISTS content.godot_versions (
  id SERIAL PRIMARY KEY,
  project_slug TEXT NOT NULL,
  version_tag TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  source_archive_path TEXT,
  extracted_path TEXT,
  build_path TEXT,
  build_status TEXT CHECK(build_status IN ('pending', 'building', 'success', 'failed')) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_slug, version_tag),
  FOREIGN KEY (project_slug) REFERENCES content.godot_projects(project_slug) ON DELETE CASCADE
);

-- Check if godot_scripts exists, create if missing
CREATE TABLE IF NOT EXISTS content.godot_scripts (
  id SERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  script_name TEXT NOT NULL,
  content TEXT NOT NULL,
  original_content TEXT,
  is_modified BOOLEAN DEFAULT FALSE,
  dependencies JSONB,
  functions JSONB,
  signals JSONB,
  exports JSONB,
  last_edited_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(version_id, file_path),
  FOREIGN KEY (version_id) REFERENCES content.godot_versions(id) ON DELETE CASCADE
);

-- Check if godot_dependency_graph exists, create if missing
CREATE TABLE IF NOT EXISTS content.godot_dependency_graph (
  id SERIAL PRIMARY KEY,
  version_id INTEGER UNIQUE NOT NULL,
  graph_data JSONB NOT NULL,
  parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (version_id) REFERENCES content.godot_versions(id) ON DELETE CASCADE
);

-- Check if godot_runtime_events exists, create if missing
CREATE TABLE IF NOT EXISTS content.godot_runtime_events (
  id SERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  script_path TEXT,
  function_name TEXT,
  node_path TEXT,
  event_timestamp BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (version_id) REFERENCES content.godot_versions(id) ON DELETE CASCADE
);

-- Check if godot_github_sync exists, create if missing
CREATE TABLE IF NOT EXISTS content.godot_github_sync (
  id SERIAL PRIMARY KEY,
  project_slug TEXT UNIQUE NOT NULL,
  repo_url TEXT,
  branch_name TEXT DEFAULT 'main',
  last_commit_sha TEXT,
  last_sync_at TIMESTAMP,
  sync_status TEXT CHECK(sync_status IN ('synced', 'pending', 'error')) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_slug) REFERENCES content.godot_projects(project_slug) ON DELETE CASCADE
);

-- Check if godot_scenes exists, create if missing
CREATE TABLE IF NOT EXISTS content.godot_scenes (
  id SERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  scene_name TEXT NOT NULL,
  hierarchy JSONB,
  connections JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(version_id, file_path),
  FOREIGN KEY (version_id) REFERENCES content.godot_versions(id) ON DELETE CASCADE
);

-- Ensure all critical indexes exist
CREATE INDEX IF NOT EXISTS idx_godot_projects_slug ON content.godot_projects(project_slug);
CREATE INDEX IF NOT EXISTS idx_godot_versions_project ON content.godot_versions(project_slug);
CREATE INDEX IF NOT EXISTS idx_godot_versions_active ON content.godot_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_godot_scripts_version ON content.godot_scripts(version_id);
CREATE INDEX IF NOT EXISTS idx_godot_scripts_path ON content.godot_scripts(file_path);
CREATE INDEX IF NOT EXISTS idx_godot_dependency_graph_version ON content.godot_dependency_graph(version_id);
CREATE INDEX IF NOT EXISTS idx_godot_runtime_events_version ON content.godot_runtime_events(version_id);
CREATE INDEX IF NOT EXISTS idx_godot_scenes_version ON content.godot_scenes(version_id);

-- Signal successful recovery
SELECT 'Godot schema recovery complete - all required tables now exist'::text as status;
