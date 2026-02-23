/**
 * Instance Health Monitor
 *
 * Continuously monitors the health of spawned instances by:
 * - Checking heartbeat freshness
 * - Verifying process still exists (PID check)
 * - Verifying registry status matches reality
 *
 * Emits 'unhealthy' event when an instance has issues,
 * which triggers supervisor to restart it.
 */

import { EventEmitter } from 'events';
import { recordHeartbeat, getInstanceStatus, InstanceStatus } from '../registry.js';

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** How often to check instance health (milliseconds) */
  checkIntervalMs: number;

  /** Maximum time since last heartbeat before marking unhealthy (milliseconds) */
  heartbeatTimeoutMs: number;

  /** Name for logging */
  name?: string;
}

/**
 * Default configuration
 */
export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  checkIntervalMs: 10000, // Check every 10 seconds
  heartbeatTimeoutMs: 30000, // 30 seconds without heartbeat = unhealthy
  name: 'instance-monitor',
};

/**
 * Instance Health Event
 */
export interface InstanceHealthEvent {
  versionId: number;
  healthy: boolean;
  reason?: string;
  timestamp: Date;
}

/**
 * Instance Monitor
 */
export class InstanceMonitor extends EventEmitter {
  private checkIntervals = new Map<number, NodeJS.Timeout>();
  private config: HealthCheckConfig;

  constructor(config: HealthCheckConfig = DEFAULT_HEALTH_CHECK_CONFIG) {
    super();
    this.config = config;
  }

  /**
   * Start monitoring an instance
   */
  startMonitoring(versionId: number): void {
    if (this.checkIntervals.has(versionId)) {
      console.error(`[InstanceMonitor] Already monitoring version ${versionId}`);
      return;
    }

    console.error(`[InstanceMonitor] Starting health checks for version ${versionId}`);

    const interval = setInterval(async () => {
      await this.checkInstanceHealth(versionId);
    }, this.config.checkIntervalMs);

    this.checkIntervals.set(versionId, interval);
  }

  /**
   * Stop monitoring an instance
   */
  stopMonitoring(versionId: number): void {
    const interval = this.checkIntervals.get(versionId);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(versionId);
      console.error(`[InstanceMonitor] Stopped monitoring version ${versionId}`);
    }
  }

  /**
   * Check health of a single instance
   */
  private async checkInstanceHealth(versionId: number): Promise<void> {
    try {
      // Get instance status from registry
      const status = await getInstanceStatus(versionId);

      if (!status) {
        // Instance not in registry
        this.emitUnhealthy(versionId, 'Instance not found in registry');
        return;
      }

      // Check registry status
      if (status.instance_status === 'error') {
        this.emitUnhealthy(versionId, `Registry status is error: ${status.error_message}`);
        return;
      }

      if (status.instance_status === 'stopped') {
        this.emitUnhealthy(versionId, 'Registry status is stopped');
        return;
      }

      // Check heartbeat freshness
      if (!status.instance_last_heartbeat) {
        this.emitUnhealthy(versionId, 'No heartbeat recorded');
        return;
      }

      const lastHeartbeat = new Date(status.instance_last_heartbeat);
      const timeSinceHeartbeat = Date.now() - lastHeartbeat.getTime();

      if (timeSinceHeartbeat > this.config.heartbeatTimeoutMs) {
        this.emitUnhealthy(
          versionId,
          `No heartbeat for ${timeSinceHeartbeat}ms (timeout: ${this.config.heartbeatTimeoutMs}ms)`
        );
        return;
      }

      // Check if PID is still alive
      if (!this.isPidAlive(status.instance_pid)) {
        this.emitUnhealthy(versionId, `Process PID ${status.instance_pid} is not alive`);
        return;
      }

      // Instance is healthy
      this.emitHealthy(versionId);
    } catch (error) {
      console.error(`[InstanceMonitor] Error checking health for version ${versionId}: ${error}`);
      // Treat check errors as potential unhealthiness
      this.emitUnhealthy(versionId, `Health check error: ${error}`);
    }
  }

  /**
   * Check if a process ID is alive
   */
  private isPidAlive(pid: number | null): boolean {
    if (!pid) {
      return false;
    }

    try {
      // Signal 0 = test if process exists (doesn't actually send signal)
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Emit unhealthy event
   */
  private emitUnhealthy(versionId: number, reason: string): void {
    console.error(`[InstanceMonitor] Instance ${versionId} unhealthy: ${reason}`);

    const event: InstanceHealthEvent = {
      versionId,
      healthy: false,
      reason,
      timestamp: new Date(),
    };

    this.emit('unhealthy', event);
  }

  /**
   * Emit healthy event
   */
  private emitHealthy(versionId: number): void {
    const event: InstanceHealthEvent = {
      versionId,
      healthy: true,
      timestamp: new Date(),
    };

    this.emit('healthy', event);
  }

  /**
   * Stop all monitoring
   */
  stopAll(): void {
    for (const [versionId] of this.checkIntervals) {
      this.stopMonitoring(versionId);
    }
  }

  /**
   * Get list of monitored instances
   */
  getMonitoredInstances(): number[] {
    return Array.from(this.checkIntervals.keys());
  }

  /**
   * Send manual heartbeat to reset timeout
   */
  async recordHeartbeat(versionId: number): Promise<void> {
    try {
      await recordHeartbeat(versionId);
    } catch (error) {
      console.error(
        `[InstanceMonitor] Error recording heartbeat for version ${versionId}: ${error}`
      );
    }
  }
}
