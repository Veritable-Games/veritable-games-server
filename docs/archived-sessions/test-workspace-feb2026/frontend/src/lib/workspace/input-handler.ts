/**
 * Input Handler
 *
 * Handles mouse and touch input for canvas interactions.
 * Supports pan, zoom, node dragging, and selection.
 *
 * Features:
 * - Mouse wheel zoom with ctrl/cmd key
 * - Mouse drag for pan
 * - Touch support (pinch zoom, two-finger pan)
 * - Node dragging and selection
 * - Keyboard shortcuts
 */

import { TransformManager } from './transform-manager';
import { Point, isNodeLocked } from './types';
import { NodeId } from './branded-types';
import { BoundingBox, isPointInBoundingBox } from './bounding-box-utils';
import { useWorkspaceStore } from '@/stores/workspace';
import { logger } from '@/lib/utils/logger';

export interface InputHandlerConfig {
  zoomSensitivity: number;
  panButton: number; // Mouse button for pan (0 = left, 1 = middle, 2 = right)
  minDragDistance: number; // Minimum pixels to consider a drag
}

export const DEFAULT_INPUT_CONFIG: InputHandlerConfig = {
  zoomSensitivity: 1.0,
  panButton: 1, // Middle mouse button for pan
  minDragDistance: 10, // Increased from 3 to 10px to tolerate natural hand jitter during double-click
};

export interface InputCallbacks {
  onNodeClick?: (nodeId: string, event: MouseEvent | TouchEvent) => void;
  onNodeDragStart?: (nodeId: string, canvasPos: Point) => void;
  onNodeDragMove?: (nodeId: string, canvasPos: Point, delta: Point) => void;
  onNodeDragEnd?: (nodeId: string, canvasPos: Point) => void;
  onCanvasClick?: (canvasPos: Point, event: MouseEvent | TouchEvent) => void;
  onCanvasRightClick?: (screenPos: Point, canvasPos: Point) => void;
  onSelectionBox?: (start: Point, end: Point) => void;
  onSelectionBoxUpdate?: (start: Point, end: Point) => void; // Live updates during drag
  onSelectionBoxEnd?: (
    start: Point,
    end: Point,
    modifiers: { shift: boolean; ctrl: boolean }
  ) => void; // Finalize selection with modifier keys
  onTransformChange?: () => void;
  isNodeEditing?: (nodeId: string) => boolean; // Check if a node is currently being edited
  getSelectionBoundingBox?: () => { boundingBox: BoundingBox; firstNodeId: string } | null; // Get current selection bounding box on-demand
}

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  button: number;
  target: 'canvas' | 'node' | 'marquee';
  nodeId?: string;
  hasMoved: boolean;
}

interface TouchState {
  touches: Map<number, { x: number; y: number }>;
  initialDistance?: number;
  initialScale?: number;
}

export class InputHandler {
  private container: HTMLElement;
  private transformManager: TransformManager;
  private config: InputHandlerConfig;
  private callbacks: InputCallbacks;

  // PHASE 2.2: Drag state now lives in Zustand store (no local dragState)
  // This eliminates orphaned state issues by having a single source of truth
  private touchState: TouchState = { touches: new Map() };

  // AbortController for clean event listener removal
  // Using AbortController guarantees ALL listeners are removed when destroy() is called
  private abortController: AbortController;

  private isSpacePressed: boolean = false;
  private isCtrlPressed: boolean = false;
  private isShiftPressed: boolean = false;
  private currentCursor: string = 'default';

  constructor(
    container: HTMLElement,
    transformManager: TransformManager,
    callbacks: InputCallbacks = {},
    config: Partial<InputHandlerConfig> = {}
  ) {
    this.container = container;
    this.transformManager = transformManager;
    this.callbacks = callbacks;
    this.config = { ...DEFAULT_INPUT_CONFIG, ...config };

    // Initialize AbortController for clean listener removal
    this.abortController = new AbortController();

    this.attachEventListeners();
  }

