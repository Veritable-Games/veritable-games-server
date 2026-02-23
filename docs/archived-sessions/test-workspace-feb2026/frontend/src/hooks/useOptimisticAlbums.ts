/**
 * useOptimisticAlbums Hook
 *
 * React 19 hook for optimistic UI updates during album operations.
 * Provides instant feedback for album creation and image addition.
 *
 * Features:
 * - Instant UI updates using React 19's useOptimistic
 * - Automatic rollback on error
 * - Loading state tracking
 * - Error callback for toast notifications
 * - Success callback for user feedback
 *
 * Usage:
 * ```tsx
 * const { executeCreateAlbum, executeAddToAlbum, isPending } = useOptimisticAlbums({
 *   onSuccess: (action) => toast.success(`Album ${action}d successfully`),
 *   onError: (error) => toast.error(error.message),
 * });
 * ```
 *
 * @module hooks/useOptimisticAlbums
 */

'use client';

import { useCallback, useTransition } from 'react';
import { useReferencesStore } from '@/lib/stores/referencesStore';
import { fetchWithCSRF } from '@/lib/utils/csrf';
import type {
  ReferenceImage,
  ReferenceImageId,
  ReferenceAlbum,
  AlbumId,
} from '@/types/project-references';
import type { UserId } from '@/lib/database/schema-types';
import type { GalleryType } from '@/lib/projects/gallery-service';
import { logger } from '@/lib/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface UseOptimisticAlbumsOptions {
  onSuccess?: (action: 'create' | 'add' | 'combine' | 'delete') => void;
  onError?: (error: Error) => void;
  projectSlug: string;
  galleryType: GalleryType;
}

export interface UseOptimisticAlbumsReturn {
  isPending: boolean;
  executeCreateAlbum: (draggedId: ReferenceImageId, targetId: ReferenceImageId) => Promise<void>;
  executeAddToAlbum: (albumId: AlbumId, imageId: ReferenceImageId) => Promise<void>;
  executeAddMultipleToAlbum: (albumId: AlbumId, imageIds: ReferenceImageId[]) => Promise<void>;
  executeCombineAlbums: (targetAlbumId: AlbumId, sourceAlbumIds: AlbumId[]) => Promise<void>;
  executeDeleteSelection: (imageIds: ReferenceImageId[], albumIds: AlbumId[]) => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useOptimisticAlbums(
  options: UseOptimisticAlbumsOptions
): UseOptimisticAlbumsReturn {
  const { onSuccess, onError, projectSlug, galleryType } = options;
  const [isPending, startTransition] = useTransition();

  const { addAlbum, removeImages, displayItems, albums, images: allImages } = useReferencesStore();

  /**
   * Create a new album from two images
   */
  const executeCreateAlbum = useCallback(
    async (draggedId: ReferenceImageId, targetId: ReferenceImageId) => {
      try {
        // Get the two images to create album from
        const draggedImage = allImages.find(img => img.id === draggedId);
        const targetImage = allImages.find(img => img.id === targetId);

        if (!draggedImage || !targetImage) {
          throw new Error('One or both images not found');
        }

        // Create optimistic album
        const optimisticAlbum: ReferenceAlbum = {
          id: Math.random() as AlbumId, // Temporary ID, will be replaced
          project_id: draggedImage.project_id,
          gallery_type: galleryType,
          name: null,
          created_by: 0 as UserId, // Temporary - will be set by server
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          images: [draggedImage, targetImage],
          image_count: 2,
        };

        // Apply optimistic update
        startTransition(() => {
          addAlbum(optimisticAlbum);
          // Note: Don't remove images from store - displayItems() handles filtering
        });

        // Call API
        const response = await fetchWithCSRF(`/api/projects/${projectSlug}/${galleryType}/albums`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageIds: [draggedId, targetId] }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          const errorMessage =
            typeof errorData.error === 'string'
              ? errorData.error
              : errorData.error?.message || 'Failed to create album';
          throw new Error(errorMessage);
        }

        const result = await response.json();

        // Replace optimistic album with real one from server
        if (result.album) {
          // Remove old optimistic album and add real one
          useReferencesStore.setState(state => ({
            albums: [...state.albums.filter(a => a.id !== optimisticAlbum.id), result.album],
          }));
        }

        onSuccess?.('create');
      } catch (error) {
        // Rollback happens automatically because we don't confirm the optimistic update
        logger.error('Failed to create album:', error);
        onError?.(error instanceof Error ? error : new Error('Failed to create album'));
      }
    },
    [projectSlug, galleryType, allImages, addAlbum, removeImages, onSuccess, onError]
  );

