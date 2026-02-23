import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';
import { projectGalleryService } from '@/lib/projects/gallery-service';
import type { ReferenceImageId, UserId } from '@/lib/database/schema-types';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * PUT /api/projects/[slug]/concept-art/images/[imageId]/date
 * Update the created_at date of a concept art image
 * Only accessible to admins
 */
export const PUT = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ slug: string; imageId: string }> }) => {
    try {
      const user = await getCurrentUser(request);
      if (!user) throw new AuthenticationError();

      const params = await context.params;
      const imageId = parseInt(params.imageId) as ReferenceImageId;
      const body = await request.json();
      const { created_at } = body;

      // Validate input
      if (!created_at || typeof created_at !== 'string') {
        throw new ValidationError('created_at date string is required');
      }

      // Validate ISO date format
      const date = new Date(created_at);
      if (isNaN(date.getTime())) {
        throw new ValidationError('Invalid date format. Must be valid ISO 8601 date string');
      }

      // Update image metadata via service
      const result = await projectGalleryService.updateImageDate(
        imageId,
        created_at,
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
        message: 'Image date updated successfully',
        data: result.value,
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
);
