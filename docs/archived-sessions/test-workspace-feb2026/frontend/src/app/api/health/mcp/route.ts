/**
 * GET /api/health/mcp - MCP instance health status
 *
 * Returns health status of all Godot MCP instances managed by the router.
 * Checks: instance count, health status, recent heartbeats, PID validity.
 *
 * Response:
 * {
 *   status: 'healthy' | 'degraded' | 'unhealthy',
 *   timestamp: ISO string,
 *   instances: {
 *     total: number,
 *     healthy: number,
 *     unhealthy: number,
 *     idle: number,
 *     details: [ { versionId, status, pid, socketPath, uptime, lastHeartbeat } ]
 *   }
 * }
 */

import { NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function GETHandler() {
  try {
    // Query all Godot version instances from database
    const result = await dbAdapter.query(
      `SELECT
        id as version_id,
        version_tag,
        instance_status as status,
        instance_pid as pid,
        instance_socket_path as socket_path,
        instance_last_heartbeat as last_heartbeat,
        EXTRACT(EPOCH FROM (NOW() - instance_last_heartbeat)) as seconds_since_heartbeat
       FROM godot_versions
       WHERE instance_status IS NOT NULL
       ORDER BY id`,
      [],
      { schema: 'system' }
    );

    const instances = result.rows || [];

    // Categorize instances by status
    let healthy = 0;
    let unhealthy = 0;
    let idle = 0;

    const details = instances.map((instance: any) => {
      const secondsSinceHeartbeat = instance.seconds_since_heartbeat || Infinity;
      let effectiveStatus = instance.status;

      // Determine health based on status and heartbeat
      if (instance.status === 'ready') {
        if (secondsSinceHeartbeat < 30) {
          // Fresh heartbeat - healthy
          healthy++;
        } else if (secondsSinceHeartbeat < 60) {
          // Getting old but still acceptable
          effectiveStatus = 'idle';
          idle++;
        } else {
          // Stale - likely dead
          effectiveStatus = 'error';
          unhealthy++;
        }
      } else if (instance.status === 'error') {
        unhealthy++;
      } else if (instance.status === 'idle') {
        idle++;
      }

      return {
        versionId: instance.version_id,
        versionTag: instance.version_tag,
        status: effectiveStatus,
        pid: instance.pid,
        socketPath: instance.socket_path,
        lastHeartbeat: instance.last_heartbeat
          ? new Date(instance.last_heartbeat).toISOString()
          : null,
        secondsSinceHeartbeat:
          secondsSinceHeartbeat === Infinity ? null : Math.round(secondsSinceHeartbeat),
      };
    });

    // Determine overall status
    let overallStatus = 'healthy';
    if (unhealthy > 0) {
      overallStatus = unhealthy > healthy ? 'unhealthy' : 'degraded';
    } else if (instances.length === 0) {
      overallStatus = 'degraded'; // No instances running
    }

    const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 503 : 503;

    return NextResponse.json(
      {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        instances: {
          total: instances.length,
          healthy,
          unhealthy,
          idle,
          details,
        },
      },
      { status: httpStatus }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        instances: {
          total: 0,
          healthy: 0,
          unhealthy: 0,
          idle: 0,
          details: [],
        },
      },
      { status: 503 }
    );
  }
}

export const GET = GETHandler;
