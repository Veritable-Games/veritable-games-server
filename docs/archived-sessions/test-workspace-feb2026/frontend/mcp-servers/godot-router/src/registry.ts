/**
 * Instance Registry Manager
 *
 * Manages the registry of spawned MCP server instances.
 * Tracks:
 * - Which instances are running (one per version)
 * - Socket paths for IPC
 * - Process IDs
 * - Instance status (stopped, starting, ready, idle, error)
 * - Health/heartbeat information
 *
 * Uses PostgreSQL as the authoritative registry.
 */

import { dbPool } from '../../godot/dist/utils/db-client.js';

export type InstanceStatus = 'stopped' | 'starting' | 'ready' | 'idle' | 'error';

export interface InstanceInfo {
  versionId: number;
  socketPath: string | null;
  pid: number | null;
  status: InstanceStatus;
  lastHeartbeat: Date | null;
  createdAt: Date | null;
  errorMessage: string | null;
}

export interface InstanceListItem {
  versionId: number;
  projectSlug: string;
  versionTag: string;
  socketPath: string | null;
  pid: number | null;
  status: InstanceStatus;
  uptime: number | null; // in seconds
}

/**
 * Register a new instance in the registry
 */
export async function registerInstance(
  versionId: number,
  pid: number,
  socketPath: string
): Promise<void> {
  console.error(
    `[Registry] Registering instance: versionId=${versionId}, pid=${pid}, socket=${socketPath}`
  );

  const connection = await dbPool.getConnection('content');
  try {
    await connection.query(
      `UPDATE godot_versions
       SET instance_socket_path = $1,
           instance_pid = $2,
           instance_status = 'ready',
           instance_created_at = CURRENT_TIMESTAMP,
           instance_last_heartbeat = CURRENT_TIMESTAMP,
           instance_error_message = NULL
       WHERE id = $3`,
      [socketPath, pid, versionId]
    );

    console.error(`[Registry] Instance registered: versionId=${versionId}`);
  } finally {
    connection.release();
  }
}

/**
 * Update instance status
 */
export async function updateInstanceStatus(
  versionId: number,
  status: InstanceStatus,
  errorMessage?: string
): Promise<void> {
  console.error(`[Registry] Updating instance status: versionId=${versionId}, status=${status}`);

  const connection = await dbPool.getConnection('content');
  try {
    await connection.query(
      `UPDATE godot_versions
       SET instance_status = $1,
           instance_error_message = $2
       WHERE id = $3`,
      [status, errorMessage || null, versionId]
    );
  } finally {
    connection.release();
  }
}

/**
 * Record heartbeat from instance (indicates it's still alive)
 */
export async function recordHeartbeat(versionId: number): Promise<void> {
  const connection = await dbPool.getConnection('content');
  try {
    await connection.query(
      `UPDATE godot_versions
       SET instance_last_heartbeat = CURRENT_TIMESTAMP,
           instance_status = 'ready'
       WHERE id = $1`,
      [versionId]
    );
  } finally {
    connection.release();
  }
}

/**
 * Get instance info from registry
 */
