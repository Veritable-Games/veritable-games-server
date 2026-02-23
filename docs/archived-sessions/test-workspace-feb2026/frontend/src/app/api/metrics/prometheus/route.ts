/**
 * GET /api/metrics/prometheus - Prometheus metrics export
 *
 * Exports MCP system metrics in Prometheus text format.
 * Includes: instance spawns, tool calls, socket connections, health checks.
 *
 * Used by Prometheus scrapers for monitoring and alerting.
 * Response format: text/plain with Prometheus line protocol.
 *
 * Example:
 * # HELP godot_instance_spawn_total Total number of instance spawn attempts
 * # TYPE godot_instance_spawn_total counter
 * godot_instance_spawn_total 42 1735689600000
 */

import { NextResponse } from 'next/server';
import { mcpMetrics } from '@/lib/mcp/metrics';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime metrics access
export const dynamic = 'force-dynamic';

async function GETHandler() {
  try {
    // Get metrics in Prometheus format
    const prometheusMetrics = mcpMetrics.exportPrometheus();

    // Return as text/plain (Prometheus standard)
    return new NextResponse(prometheusMetrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    logger.error('[Prometheus] Failed to export metrics:', error);

    // Return error in Prometheus format
    const errorMetrics = `# HELP godot_metrics_export_error Whether metrics export encountered an error
# TYPE godot_metrics_export_error gauge
godot_metrics_export_error 1 ${Date.now()}
`;

    return new NextResponse(errorMetrics, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}

export const GET = GETHandler;
