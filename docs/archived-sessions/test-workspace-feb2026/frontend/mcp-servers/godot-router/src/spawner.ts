/**
 * Instance Spawner
 *
 * Spawns and manages Godot MCP server instances as separate processes.
 *
 * Each instance:
 * - Runs in its own process
 * - Communicates via Unix domain socket
 * - Has isolated state and database connections
 * - Auto-terminates after idle timeout (30 minutes)
 * - Is tracked in PostgreSQL registry
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbPool } from '../../godot/dist/utils/db-client.js';
import {
  registerInstance,
  updateInstanceStatus,
  cleanupInstance,
  recordHeartbeat,
  InstanceInfo,
  tryStartInstance,
} from './registry.js';
import { waitForSocket } from './socket-transport.js';
import { UnixSocketClientTransport } from './socket-transport.js';
import { globalLockManager } from './resilience/lock-manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Spawned instance process information
 */
export interface SpawnedInstance {
  versionId: number;
  pid: number;
  socketPath: string;
  process: ChildProcess;
  createdAt: Date;
  lastActivityAt: Date;
}

/**
 * Pool of spawned instances
 */
const spawnedInstances = new Map<number, SpawnedInstance>();

/**
 * Spawn a new MCP instance for a version
 * Uses atomic database operations to prevent duplicate spawning
 */
