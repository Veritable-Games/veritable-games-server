/**
 * Admin Expenses API
 *
 * POST /api/admin/expenses - Create new expense
 * GET /api/admin/expenses - List all expenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { transparencyService } from '@/lib/donations/service';
import type { ExpenseCategoryId } from '@/lib/donations/types';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';
import {
  errorResponse,
  AuthenticationError,
  ValidationError,
  PermissionError,
} from '@/lib/utils/api-errors';

/**
 * GET /api/admin/expenses
 * List all expenses (admin only)
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

    // Parse query parameters for filtering
    const { searchParams } = request.nextUrl;
    const categoryId = searchParams.get('category_id');
    const projectId = searchParams.get('project_id');
    const year = searchParams.get('year');

    const filters: { category_id?: number; project_id?: number; year?: number } = {};

    if (categoryId) {
      const parsed = parseInt(categoryId, 10);
      if (!isNaN(parsed) && parsed > 0) {
        filters.category_id = parsed;
      }
    }

    if (projectId) {
      const parsed = parseInt(projectId, 10);
      if (!isNaN(parsed) && parsed > 0) {
        filters.project_id = parsed;
      }
    }

    if (year) {
      const parsed = parseInt(year, 10);
      if (!isNaN(parsed) && parsed > 1900 && parsed < 2100) {
        filters.year = parsed;
      }
    }

    const expenses = await transparencyService.getAllExpenses(filters);

    return NextResponse.json({
      success: true,
      data: expenses,
      count: expenses.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

/**
 * POST /api/admin/expenses
 * Create new expense (admin only)
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
      category_id,
      project_id,
      amount,
      currency,
      description,
      receipt_url,
      expense_date,
      is_recurring,
      recurrence_period,
    } = body;

    // Validate required fields
    if (typeof category_id !== 'number' || category_id <= 0) {
      throw new ValidationError('Category ID is required and must be a positive number');
    }

    if (typeof amount !== 'number' || amount <= 0) {
      throw new ValidationError('Amount must be a positive number');
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      throw new ValidationError('Description is required and must be a non-empty string');
    }

    if (!expense_date || typeof expense_date !== 'string') {
      throw new ValidationError('Expense date is required (ISO format)');
    }

    // Validate expense_date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expense_date)) {
      throw new ValidationError('Expense date must be in YYYY-MM-DD format');
    }

    // Validate project_id if provided
    if (project_id !== undefined && project_id !== null) {
      if (typeof project_id !== 'number' || project_id <= 0) {
        throw new ValidationError('Project ID must be a positive number');
      }
    }

    // Validate currency if provided
    if (currency !== undefined && typeof currency !== 'string') {
      throw new ValidationError('Currency must be a string');
    }

    // Validate recurrence_period if is_recurring is true
    if (is_recurring && recurrence_period) {
      const validPeriods = ['monthly', 'yearly'];
      if (!validPeriods.includes(recurrence_period)) {
        throw new ValidationError('Recurrence period must be either monthly or yearly');
      }
    }

    // Create expense
    const expense = await transparencyService.createExpense({
      category_id: category_id as ExpenseCategoryId,
      project_id: project_id || undefined,
      amount,
      currency: currency || 'USD',
      description: description.trim(),
      receipt_url: receipt_url || undefined,
      expense_date,
      is_recurring: is_recurring || false,
      recurrence_period: recurrence_period || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: expense,
        message: 'Expense created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
});
