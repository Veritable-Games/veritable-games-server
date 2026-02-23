'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useReferencesStore } from '@/lib/stores/referencesStore';
import type { ReferenceImage } from '@/types/project-references';
import { isVideo } from '@/types/project-references';
import { LightboxTagSystem } from './tags/LightboxTagSystem';
import { useImageZoom } from '@/hooks/useImageZoom';
import { ImageLightboxZoomControls } from './ImageLightboxZoomControls';
import { fetchWithCSRF } from '@/lib/utils/csrf';
import dynamic from 'next/dynamic';
import { logger } from '@/lib/utils/logger';

// Dynamically import Plyr for video playback in lightbox
const Plyr = dynamic(() => import('plyr-react'), {
  ssr: false,
  loading: () => (
    <div
      className="flex w-full items-center justify-center rounded-lg bg-gray-800"
      style={{ aspectRatio: '16/9' }}
    >
      <div className="text-gray-400">Loading player...</div>
    </div>
  ),
});

// Import Plyr CSS
if (typeof window !== 'undefined') {
  // @ts-ignore - CSS import
  import('plyr-react/plyr.css');
}

/**
 * Full-screen Lightbox Modal Component
 * Simple tag management only
 */

interface ImageLightboxProps {
  images: ReferenceImage[];
  projectSlug: string;
  isAdmin: boolean;
}

