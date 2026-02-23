/**
 * BTCPay Donation Creation API
 * Creates donation record and BTCPay invoice
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { donationService } from '@/lib/donations/service';
import { errorResponse, NotFoundError } from '@/lib/utils/api-errors';
import { dbAdapter } from '@/lib/database/adapter';
import fs from 'fs';
import { logger } from '@/lib/utils/logger';
import type { ProjectId } from '@/lib/donations/types';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface BTCPayInvoiceRequest {
  amount: number;
  currency: string;
  projectId: number;
  donorName?: string;
  donorEmail?: string;
  message?: string;
  isRecurring?: boolean; // Not supported by BTCPay, but accepted for API consistency
}

// Debug logging to file (production console.log doesn't work)
function debugLog(message: string, data?: any) {
  const logEntry = `${new Date().toISOString()} - ${message}${data ? ': ' + JSON.stringify(data) : ''}\n`;
  try {
    fs.appendFileSync('/tmp/btcpay-debug.log', logEntry);
  } catch (e) {
    // Ignore file write errors
  }
  logger.info(message, data); // Still try console.log
}

/**
 * POST /api/donations/btcpay
 * Create donation and BTCPay invoice
 */
async function POSTHandler(request: NextRequest) {
  try {
    const body: BTCPayInvoiceRequest = await request.json();

    debugLog('[BTCPay API] Request received', {
      amount: body.amount,
      currency: body.currency,
      projectId: body.projectId,
      hasDonorName: !!body.donorName,
      hasDonorEmail: !!body.donorEmail,
      hasMessage: !!body.message,
    });

    // Validate input
    if (!body.amount || body.amount < 0.01) {
      debugLog('[BTCPay API] Invalid amount', body.amount);
      return NextResponse.json({ error: 'Amount must be at least $0.01' }, { status: 400 });
    }

    if (!body.projectId) {
      debugLog('[BTCPay API] Missing project ID');
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Get project details for invoice description
    const project = await donationService.getFundingProjectById(body.projectId);
    if (!project) {
      debugLog('[BTCPay API] Project not found', body.projectId);
      return errorResponse(new NotFoundError('Project', body.projectId));
    }

    debugLog('[BTCPay API] Creating donation record...');

    // Create donation record (pending status)
    const donation = await donationService.createDonation({
      amount: body.amount,
      currency: (body.currency as 'USD' | 'BTC' | 'EUR' | 'GBP') || 'USD',
      payment_processor: 'btcpay',
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

    debugLog('[BTCPay API] Donation created', {
      donationId: donation.id,
      amount: donation.amount,
    });

    // Create BTCPay invoice
    debugLog('[BTCPay API] Creating BTCPay invoice...');
    const btcpayUrl = process.env.BTCPAY_SERVER_URL;
    const btcpayStoreId = process.env.BTCPAY_STORE_ID;
    const btcpayApiKey = process.env.BTCPAY_API_KEY;

    if (!btcpayUrl || !btcpayStoreId || !btcpayApiKey) {
      logger.error('BTCPay configuration missing:', {
        hasUrl: !!btcpayUrl,
        hasStoreId: !!btcpayStoreId,
        hasApiKey: !!btcpayApiKey,
      });
      return NextResponse.json({ error: 'BTCPay Server not configured' }, { status: 500 });
    }

    // Create invoice via BTCPay API
    const invoiceResponse = await fetch(`${btcpayUrl}/api/v1/stores/${btcpayStoreId}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `token ${btcpayApiKey}`,
      },
      body: JSON.stringify({
        amount: body.amount.toString(),
        currency: body.currency || 'USD',
        metadata: {
          orderId: `donation-${donation.id}`,
          donationId: donation.id.toString(),
          itemDesc: `Support ${project.name}`,
          projectName: project.name,
        },
        checkout: {
          redirectURL: `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.veritablegames.com'}/donate/success`,
          defaultLanguage: 'en-US',
        },
      }),
    });

    if (!invoiceResponse.ok) {
      const errorText = await invoiceResponse.text();
      logger.error('BTCPay invoice creation failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to create BTCPay invoice', details: errorText },
        { status: 500 }
      );
    }

    const invoice = await invoiceResponse.json();

    debugLog('[BTCPay API] BTCPay invoice created', {
      invoiceId: invoice.id,
      checkoutLink: invoice.checkoutLink,
    });

    // Update donation with BTCPay invoice ID (using donation ID, not payment_id)
    debugLog('[BTCPay API] Updating donation with invoice details...');
    await dbAdapter.query(
      `
      UPDATE donations
      SET payment_id = $1::text,
          metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
          updated_at = NOW()
      WHERE id = $3::bigint
      `,
      [
        invoice.id,
        JSON.stringify({
          btcpay_invoice_id: invoice.id,
          btcpay_checkout_url: invoice.checkoutLink,
        }),
        donation.id,
      ],
      { schema: 'donations' }
    );

    debugLog('[BTCPay API] Donation updated successfully');

    return NextResponse.json({
      success: true,
      donationId: donation.id,
      invoiceId: invoice.id,
      checkoutUrl: invoice.checkoutLink,
    });
  } catch (error: any) {
    debugLog('[BTCPay API] ERROR', {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });
    return errorResponse(error);
  }
}

// Apply security middleware (CSRF protection)
export const POST = withSecurity(POSTHandler, { enableCSRF: true });
