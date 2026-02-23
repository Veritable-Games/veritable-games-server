import { NextRequest, NextResponse } from 'next/server';
import { getWikiService } from '@/lib/services/registry';
import { UpdateWikiTemplateData } from '@/lib/wiki/types';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

const wikiService = getWikiService();

// GET /api/wiki/templates/[id] - Get specific template
async function getWikiTemplate(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid template ID',
        },
        { status: 400 }
      );
    }

    const template = await wikiService.getTemplateById(templateId);

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    logger.error('Error fetching template:', error);

    if (error.message === 'Template not found') {
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
        error: 'Failed to fetch template',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// PUT /api/wiki/templates/[id] - Update template
async function updateWikiTemplate(
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

    // Only admins and moderators can update templates
    if (user.role !== 'admin' && user.role !== 'moderator') {
      return NextResponse.json(
        { success: false, error: 'Admin or moderator access required to update templates' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid template ID',
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const updateData: UpdateWikiTemplateData = body;

    // Validate field types if fields are being updated
    if (updateData.fields) {
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
      const invalidFields = updateData.fields.filter(
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
    }

    const template = await wikiService.updateTemplate(templateId, updateData, user.id);

    return NextResponse.json({
      success: true,
      data: template,
      message: 'Template updated successfully',
    });
  } catch (error: any) {
    logger.error('Error updating template:', error);

    if (error.message === 'Template not found') {
      return NextResponse.json(
        {
          success: false,
          error: 'Template not found',
        },
        { status: 404 }
      );
    }

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
        error: 'Failed to update template',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// DELETE /api/wiki/templates/[id] - Delete template
async function deleteWikiTemplate(
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

    // Only admins can delete templates
    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required to delete templates' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid template ID',
        },
        { status: 400 }
      );
    }

    await wikiService.deleteTemplate(templateId, user.id);

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting template:', error);

    if (error.message === 'Template not found') {
      return NextResponse.json(
        {
          success: false,
          error: 'Template not found',
        },
        { status: 404 }
      );
    }

    if (error.message.includes('Cannot delete template with active infoboxes')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete template that is currently in use',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete template',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// Apply security middleware to all operations
export const GET = withSecurity(getWikiTemplate, {});

export const PUT = withSecurity(updateWikiTemplate, {
  enableCSRF: true,
});

export const DELETE = withSecurity(deleteWikiTemplate, {
  enableCSRF: true,
});
