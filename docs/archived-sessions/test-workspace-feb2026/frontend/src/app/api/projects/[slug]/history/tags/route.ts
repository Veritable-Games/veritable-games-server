import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { projectGalleryService } from '@/lib/projects/gallery-service';
import { withSecurity } from '@/lib/security/middleware';
import type { ReferenceCategoryId } from '@/lib/database/schema-types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * Service error with optional details
 */
interface ServiceErrorWithDetails {
  message: string;
  details?: {
    message?: string;
  };
}

/**
 * GET /api/projects/[slug]/references/tags
 * Get all available reference tags for this project
 */
export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;

    // Get project ID from slug
    const { dbAdapter } = await import('@/lib/database/adapter');
    const projectResult = await dbAdapter.query('SELECT id FROM projects WHERE slug = $1', [slug], {
      schema: 'content',
    });
    const project = projectResult.rows[0] as { id: any } | undefined;

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const result = await projectGalleryService.getAllTags('history', project.id);

    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ tags: result.value });
  } catch (error) {
    logger.error('Error fetching tags:', error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[slug]/references/tags
 * Create a new reference tag (admin only)
 */
async function createTagHandler(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    // Check authentication and admin authorization
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
    }

    // Get project ID from slug
    const { dbAdapter } = await import('@/lib/database/adapter');
    const projectResult = await dbAdapter.query('SELECT id FROM projects WHERE slug = $1', [slug], {
      schema: 'content',
    });
    const project = projectResult.rows[0] as { id: any } | undefined;

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let categoryId: ReferenceCategoryId;

    // Check if default category exists
    const categoryResult = await dbAdapter.query(
      'SELECT id FROM reference_categories WHERE name = $1',
      ['General'],
      { schema: 'content' }
    );
    const defaultCategory = categoryResult.rows[0] as { id: ReferenceCategoryId } | undefined;

    if (defaultCategory) {
      categoryId = defaultCategory.id;
    } else {
      // Create default category
      const insertResult = await dbAdapter.query(
        `INSERT INTO reference_categories (id, name, description, visibility, display_order)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4) RETURNING id`,
        ['General', 'Default category for history tags', 'public', 0],
        { schema: 'content' }
      );
      categoryId = insertResult.rows[0].id as ReferenceCategoryId;
    }

    // Create tag with neutral color for this specific project
    const tagResult = await projectGalleryService.createTag({
      name: name.trim(),
      project_id: project.id,
      category_id: categoryId,
      color: '#9CA3AF', // Neutral gray color
    });

    if (!tagResult.ok) {
      // Check for UNIQUE constraint violation in error details
      const error = tagResult.error as ServiceErrorWithDetails;
      const errorMessage = error.message || '';
      const detailsMessage = error.details?.message || '';

      if (
        errorMessage.includes('UNIQUE constraint') ||
        errorMessage.includes('unique') ||
        detailsMessage.includes('UNIQUE constraint') ||
        detailsMessage.includes('unique')
      ) {
        return NextResponse.json(
          { error: 'A tag with this name already exists in this project' },
          { status: 400 }
        );
      }

      logger.error('Tag creation failed:', tagResult.error);
      return NextResponse.json(
        { error: tagResult.error.message || 'Failed to create tag' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tag_id: tagResult.value,
      message: 'Tag created successfully',
    });
  } catch (error) {
    logger.error('Create tag error:', error);
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
  }
}

export const POST = withSecurity(createTagHandler, {
  enableCSRF: true,
});
