/**
 * Admin Expense API (Individual)
 *
 * GET /api/admin/expenses/[id] - Get single expense
 * PUT /api/admin/expenses/[id] - Update expense
 * DELETE /api/admin/expenses/[id] - Delete expense
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { transparencyService } from '@/lib/donations/service';

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
 * GET /api/admin/expenses/[id]
 * Get single expense (admin only)
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
      const expenseId = parseInt(params.id, 10);

      if (isNaN(expenseId) || expenseId <= 0) {
        throw new ValidationError('Invalid expense ID');
      }

      const expense = await transparencyService.getExpenseById(expenseId);

      if (!expense) {
        throw new NotFoundError('Expense', expenseId);
      }

      return NextResponse.json({
        success: true,
        data: expense,
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
);

/**
 * PUT /api/admin/expenses/[id]
 * Update expense (admin only)
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
      const expenseId = parseInt(params.id, 10);

      if (isNaN(expenseId) || expenseId <= 0) {
        throw new ValidationError('Invalid expense ID');
      }

      // Verify expense exists
      const existingExpense = await transparencyService.getExpenseById(expenseId);
      if (!existingExpense) {
        throw new NotFoundError('Expense', expenseId);
      }

      const body = await request.json();
      const {
        category_id,
        project_id,
        amount,
        description,
        receipt_url,
        expense_date,
        is_recurring,
        recurrence_period,
      } = body;

      // Validate fields if provided
      if (category_id !== undefined) {
        if (typeof category_id !== 'number' || category_id <= 0) {
          throw new ValidationError('Category ID must be a positive number');
        }
      }

      if (project_id !== undefined && project_id !== null) {
        if (typeof project_id !== 'number' || project_id <= 0) {
          throw new ValidationError('Project ID must be a positive number');
        }
      }

      if (amount !== undefined) {
        if (typeof amount !== 'number' || amount <= 0) {
          throw new ValidationError('Amount must be a positive number');
        }
      }

      if (description !== undefined) {
        if (typeof description !== 'string' || description.trim().length === 0) {
          throw new ValidationError('Description must be a non-empty string');
        }
      }

      if (expense_date !== undefined) {
        if (typeof expense_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expense_date)) {
          throw new ValidationError('Expense date must be in YYYY-MM-DD format');
        }
      }

      if (is_recurring !== undefined) {
        if (typeof is_recurring !== 'boolean') {
          throw new ValidationError('is_recurring must be a boolean');
        }
      }

      if (recurrence_period !== undefined && recurrence_period !== null) {
        const validPeriods = ['monthly', 'yearly'];
        if (!validPeriods.includes(recurrence_period)) {
          throw new ValidationError('Recurrence period must be either monthly or yearly');
        }
      }

      // Update expense
      const updatedExpense = await transparencyService.updateExpense(expenseId, {
        category_id,
        project_id,
        amount,
        description: description ? description.trim() : undefined,
        receipt_url,
        expense_date,
        is_recurring,
        recurrence_period,
      });

      return NextResponse.json({
        success: true,
        data: updatedExpense,
        message: 'Expense updated successfully',
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
);

/**
 * DELETE /api/admin/expenses/[id]
 * Delete expense (hard delete)
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
      const expenseId = parseInt(params.id, 10);

      if (isNaN(expenseId) || expenseId <= 0) {
        throw new ValidationError('Invalid expense ID');
      }

      // Verify expense exists
      const existingExpense = await transparencyService.getExpenseById(expenseId);
      if (!existingExpense) {
        throw new NotFoundError('Expense', expenseId);
      }

      // Hard delete
      await transparencyService.deleteExpense(expenseId);

      return NextResponse.json({
        success: true,
        message: 'Expense deleted successfully',
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
);
