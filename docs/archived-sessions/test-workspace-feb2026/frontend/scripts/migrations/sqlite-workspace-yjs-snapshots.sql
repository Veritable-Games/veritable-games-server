-- SQLite Migration: Yjs Snapshot Storage
-- Stores Yjs document state as text (base64) for crash recovery
-- Date: 2025-11-27

CREATE TABLE IF NOT EXISTS workspace_yjs_snapshots (
  workspace_id TEXT PRIMARY KEY,
  yjs_state TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_workspace_yjs_snapshots_updated_at
  ON workspace_yjs_snapshots(updated_at DESC);

-- Auto-update timestamp trigger (SQLite version)
CREATE TRIGGER IF NOT EXISTS update_workspace_yjs_snapshots_timestamp
AFTER UPDATE ON workspace_yjs_snapshots
FOR EACH ROW
BEGIN
  UPDATE workspace_yjs_snapshots
  SET updated_at = CURRENT_TIMESTAMP
  WHERE workspace_id = NEW.workspace_id;
END;
