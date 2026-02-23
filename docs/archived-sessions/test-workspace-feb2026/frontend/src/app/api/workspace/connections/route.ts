/**
 * Workspace Connections API Routes
 *
 * POST   /api/workspace/connections - Create connection
 * GET    /api/workspace/connections - Get connections for workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import WorkspaceService from '@/lib/workspace/service';
import { getCurrentUser } from '@/lib/auth/server';
import { unsafeToWorkspaceId, unsafeToNodeId } from '@/lib/workspace/branded-types';
import { unsafeToUserId } from '@/types/branded';
import { ConnectionAnchor } from '@/lib/workspace/types';
import { isDeveloperOrAbove } from '@/lib/permissions/types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

const workspaceService = new WorkspaceService();

/**
 * POST /api/workspace/connections
 * Create a new connection between two nodes
 */
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    // Authenticate user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role check: only developers and admins can create connections
    if (!isDeveloperOrAbove(user.role)) {
      return NextResponse.json({ error: 'Developer access required' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const {
      workspace_id,
      source_node_id,
      source_anchor,
      target_node_id,
      target_anchor,
      label,
      style,
      z_index,
    } = body;

    // Validate required fields
    if (!workspace_id || !source_node_id || !source_anchor || !target_node_id || !target_anchor) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate anchor structure
    if (!source_anchor.side || typeof source_anchor.offset !== 'number') {
      return NextResponse.json({ error: 'Invalid source anchor' }, { status: 400 });
    }
    if (!target_anchor.side || typeof target_anchor.offset !== 'number') {
      return NextResponse.json({ error: 'Invalid target anchor' }, { status: 400 });
    }

    // Validate anchor offset range (0.0 to 1.0)
    if (
      source_anchor.offset < 0 ||
      source_anchor.offset > 1 ||
      target_anchor.offset < 0 ||
      target_anchor.offset > 1
    ) {
      return NextResponse.json(
        { error: 'Anchor offset must be between 0.0 and 1.0' },
        { status: 400 }
      );
    }

    // Create connection
    const result = await workspaceService.createConnection(
      {
        workspace_id: unsafeToWorkspaceId(workspace_id),
        source_node_id: unsafeToNodeId(source_node_id),
        source_anchor: source_anchor as ConnectionAnchor,
        target_node_id: unsafeToNodeId(target_node_id),
        target_anchor: target_anchor as ConnectionAnchor,
        label,
        style,
        z_index,
      },
      unsafeToUserId(user.id)
    );

    if (!result.ok) {
      const statusCode = result.error.code === 'INVALID_CONNECTION' ? 400 : 500;
      return NextResponse.json({ error: result.error.message }, { status: statusCode });
    }

    return NextResponse.json(result.value, { status: 201 });
  } catch (error) {
    logger.error('Failed to create connection:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

/**
 * GET /api/workspace/connections?workspace_id=xxx
 * Get all connections for a workspace
 */
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    // Authenticate user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace_id from query params
    const searchParams = request.nextUrl.searchParams;
    const workspace_id = searchParams.get('workspace_id');

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id query parameter required' }, { status: 400 });
    }

    // Get connections
    const result = await workspaceService.getConnections(unsafeToWorkspaceId(workspace_id));

    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.value);
  } catch (error) {
    logger.error('Failed to get connections:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
