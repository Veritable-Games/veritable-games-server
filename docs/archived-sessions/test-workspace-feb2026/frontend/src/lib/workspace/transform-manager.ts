/**
 * Transform Manager
 *
 * Handles viewport transformations (pan/zoom) with smooth interpolation.
 * Provides coordinate conversion between screen space and canvas space.
 *
 * Features:
 * - GPU-accelerated CSS transforms (translate3d)
 * - Smooth zoom with configurable lerp
 * - Screen-to-canvas coordinate conversion
 * - Bounds clamping for zoom levels
 */

import { ViewportTransform, Point, Bounds } from './types';

export interface TransformConfig {
  minZoom: number;
  maxZoom: number;
  zoomSpeed: number;
  lerpFactor: number; // 0-1, controls smoothness (0 = instant, 1 = never reaches target)
}

export const DEFAULT_TRANSFORM_CONFIG: TransformConfig = {
  minZoom: 0.1,
  maxZoom: 5.0,
  zoomSpeed: 0.001,
  lerpFactor: 0.2, // Increased from 0.15 for smoother, faster animations
};

export class TransformManager {
  private config: TransformConfig;
  private currentTransform: ViewportTransform;
  private targetTransform: ViewportTransform;
  private isAnimating: boolean = false;

  constructor(
    initialTransform: ViewportTransform = { offsetX: 0, offsetY: 0, scale: 1.0 },
    config: Partial<TransformConfig> = {}
  ) {
    this.config = { ...DEFAULT_TRANSFORM_CONFIG, ...config };
    this.currentTransform = { ...initialTransform };
    this.targetTransform = { ...initialTransform };
  }

  /**
   * Get current transform (for reading state)
   */
  getTransform(): ViewportTransform {
    return { ...this.currentTransform };
  }

  /**
   * Set transform directly (instant, no animation)
   */
  setTransform(transform: ViewportTransform): void {
    this.currentTransform = { ...transform };
    this.targetTransform = { ...transform };
    this.isAnimating = false;
  }

  /**
   * Pan viewport by delta (smooth animation)
   */
  pan(deltaX: number, deltaY: number): void {
    this.targetTransform.offsetX += deltaX;
    this.targetTransform.offsetY += deltaY;
    this.isAnimating = true;
  }

  /**
   * Pan viewport by delta (instant, no animation)
   * Use this for responsive user input like middle-mouse dragging
   */
  panInstant(deltaX: number, deltaY: number): void {
    this.currentTransform.offsetX += deltaX;
    this.currentTransform.offsetY += deltaY;
    this.targetTransform.offsetX = this.currentTransform.offsetX;
    this.targetTransform.offsetY = this.currentTransform.offsetY;
    this.isAnimating = false; // No animation needed
  }

  /**
   * Set pan position directly (smooth animation)
   */
  setPan(offsetX: number, offsetY: number): void {
    this.targetTransform.offsetX = offsetX;
    this.targetTransform.offsetY = offsetY;
    this.isAnimating = true;
  }

  /**
   * Zoom viewport around a specific point (smooth animation)
   * @param delta - Positive to zoom in, negative to zoom out
   * @param centerX - Screen X coordinate of zoom center
   * @param centerY - Screen Y coordinate of zoom center
   */
  zoom(delta: number, centerX: number, centerY: number): void {
    const oldScale = this.targetTransform.scale;
    const newScale = this.clampZoom(oldScale * (1 + delta * this.config.zoomSpeed));

    if (newScale === oldScale) return; // Already at min/max

    // Calculate zoom point in canvas space
    const canvasX = (centerX - this.targetTransform.offsetX) / oldScale;
    const canvasY = (centerY - this.targetTransform.offsetY) / oldScale;

    // Adjust offset to keep the zoom point stationary
    this.targetTransform.offsetX = centerX - canvasX * newScale;
    this.targetTransform.offsetY = centerY - canvasY * newScale;
    this.targetTransform.scale = newScale;
    this.isAnimating = true;
  }

  /**
   * Zoom viewport around a specific point (instant, no animation)
   * Use this for responsive user input like mouse wheel zooming
   * @param delta - Positive to zoom in, negative to zoom out
   * @param centerX - Screen X coordinate of zoom center
   * @param centerY - Screen Y coordinate of zoom center
   */
  zoomInstant(delta: number, centerX: number, centerY: number): void {
    const oldScale = this.currentTransform.scale;
    const newScale = this.clampZoom(oldScale * (1 + delta * this.config.zoomSpeed));

    if (newScale === oldScale) return; // Already at min/max

    // Calculate zoom point in canvas space
    const canvasX = (centerX - this.currentTransform.offsetX) / oldScale;
    const canvasY = (centerY - this.currentTransform.offsetY) / oldScale;

    // Adjust offset to keep the zoom point stationary
    this.currentTransform.offsetX = centerX - canvasX * newScale;
    this.currentTransform.offsetY = centerY - canvasY * newScale;
    this.currentTransform.scale = newScale;

    // Update target to match current (no animation)
    this.targetTransform.offsetX = this.currentTransform.offsetX;
    this.targetTransform.offsetY = this.currentTransform.offsetY;
    this.targetTransform.scale = this.currentTransform.scale;
    this.isAnimating = false;
  }

