/**
 * Forum Section Detail API
 *
 * PATCH /api/forums/sections/[id] - Update section display name
 * DELETE /api/forums/sections/[id] - Delete section
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { forumSectionService } from '@/lib/forums/services';
import {
  errorResponse,
  AuthenticationError,
  ValidationError,
  NotFoundError,
} from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/forums/sections/[id]
 *
 * Updates section display name
 * Requires: Admin or Moderator role
 */
export const PATCH = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      // Authenticate
      const user = await getCurrentUser(request);
      if (!user) {
        throw new AuthenticationError();
      }

      // Check permissions
      if (user.role !== 'admin' && user.role !== 'moderator') {
        throw new ValidationError('Only administrators and moderators can update sections');
      }

      // Get section ID from params
      const params = await context.params;
      const sectionId = params.id;

      if (!sectionId) {
        throw new ValidationError('Section ID is required');
      }

      // Parse request body
      const body = await request.json();
      const { display_name } = body;

      if (!display_name || typeof display_name !== 'string' || !display_name.trim()) {
        throw new ValidationError('Display name is required');
      }

      // Update section name
      await forumSectionService.updateSectionName(sectionId, display_name);

      // Return updated section
      const section = await forumSectionService.getSectionById(sectionId);
      if (!section) {
        throw new NotFoundError('Section', sectionId);
      }

      return NextResponse.json({
        success: true,
        data: { section },
      });
    } catch (error) {
      logger.error('[API] Error updating section:', error);
      return errorResponse(error);
    }
  }
);

/**
 * DELETE /api/forums/sections/[id]
 *
 * Deletes a section (only if empty - no categories)
 * Requires: Admin or Moderator role
 */
export const DELETE = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      // Authenticate
      const user = await getCurrentUser(request);
      if (!user) {
        throw new AuthenticationError();
      }

      // Check permissions
      if (user.role !== 'admin' && user.role !== 'moderator') {
        throw new ValidationError('Only administrators and moderators can delete sections');
      }

      // Get section ID from params
      const params = await context.params;
      const sectionId = params.id;

      if (!sectionId) {
        throw new ValidationError('Section ID is required');
      }

      // Delete section
      await forumSectionService.deleteSection(sectionId);

      return NextResponse.json({
        success: true,
        message: 'Section deleted successfully',
      });
    } catch (error) {
      logger.error('[API] Error deleting section:', error);
      return errorResponse(error);
    }
  }
);