  /**
   * Helper: Get current drag state from Zustand
   */
  private getDragState() {
    const state = useWorkspaceStore.getState();
    return {
      isDragging: state.isDragging,
      dragTarget: state.dragTarget,
      dragNodeId: state.dragNodeId,
      dragStartScreenPos: state.dragStartScreenPos,
      dragLastScreenPos: state.dragLastScreenPos,
      dragHasMoved: state.dragHasMoved,
      dragButton: state.dragButton,
    };
  }

  /**
   * Attach all event listeners
   * Uses AbortController signal for guaranteed cleanup on destroy()
   */
  private attachEventListeners(): void {
    const { signal } = this.abortController;

    // Mouse events on container
    this.container.addEventListener('mousedown', this.handleMouseDown, { signal });
    this.container.addEventListener('mousemove', this.handleMouseMove, { signal });
    this.container.addEventListener('mouseup', this.handleMouseUp, { signal });
    this.container.addEventListener('mouseleave', this.handleMouseLeave, { signal });
    this.container.addEventListener('wheel', this.handleWheel, { signal, passive: false });

    // Document-level mouse events for tracking outside container
    // This allows marquee selection to work even when mouse leaves bounds
    document.addEventListener('mousemove', this.handleMouseMove, { signal });
    document.addEventListener('mouseup', this.handleMouseUp, { signal });

    // Touch events
    this.container.addEventListener('touchstart', this.handleTouchStart, {
      signal,
      passive: false,
    });
    this.container.addEventListener('touchmove', this.handleTouchMove, { signal, passive: false });
    this.container.addEventListener('touchend', this.handleTouchEnd, { signal });
    this.container.addEventListener('touchcancel', this.handleTouchEnd, { signal });

    // Keyboard events
    window.addEventListener('keydown', this.handleKeyDown, { signal });
    window.addEventListener('keyup', this.handleKeyUp, { signal });

    // Conditionally prevent context menu (only on canvas background)
    // Note: Using signal ensures this anonymous handler is also cleaned up
    this.container.addEventListener(
      'contextmenu',
      e => {
        const nodeElement = (e.target as HTMLElement).closest('[data-node-id]');
        if (!nodeElement) {
          e.preventDefault(); // Prevent context menu on empty canvas
        }
      },
      { signal }
    );
  }

  /**
   * Remove all event listeners
   * AbortController.abort() removes ALL listeners that were registered with its signal
   */
  destroy(): void {
    this.abortController.abort();
  }

  // ========================================================================
  // Mouse Event Handlers
  // ========================================================================

