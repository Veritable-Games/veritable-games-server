/**
 * Phase 5: Godot Panel Positions Persistence
 *
 * Stores user-customized panel positions for the Godot Developer Console.
 * Allows users to drag and reposition UI panels, with positions persisted
 * per Godot version in the database.
 *
 * Purpose:
 * - Track panel x/y coordinates per version
 * - Enable state persistence across sessions and devices
 * - Support per-version layout preferences
 * - Enable future reset/layout features
 */

-- Create table for panel positions
CREATE TABLE IF NOT EXISTS content.godot_panel_positions (
  version_id INTEGER NOT NULL REFERENCES content.godot_versions(id) ON DELETE CASCADE,
  panel_id VARCHAR(50) NOT NULL,
  position_x INTEGER NOT NULL,
  position_y INTEGER NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (version_id, panel_id)
);

-- Index for efficient lookups by version (when loading all positions)
CREATE INDEX IF NOT EXISTS idx_godot_panel_positions_version
ON content.godot_panel_positions(version_id);

-- Add comments documenting the table
COMMENT ON TABLE content.godot_panel_positions IS 'Persisted panel positions for Godot Developer Console UI elements';
COMMENT ON COLUMN content.godot_panel_positions.version_id IS 'Reference to godot_versions table (CASCADE delete)';
COMMENT ON COLUMN content.godot_panel_positions.panel_id IS 'Panel identifier: info-panel, search-panel, control-panel, temp-legend, edge-legend, tooltip, terminal';
COMMENT ON COLUMN content.godot_panel_positions.position_x IS 'Horizontal position in pixels from viewport left edge';
COMMENT ON COLUMN content.godot_panel_positions.position_y IS 'Vertical position in pixels from viewport top edge';
COMMENT ON COLUMN content.godot_panel_positions.updated_at IS 'Timestamp of last position update';
