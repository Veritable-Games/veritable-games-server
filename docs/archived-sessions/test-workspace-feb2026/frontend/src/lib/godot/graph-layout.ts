/**
 * Force-Directed 3D Graph Layout Engine
 *
 * Uses physics-based simulation to arrange graph nodes in 3D space
 * with meaningful spatial relationships based on dependencies.
 *
 * Inspired by stellar mechanics and adapted for dependency graphs.
 */

import { GraphNode, GraphEdge } from './parser-service';
import { logger } from '@/lib/utils/logger';

export interface LayoutConfig {
  /** Initial distribution sphere radius (default: 8) */
  sphereRadius: number;

  /** Attraction strength for connected nodes (default: 0.02) */
  attractionStrength: number;

  /** Repulsion strength for all nodes (default: 1.0) */
  repulsionStrength: number;

  /** Centering force to prevent drift (default: 0.01) */
  centeringForce: number;

  /** Number of iterations for convergence (default: 300) */
  iterations: number;

  /** Velocity decay factor (default: 0.9) */
  damping: number;

  /** Movement threshold for convergence detection (default: 0.01) */
  minMovement: number;
}

interface NodeWithVelocity extends GraphNode {
  velocity?: { x: number; y: number; z: number };
}

interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Compute force-directed 3D layout for a graph
 *
 * @param nodes - Array of graph nodes without positions
 * @param edges - Array of edges connecting nodes
 * @param config - Layout configuration parameters
 * @returns Array of positioned nodes with x, y, z coordinates
 */
export function computeForceDirectedLayout3D(
  nodes: GraphNode[],
  edges: GraphEdge[],
  config: LayoutConfig
): GraphNode[] {
  // Handle edge cases
  if (nodes.length === 0) return [];
  if (nodes.length === 1) {
    const node = nodes[0]!;
    const singleNode: GraphNode = {
      id: node.id,
      label: node.label,
      type: node.type,
      metadata: node.metadata,
      position: { x: 0, y: 0, z: 0 },
    };
    return [singleNode];
  }

  // Step 1: Initialize with spherical distribution
  const workingNodes: NodeWithVelocity[] = nodes.map((node, index) => {
    // Uniform spherical distribution using theta and phi
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    // Virtual (built-in) nodes positioned in outer ring, regular nodes in inner sphere
    const isVirtual = node.metadata?.isVirtual === true;
    const r = isVirtual ? config.sphereRadius * 1.5 : config.sphereRadius;

    const newNode: NodeWithVelocity = {
      ...node,
      position: {
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi),
      },
      velocity: { x: 0, y: 0, z: 0 },
    };

    return newNode;
  });

  // Step 2: Build adjacency map for fast connection lookup
  const adjacencyMap = new Map<string, Set<string>>();
  const edgeWeightMap = new Map<string, number>();

  edges.forEach(edge => {
    const key = `${edge.from}-${edge.to}`;
    if (!adjacencyMap.has(edge.from)) {
      adjacencyMap.set(edge.from, new Set());
    }
    adjacencyMap.get(edge.from)!.add(edge.to);
    edgeWeightMap.set(key, edge.weight || 1);
  });

  // Step 3: Iterative force simulation
  for (let iteration = 0; iteration < config.iterations; iteration++) {
    let totalMovement = 0;

    workingNodes.forEach(nodeA => {
      let forceX = 0;
      let forceY = 0;
      let forceZ = 0;

      // Force 1: Repulsion from ALL nodes (Coulomb-like: F = k/r²)
      workingNodes.forEach(nodeB => {
        if (nodeA.id === nodeB.id || !nodeA.position || !nodeB.position) return;

        const dx = nodeA.position.x - nodeB.position.x;
        const dy = nodeA.position.y - nodeB.position.y;
        const dz = nodeA.position.z - nodeB.position.z;
        const distSq = dx * dx + dy * dy + dz * dz + 0.01; // Epsilon to prevent division by 0
        const dist = Math.sqrt(distSq);

        // Repulsion force magnitude: F = k / r²
        const repulsion = config.repulsionStrength / distSq;
        const forceScale = repulsion / dist;

        forceX += dx * forceScale;
        forceY += dy * forceScale;
        forceZ += dz * forceScale;
      });

      // Force 2: Attraction to CONNECTED nodes (Spring-like: F = k*r)
      const connectedNodeIds = adjacencyMap.get(nodeA.id) || new Set();
      connectedNodeIds.forEach(connectedId => {
        const nodeB = workingNodes.find(n => n.id === connectedId);
        if (!nodeB || !nodeA.position || !nodeB.position) return;

        const dx = nodeB.position.x - nodeA.position.x;
        const dy = nodeB.position.y - nodeA.position.y;
        const dz = nodeB.position.z - nodeA.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        const dist = Math.sqrt(distSq) + 0.01;

        // Attraction force: F = k * r (Hooke's law)
        const edgeKey = `${nodeA.id}-${connectedId}`;
        const edgeWeight = edgeWeightMap.get(edgeKey) || 1;
        const attraction = config.attractionStrength * edgeWeight * dist;
        const forceScale = attraction / dist;

        forceX += (dx / dist) * attraction;
        forceY += (dy / dist) * attraction;
        forceZ += (dz / dist) * attraction;
      });

      // Force 3: Centering force to prevent drift
      if (nodeA.position) {
        forceX -= nodeA.position.x * config.centeringForce;
        forceY -= nodeA.position.y * config.centeringForce;
        forceZ -= nodeA.position.z * config.centeringForce;
      }

      // Update velocity with damping
      if (!nodeA.velocity) nodeA.velocity = { x: 0, y: 0, z: 0 };
      nodeA.velocity.x = (nodeA.velocity.x + forceX) * config.damping;
      nodeA.velocity.y = (nodeA.velocity.y + forceY) * config.damping;
      nodeA.velocity.z = (nodeA.velocity.z + forceZ) * config.damping;

      // Update position
      if (nodeA.position) {
        nodeA.position.x += nodeA.velocity.x;
        nodeA.position.y += nodeA.velocity.y;
        nodeA.position.z += nodeA.velocity.z;
      }

      // Track movement for convergence detection
      totalMovement +=
        Math.abs(nodeA.velocity.x) + Math.abs(nodeA.velocity.y) + Math.abs(nodeA.velocity.z);
    });

    // Early termination if converged
    if (totalMovement < config.minMovement * workingNodes.length) {
      logger.info(`[Graph Layout] Converged at iteration ${iteration}/${config.iterations}`);
      break;
    }

    // Progress logging for large graphs
    if (workingNodes.length > 100 && iteration % 50 === 0) {
      logger.info(
        `[Graph Layout] Iteration ${iteration}/${config.iterations}, movement: ${totalMovement.toFixed(2)}`
      );
    }
  }

  // Step 4: Clean up and return positioned nodes
  return workingNodes.map(node => {
    const cleanedNode = { ...node };
    delete cleanedNode.velocity;
    return cleanedNode as GraphNode;
  });
}

