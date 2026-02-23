/**
 * Admin Campaign API (Individual)
 *
 * GET /api/admin/campaigns/[id] - Get single funding goal
 * PUT /api/admin/campaigns/[id] - Update funding goal
 * DELETE /api/admin/campaigns/[id] - Delete funding goal (soft delete)
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
  NotFoundError,
} from '@/lib/utils/api-errors';

/**
 * GET /api/admin/campaigns/[id]
 * Get single funding goal (admin only)
 */
export const GET = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      const user = await getCurrentUser(request);

      if (!user) {
        throw new AuthenticationError();
      }

      if (user.role !== 'admin') {
        throw new PermissionError('Admin access required');
      }

      // Get ID from params (Next.js 15 async params pattern)
      const params = await context.params;
      const goalId = parseInt(params.id, 10);

      if (isNaN(goalId) || goalId <= 0) {
        throw new ValidationError('Invalid campaign ID');
      }

      const goal = await donationService.getFundingGoalById(goalId);

      if (!goal) {
        throw new NotFoundError('Funding goal', goalId);
      }

      return NextResponse.json({
        success: true,
        data: goal,
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
);

/**
 * PUT /api/admin/campaigns/[id]
 * Update funding goal (admin only)
 */
export const PUT = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      const user = await getCurrentUser(request);

      if (!user) {
        throw new AuthenticationError();
      }

      if (user.role !== 'admin') {
        throw new PermissionError('Admin access required');
      }

      // Get ID from params
      const params = await context.params;
      const goalId = parseInt(params.id, 10);

      if (isNaN(goalId) || goalId <= 0) {
        throw new ValidationError('Invalid campaign ID');
      }

      // Verify goal exists
      const existingGoal = await donationService.getFundingGoalById(goalId);
      if (!existingGoal) {
        throw new NotFoundError('Funding goal', goalId);
      }

      const body = await request.json();
      const { title, description, target_amount, start_date, end_date, is_active } = body;

      // Validate fields if provided
      if (title !== undefined) {
        if (typeof title !== 'string' || title.trim().length === 0) {
          throw new ValidationError('Title must be a non-empty string');
        }
      }

      if (description !== undefined) {
        if (typeof description !== 'string') {
          throw new ValidationError('Description must be a string');
        }
      }

      if (target_amount !== undefined) {
        if (typeof target_amount !== 'number' || target_amount <= 0) {
          throw new ValidationError('Target amount must be a positive number');
        }
      }

      if (start_date !== undefined) {
        if (typeof start_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
          throw new ValidationError('Start date must be in YYYY-MM-DD format');
        }
      }

      if (end_date !== undefined && end_date !== null) {
        if (typeof end_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
          throw new ValidationError('End date must be in YYYY-MM-DD format or null');
        }
      }

      if (is_active !== undefined) {
        if (typeof is_active !== 'boolean') {
          throw new ValidationError('is_active must be a boolean');
        }
      }

      // Update goal
      const updatedGoal = await donationService.updateFundingGoal(goalId, {
        title: title ? title.trim() : undefined,
        description: description ? description.trim() : undefined,
        target_amount,
        start_date,
        end_date,
        is_active,
      });

      return NextResponse.json({
        success: true,
        data: updatedGoal,
        message: 'Funding goal updated successfully',
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
);

/**
 * DELETE /api/admin/campaigns/[id]
 * Delete funding goal (soft delete - sets is_active = false)
 */
export const DELETE = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      const user = await getCurrentUser(request);

      if (!user) {
        throw new AuthenticationError();
      }

      if (user.role !== 'admin') {
        throw new PermissionError('Admin access required');
      }

      // Get ID from params
      const params = await context.params;
      const goalId = parseInt(params.id, 10);

      if (isNaN(goalId) || goalId <= 0) {
        throw new ValidationError('Invalid campaign ID');
      }

      // Verify goal exists
      const existingGoal = await donationService.getFundingGoalById(goalId);
      if (!existingGoal) {
        throw new NotFoundError('Funding goal', goalId);
      }

      // Soft delete
      await donationService.deleteFundingGoal(goalId);

      return NextResponse.json({
        success: true,
        message: 'Funding goal deleted successfully',
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
);
