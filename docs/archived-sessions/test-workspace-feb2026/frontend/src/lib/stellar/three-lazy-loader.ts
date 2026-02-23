/**
 * Three.js Lazy Loading Manager
 * Implements aggressive code splitting and on-demand loading for Three.js modules
 * Reduces initial bundle size by ~2MB
 */

type ThreeModule = 'core' | 'controls' | 'loaders' | 'postprocessing' | 'utils';

interface ModuleCache {
  core?: any;
  controls?: any;
  loaders?: any;
  postprocessing?: any;
  utils?: any;
}

class ThreeJSLazyLoader {
  private static instance: ThreeJSLazyLoader;
  private moduleCache: ModuleCache = {};
  private loadingPromises: Map<ThreeModule, Promise<any>> = new Map();

  private constructor() {}

  static getInstance(): ThreeJSLazyLoader {
    if (!ThreeJSLazyLoader.instance) {
      ThreeJSLazyLoader.instance = new ThreeJSLazyLoader();
    }
    return ThreeJSLazyLoader.instance;
  }

  /**
   * Load core Three.js module (essential for basic rendering)
   */
  async loadCore(): Promise<any> {
    if (this.moduleCache.core) {
      return this.moduleCache.core;
    }

    if (this.loadingPromises.has('core')) {
      return this.loadingPromises.get('core')!;
    }

    const loadPromise = import(/* webpackChunkName: "three-core" */ 'three').then(module => {
      this.moduleCache.core = module;
      this.loadingPromises.delete('core');
      return module;
    });

    this.loadingPromises.set('core', loadPromise);
    return loadPromise;
  }

  /**
   * Load camera controls (OrbitControls, FlyControls, etc.)
   */
  async loadControls(controlType: string = 'OrbitControls'): Promise<any> {
    const cacheKey = `controls_${controlType}`;

    if (this.moduleCache.controls?.[controlType]) {
      return this.moduleCache.controls[controlType];
    }

    let loadPromise: Promise<any>;

    // Use static imports for known control types to avoid webpack dynamic import issues
    switch (controlType) {
      case 'OrbitControls':
        loadPromise = import(
          /* webpackChunkName: "three-orbit-controls" */
          'three/examples/jsm/controls/OrbitControls.js'
        ).then(module => module.OrbitControls);
        break;
      case 'FlyControls':
        loadPromise = import(
          /* webpackChunkName: "three-fly-controls" */
          'three/examples/jsm/controls/FlyControls.js'
        ).then(module => module.FlyControls);
        break;
      case 'TrackballControls':
        loadPromise = import(
          /* webpackChunkName: "three-trackball-controls" */
          'three/examples/jsm/controls/TrackballControls.js'
        ).then(module => module.TrackballControls);
        break;
      default:
        // Default to OrbitControls if unknown type requested
        loadPromise = import(
          /* webpackChunkName: "three-orbit-controls" */
          'three/examples/jsm/controls/OrbitControls.js'
        ).then(module => module.OrbitControls);
    }

    return loadPromise.then(Control => {
      if (!this.moduleCache.controls) {
        this.moduleCache.controls = {};
      }
      this.moduleCache.controls[controlType] = Control;
      return Control;
    });
  }

