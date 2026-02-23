import { NextRequest, NextResponse } from 'next/server';
import { getWikiService } from '@/lib/services/registry';
import { UpdateWikiInfoboxData } from '@/lib/wiki/types';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

const wikiService = getWikiService();

// GET /api/wiki/infoboxes/[id] - Get specific infobox
async function getWikiInfobox(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const infoboxId = parseInt(id);

    if (isNaN(infoboxId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid infobox ID',
        },
        { status: 400 }
      );
    }

    const infobox = await wikiService.getInfoboxById(infoboxId);

    return NextResponse.json({
      success: true,
      data: infobox,
    });
  } catch (error: any) {
    logger.error('Error fetching infobox:', error);

    if (error.message === 'Infobox not found') {
      return NextResponse.json(
        {
          success: false,
          error: 'Infobox not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch infobox',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// PUT /api/wiki/infoboxes/[id] - Update infobox
async function updateWikiInfobox(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and authorization
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only admins and moderators can update infoboxes
    if (user.role !== 'admin' && user.role !== 'moderator') {
      return NextResponse.json(
        { success: false, error: 'Admin or moderator access required to update infoboxes' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const infoboxId = parseInt(id);

    if (isNaN(infoboxId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid infobox ID',
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const updateData: UpdateWikiInfoboxData = body;

    // Validate position if provided
    if (updateData.position) {
      const validPositions = ['top-right', 'top-left', 'bottom-right', 'bottom-left', 'inline'];
      if (!validPositions.includes(updateData.position)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid position. Must be one of: ${validPositions.join(', ')}`,
          },
          { status: 400 }
        );
      }
    }

    const infobox = await wikiService.updateInfobox(infoboxId, updateData, user.id);

    return NextResponse.json({
      success: true,
      data: infobox,
      message: 'Infobox updated successfully',
    });
  } catch (error: any) {
    logger.error('Error updating infobox:', error);

    if (error.message === 'Infobox not found') {
      return NextResponse.json(
        {
          success: false,
          error: 'Infobox not found',
        },
        { status: 404 }
      );
    }

    if (error.message.includes('Template not found')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Template not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update infobox',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// DELETE /api/wiki/infoboxes/[id] - Delete infobox
async function deleteWikiInfobox(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and authorization
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only admins can delete infoboxes
    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required to delete infoboxes' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const infoboxId = parseInt(id);

    if (isNaN(infoboxId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid infobox ID',
        },
        { status: 400 }
      );
    }

    await wikiService.deleteInfobox(infoboxId, user.id);

    return NextResponse.json({
      success: true,
      message: 'Infobox deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting infobox:', error);

    if (error.message === 'Infobox not found') {
      return NextResponse.json(
        {
          success: false,
          error: 'Infobox not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete infobox',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// Apply security middleware to all operations
export const GET = withSecurity(getWikiInfobox, {});

export const PUT = withSecurity(updateWikiInfobox, {
  enableCSRF: true,
});

export const DELETE = withSecurity(deleteWikiInfobox, {
  enableCSRF: true,
});
