/**
 * Enhanced Three.js Optimization Strategy
 * Phase 3: Aggressive code splitting and conditional loading
 */

import { threeLoader } from './three-lazy-loader';

type LoadingPriority = 'critical' | 'high' | 'medium' | 'low';
type ViewerFeature = 'basic' | 'controls' | 'postprocessing' | 'loaders' | 'effects';

interface OptimizationConfig {
  enableIntersectionLoading: boolean;
  enablePreloadOnHover: boolean;
  enableModulePreloading: boolean;
  maxConcurrentLoads: number;
  loadingTimeout: number;
}

class OptimizedThreeLoader {
  private static instance: OptimizedThreeLoader;
  private config: OptimizationConfig;
  private loadingQueue: Map<ViewerFeature, { priority: LoadingPriority; promise?: Promise<any> }>;
  private moduleCache: Map<string, any>;
  private userInteractionDetected: boolean = false;

  private constructor() {
    this.config = {
      enableIntersectionLoading: true,
      enablePreloadOnHover: true,
      enableModulePreloading: false, // Only enable after user interaction
      maxConcurrentLoads: 2,
      loadingTimeout: 10000, // 10 seconds
    };
    this.loadingQueue = new Map();
    this.moduleCache = new Map();
    this.setupUserInteractionDetection();
  }

  static getInstance(): OptimizedThreeLoader {
    if (!OptimizedThreeLoader.instance) {
      OptimizedThreeLoader.instance = new OptimizedThreeLoader();
    }
    return OptimizedThreeLoader.instance;
  }

  /**
   * Setup user interaction detection to enable preloading
   */
  private setupUserInteractionDetection(): void {
    if (typeof window === 'undefined') return;

    const events = ['mousedown', 'touchstart', 'keydown', 'scroll'];
    const onFirstInteraction = () => {
      this.userInteractionDetected = true;
      this.config.enableModulePreloading = true;
      events.forEach(event => {
        window.removeEventListener(event, onFirstInteraction);
      });
    };

    events.forEach(event => {
      window.addEventListener(event, onFirstInteraction, { once: true, passive: true });
    });
  }

  /**
   * Load Three.js modules with intelligent prioritization
   */
  async loadOptimizedModules(features: ViewerFeature[]): Promise<any> {
    const prioritizedFeatures = this.prioritizeFeatures(features);

    // Load critical features first (basic Three.js core)
    const criticalFeatures = prioritizedFeatures.filter(
      f => this.getFeaturePriority(f) === 'critical'
    );
    await this.loadFeaturesBatch(criticalFeatures);

    // Load other features progressively
    const remainingFeatures = prioritizedFeatures.filter(
      f => this.getFeaturePriority(f) !== 'critical'
    );
    this.loadFeaturesProgressive(remainingFeatures);

    return this.moduleCache.get('core');
  }

  /**
   * Load features in batches respecting concurrency limits
   */
  private async loadFeaturesBatch(features: ViewerFeature[]): Promise<void> {
    const batches = this.createBatches(features, this.config.maxConcurrentLoads);

    for (const batch of batches) {
      const promises = batch.map(feature => this.loadSingleFeature(feature));
      await Promise.allSettled(promises);
    }
  }

  /**
   * Load features progressively in background
   */
  private loadFeaturesProgressive(features: ViewerFeature[]): void {
    if (!this.userInteractionDetected) return;

    let delay = 100; // Start with 100ms delay
    features.forEach((feature, index) => {
      setTimeout(
        () => {
          this.loadSingleFeature(feature);
        },
        delay * (index + 1)
      );
    });
  }

  /**
   * Load a single Three.js feature module
   */
  private async loadSingleFeature(feature: ViewerFeature): Promise<any> {
    if (this.moduleCache.has(feature)) {
      return this.moduleCache.get(feature);
    }

    try {
      let module: any;

      switch (feature) {
        case 'basic':
          module = await this.loadBasicThreeJS();
          break;
        case 'controls':
          module = await threeLoader.loadControls('OrbitControls');
          break;
        case 'postprocessing':
          module = await threeLoader.loadPostProcessing();
          break;
        case 'loaders':
          module = await threeLoader.loadLoader('GLTFLoader');
          break;
        case 'effects':
          module = await this.loadEffectsModule();
          break;
        default:
          throw new Error(`Unknown feature: ${feature}`);
      }

      this.moduleCache.set(feature, module);
      return module;
    } catch (error) {
      logger.warn(`Failed to load Three.js feature ${feature}:`, error);
      throw error;
    }
  }

