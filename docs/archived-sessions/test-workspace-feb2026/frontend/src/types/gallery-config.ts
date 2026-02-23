/**
 * Gallery Configuration Types
 *
 * Defines configuration interface for gallery types (references, concept-art).
 * Similar pattern to markdown editor feature flags.
 */

import type { GalleryType } from '@/lib/projects/gallery-service';

/**
 * Gallery-specific feature flags and settings
 */
export interface GalleryFeatures {
  /** Allow batch tagging during upload */
  allowBatchTagging: boolean;

  /** Allow manual image reordering (drag-drop) */
  allowSortOrder: boolean;

  /** Show uploader information on images */
  showUploaderInfo: boolean;

  /** Enable version/iteration tracking (concept-art specific) */
  allowVersioning?: boolean;

  /** Show iteration numbers on images (concept-art specific) */
  showIterationNumber?: boolean;
}

/**
 * Complete gallery configuration
 */
export interface GalleryConfig {
  /** Gallery type identifier */
  galleryType: GalleryType;

  /** Display name for UI */
  displayName: string;

  /** API endpoint base path */
  uploadPath: string;

  /** Allowed MIME types for upload */
  allowedMimeTypes: string[];

  /** Maximum file size in bytes */
  maxFileSize: number;

  /** Feature flags */
  features: GalleryFeatures;
}
