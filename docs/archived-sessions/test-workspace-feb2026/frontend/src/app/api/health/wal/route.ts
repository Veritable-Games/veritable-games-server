/**
 * WAL Health Monitoring API Endpoint
 *
 * Provides real-time WAL file monitoring and checkpoint capabilities
 * for production systems monitoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { walMonitor } from '@/lib/database/legacy/wal-monitor';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function GETHandler(request: NextRequest) {
  try {
    const healthStatus = await walMonitor.getHealthStatus();

    // Include additional system information
    const response = {
      timestamp: new Date().toISOString(),
      wal: healthStatus,
      system: {
        node_env: process.env.NODE_ENV,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
      },
    };

    // Set appropriate HTTP status based on WAL health
    let httpStatus = 200;
    if (healthStatus.status === 'warning') {
      httpStatus = 202; // Accepted but with warnings
    } else if (healthStatus.status === 'critical') {
      httpStatus = 503; // Service unavailable due to critical WAL issues
    }

    return NextResponse.json(response, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-WAL-Status': healthStatus.status,
        'X-Monitoring-Active': healthStatus.monitoringActive.toString(),
      },
    });
  } catch (error) {
    logger.error('WAL health check error:', error);

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        error: 'WAL health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      },
      { status: 500 }
    );
  }
}

async function POSTHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'checkpoint':
        logger.info('Manual WAL checkpoint requested');
        const checkpointResult = await walMonitor.performCheckpoint('forums');

        return NextResponse.json({
          timestamp: new Date().toISOString(),
          action: 'checkpoint',
          result: checkpointResult,
        });

      case 'start_monitoring':
        walMonitor.startMonitoring();
        return NextResponse.json({
          timestamp: new Date().toISOString(),
          action: 'start_monitoring',
          result: { success: true, message: 'Monitoring started' },
        });

      case 'stop_monitoring':
        walMonitor.stopMonitoring();
        return NextResponse.json({
          timestamp: new Date().toISOString(),
          action: 'stop_monitoring',
          result: { success: true, message: 'Monitoring stopped' },
        });

      default:
        return NextResponse.json(
          {
            error: 'Invalid action',
            available_actions: ['checkpoint', 'start_monitoring', 'stop_monitoring'],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('WAL control action error:', error);

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        error: 'WAL control action failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Apply security middleware
export const GET = withSecurity(GETHandler, {});
export const POST = withSecurity(POSTHandler, {});
