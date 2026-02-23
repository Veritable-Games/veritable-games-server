/**
 * WikiPageService - Specialized service for wiki page CRUD operations
 * Phase 3: God object refactoring - extracted from WikiService
 * MIGRATED: PostgreSQL async queries
 */

import { dbAdapter } from '@/lib/database/adapter';
import { cacheManager } from '@/lib/cache/manager';
import { wikiAutoCategorizer } from '../auto-categorization';
import { userLookupService } from '@/lib/users/user-lookup-service';
import { generateSlug } from '@/lib/utils/slug';
import { WikiPage, CreateWikiPageData, UpdateWikiPageData } from '../types';
import { logger } from '@/lib/utils/logger';

export class WikiPageService {
  /**
   * Create a new wiki page with validation and auto-categorization
   */
  async createPage(
    data: CreateWikiPageData,
    authorId?: number,
    authorIp?: string
  ): Promise<WikiPage> {
    // Pre-flight validation using centralized user lookup
    if (authorId) {
      const userExists = await userLookupService.userExists(authorId);
      if (!userExists) {
        throw new Error(`User with ID ${authorId} does not exist`);
      }
    }

    // Validate category if provided (single category only)
    const categoryId =
      data.categories && data.categories.length > 0 ? data.categories[0] : 'uncategorized';
    if (categoryId !== 'uncategorized') {
      const existingCategoriesResult = await dbAdapter.query('SELECT id FROM wiki_categories', [], {
        schema: 'wiki',
      });
      const existingCategories = existingCategoriesResult.rows.map((row: any) => row.id);
      if (!existingCategories.includes(categoryId)) {
        throw new Error(
          `Category '${categoryId}' does not exist. Available categories: ${existingCategories.join(', ')}`
        );
      }
    }

    // CRITICAL: Auto-assign namespace for special categories
    // Journals category requires namespace='journals' to appear in the Journals UI
    let namespace = data.namespace || 'main';
    if (categoryId === 'journals') {
      namespace = 'journals';
    }

    try {
      const pageId = await dbAdapter.transaction(
        async adapter => {
          // Create the page with single category
          const pageResult = await adapter.query(
            `INSERT INTO wiki_pages (slug, title, namespace, status, created_by, category_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
            [
              data.slug,
              data.title,
              namespace,
              data.status || 'published',
              authorId || null,
              categoryId,
            ],
            { schema: 'wiki', returnLastId: true }
          );

          const newPageId = pageResult.rows[0]?.id as number;

          // Create the initial revision
          const contentBytes = Buffer.from(data.content, 'utf8').length;

          await adapter.query(
            `INSERT INTO wiki_revisions (page_id, content, summary, content_format, author_id, author_ip, is_minor, size_bytes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              newPageId,
              data.content,
              data.summary || 'Initial page creation',
              data.content_format || 'markdown',
              authorId || null,
              authorIp || null,
              data.is_minor ? true : false,
              contentBytes,
            ],
            { schema: 'wiki' }
          );

          // CRITICAL: Also populate the junction table with the category
          // This prevents auto-categorizer from overwriting the user's choice
          await adapter.query(
            `INSERT INTO wiki_page_categories (page_id, category_id, added_at)
           VALUES ($1, $2, NOW())`,
            [newPageId, categoryId],
            { schema: 'wiki' }
          );

          return newPageId;
        },
        { schema: 'wiki' }
      );

      // Auto-categorize if no categories were provided
      if (!data.categories || data.categories.length === 0) {
        try {
          await wikiAutoCategorizer.autoCategorizePage(pageId);
        } catch (autoCatError) {
          logger.warn('Auto-categorization failed for new page', { pageId, error: autoCatError });
        }
      }

      // Invalidate all search caches (new page affects search results)
      await cacheManager.invalidateCategory('search');
      // Invalidate content cache (new page affects category counts)
      await cacheManager.invalidateCategory('content');

      return this.getPageById(pageId);
    } catch (error: any) {
      // PostgreSQL error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
      const pgError = error as { code?: string; constraint?: string; detail?: string };

      // Check PostgreSQL error code for specific constraint violations
      if (pgError.code === '23505') {
        // 23505 = unique_violation
        if (pgError.constraint === 'wiki_pages_pkey') {
          // PRIMARY KEY violation - this is a database sequence issue
          throw new Error(
            `Database sequence error: Unable to generate unique page ID. ` +
              `This may indicate a corrupted sequence. Please contact support.`
          );
        } else if (
          pgError.constraint?.includes('slug') ||
          pgError.detail?.toLowerCase().includes('slug')
        ) {
          // Slug uniqueness violation
          throw new Error(`UNIQUE constraint failed: A page with this slug already exists`);
        } else {
          // Other unique constraint violation
          throw new Error(
            `Unique constraint violation: ${pgError.constraint || 'unknown'} - ${pgError.detail || error.message}`
          );
        }
      } else if (pgError.code === '23503' || error.message?.includes('foreign key')) {
        // 23503 = foreign_key_violation
        throw new Error(`FOREIGN KEY constraint failed: ${error.message}`);
      } else {
        throw new Error(`Database error during page creation: ${error.message}`);
      }
    }
  }

