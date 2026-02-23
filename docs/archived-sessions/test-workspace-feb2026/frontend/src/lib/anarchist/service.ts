/**
 * Anarchist Library Service Layer
 *
 * Handles all database operations and filesystem access for the Anarchist Library
 * Archive (24,643 texts across 27 languages from anarchist library network).
 *
 * MIGRATED: PostgreSQL async queries using dbAdapter
 *
 * Architecture:
 * - Metadata stored in PostgreSQL anarchist schema
 * - Document content stored in Docker volume /app/anarchist-library
 * - YAML frontmatter parsed from markdown files
 */

import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

import type {
  AnarchistDocument,
  AnarchistDocumentWithContent,
  AnarchistSearchParams,
  AnarchistSearchResult,
  AnarchistArchiveStats,
  AnarchistLanguage,
} from './types';

/**
 * PostgreSQL error with error code
 */
interface PostgreSQLError extends Error {
  code?: string;
}

export class AnarchistService {
  /**
   * Base path where anarchist library documents are stored in Docker volume
   * Inside container: /app/anarchist-library
   * On host: /var/lib/docker/volumes/anarchist-library/_data
   */
  private readonly LIBRARY_BASE_PATH =
    process.env.ANARCHIST_LIBRARY_PATH || '/app/anarchist-library';

  /**
   * Filter documents by visibility and user role
   * @param documents - All documents from database
   * @param userRole - Current user's role (admin, moderator, user, anonymous)
   * @returns Filtered documents based on is_public and role
   */
  private filterByVisibility(documents: any[], userRole?: string): any[] {
    return documents.filter(doc => {
      // Admins and moderators see everything
      if (userRole === 'admin' || userRole === 'moderator') {
        return true;
      }

      // is_public defaults to true if not set (backwards compatibility)
      const isPublic =
        doc.is_public === undefined || doc.is_public === null || doc.is_public === true;
      return isPublic;
    });
  }

  /**
   * Parse YAML frontmatter from markdown content
   */
  private parseFrontmatter(content: string): Record<string, any> {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch || !frontmatterMatch[1]) return {};

    const frontmatterText = frontmatterMatch[1];
    const frontmatter: Record<string, any> = {};

