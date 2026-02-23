import { dbAdapter } from '@/lib/database/adapter';
import { NextRequest, NextResponse } from 'next/server';
import { getProjectService } from '@/lib/services/registry';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import type { TracedContentRow } from '@/lib/tracing/types';
import { rowToTracedContent } from '@/lib/tracing/types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * Project database row structure
 */
interface ProjectRow {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  category: string | null;
  color: string | null;
  display_order: number;
  is_universal_system: boolean | number;
  content: string | null;
  background_content: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * PostgreSQL error with code property
 */
interface PostgresError {
  code: string;
  message: string;
}

const projectService = getProjectService();

// GET /api/projects/[slug] - Get project with content and revision history
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const resolvedParams = await params;
    const user = await getCurrentUser(request);
    const isAdmin = user?.role === 'admin';

    // First, try to get the project from the basic projects table
    const projectResult = await dbAdapter.query(
      'SELECT * FROM projects WHERE slug = $1',
      [resolvedParams.slug],
      { schema: 'content' }
    );
    const basicProject = projectResult.rows[0] as ProjectRow | undefined;

    if (!basicProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get traced content for this project
    // Tracing is enabled by default for all projects with content
    const projectContent = (basicProject.content as string) || '';
    const hasContent = projectContent.length > 0;
    const tracingEnabled = hasContent; // Enable tracing whenever there's content

    let tracedContents: ReturnType<typeof rowToTracedContent>[] = [];

    if (hasContent) {
      const statusFilter = isAdmin ? '' : "AND status = 'published'";
      const tracesResult = await dbAdapter.query(
        `SELECT * FROM project_traced_content
         WHERE project_slug = $1 ${statusFilter}
         ORDER BY anchor_start_offset ASC NULLS LAST, created_at ASC`,
        [resolvedParams.slug],
        { schema: 'content' }
      );
      tracedContents = (tracesResult.rows as TracedContentRow[]).map(rowToTracedContent);
    }

    // Use the rich content from the content field directly
    const project = {
      metadata: {
        ...basicProject,
        is_universal_system: Boolean(basicProject.is_universal_system),
      },
      content:
        (basicProject.content as string) ||
        `# ${(basicProject.title as string) || 'Untitled Project'}

## Project Overview

${(basicProject.description as string) || 'No description available'}

This project is currently in ${((basicProject.status as string) || 'unknown').toLowerCase()} phase.`,
      sections: [],
      last_revision: basicProject.updated_at
        ? {
            id: 1,
            author_name: 'System',
            summary: 'Project content updated',
            revision_timestamp: basicProject.updated_at,
          }
        : null,
      // Tracing data
      tracingEnabled,
      // Background content for admins: use explicit background_content or fall back to content
      backgroundContent: isAdmin
        ? (basicProject.background_content as string | null) || projectContent || null
        : null,
      tracedContents,
    };

    return NextResponse.json(project);
  } catch (error) {
    logger.error('Error fetching project:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

// PUT /api/projects/[slug] - Update project metadata or content (admin only)
async function updateProject(
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

    // Check if this is a content update (has content and summary) or metadata update
    if (body.content && body.summary) {
      // Update project content directly in the database
      try {
        // Update project content
        const updateResult = await dbAdapter.query(
          `UPDATE projects
           SET content = $1, updated_at = NOW()
           WHERE slug = $2`,
          [body.content, resolvedParams.slug],
          { schema: 'content' }
        );

        if (updateResult.rowCount === 0) {
          return NextResponse.json(
            { error: 'Project not found or no changes made' },
            { status: 404 }
          );
        }

        // Create revision record
        const revisionTimestamp = new Date().toISOString();
        const sizeBytes = body.content.length;

        await dbAdapter.query(
          `INSERT INTO project_revisions (
            project_slug,
            content,
            summary,
            author_id,
            author_name,
            revision_timestamp,
            size_bytes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            resolvedParams.slug,
            body.content,
            body.summary,
            user.id,
            user.username,
            revisionTimestamp,
            sizeBytes,
          ],
          { schema: 'content' }
        );

        // Get updated project data
        const updatedProjectResult = await dbAdapter.query(
          'SELECT * FROM projects WHERE slug = $1',
          [resolvedParams.slug],
          { schema: 'content' }
        );
        const updatedProject = updatedProjectResult.rows[0] as ProjectRow;

        // Get the latest revision for the response
        const latestRevisionResult = await dbAdapter.query(
          `SELECT id, author_name, summary, revision_timestamp
           FROM project_revisions
           WHERE project_slug = $1
           ORDER BY revision_timestamp DESC
           LIMIT 1`,
          [resolvedParams.slug],
          { schema: 'content' }
        );
        const latestRevision = latestRevisionResult.rows[0];

        return NextResponse.json({
          success: true,
          project: {
            metadata: {
              ...updatedProject,
              is_universal_system: Boolean(updatedProject.is_universal_system),
            },
            content: updatedProject.content,
            sections: [],
            last_revision: latestRevision || null,
          },
        });
      } catch (dbError) {
        logger.error('Error updating project content:', dbError);
        return NextResponse.json({ error: 'Failed to update project content' }, { status: 500 });
      }
    } else {
      // Update project metadata directly in database
      try {
        // Check if slug is numeric (ID-based update)
        const isNumericSlug = /^\d+$/.test(resolvedParams.slug);
        const whereClause = isNumericSlug ? 'id = $9' : 'slug = $9';

        await dbAdapter.query(
          `UPDATE projects
           SET title = $1, slug = $2, status = $3, description = $4,
               category = $5, color = $6, display_order = $7,
               is_universal_system = $8, updated_at = NOW()
           WHERE ${whereClause}`,
          [
            body.title,
            body.slug,
            body.status,
            body.description,
            body.category,
            body.color,
            body.display_order || 0,
            body.is_universal_system ? true : false,
            resolvedParams.slug,
          ],
          { schema: 'content' }
        );

        return NextResponse.json({ success: true });
      } catch (dbError) {
        logger.error('Error updating project metadata:', dbError);
        // Check if it's a PostgreSQL error with code property
        if (
          dbError &&
          typeof dbError === 'object' &&
          'code' in dbError &&
          (dbError as PostgresError).code === '23505'
        ) {
          // PostgreSQL unique constraint violation
          return NextResponse.json({ error: 'Project slug must be unique' }, { status: 409 });
        }
        throw dbError;
      }
    }
  } catch (error) {
    logger.error('Error in PUT request:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export const PUT = withSecurity(updateProject, {
  enableCSRF: true,
});