  /**
   * Update an existing wiki page
   */
  async updatePage(
    pageId: number,
    data: UpdateWikiPageData,
    authorId?: number,
    authorIp?: string
  ): Promise<WikiPage> {
    // Get current page data before transaction
    const currentPage = await this.getPageById(pageId);
    if (!currentPage) {
      throw new Error('Page not found');
    }

    // Track title changes for automatic link updates
    const titleChanged = data.title !== undefined && data.title !== currentPage.title;
    const oldTitle = currentPage.title;
    const oldSlug = currentPage.slug;

    // Track category changes for cache invalidation
    const oldCategoryId = currentPage.category_ids?.[0];
    const categoryChanged =
      data.categories !== undefined &&
      data.categories.length > 0 &&
      data.categories[0] !== oldCategoryId;

    await dbAdapter.transaction(
      async adapter => {
        // Auto-regenerate slug when title changes
        if (titleChanged && data.title) {
          const newSlug = generateSlug(data.title);

          // Check for slug conflicts in the same namespace (UNIQUE constraint)
          const conflictResult = await adapter.query(
            `SELECT id FROM wiki_pages
           WHERE slug = $1 AND namespace = $2 AND id != $3`,
            [newSlug, currentPage.namespace, pageId],
            { schema: 'wiki' }
          );

          if (conflictResult.rows.length > 0) {
            throw new Error(
              `A page with the slug "${newSlug}" already exists in the "${currentPage.namespace}" namespace. ` +
                `Please choose a different title to avoid conflicts.`
            );
          }
        }

        // Update page metadata if provided
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.title !== undefined) {
          updates.push(`title = $${paramIndex++}`);
          values.push(data.title);

          // Also update slug when title changes
          if (titleChanged) {
            const newSlug = generateSlug(data.title);
            updates.push(`slug = $${paramIndex++}`);
            values.push(newSlug);
          }
        }
        if (data.status !== undefined) {
          updates.push(`status = $${paramIndex++}`);
          values.push(data.status);
        }
        if (data.protection_level !== undefined) {
          updates.push(`protection_level = $${paramIndex++}`);
          values.push(data.protection_level);
        }
        if (data.document_author !== undefined) {
          updates.push(`document_author = $${paramIndex++}`);
          values.push(data.document_author);
        }
        if (data.publication_date !== undefined) {
          updates.push(`publication_date = $${paramIndex++}`);
          values.push(data.publication_date);
        }

        if (updates.length > 0) {
          updates.push(`updated_at = NOW()`);
          values.push(pageId);

          const updateResult = await adapter.query(
            `UPDATE wiki_pages SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
            values,
            { schema: 'wiki' }
          );

          if (updateResult.rowCount === 0) {
            throw new Error('Failed to update page: no rows affected');
          }
        }

        // Create new revision if content is provided
        if (data.content !== undefined) {
          const contentBytes = Buffer.from(data.content, 'utf8').length;

          await adapter.query(
            `INSERT INTO wiki_revisions (page_id, content, summary, content_format, author_id, author_ip, is_minor, size_bytes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              pageId,
              data.content,
              data.summary || 'Page updated',
              data.content_format || 'markdown',
              authorId || null,
              authorIp || null,
              data.is_minor ? true : false,
              contentBytes,
            ],
            { schema: 'wiki' }
          );
        }

        // Update category if provided (single category only)
        if (data.categories !== undefined) {
          const newCategoryId = data.categories.length > 0 ? data.categories[0] : 'uncategorized';

          // Validate that the category exists
          let finalCategoryId = newCategoryId;
          if (newCategoryId !== 'uncategorized') {
            const categoryResult = await adapter.query(
              `SELECT id FROM wiki_categories WHERE name = $1 OR id = $2`,
              [newCategoryId, newCategoryId],
              { schema: 'wiki' }
            );

            if (categoryResult.rows.length === 0) {
              throw new Error(`Category not found: ${newCategoryId}`);
            } else {
              finalCategoryId = categoryResult.rows[0].id;
            }
          }

          // CRITICAL: Auto-update namespace when switching to/from journals category
          // Journals category requires namespace='journals' to appear in the Journals UI
          let namespaceUpdate = '';
          if (finalCategoryId === 'journals') {
            namespaceUpdate = `, namespace = 'journals'`;
          } else if (oldCategoryId === 'journals' && finalCategoryId !== 'journals') {
            // Moving away from journals - reset to 'main' namespace
            namespaceUpdate = `, namespace = 'main'`;
          }

          // Update both the direct category_id column and the junction table
          await adapter.query(
            `UPDATE wiki_pages SET category_id = $1${namespaceUpdate} WHERE id = $2`,
            [finalCategoryId, pageId],
            { schema: 'wiki' }
          );

          // Sync junction table - remove ALL existing entries and add the single new one
          await adapter.query(`DELETE FROM wiki_page_categories WHERE page_id = $1`, [pageId], {
            schema: 'wiki',
          });

          // Insert new category relationship
          await adapter.query(
            `INSERT INTO wiki_page_categories (page_id, category_id, added_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT DO NOTHING`,
            [pageId, finalCategoryId],
            { schema: 'wiki' }
          );
        }
      },
      { schema: 'wiki' }
    );