export async function spawnInstance(versionId: number): Promise<SpawnedInstance> {
  console.error(`[Spawner] Spawning instance for versionId=${versionId}`);

  // Check if already spawned locally
  const existing = spawnedInstances.get(versionId);
  if (existing) {
    console.error(`[Spawner] Instance already exists for versionId=${versionId}, reusing`);
    return existing;
  }

  // Atomically try to transition from 'stopped' to 'starting'
  // This prevents race conditions on concurrent spawn attempts
  const transitioned = await tryStartInstance(versionId);
  if (!transitioned) {
    console.error(
      `[Spawner] Could not transition instance to 'starting' state (may already be starting/ready)`
    );
    throw new Error(`Instance ${versionId} is already in process of starting or already running`);
  }

  // Query version metadata
  const connection = await dbPool.getConnection('content');
  let projectSlug: string;
  let versionTag: string;

  try {
    const result = await connection.query(
      `SELECT project_slug, version_tag FROM godot_versions WHERE id = $1`,
      [versionId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Version ${versionId} not found in database`);
    }

    projectSlug = result.rows[0].project_slug;
    versionTag = result.rows[0].version_tag;
  } finally {
    connection.release();
  }

  // Generate socket path
  const socketPath = `/tmp/godot-mcp-${projectSlug}-${versionTag}.sock`;
  console.error(`[Spawner] Socket path: ${socketPath}`);

  // Spawn child process
  const instancePath = path.join(__dirname, '../../godot/dist/index.js');
  console.error(`[Spawner] Instance script: ${instancePath}`);

  const child = spawn('node', [instancePath], {
    env: {
      ...process.env,
      VERSION_ID: versionId.toString(),
      SOCKET_PATH: socketPath,
      MCP_INSTANCE_MODE: 'true',
      DATABASE_URL: process.env.DATABASE_URL,
      API_BASE_URL: process.env.API_BASE_URL,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false, // Don't detach so we can manage lifecycle
  });

  console.error(`[Spawner] Instance process spawned: PID=${child.pid}`);

  // Setup stdout/stderr logging
  child.stdout?.on('data', data => {
    console.error(`[Instance ${versionId}] ${data.toString().trim()}`);
  });

  child.stderr?.on('data', data => {
    console.error(`[Instance ${versionId}] ${data.toString().trim()}`);
  });

  child.on('exit', (code, signal) => {
    console.error(`[Spawner] Instance ${versionId} exited: code=${code}, signal=${signal}`);
    spawnedInstances.delete(versionId);
    // Cleanup registry
    cleanupInstance(versionId).catch(e => {
      console.error(`[Spawner] Error cleaning up instance: ${e}`);
    });
  });

  child.on('error', err => {
    console.error(`[Spawner] Instance ${versionId} error: ${err}`);
    updateInstanceStatus(versionId, 'error', err.message).catch(e => {
      console.error(`[Spawner] Error updating status: ${e}`);
    });
  });

  // Wait for socket to be ready
  try {
    await waitForSocket(socketPath, 5000);
    console.error(`[Spawner] Socket ready: ${socketPath}`);
  } catch (e) {
    console.error(`[Spawner] Socket not ready: ${e}`);
    child.kill('SIGTERM');
    await updateInstanceStatus(versionId, 'error', `Socket not ready: ${e}`);
    throw new Error(`Failed to spawn instance: socket not ready`);
  }

  // Register instance in database
  if (!child.pid) {
    throw new Error('Failed to get child process PID');
  }

  await registerInstance(versionId, child.pid, socketPath);

  // Create spawned instance object
  const instance: SpawnedInstance = {
    versionId,
    pid: child.pid,
    socketPath,
    process: child,
    createdAt: new Date(),
    lastActivityAt: new Date(),
  };

  // Store in pool
  spawnedInstances.set(versionId, instance);

  // Setup idle timeout
  setupIdleTimeout(versionId, instance);

  console.error(
    `[Spawner] Instance spawned successfully: versionId=${versionId}, PID=${child.pid}`
  );

  return instance;
}

/**
 * Get or spawn instance for a version
 * Uses lock to prevent duplicate spawning on concurrent requests
 */
export async function getOrSpawnInstance(versionId: number): Promise<SpawnedInstance> {
  // Check local pool first
  const existing = spawnedInstances.get(versionId);
  if (existing) {
    console.error(`[Spawner] Using existing instance: versionId=${versionId}`);
    existing.lastActivityAt = new Date();
    return existing;
  }

  // Use lock to ensure only one spawn happens concurrently
  const lockKey = `spawn-instance-${versionId}`;
  return await globalLockManager.withLock(
    lockKey,
    async () => {
      // Check again after acquiring lock (another thread might have spawned)
      const existing = spawnedInstances.get(versionId);
      if (existing) {
        console.error(
          `[Spawner] Instance already exists (found after lock): versionId=${versionId}`
        );
        return existing;
      }

      // Spawn new
      return await spawnInstance(versionId);
    },
    30000 // 30 second timeout for spawn
  );
}

/**
 * Update activity timestamp for idle timeout tracking
 */
export function recordActivity(versionId: number): void {
  const instance = spawnedInstances.get(versionId);
  if (instance) {
    instance.lastActivityAt = new Date();
  }
}

/**
 * Setup idle timeout for an instance
 */
function setupIdleTimeout(versionId: number, instance: SpawnedInstance): void {
  const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  const CHECK_INTERVAL = 60 * 1000; // Check every minute

  const idleTimer = setInterval(() => {
    const timeSinceActivity = Date.now() - instance.lastActivityAt.getTime();

    if (timeSinceActivity > IDLE_TIMEOUT) {
      console.error(
        `[Spawner] Instance ${versionId} idle for ${timeSinceActivity / 1000}s, terminating`
      );

      // Terminate instance
      terminateInstance(versionId).catch(e => {
        console.error(`[Spawner] Error terminating instance: ${e}`);
      });

      clearInterval(idleTimer);
    }
  }, CHECK_INTERVAL);
}

/**
 * Terminate an instance
 */
export async function terminateInstance(versionId: number): Promise<void> {
  const instance = spawnedInstances.get(versionId);
  if (!instance) {
    console.error(`[Spawner] Instance not found: versionId=${versionId}`);
    return;
  }

  console.error(`[Spawner] Terminating instance: versionId=${versionId}, PID=${instance.pid}`);

  // Send SIGTERM to process
  try {
    instance.process.kill('SIGTERM');

    // Wait for graceful shutdown
    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        console.error(`[Spawner] Graceful shutdown timeout, force killing: versionId=${versionId}`);
        instance.process.kill('SIGKILL');
        resolve();
      }, 5000);

      instance.process.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  } catch (e) {
    console.error(`[Spawner] Error terminating instance: ${e}`);
  }

  // Remove from pool
  spawnedInstances.delete(versionId);

  // Cleanup registry
  await cleanupInstance(versionId);
}

/**
 * Terminate all instances
 */
export async function terminateAllInstances(): Promise<void> {
  console.error(`[Spawner] Terminating all instances`);

  const versionIds = Array.from(spawnedInstances.keys());
  await Promise.all(versionIds.map(vid => terminateInstance(vid)));

  console.error(`[Spawner] All instances terminated`);
}

/**
 * Get instance info
 */
export function getInstance(versionId: number): SpawnedInstance | undefined {
  return spawnedInstances.get(versionId);
}

/**
 * List all spawned instances
 */
export function listInstances(): SpawnedInstance[] {
  return Array.from(spawnedInstances.values());
}

/**
 * Get instance uptime
 */
export function getInstanceUptime(versionId: number): number | null {
  const instance = spawnedInstances.get(versionId);
  if (!instance) return null;

  return Date.now() - instance.createdAt.getTime();
}

/**
 * Send heartbeat to update instance activity
 */
export async function sendHeartbeat(versionId: number): Promise<void> {
  recordActivity(versionId);
  await recordHeartbeat(versionId);
}
