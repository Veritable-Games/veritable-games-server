/**
 * Workspace Batch Operations API
 *
 * POST /api/workspace/batch - Execute multiple operations in a batch
 *
 * Supports batching multiple node/connection updates for performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import WorkspaceService from '@/lib/workspace/service';
import { unsafeToNodeId } from '@/lib/workspace/branded-types';
import { getCurrentUser } from '@/lib/auth/server';
import { userIdFromNumber } from '@/types/branded';
import { isDeveloperOrAbove } from '@/lib/permissions/types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface BatchOperation {
  type: 'node.update' | 'node.delete';
  id: string;
  data?: any;
}

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    // SECURITY: Use server-side session authentication, NEVER trust client headers
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Role check: only developers and admins can perform batch operations
    if (!isDeveloperOrAbove(user.role)) {
      return NextResponse.json({ error: 'Developer access required' }, { status: 403 });
    }

    const userId = userIdFromNumber(user.id);

    const { operations } = await request.json();

    if (!Array.isArray(operations)) {
      return NextResponse.json({ error: 'Operations must be an array' }, { status: 400 });
    }

    const workspaceService = new WorkspaceService();
    const results = [];
    const errors = [];

    // Process all operations
    for (const op of operations as BatchOperation[]) {
      try {
        let result;

        switch (op.type) {
          case 'node.update':
            result = await workspaceService.updateNode(unsafeToNodeId(op.id), op.data, userId);
            break;

          case 'node.delete':
            result = await workspaceService.deleteNode(unsafeToNodeId(op.id), userId);
            break;

          default:
            errors.push({
              operation: op,
              error: `Unknown operation type: ${op.type}`,
            });
            continue;
        }

        if (result.ok) {
          results.push({
            operation: op,
            success: true,
            data: result.value,
          });
        } else {
          errors.push({
            operation: op,
            error: result.error.message,
          });
        }
      } catch (error) {
        errors.push({
          operation: op,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      results,
      errors,
      total: operations.length,
      succeeded: results.length,
      failed: errors.length,
    });
  } catch (error) {
    logger.error('Batch operation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