    // Simple YAML parser for basic key-value pairs
    frontmatterText.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim();
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, '');
        frontmatter[key.trim()] = cleanValue;
      }
    });

    return frontmatter;
  }

  /**
   * Get document content from filesystem
   */
  private async getDocumentContent(filePath: string): Promise<string | null> {
    try {
      const fullPath = path.join(this.LIBRARY_BASE_PATH, filePath);
      // Security check: ensure path is within library directory
      if (!fullPath.startsWith(this.LIBRARY_BASE_PATH)) {
        logger.warn('Path traversal attempt detected', { filePath });
        return null;
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (error) {
      logger.error('Failed to read document file', { filePath, error });
      return null;
    }
  }

  /**
   * Get all anarchist documents with optional filtering and pagination
   */
  async getDocuments(
    params: AnarchistSearchParams = {},
    userRole?: string
  ): Promise<AnarchistSearchResult> {
    const {
      query,
      language,
      category,
      author,
      tags,
      sort_by = 'title',
      sort_order = 'asc',
      page = 1,
      limit = 100,
      offset: providedOffset,
    } = params;

    try {
      logger.info('AnarchistService.getDocuments called', {
        query: query || '(no query)',
        language: language || '(all)',
        page,
        limit,
        offset: providedOffset,
      });

      // Validate and sanitize input parameters
      const validSortColumns = ['title', 'author', 'publication_date', 'created_at', 'view_count'];
      const safeSortBy = validSortColumns.includes(sort_by) ? sort_by : 'title';
      const safeSortOrder = sort_order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      const safeLimit = Math.max(1, Number(limit) || 100); // No cap - allow unlimited for virtual scrolling
      const safePage = Math.max(1, Number(page) || 1);

      // Use provided offset if available, otherwise calculate from page
      const offset =
        providedOffset !== undefined ? Number(providedOffset) : (safePage - 1) * safeLimit;
      const whereConditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Build WHERE conditions
      if (language) {
        if (Array.isArray(language) && language.length > 0) {
          // Multiple languages: use ANY for array matching, exclude NULL/empty
          whereConditions.push(
            `d.language = ANY($${paramIndex++}) AND d.language IS NOT NULL AND d.language != ''`
          );
          queryParams.push(language);
        } else if (typeof language === 'string') {
          // Single language: exact match, exclude NULL/empty
          whereConditions.push(
            `d.language = $${paramIndex++} AND d.language IS NOT NULL AND d.language != ''`
          );
          queryParams.push(language);
        }
      }

      if (category) {
        whereConditions.push(`d.category = $${paramIndex++}`);
        queryParams.push(category);
      }

      if (author) {
        whereConditions.push(`d.author ILIKE $${paramIndex++}`);
        queryParams.push(`%${author}%`);
      }

      // PostgreSQL full-text search
      if (query) {
        whereConditions.push(`(d.title ILIKE $${paramIndex} OR d.author ILIKE $${paramIndex})`);
        const searchTerm = `%${query}%`;
        queryParams.push(searchTerm);
        paramIndex++;
      }

      // Tag filtering (server-side) - use EXISTS for proper filtering
      if (tags && Array.isArray(tags) && tags.length > 0) {
        // Filter documents that have AT LEAST ONE of the selected tags
        whereConditions.push(`
          EXISTS (
            SELECT 1 FROM anarchist.document_tags dt
            JOIN shared.tags t ON dt.tag_id = t.id
            WHERE dt.document_id = d.id
              AND t.name = ANY($${paramIndex}::text[])
          )
        `);
        queryParams.push(tags);
        paramIndex++;
      }

      const whereClause =
        whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // No tag joins needed - EXISTS handles it
      const tagJoins = '';

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT d.id) as total
        FROM anarchist.documents d
        ${tagJoins}
        ${whereClause}
      `;
      const countResult = await dbAdapter.query(countQuery, queryParams, { schema: 'anarchist' });
      const total = countResult.rows[0]?.total || 0;

      // Get documents
      const documentsQuery = `
        SELECT DISTINCT d.*, d.is_public
        FROM anarchist.documents d
        ${tagJoins}
        ${whereClause}
        ORDER BY d.${safeSortBy} ${safeSortOrder}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      const documentsResult = await dbAdapter.query(
        documentsQuery,
        [...queryParams, safeLimit, offset],
        { schema: 'anarchist' }
      );
      let documents = documentsResult.rows as AnarchistDocument[];

      // Apply role-based visibility filtering
      const documentsBeforeFilter = documents.length;
      documents = this.filterByVisibility(documents, userRole) as AnarchistDocument[];

      // DEBUG: Log visibility filtering results
      logger.info('[Anarchist Service] Visibility filter applied:', {
        userRole: userRole || 'anonymous',
        documentsBeforeFilter,
        documentsAfterFilter: documents.length,
        publicDocuments: documentsResult.rows.filter((d: any) => d.is_public !== false).length,
      });

      // Load tags for documents
      if (documents.length > 0) {
        const documentIds = documents.map(doc => doc.id);
        const tagsQuery = `
          SELECT
            dt.document_id,
            json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name) as tags
          FROM anarchist.document_tags dt
          JOIN shared.tags t ON dt.tag_id = t.id
          WHERE dt.document_id = ANY($1)
          GROUP BY dt.document_id
        `;
        const tagsResult = await dbAdapter.query(tagsQuery, [documentIds], { schema: 'anarchist' });

        // Map tags to documents
        const tagsMap: Record<number, any[]> = {};
        tagsResult.rows.forEach((row: any) => {
          tagsMap[row.document_id] = row.tags || [];
        });

        // Add tags to documents
        documents.forEach(doc => {
          doc.tags = tagsMap[doc.id] || [];
        });
      }

      // Get language statistics
      const languageStatsResult = await dbAdapter.query(
        `
        SELECT DISTINCT language, COUNT(*) as count
        FROM anarchist.documents
        GROUP BY language
        ORDER BY count DESC
      `,
        [],
        { schema: 'anarchist' }
      );
      const languagesAvailable = languageStatsResult.rows.length;

      // Get total unique authors
      const authorsResult = await dbAdapter.query(
        `
        SELECT COUNT(DISTINCT author) as total
        FROM anarchist.documents
        WHERE author IS NOT NULL AND author != ''
      `,
        [],
        { schema: 'anarchist' }
      );
      const totalAuthors = authorsResult.rows[0]?.total || 0;

      const result = {
        documents,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit),
          has_more: safePage < Math.ceil(total / safeLimit),
        },
        stats: {
          total_documents: total,
          languages_available: languagesAvailable,
          total_authors: totalAuthors,
        },
      };

      logger.info('AnarchistService.getDocuments succeeded', {
        documentsReturned: documents.length,
        total,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';

      // Check if this is a PostgreSQL schema error (missing table/schema)
      const pgError = error as PostgreSQLError;
      const isSchemaError =
        pgError.code === '42P01' ||
        errorMessage.includes('does not exist') ||
        errorMessage.includes('relation');

      if (isSchemaError) {
        // This is expected on localhost where anarchist schema doesn't exist
        logger.info('AnarchistService: Anarchist schema not available (localhost mode)', {
          message: errorMessage,
        });
      } else {
        // Unexpected error - log as error
        logger.error('AnarchistService.getDocuments failed', {
          message: errorMessage,
          stack: errorStack,
          params,
          timestamp: new Date().toISOString(),
        });
      }

      // Return empty results instead of throwing
      return {
        documents: [],
        pagination: {
          page: 1,
          limit: 100,
          total: 0,
          totalPages: 0,
          has_more: false,
        },
        stats: {
          total_documents: 0,
          languages_available: 0,
          total_authors: 0,
        },
      };
    }
  }

  /**
   * Get a single document by slug with full content
   */
  async getDocumentBySlug(slug: string): Promise<AnarchistDocumentWithContent | null> {
    try {
      const result = await dbAdapter.query(
        `
        SELECT *
        FROM anarchist.documents
        WHERE slug = $1
      `,
        [slug],
        { schema: 'anarchist' }
      );

      const document = result.rows[0] as AnarchistDocument | undefined;
      if (!document) {
        logger.info('Document not found by slug', { slug });
        return null;
      }

      // Validate file_path exists
      if (!document.file_path) {
        logger.error('Document has empty file_path', {
          slug,
          documentId: document.id,
        });
        // Return document with placeholder content instead of failing completely
        return {
          ...document,
          content: `# ${document.title}\n\n${document.notes || 'Content not available'}`,
          frontmatter: {},
        };
      }

      // Load content from filesystem
      const content = await this.getDocumentContent(document.file_path);
      if (!content) {
        logger.warn('Document content not found on filesystem', {
          slug,
          filePath: document.file_path,
          documentId: document.id,
        });
        // Return document with placeholder content instead of failing completely
        return {
          ...document,
          content: `# ${document.title}\n\n${document.notes || 'Content file not found. Metadata available below.'}\n\n---\n\n**File Path:** ${document.file_path}`,
          frontmatter: {},
        };
      }

      // Parse frontmatter
      const frontmatter = this.parseFrontmatter(content);

      // Load tags for this document
      const tagsQuery = `
        SELECT
          t.id,
          t.name
        FROM anarchist.document_tags dt
        JOIN shared.tags t ON dt.tag_id = t.id
        WHERE dt.document_id = $1
        ORDER BY t.name
      `;
      const tagsResult = await dbAdapter.query(tagsQuery, [document.id], { schema: 'anarchist' });
      const tags = tagsResult.rows;

      return {
        ...document,
        content,
        frontmatter,
        tags,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';

      logger.error('Failed to fetch document by slug', {
        slug,
        message: errorMessage,
        stack: errorStack,
        timestamp: new Date().toISOString(),
      });
      return null;
    }
  }

  /**
   * Get documents by language
   */
  async getDocumentsByLanguage(
    language: string,
    limit: number = 100
  ): Promise<AnarchistDocument[]> {
    const result = await dbAdapter.query(
      `
      SELECT *
      FROM anarchist.documents
      WHERE language = $1
      ORDER BY title
      LIMIT $2
    `,
      [language, limit],
      { schema: 'anarchist' }
    );

    return result.rows as AnarchistDocument[];
  }

  /**
   * Get available languages with document counts
   */
  async getAvailableLanguages(): Promise<AnarchistLanguage[]> {
    const result = await dbAdapter.query(
      `
      SELECT
        language as code,
        COUNT(*) as document_count
      FROM anarchist.documents
      GROUP BY language
      ORDER BY document_count DESC
    `,
      [],
      { schema: 'anarchist' }
    );

    // Map language codes to names
    const languageNames: Record<string, string> = {
      en: 'English',
      de: 'German',
      es: 'Spanish',
      fr: 'French',
      it: 'Italian',
      pt: 'Portuguese',
      pl: 'Polish',
      ru: 'Russian',
      nl: 'Dutch',
      ja: 'Japanese',
      zh: 'Chinese',
      ko: 'Korean',
      tr: 'Turkish',
      gr: 'Greek',
      da: 'Danish',
      sv: 'Swedish',
      fi: 'Finnish',
      ro: 'Romanian',
      hu: 'Hungarian',
      cs: 'Czech',
      sq: 'Albanian',
      eu: 'Basque',
      fa: 'Farsi',
      eo: 'Esperanto',
      sr: 'Serbian',
      mk: 'Macedonian',
    };

    return result.rows.map((row: any) => ({
      code: row.code,
      name: languageNames[row.code] || row.code.toUpperCase(),
      document_count: parseInt(row.document_count, 10),
      documents_indexed: parseInt(row.document_count, 10),
    }));
  }

  /**
   * Get archive statistics
   */
  async getArchiveStats(): Promise<AnarchistArchiveStats> {
    // Total documents
    const totalResult = await dbAdapter.query(
      `SELECT COUNT(*) as total FROM anarchist.documents`,
      [],
      { schema: 'anarchist' }
    );
    const totalDocuments = totalResult.rows[0]?.total || 0;

    // Languages
    const languagesResult = await dbAdapter.query(
      `
      SELECT DISTINCT language
      FROM anarchist.documents
      ORDER BY language
    `,
      [],
      { schema: 'anarchist' }
    );
    const languages = await this.getAvailableLanguages();

    // Authors
    const authorsResult = await dbAdapter.query(
      `
      SELECT COUNT(DISTINCT author) as total
      FROM anarchist.documents
      WHERE author IS NOT NULL AND author != ''
    `,
      [],
      { schema: 'anarchist' }
    );
    const totalAuthors = authorsResult.rows[0]?.total || 0;

    // Date range
    const datesResult = await dbAdapter.query(
      `
      SELECT
        MIN(publication_date) as oldest,
        MAX(publication_date) as newest
      FROM anarchist.documents
      WHERE publication_date IS NOT NULL AND publication_date != ''
    `,
      [],
      { schema: 'anarchist' }
    );
    const oldestDate = datesResult.rows[0]?.oldest;
    const newestDate = datesResult.rows[0]?.newest;

    return {
      total_documents: totalDocuments,
      total_languages: languages.length,
      languages,
      total_authors: totalAuthors,
      oldest_publication: oldestDate || undefined,
      newest_publication: newestDate || undefined,
      last_indexed: new Date().toISOString(),
    };
  }

  /**
   * Increment view count for a document
   */
  async incrementViewCount(documentId: number): Promise<void> {
    try {
      await dbAdapter.query(
        `
        UPDATE anarchist.documents
        SET view_count = view_count + 1, updated_at = NOW()
        WHERE id = $1
      `,
        [documentId],
        { schema: 'anarchist' }
      );
    } catch (error) {
      logger.error('Failed to increment view count', { documentId, error });
    }
  }

  /**
   * Search documents with full-text search
   */
  async search(query: string, limit: number = 100): Promise<AnarchistDocument[]> {
    try {
      const result = await dbAdapter.query(
        `
        SELECT *
        FROM anarchist.documents
        WHERE
          title ILIKE $1 OR
          author ILIKE $1 OR
          notes ILIKE $1
        ORDER BY
          CASE WHEN title ILIKE $1 THEN 1 ELSE 2 END,
          view_count DESC
        LIMIT $2
      `,
        [`%${query}%`, limit],
        { schema: 'anarchist' }
      );

      return result.rows as AnarchistDocument[];
    } catch (error) {
      logger.error('Document search failed', { query, error });
      return [];
    }
  }

  /**
   * Get recently added documents
   */
  async getRecentDocuments(limit: number = 20): Promise<AnarchistDocument[]> {
    const result = await dbAdapter.query(
      `
      SELECT *
      FROM anarchist.documents
      ORDER BY created_at DESC
      LIMIT $1
    `,
      [limit],
      { schema: 'anarchist' }
    );

    return result.rows as AnarchistDocument[];
  }

  /**
   * Get most viewed documents
   */
  async getMostViewedDocuments(limit: number = 20): Promise<AnarchistDocument[]> {
    const result = await dbAdapter.query(
      `
      SELECT *
      FROM anarchist.documents
      ORDER BY view_count DESC
      LIMIT $1
    `,
      [limit],
      { schema: 'anarchist' }
    );

    return result.rows as AnarchistDocument[];
  }

  /**
   * Check if a document exists by slug
   */
  async documentExists(slug: string): Promise<boolean> {
    const result = await dbAdapter.query(
      `
      SELECT EXISTS(SELECT 1 FROM anarchist.documents WHERE slug = $1) as exists
    `,
      [slug],
      { schema: 'anarchist' }
    );

    return result.rows[0]?.exists || false;
  }

  /**
   * Get related documents (same author or language)
   */
  async getRelatedDocuments(documentId: number, limit: number = 5): Promise<AnarchistDocument[]> {
    const sourceDoc = await dbAdapter.query(
      `SELECT author, language FROM anarchist.documents WHERE id = $1`,
      [documentId],
      { schema: 'anarchist' }
    );

    if (sourceDoc.rows.length === 0) {
      return [];
    }

    const doc = sourceDoc.rows[0];
    const result = await dbAdapter.query(
      `
      SELECT *
      FROM anarchist.documents
      WHERE
        id != $1 AND (
          (author = $2 AND author IS NOT NULL) OR
          language = $3
        )
      ORDER BY
        CASE WHEN author = $2 THEN 1 ELSE 2 END,
        title
      LIMIT $4
    `,
      [documentId, doc.author, doc.language, limit],
      { schema: 'anarchist' }
    );

    return result.rows as AnarchistDocument[];
  }

  /**
   * Delete an anarchist document by slug
   */
  async deleteDocument(slug: string): Promise<void> {
    try {
      const result = await dbAdapter.query(
        `
        DELETE FROM anarchist.documents
        WHERE slug = $1
        RETURNING id
      `,
        [slug],
        { schema: 'anarchist' }
      );

      if (result.rows.length === 0) {
        throw new Error(`Document with slug "${slug}" not found`);
      }

      logger.info('Document deleted from anarchist library', {
        slug,
        documentId: result.rows[0]?.id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to delete anarchist document', {
        slug,
        message: errorMessage,
        error,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const anarchistService = new AnarchistService();