  /**
   * Set zoom level directly (smooth animation)
   */
  setZoom(scale: number, centerX?: number, centerY?: number): void {
    const clampedScale = this.clampZoom(scale);

    if (centerX !== undefined && centerY !== undefined) {
      // Zoom around specific point
      const oldScale = this.targetTransform.scale;
      const canvasX = (centerX - this.targetTransform.offsetX) / oldScale;
      const canvasY = (centerY - this.targetTransform.offsetY) / oldScale;

      this.targetTransform.offsetX = centerX - canvasX * clampedScale;
      this.targetTransform.offsetY = centerY - canvasY * clampedScale;
    }

    this.targetTransform.scale = clampedScale;
    this.isAnimating = true;
  }

  /**
   * Update animation frame (call in requestAnimationFrame loop)
   * @returns true if still animating, false if reached target
   */
  update(): boolean {
    if (!this.isAnimating) return false;

    const epsilon = 0.001; // Threshold for "close enough"
    let hasChanges = false;

    // Lerp toward target
    const lerpX =
      this.currentTransform.offsetX +
      (this.targetTransform.offsetX - this.currentTransform.offsetX) * this.config.lerpFactor;
    const lerpY =
      this.currentTransform.offsetY +
      (this.targetTransform.offsetY - this.currentTransform.offsetY) * this.config.lerpFactor;
    const lerpScale =
      this.currentTransform.scale +
      (this.targetTransform.scale - this.currentTransform.scale) * this.config.lerpFactor;

    // Check if we're close enough to target
    const diffX = Math.abs(lerpX - this.targetTransform.offsetX);
    const diffY = Math.abs(lerpY - this.targetTransform.offsetY);
    const diffScale = Math.abs(lerpScale - this.targetTransform.scale);

    if (diffX > epsilon || diffY > epsilon || diffScale > epsilon) {
      this.currentTransform.offsetX = lerpX;
      this.currentTransform.offsetY = lerpY;
      this.currentTransform.scale = lerpScale;
      hasChanges = true;
    } else {
      // Snap to target when close enough
      this.currentTransform = { ...this.targetTransform };
      this.isAnimating = false;
    }

    return hasChanges;
  }

  /**
   * Convert screen coordinates to canvas coordinates
   */
  screenToCanvas(screenX: number, screenY: number): Point {
    const x = (screenX - this.currentTransform.offsetX) / this.currentTransform.scale;
    const y = (screenY - this.currentTransform.offsetY) / this.currentTransform.scale;
    return { x, y };
  }

  /**
   * Convert canvas coordinates to screen coordinates
   */
  canvasToScreen(canvasX: number, canvasY: number): Point {
    const x = canvasX * this.currentTransform.scale + this.currentTransform.offsetX;
    const y = canvasY * this.currentTransform.scale + this.currentTransform.offsetY;
    return { x, y };
  }

  /**
   * Get visible canvas bounds for current viewport
   * @param screenWidth - Viewport width in pixels
   * @param screenHeight - Viewport height in pixels
   * @param margin - Extra margin in canvas units (for culling)
   */
  getVisibleBounds(screenWidth: number, screenHeight: number, margin: number = 0): Bounds {
    const topLeft = this.screenToCanvas(0, 0);
    const bottomRight = this.screenToCanvas(screenWidth, screenHeight);

    return {
      minX: topLeft.x - margin,
      minY: topLeft.y - margin,
      maxX: bottomRight.x + margin,
      maxY: bottomRight.y + margin,
    };
  }

  /**
   * Get CSS transform string for GPU-accelerated rendering
   */
  toCSSTransform(): string {
    return `translate3d(${this.currentTransform.offsetX}px, ${this.currentTransform.offsetY}px, 0) scale(${this.currentTransform.scale})`;
  }

  /**
   * Reset to default transform
   */
  reset(): void {
    this.setTransform({ offsetX: 0, offsetY: 0, scale: 1.0 });
  }

  /**
   * Frame viewport to show specific bounds
   * @param bounds - Canvas bounds to frame
   * @param screenWidth - Viewport width
   * @param screenHeight - Viewport height
   * @param padding - Padding in pixels
   */
  frameBounds(
    bounds: Bounds,
    screenWidth: number,
    screenHeight: number,
    padding: number = 50
  ): void {
    const boundsWidth = bounds.maxX - bounds.minX;
    const boundsHeight = bounds.maxY - bounds.minY;

    const availableWidth = screenWidth - padding * 2;
    const availableHeight = screenHeight - padding * 2;

    // Calculate scale to fit bounds
    const scaleX = availableWidth / boundsWidth;
    const scaleY = availableHeight / boundsHeight;
    const scale = this.clampZoom(Math.min(scaleX, scaleY));

    // Center bounds in viewport
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    this.targetTransform.scale = scale;
    this.targetTransform.offsetX = screenWidth / 2 - centerX * scale;
    this.targetTransform.offsetY = screenHeight / 2 - centerY * scale;
    this.isAnimating = true;
  }

  /**
   * Clamp zoom level to configured bounds
   */
  private clampZoom(scale: number): number {
    return Math.max(this.config.minZoom, Math.min(this.config.maxZoom, scale));
  }

  /**
   * Check if currently animating
   */
  isCurrentlyAnimating(): boolean {
    return this.isAnimating;
  }

  /**
   * Get current zoom level
   */
  getZoom(): number {
    return this.currentTransform.scale;
  }

  /**
   * Get current pan position
   */
  getPan(): { x: number; y: number } {
    return {
      x: this.currentTransform.offsetX,
      y: this.currentTransform.offsetY,
    };
  }
}
