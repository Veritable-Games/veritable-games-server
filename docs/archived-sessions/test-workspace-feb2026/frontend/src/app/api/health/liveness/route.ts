/**
 * GET /api/health/liveness - Kubernetes liveness probe
 *
 * Simple process alive check - no external dependencies.
 * Returns 200 if the process is running, 503 if not.
 *
 * Used by Kubernetes to detect dead processes and restart them.
 * Should always respond quickly (<100ms).
 */

import { NextResponse } from 'next/server';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function GETHandler() {
  return NextResponse.json(
    {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    { status: 200 }
  );
}

export const GET = GETHandler;
