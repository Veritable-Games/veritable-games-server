/**
 * Admin Test Donations API
 * Endpoints to create and delete test donations
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { errorResponse, PermissionError } from '@/lib/utils/api-errors';
import { dbAdapter } from '@/lib/database/adapter';
import { getServerSession } from '@/lib/auth/session';

// POST - Create test donation
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    const body = await request.json();
    const amount = parseFloat(body.amount) || 25.0;

    // Get admin user
    const userResult = await dbAdapter.query(
      'SELECT id, username, email FROM users WHERE id = ?',
      [session.id],
      { schema: 'users' }
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const user = userResult.rows[0];

    // Get a funding project
    const projectResult = await dbAdapter.query(
      'SELECT id, name, slug FROM funding_projects WHERE is_active = ? LIMIT 1',
      [true],
      { schema: 'donations' }
    );

    if (!projectResult.rows || projectResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No active funding projects found' },
        { status: 404 }
      );
    }

    const project = projectResult.rows[0];

    // Insert test donation
    const donationResult = await dbAdapter.query(
      `INSERT INTO donations (
        user_id,
        amount,
        currency,
        payment_processor,
        payment_id,
        payment_status,
        donor_name,
        donor_email,
        is_anonymous,
        message,
        completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id`,
      [
        user.id,
        amount,
        'USD',
        'other', // Marks this as test donation
        `test-${Date.now()}`,
        'completed',
        user.username,
        user.email,
        false,
        `Test donation ($${amount})`,
        new Date().toISOString(),
      ],
      { schema: 'donations' }
    );

    const donationId = donationResult.rows[0].id;

    // Create allocation (100% to the project)
    await dbAdapter.query(
      `INSERT INTO donation_allocations (
        donation_id,
        project_id,
        amount,
        percentage
      ) VALUES (?, ?, ?, ?)`,
      [donationId, project.id, amount, 100.0],
      { schema: 'donations' }
    );

    return NextResponse.json({
      success: true,
      message: `Created $${amount} test donation!`,
      donation: {
        id: donationId,
        amount,
        currency: 'USD',
        projectName: project.name,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
});

// DELETE - Clear all test donations
export const DELETE = withSecurity(async (request: NextRequest) => {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    // Delete all donations with payment_processor = 'other' (test donations)
    await dbAdapter.query(
      "DELETE FROM donations WHERE payment_processor = 'other' AND user_id = ?",
      [session.id],
      { schema: 'donations' }
    );

    return NextResponse.json({
      success: true,
      message: 'Test donations cleared successfully',
    });
  } catch (error) {
    return errorResponse(error);
  }
});
