/**
 * Project Versions Service
 *
 * Standalone version system for projects in PostgreSQL content schema
 * Completely independent from wiki.db revision system
 */

import { dbAdapter } from '@/lib/database/adapter';
import { ContentSanitizer } from '@/lib/content/sanitization';

export interface ProjectRevision {
  id: number;
  project_slug: string;
  content: string;
  summary: string;
  author_id: number | null;
  author_name: string;
  revision_timestamp: string;
  size_bytes: number;
  is_minor: number;
  content_format: string;
}

export interface CreateRevisionData {
  project_slug: string;
  content: string;
  summary: string;
  author_id?: number;
  author_name: string;
  is_minor?: boolean;
}

export interface RevisionDiffLine {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  lineNumber: number;
  content?: string;
  oldContent?: string;
  newContent?: string;
}

export class ProjectRevisionsService {
  /**
   * Create a new project revision
   */
  async createRevision(data: CreateRevisionData): Promise<ProjectRevision> {
    // Sanitize content for security
    const sanitizedContent = ContentSanitizer.sanitizeContent(data.content, { level: 'safe' });
    const sizeBytes = Buffer.byteLength(sanitizedContent, 'utf8');

    const result = await dbAdapter.query<ProjectRevision>(
      `
      INSERT INTO project_revisions (
        project_slug, content, summary, author_id, author_name,
        size_bytes, is_minor, revision_timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `,
      [
        data.project_slug,
        sanitizedContent,
        data.summary,
        data.author_id || null,
        data.author_name,
        sizeBytes,
        data.is_minor ? 1 : 0,
      ],
      { schema: 'content' }
    );

    return result.rows[0]!;
  }

