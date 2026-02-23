/**
 * Workspace Alignment Utilities
 *
 * Provides alignment and distribution operations for canvas nodes.
 * Supports aligning 2+ selected nodes by edges or centers,
 * and distributing 3+ nodes with even spacing.
 *
 * @module alignment-utils
 */

import { CanvasNode, Point } from './types';
import { NodeId } from './branded-types';
import { calculateBoundingBox, BoundingBox } from './bounding-box-utils';
import { isNodeLocked } from './types';
import { logger } from '@/lib/utils/logger';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Types of alignment operations
 */
export type AlignmentType =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'center-horizontal'
  | 'center-vertical';

/**
 * Types of distribution operations
 */
export type DistributionType = 'horizontal' | 'vertical';

/**
 * Result of an alignment calculation for a single node
 */
export interface AlignmentResult {
  nodeId: NodeId;
  newPosition: Point;
}

/**
 * Summary of alignment operation
 */
export interface AlignmentSummary {
  totalNodes: number;
  alignedNodes: number;
  skippedNodes: number; // Locked nodes
  alignmentType: AlignmentType | DistributionType;
}

// ============================================================================
// Alignment Functions
// ============================================================================

/**
 * Calculate new positions for aligning nodes
 *
 * @param nodes - Array of nodes to align (must be 2+)
 * @param alignmentType - Type of alignment to apply
 * @returns Array of alignment results with new positions
 *
 * @example
 * ```typescript
 * const nodes = [nodeA, nodeB, nodeC];
 * const results = calculateAlignment(nodes, 'left');
 * results.forEach(({ nodeId, newPosition }) => {
 *   updateNode(nodeId, { position: newPosition });
 * });
 * ```
 */
export function calculateAlignment(
  nodes: CanvasNode[],
  alignmentType: AlignmentType
): AlignmentResult[] {
  // Filter out locked nodes
  const unlocked = nodes.filter(node => !isNodeLocked(node));

  if (unlocked.length < 2) {
    logger.warn('[calculateAlignment] Need at least 2 unlocked nodes to align');
    return [];
  }

  // Calculate bounding box for alignment reference
  const bounds = calculateBoundingBox(unlocked);
  if (!bounds) {
    logger.warn('[calculateAlignment] Could not calculate bounding box');
    return [];
  }

  logger.info(`[calculateAlignment] Aligning ${unlocked.length} nodes: ${alignmentType}`, {
    bounds,
  });

  const results: AlignmentResult[] = [];

  switch (alignmentType) {
    case 'left':
      // Align all nodes to leftmost X coordinate
      unlocked.forEach(node => {
        results.push({
          nodeId: node.id,
          newPosition: {
            x: bounds.x,
            y: node.position.y, // Keep Y unchanged
          },
        });
      });
      break;

    case 'right':
      // Align all nodes to rightmost X coordinate (right edges aligned)
      unlocked.forEach(node => {
        results.push({
          nodeId: node.id,
          newPosition: {
            x: bounds.x + bounds.width - node.size.width, // Align right edges
            y: node.position.y,
          },
        });
      });
      break;

    case 'top':
      // Align all nodes to topmost Y coordinate
      unlocked.forEach(node => {
        results.push({
          nodeId: node.id,
          newPosition: {
            x: node.position.x, // Keep X unchanged
            y: bounds.y,
          },
        });
      });
      break;

    case 'bottom':
      // Align all nodes to bottommost Y coordinate (bottom edges aligned)
      unlocked.forEach(node => {
        results.push({
          nodeId: node.id,
          newPosition: {
            x: node.position.x,
            y: bounds.y + bounds.height - node.size.height, // Align bottom edges
          },
        });
      });
      break;

    case 'center-horizontal':
      // Center all nodes horizontally within bounding box
      const centerX = bounds.x + bounds.width / 2;
      unlocked.forEach(node => {
        results.push({
          nodeId: node.id,
          newPosition: {
            x: centerX - node.size.width / 2, // Center node horizontally
            y: node.position.y,
          },
        });
      });
      break;

    case 'center-vertical':
      // Center all nodes vertically within bounding box
      const centerY = bounds.y + bounds.height / 2;
      unlocked.forEach(node => {
        results.push({
          nodeId: node.id,
          newPosition: {
            x: node.position.x,
            y: centerY - node.size.height / 2, // Center node vertically
          },
        });
      });
      break;

    default:
      logger.warn(`[calculateAlignment] Unknown alignment type: ${alignmentType}`);
      return [];
  }

  return results;
}

// ============================================================================
// Distribution Functions
// ============================================================================

/**
 * Calculate new positions for distributing nodes with even spacing
 *
 * @param nodes - Array of nodes to distribute (must be 3+)
 * @param distributionType - Type of distribution to apply
 * @returns Array of alignment results with new positions
 *
 * @example
 * ```typescript
 * const nodes = [nodeA, nodeB, nodeC, nodeD];
 * const results = calculateDistribution(nodes, 'horizontal');
 * results.forEach(({ nodeId, newPosition }) => {
 *   updateNode(nodeId, { position: newPosition });
 * });
 * ```
 */
