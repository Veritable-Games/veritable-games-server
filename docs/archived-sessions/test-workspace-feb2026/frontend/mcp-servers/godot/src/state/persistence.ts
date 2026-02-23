/**
 * Instance State Persistence
 *
 * Saves and restores instance state to/from database for Phase 4a
 * Enables context to survive instance restarts.
 *
 * Persists:
 * - selectedNodePath: Currently focused script
 * - buildStatusCache: Recent build results
 * - runtimeEventBuffer: Last 50 runtime events
 * - contextData: Any other context data
 */

import { dbPool } from '../utils/db-client.js';
import type { RuntimeEvent, BuildStatus } from '../utils/types.js';

/**
 * Instance state structure that gets persisted
 */
export interface PersistedState {
  selectedNodePath?: string;
  buildCache?: Record<number, BuildStatus>;
  runtimeEvents?: RuntimeEvent[];
  contextData?: Record<string, any>;
}

/**
 * Save instance state to database
 * Called when instance goes idle or receives shutdown signal
 */
export async function saveInstanceState(versionId: number, state: PersistedState): Promise<void> {
  const connection = await dbPool.getConnection('content');

  try {
    console.error(
      `[Persistence] Saving state for version ${versionId}: selectedNode=${state.selectedNodePath}, events=${state.runtimeEvents?.length || 0}`
    );

    await connection.query(
      `INSERT INTO godot_instance_state (
         version_id,
         selected_node_path,
         build_cache,
         runtime_events,
         context_data,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (version_id) DO UPDATE
       SET selected_node_path = $2,
           build_cache = $3,
           runtime_events = $4,
           context_data = $5,
           updated_at = CURRENT_TIMESTAMP`,
      [
        versionId,
        state.selectedNodePath || null,
        state.buildCache ? JSON.stringify(Object.fromEntries(state.buildCache)) : null,
        state.runtimeEvents ? JSON.stringify(state.runtimeEvents) : null,
        state.contextData ? JSON.stringify(state.contextData) : null,
      ]
    );

    console.error(`[Persistence] State saved for version ${versionId}`);
  } catch (error) {
    console.error(`[Persistence] Error saving state: ${error}`);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Load instance state from database
 * Called when instance starts up to restore context
 */
export async function loadInstanceState(versionId: number): Promise<PersistedState | null> {
  const connection = await dbPool.getConnection('content');

  try {
    const result = await connection.query(
      `SELECT selected_node_path, build_cache, runtime_events, context_data, updated_at
       FROM godot_instance_state
       WHERE version_id = $1`,
      [versionId]
    );

    if (result.rows.length === 0) {
      console.error(`[Persistence] No saved state found for version ${versionId}`);
      return null;
    }

    const row = result.rows[0];
    const state: PersistedState = {
      selectedNodePath: row.selected_node_path || undefined,
      buildCache: row.build_cache
        ? new Map(Object.entries(JSON.parse(row.build_cache)))
        : undefined,
      runtimeEvents: row.runtime_events ? JSON.parse(row.runtime_events) : undefined,
      contextData: row.context_data ? JSON.parse(row.context_data) : undefined,
    };

    const timeSinceSave = Date.now() - new Date(row.updated_at).getTime();
    console.error(
      `[Persistence] Loaded state for version ${versionId}: ${Math.floor(timeSinceSave / 1000)}s old`
    );

    return state;
  } catch (error) {
    console.error(`[Persistence] Error loading state: ${error}`);
    return null;
  } finally {
    connection.release();
  }
}

/**
 * Clear persisted state for a version
 * Called when instance is explicitly terminated or reset
 */
export async function clearInstanceState(versionId: number): Promise<void> {
  const connection = await dbPool.getConnection('content');

  try {
    await connection.query(`DELETE FROM godot_instance_state WHERE version_id = $1`, [versionId]);

    console.error(`[Persistence] Cleared state for version ${versionId}`);
  } catch (error) {
    console.error(`[Persistence] Error clearing state: ${error}`);
  } finally {
    connection.release();
  }
}
