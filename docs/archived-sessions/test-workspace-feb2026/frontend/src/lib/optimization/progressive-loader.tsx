/**
 * Progressive Loading Strategy
 * Phase 3: Smart asset loading based on user behavior and device capabilities
 */

import React from 'react';
import { logger } from '@/lib/utils/logger';

/**
 * Experimental Browser APIs (not yet in standard TypeScript types)
 */
interface NetworkInformation {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
  downlink: number;
  rtt: number;
  saveData: boolean;
}

interface NavigatorWithExperimentalAPIs extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
  deviceMemory?: number;
}

interface ProgressiveLoadingConfig {
  connectionSpeed: 'slow' | 'fast' | 'unknown';
  deviceMemory: number;
  hardwareConcurrency: number;
  enablePrefetch: boolean;
  maxConcurrentLoads: number;
  preloadThreshold: number; // Distance from viewport in pixels
}

interface LoadingPriority {
  critical: string[]; // Must load immediately
  high: string[]; // Load after critical
  medium: string[]; // Load on user interaction
  low: string[]; // Load when idle
  onDemand: string[]; // Load only when explicitly requested
}

class ProgressiveLoader {
  private static instance: ProgressiveLoader;
  private config: ProgressiveLoadingConfig;
  private loadingQueue: Map<string, Promise<any>>;
  private loadedAssets: Set<string>;
  private deviceCapabilities: any;
  private idleCallback: number | NodeJS.Timeout | null = null;

  private constructor() {
    this.loadingQueue = new Map();
    this.loadedAssets = new Set();
    this.deviceCapabilities = this.assessDeviceCapabilities();
    this.config = this.createOptimalConfig();
    this.initializeProgressiveLoading();
  }

  static getInstance(): ProgressiveLoader {
    if (!ProgressiveLoader.instance) {
      ProgressiveLoader.instance = new ProgressiveLoader();
    }
    return ProgressiveLoader.instance;
  }

  /**
   * Assess device capabilities for optimal loading strategy
   */
  private assessDeviceCapabilities(): any {
    if (typeof navigator === 'undefined') {
      return { memory: 4, cores: 2, connection: 'unknown' };
    }

    const nav = navigator as NavigatorWithExperimentalAPIs;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

    return {
      memory: nav.deviceMemory || 4,
      cores: navigator.hardwareConcurrency || 2,
      connection: connection
        ? {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
            saveData: connection.saveData,
          }
        : null,
    };
  }

  /**
   * Create configuration based on device capabilities
   */
  private createOptimalConfig(): ProgressiveLoadingConfig {
    const { memory, cores, connection } = this.deviceCapabilities;

    // Determine connection speed
    let connectionSpeed: 'slow' | 'fast' | 'unknown' = 'unknown';
    if (connection) {
      connectionSpeed = ['slow-2g', '2g', '3g'].includes(connection.effectiveType)
        ? 'slow'
        : 'fast';
      if (connection.saveData) connectionSpeed = 'slow';
    }

    return {
      connectionSpeed,
      deviceMemory: memory,
      hardwareConcurrency: cores,
      enablePrefetch: connectionSpeed !== 'slow' && memory >= 4,
      maxConcurrentLoads: Math.min(cores, connectionSpeed === 'slow' ? 2 : 4),
      preloadThreshold: connectionSpeed === 'slow' ? 100 : 500,
    };
  }

  /**
   * Initialize progressive loading system
   */
  private initializeProgressiveLoading(): void {
    if (typeof window === 'undefined') return;

    // Load critical assets immediately
    this.loadCriticalAssets();

    // Set up intersection observer for viewport-based loading
    this.setupViewportLoading();

    // Set up idle loading for low-priority assets
    this.setupIdleLoading();

    // Set up user interaction detection
    this.setupInteractionLoading();
  }

  /**
   * Load critical assets immediately
   */
  private async loadCriticalAssets(): Promise<void> {
    const criticalAssets = this.getCriticalAssets();

    await Promise.allSettled(criticalAssets.map(asset => this.loadAsset(asset, 'critical')));
  }

  /**
   * Get critical assets that must load immediately
   */
  private getCriticalAssets(): string[] {
    return [
      // Essential CSS is already loaded by Next.js
      // Only include absolutely critical JS modules
      '/api/csrf-token', // Security token
    ];
  }