export function calculateDistribution(
  nodes: CanvasNode[],
  distributionType: DistributionType
): AlignmentResult[] {
  // Filter out locked nodes
  const unlocked = nodes.filter(node => !isNodeLocked(node));

  if (unlocked.length < 3) {
    logger.warn('[calculateDistribution] Need at least 3 unlocked nodes to distribute');
    return [];
  }

  logger.info(`[calculateDistribution] Distributing ${unlocked.length} nodes: ${distributionType}`);

  const results: AlignmentResult[] = [];

  if (distributionType === 'horizontal') {
    // Sort nodes by X position (left to right)
    const sorted = [...unlocked].sort((a, b) => a.position.x - b.position.x);

    // Keep first and last nodes in place (anchors)
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    // Safety check (should never happen due to earlier validation)
    if (!first || !last) {
      logger.warn('[Distribution] Invalid sorted array');
      return [];
    }

    // Calculate total available space
    const totalSpace = last.position.x + last.size.width - (first.position.x + first.size.width);

    // Calculate total width of middle nodes
    const middleNodes = sorted.slice(1, -1);
    const totalMiddleWidth = middleNodes.reduce((sum, node) => sum + node.size.width, 0);

    // Calculate spacing between nodes
    const spacing =
      middleNodes.length > 0 ? (totalSpace - totalMiddleWidth) / (middleNodes.length + 1) : 0;

    // First node stays in place
    results.push({
      nodeId: first.id,
      newPosition: first.position,
    });

    // Distribute middle nodes with even spacing
    let currentX = first.position.x + first.size.width + spacing;
    middleNodes.forEach(node => {
      results.push({
        nodeId: node.id,
        newPosition: {
          x: currentX,
          y: node.position.y, // Keep Y unchanged
        },
      });
      currentX += node.size.width + spacing;
    });

    // Last node stays in place
    results.push({
      nodeId: last.id,
      newPosition: last.position,
    });
  } else if (distributionType === 'vertical') {
    // Sort nodes by Y position (top to bottom)
    const sorted = [...unlocked].sort((a, b) => a.position.y - b.position.y);

    // Keep first and last nodes in place (anchors)
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    // Safety check (should never happen due to earlier validation)
    if (!first || !last) {
      logger.warn('[Distribution] Invalid sorted array');
      return [];
    }

    // Calculate total available space
    const totalSpace = last.position.y + last.size.height - (first.position.y + first.size.height);

    // Calculate total height of middle nodes
    const middleNodes = sorted.slice(1, -1);
    const totalMiddleHeight = middleNodes.reduce((sum, node) => sum + node.size.height, 0);

    // Calculate spacing between nodes
    const spacing =
      middleNodes.length > 0 ? (totalSpace - totalMiddleHeight) / (middleNodes.length + 1) : 0;

    // First node stays in place
    results.push({
      nodeId: first.id,
      newPosition: first.position,
    });

    // Distribute middle nodes with even spacing
    let currentY = first.position.y + first.size.height + spacing;
    middleNodes.forEach(node => {
      results.push({
        nodeId: node.id,
        newPosition: {
          x: node.position.x, // Keep X unchanged
          y: currentY,
        },
      });
      currentY += node.size.height + spacing;
    });

    // Last node stays in place
    results.push({
      nodeId: last.id,
      newPosition: last.position,
    });
  }

  return results;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get alignment summary with locked node count
 *
 * @param nodes - All selected nodes (including locked)
 * @param alignmentType - Type of alignment applied
 * @returns Summary of alignment operation
 */
export function getAlignmentSummary(
  nodes: CanvasNode[],
  alignmentType: AlignmentType | DistributionType
): AlignmentSummary {
  const totalNodes = nodes.length;
  const skippedNodes = nodes.filter(isNodeLocked).length;
  const alignedNodes = totalNodes - skippedNodes;

  return {
    totalNodes,
    alignedNodes,
    skippedNodes,
    alignmentType,
  };
}

/**
 * Check if alignment operation is valid
 *
 * @param nodes - Selected nodes
 * @param alignmentType - Type of alignment
 * @returns True if operation can proceed
 */
export function canAlign(
  nodes: CanvasNode[],
  alignmentType: AlignmentType | DistributionType
): boolean {
  const unlocked = nodes.filter(node => !isNodeLocked(node));

  // Alignment requires 2+ unlocked nodes
  if (alignmentType !== 'horizontal' && alignmentType !== 'vertical' && unlocked.length < 2) {
    return false;
  }

  // Distribution requires 3+ unlocked nodes
  if ((alignmentType === 'horizontal' || alignmentType === 'vertical') && unlocked.length < 3) {
    return false;
  }

  return true;
}

/**
 * Get user-friendly alignment name
 *
 * @param alignmentType - Type of alignment
 * @returns Human-readable name
 */
export function getAlignmentName(alignmentType: AlignmentType | DistributionType): string {
  const names: Record<AlignmentType | DistributionType, string> = {
    left: 'Align Left',
    right: 'Align Right',
    top: 'Align Top',
    bottom: 'Align Bottom',
    'center-horizontal': 'Center Horizontally',
    'center-vertical': 'Center Vertically',
    horizontal: 'Distribute Horizontally',
    vertical: 'Distribute Vertically',
  };

  return names[alignmentType] || alignmentType;
}
