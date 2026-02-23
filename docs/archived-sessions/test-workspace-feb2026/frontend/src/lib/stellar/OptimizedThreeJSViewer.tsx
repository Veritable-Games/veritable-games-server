'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { threeLoader } from './three-lazy-loader';
import { logger } from '@/lib/utils/logger';

/**
 * Minimal TypeScript interfaces for Three.js objects
 * These provide type safety without requiring the full Three.js types package
 */

interface ThreeMaterial {
  dispose(): void;
  [key: string]: unknown;
}

interface ThreeGeometry {
  dispose(): void;
  [key: string]: unknown;
}

interface ThreeMesh {
  geometry?: ThreeGeometry;
  material?: ThreeMaterial | ThreeMaterial[];
  rotation: { x: number; y: number; z: number };
  [key: string]: unknown;
}

interface ThreeScene {
  background: unknown;
  add(object: unknown): void;
  remove(object: unknown): void;
  clear(): void;
  [key: string]: unknown;
}

interface ThreeCamera {
  aspect: number;
  position: { set(x: number, y: number, z: number): void };
  updateProjectionMatrix(): void;
  [key: string]: unknown;
}

interface ThreeRenderer {
  domElement: HTMLCanvasElement;
  shadowMap: { enabled: boolean };
  outputColorSpace: unknown;
  setSize(width: number, height: number): void;
  setPixelRatio(ratio: number): void;
  setRenderTarget(target: unknown): void;
  dispose(): void;
  render(scene: ThreeScene, camera: ThreeCamera): void;
  [key: string]: unknown;
}

interface ThreeOrbitControls {
  enableDamping: boolean;
  dampingFactor: number;
  enableZoom: boolean;
  maxDistance: number;
  minDistance: number;
  update(): void;
  dispose(): void;
  [key: string]: unknown;
}

interface ThreeLight {
  position?: { set(x: number, y: number, z: number): void };
  [key: string]: unknown;
}

interface ThreeCore {
  REVISION: string;
  Scene: new () => ThreeScene;
  PerspectiveCamera: new (fov: number, aspect: number, near: number, far: number) => ThreeCamera;
  WebGLRenderer: new (options: Record<string, unknown>) => ThreeRenderer;
  DodecahedronGeometry: new (radius: number, detail: number) => ThreeGeometry;
  MeshPhongMaterial: new (options: Record<string, unknown>) => ThreeMaterial;
  Mesh: new (geometry: ThreeGeometry, material: ThreeMaterial) => ThreeMesh;
  AmbientLight: new (color: number, intensity: number) => ThreeLight;
  DirectionalLight: new (color: number, intensity: number) => ThreeLight;
  Color: new (color: number) => unknown;
  SRGBColorSpace: unknown;
  [key: string]: unknown;
}

// Three.js modules will be loaded on demand
let THREE: ThreeCore | null = null;
let OrbitControls:
  | (new (camera: ThreeCamera, domElement: HTMLElement) => ThreeOrbitControls)
  | null = null;

// Resource management for proper cleanup
interface ThreeResources {
  scene?: ThreeScene;
  renderer?: ThreeRenderer;
  camera?: ThreeCamera;
  controls?: ThreeOrbitControls;
  meshes: ThreeMesh[];
  geometries: ThreeGeometry[];
  materials: ThreeMaterial[];
  lights: ThreeLight[];
}

// Optimized Three.js loading with lazy loader and error handling
const initializeThreeJS = async () => {
  if (typeof window === 'undefined') return null;

  try {
    // Load only the core module initially
    THREE = await threeLoader.loadCore();

    // Load controls separately (reduces initial bundle)
    OrbitControls = await threeLoader.loadControls('OrbitControls');

    return { THREE, OrbitControls };
  } catch (error) {
    logger.error('Failed to load Three.js modules:', error);
    throw error;
  }
};

const OptimizedThreeJSViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const resourcesRef = useRef<ThreeResources>({
    meshes: [],
    geometries: [],
    materials: [],
    lights: [],
  });
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState('Loading Three.js...');
  const [isInitialized, setIsInitialized] = useState(false);

  // Memoized container dimensions for performance
  const containerDimensions = useMemo(
    () => ({
      width: typeof window !== 'undefined' ? window.innerWidth : 800,
      height: typeof window !== 'undefined' ? window.innerHeight : 600,
    }),
    []
  );

  // Optimized cleanup function to prevent memory leaks
  const cleanupResources = useCallback(() => {
    const resources = resourcesRef.current;

    // Cancel animation frame
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }

    // Dispose of Three.js objects in proper order
    try {
      // Stop controls first
      if (resources.controls) {
        resources.controls.dispose();
        resources.controls = undefined;
      }

      // Dispose meshes and their resources
      resources.meshes.forEach(mesh => {
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((material: ThreeMaterial) => material.dispose());
          } else {
            mesh.material.dispose();
          }
        }
        if (resources.scene) {
          resources.scene.remove(mesh);
        }
      });
      resources.meshes.length = 0;

      // Dispose lights
      resources.lights.forEach(light => {
        if (resources.scene) {
          resources.scene.remove(light);
        }
      });
      resources.lights.length = 0;

      // Dispose individual geometries and materials
      resources.geometries.forEach(geometry => geometry.dispose());
      resources.geometries.length = 0;

      resources.materials.forEach(material => material.dispose());
      resources.materials.length = 0;

      // Dispose renderer
      if (resources.renderer) {
        // Clear render targets
        resources.renderer.setRenderTarget(null);
        resources.renderer.dispose();

        // Remove canvas from DOM
        const canvas = resources.renderer.domElement;
        if (canvas && canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
        resources.renderer = undefined;
      }

      // Clear scene
      if (resources.scene) {
        resources.scene.clear();
        resources.scene = undefined;
      }

      // Clear camera
      resources.camera = undefined;

      // Run additional cleanup functions
      cleanupFunctionsRef.current.forEach(cleanup => {
        try {
          cleanup();
        } catch (err) {
          logger.warn('Cleanup function error:', err);
        }
      });
      cleanupFunctionsRef.current.length = 0;
    } catch (err) {
      logger.warn('Error during Three.js cleanup:', err);
    }
  }, []);

  // Optimized resize handler with debouncing
  const handleResize = useCallback(() => {
    const resources = resourcesRef.current;
    if (!resources.camera || !resources.renderer) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    resources.camera.aspect = width / height;
    resources.camera.updateProjectionMatrix();

    resources.renderer.setSize(width, height);
  }, []);

  // Initialize Three.js viewer with proper resource tracking
  const initializeViewer = useCallback(async () => {
    if (!containerRef.current || isInitialized) return;

    let mounted = true;

    try {
      setLoadingStage('Loading 3D engine...');
      const modules = await initializeThreeJS();
      if (!modules || !mounted) return;

      setLoadingStage('Creating 3D scene...');

      // Verify THREE is loaded
      if (!THREE || !OrbitControls) {
        throw new Error('Three.js modules not loaded');
      }

      // Create scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000011);
      resourcesRef.current.scene = scene;

      // Create camera
      const camera = new THREE.PerspectiveCamera(
        75,
        containerDimensions.width / containerDimensions.height,
        0.1,
        1000
      );
      camera.position.set(0, 0, 5);
      resourcesRef.current.camera = camera;

      // Create renderer with optimized settings
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.setSize(containerDimensions.width, containerDimensions.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Optimize renderer for performance
      renderer.shadowMap.enabled = false; // Disable shadows for performance
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      resourcesRef.current.renderer = renderer;

      // Clear container and add renderer
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(renderer.domElement);

      // Create controls with optimized settings
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enableZoom = true;
      controls.maxDistance = 20;
      controls.minDistance = 2;
      resourcesRef.current.controls = controls;

      setLoadingStage('Creating stellar objects...');

      // Create optimized geometry with limited detail for performance
      const geometry = new THREE.DodecahedronGeometry(1, 0);
      resourcesRef.current.geometries.push(geometry);

      const material = new THREE.MeshPhongMaterial({
        color: 0x4444ff,
        shininess: 100,
        wireframe: false,
      });
      resourcesRef.current.materials.push(material);

      const dodecahedron = new THREE.Mesh(geometry, material);
      scene.add(dodecahedron);
      resourcesRef.current.meshes.push(dodecahedron);

      // Add optimized lights
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
      scene.add(ambientLight);
      resourcesRef.current.lights.push(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position?.set(-1, 1, 1);
      scene.add(directionalLight);
      resourcesRef.current.lights.push(directionalLight);

      setLoadingStage('Starting animation...');

      // Optimized animation loop with performance monitoring
      let lastTime = 0;
      const targetFPS = 60;
      const frameInterval = 1000 / targetFPS;

      const animate = (currentTime: number) => {
        if (!mounted || !resourcesRef.current.renderer) return;

        frameRef.current = requestAnimationFrame(animate);

        // Throttle animation to target FPS
        if (currentTime - lastTime < frameInterval) return;
        lastTime = currentTime;

        // Rotate dodecahedron with optimized rotation
        dodecahedron.rotation.x += 0.005; // Reduced rotation speed for better performance
        dodecahedron.rotation.y += 0.005;

        controls.update();
        renderer.render(scene, camera);
      };

      animate(0);

      // Add resize listener with cleanup tracking
      window.addEventListener('resize', handleResize);
      cleanupFunctionsRef.current.push(() => {
        window.removeEventListener('resize', handleResize);
      });

      if (mounted) {
        setIsLoading(false);
        setLoadingStage('');
        setIsInitialized(true);
      }
    } catch (err) {
      logger.error('Three.js viewer initialization failed:', err);
      if (mounted) {
        setError(
          `Failed to initialize 3D viewer: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
        setIsLoading(false);
      }
    }

    return () => {
      mounted = false;
    };
  }, [containerDimensions, handleResize, isInitialized]);

  // Initialize viewer on mount
  useEffect(() => {
    initializeViewer();
  }, [initializeViewer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);

  // Handle visibility change to pause/resume animation
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pause animation when tab is not visible
        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = 0;
        }
      } else {
        // Resume animation when tab becomes visible
        if (isInitialized && !frameRef.current) {
          // Restart animation loop
          const animate = () => {
            if (!resourcesRef.current.renderer) return;

            frameRef.current = requestAnimationFrame(animate);

            const resources = resourcesRef.current;
            if (resources.meshes[0]) {
              resources.meshes[0].rotation.x += 0.005;
              resources.meshes[0].rotation.y += 0.005;
            }

            if (resources.controls) {
              resources.controls.update();
            }

            if (resources.renderer && resources.scene && resources.camera) {
              resources.renderer.render(resources.scene, resources.camera);
            }
          };
          animate();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    cleanupFunctionsRef.current.push(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isInitialized]);

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-blue-900 via-gray-900 to-black">
        <div className="max-w-2xl p-8 text-center text-white">
          <div className="mb-4 text-xl text-red-400">⚠ 3D Viewer Error</div>
          <div className="mb-4 rounded border border-red-500/20 bg-red-900/20 p-4 font-mono text-sm opacity-80">
            {error}
          </div>
          <div className="text-xs opacity-60">
            The stellar visualization system is experiencing technical difficulties. Check the
            browser console for more details.
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-blue-900 via-gray-900 to-black">
        <div className="text-center text-white">
          <div className="mb-2 animate-pulse text-blue-300">◯ Loading Stellar Viewer</div>
          <div className="text-xs opacity-60">{loadingStage || 'Initializing...'}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className="h-full w-full" />

      {/* Development overlay with memory info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded bg-black/50 p-2 text-xs text-white backdrop-blur-sm">
          <div>Stellar Viewer: Optimized (Three.js {THREE?.REVISION || '?'})</div>
          <div>Meshes: {resourcesRef.current.meshes.length}</div>
          <div>Materials: {resourcesRef.current.materials.length}</div>
          <div>Geometries: {resourcesRef.current.geometries.length}</div>
          <div>Mouse: orbit • Wheel: zoom</div>
        </div>
      )}
    </>
  );
};

export default React.memo(OptimizedThreeJSViewer);