  /**
   * Load asset with priority handling
   */
  private async loadAsset(url: string, priority: keyof LoadingPriority): Promise<any> {
    if (this.loadedAssets.has(url) || this.loadingQueue.has(url)) {
      return this.loadingQueue.get(url);
    }

    const loadPromise = this.performAssetLoad(url, priority);
    this.loadingQueue.set(url, loadPromise);

    try {
      const result = await loadPromise;
      this.loadedAssets.add(url);
      this.loadingQueue.delete(url);
      return result;
    } catch (error) {
      this.loadingQueue.delete(url);
      logger.warn(`Failed to load asset ${url}:`, error);
      throw error;
    }
  }

  /**
   * Perform the actual asset loading
   */
  private async performAssetLoad(url: string, priority: keyof LoadingPriority): Promise<any> {
    if (url.endsWith('.js') || url.startsWith('/_next/')) {
      return this.loadScript(url);
    } else if (url.endsWith('.css')) {
      return this.loadStylesheet(url);
    } else if (url.match(/\.(jpg|jpeg|png|webp|avif)$/)) {
      return this.loadImage(url);
    } else {
      return this.loadGeneric(url);
    }
  }

  /**
   * Load JavaScript module
   */
  private async loadScript(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Load CSS stylesheet
   */
  private async loadStylesheet(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  /**
   * Load image with optimization
   */
  private async loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  /**
   * Load generic resource
   */
  private async loadGeneric(url: string): Promise<Response> {
    return fetch(url);
  }

  /**
   * Setup viewport-based loading
   */
  private setupViewportLoading(): void {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            const preloadData = element.dataset.preload;
            if (preloadData) {
              try {
                const assets = JSON.parse(preloadData);
                this.preloadAssets(assets);
              } catch (error) {
                logger.warn('Invalid preload data:', preloadData);
              }
            }
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: `${this.config.preloadThreshold}px`,
      }
    );

    // Observe elements with preload data
    const observeElements = () => {
      document.querySelectorAll('[data-preload]').forEach(el => {
        observer.observe(el);
      });
    };

    // Initial observation
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', observeElements);
    } else {
      observeElements();
    }

