/**
 * WikiRevisionService - Specialized service for wiki page revision management
 * Phase 3: God object refactoring - extracted from WikiService
 * Phase 11d: Converted to PostgreSQL
 */

import { dbAdapter } from '@/lib/database/adapter';
import { WikiRevision } from '../types';

export class WikiRevisionService {
  /**
   * Get a specific revision by ID
   */
  async getRevisionById(revisionId: number): Promise<WikiRevision | null> {
    // Note: Using explicit schema qualification (wiki.wiki_revisions, users.users)
    // so NO schema option needed - prevents double-prefixing
    const result = await dbAdapter.query(
      `
      SELECT r.*, u.username as author_name
      FROM wiki.wiki_revisions r
      LEFT JOIN users.users u ON r.author_id = u.id
      WHERE r.id = $1
    `,
      [revisionId]
    );

    return (result.rows[0] as WikiRevision) || null;
  }

  /**
   * Get all revisions for a specific page with pagination
   */
  async getPageRevisions(
    pageId: number,
    options: { limit?: number; offset?: number } = {}
  ): Promise<WikiRevision[]> {
    const { limit = 20, offset = 0 } = options;

    // Note: Using explicit schema qualification (wiki.wiki_revisions, users.users)
    // so NO schema option needed - prevents double-prefixing
    const result = await dbAdapter.query(
      `
      SELECT
        r.*,
        u.username as author_name,
        u.display_name as author_display_name
      FROM wiki.wiki_revisions r
      LEFT JOIN users.users u ON r.author_id = u.id
      WHERE r.page_id = $1
      ORDER BY r.revision_timestamp DESC
      LIMIT $2 OFFSET $3
    `,
      [pageId, limit, offset]
    );

    return result.rows as WikiRevision[];
  }

  /**
   * Get the latest revision for a page
   */
  async getLatestRevision(pageId: number): Promise<WikiRevision | null> {
    // Note: Using explicit schema qualification (wiki.wiki_revisions, users.users)
    // so NO schema option needed - prevents double-prefixing
    const result = await dbAdapter.query(
      `
      SELECT
        r.*,
        u.username as author_name,
        u.display_name as author_display_name
      FROM wiki.wiki_revisions r
      LEFT JOIN users.users u ON r.author_id = u.id
      WHERE r.page_id = $1
      ORDER BY r.revision_timestamp DESC
      LIMIT 1
    `,
      [pageId]
    );

    return (result.rows[0] as WikiRevision) || null;
  }

