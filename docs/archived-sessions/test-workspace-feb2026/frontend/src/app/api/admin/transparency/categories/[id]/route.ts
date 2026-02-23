/**
 * Expense Category Admin API - Individual Category Operations
 * GET: Get single category
 * PUT: Update category
 * DELETE: Delete category
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
  NotFoundError,
  PermissionError,
} from '@/lib/utils/api-errors';

type Context = { params: Promise<{ id: string }> };

// GET: Get single category
export const GET = withSecurity(async (request: NextRequest, context: Context) => {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      throw new AuthenticationError();
    }

    if (user.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    const { id } = await context.params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      throw new ValidationError('Invalid category ID');
    }

    const category = await transparencyService.getExpenseCategoryById(categoryId);

    if (!category) {
      throw new NotFoundError('Category', categoryId);
    }

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

// PUT: Update category
export const PUT = withSecurity(async (request: NextRequest, context: Context) => {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      throw new AuthenticationError();
    }

    if (user.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    const { id } = await context.params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      throw new ValidationError('Invalid category ID');
    }

    const body = await request.json();

    // Build update data
    const updateData: Parameters<typeof transparencyService.updateExpenseCategory>[1] = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const category = await transparencyService.updateExpenseCategory(categoryId, updateData);

    return NextResponse.json({
      success: true,
      data: category,
      message: 'Category updated successfully',
    });
  } catch (error) {
    return errorResponse(error);
  }
});

// DELETE: Delete category
export const DELETE = withSecurity(async (request: NextRequest, context: Context) => {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      throw new AuthenticationError();
    }

    if (user.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    const { id } = await context.params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      throw new ValidationError('Invalid category ID');
    }

    await transparencyService.deleteExpenseCategory(categoryId);

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    return errorResponse(error);
  }
});
