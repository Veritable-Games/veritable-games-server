'use client';

import { useRef, useState } from 'react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { useReferencesStore } from '@/lib/stores/referencesStore';
import { ImageSkeleton } from './ImageSkeleton';
import type { ReferenceAlbum, AlbumId, ReferenceImageId } from '@/types/project-references';

interface AlbumCardProps {
  album: ReferenceAlbum;
  isAdmin: boolean;
  onClick: () => void; // Open lightbox at album's first image
  onDragStart?: (albumId: AlbumId) => void;
  onDragEnd?: () => void;
  onDragOver?: (albumId: AlbumId) => void;
  onDragLeave?: () => void;
  onDrop?: (draggedId: ReferenceImageId | AlbumId, targetId: AlbumId) => Promise<void>; // draggedId can be image or album (async)
}

/**
 * Album Card Component
 * Displays an album in the masonry grid with cover image and image count badge
 */

export function AlbumCard({
  album,
  isAdmin,
  onClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: AlbumCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const toggleAlbumSelection = useReferencesStore(state => state.toggleAlbumSelection);
  const selectedAlbumIds = useReferencesStore(state => state.selectedAlbumIds);
  const selectedImageIds = useReferencesStore(state => state.selectedImageIds);
  const clearSelection = useReferencesStore(state => state.clearSelection);
  const isSelected = selectedAlbumIds.has(album.id);

  // Lazy load with intersection observer
  const isVisible = useIntersectionObserver(cardRef as React.RefObject<Element>, {
    threshold: 0.1,
    rootMargin: '200px',
    triggerOnce: true,
  });

  // Use last image in album as cover
  const coverImage = album.images[album.images.length - 1];

  if (!coverImage) {
    // Empty album shouldn't happen, but handle gracefully
    return null;
  }

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Ctrl+Click or Cmd+Click for selection (admin only)
    if ((e.ctrlKey || e.metaKey) && isAdmin) {
      e.preventDefault();
      e.stopPropagation();
      toggleAlbumSelection(album.id);
    } else {
      // Clear selection before opening album on regular click
      if (selectedImageIds.size > 0 || selectedAlbumIds.size > 0) {
        clearSelection();
      }
      onClick();
    }
  };

  // Drag and drop handlers for album combining
  const handleDragStartEvent = (e: React.DragEvent) => {
    if (onDragStart) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('albumId', album.id.toString());
      onDragStart(album.id);
    }
  };

  const handleDragEndEvent = (e: React.DragEvent) => {
    if (onDragEnd) {
      onDragEnd();
    }
  };

  const handleDragOverEvent = (e: React.DragEvent) => {
    if (onDragOver) {
      // Prevent drop on selected items - they're part of the payload, not the target
      if (isSelected) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }

      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      onDragOver(album.id);
    }
  };

  const handleDragLeaveEvent = (e: React.DragEvent) => {
    if (onDragLeave) {
      onDragLeave();
    }
  };

  const handleDropEvent = (e: React.DragEvent) => {
    e.preventDefault();
    if (onDrop) {
      // Check if dragging an image or an album
      const imageId = e.dataTransfer.getData('imageId');
      const albumId = e.dataTransfer.getData('albumId');

      const draggedId = imageId ? parseInt(imageId) : parseInt(albumId);
      onDrop(draggedId as AlbumId, album.id);
    }
    if (onDragLeave) {
      onDragLeave();
    }
  };

  return (
    <div
      ref={cardRef}
      className={`group relative cursor-pointer overflow-hidden border-2 border-blue-500/50 bg-gray-900/70 hover:border-blue-400 ${
        isSelected
          ? 'outline-3 outline outline-offset-4 outline-blue-500'
          : 'rounded transition-all'
      }`}
      onClick={handleCardClick}
      draggable={!!onDragStart}
      onDragStart={handleDragStartEvent}
      onDragEnd={handleDragEndEvent}
      onDragOver={handleDragOverEvent}
      onDragLeave={handleDragLeaveEvent}
      onDrop={handleDropEvent}
    >
      {/* Image Container */}
      <div className="relative w-full">
        {!imageLoaded && <ImageSkeleton aspectRatio={coverImage.aspect_ratio} />}

        {isVisible && !imageError && (
          <img
            src={coverImage.file_path}
            alt={`Album ${album.id} cover`}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '800px',
              objectFit: 'contain',
              display: imageLoaded ? 'block' : 'none',
            }}
            className="transition-opacity duration-300"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}

        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-gray-500">
            <div className="text-center">
              <svg
                className="mx-auto mb-2 h-12 w-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm">Failed to load</p>
            </div>
          </div>
        )}

        {/* Album Badge Overlay - Bottom Left */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-blue-600/90 px-2 py-1 shadow-lg backdrop-blur-sm">
          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-sm font-semibold text-white">{album.image_count}</span>
        </div>

        {/* Selection Checkmark Badge (top-left to avoid collision with album badge) */}
        {isSelected && (
          <div className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 shadow-lg">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
