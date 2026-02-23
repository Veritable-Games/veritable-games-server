import { NextRequest, NextResponse } from 'next/server';
import { CreateWikiTemplateData } from '@/lib/wiki/types';
import { withSecurity } from '@/lib/security/middleware';
import { requireAuth } from '@/lib/auth/server';
import { getWikiService } from '@/lib/services/registry';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// GET /api/wiki/templates - List all templates
async function getHandler(request: NextRequest) {
  try {
    // Require authentication - all wiki content requires login
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'infobox' | 'template' | 'notice' | null;
    const category = searchParams.get('category');
    const active = searchParams.get('active');

    const wikiService = getWikiService();
    const templates = await wikiService.getTemplates({
      type: type || undefined,
      category: category || undefined,
      is_active: active === 'true' ? true : active === 'false' ? false : undefined,
    });

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error: any) {
    logger.error('Error fetching templates:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch templates',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

export const GET = withSecurity(getHandler, {
  enableCSRF: false, // GET requests don't need CSRF
});

// POST /api/wiki/templates - Create new template
async function postHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const templateData: CreateWikiTemplateData = body;

    // Basic validation
    if (!templateData.name || !templateData.type || !templateData.fields) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: name, type, fields',
        },
        { status: 400 }
      );
    }

    // Validate field types
    const validFieldTypes = [
      'text',
      'textarea',
      'image',
      'url',
      'date',
      'list',
      'boolean',
      'number',
    ];
    const invalidFields = templateData.fields.filter(
      field => !validFieldTypes.includes(field.field_type)
    );

    if (invalidFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid field types: ${invalidFields.map(f => f.field_type).join(', ')}`,
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

    // Check for moderator/admin role
    if (user.role !== 'admin' && user.role !== 'moderator') {
      return NextResponse.json(
        {
          success: false,
          error: 'Moderator or admin role required',
        },
        { status: 401 }
      );
    }

    const wikiService = getWikiService();
    const template = await wikiService.createTemplate(templateData, user.id);

    return NextResponse.json(
      {
        success: true,
        data: template,
        message: 'Template created successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error('Error creating template:', error);

    if (error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Template name already exists',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create template',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(postHandler, {
  enableCSRF: true,
});