  /**
   * Get revisions for a project
   */
  async getRevisions(
    projectSlug: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<ProjectRevision[]> {
    const limit = Math.min(options.limit || 50, 200);
    const offset = options.offset || 0;

    const result = await dbAdapter.query<ProjectRevision>(
      `
      SELECT * FROM project_revisions
      WHERE project_slug = $1
      ORDER BY revision_timestamp DESC
      LIMIT $2 OFFSET $3
    `,
      [projectSlug, limit, offset],
      { schema: 'content' }
    );

    return result.rows;
  }

  /**
   * Get a specific revision by ID
   */
  async getRevisionById(revisionId: number): Promise<ProjectRevision | null> {
    const result = await dbAdapter.query<ProjectRevision>(
      `
      SELECT * FROM project_revisions WHERE id = $1
    `,
      [revisionId],
      { schema: 'content' }
    );

    return result.rows[0] || null;
  }

  /**
   * Get revision count for a project
   */
  async getRevisionCount(projectSlug: string): Promise<number> {
    const result = await dbAdapter.query<{ count: number }>(
      `
      SELECT COUNT(*) as count
      FROM project_revisions
      WHERE project_slug = $1
    `,
      [projectSlug],
      { schema: 'content' }
    );

    return Number(result.rows[0]!.count);
  }

  /**
   * Compare two revisions
   */
  async compareRevisions(
    fromRevisionId: number,
    toRevisionId: number
  ): Promise<{
    from: ProjectRevision;
    to: ProjectRevision;
    diff: RevisionDiffLine[];
  } | null> {
    const fromRevision = await this.getRevisionById(fromRevisionId);
    const toRevision = await this.getRevisionById(toRevisionId);

    if (!fromRevision || !toRevision) {
      return null;
    }

    const diff = this.createDiff(fromRevision.content, toRevision.content);

    return {
      from: fromRevision,
      to: toRevision,
      diff,
    };
  }

  /**
   * Restore a project to a specific revision
   * Creates a new revision with the old content
   */
  async restoreRevision(
    projectSlug: string,
    revisionId: number,
    authorId: number | undefined,
    authorName: string,
    summary?: string
  ): Promise<ProjectRevision> {
    // Get the revision to restore
    const revision = await this.getRevisionById(revisionId);
    if (!revision) {
      throw new Error('Revision not found');
    }

    // Verify it belongs to the correct project
    if (revision.project_slug !== projectSlug) {
      throw new Error('Revision does not belong to this project');
    }

    // Get current project content
    const currentProjectResult = await dbAdapter.query<{ content: string }>(
      `SELECT content FROM projects WHERE slug = $1`,
      [projectSlug],
      { schema: 'content' }
    );

    if (currentProjectResult.rows.length === 0) {
      throw new Error('Project not found');
    }

    const currentProject = currentProjectResult.rows[0]!;

    // Create backup revision of current state (before restore)
    const backupSummary = `Backup before restoring revision #${revisionId}`;
    await this.createRevision({
      project_slug: projectSlug,
      content: currentProject.content,
      summary: backupSummary,
      author_id: authorId,
      author_name: authorName,
      is_minor: false,
    });

    // Create new revision with restored content
    const restoreSummary =
      summary || `Restored to revision #${revisionId}: ${revision.summary || 'No summary'}`;
    return await this.createRevision({
      project_slug: projectSlug,
      content: revision.content,
      summary: restoreSummary,
      author_id: authorId,
      author_name: authorName,
      is_minor: false,
    });
  }

  /**
   * Delete a revision (admin only)
   * Note: Be careful with this - should only be used for cleanup
   */
  async deleteRevision(revisionId: number): Promise<boolean> {
    const result = await dbAdapter.query(
      `
      DELETE FROM project_revisions WHERE id = $1
    `,
      [revisionId],
      { schema: 'content' }
    );

    return result.rowCount > 0;
  }

  /**
   * Search revisions by content, summary, or author
   */
  async searchRevisions(
    projectSlug: string,
    query: {
      searchTerm?: string;
      author?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
    }
  ): Promise<ProjectRevision[]> {
    const conditions: string[] = ['project_slug = $1'];
    const params: any[] = [projectSlug];
    let paramIndex = 2;

    if (query.searchTerm) {
      conditions.push(`(content ILIKE $${paramIndex} OR summary ILIKE $${paramIndex + 1})`);
      const searchPattern = `%${query.searchTerm}%`;
      params.push(searchPattern, searchPattern);
      paramIndex += 2;
    }

    if (query.author) {
      conditions.push(`author_name ILIKE $${paramIndex}`);
      params.push(`%${query.author}%`);
      paramIndex++;
    }

    if (query.dateFrom) {
      conditions.push(`revision_timestamp >= $${paramIndex}`);
      params.push(query.dateFrom);
      paramIndex++;
    }

    if (query.dateTo) {
      conditions.push(`revision_timestamp <= $${paramIndex}`);
      params.push(query.dateTo);
      paramIndex++;
    }

    const limit = Math.min(query.limit || 50, 200);
    params.push(limit);

    const result = await dbAdapter.query<ProjectRevision>(
      `
      SELECT * FROM project_revisions
      WHERE ${conditions.join(' AND ')}
      ORDER BY revision_timestamp DESC
      LIMIT $${paramIndex}
    `,
      params,
      { schema: 'content' }
    );

    return result.rows;
  }

  /**
   * Get revision statistics for a project
   */
  async getRevisionStats(projectSlug: string): Promise<{
    total_revisions: number;
    total_authors: number;
    first_revision: string | null;
    last_revision: string | null;
    avg_size_bytes: number;
    total_size_bytes: number;
  }> {
    const result = await dbAdapter.query<{
      total_revisions: number;
      total_authors: number;
      first_revision: string | null;
      last_revision: string | null;
      avg_size_bytes: number;
      total_size_bytes: number;
    }>(
      `
      SELECT
        COUNT(*) as total_revisions,
        COUNT(DISTINCT author_id) as total_authors,
        MIN(revision_timestamp) as first_revision,
        MAX(revision_timestamp) as last_revision,
        AVG(size_bytes) as avg_size_bytes,
        SUM(size_bytes) as total_size_bytes
      FROM project_revisions
      WHERE project_slug = $1
    `,
      [projectSlug],
      { schema: 'content' }
    );

    const stats = result.rows[0]!;

    return {
      total_revisions: Number(stats.total_revisions) || 0,
      total_authors: Number(stats.total_authors) || 0,
      first_revision: stats.first_revision,
      last_revision: stats.last_revision,
      avg_size_bytes: Math.round(Number(stats.avg_size_bytes) || 0),
      total_size_bytes: Number(stats.total_size_bytes) || 0,
    };
  }

  /**
   * Create a line-by-line diff between two content strings
   */
  private createDiff(oldContent: string, newContent: string): RevisionDiffLine[] {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diff: RevisionDiffLine[] = [];
    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined && newLine !== undefined) {
        // Line added
        diff.push({
          type: 'added',
          lineNumber: i + 1,
          content: newLine,
        });
      } else if (oldLine !== undefined && newLine === undefined) {
        // Line removed
        diff.push({
          type: 'removed',
          lineNumber: i + 1,
          content: oldLine,
        });
      } else if (oldLine !== newLine) {
        // Line modified
        diff.push({
          type: 'modified',
          lineNumber: i + 1,
          oldContent: oldLine,
          newContent: newLine,
        });
      }
      // Skip unchanged lines for diff display (can include them if needed)
    }

    return diff;
  }
}

// Export singleton instance
export const projectRevisionsService = new ProjectRevisionsService();
