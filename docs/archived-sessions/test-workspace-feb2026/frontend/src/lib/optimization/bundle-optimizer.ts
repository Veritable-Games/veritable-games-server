/**
 * Bundle Optimization and Code Splitting Utilities
 * Implements advanced optimization strategies for production builds
 */

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { DynamicOptions } from 'next/dynamic';

/**
 * Bundle Analysis Configuration
 */
export interface BundleConfig {
  // Chunk splitting strategy
  chunks: 'all' | 'async' | 'initial';
  // Maximum parallel requests
  maxParallelRequests: number;
  // Minimum chunk size in bytes
  minSize: number;
  // Maximum chunk size in bytes
  maxSize: number;
  // Cache groups for vendor splitting
  cacheGroups: Record<string, CacheGroupConfig>;
}

interface CacheGroupConfig {
  test: RegExp | string;
  name: string;
  priority: number;
  reuseExistingChunk: boolean;
  enforce?: boolean;
}

/**
 * Default bundle optimization configuration
 */
export const defaultBundleConfig: BundleConfig = {
  chunks: 'all',
  maxParallelRequests: 30,
  minSize: 20000, // 20kb
  maxSize: 244000, // 244kb (recommended for optimal loading)
  cacheGroups: {
    // Core React libraries
    react: {
      test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
      name: 'react',
      priority: 20,
      reuseExistingChunk: true,
    },
    // UI libraries and components
    ui: {
      test: /[\\/]node_modules[\\/](@heroicons|@tailwindcss)[\\/]/,
      name: 'ui',
      priority: 15,
      reuseExistingChunk: true,
    },
    // Data fetching and state management
    data: {
      test: /[\\/]node_modules[\\/](@tanstack|swr|socket\.io)[\\/]/,
      name: 'data',
      priority: 14,
      reuseExistingChunk: true,
    },
    // Utility libraries
    utils: {
      test: /[\\/]node_modules[\\/](lodash|date-fns|zod)[\\/]/,
      name: 'utils',
      priority: 13,
      reuseExistingChunk: true,
    },
    // Markdown and code highlighting
    markdown: {
      test: /[\\/]node_modules[\\/](react-markdown|remark|rehype|react-syntax-highlighter)[\\/]/,
      name: 'markdown',
      priority: 12,
      reuseExistingChunk: true,
    },
    // Monaco editor (large bundle)
    monaco: {
      test: /[\\/]node_modules[\\/](@monaco-editor|monaco-editor)[\\/]/,
      name: 'monaco',
      priority: 11,
      reuseExistingChunk: true,
      enforce: true, // Force separate chunk
    },
    // Three.js and 3D libraries
    three: {
      test: /[\\/]public[\\/]stellar[\\/]three\.js[\\/]/,
      name: 'three',
      priority: 10,
      reuseExistingChunk: true,
      enforce: true,
    },
    // Default vendor chunk
    vendor: {
      test: /[\\/]node_modules[\\/]/,
      name: 'vendor',
      priority: 1,
      reuseExistingChunk: true,
    },
  },
};

/**
 * Dynamic import with loading and error boundaries
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options?: {
    loading?: ComponentType;
    error?: ComponentType<{ error: Error; retry: () => void }>;
    ssr?: boolean;
    suspense?: boolean;
  }
): T {
  // dynamic() returns ComponentType but we know from importFunc that it's T
  return dynamic(importFunc, {
    loading: options?.loading as DynamicOptions<T>['loading'],
    ssr: options?.ssr ?? true,
  }) as T;
}

/**
 * Preload component chunks
 */
export function preloadComponent(componentPath: string, priority: 'high' | 'low' = 'low'): void {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = priority === 'high' ? 'preload' : 'prefetch';
  link.as = 'script';
  link.href = `/_next/static/chunks/${componentPath}`;
  document.head.appendChild(link);
}

/**
 * Route-based code splitting configuration
 */
export const routeChunks = {
  // Core pages that should be in the main bundle
  critical: ['/', '/games', '/forums', '/wiki'],

  // Secondary pages that can be lazy loaded
  secondary: ['/profile', '/settings', '/search'],

  // Admin pages that should be completely separate
  admin: ['/admin', '/admin/*'],

  // Heavy features that should be dynamically imported
  features: {
    editor: '/editor',
    analytics: '/analytics',
    stellar: '/games/stellar',
    orbital: '/games/orbital',
  },
};

/**
 * Generate webpack optimization configuration
 */
