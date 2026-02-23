/**
 * Admin Donations API
 * View all donations with filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import { errorResponse, PermissionError } from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/donations
 * List all donations with optional filtering
 */
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    const { searchParams } = request.nextUrl;
    const paymentStatus = searchParams.get('payment_status');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build WHERE conditions
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (paymentStatus && paymentStatus !== 'all') {
      conditions.push(`d.payment_status = $${paramIndex++}`);
      values.push(paymentStatus);
    }

    if (startDate) {
      conditions.push(`d.created_at >= $${paramIndex++}`);
      values.push(startDate);
    }

    if (endDate) {
      conditions.push(`d.created_at <= $${paramIndex++}`);
      values.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Fetch donations with project allocations
    const query = `
      SELECT
        d.id,
        d.donor_name,
        d.amount,
        d.currency,
        d.payment_processor,
        d.payment_status,
        d.message,
        d.is_anonymous,
        d.created_at,
        d.completed_at,
        COALESCE(
          json_agg(
            json_build_object('project_name', fp.name)
          ) FILTER (WHERE fp.id IS NOT NULL),
          '[]'
        ) as projects
      FROM donations d
      LEFT JOIN donation_allocations da ON d.id = da.donation_id
      LEFT JOIN funding_projects fp ON da.project_id = fp.id
      ${whereClause}
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    values.push(limit, offset);

    const result = await dbAdapter.query<any>(query, values, { schema: 'donations' });

    // Format project names into array
    const donations = result.rows.map(row => ({
      ...row,
      project_names: row.projects.map((p: any) => p.project_name).filter(Boolean),
      projects: undefined, // Remove raw projects field
    }));

    return NextResponse.json({
      success: true,
      data: donations,
      count: donations.length,
      pagination: {
        limit,
        offset,
      },
    });
  } catch (error: any) {
    logger.error('[Admin Donations API] Error:', error);
    return errorResponse(error);
  }
});
