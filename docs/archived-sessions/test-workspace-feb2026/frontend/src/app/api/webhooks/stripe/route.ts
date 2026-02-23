/**
 * Stripe Webhook Handler
 * Receives payment notifications from Stripe
 *
 * IMPORTANT: NO CSRF protection (external webhook)
 * Signature verification required for security
 */

import { NextRequest, NextResponse } from 'next/server';
import { donationService } from '@/lib/donations/service';
import { subscriptionService } from '@/lib/donations/subscription-service';
import { emailService } from '@/lib/email/service';
import type { SubscriptionStatus } from '@/lib/donations/types';
import Stripe from 'stripe';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// Initialize Stripe (only if API key is configured)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover', // Latest API version
    })
  : null;

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      logger.error('Stripe not configured');
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      logger.error('Missing Stripe-Signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // Verify webhook signature
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      logger.error('Stripe webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    logger.info('Stripe webhook received:', {
      type: event.type,
      id: event.id,
    });

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        // Payment successful
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await donationService.updatePaymentStatus(paymentIntent.id, 'completed', {
          stripe_event: event.type,
          stripe_payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount / 100, // Convert cents to dollars
          currency: paymentIntent.currency.toUpperCase(),
          payment_method: paymentIntent.payment_method,
          timestamp: new Date(event.created * 1000).toISOString(),
        });
        break;

      case 'payment_intent.payment_failed':
        // Payment failed
        const failedIntent = event.data.object as Stripe.PaymentIntent;
        await donationService.updatePaymentStatus(failedIntent.id, 'failed', {
          stripe_event: event.type,
          stripe_payment_intent_id: failedIntent.id,
          error_message: failedIntent.last_payment_error?.message,
          timestamp: new Date(event.created * 1000).toISOString(),
        });
        break;

      case 'charge.refunded':
        // Refund issued
        const charge = event.data.object as Stripe.Charge;
        await donationService.updatePaymentStatus(charge.payment_intent as string, 'refunded', {
          stripe_event: event.type,
          stripe_charge_id: charge.id,
          refund_amount: charge.amount_refunded / 100,
          timestamp: new Date(event.created * 1000).toISOString(),
        });
        break;

      case 'checkout.session.completed':
        // Checkout session completed (alternative payment flow)
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_intent) {
          const updatedDonation = await donationService.updatePaymentStatus(
            session.payment_intent as string,
            'completed',
            {
              stripe_event: event.type,
              stripe_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent,
              amount: (session.amount_total || 0) / 100,
              currency: (session.currency || 'usd').toUpperCase(),
              timestamp: new Date(event.created * 1000).toISOString(),
            }
          );

          // Send donation receipt email
          if (updatedDonation && session.customer_email) {
            try {
              // Get project names from allocations if available
              const projectNames: string[] = [];
              if (session.metadata?.project_id) {
                const projectName = session.metadata?.project_name || 'Project';
                projectNames.push(projectName);
              }

              await emailService.sendDonationReceipt({
                donorEmail: session.customer_email,
                donorName: session.metadata?.donor_name || undefined,
                amount: (session.amount_total || 0) / 100,
                currency: (session.currency || 'usd').toUpperCase(),
                projectNames,
                donationType: session.mode === 'subscription' ? 'recurring' : 'one_time',
                donationId: updatedDonation.id,
                paymentDate: new Date(event.created * 1000),
              });
              logger.info('Sent donation receipt for checkout session:', session.id);
            } catch (emailError) {
              logger.error('Failed to send donation receipt:', emailError);
              // Don't fail the webhook for email errors
            }
          }
        }
        break;

      // =========================================================================
      // SUBSCRIPTION LIFECYCLE EVENTS (Recurring Donations)
      // =========================================================================

      case 'customer.subscription.created':
        // New subscription created
        const newSub = event.data.object as Stripe.Subscription & {
          current_period_start: number;
          current_period_end: number;
        };
        try {
          await subscriptionService.createSubscription({
            stripeSubscriptionId: newSub.id,
            stripeCustomerId: newSub.customer as string,
            donorEmail: newSub.metadata?.donor_email || '',
            donorName: newSub.metadata?.donor_name,
            projectId: newSub.metadata?.project_id
              ? parseInt(newSub.metadata.project_id, 10)
              : undefined,
            amount: (newSub.items.data[0]?.price?.unit_amount || 0) / 100,
            currency: (newSub.currency?.toUpperCase() || 'USD') as 'USD' | 'BTC' | 'EUR' | 'GBP',
            interval: newSub.items.data[0]?.price?.recurring?.interval as 'month' | 'year',
            status: newSub.status as SubscriptionStatus,
            currentPeriodStart: new Date(newSub.current_period_start * 1000),
            currentPeriodEnd: new Date(newSub.current_period_end * 1000),
          });
          logger.info('Created subscription:', newSub.id);
        } catch (err: any) {
          logger.error('Error creating subscription:', err.message);
        }
        break;

      case 'customer.subscription.updated':
        // Subscription updated (status change, period change, etc.)
        const updatedSub = event.data.object as Stripe.Subscription & {
          current_period_end: number;
        };
        try {
          await subscriptionService.updateSubscriptionStatus(
            updatedSub.id,
            updatedSub.status as SubscriptionStatus,
            {
              canceledAt: updatedSub.canceled_at ? new Date(updatedSub.canceled_at * 1000) : null,
              currentPeriodEnd: new Date(updatedSub.current_period_end * 1000),
            }
          );
          logger.info('Updated subscription:', updatedSub.id, 'status:', updatedSub.status);
        } catch (err: any) {
          logger.error('Error updating subscription:', err.message);
        }
        break;

      case 'customer.subscription.deleted':
        // Subscription canceled/deleted
        const deletedSub = event.data.object as Stripe.Subscription;
        try {
          await subscriptionService.updateSubscriptionStatus(deletedSub.id, 'canceled', {
            canceledAt: new Date(),
          });
          logger.info('Canceled subscription:', deletedSub.id);
        } catch (err: any) {
          logger.error('Error canceling subscription:', err.message);
        }
        break;

      case 'invoice.payment_succeeded':
        // Invoice paid (initial payment or recurring charge)
        // Cast to include subscription property (available in webhook payloads)
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | null;
        };
        // Only process recurring payments (not the initial checkout)
        if (invoice.subscription && invoice.billing_reason === 'subscription_cycle') {
          try {
            const donation = await subscriptionService.recordRecurringPayment({
              stripeSubscriptionId: invoice.subscription,
              stripeInvoiceId: invoice.id,
              amount: (invoice.amount_paid || 0) / 100,
              currency: (invoice.currency?.toUpperCase() || 'USD') as 'USD' | 'BTC' | 'EUR' | 'GBP',
              paidAt: new Date((invoice.status_transitions?.paid_at || event.created) * 1000),
            });
            logger.info(
              'Recorded recurring payment:',
              invoice.id,
              'subscription:',
              invoice.subscription,
              'donation:',
              donation?.id
            );

            // Send recurring donation receipt email
            if (donation && invoice.customer_email) {
              try {
                // Get subscription details for donor info
                const subscriptionDetails = await subscriptionService.getSubscriptionByStripeId(
                  invoice.subscription
                );
                // Project names can be extracted from invoice metadata if available
                const projectNames: string[] = [];
                if (invoice.metadata?.project_name) {
                  projectNames.push(invoice.metadata.project_name);
                }

                await emailService.sendDonationReceipt({
                  donorEmail: invoice.customer_email,
                  donorName: subscriptionDetails?.donor_name || undefined,
                  amount: (invoice.amount_paid || 0) / 100,
                  currency: (invoice.currency || 'usd').toUpperCase(),
                  projectNames,
                  donationType: 'recurring',
                  donationId: donation.id,
                  paymentDate: new Date(
                    (invoice.status_transitions?.paid_at || event.created) * 1000
                  ),
                });
                logger.info('Sent recurring donation receipt for invoice:', invoice.id);
              } catch (emailError) {
                logger.error('Failed to send recurring donation receipt:', emailError);
                // Don't fail the webhook for email errors
              }
            }
          } catch (err: any) {
            logger.error('Error recording recurring payment:', err.message);
          }
        }
        break;

      case 'invoice.payment_failed':
        // Invoice payment failed (recurring charge failed)
        const failedInvoice = event.data.object as Stripe.Invoice & {
          subscription?: string | null;
        };
        if (failedInvoice.subscription) {
          try {
            await subscriptionService.updateSubscriptionStatus(
              failedInvoice.subscription,
              'past_due'
            );
            logger.info('Marked subscription as past_due:', failedInvoice.subscription);
          } catch (err: any) {
            logger.error('Error updating subscription status:', err.message);
          }
        }
        break;

      default:
        logger.info('Unhandled Stripe event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    logger.error('Stripe webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    );
  }
}

// Export config to disable body parsing (needed for signature verification)
export const config = {
  api: {
    bodyParser: false,
  },
};
