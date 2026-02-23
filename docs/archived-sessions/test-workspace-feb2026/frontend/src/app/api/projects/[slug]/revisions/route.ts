import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

/**
 * Database query result interfaces
 */

interface ProjectRow {
  id: number;
  slug: string;
  title: string;
  [key: string]: unknown; // Allow additional project fields
}

interface ProjectRevisionRow {
  id: number;
  content: string;
  summary: string | null;
  author_id: number | null;
  author_name: string | null;
  revision_timestamp: string;
  size?: number; // Aliased from size_bytes in query
  [key: string]: unknown; // Allow additional revision fields
}

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// GET /api/projects/[slug]/revisions - Get project version history
export const GET = withSecurity(
  async (request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    try {
      const resolvedParams = await params;

      // First check if project exists in the simple projects table
      const projectResult = await dbAdapter.query(
        'SELECT * FROM projects WHERE slug = $1',
        [resolvedParams.slug],
        { schema: 'content' }
      );
      const basicProject = projectResult.rows[0] as ProjectRow | undefined;

      if (!basicProject) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      // Query actual version history from project_revisions table
      const revisionsResult = await dbAdapter.query(
        `SELECT
          id,
          content,
          summary,
          author_id,
          author_name,
          revision_timestamp,
          size_bytes as size
        FROM project_revisions
        WHERE project_slug = $1
        ORDER BY revision_timestamp DESC`,
        [resolvedParams.slug],
        { schema: 'content' }
      );

      const dbRevisions = revisionsResult.rows as ProjectRevisionRow[];

      // Return empty array when no revisions exist
      // This fixes the issue where mock/fallback revisions were being created
      return NextResponse.json({
        project_slug: resolvedParams.slug,
        revisions: dbRevisions,
      });
    } catch (error) {
      logger.error('Error fetching project revisions:', error);
      return NextResponse.json({ error: 'Failed to fetch version history' }, { status: 500 });
    }
  },
  {}
);

// POST /api/projects/[slug]/revisions/compare - Compare two revisions
export const POST = withSecurity(
  async (request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    try {
      const resolvedParams = await params;
      const body = await request.json();
      const { fromRevisionId, toRevisionId } = body;

      if (!fromRevisionId || !toRevisionId) {
        return NextResponse.json({ error: 'Both revision IDs are required' }, { status: 400 });
      }

      // Get the two revisions for comparison
      const fromRevisionResult = await dbAdapter.query(
        `SELECT id, content, summary, revision_timestamp, author_name
         FROM project_revisions
         WHERE project_slug = $1 AND id = $2`,
        [resolvedParams.slug, fromRevisionId],
        { schema: 'content' }
      );
      const fromRevision = fromRevisionResult.rows[0] as ProjectRevisionRow | undefined;

      const toRevisionResult = await dbAdapter.query(
        `SELECT id, content, summary, revision_timestamp, author_name
         FROM project_revisions
         WHERE project_slug = $1 AND id = $2`,
        [resolvedParams.slug, toRevisionId],
        { schema: 'content' }
      );
      const toRevision = toRevisionResult.rows[0] as ProjectRevisionRow | undefined;

      if (!fromRevision || !toRevision) {
        return NextResponse.json(
          {
            error: 'One or both revisions not found',
          },
          { status: 404 }
        );
      }

      // Basic diff implementation (line-by-line comparison)
      const fromLines = (fromRevision.content || '').split('\n');
      const toLines = (toRevision.content || '').split('\n');
      const maxLines = Math.max(fromLines.length, toLines.length);
      const diff = [];

      for (let i = 0; i < maxLines; i++) {
        const fromLine = fromLines[i] || '';
        const toLine = toLines[i] || '';

        if (fromLine !== toLine) {
          if (fromLine && !toLine) {
            diff.push({
              type: 'removed',
              lineNumber: i + 1,
              content: fromLine,
            });
          } else if (!fromLine && toLine) {
            diff.push({
              type: 'added',
              lineNumber: i + 1,
              content: toLine,
            });
          } else {
            diff.push({
              type: 'modified',
              lineNumber: i + 1,
              oldContent: fromLine,
              newContent: toLine,
            });
          }
        }
      }

      return NextResponse.json({
        project_slug: resolvedParams.slug,
        from: {
          id: fromRevision.id,
          timestamp: fromRevision.revision_timestamp,
          summary: fromRevision.summary,
          author_name: fromRevision.author_name,
        },
        to: {
          id: toRevision.id,
          timestamp: toRevision.revision_timestamp,
          summary: toRevision.summary,
          author_name: toRevision.author_name,
        },
        diff: diff,
      });
    } catch (error) {
      logger.error('Error comparing revisions:', error);
      return NextResponse.json({ error: 'Failed to compare revisions' }, { status: 500 });
    }
  },
  {
    enableCSRF: true,
  }
);

// DELETE /api/projects/[slug]/revisions - Delete a specific revision
export const DELETE = withSecurity(
  async (request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    try {
      const resolvedParams = await params;
      const { searchParams } = new URL(request.url);
      const revisionId = searchParams.get('revisionId');

      if (!revisionId) {
        return NextResponse.json({ error: 'Revision ID is required' }, { status: 400 });
      }

      // Check if revision exists
      const checkResult = await dbAdapter.query(
        `SELECT id FROM project_revisions
         WHERE project_slug = $1 AND id = $2`,
        [resolvedParams.slug, revisionId],
        { schema: 'content' }
      );
      const revision = checkResult.rows[0];

      if (!revision) {
        return NextResponse.json({ error: 'Revision not found' }, { status: 404 });
      }

      // Delete the revision
      const deleteResult = await dbAdapter.query(
        `DELETE FROM project_revisions
         WHERE project_slug = $1 AND id = $2`,
        [resolvedParams.slug, revisionId],
        { schema: 'content' }
      );

      if (deleteResult.rowCount === 0) {
        return NextResponse.json({ error: 'Failed to delete revision' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Revision deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting revision:', error);
      return NextResponse.json({ error: 'Failed to delete revision' }, { status: 500 });
    }
  },
  {
    enableCSRF: true,
  }
);
