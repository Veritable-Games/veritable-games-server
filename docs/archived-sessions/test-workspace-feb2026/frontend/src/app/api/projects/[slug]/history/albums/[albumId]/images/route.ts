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
 * POST /api/projects/[slug]/references/albums/[albumId]/images
 * Add image(s) to an existing reference album
 * Supports both single image and batch additions
 */
export const POST = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ slug: string; albumId: string }> }) => {
    try {
      const user = await getCurrentUser(request);
      if (!user) throw new AuthenticationError();

      const params = await context.params;
      const albumId = brandAlbumId(parseInt(params.albumId));
      const body = await request.json();

      // Validate input - support both single imageId and array imageIds
      const { imageId, imageIds } = body;

      // Determine if this is a batch operation
      const isBatch = Array.isArray(imageIds);
      const idsToAdd: ReferenceImageId[] = isBatch ? imageIds : imageId ? [imageId] : [];

      if (idsToAdd.length === 0) {
        throw new ValidationError('At least one image ID is required');
      }

      // Validate all IDs are numbers
      if (!idsToAdd.every((id: unknown) => typeof id === 'number')) {
        throw new ValidationError('All image IDs must be numbers');
      }

      // Add images to album via service
      if (isBatch) {
        // Batch add - call service method for each image
        for (const id of idsToAdd) {
          const result = await projectGalleryService.addImageToAlbum(
            albumId,
            id as ReferenceImageId,
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
        }

        return NextResponse.json({
          success: true,
          message: `${idsToAdd.length} images added to album successfully`,
        });
      } else {
        // Single add (legacy compatibility)
        const result = await projectGalleryService.addImageToAlbum(
          albumId,
          idsToAdd[0] as ReferenceImageId,
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
          message: 'Image added to album successfully',
        });
      }
    } catch (error) {
      return errorResponse(error);
    }
  }
);
