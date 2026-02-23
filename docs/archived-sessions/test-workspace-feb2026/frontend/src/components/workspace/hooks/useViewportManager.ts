/**
 * useViewportManager Hook
 *
 * Encapsulates viewport transformation and culling logic for WorkspaceCanvas.
 * Manages pan/zoom, coordinate transformations, viewport culling, and animation loop.
 *
 * Phase 2: Extracted from WorkspaceCanvas.tsx (lines 120-280, 835-905)
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { TransformManager } from '@/lib/workspace/transform-manager';
import { ViewportCuller } from '@/lib/workspace/viewport-culling';
import { CanvasNode, ViewportTransform } from '@/lib/workspace/types';
import { fetchWithCSRF } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

interface UseViewportManagerOptions {
  initialViewport?: ViewportTransform;
  workspaceId?: string;
  isLoading: boolean;
  onViewportChange?: (transform: ViewportTransform) => void;
}

interface ViewportManagerResult {
  // Transform state
  transform: ViewportTransform | null;
  zoom: number;

  // Transform methods
  pan: (deltaX: number, deltaY: number) => void;
  panInstant: (deltaX: number, deltaY: number) => void;
  zoomIn: (centerX: number, centerY: number) => void;
  zoomOut: (centerX: number, centerY: number) => void;
  setZoom: (delta: number, centerX: number, centerY: number) => void;
  resetView: () => void;

  // Coordinate transformations
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number } | null;
  canvasToScreen: (canvasX: number, canvasY: number) => { x: number; y: number } | null;

  // Viewport culling
  getVisibleNodes: (
    nodes: Map<string, CanvasNode>,
    containerWidth: number,
    containerHeight: number
  ) => CanvasNode[];

  // Animation state
  isAnimating: boolean;
  startAnimationLoop: (
    canvasLayerRef: React.RefObject<HTMLDivElement>,
    gridLayerRef: React.RefObject<HTMLDivElement>
  ) => void;

  // Layer refs for CSS transforms
  applyTransformToLayers: (
    canvasLayerRef: React.RefObject<HTMLDivElement>,
    gridLayerRef: React.RefObject<HTMLDivElement>
  ) => void;

  // Internal refs (for WorkspaceCanvas compatibility)
  transformManagerRef: React.MutableRefObject<TransformManager | null>;
  viewportCullerRef: React.MutableRefObject<ViewportCuller | null>;
}

/**
 * Custom hook to manage viewport transformations and culling
 */
