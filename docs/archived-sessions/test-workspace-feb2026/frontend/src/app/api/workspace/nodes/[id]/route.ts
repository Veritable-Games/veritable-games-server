/**
 * Workspace Node API - Single node operations
 *
 * GET /api/workspace/nodes/[id] - Get a node
 * PUT /api/workspace/nodes/[id] - Update a node
 * DELETE /api/workspace/nodes/[id] - Delete a node (hard delete, cascades connections)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import WorkspaceService from '@/lib/workspace/service';
import { unsafeToNodeId } from '@/lib/workspace/branded-types';
import { getCurrentUser } from '@/lib/auth/server';
import { UpdateNodeSchema, validateRequest } from '@/lib/workspace/validation';
import { userIdFromNumber } from '@/types/branded';
import { isDeveloperOrAbove } from '@/lib/permissions/types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

export const GET = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const user = await getCurrentUser(request);

      if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      const workspaceService = new WorkspaceService();
      const nodeId = unsafeToNodeId(id);

      // Support includeDeleted query param for testing/recovery purposes
      const { searchParams } = new URL(request.url);
      const includeDeleted = searchParams.get('includeDeleted') === 'true';

      const result = await workspaceService.getNode(nodeId, includeDeleted);

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error.message },
          { status: result.error.code === 'NODE_NOT_FOUND' ? 404 : 500 }
        );
      }

      return NextResponse.json(result.value);
    } catch (error) {
      logger.error('Get node error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

export const PUT = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const user = await getCurrentUser(request);

      if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      // Role check: only developers and admins can update nodes
      if (!isDeveloperOrAbove(user.role)) {
        return NextResponse.json({ error: 'Developer access required' }, { status: 403 });
      }

      const body = await request.json();

      // Validate request body
      const validation = validateRequest(UpdateNodeSchema, body);
      if (!validation.success) {
        logger.error('[API] Node update validation failed:', {
          nodeId: id,
          errors: validation.errors,
          receivedBody: JSON.stringify(body).substring(0, 500),
        });
        return NextResponse.json(
          { error: 'Invalid request data', details: validation.errors },
          { status: 400 }
        );
      }

      const workspaceService = new WorkspaceService();
      const nodeId = unsafeToNodeId(id);

      // Lock guard: Check if node is locked before allowing updates
      const getResult = await workspaceService.getNode(nodeId);
      if (!getResult.ok) {
        return NextResponse.json(
          { error: getResult.error.message },
          { status: getResult.error.code === 'NODE_NOT_FOUND' ? 404 : 500 }
        );
      }

      const currentNode = getResult.value;
      const isCurrentlyLocked = currentNode.metadata?.locked === true;

      // Check if this request is explicitly unlocking the node
      const isUnlockingNode = validation.data.metadata?.locked === false;

      // Prevent updates to locked nodes (unless explicitly unlocking)
      if (isCurrentlyLocked && !isUnlockingNode) {
        logger.warn(`[API] Attempted to update locked node ${id}`);
        return NextResponse.json(
          { error: 'Cannot update locked node. Unlock the node first.' },
          { status: 403 }
        );
      }

      const result = await workspaceService.updateNode(
        nodeId,
        validation.data,
        userIdFromNumber(user.id)
      );

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error.message },
          { status: result.error.code === 'NODE_NOT_FOUND' ? 404 : 500 }
        );
      }

      return NextResponse.json(result.value);
    } catch (error) {
      logger.error('Update node error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

export const DELETE = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const user = await getCurrentUser(request);

      if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      // Role check: only developers and admins can delete nodes
      if (!isDeveloperOrAbove(user.role)) {
        return NextResponse.json({ error: 'Developer access required' }, { status: 403 });
      }

      const workspaceService = new WorkspaceService();
      const nodeId = unsafeToNodeId(id);

      // Lock guard: Check if node is locked before allowing deletion
      const getResult = await workspaceService.getNode(nodeId);
      if (!getResult.ok) {
        return NextResponse.json(
          { error: getResult.error.message },
          { status: getResult.error.code === 'NODE_NOT_FOUND' ? 404 : 500 }
        );
      }

      const currentNode = getResult.value;
      const isLocked = currentNode.metadata?.locked === true;

      // Prevent deletion of locked nodes
      if (isLocked) {
        logger.warn(`[API] Attempted to delete locked node ${id}`);
        return NextResponse.json(
          { error: 'Cannot delete locked node. Unlock the node first.' },
          { status: 403 }
        );
      }

      const result = await workspaceService.deleteNode(nodeId, userIdFromNumber(user.id));

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error.message },
          { status: result.error.code === 'NODE_NOT_FOUND' ? 404 : 500 }
        );
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error('Delete node error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
