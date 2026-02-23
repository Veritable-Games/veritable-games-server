/**
 * Safe Event Listener Hook
 * Automatically handles cleanup and prevents memory leaks
 */

import { useEffect, useRef } from 'react';

interface UseEventListenerOptions {
  enabled?: boolean;
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
}

/**
 * Custom hook for adding event listeners with automatic cleanup
 * Prevents memory leaks by ensuring listeners are always removed
 */
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element?: HTMLElement | Window | Document | null,
  options?: UseEventListenerOptions
): void;
export function useEventListener<K extends keyof DocumentEventMap>(
  eventName: K,
  handler: (event: DocumentEventMap[K]) => void,
  element?: HTMLElement | Window | Document | null,
  options?: UseEventListenerOptions
): void;
export function useEventListener<K extends keyof HTMLElementEventMap>(
  eventName: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  element?: HTMLElement | Window | Document | null,
  options?: UseEventListenerOptions
): void;
export function useEventListener(
  eventName: string,
  handler: (event: Event) => void,
  element?: HTMLElement | Window | Document | null,
  options: UseEventListenerOptions = {}
) {
  const { enabled = true, capture = false, once = false, passive = false } = options;

  // Store handler in ref to avoid re-creating effect on every render
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    // Don't add listener if disabled or element doesn't exist
    if (!enabled || !element) return;

    // Get the target element (default to window)
    const targetElement = element || window;

    // Create event listener that calls handler function stored in ref
    const eventListener = (event: Event) => savedHandler.current(event);

    // Add event listener with options
    targetElement.addEventListener(eventName as string, eventListener, {
      capture,
      once,
      passive,
    });

    // Cleanup function removes event listener
    return () => {
      targetElement.removeEventListener(eventName as string, eventListener, capture);
    };
  }, [eventName, element, enabled, capture, once, passive]);
}

/**
 * Hook for handling click outside of an element
 */
export function useClickOutside(
  ref: React.RefObject<HTMLElement>,
  handler: () => void,
  enabled: boolean = true
) {
  useEventListener(
    'mousedown',
    (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    },
    undefined,
    { enabled }
  );

  // Also handle touch events for mobile
  useEventListener(
    'touchstart',
    (event: TouchEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    },
    undefined,
    { enabled, passive: true }
  );
}

/**
 * Hook for handling escape key press
 */
export function useEscapeKey(handler: () => void, enabled: boolean = true) {
  useEventListener(
    'keydown',
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.keyCode === 27) {
        handler();
      }
    },
    undefined,
    { enabled }
  );
}

/**
 * Hook for handling window resize with debouncing
 */
export function useWindowResize(
  handler: (width: number, height: number) => void,
  delay: number = 250,
  enabled: boolean = true
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEventListener(
    'resize',
    () => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout for debounced handler
      timeoutRef.current = setTimeout(() => {
        handler(window.innerWidth, window.innerHeight);
      }, delay);
    },
    window,
    { enabled }
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
}

/**
 * Hook for handling scroll events with throttling
 */
export function useScrollListener(
  handler: (scrollY: number) => void,
  throttleMs: number = 100,
  element?: HTMLElement | null,
  enabled: boolean = true
) {
  const lastRunRef = useRef(Date.now());

  useEventListener(
    'scroll',
    () => {
      const now = Date.now();
      if (now - lastRunRef.current >= throttleMs) {
        const scrollY = element ? element.scrollTop : window.scrollY;
        handler(scrollY);
        lastRunRef.current = now;
      }
    },
    element || window,
    { enabled, passive: true }
  );
}

/**
 * Hook for handling visibility change
 */
export function usePageVisibility(handler: (isVisible: boolean) => void, enabled: boolean = true) {
  useEventListener(
    'visibilitychange',
    () => {
      handler(!document.hidden);
    },
    document,
    { enabled }
  );
}
