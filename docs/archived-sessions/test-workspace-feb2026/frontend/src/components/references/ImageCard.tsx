'use client';

import { useRef, useState } from 'react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { useReferencesStore } from '@/lib/stores/referencesStore';
import { ImageSkeleton } from './ImageSkeleton';
import type { ReferenceImage, ReferenceImageId } from '@/types/project-references';

interface ImageCardProps {
  image: ReferenceImage;
  index: number;
  isAdmin: boolean;
  onDelete?: (imageId: ReferenceImageId) => void;
  onDragStart?: (imageId: ReferenceImageId) => void;
  onDragEnd?: () => void;
  onDragOver?: (imageId: ReferenceImageId) => void;
  onDragLeave?: () => void;
  onDrop?: (draggedId: ReferenceImageId, targetId: ReferenceImageId) => void;
}

/**
 * Individual Image Card Component
 * Features lazy loading, tag badges, lightbox trigger, and edit/delete actions
 */

export function ImageCard({
  image,
  index,
  isAdmin,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: ImageCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const openLightbox = useReferencesStore(state => state.openLightbox);
  const toggleImageSelection = useReferencesStore(state => state.toggleImageSelection);
  const selectedImageIds = useReferencesStore(state => state.selectedImageIds);
  const selectedAlbumIds = useReferencesStore(state => state.selectedAlbumIds);
  const clearSelection = useReferencesStore(state => state.clearSelection);
  const setSelectedAlbum = useReferencesStore(state => state.setSelectedAlbum);
  const isSelected = selectedImageIds.has(image.id);

  // Lazy load with intersection observer
  const isVisible = useIntersectionObserver(cardRef as React.RefObject<Element>, {
    threshold: 0.1,
    rootMargin: '800px', // Pre-load images 800px before they're visible (reduces scroll lag)
    triggerOnce: true,
  });

  const handleClick = (e: React.MouseEvent) => {
    // Ctrl+Click or Cmd+Click for selection (admin only)
    if ((e.ctrlKey || e.metaKey) && isAdmin) {
      e.preventDefault();
      e.stopPropagation();
      toggleImageSelection(image.id);
    } else {
      // Clear selection before opening lightbox on regular click
      if (selectedImageIds.size > 0 || selectedAlbumIds.size > 0) {
        clearSelection();
      }
      // Clear album context - viewing a standalone image, not in an album
      setSelectedAlbum(null);
      openLightbox(index);
    }
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(image.id);
    }
  };

  // Drag and drop handlers
  const handleDragStartEvent = (e: React.DragEvent) => {
    if (onDragStart) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('imageId', image.id.toString());
      onDragStart(image.id);
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
      onDragOver(image.id);
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
      const draggedId = parseInt(e.dataTransfer.getData('imageId')) as ReferenceImageId;
      onDrop(draggedId, image.id);
    }
    if (onDragLeave) {
      onDragLeave();
    }
  };

  return (
    <div
      ref={cardRef}
      className={`group relative cursor-pointer overflow-hidden border border-gray-700 bg-gray-900/70 hover:border-gray-500 ${
        isSelected
          ? 'outline-3 outline outline-offset-4 outline-blue-500'
          : 'rounded transition-all'
      }`}
      onClick={handleClick}
      draggable={!!onDragStart}
      onDragStart={handleDragStartEvent}
      onDragEnd={handleDragEndEvent}
      onDragOver={handleDragOverEvent}
      onDragLeave={handleDragLeaveEvent}
      onDrop={handleDropEvent}
    >
      {/* Image Container */}
      <div className="relative w-full">
        {!imageLoaded && <ImageSkeleton aspectRatio={image.aspect_ratio} />}

        {isVisible && !imageError && (
          <img
            src={image.file_path}
            alt={image.title || image.filename_storage || `Image ${image.id}`}
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

        {/* Selection Checkmark Badge */}
        {isSelected && (
          <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 shadow-lg">
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
