'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
// @ts-ignore - OrbitControls JSM import works at runtime
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { createTextSprite } from '@/lib/godot/visualization-utils';
import {
  createInstancedNodes,
  createBatchedEdges,
  createFrustumCuller,
  createLabelLOD,
  getNodeColor,
  getNodeScale,
  type GraphNode as OptGraphNode,
  type GraphEdge as OptGraphEdge,
  type NodeColorState,
} from '@/lib/godot/optimized-graph-renderer';
import { useGodotRuntimeEvents } from '@/hooks/useGodotRuntimeEvents';
import { useDraggable } from '@/hooks/useDraggable';
import { useGraphStreaming } from '@/hooks/useGraphStreaming';
import { fetchWithCSRF } from '@/lib/utils/csrf';
import { StreamingToggle } from './StreamingToggle';
import { StreamingVideoPlayer } from './StreamingVideoPlayer';
import { logger } from '@/lib/utils/logger';

/**
 * Metadata structure for graph nodes
 */
interface GraphNodeMetadata {
  isVirtual?: boolean;
  functionCount?: number;
  signalCount?: number;
}

/**
 * UserData attached to raycasting proxy meshes
 */
interface ProxyMeshUserData {
  nodeId: string;
  label: string;
  isVirtual: boolean;
  instanceIndex: number;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'script' | 'scene' | 'class';
  metadata?: GraphNodeMetadata;
  position?: { x: number; y: number; z: number };
}

interface GraphEdge {
  from: string;
  to: string;
  type: 'extends' | 'preload' | 'load' | 'calls' | 'signal';
  weight?: number;
}

interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface DependencyGraphViewerProps {
  versionId: number;
  activeNodePath?: string;
  onNodeClick?: (nodeId: string) => void;
  // Panel repositioning mode props (from parent GodotDevOverlay)
  isCtrlPressed?: boolean;
  selectedPanelId?: string | null;
  onPanelClick?: (panelId: string) => void;
}

/**
 * DependencyGraphViewer - Interactive 3D visualization of script dependencies
 * Uses Three.js with OrbitControls for navigation
 */
