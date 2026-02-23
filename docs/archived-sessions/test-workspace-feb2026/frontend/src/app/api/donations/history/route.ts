/**
 * Donation History API
 * GET: Returns paginated user donation history with allocations
 *
 * Query Parameters:
 * - limit: Number of donations per page (default: 20, max: 100)
 * - offset: Number of donations to skip (default: 0)
 *
 * Returns:
 * - donations: Array of donations with allocations
 * - total: Total number of donations
 * - hasMore: Whether there are more donations to load
 *
 * Used by: /donate/manage page for donation timeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';
import { requireAuth } from '@/lib/auth/session';
import type { DonationWithAllocations } from '@/lib/donations/types';

// Mark as dynamic - requires runtime database access
export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * GET /api/donations/history?limit=20&offset=0
 * Returns paginated user donation history
 */
async function GETHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Get authenticated user (throws if not authenticated)
    const user = await requireAuth();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const limit = limitParam ? Math.min(parseInt(limitParam, 10), MAX_LIMIT) : DEFAULT_LIMIT;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    // Validate parameters
    if (isNaN(limit) || limit < 1) {
      throw new ValidationError('Invalid limit parameter');
    }
    if (isNaN(offset) || offset < 0) {
      throw new ValidationError('Invalid offset parameter');
    }

    // Get total count and donations in parallel
    const [totalResult, donations] = await Promise.all([
      // Get total count
      dbAdapter.query<{ count: string }>(
        `
        SELECT COUNT(*) as count
        FROM donations
        WHERE user_id = $1
          AND payment_status = 'completed'
        `,
        [user.id],
        { schema: 'donations' }
      ),

      // Get paginated donations with allocations
      getUserDonations(user.id, limit, offset),
    ]);

    const total = parseInt(totalResult.rows[0]?.count || '0', 10);
    const hasMore = offset + limit < total;

    return NextResponse.json({
      success: true,
      donations,
      pagination: {
        limit,
        offset,
        total,
        hasMore,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching donation history:', error);
    return errorResponse(error);
  }
}

/**
 * Get user donations with allocations
 */
async function getUserDonations(
  userId: number,
  limit: number,
  offset: number
): Promise<DonationWithAllocations[]> {
  // Get donations
  const donationsResult = await dbAdapter.query<any>(
    `
    SELECT
      id,
      user_id,
      amount,
      currency,
      payment_processor,
      payment_id,
      payment_status,
      donor_name,
      donor_email,
      is_anonymous,
      message,
      metadata,
      created_at,
      updated_at,
      completed_at
    FROM donations
    WHERE user_id = $1
      AND payment_status = 'completed'
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset],
    { schema: 'donations' }
  );

  const donations = donationsResult.rows;

  if (donations.length === 0) {
    return [];
  }

  // Get donation IDs for allocation query
  const donationIds = donations.map((d: any) => d.id);

  // Get allocations for all donations
  const allocationsResult = await dbAdapter.query<any>(
    `
    SELECT
      da.donation_id,
      da.project_id,
      da.amount,
      fp.name as project_name,
      fp.slug as project_slug
    FROM donation_allocations da
    LEFT JOIN funding_projects fp ON da.project_id = fp.id
    WHERE da.donation_id = ANY($1::int[])
    ORDER BY da.donation_id, da.id
    `,
    [donationIds],
    { schema: 'donations' }
  );

  // Group allocations by donation_id
  const allocationsByDonation: Record<number, any[]> = {};
  for (const alloc of allocationsResult.rows) {
    if (!allocationsByDonation[alloc.donation_id]) {
      allocationsByDonation[alloc.donation_id] = [];
    }
    // TypeScript doesn't understand the check above, so use non-null assertion
    allocationsByDonation[alloc.donation_id]!.push({
      project_id: alloc.project_id,
      project_name: alloc.project_name,
      project_slug: alloc.project_slug,
      amount: parseFloat(alloc.amount),
    });
  }

  // Attach allocations to donations
  return donations.map((donation: any) => ({
    id: donation.id,
    user_id: donation.user_id,
    amount: parseFloat(donation.amount),
    currency: donation.currency,
    payment_processor: donation.payment_processor,
    payment_id: donation.payment_id,
    payment_status: donation.payment_status,
    donor_name: donation.donor_name,
    donor_email: donation.donor_email,
    is_anonymous: donation.is_anonymous,
    message: donation.message,
    metadata: donation.metadata || {},
    created_at: donation.created_at,
    updated_at: donation.updated_at,
    completed_at: donation.completed_at,
    allocations: allocationsByDonation[donation.id] || [],
  }));
}

export const GET = withSecurity(GETHandler, {
  enableCSRF: false, // GET request doesn't need CSRF
});
