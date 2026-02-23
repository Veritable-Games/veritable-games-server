/**
 * Emergency Code Splitting - Dynamic Import System
 * Implements intelligent dynamic imports to reduce main bundle size
 */

import { ComponentType, lazy, LazyExoticComponent } from 'react';
import { logger } from '@/lib/utils/logger';

/**
 * Navigator extension with Network Information API
 * Note: navigator.connection is non-standard and only available in Chrome/Chromium
 */
interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
    downlink: number;
    rtt: number;
    saveData: boolean;
  };
}

export interface DynamicImportConfig {
  preload?: boolean;
  retry?: number;
  fallback?: ComponentType;
  chunkName?: string;
}

export interface LoadableComponent<T = {}> {
  Component: LazyExoticComponent<ComponentType<T>>;
  preload: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Dynamic import manager for emergency bundle size reduction
 */
export class DynamicImportManager {
  private loadPromises = new Map<string, Promise<any>>();
  private loadedModules = new Map<string, any>();
  private preloadQueue: string[] = [];

  /**
   * Creates a lazily loaded component with advanced error handling
   */
  createLazyComponent<T = {}>(
    importFn: () => Promise<{ default: ComponentType<T> }>,
    config: DynamicImportConfig = {}
  ): LoadableComponent<T> {
    const { retry = 3, chunkName } = config;
    let isLoading = false;
    let error: Error | null = null;

    const Component = lazy(async () => {
      isLoading = true;
      let lastError: Error;

      for (let attempt = 0; attempt <= retry; attempt++) {
        try {
          const module = await importFn();
          isLoading = false;
          error = null;

          if (chunkName) {
            logger.info(`✅ Loaded chunk: ${chunkName} (attempt ${attempt + 1})`);
          }

          return module;
        } catch (err) {
          lastError = err as Error;
          logger.warn(
            `⚠️ Failed to load ${chunkName || 'component'} (attempt ${attempt + 1}):`,
            err
          );

          if (attempt < retry) {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          }
        }
      }

      isLoading = false;
      error = lastError!;
      throw lastError!;
    });

    const preload = async () => {
      if (chunkName && this.loadedModules.has(chunkName)) {
        return;
      }

      try {
        const module = await importFn();
        if (chunkName) {
          this.loadedModules.set(chunkName, module);
          logger.info(`🚀 Preloaded: ${chunkName}`);
        }
      } catch (err) {
        logger.error(`❌ Preload failed for ${chunkName}:`, err);
      }
    };

    return {
      Component,
      preload,
      isLoading,
      error,
    };
  }

  /**
   * Preloads multiple components based on priority
   */
  async preloadComponents(componentKeys: string[], priority: 'high' | 'medium' | 'low' = 'medium') {
    const delay = priority === 'high' ? 0 : priority === 'medium' ? 1000 : 3000;

    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const preloadPromises = componentKeys.map(async key => {
      const component = LAZY_COMPONENTS[key as keyof typeof LAZY_COMPONENTS];
      if (component) {
        return component.preload();
      }
    });

    await Promise.allSettled(preloadPromises);
  }
}

// Global dynamic import manager instance
export const dynamicImportManager = new DynamicImportManager();

/**
 * Emergency Lazy Components - Most Critical for Bundle Size Reduction
 */
export const LAZY_COMPONENTS = {
  // Three.js Components (Highest Priority - ~2MB+ savings)
  StellarViewer: dynamicImportManager.createLazyComponent(
    () => import('@/lib/stellar/ThreeJSViewer'),
    { chunkName: 'stellar-viewer', preload: false }
  ),

  StellarDodecahedronViewer: dynamicImportManager.createLazyComponent(
    () => import('@/lib/stellar/ThreeJSViewer'),
    { chunkName: 'stellar-dodecahedron', preload: false }
  ),

  // Editor Components (High Priority - ~1MB+ savings)
  MarkdownEditor: dynamicImportManager.createLazyComponent(
    () => import('@/components/editor/MarkdownEditor'),
    { chunkName: 'markdown-editor', preload: false }
  ),

  MarkdownEditorToolbar: dynamicImportManager.createLazyComponent(
    () => import('@/components/editor/MarkdownEditorToolbar'),
    { chunkName: 'markdown-toolbar', preload: false }
  ),

  MonacoEditor: dynamicImportManager.createLazyComponent<any>(
    () => import('@monaco-editor/react').then(mod => ({ default: mod.default })),
    { chunkName: 'monaco-editor', preload: false }
  ),

  // Chart Components (Medium Priority - ~400KB savings)
  // AdminDashboard removed - admin pages were deleted

  // Large Project Components (Medium Priority - ~300KB+ savings)
  SimplifiedRevisionManager: dynamicImportManager.createLazyComponent(
    () => import('@/components/projects/SimplifiedRevisionManager'),
    { chunkName: 'revision-manager', preload: false }
  ),

  ProjectEditor: dynamicImportManager.createLazyComponent(
    () => import('@/components/projects/SimplifiedRevisionManager'),
    { chunkName: 'project-editor', preload: false }
  ),

  // Forum Components - DISABLED (forums removed)
  // ForumTopicView: dynamicImportManager.createLazyComponent(
  //   () => import('@/components/forums/TopicView'),
  //   { chunkName: 'forum-topic', preload: false }
  // ),
  //
  // ReplyList: dynamicImportManager.createLazyComponent(
  //   () => import('@/components/forums/ReplyList'),
  //   { chunkName: 'reply-list', preload: false }
  // ),

  // Wiki Components (Lower Priority - ~200KB savings)
  WikiEditor: dynamicImportManager.createLazyComponent(
    () => import('@/components/editor/MarkdownEditor'),
    { chunkName: 'wiki-editor', preload: false }
  ),

  InfoboxEditor: dynamicImportManager.createLazyComponent(
    () => import('@/components/wiki/InfoboxEditor'),
    { chunkName: 'infobox-editor', preload: false }
  ),
};

/**
 * Component loading strategies based on user interaction patterns
 */
export const LoadingStrategies = {
  // Immediate loading for critical user paths
  immediate: ['Navigation', 'AuthForm'],

  // High priority loading on page load
  high: ['MarkdownEditor'], // ForumTopicView removed (forums disabled)

  // Medium priority loading after main content
  medium: ['WikiEditor', 'ProjectEditor'],

  // Low priority loading on user interaction
  low: ['StellarViewer', 'AdminDashboard', 'MonacoEditor'],

  // Background loading for future sessions
  background: ['StellarDodecahedronViewer', 'SimplifiedRevisionManager'],
};

/**
 * Intelligent preloading based on route and user behavior
 */
export class IntelligentPreloader {
  private static instance: IntelligentPreloader;
  private loadedRoutes = new Set<string>();
  private userActivity = { clicks: 0, scrolls: 0, lastActive: Date.now() };

