/**
 * Manage API Route
 * GET: Validate magic link token and return subscription details
 *
 * Used by the /donate/manage page to verify the token and get subscription info
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { subscriptionService } from '@/lib/donations/subscription-service';
import { errorResponse, ValidationError } from '@/lib/utils/api-errors';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/donations/manage?token=xxx
 * Validate magic link token and return subscription info
 */
async function GETHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return errorResponse(new ValidationError('Token is required'));
    }

    // Validate the token (this also invalidates it for one-time use)
    const subscription = await subscriptionService.validatePortalToken(token);

    if (!subscription) {
      return NextResponse.json(
        { error: 'Invalid or expired token. Please request a new management link.' },
        { status: 404 }
      );
    }

    // Get donation history for this email
    const donationHistory = await subscriptionService.getDonationHistoryByEmail(
      subscription.donor_email,
      20
    );

    // Get all subscriptions for this email
    const allSubscriptions = await subscriptionService.getSubscriptionsByEmail(
      subscription.donor_email
    );

    // Get total donated
    const totalDonated = await subscriptionService.getTotalDonatedByEmail(subscription.donor_email);

    return NextResponse.json({
      success: true,
      subscription,
      allSubscriptions,
      donationHistory,
      totalDonated,
      donorEmail: subscription.donor_email,
    });
  } catch (error: any) {
    logger.error('Error validating manage token:', error);
    return errorResponse(error);
  }
}

export const GET = withSecurity(GETHandler);
