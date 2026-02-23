/**
 * Portal API Route
 * POST: Generate Stripe Customer Portal session URL
 *
 * Creates a Stripe Billing Portal session for subscription management
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { subscriptionService } from '@/lib/donations/subscription-service';
import { errorResponse, ValidationError, NotFoundError } from '@/lib/utils/api-errors';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * POST /api/donations/portal
 * Generate Stripe Customer Portal URL
 */
async function POSTHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const { stripeCustomerId, returnUrl } = body;

    if (!stripeCustomerId) {
      return errorResponse(new ValidationError('Stripe customer ID is required'));
    }

    // Default return URL if not provided
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      'http://localhost:3000';
    const finalReturnUrl = returnUrl || `${baseUrl}/donate/dashboard`;

    // Generate Stripe portal session
    const portalUrl = await subscriptionService.createStripePortalSession(
      stripeCustomerId,
      finalReturnUrl
    );

    if (!portalUrl) {
      return errorResponse(new Error('Failed to create Stripe portal session. Please try again.'));
    }

    return NextResponse.json({
      success: true,
      portalUrl,
    });
  } catch (error: any) {
    logger.error('Error creating portal session:', error);
    return errorResponse(error);
  }
}

// Apply security middleware
export const POST = withSecurity(POSTHandler, {
  enableCSRF: true,
});
