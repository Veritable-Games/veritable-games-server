/**
 * x402 Bot Client Management API
 *
 * GET  /api/admin/x402/clients - List all registered bot clients
 * POST /api/admin/x402/clients - Register a new bot client
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { requireAdmin } from '@/lib/auth/server';
import { dbAdapter } from '@/lib/database/adapter';
import crypto from 'crypto';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface BotClient {
  id: number;
  clientId: string;
  clientName: string;
  contactEmail: string | null;
  billingType: 'instant' | 'aggregated';
  walletAddress: string | null;
  monthlyLimitUSD: number;
  currentMonthUsageUSD: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateBotClientRequest {
  clientName: string;
  contactEmail?: string;
  billingType?: 'instant' | 'aggregated';
  walletAddress?: string;
  monthlyLimitUSD?: number;
  notes?: string;
}

interface ClientRow {
  id: number;
  client_id: string;
  client_name: string;
  contact_email: string | null;
  billing_type: string;
  wallet_address: string | null;
  monthly_limit_usd: string;
  current_month_usage_usd: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Generate a secure API key
 */
function generateApiKey(): string {
  return `vg_x402_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Hash an API key for storage
 */
function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    const result = await dbAdapter.query<ClientRow>(
      `
      SELECT
        id,
        client_id,
        client_name,
        contact_email,
        billing_type,
        wallet_address,
        monthly_limit_usd,
        current_month_usage_usd,
        is_active,
        notes,
        created_at,
        updated_at
      FROM bot_clients
      ORDER BY created_at DESC
    `,
      [],
      { schema: 'x402_payments' }
    );

    const clients: BotClient[] = result.rows.map(row => ({
      id: row.id,
      clientId: row.client_id,
      clientName: row.client_name,
      contactEmail: row.contact_email,
      billingType: row.billing_type as 'instant' | 'aggregated',
      walletAddress: row.wallet_address,
      monthlyLimitUSD: parseFloat(row.monthly_limit_usd),
      currentMonthUsageUSD: parseFloat(row.current_month_usage_usd),
      isActive: row.is_active,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: clients,
    });
  } catch (error) {
    logger.error('Error fetching x402 clients:', error);

    // If schema doesn't exist yet, return empty data
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('x402_payments') || errorMessage.includes('does not exist')) {
      return NextResponse.json({
        success: true,
        data: [],
        notice: 'x402 schema not yet initialized. Run the migration to enable.',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch x402 clients' },
      { status: 500 }
    );
  }
});

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    const body: CreateBotClientRequest = await request.json();

    // Validate required fields
    if (!body.clientName) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: clientName' },
        { status: 400 }
      );
    }

    // Validate billing type
    if (body.billingType && !['instant', 'aggregated'].includes(body.billingType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid billingType. Must be: instant or aggregated' },
        { status: 400 }
      );
    }

    // Generate API key for the client
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    const result = await dbAdapter.query<ClientRow>(
      `
      INSERT INTO bot_clients (
        client_name,
        contact_email,
        billing_type,
        wallet_address,
        monthly_limit_usd,
        api_key_hash,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        client_id,
        client_name,
        contact_email,
        billing_type,
        wallet_address,
        monthly_limit_usd,
        current_month_usage_usd,
        is_active,
        notes,
        created_at,
        updated_at
    `,
      [
        body.clientName,
        body.contactEmail || null,
        body.billingType || 'instant',
        body.walletAddress || null,
        body.monthlyLimitUSD || 100.0,
        apiKeyHash,
        body.notes || null,
      ],
      { schema: 'x402_payments' }
    );

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json(
        { success: false, error: 'Failed to create client - no result returned' },
        { status: 500 }
      );
    }

    const client: BotClient = {
      id: row.id,
      clientId: row.client_id,
      clientName: row.client_name,
      contactEmail: row.contact_email,
      billingType: row.billing_type as 'instant' | 'aggregated',
      walletAddress: row.wallet_address,
      monthlyLimitUSD: parseFloat(row.monthly_limit_usd),
      currentMonthUsageUSD: parseFloat(row.current_month_usage_usd),
      isActive: row.is_active,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return NextResponse.json(
      {
        success: true,
        data: {
          client,
          // Only return the API key once at creation time
          apiKey,
          warning: 'Save this API key now. It cannot be retrieved later.',
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating x402 client:', error);

    // Check for unique constraint violation
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('unique') || errorMessage.includes('duplicate')) {
      return NextResponse.json(
        { success: false, error: 'A client with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create x402 client' },
      { status: 500 }
    );
  }
});
