'use client';

import { useState, useEffect } from 'react';

interface ImageLightboxZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

export function ImageLightboxZoomControls({
  scale,
  onZoomIn,
  onZoomOut,
  onReset,
  canZoomIn,
  canZoomOut,
}: ImageLightboxZoomControlsProps) {
  const [showIndicator, setShowIndicator] = useState(false);
  const zoomPercentage = Math.round(scale * 100);

  // Show zoom indicator when scale changes
  useEffect(() => {
    if (scale !== 1) {
      setShowIndicator(true);
      const timer = setTimeout(() => setShowIndicator(false), 1500);
      return () => clearTimeout(timer);
    } else {
      setShowIndicator(false);
    }
  }, [scale]);

  return (
    <>
      {/* Zoom controls toolbar */}
      <div
        role="toolbar"
        aria-label="Image zoom controls"
        className="absolute right-4 top-16 z-20 flex flex-col gap-2"
        onClick={e => e.stopPropagation()}
      >
        {/* Zoom in */}
        <button
          onClick={e => {
            e.stopPropagation();
            onZoomIn();
          }}
          disabled={!canZoomIn}
          className="rounded-lg bg-gray-900/80 p-2 text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Zoom in (current: ${zoomPercentage}%)`}
          aria-keyshortcuts="+ ="
          title="Zoom in (+)"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
            />
          </svg>
        </button>

        {/* Reset zoom */}
        <button
          onClick={e => {
            e.stopPropagation();
            onReset();
          }}
          disabled={scale === 1}
          className="rounded-lg bg-gray-900/80 p-2 text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Reset zoom to 100%"
          aria-keyshortcuts="0"
          title="Reset zoom (0)"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>

        {/* Zoom out */}
        <button
          onClick={e => {
            e.stopPropagation();
            onZoomOut();
          }}
          disabled={!canZoomOut}
          className="rounded-lg bg-gray-900/80 p-2 text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Zoom out (current: ${zoomPercentage}%)`}
          aria-keyshortcuts="-"
          title="Zoom out (-)"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
            />
          </svg>
        </button>
      </div>

      {/* Zoom level indicator */}
      {showIndicator && (
        <div
          className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 animate-fade-in items-center gap-3 rounded-lg bg-gray-900/90 px-4 py-2 text-white"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {/* Zoom percentage */}
          <span className="text-sm font-medium">
            {zoomPercentage === 100 ? 'Fit to screen' : `${zoomPercentage}%`}
          </span>

          {/* Visual zoom level indicator */}
          <div className="flex gap-1" aria-hidden="true">
            {[50, 100, 200, 300, 400].map(level => (
              <div
                key={level}
                className={`h-4 w-1 rounded-full transition-colors ${
                  zoomPercentage >= level ? 'bg-blue-400' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>

          {/* Zoom status indicator */}
          {scale > 1 && (
            <span className="border-l border-gray-600 pl-3 text-xs text-blue-300">Zoomed</span>
          )}
        </div>
      )}

      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {scale !== 1 && `Zoom level: ${zoomPercentage}%`}
        {scale > 1 && '. Use arrow keys to pan or drag to move image'}
      </div>
    </>
  );
}
