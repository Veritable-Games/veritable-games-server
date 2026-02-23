/**
 * BTCPay Server Webhook Handler
 * Receives payment notifications from BTCPay Server
 *
 * IMPORTANT: NO CSRF protection (external webhook)
 * Signature verification required for security
 */

import { NextRequest, NextResponse } from 'next/server';
import { donationService } from '@/lib/donations/service';
import crypto from 'crypto';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * Verify BTCPay webhook signature
 * @param payload Raw request body
 * @param signature Signature from BTCPay-Sig header
 * @param secret Webhook secret from BTCPay settings
 */
function verifyBTCPaySignature(payload: string, signature: string, secret: string): boolean {
  try {
    // BTCPay uses HMAC-SHA256 with 'sha256=' prefix
    const expectedSignature =
      'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Debug logging
    logger.info('[BTCPay Webhook Debug] Signature verification:', {
      receivedSignature: signature,
      expectedSignature: expectedSignature,
      signatureMatch: signature === expectedSignature,
      payloadLength: payload.length,
      payloadPreview: payload.substring(0, 100),
      secretLength: secret.length,
      secretPrefix: secret.substring(0, 4) + '...',
    });

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (error) {
    logger.error('BTCPay signature verification error:', error);
    return false;
  }
}

/**
 * POST /api/webhooks/btcpay
 * Handle BTCPay Server webhook events
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('BTCPAY-SIG') || request.headers.get('btcpay-sig');

    // Debug: Log all headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = key.toLowerCase().includes('sig') ? value : value.substring(0, 50);
    });
    logger.info('[BTCPay Webhook Debug] Incoming webhook:', {
      headers,
      bodyLength: body.length,
      bodyPreview: body.substring(0, 200),
    });

    // Verify signature
    const webhookSecret = process.env.BTCPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('BTCPAY_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    if (!signature) {
      logger.error('Missing BTCPAY-SIG header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    if (!verifyBTCPaySignature(body, signature, webhookSecret)) {
      logger.error('Invalid BTCPay webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse event
    const event = JSON.parse(body);

    logger.info('BTCPay webhook received:', {
      type: event.type,
      invoiceId: event.invoiceId,
      status: event.status,
    });

    // Handle different event types
    switch (event.type) {
      case 'InvoiceSettled':
      case 'InvoiceProcessing':
        // Invoice paid successfully
        await donationService.updatePaymentStatus(event.invoiceId, 'completed', {
          btcpay_event: event.type,
          btcpay_invoice_id: event.invoiceId,
          amount_paid: event.amountPaid,
          currency: event.currency,
          timestamp: event.timestamp,
        });
        break;

      case 'InvoiceExpired':
      case 'InvoiceInvalid':
        // Invoice expired or invalid
        await donationService.updatePaymentStatus(event.invoiceId, 'failed', {
          btcpay_event: event.type,
          btcpay_invoice_id: event.invoiceId,
          timestamp: event.timestamp,
        });
        break;

      case 'InvoicePaymentSettled':
        // Payment fully settled (confirmed on blockchain)
        await donationService.updatePaymentStatus(event.invoiceId, 'completed', {
          btcpay_event: event.type,
          btcpay_invoice_id: event.invoiceId,
          btcpay_payment_method: event.paymentMethod,
          btcpay_tx_id: event.transactionId,
          timestamp: event.timestamp,
        });
        break;

      default:
        logger.info('Unhandled BTCPay event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    logger.error('BTCPay webhook error:', error);
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
