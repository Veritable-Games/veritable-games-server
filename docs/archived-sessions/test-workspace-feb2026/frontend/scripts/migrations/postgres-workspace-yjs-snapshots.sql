-- PostgreSQL Migration: Yjs Snapshot Storage
-- Stores Yjs document state as binary blobs for crash recovery
-- Date: 2025-11-27

CREATE TABLE IF NOT EXISTS content.workspace_yjs_snapshots (
  workspace_id TEXT PRIMARY KEY,
  yjs_state TEXT NOT NULL, -- Base64-encoded Yjs state vector
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_workspace_yjs_snapshots_updated_at
  ON content.workspace_yjs_snapshots(updated_at DESC);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_workspace_yjs_snapshots_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_workspace_yjs_snapshots_timestamp
  ON content.workspace_yjs_snapshots;

CREATE TRIGGER update_workspace_yjs_snapshots_timestamp
BEFORE UPDATE ON content.workspace_yjs_snapshots
FOR EACH ROW
EXECUTE FUNCTION update_workspace_yjs_snapshots_timestamp();
