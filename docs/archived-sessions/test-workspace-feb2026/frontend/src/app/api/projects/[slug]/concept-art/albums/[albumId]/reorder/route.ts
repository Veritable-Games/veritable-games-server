import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';
import { projectGalleryService } from '@/lib/projects/gallery-service';
import type { AlbumId, ReferenceImageId, UserId } from '@/lib/database/schema-types';
import { brandAlbumId } from '@/lib/database/schema-types';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * PUT /api/projects/[slug]/concept-art/albums/[albumId]/reorder
 * Reorder images within a concept-art album
 */
export const PUT = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ slug: string; albumId: string }> }) => {
    try {
      const user = await getCurrentUser(request);
      if (!user) throw new AuthenticationError();

      const params = await context.params;
      const albumId = brandAlbumId(parseInt(params.albumId));
      const body = await request.json();

      // Validate input
      const { orderedImageIds } = body;

      if (!Array.isArray(orderedImageIds) || orderedImageIds.length === 0) {
        throw new ValidationError('orderedImageIds must be a non-empty array');
      }

      // Validate all IDs are numbers
      if (!orderedImageIds.every(id => typeof id === 'number')) {
        throw new ValidationError('All image IDs must be numbers');
      }

      // Reorder images via service
      const result = await projectGalleryService.reorderAlbumImages(
        albumId,
        orderedImageIds as ReferenceImageId[],
        user.id as UserId
      );

      if (!result.ok) {
        if (result.error.code === 'NOT_FOUND') {
          return NextResponse.json(
            {
              success: false,
              error: result.error.message,
            },
            { status: 404 }
          );
        }
        if (result.error.code === 'INVALID_INPUT') {
          return NextResponse.json(
            {
              success: false,
              error: result.error.message,
            },
            { status: 400 }
          );
        }
        throw new Error(result.error.message);
      }

      return NextResponse.json({
        success: true,
        message: 'Album images reordered successfully',
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
);
