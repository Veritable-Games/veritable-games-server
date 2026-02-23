/**
 * Funding Projects API
 * Public endpoint for listing active funding projects
 */

import { NextRequest, NextResponse } from 'next/server';
import { donationService } from '@/lib/donations/service';
import { errorResponse } from '@/lib/utils/api-errors';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/donations/projects
 * Get all active funding projects with progress
 *
 * No authentication required - public data
 */
export async function GET(request: NextRequest) {
  try {
    const projects = await donationService.getFundingProjectsWithProgress();

    return NextResponse.json(projects, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error: any) {
    logger.error('[Projects API] Error:', error);
    return errorResponse(error);
  }
}
