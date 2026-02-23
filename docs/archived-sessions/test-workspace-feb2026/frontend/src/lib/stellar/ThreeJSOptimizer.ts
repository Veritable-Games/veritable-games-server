'use client';

/**
 * Three.js Performance Optimizer
 * Manages memory, rendering, and performance optimizations for the stellar visualization system
 */

/**
 * Minimal type definitions for Three.js objects
 * These interfaces define only the properties and methods used by the optimizer
 */

interface ThreeTexture {
  isTexture: boolean;
  dispose(): void;
}

interface ThreeMaterial {
  transparent?: boolean;
  alphaTest?: number;
  side?: number;
  precision?: string;
  dispose(): void;
  [key: string]: unknown;
}

interface ThreeGeometry {
  computeBoundingSphere?(): void;
  computeBoundingBox?(): void;
  dispose(): void;
}

interface ThreeObject3D {
  isMesh?: boolean;
  geometry?: ThreeGeometry;
  material?: ThreeMaterial | ThreeMaterial[];
  frustumCulled?: boolean;
}

interface ThreeScene {
  traverse(callback: (object: ThreeObject3D) => void): void;
  autoUpdate?: boolean;
}

interface ThreeRendererInfo {
  render: {
    triangles: number;
    calls: number;
  };
  reset(): void;
}

interface ThreeRenderer {
  setPixelRatio(ratio: number): void;
  getPixelRatio(): number;
  setSize(width: number, height: number): void;
  shadowMap: {
    enabled: boolean;
  };
  antialias?: boolean;
  sortObjects?: boolean;
  logarithmicDepthBuffer?: boolean;
  powerPreference?: string;
  info: ThreeRendererInfo;
}

interface ThreeCamera {
  isPerspectiveCamera?: boolean;
  aspect?: number;
  updateProjectionMatrix?(): void;
}

interface PerformanceMemory {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  triangleCount: number;
  drawCalls: number;
}

export interface OptimizationConfig {
  enableFrustumCulling: boolean;
  enableLevelOfDetail: boolean;
  maxFPS: number;
  memoryThreshold: number;
  autoResize: boolean;
  pixelRatioLimit: number;
}

export class ThreeJSOptimizer {
  private frameCount = 0;
  private lastTime = performance.now();
  private frameTimeBuffer: number[] = [];
  private readonly BUFFER_SIZE = 60;

  private config: OptimizationConfig = {
    enableFrustumCulling: true,
    enableLevelOfDetail: true,
    maxFPS: 60,
    memoryThreshold: 100 * 1024 * 1024, // 100MB
    autoResize: true,
    pixelRatioLimit: 2,
  };

  constructor(customConfig?: Partial<OptimizationConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
  }

