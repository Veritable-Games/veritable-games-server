/**
 * Connection Utilities
 *
 * Helper functions for connection calculations:
 * - Anchor position calculations
 * - SVG path generation for arrows
 * - Connection validation
 */

import { CanvasNode, Connection, ConnectionAnchor, AnchorSide, Point } from './types';

// ============================================================================
// Anchor Position Calculations
// ============================================================================

/**
 * Calculate the absolute position of an anchor point on a node
 * @param node - The canvas node
 * @param anchor - The anchor configuration (side + offset)
 * @returns Absolute position in canvas coordinates
 */
export function calculateAnchorPosition(node: CanvasNode, anchor: ConnectionAnchor): Point {
  const { position, size } = node;
  const { side, offset } = anchor;

  switch (side) {
    case 'top':
      return {
        x: position.x + size.width * offset,
        y: position.y,
      };

    case 'right':
      return {
        x: position.x + size.width,
        y: position.y + size.height * offset,
      };

    case 'bottom':
      return {
        x: position.x + size.width * offset,
        y: position.y + size.height,
      };

    case 'left':
      return {
        x: position.x,
        y: position.y + size.height * offset,
      };

    case 'center':
      return {
        x: position.x + size.width / 2,
        y: position.y + size.height / 2,
      };

    default:
      // Fallback to center
      return {
        x: position.x + size.width / 2,
        y: position.y + size.height / 2,
      };
  }
}

/**
 * Get the optimal anchor side for connecting from source to target
 * Chooses the side that minimizes distance
 */
export function getOptimalAnchorSide(
  sourceNode: CanvasNode,
  targetNode: CanvasNode,
  isSource: boolean
): AnchorSide {
  const sourceCenterX = sourceNode.position.x + sourceNode.size.width / 2;
  const sourceCenterY = sourceNode.position.y + sourceNode.size.height / 2;
  const targetCenterX = targetNode.position.x + targetNode.size.width / 2;
  const targetCenterY = targetNode.position.y + targetNode.size.height / 2;

  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;

  if (isSource) {
    // For source node, choose side facing target
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    } else {
      return dy > 0 ? 'bottom' : 'top';
    }
  } else {
    // For target node, choose side facing source
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'left' : 'right';
    } else {
      return dy > 0 ? 'top' : 'bottom';
    }
  }
}

/**
 * Get the normal direction vector for an anchor side
 * Used for arrow head orientation
 */
export function getAnchorNormal(side: AnchorSide): Point {
  switch (side) {
    case 'top':
      return { x: 0, y: -1 };
    case 'right':
      return { x: 1, y: 0 };
    case 'bottom':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'center':
      return { x: 0, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

// ============================================================================
// SVG Path Generation
// ============================================================================

/**
 * Generate an SVG path for a connection arrow
 * Uses cubic bezier curves for smooth, organic-looking connections
 *
 * @param start - Start point (source anchor)
 * @param end - End point (target anchor)
 * @param startSide - Source anchor side (for control point calculation)
 * @param endSide - Target anchor side (for control point calculation)
 * @returns SVG path string
 */
export function generateConnectionPath(
  start: Point,
  end: Point,
  startSide: AnchorSide,
  endSide: AnchorSide
): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Control point distance (proportional to line length)
  // Minimum 50px, maximum 200px
  const controlDistance = Math.min(200, Math.max(50, distance * 0.4));

  // Calculate control points based on anchor sides
  const startNormal = getAnchorNormal(startSide);
  const endNormal = getAnchorNormal(endSide);

  const cp1 = {
    x: start.x + startNormal.x * controlDistance,
    y: start.y + startNormal.y * controlDistance,
  };

  const cp2 = {
    x: end.x + endNormal.x * controlDistance,
    y: end.y + endNormal.y * controlDistance,
  };

  // Generate cubic bezier path
  return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
}

/**
 * Generate a simplified straight line path (for debugging or performance)
 */
export function generateStraightPath(start: Point, end: Point): string {
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

/**
 * Calculate the angle of the arrow at the target point
 * Used for arrow head rotation
 */
export function calculateArrowAngle(start: Point, end: Point, endSide: AnchorSide): number {
  // Use anchor normal for primary direction
  const normal = getAnchorNormal(endSide);

  // If center anchor, calculate from vector
  if (endSide === 'center') {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }

  return Math.atan2(normal.y, normal.x) * (180 / Math.PI);
}

// ============================================================================
// Connection Validation
// ============================================================================

/**
 * Validate that a connection is valid
 * Checks for self-connections and ensures nodes exist
 */
export function validateConnection(
  sourceNodeId: string,
  targetNodeId: string,
  nodes: Map<string, CanvasNode>
): { valid: boolean; error?: string } {
  // Check for self-connection
  if (sourceNodeId === targetNodeId) {
    return {
      valid: false,
      error: 'Cannot connect a node to itself',
    };
  }

  // Check source node exists
  if (!nodes.has(sourceNodeId)) {
    return {
      valid: false,
      error: `Source node ${sourceNodeId} not found`,
    };
  }

  // Check target node exists
  if (!nodes.has(targetNodeId)) {
    return {
      valid: false,
      error: `Target node ${targetNodeId} not found`,
    };
  }

  return { valid: true };
}

/**
 * Check if a connection already exists between two nodes
 */
export function connectionExists(
  sourceNodeId: string,
  targetNodeId: string,
  connections: Map<string, Connection>
): boolean {
  return Array.from(connections.values()).some(
    conn =>
      (conn.source_node_id === sourceNodeId && conn.target_node_id === targetNodeId) ||
      (conn.source_node_id === targetNodeId && conn.target_node_id === sourceNodeId)
  );
}

// ============================================================================
// Geometric Utilities
// ============================================================================

/**
 * Calculate distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if a point is near a line (for click detection)
 * @param point - Point to test
 * @param lineStart - Line start point
 * @param lineEnd - Line end point
 * @param threshold - Maximum distance to consider "near" (default 10px)
 */
export function isPointNearLine(
  point: Point,
  lineStart: Point,
  lineEnd: Point,
  threshold: number = 10
): boolean {
  // Calculate distance from point to line segment
  const lineLengthSq = (lineEnd.x - lineStart.x) ** 2 + (lineEnd.y - lineStart.y) ** 2;

  if (lineLengthSq === 0) {
    return distance(point, lineStart) <= threshold;
  }

  // Project point onto line
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - lineStart.x) * (lineEnd.x - lineStart.x) +
        (point.y - lineStart.y) * (lineEnd.y - lineStart.y)) /
        lineLengthSq
    )
  );

  const projection = {
    x: lineStart.x + t * (lineEnd.x - lineStart.x),
    y: lineStart.y + t * (lineEnd.y - lineStart.y),
  };

  return distance(point, projection) <= threshold;
}

/**
 * Get the midpoint of a connection (for label placement)
 */
export function getConnectionMidpoint(start: Point, end: Point): Point {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}
