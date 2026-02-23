import * as THREE from 'three';

/**
 * Optimized Graph Renderer for Three.js
 *
 * Performance optimizations:
 * - InstancedMesh for nodes (149 nodes → 1 draw call)
 * - LineSegments batching for edges (2,468 edges → ~4 draw calls)
 * - Frustum culling for viewport optimization
 * - LOD for labels (hide when zoomed out)
 * - Reduced geometry complexity (12×12 spheres instead of 32×32)
 */

export interface GraphNode {
  id: string;
  name: string;
  path: string;
  type: 'script' | 'virtual';
  position: THREE.Vector3;
  color?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'extends' | 'preload' | 'load';
}

export interface NodeColorState {
  isActive: boolean;
  isConnected: boolean;
  isFiltered: boolean;
  isSearchMatch: boolean;
  isHovered: boolean;
}

// Edge type colors
const EDGE_COLORS = {
  extends: 0xfbbf24, // Yellow
  preload: 0x10b981, // Green
  load: 0x6366f1, // Indigo
};

// Node state colors
const NODE_COLORS = {
  active: 0xef4444, // Red
  connected: 0x22c55e, // Green
  filtered: 0x3b82f6, // Blue
  searchMatch: 0xfbbf24, // Yellow
  hovered: 0xa855f7, // Purple
  default: 0x3b82f6, // Blue
  virtual: 0x9ca3af, // Gray
};

/**
 * Create an InstancedMesh for all graph nodes
 * Reduces draw calls from N to 1
 */
export function createInstancedNodes(
  nodes: GraphNode[],
  options: {
    regularRadius?: number;
    virtualRadius?: number;
    segments?: number;
  } = {}
): {
  instancedMesh: THREE.InstancedMesh;
  nodeIndexMap: Map<string, number>;
  updateNodeColor: (nodeId: string, color: number) => void;
  updateNodeScale: (nodeId: string, scale: number) => void;
  updateAllNodeColors: (colorFn: (node: GraphNode) => number) => void;
} {
  const { regularRadius = 0.3, virtualRadius = 0.15, segments = 12 } = options;

  // Use a single geometry for all nodes (reduced complexity: 12×12 instead of 32×32)
  const geometry = new THREE.SphereGeometry(regularRadius, segments, segments);
  const material = new THREE.MeshPhongMaterial({
    vertexColors: false,
    flatShading: false,
  });

  const instancedMesh = new THREE.InstancedMesh(geometry, material, nodes.length);
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // Create instance color buffer
  const colors = new Float32Array(nodes.length * 3);
  instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  instancedMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

  const nodeIndexMap = new Map<string, number>();
  const tempMatrix = new THREE.Matrix4();
  const tempColor = new THREE.Color();

  // Initialize all instances
  nodes.forEach((node, index) => {
    nodeIndexMap.set(node.id, index);

    // Set position
    tempMatrix.makeTranslation(node.position.x, node.position.y, node.position.z);

    // Scale virtual nodes smaller
    if (node.type === 'virtual') {
      const scale = virtualRadius / regularRadius;
      tempMatrix.scale(new THREE.Vector3(scale, scale, scale));
    }

    instancedMesh.setMatrixAt(index, tempMatrix);

    // Set initial color
    const color = node.type === 'virtual' ? NODE_COLORS.virtual : NODE_COLORS.default;
    tempColor.setHex(color);
    instancedMesh.setColorAt(index, tempColor);
  });

  instancedMesh.instanceMatrix.needsUpdate = true;
  if (instancedMesh.instanceColor) {
    instancedMesh.instanceColor.needsUpdate = true;
  }

  // Helper function to update a single node's color
  const updateNodeColor = (nodeId: string, color: number) => {
    const index = nodeIndexMap.get(nodeId);
    if (index !== undefined) {
      tempColor.setHex(color);
      instancedMesh.setColorAt(index, tempColor);
      if (instancedMesh.instanceColor) {
        instancedMesh.instanceColor.needsUpdate = true;
      }
    }
  };

  // Helper function to update a single node's scale
  const updateNodeScale = (nodeId: string, scale: number) => {
    const index = nodeIndexMap.get(nodeId);
    if (index !== undefined) {
      const node = nodes[index];
      if (node) {
        tempMatrix.makeTranslation(node.position.x, node.position.y, node.position.z);
        tempMatrix.scale(new THREE.Vector3(scale, scale, scale));
        instancedMesh.setMatrixAt(index, tempMatrix);
        instancedMesh.instanceMatrix.needsUpdate = true;
      }
    }
  };

  // Helper to batch update all node colors
  const updateAllNodeColors = (colorFn: (node: GraphNode) => number) => {
    nodes.forEach((node, index) => {
      tempColor.setHex(colorFn(node));
      instancedMesh.setColorAt(index, tempColor);
    });
    if (instancedMesh.instanceColor) {
      instancedMesh.instanceColor.needsUpdate = true;
    }
  };

  return {
    instancedMesh,
    nodeIndexMap,
    updateNodeColor,
    updateNodeScale,
    updateAllNodeColors,
  };
}

