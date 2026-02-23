/**
 * Project Reference Images Types
 *
 * Types for the project reference image gallery system.
 * Manages uploaded reference images with tagging and categorization.
 */

import type {
  ProjectId,
  UserId,
  ReferenceImageId,
  ReferenceTagId,
  ReferenceCategoryId,
  AlbumId,
} from '@/lib/database/schema-types';

// Re-export branded ID types for external use
export type {
  ReferenceImageId,
  ReferenceTagId,
  ReferenceCategoryId,
  AlbumId,
} from '@/lib/database/schema-types';

// ============================================
// Database Record Types
// ============================================

/**
 * Reference image database record
 * Matches project_reference_images table schema
 * NOTE: Now supports both images and videos
 */
export interface ReferenceImageRecord {
  id: ReferenceImageId;
  project_id: ProjectId;

  // File metadata
  filename_storage: string;
  file_path: string;
  file_size: number;
  mime_type: string;

  // Image dimensions for masonry layout
  width: number | null;
  height: number | null;
  aspect_ratio: number | null;

  // Video-specific fields (null for images)
  duration: number | null; // Video duration in seconds
  poster_path: string | null; // Video thumbnail/poster image

  // Metadata
  title: string | null; // Optional title for video/image
  description: string | null; // Optional description
  uploaded_by: UserId;
  sort_order: number;

  // Soft delete
  is_deleted: number;
  deleted_at: string | null;
  deleted_by: UserId | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Reference tag database record
 * Matches reference_tags table schema
 */
export interface ReferenceTagRecord {
  id: ReferenceTagId;
  category_id: ReferenceCategoryId;
  name: string;
  color: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Reference category database record
 * Matches reference_categories table schema
 */
export interface ReferenceCategoryRecord {
  id: ReferenceCategoryId;
  name: string;
  description: string | null;
  visibility: 'public' | 'private';
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Tag assignment junction table record
 * Matches project_reference_tags table schema (junction table)
 */
export interface ReferenceTagAssignmentRecord {
  reference_id: ReferenceImageId;
  tag_id: ReferenceTagId;
  created_at: string;
}

/**
 * Reference album database record
 * Matches reference_albums table schema
 */
export interface ReferenceAlbumRecord {
  id: AlbumId;
  project_id: ProjectId;
  gallery_type: 'references' | 'concept-art' | 'history';
  name: string | null;
  created_by: UserId;
  created_at: string;
  updated_at: string;
}

/**
 * Album image junction table record
 * Matches reference_album_images table schema
 */
export interface ReferenceAlbumImageRecord {
  album_id: AlbumId;
  image_id: ReferenceImageId;
  position: number;
  added_at: string;
}

// ============================================
// Display Types (with resolved relationships)
// ============================================

/**
 * Reference image with resolved relationships for display
 * NOTE: Now supports both images and videos
 */
export interface ReferenceImage {
  id: ReferenceImageId;
  project_id: ProjectId;

  // File info
  filename_storage: string;
  file_path: string;
  file_size: number;
  mime_type: string;

  // Dimensions for masonry layout
  width: number | null;
  height: number | null;
  aspect_ratio: number | null;

  // Video-specific fields (null for images)
  duration?: number | null; // Video duration in seconds
  poster_path?: string | null; // Video thumbnail/poster image

  // Metadata
  title?: string | null; // Optional title for video/image
  description?: string | null; // Optional description
  sort_order: number;

  // Resolved relationships
  tags: ReferenceTag[];
  uploader: {
    id: UserId;
    username: string;
    display_name: string | null;
  } | null;

