/**
 * Expense Categories Admin API
 * GET: List all categories (including inactive)
 * POST: Create new category
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
} from '@/lib/utils/api-errors';

// GET: List all expense categories
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      throw new AuthenticationError();
    }

    if (user.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    const categories = await transparencyService.getAllExpenseCategories();

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

// POST: Create new expense category
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

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      throw new ValidationError('Name is required');
    }

    const category = await transparencyService.createExpenseCategory({
      name: body.name.trim(),
      slug: body.slug || body.name.toLowerCase().replace(/\s+/g, '-'),
      description: body.description,
      color: body.color,
      icon: body.icon,
      display_order: body.display_order,
    });

    return NextResponse.json(
      {
        success: true,
        data: category,
        message: 'Category created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
});
