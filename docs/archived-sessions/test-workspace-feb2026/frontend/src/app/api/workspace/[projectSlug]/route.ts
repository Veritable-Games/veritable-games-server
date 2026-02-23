/**
 * Workspace API - Get workspace with all content
 *
 * GET /api/workspace/[projectSlug]
 * Returns workspace metadata, nodes, connections, and viewport state
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import WorkspaceService from '@/lib/workspace/service';
import { unsafeToWorkspaceId } from '@/lib/workspace/branded-types';
import { getCurrentUser } from '@/lib/auth/server';
import { userIdFromNumber } from '@/types/branded';
import { isDeveloperOrAbove } from '@/lib/permissions/types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

export const GET = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ projectSlug: string }> }) => {
    try {
      const { projectSlug } = await context.params;

      // Get user from server-side session
      const user = await getCurrentUser(request);

      if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      const workspaceService = new WorkspaceService();
      const workspaceId = unsafeToWorkspaceId(projectSlug);

      // Try to get existing workspace
      let workspaceResult = await workspaceService.getWorkspace(workspaceId);

      // If workspace doesn't exist, create it
      if (!workspaceResult.ok) {
        const createResult = await workspaceService.createWorkspace(
          { project_slug: projectSlug },
          userIdFromNumber(user.id)
        );

        if (!createResult.ok) {
          return NextResponse.json(
            { error: 'Failed to create workspace', details: createResult.error.message },
            { status: 500 }
          );
        }
      }

      // Get workspace with all content
      const contentResult = await workspaceService.getWorkspaceWithContent(
        workspaceId,
        userIdFromNumber(user.id)
      );

      if (!contentResult.ok) {
        return NextResponse.json({ error: contentResult.error.message }, { status: 500 });
      }

      return NextResponse.json(contentResult.value);
    } catch (error) {
      logger.error('Workspace API error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

export const PUT = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ projectSlug: string }> }) => {
    try {
      const { projectSlug } = await context.params;
      const user = await getCurrentUser(request);

      if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      // Role check: only developers and admins can update workspaces
      if (!isDeveloperOrAbove(user.role)) {
        return NextResponse.json({ error: 'Developer access required' }, { status: 403 });
      }

      const body = await request.json();
      const workspaceService = new WorkspaceService();
      const workspaceId = unsafeToWorkspaceId(projectSlug);

      const result = await workspaceService.updateWorkspace(
        workspaceId,
        body,
        userIdFromNumber(user.id)
      );

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error.message },
          { status: result.error.code === 'WORKSPACE_NOT_FOUND' ? 404 : 500 }
        );
      }

      return NextResponse.json(result.value);
    } catch (error) {
      logger.error('Update workspace error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
