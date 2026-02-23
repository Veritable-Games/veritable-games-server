'use client';

import React, { useRef, useEffect, useState } from 'react';
import { threeLoader } from './three-lazy-loader';
import { logger } from '@/lib/utils/logger';

// Three.js modules will be loaded on demand
let THREE: any;
let OrbitControls: any;

// Optimized Three.js loading with lazy loader
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

const ThreeJSViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const frameRef = useRef<number>(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState('Loading Three.js...');

  useEffect(() => {
    let mounted = true;

    const initializeViewer = async () => {
      try {
        if (!containerRef.current || !mounted) return;

        // Initialize Three.js with optimized loading
        setLoadingStage('Loading 3D engine...');
        const modules = await initializeThreeJS();
        if (!modules || !mounted) return;

        setLoadingStage('Creating 3D scene...');

        // Create scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000011);

        // Create camera
        const camera = new THREE.PerspectiveCamera(
          75,
          window.innerWidth / window.innerHeight,
          0.1,
          1000
        );
        camera.position.set(0, 0, 5);

        // Create renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Clear container and add renderer
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(renderer.domElement);

        // Create controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enableZoom = true;

        setLoadingStage('Creating stellar objects...');

        // Create a simple dodecahedron as placeholder
        const geometry = new THREE.DodecahedronGeometry(1, 0);
        const material = new THREE.MeshPhongMaterial({
          color: 0x4444ff,
          shininess: 100,
          wireframe: false,
        });
        const dodecahedron = new THREE.Mesh(geometry, material);
        scene.add(dodecahedron);

        // Add some lights
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(-1, 1, 1);
        scene.add(directionalLight);

        // Store references
        sceneRef.current = scene;
        rendererRef.current = renderer;
        cameraRef.current = camera;
        controlsRef.current = controls;

        setLoadingStage('Starting animation...');

        // Animation loop
        const animate = () => {
          if (!mounted) return;

          frameRef.current = requestAnimationFrame(animate);

          // Rotate dodecahedron
          dodecahedron.rotation.x += 0.01;
          dodecahedron.rotation.y += 0.01;

          controls.update();
          renderer.render(scene, camera);
        };

        animate();

        // Handle resize
        const handleResize = () => {
          if (!camera || !renderer) return;

          const width = window.innerWidth;
          const height = window.innerHeight;

          camera.aspect = width / height;
          camera.updateProjectionMatrix();

          renderer.setSize(width, height);
        };

        window.addEventListener('resize', handleResize);

        if (mounted) {
          setIsLoading(false);
          setLoadingStage('');
        }

        return () => {
          window.removeEventListener('resize', handleResize);
        };
      } catch (err) {
        logger.error('Three.js viewer initialization failed:', err);
        if (mounted) {
          setError(
            `Failed to initialize 3D viewer: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
          setIsLoading(false);
        }
      }
    };

    initializeViewer();

    return () => {
      mounted = false;

      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }

      // Clean up Three.js objects
      if (sceneRef.current) {
        sceneRef.current.traverse((object: any) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((material: any) => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }

      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
    };
  }, []);

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

      {/* Development overlay */}
      {process.env.NODE_ENV === 'development' && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded bg-black/50 p-2 text-xs text-white backdrop-blur-sm">
          <div>Stellar Viewer: Active (Three.js {THREE?.REVISION || '?'})</div>
          <div>Mouse: orbit • Wheel: zoom</div>
        </div>
      )}
    </>
  );
};

export default ThreeJSViewer;
