/**
 * Transparency Metrics API Route
 * GET: Fetch financial transparency data for public dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { transparencyService } from '@/lib/donations/service';
import { errorResponse } from '@/lib/utils/api-errors';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/transparency/metrics
 * Fetch comprehensive transparency metrics
 * Public endpoint - no authentication required
 */
async function GETHandler(request: NextRequest) {
  try {
    const metrics = await transparencyService.getTransparencyMetrics();

    return NextResponse.json({
      success: true,
      ...metrics,
    });
  } catch (error: any) {
    logger.error('Error fetching transparency metrics:', error);
    return errorResponse(error);
  }
}

// Apply security middleware (no CSRF needed for GET, public data)
export const GET = withSecurity(GETHandler, {});
