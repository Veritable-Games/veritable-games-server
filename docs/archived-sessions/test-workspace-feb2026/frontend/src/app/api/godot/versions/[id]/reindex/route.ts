/**
 * POST /api/godot/versions/[id]/reindex - Re-index an existing version with the current parser
 * Useful when the parser has been improved and previous versions need to be re-parsed
 * with the new dependency detection patterns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { godotService } from '@/lib/godot/service';
import { AuthenticationError, errorResponse } from '@/lib/utils/api-errors';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering to prevent static prerendering of API routes
export const dynamic = 'force-dynamic';

async function reindexHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // 1. Authenticate user
    const user = await getCurrentUser(request);
    if (!user || (user.role !== 'admin' && user.role !== 'developer')) {
      throw new AuthenticationError('Admin or developer access required');
    }

    // 2. Parse version ID
    const params = await context.params;
    const versionId = parseInt(params.id);

    if (isNaN(versionId)) {
      return NextResponse.json({ error: 'Invalid version ID' }, { status: 400 });
    }

    logger.info(`[Reindex API] Starting re-index for version ${versionId}`);

    // 3. Call reindex service
    const result = await godotService.reindexVersion(versionId);

    logger.info(
      `[Reindex API] Success: ${result.scriptsIndexed} scripts, ${result.graph.edges.length} dependencies`
    );

    // 4. Return success response
    return NextResponse.json({
      success: true,
      versionId,
      scriptsIndexed: result.scriptsIndexed,
      dependenciesFound: result.graph.edges.length,
      graphStats: {
        nodes: result.graph.nodes.length,
        edges: result.graph.edges.length,
      },
      message: `Re-indexed ${result.scriptsIndexed} scripts with ${result.graph.edges.length} dependencies`,
    });
  } catch (error) {
    logger.error('[Reindex API] Error:', error);
    return errorResponse(error);
  }
}

export const POST = withSecurity(reindexHandler);
