'use client';

import { useState, useEffect, useCallback } from 'react';
import { ImageCard } from './ImageCard';
import { VideoCardPlyr } from './VideoCardPlyr';
import { AlbumCard } from './AlbumCard';
import { useReferencesStore } from '@/lib/stores/referencesStore';
import { useOptimisticAlbums } from '@/hooks/useOptimisticAlbums';
import { isVideo } from '@/types/project-references';
import { logger } from '@/lib/utils/logger';
import type {
  ReferenceImage,
  ReferenceImageId,
  ReferenceAlbum,
  AlbumId,
} from '@/types/project-references';

/**
 * Pure CSS Masonry Grid Component with Album and Video Support
 * Uses column-count for responsive layout with no JavaScript library overhead
 * Supports drag-and-drop album creation with optimistic UI updates
 * Automatically detects and renders images vs videos with appropriate players
 */

interface MasonryGridProps {
  projectSlug: string;
  onDelete?: (imageId: ReferenceImageId) => void;
  onDeleteAlbum?: (albumId: AlbumId) => void;
  isAdmin: boolean;
}

export function MasonryGrid({ projectSlug, onDelete, onDeleteAlbum, isAdmin }: MasonryGridProps) {
  const {
    displayItems,
    openLightbox,
    config,
    images,
    albums,
    selectedImageIds,
    selectedAlbumIds,
    getSelectedImages,
    getSelectedAlbums,
    clearSelection,
    setSelectedAlbum,
  } = useReferencesStore();

  const [draggedImageId, setDraggedImageId] = useState<ReferenceImageId | null>(null);
  const [draggedAlbumId, setDraggedAlbumId] = useState<AlbumId | null>(null);
  const [dropTargetId, setDropTargetId] = useState<ReferenceImageId | AlbumId | null>(null);

  // Optimistic album updates with React 19
  const {
    executeCreateAlbum,
    executeAddToAlbum,
    executeAddMultipleToAlbum,
    executeCombineAlbums,
    executeDeleteSelection,
    isPending,
  } = useOptimisticAlbums({
    projectSlug,
    galleryType: config?.galleryType || 'references',
    onSuccess: action => {
      // Clear selection after successful delete
      if (action === 'delete') {
        clearSelection();
      }
    },
    onError: error => {
      logger.error('Operation failed:', error);
    },
  });

  const items = displayItems();

  // Delete selection handler (memoized to prevent infinite loops)
  const handleDeleteSelection = useCallback(async () => {
    const imageIds = Array.from(selectedImageIds);
    const albumIds = Array.from(selectedAlbumIds);
    await executeDeleteSelection(imageIds, albumIds);
  }, [selectedImageIds, selectedAlbumIds, executeDeleteSelection]);

  // Keyboard event listener for Delete and Escape keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete key - delete selected items
      if (e.key === 'Delete' && isAdmin) {
        const imageIds = Array.from(selectedImageIds);
        const albumIds = Array.from(selectedAlbumIds);
        if (imageIds.length > 0 || albumIds.length > 0) {
          e.preventDefault();
          handleDeleteSelection();
        }
      }

      // Escape key - clear selection
      if (e.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin, selectedImageIds, selectedAlbumIds, clearSelection, handleDeleteSelection]);

  // Check if item is an album (type guard)
  const isAlbum = (item: ReferenceImage | ReferenceAlbum): item is ReferenceAlbum => {
    return 'images' in item && 'image_count' in item;
  };

  // Handle image drag start
  const handleDragStart = (imageId: ReferenceImageId) => {
    if (!isAdmin) return;
    setDraggedImageId(imageId);
  };

  // Handle album drag start
  const handleAlbumDragStart = (albumId: AlbumId) => {
    if (!isAdmin) return;
    setDraggedAlbumId(albumId);
  };

  // Handle drag end (cleanup when drag operation ends)
  const handleDragEnd = () => {
    if (!isAdmin) return;
    setDraggedImageId(null);
    setDraggedAlbumId(null);
    setDropTargetId(null);
  };

  // Handle drag over (show drop zone)
  const handleDragOver = (targetId: ReferenceImageId | AlbumId) => {
    if (!isAdmin) return;

    // Prevent drop on selected items - they're part of the payload, not the target
    const isTargetSelected =
      selectedImageIds.has(targetId as ReferenceImageId) ||
      selectedAlbumIds.has(targetId as AlbumId);

    if (isTargetSelected) {
      return; // Don't set as drop target
    }

    setDropTargetId(targetId);
  };

  // Handle drag leave
  const handleDragLeave = () => {
    if (!isAdmin) return;
    setDropTargetId(null);
  };

  // Handle drop (create album, add to album, or combine albums) with optimistic updates
  const handleDrop = async (draggedId: ReferenceImageId, targetId: ReferenceImageId | AlbumId) => {
    if (!isAdmin || isPending) return; // Prevent operations while one is in progress
    setDraggedImageId(null);
    setDraggedAlbumId(null);
    setDropTargetId(null);

    // Don't allow dropping on itself
    if (draggedId === targetId) return;

    // Find the target item to determine if it's an album or image
    const targetItem = items.find(item =>
      isAlbum(item) ? item.id === targetId : item.id === targetId
    );

    if (!targetItem) return;

    // Check if dragged item was selected (determines whether to clear selection after)
    const wasDraggedItemSelected = selectedImageIds.has(draggedId);
    const hasSelectedImages = selectedImageIds.size > 0;

    if (isAlbum(targetItem)) {
      // Dropping onto an album
      if (hasSelectedImages && selectedImageIds.has(draggedId)) {
        // Dragging multiple selected images onto album
        const imageIds = Array.from(selectedImageIds);
        await executeAddMultipleToAlbum(targetId as AlbumId, imageIds);
        clearSelection();
      } else {
        // Dragging single image onto album
        await executeAddToAlbum(targetId as AlbumId, draggedId);
        if (wasDraggedItemSelected) {
          clearSelection();
        }
      }
    } else {
      // Dropping onto an image
      if (hasSelectedImages && selectedImageIds.has(draggedId)) {
        // Dragging multiple selected images onto single image - create album with all
        const imageIds = [targetId as ReferenceImageId, ...Array.from(selectedImageIds)];
        // Use the first two for executeCreateAlbum, then add the rest
        await executeCreateAlbum(draggedId, targetId as ReferenceImageId);
        // TODO: Add remaining images after album creation
        clearSelection();
      } else {
        // Create new album from two images
        await executeCreateAlbum(draggedId, targetId as ReferenceImageId);
        if (wasDraggedItemSelected) {
          clearSelection();
        }
      }
    }
  };

  // Handle drop onto album (can be image or album)
  const handleDropOnAlbum = async (
    draggedId: ReferenceImageId | AlbumId,
    targetAlbumId: AlbumId
  ) => {
    if (!isAdmin || isPending) return;
    setDraggedImageId(null);
    setDraggedAlbumId(null);
    setDropTargetId(null);

    if (draggedId === targetAlbumId) return;

    // Check if dragging an image or an album
    const isDraggingImage = images.some(img => img.id === draggedId);
    const isDraggingAlbum = albums.some(a => a.id === draggedId);

    if (isDraggingImage) {
      // Dragging image onto album - add to album
      const hasSelectedImages = selectedImageIds.size > 0;
      const wasDraggedImageSelected = selectedImageIds.has(draggedId as ReferenceImageId);

      if (hasSelectedImages && wasDraggedImageSelected) {
        // Dragging multiple selected images onto album
        const imageIds = Array.from(selectedImageIds);
        await executeAddMultipleToAlbum(targetAlbumId, imageIds);
        clearSelection();
      } else {
        // Dragging single image onto album
        await executeAddToAlbum(targetAlbumId, draggedId as ReferenceImageId);
        if (wasDraggedImageSelected) {
          clearSelection();
        }
      }
    } else if (isDraggingAlbum) {
      // Dragging album onto album - combine albums
      const hasSelectedAlbums = selectedAlbumIds.size > 0;
      const wasDraggedAlbumSelected = selectedAlbumIds.has(draggedId as AlbumId);

      if (hasSelectedAlbums && wasDraggedAlbumSelected) {
        // Dragging multiple selected albums - combine all into target
        const albumIds = Array.from(selectedAlbumIds);
        await executeCombineAlbums(targetAlbumId, albumIds);
        clearSelection();
      } else {
        // Dragging single album
        await executeCombineAlbums(targetAlbumId, [draggedId as AlbumId]);
        if (wasDraggedAlbumSelected) {
          clearSelection();
        }
      }
    }
  };

  return (
    <>
      {/* Loading Overlay */}
      {isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex items-center gap-3 rounded-lg bg-gray-800 px-6 py-4 shadow-xl">
            <svg className="h-6 w-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="font-medium text-gray-200">Creating album...</p>
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .masonry-grid {
          column-count: 1;
          column-gap: 1rem;
        }

        .masonry-grid-item {
          break-inside: avoid;
          margin-bottom: 1rem;
          display: block;
          width: 100%;
        }

        /* Responsive column counts */
        @media (min-width: 640px) {
          .masonry-grid {
            column-count: 2;
          }
        }

        @media (min-width: 1024px) {
          .masonry-grid {
            column-count: 3;
          }
        }

        @media (min-width: 1536px) {
          .masonry-grid {
            column-count: 4;
          }
        }

        /* Drop zone visual feedback */
        .drop-zone-active {
          outline: 3px dashed #3b82f6;
          outline-offset: 4px;
          background-color: rgba(59, 130, 246, 0.1);
        }

        /* Disable pointer events during loading */
        .masonry-grid.loading {
          pointer-events: none;
          opacity: 0.6;
        }
      `,
        }}
      />

      <div className={`masonry-grid ${isPending ? 'loading' : ''}`}>
        {items.map((item, index) => (
          <div
            key={isAlbum(item) ? `album-${item.id}` : `img-${item.id}`}
            className={`masonry-grid-item ${dropTargetId === item.id ? 'drop-zone-active' : ''}`}
          >
            {isAlbum(item) ? (
              <AlbumCard
                album={item}
                isAdmin={isAdmin}
                onClick={() => {
                  // Find the cover image (last image) in the album
                  const coverImage = item.images[item.images.length - 1];
                  if (!coverImage) return;

                  // Find its index in the full images array (not displayItems)
                  const imageIndex = images.findIndex(img => img.id === coverImage.id);

                  if (imageIndex !== -1) {
                    // Track that we're viewing this album for context-aware navigation
                    setSelectedAlbum(item.id);
                    openLightbox(imageIndex);
                  }
                }}
                onDragStart={isAdmin ? handleAlbumDragStart : undefined}
                onDragEnd={isAdmin ? handleDragEnd : undefined}
                onDragOver={isAdmin ? handleDragOver : undefined}
                onDragLeave={isAdmin ? handleDragLeave : undefined}
                onDrop={isAdmin ? handleDropOnAlbum : undefined}
              />
            ) : isVideo(item) ? (
              <VideoCardPlyr
                video={item}
                isAdmin={isAdmin}
                onClick={() => {
                  // Open video in lightbox when clicking video area (not controls)
                  setSelectedAlbum(null);
                  openLightbox(images.findIndex(img => img.id === item.id));
                }}
              />
            ) : (
              <ImageCard
                image={item}
                index={images.findIndex(img => img.id === item.id)}
                isAdmin={isAdmin}
                onDelete={onDelete}
                onDragStart={isAdmin ? handleDragStart : undefined}
                onDragEnd={isAdmin ? handleDragEnd : undefined}
                onDragOver={isAdmin ? handleDragOver : undefined}
                onDragLeave={isAdmin ? handleDragLeave : undefined}
                onDrop={isAdmin ? handleDrop : undefined}
              />
            )}
          </div>
        ))}
      </div>
    </>
  );
}
