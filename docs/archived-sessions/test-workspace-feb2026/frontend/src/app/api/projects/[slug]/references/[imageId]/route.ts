import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { projectGalleryService } from '@/lib/projects/gallery-service';
import { withSecurity } from '@/lib/security/middleware';
import type { ReferenceImageId, ReferenceTagId, UserId } from '@/lib/database/schema-types';
import type { UpdateReferenceImageInput } from '@/types/project-references';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[slug]/references/[imageId]
 * Get a single reference image by ID
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string; imageId: string }> }
) {
  try {
    const { imageId } = await context.params;
    const id = parseInt(imageId) as ReferenceImageId;

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid image ID' }, { status: 400 });
    }

    const result = await projectGalleryService.getImageById(id);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        return NextResponse.json({ error: result.error.message }, { status: 404 });
      }
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.value);
  } catch (error) {
    logger.error('Error fetching reference image:', error);
    return NextResponse.json({ error: 'Failed to fetch reference image' }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[slug]/references/[imageId]
 * Update reference image metadata (admin only)
 */
async function updateReferenceHandler(
  request: NextRequest,
  context: { params: Promise<{ slug: string; imageId: string }> }
) {
  try {
    const { imageId } = await context.params;
    const id = parseInt(imageId) as ReferenceImageId;

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid image ID' }, { status: 400 });
    }

    // Check authentication and admin authorization
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();

    // Check if this is a restore request
    if (body.restore === true) {
      const result = await projectGalleryService.updateImage(
        id,
        { is_deleted: false },
        user.id as UserId
      );

      if (!result.ok) {
        if (result.error.code === 'NOT_FOUND') {
          return NextResponse.json({ error: result.error.message }, { status: 404 });
        }
        return NextResponse.json({ error: result.error.message }, { status: 500 });
      }

      // Fetch the restored image to return with tags
      const restoredImageResult = await projectGalleryService.getImageById(id);

      if (!restoredImageResult.ok) {
        return NextResponse.json({ error: 'Failed to fetch restored image' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Image restored successfully',
        image: restoredImageResult.value,
      });
    }

    // Build update input for tag updates
    const input: UpdateReferenceImageInput = {};

    if (body.tag_ids !== undefined) {
      input.tag_ids = body.tag_ids as ReferenceTagId[];
    }

    const result = await projectGalleryService.updateImage(id, input, user.id as UserId);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        return NextResponse.json({ error: result.error.message }, { status: 404 });
      }
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    // Fetch the updated image to return with tags
    const updatedImageResult = await projectGalleryService.getImageById(id);

    if (!updatedImageResult.ok) {
      return NextResponse.json({ error: 'Failed to fetch updated image' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Image updated successfully',
      image: updatedImageResult.value,
    });
  } catch (error) {
    logger.error('Update error:', error);
    return NextResponse.json({ error: 'Failed to update image' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[slug]/references/[imageId]
 * Soft delete a reference image (admin only)
 */
async function deleteReferenceHandler(
  request: NextRequest,
  context: { params: Promise<{ slug: string; imageId: string }> }
) {
  try {
    const { imageId } = await context.params;
    const id = parseInt(imageId) as ReferenceImageId;

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid image ID' }, { status: 400 });
    }

    // Check authentication and admin authorization
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const result = await projectGalleryService.deleteImage(id, user.id as UserId);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        return NextResponse.json({ error: result.error.message }, { status: 404 });
      }
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    logger.error('Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
  }
}

// Apply security middleware
export const PATCH = withSecurity(updateReferenceHandler, {});

export const DELETE = withSecurity(deleteReferenceHandler, {});
