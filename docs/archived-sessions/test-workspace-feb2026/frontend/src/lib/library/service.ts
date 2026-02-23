/**
 * Library Service Layer
 *
 * Handles all database operations for the library system.
 * The library is COMPLETELY SEPARATE from the wiki system.
 * Supports text-based documents only.
 *
 * MIGRATED: PostgreSQL async queries using dbAdapter
 */

import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';
import { libraryFileService } from './file-service';
import type {
  LibraryDocument,
  LibraryDocumentWithMetadata,
  LibraryDocumentCreateInput,
  LibraryDocumentUpdateInput,
  LibrarySearchParams,
  LibrarySearchResult,
  LibraryTag,
  LibraryTagGroup,
  LibraryDocumentDisplay,
} from './types';

export class LibraryService {
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
   * Calculate word count from content
   */
  private calculateWordCount(content: string | null): number {
    if (!content) return 0;
    // Remove markdown syntax and count words
    const plainText = content
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]*`/g, '') // Remove inline code
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/[*_~]/g, '') // Remove emphasis markers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Extract link text
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();

    if (!plainText) return 0;
    return plainText.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Get user information by ID from users schema
   */
  private async getUserById(
    userId: number
  ): Promise<{ username: string; display_name: string | null } | null> {
    try {
      const result = await dbAdapter.query(
        'SELECT username, display_name FROM users WHERE id = $1',
        [userId],
        { schema: 'users' }
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('Failed to fetch user data from users schema', { userId, error });
      return null;
    }
  }

  /**
   * Get all library documents with metadata
   */
  async getDocuments(
    params: LibrarySearchParams = {},
    userRole?: string
  ): Promise<LibrarySearchResult> {
    const {
      query,
      language,
      tags,
      author,
      document_type,
      reconversion_status,
      // status column deleted in schema migration - all docs are published by default
      sort_by = 'title',
      sort_order = 'asc',
      page = 1,
      limit = 100,
      offset: providedOffset,
    } = params;

    // Validate and sanitize input parameters to prevent SQL injection
    const validSortColumns = [
      'title',
      'author',
      'publication_date',
      'created_at',
      'updated_at',
      'view_count',
    ];
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
    // Note: status column removed - all documents are published by default

    // PostgreSQL full-text search
    if (query) {
      // Search in title, author, description, and content
      whereConditions.push(
        `(d.title ILIKE $${paramIndex} OR d.author ILIKE $${paramIndex} OR d.description ILIKE $${paramIndex} OR d.content ILIKE $${paramIndex})`
      );
      const searchTerm = `%${query}%`;
      queryParams.push(searchTerm);
      paramIndex++;
    }

    if (author) {
      whereConditions.push(`d.author ILIKE $${paramIndex++}`);
      queryParams.push(`%${author}%`);
    }

    if (document_type) {
      whereConditions.push(`d.document_type = $${paramIndex++}`);
      queryParams.push(document_type);
    }

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

    // Tag filtering (server-side)
    if (tags && Array.isArray(tags) && tags.length > 0) {
      // Filter documents that have ANY of the selected tags
      whereConditions.push(`t.name = ANY($${paramIndex++})`);
      queryParams.push(tags);
    }

    // Reconversion status filtering
    if (reconversion_status && reconversion_status !== 'all') {
      whereConditions.push(`d.reconversion_status = $${paramIndex++}`);
      queryParams.push(reconversion_status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Determine if we need to join tags table
    const needsTagJoin = tags && Array.isArray(tags) && tags.length > 0;
    const tagJoins = needsTagJoin
      ? `LEFT JOIN library_document_tags ldt ON d.id = ldt.document_id
         LEFT JOIN shared.tags t ON ldt.tag_id = t.id`
      : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT d.id) as total
      FROM library_documents d
      ${tagJoins}
      ${whereClause}
    `;
    const countResult = await dbAdapter.query(countQuery, queryParams, { schema: 'library' });
    const total = countResult.rows[0]?.total || 0;

    // Build ORDER BY clause
    const orderByClause = `d.${safeSortBy} ${safeSortOrder}`;