  /**
   * Load minimal Three.js core with tree shaking
   */
  private async loadBasicThreeJS(): Promise<any> {
    // Import only essential Three.js modules
    const modules = await Promise.all([
      import(/* webpackChunkName: "three-core-scene" */ 'three/src/scenes/Scene.js'),
      import(/* webpackChunkName: "three-core-camera" */ 'three/src/cameras/PerspectiveCamera.js'),
      import(/* webpackChunkName: "three-core-renderer" */ 'three/src/renderers/WebGLRenderer.js'),
      import(
        /* webpackChunkName: "three-core-geometries" */ 'three/src/geometries/DodecahedronGeometry.js'
      ),
      import(
        /* webpackChunkName: "three-core-materials" */ 'three/src/materials/MeshPhongMaterial.js'
      ),
      import(/* webpackChunkName: "three-core-mesh" */ 'three/src/objects/Mesh.js'),
      import(/* webpackChunkName: "three-core-lights" */ 'three/src/lights/AmbientLight.js'),
      import(/* webpackChunkName: "three-core-lights" */ 'three/src/lights/DirectionalLight.js'),
      import(/* webpackChunkName: "three-core-math" */ 'three/src/math/Color.js'),
    ]);

    // Construct minimal Three.js object
    const THREE = {
      Scene: modules[0].Scene,
      PerspectiveCamera: modules[1].PerspectiveCamera,
      WebGLRenderer: modules[2].WebGLRenderer,
      DodecahedronGeometry: modules[3].DodecahedronGeometry,
      MeshPhongMaterial: modules[4].MeshPhongMaterial,
      Mesh: modules[5].Mesh,
      AmbientLight: modules[6].AmbientLight,
      DirectionalLight: modules[7].DirectionalLight,
      Color: modules[8].Color,
      REVISION: '180', // Current Three.js version
    };

    return THREE;
  }

  /**
   * Load effects module for advanced features
   */
  private async loadEffectsModule(): Promise<any> {
    const effects = await import(
      /* webpackChunkName: "three-effects" */ 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
    );
    return effects;
  }

  /**
   * Prioritize features based on user needs
   */
  private prioritizeFeatures(features: ViewerFeature[]): ViewerFeature[] {
    return features.sort((a, b) => {
      const priorityA = this.getFeaturePriority(a);
      const priorityB = this.getFeaturePriority(b);
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[priorityA] - order[priorityB];
    });
  }

  /**
   * Get priority level for a feature
   */
  private getFeaturePriority(feature: ViewerFeature): LoadingPriority {
    const priorities: Record<ViewerFeature, LoadingPriority> = {
      basic: 'critical',
      controls: 'high',
      loaders: 'medium',
      postprocessing: 'low',
      effects: 'low',
    };
    return priorities[feature];
  }

  /**
   * Create batches for concurrent loading
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Preload modules on user hover/interaction
   */
  preloadOnHover(targetFeatures: ViewerFeature[]): void {
    if (!this.config.enablePreloadOnHover || !this.userInteractionDetected) return;

    targetFeatures.forEach(feature => {
      if (!this.moduleCache.has(feature)) {
        this.loadSingleFeature(feature).catch(err => {
          logger.warn(`Preload failed for ${feature}:`, err);
        });
      }
    });
  }

  /**
   * Check if modules are loaded
   */
  isLoaded(features: ViewerFeature[]): boolean {
    return features.every(feature => this.moduleCache.has(feature));
  }

  /**
   * Get loading progress
   */
  getLoadingProgress(features: ViewerFeature[]): number {
    const loaded = features.filter(feature => this.moduleCache.has(feature)).length;
    return (loaded / features.length) * 100;
  }

  /**
   * Clean up cached modules
   */
  cleanup(): void {
    this.moduleCache.clear();
    this.loadingQueue.clear();
  }
}

export const optimizedThreeLoader = OptimizedThreeLoader.getInstance();

/**
 * React hook for optimized Three.js loading
 */
export function useOptimizedThree(features: ViewerFeature[] = ['basic']) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<Error | null>(null);
  const [modules, setModules] = React.useState<any>(null);

  React.useEffect(() => {
    let mounted = true;

    const loadModules = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Update progress during loading
        const progressInterval = setInterval(() => {
          if (mounted) {
            setProgress(optimizedThreeLoader.getLoadingProgress(features));
          }
        }, 100);

        const loadedModules = await optimizedThreeLoader.loadOptimizedModules(features);

        clearInterval(progressInterval);

        if (mounted) {
          setModules(loadedModules);
          setProgress(100);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
          setIsLoading(false);
        }
      }
    };

    loadModules();

    return () => {
      mounted = false;
    };
  }, [features]);

  const preloadAdditionalFeatures = React.useCallback((additionalFeatures: ViewerFeature[]) => {
    optimizedThreeLoader.preloadOnHover(additionalFeatures);
  }, []);

  return {
    isLoading,
    progress,
    error,
    modules,
    preloadAdditionalFeatures,
    isFullyLoaded: optimizedThreeLoader.isLoaded(features),
  };
}

// Add React import for the hook
import React from 'react';
import { logger } from '@/lib/utils/logger';
