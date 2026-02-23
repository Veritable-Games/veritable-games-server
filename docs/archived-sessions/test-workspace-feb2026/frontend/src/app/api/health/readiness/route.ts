/**
 * GET /api/health/readiness - Kubernetes readiness probe
 *
 * Checks if the service is ready to accept traffic.
 * Verifies critical dependencies like database connectivity.
 * Returns 200 if ready, 503 if not ready.
 *
 * Used by Kubernetes to determine if pod should receive traffic.
 * May take longer than liveness (up to 5s timeout typical).
 */

import { NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function GETHandler() {
  const startTime = Date.now();

  try {
    // Test database connectivity
    const result = await dbAdapter.query('SELECT 1 as test', [], { schema: 'system' });

    if (!result.rows || result.rows[0]?.test !== 1) {
      return NextResponse.json(
        {
          status: 'not_ready',
          reason: 'database_check_failed',
          timestamp: new Date().toISOString(),
          checks: {
            database: false,
          },
        },
        { status: 503 }
      );
    }

    // All checks passed
    return NextResponse.json(
      {
        status: 'ready',
        timestamp: new Date().toISOString(),
        responseTime: `${Date.now() - startTime}ms`,
        checks: {
          database: true,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'not_ready',
        reason: 'readiness_check_failed',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        checks: {
          database: false,
        },
      },
      { status: 503 }
    );
  }
}

export const GET = GETHandler;
