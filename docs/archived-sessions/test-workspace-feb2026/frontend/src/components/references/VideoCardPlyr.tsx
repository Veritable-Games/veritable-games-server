/**
 * VideoCardPlyr Component
 *
 * Displays a video using the Plyr player (https://github.com/sampotts/plyr)
 * - Beautiful, accessible UI
 * - Keyboard navigation (Space, arrows, M, F, etc.)
 * - WCAG compliant
 * - 30KB gzipped
 *
 * INSTALLATION:
 * npm install plyr-react
 */

'use client';

import { useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useReferencesStore } from '@/lib/stores/referencesStore';
import type { ReferenceImage, ReferenceImageId } from '@/types/project-references';
import type { APITypes as PlyrAPITypes } from 'plyr-react';
import { logger } from '@/lib/utils/logger';

// Dynamically import Plyr to avoid SSR issues (document is not defined)
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

// Import Plyr CSS only on client side
if (typeof window !== 'undefined') {
  // @ts-ignore - CSS import
  import('plyr-react/plyr.css');
}

interface VideoCardPlyrProps {
  video: ReferenceImage;
  onClick?: () => void;
  isAdmin: boolean;
}

export function VideoCardPlyr({ video, onClick, isAdmin }: VideoCardPlyrProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<PlyrAPITypes | null>(null);

  const toggleImageSelection = useReferencesStore(state => state.toggleImageSelection);
  const selectedImageIds = useReferencesStore(state => state.selectedImageIds);
  const selectedAlbumIds = useReferencesStore(state => state.selectedAlbumIds);
  const clearSelection = useReferencesStore(state => state.clearSelection);
  const setVideoPlaybackState = useReferencesStore(state => state.setVideoPlaybackState);
  const isSelected = selectedImageIds.has(video.id);

  // Memoize Plyr source to prevent re-initialization on selection state changes
  const plyrSource = useMemo(
    () => ({
      type: 'video' as const,
      sources: [
        {
          src: video.file_path,
          type: 'video/mp4',
        },
      ],
      poster: video.poster_path || undefined,
    }),
    [video.file_path, video.poster_path]
  );

  // Memoize Plyr options to prevent re-initialization
  const plyrOptions = useMemo(
    () => ({
      controls: ['play-large', 'progress', 'current-time', 'duration', 'volume', 'pip'],
      settings: [],
      fullscreen: {
        enabled: false,
        fallback: false,
        iosNative: false,
      },
      speed: {
        selected: 1,
        options: [],
      },
      autopause: true,
      resetOnEnd: true,
      clickToPlay: true,
      keyboard: {
        focused: true,
        global: false,
      },
      tooltips: {
        controls: true,
        seek: true,
      },
      captions: {
        active: false,
        update: false,
      },
      iconUrl: '',
      blankVideo: '',
    }),
    []
  );

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Check if clicking on any Plyr control element
    const clickedOnControls =
      target.closest('.plyr__controls') || // Bottom control bar
      target.closest('.plyr__control') || // Any control button
      target.closest('.plyr__control--overlaid') || // Large center play button
      target.closest('.plyr__volume') || // Volume slider
      target.closest('.plyr__progress') || // Progress/timeline bar
      target.closest('.plyr__time') || // Time displays
      target.closest('button[data-plyr]') || // Plyr buttons
      target.matches('.plyr__control') || // Direct match
      target.matches('.plyr__control--overlaid'); // Direct match on play button

    // Ctrl+Click or Cmd+Click for selection (admin only)
    if ((e.ctrlKey || e.metaKey) && isAdmin) {
      e.preventDefault();
      e.stopPropagation();
      toggleImageSelection(video.id);
      return; // Don't trigger player controls or lightbox
    }

    // Don't open lightbox if clicking on player controls
    if (clickedOnControls) {
      return; // Let Plyr handle the control interaction
    }

    // Regular click opens lightbox
    // Clear selection before opening lightbox
    if (selectedImageIds.size > 0 || selectedAlbumIds.size > 0) {
      clearSelection();
    }

    // Capture video playback state for seamless lightbox transition
    if (playerRef.current?.plyr) {
      const player = playerRef.current.plyr;
      const currentTime = player.currentTime || 0;
      const wasPlaying = !player.paused;
      logger.info('[VideoCardPlyr] Capturing playback state:', {
        currentTime,
        wasPlaying,
        playerRef: !!playerRef.current,
        plyr: !!playerRef.current.plyr,
      });
      setVideoPlaybackState(currentTime, wasPlaying);
    } else {
      logger.info('[VideoCardPlyr] NO PLAYER REF - cannot capture state', {
        playerRef: !!playerRef.current,
        plyr: playerRef.current?.plyr,
      });
    }

    onClick?.();
  };

  return (
    <div
      ref={cardRef}
      className={`video-card relative cursor-pointer overflow-hidden rounded-lg ${
        isSelected ? 'ring-4 ring-blue-500' : ''
      }`}
      onClick={handleClick}
    >
      {/* Custom Plyr Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .video-card .plyr__control--overlaid {
            background: rgba(37, 99, 235, 0.95) !important;
            color: white !important;
            border: none !important;
            padding: 1.5rem !important;
            width: 5rem !important;
            height: 5rem !important;
            border-radius: 50% !important;
          }
          .video-card .plyr__control--overlaid:hover {
            background: rgb(37, 99, 235) !important;
          }
          .video-card .plyr__control--overlaid::after {
            content: '';
            display: block !important;
            width: 0;
            height: 0;
            border-style: solid;
            border-width: 1rem 0 1rem 1.75rem;
            border-color: transparent transparent transparent white;
            margin-left: 0.25rem;
          }
          .video-card .plyr__control--overlaid svg {
            display: none !important;
          }
          .video-card .plyr--playing .plyr__control--overlaid {
            display: none !important;
          }
        `,
        }}
      />

      {/* Wrapper for Plyr and selection indicator to avoid DOM insertion conflicts */}
      <div className="relative">
        {/* Selection indicator - always rendered to avoid DOM insertion conflicts */}
        <div
          className={`absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg transition-opacity ${
            isSelected ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <Plyr key={`video-${video.id}`} ref={playerRef} source={plyrSource} options={plyrOptions} />
      </div>
    </div>
  );
}