export function useViewportManager({
  initialViewport,
  workspaceId,
  isLoading,
  onViewportChange,
}: UseViewportManagerOptions): ViewportManagerResult {
  // Core managers
  const transformManagerRef = useRef<TransformManager | null>(null);
  const viewportCullerRef = useRef<ViewportCuller | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const viewportSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [currentTransform, setCurrentTransform] = useState<ViewportTransform | null>(
    initialViewport || null
  );
  const [isAnimating, setIsAnimating] = useState(false);

  /**
   * Initialize TransformManager and ViewportCuller ONCE
   */
  useEffect(() => {
    const transformManager = new TransformManager(
      initialViewport || { offsetX: 0, offsetY: 0, scale: 1.0 }
    );
    transformManagerRef.current = transformManager;

    const viewportCuller = new ViewportCuller();
    viewportCullerRef.current = viewportCuller;

    setCurrentTransform(transformManager.getTransform());

    return () => {
      // Cleanup animation frame on unmount
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Update TransformManager when viewport loads from server
   */
  useEffect(() => {
    if (!isLoading && transformManagerRef.current && initialViewport) {
      transformManagerRef.current.setTransform(initialViewport);
      setCurrentTransform(initialViewport);
    }
  }, [isLoading, initialViewport]);

  /**
   * Debounced viewport save
   * Delays save until user stops panning/zooming (1500ms after last change)
   */
  const debouncedSaveViewport = useCallback(
    (transform: ViewportTransform, delay: number = 1500) => {
      if (!workspaceId) return;

      // Clear existing timer
      if (viewportSaveTimerRef.current) {
        clearTimeout(viewportSaveTimerRef.current);
      }

      // Set new timer
      viewportSaveTimerRef.current = setTimeout(async () => {
        try {
          await fetchWithCSRF('/api/workspace/viewport', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspaceId,
              transform,
            }),
          });
          if (process.env.NODE_ENV === 'development') {
            logger.info('Viewport saved:', transform);
          }
        } catch (error) {
          logger.error('Failed to save viewport:', error);
        }

        viewportSaveTimerRef.current = null;
      }, delay);
    },
    [workspaceId]
  );

  /**
   * Animation loop
   * Updates TransformManager and applies CSS transforms each frame
   */
  const startAnimationLoop = useCallback(
    (
      canvasLayerRef: React.RefObject<HTMLDivElement>,
      gridLayerRef: React.RefObject<HTMLDivElement>
    ) => {
      // Don't start if already running
      if (animationFrameRef.current !== null) return;

      setIsAnimating(true);

      const animate = () => {
        if (transformManagerRef.current) {
          const hasChanges = transformManagerRef.current.update();

          if (hasChanges) {
            const transform = transformManagerRef.current.toCSSTransform();
            const newTransform = transformManagerRef.current.getTransform();

            // Update CSS transform for ALL layers synchronously
            if (canvasLayerRef.current) {
              canvasLayerRef.current.style.transform = transform;
            }
            if (gridLayerRef.current) {
              gridLayerRef.current.style.transform = transform;
            }

            // Update state and notify parent
            setCurrentTransform(newTransform);
            onViewportChange?.(newTransform);

            // Save viewport (debounced)
            debouncedSaveViewport(newTransform);

            // Continue animation loop
            animationFrameRef.current = requestAnimationFrame(animate);
          } else {
            // Animation complete - stop RAF loop to save CPU/battery
            animationFrameRef.current = null;
            setIsAnimating(false);
          }
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    },
    [onViewportChange, debouncedSaveViewport]
  );

  /**
   * Apply transform to layers immediately (without animation)
   */
  const applyTransformToLayers = useCallback(
    (
      canvasLayerRef: React.RefObject<HTMLDivElement>,
      gridLayerRef: React.RefObject<HTMLDivElement>
    ) => {
      if (!transformManagerRef.current) return;

      const cssTransform = transformManagerRef.current.toCSSTransform();
      if (canvasLayerRef.current) {
        canvasLayerRef.current.style.transform = cssTransform;
      }
      if (gridLayerRef.current) {
        gridLayerRef.current.style.transform = cssTransform;
      }
    },
    []
  );

  /**
   * Pan viewport (with animation)
   */
  const pan = useCallback((deltaX: number, deltaY: number) => {
    if (!transformManagerRef.current) return;
    transformManagerRef.current.pan(deltaX, deltaY);
  }, []);

  /**
   * Pan viewport instantly (without animation)
   */
  const panInstant = useCallback(
    (deltaX: number, deltaY: number) => {
      if (!transformManagerRef.current) return;
      transformManagerRef.current.panInstant(deltaX, deltaY);
      const newTransform = transformManagerRef.current.getTransform();
      setCurrentTransform(newTransform);
      onViewportChange?.(newTransform);
      debouncedSaveViewport(newTransform);
    },
    [onViewportChange, debouncedSaveViewport]
  );

  /**
   * Zoom in
   */
  const zoomIn = useCallback((centerX: number, centerY: number) => {
    if (!transformManagerRef.current) return;
    transformManagerRef.current.zoom(0.1, centerX, centerY);
  }, []);

  /**
   * Zoom out
   */
  const zoomOut = useCallback((centerX: number, centerY: number) => {
    if (!transformManagerRef.current) return;
    transformManagerRef.current.zoom(-0.1, centerX, centerY);
  }, []);

  /**
   * Set zoom level
   */
  const setZoom = useCallback((delta: number, centerX: number, centerY: number) => {
    if (!transformManagerRef.current) return;
    transformManagerRef.current.zoom(delta, centerX, centerY);
  }, []);

  /**
   * Reset viewport to default position
   */
  const resetView = useCallback(() => {
    if (!transformManagerRef.current) return;
    transformManagerRef.current.setTransform({ offsetX: 0, offsetY: 0, scale: 1.0 });
    const newTransform = transformManagerRef.current.getTransform();
    setCurrentTransform(newTransform);
    onViewportChange?.(newTransform);
    debouncedSaveViewport(newTransform, 0); // Save immediately
  }, [onViewportChange, debouncedSaveViewport]);

  /**
   * Convert screen coordinates to canvas coordinates
   */
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } | null => {
      if (!transformManagerRef.current) return null;
      return transformManagerRef.current.screenToCanvas(screenX, screenY);
    },
    []
  );

  /**
   * Convert canvas coordinates to screen coordinates
   */
  const canvasToScreen = useCallback(
    (canvasX: number, canvasY: number): { x: number; y: number } | null => {
      if (!transformManagerRef.current) return null;
      return transformManagerRef.current.canvasToScreen(canvasX, canvasY);
    },
    []
  );

  /**
   * Get visible nodes within viewport bounds
   */
  const getVisibleNodes = useCallback(
    (
      nodes: Map<string, CanvasNode>,
      containerWidth: number,
      containerHeight: number
    ): CanvasNode[] => {
      if (!viewportCullerRef.current || !transformManagerRef.current) return [];

      const viewportBounds = transformManagerRef.current.getVisibleBounds(
        containerWidth,
        containerHeight,
        viewportCullerRef.current.getMargin()
      );

      if (!viewportBounds) return [];

      return viewportCullerRef.current.cullNodes(nodes, viewportBounds);
    },
    []
  );

  return {
    // State
    transform: currentTransform,
    zoom: currentTransform?.scale || 1.0,
    isAnimating,

    // Methods
    pan,
    panInstant,
    zoomIn,
    zoomOut,
    setZoom,
    resetView,
    screenToCanvas,
    canvasToScreen,
    getVisibleNodes,
    startAnimationLoop,
    applyTransformToLayers,

    // Internal refs (for compatibility)
    transformManagerRef,
    viewportCullerRef,
  };
}
