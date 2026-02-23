/**
 * Donations API Route
 * POST: Create new donation
 * GET: List donations (with filters)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, rateLimiters } from '@/lib/security/middleware';
import { donationService } from '@/lib/donations/service';
import { errorResponse, ValidationError } from '@/lib/utils/api-errors';
import type { CreateDonationDTO } from '@/lib/donations/types';
import { validateAllocations, validateDonationAmount } from '@/lib/donations/types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * POST /api/donations
 * Create a new donation
 */
async function POSTHandler(request: NextRequest) {
  try {
    const body: CreateDonationDTO = await request.json();

    // Validate amount
    const amountValidation = validateDonationAmount(body.amount);
    if (!amountValidation.valid) {
      return errorResponse(new ValidationError(amountValidation.errors.join(', ')));
    }

    // Validate allocations
    if (!body.allocations || body.allocations.length === 0) {
      return errorResponse(new ValidationError('At least one project allocation is required'));
    }

    const allocationValidation = validateAllocations(body.allocations);
    if (!allocationValidation.valid) {
      return errorResponse(new ValidationError(allocationValidation.errors.join(', ')));
    }

    // Validate payment processor
    if (!['stripe', 'btcpay'].includes(body.payment_processor)) {
      return errorResponse(new ValidationError('Invalid payment processor'));
    }

    // TODO: Get user ID from session (if authenticated)
    const userId = undefined; // Replace with actual session user ID when auth is implemented

    // Create donation
    const donation = await donationService.createDonation(body, userId);

    // TODO: Initiate payment with processor (Stripe/BTCPay)
    // For now, return the donation with pending status
    // In production, this would:
    // 1. Create payment intent with Stripe/BTCPay
    // 2. Return client_secret or checkout URL
    // 3. Frontend redirects to payment page
    // 4. Webhook confirms payment and updates status

    return NextResponse.json(
      {
        success: true,
        donation,
        message: 'Donation created successfully. Please complete payment.',
        // payment_intent: {}, // Would be populated by Stripe/BTCPay
      },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error('Error creating donation:', error);
    return errorResponse(error);
  }
}

/**
 * GET /api/donations
 * List donations (with optional filters)
 * Query params:
 * - user_id: Filter by user
 * - project_id: Filter by project
 * - status: Filter by payment status
 * - limit: Results per page (default 20, max 100)
 * - offset: Pagination offset
 */
async function GETHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const userId = searchParams.get('user_id');
    const projectId = searchParams.get('project_id');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // TODO: Implement filtered query
    // For now, return recent donations
    const recentDonations = await donationService.getRecentDonations(limit);

    return NextResponse.json({
      success: true,
      donations: recentDonations,
      pagination: {
        limit,
        offset,
        total: recentDonations.length, // TODO: Get actual count
      },
    });
  } catch (error: any) {
    logger.error('Error fetching donations:', error);
    return errorResponse(error);
  }
}

// Apply security middleware
export const POST = withSecurity(POSTHandler, {
  enableCSRF: true,
  rateLimiter: rateLimiters.messageSend, // 20 per hour to prevent abuse
  rateLimiterType: 'messageSend',
});

export const GET = withSecurity(GETHandler, {
  // No CSRF needed for GET
  // No rate limit for public data
});
