/**
 * GET /api/godot/versions/[id]/scripts/search - Search scripts by content
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { godotService } from '@/lib/godot/service';
import { AuthenticationError, errorResponse } from '@/lib/utils/api-errors';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering to prevent static prerendering of API routes
export const dynamic = 'force-dynamic';

async function searchScripts(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user || (user.role !== 'admin' && user.role !== 'developer')) {
      throw new AuthenticationError('Admin or developer access required');
    }

    const params = await context.params;
    const versionId = parseInt(params.id);

    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const snippetLength = parseInt(url.searchParams.get('snippetLength') || '100');

    if (!query || query.length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
    }

    logger.info(
      `[Search API] Searching scripts: versionId=${versionId}, query="${query}", limit=${limit}, offset=${offset}`
    );

    const results = await godotService.searchScripts(versionId, {
      query,
      limit,
      offset,
      snippetLength,
    });

    logger.info(`[Search API] Found ${results.results.length} results for query "${query}"`);

    return NextResponse.json(results);
  } catch (error) {
    logger.error('Error searching scripts:', error);
    return errorResponse(error);
  }
}

export const GET = withSecurity(searchScripts);