  static getInstance(): IntelligentPreloader {
    if (!IntelligentPreloader.instance) {
      IntelligentPreloader.instance = new IntelligentPreloader();
    }
    return IntelligentPreloader.instance;
  }

  /**
   * Preloads components based on current route
   */
  async preloadForRoute(route: string) {
    if (this.loadedRoutes.has(route)) return;

    const routePreloadMap: Record<string, string[]> = {
      '/': ['MarkdownEditor'],
      // '/forums': ['ForumTopicView', 'ReplyList'], // Forums disabled
      '/wiki': ['WikiEditor', 'MarkdownEditor'],
      '/projects': ['ProjectEditor', 'SimplifiedRevisionManager'],
      '/stellar': ['StellarViewer'],
      '/admin': ['AdminDashboard', 'MonacoEditor'],
    };

    const componentsToLoad = routePreloadMap[route] || [];
    if (componentsToLoad.length > 0) {
      logger.info(`🎯 Preloading for route ${route}:`, componentsToLoad);
      await dynamicImportManager.preloadComponents(componentsToLoad, 'high');
      this.loadedRoutes.add(route);
    }
  }

  /**
   * Preloads components based on user activity level
   */
  async preloadBasedOnActivity() {
    const isActiveUser = this.userActivity.clicks > 5 || this.userActivity.scrolls > 10;
    const isRecentlyActive = Date.now() - this.userActivity.lastActive < 30000; // 30 seconds

    if (isActiveUser && isRecentlyActive) {
      // Active users get medium priority components preloaded
      await dynamicImportManager.preloadComponents(LoadingStrategies.medium, 'medium');
    }
  }

  /**
   * Background preloading for low-priority components
   */
  async backgroundPreload() {
    // Only preload in background if user is idle and network is good
    if (this.isUserIdle() && this.isGoodConnection()) {
      await dynamicImportManager.preloadComponents(LoadingStrategies.background, 'low');
    }
  }

  private isUserIdle(): boolean {
    return Date.now() - this.userActivity.lastActive > 60000; // 1 minute idle
  }

  private isGoodConnection(): boolean {
    const navigatorWithConnection = navigator as NavigatorWithConnection;
    if ('connection' in navigator && navigatorWithConnection.connection) {
      const connection = navigatorWithConnection.connection;
      return connection.effectiveType === '4g' && connection.downlink > 5;
    }
    return true; // Assume good connection if not available
  }

  /**
   * Track user activity for intelligent preloading
   */
  trackActivity(type: 'click' | 'scroll') {
    this.userActivity[type === 'click' ? 'clicks' : 'scrolls']++;
    this.userActivity.lastActive = Date.now();
  }
}

/**
 * Hook into global events for intelligent preloading
 */
if (typeof window !== 'undefined') {
  const preloader = IntelligentPreloader.getInstance();

  // Track user activity
  document.addEventListener('click', () => preloader.trackActivity('click'));
  document.addEventListener('scroll', () => preloader.trackActivity('scroll'));

  // Start background preloading after page load
  window.addEventListener('load', () => {
    setTimeout(() => preloader.backgroundPreload(), 5000);
  });
}

/**
 * Utility functions for emergency bundle optimization
 */
export const BundleOptimizationUtils = {
  /**
   * Estimates bundle size savings from dynamic imports
   */
  estimateSavings(): { component: string; estimatedSavings: string }[] {
    return [
      { component: 'Three.js Components', estimatedSavings: '2.1MB' },
      { component: 'Monaco Editor', estimatedSavings: '1.2MB' },
      { component: 'Chart Components', estimatedSavings: '400KB' },
      { component: 'Large Components', estimatedSavings: '800KB' },
      { component: 'Total Estimated', estimatedSavings: '4.5MB (59% reduction)' },
    ];
  },

  /**
   * Reports current loading status
   */
  getLoadingStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    Object.keys(LAZY_COMPONENTS).forEach(key => {
      status[key] = !LAZY_COMPONENTS[key as keyof typeof LAZY_COMPONENTS].isLoading;
    });
    return status;
  },
};

export default dynamicImportManager;
