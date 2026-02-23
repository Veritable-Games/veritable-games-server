/**
 * Stripe Webhook Handler
 * Processes Stripe events (checkout.session.completed, etc.)
 *
 * SECURITY: Verifies webhook signatures using STRIPE_WEBHOOK_SECRET
 * NO CSRF protection (external webhook from Stripe)
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { donationService } from '@/lib/donations/service';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime processing
export const dynamic = 'force-dynamic';

// Disable body parsing - Stripe signature verification requires raw body
export const runtime = 'nodejs';

// Singleton instance cache
let stripeInstance: Stripe | null = null;

/**
 * Get or create Stripe client
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

/**
 * POST /api/donations/stripe/webhook
 * Handle Stripe webhook events
 *
 * Events handled:
 * - checkout.session.completed: Update donation to completed
 * - checkout.session.expired: Update donation to failed
 */
export async function POST(request: NextRequest) {
  try {
    // Get webhook signature from headers
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      logger.error('[Stripe Webhook] Missing stripe-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // Verify webhook secret is configured
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature and construct event
    const stripe = getStripeClient();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      logger.error('[Stripe Webhook] Signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    logger.info('[Stripe Webhook] Event received:', {
      type: event.type,
      id: event.id,
    });

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        logger.info('[Stripe Webhook] Checkout session completed:', {
          sessionId: session.id,
          paymentStatus: session.payment_status,
          amountTotal: session.amount_total,
        });

        // Update donation status to completed
        // The session.id was stored as payment_intent_id when donation was created
        await donationService.updatePaymentStatus(session.id, 'completed', {
          payment_status: session.payment_status,
          amount_total: session.amount_total,
          currency: session.currency,
          customer_email: session.customer_details?.email,
          completed_at: new Date().toISOString(),
        });

        logger.info('[Stripe Webhook] Donation marked as completed:', {
          sessionId: session.id,
        });

        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;

        logger.info('[Stripe Webhook] Checkout session expired:', {
          sessionId: session.id,
        });

        // Update donation status to failed (user abandoned checkout)
        await donationService.updatePaymentStatus(session.id, 'failed', {
          reason: 'Session expired without payment',
          expired_at: new Date().toISOString(),
        });

        logger.info('[Stripe Webhook] Donation marked as failed (expired):', {
          sessionId: session.id,
        });

        break;
      }

      default:
        // Log unhandled event types (for debugging/monitoring)
        logger.info('[Stripe Webhook] Unhandled event type:', {
          type: event.type,
          id: event.id,
        });
    }

    // Always return 200 to Stripe to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error: any) {
    logger.error('[Stripe Webhook] Error processing webhook:', {
      error: error.message,
      stack: error.stack,
    });

    // Return 500 so Stripe knows to retry
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
