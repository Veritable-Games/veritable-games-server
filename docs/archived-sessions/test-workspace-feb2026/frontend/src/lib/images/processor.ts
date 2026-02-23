/**
 * Image Processing Service
 *
 * Handles image uploads, validation, optimization, and format conversion using Sharp
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

// Constants
const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
] as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ============================================================================
// Types
// ============================================================================

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
}

export interface ImageVariant {
  format: 'avif' | 'webp' | 'jpeg';
  buffer: Buffer;
  size: number;
}

export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  formats?: Array<'avif' | 'webp' | 'jpeg'>;
  preserveMetadata?: boolean;
}

// ============================================================================
// Validation
// ============================================================================

export class ImageValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

/**
 * Validate image file buffer
 */
export async function validateImageBuffer(buffer: Buffer): Promise<ImageMetadata> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new ImageValidationError('Invalid image dimensions', 'INVALID_DIMENSIONS');
    }

    if (!metadata.format) {
      throw new ImageValidationError('Unknown image format', 'UNKNOWN_FORMAT');
    }

    const mimeType = `image/${metadata.format}`;
    if (!SUPPORTED_MIME_TYPES.includes(mimeType as (typeof SUPPORTED_MIME_TYPES)[number])) {
      throw new ImageValidationError(
        `Unsupported format: ${metadata.format}. Supported: ${SUPPORTED_MIME_TYPES.join(', ')}`,
        'UNSUPPORTED_FORMAT'
      );
    }

    if (buffer.length > MAX_FILE_SIZE) {
      throw new ImageValidationError(
        `File too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB. Max: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        'FILE_TOO_LARGE'
      );
    }

    if (metadata.width > 50000 || metadata.height > 50000) {
      throw new ImageValidationError(
        `Image dimensions too large: ${metadata.width}x${metadata.height}. Max: 50000x50000`,
        'DIMENSIONS_TOO_LARGE'
      );
    }

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: buffer.length,
      hasAlpha: metadata.hasAlpha || false,
    };
  } catch (error) {
    if (error instanceof ImageValidationError) {
      throw error;
    }
    throw new ImageValidationError('Invalid image file', 'INVALID_IMAGE');
  }
}

// ============================================================================
// Image Processing
// ============================================================================

/**
 * Process and optimize image
 */
export async function processImage(
  buffer: Buffer,
  options: ImageProcessingOptions = {}
): Promise<ProcessedImage> {
  const { maxWidth = 4096, maxHeight = 4096, quality = 90, preserveMetadata = false } = options;

  try {
    let image = sharp(buffer);

    // Get original metadata
    const metadata = await image.metadata();

    // Resize if needed
    if (metadata.width && metadata.height) {
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        image = image.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }
    }

    // Remove metadata unless explicitly preserved
    if (!preserveMetadata) {
      image = image.rotate(); // Auto-rotate based on EXIF
    }

    // Optimize based on format
    if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
      image = image.jpeg({ quality, mozjpeg: true });
    } else if (metadata.format === 'png') {
      image = image.png({ quality, compressionLevel: 9 });
    } else if (metadata.format === 'webp') {
      image = image.webp({ quality });
    } else if (metadata.format === 'avif') {
      image = image.avif({ quality });
    }

    const processedBuffer = await image.toBuffer();
    const processedMetadata = await sharp(processedBuffer).metadata();

    return {
      buffer: processedBuffer,
      width: processedMetadata.width || 0,
      height: processedMetadata.height || 0,
      format: processedMetadata.format || 'unknown',
      size: processedBuffer.length,
    };
  } catch (error) {
    throw new ImageValidationError(
      `Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'PROCESSING_FAILED'
    );
  }
}

/**
 * Generate multiple format variants (AVIF, WebP, JPEG)
 */
