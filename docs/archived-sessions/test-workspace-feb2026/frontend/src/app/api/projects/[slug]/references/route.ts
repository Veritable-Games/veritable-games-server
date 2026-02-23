import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { projectGalleryService } from '@/lib/projects/gallery-service';
import { withSecurity } from '@/lib/security/middleware';
import { writeFile, mkdir, stat, utimes } from 'fs/promises';
import path from 'path';
import {
  validateImageUpload,
  extractImageDates,
  formatDateForSQL,
} from '@/lib/security/file-upload-validator';
import type { ProjectId, ReferenceTagId, UserId } from '@/lib/database/schema-types';
import type { CreateReferenceImageInput } from '@/types/project-references';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[slug]/references
 * Get all reference images for a project with optional filtering
 */
export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const searchParams = request.nextUrl.searchParams;

    // Get project ID from slug
    const { dbAdapter } = await import('@/lib/database/adapter');
    const projectResult = await dbAdapter.query('SELECT id FROM projects WHERE slug = $1', [slug], {
      schema: 'content',
    });
    const project = projectResult.rows[0] as { id: ProjectId } | undefined;

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse query parameters
    const tagIds = searchParams.get('tags')?.split(',').filter(Boolean) as
      | ReferenceTagId[]
      | undefined;
    const limit = parseInt(searchParams.get('limit') || '100');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;
    const sortBy = (searchParams.get('sortBy') || 'default') as 'default' | 'dimensions';

    const result = await projectGalleryService.getProjectImages(
      'references',
      {
        project_id: project.id,
        tag_ids: tagIds,
        limit,
        offset,
      },
      sortBy
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.value);
  } catch (error) {
    logger.error('Error fetching reference images:', error);
    return NextResponse.json({ error: 'Failed to fetch reference images' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[slug]/references
 * Upload new reference images (admin only)
 */
async function uploadReferencesHandler(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    // Check authentication and admin authorization
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get project
    const { dbAdapter } = await import('@/lib/database/adapter');
    const projectResult = await dbAdapter.query('SELECT id FROM projects WHERE slug = $1', [slug], {
      schema: 'content',
    });
    const project = projectResult.rows[0] as { id: ProjectId } | undefined;

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const tagIds = formData.get('tag_ids')?.toString().split(',').filter(Boolean) as
      | ReferenceTagId[]
      | undefined;
    const userProvidedDate = formData.get('date_created')?.toString(); // YYYY-MM-DD format from user

    // Parse explicit metadata sent from client
    // (FormData doesn't serialize File.lastModified, so we send it separately)
    let filesMetadata: Array<{ name: string; lastModified: number; size: number }> = [];
    const filesMetadataStr = formData.get('files_metadata')?.toString();
    if (filesMetadataStr) {
      try {
        const parsed = JSON.parse(filesMetadataStr);
        filesMetadata = [parsed]; // Single file upload
      } catch (error) {
        logger.warn('[Warning] Failed to parse files_metadata:', error);
      }
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Validate files
    const validTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/avif',
    ];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const uploadResults = [];

    for (const file of files) {
      try {
        // Validate file with comprehensive security checks
        const validation = await validateImageUpload(file, {
          maxSizeBytes: maxSize,
          allowedMimeTypes: validTypes,
          requireDimensionValidation: true,
        });

        if (!validation.valid) {
          uploadResults.push({
            filename: file.name,
            success: false,
            error: validation.error || 'File validation failed',
          });
          continue;
        }

        // Extract validated data
        const { safeFilename, detectedMimeType, dimensions } = validation;
        const filename = safeFilename!;
        const width = dimensions?.width ?? undefined;
        const height = dimensions?.height ?? undefined;

        // Ensure upload directory exists
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'references', slug);
        await mkdir(uploadDir, { recursive: true });

        // Read file buffer for writing
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Write file to disk
        const filePath = path.join(uploadDir, filename);
        await writeFile(filePath, buffer);

        // CRITICAL: Restore original file timestamp from explicit metadata
        // FormData doesn't serialize File.lastModified (HTML spec limitation)
        // We receive it as separate 'files_metadata' JSON sent from client
        const metadata = filesMetadata[0]; // Single file in this loop
        if (metadata && metadata.lastModified) {
          const originalDate = new Date(metadata.lastModified);
          logger.info(`[DEBUG] Restoring timestamp from metadata: ${originalDate.toISOString()}`);
          await utimes(filePath, originalDate, originalDate);
        }

        // Get filesystem stats from the saved file (now with restored timestamps)
        const fileStats = await stat(filePath);

        // Extract metadata dates (EXIF + filesystem timestamps)
        // The mtime should now reflect the original file's modification date
        let createdAt: string | undefined;

        if (userProvidedDate) {
          // 1. User-provided date (highest priority)
          createdAt = `${userProvidedDate} 00:00:00`;
          logger.info(`[DEBUG] Using user-provided date: ${createdAt}`);
        } else {
          // 2-4. Extract from image and file metadata
          const dates = await extractImageDates(buffer, {
            mtime: fileStats.mtime,
            birthtime: fileStats.birthtime,
          });
          const formatted = dates.earliestDate ? formatDateForSQL(dates.earliestDate) : null;
          createdAt = formatted || undefined;
          logger.info(
            `[DEBUG] Using extracted date: ${createdAt} (EXIF: ${dates.exifDate?.toISOString()}, filesystem: ${dates.fileModified?.toISOString()})`
          );
        }

        // Create database record
        const relativePath = `/uploads/references/${slug}/${filename}`;
        const input: CreateReferenceImageInput = {
          project_id: project.id,
          filename_storage: filename,
          file_path: relativePath,
          file_size: file.size,
          mime_type: detectedMimeType!, // Use detected MIME type, not client-provided
          width,
          height,
          tag_ids: tagIds,
          created_at: createdAt || undefined, // Use earliest available date
        };

        const result = await projectGalleryService.createImage(
          'references',
          input,
          user.id as UserId
        );

        if (!result.ok) {
          // Handle duplicate file error - return 409 Conflict
          if (result.error.code === 'DUPLICATE') {
            return NextResponse.json(
              {
                success: false,
                error: 'Duplicate file',
                message: result.error.message,
                details: 'This file has already been uploaded to this gallery',
              },
              { status: 409 }
            );
          }

          uploadResults.push({
            filename: file.name,
            success: false,
            error: result.error.message,
          });
        } else {
          uploadResults.push({
            filename: file.name,
            success: true,
            image_id: result.value,
            file_path: relativePath,
          });
        }
      } catch (error) {
        logger.error(`Error processing file: ${file.name}`, error);
        uploadResults.push({
          filename: file.name,
          success: false,
          error: 'Failed to process image',
        });
      }
    }

    const successCount = uploadResults.filter(r => r.success).length;
    const failCount = uploadResults.filter(r => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      message: `Uploaded ${successCount} of ${files.length} images`,
      results: uploadResults,
    });
  } catch (error) {
    logger.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to upload images' }, { status: 500 });
  }
}

// Apply security middleware to POST (no rate limiting for admin-only endpoint)
export const POST = withSecurity(uploadReferencesHandler);