  private handleMouseDown = (e: MouseEvent): void => {
    const rect = this.container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const target = e.target as HTMLElement;

    // PHASE 2.2: Check Zustand state instead of local dragState
    const currentDragState = this.getDragState();
    logger.info('[InputHandler] === MOUSEDOWN ===', {
      button: e.button,
      screenPos: { x: screenX, y: screenY },
      target: target.tagName,
      targetClass: target.className,
      currentDragState: currentDragState.dragStartScreenPos ? 'EXISTS' : 'NULL',
    });

    // Check for right-click on canvas background
    if (e.button === 2) {
      e.preventDefault(); // Prevent default context menu
      const nodeElement = target.closest('[data-node-id]') as HTMLElement | null;
      if (!nodeElement) {
        // Right-click on empty canvas - show context menu
        const canvasPos = this.transformManager.screenToCanvas(screenX, screenY);
        this.callbacks.onCanvasRightClick?.(
          { x: e.clientX, y: e.clientY }, // Screen coords for menu positioning
          canvasPos // Canvas coords for node creation
        );
        return; // Don't start drag state
      }
      // If right-click on node, do nothing (node's own context menu or no action)
      return;
    }

    // Priority 1: Check for node body
    const nodeElement = target.closest('[data-node-id]') as HTMLElement | null;
    const nodeId = nodeElement?.dataset.nodeId;

    logger.info('[InputHandler] Node detection:', {
      found: !!nodeElement,
      nodeId: nodeId,
    });

    if (nodeId) {
      // Don't allow drag if node is being edited (user is selecting text)
      if (this.callbacks.isNodeEditing?.(nodeId)) {
        logger.info('[InputHandler] Node is being edited - SKIP');
        return; // Skip drag entirely - let the editor handle mouse events
      }

      // Don't allow drag if node is locked
      const store = useWorkspaceStore.getState();
      const node = store.getNode(nodeId as NodeId);
      if (node && isNodeLocked(node)) {
        logger.info('[InputHandler] Node is locked - SKIP drag');
        return; // Skip drag entirely - locked nodes cannot be moved
      }

      // Don't drag nodes with middle mouse button - use it for panning instead
      if (e.button === this.config.panButton) {
        e.preventDefault(); // Prevent middle-click default behavior
        logger.info('[InputHandler] Middle mouse on node - fall through to pan');
        // Fall through to canvas pan mode
      } else {
        // DON'T call preventDefault() here - allows dblclick events to work
        // DON'T set isDragging yet - wait for actual movement to allow double-click
        logger.info('[InputHandler] Initiating node drag:', nodeId);
        const canvasPos = this.transformManager.screenToCanvas(screenX, screenY);

        // PHASE 3.2: Calculate click offset (difference between click and node position)
        const store = useWorkspaceStore.getState();
        const node = store.getNode(nodeId as NodeId);
        const clickOffset = node
          ? { x: canvasPos.x - node.position.x, y: canvasPos.y - node.position.y }
          : undefined;

        // PHASE 2.2: Delegate to Zustand instead of managing local dragState
        store.initiateDrag(
          'node',
          { x: screenX, y: screenY }, // Screen position
          canvasPos, // Canvas position
          nodeId as NodeId, // NodeId (branded type)
          e.button,
          clickOffset
        );

        // Don't call onNodeDragStart yet - wait for movement
        return;
      }
    }

    // Priority 2: Check if click is inside selection bounding box (for group drag)
    // Only for left-click, and only if we have multiple selected nodes
    if (e.button === 0) {
      const selectionData = this.callbacks.getSelectionBoundingBox?.();

      if (selectionData) {
        // Convert screen coords to canvas coords for bounding box check
        const canvasPos = this.transformManager.screenToCanvas(screenX, screenY);

        if (isPointInBoundingBox(canvasPos, selectionData.boundingBox)) {
          logger.info('[InputHandler] Initiating group drag');

          // PHASE 3.2: Calculate click offset for first selected node
          const store = useWorkspaceStore.getState();
          const firstNode = store.getNode(selectionData.firstNodeId as NodeId);
          const clickOffset = firstNode
            ? { x: canvasPos.x - firstNode.position.x, y: canvasPos.y - firstNode.position.y }
            : undefined;

          // PHASE 2.2: Delegate to Zustand
          store.initiateDrag(
            'node',
            { x: screenX, y: screenY },
            canvasPos,
            selectionData.firstNodeId as NodeId,
            e.button,
            clickOffset
          );

          // Don't call onNodeDragStart yet - wait for movement
          return;
        }
      }
    }

    // Priority 3: Empty canvas
    // Only allow panning with middle mouse button or space+drag
    if (e.button === this.config.panButton || this.isSpacePressed) {
      e.preventDefault(); // Prevent text selection during canvas pan
      const canvasPos = this.transformManager.screenToCanvas(screenX, screenY);
      logger.info('[InputHandler] Initiating canvas pan');

      // PHASE 2.2: Delegate to Zustand
      useWorkspaceStore
        .getState()
        .initiateDrag('canvas', { x: screenX, y: screenY }, canvasPos, undefined, e.button);

      // Set cursor for panning
      this.setCursor('grabbing');
    } else if (e.button === 0) {
      // Left click on empty canvas - start marquee selection
      const canvasPos = this.transformManager.screenToCanvas(screenX, screenY);
      logger.info('[InputHandler] Initiating marquee selection');

      // PHASE 2.2: Delegate to Zustand
      useWorkspaceStore
        .getState()
        .initiateDrag('marquee', { x: screenX, y: screenY }, canvasPos, undefined, e.button);

      // Don't call onCanvasClick yet - wait to see if it's a click or drag
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    // PHASE 2.2: Check Zustand state instead of local dragState
    const dragState = this.getDragState();
    if (!dragState.dragStartScreenPos) {
      return; // No drag in progress
    }

    const rect = this.container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasPos = this.transformManager.screenToCanvas(screenX, screenY);

    // PHASE 2.2: Capture state BEFORE continueDrag
    const wasMovedBefore = dragState.dragHasMoved;
    const wasDraggingBefore = dragState.isDragging;

    // PHASE 2.2: Delegate to Zustand for threshold checking and state updates
    // Use different thresholds for different drag targets (marquee needs lower threshold)
    const minDragDistance =
      dragState.dragTarget === 'marquee'
        ? 3 // Lower threshold for selection box (more responsive)
        : this.config.minDragDistance; // Keep 10px for node/canvas drag

    useWorkspaceStore.getState().continueDrag({ x: screenX, y: screenY }, canvasPos, {
      minDragDistance,
    });

    // PHASE 2.2: Get updated state after continueDrag
    const dragStateAfter = this.getDragState();

    // Log movement for debugging
    const totalDeltaX = screenX - dragState.dragStartScreenPos.x;
    const totalDeltaY = screenY - dragState.dragStartScreenPos.y;
    const distance = Math.sqrt(totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY);
    logger.info('[InputHandler] mousemove:', {
      distance,
      threshold: this.config.minDragDistance,
      hasMoved: dragStateAfter.dragHasMoved,
      isDragging: dragStateAfter.isDragging,
      target: dragStateAfter.dragTarget,
    });

    // Fire callbacks when transitioning from threshold to active drag
    if (
      !wasMovedBefore &&
      dragStateAfter.dragHasMoved &&
      dragStateAfter.dragTarget === 'node' &&
      dragStateAfter.dragNodeId
    ) {
      logger.info('[InputHandler] === NODE DRAG STARTED ===', dragStateAfter.dragNodeId);
      this.callbacks.onNodeDragStart?.(dragStateAfter.dragNodeId, canvasPos);
    }

    // Handle based on drag target
    if (!dragStateAfter.dragHasMoved) {
      // Below threshold - don't do anything yet
      return;
    }

    if (dragStateAfter.dragTarget === 'node' && dragStateAfter.dragNodeId) {
      // Calculate delta for callback (screen delta converted to canvas delta)
      const lastPos = dragState.dragLastScreenPos || dragState.dragStartScreenPos;
      const deltaX = screenX - lastPos.x;
      const deltaY = screenY - lastPos.y;
      const canvasDelta = {
        x: deltaX / this.transformManager.getZoom(),
        y: deltaY / this.transformManager.getZoom(),
      };
      this.callbacks.onNodeDragMove?.(dragStateAfter.dragNodeId, canvasPos, canvasDelta);
    } else if (dragStateAfter.dragTarget === 'marquee') {
      // Marquee selection - send screen coordinates for visual rendering
      const containerWidth = this.container.clientWidth;
      const containerHeight = this.container.clientHeight;

      const clampedX = Math.max(0, Math.min(screenX, containerWidth));
      const clampedY = Math.max(0, Math.min(screenY, containerHeight));

      const start = dragState.dragStartScreenPos;
      const end = { x: clampedX, y: clampedY };
      this.callbacks.onSelectionBoxUpdate?.(start, end);
      this.setCursor('crosshair');
    } else if (dragStateAfter.dragTarget === 'canvas') {
      // Canvas panning
      const lastPos = dragState.dragLastScreenPos || dragState.dragStartScreenPos;
      const deltaX = screenX - lastPos.x;
      const deltaY = screenY - lastPos.y;

      this.transformManager.panInstant(deltaX, deltaY);
      this.callbacks.onTransformChange?.();
      this.setCursor('grabbing');
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    // PHASE 2.2: Get drag state from Zustand
    const dragState = this.getDragState();

    logger.info('[InputHandler] === MOUSEUP ===', {
      hasDragState: !!dragState.dragStartScreenPos,
      dragState: dragState.dragStartScreenPos
        ? {
            hasMoved: dragState.dragHasMoved,
            isDragging: dragState.isDragging,
            target: dragState.dragTarget,
            nodeId: dragState.dragNodeId,
          }
        : null,
    });

    if (!dragState.dragStartScreenPos) return;

    const rect = this.container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasPos = this.transformManager.screenToCanvas(screenX, screenY);

    // Handle click vs drag
    if (!dragState.dragHasMoved) {
      logger.info('[InputHandler] Click event (no movement)');
      // Click event (no movement)
      if (dragState.dragNodeId) {
        this.callbacks.onNodeClick?.(dragState.dragNodeId, e);
      } else if (dragState.dragTarget === 'marquee') {
        // Single click on empty canvas - deselect
        this.callbacks.onCanvasClick?.(canvasPos, e);
      } else {
        this.callbacks.onCanvasClick?.(canvasPos, e);
      }
    } else {
      logger.info('[InputHandler] Drag end (movement occurred)');
      // Drag end (movement occurred)
      if (dragState.dragTarget === 'node' && dragState.dragNodeId) {
        // Finish node drag
        logger.info('[InputHandler] Calling onNodeDragEnd for:', dragState.dragNodeId);
        this.callbacks.onNodeDragEnd?.(dragState.dragNodeId, canvasPos);
      } else if (dragState.dragTarget === 'marquee') {
        // Finish marquee selection - send screen coordinates with modifier keys
        const start = dragState.dragStartScreenPos;
        const end = { x: screenX, y: screenY };
        const modifiers = {
          shift: this.isShiftPressed,
          ctrl: this.isCtrlPressed,
        };
        this.callbacks.onSelectionBoxEnd?.(start, end, modifiers);
      }
      // Canvas panning doesn't need a drag end callback
    }

    logger.info('[InputHandler] Clearing drag state via Zustand');
    // PHASE 2.2: Delegate to Zustand instead of clearing local state
    useWorkspaceStore.getState().completeDrag();
    this.resetCursor();
  };

  private handleMouseLeave = (e: MouseEvent): void => {
    // PHASE 2.2: Get drag state from Zustand
    const dragState = this.getDragState();

    // Only finalize marquee if we're actively dragging
    if (dragState.dragTarget === 'marquee' && dragState.dragStartScreenPos) {
      // Clamp final marquee position to container bounds before finalizing
      const containerWidth = this.container.clientWidth;
      const containerHeight = this.container.clientHeight;

      const rect = this.container.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const clampedX = Math.max(0, Math.min(screenX, containerWidth));
      const clampedY = Math.max(0, Math.min(screenY, containerHeight));

      const start = dragState.dragStartScreenPos;
      const end = { x: clampedX, y: clampedY };
      const modifiers = {
        shift: this.isShiftPressed,
        ctrl: this.isCtrlPressed,
      };

      // Finalize selection with clamped coordinates
      this.callbacks.onSelectionBoxEnd?.(start, end, modifiers);
    }

    // Clear drag state and reset cursor for any drag type
    if (dragState.dragStartScreenPos) {
      // PHASE 2.2: Delegate to Zustand instead of clearing local state
      useWorkspaceStore.getState().clearDrag();
      this.resetCursor();
    }
  };

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();

    const rect = this.container.getBoundingClientRect();
    const centerX = e.clientX - rect.left;
    const centerY = e.clientY - rect.top;

    // Normalize wheel delta to match button zoom effectiveness
    // Buttons use ±100, so we scale the wheel delta similarly
    const delta = -Math.sign(e.deltaY) * 100 * this.config.zoomSensitivity;

    // Use instant zoom for snappy, responsive feel
    this.transformManager.zoomInstant(delta, centerX, centerY);
    this.callbacks.onTransformChange?.();
  };

  // ========================================================================
  // Touch Event Handlers
  // ========================================================================

  private handleTouchStart = (e: TouchEvent): void => {
    e.preventDefault();

    // Store all touches
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches.item(i);
      if (touch) {
        const rect = this.container.getBoundingClientRect();
        this.touchState.touches.set(touch.identifier, {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        });
      }
    }

    // Two-finger pinch zoom initialization
    if (this.touchState.touches.size === 2) {
      const touches = Array.from(this.touchState.touches.values());
      if (touches.length === 2 && touches[0] && touches[1]) {
        const dx = touches[0].x - touches[1].x;
        const dy = touches[0].y - touches[1].y;
        this.touchState.initialDistance = Math.sqrt(dx * dx + dy * dy);
        this.touchState.initialScale = this.transformManager.getZoom();
      }
    }
  };

