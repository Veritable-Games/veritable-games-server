/**
 * Workspace Connection API Routes (Individual)
 *
 * DELETE /api/workspace/connections/[id] - Delete connection
 * PATCH  /api/workspace/connections/[id] - Update connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import WorkspaceService from '@/lib/workspace/service';
import { getCurrentUser } from '@/lib/auth/server';
import { unsafeToConnectionId } from '@/lib/workspace/branded-types';
import { unsafeToUserId } from '@/types/branded';
import { ConnectionAnchor } from '@/lib/workspace/types';
import { isDeveloperOrAbove } from '@/lib/permissions/types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

const workspaceService = new WorkspaceService();

/**
 * DELETE /api/workspace/connections/[id]
 * Soft delete a connection
 */
export const DELETE = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      // Authenticate user
      const user = await getCurrentUser(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Role check: only developers and admins can delete connections
      if (!isDeveloperOrAbove(user.role)) {
        return NextResponse.json({ error: 'Developer access required' }, { status: 403 });
      }

      // Get connection ID from params
      const params = await context.params;
      const connectionId = unsafeToConnectionId(params.id);

      // Delete connection (soft delete)
      const result = await workspaceService.deleteConnection(connectionId);

      if (!result.ok) {
        const statusCode = result.error.code === 'CONNECTION_NOT_FOUND' ? 404 : 500;
        return NextResponse.json({ error: result.error.message }, { status: statusCode });
      }

      return NextResponse.json({ success: true, message: 'Connection deleted' }, { status: 200 });
    } catch (error) {
      logger.error('Failed to delete connection:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

/**
 * PATCH /api/workspace/connections/[id]
 * Update connection (anchors, label, style)
 */
export const PATCH = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      // Authenticate user
      const user = await getCurrentUser(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Role check: only developers and admins can update connections
      if (!isDeveloperOrAbove(user.role)) {
        return NextResponse.json({ error: 'Developer access required' }, { status: 403 });
      }

      // Get connection ID from params
      const params = await context.params;
      const connectionId = unsafeToConnectionId(params.id);

      // Parse request body
      const body = await request.json();
      const { source_anchor, target_anchor, label, style, z_index } = body;

      // Validate anchor structure if provided
      if (source_anchor) {
        if (!source_anchor.side || typeof source_anchor.offset !== 'number') {
          return NextResponse.json({ error: 'Invalid source anchor' }, { status: 400 });
        }
        if (source_anchor.offset < 0 || source_anchor.offset > 1) {
          return NextResponse.json(
            { error: 'Anchor offset must be between 0.0 and 1.0' },
            { status: 400 }
          );
        }
      }

      if (target_anchor) {
        if (!target_anchor.side || typeof target_anchor.offset !== 'number') {
          return NextResponse.json({ error: 'Invalid target anchor' }, { status: 400 });
        }
        if (target_anchor.offset < 0 || target_anchor.offset > 1) {
          return NextResponse.json(
            { error: 'Anchor offset must be between 0.0 and 1.0' },
            { status: 400 }
          );
        }
      }

      // Update connection
      const result = await workspaceService.updateConnection(
        connectionId,
        {
          source_anchor: source_anchor as ConnectionAnchor | undefined,
          target_anchor: target_anchor as ConnectionAnchor | undefined,
          label,
          style,
          z_index,
        },
        unsafeToUserId(user.id)
      );

      if (!result.ok) {
        const statusCode = result.error.code === 'CONNECTION_NOT_FOUND' ? 404 : 500;
        return NextResponse.json({ error: result.error.message }, { status: statusCode });
      }

      return NextResponse.json(result.value);
    } catch (error) {
      logger.error('Failed to update connection:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
