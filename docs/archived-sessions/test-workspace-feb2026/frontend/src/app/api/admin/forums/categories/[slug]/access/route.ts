/**
 * Admin Category Access Management API
 *
 * GET    /api/admin/forums/categories/[slug]/access - Get access rules for a category
 * POST   /api/admin/forums/categories/[slug]/access - Add an access rule
 * DELETE /api/admin/forums/categories/[slug]/access - Remove all access rules (make public)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { requireAdmin } from '@/lib/auth/server';
import {
  categoryAccessService,
  type AccessType,
  type PermissionLevel,
} from '@/lib/forums/services/CategoryAccessService';
import { forumCategoryService } from '@/lib/forums/services/ForumCategoryService';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export const GET = withSecurity(async (request: NextRequest, context: RouteContext) => {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    const params = await context.params;
    const categorySlug = params.slug;

    // Verify category exists
    try {
      await forumCategoryService.getCategoryBySlug(categorySlug);
    } catch {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    }

    const rules = await categoryAccessService.getCategoryAccessRules(categorySlug);

    return NextResponse.json({
      success: true,
      data: {
        category_slug: categorySlug,
        rules,
        is_restricted: rules.length > 0,
      },
    });
  } catch (error) {
    logger.error('Error fetching category access rules:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch access rules' },
      { status: 500 }
    );
  }
});

export const POST = withSecurity(async (request: NextRequest, context: RouteContext) => {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    const params = await context.params;
    const categorySlug = params.slug;

    // Verify category exists
    try {
      await forumCategoryService.getCategoryBySlug(categorySlug);
    } catch {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.access_type || !body.access_value) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: access_type, access_value' },
        { status: 400 }
      );
    }

    // Validate access_type
    const validAccessTypes: AccessType[] = ['role', 'badge', 'badge_type'];
    if (!validAccessTypes.includes(body.access_type)) {
      return NextResponse.json(
        { success: false, error: `Invalid access_type. Must be: ${validAccessTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate permission_level
    const validPermissionLevels: PermissionLevel[] = ['view', 'post', 'moderate'];
    const permissionLevel: PermissionLevel = body.permission_level || 'view';
    if (!validPermissionLevels.includes(permissionLevel)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid permission_level. Must be: ${validPermissionLevels.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate access_value based on type
    if (body.access_type === 'role') {
      const validRoles = ['user', 'moderator', 'developer', 'admin'];
      if (!validRoles.includes(body.access_value)) {
        return NextResponse.json(
          { success: false, error: `Invalid role. Must be: ${validRoles.join(', ')}` },
          { status: 400 }
        );
      }
    } else if (body.access_type === 'badge_type') {
      const validBadgeTypes = ['supporter', 'achievement', 'special'];
      if (!validBadgeTypes.includes(body.access_value)) {
        return NextResponse.json(
          { success: false, error: `Invalid badge_type. Must be: ${validBadgeTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const rule = await categoryAccessService.addAccessRule({
      category_slug: categorySlug,
      access_type: body.access_type,
      access_value: body.access_value,
      permission_level: permissionLevel,
    });

    return NextResponse.json(
      {
        success: true,
        data: rule,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error adding access rule:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add access rule' },
      { status: 500 }
    );
  }
});

export const DELETE = withSecurity(async (request: NextRequest, context: RouteContext) => {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    const params = await context.params;
    const categorySlug = params.slug;

    // Verify category exists
    try {
      await forumCategoryService.getCategoryBySlug(categorySlug);
    } catch {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const ruleId = searchParams.get('ruleId');

    if (ruleId) {
      // Delete specific rule
      const success = await categoryAccessService.removeAccessRule(parseInt(ruleId, 10));
      if (!success) {
        return NextResponse.json(
          { success: false, error: 'Access rule not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: 'Access rule removed',
      });
    } else {
      // Delete all rules (make category public)
      const count = await categoryAccessService.removeAllAccessRules(categorySlug);
      return NextResponse.json({
        success: true,
        message: `Removed ${count} access rules. Category is now public.`,
      });
    }
  } catch (error) {
    logger.error('Error removing access rules:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove access rules' },
      { status: 500 }
    );
  }
});
