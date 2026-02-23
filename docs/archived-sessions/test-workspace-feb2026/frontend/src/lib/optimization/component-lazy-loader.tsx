/**
 * Component Lazy Loading Strategy
 * Phase 3: Intelligent component code splitting
 */

import React, { ComponentType, lazy, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { logger } from '@/lib/utils/logger';
import type { DynamicOptions } from 'next/dynamic';

interface LazyComponentOptions {
  loading?: ComponentType;
  ssr?: boolean;
  suspense?: boolean;
  preload?: 'hover' | 'viewport' | 'never';
  priority?: 'high' | 'medium' | 'low';
}

// Loading fallback components
const ComponentSkeletons = {
  editor: () => (
    <div className="flex h-64 w-full animate-pulse items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
      <div className="text-sm text-gray-500">Loading editor...</div>
    </div>
  ),

  viewer: () => (
    <div className="flex h-96 w-full animate-pulse items-center justify-center rounded-lg bg-gradient-to-b from-blue-900 via-gray-900 to-black">
      <div className="text-sm text-white">Loading 3D viewer...</div>
    </div>
  ),

  dashboard: () => (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
      ))}
    </div>
  ),

  form: () => (
    <div className="space-y-4 p-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      ))}
    </div>
  ),

  default: () => (
    <div className="flex h-32 w-full animate-pulse items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
      <div className="text-sm text-gray-500">Loading...</div>
    </div>
  ),
};

/**
 * Create optimized lazy component with intelligent loading
 */
export function createLazyComponent<T = any>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  options: LazyComponentOptions = {}
) {
  const {
    loading = ComponentSkeletons.default,
    ssr = false,
    suspense = true,
    preload = 'never',
    priority = 'medium',
  } = options;

  // Use Next.js dynamic for better optimization
  const LazyComponent = dynamic(importFn, {
    ssr,
    loading: loading as DynamicOptions<T>['loading'],
    ...(suspense && { suspense: true }),
  });

  // Add preloading behavior
  if (preload !== 'never' && typeof window !== 'undefined') {
    const preloadComponent = () => {
      importFn().catch(err => {
        logger.warn('Component preload failed:', err);
      });
    };

    if (preload === 'hover') {
      // Preload on first hover event
      let hasPreloaded = false;
      const onHover = () => {
        if (!hasPreloaded) {
          hasPreloaded = true;
          preloadComponent();
        }
      };

      // Add global hover listener for preloading
      document.addEventListener('mouseover', onHover, { once: true, passive: true });
    } else if (preload === 'viewport') {
      // Preload when any part comes into viewport
      const observer = new IntersectionObserver(
        entries => {
          if (entries.some(entry => entry?.isIntersecting)) {
            preloadComponent();
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );

      // Start observing when component is referenced
      setTimeout(() => {
        const elements = document.querySelectorAll('[data-lazy-component]');
        elements.forEach(el => observer.observe(el));
      }, 100);
    }
  }

  return LazyComponent;
}

/**
 * Pre-configured lazy components for common use cases
 */
export const LazyComponents = {
  // Editor components (heavy Monaco dependency)
  MarkdownEditor: createLazyComponent(() => import('@/components/editor/HybridMarkdownEditor'), {
    loading: ComponentSkeletons.editor,
    ssr: false,
    preload: 'hover',
    priority: 'high',
  }),

  LazyMarkdownEditor: createLazyComponent(() => import('@/components/editor/LazyMarkdownEditor'), {
    loading: ComponentSkeletons.editor,
    ssr: false,
    preload: 'viewport',
  }),

  // 3D Viewer components (heavy Three.js dependency)
  StellarViewer: createLazyComponent(() => import('@/components/ui/StellarViewerBackground'), {
    loading: ComponentSkeletons.viewer,
    ssr: false,
    preload: 'never', // Only load when explicitly needed
    priority: 'low',
  }),

  // Project management components
  RevisionManager: createLazyComponent(
    () => import('@/components/projects/SimplifiedRevisionManager'),
    {
      loading: ComponentSkeletons.form,
      ssr: true,
      preload: 'viewport',
    }
  ),

  DiffViewer: createLazyComponent(() => import('@/components/projects/EnhancedDiffViewer'), {
    loading: ComponentSkeletons.editor,
    ssr: false,
    preload: 'hover',
  }),

  // Authentication components
  AuthModal: createLazyComponent(() => import('@/components/auth/AuthModal'), {
    loading: ComponentSkeletons.form,
    ssr: false,
    preload: 'hover',
    priority: 'high',
  }),

  // Profile and social components
  AvatarCropper: createLazyComponent(() => import('@/components/profiles/AvatarCropper'), {
    loading: ComponentSkeletons.editor,
    ssr: false,
    preload: 'never', // Heavy image processing
  }),

  // Library and document components
  LibraryAnnotation: createLazyComponent(
    () => import('@/components/library/LibraryAnnotationOverlay'),
    {
      loading: ComponentSkeletons.editor,
      ssr: false,
      preload: 'viewport',
    }
  ),
};

/**
 * Route-based code splitting for pages
 */
export const LazyPages = {
  // Admin pages - commented out due to module path issues
  // AdminLayout: createLazyComponent(() => import('@/app/admin/layout'), {
  //   loading: ComponentSkeletons.dashboard,
  //   ssr: true,
  //   preload: 'never',
  // }),

  // Forum pages - DISABLED (forums removed)
  // TopicView: createLazyComponent(
  //   () => import('@/components/forums/TopicView'),
  //   {
  //     loading: ComponentSkeletons.default,
  //     ssr: true,
  //     preload: 'viewport'
  //   }
  // ),

  // Wiki pages
  WikiEditor: createLazyComponent(() => import('@/components/editor/MarkdownEditor'), {
    loading: ComponentSkeletons.editor,
    ssr: false,
    preload: 'hover',
  }),
};

/**
 * Hook for managing component lazy loading state
 */
export function useLazyLoading() {
  const [loadedComponents, setLoadedComponents] = React.useState<Set<string>>(new Set());
  const [isPreloading, setIsPreloading] = React.useState(false);

  const markAsLoaded = React.useCallback((componentName: string) => {
    setLoadedComponents(prev => new Set([...prev, componentName]));
  }, []);

  const preloadComponents = React.useCallback(
    async (componentNames: string[]) => {
      setIsPreloading(true);

      // Preload components that aren't already loaded
      const toPreload = componentNames.filter(name => !loadedComponents.has(name));

      try {
        await Promise.allSettled(
          toPreload.map(async name => {
            // This would trigger the dynamic import
            // Check if the component name is a valid key before accessing
            if (name in LazyComponents) {
              return LazyComponents[name as keyof typeof LazyComponents];
            }
            return null;
          })
        );
      } catch (error) {
        logger.warn('Component preloading failed:', error);
      } finally {
        setIsPreloading(false);
      }
    },
    [loadedComponents]
  );

  return {
    loadedComponents: Array.from(loadedComponents),
    isPreloading,
    markAsLoaded,
    preloadComponents,
  };
}

/**
 * Intersection Observer hook for viewport-based loading
 */
export function useIntersectionLoader(
  ref: React.RefObject<HTMLElement>,
  onIntersect: () => void,
  options: IntersectionObserverInit = {}
) {
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          onIntersect();
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [onIntersect, options]);
}
