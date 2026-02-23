'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Custom hook for managing focus during SPA route changes
 * Ensures proper focus management for screen reader users
 */
export function useRouteFocusManagement() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Only run on client side after mount and on route change
    if (!isMounted) return;

    // Only run on route change, not initial load
    if (previousPathname.current !== pathname) {
      // Announce route change to screen readers
      announceRouteChange(pathname);

      // Set focus to main content area
      const mainContent = document.getElementById('main-content');
      if (mainContent) {
        // Remove tabindex after focus to maintain natural tab order
        mainContent.focus();
        mainContent.addEventListener(
          'blur',
          () => {
            mainContent.removeAttribute('tabindex');
          },
          { once: true }
        );
      }

      previousPathname.current = pathname;
    }
  }, [pathname, isMounted]);
}

/**
 * Announce route changes to screen readers
 */
function announceRouteChange(pathname: string) {
  // Only run on client side
  if (typeof window === 'undefined') return;

  // Create or get the live region
  let liveRegion = document.getElementById('route-announcer');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'route-announcer';
    liveRegion.setAttribute('aria-live', 'assertive');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    document.body.appendChild(liveRegion);
  }

  // Parse the pathname to create a human-readable announcement
  const pageName = getPageNameFromPath(pathname);
  liveRegion.textContent = `Navigated to ${pageName}`;

  // Clear the announcement after a delay
  setTimeout(() => {
    if (liveRegion) {
      liveRegion.textContent = '';
    }
  }, 1000);
}

/**
 * Convert pathname to human-readable page name
 */
function getPageNameFromPath(pathname: string): string {
  if (pathname === '/') return 'home page';

  const segments = pathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];

  // Handle special cases
  const pageNames: Record<string, string> = {
    forums: 'Forums',
    wiki: 'Wiki',
    library: 'Library',
    projects: 'Projects',
    about: 'About',
    news: 'News',
    admin: 'Admin Panel',
    login: 'Login',
    register: 'Registration',
  };

  return pageNames[lastSegment || ''] || lastSegment?.replace(/-/g, ' ') || 'page';
}

/**
 * Hook for managing keyboard navigation in complex components
 */
export function useKeyboardNavigation(
  items: Array<any>,
  onSelect: (item: any, index: number) => void
) {
  const selectedIndex = useRef(0);
  const containerRef = useRef<HTMLElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!items.length) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          selectedIndex.current = Math.min(selectedIndex.current + 1, items.length - 1);
          focusItem(selectedIndex.current);
          break;

        case 'ArrowUp':
          event.preventDefault();
          selectedIndex.current = Math.max(selectedIndex.current - 1, 0);
          focusItem(selectedIndex.current);
          break;

        case 'Home':
          event.preventDefault();
          selectedIndex.current = 0;
          focusItem(selectedIndex.current);
          break;

        case 'End':
          event.preventDefault();
          selectedIndex.current = items.length - 1;
          focusItem(selectedIndex.current);
          break;

        case 'Enter':
        case ' ':
          event.preventDefault();
          if (items[selectedIndex.current]) {
            onSelect(items[selectedIndex.current], selectedIndex.current);
          }
          break;

        case 'Escape':
          // Allow parent component to handle escape
          break;
      }
    },
    [items, onSelect]
  );

  const focusItem = useCallback((index: number) => {
    if (!containerRef.current) return;

    const items = containerRef.current.querySelectorAll('[role="option"]');
    const item = items[index] as HTMLElement;

    if (item) {
      item.focus();
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('keydown', handleKeyDown as EventListener);
    return () => {
      container.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [handleKeyDown]);

  return {
    containerRef,
    selectedIndex: selectedIndex.current,
    setSelectedIndex: (index: number) => {
      selectedIndex.current = index;
      focusItem(index);
    },
  };
}

/**
 * Hook for managing focus trap within modals/dialogs
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Store the currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Get all focusable elements within the container
    const getFocusableElements = () => {
      if (!containerRef.current) return [];

      const selector = [
        'a[href]:not([disabled])',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(',');

      return Array.from(containerRef.current.querySelectorAll(selector)) as HTMLElement[];
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Trap focus within the container
      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Focus the first focusable element
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0]?.focus();
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus to the previously focused element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Hook for managing live regions for dynamic content
 */
export function useLiveRegion(ariaLive: 'polite' | 'assertive' = 'polite') {
  const regionRef = useRef<HTMLDivElement | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Only create live region on client side after mount
    if (!isMounted) return;

    // Create live region element
    const region = document.createElement('div');
    region.setAttribute('aria-live', ariaLive);
    region.setAttribute('aria-atomic', 'true');
    region.className = 'sr-only';
    document.body.appendChild(region);
    regionRef.current = region;

    return () => {
      if (regionRef.current && document.body.contains(regionRef.current)) {
        document.body.removeChild(regionRef.current);
      }
    };
  }, [ariaLive, isMounted]);

  const announce = useCallback((message: string) => {
    if (regionRef.current) {
      regionRef.current.textContent = message;
      // Clear after announcement
      setTimeout(() => {
        if (regionRef.current) {
          regionRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  return announce;
}

/**
 * Hook for managing reduced motion preferences
 */
export function useReducedMotion() {
  const QUERY = '(prefers-reduced-motion: reduce)';
  const mediaQueryList = typeof window !== 'undefined' ? window.matchMedia(QUERY) : null;

  const getInitialState = () => {
    return mediaQueryList ? mediaQueryList.matches : false;
  };

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getInitialState);

  useEffect(() => {
    if (!mediaQueryList) return;

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', listener);
    } else {
      // Fallback for older browsers
      mediaQueryList.addListener(listener);
    }

    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', listener);
      } else {
        // Fallback for older browsers
        mediaQueryList.removeListener(listener);
      }
    };
  }, [mediaQueryList]);

  return prefersReducedMotion;
}
