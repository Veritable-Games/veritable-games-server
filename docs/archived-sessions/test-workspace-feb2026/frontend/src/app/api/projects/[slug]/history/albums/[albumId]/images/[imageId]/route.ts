import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { errorResponse, AuthenticationError } from '@/lib/utils/api-errors';
import { projectGalleryService } from '@/lib/projects/gallery-service';
import type { AlbumId, ReferenceImageId, UserId } from '@/lib/database/schema-types';
import { brandAlbumId } from '@/lib/database/schema-types';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/projects/[slug]/references/albums/[albumId]/images/[imageId]
 * Remove an image from a reference album
 * If album becomes empty, it is automatically deleted
 */
export const DELETE = withSecurity(
  async (
    request: NextRequest,
    context: { params: Promise<{ slug: string; albumId: string; imageId: string }> }
  ) => {
    try {
      const user = await getCurrentUser(request);
      if (!user) throw new AuthenticationError();

      const params = await context.params;
      const albumId = brandAlbumId(parseInt(params.albumId));
      const imageId = parseInt(params.imageId) as ReferenceImageId;

      // Remove image from album via service
      const result = await projectGalleryService.removeImageFromAlbum(
        albumId,
        imageId,
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
        throw new Error(result.error.message);
      }

      return NextResponse.json({
        success: true,
        message: 'Image removed from album successfully',
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
);
