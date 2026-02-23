/**
 * Forum Category by Slug API
 *
 * GET /api/forums/categories/[slug] - Get single category by slug
 * PATCH /api/forums/categories/[slug] - Update category (Admin/Moderator only)
 * DELETE /api/forums/categories/[slug] - Delete category (Admin only)
 *
 * Returns:
 * - success: boolean
 * - data: { category: ForumCategory } | { message: string }
 * - error?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { CategoryRepository } from '@/lib/forums/repositories/category-repository';
import { forumCategoryService } from '@/lib/forums/services';
import {
  errorResponse,
  NotFoundError,
  AuthenticationError,
  ValidationError,
} from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';
import type { UpdateCategoryData, CategoryId } from '@/lib/forums/types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/forums/categories/[slug]
 *
 * Fetches a single category by its slug
 */
export const GET = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    try {
      const params = await context.params;
      const categoryRepo = new CategoryRepository();

      // Fetch category by slug
      const result = await categoryRepo.findBySlug(params.slug);

      if (result.isErr()) {
        const err = result.error;
        throw new Error(err.type === 'database' ? err.message : `Repository error: ${err.type}`);
      }

      if (!result.value) {
        throw new NotFoundError('Category', params.slug);
      }

      const category = result.value;

      // Check visibility: return 404 if category is hidden and user is not admin
      const user = await getCurrentUser(request);
      const userRole = user?.role || 'anonymous';

      if (!category.is_public && userRole !== 'admin') {
        // Return 404 instead of 403 to hide existence of hidden categories
        throw new NotFoundError('Category', params.slug);
      }

      return NextResponse.json({
        success: true,
        data: {
          category,
        },
      });
    } catch (error) {
      logger.error('Error fetching category:', error);
      return errorResponse(error);
    }
  }
);

/**
 * PATCH /api/forums/categories/[slug]
 *
 * Updates a category
 * Requires: Admin or Moderator role
 */
export const PATCH = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    try {
      const params = await context.params;

      // Authenticate
      const user = await getCurrentUser(request);
      if (!user) {
        throw new AuthenticationError();
      }

      // Check permissions (Admin or Moderator only)
      if (user.role !== 'admin' && user.role !== 'moderator') {
        throw new ValidationError('Only administrators and moderators can update categories');
      }

      // Get category by slug to get the ID
      const existingCategory = await forumCategoryService.getCategoryBySlug(params.slug);

      // Parse request body
      const body = await request.json();
      const { name, description, icon, color, section, sort_order, is_public } = body;

      // Build update data (only include provided fields)
      const updateData: UpdateCategoryData = {};

      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          throw new ValidationError('Category name cannot be empty');
        }
        updateData.name = name.trim();
      }

      if (description !== undefined) {
        updateData.description = description?.trim() || undefined;
      }

      if (icon !== undefined) {
        updateData.icon = icon || undefined;
      }

      if (color !== undefined) {
        updateData.color = color || '#3B82F6';
      }

      if (section !== undefined) {
        updateData.section = section || 'general';
      }

      if (sort_order !== undefined) {
        updateData.sort_order = Number(sort_order);
      }

      if (is_public !== undefined) {
        updateData.is_public = Boolean(is_public);
      }

      // Update category
      const updatedCategory = await forumCategoryService.updateCategory(
        existingCategory.id,
        updateData
      );

      return NextResponse.json({
        success: true,
        data: { category: updatedCategory },
      });
    } catch (error) {
      logger.error('[API] Error updating category:', error);
      return errorResponse(error);
    }
  }
);

/**
 * DELETE /api/forums/categories/[slug]
 *
 * Deletes a category and moves its topics to a default category
 * Requires: Admin role
 */
export const DELETE = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    try {
      const params = await context.params;

      // Authenticate
      const user = await getCurrentUser(request);
      if (!user) {
        throw new AuthenticationError();
      }

      // Check permissions (Admin only for deletion)
      if (user.role !== 'admin') {
        throw new ValidationError('Only administrators can delete categories');
      }

      // Get category by slug to get the ID
      const category = await forumCategoryService.getCategoryBySlug(params.slug);

      // Get moveToSlug from query params (default: 'off-topic')
      const url = new URL(request.url);
      const moveToSlug = url.searchParams.get('moveToSlug') || 'off-topic';

      // Delete category (will move topics to specified category)
      await forumCategoryService.deleteCategory(category.id, moveToSlug);

      return NextResponse.json({
        success: true,
        data: {
          message: `Category '${category.name}' deleted successfully. Topics moved to '${moveToSlug}'.`,
        },
      });
    } catch (error) {
      logger.error('[API] Error deleting category:', error);
      return errorResponse(error);
    }
  }
);
