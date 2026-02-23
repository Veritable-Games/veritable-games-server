/**
 * Server-Side Three.js Renderer for Godot Dependency Graph
 *
 * Mirrors DependencyGraphViewer.tsx rendering in Node.js headless context
 * Outputs frame buffers for NVENC encoding and WebSocket streaming
 */

import * as THREE from 'three';
import {
  createInstancedNodes,
  createBatchedEdges,
  NodeColorState,
  GraphNode,
  GraphEdge,
} from './optimized-graph-renderer';
import { logger } from '@/lib/utils/logger';

export interface ServerRendererOptions {
  width?: number;
  height?: number;
  fps?: number;
  glContext?: any;
}

export interface SceneState {
  activeNodePath: string | null;
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  searchQuery: string;
  activeNodes: Map<string, number>;
  runtimeTemperature: Map<string, number>;
  filterOutput: boolean;
  filterBySearch: boolean;
}

export class ServerGraphRenderer {
  // Three.js core
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private renderTarget: THREE.WebGLRenderTarget;
  private frameBuffer: Uint8Array;

  // Graph geometry
  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];
  private nodeIndexMap = new Map<string, number>();
  private instancedNodes: THREE.InstancedMesh | null = null;
  private batchedEdges: any = null;
  private sprites = new Map<string, THREE.Sprite>();

  // State tracking
  private currentState: SceneState = {
    activeNodePath: null,
    hoveredNodeId: null,
    selectedNodeId: null,
    searchQuery: '',
    activeNodes: new Map(),
    runtimeTemperature: new Map(),
    filterOutput: false,
    filterBySearch: false,
  };

  private prevState: SceneState = { ...this.currentState };

  // Rendering parameters
  private width: number;
  private height: number;
  private fps: number;

  constructor(options: ServerRendererOptions = {}) {
    this.width = options.width || 1920;
    this.height = options.height || 1080;
    this.fps = options.fps || 30;

    // Initialize Three.js with headless-gl context
    const glContext = options.glContext;
    if (!glContext) {
      throw new Error('headless-gl context is required for server renderer');
    }

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      context: glContext,
      antialias: true,
      alpha: false,
    });

    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0x0f172a); // Dark blue background from DependencyGraphViewer

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
    this.camera.position.set(0, 0, 15);

    // Create render target for frame capture
    this.renderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });

    // Initialize frame buffer
    this.frameBuffer = new Uint8Array(this.width * this.height * 4);

    // Setup lighting (matching DependencyGraphViewer lines 510-516)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    this.scene.add(directionalLight);
  }

  /**
   * Initialize graph with nodes and edges
   */
  async initializeGraph(nodes: GraphNode[], edges: GraphEdge[]): Promise<void> {
    this.nodes = nodes;
    this.edges = edges;

    // Create node positions map
    const nodePositions = new Map<string, THREE.Vector3>();
    nodes.forEach(node => {
      nodePositions.set(node.id, node.position || new THREE.Vector3(0, 0, 0));
    });

    // Create instanced nodes (matching optimized-graph-renderer.ts)
    const nodeResult = createInstancedNodes(nodes, {
      regularRadius: 0.3,
      virtualRadius: 0.15,
      segments: 12,
    });

    this.instancedNodes = nodeResult.instancedMesh;
    this.nodeIndexMap = nodeResult.nodeIndexMap;
    this.scene.add(this.instancedNodes);

    // Create batched edges
    this.batchedEdges = createBatchedEdges(edges, nodePositions);
    this.batchedEdges.lineSegments.forEach((lines: THREE.LineSegments) => {
      this.scene.add(lines);
    });
    this.scene.add(this.batchedEdges.arrowInstances);

    // Create label sprites
    await this.createLabelSprites(nodes);
  }

  /**
   * Create canvas-based text sprites for node labels
   * Gracefully skips if canvas is not available
   */
  private async createLabelSprites(nodes: GraphNode[]): Promise<void> {
    // Try to create label sprites, but don't fail if canvas is unavailable
    try {
      for (const node of nodes) {
        // Create canvas with text
        const canvas = this.createLabelCanvas(node.name);
        if (!canvas) continue; // Skip if canvas creation failed

        const texture = new THREE.CanvasTexture(canvas);

        // Create sprite
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);

        const position = node.position || new THREE.Vector3(0, 0, 0);
        sprite.position.copy(position);
        sprite.position.z += 0.5; // Offset slightly in front
        sprite.scale.set(2, 1, 1); // Adjust size

        this.sprites.set(node.id, sprite);
        this.scene.add(sprite);
      }
    } catch (error) {
      logger.warn(
        '[ServerGraphRenderer] Could not create label sprites (canvas unavailable):',
        error
      );
      // Continue without labels - still functional for streaming
    }
  }

  /**
   * Create canvas texture with node label text
   * Returns null if canvas is unavailable
   */
  private createLabelCanvas(text: string, size: number = 64): HTMLCanvasElement | null {
    try {
      let canvas: any;

      if (typeof document !== 'undefined') {
        // Browser environment
        canvas = document.createElement('canvas');
      } else {
        // Node.js environment - try to use canvas package if available
        try {
          const canvasModule = require('canvas');
          canvas = canvasModule.createCanvas(512, 64);
        } catch (e) {
          // Canvas module not available - return null
          return null;
        }
      }

      canvas.width = 512;
      canvas.height = 64;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Clear with transparent background
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);

      return canvas;
    } catch (error) {
      logger.warn('[ServerGraphRenderer] Failed to create label canvas:', error);
      return null;
    }
  }

  /**
   * Update renderer state (node colors, scales, visibility)
   */
  updateState(newState: Partial<SceneState>): void {
    this.currentState = { ...this.currentState, ...newState };

    // Only update colors if state actually changed (optimization)
    const stateChanged =
      this.currentState.activeNodePath !== this.prevState.activeNodePath ||
      this.currentState.hoveredNodeId !== this.prevState.hoveredNodeId ||
      this.currentState.selectedNodeId !== this.prevState.selectedNodeId ||
      this.currentState.searchQuery !== this.prevState.searchQuery;

    if (stateChanged && this.instancedNodes) {
      this.updateNodeColorsAndScales();
      this.prevState = { ...this.currentState };
    }

    // Update label visibility based on zoom (LOD optimization)
    this.updateLabelVisibility();
  }

  /**
   * Update node colors and scales based on current state
   * Mirrors DependencyGraphViewer lines 653-726
   */
  private updateNodeColorsAndScales(): void {
    if (!this.instancedNodes) return;

    const nodeUpdaters = {
      updateNodeColor: (nodeId: string, color: number) => {
        const index = this.nodeIndexMap.get(nodeId);
        if (index !== undefined) {
          const tempColor = new THREE.Color(color);
          this.instancedNodes!.setColorAt(index, tempColor);
        }
      },
      updateNodeScale: (nodeId: string, scale: number) => {
        const index = this.nodeIndexMap.get(nodeId);
        if (index !== undefined) {
          const node = this.nodes[index];
          if (node) {
            const tempMatrix = new THREE.Matrix4();
            const pos = node.position || new THREE.Vector3(0, 0, 0);
            tempMatrix.makeTranslation(pos.x, pos.y, pos.z);
            tempMatrix.scale(new THREE.Vector3(scale, scale, scale));
            this.instancedNodes!.setMatrixAt(index, tempMatrix);
          }
        }
      },
    };

    // Color constants (from optimized-graph-renderer.ts and DependencyGraphViewer)
    const NODE_COLORS = {
      active: 0xffff00, // Bright yellow
      selected: 0x3b82f6, // Blue
      hovered: 0x06b6d4, // Cyan
      temperature_hot: 0xf97316, // Orange (>15)
      temperature_warm: 0xeab308, // Yellow (5-15)
      temperature_cool: 0x06b6d4, // Cyan (1-4)
      default: 0x3b82f6, // Blue
      virtual: 0xa855f7, // Purple
      filtered: 0x4b5563, // Gray
    };

    // Update each node's color and scale
    this.nodes.forEach((node, index) => {
      let color = NODE_COLORS.default;
      let scale = 1.0;

      const isVirtual = node.type === 'virtual';
      const isActive = this.currentState.activeNodePath === node.id;
      const isSelected = this.currentState.selectedNodeId === node.id;
      const isHovered = this.currentState.hoveredNodeId === node.id;
      const isFiltered = this.currentState.filterOutput && !this.isNodeOutputRelevant(node.id);
      const matchesSearch =
        !this.currentState.filterBySearch ||
        node.name.toLowerCase().includes(this.currentState.searchQuery.toLowerCase());

      if (isVirtual) {
        color = NODE_COLORS.virtual;
      } else if (isActive) {
        color = NODE_COLORS.active;
        scale = 1.4;
      } else if (isSelected) {
        color = NODE_COLORS.selected;
        scale = 1.2;
      } else if (isHovered) {
        color = NODE_COLORS.hovered;
        scale = 1.1;
      } else {
        // Check temperature
        const temperature = this.currentState.runtimeTemperature.get(node.id) || 0;
        if (temperature > 15) {
          color = NODE_COLORS.temperature_hot;
        } else if (temperature >= 5) {
          color = NODE_COLORS.temperature_warm;
        } else if (temperature > 0) {
          color = NODE_COLORS.temperature_cool;
        } else {
          color = NODE_COLORS.default;
        }
      }

      if (isFiltered) {
        color = NODE_COLORS.filtered;
        scale *= 0.8;
      }

      if (!matchesSearch) {
        color = NODE_COLORS.filtered;
        scale *= 0.8;
      }

      nodeUpdaters.updateNodeColor(node.id, color);
      nodeUpdaters.updateNodeScale(node.id, scale);
    });

    if (this.instancedNodes.instanceColor) {
      this.instancedNodes.instanceColor.needsUpdate = true;
    }
    this.instancedNodes.instanceMatrix.needsUpdate = true;
  }

  /**
   * Check if a node's output is relevant (not filtered)
   */
  private isNodeOutputRelevant(nodeId: string): boolean {
    // Placeholder: In real implementation, check if node has relevant output
    // Based on graph connectivity and active nodes
    return true;
  }

  /**
   * Update label visibility based on camera distance (LOD)
   */
  private updateLabelVisibility(): void {
    const zoomLevel = this.camera.position.length();
    const HIDE_ALL_DISTANCE = 50;
    const SHOW_HOVERED_ONLY_DISTANCE = 25;

    this.sprites.forEach((sprite, nodeId) => {
      if (zoomLevel > HIDE_ALL_DISTANCE) {
        sprite.visible = false;
      } else if (zoomLevel > SHOW_HOVERED_ONLY_DISTANCE) {
        sprite.visible = nodeId === this.currentState.hoveredNodeId;
      } else {
        sprite.visible = true;
      }
    });
  }

  /**
   * Update camera position (for navigation/zoom)
   */
  setCameraPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
  }

  /**
   * Update camera look-at target
   */
  setCameraTarget(x: number, y: number, z: number): void {
    this.camera.lookAt(x, y, z);
  }

  /**
   * Capture current frame as RGBA buffer
   */
  captureFrame(): Buffer {
    // Render to target
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.camera);

    // Read pixels from GPU
    this.renderer.readRenderTargetPixels(
      this.renderTarget,
      0,
      0,
      this.width,
      this.height,
      this.frameBuffer
    );

    return Buffer.from(this.frameBuffer);
  }

  /**
   * Main render loop - call repeatedly at target FPS
   */
  render(): void {
    // Update colors/scales if state changed
    this.updateNodeColorsAndScales();

    // Update label visibility
    this.updateLabelVisibility();

    // Render scene to frame buffer
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Get current frame buffer without rendering
   */
  getFrameBuffer(): Buffer {
    this.renderer.readRenderTargetPixels(
      this.renderTarget,
      0,
      0,
      this.width,
      this.height,
      this.frameBuffer
    );
    return Buffer.from(this.frameBuffer);
  }

  /**
   * Cleanup and dispose resources
   */
  dispose(): void {
    // Dispose sprites
    this.sprites.forEach(sprite => {
      if (sprite.material instanceof THREE.SpriteMaterial && sprite.material.map) {
        sprite.material.map.dispose();
        sprite.material.dispose();
      }
      this.scene.remove(sprite);
    });
    this.sprites.clear();

    // Dispose instanced nodes
    if (this.instancedNodes) {
      this.instancedNodes.geometry.dispose();
      const nodeMaterial = this.instancedNodes.material;
      if (Array.isArray(nodeMaterial)) {
        nodeMaterial.forEach(m => m.dispose());
      } else {
        nodeMaterial.dispose();
      }
      this.scene.remove(this.instancedNodes);
    }

    // Dispose batched edges
    if (this.batchedEdges) {
      this.batchedEdges.lineSegments.forEach((lines: THREE.LineSegments) => {
        lines.geometry.dispose();
        const material = lines.material;
        if (Array.isArray(material)) {
          material.forEach(m => m.dispose());
        } else {
          material.dispose();
        }
        this.scene.remove(lines);
      });
      this.batchedEdges.arrowInstances.geometry.dispose();
      const arrowMaterial = this.batchedEdges.arrowInstances.material;
      if (Array.isArray(arrowMaterial)) {
        arrowMaterial.forEach(m => m.dispose());
      } else {
        arrowMaterial.dispose();
      }
      this.scene.remove(this.batchedEdges.arrowInstances);
    }

    // Dispose render target
    this.renderTarget.dispose();

    // Dispose renderer
    this.renderer.dispose();
  }
}