/**
 * Create batched LineSegments for all edges grouped by type
 * Reduces draw calls from N to ~4 (one per edge type + one for arrows)
 */
export function createBatchedEdges(
  edges: GraphEdge[],
  nodePositions: Map<string, THREE.Vector3>
): {
  lineSegments: Map<string, THREE.LineSegments>;
  arrowInstances: THREE.InstancedMesh;
  edgeIndexMap: Map<string, { type: string; lineIndex: number; arrowIndex: number }>;
  updateEdgeVisibility: (type: string, visible: boolean) => void;
  updateEdgeOpacity: (type: string, opacity: number) => void;
} {
  // Group edges by type
  const edgesByType: Record<string, GraphEdge[]> = {
    extends: [],
    preload: [],
    load: [],
  };

  edges.forEach(edge => {
    const typeArray = edgesByType[edge.type];
    if (typeArray) {
      typeArray.push(edge);
    }
  });

  const lineSegments = new Map<string, THREE.LineSegments>();
  const edgeIndexMap = new Map<string, { type: string; lineIndex: number; arrowIndex: number }>();

  // Track total arrows needed
  let totalArrows = 0;

  // Create batched line segments for each edge type
  Object.entries(edgesByType).forEach(([type, typeEdges]) => {
    if (typeEdges.length === 0) return;

    const positions: number[] = [];

    typeEdges.forEach((edge, index) => {
      const fromPos = nodePositions.get(edge.from);
      const toPos = nodePositions.get(edge.to);

      if (fromPos && toPos) {
        // Add line segment vertices (from → to)
        positions.push(fromPos.x, fromPos.y, fromPos.z);
        positions.push(toPos.x, toPos.y, toPos.z);

        // Track edge index for later updates
        edgeIndexMap.set(`${edge.from}-${edge.to}`, {
          type,
          lineIndex: index * 2, // Each edge uses 2 vertices
          arrowIndex: totalArrows + index,
        });
      }
    });

    totalArrows += typeEdges.length;

    if (positions.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

      const material = new THREE.LineBasicMaterial({
        color: EDGE_COLORS[type as keyof typeof EDGE_COLORS],
        opacity: type === 'extends' ? 0.8 : 0.5,
        transparent: true,
      });

      const lines = new THREE.LineSegments(geometry, material);
      lines.userData = { edgeType: type };
      lineSegments.set(type, lines);
    }
  });

  // Create instanced arrows for all edges
  const arrowGeometry = new THREE.ConeGeometry(0.08, 0.16, 6);
  const arrowMaterial = new THREE.MeshBasicMaterial({ vertexColors: false });
  const arrowInstances = new THREE.InstancedMesh(arrowGeometry, arrowMaterial, totalArrows);

  // Create instance color buffer for arrows
  const arrowColors = new Float32Array(totalArrows * 3);
  arrowInstances.instanceColor = new THREE.InstancedBufferAttribute(arrowColors, 3);

  const tempMatrix = new THREE.Matrix4();
  const tempColor = new THREE.Color();
  const direction = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  let arrowIndex = 0;
  Object.entries(edgesByType).forEach(([type, typeEdges]) => {
    typeEdges.forEach(edge => {
      const fromPos = nodePositions.get(edge.from);
      const toPos = nodePositions.get(edge.to);

      if (fromPos && toPos) {
        // Calculate arrow position (75% along the line)
        direction.subVectors(toPos, fromPos);
        const arrowPos = fromPos.clone().add(direction.clone().multiplyScalar(0.75));

        // Create rotation matrix to orient arrow
        direction.normalize();
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(up, direction);

        tempMatrix.makeRotationFromQuaternion(quaternion);
        tempMatrix.setPosition(arrowPos.x, arrowPos.y, arrowPos.z);

        arrowInstances.setMatrixAt(arrowIndex, tempMatrix);

        // Set arrow color based on edge type
        tempColor.setHex(EDGE_COLORS[type as keyof typeof EDGE_COLORS]);
        arrowInstances.setColorAt(arrowIndex, tempColor);

        arrowIndex++;
      }
    });
  });

  arrowInstances.instanceMatrix.needsUpdate = true;
  if (arrowInstances.instanceColor) {
    arrowInstances.instanceColor.needsUpdate = true;
  }

  // Helper to update edge visibility by type
  const updateEdgeVisibility = (type: string, visible: boolean) => {
    const lines = lineSegments.get(type);
    if (lines) {
      lines.visible = visible;
    }
  };

  // Helper to update edge opacity by type
  const updateEdgeOpacity = (type: string, opacity: number) => {
    const lines = lineSegments.get(type);
    if (lines) {
      (lines.material as THREE.LineBasicMaterial).opacity = opacity;
    }
  };

  return {
    lineSegments,
    arrowInstances,
    edgeIndexMap,
    updateEdgeVisibility,
    updateEdgeOpacity,
  };
}

