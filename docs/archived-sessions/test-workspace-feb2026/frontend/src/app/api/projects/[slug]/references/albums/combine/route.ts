import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';
import { projectGalleryService } from '@/lib/projects/gallery-service';
import type { AlbumId, UserId } from '@/lib/database/schema-types';
import { brandAlbumId } from '@/lib/database/schema-types';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[slug]/references/albums/combine
 * Combine multiple albums into a single target album
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
      const { targetAlbumId, sourceAlbumIds } = body;

      if (!targetAlbumId || typeof targetAlbumId !== 'number') {
        throw new ValidationError('Target album ID is required');
      }

      if (!Array.isArray(sourceAlbumIds) || sourceAlbumIds.length === 0) {
        throw new ValidationError('At least one source album is required');
      }

      // Validate all IDs are numbers
      if (!sourceAlbumIds.every((id: unknown) => typeof id === 'number')) {
        throw new ValidationError('All album IDs must be numbers');
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

      // Combine albums via service
      const result = await projectGalleryService.combineAlbums(
        brandAlbumId(targetAlbumId),
        sourceAlbumIds.map(id => brandAlbumId(id)),
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
        if (result.error.code === 'DATABASE_ERROR') {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'DATABASE_ERROR',
                message: result.error.message,
                details: process.env.NODE_ENV === 'development' ? result.error.details : undefined,
              },
            },
            { status: 500 }
          );
        }
        throw new Error(result.error.message);
      }

      return NextResponse.json(
        {
          success: true,
          album: result.value,
        },
        { status: 200 }
      );
    } catch (error) {
      return errorResponse(error);
    }
  }
);
