/**
 * MCP Metrics Collection
 *
 * Tracks key metrics for the Godot MCP system:
 * - Instance spawning (count, duration)
 * - Tool calls (count, duration, success rate)
 * - Socket connections (active, total)
 * - Health check failures
 *
 * Exports metrics in Prometheus format for monitoring and alerting.
 */

/**
 * Metric types
 */
interface MetricValue {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number;
  unit?: string;
}

/**
 * Metrics storage
 */
interface MetricsStore {
  // Instance spawning
  instanceSpawnTotal: number;
  instanceSpawnSuccessful: number;
  instanceSpawnFailed: number;
  instanceSpawnDurations: number[];

  // Tool calls
  toolCallTotal: number;
  toolCallsByName: Record<string, number>;
  toolCallDurations: Record<string, number[]>;
  toolCallErrors: Record<string, number>;

  // Socket connections
  socketConnectionsActive: number;
  socketConnectionsTotal: number;
  socketConnectionsLost: number;

  // Health checks
  healthCheckFailures: number;
  instanceRestarts: number;
  crashLoopsDetected: number;
}

/**
 * MCPMetrics class for collecting and exporting metrics
 */
export class MCPMetrics {
  private store: MetricsStore = {
    instanceSpawnTotal: 0,
    instanceSpawnSuccessful: 0,
    instanceSpawnFailed: 0,
    instanceSpawnDurations: [],

    toolCallTotal: 0,
    toolCallsByName: {},
    toolCallDurations: {},
    toolCallErrors: {},

    socketConnectionsActive: 0,
    socketConnectionsTotal: 0,
    socketConnectionsLost: 0,

    healthCheckFailures: 0,
    instanceRestarts: 0,
    crashLoopsDetected: 0,
  };

  /**
   * Record instance spawn attempt
   */
  recordInstanceSpawn(versionId: number, durationMs: number, success: boolean): void {
    this.store.instanceSpawnTotal++;
    if (success) {
      this.store.instanceSpawnSuccessful++;
    } else {
      this.store.instanceSpawnFailed++;
    }
    this.store.instanceSpawnDurations.push(durationMs);
  }

  /**
   * Record tool call
   */
  recordToolCall(tool: string, durationMs: number, success: boolean): void {
    this.store.toolCallTotal++;
    this.store.toolCallsByName[tool] = (this.store.toolCallsByName[tool] || 0) + 1;

    if (!this.store.toolCallDurations[tool]) {
      this.store.toolCallDurations[tool] = [];
    }
    this.store.toolCallDurations[tool].push(durationMs);

    if (!success) {
      this.store.toolCallErrors[tool] = (this.store.toolCallErrors[tool] || 0) + 1;
    }
  }

  /**
   * Record socket connection
   */
  recordSocketConnection(): void {
    this.store.socketConnectionsActive++;
    this.store.socketConnectionsTotal++;
  }

  /**
   * Record socket disconnection
   */
  recordSocketDisconnection(): void {
    this.store.socketConnectionsActive = Math.max(0, this.store.socketConnectionsActive - 1);
    this.store.socketConnectionsLost++;
  }

  /**
   * Record health check failure
   */
  recordHealthCheckFailure(): void {
    this.store.healthCheckFailures++;
  }

  /**
   * Record instance restart
   */
  recordInstanceRestart(): void {
    this.store.instanceRestarts++;
  }

  /**
   * Record crash loop detection
   */
  recordCrashLoopDetected(): void {
    this.store.crashLoopsDetected++;
  }

