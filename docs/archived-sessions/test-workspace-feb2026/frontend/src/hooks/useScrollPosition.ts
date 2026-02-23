/**
 * Hook: useScrollPosition
 *
 * Saves and restores scroll position when filters change
 * Uses sessionStorage for persistence across navigation
 */

import { useEffect, useRef } from 'react';

interface UseScrollPositionOptions {
  key?: string;
  enabled?: boolean;
  onScroll?: (position: number) => void;
}

export function useScrollPosition({
  key = 'library-scroll-position',
  enabled = true,
  onScroll,
}: UseScrollPositionOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef(false);

  // Save scroll position before unmount or when explicitly called
  const savePosition = () => {
    if (!enabled || !containerRef.current) return;

    const position = containerRef.current.scrollTop;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(key, position.toString());
    }
  };

  // Restore scroll position after DOM update
  const restorePosition = () => {
    if (!enabled || !containerRef.current || isRestoringRef.current) return;

    // Use requestAnimationFrame to ensure DOM is fully updated
    requestAnimationFrame(() => {
      if (!containerRef.current) return;

      isRestoringRef.current = true;

      if (typeof window !== 'undefined') {
        const saved = sessionStorage.getItem(key);
        if (saved) {
          const position = parseInt(saved, 10);
          if (position > 0) {
            containerRef.current!.scrollTop = position;
          }
        }
      }

      setTimeout(() => {
        isRestoringRef.current = false;
      }, 100);
    });
  };

  // Track scroll position during scrolling
  const handleScroll = () => {
    if (!enabled || !containerRef.current) return;

    const position = containerRef.current.scrollTop;
    sessionStorage.setItem(key, position.toString());

    if (onScroll) {
      onScroll(position);
    }
  };

  // Save position on unmount
  useEffect(() => {
    return () => {
      savePosition();
    };
  }, [enabled, key]);

  // Add scroll listener
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [enabled, onScroll, key]);

  return {
    ref: containerRef,
    savePosition,
    restorePosition,
  };
}