  /**
   * Create a new revision for a page
   */
  async createRevision(
    pageId: number,
    content: string,
    options: {
      summary?: string;
      content_format?: string;
      author_id?: number;
      author_ip?: string;
      is_minor?: boolean;
    } = {}
  ): Promise<WikiRevision> {
    const {
      summary = 'Page updated',
      content_format = 'markdown',
      author_id,
      author_ip,
      is_minor = false,
    } = options;

    // Validate page exists
    const pageCheck = await dbAdapter.query('SELECT id FROM wiki_pages WHERE id = $1', [pageId], {
      schema: 'wiki',
    });

    if (!pageCheck.rows[0]) {
      throw new Error('Page not found');
    }

    // Validate author if provided
    if (author_id) {
      const userCheck = await dbAdapter.query('SELECT id FROM users WHERE id = $1', [author_id], {
        schema: 'auth',
      });

      if (!userCheck.rows[0]) {
        throw new Error(`User with ID ${author_id} does not exist`);
      }
    }

    const contentBytes = Buffer.from(content, 'utf8').length;

    try {
      const result = await dbAdapter.query(
        `
        INSERT INTO wiki_revisions (
          page_id, content, summary, content_format,
          author_id, author_ip, is_minor, size_bytes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
        [
          pageId,
          content,
          summary,
          content_format,
          author_id || null,
          author_ip || null,
          is_minor,
          contentBytes,
        ],
        { schema: 'wiki' }
      );

      const revisionId = result.rows[0].id;

      // Update the page's updated_at timestamp
      await dbAdapter.query('UPDATE wiki_pages SET updated_at = NOW() WHERE id = $1', [pageId], {
        schema: 'wiki',
      });

      // Return the created revision
      const revision = await this.getRevisionById(revisionId);
      if (!revision) {
        throw new Error('Failed to retrieve created revision');
      }

      return revision;
    } catch (error: any) {
      if (error.code === '23503') {
        // PostgreSQL foreign key violation
        throw new Error(`Foreign key constraint failed: ${error.message}`);
      }
      throw new Error(`Failed to create revision: ${error.message}`);
    }
  }

  /**
   * Delete a revision (with validation to prevent deleting the last revision)
   */
  async deleteRevision(revisionId: number): Promise<void> {
    // Get revision info
    const revision = await this.getRevisionById(revisionId);
    if (!revision) {
      throw new Error('Revision not found');
    }

    // Check if this is the only revision for the page
    const countResult = await dbAdapter.query(
      `
      SELECT COUNT(*) as count FROM wiki_revisions WHERE page_id = $1
    `,
      [revision.page_id],
      { schema: 'wiki' }
    );

    const revisionCount = parseInt(countResult.rows[0].count, 10);

    if (revisionCount <= 1) {
      throw new Error('Cannot delete the last revision of a page');
    }

    // Delete the revision
    const result = await dbAdapter.query('DELETE FROM wiki_revisions WHERE id = $1', [revisionId], {
      schema: 'wiki',
    });

    if (result.rowCount === 0) {
      throw new Error('Revision not found or could not be deleted');
    }
  }

  /**
   * Get revision statistics for a page
   */
  async getRevisionStats(pageId: number): Promise<{
    total_revisions: number;
    total_contributors: number;
    first_revision_date: string;
    latest_revision_date: string;
    total_size_bytes: number;
  }> {
    const result = await dbAdapter.query(
      `
      SELECT
        COUNT(*) as total_revisions,
        COUNT(DISTINCT author_id) as total_contributors,
        MIN(revision_timestamp) as first_revision_date,
        MAX(revision_timestamp) as latest_revision_date,
        SUM(size_bytes) as total_size_bytes
      FROM wiki_revisions
      WHERE page_id = $1
    `,
      [pageId],
      { schema: 'wiki' }
    );

    const stats = result.rows[0];

    return {
      total_revisions: parseInt(stats.total_revisions, 10) || 0,
      total_contributors: parseInt(stats.total_contributors, 10) || 0,
      first_revision_date: stats.first_revision_date || '',
      latest_revision_date: stats.latest_revision_date || '',
      total_size_bytes: parseInt(stats.total_size_bytes, 10) || 0,
    };
  }

  /**
   * Get recent revisions across all pages with optional filtering
   */
  async getRecentRevisions(
    options: {
      limit?: number;
      offset?: number;
      author_id?: number;
      days?: number;
    } = {}
  ): Promise<WikiRevision[]> {
    const { limit = 20, offset = 0, author_id, days } = options;

    // Note: Using explicit schema qualification (wiki.*, users.users)
    // so NO schema option needed - prevents double-prefixing
    let query = `
      SELECT
        r.*,
        u.username as author_name,
        u.display_name as author_display_name,
        p.title as page_title,
        p.slug as page_slug,
        p.namespace as page_namespace
      FROM wiki.wiki_revisions r
      LEFT JOIN users.users u ON r.author_id = u.id
      LEFT JOIN wiki.wiki_pages p ON r.page_id = p.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (author_id) {
      query += ` AND r.author_id = $${paramIndex}`;
      params.push(author_id);
      paramIndex++;
    }

    if (days) {
      query += ` AND r.revision_timestamp > NOW() - INTERVAL '${days} days'`;
    }

    query += ` ORDER BY r.revision_timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await dbAdapter.query(query, params);
    return result.rows as WikiRevision[];
  }

  /**
   * Compare two revisions and return diff information
   */
  async compareRevisions(
    revisionId1: number,
    revisionId2: number
  ): Promise<{
    revision1: WikiRevision;
    revision2: WikiRevision;
    size_diff: number;
    timestamp_diff: number;
  }> {
    const revision1 = await this.getRevisionById(revisionId1);
    const revision2 = await this.getRevisionById(revisionId2);

    if (!revision1 || !revision2) {
      throw new Error('One or both revisions not found');
    }

    if (revision1.page_id !== revision2.page_id) {
      throw new Error('Cannot compare revisions from different pages');
    }

    const size_diff = revision2.size_bytes - revision1.size_bytes;
    const timestamp1 = new Date(revision1.revision_timestamp).getTime();
    const timestamp2 = new Date(revision2.revision_timestamp).getTime();
    const timestamp_diff = Math.abs(timestamp2 - timestamp1);

    return {
      revision1,
      revision2,
      size_diff,
      timestamp_diff,
    };
  }

  /**
   * Get revision history summary for a page (compact format for UI)
   */
  async getRevisionHistory(
    pageId: number,
    limit: number = 10
  ): Promise<
    Array<{
      id: number;
      summary: string;
      author_name: string;
      revision_timestamp: string;
      size_bytes: number;
      is_minor: boolean;
    }>
  > {
    // Note: Using explicit schema qualification (wiki.wiki_revisions, users.users)
    // so NO schema option needed - prevents double-prefixing
    const result = await dbAdapter.query(
      `
      SELECT
        r.id,
        r.summary,
        r.revision_timestamp,
        r.size_bytes,
        r.is_minor,
        COALESCE(u.username, 'Anonymous') as author_name
      FROM wiki.wiki_revisions r
      LEFT JOIN users.users u ON r.author_id = u.id
      WHERE r.page_id = $1
      ORDER BY r.revision_timestamp DESC
      LIMIT $2
    `,
      [pageId, limit]
    );

    return result.rows as Array<{
      id: number;
      summary: string;
      author_name: string;
      revision_timestamp: string;
      size_bytes: number;
      is_minor: boolean;
    }>;
  }

  /**
   * Restore a page to a specific revision
   */
  async restoreToRevision(
    pageId: number,
    revisionId: number,
    authorId?: number,
    summary?: string
  ): Promise<WikiRevision> {
    // Get the target revision
    const targetRevision = await this.getRevisionById(revisionId);
    if (!targetRevision || targetRevision.page_id !== pageId) {
      throw new Error('Target revision not found or belongs to different page');
    }

    // Create a new revision with the old content
    const restoreRevision = await this.createRevision(pageId, targetRevision.content, {
      summary: summary || `Restored to revision ${revisionId}`,
      content_format: targetRevision.content_format,
      author_id: authorId,
      is_minor: false,
    });

    return restoreRevision;
  }
}

// Export singleton instance
export const wikiRevisionService = new WikiRevisionService();
