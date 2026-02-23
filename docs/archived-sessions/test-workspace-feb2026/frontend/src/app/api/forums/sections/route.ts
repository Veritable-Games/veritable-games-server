/**
 * Forum Sections API
 *
 * GET /api/forums/sections - List all sections
 * POST /api/forums/sections - Create new section
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { forumSectionService } from '@/lib/forums/services';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/forums/sections
 *
 * Returns all forum sections ordered by sort_order
 */
export const GET = withSecurity(async () => {
  try {
    const sections = await forumSectionService.getAllSections();

    return NextResponse.json({
      success: true,
      data: {
        sections,
      },
    });
  } catch (error) {
    logger.error('[API] Error fetching sections:', error);
    return errorResponse(error);
  }
});

/**
 * POST /api/forums/sections
 *
 * Creates a new forum section
 * Requires: Admin or Moderator role
 */
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    // Authenticate
    const user = await getCurrentUser(request);
    if (!user) {
      throw new AuthenticationError();
    }

    // Check permissions
    if (user.role !== 'admin' && user.role !== 'moderator') {
      throw new ValidationError('Only administrators and moderators can create sections');
    }

    // Parse request body
    const body = await request.json();
    const { id, display_name } = body;

    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new ValidationError('Section ID is required');
    }

    if (!display_name || typeof display_name !== 'string' || !display_name.trim()) {
      throw new ValidationError('Display name is required');
    }

    // Create section
    const section = await forumSectionService.createSection(id, display_name);

    return NextResponse.json({
      success: true,
      data: { section },
    });
  } catch (error) {
    logger.error('[API] Error creating section:', error);
    return errorResponse(error);
  }
});
