/**
 * GET /api/godot/projects/[slug]/versions - List all versions for a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { godotService } from '@/lib/godot/service';
import { AuthenticationError, errorResponse } from '@/lib/utils/api-errors';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering to prevent static prerendering of API routes
export const dynamic = 'force-dynamic';

async function getVersions(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user || (user.role !== 'admin' && user.role !== 'developer')) {
      throw new AuthenticationError('Admin or developer access required');
    }

    const params = await context.params;
    const { slug } = params;

    const versions = await godotService.getVersions(slug);

    // Transform snake_case database fields to camelCase for frontend
    const transformed = versions.map(v => ({
      id: v.id,
      versionTag: v.version_tag,
      isActive: v.is_active,
      extractedPath: v.extracted_path,
      buildStatus: v.build_status,
      createdAt: v.created_at,
      updatedAt: v.updated_at,
    }));

    return NextResponse.json(transformed);
  } catch (error) {
    logger.error('Error fetching versions:', error);
    return errorResponse(error);
  }
}

export const GET = withSecurity(getVersions);