  private handleTouchMove = (e: TouchEvent): void => {
    e.preventDefault();

    const rect = this.container.getBoundingClientRect();

    // Update touch positions
    const currentTouches = new Map<number, { x: number; y: number }>();
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches.item(i);
      if (touch) {
        currentTouches.set(touch.identifier, {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        });
      }
    }

    // Two-finger pan and zoom
    if (this.touchState.touches.size === 2 && currentTouches.size === 2) {
      const prevTouches = Array.from(this.touchState.touches.values());
      const currTouches = Array.from(currentTouches.values());

      if (prevTouches.length === 2 && currTouches.length === 2) {
        // Calculate pinch zoom
        const prevDx = prevTouches[0]!.x - prevTouches[1]!.x;
        const prevDy = prevTouches[0]!.y - prevTouches[1]!.y;
        const prevDist = Math.sqrt(prevDx * prevDx + prevDy * prevDy);

        const currDx = currTouches[0]!.x - currTouches[1]!.x;
        const currDy = currTouches[0]!.y - currTouches[1]!.y;
        const currDist = Math.sqrt(currDx * currDx + currDy * currDy);

        if (this.touchState.initialDistance && this.touchState.initialScale) {
          const scale = (currDist / this.touchState.initialDistance) * this.touchState.initialScale;
          const centerX = (currTouches[0]!.x + currTouches[1]!.x) / 2;
          const centerY = (currTouches[0]!.y + currTouches[1]!.y) / 2;
          this.transformManager.setZoom(scale, centerX, centerY);
          this.callbacks.onTransformChange?.();
        }

        // Calculate pan
        const prevCenterX = (prevTouches[0]!.x + prevTouches[1]!.x) / 2;
        const prevCenterY = (prevTouches[0]!.y + prevTouches[1]!.y) / 2;
        const currCenterX = (currTouches[0]!.x + currTouches[1]!.x) / 2;
        const currCenterY = (currTouches[0]!.y + currTouches[1]!.y) / 2;

        const deltaX = currCenterX - prevCenterX;
        const deltaY = currCenterY - prevCenterY;

        // Use instant pan for responsive touch panning
        this.transformManager.panInstant(deltaX, deltaY);
        this.callbacks.onTransformChange?.();
      }
    }
    // Single-finger pan
    else if (this.touchState.touches.size === 1 && currentTouches.size === 1) {
      const prevTouch = Array.from(this.touchState.touches.values())[0];
      const currTouch = Array.from(currentTouches.values())[0];

      if (prevTouch && currTouch) {
        const deltaX = currTouch.x - prevTouch.x;
        const deltaY = currTouch.y - prevTouch.y;

        // Use instant pan for responsive touch panning
        this.transformManager.panInstant(deltaX, deltaY);
        this.callbacks.onTransformChange?.();
      }
    }

