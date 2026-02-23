import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { projectGalleryService } from '@/lib/projects/gallery-service';
import { withSecurity } from '@/lib/security/middleware';
import { unlink } from 'fs/promises';
import path from 'path';
import type { ReferenceImageId, UserId } from '@/lib/database/schema-types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/projects/[slug]/concept-art/[imageId]/permanent
 * PERMANENTLY DELETE a concept art image (hard delete)
 *
 * WARNING: This operation is IRREVERSIBLE!
 * - Deletes from database completely
 * - Removes file from disk
 * - Cannot be recovered (unless backup exists)
 *
 * Admin only. Requires confirmation query parameter.
 */
async function permanentDeleteHandler(
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

    // Require explicit confirmation to prevent accidental deletion
    const confirmed = request.nextUrl.searchParams.get('confirm');
    if (confirmed !== 'true') {
      return NextResponse.json(
        {
          error: 'Confirmation required',
          message: 'Add ?confirm=true to permanently delete this image',
          warning:
            'This operation is IRREVERSIBLE - the image will be completely deleted from disk and database',
        },
        { status: 400 }
      );
    }

    // Get image details before deletion (for file cleanup)
    const imageResult = await projectGalleryService.getImageById(id);
    if (!imageResult.ok) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const image = imageResult.value;

    // Delete from database
    const deleteResult = await projectGalleryService.permanentlyDeleteImage(id);
    if (!deleteResult.ok) {
      return NextResponse.json({ error: deleteResult.error.message }, { status: 500 });
    }

    // Delete file from disk
    try {
      const filePath = path.join(process.cwd(), 'public', image.file_path);
      await unlink(filePath);
      logger.info('Image file permanently deleted from disk', { imageId, filePath });
    } catch (error) {
      // File might already be deleted or moved, log but don't fail
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!errorMsg.includes('ENOENT')) {
        logger.warn('Failed to delete image file from disk', {
          imageId,
          filePath: image.file_path,
          error,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Image permanently deleted',
      details: {
        imageId: id,
        filename: image.filename_storage,
        fileSize: image.file_size,
        deletedAt: new Date().toISOString(),
        deletedBy: user.id,
      },
    });
  } catch (error) {
    logger.error('Permanent delete error:', error);
    return NextResponse.json({ error: 'Failed to permanently delete image' }, { status: 500 });
  }
}

// Apply security middleware
export const DELETE = withSecurity(permanentDeleteHandler, {});