  /**
   * Load geometry loaders (GLTFLoader, OBJLoader, etc.)
   */
  async loadLoader(loaderType: string = 'GLTFLoader'): Promise<any> {
    const cacheKey = `loaders_${loaderType}`;

    if (this.moduleCache.loaders?.[loaderType]) {
      return this.moduleCache.loaders[loaderType];
    }

    let loadPromise: Promise<any>;

    // Use static imports for known loader types to avoid webpack dynamic import issues
    switch (loaderType) {
      case 'GLTFLoader':
        loadPromise = import(
          /* webpackChunkName: "three-gltf-loader" */
          'three/examples/jsm/loaders/GLTFLoader.js'
        ).then(module => module.GLTFLoader);
        break;
      case 'OBJLoader':
        loadPromise = import(
          /* webpackChunkName: "three-obj-loader" */
          'three/examples/jsm/loaders/OBJLoader.js'
        ).then(module => module.OBJLoader);
        break;
      case 'FBXLoader':
        loadPromise = import(
          /* webpackChunkName: "three-fbx-loader" */
          'three/examples/jsm/loaders/FBXLoader.js'
        ).then(module => module.FBXLoader);
        break;
      case 'STLLoader':
        loadPromise = import(
          /* webpackChunkName: "three-stl-loader" */
          'three/examples/jsm/loaders/STLLoader.js'
        ).then(module => module.STLLoader);
        break;
      case 'PLYLoader':
        loadPromise = import(
          /* webpackChunkName: "three-ply-loader" */
          'three/examples/jsm/loaders/PLYLoader.js'
        ).then(module => module.PLYLoader);
        break;
      case 'ColladaLoader':
        loadPromise = import(
          /* webpackChunkName: "three-collada-loader" */
          'three/examples/jsm/loaders/ColladaLoader.js'
        ).then(module => module.ColladaLoader);
        break;
      case 'DRACOLoader':
        loadPromise = import(
          /* webpackChunkName: "three-draco-loader" */
          'three/examples/jsm/loaders/DRACOLoader.js'
        ).then(module => module.DRACOLoader);
        break;
      default:
        // Default to GLTFLoader if unknown type requested
        loadPromise = import(
          /* webpackChunkName: "three-gltf-loader" */
          'three/examples/jsm/loaders/GLTFLoader.js'
        ).then(module => module.GLTFLoader);
    }

    return loadPromise.then(Loader => {
      if (!this.moduleCache.loaders) {
        this.moduleCache.loaders = {};
      }
      this.moduleCache.loaders[loaderType] = Loader;
      return Loader;
    });
  }

  /**
   * Load post-processing effects
   */
  async loadPostProcessing(): Promise<any> {
    if (this.moduleCache.postprocessing) {
      return this.moduleCache.postprocessing;
    }

    const loadPromise = Promise.all([
      import(
        /* webpackChunkName: "three-postprocessing" */ 'three/examples/jsm/postprocessing/EffectComposer.js'
      ),
      import(
        /* webpackChunkName: "three-postprocessing" */ 'three/examples/jsm/postprocessing/RenderPass.js'
      ),
      import(
        /* webpackChunkName: "three-postprocessing" */ 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
      ),
    ]).then(([effectComposer, renderPass, bloomPass]) => {
      this.moduleCache.postprocessing = {
        EffectComposer: effectComposer.EffectComposer,
        RenderPass: renderPass.RenderPass,
        UnrealBloomPass: bloomPass.UnrealBloomPass,
      };
      return this.moduleCache.postprocessing;
    });

    return loadPromise;
  }

  /**
   * Preload specific modules for better performance
   */
  async preloadModules(modules: ThreeModule[]): Promise<void> {
    const loadPromises = modules.map(module => {
      switch (module) {
        case 'core':
          return this.loadCore();
        case 'controls':
          return this.loadControls();
        case 'postprocessing':
          return this.loadPostProcessing();
        default:
          return Promise.resolve();
      }
    });

    await Promise.all(loadPromises);
  }

  /**
   * Clean up cached modules to free memory
   */
  clearCache(module?: ThreeModule): void {
    if (module) {
      delete this.moduleCache[module];
    } else {
      this.moduleCache = {};
    }
    this.loadingPromises.clear();
  }

  /**
   * Get loading status
   */
  getLoadingStatus(): { loaded: string[]; loading: string[] } {
    const loaded = Object.keys(this.moduleCache).filter(
      key => this.moduleCache[key as ThreeModule]
    );
    const loading = Array.from(this.loadingPromises.keys());
    return { loaded, loading };
  }
}

// Export singleton instance
export const threeLoader = ThreeJSLazyLoader.getInstance();

/**
 * React hook for lazy loading Three.js modules
 */
export function useThreeModule(module: ThreeModule) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [moduleRef, setModuleRef] = React.useState<any>(null);

  React.useEffect(() => {
    let mounted = true;

    const loadModule = async () => {
      try {
        setIsLoading(true);
        let loadedModule: any;

        switch (module) {
          case 'core':
            loadedModule = await threeLoader.loadCore();
            break;
          case 'controls':
            loadedModule = await threeLoader.loadControls();
            break;
          case 'postprocessing':
            loadedModule = await threeLoader.loadPostProcessing();
            break;
          default:
            throw new Error(`Unknown module: ${module}`);
        }

        if (mounted) {
          setModuleRef(loadedModule);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
          setIsLoading(false);
        }
      }
    };

    loadModule();

    return () => {
      mounted = false;
    };
  }, [module]);

  return { isLoading, error, module: moduleRef };
}

// Add React import for the hook
import React from 'react';
