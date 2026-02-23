/**
 * Donation Management Stats API
 * GET: Returns user-specific donation statistics
 *
 * Returns:
 * - totalDonated: Total amount donated by user
 * - subscriptionCount: Number of subscriptions (active/total)
 * - donationCount: Total number of donations made
 *
 * Used by: /donate/manage page for user dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { errorResponse, AuthenticationError } from '@/lib/utils/api-errors';
import { donationService } from '@/lib/donations/service';
import { subscriptionService } from '@/lib/donations/subscription-service';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';
import { requireAuth } from '@/lib/auth/session';

// Mark as dynamic - requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/donations/manage/stats
 * Returns user-specific donation statistics
 */
async function GETHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Get authenticated user (throws if not authenticated)
    const user = await requireAuth();

    // Fetch user stats in parallel for better performance
    const [totalDonated, subscriptions, donationCount] = await Promise.all([
      // Total amount donated
      donationService.getUserTotalDonations(user.id),

      // All subscriptions
      subscriptionService.getSubscriptionsByUserId(user.id),

      // Total donation count
      getUserDonationCount(user.id),
    ]);

    // Count active subscriptions
    const activeSubscriptionCount = subscriptions.filter(s => s.status === 'active').length;

    return NextResponse.json({
      success: true,
      stats: {
        totalDonated: parseFloat(totalDonated.toFixed(2)),
        subscriptionCount: subscriptions.length,
        activeSubscriptionCount,
        donationCount,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching donation stats:', error);
    return errorResponse(error);
  }
}

/**
 * Get total number of donations made by user
 */
async function getUserDonationCount(userId: number): Promise<number> {
  const result = await dbAdapter.query<{ count: string }>(
    `
    SELECT COUNT(*) as count
    FROM donations
    WHERE user_id = $1
      AND payment_status = 'completed'
    `,
    [userId],
    { schema: 'donations' }
  );

  const row = result.rows[0];
  return row ? parseInt(row.count, 10) : 0;
}

export const GET = withSecurity(GETHandler, {
  enableCSRF: false, // GET request doesn't need CSRF
});
