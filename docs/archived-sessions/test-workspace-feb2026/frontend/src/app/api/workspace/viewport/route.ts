/**
 * Workspace Viewport API
 *
 * PUT /api/workspace/viewport - Update viewport state (pan/zoom)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import WorkspaceService from '@/lib/workspace/service';
import { unsafeToWorkspaceId } from '@/lib/workspace/branded-types';
import { getCurrentUser } from '@/lib/auth/server';
import { UpdateViewportSchema, validateRequest } from '@/lib/workspace/validation';
import { userIdFromNumber } from '@/types/branded';
import { isDeveloperOrAbove } from '@/lib/permissions/types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

export const PUT = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Role check: only developers and admins can update viewport state
    if (!isDeveloperOrAbove(user.role)) {
      return NextResponse.json({ error: 'Developer access required' }, { status: 403 });
    }

    const body = await request.json();

    // Validate request body
    const validation = validateRequest(UpdateViewportSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.errors },
        { status: 400 }
      );
    }

    const { workspaceId, transform } = validation.data;

    const workspaceService = new WorkspaceService();
    const workspace = unsafeToWorkspaceId(workspaceId);

    const result = await workspaceService.updateViewportState(
      workspace,
      userIdFromNumber(user.id),
      { transform }
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.value);
  } catch (error) {
    logger.error('Update viewport error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