    // Re-observe on dynamic content changes
    const mutationObserver = new MutationObserver(() => {
      observeElements();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Setup idle loading for low-priority assets
   */
  private setupIdleLoading(): void {
    if (!this.config.enablePrefetch) return;

    const loadOnIdle = () => {
      if (this.idleCallback) return;

      this.idleCallback = requestIdleCallback
        ? requestIdleCallback(() => {
            this.loadIdleAssets();
            this.idleCallback = null;
          })
        : setTimeout(() => {
            this.loadIdleAssets();
            this.idleCallback = null;
          }, 2000);
    };

    // Start idle loading after initial page load
    if (document.readyState === 'complete') {
      loadOnIdle();
    } else {
      window.addEventListener('load', loadOnIdle);
    }
  }

  /**
   * Load assets during idle periods
   */
  private async loadIdleAssets(): Promise<void> {
    const idleAssets = [
      // Three.js modules for potential 3D viewer usage
      '/stellar/three.js/three.module.js',
      '/stellar/three.js/examples/jsm/controls/OrbitControls.js',
      // Admin dashboard assets (if user is admin)
      // Wiki editor assets (if user can edit)
    ];

    // Filter based on user capabilities and roles
    const relevantAssets = this.filterAssetsByContext(idleAssets);

    // Load with low priority
    const batchSize = Math.max(1, Math.floor(this.config.maxConcurrentLoads / 2));
    await this.loadAssetsBatch(relevantAssets, batchSize);
  }

  /**
   * Setup interaction-based loading
   */
  private setupInteractionLoading(): void {
    const interactions = ['mousedown', 'touchstart', 'keydown'];
    let hasInteracted = false;

    const onFirstInteraction = () => {
      if (hasInteracted) return;
      hasInteracted = true;

      // Load medium priority assets on first interaction
      this.loadMediumPriorityAssets();

      // Remove listeners
      interactions.forEach(event => {
        document.removeEventListener(event, onFirstInteraction);
      });
    };

    interactions.forEach(event => {
      document.addEventListener(event, onFirstInteraction, { passive: true, once: true });
    });
  }

  /**
   * Load medium priority assets after user interaction
   */
  private async loadMediumPriorityAssets(): Promise<void> {
    const mediumAssets: string[] = [
      // Editor components
      // Form validation libraries
      // Non-critical UI enhancements
    ];

    await this.loadAssetsBatch(mediumAssets, this.config.maxConcurrentLoads);
  }

  /**
   * Load assets in batches
   */
  private async loadAssetsBatch(assets: string[], batchSize: number): Promise<void> {
    for (let i = 0; i < assets.length; i += batchSize) {
      const batch = assets.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(asset => this.loadAsset(asset, 'medium')));
    }
  }

  /**
   * Filter assets based on current context
   */
  private filterAssetsByContext(assets: string[]): string[] {
    // Filter based on current page, user role, device capabilities
    return assets.filter(asset => {
      // Skip 3D assets on low-memory devices
      if (asset.includes('three.js') && this.deviceCapabilities.memory < 4) {
        return false;
      }

      // Skip admin assets for non-admin users
      if (asset.includes('admin') && !this.isAdminUser()) {
        return false;
      }

      return true;
    });
  }

  /**
   * Check if current user is admin
   */
  private isAdminUser(): boolean {
    // This would be implemented based on your auth system
    return document.querySelector('[data-user-role="admin"]') !== null;
  }

  /**
   * Preload specific assets
   */
  async preloadAssets(assets: string[]): Promise<void> {
    if (!this.config.enablePrefetch) return;

    await Promise.allSettled(assets.map(asset => this.loadAsset(asset, 'high')));
  }

  /**
   * Get loading statistics
   */
  getStats(): {
    loaded: number;
    loading: number;
    config: ProgressiveLoadingConfig;
    deviceCapabilities: any;
  } {
    return {
      loaded: this.loadedAssets.size,
      loading: this.loadingQueue.size,
      config: this.config,
      deviceCapabilities: this.deviceCapabilities,
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.idleCallback !== null) {
      // Try to cancel as idle callback first (browser API)
      if (typeof cancelIdleCallback !== 'undefined' && typeof this.idleCallback === 'number') {
        cancelIdleCallback(this.idleCallback);
      } else {
        // Otherwise clear as timeout (works for both browser setTimeout and Node.js Timeout)
        clearTimeout(this.idleCallback);
      }
      this.idleCallback = null;
    }

    this.loadingQueue.clear();
    this.loadedAssets.clear();
  }
}

// Export singleton instance
export const progressiveLoader = ProgressiveLoader.getInstance();

/**
 * React hook for progressive loading integration
 */
export function useProgressiveLoading() {
  const [stats, setStats] = React.useState(progressiveLoader.getStats());

  React.useEffect(() => {
    const updateStats = () => setStats(progressiveLoader.getStats());

    // Update stats periodically
    const interval = setInterval(updateStats, 1000);

    return () => clearInterval(interval);
  }, []);

  const preloadAssets = React.useCallback(async (assets: string[]) => {
    await progressiveLoader.preloadAssets(assets);
    setStats(progressiveLoader.getStats());
  }, []);

  return {
    ...stats,
    preloadAssets,
  };
}

/**
 * HOC for adding progressive loading to components
 */
export function withProgressiveLoading<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  preloadAssets: string[] = []
) {
  const ProgressiveComponent = (props: P) => {
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      if (preloadAssets.length === 0) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            progressiveLoader.preloadAssets(preloadAssets);
            observer.disconnect();
          }
        },
        { threshold: 0.1, rootMargin: '100px' }
      );

      if (containerRef.current) {
        observer.observe(containerRef.current);
      }

      return () => observer.disconnect();
    }, []);

    return (
      <div ref={containerRef} data-preload={JSON.stringify(preloadAssets)}>
        <WrappedComponent {...props} />
      </div>
    );
  };

  ProgressiveComponent.displayName = `withProgressiveLoading(${WrappedComponent.displayName || WrappedComponent.name})`;

  return ProgressiveComponent;
}

// Add requestIdleCallback polyfill type
declare global {
  function requestIdleCallback(callback: () => void): number;
  function cancelIdleCallback(id: number): void;
}