export function DependencyGraphViewer({
  versionId,
  activeNodePath,
  onNodeClick,
  isCtrlPressed = false,
  selectedPanelId = null,
  onPanelClick,
}: DependencyGraphViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Optimized rendering refs
  const instancedNodesRef = useRef<THREE.InstancedMesh | null>(null);
  const nodeIndexMapRef = useRef<Map<string, number>>(new Map());
  const nodeUpdatersRef = useRef<{
    updateNodeColor: (nodeId: string, color: number) => void;
    updateNodeScale: (nodeId: string, scale: number) => void;
    updateAllNodeColors: (colorFn: (node: OptGraphNode) => number) => void;
  } | null>(null);
  const batchedEdgesRef = useRef<{
    lineSegments: Map<string, THREE.LineSegments>;
    arrowInstances: THREE.InstancedMesh;
  } | null>(null);
  const spritesRef = useRef<Map<string, THREE.Sprite>>(new Map());
  const labelLODRef = useRef<{
    update: (camera: THREE.Camera, hoveredNodeId: string | null) => void;
  } | null>(null);
  const frustumCullerRef = useRef<{
    updateFrustum: () => void;
    isVisible: (position: THREE.Vector3, radius?: number) => boolean;
  } | null>(null);

  // State tracking for conditional updates (optimization: don't update every frame)
  const prevStateRef = useRef<{
    activeNodePath: string | undefined;
    searchQuery: string;
    hoveredNodeId: string | null;
    needsUpdate: boolean;
  }>({
    activeNodePath: undefined,
    searchQuery: '',
    hoveredNodeId: null,
    needsUpdate: true,
  });

  // Legacy refs (kept for compatibility with raycasting)
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const edgesRef = useRef<THREE.Group[]>([]);
  const activeNodesRef = useRef<Map<string, number>>(new Map()); // Maps scriptPath -> expireTime
  const hoveredNodeIdRef = useRef<string | null>(null); // Track currently hovered node for animation loop
  const navigationIndexRef = useRef<{ incoming: number; outgoing: number }>({
    incoming: 0,
    outgoing: 0,
  }); // Track navigation position in edge lists

  // Raycasting debounce (performance optimization: reduce raycast calls during rotation)
  const RAYCAST_DEBOUNCE_MS = 50;
  const lastRaycastTimeRef = useRef<number>(0);
  const lastRaycastResultRef = useRef<{ nodeId: string | null }>({ nodeId: null });

  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [showLabels, setShowLabels] = useState(true);
  const [buildStatus, setBuildStatus] = useState<'pending' | 'building' | 'success' | 'failed'>(
    'pending'
  );
  const [reindexStatus, setReindexStatus] = useState<'idle' | 'reindexing' | 'success' | 'failed'>(
    'idle'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [stickyNode, setStickyNode] = useState<GraphNode | null>(null);
  const [expandedIncoming, setExpandedIncoming] = useState(false);
  const [expandedOutgoing, setExpandedOutgoing] = useState(false);

  // Streaming state
  const [streamingEnabled, setStreamingEnabled] = useState(false);
  const lastStreamingStateUpdateRef = useRef<number>(0);

  // Streaming hook for WebSocket connection
  const {
    isConnected,
    isConnecting,
    error: streamingError,
    updateState: updateStreamingState,
    updateCamera: updateStreamingCamera,
  } = useGraphStreaming({
    versionId,
    enabled: streamingEnabled,
    onFrame: () => {
      // Frame received - video player will handle display
    },
  });

  // Draggable panel hooks
  const infoPanelDrag = useDraggable({
    id: 'info-panel',
    defaultPosition: { x: 16, y: 16 },
    versionId,
    isSelected: selectedPanelId === 'info-panel',
    onSelect: () => onPanelClick?.('info-panel'),
    allowDragFromAnywhere: selectedPanelId === 'info-panel',
  });

  const searchPanelDrag = useDraggable({
    id: 'search-panel',
    defaultPosition: { x: 0, y: 64 },
    versionId,
    isSelected: selectedPanelId === 'search-panel',
    onSelect: () => onPanelClick?.('search-panel'),
    allowDragFromAnywhere: selectedPanelId === 'search-panel',
  });

  const controlPanelDrag = useDraggable({
    id: 'control-panel',
    defaultPosition: { x: 0, y: 16 },
    versionId,
    isSelected: selectedPanelId === 'control-panel',
    onSelect: () => onPanelClick?.('control-panel'),
    allowDragFromAnywhere: selectedPanelId === 'control-panel',
  });

  const tempLegendDrag = useDraggable({
    id: 'temp-legend',
    defaultPosition: { x: 16, y: 0 },
    versionId,
    isSelected: selectedPanelId === 'temp-legend',
    onSelect: () => onPanelClick?.('temp-legend'),
    allowDragFromAnywhere: selectedPanelId === 'temp-legend',
  });

  const edgeLegendDrag = useDraggable({
    id: 'edge-legend',
    defaultPosition: { x: 0, y: 0 },
    versionId,
    isSelected: selectedPanelId === 'edge-legend',
    onSelect: () => onPanelClick?.('edge-legend'),
    allowDragFromAnywhere: selectedPanelId === 'edge-legend',
  });

  const tooltipDrag = useDraggable({
    id: 'tooltip',
    defaultPosition: { x: 0, y: 0 },
    versionId,
    isSelected: selectedPanelId === 'tooltip',
    onSelect: () => onPanelClick?.('tooltip'),
    allowDragFromAnywhere: selectedPanelId === 'tooltip',
  });

  // Track node activation count (temperature)
  const temperatureRef = useRef<Map<string, number>>(new Map());

  // Subscribe to runtime events
  const { events: runtimeEvents, connected: runtimeConnected } = useGodotRuntimeEvents(versionId);

  // Calculate filtered nodes based on search
  const filteredNodes =
    graph?.nodes.filter(node => {
      if (!searchQuery.trim()) return true;
      return (
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }) ?? [];

  // Calculate isolated nodes (no incoming or outgoing edges)
  const isolatedNodes =
    graph?.nodes.filter(node => {
      const hasOutgoing = graph?.edges.some(e => e.from === node.id);
      const hasIncoming = graph?.edges.some(e => e.to === node.id);
      return !hasOutgoing && !hasIncoming;
    }) ?? [];

  // Load graph data
  useEffect(() => {
    const loadGraph = async () => {
      try {
        setLoading(true);
        const url = `/api/godot/versions/${versionId}/graph?mode=dependencies`;
        logger.info(`[DependencyGraphViewer] Loading graph:`, { url, versionId });

        const response = await fetch(url);

        logger.info(`[DependencyGraphViewer] Graph response received:`, {
          status: response.status,
          ok: response.ok,
          contentType: response.headers.get('content-type'),
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error(`[DependencyGraphViewer] Failed to load graph - HTTP ${response.status}:`, {
            url,
            versionId,
            status: response.status,
            responseLength: errorText.length,
            responseSample: errorText.substring(0, 500),
            fullResponse: errorText,
          });
          throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
        }

        let data;
        try {
          const responseText = await response.text();
          logger.info(`[DependencyGraphViewer] Parsing graph response:`, {
            length: responseText.length,
            sample: responseText.substring(0, 200),
          });
          data = JSON.parse(responseText);
        } catch (parseErr) {
          const responseClone = response.clone();
          const responseText = await responseClone.text();
          logger.error(`[DependencyGraphViewer] Failed to parse graph response JSON`, {
            url,
            versionId,
            parseError: parseErr instanceof Error ? parseErr.message : String(parseErr),
            responseLength: responseText.length,
            responseSample: responseText.substring(0, 500),
            fullResponse: responseText,
          });
          throw new Error(
            `Failed to parse graph response: ${parseErr instanceof Error ? parseErr.message : 'Unknown error'}`
          );
        }
        logger.info(`[DependencyGraphViewer] Graph loaded successfully:`, {
          nodeCount: data.nodes?.length || 0,
          edgeCount: data.edges?.length || 0,
          dataType: typeof data,
        });

        if (!data.nodes || !Array.isArray(data.nodes)) {
          throw new Error(`Invalid graph data: expected nodes array, got ${typeof data.nodes}`);
        }

        setGraph(data);
        setNodeCount(data.nodes?.length || 0);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        logger.error('[DependencyGraphViewer] Error loading graph:', err);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    loadGraph();
  }, [versionId]);

  // Navigate graph with arrow keys
  const navigateGraph = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!graph || !activeNodePath) {
      // Select first node if none selected
      if (graph?.nodes[0]) onNodeClick?.(graph.nodes[0].id);
      return;
    }

    const isIncoming = direction === 'up' || direction === 'down';
    const edges = graph.edges.filter(e =>
      isIncoming ? e.to === activeNodePath : e.from === activeNodePath
    );

    if (edges.length === 0) return;

    const indexKey = isIncoming ? 'incoming' : 'outgoing';
    let currentIndex = navigationIndexRef.current[indexKey];

    // Cycle through edges
    if (direction === 'down' || direction === 'right') {
      currentIndex = (currentIndex + 1) % edges.length;
    } else {
      currentIndex = (currentIndex - 1 + edges.length) % edges.length;
    }

    navigationIndexRef.current[indexKey] = currentIndex;

    const targetEdge = edges[currentIndex];
    if (!targetEdge) return;
    const targetNodeId = isIncoming ? targetEdge.from : targetEdge.to;
    onNodeClick?.(targetNodeId);

    // Focus camera on new node
    const targetNode = graph.nodes.find(n => n.id === targetNodeId);
    if (targetNode?.position && controlsRef.current && cameraRef.current) {
      controlsRef.current.target.set(
        targetNode.position.x,
        targetNode.position.y,
        targetNode.position.z
      );
      cameraRef.current.lookAt(targetNode.position.x, targetNode.position.y, targetNode.position.z);
    }
  };

  // Initialize and manage Three.js scene
  useEffect(() => {
    if (!containerRef.current || !graph) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Dark blue background
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 15);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Clear existing meshes and sprites
    meshesRef.current.clear();
    spritesRef.current.forEach(sprite => {
      if (sprite.material instanceof THREE.SpriteMaterial) {
        if (sprite.material.map) {
          sprite.material.map.dispose();
        }
        sprite.material.dispose();
      }
      scene.remove(sprite);
    });
    spritesRef.current.clear();

    // Clear temperature tracking
    temperatureRef.current.clear();

    // =======================================================================
    // OPTIMIZED NODE RENDERING - Uses InstancedMesh for 149 nodes → 1 draw call
    // =======================================================================

    // Convert graph nodes to optimized format
    const optNodes: OptGraphNode[] = graph.nodes.map(node => ({
      id: node.id,
      name: node.label,
      path: node.id,
      type: node.metadata?.isVirtual ? 'virtual' : 'script',
      position: new THREE.Vector3(
        node.position?.x || 0,
        node.position?.y || 0,
        node.position?.z || 0
      ),
    }));

    // Create instanced nodes (12x12 sphere segments instead of 32x32 = 7x fewer vertices)
    const { instancedMesh, nodeIndexMap, updateNodeColor, updateNodeScale, updateAllNodeColors } =
      createInstancedNodes(optNodes, {
        regularRadius: 0.3,
        virtualRadius: 0.15,
        segments: 12, // Reduced from 32 for performance
      });

    scene.add(instancedMesh);
    instancedNodesRef.current = instancedMesh;
    nodeIndexMapRef.current = nodeIndexMap;
    nodeUpdatersRef.current = { updateNodeColor, updateNodeScale, updateAllNodeColors };

    // Create frustum culler for viewport optimization
    frustumCullerRef.current = createFrustumCuller(camera);

    // Also create individual meshes for raycasting (simpler invisible proxies)
    // These are much lighter than the visual meshes - just for click/hover detection
    const proxyGeometry = new THREE.SphereGeometry(0.35, 8, 8); // Low-poly proxy
    const proxyMaterial = new THREE.MeshBasicMaterial({ visible: false });

    graph.nodes.forEach((node, index) => {
      const isVirtual = node.metadata?.isVirtual === true;
      const pos = node.position || { x: 0, y: 0, z: 0 };

      // Create invisible proxy mesh for raycasting
      const proxyMesh = new THREE.Mesh(proxyGeometry, proxyMaterial);
      proxyMesh.position.set(pos.x, pos.y, pos.z);
      proxyMesh.userData = {
        nodeId: node.id,
        label: node.label,
        isVirtual,
        instanceIndex: index,
      };

      scene.add(proxyMesh);
      meshesRef.current.set(node.id, proxyMesh);
    });

    // Create and add text label sprites (conditional on showLabels state)
    if (showLabels) {
      graph.nodes.forEach(node => {
        const isVirtual = node.metadata?.isVirtual === true;
        const pos = node.position || { x: 0, y: 0, z: 0 };

        try {
          const labelSprite = createTextSprite(node.label, {
            fontSize: isVirtual ? 16 : 20,
            textColor: isVirtual ? '#a855f7' : '#ffffff',
            backgroundColor: isVirtual ? 'rgba(88, 28, 135, 0.5)' : 'rgba(0, 0, 0, 0.6)',
            padding: isVirtual ? 4 : 6,
          });

          // Position label slightly above the node
          labelSprite.position.set(pos.x, pos.y + (isVirtual ? 0.4 : 0.6), pos.z);
          labelSprite.userData = { nodeId: node.id, isLabel: true };

          scene.add(labelSprite);
          spritesRef.current.set(node.id, labelSprite);
        } catch (err) {
          logger.warn(`[DependencyGraphViewer] Failed to create label for ${node.label}:`, err);
        }
      });

      // Create label LOD manager for zoom-based visibility
      labelLODRef.current = createLabelLOD(spritesRef.current, {
        hideAllDistance: 50,
        showHoveredOnlyDistance: 25,
      });
    }

    // =======================================================================
    // OPTIMIZED EDGE RENDERING - Batched LineSegments (2,468 edges → ~4 draw calls)
    // =======================================================================

    // Build node position map for edge rendering
    const nodePositions = new Map<string, THREE.Vector3>();
    graph.nodes.forEach(node => {
      if (node.position) {
        nodePositions.set(
          node.id,
          new THREE.Vector3(node.position.x, node.position.y, node.position.z)
        );
      }
    });

    // Convert edges to optimized format (only extends, preload, load types)
    const optEdges: OptGraphEdge[] = graph.edges
      .filter(edge => ['extends', 'preload', 'load'].includes(edge.type))
      .map(edge => ({
        from: edge.from,
        to: edge.to,
        type: edge.type as 'extends' | 'preload' | 'load',
      }));

    // Create batched edges (all edges of same type in single geometry)
    const { lineSegments, arrowInstances } = createBatchedEdges(optEdges, nodePositions);

    // Add all line segments to scene
    lineSegments.forEach((lines, type) => {
      scene.add(lines);
    });
    scene.add(arrowInstances);

    // Store reference for updates
    batchedEdgesRef.current = { lineSegments, arrowInstances };

    // Legacy: keep edgesRef empty for compatibility (no individual groups anymore)
    edgesRef.current = [];

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    // Handle mouse clicks and hovers on nodes
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMove = (event: MouseEvent) => {
      if (event.target !== renderer.domElement) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / height) * 2 + 1;

      // Raycasting debounce: only raycast every 50ms to reduce CPU load during rotation
      const now = Date.now();
      let nodeId: string | null = null;

      if (now - lastRaycastTimeRef.current >= RAYCAST_DEBOUNCE_MS) {
        // Perform raycast
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(Array.from(meshesRef.current.values()));
        const firstIntersect = intersects[0];

        if (firstIntersect && firstIntersect.object instanceof THREE.Mesh) {
          const userData = firstIntersect.object.userData as ProxyMeshUserData;
          if (userData?.nodeId) {
            nodeId = userData.nodeId;
            lastRaycastResultRef.current.nodeId = nodeId;
          }
        } else {
          lastRaycastResultRef.current.nodeId = null;
        }

        lastRaycastTimeRef.current = now;
      } else {
        // Reuse cached raycast result
        nodeId = lastRaycastResultRef.current.nodeId;
      }

      // Update hover state based on raycast result (from cache or fresh)
      if (nodeId && graph) {
        const hoveredNodeObj = graph.nodes.find(n => n.id === nodeId);
        setHoveredNode(hoveredNodeObj || null);
        hoveredNodeIdRef.current = nodeId;
      } else {
        setHoveredNode(null);
        hoveredNodeIdRef.current = null;
      }
    };

    const onMouseClick = (event: MouseEvent) => {
      if (event.target !== renderer.domElement) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(scene.children);
      let nodeClicked = false;

      for (const intersection of intersects) {
        if (intersection.object instanceof THREE.Mesh) {
          const userData = intersection.object.userData as ProxyMeshUserData;
          if (userData?.nodeId) {
            const clickedNode = graph?.nodes.find(n => n.id === userData.nodeId);
            setStickyNode(clickedNode || null);
            setExpandedIncoming(false);
            setExpandedOutgoing(false);
            onNodeClick?.(userData.nodeId);
            nodeClicked = true;
            break;
          }
        }
      }

      // Click outside nodes - unstick tooltip
      if (!nodeClicked) {
        setStickyNode(null);
      }
    };

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onMouseClick);

    // Handle keyboard navigation with arrow keys
    const onKeyDown = (event: KeyboardEvent) => {
      // Close sticky tooltip with ESC
      if (event.key === 'Escape') {
        setStickyNode(null);
        setHoveredNode(null);
        return;
      }

      const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (!arrows.includes(event.key)) return;

      event.preventDefault();
      const directionMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      };
      navigateGraph(directionMap[event.key]!);
    };

    window.addEventListener('keydown', onKeyDown);

    // Handle window resize
    const onWindowResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', onWindowResize);

    // =======================================================================
    // OPTIMIZED ANIMATION LOOP - Only updates on state change, not every frame
    // =======================================================================
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();

      // Check if state changed (optimization: skip expensive updates if nothing changed)
      const stateChanged =
        prevStateRef.current.activeNodePath !== activeNodePath ||
        prevStateRef.current.searchQuery !== searchQuery ||
        prevStateRef.current.hoveredNodeId !== hoveredNodeIdRef.current ||
        prevStateRef.current.needsUpdate;

      // Update instanced node colors only when state changes
      if (stateChanged && nodeUpdatersRef.current && graph) {
        const { updateNodeColor, updateNodeScale } = nodeUpdatersRef.current;

        graph.nodes.forEach(node => {
          const isVirtual = node.metadata?.isVirtual === true;
          const isRuntimeActive = activeNodesRef.current.has(node.id);
          const isSelected = node.id === activeNodePath;
          const isHovered = node.id === hoveredNodeIdRef.current;
          const isFiltered = searchQuery.trim() && !filteredNodes.some(n => n.id === node.id);
          const temperature = temperatureRef.current.get(node.id) || 0;

          // Determine color based on state
          let color: number;
          let scale: number;

          if (isVirtual) {
            // Virtual nodes (built-in classes)
            if (isSelected) {
              color = 0xc084fc; // Lighter purple
              scale = 1.0;
            } else if (isHovered) {
              color = 0x06b6d4; // Cyan
              scale = 0.95;
            } else if (isRuntimeActive) {
              color = 0xa855f7; // Purple
              scale = 0.9;
            } else {
              color = 0xa855f7; // Purple
              scale = 0.8;
            }
          } else {
            // Regular script nodes
            if (isRuntimeActive) {
              color = 0xffff00; // Bright yellow
              scale = 1.4;
            } else if (isSelected) {
              color = 0x3b82f6; // Blue
              scale = 1.2;
            } else if (isHovered) {
              color = 0x06b6d4; // Cyan
              scale = 1.1;
            } else if (temperature > 15) {
              color = 0xf97316; // Hot - orange
              scale = 1.0;
            } else if (temperature > 5) {
              color = 0xeab308; // Warm - yellow
              scale = 1.0;
            } else if (temperature > 0) {
              color = 0x06b6d4; // Cool - cyan
              scale = 1.0;
            } else {
              color = 0x3b82f6; // Cold - blue (default)
              scale = 1.0;
            }
          }

          // Apply filtered state (dim nodes that don't match search)
          if (isFiltered && !isSelected && !isHovered) {
            color = 0x4b5563; // Gray for filtered out
            scale *= 0.8;
          }

          updateNodeColor(node.id, color);
          updateNodeScale(node.id, scale);
        });

        // Update state tracking
        prevStateRef.current = {
          activeNodePath,
          searchQuery,
          hoveredNodeId: hoveredNodeIdRef.current,
          needsUpdate: false,
        };
      }

      // Update label LOD (visibility based on zoom level)
      if (labelLODRef.current) {
        labelLODRef.current.update(camera, hoveredNodeIdRef.current);
      }

      // Update frustum culler for potential future culling optimizations
      if (frustumCullerRef.current) {
        frustumCullerRef.current.updateFrustum();
      }

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('click', onMouseClick);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onWindowResize);

      // Dispose of sprite materials and textures
      spritesRef.current.forEach(sprite => {
        if (sprite.material instanceof THREE.SpriteMaterial) {
          if (sprite.material.map) {
            sprite.material.map.dispose();
          }
          sprite.material.dispose();
        }
        scene.remove(sprite);
      });
      spritesRef.current.clear();

      // Dispose of instanced nodes mesh
      if (instancedNodesRef.current) {
        instancedNodesRef.current.geometry.dispose();
        if (instancedNodesRef.current.material instanceof THREE.Material) {
          instancedNodesRef.current.material.dispose();
        }
        scene.remove(instancedNodesRef.current);
        instancedNodesRef.current = null;
      }

      // Dispose of batched edges
      if (batchedEdgesRef.current) {
        batchedEdgesRef.current.lineSegments.forEach(lines => {
          lines.geometry.dispose();
          if (lines.material instanceof THREE.Material) {
            lines.material.dispose();
          }
          scene.remove(lines);
        });
        batchedEdgesRef.current.arrowInstances.geometry.dispose();
        if (batchedEdgesRef.current.arrowInstances.material instanceof THREE.Material) {
          batchedEdgesRef.current.arrowInstances.material.dispose();
        }
        scene.remove(batchedEdgesRef.current.arrowInstances);
        batchedEdgesRef.current = null;
      }

      // Dispose of proxy meshes (for raycasting)
      meshesRef.current.forEach(mesh => {
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose();
        }
        scene.remove(mesh);
      });
      meshesRef.current.clear();

      // Clear refs
      nodeIndexMapRef.current.clear();
      nodeUpdatersRef.current = null;
      labelLODRef.current = null;
      frustumCullerRef.current = null;

      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [graph, activeNodePath, onNodeClick, showLabels]);

  // Track runtime events and update active nodes
  useEffect(() => {
    if (!runtimeEvents || runtimeEvents.length === 0) return;

    const latestEvent = runtimeEvents[runtimeEvents.length - 1];
    if (!latestEvent) return;

    // Handle graph_update events
    if (latestEvent.type === 'graph_update') {
      logger.info('[DependencyGraphViewer] Graph update event received, reloading graph...');
      const loadGraph = async () => {
        try {
          const url = `/api/godot/versions/${versionId}/graph?mode=dependencies`;
          logger.info('[DependencyGraphViewer] Reloading graph after update:', { url, versionId });

          const response = await fetch(url);

          logger.info('[DependencyGraphViewer] Graph reload response:', {
            status: response.status,
            ok: response.ok,
            contentType: response.headers.get('content-type'),
          });

          if (!response.ok) {
            const errorText = await response.text();
            logger.error(
              '[DependencyGraphViewer] Failed to reload graph - HTTP ' + response.status,
              {
                url,
                status: response.status,
                responseSample: errorText.substring(0, 200),
              }
            );
            return;
          }

          let newGraph;
          try {
            const responseText = await response.text();
            logger.info('[DependencyGraphViewer] Parsing reloaded graph:', {
              length: responseText.length,
            });
            newGraph = JSON.parse(responseText);
          } catch (parseErr) {
            const responseClone = response.clone();
            const responseText = await responseClone.text();
            logger.error('[DependencyGraphViewer] Failed to parse reloaded graph JSON', {
              url,
              parseError: parseErr instanceof Error ? parseErr.message : String(parseErr),
              responseSample: responseText.substring(0, 200),
            });
            return;
          }

          logger.info('[DependencyGraphViewer] Graph reloaded successfully:', {
            nodeCount: newGraph.nodes?.length || 0,
          });
          setGraph(newGraph);
          setNodeCount(newGraph.nodes?.length || 0);
        } catch (err) {
          logger.error('[DependencyGraphViewer] Error reloading graph:', {
            error: err instanceof Error ? err.message : String(err),
            fullError: err,
          });
        }
      };
      loadGraph();
      return;
    }

    // Handle runtime_event events
    const scriptPath = latestEvent.scriptPath;
    if (!scriptPath) return;

    const now = Date.now();
    const expireTime = now + 2000; // Keep node active for 2 seconds

    logger.info(`[DependencyGraphViewer] Runtime event: ${scriptPath}`);

    // Mark this node as active
    activeNodesRef.current.set(scriptPath, expireTime);

    // Track activation count (temperature)
    const currentTemp = temperatureRef.current.get(scriptPath) || 0;
    temperatureRef.current.set(scriptPath, currentTemp + 1);

    // Clean up expired nodes
    const currentTime = Date.now();
    const expiredNodes: string[] = [];
    activeNodesRef.current.forEach((expireAt, nodeId) => {
      if (currentTime > expireAt) {
        expiredNodes.push(nodeId);
      }
    });
    expiredNodes.forEach(nodeId => {
      activeNodesRef.current.delete(nodeId);
    });
  }, [runtimeEvents, versionId]);

  // Reset navigation indices when selection changes
  useEffect(() => {
    navigationIndexRef.current = { incoming: 0, outgoing: 0 };
  }, [activeNodePath]);

  // Clear sticky node if it's filtered out by search
  useEffect(() => {
    if (stickyNode && searchQuery.trim()) {
      const isFiltered = !filteredNodes.some(n => n.id === stickyNode.id);
      if (isFiltered) {
        setStickyNode(null);
      }
    }
  }, [searchQuery, stickyNode, filteredNodes]);

  // Synchronize renderer state to streaming server
  useEffect(() => {
    if (!streamingEnabled || !isConnected) return;

    // Throttle state updates to avoid excessive network traffic (max 10 updates/sec)
    const now = Date.now();
    if (now - lastStreamingStateUpdateRef.current < 100) return;
    lastStreamingStateUpdateRef.current = now;

    updateStreamingState({
      activeNodePath: activeNodePath || null,
      hoveredNodeId: hoveredNodeIdRef.current,
      selectedNodeId: stickyNode?.id || null,
      searchQuery,
      filterOutput: false,
      filterBySearch: !!searchQuery,
    });
  }, [
    streamingEnabled,
    isConnected,
    activeNodePath,
    searchQuery,
    stickyNode,
    updateStreamingState,
  ]);

  // Synchronize camera position to streaming server
  useEffect(() => {
    if (!streamingEnabled || !isConnected || !cameraRef.current) return;

    const handleCameraUpdate = () => {
      const camera = cameraRef.current;
      if (camera) {
        updateStreamingCamera(camera.position.x, camera.position.y, camera.position.z);
      }
    };

    // Update camera position every 100ms while streaming
    const interval = setInterval(handleCameraUpdate, 100);
    return () => clearInterval(interval);
  }, [streamingEnabled, isConnected, updateStreamingCamera]);

  // Handle re-index
  const handleReindex = async () => {
    try {
      setReindexStatus('reindexing');
      logger.info(`[DependencyGraphViewer] Triggering re-index for version ${versionId}`);

      const response = await fetchWithCSRF(`/api/godot/versions/${versionId}/reindex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Re-index failed: ${await response.text()}`);
      }

      const data = await response.json();
      logger.info('[DependencyGraphViewer] Re-index complete:', data);

      setReindexStatus('success');

      // Reload graph after 500ms
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      logger.error('[DependencyGraphViewer] Re-index failed:', err);
      setReindexStatus('failed');
      alert(`Re-index failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Handle build trigger
  const handleTriggerBuild = async () => {
    try {
      setBuildStatus('building');
      logger.info(`[DependencyGraphViewer] Triggering build for version ${versionId}`);

      const response = await fetchWithCSRF(`/api/godot/versions/${versionId}/build`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Log response details
      logger.info(`[DependencyGraphViewer] Build trigger response:`, {
        status: response.status,
        contentType: response.headers.get('content-type'),
        ok: response.ok,
      });

      if (!response.ok) {
        const responseText = await response.text();
        logger.error(`[DependencyGraphViewer] Build trigger failed - HTTP ${response.status}`, {
          responseText: responseText.substring(0, 500),
          fullResponse: responseText,
        });
        throw new Error(
          `Build trigger failed with HTTP ${response.status}: ${responseText.substring(0, 100)}`
        );
      }

      // Parse response
      let data;
      try {
        const responseText = await response.text();
        logger.info(`[DependencyGraphViewer] Parsing build trigger response:`, {
          length: responseText.length,
          sample: responseText.substring(0, 200),
        });
        data = JSON.parse(responseText);
      } catch (parseErr) {
        logger.error('[DependencyGraphViewer] Failed to parse build trigger response:', {
          error: parseErr,
          responseLength: response
            .clone()
            .text()
            .then(t => t.length),
        });
        throw new Error(
          `Failed to parse build response: ${parseErr instanceof Error ? parseErr.message : 'Unknown error'}`
        );
      }

      logger.info('[DependencyGraphViewer] Build started:', data);

      // Poll for build status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/godot/versions/${versionId}/build`);

          logger.info(`[DependencyGraphViewer] Build status poll response:`, {
            status: statusResponse.status,
            contentType: statusResponse.headers.get('content-type'),
          });

          if (!statusResponse.ok) {
            const errorText = await statusResponse.text();
            logger.error(
              `[DependencyGraphViewer] Failed to get build status - HTTP ${statusResponse.status}`,
              {
                error: errorText.substring(0, 200),
              }
            );
            clearInterval(pollInterval);
            throw new Error(`Failed to get build status: HTTP ${statusResponse.status}`);
          }

          const statusDataText = await statusResponse.text();
          const statusData = JSON.parse(statusDataText);

          logger.info('[DependencyGraphViewer] Build status:', statusData.status);
          setBuildStatus(statusData.status);

          if (statusData.status === 'success' || statusData.status === 'failed') {
            clearInterval(pollInterval);
            logger.info(`[DependencyGraphViewer] Build ${statusData.status}`);
          }
        } catch (err) {
          logger.error('[DependencyGraphViewer] Error polling build status:', {
            error: err instanceof Error ? err.message : String(err),
            fullError: err,
          });
          clearInterval(pollInterval);
        }
      }, 2000);

      // Clear interval after 5 minutes (safety timeout)
      setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
    } catch (err) {
      logger.error('[DependencyGraphViewer] Build trigger failed:', {
        error: err instanceof Error ? err.message : String(err),
        fullError: err,
      });
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setBuildStatus('failed');
      alert(`Build failed: ${errorMessage}`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-950 text-gray-400">
        <div className="text-center">
          <div className="mb-4">Loading dependency graph...</div>
          <div className="text-sm text-gray-600">Parsing scripts and building visualization</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-950 text-red-400">
        <div className="text-center">
          <div className="mb-4">Error loading graph</div>
          <div className="text-sm text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full bg-slate-950">
      {/* Info Panel - Draggable */}
      <div
        ref={infoPanelDrag.ref}
        onClick={infoPanelDrag.onClick}
        onMouseDown={infoPanelDrag.handleMouseDown}
        style={{
          position: 'absolute',
          left: `${infoPanelDrag.position.x}px`,
          top: `${infoPanelDrag.position.y}px`,
          zIndex: infoPanelDrag.isDragging ? 30 : 10,
          cursor: infoPanelDrag.isDragging ? 'grabbing' : 'default',
          outline: infoPanelDrag.isMoveBlocked
            ? '2px solid #ef4444'
            : infoPanelDrag.isSelected
              ? '2px solid #60a5fa'
              : 'none',
          outlineOffset: '2px',
          transition: infoPanelDrag.isDragging ? 'none' : 'outline 0.2s ease',
        }}
        className="rounded border border-gray-700 bg-gray-900/80 px-3 py-2 text-xs"
      >
        <div className="mb-2 border-b border-gray-700 pb-2">
          <div className="font-semibold text-gray-300">Dependency Graph</div>
          <div className="text-gray-400">{nodeCount} scripts found</div>
          <div className="mt-1 text-gray-600">Drag to rotate • Scroll to zoom</div>
        </div>

        {/* Statistics integrated here */}
        <div className="space-y-1 text-gray-400">
          <div className="font-semibold text-gray-300">Statistics</div>
          <div>Total Scripts: {graph?.nodes.length || 0}</div>
          <div>Dependencies: {graph?.edges.length || 0}</div>
          <div>Isolated: {isolatedNodes.length}</div>
          {searchQuery && <div className="text-blue-400">Filtered: {filteredNodes.length}</div>}
        </div>
      </div>

      {/* Search Panel - Draggable */}
      <div
        ref={searchPanelDrag.ref}
        onClick={searchPanelDrag.onClick}
        onMouseDown={searchPanelDrag.handleMouseDown}
        style={{
          position: 'absolute',
          left: `${searchPanelDrag.position.x}px`,
          top: `${searchPanelDrag.position.y}px`,
          zIndex: searchPanelDrag.isDragging ? 30 : 10,
          cursor: searchPanelDrag.isDragging ? 'grabbing' : 'default',
          transform: 'translateX(-50%)',
          width: '288px',
          outline: searchPanelDrag.isMoveBlocked
            ? '2px solid #ef4444'
            : searchPanelDrag.isSelected
              ? '2px solid #60a5fa'
              : 'none',
          outlineOffset: '2px',
          transition: searchPanelDrag.isDragging ? 'none' : 'outline 0.2s ease',
        }}
      >
        <div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                setSearchQuery('');
                e.currentTarget.blur();
              } else if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            placeholder="Search scripts..."
            className="w-full rounded-lg border border-gray-700 bg-gray-900/80 px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Control Panel - Draggable */}
      <div
        ref={controlPanelDrag.ref}
        onClick={controlPanelDrag.onClick}
        onMouseDown={controlPanelDrag.handleMouseDown}
        style={{
          position: 'absolute',
          right: controlPanelDrag.position.x !== 0 ? undefined : '16px',
          left: controlPanelDrag.position.x !== 0 ? `${controlPanelDrag.position.x}px` : undefined,
          top: `${controlPanelDrag.position.y}px`,
          zIndex: controlPanelDrag.isDragging ? 30 : 10,
          cursor: controlPanelDrag.isDragging ? 'grabbing' : 'default',
          outline: controlPanelDrag.isMoveBlocked
            ? '2px solid #ef4444'
            : controlPanelDrag.isSelected
              ? '2px solid #60a5fa'
              : 'none',
          outlineOffset: '2px',
          transition: controlPanelDrag.isDragging ? 'none' : 'outline 0.2s ease',
        }}
        className="space-y-2 rounded border border-gray-700 bg-gray-900/80 px-3 py-2 text-xs text-gray-400"
      >
        <div className="mb-2 pb-2">
          <div className="text-xs font-semibold text-gray-300">Controls</div>
        </div>
        <button
          onClick={() => setShowLabels(!showLabels)}
          className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700"
        >
          <span>{showLabels ? 'Hide Labels' : 'Show Labels'}</span>
        </button>

        {/* Streaming Toggle */}
        <div className="border-t border-gray-700 pt-2">
          <StreamingToggle
            versionId={versionId}
            isEnabled={streamingEnabled}
            onToggle={setStreamingEnabled}
            isConnecting={isConnecting}
            connectionError={streamingError}
          />
        </div>

        <button
          onClick={handleTriggerBuild}
          disabled={buildStatus === 'building'}
          className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded bg-green-600 px-3 py-2 text-sm text-white transition-colors hover:bg-green-700 disabled:bg-gray-600"
        >
          <span>{buildStatus === 'building' ? 'Building...' : 'Build HTML5'}</span>
        </button>

        {buildStatus === 'success' && (
          <div className="text-center text-xs font-semibold text-green-400">Build Successful</div>
        )}
        {buildStatus === 'failed' && (
          <div className="text-center text-xs font-semibold text-red-400">Build Failed</div>
        )}

        <button
          onClick={handleReindex}
          disabled={reindexStatus === 'reindexing'}
          className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded bg-purple-600 px-3 py-2 text-sm text-white transition-colors hover:bg-purple-700 disabled:bg-gray-600"
        >
          <span>{reindexStatus === 'reindexing' ? 'Re-indexing...' : 'Re-index Scripts'}</span>
        </button>

        {reindexStatus === 'success' && (
          <div className="text-center text-xs font-semibold text-green-400">
            Re-index Successful
          </div>
        )}
        {reindexStatus === 'failed' && (
          <div className="text-center text-xs font-semibold text-red-400">Re-index Failed</div>
        )}

        <div className="space-y-1 border-t border-gray-700 pt-2 text-xs text-gray-400">
          <div>Edges: {graph?.edges.length || 0}</div>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                runtimeConnected ? 'animate-pulse bg-green-500' : 'bg-gray-600'
              }`}
            ></div>
            <span className="text-xs">{runtimeConnected ? 'Live' : 'Offline'}</span>
          </div>
        </div>
      </div>

      {/* Temperature Legend - Draggable */}
      <div
        ref={tempLegendDrag.ref}
        onClick={tempLegendDrag.onClick}
        onMouseDown={tempLegendDrag.handleMouseDown}
        style={{
          position: 'absolute',
          bottom: tempLegendDrag.position.y !== 0 ? undefined : '16px',
          top: tempLegendDrag.position.y !== 0 ? `${tempLegendDrag.position.y}px` : undefined,
          left: `${tempLegendDrag.position.x}px`,
          zIndex: tempLegendDrag.isDragging ? 30 : 10,
          cursor: tempLegendDrag.isDragging ? 'grabbing' : 'default',
          outline: tempLegendDrag.isMoveBlocked
            ? '2px solid #ef4444'
            : tempLegendDrag.isSelected
              ? '2px solid #60a5fa'
              : 'none',
          outlineOffset: '2px',
          transition: tempLegendDrag.isDragging ? 'none' : 'outline 0.2s ease',
        }}
        className="rounded border border-gray-700 bg-gray-900/80 px-3 py-2 text-xs text-gray-400"
      >
        <div className="mb-2 font-semibold text-gray-300">Temperature</div>
        <div className="mb-1 flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-500"></div>
          <span className="text-xs">Cold (0)</span>
        </div>
        <div className="mb-1 flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-cyan-400"></div>
          <span className="text-xs">Cool (1-4)</span>
        </div>
        <div className="mb-1 flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
          <span className="text-xs">Warm (5-14)</span>
        </div>
        <div className="mb-1 flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-orange-500"></div>
          <span className="text-xs">Hot (15+)</span>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-yellow-300"></div>
          <span className="text-xs">Runtime Active</span>
        </div>
        <div className="border-t border-gray-700 pt-2">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-purple-500 opacity-60"></div>
            <span className="text-xs">Built-in Class</span>
          </div>
        </div>
      </div>

      {/* Edge Type Legend - Draggable */}
      <div
        ref={edgeLegendDrag.ref}
        onClick={edgeLegendDrag.onClick}
        onMouseDown={edgeLegendDrag.handleMouseDown}
        style={{
          position: 'absolute',
          right: edgeLegendDrag.position.x !== 0 ? undefined : '16px',
          left: edgeLegendDrag.position.x !== 0 ? `${edgeLegendDrag.position.x}px` : undefined,
          bottom: edgeLegendDrag.position.y !== 0 ? undefined : '16px',
          top: edgeLegendDrag.position.y !== 0 ? `${edgeLegendDrag.position.y}px` : undefined,
          zIndex: edgeLegendDrag.isDragging ? 30 : 10,
          cursor: edgeLegendDrag.isDragging ? 'grabbing' : 'default',
          outline: edgeLegendDrag.isMoveBlocked
            ? '2px solid #ef4444'
            : edgeLegendDrag.isSelected
              ? '2px solid #60a5fa'
              : 'none',
          outlineOffset: '2px',
          transition: edgeLegendDrag.isDragging ? 'none' : 'outline 0.2s ease',
        }}
        className="rounded border border-gray-700 bg-gray-900/80 px-3 py-2 text-xs text-gray-400"
      >
        <div className="mb-2 font-semibold text-gray-300">Edge Types</div>
        <div className="mb-1 flex items-center gap-2">
          <div className="h-2 w-2 rounded bg-red-500"></div>
          <span>Extends</span>
        </div>
        <div className="mb-1 flex items-center gap-2">
          <div className="h-2 w-2 rounded bg-blue-400"></div>
          <span>Preload</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded bg-green-500"></div>
          <span>Load</span>
        </div>
      </div>

      {/* Unified Sticky Tooltip */}
      {(stickyNode || hoveredNode) &&
        (() => {
          const displayNode = stickyNode || hoveredNode;
          const isSticky = !!stickyNode;

          if (!displayNode) return null;

          const incomingEdges = graph?.edges.filter(e => e.to === displayNode.id) || [];
          const outgoingEdges = graph?.edges.filter(e => e.from === displayNode.id) || [];

          const displayIncoming = expandedIncoming ? incomingEdges : incomingEdges.slice(0, 5);
          const displayOutgoing = expandedOutgoing ? outgoingEdges : outgoingEdges.slice(0, 5);

          return (
            <div
              ref={tooltipDrag.ref}
              onClick={tooltipDrag.onClick}
              onMouseDown={tooltipDrag.handleMouseDown}
              style={{
                position: 'absolute',
                left: `${tooltipDrag.position.x}px`,
                top: `${tooltipDrag.position.y}px`,
                zIndex: tooltipDrag.isDragging ? 40 : isSticky ? 15 : 10,
                cursor: tooltipDrag.isDragging ? 'grabbing' : 'default',
                transform: tooltipDrag.position.x === 0 ? 'translateX(-50%)' : undefined,
                maxWidth: '320px',
                outline: tooltipDrag.isMoveBlocked
                  ? '2px solid #ef4444'
                  : tooltipDrag.isSelected
                    ? '2px solid #60a5fa'
                    : 'none',
                outlineOffset: '2px',
                transition: tooltipDrag.isDragging ? 'none' : 'outline 0.2s ease',
              }}
              className={`rounded-lg p-4 shadow-2xl transition-all duration-200 ${
                isSticky
                  ? 'bg-gray-800/98 border-2 border-blue-500'
                  : 'border border-gray-600 bg-gray-800/95'
              }`}
            >
              {/* Header */}
              <div className="mb-2 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-white">{displayNode.label}</div>
                  </div>
                </div>
                {isSticky && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setStickyNode(null);
                    }}
                    className="ml-2 text-gray-400 transition-colors hover:text-gray-200"
                    title="Close (ESC)"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Node Metadata */}
              <div className="mb-3 space-y-1 border-b border-gray-700 pb-3 text-xs text-gray-300">
                <div>
                  <span className="text-gray-400">Path:</span>{' '}
                  <code className="text-xs text-gray-200">{displayNode.id}</code>
                </div>
                {displayNode.metadata && (
                  <div className="flex gap-4">
                    <div>
                      <span className="text-gray-400">Functions:</span>{' '}
                      <span className="text-gray-200">
                        {displayNode.metadata.functionCount || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Signals:</span>{' '}
                      <span className="text-gray-200">{displayNode.metadata.signalCount || 0}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Connection Details - Only show when sticky */}
              {isSticky && (incomingEdges.length > 0 || outgoingEdges.length > 0) && (
                <div className="space-y-3 text-xs">
                  {/* Incoming Connections */}
                  {incomingEdges.length > 0 && (
                    <div>
                      <div className="mb-1 font-semibold text-gray-400">
                        Used by: ({incomingEdges.length})
                      </div>
                      <div className="max-h-32 space-y-0.5 overflow-y-auto">
                        {displayIncoming.map(e => {
                          const fromNode = graph?.nodes.find(n => n.id === e.from);
                          const typeColor =
                            {
                              extends: 'text-red-400',
                              preload: 'text-blue-400',
                              load: 'text-green-400',
                              calls: 'text-yellow-400',
                              signal: 'text-purple-400',
                            }[e.type] || 'text-gray-400';
                          return (
                            <div key={e.from} className={typeColor}>
                              ← {fromNode?.label || e.from} ({e.type})
                            </div>
                          );
                        })}
                      </div>
                      {incomingEdges.length > 5 && (
                        <button
                          onClick={() => setExpandedIncoming(!expandedIncoming)}
                          className="mt-1 text-xs text-blue-400 hover:text-blue-300"
                        >
                          {expandedIncoming
                            ? 'Show less'
                            : `Show all (${incomingEdges.length - 5} more)`}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Outgoing Connections */}
                  {outgoingEdges.length > 0 && (
                    <div>
                      <div className="mb-1 font-semibold text-gray-400">
                        Depends on: ({outgoingEdges.length})
                      </div>
                      <div className="max-h-32 space-y-0.5 overflow-y-auto">
                        {displayOutgoing.map(e => {
                          const toNode = graph?.nodes.find(n => n.id === e.to);
                          const typeColor =
                            {
                              extends: 'text-red-400',
                              preload: 'text-blue-400',
                              load: 'text-green-400',
                              calls: 'text-yellow-400',
                              signal: 'text-purple-400',
                            }[e.type] || 'text-gray-400';
                          return (
                            <div key={e.to} className={typeColor}>
                              → {toNode?.label || e.to} ({e.type})
                            </div>
                          );
                        })}
                      </div>
                      {outgoingEdges.length > 5 && (
                        <button
                          onClick={() => setExpandedOutgoing(!expandedOutgoing)}
                          className="mt-1 text-xs text-blue-400 hover:text-blue-300"
                        >
                          {expandedOutgoing
                            ? 'Show less'
                            : `Show all (${outgoingEdges.length - 5} more)`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* No connections message - Only when sticky */}
              {isSticky && incomingEdges.length === 0 && outgoingEdges.length === 0 && (
                <div className="text-xs italic text-gray-500">No connections found</div>
              )}
            </div>
          );
        })()}

      {/* Ctrl Key Press Indicator */}
      {isCtrlPressed && !selectedPanelId && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg border border-blue-500 bg-blue-950/90 px-4 py-2 text-sm text-blue-200 shadow-lg"
          style={{ zIndex: 100 }}
        >
          <kbd className="rounded bg-blue-900 px-2 py-1 font-mono text-xs">Ctrl</kbd> + Click on a
          panel to select it for repositioning
        </div>
      )}

      {/* Selected Panel Indicator */}
      {selectedPanelId && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg border border-green-500 bg-green-950/90 px-4 py-2 text-sm text-green-200 shadow-lg"
          style={{ zIndex: 100 }}
        >
          Panel selected:{' '}
          <strong className="capitalize">{selectedPanelId.replace('-', ' ')}</strong>
          <span className="ml-2 text-xs opacity-70">
            (Ctrl+Click to deselect, Esc to exit, or drag to reposition)
          </span>
        </div>
      )}

      {/* Server-Side Rendering Video Overlay */}
      {streamingEnabled && (
        <StreamingVideoPlayer
          isActive={isConnected}
          width={1920}
          height={1080}
          className="fixed inset-0 z-50"
        />
      )}
    </div>
  );
}