    // Get documents with metadata
    const documentsQuery = `
      SELECT
        d.*,
        LEFT(d.content, 500) as content_preview,
        d.is_public
      FROM library_documents d
      ${tagJoins}
      ${whereClause}
      ${tagJoins ? 'GROUP BY d.id' : ''}
      ORDER BY ${orderByClause}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const documentsResult = await dbAdapter.query(
      documentsQuery,
      [...queryParams, safeLimit, offset],
      { schema: 'library' }
    );
    let documents = documentsResult.rows;

    // Apply role-based visibility filtering
    documents = this.filterByVisibility(documents, userRole);

    // Get tags for each document
    const documentIds = documents.map(d => d.id);
    const tagsMap = new Map<number, any[]>();

    if (documentIds.length > 0) {
      // Build IN clause with individual placeholders for proper PostgreSQL parameter binding
      const placeholders = documentIds.map((_, i) => `$${i + 1}`).join(',');
      const tagsQuery = `
        SELECT
          dt.document_id,
          t.id,
          t.name
        FROM library_document_tags dt
        JOIN shared.tags t ON dt.tag_id = t.id
        WHERE dt.document_id IN (${placeholders})
      `;
      const tagsResult = await dbAdapter.query(tagsQuery, documentIds, { schema: 'library' });
      const allTags = tagsResult.rows;

      for (const tag of allTags) {
        // Normalize document_id to number for consistent Map key type
        const docId =
          typeof tag.document_id === 'string' ? parseInt(tag.document_id, 10) : tag.document_id;
        if (!tagsMap.has(docId)) {
          tagsMap.set(docId, []);
        }
        tagsMap.get(docId)!.push({
          id: tag.id,
          name: tag.name,
          type: tag.type || 'general',
        });
      }
    }

    // Transform to display format
    const transformedDocuments: LibraryDocumentWithMetadata[] = documents.map(doc => {
      // Normalize doc.id to number for consistent Map key lookup
      const docId = typeof doc.id === 'string' ? parseInt(doc.id, 10) : doc.id;

      return {
        ...doc,
        tags: tagsMap.get(docId) || [],
        is_public: doc.is_public !== undefined ? Boolean(doc.is_public) : true,
      };
    });

    // Get aggregated stats
    const statsResult = await dbAdapter.query(
      `
      SELECT
        COUNT(DISTINCT d.id) as total_documents,
        COUNT(DISTINCT d.created_by) as contributors
      FROM library_documents d
    `,
      [],
      { schema: 'library' }
    );
    const stats = statsResult.rows[0] || {
      total_documents: 0,
      contributors: 0,
    };

    return {
      documents: transformedDocuments,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
        has_more: safePage < Math.ceil(total / safeLimit),
      },
      stats,
    };
  }

  /**
   * Get a single document by slug
   */
  async getDocumentBySlug(slug: string): Promise<LibraryDocumentWithMetadata | null> {
    // Query library schema
    const query = `
      SELECT d.*
      FROM library_documents d
      WHERE d.slug = $1
    `;

    const result = await dbAdapter.query(query, [slug], { schema: 'library' });
    const document = result.rows[0];

    if (!document) {
      return null;
    }

    // DUAL-READ LOGIC: Migration completed Nov 21, 2025 (100% file-based)
    // Database fallback kept for safety in case of file system issues
    let content = '';

    // Try file-based storage first (primary system - all 3,859 docs migrated)
    if (document.file_path) {
      try {
        const fileContent = await libraryFileService.getDocumentContent(document.file_path);
        if (fileContent) {
          const { frontmatter, contentWithoutFrontmatter } =
            libraryFileService.parseFrontmatter(fileContent);
          content = contentWithoutFrontmatter;

          // Optional: Validate frontmatter matches database metadata
          if (frontmatter.title && frontmatter.title !== document.title) {
            logger.warn('Frontmatter title mismatch', {
              dbTitle: document.title,
              fileTitle: frontmatter.title,
              slug,
            });
          }
        } else {
          logger.warn('Failed to load content from file, falling back to database', {
            slug,
            file_path: document.file_path,
          });
        }
      } catch (error) {
        logger.error('Error reading document file', { slug, file_path: document.file_path, error });
      }
    }

    // Fallback to database content (old system)
    if (!content && document.content) {
      content = document.content;
      logger.debug('Using database content (file not available)', { slug });
    }

    // If still no content, provide error message
    if (!content) {
      content = `# ${document.title}\n\n*Content file not found or not yet migrated.*`;
      logger.error('Document has no content available', {
        slug,
        has_file_path: !!document.file_path,
        has_db_content: !!document.content,
      });
    }

    // Get user information from users schema if created_by is set
    let created_by_username = null;
    let created_by_display_name = null;
    if (document.created_by) {
      const user = await this.getUserById(document.created_by);
      if (user) {
        created_by_username = user.username;
        created_by_display_name = user.display_name;
      }
    }

    // Get tags
    // Note: Using explicit schema qualification (library.library_document_tags, shared.tags)
    // so NO schema option needed - prevents double-prefixing
    const tagsQuery = `
      SELECT
        t.id,
        t.name
      FROM library.library_document_tags dt
      JOIN shared.tags t ON dt.tag_id = t.id
      WHERE dt.document_id = $1
    `;
    const tagsResult = await dbAdapter.query(tagsQuery, [document.id]);
    const tags = tagsResult.rows;

    return {
      ...document,
      content, // Now from file OR database (dual-read)
      created_by_username,
      created_by_display_name,
      tags: tags.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type || 'general',
      })),
    };
  }

  /**
   * Create a new library document (text-only)
   */
  async createDocument(
    input: LibraryDocumentCreateInput,
    userId: number
  ): Promise<{ id: number; slug: string }> {
    logger.info('Starting document creation', { title: input.title });

    // Generate safe slug from title
    let slug = input.title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '');

    // If title becomes empty after sanitization, use a timestamp-based name
    if (!slug) {
      slug = `document-${Date.now()}`;
    }

    logger.debug('Generated slug', { slug });

    // Generate file path for new document
    const filePath = libraryFileService.generateFilePath(slug);
    logger.debug('Generated file path', { filePath });

    // Prepare metadata for frontmatter
    const now = new Date();
    const metadata = {
      id: 0, // Will be updated after DB insert
      slug,
      title: input.title,
      author: input.author || null,
      publication_date: input.publication_date || null,
      document_type: input.document_type || 'document',
      // status, description, abstract columns removed in schema migration
      notes: input.description || null, // description → notes mapping
      language: 'en', // Default language
      created_by: userId,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      view_count: 0,
      word_count: libraryFileService.calculateWordCount(input.content || ''),
      reading_time_minutes: libraryFileService.calculateReadingTime(
        libraryFileService.calculateWordCount(input.content || '')
      ),
    };

    // Write content to file BEFORE database insert
    const writeSuccess = await libraryFileService.writeDocumentContent(
      filePath,
      input.content || '',
      metadata
    );

    if (!writeSuccess) {
      logger.error('Failed to write document file', { slug, filePath });
      throw new Error('Failed to write document file - check disk space and permissions');
    }

    logger.debug('Document file written successfully', { filePath });

    // Begin transaction
    const result = await dbAdapter.transaction(
      async adapter => {
        try {
          logger.debug('Document creation transaction started');

          // Insert document (with file_path, NOT content)
          // Note: status, description, abstract, search_text columns removed in schema migration
          const docResult = await adapter.query(
            `INSERT INTO library_documents (
            slug, title, author, publication_date, document_type,
            notes, file_path, created_by,
            created_at, updated_at, view_count
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), $9)
          RETURNING id`,
            [
              slug,
              input.title,
              input.author || null,
              input.publication_date || null,
              input.document_type || 'document',
              input.description || null, // description → notes
              filePath, // Store file path instead of content
              userId,
              0, // view_count
            ],
            { schema: 'library', returnLastId: true }
          );

          const documentId = docResult.rows[0]?.id;
          logger.info('Document inserted', { documentId });

          // Add tags if specified
          if (input.tags && input.tags.length > 0) {
            logger.debug('Processing tags', { tagCount: input.tags.length });

            for (const tagName of input.tags) {
              logger.debug('Processing tag', { tagName });

              // Insert tag (ignore if exists)
              await adapter.query(
                `INSERT INTO shared.tags (name, created_at)
               VALUES ($1, NOW())
               ON CONFLICT (name) DO NOTHING`,
                [tagName],
                { schema: 'shared' }
              );

              // Get tag ID
              const tagResult = await adapter.query(
                'SELECT id FROM shared.tags WHERE name = $1',
                [tagName],
                { schema: 'shared' }
              );
              const tag = tagResult.rows[0];

              if (tag) {
                // Insert document-tag relationship
                await adapter.query(
                  `INSERT INTO library_document_tags (document_id, tag_id, added_by, added_at)
                 VALUES ($1, $2, $3, NOW())`,
                  [documentId, tag.id, userId],
                  { schema: 'library' }
                );

                // Update tag usage count
                await adapter.query(
                  `UPDATE shared.tags
                 SET usage_count = COALESCE(usage_count, 0) + 1
                 WHERE id = $1`,
                  [tag.id],
                  { schema: 'shared' }
                );

                logger.debug('Tag processed', { tagName, tagId: tag.id });
              }
            }
            logger.debug('All tags processed');
          }

          logger.info('Document creation completed successfully');
          return { id: documentId, slug };
        } catch (error) {
          logger.error('Document creation transaction failed', error);
          throw error;
        }
      },
      { schema: 'library' }
    );

    return result;
  }

  /**
   * Update a library document
   */
  async updateDocument(id: number, input: LibraryDocumentUpdateInput): Promise<boolean> {
    // Use transaction to handle both document and tag updates
    const result = await dbAdapter.transaction(
      async adapter => {
        // If content is being updated, update the file
        if (input.content !== undefined) {
          // Get current document metadata (need file_path)
          const docResult = await adapter.query(
            'SELECT slug, file_path, title, author FROM library_documents WHERE id = $1',
            [id],
            { schema: 'library' }
          );
          const document = docResult.rows[0];

          if (!document) {
            throw new Error(`Document with ID ${id} not found`);
          }

          // If no file_path exists yet, this is a legacy document - generate one
          let filePath = document.file_path;
          if (!filePath) {
            filePath = libraryFileService.generateFilePath(document.slug);
            logger.info('Generated file path for legacy document', {
              id,
              slug: document.slug,
              filePath,
            });
          }

          // Prepare updated metadata for frontmatter
          const now = new Date();
          const metadata = {
            id,
            slug: document.slug,
            title: input.title ?? document.title,
            author: input.author !== undefined ? input.author : document.author,
            publication_date: input.publication_date,
            document_type: input.document_type,
            // status, description, abstract columns removed in schema migration
            notes: input.description, // description → notes
            language: 'en',
            updated_at: now.toISOString(),
            word_count: libraryFileService.calculateWordCount(input.content),
            reading_time_minutes: libraryFileService.calculateReadingTime(
              libraryFileService.calculateWordCount(input.content)
            ),
          };

          // Write updated content to file
          const writeSuccess = await libraryFileService.writeDocumentContent(
            filePath,
            input.content,
            metadata
          );

          if (!writeSuccess) {
            logger.error('Failed to update document file', { id, filePath });
            throw new Error('Failed to update document file');
          }

          logger.debug('Document file updated successfully', { id, filePath });
        }

        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (input.title !== undefined) {
          updates.push(`title = $${paramIndex++}`);
          params.push(input.title);
        }

        if (input.author !== undefined) {
          updates.push(`author = $${paramIndex++}`);
          params.push(input.author);
        }

        if (input.publication_date !== undefined) {
          updates.push(`publication_date = $${paramIndex++}`);
          params.push(input.publication_date);
        }

        if (input.document_type !== undefined) {
          updates.push(`document_type = $${paramIndex++}`);
          params.push(input.document_type);
        }

        // description → notes mapping
        if (input.description !== undefined) {
          updates.push(`notes = $${paramIndex++}`);
          params.push(input.description);
        }

        // NOTE: status, abstract, search_text columns removed in schema migration
        // NOTE: We no longer update content column - it's stored in files

        updates.push(`updated_at = NOW()`);

        // Update document metadata
        if (updates.length > 1) {
          params.push(id);
          const updateQuery = `
          UPDATE library_documents
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex}
        `;
          await adapter.query(updateQuery, params, { schema: 'library' });
        }

        // Handle tags if provided
        if (input.tags !== undefined) {
          // Remove all existing document tags
          await adapter.query('DELETE FROM library_document_tags WHERE document_id = $1', [id], {
            schema: 'library',
          });

          // Add new tags
          if (input.tags.length > 0) {
            for (const tagName of input.tags) {
              // Insert tag (ignore if exists)
              await adapter.query(
                `INSERT INTO shared.tags (name, created_at)
               VALUES ($1, NOW())
               ON CONFLICT (name) DO NOTHING`,
                [tagName],
                { schema: 'shared' }
              );

              // Get tag ID
              const tagResult = await adapter.query(
                'SELECT id FROM shared.tags WHERE name = $1',
                [tagName],
                { schema: 'shared' }
              );
              const tag = tagResult.rows[0];

              if (tag) {
                await adapter.query(
                  `INSERT INTO library_document_tags (document_id, tag_id, added_by, added_at)
                 VALUES ($1, $2, $3, NOW())`,
                  [id, tag.id, input.authorId || null],
                  { schema: 'library' }
                );
              }
            }
          }

          // Update usage counts for all tags
          await adapter.query(
            `UPDATE shared.tags
           SET usage_count = (
             SELECT COUNT(*) FROM library.library_document_tags
             WHERE tag_id = shared.tags.id
           )`,
            [],
            { schema: 'shared' }
          );
        }

        return true;
      },
      { schema: 'library' }
    );

    return result;
  }

  /**
   * Get all library tags (simple flat array)
   */
  async getAllTags(): Promise<Array<{ id: number; name: string; color?: string }>> {
    const result = await dbAdapter.query(
      `SELECT
        t.id,
        t.name
      FROM shared.tags t
      WHERE id IN (
        SELECT DISTINCT tag_id FROM library.library_document_tags
      )
      ORDER BY t.usage_count DESC, t.name`,
      [],
      { schema: 'shared' }
    );

    return result.rows.map(t => ({
      id: t.id,
      name: t.name,
    }));
  }

  /**
   * Increment view count for a document
   */
  async incrementViewCount(documentId: number): Promise<void> {
    await dbAdapter.query(
      `UPDATE library_documents
       SET view_count = view_count + 1
       WHERE id = $1`,
      [documentId],
      { schema: 'library' }
    );
  }

  /**
   * Delete a library document by ID
   * Only the author or an admin can delete documents
   */
  async deleteDocument(
    id: number,
    userId: number,
    userRole: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // First check if the document exists and get its author
      const docResult = await dbAdapter.query(
        `SELECT id, created_by, title FROM library_documents WHERE id = $1`,
        [id],
        { schema: 'library' }
      );
      const document = docResult.rows[0];

      if (!document) {
        return { success: false, message: 'Document not found' };
      }

      // Check permissions: only the author or admin can delete
      if (document.created_by !== userId && userRole !== 'admin') {
        return {
          success: false,
          message:
            'You do not have permission to delete this document. Only the author or an admin can delete documents.',
        };
      }

      // Begin transaction for safe deletion
      await dbAdapter.transaction(
        async adapter => {
          // Delete document tags
          await adapter.query('DELETE FROM library_document_tags WHERE document_id = $1', [id], {
            schema: 'library',
          });

          // Delete the main document
          const deleteResult = await adapter.query(
            'DELETE FROM library_documents WHERE id = $1',
            [id],
            { schema: 'library' }
          );

          if (deleteResult.rowCount === 0) {
            throw new Error('Failed to delete document');
          }
        },
        { schema: 'library' }
      );

      logger.info(`Library document deleted: ID ${id} (${document.title}) by user ${userId}`);

      return {
        success: true,
        message: `Document "${document.title}" has been successfully deleted.`,
      };
    } catch (error) {
      logger.error('Error deleting library document:', error);
      return {
        success: false,
        message: `Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// Export singleton instance
export const libraryService = new LibraryService();
