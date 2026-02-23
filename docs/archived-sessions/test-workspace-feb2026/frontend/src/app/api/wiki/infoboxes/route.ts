import { NextRequest, NextResponse } from 'next/server';
import { getWikiService } from '@/lib/services/registry';
import { CreateWikiInfoboxData } from '@/lib/wiki/types';
import { withSecurity } from '@/lib/security/middleware';
import { requireAuth } from '@/lib/auth/server';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

const wikiService = getWikiService();

// GET /api/wiki/infoboxes - List infoboxes with filtering
async function getHandler(request: NextRequest) {
  try {
    // Require authentication - all wiki content requires login
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const searchParams = request.nextUrl.searchParams;
    const pageId = searchParams.get('page_id');
    const templateId = searchParams.get('template_id');
    const active = searchParams.get('active');

    const filters: any = {};

    if (pageId) {
      const parsedPageId = parseInt(pageId);
      if (!isNaN(parsedPageId)) {
        filters.page_id = parsedPageId;
      }
    }

    if (templateId) {
      const parsedTemplateId = parseInt(templateId);
      if (!isNaN(parsedTemplateId)) {
        filters.template_id = parsedTemplateId;
      }
    }

    if (active !== null) {
      filters.is_active = active === 'true';
    }

    const infoboxes = await wikiService.getInfoboxes(filters);

    return NextResponse.json({
      success: true,
      data: infoboxes,
    });
  } catch (error: any) {
    logger.error('Error fetching infoboxes:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch infoboxes',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

export const GET = withSecurity(getHandler, {
  enableCSRF: false, // GET requests don't need CSRF
});

// POST /api/wiki/infoboxes - Create new infobox
async function postHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const infoboxData: CreateWikiInfoboxData = body;

    // Basic validation
    if (!infoboxData.page_id || !infoboxData.template_id || !infoboxData.data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: page_id, template_id, data',
        },
        { status: 400 }
      );
    }

    // Validate position if provided
    const validPositions = ['top-right', 'top-left', 'bottom-right', 'bottom-left', 'inline'];
    if (infoboxData.position && !validPositions.includes(infoboxData.position)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid position. Must be one of: ${validPositions.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const user = authResult.user;
    const userId = user.id;

    const infobox = await wikiService.createInfobox(infoboxData, userId);

    return NextResponse.json(
      {
        success: true,
        data: infobox,
        message: 'Infobox created successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error('Error creating infobox:', error);

    if (error.message.includes('Page not found')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Page not found',
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
        error: 'Failed to create infobox',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(postHandler, {
  enableCSRF: true,
});
