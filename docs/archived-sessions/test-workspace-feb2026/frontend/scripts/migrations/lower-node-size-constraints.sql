-- Migration: Lower canvas_nodes size constraints
-- Date: 2025-01-13
-- Purpose: Allow smaller text boxes (60x30 minimum instead of 100x50)
-- Reason: Tight text wrapping for Miro-style text boxes

-- SQLite doesn't support ALTER TABLE to modify CHECK constraints
-- We need to recreate the table with new constraints

BEGIN TRANSACTION;

-- Step 1: Create new table with updated constraints
CREATE TABLE canvas_nodes_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,

  -- Position (canvas coordinates)
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,

  -- Size (UPDATED: Lower minimums from 100x50 to 60x30)
  width REAL NOT NULL DEFAULT 200,
  height REAL NOT NULL DEFAULT 100,

  -- Content (JSON: { title?, text, markdown?, format? })
  content TEXT NOT NULL,

  -- Visual styling (JSON: { backgroundColor?, borderColor?, ... })
  style TEXT,

  -- Metadata (JSON: { nodeType?, textScale?, ... })
  metadata TEXT,

  -- Z-index for layering
  z_index INTEGER NOT NULL DEFAULT 0,

  -- Audit fields
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Soft delete (for undo functionality)
  is_deleted INTEGER DEFAULT 0,
  deleted_at DATETIME,

  -- Constraints
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,

  -- UPDATED: Lower minimum sizes for tighter text boxes
  CHECK (width >= 60),   -- Minimum width: 60px (was 100px)
  CHECK (height >= 30)   -- Minimum height: 30px (was 50px)
);

-- Step 2: Copy all data from old table to new table (explicit column mapping)
INSERT INTO canvas_nodes_new (
  id, workspace_id,
  position_x, position_y, width, height,
  content, style, z_index, metadata,
  created_by, created_at, updated_by, updated_at,
  is_deleted, deleted_at
)
SELECT
  id, workspace_id,
  position_x, position_y, width, height,
  content, style, z_index, metadata,
  created_by, created_at, updated_by, updated_at,
  is_deleted, deleted_at
FROM canvas_nodes;

-- Step 3: Drop old table
DROP TABLE canvas_nodes;

-- Step 4: Rename new table to original name
ALTER TABLE canvas_nodes_new RENAME TO canvas_nodes;

-- Step 5: Recreate indexes
CREATE INDEX idx_canvas_nodes_workspace
  ON canvas_nodes(workspace_id);

CREATE INDEX idx_canvas_nodes_created_at
  ON canvas_nodes(created_at DESC);

CREATE INDEX idx_canvas_nodes_is_deleted
  ON canvas_nodes(is_deleted);

-- Step 6: Recreate triggers
CREATE TRIGGER update_canvas_nodes_timestamp
AFTER UPDATE ON canvas_nodes
FOR EACH ROW
BEGIN
  UPDATE canvas_nodes
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

COMMIT;

-- Verification: Check that constraints are updated
SELECT sql FROM sqlite_master
WHERE type='table' AND name='canvas_nodes';
