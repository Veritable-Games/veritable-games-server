/**
 * Admin Campaigns API
 *
 * POST /api/admin/campaigns - Create new funding goal
 * GET /api/admin/campaigns - List all funding goals
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { donationService } from '@/lib/donations/service';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';
import {
  errorResponse,
  AuthenticationError,
  ValidationError,
  PermissionError,
} from '@/lib/utils/api-errors';

/**
 * GET /api/admin/campaigns
 * List all funding goals (admin only)
 */
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      throw new AuthenticationError();
    }

    if (user.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    // Parse query parameters
    const { searchParams } = request.nextUrl;
    const includeInactive = searchParams.get('include_inactive') !== 'false';

    const goals = await donationService.getAllFundingGoals(includeInactive);

    return NextResponse.json({
      success: true,
      data: goals,
      count: goals.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

/**
 * POST /api/admin/campaigns
 * Create new funding goal (admin only)
 */
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      throw new AuthenticationError();
    }

    if (user.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    const body = await request.json();
    const {
      project_id,
      title,
      description,
      target_amount,
      start_date,
      end_date,
      is_recurring,
      recurrence_period,
    } = body;

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new ValidationError('Title is required and must be a non-empty string');
    }

    if (!description || typeof description !== 'string') {
      throw new ValidationError('Description is required and must be a string');
    }

    if (typeof target_amount !== 'number' || target_amount <= 0) {
      throw new ValidationError('Target amount must be a positive number');
    }

    if (!start_date || typeof start_date !== 'string') {
      throw new ValidationError('Start date is required (ISO format)');
    }

    // Validate start_date format (basic check)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
      throw new ValidationError('Start date must be in YYYY-MM-DD format');
    }

    // Validate end_date if provided
    if (end_date !== undefined && end_date !== null) {
      if (typeof end_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
        throw new ValidationError('End date must be in YYYY-MM-DD format');
      }
    }

    // Validate project_id if provided
    if (project_id !== undefined && project_id !== null) {
      if (typeof project_id !== 'number' || project_id <= 0) {
        throw new ValidationError('Project ID must be a positive number');
      }
    }

    // Validate recurrence_period if is_recurring is true
    if (is_recurring && recurrence_period) {
      const validPeriods = ['monthly', 'quarterly', 'yearly'];
      if (!validPeriods.includes(recurrence_period)) {
        throw new ValidationError('Recurrence period must be one of: monthly, quarterly, yearly');
      }
    }

    // Create funding goal
    const goal = await donationService.createFundingGoal({
      project_id: project_id || undefined,
      title: title.trim(),
      description: description.trim(),
      target_amount,
      start_date,
      end_date: end_date || null,
      is_recurring: is_recurring || false,
      recurrence_period: recurrence_period || null,
    });

    return NextResponse.json(
      {
        success: true,
        data: goal,
        message: 'Funding goal created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
});
