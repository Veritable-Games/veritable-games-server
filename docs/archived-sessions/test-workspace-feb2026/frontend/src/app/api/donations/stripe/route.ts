/**
 * Stripe Donation Creation API
 * Creates donation record and Stripe Checkout Session
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { donationService } from '@/lib/donations/service';
import { errorResponse, ValidationError, NotFoundError } from '@/lib/utils/api-errors';
import Stripe from 'stripe';
import { logger } from '@/lib/utils/logger';
import type { ProjectId } from '@/lib/donations/types';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// Singleton instance cache (performance optimization)
let stripeInstance: Stripe | null = null;

/**
 * Get or create Stripe client (lazy initialization)
 * Only creates instance when needed at runtime
 * @throws Error if STRIPE_SECRET_KEY not configured
 */
function getStripeClient(): Stripe {
  if (stripeInstance) {
    return stripeInstance;
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }

  stripeInstance = new Stripe(apiKey, {
    apiVersion: '2025-12-15.clover',
  });

  return stripeInstance;
}

interface StripeCheckoutRequest {
  amount: number;
  currency: string;
  projectId: number;
  donorName?: string;
  donorEmail?: string;
  message?: string;
  isRecurring?: boolean;
}

/**
 * POST /api/donations/stripe
 * Create donation and Stripe Checkout Session
 */
async function POSTHandler(request: NextRequest) {
  // During build time, return unavailable response
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json(
      {
        success: false,
        error: 'Service not available during build',
      },
      { status: 503 }
    );
  }

  try {
    const body: StripeCheckoutRequest = await request.json();

    // Validate input
    if (!body.amount || body.amount < 0.5) {
      return errorResponse(new ValidationError('Amount must be at least $0.50 for Stripe'));
    }

    if (!body.projectId) {
      return errorResponse(new ValidationError('Project ID is required'));
    }

    // Validate Stripe configuration
    if (!process.env.STRIPE_SECRET_KEY) {
      logger.error('Stripe configuration missing: STRIPE_SECRET_KEY not set');
      return errorResponse(new Error('Stripe not configured'));
    }

    // Get base URL (support both NEXT_PUBLIC_BASE_URL and NEXT_PUBLIC_SITE_URL)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;
    if (!baseUrl) {
      logger.error(
        'Base URL not configured (neither NEXT_PUBLIC_BASE_URL nor NEXT_PUBLIC_SITE_URL)'
      );
      return errorResponse(new Error('Server misconfigured'));
    }

    // Get project details for line item
    const project = await donationService.getFundingProjectById(body.projectId);
    if (!project) {
      return errorResponse(new NotFoundError('Project', body.projectId));
    }

    // Create Stripe Checkout Session first (so we have session ID for donation)

    // Get Stripe client (lazy initialization)
    const stripe = getStripeClient();

    // Determine session mode and line items based on recurring setting
    const isRecurring = body.isRecurring === true;

    const session = await stripe.checkout.sessions.create({
      mode: isRecurring ? 'subscription' : 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: body.currency.toLowerCase() || 'usd',
            product_data: {
              name: project.name,
              description: project.description || `Support ${project.name}`,
            },
            unit_amount: Math.round(body.amount * 100), // Convert to cents
            ...(isRecurring && {
              recurring: {
                interval: 'month',
              },
            }),
          },
          quantity: 1,
        },
      ],
      // Metadata for webhook handler (donationId will be added via webhook)
      metadata: {
        projectId: project.id.toString(),
        projectName: project.name,
        amount: body.amount.toString(),
        isRecurring: isRecurring.toString(),
      },
      // Customer email (if provided)
      ...(body.donorEmail && { customer_email: body.donorEmail }),
      // Success/Cancel URLs
      success_url: `${baseUrl}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/donate?canceled=true`,
    });

    logger.info('[Stripe API] Checkout session created:', {
      sessionId: session.id,
      checkoutUrl: session.url,
    });

    // Create donation record with Stripe session ID (pending status)
    const donation = await donationService.createDonation({
      amount: body.amount,
      currency: (body.currency as 'USD' | 'BTC' | 'EUR' | 'GBP') || 'USD',
      payment_processor: 'stripe',
      payment_intent_id: session.id, // Stripe Checkout Session ID
      donor_name: body.donorName,
      donor_email: body.donorEmail,
      is_anonymous: !body.donorName,
      message: body.message,
      allocations: [
        {
          project_id: body.projectId as ProjectId,
          percentage: 100, // For now, 100% to selected project
        },
      ],
    });

    logger.info('[Stripe API] Donation created:', {
      donationId: donation.id,
      amount: donation.amount,
      paymentId: session.id,
    });

    return NextResponse.json({
      success: true,
      donationId: donation.id,
      sessionId: session.id,
      checkoutUrl: session.url,
    });
  } catch (error: any) {
    logger.error('[Stripe API] Error:', error);

    // Stripe-specific error handling
    if (error.type === 'StripeCardError') {
      return errorResponse(new ValidationError(`Payment error: ${error.message}`));
    }

    if (error.type === 'StripeInvalidRequestError') {
      return errorResponse(new ValidationError(`Invalid request: ${error.message}`));
    }

    return errorResponse(error);
  }
}

export const POST = withSecurity(POSTHandler);
