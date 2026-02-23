/**
 * Project Gallery Service
 *
 * Manages project gallery images (references, concept art) with tagging and categorization.
 * Uses PostgreSQL content schema for image storage alongside project data.
 *
 * Architecture:
 * - Gallery type system: 'references' | 'concept-art' (extensible)
 * - Uses existing database schema (project_reference_images, reference_tags, etc.)
 * - Result pattern for type-safe error handling
 * - Cross-database user lookups (users.db)
 * - Tag-based filtering with AND/OR logic
 */

import { dbAdapter } from '@/lib/database/adapter';
import { serializeError, serializeErrorDetail } from '@/lib/utils/serialize-error';
import type {
  ProjectId,
  UserId,
  ReferenceImageId,
  ReferenceTagId,
  ReferenceCategoryId,
  AlbumId,
} from '@/lib/database/schema-types';
import { brandAlbumId } from '@/lib/database/schema-types';
import { logger } from '@/lib/utils/logger';
import type {
  ReferenceImage,
  ReferenceImageRecord,
  ReferenceTag,
  ReferenceTagRecord,
  ReferenceCategory,
  ReferenceCategoryRecord,
  ReferenceAlbum,
  ReferenceAlbumRecord,
  CreateReferenceImageInput,
  UpdateReferenceImageInput,
  CreateReferenceTagInput,
  ReferenceImageFilters,
  ReferenceImageQueryResult,
  ReferenceImageServiceError,
} from '@/types/project-references';

/**
 * Gallery type for categorizing image collections
 * Extensible: Add new types as needed (e.g., 'screenshots', 'textures')
 */
export type GalleryType = 'references' | 'concept-art' | 'history';

/**
 * Result type for operations that can fail
 */
type Result<T, E = ReferenceImageServiceError> = { ok: true; value: T } | { ok: false; error: E };