    this.touchState.touches = currentTouches;
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    // Remove ended touches
    const activeTouchIds = new Set<number>();
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches.item(i);
      if (touch) {
        activeTouchIds.add(touch.identifier);
      }
    }

    for (const id of this.touchState.touches.keys()) {
      if (!activeTouchIds.has(id)) {
        this.touchState.touches.delete(id);
      }
    }

    // Reset pinch state when not two fingers
    if (this.touchState.touches.size !== 2) {
      this.touchState.initialDistance = undefined;
      this.touchState.initialScale = undefined;
    }
  };

  // ========================================================================
  // Keyboard Event Handlers
  // ========================================================================

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space') {
      this.isSpacePressed = true;
    }
    if (e.ctrlKey || e.metaKey) {
      this.isCtrlPressed = true;
    }
    if (e.shiftKey) {
      this.isShiftPressed = true;
    }

    // Keyboard shortcuts
    if (this.isCtrlPressed || e.metaKey) {
      switch (e.code) {
        case 'Equal': // Ctrl/Cmd + =
        case 'NumpadAdd':
          e.preventDefault();
          this.zoomIn();
          break;
        case 'Minus': // Ctrl/Cmd + -
        case 'NumpadSubtract':
          e.preventDefault();
          this.zoomOut();
          break;
        case 'Digit0': // Ctrl/Cmd + 0
        case 'Numpad0':
          e.preventDefault();
          this.resetZoom();
          break;
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Space') {
      this.isSpacePressed = false;
    }
    if (!e.ctrlKey && !e.metaKey) {
      this.isCtrlPressed = false;
    }
    if (!e.shiftKey) {
      this.isShiftPressed = false;
    }
  };

  // ========================================================================
  // Public Methods
  // ========================================================================

  /**
   * Zoom in around viewport center (smooth animation)
   */
  zoomIn(): void {
    const rect = this.container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    // Use smooth zoom for better UX
    this.transformManager.zoom(100, centerX, centerY);
    this.callbacks.onTransformChange?.();
  }

  /**
   * Zoom out around viewport center (smooth animation)
   */
  zoomOut(): void {
    const rect = this.container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    // Use smooth zoom for better UX
    this.transformManager.zoom(-100, centerX, centerY);
    this.callbacks.onTransformChange?.();
  }

  /**
   * Reset zoom to 100% (smooth animation)
   */
  resetZoom(): void {
    const rect = this.container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    // Use smooth zoom for better UX
    this.transformManager.setZoom(1.0, centerX, centerY);
    this.callbacks.onTransformChange?.();
  }

  /**
   * Check if currently dragging
   */
  isDragging(): boolean {
    // PHASE 2.2: Check Zustand state
    return useWorkspaceStore.getState().isDragging;
  }

  /**
   * Cancel current drag operation (for escape key)
   */
  cancelDrag(): void {
    // PHASE 2.2: Delegate to Zustand
    const dragState = this.getDragState();
    if (dragState.dragStartScreenPos) {
      useWorkspaceStore.getState().clearDrag();
      this.resetCursor();
    }
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: InputCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // ========================================================================
  // Drag State Timeout Management (Deprecated - Phase 2.2)
  // ========================================================================
  // NOTE: Watchdog timers are no longer needed since drag state is managed by
  // Zustand. The unified state prevents orphaned drag state by design.
  // These methods are kept as stubs for backward compatibility.

  /**
   * Reset the watchdog timer for drag state (no longer used in Phase 2.2)
   */
  private resetDragTimeout(): void {
    // PHASE 2.2: Drag state is now in Zustand - no orphaned state possible
  }

  /**
   * Cancel the watchdog timer (no longer used in Phase 2.2)
   */
  private clearDragTimeout(): void {
    // PHASE 2.2: Drag state is now in Zustand - no cleanup needed
  }

  // ========================================================================
  // Cursor Management
  // ========================================================================

  /**
   * Set cursor style
   */
  private setCursor(cursor: string): void {
    this.currentCursor = cursor;
    this.container.style.cursor = cursor;
  }

  /**
   * Reset cursor to default
   */
  private resetCursor(): void {
    this.currentCursor = 'default';
    this.container.style.cursor = 'default';
  }
}
