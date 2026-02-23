import { dbAdapter } from '@/lib/database/adapter';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// GET /api/projects/[slug]/traces - Get traced content for a project
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const resolvedParams = await params;

    // Get the traced content from the projects table
    const result = await dbAdapter.query(
      'SELECT traced_content FROM projects WHERE slug = $1',
      [resolvedParams.slug],
      { schema: 'content' }
    );

    const project = result.rows[0] as { traced_content: string | null } | undefined;

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      tracedContent: project.traced_content || null,
    });
  } catch (error) {
    logger.error('Error fetching traced content:', error);
    return NextResponse.json({ error: 'Failed to fetch traced content' }, { status: 500 });
  }
}

// PUT /api/projects/[slug]/traces - Save traced content (admin only)
async function updateTracedContent(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Check authentication and admin authorization
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const resolvedParams = await params;

    if (typeof body.content !== 'string') {
      return NextResponse.json({ error: 'Content must be a string' }, { status: 400 });
    }

    // Update the traced_content column
    const result = await dbAdapter.query(
      `UPDATE projects
       SET traced_content = $1, updated_at = NOW()
       WHERE slug = $2`,
      [body.content || null, resolvedParams.slug],
      { schema: 'content' }
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Traced content saved',
    });
  } catch (error) {
    logger.error('Error saving traced content:', error);
    return NextResponse.json({ error: 'Failed to save traced content' }, { status: 500 });
  }
}

export const PUT = withSecurity(updateTracedContent, {
  enableCSRF: true,
});