    // Auto-update wikilinks if title changed
    if (titleChanged && data.title) {
      const newSlug = generateSlug(data.title);
      await this.updatePageReferences(
        pageId,
        oldTitle,
        data.title,
        oldSlug,
        newSlug,
        currentPage.namespace,
        authorId,
        authorIp
      );
    }

    // Get updated page for cache operations
    const updatedPage = await this.getPageById(pageId);

    // Aggressive cache invalidation when category changes
    if (categoryChanged && oldCategoryId) {
      const newCategoryId = data.categories![0] || 'uncategorized';

      // 1. Invalidate the page cache (current slug)
      const currentCacheKey = `page:${currentPage.namespace}:${currentPage.slug}`;
      await cacheManager.delete({ category: 'content', identifier: currentCacheKey });

      // 2. If slug also changed, invalidate the new slug cache
      if (titleChanged && data.title) {
        const newSlug = generateSlug(data.title);
        const newCacheKey = `page:${currentPage.namespace}:${newSlug}`;
        await cacheManager.delete({ category: 'content', identifier: newCacheKey });
      }

      // 3. Invalidate entire content category cache (nuclear option for category changes)
      await cacheManager.invalidateCategory('content');

      // 4. Invalidate search caches (category is indexed)
      await cacheManager.invalidateCategory('search');
    } else {
      // Normal cache invalidation (no category change)
      if (updatedPage) {
        const cacheKey = `page:${updatedPage.namespace}:${updatedPage.slug}`;
        await cacheManager.delete({ category: 'content', identifier: cacheKey });
      }

      // Invalidate search caches if content/title changed
      if (data.content || titleChanged) {
        await cacheManager.invalidateCategory('search');
      }
    }

