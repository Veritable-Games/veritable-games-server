/**
 * Video Upload API Route
 *
 * Handles video uploads with automatic FFmpeg transcoding:
 * 1. Receives video file from client
 * 2. Saves to temporary storage
 * 3. Transcodes with FFmpeg (H.265, 720p, CRF 26)
 * 4. Extracts thumbnail at 1 second
 * 5. Saves compressed video and thumbnail to public/uploads/videos/
 * 6. Creates database record
 * 7. Cleans up temp files
 *
 * REQUIREMENTS:
 * - FFmpeg must be installed on server
 * - Admin authentication required
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { writeFile, readFile, unlink, mkdir, utimes, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import {
  transcodeVideo,
  extractThumbnail,
  isFFmpegAvailable,
  calculateCompressionRatio,
  getVideoMetadata,
} from '@/lib/video/transcoding-service';
import { extractVideoDates, formatDateForSQL } from '@/lib/security/file-upload-validator';
import { dbAdapter } from '@/lib/database/adapter';
import { UploadLogger } from '@/lib/utils/upload-logger';
import type { ProjectId, UserId } from '@/lib/database/schema-types';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface UploadResponse {
  success: boolean;
  videoId?: number;
  filePath?: string;
  message?: string;
  metadata?: {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    duration: number;
    resolution: string;
  };
  error?: string;
}

async function uploadVideoHandler(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
): Promise<NextResponse<UploadResponse>> {
  // Create logger for this upload request
  const logger = new UploadLogger(`api-${Date.now()}`, 'VideoUploadAPI');

  try {
    const { slug } = await context.params;
    logger.info('upload', 'Video upload request received', { slug });

    // 1. Check authentication and authorization
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    // 2. Check if FFmpeg is available
    const ffmpegAvailable = await isFFmpegAvailable();
    if (!ffmpegAvailable) {
      return NextResponse.json(
        {
          success: false,
          error: 'FFmpeg not installed on server. Please install FFmpeg to enable video uploads.',
        },
        { status: 500 }
      );
    }

    // 3. Get project
    const projectResult = await dbAdapter.query('SELECT id FROM projects WHERE slug = $1', [slug], {
      schema: 'content',
    });
    const project = projectResult.rows[0] as { id: ProjectId } | undefined;

    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    // 4. Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const tagIds = formData.get('tag_ids')?.toString().split(',').filter(Boolean) || [];
    const title = formData.get('title')?.toString() || null;
    const description = formData.get('description')?.toString() || null;
    const userProvidedDate = formData.get('date_created')?.toString() || null;
    const filesMetadataStr = formData.get('files_metadata')?.toString();

    // Parse files_metadata JSON
    let originalFileTimestamp: number | undefined;
    if (filesMetadataStr) {
      try {
        const filesMetadata = JSON.parse(filesMetadataStr);
        originalFileTimestamp = filesMetadata.lastModified; // Browser's File.lastModified
      } catch (error) {
        logger.warn('upload', 'Failed to parse files_metadata', {
          error: (error as Error).message,
        });
      }
    }

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // 5. Validate file type
    if (!file.type.startsWith('video/')) {
      return NextResponse.json({ success: false, error: 'File must be a video' }, { status: 400 });
    }

    // 6. Validate file size (100MB max before compression)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large. Maximum size: 100MB. Your file: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
        },
        { status: 400 }
      );
    }

    // 7. Create temp file paths
    const timestamp = Date.now();
    const tempInputPath = path.join('/tmp', `upload-${timestamp}-${file.name}`);
    const tempOutputPath = path.join('/tmp', `compressed-${timestamp}.mp4`);
    const tempThumbnailPath = path.join('/tmp', `thumb-${timestamp}.jpg`);

    try {
      // 8. Save uploaded file to temp storage
      const bytes = await file.arrayBuffer();
      await writeFile(tempInputPath, Buffer.from(bytes));

      logger.info('upload', 'Video saved to temp storage', {
        filename: file.name,
        originalSizeMB: (file.size / 1024 / 1024).toFixed(2),
        tempPath: tempInputPath,
        timestamp,
      });

      // 8b. Restore original file timestamp if available
      if (originalFileTimestamp) {
        try {
          const originalDate = new Date(originalFileTimestamp);
          await utimes(tempInputPath, originalDate, originalDate);
          logger.info('upload', 'Restored original file timestamp', {
            originalTimestamp: originalFileTimestamp,
            restoredDate: originalDate.toISOString(),
          });
        } catch (error) {
          logger.warn('upload', 'Failed to restore file timestamp', {
            error: (error as Error).message,
          });
        }
      }

      // 8c. Extract metadata from ORIGINAL file (before transcoding)
      let originalMetadata;
      try {
        originalMetadata = await getVideoMetadata(tempInputPath);
        logger.info('metadata', 'Extracted metadata from original video', {
          duration: originalMetadata.duration,
          resolution: `${originalMetadata.width}x${originalMetadata.height}`,
          codec: originalMetadata.codec,
          hasCreationTime: !!originalMetadata.creationTime,
          creationTime: originalMetadata.creationTime?.toISOString(),
        });
      } catch (error) {
        logger.warn('metadata', 'Failed to extract original video metadata', {
          error: (error as Error).message,
        });
      }

      // 8d. Get file stats for date extraction
      const fileStats = await stat(tempInputPath);
      logger.info('metadata', 'Got file stats', {
        mtime: fileStats.mtime.toISOString(),
        birthtime: fileStats.birthtime?.toISOString(),
      });

      // 9. Transcode video with FFmpeg
      logger.info('transcode', 'Starting FFmpeg transcoding', {
        inputPath: tempInputPath,
        outputPath: tempOutputPath,
        resolution: '720p',
        crf: 26,
      });
      const transcodingResult = await transcodeVideo({
        inputPath: tempInputPath,
        outputPath: tempOutputPath,
        resolution: '720p',
        crf: 26,
        preset: 'medium',
        onProgress: progress => {
          logger.info('transcode-progress', 'FFmpeg encoding progress', {
            percent: progress.percent,
            currentTime: `${Math.floor(progress.currentTime)}s`,
            totalDuration: `${Math.floor(progress.totalDuration)}s`,
            fps: progress.fps,
            speed: `${progress.speed}x`,
            frame: progress.frame,
            bitrate: progress.bitrate,
          });
        },
      });

      if (!transcodingResult.success) {
        logger.error('transcode', 'FFmpeg transcoding failed', {
          error: transcodingResult.error,
          inputPath: tempInputPath,
          expectedOutput: tempOutputPath,
        });
        await unlink(tempInputPath).catch(() => {});
        return NextResponse.json(
          { success: false, error: `Video transcoding failed: ${transcodingResult.error}` },
          { status: 500 }
        );
      }

      logger.info('transcode', 'FFmpeg transcoding complete', {
        durationSeconds: transcodingResult.duration,
        resolution: `${transcodingResult.width}x${transcodingResult.height}`,
        compressedSizeMB: ((transcodingResult.fileSize || 0) / 1024 / 1024).toFixed(2),
        compressionRatio: calculateCompressionRatio(file.size, transcodingResult.fileSize || 0),
      });

      // 10. Extract thumbnail
      logger.info('ffmpeg', 'Extracting video thumbnail', {
        inputPath: tempOutputPath,
        outputPath: tempThumbnailPath,
        timeSeconds: 1,
        width: 640,
      });
      const thumbnailResult = await extractThumbnail({
        inputPath: tempOutputPath,
        outputPath: tempThumbnailPath,
        timeSeconds: 1,
        width: 640,
      });

      if (!thumbnailResult.success) {
        logger.warn('ffmpeg', 'Thumbnail extraction failed (optional, continuing)', {
          error: thumbnailResult.error,
        });
        // Continue anyway - thumbnail is optional
      } else {
        logger.info('ffmpeg', 'Thumbnail extracted successfully', {
          outputPath: tempThumbnailPath,
        });
      }

      // 11. Create permanent storage directories
      const videoDir = path.join(process.cwd(), 'public', 'uploads', 'videos', slug);
      const thumbDir = path.join(videoDir, 'thumbs');

      if (!existsSync(videoDir)) {
        await mkdir(videoDir, { recursive: true });
      }
      if (!existsSync(thumbDir)) {
        await mkdir(thumbDir, { recursive: true });
      }

      // 12. Generate safe filenames
      const videoFilename = `video_${timestamp}.mp4`;
      const thumbFilename = `video_${timestamp}_thumb.jpg`;

      const videoPath = path.join(videoDir, videoFilename);
      const thumbPath = path.join(thumbDir, thumbFilename);

      // 13. Move files to permanent storage
      const videoBuffer = await readFile(tempOutputPath);
      await writeFile(videoPath, videoBuffer);

      let savedThumbPath = null;
      if (thumbnailResult.success) {
        const thumbBuffer = await readFile(tempThumbnailPath);
        await writeFile(thumbPath, thumbBuffer);
        savedThumbPath = `/uploads/videos/${slug}/thumbs/${thumbFilename}`;
      }

      // 14. Extract and determine creation date
      // Priority: user override > container metadata > filesystem dates
      let createdAt: string | null = null;

      if (userProvidedDate) {
        // User explicitly provided a date (YYYY-MM-DD format)
        createdAt = `${userProvidedDate} 00:00:00`;
        logger.info('metadata', 'Using user-provided date', {
          dateCreated: userProvidedDate,
          formattedDate: createdAt,
        });
      } else {
        // Extract dates from video metadata and filesystem
        const dates = await extractVideoDates(originalMetadata, {
          mtime: fileStats.mtime,
          birthtime: fileStats.birthtime,
        });

        logger.info('metadata', 'Extracted video dates', {
          containerDate: dates.containerDate?.toISOString(),
          fileModified: dates.fileModified?.toISOString(),
          fileCreated: dates.fileCreated?.toISOString(),
          earliestDate: dates.earliestDate?.toISOString(),
        });

        // Use the earliest date we could extract
        if (dates.earliestDate) {
          createdAt = formatDateForSQL(dates.earliestDate);
          logger.info('metadata', 'Using extracted creation date', {
            source: dates.containerDate ? 'container metadata' : 'filesystem',
            createdAt,
          });
        }
      }

      // Fallback to current time if no date could be determined
      if (!createdAt) {
        logger.warn('metadata', 'No creation date found, using current time');
      }

      // 15. Create database record
      const videoUrl = `/uploads/videos/${slug}/${videoFilename}`;
      const insertResult = await dbAdapter.query(
        `
        INSERT INTO project_reference_images (
          project_id, filename_storage, file_path, file_size, mime_type,
          width, height, duration, poster_path, uploaded_by, gallery_type,
          title, description, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'history', $11, $12, $13)
        RETURNING id
      `,
        [
          project.id,
          videoFilename,
          videoUrl,
          transcodingResult.fileSize,
          'video/mp4',
          transcodingResult.width,
          transcodingResult.height,
          transcodingResult.duration,
          savedThumbPath,
          user.id,
          title,
          description,
          createdAt || null, // Use extracted date or let DB default to NOW()
        ],
        { schema: 'content' }
      );
      const videoId = insertResult.rows[0].id as number;

      // Insert tags if provided
      if (tagIds.length > 0) {
        for (const tagId of tagIds) {
          await dbAdapter.query(
            'INSERT INTO project_reference_image_tags (reference_id, tag_id) VALUES ($1, $2)',
            [videoId, tagId],
            { schema: 'content' }
          );
        }

        logger.info('tags', 'Tags applied to video', {
          videoId,
          tagCount: tagIds.length,
          tagIds: tagIds,
        });
      }

      // 15. Cleanup temp files
      await Promise.all([
        unlink(tempInputPath).catch(() => {}),
        unlink(tempOutputPath).catch(() => {}),
        unlink(tempThumbnailPath).catch(() => {}),
      ]);

      logger.info('upload', 'Video upload complete', {
        videoId,
        url: videoUrl,
        posterPath: savedThumbPath,
        metadata: {
          originalSizeMB: (file.size / 1024 / 1024).toFixed(2),
          compressedSizeMB: ((transcodingResult.fileSize || 0) / 1024 / 1024).toFixed(2),
          compressionRatio: calculateCompressionRatio(file.size, transcodingResult.fileSize || 0),
        },
      });

      // 16. Return success response
      return NextResponse.json({
        success: true,
        videoId,
        filePath: videoUrl,
        message: 'Video uploaded and transcoded successfully',
        metadata: {
          originalSize: file.size,
          compressedSize: transcodingResult.fileSize || 0,
          compressionRatio: calculateCompressionRatio(file.size, transcodingResult.fileSize || 0),
          duration: transcodingResult.duration || 0,
          resolution: `${transcodingResult.width}x${transcodingResult.height}`,
        },
      });
    } catch (error) {
      // Cleanup temp files on error
      await Promise.all([
        unlink(tempInputPath).catch(() => {}),
        unlink(tempOutputPath).catch(() => {}),
        unlink(tempThumbnailPath).catch(() => {}),
      ]);

      throw error;
    }
  } catch (error) {
    logger.error('upload', 'Video upload error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    return NextResponse.json(
      {
        success: false,
        error: `Upload failed: ${(error as Error).message}`,
      },
      { status: 500 }
    );
  }
}

// Apply security middleware
export const POST = withSecurity(uploadVideoHandler);
