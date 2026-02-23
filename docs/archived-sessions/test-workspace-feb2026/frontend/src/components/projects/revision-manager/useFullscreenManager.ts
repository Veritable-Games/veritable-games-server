'use client';

import { useState, useEffect, useRef } from 'react';

interface FullscreenState {
  bodyOverflow: string;
  documentScrollTop: number;
}

export function useFullscreenManager() {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [layoutBeforeFullscreen, setLayoutBeforeFullscreen] = useState<FullscreenState | null>(
    null
  );

  // Handle fullscreen state and layout management
  useEffect(() => {
    if (isFullScreen && !layoutBeforeFullscreen) {
      // Save current layout state only when entering fullscreen
      setLayoutBeforeFullscreen({
        bodyOverflow: document.body.style.overflow || 'auto',
        documentScrollTop: window.scrollY,
      });
    }

    if (isFullScreen) {
      // Apply comprehensive fullscreen protection
      document.body.classList.add('revision-manager-fullscreen-active');
      document.documentElement.style.setProperty('--revision-manager-fullscreen', '1');

      // Force scroll position to top to prevent layout issues
      window.scrollTo(0, 0);

      // Additional protection - hide floating elements directly
      const style = document.createElement('style');
      style.id = 'revision-manager-fullscreen-styles';
      style.textContent = `
        .fixed.bottom-4.right-4,
        [class*="gameStateOverlay"] {
          display: none !important;
        }
        body {
          overflow: hidden !important;
          position: fixed !important;
          width: 100% !important;
        }
      `;
      document.head.appendChild(style);
    } else {
      // Restore original layout
      document.body.classList.remove('revision-manager-fullscreen-active');
      document.documentElement.style.removeProperty('--revision-manager-fullscreen');

      // Remove temporary styles
      const style = document.getElementById('revision-manager-fullscreen-styles');
      if (style) {
        document.head.removeChild(style);
      }

      // Restore scroll position and layout
      if (layoutBeforeFullscreen) {
        // Use timeout to ensure layout restoration happens after React re-render
        setTimeout(() => {
          window.scrollTo(0, layoutBeforeFullscreen.documentScrollTop);
        }, 50);
        setLayoutBeforeFullscreen(null);
      }
    }

    // Cleanup on unmount
    return () => {
      if (isFullScreen) {
        document.body.classList.remove('revision-manager-fullscreen-active');
        document.documentElement.style.removeProperty('--revision-manager-fullscreen');

        const style = document.getElementById('revision-manager-fullscreen-styles');
        if (style) {
          document.head.removeChild(style);
        }
      }
    };
  }, [isFullScreen]);

  // Handle escape key for full-screen exit
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };

    if (isFullScreen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [isFullScreen]);

  return {
    isFullScreen,
    setIsFullScreen,
  };
}