    return updatedPage;
  }

  /**
   * Delete a wiki page and clean up related data
   */
  async deletePage(pageId: number, authorId?: number): Promise<void> {
    // Get page info before deletion for logging and library handling
    const pageInfoResult = await dbAdapter.query(
      `SELECT title, slug, namespace FROM wiki_pages WHERE id = $1`,
      [pageId],
      { schema: 'wiki' }
    );

    if (pageInfoResult.rows.length === 0) {
      throw new Error('Page not found');
    }

    const pageInfo = pageInfoResult.rows[0];

    await dbAdapter.transaction(
      async adapter => {
        // If this is a library page, also delete from library_documents
        if (pageInfo.namespace === 'library' && pageInfo.slug.startsWith('library/')) {
          const filename = pageInfo.slug.replace('library/', '');
          const libraryDocResult = await adapter.query(
            `SELECT id FROM library_documents WHERE filename = $1`,
            [filename],
            { schema: 'content' } // Library documents are in content schema
          );

          if (libraryDocResult.rows.length > 0) {
            await adapter.query(
              `DELETE FROM library_documents WHERE id = $1`,
              [libraryDocResult.rows[0].id],
              { schema: 'content' }
            );
          }
        }

        // Delete related records that might not have cascading deletes
        await adapter.query(`DELETE FROM wiki_page_tags WHERE page_id = $1`, [pageId], {
          schema: 'wiki',
        });
        await adapter.query(`DELETE FROM wiki_page_categories WHERE page_id = $1`, [pageId], {
          schema: 'wiki',
        });
        await adapter.query(`DELETE FROM wiki_revisions WHERE page_id = $1`, [pageId], {
          schema: 'wiki',
        });
        await adapter.query(`DELETE FROM wiki_page_views WHERE page_id = $1`, [pageId], {
          schema: 'wiki',
        });
        await adapter.query(
          `DELETE FROM wiki_page_links WHERE source_page_id = $1 OR target_page_id = $2`,
          [pageId, pageId],
          { schema: 'wiki' }
        );

        // Delete the page
        await adapter.query(`DELETE FROM wiki_pages WHERE id = $1`, [pageId], { schema: 'wiki' });
      },
      { schema: 'wiki' }
    );

    // Invalidate all search caches (deleted page affects search results)
    await cacheManager.invalidateCategory('search');
    // Invalidate content cache (deleted page affects category counts and statistics)
    await cacheManager.invalidateCategory('content');
  }

  /**
   * Get a page by ID with all related data
   */
  async getPageById(pageId: number): Promise<WikiPage> {
    const result = await dbAdapter.query(
      `SELECT
        p.id,
        p.slug,
        p.title,
        p.namespace,
        p.project_slug,
        p.template_type,
        p.category_id,
        p.status,
        p.protection_level,
        p.created_by,
        p.created_at,
        p.updated_at,
        r.content,
        r.content_format,
        r.size_bytes,
        c.id as category_id,
        c.name as category_name,
        COALESCE(SUM(pv.view_count), 0) as total_views
      FROM wiki_pages p
      LEFT JOIN wiki_revisions r ON p.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = p.id)
      LEFT JOIN wiki_categories c ON p.category_id = c.id
      LEFT JOIN wiki_page_views pv ON p.id = pv.page_id
      WHERE p.id = $1
      GROUP BY p.id, p.slug, p.title, p.namespace, p.project_slug, p.template_type, p.category_id, p.status, p.protection_level, p.created_by, p.created_at, p.updated_at, r.content, r.content_format, r.size_bytes, c.id, c.name`,
      [pageId],
      { schema: 'wiki' }
    );

    if (result.rows.length === 0) {
      throw new Error('Page not found');
    }

    const page = this.formatPageResult(result.rows[0]);

    // Fetch tags for the page
    page.tags = await this.getPageTags(page.id);

    // Fetch infoboxes for the page
    page.infoboxes = await this.getPageInfoboxes(page.id);

    return page;
  }

  /**
   * Get a wiki page by its slug and namespace
   *
   * **IMPORTANT:** The `slug` parameter must NOT include the namespace prefix.
   * Wiki pages store slug and namespace as separate database columns.
   *
   * Database schema:
   * - `slug` column: The page slug WITHOUT namespace (e.g., "doom-bible", "cascade-day")
   * - `namespace` column: The namespace (e.g., "main", "library", "project")
   *
   * @param slug - The page slug WITHOUT namespace prefix (e.g., "doom-bible", NOT "library/doom-bible")
   * @param namespace - The namespace to search in (defaults to 'main')
   * @returns The wiki page with all related data (content, tags, views, infoboxes)
   * @throws Error if page not found
   *
   * @example
   * // ✅ CORRECT - slug and namespace separated
   * await wikiPageService.getPageBySlug("doom-bible", "library");
   *
   * @example
   * // ❌ WRONG - slug includes namespace prefix
   * await wikiPageService.getPageBySlug("library/doom-bible", "main");
   *
   * @example
   * // ✅ CORRECT - default namespace
   * await wikiPageService.getPageBySlug("cascade-day"); // Uses namespace="main"
   */
  async getPageBySlug(slug: string, namespace: string = 'main'): Promise<WikiPage> {
    const cacheKey = `page:${namespace}:${slug}`;

    // Check cache first
    const cached = await cacheManager.get<WikiPage>({ category: 'content', identifier: cacheKey });
    if (cached) {
      return cached;
    }

    const result = await dbAdapter.query(
      `SELECT
        p.id,
        p.slug,
        p.title,
        p.namespace,
        p.project_slug,
        p.template_type,
        p.category_id,
        p.status,
        p.protection_level,
        p.created_by,
        p.created_at,
        p.updated_at,
        r.content,
        r.content_format,
        r.size_bytes,
        c.id as category_id,
        c.name as category_name,
        COALESCE(SUM(pv.view_count), 0) as total_views
      FROM wiki_pages p
      LEFT JOIN wiki_revisions r ON p.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = p.id)
      LEFT JOIN wiki_categories c ON p.category_id = c.id
      LEFT JOIN wiki_page_views pv ON p.id = pv.page_id
      WHERE p.slug = $1 AND p.namespace = $2
      GROUP BY p.id, p.slug, p.title, p.namespace, p.project_slug, p.template_type, p.category_id, p.status, p.protection_level, p.created_by, p.created_at, p.updated_at, r.content, r.content_format, r.size_bytes, c.id, c.name`,
      [slug, namespace],
      { schema: 'wiki' }
    );

    if (result.rows.length === 0) {
      throw new Error(`Page not found: slug="${slug}", namespace="${namespace}"`);
    }

    const page = this.formatPageResult(result.rows[0]);

    // Fetch tags for the page
    page.tags = await this.getPageTags(page.id);

    // Fetch infoboxes for the page
    page.infoboxes = await this.getPageInfoboxes(page.id);

    // Cache the result (including tags and infoboxes)
    await cacheManager.set({ category: 'content', identifier: cacheKey }, page);

    return page;
  }

  /**
   * Get all pages with optional filtering
   */
  async getAllPages(category?: string, limit?: number, userRole?: string): Promise<WikiPage[]> {
    let query = `
      SELECT
        p.id,
        p.slug,
        p.title,
        p.namespace,
        p.project_slug,
        p.template_type,
        p.category_id,
        p.status,
        p.protection_level,
        p.created_by,
        p.created_at,
        p.updated_at,
        r.content,
        r.content_format,
        r.size_bytes,
        c.id as category_id,
        c.name as category_name,
        COALESCE(SUM(pv.view_count), 0) as total_views
      FROM wiki_pages p
      LEFT JOIN wiki_revisions r ON p.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = p.id)
      LEFT JOIN wiki_categories c ON p.category_id = c.id
      LEFT JOIN wiki_page_views pv ON p.id = pv.page_id
      WHERE p.status = 'published'
        AND p.namespace != 'journals'
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND (p.category_id = $${paramIndex} OR p.category_id LIKE $${paramIndex + 1})`;
      queryParams.push(category, `${category}-%`);
      paramIndex += 2;
    }

    // Add access control for admin-only categories
    if (userRole !== 'admin' && userRole !== 'moderator') {
      const adminOnlyCategories = [
        'library',
        'archive',
        'development',
        'uncategorized',
        'journals',
      ];
      // Only exclude admin-only categories if we're not explicitly searching for one
      if (!category || !adminOnlyCategories.includes(category.toLowerCase())) {
        const placeholders = adminOnlyCategories.map((_, i) => `$${paramIndex + i}`).join(', ');
        query += ` AND (p.category_id IS NULL OR p.category_id NOT IN (${placeholders}))`;
        queryParams.push(...adminOnlyCategories);
        paramIndex += adminOnlyCategories.length;
      }
    }

    // PostgreSQL requires all non-aggregated columns in GROUP BY when using aggregate functions
    query += ` GROUP BY p.id, p.slug, p.title, p.namespace, p.project_slug, p.template_type, p.category_id, p.status, p.protection_level, p.created_by, p.created_at, p.updated_at, r.content, r.content_format, r.size_bytes, c.id, c.name ORDER BY p.updated_at DESC`;

    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      queryParams.push(limit);
    }

    const result = await dbAdapter.query(query, queryParams, { schema: 'wiki' });

    // Format all pages first
    const pages = result.rows.map((row: any) => this.formatPageResult(row));

    // Collect all unique author IDs
    const authorIds = [...new Set(pages.map(p => p.created_by).filter(id => id != null))];

    // Fetch author data in bulk (cross-database, so use UserLookupService)
    if (authorIds.length > 0) {
      const authorsMap = await userLookupService.getUsersBasic(authorIds as number[]);

      // Attach author data to pages
      pages.forEach(page => {
        if (page.created_by) {
          const authorData = authorsMap.get(page.created_by);
          if (authorData) {
            page.author = {
              id: authorData.id,
              username: authorData.username,
              display_name: authorData.display_name,
              avatar_url: authorData.avatar_url,
              email: '',
              bio: '',
              role: (authorData.role as 'user' | 'admin' | 'moderator') || 'user',
              reputation: 0,
              post_count: 0,
              created_at: '',
              last_active: '',
              is_active: true,
            };
          }
        }
      });
    }

    return pages;
  }

  /**
   * Get tags for a specific page with full tag objects
   */
  async getPageTags(pageId: number): Promise<Array<{ id: number; name: string; color?: string }>> {
    try {
      const result = await dbAdapter.query(
        `SELECT t.id, t.name, t.color
        FROM wiki_tags t
        INNER JOIN wiki_page_tags pt ON t.id = pt.tag_id
        WHERE pt.page_id = $1
        ORDER BY t.name`,
        [pageId],
        { schema: 'wiki' }
      );

      return result.rows || [];
    } catch (error) {
      logger.error('Error fetching page tags', { error });
      return [];
    }
  }

  /**
   * Get infoboxes for a specific page
   */
  async getPageInfoboxes(pageId: number): Promise<any[]> {
    try {
      const result = await dbAdapter.query(
        `SELECT
          i.*,
          t.name as template_name,
          t.type as template_type,
          t.schema_definition,
          json_agg(
            json_build_object(
              'field_name', tf.field_name,
              'field_type', tf.field_type,
              'field_label', tf.field_label,
              'is_required', tf.is_required,
              'default_value', tf.default_value,
              'display_order', tf.display_order
            )
          ) as template_fields_json
        FROM wiki_infoboxes i
        LEFT JOIN wiki_templates t ON i.template_id = t.id
        LEFT JOIN wiki_template_fields tf ON t.id = tf.template_id
        WHERE i.page_id = $1 AND i.is_active = true
        GROUP BY i.id, t.id
        ORDER BY i.position, i.id`,
        [pageId],
        { schema: 'wiki' }
      );

      return result.rows.map((row: any) => {
        let templateFields = [];
        if (row.template_fields_json) {
          try {
            templateFields = row.template_fields_json;
          } catch (e) {
            logger.warn('Failed to parse template fields', { error: e });
          }
        }

        let parsedData = {};
        if (row.data) {
          try {
            parsedData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          } catch (e) {
            logger.warn('Failed to parse infobox data', { error: e });
          }
        }

        return {
          ...row,
          template_fields: templateFields,
          parsed_data: parsedData,
        };
      });
    } catch (error) {
      logger.error('Error fetching page infoboxes', { error });
      return [];
    }
  }

  /**
   * Record a page view
   */
  async recordPageView(pageId: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    await dbAdapter.query(
      `INSERT INTO wiki_page_views (page_id, view_date, view_count)
       VALUES ($1, $2, 1)
       ON CONFLICT (page_id, view_date)
       DO UPDATE SET view_count = view_count + 1`,
      [pageId, today],
      { schema: 'wiki' }
    );
  }

  /**
   * Check if user can access a page based on role and category
   */
  async canUserAccessPage(page: any, userRole?: string): Promise<boolean> {
    if (page.category_ids && page.category_ids.length > 0) {
      // Check if page belongs to an admin-only category
      // We need to query the category to check its is_public status
      for (const categoryId of page.category_ids) {
        const result = await dbAdapter.query(
          'SELECT is_public FROM wiki_categories WHERE id = $1',
          [categoryId],
          { schema: 'wiki' }
        );

        // If category has is_public set to false, check user role
        if (result.rows.length > 0) {
          const category = result.rows[0];
          if (category.is_public === false || category.is_public === 0) {
            if (userRole !== 'admin' && userRole !== 'moderator') {
              return false;
            }
          }
        }
      }
    }

    return true;
  }

  /**
   * Format raw database result into WikiPage object
   */
  private formatPageResult(result: any): WikiPage {
    // Handle single category format
    const categories = [];
    const category_ids = [];

    if (result.category_name && result.category_id) {
      categories.push(result.category_name);
      category_ids.push(result.category_id);
    } else if (result.categories) {
      categories.push(...result.categories.split(',').filter(Boolean));
      category_ids.push(
        ...(result.category_ids ? result.category_ids.split(',').filter(Boolean) : [])
      );
    }

    return {
      id: result.id,
      slug: result.slug,
      title: result.title,
      namespace: result.namespace,
      status: result.status,
      protection_level: result.protection_level,
      created_by: Number(result.created_by),
      created_at: result.created_at,
      updated_at: result.updated_at,
      content: result.content,
      content_format: result.content_format,
      size_bytes: result.size_bytes,
      categories,
      category_ids,
      tags: [], // Tags are fetched separately via getPageTags()
      total_views: result.total_views || 0,
      // Document-specific fields (optional - may not exist for all pages)
      content_type: result.content_type || null,
      file_path: result.file_path || null,
      file_size: result.file_size || null,
      mime_type: result.mime_type || null,
      document_author: result.document_author || null,
      publication_date: result.publication_date || null,
      download_count: result.download_count || 0,
      author: result.username
        ? {
            id: Number(result.created_by),
            username: result.username,
            email: '',
            display_name: result.display_name,
            avatar_url: result.avatar_url,
            bio: '',
            role: 'user' as const,
            reputation: 0,
            post_count: 0,
            created_at: '',
            last_active: '',
            is_active: true,
          }
        : undefined,
    };
  }

  /**
   * Update all references to a page when its title/slug changes
   * This prevents broken wikilinks and stale database references
   */
  private async updatePageReferences(
    pageId: number,
    oldTitle: string,
    newTitle: string,
    oldSlug: string,
    newSlug: string,
    namespace: string,
    authorId?: number,
    authorIp?: string
  ): Promise<void> {
    // Step 1: Update wiki_page_links database table
    await this.updateDatabaseLinks(oldSlug, newSlug, pageId);

    // Step 2: Update [[WikiLink]] syntax in page content
    await this.updateContentLinks(oldTitle, newTitle, namespace, authorId, authorIp);
  }

  /**
   * Update wiki_page_links table when slug changes
   */
  private async updateDatabaseLinks(
    oldSlug: string,
    newSlug: string,
    pageId: number
  ): Promise<number> {
    // Update all links that point to the old slug
    const result = await dbAdapter.query(
      `UPDATE wiki_page_links
       SET target_slug = $1
       WHERE target_slug = $2
         AND (target_page_id = $3 OR target_page_id IS NULL)`,
      [newSlug, oldSlug, pageId],
      { schema: 'wiki' }
    );

    return result.rowCount;
  }

  /**
   * Update [[WikiLink]] syntax in all pages that reference the old title
   */
  private async updateContentLinks(
    oldTitle: string,
    newTitle: string,
    namespace: string,
    authorId?: number,
    authorIp?: string
  ): Promise<number> {
    // Find all pages containing the old title in wikilinks
    const affectedPages = await this.findPagesWithWikiLink(oldTitle, namespace);

    if (affectedPages.length === 0) {
      return 0;
    }

    // Update each affected page in a transaction
    await dbAdapter.transaction(
      async adapter => {
        for (const page of affectedPages) {
          const updatedContent = this.replaceWikiLinks(page.content, oldTitle, newTitle, namespace);

          // Only update if content actually changed
          if (updatedContent !== page.content) {
            // Create new revision with updated content
            const contentBytes = Buffer.from(updatedContent, 'utf8').length;

            await adapter.query(
              `INSERT INTO wiki_revisions (page_id, content, summary, content_format, author_id, author_ip, is_minor, size_bytes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                page.id,
                updatedContent,
                `Auto-updated wikilink: [[${oldTitle}]] → [[${newTitle}]]`,
                page.content_format || 'markdown',
                authorId || null,
                authorIp || null,
                true, // is_minor = true
                contentBytes,
              ],
              { schema: 'wiki' }
            );
          }
        }
      },
      { schema: 'wiki' }
    );

    return affectedPages.length;
  }

  /**
   * Find all published pages containing wikilinks to a specific title
   */
  private async findPagesWithWikiLink(
    targetTitle: string,
    targetNamespace: string
  ): Promise<Array<{ id: number; content: string; content_format: string }>> {
    // Get all published pages with their latest content
    const result = await dbAdapter.query(
      `SELECT
        p.id,
        p.namespace,
        r.content,
        r.content_format
      FROM wiki_pages p
      LEFT JOIN wiki_revisions r ON p.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = p.id)
      WHERE p.status = 'published'
        AND r.content IS NOT NULL`,
      [],
      { schema: 'wiki' }
    );

    const allPages = result.rows as Array<{
      id: number;
      namespace: string;
      content: string;
      content_format: string;
    }>;

    // Filter to only pages that contain wikilinks to the target
    return allPages.filter(page => {
      // Check for various wikilink patterns:
      // [[TargetTitle]]
      // [[TargetTitle|Display]]
      // [[TargetTitle#anchor]]
      // [[namespace:TargetTitle]]

      const patterns = [
        new RegExp(`\\[\\[${this.escapeRegex(targetTitle)}\\]\\]`, 'gi'),
        new RegExp(`\\[\\[${this.escapeRegex(targetTitle)}\\|[^\\]]+\\]\\]`, 'gi'),
        new RegExp(`\\[\\[${this.escapeRegex(targetTitle)}#[^\\]]+\\]\\]`, 'gi'),
        new RegExp(`\\[\\[${targetNamespace}:${this.escapeRegex(targetTitle)}[^\\]]*\\]\\]`, 'gi'),
      ];

      return patterns.some(pattern => pattern.test(page.content));
    });
  }

  /**
   * Replace wikilinks in content while preserving display text, anchors, etc.
   */
  private replaceWikiLinks(
    content: string,
    oldTitle: string,
    newTitle: string,
    namespace: string
  ): string {
    let updated = content;

    // Pattern 1: [[OldTitle]] → [[NewTitle]]
    updated = updated.replace(
      new RegExp(`\\[\\[${this.escapeRegex(oldTitle)}\\]\\]`, 'gi'),
      `[[${newTitle}]]`
    );

    // Pattern 2: [[OldTitle|Display]] → [[NewTitle|Display]]
    updated = updated.replace(
      new RegExp(`\\[\\[${this.escapeRegex(oldTitle)}\\|([^\\]]+)\\]\\]`, 'gi'),
      `[[${newTitle}|$1]]`
    );

    // Pattern 3: [[OldTitle#anchor]] → [[NewTitle#anchor]]
    updated = updated.replace(
      new RegExp(`\\[\\[${this.escapeRegex(oldTitle)}(#[^\\]|]+)\\]\\]`, 'gi'),
      `[[${newTitle}$1]]`
    );

    // Pattern 4: [[OldTitle#anchor|Display]] → [[NewTitle#anchor|Display]]
    updated = updated.replace(
      new RegExp(`\\[\\[${this.escapeRegex(oldTitle)}(#[^\\]|]+)\\|([^\\]]+)\\]\\]`, 'gi'),
      `[[${newTitle}$1|$2]]`
    );

    // Pattern 5: [[namespace:OldTitle...]] → [[namespace:NewTitle...]]
    updated = updated.replace(
      new RegExp(`\\[\\[${namespace}:${this.escapeRegex(oldTitle)}([^\\]]*)\\]\\]`, 'gi'),
      `[[${namespace}:${newTitle}$1]]`
    );

    return updated;
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Export singleton instance
export const wikiPageService = new WikiPageService();
