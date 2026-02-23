/**
 * Bounding Box Utilities
 *
 * Utilities for calculating and working with selection bounding boxes.
 * Used for multi-select visualization and group drag operations.
 */

import type { CanvasNode } from './types';

/**
 * Bounding box rectangle
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Point in 2D space
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Calculate bounding box that encompasses all selected nodes
 *
 * @param nodes - Array of selected nodes
 * @param padding - Padding around the outer bounds (default: 8px)
 * @returns Bounding box rectangle, or null if no nodes
 */
export function calculateBoundingBox(nodes: CanvasNode[], padding: number = 8): BoundingBox | null {
  if (nodes.length === 0) {
    return null;
  }

  // Find min/max bounds of all nodes
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach(node => {
    const nodeMinX = node.position.x;
    const nodeMinY = node.position.y;
    const nodeMaxX = node.position.x + node.size.width;
    const nodeMaxY = node.position.y + node.size.height;

    minX = Math.min(minX, nodeMinX);
    minY = Math.min(minY, nodeMinY);
    maxX = Math.max(maxX, nodeMaxX);
    maxY = Math.max(maxY, nodeMaxY);
  });

  // Apply padding
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

/**
 * Check if a point is inside a bounding box
 *
 * @param point - Point to test (in canvas coordinates)
 * @param boundingBox - Bounding box to test against
 * @param margin - Extra margin for easier clicking (default: 0)
 * @returns True if point is inside bounding box
 */
export function isPointInBoundingBox(
  point: Point,
  boundingBox: BoundingBox,
  margin: number = 0
): boolean {
  return (
    point.x >= boundingBox.x - margin &&
    point.x <= boundingBox.x + boundingBox.width + margin &&
    point.y >= boundingBox.y - margin &&
    point.y <= boundingBox.y + boundingBox.height + margin
  );
}

/**
 * Check if a point is on the bounding box border (for future resize handles)
 *
 * @param point - Point to test (in canvas coordinates)
 * @param boundingBox - Bounding box to test against
 * @param borderWidth - Width of the border hit area (default: 8px)
 * @returns True if point is on the border
 */
export function isPointOnBoundingBoxBorder(
  point: Point,
  boundingBox: BoundingBox,
  borderWidth: number = 8
): boolean {
  const inside = isPointInBoundingBox(point, boundingBox, 0);
  const outsideInner = !isPointInBoundingBox(point, boundingBox, -borderWidth);
  return inside && outsideInner;
}

/**
 * Get the center point of a bounding box
 *
 * @param boundingBox - Bounding box to get center of
 * @returns Center point in canvas coordinates
 */
export function getBoundingBoxCenter(boundingBox: BoundingBox): Point {
  return {
    x: boundingBox.x + boundingBox.width / 2,
    y: boundingBox.y + boundingBox.height / 2,
  };
}

/**
 * Check if two bounding boxes intersect
 *
 * @param box1 - First bounding box
 * @param box2 - Second bounding box
 * @returns True if boxes intersect
 */
export function doBoundingBoxesIntersect(box1: BoundingBox, box2: BoundingBox): boolean {
  return (
    box1.x < box2.x + box2.width &&
    box1.x + box1.width > box2.x &&
    box1.y < box2.y + box2.height &&
    box1.y + box1.height > box2.y
  );
}