/**
 * Create a frustum culler for viewport optimization
 */
export function createFrustumCuller(camera: THREE.Camera): {
  frustum: THREE.Frustum;
  updateFrustum: () => void;
  isVisible: (position: THREE.Vector3, radius?: number) => boolean;
} {
  const frustum = new THREE.Frustum();
  const projScreenMatrix = new THREE.Matrix4();

  const updateFrustum = () => {
    camera.updateMatrixWorld();
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);
  };

  const isVisible = (position: THREE.Vector3, radius = 0.5): boolean => {
    // Use sphere bounds check for efficiency
    const sphere = new THREE.Sphere(position, radius);
    return frustum.intersectsSphere(sphere);
  };

  return { frustum, updateFrustum, isVisible };
}

/**
 * Label LOD manager - hides labels based on zoom level
 * Optimization: caches zoom level to avoid updating sprite visibility every frame
 */
export function createLabelLOD(
  sprites: Map<string, THREE.Sprite>,
  options: {
    hideAllDistance?: number;
    showHoveredOnlyDistance?: number;
  } = {}
): {
  update: (camera: THREE.Camera, hoveredNodeId: string | null, forceUpdate?: boolean) => void;
} {
  const { hideAllDistance = 50, showHoveredOnlyDistance = 25 } = options;
  const ZOOM_CHANGE_THRESHOLD = 0.5; // Only update if zoom changes by more than 0.5 units

  // Cache state to avoid updates when nothing changed
  let prevZoomLevel: number | null = null;
  let prevHoveredNodeId: string | null = null;

  const shouldUpdateLOD = (currentZoom: number, currentHoveredId: string | null): boolean => {
    // Update if zoom changed significantly OR hovered node changed
    const zoomChanged =
      prevZoomLevel === null || Math.abs(currentZoom - prevZoomLevel) >= ZOOM_CHANGE_THRESHOLD;
    const hoveredChanged = currentHoveredId !== prevHoveredNodeId;

    return zoomChanged || hoveredChanged;
  };

  const update = (camera: THREE.Camera, hoveredNodeId: string | null, forceUpdate = false) => {
    const zoomLevel = camera.position.length();

    // Skip update if nothing changed (performance optimization for rotation)
    if (!forceUpdate && !shouldUpdateLOD(zoomLevel, hoveredNodeId)) {
      return;
    }

    // Update cache
    prevZoomLevel = zoomLevel;
    prevHoveredNodeId = hoveredNodeId;

    // Update sprite visibility only when needed
    sprites.forEach((sprite, nodeId) => {
      if (zoomLevel > hideAllDistance) {
        // Zoomed way out - hide all labels
        sprite.visible = false;
      } else if (zoomLevel > showHoveredOnlyDistance) {
        // Medium zoom - show only hovered
        sprite.visible = nodeId === hoveredNodeId;
      } else {
        // Close up - show all labels
        sprite.visible = true;
      }
    });
  };

  return { update };
}

/**
 * Get node color based on current state
 */
export function getNodeColor(state: NodeColorState, isVirtual: boolean): number {
  if (isVirtual) return NODE_COLORS.virtual;
  if (state.isActive) return NODE_COLORS.active;
  if (state.isHovered) return NODE_COLORS.hovered;
  if (state.isSearchMatch) return NODE_COLORS.searchMatch;
  if (state.isConnected) return NODE_COLORS.connected;
  if (state.isFiltered) return NODE_COLORS.filtered;
  return NODE_COLORS.default;
}

/**
 * Get node scale based on current state
 */
export function getNodeScale(state: NodeColorState, baseScale = 1): number {
  if (state.isActive) return baseScale * 1.5;
  if (state.isHovered) return baseScale * 1.3;
  if (state.isSearchMatch) return baseScale * 1.2;
  return baseScale;
}

export { EDGE_COLORS, NODE_COLORS };
