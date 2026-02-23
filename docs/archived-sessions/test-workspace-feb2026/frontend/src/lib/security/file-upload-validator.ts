/**
 * Secure File Upload Validator
 *
 * Provides comprehensive file upload security including:
 * - Magic byte verification
 * - MIME type validation
 * - Extension validation and enforcement
 * - Path traversal prevention
 * - File size limits
 */

import { createHash } from 'crypto';
import sharp from 'sharp';
import ExifParser from 'exif-parser';
import type { VideoMetadata } from '@/lib/video/transcoding-service';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  safeFilename?: string;
  detectedMimeType?: string;
  dimensions?: { width: number; height: number };
}

/**
 * Magic byte signatures for image formats
 */
const MAGIC_BYTES = {
  'image/jpeg': [{ bytes: [0xff, 0xd8, 0xff], offset: 0 }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0 }],
  'image/gif': [
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], offset: 0 }, // GIF87a
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], offset: 0 }, // GIF89a
  ],
  'image/webp': [
    {
      bytes: [0x52, 0x49, 0x46, 0x46],
      offset: 0,
      extraCheck: (buffer: Buffer) =>
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50,
    },
  ],
  'image/avif': [
    {
      bytes: [0x00, 0x00, 0x00],
      offset: 0,
      extraCheck: (buffer: Buffer) => {
        // AVIF files start with ftyp box
        const ftyp = buffer.slice(4, 8).toString('ascii');
        const brand = buffer.slice(8, 12).toString('ascii');
        return ftyp === 'ftyp' && ['avif', 'avis'].includes(brand);
      },
    },
  ],
  'image/vnd.adobe.photoshop': [{ bytes: [0x38, 0x42, 0x50, 0x53], offset: 0 }], // 8BPS - PSD signature
  'image/x-photoshop': [{ bytes: [0x38, 0x42, 0x50, 0x53], offset: 0 }], // Alternative PSD MIME type
} as const;

/**
 * Safe file extensions mapped to MIME types
 */
const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/vnd.adobe.photoshop': '.psd',
  'image/x-photoshop': '.psd',
};

/**
 * Allowed file extensions (whitelist)
 */
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.psd'];

/**
 * Detect MIME type from magic bytes
 */
function detectMimeTypeFromMagicBytes(buffer: Buffer): string | null {
  for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
    for (const sig of signatures) {
      // Check basic magic bytes
      let matches = true;
      for (let i = 0; i < sig.bytes.length; i++) {
        if (buffer[sig.offset + i] !== sig.bytes[i]) {
          matches = false;
          break;
        }
      }

      // Check extra validation if present
      if (matches && 'extraCheck' in sig && typeof sig.extraCheck === 'function') {
        matches = sig.extraCheck(buffer);
      }

      if (matches) {
        return mimeType;
      }
    }
  }
  return null;
}

/**
 * Sanitize filename to prevent path traversal and malicious extensions
 */
function sanitizeFilename(originalFilename: string): string {
  // Remove path components
  let filename = originalFilename.replace(/^.*[\\\/]/, '');

  // Remove all non-alphanumeric except dots, hyphens, underscores
  filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Remove leading dots and spaces
  filename = filename.replace(/^[.\s]+/, '');

  // Limit length
  if (filename.length > 100) {
    const ext = filename.slice(filename.lastIndexOf('.'));
    filename = filename.slice(0, 100 - ext.length) + ext;
  }

  return filename || 'unnamed';
}

/**
 * Generate cryptographically secure filename
 */
export function generateSecureFilename(
  buffer: Buffer,
  detectedMimeType: string,
  originalFilename?: string
): string {
  // Use content hash for uniqueness and deduplication
  const hash = createHash('sha256').update(buffer).digest('hex');
  const shortHash = hash.substring(0, 16);

  // Use timestamp for ordering
  const timestamp = Date.now();

  // Get safe extension from detected MIME type
  const extension = MIME_TO_EXTENSION[detectedMimeType] || '.bin';

  // Optional: preserve sanitized original filename for human readability
  const safeName = originalFilename ? sanitizeFilename(originalFilename) : '';
  const baseFilename = safeName ? `${safeName.replace(/\.[^.]*$/, '')}_` : '';

  return `image_${timestamp}_${shortHash}${extension}`;
}