  // Soft delete
  is_deleted: boolean;
  deleted_at: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Reference tag for display
 */
export interface ReferenceTag {
  id: ReferenceTagId;
  name: string;
  color: string;
  category: {
    id: ReferenceCategoryId;
    name: string;
  };
  display_order?: number;
}

/**
 * Reference category for display
 */
export interface ReferenceCategory {
  id: ReferenceCategoryId;
  name: string;
  description: string | null;
  visibility: 'public' | 'private';
  display_order: number;
  tag_count?: number;
}

/**
 * Reference album for display with resolved images
 */
export interface ReferenceAlbum {
  id: AlbumId;
  project_id: ProjectId;
  gallery_type: 'references' | 'concept-art' | 'history';
  name: string | null;
  created_by: UserId;
  created_at: string;
  updated_at: string;
  images: ReferenceImage[]; // Ordered by position
  image_count: number;
}

// ============================================
// Input Types (for creation/updates)
// ============================================

/**
 * Input for creating a new reference image or video
 */
export interface CreateReferenceImageInput {
  project_id: ProjectId;
  filename_storage: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  width?: number;
  height?: number;
  duration?: number; // Video duration in seconds (optional, for videos only)
  poster_path?: string; // Video thumbnail path (optional, for videos only)
  tag_ids?: ReferenceTagId[];
  created_at?: string; // Optional: SQLite datetime string (YYYY-MM-DD HH:MM:SS)
}

/**
 * Input for updating reference image metadata
 */
export interface UpdateReferenceImageInput {
  tag_ids?: ReferenceTagId[];
  is_deleted?: boolean;
}

/**
 * Input for creating a new tag
 */
export interface CreateReferenceTagInput {
  name: string;
  project_id: ProjectId;
  category_id: ReferenceCategoryId;
  color?: string;
  display_order?: number;
}

// ============================================
// Query Filter Types
// ============================================

/**
 * Filters for querying reference images
 */
export interface ReferenceImageFilters {
  project_id: ProjectId;
  tag_ids?: ReferenceTagId[];
  category_ids?: ReferenceCategoryId[];
  include_deleted?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Result of image query with pagination
 */
export interface ReferenceImageQueryResult {
  images: ReferenceImage[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// ============================================
// Error Types
// ============================================

/**
 * Service error types for reference images
 */
export interface ReferenceImageServiceError {
  code:
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'INVALID_INPUT'
    | 'DATABASE_ERROR'
    | 'FILE_ERROR'
    | 'DUPLICATE'
    | 'INVALID_FILE_TYPE'
    | 'FILE_TOO_LARGE';
  message: string;
  details?: unknown;
}

// ============================================
// UI State Types (for Zustand store)
// ============================================

/**
 * UI state for the reference gallery
 */
export interface ReferenceGalleryState {
  images: ReferenceImage[];
  selectedTags: ReferenceTagId[];
  selectedCategories: ReferenceCategoryId[];
  isLightboxOpen: boolean;
  selectedImageIndex: number | null;
  isUploading: boolean;
  uploadProgress: number;

  // Actions
  setImages: (images: ReferenceImage[]) => void;
  toggleTag: (tagId: ReferenceTagId) => void;
  toggleCategory: (categoryId: ReferenceCategoryId) => void;
  clearFilters: () => void;
  openLightbox: (index: number) => void;
  closeLightbox: () => void;
  navigateLightbox: (direction: 'prev' | 'next') => void;
  setUploading: (uploading: boolean) => void;
  setUploadProgress: (progress: number) => void;
}

// ============================================
// Utility Types
// ============================================

/**
 * File validation result
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mime_type?: string;
  size?: number;
  dimensions?: {
    width: number;
    height: number;
  };
}

/**
 * Upload result for a single file
 */
export interface FileUploadResult {
  success: boolean;
  image_id?: ReferenceImageId;
  filename?: string;
  error?: string;
}

/**
 * Batch upload result
 */
export interface BatchUploadResult {
  success: boolean;
  uploaded: FileUploadResult[];
  failed: FileUploadResult[];
  total: number;
}

// ============================================
// Media Type Utilities
// ============================================

/**
 * Media type discriminator
 */
export type MediaType = 'image' | 'video';

/**
 * Helper function to determine if a reference is a video
 */
export function isVideo(media: ReferenceImage): boolean {
  return media.mime_type.startsWith('video/');
}

/**
 * Helper function to determine if a reference is an image
 */
export function isImage(media: ReferenceImage): boolean {
  return media.mime_type.startsWith('image/');
}

/**
 * Get media type from MIME type
 */
export function getMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith('video/')) return 'video';
  return 'image';
}
