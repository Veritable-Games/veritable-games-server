/**
 * Optimized Stellar Viewer Component
 * Phase 3: Demonstrates all optimization techniques
 */

'use client';

import React, { Suspense, lazy } from 'react';
import { useOptimizedThree } from '@/lib/stellar/optimized-three-loader';
import { withProgressiveLoading } from '@/lib/optimization/progressive-loader';
import { useIntersectionLoader } from '@/lib/optimization/component-lazy-loader';

// Lazy load the actual Three.js viewer only when needed
const ThreeJSViewer = lazy(() => import('@/lib/stellar/ThreeJSViewer'));

interface OptimizedStellarViewerProps {
  className?: string;
  autoLoad?: boolean;
  preloadOnHover?: boolean;
  enableIntersectionLoading?: boolean;
}

const StellarViewerSkeleton = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-blue-900 via-gray-900 to-black">
    <div className="text-center text-white">
      <div className="mb-2 animate-pulse text-blue-300">◯ Preparing Stellar Viewer</div>
      <div className="mb-4 text-xs opacity-60">Optimizing 3D assets...</div>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-gray-700">
        <div className="h-full animate-pulse rounded-full bg-blue-500" style={{ width: '60%' }} />
      </div>
    </div>
  </div>
);

const StellarViewerError = ({ error, retry }: { error: Error; retry: () => void }) => (
  <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-red-900 via-gray-900 to-black">
    <div className="max-w-2xl p-8 text-center text-white">
      <div className="mb-4 text-xl text-red-400">⚠ 3D Viewer Optimization Error</div>
      <div className="mb-4 rounded border border-red-500/20 bg-red-900/20 p-4 font-mono text-sm opacity-80">
        {error.message}
      </div>
      <button
        onClick={retry}
        className="rounded bg-blue-600 px-4 py-2 transition-colors hover:bg-blue-500"
      >
        Retry Loading
      </button>
      <div className="mt-4 text-xs opacity-60">
        Using optimized loading strategy. Check browser compatibility.
      </div>
    </div>
  </div>
);

const OptimizedStellarViewerComponent: React.FC<OptimizedStellarViewerProps> = ({
  className = '',
  autoLoad = false,
  preloadOnHover = true,
  enableIntersectionLoading = true,
}) => {
  const [shouldLoad, setShouldLoad] = React.useState(autoLoad);
  const [hasUserInteracted, setHasUserInteracted] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Use optimized Three.js loading
  const {
    isLoading: isThreeLoading,
    progress,
    error: threeError,
    modules: threeModules,
    preloadAdditionalFeatures,
    isFullyLoaded,
  } = useOptimizedThree(shouldLoad ? ['basic', 'controls'] : []);

  // Setup intersection-based loading
  useIntersectionLoader(
    containerRef as React.RefObject<HTMLElement>,
    () => {
      if (enableIntersectionLoading && !shouldLoad) {
        setShouldLoad(true);
      }
    },
    { threshold: 0.1, rootMargin: '100px' }
  );

  // Setup hover-based preloading
  React.useEffect(() => {
    if (!preloadOnHover || shouldLoad) return;

    const handleMouseEnter = () => {
      if (!hasUserInteracted) {
        setHasUserInteracted(true);
        // Preload additional features on hover
        preloadAdditionalFeatures(['postprocessing', 'effects']);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mouseenter', handleMouseEnter, { once: true });
      return () => container.removeEventListener('mouseenter', handleMouseEnter);
    }
  }, [preloadOnHover, shouldLoad, hasUserInteracted, preloadAdditionalFeatures]);

  // Handle manual load trigger
  const handleLoadViewer = React.useCallback(() => {
    setShouldLoad(true);
    setHasUserInteracted(true);
  }, []);

  // Retry on error
  const handleRetry = React.useCallback(() => {
    setShouldLoad(false);
    setTimeout(() => setShouldLoad(true), 100);
  }, []);

  // Don't render anything if not ready to load
  if (!shouldLoad) {
    return (
      <div
        ref={containerRef}
        className={`group fixed inset-0 flex cursor-pointer items-center justify-center bg-gradient-to-b from-blue-900 via-gray-900 to-black ${className}`}
        onClick={handleLoadViewer}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleLoadViewer();
          }
        }}
        aria-label="Click to load 3D stellar viewer"
      >
        <div className="text-center text-white">
          <div className="mb-2 text-blue-300 group-hover:animate-pulse">◯ Stellar Viewer Ready</div>
          <div className="mb-4 text-xs opacity-60">Click to load 3D visualization</div>
          <div className="text-xs opacity-40">
            Optimized loading • {Math.round(progress)}% assets prepared
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (threeError) {
    return <StellarViewerError error={threeError} retry={handleRetry} />;
  }

  // Show loading state with progress
  if (isThreeLoading || !isFullyLoaded) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-blue-900 via-gray-900 to-black">
        <div className="text-center text-white">
          <div className="mb-2 animate-pulse text-blue-300">◯ Loading Stellar Viewer</div>
          <div className="mb-4 text-xs opacity-60">
            {progress < 50
              ? 'Loading 3D engine...'
              : progress < 80
                ? 'Initializing controls...'
                : 'Finalizing setup...'}
          </div>
          <div className="h-2 w-48 overflow-hidden rounded-full bg-gray-700">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 text-xs opacity-40">{Math.round(progress)}% complete</div>
        </div>
      </div>
    );
  }

  // Render the actual viewer
  return (
    <div ref={containerRef} className={`fixed inset-0 ${className}`} style={{ zIndex: 1 }}>
      <Suspense fallback={<StellarViewerSkeleton />}>
        <ThreeJSViewer />
      </Suspense>

      {/* Performance info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded bg-black/50 p-2 text-xs text-white backdrop-blur-sm">
          <div>Optimization: Phase 3</div>
          <div>Modules: {isFullyLoaded ? 'Loaded' : 'Loading'}</div>
          <div>Progress: {Math.round(progress)}%</div>
          <div>User Interaction: {hasUserInteracted ? 'Yes' : 'No'}</div>
        </div>
      )}
    </div>
  );
};

// Apply progressive loading HOC with relevant assets
export const OptimizedStellarViewer = withProgressiveLoading(OptimizedStellarViewerComponent, [
  '/stellar/three.js/three.module.js',
  '/stellar/three.js/examples/jsm/controls/OrbitControls.js',
]);

/**
 * Lightweight version for background use
 */
export const StellarBackgroundViewer: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <OptimizedStellarViewer
      className={className}
      autoLoad={false}
      preloadOnHover={true}
      enableIntersectionLoading={true}
    />
  );
};

/**
 * Immediate load version for dedicated 3D pages
 */
export const ImmediateStellarViewer: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <OptimizedStellarViewer
      className={className}
      autoLoad={true}
      preloadOnHover={false}
      enableIntersectionLoading={false}
    />
  );
};

export default OptimizedStellarViewer;