/**
 * Validate uploaded image file with comprehensive security checks
 */
export async function validateImageUpload(
  file: File,
  options: {
    maxSizeBytes?: number;
    allowedMimeTypes?: string[];
    requireDimensionValidation?: boolean;
  } = {}
): Promise<FileValidationResult> {
  const {
    maxSizeBytes = 10 * 1024 * 1024, // 10MB default
    allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'],
    requireDimensionValidation = true,
  } = options;

  // Step 1: Validate file size
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${(maxSizeBytes / 1024 / 1024).toFixed(2)}MB)`,
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty',
    };
  }

  // Step 2: Read file buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Step 3: Detect MIME type from magic bytes (CRITICAL: Don't trust client-provided MIME type)
  const detectedMimeType = detectMimeTypeFromMagicBytes(buffer);

  if (!detectedMimeType) {
    return {
      valid: false,
      error:
        'File content does not match any supported image format. Potential security risk detected.',
    };
  }

  // Step 4: Verify detected MIME type is in allowlist
  if (!allowedMimeTypes.includes(detectedMimeType)) {
    return {
      valid: false,
      error: `Detected file type '${detectedMimeType}' is not allowed. Only ${allowedMimeTypes.join(', ')} are permitted.`,
    };
  }

  // Step 5: Validate file extension matches detected MIME type
  const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  const expectedExtension = MIME_TO_EXTENSION[detectedMimeType];

  // Allow common variations (.jpg vs .jpeg)
  const validExtensions =
    detectedMimeType === 'image/jpeg' ? ['.jpg', '.jpeg'] : [expectedExtension];

  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return {
      valid: false,
      error: `File extension '${fileExtension}' is not allowed. File will be renamed with correct extension.`,
    };
  }

  // Step 6: Validate image dimensions using sharp (also verifies it's a real image)
  let dimensions: { width: number; height: number } | undefined;

  // Skip dimension validation for PSD files (sharp doesn't support them)
  const isPSD =
    detectedMimeType === 'image/vnd.adobe.photoshop' || detectedMimeType === 'image/x-photoshop';

  if (requireDimensionValidation && !isPSD) {
    try {
      const metadata = await sharp(buffer).metadata();

      if (!metadata.width || !metadata.height) {
        return {
          valid: false,
          error: 'Unable to determine image dimensions. File may be corrupted.',
        };
      }

      dimensions = {
        width: metadata.width,
        height: metadata.height,
      };

      // Additional validation: prevent absurdly large images
      const maxDimension = 20000; // 20k pixels per side
      if (metadata.width > maxDimension || metadata.height > maxDimension) {
        return {
          valid: false,
          error: `Image dimensions (${metadata.width}x${metadata.height}) exceed maximum allowed (${maxDimension}x${maxDimension})`,
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: 'Failed to process image. File may be corrupted or malicious.',
      };
    }
  }

  // Step 7: Generate secure filename
  const safeFilename = generateSecureFilename(buffer, detectedMimeType, file.name);

  return {
    valid: true,
    safeFilename,
    detectedMimeType,
    dimensions,
  };
}

/**
 * Extract date metadata from image file
 *
 * Attempts to extract dates from multiple sources and returns the earliest:
 * - EXIF DateTimeOriginal (camera capture date)
 * - EXIF DateTime (general date/time)
 * - EXIF CreateDate
 * - File mtime (modification time from filesystem)
 * - File birthtime (creation time from filesystem, if available)
 *
 * @param buffer - Image file buffer
 * @param fileStats - fs.Stats object from the saved file (optional)
 * @returns Object with extracted dates and earliest date
 */
export async function extractImageDates(
  buffer: Buffer,
  fileStats?: { mtime: Date; birthtime?: Date }
): Promise<{
  exifDate: Date | null;
  fileModified: Date | null;
  fileCreated: Date | null;
  earliestDate: Date | null;
}> {
  const dates = {
    exifDate: null as Date | null,
    fileModified: null as Date | null,
    fileCreated: null as Date | null,
    earliestDate: null as Date | null,
  };

  // Extract file timestamps from filesystem stats (server-side)
  if (fileStats) {
    dates.fileModified = fileStats.mtime;
    if (fileStats.birthtime) {
      dates.fileCreated = fileStats.birthtime;
    }
  }

  // Extract EXIF date
  try {
    const metadata = await sharp(buffer).metadata();

    if (metadata.exif) {
      const parser = ExifParser.create(metadata.exif);
      const result = parser.parse();

      // Try different EXIF date fields (in order of preference)
      const exifTimestamp =
        result.tags.DateTimeOriginal || result.tags.DateTime || result.tags.CreateDate;

      if (exifTimestamp) {
        dates.exifDate = new Date(exifTimestamp * 1000); // EXIF uses seconds since epoch
      }
    }
  } catch (error) {
    // Not all images have EXIF data (PNG, GIF don't support it)
    // This is expected and not an error
  }

  // Determine the best date to use (priority order matters for reliability)
  // For photos, EXIF dates are more reliable than filesystem dates
  // (filesystem dates get corrupted by copies, syncs, and backups)
  if (dates.exifDate) {
    // EXIF DateTimeOriginal is most reliable for camera photos
    dates.earliestDate = dates.exifDate;
  } else {
    // Fallback to filesystem timestamps if no EXIF data
    // Use earliest of mtime and birthtime
    const filesystemDates = [dates.fileModified, dates.fileCreated].filter(
      (d): d is Date => d !== null
    );

    if (filesystemDates.length > 0) {
      dates.earliestDate = new Date(Math.min(...filesystemDates.map(d => d.getTime())));
    }
  }

  return dates;
}

/**
 * Extract video creation/modification dates from multiple sources
 * Priority order (most to least reliable):
 * - Container metadata (creation_time tag from MP4/MOV/MKV containers)
 * - File mtime (modification time from filesystem)
 * - File birthtime (creation time from filesystem, if available)
 *
 * @param videoMetadata - Video metadata extracted by FFprobe (optional)
 * @param fileStats - fs.Stats object from the saved file (optional)
 * @returns Object with extracted dates and earliest date
 */
export async function extractVideoDates(
  videoMetadata?: VideoMetadata,
  fileStats?: { mtime: Date; birthtime?: Date }
): Promise<{
  containerDate: Date | null;
  fileModified: Date | null;
  fileCreated: Date | null;
  earliestDate: Date | null;
}> {
  const dates = {
    containerDate: null as Date | null,
    fileModified: null as Date | null,
    fileCreated: null as Date | null,
    earliestDate: null as Date | null,
  };

  // Extract file timestamps from filesystem stats (server-side)
  if (fileStats) {
    dates.fileModified = fileStats.mtime;
    if (fileStats.birthtime) {
      dates.fileCreated = fileStats.birthtime;
    }
  }

  // Extract creation time from container metadata (MP4, MOV, MKV)
  if (videoMetadata?.creationTime) {
    dates.containerDate = videoMetadata.creationTime;
  }

  // Determine the best date to use (priority order matters for reliability)
  // For videos, container metadata (creation_time) is most reliable
  // (filesystem dates get corrupted by copies, syncs, and backups)
  if (dates.containerDate) {
    // Container creation_time is most reliable for videos
    dates.earliestDate = dates.containerDate;
  } else {
    // Fallback to filesystem timestamps if no container metadata
    // Use earliest of mtime and birthtime
    const filesystemDates = [dates.fileModified, dates.fileCreated].filter(
      (d): d is Date => d !== null
    );

    if (filesystemDates.length > 0) {
      dates.earliestDate = new Date(Math.min(...filesystemDates.map(d => d.getTime())));
    }
  }

  return dates;
}

/**
 * Format date for SQLite datetime column (ISO 8601 without 'T' and 'Z')
 * SQLite expects: 'YYYY-MM-DD HH:MM:SS'
 *
 * @param date - JavaScript Date object
 * @returns Formatted string for SQLite, or null if date is invalid
 */
export function formatDateForSQL(date: Date | null): string | null {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().replace('T', ' ').substring(0, 19);
}
