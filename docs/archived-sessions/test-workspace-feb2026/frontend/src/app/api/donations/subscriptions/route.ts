/**
 * Subscriptions API Route
 * GET: List subscriptions for authenticated user or by email
 *
 * Used by the Donor Dashboard to fetch subscription list
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { subscriptionService } from '@/lib/donations/subscription-service';
import { getServerSession } from '@/lib/auth/session';
import { errorResponse } from '@/lib/utils/api-errors';
import type { Subscription, Donation } from '@/lib/donations/types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/donations/subscriptions
 * List subscriptions for authenticated user
 * Query params:
 * - email: Optional email to filter by (for guest dashboard via token context)
 */
async function GETHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    // Try to get current user
    const user = await getServerSession();

    // If no user and no email, return empty
    if (!user && !email) {
      return NextResponse.json({
        success: true,
        subscriptions: [],
        message: 'Please log in or provide an email to view subscriptions.',
      });
    }

    let subscriptions: Subscription[] = [];
    let donationHistory: Donation[] = [];
    let totalDonated: number = 0;

    if (user) {
      // Authenticated user - get subscriptions by user ID
      subscriptions = await subscriptionService.getSubscriptionsByUserId(user.id);
      donationHistory = await subscriptionService.getDonationHistoryByUserId(user.id, 50);

      // For authenticated users, also check by email if they have one
      if (user.email) {
        const emailSubscriptions = await subscriptionService.getSubscriptionsByEmail(user.email);
        // Merge subscriptions (in case some were created before linking to user)
        const existingIds = new Set(subscriptions.map(s => s.id));
        for (const sub of emailSubscriptions) {
          if (!existingIds.has(sub.id)) {
            subscriptions.push(sub);
          }
        }
        totalDonated = await subscriptionService.getTotalDonatedByEmail(user.email);
      } else {
        totalDonated = 0;
      }
    } else if (email) {
      // Guest with email - get subscriptions by email
      subscriptions = await subscriptionService.getSubscriptionsByEmail(email);
      donationHistory = await subscriptionService.getDonationHistoryByEmail(email, 50);
      totalDonated = await subscriptionService.getTotalDonatedByEmail(email);
    } else {
      subscriptions = [];
      donationHistory = [];
      totalDonated = 0;
    }

    // Sort subscriptions: active first, then by date
    subscriptions.sort((a, b) => {
      const statusOrder: Record<string, number> = {
        active: 0,
        trialing: 1,
        past_due: 2,
        paused: 3,
        canceled: 4,
        unpaid: 5,
        incomplete: 6,
      };
      const orderA = statusOrder[a.status] ?? 10;
      const orderB = statusOrder[b.status] ?? 10;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json({
      success: true,
      subscriptions,
      donationHistory,
      totalDonated,
      isAuthenticated: !!user,
    });
  } catch (error: any) {
    logger.error('Error fetching subscriptions:', error);
    return errorResponse(error);
  }
}

export const GET = withSecurity(GETHandler);