  /**
   * Optimize renderer settings for performance
   */
  optimizeRenderer(renderer: ThreeRenderer): void {
    if (!renderer) return;

    // Limit pixel ratio for performance
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.config.pixelRatioLimit));

    // Enable performance optimizations
    renderer.shadowMap.enabled = false; // Disable shadows for better performance
    renderer.antialias = window.devicePixelRatio < 2; // Disable on high-DPI displays

    // Optimize rendering
    renderer.sortObjects = true;
    renderer.logarithmicDepthBuffer = false;

    // Power preference for mobile devices
    if (this.isMobile()) {
      renderer.powerPreference = 'high-performance';
    }
  }

  /**
   * Optimize scene objects for performance
   */
  optimizeScene(scene: ThreeScene): void {
    if (!scene) return;

    scene.traverse((object: ThreeObject3D) => {
      if (object.isMesh) {
        this.optimizeMesh(object);
      }
    });

    // Enable frustum culling
    if (this.config.enableFrustumCulling) {
      scene.autoUpdate = false;
    }
  }

  /**
   * Optimize individual mesh objects
   */
  private optimizeMesh(mesh: ThreeObject3D): void {
    if (!mesh.geometry || !mesh.material) return;

    // Optimize geometry
    if (mesh.geometry.computeBoundingSphere) {
      mesh.geometry.computeBoundingSphere();
    }
    if (mesh.geometry.computeBoundingBox) {
      mesh.geometry.computeBoundingBox();
    }

    // Set frustum culling
    mesh.frustumCulled = this.config.enableFrustumCulling;

    // Optimize materials
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((mat: ThreeMaterial) => this.optimizeMaterial(mat));
    } else {
      this.optimizeMaterial(mesh.material);
    }
  }

  /**
   * Optimize material settings
   */
  private optimizeMaterial(material: ThreeMaterial): void {
    if (!material) return;

    // Disable expensive features for performance
    material.transparent = false;
    material.alphaTest = 0;
    material.side = 0; // THREE.FrontSide

    // Optimize for mobile
    if (this.isMobile()) {
      material.precision = 'mediump';
    }
  }

  /**
   * Monitor and collect performance metrics
   */
  updateMetrics(renderer: ThreeRenderer, scene: ThreeScene): PerformanceMetrics {
    const currentTime = performance.now();
    const frameTime = currentTime - this.lastTime;

    this.frameTimeBuffer.push(frameTime);
    if (this.frameTimeBuffer.length > this.BUFFER_SIZE) {
      this.frameTimeBuffer.shift();
    }

    this.frameCount++;
    this.lastTime = currentTime;

    const averageFrameTime =
      this.frameTimeBuffer.reduce((a, b) => a + b, 0) / this.frameTimeBuffer.length;
    const fps = 1000 / averageFrameTime;

    const metrics: PerformanceMetrics = {
      fps: Math.round(fps),
      frameTime: Math.round(averageFrameTime * 100) / 100,
      memoryUsage: this.getMemoryUsage(),
      triangleCount: renderer?.info?.render?.triangles || 0,
      drawCalls: renderer?.info?.render?.calls || 0,
    };

    return metrics;
  }

  /**
   * Automatic performance adjustments based on metrics
   */
  autoOptimize(metrics: PerformanceMetrics, renderer: ThreeRenderer, scene: ThreeScene): void {
    // Reduce quality if FPS is too low
    if (metrics.fps < 30) {
      this.reduceQuality(renderer);
    }

    // Memory management
    if (metrics.memoryUsage > this.config.memoryThreshold) {
      this.cleanupMemory(scene);
    }

    // Reset renderer info for next frame
    if (renderer?.info?.reset) {
      renderer.info.reset();
    }
  }

  /**
   * Reduce rendering quality for better performance
   */
  private reduceQuality(renderer: ThreeRenderer): void {
    if (!renderer) return;

    // Reduce pixel ratio
    const currentRatio = renderer.getPixelRatio();
    if (currentRatio > 1) {
      renderer.setPixelRatio(Math.max(1, currentRatio * 0.8));
    }
  }

  /**
   * Clean up memory by disposing unused resources
   */
  private cleanupMemory(scene: ThreeScene): void {
    if (!scene) return;

    scene.traverse((object: ThreeObject3D) => {
      if (object.geometry) {
        object.geometry.dispose();
      }

      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material: ThreeMaterial) => {
            this.disposeMaterial(material);
          });
        } else {
          this.disposeMaterial(object.material);
        }
      }
    });
  }

  /**
   * Dispose material and its textures
   */
  private disposeMaterial(material: ThreeMaterial): void {
    if (!material) return;

    // Dispose textures
    Object.keys(material).forEach(key => {
      const value = material[key];
      const texture = value as ThreeTexture | undefined;
      if (texture && typeof texture === 'object' && 'isTexture' in texture && texture.isTexture) {
        texture.dispose();
      }
    });

    material.dispose();
  }

  /**
   * Handle window resize optimization
   */
  handleResize(renderer: ThreeRenderer, camera: ThreeCamera): void {
    if (!this.config.autoResize) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Update camera
    if (camera?.isPerspectiveCamera) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix?.();
    }

    // Update renderer
    if (renderer) {
      renderer.setSize(width, height);

      // Optimize pixel ratio based on screen size
      const pixelRatio = Math.min(
        window.devicePixelRatio,
        this.config.pixelRatioLimit,
        width > 1920 ? 1 : 2 // Reduce on large screens
      );
      renderer.setPixelRatio(pixelRatio);
    }
  }

  /**
   * Get memory usage estimation
   */
  private getMemoryUsage(): number {
    const perfWithMemory = performance as PerformanceWithMemory;
    if ('memory' in perfWithMemory && perfWithMemory.memory) {
      return perfWithMemory.memory.usedJSHeapSize || 0;
    }
    return 0;
  }

  /**
   * Detect mobile devices
   */
  private isMobile(): boolean {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.fps < 30) {
      recommendations.push('Consider reducing scene complexity or lowering quality settings');
    }

    if (metrics.drawCalls > 100) {
      recommendations.push('Too many draw calls - consider mesh merging or instancing');
    }

    if (metrics.memoryUsage > this.config.memoryThreshold) {
      recommendations.push('High memory usage detected - consider disposing unused resources');
    }

    if (metrics.triangleCount > 50000) {
      recommendations.push('High triangle count - consider using Level of Detail (LOD)');
    }

    return recommendations;
  }

  /**
   * Dispose the optimizer and clean up resources
   */
  dispose(): void {
    this.frameTimeBuffer = [];
    this.frameCount = 0;
  }
}

export default ThreeJSOptimizer;
