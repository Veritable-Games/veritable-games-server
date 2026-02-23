/**
 * VideoCardHTML5 Component
 *
 * Displays a video using native HTML5 <video> element
 * - Zero dependencies (no npm packages)
 * - Native browser controls (varies by browser)
 * - Lightweight alternative to Plyr
 * - Progressive download support
 *
 * PROS:
 * - No additional dependencies
 * - Extremely lightweight
 * - Works everywhere
 *
 * CONS:
 * - Inconsistent UI across browsers
 * - Less accessible than Plyr
 * - Fewer customization options
 */

'use client';

import { useState } from 'react';
import { PlayIcon } from '@heroicons/react/24/solid';
import type { ReferenceImage } from '@/types/project-references';

interface VideoCardHTML5Props {
  video: ReferenceImage;
  onDelete?: () => void;
  onClick?: () => void;
  isAdmin: boolean;
}

export function VideoCardHTML5({ video, onDelete, onClick, isAdmin }: VideoCardHTML5Props) {
  const [showPlayer, setShowPlayer] = useState(false);

  // Format duration (seconds) as MM:SS
  const formatDuration = (seconds?: number | null): string => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!showPlayer) {
    // Show poster thumbnail with play button overlay
    return (
      <div
        className="video-card group relative cursor-pointer overflow-hidden rounded-lg"
        onClick={() => {
          setShowPlayer(true);
          onClick?.();
        }}
      >
        {/* Poster image */}
        <img
          src={video.poster_path || '/placeholder-video.png'}
          alt={video.filename_storage}
          className="h-auto w-full"
        />

        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="transform rounded-full bg-blue-600 p-4 shadow-lg transition-transform duration-200 group-hover:scale-110">
            <PlayIcon className="h-12 w-12 text-white" />
          </div>
        </div>

        {/* Duration badge */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-1 text-xs font-medium text-white">
            {formatDuration(video.duration)}
          </div>
        )}

        {/* Video icon badge */}
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/80 px-2 py-1 text-xs font-medium text-white">
          <svg
            className="h-3 w-3"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
          VIDEO
        </div>

        {/* Delete button (admin only) */}
        {isAdmin && (
          <button
            onClick={e => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="absolute right-2 top-2 rounded bg-red-600 px-3 py-1 text-sm font-medium text-white opacity-0 transition-opacity hover:bg-red-700 group-hover:opacity-100"
          >
            Delete
          </button>
        )}
      </div>
    );
  }

  // Show HTML5 video player
  return (
    <div className="video-card overflow-hidden rounded-lg">
      <video
        controls
        preload="metadata"
        poster={video.poster_path || undefined}
        className="h-auto w-full bg-black"
        style={{ aspectRatio: '16 / 9' }}
      >
        <source src={video.file_path} type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Admin controls below player */}
      {isAdmin && (
        <div className="mt-2 flex items-center justify-between text-sm text-gray-400">
          <span className="truncate">{video.filename_storage}</span>
          <button
            onClick={e => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="ml-2 text-red-500 hover:text-red-400"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
