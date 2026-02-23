import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { dataExportService } from '@/lib/users/export-service';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function postHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Users can only export their own data, admins can export any user's data
    if (currentUser.id !== userId && currentUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to export user data' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { export_type } = body;

    // Validate export type
    const validExportTypes = ['full', 'forums', 'wiki', 'library', 'activity'];
    const exportType = export_type || 'full';

    if (!validExportTypes.includes(exportType)) {
      return NextResponse.json({ success: false, error: 'Invalid export type' }, { status: 400 });
    }

    const requestId = await dataExportService.requestDataExport(userId, exportType);

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: 'Failed to create export request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        request_id: requestId,
        message: 'Data export request submitted. Processing will begin shortly.',
        export_type: exportType,
      },
    });
  } catch (error) {
    logger.error('Error requesting data export:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to request data export' },
      { status: 500 }
    );
  }
}

async function getHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Users can only view their own exports, admins can view any
    if (currentUser.id !== userId && currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const exports = await dataExportService.getUserDataExports(userId);

    return NextResponse.json({
      success: true,
      data: exports,
    });
  } catch (error) {
    logger.error('Error fetching user exports:', error);
    return NextResponse.json({ error: 'Failed to fetch exports' }, { status: 500 });
  }
}

export const POST = withSecurity(postHandler, {
  enableCSRF: true,
});

export const GET = withSecurity(getHandler, {});