export function ImageLightbox({ images, projectSlug, isAdmin }: ImageLightboxProps) {
  const {
    selectedImageIndex,
    closeLightbox,
    nextImage,
    previousImage,
    allTags,
    albums,
    updateImage,
    setAllTags,
    setSelectedAlbum,
    selectedAlbumId,
    config,
    removeImageFromAlbum,
    videoPlaybackTime,
    videoWasPlaying,
    clearVideoPlaybackState,
  } = useReferencesStore();

  // Reorder state
  const [isReordering, setIsReordering] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);

  // Date edit state
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editDateValue, setEditDateValue] = useState('');

  // Track if drag just ended to prevent accidental backdrop clicks
  const justDraggedRef = useRef(false);
  const prevIsDraggingRef = useRef(false);
  const dragClearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Video player ref for applying playback state
  const lightboxPlayerRef = useRef<{ plyr: any } | null>(null);

  if (selectedImageIndex === null || images.length === 0) {
    return null;
  }

  const currentImage = images[selectedImageIndex];

  if (!currentImage) {
    return null;
  }

  // Find album containing current image
  const currentAlbum = albums.find(album => album.images.some(img => img.id === currentImage.id));

  // If in album, find position within album
  let albumImageIndex = -1;
  if (currentAlbum) {
    albumImageIndex = currentAlbum.images.findIndex(img => img.id === currentImage.id);
  }

  const isFirst = selectedImageIndex === 0;
  const isLast = selectedImageIndex === images.length - 1;

  // Initialize zoom/pan functionality
  const zoom = useImageZoom({
    minScale: 1,
    maxScale: 4,
    resetOnImageChange: currentImage.id,
  });

  // Handle moving image in album (reorder mode) - must be defined before handleKeyDown
  const handleMoveImageInAlbum = useCallback(
    async (direction: 'left' | 'right') => {
      if (!currentAlbum || !config || isReordering || albumImageIndex === -1) return;

      const newIndex = direction === 'left' ? albumImageIndex - 1 : albumImageIndex + 1;

      // Validate bounds
      if (newIndex < 0 || newIndex >= currentAlbum.images.length) return;

      setIsReordering(true);

      try {
        // Get ordered image IDs with new order
        const newImages = [...currentAlbum.images];
        const [movedImage] = newImages.splice(albumImageIndex, 1);
        newImages.splice(newIndex, 0, movedImage!);
        const orderedImageIds = newImages.map(img => img.id);

        // Update UI optimistically
        useReferencesStore.setState(state => ({
          albums: state.albums.map(a =>
            a.id === currentAlbum.id ? { ...a, images: newImages } : a
          ),
        }));

        // Call API to persist the change
        const galleryType = config.galleryType;
        const response = await fetchWithCSRF(
          `/api/projects/${projectSlug}/${galleryType}/albums/${currentAlbum.id}/reorder`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderedImageIds }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to reorder images');
        }
      } catch (error) {
        logger.error('Failed to reorder album images:', error);
        window.location.reload();
      } finally {
        setIsReordering(false);
      }
    },
    [currentAlbum, config, isReordering, albumImageIndex, projectSlug]
  );

  // Validate and parse flexible date formats (YYYY, YYYY-MM, YYYY-MM-DD)
  const parseDateInput = (input: string): { valid: boolean; isoString?: string } => {
    const trimmed = input.trim();

    // Match flexible formats: YYYY, YYYY-MM, YYYY-MM-DD
    const dateRegex = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/;
    const match = trimmed.match(dateRegex);

    if (!match) {
      return { valid: false };
    }

    const yearStr = match[1];
    const monthStr = match[2];
    const dayStr = match[3];

    if (!yearStr) return { valid: false };

    const year = parseInt(yearStr, 10);
    const month = monthStr ? parseInt(monthStr, 10) : 1;
    const day = dayStr ? parseInt(dayStr, 10) : 1;

    // Validate ranges
    if (year < 1000 || year > 2100) return { valid: false };
    if (month < 1 || month > 12) return { valid: false };
    if (day < 1 || day > 31) return { valid: false };

    // Create date string in ISO format
    const dateObj = new Date(year, month - 1, day);
    const isoString = dateObj.toISOString();

    return { valid: true, isoString };
  };

  // Handle Ctrl+click on date to enter edit mode
  const handleDateClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isAdmin || (config?.galleryType !== 'concept-art' && config?.galleryType !== 'history'))
        return;

      if (e.ctrlKey || e.metaKey) {
        e.stopPropagation();
        setIsEditingDate(true);

        // Initialize input with current date or empty
        if (currentImage.created_at) {
          const date = new Date(currentImage.created_at);
          const isoDate = date.toISOString().split('T')[0] || '';
          setEditDateValue(isoDate);
        } else {
          setEditDateValue('');
        }

        // Focus input on next render
        setTimeout(() => {
          dateInputRef.current?.focus();
          dateInputRef.current?.select();
        }, 0);
      }
    },
    [isAdmin, config, currentImage]
  );

  // Handle saving the edited date
  const handleSaveDate = useCallback(async () => {
    const parsed = parseDateInput(editDateValue);

    if (!parsed.valid || !parsed.isoString) {
      alert('Invalid date format. Use YYYY, YYYY-MM, or YYYY-MM-DD');
      return;
    }

    try {
      const response = await fetchWithCSRF(
        `/api/projects/${projectSlug}/${config?.galleryType}/images/${currentImage.id}/date`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ created_at: parsed.isoString }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update image date');
      }

      // Update the store
      updateImage(currentImage.id, {
        ...currentImage,
        created_at: parsed.isoString,
      });

      setIsEditingDate(false);
      setEditDateValue('');
    } catch (error) {
      logger.error('Failed to update image date:', error);
      alert('Failed to update date');
    }
  }, [editDateValue, parseDateInput, projectSlug, config, currentImage, updateImage]);

  // Handle canceling date edit
  const handleCancelDateEdit = useCallback(() => {
    setIsEditingDate(false);
    setEditDateValue('');
  }, []);

  // Enhanced keyboard navigation with zoom/pan support
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isZoomed = zoom.scale > 1;

      // Track Ctrl key for reorder mode
      if (e.key === 'Control') {
        setIsReorderMode(true);
        return;
      }

      // Zoom controls (Ctrl+/- not allowed, only when reorder mode is off)
      if (!isReorderMode) {
        if (['+', '='].includes(e.key)) {
          e.preventDefault();
          zoom.zoomIn();
          return;
        }
        if (['-', '_'].includes(e.key)) {
          e.preventDefault();
          zoom.zoomOut();
          return;
        }
      }

      if (e.key === '0' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        zoom.resetZoom();
        return;
      }

      // Navigation with context awareness
      switch (e.key) {
        case 'Escape':
          if (isEditingDate) {
            handleCancelDateEdit();
            e.preventDefault();
          } else if (isReorderMode) {
            setIsReorderMode(false);
            e.preventDefault();
          } else if (isZoomed) {
            zoom.resetZoom();
          } else {
            closeLightbox();
          }
          break;
        case 'Enter':
          if (isEditingDate) {
            handleSaveDate();
            e.preventDefault();
          }
          break;
        case 'ArrowLeft':
          if (isReorderMode && currentAlbum && albumImageIndex !== -1) {
            // Reorder mode: move image left in album
            e.preventDefault();
            handleMoveImageInAlbum('left');
          } else if ((e.altKey || !isZoomed) && !isReorderMode) {
            // Navigate images with Alt or when not zoomed
            if (!isFirst) previousImage();
          }
          break;
        case 'ArrowRight':
          if (isReorderMode && currentAlbum && albumImageIndex !== -1) {
            // Reorder mode: move image right in album
            e.preventDefault();
            handleMoveImageInAlbum('right');
          } else if ((e.altKey || !isZoomed) && !isReorderMode) {
            // Navigate images with Alt or when not zoomed
            if (!isLast) nextImage();
          }
          break;
      }
    },
    [
      closeLightbox,
      nextImage,
      previousImage,
      isFirst,
      isLast,
      zoom,
      isReorderMode,
      currentAlbum,
      albumImageIndex,
      handleMoveImageInAlbum,
      isEditingDate,
      handleCancelDateEdit,
      handleSaveDate,
    ]
  );

  // Handle Ctrl key release to exit reorder mode
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Control') {
      setIsReorderMode(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown, handleKeyUp]);

  // Track when drag ends to prevent accidental backdrop clicks
  // When user drags and releases mouse outside content area, click event fires on backdrop
  useEffect(() => {
    const wasDragging = prevIsDraggingRef.current;
    const isDragging = zoom.isDragging;

    if (wasDragging && !isDragging) {
      // Drag just ended - set flag to ignore clicks for 200ms
      justDraggedRef.current = true;
      dragClearTimeoutRef.current = setTimeout(() => {
        justDraggedRef.current = false;
        dragClearTimeoutRef.current = null;
      }, 200);
    } else if (isDragging && dragClearTimeoutRef.current) {
      // Dragging started again - clear any pending timeout
      clearTimeout(dragClearTimeoutRef.current);
      dragClearTimeoutRef.current = null;
      justDraggedRef.current = false;
    }

    // Update previous state for next comparison
    prevIsDraggingRef.current = isDragging;
  }, [zoom.isDragging]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (dragClearTimeoutRef.current) {
        clearTimeout(dragClearTimeoutRef.current);
      }
    };
  }, []);

  // Apply video playback state when player is ready
  useEffect(() => {
    if (!isVideo(currentImage)) {
      return;
    }

    // Check if we have stored playback state to apply
    if (videoPlaybackTime === null) {
      logger.info('[ImageLightbox] No playback state to apply');
      return;
    }

    logger.info('[ImageLightbox] Attempting to apply playback state from useEffect');

    // Poll for player readiness
    const checkAndApply = () => {
      logger.info('[ImageLightbox] Checking player readiness...', {
        hasRef: !!lightboxPlayerRef.current,
        hasPlyr: !!lightboxPlayerRef.current?.plyr,
        playbackTime: videoPlaybackTime,
        wasPlaying: videoWasPlaying,
      });

      if (lightboxPlayerRef.current?.plyr) {
        const player = lightboxPlayerRef.current.plyr;

        logger.info('[ImageLightbox] Player found! Inspecting structure:', {
          player,
          playerKeys: Object.keys(player),
          hasPlay: typeof player.play,
          hasMedia: !!player.media,
          mediaType: player.media ? typeof player.media : 'none',
          currentTime: videoPlaybackTime,
          wasPlaying: videoWasPlaying,
        });

        // Try to set currentTime on the media element
        if (player.media) {
          logger.info('[ImageLightbox] Setting currentTime on media element');
          player.media.currentTime = videoPlaybackTime;

          logger.info('[ImageLightbox] After setting currentTime:', player.media.currentTime);

          if (videoWasPlaying) {
            logger.info('[ImageLightbox] Attempting auto-play on media element...');
            player.media.play().catch((err: any) => {
              logger.info('[ImageLightbox] Auto-play blocked or failed:', err);
            });
          }
        } else {
          logger.info('[ImageLightbox] No media element found!');
        }

        // Clear the stored state after applying
        clearVideoPlaybackState();
        return true; // Successfully applied
      }
      return false; // Not ready yet
    };

    // Try immediately
    if (checkAndApply()) {
      logger.info('[ImageLightbox] Applied immediately');
      return;
    }

    // If not ready, poll every 50ms for up to 1 second
    logger.info('[ImageLightbox] Player not ready, starting polling...');
    let attempts = 0;
    const maxAttempts = 20; // 20 * 50ms = 1 second

    const pollInterval = setInterval(() => {
      attempts++;
      logger.info(`[ImageLightbox] Poll attempt ${attempts}/${maxAttempts}`);

      if (checkAndApply()) {
        logger.info('[ImageLightbox] Applied via polling');
        clearInterval(pollInterval);
      } else if (attempts >= maxAttempts) {
        logger.info('[ImageLightbox] Gave up after max attempts');
        clearInterval(pollInterval);
        clearVideoPlaybackState(); // Clear to avoid stale state
      }
    }, 50);

    return () => {
      logger.info('[ImageLightbox] Cleaning up polling interval');
      clearInterval(pollInterval);
    };
  }, [currentImage, videoPlaybackTime, videoWasPlaying, clearVideoPlaybackState]);

  const handleTagsRefresh = async () => {
    if (!config) return;

    try {
      const apiPath = config.uploadPath.replace('[slug]', projectSlug);
      const response = await fetch(`${apiPath}/tags`);
      if (response.ok) {
        const data = await response.json();
        setAllTags(data.tags);
      }
    } catch (error) {
      logger.error('Failed to refresh tags:', error);
    }
  };

  const handleTagUpdate = (updatedImage: ReferenceImage) => {
    updateImage(currentImage.id, { tags: updatedImage.tags });
  };

  // Handle cycling image position forward in album
  const handleCyclePosition = async () => {
    if (!currentAlbum || !config || isReordering) return;

    setIsReordering(true);

    try {
      const currentIndex = currentAlbum.images.findIndex(img => img.id === currentImage.id);
      if (currentIndex === -1) return;

      // Calculate next position (cycle forward, wrap to 0 at end)
      const nextIndex = (currentIndex + 1) % currentAlbum.images.length;

      // Create new order by moving current image to next position
      const newImages = [...currentAlbum.images];
      const [movedImage] = newImages.splice(currentIndex, 1);
      newImages.splice(nextIndex, 0, movedImage!);

      // Get ordered image IDs
      const orderedImageIds = newImages.map(img => img.id);

      // Update UI optimistically
      useReferencesStore.setState(state => ({
        albums: state.albums.map(a => (a.id === currentAlbum.id ? { ...a, images: newImages } : a)),
      }));

      // Call API to persist the change
      const galleryType = config.galleryType;
      const response = await fetchWithCSRF(
        `/api/projects/${projectSlug}/${galleryType}/albums/${currentAlbum.id}/reorder`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedImageIds }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to reorder images');
      }
    } catch (error) {
      logger.error('Failed to reorder album images:', error);
      // Revert optimistic update by reloading
      window.location.reload();
    } finally {
      setIsReordering(false);
    }
  };

  // Handle removing single image from album
  const handleRemoveFromAlbum = async () => {
    if (!currentAlbum || !config) return;

    try {
      // Update UI optimistically
      removeImageFromAlbum(currentAlbum.id, currentImage.id);

      // Call API to persist the change
      const galleryType = config.galleryType;
      const response = await fetchWithCSRF(
        `/api/projects/${projectSlug}/${galleryType}/albums/${currentAlbum.id}/images/${currentImage.id}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to remove image from album');
      }

      // If album had only one image, lightbox will close automatically
      // Otherwise, navigate to next image
      if (currentAlbum.images.length > 1) {
        nextImage();
      } else {
        closeLightbox();
      }
    } catch (error) {
      logger.error('Failed to remove image from album:', error);
      window.location.reload();
    }
  };

  // Handle backdrop clicks - ignore if drag just ended
  const handleBackdropClick = useCallback(() => {
    if (justDraggedRef.current) {
      // Ignore click if drag just ended (prevents accidental close when releasing drag outside content)
      return;
    }
    closeLightbox();
  }, [closeLightbox]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      onClick={handleBackdropClick}
    >
      {/* Close Button */}
      <div className="absolute right-4 top-4 z-10">
        <button
          onClick={e => {
            e.stopPropagation();
            closeLightbox();
          }}
          className="rounded-lg bg-gray-900/80 p-2 text-white transition-colors hover:bg-gray-800"
          aria-label="Close lightbox"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Previous Button */}
      {!isFirst && (
        <button
          onClick={e => {
            e.stopPropagation();
            previousImage();
          }}
          className="absolute left-4 z-10 rounded-lg bg-gray-900/80 p-3 text-white transition-colors hover:bg-gray-800"
          aria-label="Previous image"
        >
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}

      {/* Next Button */}
      {!isLast && (
        <button
          onClick={e => {
            e.stopPropagation();
            nextImage();
          }}
          className="absolute right-4 z-10 rounded-lg bg-gray-900/80 p-3 text-white transition-colors hover:bg-gray-800"
          aria-label="Next image"
        >
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Zoom Controls */}
      <ImageLightboxZoomControls
        scale={zoom.scale}
        onZoomIn={zoom.zoomIn}
        onZoomOut={zoom.zoomOut}
        onReset={zoom.resetZoom}
        canZoomIn={zoom.canZoomIn}
        canZoomOut={zoom.canZoomOut}
      />

      {/* Main Content Area */}
      <div
        className="relative flex flex-col items-center justify-center px-8 py-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Zoomable image container */}
        <div
          ref={zoom.containerRef}
          className="relative flex items-center justify-center overflow-hidden"
          style={{ height: 'calc(92vh - 10rem)' }}
        >
          {/* Position Number Button (Left Side) - Admin Only */}
          {currentAlbum && albumImageIndex !== -1 && isAdmin && (
            <div className="absolute left-0 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-1">
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleCyclePosition();
                }}
                disabled={isReordering}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-gray-900/80 font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Change position (currently ${albumImageIndex + 1} of ${currentAlbum.images.length})`}
                title="Click to cycle position forward"
                onContextMenu={e => {
                  if (!isAdmin) return;
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemoveFromAlbum();
                }}
              >
                #{albumImageIndex + 1}
              </button>
              <span className="whitespace-nowrap text-xs text-gray-400">Position</span>
            </div>
          )}

          {isVideo(currentImage) ? (
            // Render video player in lightbox
            <div className="w-full max-w-5xl">
              {/* Custom Plyr Styles */}
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                  .max-w-5xl .plyr__control--overlaid {
                    background: rgba(37, 99, 235, 0.95) !important;
                    color: white !important;
                    border: none !important;
                    padding: 1.5rem !important;
                    width: 5rem !important;
                    height: 5rem !important;
                    border-radius: 50% !important;
                  }
                  .max-w-5xl .plyr__control--overlaid:hover {
                    background: rgb(37, 99, 235) !important;
                  }
                  .max-w-5xl .plyr__control--overlaid::after {
                    content: '';
                    display: block !important;
                    width: 0;
                    height: 0;
                    border-style: solid;
                    border-width: 1rem 0 1rem 1.75rem;
                    border-color: transparent transparent transparent white;
                    margin-left: 0.25rem;
                  }
                  .max-w-5xl .plyr__control--overlaid svg {
                    display: none !important;
                  }
                  .max-w-5xl .plyr--playing .plyr__control--overlaid {
                    display: none !important;
                  }
                `,
                }}
              />
              <Plyr
                ref={lightboxPlayerRef}
                source={{
                  type: 'video',
                  sources: [
                    {
                      src: currentImage.file_path,
                      type: 'video/mp4',
                    },
                  ],
                  poster: currentImage.poster_path || undefined,
                }}
                options={{
                  controls: [
                    'play-large', // Large center play button
                    // Removed: 'play' (bottom-left play/pause button)
                    'progress',
                    'current-time',
                    'duration',
                    // Removed: 'mute' - user already has volume slider
                    'volume',
                    'pip',
                    // Removed: fullscreen, settings
                  ],
                  settings: [], // Disable all settings
                  fullscreen: {
                    enabled: false, // Disable fullscreen
                    fallback: false,
                    iosNative: false,
                  },
                  speed: {
                    selected: 1,
                    options: [], // Disable speed control
                  },
                  autopause: true,
                  resetOnEnd: true,
                  clickToPlay: true,
                  keyboard: { focused: true, global: false },
                  iconUrl: '',
                  blankVideo: '',
                }}
              />
            </div>
          ) : (
            <img
              ref={zoom.imageRef}
              src={currentImage.file_path}
              alt={`Reference image ${currentImage.id}`}
              onMouseDown={zoom.handleMouseDown}
              onDoubleClick={zoom.handleDoubleClick}
              onTouchStart={zoom.handleTouchStart}
              style={zoom.imageStyle}
              className="max-h-full max-w-[90vw] object-contain"
              draggable={false}
            />
          )}
        </div>

        {/* Resolution and Album Controls (Below Image) */}
        <div className="mt-2 flex w-full items-start justify-between">
          {/* Resolution Info - Lower Left */}
          {currentImage.width && currentImage.height && (
            <div
              className="text-sm text-gray-400"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
            >
              {currentImage.width}x{currentImage.height}
            </div>
          )}

          {/* Album Controls: Dots (Center) */}
          {currentAlbum && albumImageIndex !== -1 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-1">
              {/* Center: Minimal Dots Indicator with Reorder Controls */}
              <div className="flex items-center justify-center gap-0.5">
                {/* Left Arrow (Reorder mode only) */}
                {isReorderMode && albumImageIndex > 0 && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleMoveImageInAlbum('left');
                    }}
                    disabled={isReordering}
                    className="px-1 text-xs text-gray-400 transition-colors hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Move image left"
                  >
                    {'<'}
                  </button>
                )}

                {currentAlbum.images.map((img, idx) => (
                  <button
                    key={img.id}
                    className={`min-h-0 min-w-0 rounded-full p-0 transition-opacity ${
                      idx === albumImageIndex
                        ? `${isReorderMode ? 'bg-blue-400 opacity-80' : 'bg-gray-400 opacity-60'}`
                        : 'bg-gray-600 opacity-25 hover:opacity-40'
                    } ${isReorderMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    style={{ width: '15px', height: '15px' }}
                    onClick={e => {
                      e.stopPropagation();
                      if (isReorderMode) {
                        // In reorder mode, don't navigate on click
                        return;
                      }
                      // Navigate to this album image
                      const targetImageIndex = images.findIndex(i => i.id === img.id);
                      if (targetImageIndex !== -1) {
                        // Use the store's openLightbox to navigate
                        const { openLightbox } = useReferencesStore.getState();
                        openLightbox(targetImageIndex);
                      }
                    }}
                    aria-label={`${isReorderMode ? 'Image' : 'Go to image'} ${idx + 1} of ${currentAlbum.images.length}`}
                  />
                ))}

                {/* Right Arrow (Reorder mode only) */}
                {isReorderMode && albumImageIndex < currentAlbum.images.length - 1 && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleMoveImageInAlbum('right');
                    }}
                    disabled={isReordering}
                    className="px-1 text-xs text-gray-400 transition-colors hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Move image right"
                  >
                    {'>'}
                  </button>
                )}
              </div>

              {/* Reorder Mode Hint - Positioned below dots */}
              {isReorderMode && (
                <div className="whitespace-nowrap text-xs text-gray-400">
                  ← → to reorder • ESC to exit
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Date Created - Lower Right Corner (concept-art and history galleries) */}
      {currentImage.created_at &&
        (config?.galleryType === 'concept-art' || config?.galleryType === 'history') && (
          <div
            className="absolute bottom-12 right-8 z-20 text-sm text-gray-300"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
          >
            {isEditingDate ? (
              <div
                onClick={e => e.stopPropagation()} // Prevent lightbox from closing
                className="rounded bg-gray-900/90 px-2 py-1 backdrop-blur-sm"
              >
                <input
                  ref={dateInputRef}
                  type="text"
                  value={editDateValue}
                  onChange={e => setEditDateValue(e.target.value)}
                  placeholder="YYYY or YYYY-MM or YYYY-MM-DD"
                  className="w-40 rounded border border-gray-600 bg-gray-800 px-1 text-xs text-gray-200 focus:border-blue-400 focus:outline-none"
                />
              </div>
            ) : (
              <div
                onClick={handleDateClick}
                className={`rounded bg-gray-900/60 px-2 py-1 backdrop-blur-sm ${
                  isAdmin &&
                  (config?.galleryType === 'concept-art' || config?.galleryType === 'history')
                    ? 'cursor-pointer transition-colors hover:bg-gray-900/80'
                    : ''
                }`}
                title={
                  isAdmin &&
                  (config?.galleryType === 'concept-art' || config?.galleryType === 'history')
                    ? 'Ctrl+Click to edit'
                    : undefined
                }
              >
                {new Date(currentImage.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            )}
          </div>
        )}

      {/* Tags at Bottom */}
      {(currentImage.tags.length > 0 || isAdmin) && (
        <div className="absolute bottom-12 left-1/2 z-10 w-full max-w-[90vw] -translate-x-1/2 px-8">
          <LightboxTagSystem
            image={currentImage}
            allTags={allTags}
            projectSlug={projectSlug}
            isAdmin={isAdmin}
            onTagUpdate={handleTagUpdate}
            onTagsRefresh={handleTagsRefresh}
          />
        </div>
      )}

      {/* Navigation Hint */}
      <div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center text-xs text-gray-400"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
      >
        {zoom.scale > 1 ? (
          <span>Arrow keys to pan • Alt+Arrow to navigate • 0 to reset • ESC to close</span>
        ) : (
          <span>
            +/- to zoom • Scroll to zoom • Double-click to zoom • Arrow keys to navigate • ESC to
            close
          </span>
        )}
      </div>
    </div>
  );
}
