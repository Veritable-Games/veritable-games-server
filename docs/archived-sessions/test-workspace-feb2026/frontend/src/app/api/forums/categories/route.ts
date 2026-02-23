/**
 * Forum Categories API
 *
 * GET /api/forums/categories - List all categories with statistics
 * POST /api/forums/categories - Create a new category (Admin/Moderator only)
 *
 * Returns:
 * - success: boolean
 * - data: { categories: ForumCategory[] } | { category: ForumCategory }
 * - error?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { CategoryRepository } from '@/lib/forums/repositories/category-repository';
import {
  forumCategoryService,
  forumSectionService,
  ForumServiceUtils,
} from '@/lib/forums/services';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';
import type { CreateCategoryData } from '@/lib/forums/types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/forums/categories
 *
 * Lists all forum categories with topic/post counts
 * Filtered based on user role (admins see admin-only categories)
 */
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    // Get user for role-based filtering
    const user = await getCurrentUser(request);
    const userRole = user?.role || 'anonymous';

    // Fetch categories and sections in parallel
    const [categories, sections] = await Promise.all([
      forumCategoryService.getAllCategories(userRole),
      forumSectionService.getAllSections(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        categories,
        sections,
      },
    });
  } catch (error) {
    logger.error('Error fetching categories:', error);
    return errorResponse(error);
  }
});

/**
 * POST /api/forums/categories
 *
 * Creates a new forum category
 * Requires: Admin or Moderator role
 */
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    // Authenticate
    const user = await getCurrentUser(request);
    if (!user) {
      throw new AuthenticationError();
    }

    // Check permissions (Admin or Moderator only)
    if (user.role !== 'admin' && user.role !== 'moderator') {
      throw new ValidationError('Only administrators and moderators can create categories');
    }

    // Parse request body
    const body = await request.json();
    const { name, slug, description, icon, color, section, sort_order, is_public } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new ValidationError('Category name is required');
    }

    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      throw new ValidationError('Category slug is required');
    }

    // Validate slug format (alphanumeric, hyphens, underscores only)
    const slugRegex = /^[a-z0-9-_]+$/;
    if (!slugRegex.test(slug)) {
      throw new ValidationError(
        'Slug must contain only lowercase letters, numbers, hyphens, and underscores'
      );
    }

    // Build category data
    const categoryData: CreateCategoryData = {
      name: name.trim(),
      slug: slug.trim(),
      description: description?.trim() || undefined,
      icon: icon || undefined,
      color: color || '#3B82F6',
      section: section || 'general',
      sort_order: sort_order !== undefined ? Number(sort_order) : undefined,
      is_public: is_public !== false, // Default to true (public)
    };

    // Create category
    const category = await forumCategoryService.createCategory(categoryData);

    // Invalidate caches so new category appears immediately
    ForumServiceUtils.invalidateCaches();

    return NextResponse.json({
      success: true,
      data: { category },
    });
  } catch (error) {
    logger.error('[API] Error creating category:', error);
    return errorResponse(error);
  }
});
