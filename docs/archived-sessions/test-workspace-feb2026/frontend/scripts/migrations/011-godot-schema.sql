-- Godot Script Visualization System: Schema + Data Migration
-- Complete setup including tables, indexes, and project registration

-- ===== SCHEMA SETUP =====
-- Ensure content schema exists
CREATE SCHEMA IF NOT EXISTS content;

-- ===== TABLE CREATION =====
-- Main project registry
CREATE TABLE IF NOT EXISTS content.godot_projects (
  id SERIAL PRIMARY KEY,
  project_slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Version tracking for each project
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

-- Individual scripts within a version
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

-- Cached dependency graph for visualization
CREATE TABLE IF NOT EXISTS content.godot_dependency_graph (
  id SERIAL PRIMARY KEY,
  version_id INTEGER UNIQUE NOT NULL,
  graph_data JSONB NOT NULL,
  parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (version_id) REFERENCES content.godot_versions(id) ON DELETE CASCADE
);

-- Runtime trace events for live visualization
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

-- GitHub sync state for version control
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

-- Scene data cache for visualization
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

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_godot_versions_project_slug ON content.godot_versions(project_slug);
CREATE INDEX IF NOT EXISTS idx_godot_versions_is_active ON content.godot_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_godot_scripts_version_id ON content.godot_scripts(version_id);
CREATE INDEX IF NOT EXISTS idx_godot_scripts_is_modified ON content.godot_scripts(is_modified);
CREATE INDEX IF NOT EXISTS idx_godot_runtime_events_version_id ON content.godot_runtime_events(version_id);
CREATE INDEX IF NOT EXISTS idx_godot_runtime_events_timestamp ON content.godot_runtime_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_godot_scenes_version_id ON content.godot_scenes(version_id);

-- ===== DATA POPULATION =====
-- Register NOXII project (Active - Godot 4.5)
INSERT INTO content.godot_projects (project_slug, title, description, created_at, updated_at)
VALUES (
  'noxii',
  'NOXII',
  'Active Godot 4.5 project with 4 sequential versions',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (project_slug) DO NOTHING;

-- Register NOXII-LEGACY project (Archived - Godot 4.4)
INSERT INTO content.godot_projects (project_slug, title, description, created_at, updated_at)
VALUES (
  'noxii-legacy',
  'NOXII Legacy',
  'Archived Godot 4.4 project with 28 historical versions',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (project_slug) DO NOTHING;

-- Register ENACT project (Godot 4.4)
INSERT INTO content.godot_projects (project_slug, title, description, created_at, updated_at)
VALUES (
  'enact',
  'ENACT',
  'Separate Godot 4.4 project with 9 versions',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (project_slug) DO NOTHING;

-- Register NOXII versions (v0.01-v0.04, Godot 4.5)
INSERT INTO content.godot_versions (project_slug, version_tag, is_active, extracted_path, build_status, created_at, updated_at)
VALUES
  ('noxii', 'v0.01', false, '/data/projects/NOXII/v0.01', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii', 'v0.02', false, '/data/projects/NOXII/v0.02', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii', 'v0.03', false, '/data/projects/NOXII/v0.03', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii', 'v0.04', true, '/data/projects/NOXII/v0.04', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (project_slug, version_tag) DO NOTHING;

-- Register NOXII-LEGACY versions (0.01-0.28, Godot 4.4)
INSERT INTO content.godot_versions (project_slug, version_tag, is_active, extracted_path, build_status, created_at, updated_at)
VALUES
  ('noxii-legacy', '0.01', false, '/data/projects/NOXII-LEGACY/0.01', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.02', false, '/data/projects/NOXII-LEGACY/0.02', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.03', false, '/data/projects/NOXII-LEGACY/0.03', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.04', false, '/data/projects/NOXII-LEGACY/0.04', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.05', false, '/data/projects/NOXII-LEGACY/0.05', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.06', false, '/data/projects/NOXII-LEGACY/0.06', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.07', false, '/data/projects/NOXII-LEGACY/0.07', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.08', false, '/data/projects/NOXII-LEGACY/0.08', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.09', false, '/data/projects/NOXII-LEGACY/0.09', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.10', false, '/data/projects/NOXII-LEGACY/0.10', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.11', false, '/data/projects/NOXII-LEGACY/0.11', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.12', false, '/data/projects/NOXII-LEGACY/0.12', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.13', false, '/data/projects/NOXII-LEGACY/0.13', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.14', false, '/data/projects/NOXII-LEGACY/0.14', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.15', false, '/data/projects/NOXII-LEGACY/0.15', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.16', false, '/data/projects/NOXII-LEGACY/0.16', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.17', false, '/data/projects/NOXII-LEGACY/0.17', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.18', false, '/data/projects/NOXII-LEGACY/0.18', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.19', false, '/data/projects/NOXII-LEGACY/0.19', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.20', false, '/data/projects/NOXII-LEGACY/0.20', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.21', false, '/data/projects/NOXII-LEGACY/0.21', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.22', false, '/data/projects/NOXII-LEGACY/0.22', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.23', false, '/data/projects/NOXII-LEGACY/0.23', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.24', false, '/data/projects/NOXII-LEGACY/0.24', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.25', false, '/data/projects/NOXII-LEGACY/0.25', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.26', false, '/data/projects/NOXII-LEGACY/0.26', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.27', false, '/data/projects/NOXII-LEGACY/0.27', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('noxii-legacy', '0.28', false, '/data/projects/NOXII-LEGACY/0.28', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (project_slug, version_tag) DO NOTHING;

-- Register ENACT versions (0.01-0.09, Godot 4.4)
INSERT INTO content.godot_versions (project_slug, version_tag, is_active, extracted_path, build_status, created_at, updated_at)
VALUES
  ('enact', '0.01', false, '/data/projects/ENACT/0.01', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('enact', '0.02', false, '/data/projects/ENACT/0.02', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('enact', '0.03', false, '/data/projects/ENACT/0.03', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('enact', '0.04', false, '/data/projects/ENACT/0.04', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('enact', '0.05', false, '/data/projects/ENACT/0.05', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('enact', '0.06', false, '/data/projects/ENACT/0.06', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('enact', '0.07', false, '/data/projects/ENACT/0.07', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('enact', '0.08', false, '/data/projects/ENACT/0.08', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('enact', '0.09', true, '/data/projects/ENACT/0.09', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (project_slug, version_tag) DO NOTHING;

-- Summary:
-- ✅ Created content schema
-- ✅ Created 7 tables (godot_projects, godot_versions, godot_scripts, godot_dependency_graph, godot_runtime_events, godot_github_sync, godot_scenes)
-- ✅ Created 7 indexes
-- ✅ Registered 3 projects
-- ✅ Registered 41 versions (4 + 28 + 9)
-- ✅ Set NOXII v0.04 and ENACT 0.09 as active
