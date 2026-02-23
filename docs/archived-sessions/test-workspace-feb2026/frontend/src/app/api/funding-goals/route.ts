/**
 * Funding Goals API Route
 * GET: Fetch active funding goals and projects
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { donationService } from '@/lib/donations/service';
import { errorResponse } from '@/lib/utils/api-errors';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/funding-goals
 * Fetch active funding goals and fundable projects
 */
async function GETHandler(request: NextRequest) {
  try {
    // Fetch goals and projects in parallel
    const [goals, projects] = await Promise.all([
      donationService.getActiveFundingGoals(),
      donationService.getFundingProjectsWithProgress(),
    ]);

    return NextResponse.json({
      success: true,
      goals,
      projects,
    });
  } catch (error: any) {
    logger.error('Error fetching funding goals:', error);
    return errorResponse(error);
  }
}

// Apply security middleware (no CSRF needed for GET)
export const GET = withSecurity(GETHandler, {});
