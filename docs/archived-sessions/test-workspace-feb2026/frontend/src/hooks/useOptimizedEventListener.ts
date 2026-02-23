/**
 * Optimized Event Listener Hook with Enhanced Memory Management
 * Prevents memory leaks with better cleanup and passive event optimization
 */

import { useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/utils/logger';

type EventType = keyof WindowEventMap | keyof DocumentEventMap | keyof HTMLElementEventMap;

interface UseOptimizedEventListenerOptions {
  enabled?: boolean;
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
  signal?: AbortSignal;
}

/**
 * Enhanced custom hook for adding event listeners with automatic cleanup
 * Features optimized memory management and abort signal support
 */
export function useOptimizedEventListener<K extends EventType>(
  eventName: K,
  handler: (event: any) => void,
  element?: HTMLElement | Window | Document | null,
  options: UseOptimizedEventListenerOptions = {}
) {
  const { enabled = true, capture = false, once = false, passive = false, signal } = options;

  // Store handler in ref to avoid re-creating effect on every render
  const savedHandler = useRef(handler);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update handler reference without triggering effect
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    // Don't add listener if disabled, element doesn't exist, or signal is aborted
    if (!enabled || !element || signal?.aborted) return;

    // Create abort controller for this effect
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Get the target element (default to window)
    const targetElement = element || window;

    // Create event listener that calls handler function stored in ref
    const eventListener = (event: Event) => {
      if (!controller.signal.aborted) {
        savedHandler.current(event);
      }
    };

    // Enhanced event listener options with abort signal
    const listenerOptions = {
      capture,
      once,
      passive,
      signal: controller.signal,
    };

    try {
      // Add event listener with abort signal support (modern browsers)
      if ('addEventListener' in targetElement) {
        targetElement.addEventListener(eventName as string, eventListener, listenerOptions);
      }
    } catch (error) {
      // Fallback for older browsers without abort signal support
      if ('addEventListener' in targetElement) {
        targetElement.addEventListener(eventName as string, eventListener, {
          capture,
          once,
          passive,
        });
      }
    }

    // Cleanup function removes event listener
    return () => {
      controller.abort();

      // Fallback cleanup for browsers without abort signal support
      try {
        if ('removeEventListener' in targetElement) {
          targetElement.removeEventListener(eventName as string, eventListener, capture);
        }
      } catch (error) {
        logger.warn('Event listener cleanup error:', error);
      }
    };
  }, [eventName, element, enabled, capture, once, passive, signal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
}

/**
 * Optimized hook for handling click outside of an element
 */
export function useOptimizedClickOutside(
  ref: React.RefObject<HTMLElement>,
  handler: () => void,
  enabled: boolean = true
) {
  const optimizedHandler = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    },
    [ref, handler]
  );

  useOptimizedEventListener('mousedown', optimizedHandler, document, { enabled, passive: true });

  useOptimizedEventListener('touchstart', optimizedHandler, document, { enabled, passive: true });
}

/**
 * Optimized hook for handling escape key press
 */
export function useOptimizedEscapeKey(handler: () => void, enabled: boolean = true) {
  const optimizedHandler = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.keyCode === 27) {
        event.preventDefault();
        handler();
      }
    },
    [handler]
  );

  useOptimizedEventListener(
    'keydown',
    optimizedHandler,
    document,
    { enabled, passive: false } // Not passive since we might preventDefault
  );
}

/**
 * Optimized hook for handling window resize with advanced debouncing
 */
export function useOptimizedWindowResize(
  handler: (width: number, height: number) => void,
  delay: number = 250,
  enabled: boolean = true
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const frameRef = useRef<number | null>(null);

  const optimizedHandler = useCallback(() => {
    // Cancel existing timeout and animation frame
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }

    // Use requestAnimationFrame for immediate layout calculations
    frameRef.current = requestAnimationFrame(() => {
      // Then debounce the actual handler call
      timeoutRef.current = setTimeout(() => {
        handler(window.innerWidth, window.innerHeight);
      }, delay);
    });
  }, [handler, delay]);

  useOptimizedEventListener('resize', optimizedHandler, window, { enabled, passive: true });

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);
}

/**
 * Optimized hook for handling scroll events with advanced throttling
 */
export function useOptimizedScrollListener(
  handler: (scrollY: number, scrollX: number) => void,
  throttleMs: number = 16, // ~60fps
  element?: HTMLElement | null,
  enabled: boolean = true
) {
  const lastRunRef = useRef(Date.now());
  const frameRef = useRef<number | null>(null);

  const optimizedHandler = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = requestAnimationFrame(() => {
      const now = Date.now();
      if (now - lastRunRef.current >= throttleMs) {
        const scrollY = element ? element.scrollTop : window.scrollY;
        const scrollX = element ? element.scrollLeft : window.scrollX;
        handler(scrollY, scrollX);
        lastRunRef.current = now;
      }
    });
  }, [handler, throttleMs, element]);

  useOptimizedEventListener('scroll', optimizedHandler, element || window, {
    enabled,
    passive: true,
  });

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);
}

/**
 * Optimized hook for handling visibility change with performance tracking
 */
export function useOptimizedPageVisibility(
  handler: (isVisible: boolean, visibilityState: DocumentVisibilityState) => void,
  enabled: boolean = true
) {
  const optimizedHandler = useCallback(() => {
    const isVisible = !document.hidden;
    const visibilityState = document.visibilityState;
    handler(isVisible, visibilityState);
  }, [handler]);

  useOptimizedEventListener('visibilitychange', optimizedHandler, document, {
    enabled,
    passive: true,
  });
}

/**
 * Optimized hook for handling intersection observer with proper cleanup
 */
export function useOptimizedIntersectionObserver(
  ref: React.RefObject<HTMLElement>,
  handler: (entry: IntersectionObserverEntry) => void,
  options: IntersectionObserverInit = {},
  enabled: boolean = true
) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!enabled || !ref.current) return;

    const element = ref.current;

    // Create intersection observer with optimized options
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          handler(entry);
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px',
        ...options,
      }
    );

    observerRef.current = observer;
    observer.observe(element);

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [ref, handler, enabled, options]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);
}

/**
 * Optimized hook for handling media query changes
 */
export function useOptimizedMediaQuery(
  query: string,
  handler: (matches: boolean) => void,
  enabled: boolean = true
) {
  const mediaQueryRef = useRef<MediaQueryList | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    mediaQueryRef.current = mediaQuery;

    const optimizedHandler = (event: MediaQueryListEvent) => {
      handler(event.matches);
    };

    // Use the newer addEventListener API if available
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', optimizedHandler);

      // Call handler immediately with current state
      handler(mediaQuery.matches);

      return () => {
        mediaQuery.removeEventListener('change', optimizedHandler);
      };
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(optimizedHandler);
      handler(mediaQuery.matches);

      return () => {
        mediaQuery.removeListener(optimizedHandler);
      };
    }
  }, [query, handler, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaQueryRef.current) {
        // Modern cleanup
        if (mediaQueryRef.current.removeEventListener) {
          mediaQueryRef.current.removeEventListener('change', () => {});
        }
      }
    };
  }, []);
}

export default useOptimizedEventListener;