export async function getInstanceInfo(versionId: number): Promise<InstanceInfo | null> {
  console.error(`[Registry] Getting instance info: versionId=${versionId}`);

  const connection = await dbPool.getConnection('content');
  try {
    const result = await connection.query(
      `SELECT
         id,
         instance_socket_path,
         instance_pid,
         instance_status,
         instance_last_heartbeat,
         instance_created_at,
         instance_error_message
       FROM godot_versions
       WHERE id = $1`,
      [versionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      versionId: row.id,
      socketPath: row.instance_socket_path,
      pid: row.instance_pid,
      status: row.instance_status as InstanceStatus,
      lastHeartbeat: row.instance_last_heartbeat ? new Date(row.instance_last_heartbeat) : null,
      createdAt: row.instance_created_at ? new Date(row.instance_created_at) : null,
      errorMessage: row.instance_error_message,
    };
  } finally {
    connection.release();
  }
}

/**
 * List all instances
 */
export async function listInstances(): Promise<InstanceListItem[]> {
  console.error(`[Registry] Listing all instances`);

  const connection = await dbPool.getConnection('content');
  try {
    const result = await connection.query(
      `SELECT
         v.id,
         p.project_slug,
         v.version_tag,
         v.instance_socket_path,
         v.instance_pid,
         v.instance_status,
         v.instance_created_at
       FROM godot_versions v
       JOIN godot_projects p ON v.project_slug = p.project_slug
       ORDER BY p.project_slug ASC, v.version_tag ASC`
    );

    return result.rows.map((row: any) => {
      // Calculate uptime if instance was created
      let uptime: number | null = null;
      if (row.instance_created_at) {
        const createdTime = new Date(row.instance_created_at).getTime();
        const now = Date.now();
        uptime = Math.floor((now - createdTime) / 1000);
      }

      return {
        versionId: row.id,
        projectSlug: row.project_slug,
        versionTag: row.version_tag,
        socketPath: row.instance_socket_path,
        pid: row.instance_pid,
        status: row.instance_status as InstanceStatus,
        uptime,
      };
    });
  } finally {
    connection.release();
  }
}

/**
 * List instances by status
 */
export async function listInstancesByStatus(status: InstanceStatus): Promise<InstanceListItem[]> {
  const allInstances = await listInstances();
  return allInstances.filter(i => i.status === status);
}

/**
 * Clean up instance registry (mark as stopped, clear socket/pid info)
 */
export async function cleanupInstance(versionId: number): Promise<void> {
  console.error(`[Registry] Cleaning up instance: versionId=${versionId}`);

  const connection = await dbPool.getConnection('content');
  try {
    await connection.query(
      `UPDATE godot_versions
       SET instance_socket_path = NULL,
           instance_pid = NULL,
           instance_status = 'stopped',
           instance_error_message = NULL,
           instance_last_heartbeat = NULL
       WHERE id = $1`,
      [versionId]
    );

    console.error(`[Registry] Instance cleaned up: versionId=${versionId}`);
  } finally {
    connection.release();
  }
}

/**
 * Check for dead instances (hasn't sent heartbeat in a while)
 * Returns array of versionIds that appear to be dead
 */
export async function findDeadInstances(heartbeatTimeoutMs: number = 30000): Promise<number[]> {
  const connection = await dbPool.getConnection('content');
  try {
    const result = await connection.query(
      `SELECT id
       FROM godot_versions
       WHERE instance_status != 'stopped'
       AND instance_last_heartbeat < CURRENT_TIMESTAMP - INTERVAL '1 second' * ($1 / 1000)
       AND instance_pid IS NOT NULL`,
      [heartbeatTimeoutMs]
    );

    return result.rows.map((row: any) => row.id);
  } finally {
    connection.release();
  }
}

/**
 * Find instances that have been idle for a long time
 * Returns array of versionIds
 */
export async function findIdleInstances(
  idleTimeoutMs: number = 30 * 60 * 1000 // 30 minutes
): Promise<number[]> {
  const connection = await dbPool.getConnection('content');
  try {
    const result = await connection.query(
      `SELECT id
       FROM godot_versions
       WHERE instance_status = 'ready'
       AND instance_last_heartbeat < CURRENT_TIMESTAMP - INTERVAL '1 second' * ($1 / 1000)`,
      [idleTimeoutMs]
    );

    return result.rows.map((row: any) => row.id);
  } finally {
    connection.release();
  }
}

/**
 * Get socket path for a version (if instance running)
 */
export async function getSocketPath(versionId: number): Promise<string | null> {
  const info = await getInstanceInfo(versionId);
  if (!info) return null;

  // Only return socket if instance is in ready state
  if (info.status !== 'ready') return null;

  return info.socketPath;
}

/**
 * Check if an instance is running and healthy
 */
export async function isInstanceHealthy(versionId: number): Promise<boolean> {
  const info = await getInstanceInfo(versionId);
  if (!info) return false;

  // Check if status is ready and heartbeat is recent
  if (info.status !== 'ready') return false;

  if (!info.lastHeartbeat) return false;

  // Heartbeat must be within last 30 seconds
  const timeSinceHeartbeat = Date.now() - info.lastHeartbeat.getTime();
  if (timeSinceHeartbeat > 30000) return false;

  return true;
}

/**
 * Get raw instance status from registry (for health monitoring)
 * Returns raw database row with snake_case field names
 */
export async function getInstanceStatus(versionId: number): Promise<{
  instance_status: string;
  instance_pid: number | null;
  instance_last_heartbeat: string | null;
  error_message: string | null;
} | null> {
  const connection = await dbPool.getConnection('content');
  try {
    const result = await connection.query(
      `SELECT instance_status, instance_pid, instance_last_heartbeat, instance_error_message as error_message
       FROM godot_versions
       WHERE id = $1`,
      [versionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } finally {
    connection.release();
  }
}

/**
 * Atomically check and update instance status with row-level lock
 * Prevents race conditions in concurrent spawn attempts
 *
 * Usage:
 * ```typescript
 * const status = await atomicCheckAndUpdateStatus(
 *   versionId,
 *   (currentStatus) => {
 *     if (currentStatus === 'stopped') {
 *       return { newStatus: 'starting', errorMessage: null };
 *     }
 *     return null; // No update needed
 *   }
 * );
 * ```
 */
export async function atomicCheckAndUpdateStatus(
  versionId: number,
  updateFn: (
    currentStatus: InstanceStatus
  ) => { newStatus: InstanceStatus; errorMessage?: string | null } | null
): Promise<InstanceStatus | null> {
  const connection = await dbPool.getConnection('content');
  try {
    // Start transaction
    await connection.query('BEGIN');

    // Lock row to prevent concurrent updates
    const result = await connection.query(
      `SELECT instance_status FROM godot_versions WHERE id = $1 FOR UPDATE`,
      [versionId]
    );

    if (result.rows.length === 0) {
      await connection.query('ROLLBACK');
      return null;
    }

    const currentStatus = result.rows[0].instance_status as InstanceStatus;

    // Call update function with current status
    const update = updateFn(currentStatus);

    if (!update) {
      // No update needed
      await connection.query('ROLLBACK');
      return currentStatus;
    }

    // Apply update
    await connection.query(
      `UPDATE godot_versions
       SET instance_status = $1,
           instance_error_message = $2
       WHERE id = $3`,
      [update.newStatus, update.errorMessage || null, versionId]
    );

    // Commit transaction
    await connection.query('COMMIT');

    console.error(
      `[Registry] Atomic update successful: versionId=${versionId}, ${currentStatus} → ${update.newStatus}`
    );

    return update.newStatus;
  } catch (error) {
    try {
      await connection.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(`[Registry] Rollback error: ${rollbackError}`);
    }
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Try to transition instance from 'stopped' to 'starting' atomically
 * Returns true if transition succeeded, false if already in different state
 */
export async function tryStartInstance(versionId: number): Promise<boolean> {
  const newStatus = await atomicCheckAndUpdateStatus(versionId, currentStatus => {
    if (currentStatus === 'stopped') {
      return { newStatus: 'starting', errorMessage: null };
    }
    return null;
  });

  return newStatus === 'starting';
}

/**
 * Save instance state (for persistence across restarts)
 */
export async function saveInstanceState(
  versionId: number,
  selectedNodePath: string | null,
  buildCache: Record<string, any> | null,
  runtimeEvents: any[] | null,
  contextData: any | null
): Promise<void> {
  const connection = await dbPool.getConnection('content');
  try {
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
        selectedNodePath,
        JSON.stringify(buildCache),
        JSON.stringify(runtimeEvents),
        JSON.stringify(contextData),
      ]
    );

    console.error(`[Registry] Saved instance state: versionId=${versionId}`);
  } finally {
    connection.release();
  }
}

/**
 * Load persisted instance state
 */
export async function loadInstanceState(versionId: number): Promise<{
  selectedNodePath: string | null;
  buildCache: Record<string, any> | null;
  runtimeEvents: any[] | null;
  contextData: any | null;
} | null> {
  const connection = await dbPool.getConnection('content');
  try {
    const result = await connection.query(
      `SELECT selected_node_path, build_cache, runtime_events, context_data
       FROM godot_instance_state
       WHERE version_id = $1`,
      [versionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      selectedNodePath: row.selected_node_path,
      buildCache: row.build_cache ? JSON.parse(row.build_cache) : null,
      runtimeEvents: row.runtime_events ? JSON.parse(row.runtime_events) : null,
      contextData: row.context_data ? JSON.parse(row.context_data) : null,
    };
  } finally {
    connection.release();
  }
}

/**
 * Record instance metrics for monitoring
 */
export async function recordInstanceMetrics(
  versionId: number,
  requestCount: number,
  errorCount: number,
  uptimeSeconds: number,
  memoryMb: number
): Promise<void> {
  const connection = await dbPool.getConnection('content');
  try {
    await connection.query(
      `INSERT INTO godot_instance_metrics (
         version_id,
         request_count,
         error_count,
         last_request_at,
         uptime_seconds,
         memory_mb
       )
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)`,
      [versionId, requestCount, errorCount, uptimeSeconds, memoryMb]
    );
  } finally {
    connection.release();
  }
}
