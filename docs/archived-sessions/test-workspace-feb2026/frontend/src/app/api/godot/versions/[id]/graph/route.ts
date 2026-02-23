/**
 * GET /api/godot/versions/[id]/graph - Get dependency graph for a version
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { godotService } from '@/lib/godot/service';
import { AuthenticationError, errorResponse } from '@/lib/utils/api-errors';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering to prevent static prerendering of API routes
export const dynamic = 'force-dynamic';

async function getGraph(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const versionId = parseInt(params.id);
    logger.info(`[/api/godot/versions/[id]/graph] Request for versionId: ${versionId}`);

    const user = await getCurrentUser(request);
    if (!user || (user.role !== 'admin' && user.role !== 'developer')) {
      logger.warn(
        `[/api/godot/versions/[id]/graph] Unauthorized access attempt by user: ${user?.id}`
      );
      throw new AuthenticationError('Admin or developer access required');
    }

    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') || 'dependencies';
    logger.info(`[/api/godot/versions/[id]/graph] Mode: ${mode}`);

    // Currently only supporting dependencies mode
    // Future modes: scenes, classes, files
    if (mode !== 'dependencies') {
      return NextResponse.json(
        { error: `Visualization mode "${mode}" not yet implemented` },
        { status: 501 }
      );
    }

    const graphData = await godotService.getDependencyGraph(versionId);
    logger.info(`[/api/godot/versions/[id]/graph] Graph data retrieved:`, {
      exists: !!graphData,
      type: typeof graphData,
      isString: typeof graphData === 'string',
      length: typeof graphData === 'string' ? graphData.length : 'N/A',
    });

    if (!graphData) {
      logger.error(
        `[/api/godot/versions/[id]/graph] No graph data found for versionId: ${versionId}`
      );
      return NextResponse.json({ error: 'No graph data found for this version' }, { status: 404 });
    }

    // Parse JSON if it's a string (from PostgreSQL)
    let parsedGraph;
    try {
      parsedGraph = typeof graphData === 'string' ? JSON.parse(graphData) : graphData;
      logger.info(`[/api/godot/versions/[id]/graph] Successfully parsed graph:`, {
        nodeCount: parsedGraph.nodes?.length || 0,
        edgeCount: parsedGraph.edges?.length || 0,
      });
    } catch (parseErr) {
      logger.error(`[/api/godot/versions/[id]/graph] Failed to parse JSON:`, parseErr);
      throw new Error(
        `Failed to parse graph JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
      );
    }

    return NextResponse.json(parsedGraph);
  } catch (error) {
    logger.error('[/api/godot/versions/[id]/graph] Caught error:', error);
    return errorResponse(error);
  }
}

export const GET = withSecurity(getGraph);
