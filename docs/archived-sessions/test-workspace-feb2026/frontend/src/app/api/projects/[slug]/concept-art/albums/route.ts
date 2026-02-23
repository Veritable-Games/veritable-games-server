import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';
import { projectGalleryService } from '@/lib/projects/gallery-service';
import type { ProjectId, ReferenceImageId, UserId } from '@/lib/database/schema-types';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[slug]/concept-art/albums
 * Create a new album from multiple concept art images
 */
export const POST = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    try {
      const user = await getCurrentUser(request);
      if (!user) throw new AuthenticationError();

      const params = await context.params;
      const projectSlug = params.slug;
      const body = await request.json();

      // Validate input
      const { imageIds } = body;

      if (!Array.isArray(imageIds) || imageIds.length < 2) {
        throw new ValidationError('At least 2 images are required to create an album');
      }

      // Get project ID from slug
      const { dbAdapter } = await import('@/lib/database/adapter');
      const projectResult = await dbAdapter.query(
        'SELECT id FROM projects WHERE slug = $1',
        [projectSlug],
        { schema: 'content' }
      );
      const project = projectResult.rows[0] as { id: number } | undefined;

      if (!project) {
        return NextResponse.json(
          {
            success: false,
            error: 'Project not found',
          },
          { status: 404 }
        );
      }

      const projectId = project.id as ProjectId;

      // Create album via service
      const result = await projectGalleryService.createAlbum(
        projectId,
        'concept-art',
        imageIds as ReferenceImageId[],
        user.id as UserId
      );

      if (!result.ok) {
        if (result.error.code === 'INVALID_INPUT') {
          throw new ValidationError(result.error.message);
        }
        if (result.error.code === 'NOT_FOUND') {
          return NextResponse.json(
            {
              success: false,
              error: result.error.message,
            },
            { status: 404 }
          );
        }
        throw new Error(result.error.message);
      }

      return NextResponse.json(
        {
          success: true,
          album: result.value,
        },
        { status: 201 }
      );
    } catch (error) {
      return errorResponse(error);
    }
  }
);
