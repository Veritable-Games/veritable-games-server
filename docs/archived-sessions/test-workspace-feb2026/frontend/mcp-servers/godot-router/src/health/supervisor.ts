/**
 * Instance Supervisor
 *
 * Automatically restarts unhealthy instances with crash-loop protection.
 *
 * Features:
 * - Listens to health monitor unhealthy events
 * - Automatically restarts failed instances
 * - Crash-loop detection: stops restarting if too many failures in short time
 * - Exponential backoff between restart attempts
 * - Logging and metrics recording
 */

import { EventEmitter } from 'events';
import { InstanceHealthEvent, InstanceMonitor } from './instance-monitor.js';
import { spawnInstance, getInstance } from '../spawner.js';
import { updateInstanceStatus } from '../registry.js';

/**
 * Supervisor configuration
 */
export interface SupervisorConfig {
  /** Maximum number of restarts within the window */
  maxRestartsInWindow: number;

  /** Time window for tracking restarts (milliseconds) */
  windowMs: number;

  /** Delay before attempting restart after failure */
  restartDelayMs: number;

  /** Name for logging */
  name?: string;
}

/**
 * Default configuration
 */
export const DEFAULT_SUPERVISOR_CONFIG: SupervisorConfig = {
  maxRestartsInWindow: 5,
  windowMs: 5 * 60 * 1000, // 5 minutes
  restartDelayMs: 60000, // 60 seconds
  name: 'instance-supervisor',
};

/**
 * Instance restart history
 */
interface RestartHistory {
  timestamps: number[];
}

/**
 * Supervisor for automatic instance restarts
 */
export class InstanceSupervisor extends EventEmitter {
  private monitor: InstanceMonitor;
  private restartHistory = new Map<number, RestartHistory>();
  private restartTimers = new Map<number, NodeJS.Timeout>();
  private config: SupervisorConfig;

  constructor(monitor: InstanceMonitor, config: SupervisorConfig = DEFAULT_SUPERVISOR_CONFIG) {
    super();
    this.monitor = monitor;
    this.config = config;

    // Listen to unhealthy events from monitor
    this.monitor.on('unhealthy', (event: InstanceHealthEvent) => {
      this.handleUnhealthy(event);
    });
  }

  /**
   * Handle unhealthy instance event
   */
  private async handleUnhealthy(event: InstanceHealthEvent): Promise<void> {
    const { versionId, reason } = event;

    console.error(`[Supervisor] Instance ${versionId} unhealthy: ${reason}`);

    // Check for crash loop
    if (this.isCrashLoop(versionId)) {
      console.error(
        `[Supervisor] Crash loop detected for instance ${versionId}, preventing restart`
      );
      this.emit('crash-loop', { versionId, reason });

      // Update registry to mark as error
      try {
        await updateInstanceStatus(versionId, 'error', `Crash loop detected: ${reason}`);
      } catch (e) {
        console.error(`[Supervisor] Error updating status: ${e}`);
      }

      return;
    }

    // Schedule restart
    this.scheduleRestart(versionId);
  }

  /**
   * Check if instance is in crash loop
   */
  private isCrashLoop(versionId: number): boolean {
    const history = this.restartHistory.get(versionId);
    if (!history) {
      // Initialize history
      this.restartHistory.set(versionId, { timestamps: [] });
      return false;
    }

    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Remove old timestamps outside window
    history.timestamps = history.timestamps.filter(t => t > windowStart);

    // Check if too many restarts in window
    if (history.timestamps.length >= this.config.maxRestartsInWindow) {
      return true;
    }

    return false;
  }

  /**
   * Record restart attempt
   */
  private recordRestart(versionId: number): void {
    const history = this.restartHistory.get(versionId) || { timestamps: [] };
    history.timestamps.push(Date.now());
    this.restartHistory.set(versionId, history);
  }

  /**
   * Schedule restart with delay
   */
  private scheduleRestart(versionId: number): void {
    // Cancel any pending restart for this instance
    const existingTimer = this.restartTimers.get(versionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    console.error(
      `[Supervisor] Scheduling restart for instance ${versionId} in ${this.config.restartDelayMs}ms`
    );

    const timer = setTimeout(async () => {
      this.restartTimers.delete(versionId);
      await this.restart(versionId);
    }, this.config.restartDelayMs);

    this.restartTimers.set(versionId, timer);
  }

  /**
   * Restart an instance
   */
  private async restart(versionId: number): Promise<void> {
    console.error(`[Supervisor] Attempting restart for instance ${versionId}`);

    try {
      // Terminate existing instance if running
      const existing = getInstance(versionId);
      if (existing) {
        console.error(`[Supervisor] Killing existing instance process: PID=${existing.pid}`);
        try {
          existing.process.kill('SIGTERM');
          await new Promise<void>(resolve => {
            const timeout = setTimeout(() => {
              existing.process.kill('SIGKILL');
              resolve();
            }, 5000);

            existing.process.on('exit', () => {
              clearTimeout(timeout);
              resolve();
            });
          });
        } catch (e) {
          console.error(`[Supervisor] Error killing process: ${e}`);
        }
      }

      // Record restart attempt
      this.recordRestart(versionId);

      // Spawn new instance
      console.error(`[Supervisor] Spawning new instance for ${versionId}`);
      const instance = await spawnInstance(versionId);

      console.error(
        `[Supervisor] Instance restarted successfully: versionId=${versionId}, PID=${instance.pid}`
      );

      this.emit('restarted', { versionId, pid: instance.pid });
    } catch (error) {
      console.error(`[Supervisor] Failed to restart instance ${versionId}: ${error}`);

      // Try again if not in crash loop
      if (!this.isCrashLoop(versionId)) {
        this.scheduleRestart(versionId);
      } else {
        console.error(
          `[Supervisor] Crash loop prevention: stopping restart attempts for ${versionId}`
        );
        this.emit('crash-loop', {
          versionId,
          reason: `Failed restart: ${error}`,
        });
      }
    }
  }

  /**
   * Manually restart an instance
   */
  async restartManually(versionId: number): Promise<void> {
    // Clear crash loop history to allow restart
    this.restartHistory.delete(versionId);

    // Clear any scheduled restart
    const timer = this.restartTimers.get(versionId);
    if (timer) {
      clearTimeout(timer);
      this.restartTimers.delete(versionId);
    }

    await this.restart(versionId);
  }

  /**
   * Stop supervising an instance
   */
  stopSupervising(versionId: number): void {
    const timer = this.restartTimers.get(versionId);
    if (timer) {
      clearTimeout(timer);
      this.restartTimers.delete(versionId);
    }

    this.restartHistory.delete(versionId);
  }

  /**
   * Get restart history for an instance
   */
  getRestartHistory(versionId: number): { count: number; windowMs: number } {
    const history = this.restartHistory.get(versionId);
    if (!history) {
      return { count: 0, windowMs: this.config.windowMs };
    }

    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const recentRestarts = history.timestamps.filter(t => t > windowStart);

    return {
      count: recentRestarts.length,
      windowMs: this.config.windowMs,
    };
  }

  /**
   * Cleanup and stop supervisor
   */
  shutdown(): void {
    // Cancel all scheduled restarts
    for (const [, timer] of this.restartTimers) {
      clearTimeout(timer);
    }

    this.restartTimers.clear();
    this.restartHistory.clear();

    console.error(`[Supervisor] Supervisor shut down`);
  }
}
