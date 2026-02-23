import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// POST /api/projects/[slug]/revisions/restore - Restore a specific version
export const POST = withSecurity(
  async (request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    try {
      // Check authentication
      const user = await getCurrentUser(request);
      if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      const resolvedParams = await params;
      const projectSlug = resolvedParams.slug;
      const body = await request.json();
      const { revisionId, summary } = body;

      if (!revisionId) {
        return NextResponse.json({ error: 'Revision ID is required' }, { status: 400 });
      }

      // Get the revision to restore
      const revisionResult = await dbAdapter.query(
        `
        SELECT id, content, author_name, summary as original_summary
        FROM project_revisions
        WHERE id = $1 AND project_slug = $2
      `,
        [revisionId, projectSlug],
        { schema: 'content' }
      );

      const revision = revisionResult.rows[0];

      if (!revision) {
        return NextResponse.json({ error: 'Revision not found' }, { status: 404 });
      }

      // Get current project content
      const projectResult = await dbAdapter.query(
        `
        SELECT content FROM projects WHERE slug = $1
      `,
        [projectSlug],
        { schema: 'content' }
      );

      const currentProject = projectResult.rows[0];

      if (!currentProject) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      // Create a new revision with the current content before restoring
      const backupSummary = `Backup before restoring revision #${revisionId}`;
      await dbAdapter.query(
        `
        INSERT INTO project_revisions (
          project_slug,
          content,
          author_id,
          author_name,
          summary,
          revision_timestamp,
          size_bytes
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      `,
        [
          projectSlug,
          currentProject.content,
          user.id,
          user.username || user.display_name || 'Unknown',
          backupSummary,
          Buffer.byteLength(currentProject.content || '', 'utf8'),
        ],
        { schema: 'content' }
      );

      // Update the project with the restored content
      const updateResult = await dbAdapter.query(
        `
        UPDATE projects
        SET
          content = $1,
          updated_at = NOW()
        WHERE slug = $2
      `,
        [revision.content, projectSlug],
        { schema: 'content' }
      );

      if (updateResult.rowCount === 0) {
        return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
      }

      // Create a new revision record for the restoration
      const restoreSummary =
        summary ||
        `Restored revision #${revisionId} (${revision.original_summary || 'No summary'})`;
      await dbAdapter.query(
        `
        INSERT INTO project_revisions (
          project_slug,
          content,
          author_id,
          author_name,
          summary,
          revision_timestamp,
          size_bytes
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      `,
        [
          projectSlug,
          revision.content,
          user.id,
          user.username || user.display_name || 'Unknown',
          restoreSummary,
          Buffer.byteLength(revision.content || '', 'utf8'),
        ],
        { schema: 'content' }
      );

      return NextResponse.json({
        success: true,
        message: `Successfully restored revision #${revisionId}`,
      });
    } catch (error) {
      logger.error('Error restoring revision:', error);
      return NextResponse.json({ error: 'Failed to restore revision' }, { status: 500 });
    }
  },
  {
    enableCSRF: true,
  }
);
