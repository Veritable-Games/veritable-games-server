'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseImageZoomOptions {
  minScale?: number;
  maxScale?: number;
  zoomSensitivity?: number;
  resetOnImageChange?: string | number;
  useReducedMotion?: boolean;
}

/**
 * Extended CSSProperties with webkit-specific properties
 */
interface ImageZoomStyle extends React.CSSProperties {
  WebkitUserDrag?: 'none' | 'element' | 'auto';
}

interface UseImageZoomReturn {
  scale: number;
  translateX: number;
  translateY: number;
  isDragging: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  imageRef: React.RefObject<HTMLImageElement | null>;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleDoubleClick: (e: React.MouseEvent) => void;
  handleTouchStart: (e: React.TouchEvent) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  imageStyle: ImageZoomStyle;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

export function useImageZoom({
  minScale = 1,
  maxScale = 4,
  zoomSensitivity = 0.002,
  resetOnImageChange,
  useReducedMotion = false,
}: UseImageZoomOptions = {}): UseImageZoomReturn {
  const [state, setState] = useState({
    scale: 1,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    lastTranslateX: 0,
    lastTranslateY: 0,
    initialPinchDistance: 0,
    initialPinchScale: 1,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const rafId = useRef<number | null>(null);

  // Reset zoom/pan when image changes
  useEffect(() => {
    setState({
      scale: 1,
      translateX: 0,
      translateY: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      lastTranslateX: 0,
      lastTranslateY: 0,
      initialPinchDistance: 0,
      initialPinchScale: 1,
    });
  }, [resetOnImageChange]);

  // Calculate pan boundaries to prevent whitespace
  const clampTranslate = useCallback((x: number, y: number, scale: number) => {
    // At scale 1.0 (100%), always center the image
    if (scale <= 1) {
      return { x: 0, y: 0 };
    }

    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image) return { x, y };

    const containerRect = container.getBoundingClientRect();

    // Get CSS-fitted base dimensions (accounts for object-contain + max-w/max-h constraints)
    // getBoundingClientRect() returns size AFTER CSS layout but BEFORE transform: scale()
    // This gives us the true base size that the scale transform will be applied to
    const imageRect = image.getBoundingClientRect();
    const baseWidth = imageRect.width;
    const baseHeight = imageRect.height;

    // Calculate the actual rendered dimensions at current scale
    const scaledWidth = baseWidth * scale;
    const scaledHeight = baseHeight * scale;

    // Calculate max pan offset
    // If image is larger than container, we can pan by half the difference
    // If image fits in container, no panning allowed (return 0)
    const maxPanX = Math.max(0, (scaledWidth - containerRect.width) / 2);
    const maxPanY = Math.max(0, (scaledHeight - containerRect.height) / 2);

    // Clamp to boundaries (prevents any whitespace)
    const clampedX = maxPanX === 0 ? 0 : Math.max(-maxPanX, Math.min(maxPanX, x));
    const clampedY = maxPanY === 0 ? 0 : Math.max(-maxPanY, Math.min(maxPanY, y));

    return { x: clampedX, y: clampedY };
  }, []);

  // Zoom to cursor position
  const zoomToCursor = useCallback(
    (cursorX: number, cursorY: number, delta: number) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const relativeX = cursorX - rect.left;
      const relativeY = cursorY - rect.top;

      const newScale = Math.max(minScale, Math.min(maxScale, state.scale * (1 + delta)));

      // If zooming to 1.0 or less, center the image
      if (newScale <= 1) {
        setState(prev => ({
          ...prev,
          scale: 1,
          translateX: 0,
          translateY: 0,
        }));
        return;
      }

      // Calculate zoom origin (point under cursor in image space)
      const imageX = (relativeX - state.translateX) / state.scale;
      const imageY = (relativeY - state.translateY) / state.scale;

      // Calculate new translation to keep cursor point fixed
      const newTranslateX = relativeX - imageX * newScale;
      const newTranslateY = relativeY - imageY * newScale;

      // Clamp to boundaries (prevents whitespace)
      const clamped = clampTranslate(newTranslateX, newTranslateY, newScale);

      setState(prev => ({
        ...prev,
        scale: newScale,
        translateX: clamped.x,
        translateY: clamped.y,
      }));
    },
    [state.scale, state.translateX, state.translateY, minScale, maxScale, clampTranslate]
  );

  // Wheel zoom handler (attached via useEffect)
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // Only zoom if scale > minScale or zooming in
      if (state.scale <= minScale && e.deltaY > 0) return;

      e.preventDefault();
      e.stopPropagation();

      const delta = -e.deltaY * zoomSensitivity;
      zoomToCursor(e.clientX, e.clientY, delta);
    },
    [state.scale, minScale, zoomSensitivity, zoomToCursor]
  );

  // Attach wheel event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Mouse pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (state.scale <= 1) return; // Only pan when zoomed

      e.preventDefault();
      setState(prev => ({
        ...prev,
        isDragging: true,
        dragStartX: e.clientX,
        dragStartY: e.clientY,
        lastTranslateX: prev.translateX,
        lastTranslateY: prev.translateY,
      }));
    },
    [state.scale]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!state.isDragging) return;

      // Cancel previous RAF
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }

      // Use RAF for smooth rendering
      rafId.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - state.dragStartX;
        const deltaY = e.clientY - state.dragStartY;

        const newX = state.lastTranslateX + deltaX;
        const newY = state.lastTranslateY + deltaY;

        const clamped = clampTranslate(newX, newY, state.scale);

        setState(prev => ({
          ...prev,
          translateX: clamped.x,
          translateY: clamped.y,
        }));

        rafId.current = null;
      });
    },
    [
      state.isDragging,
      state.dragStartX,
      state.dragStartY,
      state.lastTranslateX,
      state.lastTranslateY,
      state.scale,
      clampTranslate,
    ]
  );

  const handleMouseUp = useCallback(() => {
    if (!state.isDragging) return;

    setState(prev => ({
      ...prev,
      isDragging: false,
    }));
  }, [state.isDragging]);

  // Attach global mouse event listeners for pan
  useEffect(() => {
    if (state.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [state.isDragging, handleMouseMove, handleMouseUp]);

  // Touch pan handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1 && state.scale > 1) {
        // Single finger pan (only when zoomed)
        const touch = e.touches[0]!;
        setState(prev => ({
          ...prev,
          isDragging: true,
          dragStartX: touch.clientX,
          dragStartY: touch.clientY,
          lastTranslateX: prev.translateX,
          lastTranslateY: prev.translateY,
        }));
      } else if (e.touches.length === 2) {
        // Two finger pinch zoom
        const touch1 = e.touches[0]!;
        const touch2 = e.touches[1]!;

        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );

        setState(prev => ({
          ...prev,
          initialPinchDistance: distance,
          initialPinchScale: prev.scale,
        }));
      }
    },
    [state.scale]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length === 2 && state.initialPinchDistance > 0) {
        // Pinch zoom
        e.preventDefault();

        const touch1 = e.touches[0]!;
        const touch2 = e.touches[1]!;

        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );

        const scaleChange = distance / state.initialPinchDistance;
        const newScale = Math.max(
          minScale,
          Math.min(maxScale, state.initialPinchScale * scaleChange)
        );

        setState(prev => ({ ...prev, scale: newScale }));
      } else if (e.touches.length === 1 && state.isDragging) {
        // Single finger pan
        e.preventDefault();

        const touch = e.touches[0]!;
        const deltaX = touch.clientX - state.dragStartX;
        const deltaY = touch.clientY - state.dragStartY;

        const newX = state.lastTranslateX + deltaX;
        const newY = state.lastTranslateY + deltaY;

        const clamped = clampTranslate(newX, newY, state.scale);

        setState(prev => ({
          ...prev,
          translateX: clamped.x,
          translateY: clamped.y,
        }));
      }
    },
    [
      state.initialPinchDistance,
      state.initialPinchScale,
      state.isDragging,
      state.dragStartX,
      state.dragStartY,
      state.lastTranslateX,
      state.lastTranslateY,
      state.scale,
      minScale,
      maxScale,
      clampTranslate,
    ]
  );

  const handleTouchEnd = useCallback(() => {
    setState(prev => ({
      ...prev,
      isDragging: false,
      initialPinchDistance: 0,
    }));
  }, []);

  // Attach global touch listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchMove, handleTouchEnd]);

  // Double-click zoom toggle
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      if (state.scale === 1) {
        // Zoom to 2x at cursor position
        zoomToCursor(e.clientX, e.clientY, 1); // 100% increase = 2x zoom
      } else {
        // Reset to 1x
        setState(prev => ({
          ...prev,
          scale: 1,
          translateX: 0,
          translateY: 0,
        }));
      }
    },
    [state.scale, zoomToCursor]
  );

  // Manual zoom controls
  const zoomIn = useCallback(() => {
    const newScale = Math.min(state.scale + 0.25, maxScale);

    // If zooming to 1.0 or less, center the image
    if (newScale <= 1) {
      setState(prev => ({
        ...prev,
        scale: 1,
        translateX: 0,
        translateY: 0,
      }));
      return;
    }

    // Maintain current center point, just increase scale
    const clamped = clampTranslate(state.translateX, state.translateY, newScale);

    setState(prev => ({
      ...prev,
      scale: newScale,
      translateX: clamped.x,
      translateY: clamped.y,
    }));
  }, [state.scale, state.translateX, state.translateY, maxScale, clampTranslate]);

  const zoomOut = useCallback(() => {
    const newScale = Math.max(state.scale - 0.25, minScale);

    // If zooming to 1.0 or less, center the image
    if (newScale <= 1) {
      setState(prev => ({
        ...prev,
        scale: 1,
        translateX: 0,
        translateY: 0,
      }));
      return;
    }

    // Maintain current center point, just decrease scale
    const clamped = clampTranslate(state.translateX, state.translateY, newScale);

    setState(prev => ({
      ...prev,
      scale: newScale,
      translateX: clamped.x,
      translateY: clamped.y,
    }));
  }, [state.scale, state.translateX, state.translateY, minScale, clampTranslate]);

  const resetZoom = useCallback(() => {
    setState(prev => ({
      ...prev,
      scale: 1,
      translateX: 0,
      translateY: 0,
    }));
  }, []);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  // Determine cursor style
  const getCursor = () => {
    if (state.isDragging) return 'grabbing';
    if (state.scale > 1) return 'grab';
    return 'default';
  };

  // Image transform style
  const imageStyle: ImageZoomStyle = {
    transform: `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`,
    transformOrigin: 'center center', // Scale from center for intuitive zoom behavior
    willChange: state.isDragging ? 'transform' : 'auto',
    transition: useReducedMotion ? 'none' : state.isDragging ? 'none' : 'transform 150ms ease-out',
    cursor: getCursor(),
    userSelect: 'none',
    WebkitUserDrag: 'none',
  };

  return {
    scale: state.scale,
    translateX: state.translateX,
    translateY: state.translateY,
    isDragging: state.isDragging,
    containerRef,
    imageRef,
    handleMouseDown,
    handleDoubleClick,
    handleTouchStart,
    zoomIn,
    zoomOut,
    resetZoom,
    imageStyle,
    canZoomIn: state.scale < maxScale,
    canZoomOut: state.scale > minScale,
  };
}