const Ok = <T>(value: T): Result<T> => ({ ok: true, value });
const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export class ProjectGalleryService {
  /**
   * Get user information from users database
   * Pattern from LibraryService for cross-database lookups
   */
  private async getUserById(
    userId: UserId
  ): Promise<{ id: UserId; username: string; display_name: string | null } | null> {
    try {
      const result = await dbAdapter.query<{
        id: UserId;
        username: string;
        display_name: string | null;
      }>('SELECT id, username, display_name FROM users WHERE id = $1', [userId], {
        schema: 'users',
      });

      return result.rows[0] || null;
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to fetch user data', { userId, error: errorDetail });
      return null;
    }
  }

  /**
   * Batch fetch multiple users to avoid N+1 queries
   * @param userIds Array of user IDs to fetch
   * @returns Map of userId -> user data
   */
  private async getUsersByIds(
    userIds: UserId[]
  ): Promise<Map<UserId, { id: UserId; username: string; display_name: string | null }>> {
    const userMap = new Map<
      UserId,
      { id: UserId; username: string; display_name: string | null }
    >();

    if (userIds.length === 0) {
      return userMap;
    }

    try {
      // Remove duplicates
      const uniqueIds = [...new Set(userIds)];

      // Build parameterized query: SELECT ... WHERE id IN ($1, $2, $3, ...)
      const placeholders = uniqueIds.map((_, i) => `$${i + 1}`).join(',');
      const query = `SELECT id, username, display_name FROM users WHERE id IN (${placeholders})`;

      const result = await dbAdapter.query<{
        id: UserId;
        username: string;
        display_name: string | null;
      }>(query, uniqueIds, { schema: 'users' });

      // Build map for O(1) lookups
      for (const user of result.rows) {
        userMap.set(user.id, user);
      }

      return userMap;
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to batch fetch user data', { userIds, error: errorDetail });
      return userMap;
    }
  }

  // ============================================
  // IMAGE OPERATIONS
  // ============================================

  /**
   * Get all reference images for a project with filtering
   */
  async getProjectImages(
    galleryType: GalleryType = 'references',
    filters: ReferenceImageFilters,
    sortBy: 'default' | 'dimensions' = 'default'
  ): Promise<Result<ReferenceImageQueryResult>> {
    try {
      const {
        project_id,
        tag_ids,
        category_ids,
        include_deleted = false,
        limit = 100,
        offset = 0,
      } = filters;

      // Sanitize pagination inputs
      const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
      const safeOffset = Math.max(0, Number(offset) || 0);

      const whereConditions: string[] = ['img.project_id = $1', 'img.gallery_type = $2'];
      const queryParams: any[] = [project_id, galleryType];
      let paramIndex = 3;

      // Filter by deleted status (INTEGER: 0=false, 1=true)
      if (!include_deleted) {
        whereConditions.push('img.is_deleted = 0');
      }

      // Filter by tags if specified (AND logic - image must have ALL tags)
      if (tag_ids && tag_ids.length > 0) {
        const tagPlaceholders = tag_ids.map((_, i) => `$${paramIndex + i}`).join(',');
        whereConditions.push(`
          (SELECT COUNT(DISTINCT tag_id)
           FROM project_reference_image_tags
           WHERE reference_id = img.id
           AND tag_id IN (${tagPlaceholders})) = $${paramIndex + tag_ids.length}
        `);
        queryParams.push(...tag_ids, tag_ids.length);
        paramIndex += tag_ids.length + 1;
      }

      // Filter by categories if specified (OR logic - image has tags in ANY category)
      if (category_ids && category_ids.length > 0) {
        const categoryPlaceholders = category_ids.map((_, i) => `$${paramIndex + i}`).join(',');
        whereConditions.push(`
          EXISTS (
            SELECT 1
            FROM project_reference_image_tags prt
            JOIN reference_tags rt ON prt.tag_id = rt.id
            WHERE prt.reference_id = img.id
            AND rt.category_id IN (${categoryPlaceholders})
          )
        `);
        queryParams.push(...category_ids);
        paramIndex += category_ids.length;
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM project_reference_images img
        WHERE ${whereClause}
      `;
      const countResult = await dbAdapter.query<{ total: number }>(countQuery, queryParams, {
        schema: 'content',
      });
      const total = Number(countResult.rows[0]?.total || 0);

      // Get images with primary tag for tag-based grouping
      // Primary tag = first tag by category/display order
      // Sorting behavior:
      // - default: History sorts by date, others by tag
      // - dimensions: All galleries sort by pixel count (width * height)

      // PostgreSQL FIX: Cannot reference SELECT aliases in ORDER BY
      // SQLite allows this, PostgreSQL does not
      // Solution: Use CTE (Common Table Expression) to make alias available
      let imagesQuery: string;

      if (sortBy === 'dimensions') {
        // Sort by total pixel count (largest to smallest), then filename
        imagesQuery = `
          SELECT img.*,
            (SELECT rt.name
             FROM project_reference_image_tags prit
             JOIN reference_tags rt ON prit.tag_id = rt.id
             JOIN reference_categories rc ON rt.category_id = rc.id
             WHERE prit.reference_id = img.id
             ORDER BY rc.display_order, rt.display_order
             LIMIT 1) as primary_tag_name
          FROM project_reference_images img
          WHERE ${whereClause}
          ORDER BY (COALESCE(img.width, 0) * COALESCE(img.height, 0)) DESC, img.filename_storage ASC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
      } else if (galleryType === 'history') {
        // History gallery: sort by date
        imagesQuery = `
          SELECT img.*,
            (SELECT rt.name
             FROM project_reference_image_tags prit
             JOIN reference_tags rt ON prit.tag_id = rt.id
             JOIN reference_categories rc ON rt.category_id = rc.id
             WHERE prit.reference_id = img.id
             ORDER BY rc.display_order, rt.display_order
             LIMIT 1) as primary_tag_name
          FROM project_reference_images img
          WHERE ${whereClause}
          ORDER BY COALESCE(img.created_at, img.updated_at) DESC, img.filename_storage ASC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
      } else {
        // References/concept-art: sort by tag name (use CTE to reference alias)
        imagesQuery = `
          WITH tagged_images AS (
            SELECT img.*,
              (SELECT rt.name
               FROM project_reference_image_tags prit
               JOIN reference_tags rt ON prit.tag_id = rt.id
               JOIN reference_categories rc ON rt.category_id = rc.id
               WHERE prit.reference_id = img.id
               ORDER BY rc.display_order, rt.display_order
               LIMIT 1) as primary_tag_name
            FROM project_reference_images img
            WHERE ${whereClause}
          )
          SELECT * FROM tagged_images
          ORDER BY COALESCE(primary_tag_name, 'zzz_untagged') ASC, filename_storage ASC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
      }

      queryParams.push(safeLimit, safeOffset);
      const imagesResult = await dbAdapter.query<ReferenceImageRecord>(imagesQuery, queryParams, {
        schema: 'content',
      });
      const images = imagesResult.rows;

      if (images.length === 0) {
        return Ok({
          images: [],
          total,
          page: Math.floor(safeOffset / safeLimit) + 1,
          limit: safeLimit,
          has_more: false,
        });
      }

      // Get tags for all images
      const imageIds = images.map(img => img.id);
      const tagsPlaceholders = imageIds.map((_, i) => `$${i + 1}`).join(',');
      const tagsQuery = `
        SELECT
          prt.reference_id as image_id,
          rt.id,
          rt.name,
          rt.color,
          rt.display_order,
          rc.id as category_id,
          rc.name as category_name
        FROM project_reference_image_tags prt
        JOIN reference_tags rt ON prt.tag_id = rt.id
        JOIN reference_categories rc ON rt.category_id = rc.id
        WHERE prt.reference_id IN (${tagsPlaceholders})
        ORDER BY rc.display_order, rt.display_order
      `;

      const tagsResult = await dbAdapter.query<any>(tagsQuery, imageIds, { schema: 'content' });
      const allTags = tagsResult.rows;

      // Group tags by image
      const tagsByImage = new Map<ReferenceImageId, ReferenceTag[]>();
      for (const tag of allTags) {
        if (!tagsByImage.has(tag.image_id)) {
          tagsByImage.set(tag.image_id, []);
        }
        tagsByImage.get(tag.image_id)!.push({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          category: {
            id: tag.category_id,
            name: tag.category_name,
          },
          display_order: tag.display_order,
        });
      }

      // Batch fetch user data to avoid N+1 queries
      const uploaderIds = images.map(img => img.uploaded_by);
      const uploaderMap = await this.getUsersByIds(uploaderIds);

      // Transform to display format
      const result: ReferenceImage[] = images.map(img => {
        const uploader = uploaderMap.get(img.uploaded_by);

        return {
          id: img.id,
          project_id: img.project_id,
          filename_storage: img.filename_storage,
          file_path: img.file_path,
          file_size: img.file_size,
          mime_type: img.mime_type,
          width: img.width,
          height: img.height,
          aspect_ratio: img.aspect_ratio,
          sort_order: img.sort_order,
          tags: tagsByImage.get(img.id) || [],
          uploader: uploader
            ? {
                id: uploader.id,
                username: uploader.username,
                display_name: uploader.display_name,
              }
            : null,
          is_deleted: Boolean(img.is_deleted),
          deleted_at: img.deleted_at,
          created_at: img.created_at,
          updated_at: img.updated_at,
        };
      });

      return Ok({
        images: result,
        total,
        page: Math.floor(safeOffset / safeLimit) + 1,
        limit: safeLimit,
        has_more: safeOffset + safeLimit < total,
      });
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to get project reference images', { filters, error: errorDetail });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve reference images',
        details: serializeError(error),
      });
    }
  }

  /**
   * Get a single reference image by ID
   */
  async getImageById(imageId: ReferenceImageId): Promise<Result<ReferenceImage>> {
    try {
      const imageResult = await dbAdapter.query<ReferenceImageRecord>(
        'SELECT * FROM project_reference_images WHERE id = $1',
        [imageId],
        { schema: 'content' }
      );

      if (imageResult.rows.length === 0) {
        return Err({
          code: 'NOT_FOUND',
          message: `Reference image with ID ${imageId} not found`,
        });
      }

      const image = imageResult.rows[0]!;

      // Get tags
      const tagsResult = await dbAdapter.query<any>(
        `
          SELECT
            rt.id,
            rt.name,
            rt.color,
            rt.display_order,
            rc.id as category_id,
            rc.name as category_name
          FROM project_reference_image_tags prt
          JOIN reference_tags rt ON prt.tag_id = rt.id
          JOIN reference_categories rc ON rt.category_id = rc.id
          WHERE prt.reference_id = $1
          ORDER BY rc.display_order, rt.display_order
        `,
        [imageId],
        { schema: 'content' }
      );

      const uploader = await this.getUserById(image.uploaded_by);

      const result: ReferenceImage = {
        id: image.id,
        project_id: image.project_id,
        filename_storage: image.filename_storage,
        file_path: image.file_path,
        file_size: image.file_size,
        mime_type: image.mime_type,
        width: image.width,
        height: image.height,
        aspect_ratio: image.aspect_ratio,
        sort_order: image.sort_order,
        tags: tagsResult.rows.map(t => ({
          id: t.id,
          name: t.name,
          color: t.color,
          category: {
            id: t.category_id,
            name: t.category_name,
          },
          display_order: t.display_order,
        })),
        uploader: uploader
          ? {
              id: uploader.id,
              username: uploader.username,
              display_name: uploader.display_name,
            }
          : null,
        is_deleted: Boolean(image.is_deleted),
        deleted_at: image.deleted_at,
        created_at: image.created_at,
        updated_at: image.updated_at,
      };

      return Ok(result);
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to get reference image', { imageId, error: errorDetail });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve reference image',
        details: serializeError(error),
      });
    }
  }

  /**
   * Create a new reference image
   */
  async createImage(
    galleryType: GalleryType = 'references',
    input: CreateReferenceImageInput,
    userId: UserId
  ): Promise<Result<ReferenceImageId>> {
    try {
      // Calculate aspect ratio if dimensions provided
      const aspect_ratio = input.width && input.height ? input.width / input.height : null;

      const result = await dbAdapter.transaction(
        async () => {
          // Check for duplicate file in this project
          const existingResult = await dbAdapter.query<any>(
            `SELECT id FROM project_reference_images
           WHERE project_id = $1 AND file_path = $2 AND gallery_type = $3`,
            [input.project_id, input.file_path, galleryType],
            { schema: 'content' }
          );

          if (existingResult.rows.length > 0) {
            throw new Error(
              `Duplicate file detected: Image with path "${input.file_path}" already exists in this gallery (ID: ${existingResult.rows[0].id})`
            );
          }

          // Insert image (with optional created_at for metadata preservation)
          const hasCreatedAt = input.created_at !== undefined;
          const insertSql = hasCreatedAt
            ? `INSERT INTO project_reference_images (
              project_id, gallery_type, filename_storage, file_path,
              file_size, mime_type, width, height, aspect_ratio,
              uploaded_by, sort_order, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id`
            : `INSERT INTO project_reference_images (
              project_id, gallery_type, filename_storage, file_path,
              file_size, mime_type, width, height, aspect_ratio,
              uploaded_by, sort_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id`;

          const insertParams = hasCreatedAt
            ? [
                input.project_id,
                galleryType,
                input.filename_storage,
                input.file_path,
                input.file_size,
                input.mime_type,
                input.width || null,
                input.height || null,
                aspect_ratio,
                userId,
                0, // Default sort order
                input.created_at,
              ]
            : [
                input.project_id,
                galleryType,
                input.filename_storage,
                input.file_path,
                input.file_size,
                input.mime_type,
                input.width || null,
                input.height || null,
                aspect_ratio,
                userId,
                0, // Default sort order
              ];

          const insertResult = await dbAdapter.query<{ id: ReferenceImageId }>(
            insertSql,
            insertParams,
            { schema: 'content' }
          );

          const imageId = insertResult.rows[0]!.id;

          // Add tags if specified
          if (input.tag_ids && input.tag_ids.length > 0) {
            for (const tagId of input.tag_ids) {
              await dbAdapter.query(
                `INSERT INTO project_reference_image_tags (reference_id, tag_id)
               VALUES ($1, $2)`,
                [imageId, tagId],
                { schema: 'content' }
              );
            }
          }

          return imageId;
        },
        { schema: 'content' }
      );

      logger.info('Reference image created', { imageId: result, userId });
      return Ok(result);
    } catch (error) {
      // Check for duplicate file error
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('Duplicate file detected')) {
        logger.warn('Duplicate image upload attempted', { input, error });
        return Err({
          code: 'DUPLICATE',
          message: errorMsg,
          details: serializeError(error),
        });
      }

      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to create reference image', { input, error: errorDetail });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to create reference image',
        details: serializeError(error),
      });
    }
  }

  /**
   * Update reference image metadata
   */
  async updateImage(
    imageId: ReferenceImageId,
    input: UpdateReferenceImageInput,
    userId: UserId
  ): Promise<Result<void>> {
    try {
      await dbAdapter.transaction(
        async () => {
          // Update tags if specified
          if (input.tag_ids !== undefined) {
            // Remove existing tags
            await dbAdapter.query(
              'DELETE FROM project_reference_image_tags WHERE reference_id = $1',
              [imageId],
              { schema: 'content' }
            );

            // Add new tags
            if (input.tag_ids.length > 0) {
              for (const tagId of input.tag_ids) {
                await dbAdapter.query(
                  `INSERT INTO project_reference_image_tags (reference_id, tag_id)
                 VALUES ($1, $2)`,
                  [imageId, tagId],
                  { schema: 'content' }
                );
              }
            }

            // Update timestamp
            await dbAdapter.query(
              'UPDATE project_reference_images SET updated_at = NOW() WHERE id = $1',
              [imageId],
              { schema: 'content' }
            );
          }
        },
        { schema: 'content' }
      );

      logger.info('Reference image updated', { imageId, userId });
      return Ok(undefined);
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to update reference image', { imageId, input, error: errorDetail });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to update reference image',
        details: serializeError(error),
      });
    }
  }

  /**
   * Hard delete a reference image or video
   * Immediately deletes files (video/image + thumbnail) and database records
   */
  async deleteImage(imageId: ReferenceImageId, userId: UserId): Promise<Result<void>> {
    try {
      // Get file info before deleting
      const imageResult = await dbAdapter.query<{
        file_path: string;
        poster_path: string | null;
        mime_type: string;
        duration: number | null;
      }>(
        'SELECT file_path, poster_path, mime_type, duration FROM project_reference_images WHERE id = $1',
        [imageId],
        { schema: 'content' }
      );

      if (imageResult.rows.length === 0) {
        return Err({
          code: 'NOT_FOUND',
          message: `Reference image with ID ${imageId} not found`,
        });
      }

      const image = imageResult.rows[0]!;

      // HARD DELETE - immediate file and database cleanup
      return this.hardDeleteMedia(imageId, image.file_path, image.poster_path);
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to delete reference image', { imageId, error: errorDetail });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to delete reference image',
        details: serializeError(error),
      });
    }
  }

  /**
   * Hard delete media (video or image) - immediate file and database cleanup
   * Deletes:
   * - Main file (file_path)
   * - Thumbnail/poster if exists (poster_path)
   * - Album associations
   * - Tags from database
   * - Database record
   */
  private async hardDeleteMedia(
    imageId: ReferenceImageId,
    filePath: string,
    posterPath: string | null
  ): Promise<Result<void>> {
    try {
      await dbAdapter.transaction(
        async () => {
          const fs = require('fs');
          const path = require('path');

          // Delete main file
          const mainFilePath = path.join(process.cwd(), 'public', filePath);
          if (fs.existsSync(mainFilePath)) {
            fs.unlinkSync(mainFilePath);
            logger.info('Deleted media file:', mainFilePath);
          } else {
            logger.warn('Media file not found (skipping):', mainFilePath);
          }

          // Delete thumbnail/poster if exists
          if (posterPath) {
            const posterFullPath = path.join(process.cwd(), 'public', posterPath);
            if (fs.existsSync(posterFullPath)) {
              fs.unlinkSync(posterFullPath);
              logger.info('Deleted thumbnail:', posterFullPath);
            } else {
              logger.warn('Thumbnail not found (skipping):', posterFullPath);
            }
          }

          // Delete from database (album associations, tags, then image)
          await dbAdapter.query(
            'DELETE FROM reference_album_images WHERE image_id = $1',
            [imageId],
            {
              schema: 'content',
            }
          );
          await dbAdapter.query(
            'DELETE FROM project_reference_image_tags WHERE reference_id = $1',
            [imageId],
            { schema: 'content' }
          );
          await dbAdapter.query('DELETE FROM project_reference_images WHERE id = $1', [imageId], {
            schema: 'content',
          });
        },
        { schema: 'content' }
      );

      logger.info('Media hard-deleted (files + database)', { imageId });
      return Ok(undefined);
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to hard-delete media', { imageId, error: errorDetail });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to delete media',
        details: serializeError(error),
      });
    }
  }

  /**
   * Permanently delete a reference image (hard delete)
   */
  async permanentlyDeleteImage(imageId: ReferenceImageId): Promise<Result<void>> {
    try {
      await dbAdapter.transaction(
        async () => {
          // Delete tags (cascade should handle this, but explicit is safer)
          await dbAdapter.query(
            'DELETE FROM project_reference_image_tags WHERE reference_id = $1',
            [imageId],
            { schema: 'content' }
          );

          // Delete image record
          await dbAdapter.query('DELETE FROM project_reference_images WHERE id = $1', [imageId], {
            schema: 'content',
          });
        },
        { schema: 'content' }
      );

      logger.info('Reference image permanently deleted', { imageId });
      return Ok(undefined);
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to permanently delete reference image', {
        imageId,
        error: errorDetail,
      });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to permanently delete reference image',
        details: serializeError(error),
      });
    }
  }

  /**
   * Reorder images within a project
   */
  async reorderImages(imageIds: ReferenceImageId[]): Promise<Result<void>> {
    try {
      await dbAdapter.transaction(
        async () => {
          for (let i = 0; i < imageIds.length; i++) {
            await dbAdapter.query(
              'UPDATE project_reference_images SET sort_order = $1 WHERE id = $2',
              [i, imageIds[i]],
              { schema: 'content' }
            );
          }
        },
        { schema: 'content' }
      );

      logger.info('Reference images reordered', { count: imageIds.length });
      return Ok(undefined);
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to reorder reference images', { imageIds, error: errorDetail });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to reorder reference images',
        details: serializeError(error),
      });
    }
  }

  // ============================================
  // TAG OPERATIONS
  // ============================================

  /**
   * Get all available tags with their categories
   */
  async getAllTags(
    galleryType: GalleryType = 'references',
    projectId?: ProjectId
  ): Promise<Result<ReferenceTag[]>> {
    try {
      let query = `
        SELECT
          rt.id,
          rt.name,
          rt.color,
          rt.display_order,
          rc.id as category_id,
          rc.name as category_name
        FROM reference_tags rt
        JOIN reference_categories rc ON rt.category_id = rc.id
      `;

      const params: any[] = [];
      const whereConditions: string[] = [];
      let paramIndex = 1;

      if (projectId) {
        whereConditions.push(`rt.project_id = $${paramIndex}`);
        params.push(projectId);
        paramIndex++;
      }

      whereConditions.push(`rt.gallery_type = $${paramIndex}`);
      params.push(galleryType);

      if (whereConditions.length > 0) {
        query += ` WHERE ` + whereConditions.join(' AND ');
      }

      query += ` ORDER BY rc.display_order, rt.display_order`;

      const result = await dbAdapter.query<any>(query, params, { schema: 'content' });

      const tags: ReferenceTag[] = result.rows.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color,
        category: {
          id: t.category_id,
          name: t.category_name,
        },
        display_order: t.display_order,
      }));

      return Ok(tags);
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to get tags', { projectId, error: errorDetail });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve tags',
        details: serializeError(error),
      });
    }
  }

  /**
   * Get tags used in a specific project
   */
  async getProjectTags(projectId: ProjectId): Promise<Result<ReferenceTag[]>> {
    try {
      const result = await dbAdapter.query<any>(
        `
          SELECT DISTINCT
            rt.id,
            rt.name,
            rt.color,
            rt.display_order,
            rc.id as category_id,
            rc.name as category_name
          FROM reference_tags rt
          JOIN reference_categories rc ON rt.category_id = rc.id
          JOIN project_reference_image_tags prt ON rt.id = prt.tag_id
          JOIN project_reference_images img ON prt.reference_id = img.id
          WHERE img.project_id = $1 AND img.is_deleted = 0
          ORDER BY rc.display_order, rt.display_order
        `,
        [projectId],
        { schema: 'content' }
      );

      const tags: ReferenceTag[] = result.rows.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color,
        category: {
          id: t.category_id,
          name: t.category_name,
        },
        display_order: t.display_order,
      }));

      return Ok(tags);
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to get project tags', { projectId, error: errorDetail });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve project tags',
        details: serializeError(error),
      });
    }
  }

  /**
   * Create a new tag
   */
  async createTag(input: CreateReferenceTagInput): Promise<Result<ReferenceTagId>> {
    try {
      // Generate UUID for the tag (TEXT PRIMARY KEY)
      const result = await dbAdapter.query<{ id: string }>(
        `INSERT INTO reference_tags (id, project_id, category_id, name, color, display_order)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)
         RETURNING id`,
        [
          input.project_id,
          input.category_id,
          input.name,
          input.color || '#6B7280',
          input.display_order || 999,
        ],
        { schema: 'content' }
      );

      const id = result.rows[0]!.id as ReferenceTagId;

      logger.info('Reference tag created', {
        tagId: id,
        name: input.name,
        project_id: input.project_id,
      });
      return Ok(id);
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to create tag', { input, error: errorDetail });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to create tag',
        details: serializeError(error),
      });
    }
  }

  // ============================================
  // CATEGORY OPERATIONS
  // ============================================

  /**
   * Get all available categories
   */
  async getAllCategories(): Promise<Result<ReferenceCategory[]>> {
    try {
      const result = await dbAdapter.query<any>(
        `
          SELECT
            rc.*,
            COUNT(rt.id) as tag_count
          FROM reference_categories rc
          LEFT JOIN reference_tags rt ON rc.id = rt.category_id
          GROUP BY rc.id
          ORDER BY rc.display_order
        `,
        [],
        { schema: 'content' }
      );

      const categories: ReferenceCategory[] = result.rows.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        visibility: c.visibility,
        display_order: c.display_order,
        tag_count: c.tag_count,
      }));

      return Ok(categories);
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to get categories', { error: errorDetail });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve categories',
        details: serializeError(error),
      });
    }
  }

  // ============================================
  // ALBUM OPERATIONS
  // ============================================

  /**
   * Create an album from multiple images
   * Images are removed from their previous album if they were in one
   * @param projectId - Project ID
   * @param galleryType - Gallery type (references | concept-art)
   * @param imageIds - Array of image IDs (minimum 2 images)
   * @param userId - User creating the album
   * @returns Album with resolved images
   */
  async createAlbum(
    projectId: ProjectId,
    galleryType: GalleryType,
    imageIds: ReferenceImageId[],
    userId: UserId
  ): Promise<Result<ReferenceAlbum>> {
    try {
      // Validate inputs
      if (imageIds.length < 2) {
        return Err({
          code: 'INVALID_INPUT',
          message: 'Albums must contain at least 2 images',
        });
      }

      // Verify all images exist and belong to the project
      const placeholders = imageIds.map((_, i) => `$${i + 1}`).join(',');
      const imagesResult = await dbAdapter.query<{
        id: ReferenceImageId;
        project_id: ProjectId;
        gallery_type: GalleryType;
      }>(
        `
          SELECT id, project_id, gallery_type
          FROM project_reference_images
          WHERE id IN (${placeholders})
          AND is_deleted = 0
        `,
        imageIds,
        { schema: 'content' }
      );

      if (imagesResult.rows.length !== imageIds.length) {
        return Err({
          code: 'NOT_FOUND',
          message: 'One or more images not found',
        });
      }

      // Verify all images belong to the same project and gallery
      const invalidImages = imagesResult.rows.filter(
        img => img.project_id !== projectId || img.gallery_type !== galleryType
      );
      if (invalidImages.length > 0) {
        return Err({
          code: 'INVALID_INPUT',
          message: 'All images must belong to the same project and gallery type',
        });
      }

      // Create album with transaction for atomic operations
      const albumId = await dbAdapter.transaction(
        async () => {
          const insertResult = await dbAdapter.query<{ id: AlbumId }>(
            `
            INSERT INTO reference_albums (project_id, gallery_type, created_by)
            VALUES ($1, $2, $3)
            RETURNING id
          `,
            [projectId, galleryType, userId],
            { schema: 'content' }
          );

          const newAlbumId = brandAlbumId(insertResult.rows[0]!.id);

          // Remove images from any existing albums (exclusive membership)
          await dbAdapter.query(
            `
          DELETE FROM reference_album_images
          WHERE image_id IN (${placeholders})
        `,
            imageIds,
            { schema: 'content' }
          );

          // Add images to new album with positions
          for (let i = 0; i < imageIds.length; i++) {
            await dbAdapter.query(
              `
            INSERT INTO reference_album_images (album_id, image_id, position)
            VALUES ($1, $2, $3)
          `,
              [newAlbumId, imageIds[i], i],
              { schema: 'content' }
            );
          }

          return newAlbumId;
        },
        { schema: 'content' }
      );

      logger.info('Album created', { albumId, projectId, imageCount: imageIds.length });

      // Return the created album with images
      return this.getAlbum(albumId);
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to create album', { projectId, imageIds, error: errorDetail });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to create album',
        details: serializeError(error),
      });
    }
  }

  /**
   * Get a single album with its images
   * @param albumId - Album ID
   * @returns Album with resolved images ordered by position
   */
  async getAlbum(albumId: AlbumId): Promise<Result<ReferenceAlbum>> {
    try {
      // Get album record
      const albumResult = await dbAdapter.query<ReferenceAlbumRecord>(
        `
          SELECT * FROM reference_albums
          WHERE id = $1
        `,
        [albumId],
        { schema: 'content' }
      );

      if (albumResult.rows.length === 0) {
        return Err({
          code: 'NOT_FOUND',
          message: 'Album not found',
        });
      }

      const album = albumResult.rows[0]!;

      // Get album images with tags
      const imagesResult = await dbAdapter.query<ReferenceImageRecord>(
        `
          SELECT img.*,
            (COALESCE(img.width, 0) * COALESCE(img.height, 0)) as pixel_count
          FROM reference_album_images rai
          JOIN project_reference_images img ON rai.image_id = img.id
          WHERE rai.album_id = $1
          AND img.is_deleted = 0
          ORDER BY rai.position
        `,
        [albumId],
        { schema: 'content' }
      );

      const images = imagesResult.rows;

      // Get tags for all images
      if (images.length > 0) {
        const imageIds = images.map(img => img.id);
        const tagsPlaceholders = imageIds.map((_, i) => `$${i + 1}`).join(',');
        const tagsQuery = `
          SELECT
            prt.reference_id as image_id,
            rt.id,
            rt.name,
            rt.color,
            rt.display_order,
            rc.id as category_id,
            rc.name as category_name
          FROM project_reference_image_tags prt
          JOIN reference_tags rt ON prt.tag_id = rt.id
          JOIN reference_categories rc ON rt.category_id = rc.id
          WHERE prt.reference_id IN (${tagsPlaceholders})
          ORDER BY rc.display_order, rt.display_order
        `;

        const tagsResult = await dbAdapter.query<any>(tagsQuery, imageIds, { schema: 'content' });
        const allTags = tagsResult.rows;

        // Group tags by image
        const tagsByImage = new Map<ReferenceImageId, ReferenceTag[]>();
        for (const tag of allTags) {
          if (!tagsByImage.has(tag.image_id)) {
            tagsByImage.set(tag.image_id, []);
          }
          tagsByImage.get(tag.image_id)!.push({
            id: tag.id,
            name: tag.name,
            color: tag.color,
            category: {
              id: tag.category_id,
              name: tag.category_name,
            },
            display_order: tag.display_order,
          });
        }

        // Batch fetch user data
        const uploaderIds = images.map(img => img.uploaded_by);
        const uploaderMap = await this.getUsersByIds(uploaderIds);

        // Transform images
        const resolvedImages: ReferenceImage[] = images.map(img => {
          const uploader = uploaderMap.get(img.uploaded_by);

          return {
            id: img.id,
            project_id: img.project_id,
            filename_storage: img.filename_storage,
            file_path: img.file_path,
            file_size: img.file_size,
            mime_type: img.mime_type,
            width: img.width,
            height: img.height,
            aspect_ratio: img.aspect_ratio,
            sort_order: img.sort_order,
            tags: tagsByImage.get(img.id) || [],
            uploader: uploader
              ? {
                  id: uploader.id,
                  username: uploader.username,
                  display_name: uploader.display_name,
                }
              : null,
            is_deleted: Boolean(img.is_deleted),
            deleted_at: img.deleted_at,
            created_at: img.created_at,
            updated_at: img.updated_at,
          };
        });

        const result: ReferenceAlbum = {
          id: album.id,
          project_id: album.project_id,
          gallery_type: album.gallery_type,
          name: album.name,
          created_by: album.created_by,
          created_at: album.created_at,
          updated_at: album.updated_at,
          images: resolvedImages,
          image_count: resolvedImages.length,
        };

        return Ok(result);
      } else {
        // Empty album (shouldn't happen, but handle gracefully)
        const result: ReferenceAlbum = {
          id: album.id,
          project_id: album.project_id,
          gallery_type: album.gallery_type,
          name: album.name,
          created_by: album.created_by,
          created_at: album.created_at,
          updated_at: album.updated_at,
          images: [],
          image_count: 0,
        };

        return Ok(result);
      }
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to get album', { albumId, error: errorDetail });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve album',
        details: serializeError(error),
      });
    }
  }

  /**
   * Get all albums for a project/gallery
   * @param projectId - Project ID
   * @param galleryType - Gallery type
   * @returns Array of albums with resolved images
   */
  async getAlbums(
    projectId: ProjectId,
    galleryType: GalleryType
  ): Promise<Result<ReferenceAlbum[]>> {
    try {
      // Get all albums for project/gallery
      const albumsResult = await dbAdapter.query<ReferenceAlbumRecord>(
        `
          SELECT * FROM reference_albums
          WHERE project_id = $1 AND gallery_type = $2
          ORDER BY created_at DESC
        `,
        [projectId, galleryType],
        { schema: 'content' }
      );

      if (albumsResult.rows.length === 0) {
        return Ok([]);
      }

      // Resolve each album
      const resolvedAlbums: ReferenceAlbum[] = [];
      for (const albumRecord of albumsResult.rows) {
        const albumResult = await this.getAlbum(albumRecord.id);
        if (albumResult.ok) {
          resolvedAlbums.push(albumResult.value);
        }
      }

      return Ok(resolvedAlbums);
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to get albums', { projectId, galleryType, error: errorDetail });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve albums',
        details: serializeError(error),
      });
    }
  }

  /**
   * Add an image to an existing album
   * Image is removed from its previous album if it was in one
   * @param albumId - Album ID
   * @param imageId - Image ID to add
   * @param userId - User performing the operation
   */
  async addImageToAlbum(
    albumId: AlbumId,
    imageId: ReferenceImageId,
    userId: UserId
  ): Promise<Result<void>> {
    try {
      // Verify album exists
      const albumResult = await dbAdapter.query<ReferenceAlbumRecord>(
        'SELECT * FROM reference_albums WHERE id = $1',
        [albumId],
        { schema: 'content' }
      );

      if (albumResult.rows.length === 0) {
        return Err({
          code: 'NOT_FOUND',
          message: 'Album not found',
        });
      }

      const album = albumResult.rows[0]!;

      // Verify image exists and matches project/gallery
      const imageResult = await dbAdapter.query<ReferenceImageRecord>(
        `
          SELECT * FROM project_reference_images
          WHERE id = $1 AND project_id = $2 AND gallery_type = $3 AND is_deleted = 0
        `,
        [imageId, album.project_id, album.gallery_type],
        { schema: 'content' }
      );

      if (imageResult.rows.length === 0) {
        return Err({
          code: 'NOT_FOUND',
          message: 'Image not found or does not match album project/gallery',
        });
      }

      // Add image to album with transaction for atomic operations
      await dbAdapter.transaction(
        async () => {
          // Get current max position in album
          const maxPosResult = await dbAdapter.query<{ max_position: number | null }>(
            `
            SELECT MAX(position) as max_position
            FROM reference_album_images
            WHERE album_id = $1
          `,
            [albumId],
            { schema: 'content' }
          );

          const position = (maxPosResult.rows[0]?.max_position ?? -1) + 1;

          // Remove from any existing album (exclusive membership)
          await dbAdapter.query(
            'DELETE FROM reference_album_images WHERE image_id = $1',
            [imageId],
            {
              schema: 'content',
            }
          );

          // Add to album
          await dbAdapter.query(
            `
          INSERT INTO reference_album_images (album_id, image_id, position)
          VALUES ($1, $2, $3)
        `,
            [albumId, imageId, position],
            { schema: 'content' }
          );

          // Update album timestamp
          await dbAdapter.query(
            'UPDATE reference_albums SET updated_at = NOW() WHERE id = $1',
            [albumId],
            { schema: 'content' }
          );
        },
        { schema: 'content' }
      );

      logger.info('Image added to album', { albumId, imageId });
      return Ok(undefined);
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to add image to album', { albumId, imageId, error: errorDetail });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to add image to album',
        details: serializeError(error),
      });
    }
  }

  /**
   * Remove an image from an album
   * If album becomes empty, it is deleted
   * @param albumId - Album ID
   * @param imageId - Image ID to remove
   * @param userId - User performing the operation
   */
  async removeImageFromAlbum(
    albumId: AlbumId,
    imageId: ReferenceImageId,
    userId: UserId
  ): Promise<Result<void>> {
    try {
      // Remove image and handle album deletion/reordering with transaction
      const wasDeleted = await dbAdapter.transaction(
        async () => {
          // Remove image from album
          const deleteResult = await dbAdapter.query(
            `
            DELETE FROM reference_album_images
            WHERE album_id = $1 AND image_id = $2
          `,
            [albumId, imageId],
            { schema: 'content' }
          );

          if (deleteResult.rowCount === 0) {
            throw new Error('Image not found in album');
          }

          // Check if album is now empty
          const countResult = await dbAdapter.query<{ count: number }>(
            `
            SELECT COUNT(*) as count
            FROM reference_album_images
            WHERE album_id = $1
          `,
            [albumId],
            { schema: 'content' }
          );

          if (Number(countResult.rows[0]!.count) === 0) {
            // Delete empty album
            await dbAdapter.query('DELETE FROM reference_albums WHERE id = $1', [albumId], {
              schema: 'content',
            });
            logger.info('Empty album deleted', { albumId });
            return true;
          } else {
            // Update album timestamp
            await dbAdapter.query(
              'UPDATE reference_albums SET updated_at = NOW() WHERE id = $1',
              [albumId],
              { schema: 'content' }
            );

            // Reorder remaining images to maintain sequential positions
            const imagesResult = await dbAdapter.query<{
              image_id: ReferenceImageId;
              position: number;
            }>(
              `
              SELECT image_id, position
              FROM reference_album_images
              WHERE album_id = $1
              ORDER BY position
            `,
              [albumId],
              { schema: 'content' }
            );

            for (let i = 0; i < imagesResult.rows.length; i++) {
              const img = imagesResult.rows[i];
              if (img && img.position !== i) {
                await dbAdapter.query(
                  `
                UPDATE reference_album_images
                SET position = $1
                WHERE album_id = $2 AND image_id = $3
              `,
                  [i, albumId, img.image_id],
                  { schema: 'content' }
                );
              }
            }
            return false;
          }
        },
        { schema: 'content' }
      );

      logger.info('Image removed from album', { albumId, imageId, albumDeleted: wasDeleted });
      return Ok(undefined);
    } catch (error) {
      // Check if error is "Image not found in album"
      if (error instanceof Error && error.message === 'Image not found in album') {
        return Err({
          code: 'NOT_FOUND',
          message: 'Image not found in album',
        });
      }

      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to remove image from album', { albumId, imageId, error: errorDetail });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to remove image from album',
        details: serializeError(error),
      });
    }
  }

  /**
   * Reorder images within an album
   * @param albumId - Album ID
   * @param orderedImageIds - Array of image IDs in desired order
   * @param userId - User performing the operation
   */
  async reorderAlbumImages(
    albumId: AlbumId,
    orderedImageIds: ReferenceImageId[],
    userId: UserId
  ): Promise<Result<void>> {
    try {
      // Verify album exists
      const albumResult = await dbAdapter.query<ReferenceAlbumRecord>(
        'SELECT * FROM reference_albums WHERE id = $1',
        [albumId],
        { schema: 'content' }
      );

      if (albumResult.rows.length === 0) {
        return Err({
          code: 'NOT_FOUND',
          message: 'Album not found',
        });
      }

      // Get current images in album
      const currentImagesResult = await dbAdapter.query<{ image_id: ReferenceImageId }>(
        `
          SELECT image_id
          FROM reference_album_images
          WHERE album_id = $1
        `,
        [albumId],
        { schema: 'content' }
      );

      const currentImageIds = currentImagesResult.rows.map(img => img.image_id);

      // Verify all provided IDs are in the album
      const missingIds = orderedImageIds.filter(id => !currentImageIds.includes(id));
      if (missingIds.length > 0) {
        return Err({
          code: 'INVALID_INPUT',
          message: 'One or more images not found in album',
        });
      }

      // Verify all current images are in the provided order
      const extraIds = currentImageIds.filter(id => !orderedImageIds.includes(id));
      if (extraIds.length > 0) {
        return Err({
          code: 'INVALID_INPUT',
          message: 'Ordered list must include all images in album',
        });
      }

      // Update positions with transaction for atomic operations
      await dbAdapter.transaction(
        async () => {
          for (let i = 0; i < orderedImageIds.length; i++) {
            await dbAdapter.query(
              `
            UPDATE reference_album_images
            SET position = $1
            WHERE album_id = $2 AND image_id = $3
          `,
              [i, albumId, orderedImageIds[i]],
              { schema: 'content' }
            );
          }

          // Update album timestamp
          await dbAdapter.query(
            'UPDATE reference_albums SET updated_at = NOW() WHERE id = $1',
            [albumId],
            { schema: 'content' }
          );
        },
        { schema: 'content' }
      );

      logger.info('Album images reordered', { albumId, imageCount: orderedImageIds.length });
      return Ok(undefined);
    } catch (error) {
      logger.error('Failed to reorder album images', { albumId, error });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to reorder album images',
        details: serializeError(error),
      });
    }
  }

  /**
   * Combine multiple albums into a target album
   * Moves all images from source albums into target album and deletes source albums
   */
  async combineAlbums(
    targetAlbumId: AlbumId,
    sourceAlbumIds: AlbumId[],
    userId: UserId
  ): Promise<Result<ReferenceAlbum, ReferenceImageServiceError>> {
    try {
      logger.info('Combining albums', { targetAlbumId, sourceAlbumIds, userId });

      // Validate target album exists
      const targetAlbumResult = await dbAdapter.query<ReferenceAlbumRecord>(
        'SELECT * FROM reference_albums WHERE id = $1',
        [targetAlbumId],
        { schema: 'content' }
      );

      if (targetAlbumResult.rows.length === 0) {
        return Err({
          code: 'NOT_FOUND',
          message: 'Target album not found',
        });
      }

      const targetAlbum = targetAlbumResult.rows[0]!;

      // Validate all source albums exist and belong to same project
      for (const sourceId of sourceAlbumIds) {
        const sourceAlbumResult = await dbAdapter.query<ReferenceAlbumRecord>(
          'SELECT * FROM reference_albums WHERE id = $1',
          [sourceId],
          { schema: 'content' }
        );

        if (sourceAlbumResult.rows.length === 0) {
          return Err({
            code: 'NOT_FOUND',
            message: `Source album ${sourceId} not found`,
          });
        }

        const sourceAlbum = sourceAlbumResult.rows[0]!;

        if (sourceAlbum.project_id !== targetAlbum.project_id) {
          return Err({
            code: 'INVALID_INPUT',
            message: 'All albums must belong to the same project',
          });
        }
      }

      // Perform combination in transaction
      await dbAdapter.transaction(
        async () => {
          // Get max position in target album for sequential ordering
          const maxPosResult = await dbAdapter.query<{ max_pos: number }>(
            'SELECT COALESCE(MAX(position), -1) as max_pos FROM reference_album_images WHERE album_id = $1',
            [targetAlbumId],
            { schema: 'content' }
          );

          let nextPosition = maxPosResult.rows[0]!.max_pos + 1;

          // Move images from each source album to target album
          for (const sourceId of sourceAlbumIds) {
            // Get images from source album FIRST (before deletion)
            const sourceImagesResult = await dbAdapter.query<{
              image_id: ReferenceImageId;
              position: number;
            }>(
              'SELECT image_id, position FROM reference_album_images WHERE album_id = $1 ORDER BY position',
              [sourceId],
              { schema: 'content' }
            );

            // Delete source album FIRST (CASCADE removes album_images, freeing UNIQUE constraint on image_id)
            await dbAdapter.query('DELETE FROM reference_albums WHERE id = $1', [sourceId], {
              schema: 'content',
            });

            // NOW add images to target album (UNIQUE constraint is satisfied)
            for (const img of sourceImagesResult.rows) {
              await dbAdapter.query(
                `
              INSERT INTO reference_album_images (album_id, image_id, position)
              VALUES ($1, $2, $3)
            `,
                [targetAlbumId, img.image_id, nextPosition],
                { schema: 'content' }
              );
              nextPosition++;
            }
          }

          // Update target album timestamp
          await dbAdapter.query(
            'UPDATE reference_albums SET updated_at = NOW() WHERE id = $1',
            [targetAlbumId],
            { schema: 'content' }
          );
        },
        { schema: 'content' }
      );

      // Fetch and return updated target album
      const result = await this.getAlbum(targetAlbumId);
      if (!result.ok) {
        return result;
      }

      logger.info('Albums combined successfully', {
        targetAlbumId,
        sourceCount: sourceAlbumIds.length,
        totalImages: result.value.image_count,
      });

      return Ok(result.value);
    } catch (error) {
      logger.error('Failed to combine albums', { targetAlbumId, sourceAlbumIds, error });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to combine albums',
        details: serializeError(error),
      });
    }
  }

  /**
   * Update the created_at date of an image
   * Used for fixing or changing image metadata dates
   */
  async updateImageDate(
    imageId: ReferenceImageId,
    created_at: string,
    userId: UserId
  ): Promise<Result<ReferenceImage>> {
    try {
      // Verify image exists
      const existingResult = await dbAdapter.query<any>(
        'SELECT id FROM project_reference_images WHERE id = $1',
        [imageId],
        { schema: 'content' }
      );

      if (existingResult.rows.length === 0) {
        return Err({
          code: 'NOT_FOUND',
          message: `Image with ID ${imageId} not found`,
        });
      }

      // Update the date
      await dbAdapter.query(
        `UPDATE project_reference_images
         SET created_at = $1, updated_at = NOW()
         WHERE id = $2`,
        [created_at, imageId],
        { schema: 'content' }
      );

      // Fetch and return updated image
      const imageResult = await this.getImageById(imageId);

      if (!imageResult.ok) {
        return Err({
          code: 'NOT_FOUND',
          message: 'Failed to retrieve updated image',
        });
      }

      logger.info('Image date updated', { imageId, created_at, userId });
      return Ok(imageResult.value);
    } catch (error) {
      logger.error('Failed to update image date', { imageId, created_at, error });
      return Err({
        code: 'DATABASE_ERROR',
        message: 'Failed to update image date',
        details: serializeError(error),
      });
    }
  }
}

// Export singleton instance
export const projectGalleryService = new ProjectGalleryService();
