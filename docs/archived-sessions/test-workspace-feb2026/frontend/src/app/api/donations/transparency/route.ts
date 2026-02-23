/**
 * Transparency Metrics API
 * Public endpoint for donation transparency dashboard data
 */

import { NextRequest, NextResponse } from 'next/server';
import { transparencyService, donationService } from '@/lib/donations/service';
import { errorResponse } from '@/lib/utils/api-errors';
import { logger } from '@/lib/utils/logger';
import type { Expense } from '@/lib/donations/types';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * Expense with flattened category name from SQL JOIN
 * SQL: SELECT e.*, ec.name as category_name FROM expenses e JOIN expense_categories ec...
 */
interface ExpenseWithCategoryName extends Expense {
  category_name?: string;
}

/**
 * GET /api/donations/transparency
 * Get comprehensive transparency metrics for public dashboard
 *
 * No authentication required - public data
 */
export async function GET(request: NextRequest) {
  try {
    const metrics = await transparencyService.getTransparencyMetrics();
    const campaigns = await donationService.getAllFundingGoals(true);
    const expensesRaw = await transparencyService.getAllExpenses({});

    // Transform expenses to flatten category object to string
    const expenses = (expensesRaw || []).map(expense => {
      const expenseWithCategory = expense as unknown as ExpenseWithCategoryName;
      return {
        id: expense.id,
        category: expenseWithCategory.category_name || 'Uncategorized',
        amount: expense.amount,
        description: expense.description,
        date: expense.expense_date,
      };
    });

    // Format response for DonationsTransparencyWidget
    const responseData = {
      success: true,
      data: {
        campaigns: campaigns || [],
        expenses: expenses,
        totalRaised: metrics.total_all_time || 0,
        totalAllocated: metrics.total_all_time || 0,
        totalExpenses: metrics.total_expenses_this_year || 0,
      },
    };

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error: any) {
    logger.error('[Transparency API] Error:', error);
    return errorResponse(error);
  }
}
