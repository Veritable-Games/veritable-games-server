/**
 * Layout Utilities - Helper functions for viewport-constrained layouts
 */

/**
 * Prevents page-level scrolling by setting overflow: hidden on html and body
 * Returns a cleanup function to restore original overflow values
 */
export function preventPageScroll(): () => void {
  const originalHtmlOverflow = document.documentElement.style.overflow;
  const originalBodyOverflow = document.body.style.overflow;

  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';

  return () => {
    document.documentElement.style.overflow = originalHtmlOverflow;
    document.body.style.overflow = originalBodyOverflow;
  };
}

/**
 * Hook to prevent page scrolling in React components
 */
export function usePreventPageScroll(enabled: boolean = true) {
  React.useEffect(() => {
    if (!enabled) return;

    return preventPageScroll();
  }, [enabled]);
}

/**
 * Viewport layout configuration object
 */
export const VIEWPORT_LAYOUT = {
  // Container classes
  container: 'h-screen flex flex-col overflow-hidden',

  // Header classes (fixed at top)
  header: 'flex-shrink-0 relative z-50',

  // Body classes (contains sidebar + content)
  body: 'flex-1 flex overflow-hidden min-h-0',

  // Sidebar classes (fixed on left/right)
  sidebar: 'flex-shrink-0 overflow-y-auto max-h-full',

  // Content container classes
  content: 'flex-1 flex flex-col overflow-hidden min-h-0',

  // Scrollable content area classes
  scrollArea: 'flex-1 overflow-y-auto overflow-x-hidden',

  // With padding
  scrollAreaWithPadding: 'flex-1 overflow-y-auto overflow-x-hidden p-6',
} as const;

/**
 * CSS-in-JS styles for viewport layout (if you prefer this approach)
 */
export const viewportLayoutStyles = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },

  header: {
    flexShrink: 0,
    position: 'relative' as const,
    zIndex: 50,
  },

  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    minHeight: 0,
  },

  sidebar: {
    flexShrink: 0,
    overflowY: 'auto' as const,
    maxHeight: '100%',
  },

  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    minHeight: 0,
  },

  scrollArea: {
    flex: 1,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
  },
} as const;

/**
 * Check if an element uses correct viewport layout patterns
 */
export function validateViewportLayout(element: HTMLElement): {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check for min-h-screen (usually wrong for viewport layouts)
  if (element.classList.contains('min-h-screen')) {
    issues.push('Uses min-h-screen instead of h-screen');
    recommendations.push('Replace min-h-screen with h-screen for viewport constraint');
  }

  // Check for sticky positioning on what should be fixed elements
  const stickyElements = element.querySelectorAll('.sticky');
  if (stickyElements.length > 0) {
    issues.push('Uses sticky positioning which may cause scrolling issues');
    recommendations.push('Consider using fixed positioning within viewport-constrained layout');
  }

  // Check if overflow is properly controlled
  const computedStyle = window.getComputedStyle(element);
  if (computedStyle.overflow !== 'hidden' && computedStyle.overflowY !== 'hidden') {
    issues.push('Container overflow not properly constrained');
    recommendations.push('Add overflow-hidden to prevent page-level scrolling');
  }

  return {
    isValid: issues.length === 0,
    issues,
    recommendations,
  };
}

/**
 * React hook that mimics your successful admin layout pattern
 */
import React from 'react';

export function useViewportLayout() {
  React.useEffect(() => {
    // This is the exact pattern from your working admin layout
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

  return {
    containerProps: {
      className: 'h-full w-full flex overflow-hidden',
    },
    sidebarProps: {
      className: 'flex-shrink-0',
    },
    contentProps: {
      className: 'flex-1 flex flex-col overflow-hidden',
    },
    scrollAreaProps: {
      className: 'flex-1 overflow-y-auto overflow-x-hidden px-6 py-6',
    },
  };
}
