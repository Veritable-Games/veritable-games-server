/**
 * Workspace Nodes API
 *
 * POST /api/workspace/nodes - Create a new node
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import WorkspaceService from '@/lib/workspace/service';
import { getCurrentUser } from '@/lib/auth/server';
import { CreateNodeSchema, validateRequest } from '@/lib/workspace/validation';
import { userIdFromNumber } from '@/types/branded';
import { unsafeToWorkspaceId } from '@/lib/workspace/branded-types';
import { isDeveloperOrAbove } from '@/lib/permissions/types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Role check: only developers and admins can create nodes
    if (!isDeveloperOrAbove(user.role)) {
      return NextResponse.json({ error: 'Developer access required' }, { status: 403 });
    }

    const body = await request.json();

    // Validate request body
    const validation = validateRequest(CreateNodeSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.errors },
        { status: 400 }
      );
    }

    const workspaceService = new WorkspaceService();

    // Convert validated data to use branded types
    const nodeData = {
      ...validation.data,
      workspace_id: unsafeToWorkspaceId(validation.data.workspace_id),
    };

    const result = await workspaceService.createNode(nodeData, userIdFromNumber(user.id));

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error.message, code: result.error.code, details: result.error.details },
        { status: 500 }
      );
    }

    return NextResponse.json(result.value, { status: 201 });
  } catch (error) {
    logger.error('Error creating workspace node:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
        ...(process.env.NODE_ENV === 'development' && {
          stack: error instanceof Error ? error.stack : undefined,
        }),
      },
      { status: 500 }
    );
  }
});