export function generateWebpackOptimization(): any {
  return {
    minimize: true,
    minimizer: [], // Use Next.js default minimizers
    splitChunks: {
      chunks: defaultBundleConfig.chunks,
      maxAsyncRequests: defaultBundleConfig.maxParallelRequests,
      maxInitialRequests: defaultBundleConfig.maxParallelRequests,
      minSize: defaultBundleConfig.minSize,
      maxSize: defaultBundleConfig.maxSize,
      cacheGroups: Object.entries(defaultBundleConfig.cacheGroups).reduce(
        (acc, [key, config]) => ({
          ...acc,
          [key]: {
            test: config.test,
            name: config.name,
            priority: config.priority,
            reuseExistingChunk: config.reuseExistingChunk,
            enforce: config.enforce,
          },
        }),
        {}
      ),
    },
    runtimeChunk: {
      name: 'runtime',
    },
    moduleIds: 'deterministic',
  };
}

/**
 * Resource hints for optimized loading
 */
export class ResourceHints {
  private static instance: ResourceHints;
  private preloadedResources = new Set<string>();
  private prefetchedResources = new Set<string>();

  static getInstance(): ResourceHints {
    if (!ResourceHints.instance) {
      ResourceHints.instance = new ResourceHints();
    }
    return ResourceHints.instance;
  }

  preload(url: string, as: 'script' | 'style' | 'font' | 'image'): void {
    if (typeof window === 'undefined' || this.preloadedResources.has(url)) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = as;

    if (as === 'font') {
      link.crossOrigin = 'anonymous';
    }

    document.head.appendChild(link);
    this.preloadedResources.add(url);
  }

  prefetch(url: string): void {
    if (typeof window === 'undefined' || this.prefetchedResources.has(url)) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
    this.prefetchedResources.add(url);
  }

  preconnect(origin: string): void {
    if (typeof window === 'undefined') return;

    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  dnsPrefetch(hostname: string): void {
    if (typeof window === 'undefined') return;

    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = `//${hostname}`;
    document.head.appendChild(link);
  }
}

/**
 * Module federation configuration for micro-frontends
 */
export const moduleFederationConfig = {
  name: 'veritableGames',
  filename: 'remoteEntry.js',
  exposes: {
    './Header': './src/components/layout/Header',
    './Footer': './src/components/layout/Footer',
    './GameCard': './src/components/games/GameCard',
  },
  shared: {
    react: { singleton: true, requiredVersion: '^18.2.0' },
    'react-dom': { singleton: true, requiredVersion: '^18.2.0' },
    next: { singleton: true, requiredVersion: '^15.4.7' },
  },
};

/**
 * Tree shaking configuration
 */
export const treeShakingConfig = {
  // Mark packages as side-effect free
  sideEffects: false,
  // Packages to always tree-shake
  include: ['lodash', '@heroicons/react', 'date-fns'],
  // Packages to exclude from tree-shaking
  exclude: ['core-js', 'regenerator-runtime'],
};

/**
 * Analyze bundle size and generate report
 */
export async function analyzeBundleSize(): Promise<{
  totalSize: number;
  chunks: Array<{ name: string; size: number }>;
  recommendations: string[];
}> {
  // This would integrate with webpack-bundle-analyzer in production
  // For now, return mock data structure
  return {
    totalSize: 0,
    chunks: [],
    recommendations: [
      'Consider lazy loading Monaco Editor',
      'Split Three.js into separate chunk',
      'Use dynamic imports for admin routes',
    ],
  };
}

/**
 * Performance budget configuration
 */
export const performanceBudget = {
  // Maximum bundle sizes in KB
  bundles: {
    main: 200,
    vendor: 300,
    react: 150,
    commons: 100,
  },
  // Maximum asset sizes
  assets: {
    scripts: 500,
    styles: 100,
    fonts: 200,
    images: 1000,
  },
  // Core Web Vitals targets
  metrics: {
    lcp: 2500, // Largest Contentful Paint (ms)
    fid: 100, // First Input Delay (ms)
    cls: 0.1, // Cumulative Layout Shift
    ttfb: 600, // Time to First Byte (ms)
    fcp: 1800, // First Contentful Paint (ms)
  },
};

/**
 * Export optimization utilities
 */
export const BundleOptimizer = {
  lazyLoad,
  preloadComponent,
  generateWebpackOptimization,
  ResourceHints: ResourceHints.getInstance(),
  analyzeBundleSize,
  performanceBudget,
};
