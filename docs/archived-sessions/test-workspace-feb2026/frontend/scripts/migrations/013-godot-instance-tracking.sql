/**
 * Phase 3 Migration: Godot Instance Tracking
 *
 * Adds instance registry columns to godot_versions table for tracking
 * spawned MCP server instances across version boundaries.
 *
 * Purpose:
 * - Track which instances are running (one per version)
 * - Store socket paths for Unix socket IPC
 * - Monitor instance health and heartbeat
 * - Enable graceful cleanup and restart
 */

-- Add instance tracking columns to godot_versions
ALTER TABLE content.godot_versions
ADD COLUMN IF NOT EXISTS instance_socket_path VARCHAR(255),
ADD COLUMN IF NOT EXISTS instance_pid INTEGER,
ADD COLUMN IF NOT EXISTS instance_status VARCHAR(20) DEFAULT 'stopped',
ADD COLUMN IF NOT EXISTS instance_last_heartbeat TIMESTAMP,
ADD COLUMN IF NOT EXISTS instance_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS instance_error_message TEXT;

-- Create index for fast instance status lookups
CREATE INDEX IF NOT EXISTS idx_godot_versions_instance_status
ON content.godot_versions(instance_status);

-- Create index for heartbeat monitoring
CREATE INDEX IF NOT EXISTS idx_godot_versions_last_heartbeat
ON content.godot_versions(instance_last_heartbeat);

-- Create table for instance state persistence
CREATE TABLE IF NOT EXISTS content.godot_instance_state (
  version_id INTEGER PRIMARY KEY REFERENCES content.godot_versions(id) ON DELETE CASCADE,
  selected_node_path VARCHAR(500),
  build_cache JSONB,
  runtime_events JSONB,
  context_data JSONB,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for state queries
CREATE INDEX IF NOT EXISTS idx_godot_instance_state_updated
ON content.godot_instance_state(updated_at);

-- Create table for instance metrics/monitoring
CREATE TABLE IF NOT EXISTS content.godot_instance_metrics (
  id SERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES content.godot_versions(id) ON DELETE CASCADE,
  request_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_request_at TIMESTAMP,
  uptime_seconds INTEGER,
  memory_mb INTEGER,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for metrics queries
CREATE INDEX IF NOT EXISTS idx_godot_instance_metrics_version_recorded
ON content.godot_instance_metrics(version_id, recorded_at);

-- Add comments documenting the columns
COMMENT ON COLUMN content.godot_versions.instance_socket_path IS 'Unix socket path for IPC with this version instance (e.g., /tmp/godot-mcp-noxii-0.16.sock)';
COMMENT ON COLUMN content.godot_versions.instance_pid IS 'Process ID of the spawned instance server';
COMMENT ON COLUMN content.godot_versions.instance_status IS 'Instance status: stopped, starting, ready, idle, error';
COMMENT ON COLUMN content.godot_versions.instance_last_heartbeat IS 'Timestamp of last heartbeat from instance (used to detect crashes)';
COMMENT ON COLUMN content.godot_versions.instance_created_at IS 'When this instance was first spawned';
COMMENT ON COLUMN content.godot_versions.instance_error_message IS 'Last error message if instance crashed or failed to start';

COMMENT ON TABLE content.godot_instance_state IS 'Persisted state for each Godot instance (selected node, build cache, runtime events, etc.)';
COMMENT ON TABLE content.godot_instance_metrics IS 'Performance metrics collected from instances for monitoring and debugging';
