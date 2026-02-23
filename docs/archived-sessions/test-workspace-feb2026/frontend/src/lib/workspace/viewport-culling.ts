/**
 * Viewport Culling System
 *
 * Efficiently filters visible nodes and connections based on viewport bounds.
 * Uses AABB (Axis-Aligned Bounding Box) collision detection.
 *
 * Features:
 * - O(n) filtering for nodes/connections
 * - Configurable margin for smooth scrolling
 * - Separate culling for nodes and connections
 * - Z-index aware sorting
 */

import { CanvasNode, Bounds, Point } from './types';

export interface CullingConfig {
  margin: number; // Extra pixels around viewport to render
}

export const DEFAULT_CULLING_CONFIG: CullingConfig = {
  margin: 200, // 200px margin for smooth scrolling
};

/**
 * Check if point is inside bounds
 */
export function pointInBounds(point: Point, bounds: Bounds): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

/**
 * Check if two bounds intersect (AABB collision)
 */
export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/**
 * Get bounds for a node
 */
export function getNodeBounds(node: CanvasNode): Bounds {
  return {
    minX: node.position.x,
    minY: node.position.y,
    maxX: node.position.x + node.size.width,
    maxY: node.position.y + node.size.height,
  };
}

/**
 * Expand bounds by margin
 */
export function expandBounds(bounds: Bounds, margin: number): Bounds {
  return {
    minX: bounds.minX - margin,
    minY: bounds.minY - margin,
    maxX: bounds.maxX + margin,
    maxY: bounds.maxY + margin,
  };
}

/**
 * Viewport Culler
 *
 * Filters nodes and connections to only those visible in viewport
 */
export class ViewportCuller {
  private config: CullingConfig;

  constructor(config: Partial<CullingConfig> = {}) {
    this.config = { ...DEFAULT_CULLING_CONFIG, ...config };
  }

  /**
   * Filter nodes that are visible in viewport
   */
  cullNodes(nodes: Map<string, CanvasNode>, viewportBounds: Bounds): CanvasNode[] {
    const expandedBounds = expandBounds(viewportBounds, this.config.margin);
    const visible: CanvasNode[] = [];

    for (const node of nodes.values()) {
      const nodeBounds = getNodeBounds(node);
      if (boundsIntersect(nodeBounds, expandedBounds)) {
        visible.push(node);
      }
    }

    // Sort by z-index (lower first, so higher z-index renders on top)
    return visible.sort((a, b) => a.z_index - b.z_index);
  }

  /**
   * Find nodes within a selection box
   */
  getNodesInSelection(nodes: Map<string, CanvasNode>, selectionBounds: Bounds): CanvasNode[] {
    const selected: CanvasNode[] = [];

    for (const node of nodes.values()) {
      const nodeBounds = getNodeBounds(node);
      // Node must be fully contained in selection
      if (
        nodeBounds.minX >= selectionBounds.minX &&
        nodeBounds.maxX <= selectionBounds.maxX &&
        nodeBounds.minY >= selectionBounds.minY &&
        nodeBounds.maxY <= selectionBounds.maxY
      ) {
        selected.push(node);
      }
    }

    return selected;
  }

  /**
   * Get nodes with ANY overlap with selection bounds (not just full containment)
   * More intuitive for users - touching = selecting
   */
  getNodesInSelectionPartial(
    nodes: Map<string, CanvasNode>,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): CanvasNode[] {
    const selected: CanvasNode[] = [];

    for (const node of nodes.values()) {
      const nodeBounds = {
        minX: node.position.x,
        minY: node.position.y,
        maxX: node.position.x + node.size.width,
        maxY: node.position.y + node.size.height,
      };

      // Check for ANY overlap (not full containment)
      const hasOverlap = !(
        nodeBounds.maxX < minX ||
        nodeBounds.minX > maxX ||
        nodeBounds.maxY < minY ||
        nodeBounds.minY > maxY
      );

      if (hasOverlap) {
        selected.push(node);
      }
    }

    return selected;
  }

  /**
   * Find node at specific point
   */
  getNodeAtPoint(nodes: Map<string, CanvasNode>, point: Point): CanvasNode | null {
    // Search from highest z-index to lowest (reverse order)
    const sortedNodes = Array.from(nodes.values()).sort((a, b) => b.z_index - a.z_index);

    for (const node of sortedNodes) {
      const bounds = getNodeBounds(node);
      if (pointInBounds(point, bounds)) {
        return node;
      }
    }

    return null;
  }

  /**
   * Calculate bounds that contain all nodes
   */
  calculateContentBounds(nodes: Map<string, CanvasNode>): Bounds | null {
    const activeNodes = Array.from(nodes.values());

    if (activeNodes.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of activeNodes) {
      const bounds = getNodeBounds(node);
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    }

    return { minX, minY, maxX, maxY };
  }

  /**
   * Update culling config
   */
  setConfig(config: Partial<CullingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current margin
   */
  getMargin(): number {
    return this.config.margin;
  }
}

/**
 * Calculate distance from point to line segment
 */
function distanceToLineSegment(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // Line is a point
    const pdx = point.x - lineStart.x;
    const pdy = point.y - lineStart.y;
    return Math.sqrt(pdx * pdx + pdy * pdy);
  }

  // Calculate projection onto line
  const t = Math.max(
    0,
    Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared)
  );

  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  const distX = point.x - projX;
  const distY = point.y - projY;

  return Math.sqrt(distX * distX + distY * distY);
}