/**
 * Calculate Euclidean distance between two 3D points
 * Used for testing and verification
 */
export function distance3D(a: Position3D, b: Position3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Get default layout configuration
 * Balanced for typical dependency graphs
 */
export function getDefaultLayoutConfig(): LayoutConfig {
  return {
    sphereRadius: 8,
    attractionStrength: 0.02,
    repulsionStrength: 1.0,
    centeringForce: 0.01,
    iterations: 300,
    damping: 0.9,
    minMovement: 0.01,
  };
}

/**
 * Get layout configuration for dense graphs (100+ nodes)
 */
export function getDenseGraphLayoutConfig(): LayoutConfig {
  return {
    sphereRadius: 12,
    attractionStrength: 0.015,
    repulsionStrength: 1.2,
    centeringForce: 0.008,
    iterations: 250,
    damping: 0.92,
    minMovement: 0.015,
  };
}

/**
 * Get layout configuration for sparse graphs (<20 nodes)
 */
export function getSparseGraphLayoutConfig(): LayoutConfig {
  return {
    sphereRadius: 6,
    attractionStrength: 0.03,
    repulsionStrength: 0.8,
    centeringForce: 0.015,
    iterations: 350,
    damping: 0.88,
    minMovement: 0.008,
  };
}

/**
 * Select appropriate layout config based on node count
 */
export function selectLayoutConfig(nodeCount: number): LayoutConfig {
  if (nodeCount < 20) {
    return getSparseGraphLayoutConfig();
  } else if (nodeCount > 100) {
    return getDenseGraphLayoutConfig();
  } else {
    return getDefaultLayoutConfig();
  }
}