export async function generateImageVariants(
  buffer: Buffer,
  formats: Array<'avif' | 'webp' | 'jpeg'> = ['avif', 'webp', 'jpeg'],
  quality: number = 85
): Promise<ImageVariant[]> {
  const variants: ImageVariant[] = [];

  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Auto-rotate and optimize
    let baseImage = image.rotate();

    // Resize if too large
    if (metadata.width && metadata.height) {
      if (metadata.width > 4096 || metadata.height > 4096) {
        baseImage = baseImage.resize(4096, 4096, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }
    }

    for (const format of formats) {
      let formatImage = baseImage.clone();

      switch (format) {
        case 'avif':
          formatImage = formatImage.avif({ quality, effort: 6 });
          break;
        case 'webp':
          formatImage = formatImage.webp({ quality });
          break;
        case 'jpeg':
          formatImage = formatImage.jpeg({ quality, mozjpeg: true });
          break;
      }

      const variantBuffer = await formatImage.toBuffer();

      variants.push({
        format,
        buffer: variantBuffer,
        size: variantBuffer.length,
      });
    }

    return variants;
  } catch (error) {
    throw new ImageValidationError(
      `Failed to generate variants: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'VARIANT_GENERATION_FAILED'
    );
  }
}

/**
 * Generate thumbnail
 */
export async function generateThumbnail(
  buffer: Buffer,
  width: number = 300,
  height: number = 300,
  format: 'webp' | 'jpeg' = 'webp'
): Promise<Buffer> {
  try {
    let image = sharp(buffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center',
      })
      .rotate();

    if (format === 'webp') {
      image = image.webp({ quality: 80 });
    } else {
      image = image.jpeg({ quality: 80, mozjpeg: true });
    }

    return await image.toBuffer();
  } catch (error) {
    throw new ImageValidationError(
      `Failed to generate thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'THUMBNAIL_FAILED'
    );
  }
}

// ============================================================================
// File System Operations
// ============================================================================

/**
 * Ensure upload directory exists
 */
export async function ensureUploadDirectory(projectId: string): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'references', projectId);

  try {
    await fs.mkdir(uploadDir, { recursive: true });
    return uploadDir;
  } catch (error) {
    throw new ImageValidationError(
      `Failed to create upload directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'DIRECTORY_CREATION_FAILED'
    );
  }
}

/**
 * Save image to disk
 */
export async function saveImageToDisk(
  buffer: Buffer,
  projectId: string,
  filename: string
): Promise<string> {
  try {
    const uploadDir = await ensureUploadDirectory(projectId);
    const filePath = path.join(uploadDir, filename);

    await fs.writeFile(filePath, buffer);

    return `/uploads/references/${projectId}/${filename}`;
  } catch (error) {
    throw new ImageValidationError(
      `Failed to save image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'SAVE_FAILED'
    );
  }
}

/**
 * Delete image from disk
 */
export async function deleteImageFromDisk(filePath: string): Promise<void> {
  try {
    const fullPath = path.join(process.cwd(), 'public', filePath);
    await fs.unlink(fullPath);
  } catch (error) {
    // Ignore if file doesn't exist
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new ImageValidationError(
        `Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DELETE_FAILED'
      );
    }
  }
}

/**
 * Get image dimensions without loading full buffer
 */
export async function getImageDimensions(
  filePath: string
): Promise<{ width: number; height: number }> {
  try {
    const fullPath = path.join(process.cwd(), 'public', filePath);
    const metadata = await sharp(fullPath).metadata();

    if (!metadata.width || !metadata.height) {
      throw new ImageValidationError('Could not determine image dimensions', 'INVALID_DIMENSIONS');
    }

    return {
      width: metadata.width,
      height: metadata.height,
    };
  } catch (error) {
    if (error instanceof ImageValidationError) {
      throw error;
    }
    throw new ImageValidationError(
      `Failed to get dimensions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'DIMENSION_READ_FAILED'
    );
  }
}

// ============================================================================
// Upload Helper
// ============================================================================

export interface UploadResult {
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  width: number;
  height: number;
}

/**
 * Complete upload workflow: validate, process, and save
 */
export async function uploadImage(
  buffer: Buffer,
  projectId: string,
  sanitizedFilename: string,
  options: ImageProcessingOptions = {}
): Promise<UploadResult> {
  try {
    // 1. Validate
    const metadata = await validateImageBuffer(buffer);

    // 2. Process and optimize
    const processed = await processImage(buffer, options);

    // 3. Save to disk
    const filePath = await saveImageToDisk(processed.buffer, projectId, sanitizedFilename);

    return {
      filename: sanitizedFilename,
      file_path: filePath,
      file_size: processed.size,
      mime_type: `image/${processed.format}`,
      width: processed.width,
      height: processed.height,
    };
  } catch (error) {
    if (error instanceof ImageValidationError) {
      throw error;
    }
    throw new ImageValidationError(
      `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'UPLOAD_FAILED'
    );
  }
}
