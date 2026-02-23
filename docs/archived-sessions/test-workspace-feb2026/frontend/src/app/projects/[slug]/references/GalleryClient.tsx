'use client';

import { useEffect, useState, useRef } from 'react';
import { useReferencesStore } from '@/lib/stores/referencesStore';
import { useAuth } from '@/contexts/AuthContext';
import { serializeErrorDetail } from '@/lib/utils/serialize-error';
import type {
  ReferenceImage,
  ReferenceTag,
  ReferenceImageId,
  ReferenceAlbum,
  AlbumId,
} from '@/types/project-references';
import type { GalleryConfig } from '@/types/gallery-config';
import { UploadZone } from '@/components/references/UploadZone';
import { FileQueueManager } from '@/components/references/FileQueueManager';
import { TagFilters } from '@/components/references/TagFilters';
import { MasonryGrid } from '@/components/references/MasonryGrid';
import { ImageLightbox } from '@/components/references/ImageLightbox';
import { SoftDeleteDialog } from '@/components/references/SoftDeleteDialog';
import { PermanentDeleteDialog } from '@/components/references/PermanentDeleteDialog';
import { UndoNotification } from '@/components/references/UndoNotification';
import { DeletedItemsView } from '@/components/references/DeletedItemsView';
import { PhotoIcon, PaintBrushIcon, ClockIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { MouseFollowingCounter } from '@/components/references/MouseFollowingCounter';
import { logger } from '@/lib/utils/logger';

/**
 * Client Component: Project Gallery Wrapper
 * Generic gallery component used for references, concept art, etc.
 * Behavior controlled by config prop.
 */

interface GalleryClientProps {
  config: GalleryConfig;
  projectSlug: string;
  projectTitle: string;
  initialImages: ReferenceImage[];
  initialTags: ReferenceTag[];
  initialAlbums: ReferenceAlbum[];
  totalCount: number;
}

export function GalleryClient({
  config,
  projectSlug,
  projectTitle,
  initialImages,
  initialTags,
  initialAlbums,
  totalCount,
}: GalleryClientProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Use config prop directly for rendering (avoid hydration mismatch)
  // Store config is set in useEffect which runs after hydration
  const {
    setConfig,
    setImages,
    setAllTags,
    setAlbums,
    selectedTags,
    sortBy,
    filteredImages,
    displayItems,
    isLightboxOpen,
    images,
    softDeleteImage,
    undoDelete,
    permanentlyDeleteImage,
    getSoftDeletedImages,
    selectAllImages,
    clearSelection,
    selectionCount,
    currentPage,
    hasMoreImages,
    isLoadingMore,
    totalImagesCount,
    appendImages,
    setLoadingMore,
    setHasMore,
    setCurrentPage,
    setTotalImagesCount,
  } = useReferencesStore();

  // Delete dialog state
  const [deleteMode, setDeleteMode] = useState<'soft' | 'permanent' | null>(null);
  const [imageToDelete, setImageToDelete] = useState<ReferenceImageId | null>(null);
  const [undoImageId, setUndoImageId] = useState<ReferenceImageId | null>(null);
  const [showDeletedItems, setShowDeletedItems] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleDeleteRequest = (imageId: ReferenceImageId) => {
    setImageToDelete(imageId);
    setDeleteMode('soft');
  };

  const handleDeletePermanentRequest = (imageId: ReferenceImageId) => {
    setImageToDelete(imageId);
    setDeleteMode('permanent');
  };

  const handleCloseSoftDeleteDialog = () => {
    setImageToDelete(null);
    setDeleteMode(null);
  };

  const handleClosePermanentDeleteDialog = () => {
    setImageToDelete(null);
    setDeleteMode(null);
  };

  const handleSoftDeleteConfirm = async (imageId: ReferenceImageId) => {
    try {
      // API call to soft-delete
      const response = await fetch(
        `/api/projects/${projectSlug}/${config.galleryType}/${imageId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) throw new Error('Failed to delete');

      // Update store
      softDeleteImage(imageId);

      // Show undo notification
      setUndoImageId(imageId);
      setDeleteMode(null);
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Delete failed:', errorDetail);
      alert('Failed to delete image. Please try again.');
    }
  };

  const handleUndoDelete = async (imageId: ReferenceImageId) => {
    try {
      // API call to restore (PATCH with restore flag)
      const response = await fetch(
        `/api/projects/${projectSlug}/${config.galleryType}/${imageId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ restore: true }),
        }
      );

      if (!response.ok) throw new Error('Failed to restore');

      // Update store
      undoDelete(imageId);
      setUndoImageId(null);
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Restore failed:', errorDetail);
      alert('Failed to restore image. Please try again.');
    }
  };

  const handlePermanentDeleteConfirm = async (imageId: ReferenceImageId) => {
    try {
      // API call to permanently delete
      const response = await fetch(
        `/api/projects/${projectSlug}/${config.galleryType}/${imageId}/permanent?confirm=true`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) throw new Error('Failed to permanently delete');

      // Update store
      permanentlyDeleteImage(imageId);
      setDeleteMode(null);
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Permanent delete failed:', errorDetail);
      alert('Failed to permanently delete image. Please try again.');
    }
  };

  const handleDeleteAlbumRequest = async (albumId: AlbumId) => {
    if (!window.confirm('Delete album? All images will return to gallery.')) {
      return;
    }

    try {
      // Get the album from store
      const { albums, removeAlbum } = useReferencesStore.getState();
      const album = albums.find(a => a.id === albumId);
      if (!album) return;

      // Remove each image from album (backend auto-deletes album when empty)
      for (const image of album.images) {
        const response = await fetch(
          `/api/projects/${projectSlug}/${config.galleryType}/albums/${albumId}/images/${image.id}`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': document.cookie.match(/csrf_token=([^;]+)/)?.[1] || '',
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to delete album');
        }
      }

      // Remove album from store
      removeAlbum(albumId);

      // Refetch images to update the grid
      await fetchImages();
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Failed to delete album:', errorDetail);
      alert('Failed to delete album. Please try again.');
    }
  };

  // Fetch images
  const fetchImages = async () => {
    setIsRefetching(true);
    try {
      const params = new URLSearchParams({
        limit: '500',
        page: '1',
        sortBy,
      });

      // Use config.uploadPath to construct the API endpoint
      const response = await fetch(`${config.uploadPath.replace('[slug]', projectSlug)}?${params}`);
      if (!response.ok) throw new Error('Failed to fetch images');

      const data = await response.json();
      setImages(data.images || []);
      // Update total count from API response
      if (typeof data.total === 'number') {
        setTotalImagesCount(data.total);
      }
      // Update has_more from API response
      if (typeof data.has_more === 'boolean') {
        setHasMore(data.has_more);
      }
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Error refetching images:', errorDetail);
    } finally {
      setIsRefetching(false);
    }
  };

  // Load more images for infinite scroll
  const loadMoreImages = async () => {
    // Guard: prevent duplicate requests
    if (isLoadingMore || !hasMoreImages) return;

    // Guard: disable infinite scroll when filters active
    if (selectedTags.length > 0) return;

    setLoadingMore(true);

    try {
      const nextPage = currentPage + 1;
      const params = new URLSearchParams({
        limit: '50',
        page: nextPage.toString(),
        sortBy,
      });

      const response = await fetch(`${config.uploadPath.replace('[slug]', projectSlug)}?${params}`);
      if (!response.ok) throw new Error('Failed to fetch more images');

      const data = await response.json();
      const newImages = data.images || [];

      // Append new images to store
      appendImages(newImages);

      // Update pagination state
      setCurrentPage(nextPage);
      // Update total count from API response (may change due to deletions)
      if (typeof data.total === 'number') {
        setTotalImagesCount(data.total);
      }
      // Use API's has_more flag instead of guessing from batch size
      setHasMore(data.has_more ?? newImages.length === 50);
    } catch (error) {
      const errorDetail = serializeErrorDetail(error);
      logger.error('Error loading more images:', errorDetail);
    } finally {
      setLoadingMore(false);
    }
  };

  // Initialize store with config and server data
  useEffect(() => {
    setConfig(config);
    setImages(initialImages);
    setAllTags(initialTags);
    setAlbums(initialAlbums);
    setTotalImagesCount(totalCount);

    // Initialize pagination state
    if (initialImages.length < totalCount) {
      setHasMore(true);
      setCurrentPage(1);
    } else {
      setHasMore(false);
    }
  }, [
    config,
    initialImages,
    initialTags,
    initialAlbums,
    totalCount,
    setConfig,
    setImages,
    setAllTags,
    setAlbums,
    setTotalImagesCount,
    setHasMore,
    setCurrentPage,
  ]);

  // Keyboard shortcuts: Ctrl+A to select all, Escape to clear selection (admin only)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+A or Cmd+A: Select all images (admin only)
      if (isAdmin && (e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAllImages();
      }
      // Escape: Clear selection (admin only)
      if (isAdmin && e.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin, selectAllImages, clearSelection]);

  // Refetch images when sortBy changes
  useEffect(() => {
    if (config) {
      fetchImages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

  // Infinite scroll: Observe sentinel element
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries.length > 0) {
          const entry = entries[0]!;
          if (entry.isIntersecting) {
            loadMoreImages();
          }
        }
      },
      { rootMargin: '500px' } // Trigger 500px before sentinel
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [loadMoreImages]);

  const currentImages = filteredImages();
  const { images: selectedImageCount, albums: selectedAlbumCount } = selectionCount();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed]">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 @container sm:gap-4">
            {/* Left side: Back link and title - allow truncation */}
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              {/* Back button - text when space available */}
              <a
                href={`/projects/${projectSlug}`}
                className="flex-shrink-0 text-sm text-gray-400 transition-colors hover:text-gray-200"
                title="Back to Project"
              >
                <span className="hidden @[480px]:inline">← Back to Project</span>
                <span className="inline @[480px]:hidden">←</span>
              </a>
              <div className="h-4 w-px flex-shrink-0 bg-gray-600" />
              <h1
                className="max-w-[150px] truncate text-base font-semibold sm:max-w-[200px] sm:text-xl md:max-w-[300px] lg:max-w-[400px] xl:max-w-none"
                title={`${projectSlug.toUpperCase()} ${config.displayName}`}
              >
                {projectSlug.toUpperCase()} {config.displayName}
              </h1>
            </div>

            {/* Right side: Item count and buttons - never shrink */}
            <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4">
              {/* Item count - show when there's space */}
              <p
                className="hidden text-sm text-gray-400 @[950px]:inline"
                title={`${displayItems().length} item${displayItems().length !== 1 ? 's' : ''}${
                  selectedTags.length > 0 ? ` • ${currentImages.length} filtered` : ''
                }`}
              >
                {displayItems().length} item{displayItems().length !== 1 ? 's' : ''}
                {selectedTags.length > 0 && (
                  <span className="ml-2">• {currentImages.length} filtered</span>
                )}
              </p>
              {isAdmin && getSoftDeletedImages().length > 0 && (
                <button
                  onClick={() => setShowDeletedItems(!showDeletedItems)}
                  className="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-200 transition-colors hover:bg-gray-600"
                  title={`${getSoftDeletedImages().length} deleted image${getSoftDeletedImages().length !== 1 ? 's' : ''}`}
                >
                  {showDeletedItems ? '✓' : '○'} {getSoftDeletedImages().length} deleted
                </button>
              )}
              {/* Cross-navigation buttons - Keep text until truly cramped */}
              <div className="flex items-center gap-2">
                {/* Concept Art */}
                {config.galleryType !== 'concept-art' && (
                  <Link
                    href={`/projects/${encodeURIComponent(projectSlug)}/concept-art`}
                    className="flex items-center gap-2 rounded border border-gray-700 bg-gray-800/50 px-3 py-1.5 text-sm text-gray-300 transition-all hover:border-gray-600 hover:bg-gray-700/50 hover:text-white"
                    title="Concept Art"
                  >
                    <PaintBrushIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden @[850px]:inline">Concept Art</span>
                  </Link>
                )}
                {/* References */}
                {config.galleryType !== 'references' && (
                  <Link
                    href={`/projects/${encodeURIComponent(projectSlug)}/references`}
                    className="flex items-center gap-2 rounded border border-gray-700 bg-gray-800/50 px-3 py-1.5 text-sm text-gray-300 transition-all hover:border-gray-600 hover:bg-gray-700/50 hover:text-white"
                    title="References"
                  >
                    <PhotoIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden @[850px]:inline">References</span>
                  </Link>
                )}
                {/* History */}
                {config.galleryType !== 'history' && (
                  <Link
                    href={`/projects/${encodeURIComponent(projectSlug)}/history`}
                    className="flex items-center gap-2 rounded border border-gray-700 bg-gray-800/50 px-3 py-1.5 text-sm text-gray-300 transition-all hover:border-gray-600 hover:bg-gray-700/50 hover:text-white"
                    title="History"
                  >
                    <ClockIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden @[850px]:inline">History</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Upload Zone (Admin Only) */}
        {isAdmin && (
          <div className="mb-8">
            <UploadZone projectSlug={projectSlug} config={config} />
            <FileQueueManager projectSlug={projectSlug} allTags={initialTags} isAdmin={isAdmin} />
          </div>
        )}

        {/* Tag Filters */}
        <div className="mb-8">
          <TagFilters projectSlug={projectSlug} isAdmin={isAdmin} />
        </div>

        {/* Masonry Grid */}
        <div data-masonry-grid>
          {isRefetching ? (
            <div className="py-16 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
              <p className="mt-4 text-sm text-gray-400">Loading images...</p>
            </div>
          ) : currentImages.length > 0 ? (
            <>
              <MasonryGrid
                projectSlug={projectSlug}
                onDelete={isAdmin ? handleDeleteRequest : undefined}
                onDeleteAlbum={isAdmin ? handleDeleteAlbumRequest : undefined}
                isAdmin={isAdmin}
              />

              {/* Infinite Scroll Sentinel (only when no filters active) */}
              {selectedTags.length === 0 && hasMoreImages && !isRefetching && (
                <div ref={sentinelRef} className="h-1" aria-hidden="true" />
              )}

              {/* Loading More Indicator */}
              {isLoadingMore && (
                <div className="mt-4 py-8 text-center">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-b-2 border-blue-500"></div>
                  <p className="mt-2 text-sm text-gray-400">Loading more images...</p>
                </div>
              )}

              {/* End of Results */}
              {!hasMoreImages && selectedTags.length === 0 && (
                <div className="mt-4 py-8 text-center text-sm text-gray-500">
                  All {currentImages.length} images loaded
                </div>
              )}
            </>
          ) : (
            <div className="py-16 text-center">
              <p className="text-lg text-gray-400">
                {selectedTags.length > 0
                  ? 'No images match the selected filters'
                  : `No ${config.displayName.toLowerCase()} yet`}
              </p>
              {isAdmin && selectedTags.length === 0 && (
                <p className="mt-2 text-gray-500">Upload images using the area above</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <ImageLightbox images={currentImages} projectSlug={projectSlug} isAdmin={isAdmin} />
      )}

      {/* Soft Delete Dialog */}
      {deleteMode === 'soft' && imageToDelete && (
        <SoftDeleteDialog
          imageId={imageToDelete}
          imageName={images.find(img => img.id === imageToDelete)?.filename_storage || 'image'}
          onConfirm={() => handleSoftDeleteConfirm(imageToDelete)}
          onCancel={handleCloseSoftDeleteDialog}
        />
      )}

      {/* Permanent Delete Dialog (Admin Only) */}
      {deleteMode === 'permanent' && imageToDelete && isAdmin && (
        <PermanentDeleteDialog
          imageId={imageToDelete}
          imageName={images.find(img => img.id === imageToDelete)?.filename_storage || 'image'}
          fileSize={images.find(img => img.id === imageToDelete)?.file_size || 0}
          onConfirm={() => handlePermanentDeleteConfirm(imageToDelete)}
          onCancel={handleClosePermanentDeleteDialog}
        />
      )}

      {/* Undo Notification */}
      {undoImageId && (
        <UndoNotification
          message={`Image deleted. You have 60 seconds to undo.`}
          onUndo={() => handleUndoDelete(undoImageId)}
          onDismiss={() => setUndoImageId(null)}
          duration={60000}
        />
      )}

      {/* Deleted Items View (Admin Only) */}
      {isAdmin && showDeletedItems && (
        <DeletedItemsView
          deletedImages={getSoftDeletedImages()}
          onRestore={handleUndoDelete}
          onPermanentlyDelete={imageId => {
            handleDeletePermanentRequest(imageId);
            return Promise.resolve();
          }}
        />
      )}

      {/* Mouse Following Counter */}
      <MouseFollowingCounter imageCount={selectedImageCount} albumCount={selectedAlbumCount} />
    </div>
  );
}