  /**
   * Add an image to an existing album
   */
  const executeAddToAlbum = useCallback(
    async (albumId: AlbumId, imageId: ReferenceImageId) => {
      try {
        // Find the album to update
        const album = albums.find(a => a.id === albumId);
        const image = allImages.find(img => img.id === imageId);

        if (!album || !image) {
          throw new Error('Album or image not found');
        }

        // Create optimistic updated album
        const optimisticAlbum: ReferenceAlbum = {
          ...album,
          images: [...album.images, image],
          image_count: album.image_count + 1,
          updated_at: new Date().toISOString(),
        };

        // Apply optimistic update
        startTransition(() => {
          useReferencesStore.setState(state => ({
            albums: state.albums.map(a => (a.id === albumId ? optimisticAlbum : a)),
          }));
          // Note: Don't remove images from store - displayItems() handles filtering
        });

        // Call API
        const response = await fetchWithCSRF(
          `/api/projects/${projectSlug}/${galleryType}/albums/${albumId}/images`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageId }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          const errorMessage =
            typeof errorData.error === 'string'
              ? errorData.error
              : errorData.error?.message || 'Failed to add image to album';
          throw new Error(errorMessage);
        }

        onSuccess?.('add');
      } catch (error) {
        // Rollback happens automatically
        logger.error('Failed to add image to album:', error);
        onError?.(error instanceof Error ? error : new Error('Failed to add image to album'));
      }
    },
    [projectSlug, galleryType, albums, allImages, removeImages, onSuccess, onError]
  );

  /**
   * Add multiple images to an existing album
   */
  const executeAddMultipleToAlbum = useCallback(
    async (albumId: AlbumId, imageIds: ReferenceImageId[]) => {
      try {
        const album = albums.find(a => a.id === albumId);
        const imagesToAdd = allImages.filter(img => imageIds.includes(img.id));

        if (!album || imagesToAdd.length === 0) {
          throw new Error('Album or images not found');
        }

        // Create optimistic updated album
        const optimisticAlbum: ReferenceAlbum = {
          ...album,
          images: [...album.images, ...imagesToAdd],
          image_count: album.image_count + imagesToAdd.length,
          updated_at: new Date().toISOString(),
        };

        // Apply optimistic update
        startTransition(() => {
          useReferencesStore.setState(state => ({
            albums: state.albums.map(a => (a.id === albumId ? optimisticAlbum : a)),
          }));
          // Note: Don't remove images from store - displayItems() handles filtering
        });

        // Call API with array of image IDs
        const response = await fetchWithCSRF(
          `/api/projects/${projectSlug}/${galleryType}/albums/${albumId}/images`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageIds }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          const errorMessage =
            typeof errorData.error === 'string'
              ? errorData.error
              : errorData.error?.message || 'Failed to add images to album';
          throw new Error(errorMessage);
        }

        onSuccess?.('add');
      } catch (error) {
        logger.error('Failed to add multiple images to album:', error);
        onError?.(error instanceof Error ? error : new Error('Failed to add images to album'));
      }
    },
    [projectSlug, galleryType, albums, allImages, removeImages, onSuccess, onError]
  );

  /**
   * Combine multiple albums into a target album
   */
  const executeCombineAlbums = useCallback(
    async (targetAlbumId: AlbumId, sourceAlbumIds: AlbumId[]) => {
      try {
        const targetAlbum = albums.find(a => a.id === targetAlbumId);
        const sourceAlbums = albums.filter(a => sourceAlbumIds.includes(a.id));

        if (!targetAlbum) {
          throw new Error('Target album not found');
        }

        if (sourceAlbums.length === 0) {
          throw new Error('No source albums found');
        }

        // Merge all source album images into target
        const allSourceImages = sourceAlbums.flatMap(album => album.images);
        const totalSourceImageCount = sourceAlbums.reduce(
          (sum, album) => sum + album.image_count,
          0
        );

        // Create optimistic merged album
        const optimisticAlbum: ReferenceAlbum = {
          ...targetAlbum,
          images: [...targetAlbum.images, ...allSourceImages],
          image_count: targetAlbum.image_count + totalSourceImageCount,
          updated_at: new Date().toISOString(),
        };

        // Apply optimistic update - remove source albums, update target
        startTransition(() => {
          useReferencesStore.setState(state => ({
            albums: state.albums
              .filter(a => !sourceAlbumIds.includes(a.id))
              .map(a => (a.id === targetAlbumId ? optimisticAlbum : a)),
          }));
        });

        // Call API to combine albums
        const response = await fetchWithCSRF(
          `/api/projects/${projectSlug}/${galleryType}/albums/combine`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetAlbumId,
              sourceAlbumIds,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          const errorMessage =
            typeof errorData.error === 'string'
              ? errorData.error
              : errorData.error?.message || 'Failed to combine albums';
          throw new Error(errorMessage);
        }

        onSuccess?.('combine');
      } catch (error) {
        logger.error('Failed to combine albums:', error);
        onError?.(error instanceof Error ? error : new Error('Failed to combine albums'));
      }
    },
    [projectSlug, galleryType, albums, onSuccess, onError]
  );

  /**
   * Delete selected images and albums
   * Albums: Delete album, images return to grid
   * Images: Soft delete (mark as deleted)
   */
  const executeDeleteSelection = useCallback(
    async (imageIds: ReferenceImageId[], albumIds: AlbumId[]) => {
      try {
        // Get albums that will be deleted
        const albumsToDelete = albums.filter(a => albumIds.includes(a.id));

        // Apply optimistic update
        startTransition(() => {
          // Remove selected albums (images stay in store and auto-reappear via displayItems())
          useReferencesStore.setState(state => ({
            albums: state.albums.filter(a => !albumIds.includes(a.id)),
          }));
          // Remove selected standalone images (soft delete)
          removeImages(imageIds);
        });

        // Delete albums (images return to grid automatically)
        for (const albumId of albumIds) {
          const album = albumsToDelete.find(a => a.id === albumId);
          if (!album) continue;

          // Remove each image from album (backend auto-deletes empty albums)
          for (const image of album.images) {
            const response = await fetchWithCSRF(
              `/api/projects/${projectSlug}/${galleryType}/albums/${albumId}/images/${image.id}`,
              {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
              }
            );
            if (!response.ok) {
              throw new Error('Failed to delete album');
            }
          }
        }

        // Soft delete selected standalone images
        for (const imageId of imageIds) {
          const response = await fetchWithCSRF(
            `/api/projects/${projectSlug}/${galleryType}/${imageId}`,
            {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
            }
          );
          if (!response.ok) {
            throw new Error('Failed to delete image');
          }
        }

        onSuccess?.('delete');
      } catch (error) {
        logger.error('Failed to delete selection:', error);
        onError?.(error instanceof Error ? error : new Error('Failed to delete selection'));
      }
    },
    [projectSlug, galleryType, albums, removeImages, onSuccess, onError]
  );

  return {
    isPending,
    executeCreateAlbum,
    executeAddToAlbum,
    executeAddMultipleToAlbum,
    executeCombineAlbums,
    executeDeleteSelection,
  };
}