  /**
   * Calculate average duration from array
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate percentile from array
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)]!;
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    const lines: string[] = [];
    const timestamp = Date.now();

    // Instance metrics
    lines.push(`# HELP godot_instance_spawn_total Total number of instance spawn attempts`);
    lines.push(`# TYPE godot_instance_spawn_total counter`);
    lines.push(`godot_instance_spawn_total ${this.store.instanceSpawnTotal} ${timestamp}`);

    lines.push(`# HELP godot_instance_spawn_successful Number of successful instance spawns`);
    lines.push(`# TYPE godot_instance_spawn_successful counter`);
    lines.push(
      `godot_instance_spawn_successful ${this.store.instanceSpawnSuccessful} ${timestamp}`
    );

    lines.push(`# HELP godot_instance_spawn_failed Number of failed instance spawns`);
    lines.push(`# TYPE godot_instance_spawn_failed counter`);
    lines.push(`godot_instance_spawn_failed ${this.store.instanceSpawnFailed} ${timestamp}`);

    const avgSpawnDuration = this.calculateAverage(this.store.instanceSpawnDurations);
    lines.push(`# HELP godot_instance_spawn_duration_ms Average instance spawn duration`);
    lines.push(`# TYPE godot_instance_spawn_duration_ms gauge`);
    lines.push(`godot_instance_spawn_duration_ms ${avgSpawnDuration} ${timestamp}`);

    const p95SpawnDuration = this.calculatePercentile(this.store.instanceSpawnDurations, 95);
    lines.push(`# HELP godot_instance_spawn_duration_p95_ms 95th percentile spawn duration`);
    lines.push(`# TYPE godot_instance_spawn_duration_p95_ms gauge`);
    lines.push(`godot_instance_spawn_duration_p95_ms ${p95SpawnDuration} ${timestamp}`);

    // Tool call metrics
    lines.push(`# HELP godot_tool_call_total Total number of tool calls`);
    lines.push(`# TYPE godot_tool_call_total counter`);
    lines.push(`godot_tool_call_total ${this.store.toolCallTotal} ${timestamp}`);

    for (const [tool, count] of Object.entries(this.store.toolCallsByName)) {
      lines.push(`# HELP godot_tool_call_count Number of calls to specific tool`);
      lines.push(`# TYPE godot_tool_call_count gauge`);
      lines.push(`godot_tool_call_count{tool="${tool}"} ${count} ${timestamp}`);
    }

    // Tool call duration metrics
    for (const [tool, durations] of Object.entries(this.store.toolCallDurations)) {
      const avgDuration = this.calculateAverage(durations);
      const p95Duration = this.calculatePercentile(durations, 95);

      lines.push(`# HELP godot_tool_call_duration_ms Average duration of tool calls`);
      lines.push(`# TYPE godot_tool_call_duration_ms gauge`);
      lines.push(`godot_tool_call_duration_ms{tool="${tool}"} ${avgDuration} ${timestamp}`);

      lines.push(`# HELP godot_tool_call_duration_p95_ms 95th percentile tool call duration`);
      lines.push(`# TYPE godot_tool_call_duration_p95_ms gauge`);
      lines.push(`godot_tool_call_duration_p95_ms{tool="${tool}"} ${p95Duration} ${timestamp}`);
    }

    // Tool error metrics
    for (const [tool, errorCount] of Object.entries(this.store.toolCallErrors)) {
      lines.push(`# HELP godot_tool_call_errors Number of tool call errors`);
      lines.push(`# TYPE godot_tool_call_errors counter`);
      lines.push(`godot_tool_call_errors{tool="${tool}"} ${errorCount} ${timestamp}`);
    }

    // Socket metrics
    lines.push(`# HELP godot_socket_connections_active Number of active socket connections`);
    lines.push(`# TYPE godot_socket_connections_active gauge`);
    lines.push(
      `godot_socket_connections_active ${this.store.socketConnectionsActive} ${timestamp}`
    );

    lines.push(`# HELP godot_socket_connections_total Total socket connections made`);
    lines.push(`# TYPE godot_socket_connections_total counter`);
    lines.push(`godot_socket_connections_total ${this.store.socketConnectionsTotal} ${timestamp}`);

    lines.push(`# HELP godot_socket_connections_lost Number of lost socket connections`);
    lines.push(`# TYPE godot_socket_connections_lost counter`);
    lines.push(`godot_socket_connections_lost ${this.store.socketConnectionsLost} ${timestamp}`);

    // Health metrics
    lines.push(`# HELP godot_health_check_failures Number of health check failures`);
    lines.push(`# TYPE godot_health_check_failures counter`);
    lines.push(`godot_health_check_failures ${this.store.healthCheckFailures} ${timestamp}`);

    lines.push(`# HELP godot_instance_restarts Number of instance restarts`);
    lines.push(`# TYPE godot_instance_restarts counter`);
    lines.push(`godot_instance_restarts ${this.store.instanceRestarts} ${timestamp}`);

    lines.push(`# HELP godot_crash_loops_detected Number of crash loops detected`);
    lines.push(`# TYPE godot_crash_loops_detected counter`);
    lines.push(`godot_crash_loops_detected ${this.store.crashLoopsDetected} ${timestamp}`);

    return lines.join('\n') + '\n';
  }

  /**
   * Get metrics summary for debugging
   */
  getSummary() {
    return {
      instanceSpawn: {
        total: this.store.instanceSpawnTotal,
        successful: this.store.instanceSpawnSuccessful,
        failed: this.store.instanceSpawnFailed,
        avgDurationMs: this.calculateAverage(this.store.instanceSpawnDurations),
      },
      toolCalls: {
        total: this.store.toolCallTotal,
        byTool: this.store.toolCallsByName,
        errors: this.store.toolCallErrors,
      },
      socket: {
        active: this.store.socketConnectionsActive,
        total: this.store.socketConnectionsTotal,
        lost: this.store.socketConnectionsLost,
      },
      health: {
        checkFailures: this.store.healthCheckFailures,
        instanceRestarts: this.store.instanceRestarts,
        crashLoopsDetected: this.store.crashLoopsDetected,
      },
    };
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.store = {
      instanceSpawnTotal: 0,
      instanceSpawnSuccessful: 0,
      instanceSpawnFailed: 0,
      instanceSpawnDurations: [],

      toolCallTotal: 0,
      toolCallsByName: {},
      toolCallDurations: {},
      toolCallErrors: {},

      socketConnectionsActive: 0,
      socketConnectionsTotal: 0,
      socketConnectionsLost: 0,

      healthCheckFailures: 0,
      instanceRestarts: 0,
      crashLoopsDetected: 0,
    };
  }
}

/**
 * Global metrics instance
 */
export const mcpMetrics = new MCPMetrics();
