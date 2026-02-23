/**
 * Gallery Configuration Constants
 *
 * Defines specific configurations for each gallery type.
 * Add new gallery types here as needed.
 */

import type { GalleryConfig } from '@/types/gallery-config';

/**
 * Standard image MIME types
 */
const STANDARD_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];

/**
 * Extended image types including source files
 */
const EXTENDED_IMAGE_TYPES = [
  ...STANDARD_IMAGE_TYPES,
  'image/x-photoshop', // PSD
  'image/vnd.adobe.photoshop', // PSD alternative MIME
];

/**
 * Standard video MIME types
 */
const STANDARD_VIDEO_TYPES = [
  'video/mp4', // MP4 (most common, best browser support)
  'video/quicktime', // MOV (converts to MP4)
  'video/x-msvideo', // AVI (converts to MP4)
  'video/webm', // WebM (modern format)
];

/**
 * Media types (images + videos)
 */
const STANDARD_MEDIA_TYPES = [...STANDARD_IMAGE_TYPES, ...STANDARD_VIDEO_TYPES];

/**
 * Extended media types (images + videos + source files)
 */
const EXTENDED_MEDIA_TYPES = [...EXTENDED_IMAGE_TYPES, ...STANDARD_VIDEO_TYPES];

/**
 * Configuration for References Gallery
 *
 * Use case: Reference images and videos for projects (screenshots, inspiration, etc.)
 * Constraints: Standard web images and videos, moderate file size for images, 100MB for videos
 * Note: Videos are auto-compressed with FFmpeg before storage (typically 85-90% reduction)
 */
export const REFERENCE_CONFIG: GalleryConfig = {
  galleryType: 'references',
  displayName: 'References',
  uploadPath: '/api/projects/[slug]/references',
  allowedMimeTypes: STANDARD_MEDIA_TYPES, // Images + Videos
  maxFileSize: 100 * 1024 * 1024, // 100MB (allows large videos before compression)
  features: {
    allowBatchTagging: true,
    allowSortOrder: true,
    showUploaderInfo: true,
  },
};

/**
 * Configuration for Concept Art Gallery
 *
 * Use case: Original artwork, iterations, work-in-progress (images and process videos)
 * Constraints: Larger files allowed (PSD support, process videos), version tracking
 */
export const CONCEPT_ART_CONFIG: GalleryConfig = {
  galleryType: 'concept-art',
  displayName: 'Concept Art',
  uploadPath: '/api/projects/[slug]/concept-art',
  allowedMimeTypes: EXTENDED_MEDIA_TYPES, // Images + Videos + Source Files
  maxFileSize: 100 * 1024 * 1024, // 100MB for high-res artwork, PSD files, and videos
  features: {
    allowBatchTagging: true,
    allowSortOrder: false, // Concept art typically organized by iteration, not manual order
    showUploaderInfo: true,
    allowVersioning: true, // Track artwork iterations
    showIterationNumber: true, // Display "v1", "v2", etc.
  },
};

/**
 * Configuration for History Gallery
 *
 * Use case: Historical progress images and videos, development timeline, before/after comparisons
 * Constraints: Standard web images and videos, chronological organization
 */
export const HISTORY_CONFIG: GalleryConfig = {
  galleryType: 'history',
  displayName: 'History',
  uploadPath: '/api/projects/[slug]/history',
  allowedMimeTypes: STANDARD_MEDIA_TYPES, // Images + Videos
  maxFileSize: 100 * 1024 * 1024, // 100MB (allows videos before compression)
  features: {
    allowBatchTagging: true,
    allowSortOrder: true, // Allow manual timeline organization
    showUploaderInfo: true,
  },
};

/**
 * Get configuration for a specific gallery type
 */
export function getGalleryConfig(
  galleryType: 'references' | 'concept-art' | 'history'
): GalleryConfig {
  switch (galleryType) {
    case 'references':
      return REFERENCE_CONFIG;
    case 'concept-art':
      return CONCEPT_ART_CONFIG;
    case 'history':
      return HISTORY_CONFIG;
    default:
      // Fallback to references config
      return REFERENCE_CONFIG;
  }
}
