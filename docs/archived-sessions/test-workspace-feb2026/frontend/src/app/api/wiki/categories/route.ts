import { NextRequest, NextResponse } from 'next/server';
import { getWikiService } from '@/lib/services/registry';
import { requireAuth, requireModerator } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

const wikiService = getWikiService();

async function getCategoriesHandler(request: NextRequest) {
  try {
    // Require authentication - all wiki content requires login
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const user = authResult.user;
    const userRole = user.role;

    const categories = await wikiService.getCategories(userRole);
    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error: any) {
    logger.error('Error fetching wiki categories:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch wiki categories',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

export const GET = withSecurity(getCategoriesHandler, {
  enableCSRF: false, // GET requests don't need CSRF
});

// POST handler for creating wiki categories
async function createCategoryHandler(request: NextRequest) {
  try {
    // Require moderator or admin authentication
    const authResult = await requireModerator(request);
    if (authResult.response) {
      return authResult.response;
    }

    const user = authResult.user;

    const data = await request.json();
    const { id, name, description, parent_id, color, icon, sort_order } = data;

    // Validate required fields
    if (!id || !name) {
      return NextResponse.json(
        { success: false, error: 'Category ID and name are required' },
        { status: 400 }
      );
    }

    // Validate ID format (alphanumeric, hyphens, underscores)
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Category ID must contain only letters, numbers, hyphens, and underscores',
        },
        { status: 400 }
      );
    }

    // Create category data object
    const categoryData = {
      id: id.trim().toLowerCase(),
      name: name.trim(),
      description: description?.trim() || null,
      parent_id: parent_id?.trim() || null,
      color: color || '#6B7280',
      icon: icon?.trim() || null,
      sort_order: sort_order || 0,
    };

    // Create the category
    const category = await wikiService.createCategory(categoryData);

    return NextResponse.json({
      success: true,
      data: { category },
    });
  } catch (error: any) {
    logger.error('Create wiki category error:', error);

    let errorMessage = error.message || 'Failed to create wiki category';
    let statusCode = 500;

    // Handle specific database constraint errors
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      statusCode = 409; // Conflict
      errorMessage = 'A category with this ID already exists';
    } else if (error.message && error.message.includes('FOREIGN KEY constraint failed')) {
      statusCode = 400; // Bad Request
      errorMessage = 'Invalid parent category specified';
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        ...(process.env.NODE_ENV === 'development' && {
          debug: {
            error_type: error.name || 'Unknown',
          },
        }),
      },
      { status: statusCode }
    );
  }
}

// Apply security middleware with CSRF protection and authentication
export const POST = withSecurity(createCategoryHandler, {
  enableCSRF: true,
});
