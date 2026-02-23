-- ============================================================================
-- Workspace Tables Schema for Infinite Canvas Feature
-- Database: content.db
-- Created: 2025-10-04
-- ============================================================================
--
-- This schema provides an infinite canvas workspace for each project where
-- users can create text nodes and connect them with curved lines for visual
-- note-taking and ideation.
--
-- Features:
-- - One workspace per project (1:1 relationship via project_slug)
-- - Text nodes with position, size, and rich content
-- - Curved connections between nodes with anchor points
-- - Per-user viewport state (pan/zoom position)
-- - Soft deletes for undo functionality
-- - Spatial indexing for viewport culling
-- ============================================================================

-- ============================================================================
-- Workspaces Table
-- One workspace per project for organizing canvas nodes
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,                    -- Same as project_slug (WorkspaceId)
  project_slug TEXT NOT NULL UNIQUE,      -- FK to project_metadata.project_slug
  settings TEXT NOT NULL DEFAULT '{}',    -- JSON: WorkspaceSettings (grid, snap, etc.)
  created_by INTEGER NOT NULL,            -- FK to users.id
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER,                     -- FK to users.id
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Ensure workspace_id matches project_slug (self-consistency)
  CHECK (id = project_slug)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_project ON workspaces(project_slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON workspaces(created_by);

-- ============================================================================
-- Canvas Nodes Table
-- Text boxes positioned on the infinite canvas
-- ============================================================================
CREATE TABLE IF NOT EXISTS canvas_nodes (
  id TEXT PRIMARY KEY,                    -- node_<uuid> (NodeId)
  workspace_id TEXT NOT NULL,             -- FK to workspaces.id

  -- Position and size (in canvas coordinates)
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  width REAL NOT NULL DEFAULT 300,
  height REAL NOT NULL DEFAULT 200,

  -- Content (stored as JSON for flexibility)
  -- Schema: { text: string, markdown?: string, format?: TextFormat }
  content TEXT NOT NULL,

  -- Styling (optional JSON)
  -- Schema: { backgroundColor?: string, borderColor?: string, etc. }
  style TEXT,

  -- Layering (higher z_index = rendered on top)
  z_index INTEGER NOT NULL DEFAULT 0,

  -- Metadata (optional JSON for future features)
  metadata TEXT,

  -- Audit fields
  created_by INTEGER NOT NULL,            -- FK to users.id
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER,                     -- FK to users.id
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Soft delete (for undo functionality)
  is_deleted INTEGER DEFAULT 0,           -- 0 = active, 1 = deleted
  deleted_at DATETIME,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Constraints
  CHECK (width >= 100),                   -- Minimum width
  CHECK (height >= 50)                    -- Minimum height
);

-- Spatial indexing for viewport queries (critical for performance)
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_workspace ON canvas_nodes(workspace_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_spatial ON canvas_nodes(
  workspace_id, position_x, position_y, is_deleted
);
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_z_index ON canvas_nodes(workspace_id, z_index, is_deleted);
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_created_by ON canvas_nodes(created_by);

-- ============================================================================
-- Node Connections Table
-- Curved lines connecting nodes with anchor points
-- ============================================================================
CREATE TABLE IF NOT EXISTS node_connections (
  id TEXT PRIMARY KEY,                    -- conn_<uuid> (ConnectionId)
  workspace_id TEXT NOT NULL,             -- FK to workspaces.id

  -- Source node and anchor
  source_node_id TEXT NOT NULL,           -- FK to canvas_nodes.id
  source_anchor_side TEXT NOT NULL,       -- 'top' | 'right' | 'bottom' | 'left' | 'center'
  source_anchor_offset REAL NOT NULL DEFAULT 0.5, -- 0.0 to 1.0 (position along side)

  -- Target node and anchor
  target_node_id TEXT NOT NULL,           -- FK to canvas_nodes.id
  target_anchor_side TEXT NOT NULL,
  target_anchor_offset REAL NOT NULL DEFAULT 0.5,

  -- Optional label
  label TEXT,

  -- Styling (optional JSON)
  -- Schema: { color?: string, width?: number, dashArray?: number[], etc. }
  style TEXT,

  -- Layering (rendered below nodes by default)
  z_index INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  metadata TEXT,

  -- Audit fields
  created_by INTEGER NOT NULL,            -- FK to users.id
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER,                     -- FK to users.id
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Soft delete
  is_deleted INTEGER DEFAULT 0,
  deleted_at DATETIME,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (source_node_id) REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_node_id) REFERENCES canvas_nodes(id) ON DELETE CASCADE,

  -- Constraints
  CHECK (source_node_id != target_node_id),                               -- No self-connections
  CHECK (source_anchor_side IN ('top', 'right', 'bottom', 'left', 'center')),
  CHECK (target_anchor_side IN ('top', 'right', 'bottom', 'left', 'center')),
  CHECK (source_anchor_offset >= 0.0 AND source_anchor_offset <= 1.0),
  CHECK (target_anchor_offset >= 0.0 AND target_anchor_offset <= 1.0)
);

-- Indexes for connection queries
CREATE INDEX IF NOT EXISTS idx_connections_workspace ON node_connections(workspace_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_connections_source ON node_connections(source_node_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_connections_target ON node_connections(target_node_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_connections_created_by ON node_connections(created_by);

-- ============================================================================
-- Viewport States Table
-- Per-user viewport position (pan/zoom) for each workspace
-- ============================================================================
CREATE TABLE IF NOT EXISTS viewport_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,   -- ViewportStateId
  workspace_id TEXT NOT NULL,             -- FK to workspaces.id
  user_id INTEGER NOT NULL,               -- FK to users.id

  -- Transform data (viewport position and zoom)
  offset_x REAL NOT NULL DEFAULT 0,       -- Pan X offset
  offset_y REAL NOT NULL DEFAULT 0,       -- Pan Y offset
  scale REAL NOT NULL DEFAULT 1.0,        -- Zoom level (1.0 = 100%)

  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,

  -- One viewport state per user per workspace
  UNIQUE (workspace_id, user_id),

  -- Validate scale (0.1x to 5x zoom range)
  CHECK (scale >= 0.1 AND scale <= 5.0)
);

CREATE INDEX IF NOT EXISTS idx_viewport_workspace_user ON viewport_states(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_viewport_user ON viewport_states(user_id);

-- ============================================================================
-- Triggers for Automatic Timestamp Updates
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS update_workspaces_timestamp
AFTER UPDATE ON workspaces
FOR EACH ROW
BEGIN
  UPDATE workspaces SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_canvas_nodes_timestamp
AFTER UPDATE ON canvas_nodes
FOR EACH ROW
BEGIN
  UPDATE canvas_nodes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_node_connections_timestamp
AFTER UPDATE ON node_connections
FOR EACH ROW
BEGIN
  UPDATE node_connections SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_viewport_states_timestamp
AFTER UPDATE ON viewport_states
FOR EACH ROW
BEGIN
  UPDATE viewport_states SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================================
-- Soft Delete Triggers
-- Automatically set deleted_at when is_deleted = 1
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS canvas_nodes_soft_delete
AFTER UPDATE OF is_deleted ON canvas_nodes
FOR EACH ROW
WHEN NEW.is_deleted = 1 AND OLD.is_deleted = 0
BEGIN
  UPDATE canvas_nodes SET deleted_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS node_connections_soft_delete
AFTER UPDATE OF is_deleted ON node_connections
FOR EACH ROW
WHEN NEW.is_deleted = 1 AND OLD.is_deleted = 0
BEGIN
  UPDATE node_connections SET deleted_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================================
-- Cascade Delete Trigger for Connections
-- When a node is soft-deleted, also soft-delete its connections
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS cascade_delete_connections_on_node_delete
AFTER UPDATE OF is_deleted ON canvas_nodes
FOR EACH ROW
WHEN NEW.is_deleted = 1 AND OLD.is_deleted = 0
BEGIN
  UPDATE node_connections
  SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP
  WHERE (source_node_id = NEW.id OR target_node_id = NEW.id)
    AND is_deleted = 0;
END;

-- ============================================================================
-- End of Schema
-- ============================================================================
