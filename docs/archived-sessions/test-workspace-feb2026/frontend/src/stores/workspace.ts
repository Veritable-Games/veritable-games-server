/**
 * Workspace Canvas Store (with Yjs Real-Time Collaboration)
 *
 * Zustand store for managing infinite canvas state with CRDT synchronization.
 * Handles nodes, connections, viewport, and selection state with real-time collaboration.
 *
 * Architecture:
 * - Yjs Y.Doc: Source of truth for nodes, connections (synced across users)
 * - Zustand Store: Reactive UI layer (subscribes to Yjs changes)
 * - Local-only: Viewport, selection, drag, pan state (NOT synced)
 *
 * CRITICAL: Viewport (pan/zoom) is LOCAL to each user. Do NOT sync via Yjs!
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { useShallow } from 'zustand/react/shallow';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import {
  setupYjsDocument,
  setupWebSocketProvider,
  setupIndexedDBPersistence,
  setupAwareness,
  setupUndoManager,
} from '@/lib/workspace/yjs-setup';
import { UndoManager } from 'yjs';
import {
  CanvasNode,
  Connection,
  Point,
  ContextMenuState,
  ContextMenuItem,
  ContextMenuContext,
  isNodeLocked,
  hasLockedNodes,
  getUnlockedNodes,
} from '@/lib/workspace/types';
import { NodeId, ConnectionId, WorkspaceId } from '@/lib/workspace/branded-types';
import { logger } from '@/lib/utils/logger';
import { AwarenessThrottle } from '@/lib/workspace/awareness-throttle';
import { YjsSafeWriter } from '@/lib/workspace/yjs-writer';
import {
  WORKSPACE_FEATURES,
  logFeatureFlags,
  getWebSocketUrl,
} from '@/lib/workspace/feature-flags';
import { debounce } from '@/types/performance';
import { exportToJSON, WorkspaceExportData } from '@/lib/workspace/export-import';
import { importFromCSV, readCSVFile, CSVImportOptions } from '@/lib/workspace/csv-import';
import { fetchWithCSRF } from '@/lib/utils/csrf';
import type { Editor } from '@tiptap/react';
import type { MarkdownEditorAPI } from '@/lib/workspace/markdown-utils';

// Enable Immer MapSet plugin for Map and Set support
enableMapSet();

// ============================================================================
// Helper: Sanitize Node Positions
// ============================================================================

/**
 * Ensures node position values are valid numbers, not strings.
 * This fixes a bug where position values could be strings from:
 * - Database storage (PostgreSQL returning TEXT columns)
 * - Yjs CRDT serialization
 * - IndexedDB persistence
 *
 * String positions cause string concatenation instead of addition during drag.
 */
function sanitizeNode(node: CanvasNode): CanvasNode {
  const x = Number(node.position?.x ?? 0);
  const y = Number(node.position?.y ?? 0);
  const width = Number(node.size?.width ?? 200);
  const height = Number(node.size?.height ?? 100);

  // Check for invalid values (NaN, Infinity)
  const sanitizedX = Number.isFinite(x) ? x : 100;
  const sanitizedY = Number.isFinite(y) ? y : 100;
  const sanitizedWidth = Number.isFinite(width) && width > 0 ? width : 200;
  const sanitizedHeight = Number.isFinite(height) && height > 0 ? height : 100;

  return {
    ...node,
    position: { x: sanitizedX, y: sanitizedY },
    size: { width: sanitizedWidth, height: sanitizedHeight },
  };
}

/**
 * Sanitize node updates - converts position/size values to numbers
 * to prevent string concatenation bugs
 */
function sanitizeUpdates(updates: Partial<CanvasNode>): Partial<CanvasNode> {
  const result: Partial<CanvasNode> = { ...updates };

  if (updates.position) {
    const x = Number(updates.position.x ?? 0);
    const y = Number(updates.position.y ?? 0);
    result.position = {
      x: Number.isFinite(x) ? x : 100,
      y: Number.isFinite(y) ? y : 100,
    };
  }

  if (updates.size) {
    const width = Number(updates.size.width ?? 200);
    const height = Number(updates.size.height ?? 100);
    result.size = {
      width: Number.isFinite(width) && width > 0 ? width : 200,
      height: Number.isFinite(height) && height > 0 ? height : 100,
    };
  }

  return result;
}

// ============================================================================
// State Interface
// ============================================================================

interface CanvasState {
  // Yjs Providers (real-time collaboration infrastructure)
  yjsDoc: Y.Doc | null;
  wsProvider: WebsocketProvider | null;
  indexedDBProvider: IndexeddbPersistence | null;
  awareness: any | null; // Awareness API for presence (cursors, selections)
  awarenessThrottle: AwarenessThrottle | null; // Throttle for cursor/selection updates
  undoManager: UndoManager | null; // Undo/redo manager for workspace operations

  // Yjs Shared Maps (source of truth, synced across users)
  yjsNodes: Y.Map<CanvasNode> | null;
  yjsConnections: Y.Map<Connection> | null;
  // REMOVED: yjsViewport - viewport is now LOCAL ONLY (not synced)

  // Type-safe Yjs write abstraction (Phase 1: Type Safety Infrastructure)
  // Prevents Immer proxy leaks and ensures numeric sanitization
  yjsWriter: YjsSafeWriter | null;

  // Observer cleanup functions (to prevent stale closures)
  yjsObserverCleanups: (() => void)[];

  // Canvas data (local reactive copies, auto-synced from Yjs)
  workspaceId: WorkspaceId | null;
  nodes: Map<string, CanvasNode>;
  connections: Map<string, Connection>;

  // Viewport state (LOCAL ONLY - not synced, each user has independent viewport)
  viewport: {
    offsetX: number;
    offsetY: number;
    scale: number;
  };

  // Selection state (LOCAL ONLY - not synced)
  selectedNodeIds: Set<string>;
  selectedConnectionIds: Set<string>;

  // Clipboard state (LOCAL ONLY - not synced)
  clipboardNodes: CanvasNode[];
  clipboardConnections: Connection[];

  // Interaction state - UNIFIED DRAG STATE (LOCAL ONLY - not synced)
  isDragging: boolean;
  isPanning: boolean;
  dragNodeId: NodeId | null;
  dragStartPos: Point | null;
  dragTarget: 'node' | 'marquee' | 'canvas' | null;
  dragStartScreenPos: Point | null;
  dragLastScreenPos: Point | null;
  dragHasMoved: boolean;
  dragButton: number | null;
  dragClickOffset: Point | null;
  dragInitialNodePositions: Map<string, Point> | null;

  // Context menu state (LOCAL ONLY - not synced)
  contextMenu: ContextMenuState;

  // Collaboration state (derived from awareness)
  remoteCursors: Map<string, { x: number; y: number; color: string; name: string }>;
  remoteSelections: Map<string, Set<string>>;
  isOnline: boolean; // WebSocket connection status
  isSynced: boolean; // Yjs WebSocket sync status
  isIndexedDBSynced: boolean; // IndexedDB persistence sync status (Phase 3)
  isYjsDataReady: boolean; // FIX: Indicates Yjs has loaded initial data (prevents drag race condition)
  isDestroying: boolean; // FIX: Prevents access to Yjs during cleanup (fixes revoked proxy errors)

  // Mode state (LOCAL ONLY - single source of truth for editing/resizing state)
  currentMode: 'idle' | 'editing' | 'dragging' | 'resizing' | 'connecting' | 'panning';
  editingNodeId: NodeId | null;
  editingEditor: Editor | MarkdownEditorAPI | null;
  resizingNodeId: NodeId | null;

  // Actions - Yjs Lifecycle
  initializeYjs: (workspaceId: WorkspaceId, userId: string) => void;
  destroyYjs: () => void;

  // Actions - Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Actions - Mode Management
  enterEditMode: (nodeId: NodeId, editor: Editor | MarkdownEditorAPI) => void;
  exitEditMode: () => void;
  enterResizeMode: (nodeId: NodeId) => void;
  exitResizeMode: () => void;

  // Actions - Export/Import
  exportToJSON: (selectedOnly?: boolean) => WorkspaceExportData | null;
  getExportData: (selectedOnly?: boolean) => { nodes: CanvasNode[]; connections: Connection[] };
  importFromCSVFile: (
    file: File,
    viewportCenter: Point,
    options?: CSVImportOptions
  ) => Promise<{ success: boolean; nodeCount: number; error?: string }>;

  // Actions - Lock/Unlock
  lockNode: (id: NodeId) => void;
  unlockNode: (id: NodeId) => void;
  toggleNodeLock: (id: NodeId) => void;
  lockSelectedNodes: () => void;
  unlockSelectedNodes: () => void;

  // Actions - Workspace
  setWorkspace: (workspaceId: WorkspaceId) => void;
  setWorkspaceId: (workspaceId: WorkspaceId) => void;
  clearWorkspace: () => void;
  loadWorkspace: (workspace: any) => void;
  updateViewport: (viewport: Partial<CanvasState['viewport']>) => void;
  setSelectedNodes: (nodeIds: string[]) => void;

  // Actions - Nodes (now update Yjs)
  addNode: (node: CanvasNode) => void;
  updateNode: (id: NodeId, updates: Partial<CanvasNode>) => void;
  deleteNode: (id: NodeId) => void;
  setNodes: (nodes: CanvasNode[]) => void;

  // Actions - Connections (now update Yjs)
  addConnection: (connection: Connection) => void;
  updateConnection: (id: ConnectionId, updates: Partial<Connection>) => void;
  deleteConnection: (id: ConnectionId) => void;
  setConnections: (connections: Connection[]) => void;
  getConnectionsForNode: (nodeId: NodeId) => Connection[];

  // Actions - Viewport (now update Yjs)
  setViewport: (viewport: Partial<CanvasState['viewport']>) => void;
  panViewport: (deltaX: number, deltaY: number) => void;
  zoomViewport: (delta: number, centerX: number, centerY: number) => void;
  resetViewport: () => void;

  // Actions - Selection (LOCAL ONLY - not synced)
  selectNode: (id: NodeId, multi?: boolean) => void;
  clearSelection: () => void;
  selectMultipleNodes: (ids: NodeId[]) => void;
  selectConnection: (id: ConnectionId, multi?: boolean) => void;
  clearConnectionSelection: () => void;

  // Actions - Clipboard (LOCAL ONLY - not synced)
  copySelectedNodes: () => void;
  cutSelectedNodes: () => void;
  pasteNodes: (viewportCenter: Point) => void;
  hasClipboardData: () => boolean;

  // Actions - Dragging (LOCAL ONLY - not synced)
  initiateDrag: (
    target: 'node' | 'marquee' | 'canvas',
    screenStartPos: Point,
    canvasStartPos: Point,
    nodeId?: NodeId,
    button?: number,
    clickOffset?: Point
  ) => void;
  continueDrag: (
    screenCurrentPos: Point,
    canvasCurrentPos: Point,
    options?: { minDragDistance?: number }
  ) => void;
  completeDrag: () => void;
  clearDrag: () => void;

  // Actions - Panning (LOCAL ONLY - not synced)
  startPan: () => void;
  endPan: () => void;

  // Actions - Context Menu (LOCAL ONLY - not synced)
  showContextMenu: (position: Point, context: ContextMenuContext, items: ContextMenuItem[]) => void;
  hideContextMenu: () => void;
  executeContextMenuAction: (item: ContextMenuItem) => void;

  // Utilities
  getNode: (id: NodeId) => CanvasNode | undefined;
  getSelectedNodes: () => CanvasNode[];
}

// ============================================================================
// Default State
// ============================================================================

const defaultViewport = {
  offsetX: 0,
  offsetY: 0,
  scale: 1.0,
};

// ============================================================================
// Store Creation
// ============================================================================

export const useWorkspaceStore = create<CanvasState>()(
  immer((set, get) => ({
    // Initial Yjs state
    yjsDoc: null,
    wsProvider: null,
    indexedDBProvider: null,
    awareness: null,
    awarenessThrottle: null,
    undoManager: null,
    yjsNodes: null,
    yjsConnections: null,
    yjsWriter: null,
    yjsObserverCleanups: [],

    // Initial state
    workspaceId: null,
    nodes: new Map(),
    connections: new Map(),
    viewport: defaultViewport,
    selectedNodeIds: new Set(),
    selectedConnectionIds: new Set(),
    clipboardNodes: [],
    clipboardConnections: [],
    isDragging: false,
    isPanning: false,
    dragNodeId: null,
    dragStartPos: null,
    dragTarget: null,
    dragStartScreenPos: null,
    dragLastScreenPos: null,
    dragHasMoved: false,
    dragButton: null,
    dragClickOffset: null,
    dragInitialNodePositions: null,
    contextMenu: {
      visible: false,
      position: { x: 0, y: 0 },
      items: [],
      context: null,
    },
    remoteCursors: new Map(),
    remoteSelections: new Map(),
    isOnline: false,
    isSynced: false,
    isIndexedDBSynced: false,
    isYjsDataReady: false,
    isDestroying: false,
    currentMode: 'idle',
    editingNodeId: null,
    editingEditor: null,
    resizingNodeId: null,

    // ========================================================================
    // Yjs Lifecycle Actions
    // ========================================================================

    initializeYjs: (workspaceId: WorkspaceId, userId: string) => {
      // FIX: Prevent initialization if Yjs is currently being destroyed
      // This handles rapid navigation (back button spam) gracefully
      const currentState = get();
      if (currentState.isDestroying) {
        logger.warn(
          '[Yjs Init] Initialization blocked - cleanup in progress (rapid navigation detected)'
        );
        return;
      }

      // FIX: Reset destroying flag on initialization
      set(state => {
        state.isDestroying = false;
      });

      // Log feature flags in development
      if (process.env.NODE_ENV === 'development') {
        logFeatureFlags();
      }

      const { doc, nodes, connections } = setupYjsDocument(workspaceId);

      // FIX: Only create WebSocket provider if feature flag is enabled
      // This prevents "The operation is insecure" DOMException when WebSocket is disabled
      let wsProvider: WebsocketProvider | null = null;
      let awareness: any = null;

      if (WORKSPACE_FEATURES.WEBSOCKET_ENABLED) {
        const wsUrl = getWebSocketUrl();
        if (wsUrl) {
          wsProvider = setupWebSocketProvider(doc, workspaceId, wsUrl);
          // Only setup awareness if WebSocket provider was created successfully
          if (wsProvider) {
            awareness = setupAwareness(wsProvider, userId);
            logger.info('[Yjs] WebSocket provider enabled', { wsUrl });
          } else {
            logger.warn(
              '[Yjs] WebSocket provider creation failed - continuing without real-time sync'
            );
          }
        }
      } else {
        logger.info('[Yjs] WebSocket disabled - offline-only mode');
      }

      const indexedDBProvider = setupIndexedDBPersistence(doc, workspaceId);

      // PHASE 1: Initialize type-safe Yjs writer
      // This prevents Immer proxy leaks and ensures numeric sanitization
      // NOTE: Viewport removed - it's now local-only state
      const writer = new YjsSafeWriter(doc, nodes, connections, null);
      logger.info('[Yjs] YjsSafeWriter initialized - Phase 1 type safety active');

      // PHASE 6: Initialize UndoManager for undo/redo support
      const undoManager = setupUndoManager(doc, nodes, connections);
      logger.info('[Yjs] UndoManager initialized - Ctrl+Z/Ctrl+Shift+Z ready');

      // PHASE 3: Subscribe to IndexedDB sync to track offline data readiness
      // NOTE: Must check if already synced AFTER attaching listener due to race condition
      // The 'synced' event may fire before we attach the listener
      if (indexedDBProvider) {
        indexedDBProvider.on('synced', () => {
          logger.info('[Yjs] IndexedDB synced - offline data ready');
          set(state => {
            state.isIndexedDBSynced = true;
          });
        });

        // Handle race condition: if already synced before listener was attached
        if (indexedDBProvider.synced) {
          logger.info('[Yjs] IndexedDB already synced (race condition handled)');
          set(state => {
            state.isIndexedDBSynced = true;
          });
        }

        // Fallback: If IndexedDB doesn't sync within 3 seconds, continue anyway
        // This prevents workspace from hanging if IndexedDB has issues
        setTimeout(() => {
          const currentState = get();
          if (!currentState.isIndexedDBSynced) {
            logger.warn(
              '[Yjs] IndexedDB sync timeout - continuing without offline data (workspace will still work)'
            );
            set(state => {
              state.isIndexedDBSynced = true;
            });
          }
        }, 3000);
      } else {
        logger.warn('[Yjs] IndexedDB persistence unavailable - offline mode disabled');
        // Set synced to true anyway so workspace loading doesn't hang
        set(state => {
          state.isIndexedDBSynced = true;
        });
      }

      // Define observer callback functions so we can unsubscribe them later
      // (Yjs uses .observe()/.unobserve() pattern, not return-based cleanup)

      // PHASE 3: Observer Debouncing (November 29, 2025)
      // Debounce delay: 16ms = 60 FPS (max 60 observer triggers/second)
      const DEBOUNCE_DELAY = 16;

      // Nodes observer callback (raw, non-debounced)
      const nodesObserverRaw = (event: Y.YMapEvent<CanvasNode>) => {
        // FIX: Skip observer if Yjs is being destroyed (prevents revoked proxy errors)
        const state = get();
        if (state.isDestroying) {
          return;
        }

        // FIX: Additional safety check - ensure Yjs resources still exist
        if (!state.yjsDoc || !state.yjsNodes) {
          logger.warn('[Yjs Observer] Yjs resources destroyed, skipping nodes observer');
          return;
        }

        // PHASE 3: Origin tracking - skip local changes when feature flag enabled
        if (WORKSPACE_FEATURES.ORIGIN_TRACKING && event.transaction.origin === 'local') {
          // Local write already updated Zustand, skip observer to prevent duplicate update
          return;
        }

        try {
          // PHASE 4: Development-only logging (November 29, 2025)
          if (process.env.NODE_ENV === 'development') {
            logger.debug('[Yjs Observer] Nodes changed:', {
              keysChanged: Array.from(event.changes.keys.keys()),
              origin: event.transaction.origin,
            });
          }

          set(state => {
            // Process adds and updates
            event.changes.keys.forEach((change, key) => {
              try {
                if (change.action === 'add' || change.action === 'update') {
                  // Use fresh reference from the Y.Map to avoid stale closures
                  const currentNodes = get().yjsNodes;
                  const node = currentNodes?.get(key);
                  if (node) {
                    // FIX: Store node directly from Yjs (no sanitization)
                    // This preserves object references for React.memo (+50% performance)
                    // Sanitization only happens on database load, not Yjs updates
                    state.nodes.set(key, node);
                  } else {
                    // PHASE 4: Use logger instead of console.warn (November 29, 2025)
                    logger.warn(
                      `[Yjs Observer] ${change.action} action but node not found in Yjs:`,
                      { key }
                    );
                  }
                } else if (change.action === 'delete') {
                  // PHASE 4: Removed debug logging (November 29, 2025)
                  state.nodes.delete(key);

                  // Layer 3: Auto-remove deleted node from selection (remote deletion)
                  if (state.selectedNodeIds.has(key)) {
                    state.selectedNodeIds.delete(key);
                    logger.info(
                      `[Yjs Observer] Auto-removed remotely deleted node ${key} from selection`
                    );
                  }
                }
              } catch (error) {
                // Silently ignore revoked proxy errors (React Strict Mode in dev)
                if (!(error instanceof TypeError && error.message.includes('revoked'))) {
                  logger.error('[Yjs Observer] Error processing node change:', error);
                }
              }
            });
          });
        } catch (error) {
          // Silently ignore revoked proxy errors at top level
          if (!(error instanceof TypeError && error.message.includes('revoked'))) {
            logger.error('[Yjs Observer] Error in nodes observer:', error);
          }
        }
      };

      // Connections observer callback (raw, non-debounced)
      const connectionsObserverRaw = (event: Y.YMapEvent<Connection>) => {
        // FIX: Skip observer if Yjs is being destroyed (prevents revoked proxy errors)
        const state = get();
        if (state.isDestroying) {
          return;
        }

        // FIX: Additional safety check - ensure Yjs resources still exist
        if (!state.yjsDoc || !state.yjsConnections) {
          logger.warn('[Yjs Observer] Yjs resources destroyed, skipping connections observer');
          return;
        }

        // PHASE 3: Origin tracking - skip local changes when feature flag enabled
        if (WORKSPACE_FEATURES.ORIGIN_TRACKING && event.transaction.origin === 'local') {
          return;
        }

        set(state => {
          // Process adds and updates
          event.changes.keys.forEach((change, key) => {
            if (change.action === 'add' || change.action === 'update') {
              // Use fresh reference from the Y.Map to avoid stale closures
              const currentConnections = get().yjsConnections;
              const connection = currentConnections?.get(key);
              if (connection) {
                state.connections.set(key, connection);
              }
            } else if (change.action === 'delete') {
              state.connections.delete(key);
            }
          });
        });
      };

      // REMOVED: Viewport observer - viewport is now LOCAL ONLY (not synced)
      // Each user maintains independent pan/zoom position

      // Create debounced versions of observers (16ms = 60 FPS)
      const nodesObserverDebounced = debounce(nodesObserverRaw, DEBOUNCE_DELAY);
      const connectionsObserverDebounced = debounce(connectionsObserverRaw, DEBOUNCE_DELAY);

      // Select observer based on feature flag
      const nodesObserver = WORKSPACE_FEATURES.OBSERVER_DEBOUNCE
        ? nodesObserverDebounced
        : nodesObserverRaw;
      const connectionsObserver = WORKSPACE_FEATURES.OBSERVER_DEBOUNCE
        ? connectionsObserverDebounced
        : connectionsObserverRaw;

      // PHASE 4: Development-only logging (November 29, 2025)
      if (process.env.NODE_ENV === 'development') {
        logger.debug('[Yjs Init] Observer debouncing', {
          status: WORKSPACE_FEATURES.OBSERVER_DEBOUNCE ? 'ENABLED (16ms)' : 'DISABLED',
        });
        logger.debug('[Yjs Init] Origin tracking', {
          status: WORKSPACE_FEATURES.ORIGIN_TRACKING ? 'ENABLED (skip local)' : 'DISABLED',
        });
      }

      // Subscribe to Yjs changes
      nodes.observe(nodesObserver);
      connections.observe(connectionsObserver);
      // REMOVED: viewport observer - viewport is now LOCAL ONLY

      // Store cleanup functions that use .unobserve() method
      // CRITICAL: Cancel debounced callbacks BEFORE unobserving to prevent race conditions
      const observerCleanups: (() => void)[] = [
        () => {
          // FIX: Cancel pending debounced calls FIRST (before unobserve)
          // This prevents callbacks from firing after Yjs is destroyed
          if (WORKSPACE_FEATURES.OBSERVER_DEBOUNCE) {
            nodesObserverDebounced.cancel();
            // Also flush any pending updates to ensure clean state
            // (Don't call flush() - it would trigger callback. Just cancel.)
          }
          // Then unobserve to remove observer reference
          nodes.unobserve(nodesObserver);
        },
        () => {
          // FIX: Same pattern - cancel BEFORE unobserve
          if (WORKSPACE_FEATURES.OBSERVER_DEBOUNCE) {
            connectionsObserverDebounced.cancel();
          }
          connections.unobserve(connectionsObserver);
        },
      ];

      // Store cleanup functions for destroyYjs
      set(state => {
        state.yjsObserverCleanups = observerCleanups;
      });

      // Subscribe to WebSocket connection status (only if WebSocket enabled)
      if (wsProvider) {
        wsProvider.on('status', (event: { status: string }) => {
          set(state => {
            state.isOnline = event.status === 'connected';
          });
        });

        wsProvider.on('sync', (isSynced: boolean) => {
          set(state => {
            state.isSynced = isSynced;
          });
        });
      }

      // Subscribe to awareness changes (remote cursors/selections) - only if WebSocket enabled
      if (awareness) {
        awareness.on('change', () => {
          const states = awareness.getStates();
          const cursors = new Map();
          const selections = new Map();

          states.forEach((state: any, clientId: number) => {
            if (clientId !== awareness.clientID && state.user) {
              if (state.user.cursor) {
                cursors.set(state.user.id, {
                  x: state.user.cursor.x,
                  y: state.user.cursor.y,
                  color: state.user.color,
                  name: state.user.name,
                });
              }
              if (state.user.selection) {
                selections.set(state.user.id, new Set(state.user.selection));
              }
            }
          });

          set(state => {
            state.remoteCursors = cursors;
            state.remoteSelections = selections;
          });
        });
      }

      // Set Yjs providers in state
      set(state => {
        state.yjsDoc = doc;
        state.wsProvider = wsProvider;
        state.indexedDBProvider = indexedDBProvider;
        state.awareness = awareness;
        state.awarenessThrottle = new AwarenessThrottle(); // Initialize throttle for performance
        state.undoManager = undoManager;
        state.yjsNodes = nodes;
        state.yjsConnections = connections;
        state.yjsWriter = writer;

        // Sync nodes: if local state has nodes, copy TO Yjs. Otherwise copy FROM Yjs.
        if (state.nodes.size > 0 && nodes.size === 0) {
          // Local state has data but Yjs is empty - copy local TO Yjs
          logger.info('[Yjs Init] Syncing local nodes TO Yjs:', state.nodes.size, 'nodes');
          state.nodes.forEach((node, key) => {
            nodes.set(key, node);
          });
        } else if (nodes.size > 0) {
          // Yjs has data - copy FROM Yjs to local
          logger.info('[Yjs Init] Syncing nodes FROM Yjs to local:', nodes.size, 'nodes');
          state.nodes.clear();
          nodes.forEach((node, key) => {
            // FIX: Store node directly from Yjs (preserves references for React.memo)
            state.nodes.set(key, node);
          });
        }
        // If both empty, do nothing

        // Sync connections: same logic
        if (state.connections.size > 0 && connections.size === 0) {
          logger.info(
            '[Yjs Init] Syncing local connections TO Yjs:',
            state.connections.size,
            'connections'
          );
          state.connections.forEach((connection, key) => {
            connections.set(key, connection);
          });
        } else if (connections.size > 0) {
          logger.info(
            '[Yjs Init] Syncing connections FROM Yjs to local:',
            connections.size,
            'connections'
          );
          state.connections.clear();
          connections.forEach((connection, key) => {
            state.connections.set(key, connection);
          });
        }

        // REMOVED: Viewport sync from Yjs - viewport is now LOCAL ONLY
        // Keep default viewport (0, 0, 1) unless loaded from server later

        // FIX: Mark Yjs data as ready after initial sync (if Yjs has data)
        // This allows dragging immediately if Yjs was already populated from IndexedDB
        if (nodes.size > 0 || state.nodes.size > 0) {
          state.isYjsDataReady = true;
        }
      });

      logger.info('[Workspace] Yjs initialized for workspace', { workspaceId });
    },

    destroyYjs: () => {
      // FIX: Set destroying flag FIRST to prevent observer callbacks during cleanup
      set(state => {
        state.isDestroying = true;
      });

      const {
        wsProvider,
        indexedDBProvider,
        yjsDoc,
        awarenessThrottle,
        undoManager,
        yjsObserverCleanups,
      } = get();

      logger.info('[Workspace] Starting Yjs cleanup');

      // CRITICAL FIX: Cancel ALL debounced/pending callbacks BEFORE unobserving
      // This prevents debounced observer callbacks from firing after Yjs is destroyed
      logger.info('[Workspace] Cleaning up Yjs observers', { count: yjsObserverCleanups.length });
      yjsObserverCleanups.forEach(cleanup => {
        try {
          // Each cleanup function calls .cancel() on debounced observers, then .unobserve()
          // This ensures no pending callbacks can fire after cleanup
          cleanup();
        } catch (error) {
          // Silently ignore errors during cleanup (doc may already be destroyed)
          logger.warn('[Workspace] Error during observer cleanup', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      // CRITICAL: Wait for cleanup to settle before destroying Yjs
      // Use microtask queue to ensure all synchronous cleanup completes
      queueMicrotask(() => {
        try {
          // FIX: Explicitly disconnect WebSocket BEFORE destroying
          // This prevents "connection interrupted" errors during browser navigation
          if (wsProvider) {
            try {
              // Disconnect cleanly (closes WebSocket connection gracefully)
              wsProvider.disconnect();
              logger.info('[Workspace] WebSocket disconnected');
            } catch (error) {
              logger.warn('[Workspace] Error disconnecting WebSocket', {
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          // Now destroy providers (cleanup internal state)
          wsProvider?.destroy();
          indexedDBProvider?.destroy();
          yjsDoc?.destroy();
          awarenessThrottle?.destroy();
          undoManager?.destroy();

          set(state => {
            state.yjsDoc = null;
            state.wsProvider = null;
            state.indexedDBProvider = null;
            state.awareness = null;
            state.awarenessThrottle = null;
            state.undoManager = null;
            state.yjsNodes = null;
            state.yjsConnections = null;
            state.yjsObserverCleanups = [];
            state.isOnline = false;
            state.isSynced = false;
            state.isIndexedDBSynced = false;
            state.isYjsDataReady = false;
          });

          logger.info('[Workspace] Yjs destroyed');
        } catch (error) {
          // Catch any errors during async cleanup to prevent unhandled rejections
          logger.error('[Workspace] Error during async Yjs cleanup:', error);
        }
      });
    },

    // ========================================================================
    // Undo/Redo Actions
    // ========================================================================

    undo: () => {
      const { undoManager } = get();
      if (undoManager && undoManager.canUndo()) {
        undoManager.undo();
        logger.info('[Workspace] Undo executed');
      }
    },

    redo: () => {
      const { undoManager } = get();
      if (undoManager && undoManager.canRedo()) {
        undoManager.redo();
        logger.info('[Workspace] Redo executed');
      }
    },

    canUndo: () => {
      const { undoManager } = get();
      return undoManager?.canUndo() ?? false;
    },

    canRedo: () => {
      const { undoManager } = get();
      return undoManager?.canRedo() ?? false;
    },

    // ========================================================================
    // Mode Management Actions
    // ========================================================================

    enterEditMode: (nodeId: NodeId, editor: Editor | MarkdownEditorAPI) => {
      set(state => {
        // Exit any existing edit mode first
        if (state.editingNodeId !== null) {
          logger.warn('[Mode] Forcing exit of previous edit mode', {
            previousNodeId: state.editingNodeId,
            newNodeId: nodeId,
          });
        }

        state.currentMode = 'editing';
        state.editingNodeId = nodeId;
        state.editingEditor = editor as any; // Cast to any to avoid Immer WritableDraft incompatibility with readonly Editor types

        // Clear drag state if transitioning from drag mode
        if (state.isDragging) {
          state.isDragging = false;
          state.dragNodeId = null;
          state.dragStartPos = null;
          state.dragTarget = null;
          state.dragStartScreenPos = null;
          state.dragLastScreenPos = null;
          state.dragHasMoved = false;
          state.dragButton = null;
          state.dragClickOffset = null;
          state.dragInitialNodePositions = null;
        }

        // Clear resize state if transitioning from resize mode
        if (state.resizingNodeId !== null) {
          state.resizingNodeId = null;
        }

        logger.info('[Mode] Entered edit mode', { nodeId });
      });
    },

    exitEditMode: () => {
      set(state => {
        const wasEditing = state.editingNodeId !== null;

        state.currentMode = 'idle';
        state.editingNodeId = null;
        state.editingEditor = null;

        if (wasEditing) {
          logger.info('[Mode] Exited edit mode');
        }
      });
    },

    enterResizeMode: (nodeId: NodeId) => {
      set(state => {
        state.currentMode = 'resizing';
        state.resizingNodeId = nodeId;

        // Clear edit state if transitioning from edit mode
        if (state.editingNodeId !== null) {
          state.editingNodeId = null;
          state.editingEditor = null;
        }

        logger.info('[Mode] Entered resize mode', { nodeId });
      });
    },

    exitResizeMode: () => {
      set(state => {
        const wasResizing = state.resizingNodeId !== null;

        state.currentMode = 'idle';
        state.resizingNodeId = null;

        if (wasResizing) {
          logger.info('[Mode] Exited resize mode');
        }
      });
    },

    // ========================================================================
    // Export/Import Actions
    // ========================================================================

    /**
     * Get nodes and connections for export
     * @param selectedOnly - If true, only export selected nodes. If false, export all nodes.
     * @returns Object with nodes and connections arrays
     */
    getExportData: (selectedOnly = false) => {
      const state = get();

      // Use Yjs as source of truth (fall back to Zustand if Yjs not available)
      const nodeSource = state.yjsNodes || state.nodes;
      const connectionSource = state.yjsConnections || state.connections;

      let nodesToExport: CanvasNode[];

      if (selectedOnly && state.selectedNodeIds.size > 0) {
        // Export only selected nodes
        nodesToExport = Array.from(state.selectedNodeIds)
          .map(id => nodeSource.get(id))
          .filter((n): n is CanvasNode => n !== undefined);
      } else {
        // Export all nodes
        nodesToExport = Array.from(nodeSource.values());
      }

      // Filter connections to only include those between exported nodes
      const nodeIdSet = new Set(nodesToExport.map(n => n.id as string));
      const connectionsToExport = Array.from(connectionSource.values()).filter(
        conn =>
          nodeIdSet.has(conn.source_node_id as string) &&
          nodeIdSet.has(conn.target_node_id as string)
      );

      return {
        nodes: nodesToExport,
        connections: connectionsToExport,
      };
    },

    /**
     * Export workspace to JSON format
     * @param selectedOnly - If true, only export selected nodes. If false, export all nodes.
     * @returns WorkspaceExportData object ready for serialization
     */
    exportToJSON: (selectedOnly = false) => {
      const { nodes, connections } = get().getExportData(selectedOnly);

      if (nodes.length === 0) {
        logger.warn('[exportToJSON] No nodes to export');
        return null;
      }

      const exportData = exportToJSON(nodes, connections);

      logger.info('[exportToJSON] Exported workspace data:', {
        nodeCount: exportData.metadata.nodeCount,
        connectionCount: exportData.metadata.connectionCount,
        selectedOnly,
      });

      return exportData;
    },

    /**
     * Import CSV file and create text nodes in a grid layout
     * @param file - CSV file to import
     * @param viewportCenter - Center position for the grid
     * @param options - Import options (grid layout, spacing, etc.)
     * @returns Promise with import result
     */
    importFromCSVFile: async (file: File, viewportCenter: Point, options?: CSVImportOptions) => {
      const workspaceId = get().workspaceId;

      if (!workspaceId) {
        logger.error('[importFromCSVFile] No workspace ID - cannot import');
        return { success: false, nodeCount: 0, error: 'No workspace loaded' };
      }

      try {
        // Read CSV file
        const csvText = await readCSVFile(file);

        // Parse and create nodes
        const importResult = importFromCSV(csvText, viewportCenter, options);

        logger.info('[importFromCSVFile] Importing nodes:', {
          total: importResult.nodes.length,
          skipped: importResult.skippedCount,
        });

        // Create nodes via API (parallel requests with CSRF tokens)
        const createPromises = importResult.nodes.map(async node => {
          const response = await fetchWithCSRF('/api/workspace/nodes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              workspace_id: workspaceId,
              position: node.position,
              size: node.size,
              content: node.content,
              style: node.style || {},
              metadata: node.metadata || {},
            }),
          });

          if (response.ok) {
            const newNode = await response.json();
            // Add to Yjs (will trigger observer and update local state)
            const yjsNodes = get().yjsNodes;
            if (yjsNodes) {
              yjsNodes.set(newNode.id, newNode);
            }
            return true;
          } else {
            logger.error('[importFromCSVFile] Failed to create node:', response.status);
            return false;
          }
        });

        // Wait for all imports
        const results = await Promise.all(createPromises);
        const successCount = results.filter(r => r).length;

        logger.info('[importFromCSVFile] Import complete:', {
          success: successCount,
          failed: results.length - successCount,
        });

        return {
          success: successCount > 0,
          nodeCount: successCount,
        };
      } catch (error) {
        logger.error('[importFromCSVFile] Import failed:', error);
        return {
          success: false,
          nodeCount: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    // ========================================================================
    // Lock/Unlock Actions
    // ========================================================================

    /**
     * Lock a single node to prevent editing, moving, resizing, or deletion
     * @param id - Node ID to lock
     */
    lockNode: id =>
      set(state => {
        const node = state.yjsNodes?.get(id) || state.nodes.get(id);
        if (!node) {
          logger.warn(`[lockNode] Node ${id} not found`);
          return;
        }

        // Update metadata to set locked = true
        const updates = {
          metadata: {
            ...(node.metadata || {}),
            locked: true,
          },
        };

        // Write to Yjs
        if (state.yjsWriter) {
          const updated = { ...node, ...updates };
          state.yjsWriter.writeNode(updated);
        }

        // Sync to Zustand
        if (state.yjsNodes) {
          const fromYjs = state.yjsNodes.get(id);
          if (fromYjs) {
            // FIX: Store node directly from Yjs (preserves references for React.memo)
            state.nodes.set(id, fromYjs);
          }
        }

        logger.info(`[lockNode] Locked node ${id}`);
      }),

    /**
     * Unlock a single node to allow editing, moving, resizing, and deletion
     * @param id - Node ID to unlock
     */
    unlockNode: id =>
      set(state => {
        const node = state.yjsNodes?.get(id) || state.nodes.get(id);
        if (!node) {
          logger.warn(`[unlockNode] Node ${id} not found`);
          return;
        }

        // Update metadata to set locked = false
        const updates = {
          metadata: {
            ...(node.metadata || {}),
            locked: false,
          },
        };

        // Write to Yjs (this will bypass the lock guard in updateNode since we're explicitly unlocking)
        if (state.yjsWriter) {
          const updated = { ...node, ...updates };
          state.yjsWriter.writeNode(updated);
        }

        // Sync to Zustand
        if (state.yjsNodes) {
          const fromYjs = state.yjsNodes.get(id);
          if (fromYjs) {
            // FIX: Store node directly from Yjs (preserves references for React.memo)
            state.nodes.set(id, fromYjs);
          }
        }

        logger.info(`[unlockNode] Unlocked node ${id}`);
      }),

    /**
     * Toggle lock state of a single node
     * @param id - Node ID to toggle
     */
    toggleNodeLock: id =>
      set(state => {
        const node = state.yjsNodes?.get(id) || state.nodes.get(id);
        if (!node) {
          logger.warn(`[toggleNodeLock] Node ${id} not found`);
          return;
        }

        const isLocked = isNodeLocked(node);

        if (isLocked) {
          get().unlockNode(id);
        } else {
          get().lockNode(id);
        }
      }),

    /**
     * Lock all currently selected nodes
     */
    lockSelectedNodes: () =>
      set(state => {
        const selectedIds = Array.from(state.selectedNodeIds);
        if (selectedIds.length === 0) {
          logger.warn('[lockSelectedNodes] No nodes selected');
          return;
        }

        selectedIds.forEach(id => {
          get().lockNode(id as NodeId);
        });

        logger.info(`[lockSelectedNodes] Locked ${selectedIds.length} nodes`);
      }),

    /**
     * Unlock all currently selected nodes
     */
    unlockSelectedNodes: () =>
      set(state => {
        const selectedIds = Array.from(state.selectedNodeIds);
        if (selectedIds.length === 0) {
          logger.warn('[unlockSelectedNodes] No nodes selected');
          return;
        }

        selectedIds.forEach(id => {
          get().unlockNode(id as NodeId);
        });

        logger.info(`[unlockSelectedNodes] Unlocked ${selectedIds.length} nodes`);
      }),

    // ========================================================================
    // Workspace Actions
    // ========================================================================

    setWorkspace: workspaceId =>
      set(state => {
        state.workspaceId = workspaceId;
      }),

    setWorkspaceId: workspaceId =>
      set(state => {
        state.workspaceId = workspaceId;
      }),

    loadWorkspace: workspace =>
      set(state => {
        // PHASE 2: Migrated to YjsSafeWriter (November 29, 2025)
        state.workspaceId = workspace.workspace.id;

        // Load into Yjs if initialized
        if (state.yjsWriter && state.yjsNodes && state.yjsConnections) {
          const yjsHasNodes = state.yjsNodes.size > 0;
          const yjsHasConnections = state.yjsConnections.size > 0;
          const serverHasNodes = (workspace.nodes?.length ?? 0) > 0;
          const serverHasConnections = (workspace.connections?.length ?? 0) > 0;

          // PHASE 3 FIX: Preserve offline data - only seed Yjs if empty
          // This prevents overwriting IndexedDB data with potentially stale server data
          if (!yjsHasNodes && !yjsHasConnections && (serverHasNodes || serverHasConnections)) {
            // Yjs is empty, safe to seed from server
            logger.info('[loadWorkspace] Seeding empty Yjs from server data:', {
              serverNodes: workspace.nodes?.length ?? 0,
              serverConnections: workspace.connections?.length ?? 0,
            });

            // Write nodes to Yjs using type-safe writer (batch operation)
            if (workspace.nodes && workspace.nodes.length > 0) {
              const sanitizedNodes = workspace.nodes.map((node: CanvasNode) => sanitizeNode(node));
              state.yjsWriter.writeNodes(sanitizedNodes);
            }

            // Write connections to Yjs using type-safe writer (batch operation)
            if (workspace.connections && workspace.connections.length > 0) {
              state.yjsWriter.writeConnections(workspace.connections);
            }

            // Load viewport to LOCAL state (not synced via Yjs)
            if (workspace.viewportState) {
              state.viewport = {
                offsetX: workspace.viewportState.transform.offsetX,
                offsetY: workspace.viewportState.transform.offsetY,
                scale: workspace.viewportState.transform.scale,
              };
            }

            // ALWAYS sync to Zustand from Yjs immediately after writing
            // (Previously guarded by YJS_SINGLE_SOURCE flag, causing old nodes to need two drags)
            state.nodes.clear();
            state.yjsNodes.forEach((node: CanvasNode, key: string) => {
              // FIX: Store node directly from Yjs (preserves references for React.memo)
              state.nodes.set(key, node);
            });

            state.connections.clear();
            state.yjsConnections.forEach((connection: Connection, key: string) => {
              state.connections.set(key, connection);
            });
          } else if (yjsHasNodes || yjsHasConnections) {
            // Yjs already has data (from IndexedDB or real-time sync)
            // DO NOT overwrite - IndexedDB/Yjs data takes precedence
            logger.info('[loadWorkspace] Preserving existing Yjs data (IndexedDB sync):', {
              yjsNodes: state.yjsNodes.size,
              yjsConnections: state.yjsConnections.size,
              serverNodes: workspace.nodes?.length ?? 0,
              serverConnections: workspace.connections?.length ?? 0,
            });

            // Load viewport to LOCAL state (not synced via Yjs)
            // Always load from server if available (viewport is per-user preference)
            if (workspace.viewportState) {
              state.viewport = {
                offsetX: workspace.viewportState.transform.offsetX,
                offsetY: workspace.viewportState.transform.offsetY,
                scale: workspace.viewportState.transform.scale,
              };
            }

            // ALWAYS sync existing Yjs data to Zustand
            // (Previously guarded by YJS_SINGLE_SOURCE flag)
            state.nodes.clear();
            state.yjsNodes.forEach((node: CanvasNode, key: string) => {
              // FIX: Store node directly from Yjs (preserves references for React.memo)
              state.nodes.set(key, node);
            });

            state.connections.clear();
            state.yjsConnections.forEach((connection: Connection, key: string) => {
              state.connections.set(key, connection);
            });
          } else {
            // Both Yjs and server are empty - nothing to do
            logger.info('[loadWorkspace] Both Yjs and server are empty');
          }
        } else {
          // Fallback: load directly into local state (if Yjs not initialized)
          logger.info('[loadWorkspace] Yjs not initialized, loading into local state');
          state.nodes.clear();
          state.connections.clear();
          workspace.nodes?.forEach((node: CanvasNode) => {
            state.nodes.set(node.id, sanitizeNode(node));
          });
          workspace.connections?.forEach((connection: Connection) => {
            state.connections.set(connection.id, connection);
          });
          if (workspace.viewportState) {
            state.viewport = workspace.viewportState.transform;
          }
        }

        // FIX: Mark Yjs data as ready after loading (prevents two-drag race condition)
        state.isYjsDataReady = true;
      }),

    updateViewport: viewport =>
      set(state => {
        // LOCAL ONLY: Viewport is not synced via Yjs
        // Each user maintains independent pan/zoom position
        Object.assign(state.viewport, viewport);
      }),

    setSelectedNodes: nodeIds =>
      set(state => {
        state.selectedNodeIds.clear();
        nodeIds.forEach(id => state.selectedNodeIds.add(id));

        // Update awareness for remote users
        if (state.awareness) {
          state.awareness.setLocalStateField('user', {
            ...state.awareness.getLocalState()?.user,
            selection: nodeIds,
          });
        }
      }),

    clearWorkspace: () =>
      set(state => {
        state.workspaceId = null;
        state.nodes.clear();
        state.connections.clear();
        state.selectedNodeIds.clear();
        state.selectedConnectionIds.clear();
        state.viewport = defaultViewport;

        // Clear Yjs if initialized (nodes and connections only)
        if (state.yjsDoc && state.yjsNodes && state.yjsConnections) {
          state.yjsDoc.transact(() => {
            state.yjsNodes!.clear();
            state.yjsConnections!.clear();
          });
        }
      }),

    // ========================================================================
    // Node Actions (now update Yjs)
    // ========================================================================

    addNode: node =>
      set(state => {
        // PHASE 2: Migrated to YjsSafeWriter (November 29, 2025)
        // Sanitize position/size to prevent string concatenation bugs
        const sanitized = sanitizeNode(node);

        // Write to Yjs using type-safe writer (prevents proxy leaks)
        if (state.yjsWriter) {
          state.yjsWriter.writeNode(sanitized);
        }

        // ALWAYS sync to Zustand after writing to Yjs
        // This ensures newly added nodes are immediately available for drag operations
        // (Previously guarded by YJS_SINGLE_SOURCE flag, but that caused new nodes to be
        // missing from Zustand until page refresh)
        if (state.yjsNodes) {
          const fromYjs = state.yjsNodes.get(sanitized.id);
          if (fromYjs) {
            // FIX: Store node directly from Yjs (preserves references for React.memo)
            state.nodes.set(sanitized.id, fromYjs);
          }
        }
      }),

    updateNode: (id, updates) =>
      set(state => {
        // PHASE 2: Migrated to YjsSafeWriter (November 29, 2025)
        // Sanitize position/size to prevent string concatenation bugs
        const sanitized = sanitizeUpdates(updates);

        // FIX: Read from Yjs FIRST (source of truth), fallback to Zustand
        // Previously read from Zustand first which caused early exit when
        // Yjs observer hadn't synced yet, preventing text saves
        let node = state.yjsNodes?.get(id);
        if (!node) {
          node = state.nodes.get(id);
        }
        if (!node) return;

        // Lock guard: Prevent updates to locked nodes (unless explicitly unlocking)
        const isUnlockingNode = sanitized.metadata && sanitized.metadata.locked === false;
        if (isNodeLocked(node) && !isUnlockingNode) {
          logger.warn(`[updateNode] Cannot update locked node ${id}`);
          return;
        }

        const updated = { ...node, ...sanitized };

        // Write to Yjs using type-safe writer (prevents proxy leaks)
        if (state.yjsWriter) {
          state.yjsWriter.writeNode(updated);
        }

        // ALWAYS sync to Zustand after writing to Yjs
        // This ensures content changes are visible in UI and saved by debouncedSave
        // (Previously guarded by YJS_SINGLE_SOURCE flag, causing text not to save)
        if (state.yjsNodes) {
          const fromYjs = state.yjsNodes.get(id);
          if (fromYjs) {
            // FIX: Store node directly from Yjs (preserves references for React.memo)
            state.nodes.set(id, fromYjs);
          }
        }
      }),

    deleteNode: id =>
      set(state => {
        // PHASE 2: Migrated to YjsSafeWriter (November 29, 2025)
        // PHASE 4: Removed debug logging (November 29, 2025)

        // Lock guard: Prevent deletion of locked nodes
        const node = state.yjsNodes?.get(id) || state.nodes.get(id);
        if (node && isNodeLocked(node)) {
          logger.warn(`[deleteNode] Cannot delete locked node ${id}`);
          return;
        }

        // Write to Yjs using type-safe writer (handles cascade deletion automatically)
        if (state.yjsWriter) {
          state.yjsWriter.deleteNode(id);
        }

        // Update Zustand state (remove node and cleanup)
        state.nodes.delete(id);

        // Layer 3: Auto-remove deleted node from selection (local deletion)
        const wasSelected = state.selectedNodeIds.has(id);
        if (wasSelected) {
          state.selectedNodeIds.delete(id);
          logger.info(`[deleteNode] Auto-removed deleted node ${id} from selection`);
        }

        // PHASE 3: Cascade delete connections from Zustand (special case - observer doesn't handle this)
        const connectionsToDelete: string[] = [];
        state.connections.forEach((conn, connId) => {
          if (conn.source_node_id === id || conn.target_node_id === id) {
            connectionsToDelete.push(connId);
          }
        });
        connectionsToDelete.forEach(connId => state.connections.delete(connId));
      }),

    setNodes: nodes =>
      set(state => {
        // PHASE 2: Migrated to YjsSafeWriter (November 29, 2025)
        // Sanitize all nodes
        const sanitizedNodes = nodes.map((node: CanvasNode) => sanitizeNode(node));

        // Write to Yjs using type-safe writer (batch operation, clears and replaces all)
        if (state.yjsWriter && state.yjsNodes) {
          // Clear existing nodes first
          state.yjsNodes.clear();
          // Write new nodes in batch
          if (sanitizedNodes.length > 0) {
            state.yjsWriter.writeNodes(sanitizedNodes);
          }

          // PHASE 3: Read back from Yjs (Yjs is single source of truth)
          if (WORKSPACE_FEATURES.YJS_SINGLE_SOURCE) {
            state.nodes.clear();
            state.yjsNodes.forEach((node: CanvasNode, key: string) => {
              // FIX: Store node directly from Yjs (preserves references for React.memo)
              state.nodes.set(key, node);
            });
          }
          // NOTE: YJS_SINGLE_SOURCE is required for this function to work correctly
        }
      }),

    // ========================================================================
    // Connection Actions (now update Yjs)
    // ========================================================================

    addConnection: connection =>
      set(state => {
        // PHASE 2: Migrated to YjsSafeWriter (November 29, 2025)
        // Write to Yjs using type-safe writer (prevents proxy leaks)
        if (state.yjsWriter) {
          state.yjsWriter.writeConnection(connection);
        }

        // PHASE 3: Read back from Yjs (Yjs is single source of truth)
        if (WORKSPACE_FEATURES.YJS_SINGLE_SOURCE && state.yjsConnections) {
          const fromYjs = state.yjsConnections.get(connection.id);
          if (fromYjs) {
            state.connections.set(connection.id, fromYjs);
          }
        }
        // NOTE: YJS_SINGLE_SOURCE is required for this function to work correctly
      }),

    updateConnection: (id, updates) =>
      set(state => {
        // PHASE 2: Migrated to YjsSafeWriter (November 29, 2025)
        const connection = state.connections.get(id);
        if (!connection) return;

        const updated = { ...connection, ...updates };

        // Write to Yjs using type-safe writer (prevents proxy leaks)
        if (state.yjsWriter) {
          state.yjsWriter.writeConnection(updated);
        }

        // PHASE 3: Read back from Yjs (Yjs is single source of truth)
        if (WORKSPACE_FEATURES.YJS_SINGLE_SOURCE && state.yjsConnections) {
          const fromYjs = state.yjsConnections.get(id);
          if (fromYjs) {
            state.connections.set(id, fromYjs);
          }
        }
        // NOTE: YJS_SINGLE_SOURCE is required for this function to work correctly
      }),

    deleteConnection: id =>
      set(state => {
        // PHASE 2: Migrated to YjsSafeWriter (November 29, 2025)
        // Write to Yjs using type-safe writer (prevents proxy leaks)
        if (state.yjsWriter) {
          state.yjsWriter.deleteConnection(id);
        }

        // Update Zustand state (remove connection and cleanup)
        state.connections.delete(id);
        state.selectedConnectionIds.delete(id);
      }),

    setConnections: connections =>
      set(state => {
        // PHASE 2: Migrated to YjsSafeWriter (November 29, 2025)
        // Write to Yjs using type-safe writer (batch operation, clears and replaces all)
        if (state.yjsWriter && state.yjsConnections) {
          // Clear existing connections first
          state.yjsConnections.clear();
          // Write new connections in batch
          if (connections.length > 0) {
            state.yjsWriter.writeConnections(connections);
          }

          // PHASE 3: Read back from Yjs (Yjs is single source of truth)
          if (WORKSPACE_FEATURES.YJS_SINGLE_SOURCE) {
            state.connections.clear();
            state.yjsConnections.forEach((connection: Connection, key: string) => {
              state.connections.set(key, connection);
            });
          }
          // NOTE: YJS_SINGLE_SOURCE is required for this function to work correctly
        }
      }),

    getConnectionsForNode: nodeId => {
      const state = get();
      // Prefer Yjs as source of truth
      const connectionSource = state.yjsConnections || state.connections;
      return Array.from(connectionSource.values()).filter(
        conn => conn.source_node_id === nodeId || conn.target_node_id === nodeId
      );
    },

    // ========================================================================
    // Viewport Actions (now update Yjs)
    // ========================================================================

    setViewport: viewport =>
      set(state => {
        // LOCAL ONLY: Viewport is not synced via Yjs
        // Each user maintains independent pan/zoom position
        Object.assign(state.viewport, viewport);
      }),

    panViewport: (deltaX, deltaY) =>
      set(state => {
        // LOCAL ONLY: Viewport is not synced via Yjs
        // Each user maintains independent pan/zoom position
        state.viewport.offsetX += deltaX;
        state.viewport.offsetY += deltaY;
      }),

    zoomViewport: (delta, centerX, centerY) =>
      set(state => {
        // LOCAL ONLY: Viewport is not synced via Yjs
        // Each user maintains independent pan/zoom position
        const oldScale = state.viewport.scale;
        const newScale = Math.max(0.1, Math.min(5, oldScale * (1 + delta)));

        // Zoom toward cursor position
        const scaleRatio = newScale / oldScale;
        state.viewport.offsetX = centerX - (centerX - state.viewport.offsetX) * scaleRatio;
        state.viewport.offsetY = centerY - (centerY - state.viewport.offsetY) * scaleRatio;
        state.viewport.scale = newScale;
      }),

    resetViewport: () =>
      set(state => {
        // LOCAL ONLY: Viewport is not synced via Yjs
        // Each user maintains independent pan/zoom position
        state.viewport.offsetX = 0;
        state.viewport.offsetY = 0;
        state.viewport.scale = 1;
      }),

    // ========================================================================
    // Selection Actions (LOCAL ONLY - not synced)
    // ========================================================================

    selectNode: (id, multi = false) =>
      set(state => {
        if (multi) {
          if (state.selectedNodeIds.has(id)) {
            state.selectedNodeIds.delete(id);
          } else {
            state.selectedNodeIds.add(id);
          }
        } else {
          state.selectedNodeIds.clear();
          state.selectedNodeIds.add(id);
        }

        // Update awareness for remote users
        if (state.awareness) {
          state.awareness.setLocalStateField('user', {
            ...state.awareness.getLocalState()?.user,
            selection: Array.from(state.selectedNodeIds),
          });
        }
      }),

    clearSelection: () =>
      set(state => {
        state.selectedNodeIds.clear();

        // Update awareness
        if (state.awareness) {
          state.awareness.setLocalStateField('user', {
            ...state.awareness.getLocalState()?.user,
            selection: [],
          });
        }
      }),

    selectMultipleNodes: ids =>
      set(state => {
        state.selectedNodeIds.clear();
        ids.forEach(id => state.selectedNodeIds.add(id));

        // Update awareness
        if (state.awareness) {
          state.awareness.setLocalStateField('user', {
            ...state.awareness.getLocalState()?.user,
            selection: ids,
          });
        }
      }),

    selectConnection: (id, multi = false) =>
      set(state => {
        if (multi) {
          if (state.selectedConnectionIds.has(id)) {
            state.selectedConnectionIds.delete(id);
          } else {
            state.selectedConnectionIds.add(id);
          }
        } else {
          state.selectedConnectionIds.clear();
          state.selectedConnectionIds.add(id);
        }
      }),

    clearConnectionSelection: () =>
      set(state => {
        state.selectedConnectionIds.clear();
      }),

    // ========================================================================
    // Clipboard Actions (LOCAL ONLY - not synced)
    // ========================================================================

    copySelectedNodes: () =>
      set(state => {
        const selectedIds = Array.from(state.selectedNodeIds);
        if (selectedIds.length === 0) {
          logger.info('[Clipboard] No nodes selected to copy');
          return;
        }

        // Get selected nodes
        const nodesToCopy: CanvasNode[] = [];
        const nodeSource = state.yjsNodes || state.nodes;
        selectedIds.forEach(id => {
          const node = nodeSource.get(id);
          if (node && !isNodeLocked(node)) {
            nodesToCopy.push(node);
          }
        });

        if (nodesToCopy.length === 0) {
          logger.info('[Clipboard] All selected nodes are locked, cannot copy');
          return;
        }

        // Get connections between copied nodes
        const connectionSource = state.yjsConnections || state.connections;
        const connectionsToCopy: Connection[] = [];
        const copiedNodeIds = new Set(nodesToCopy.map(n => n.id));

        connectionSource.forEach(conn => {
          if (copiedNodeIds.has(conn.source_node_id) && copiedNodeIds.has(conn.target_node_id)) {
            connectionsToCopy.push(conn);
          }
        });

        state.clipboardNodes = nodesToCopy;
        state.clipboardConnections = connectionsToCopy;

        logger.info('[Clipboard] Copied to clipboard:', {
          nodes: nodesToCopy.length,
          connections: connectionsToCopy.length,
        });
      }),

    cutSelectedNodes: () => {
      const state = get();
      const selectedIds = Array.from(state.selectedNodeIds);
      if (selectedIds.length === 0) {
        logger.info('[Clipboard] No nodes selected to cut');
        return;
      }

      // Check if any nodes are locked
      const nodeSource = state.yjsNodes || state.nodes;
      const lockedCount = selectedIds.filter(id => {
        const node = nodeSource.get(id);
        return node && isNodeLocked(node);
      }).length;

      if (lockedCount > 0) {
        logger.warn('[Clipboard] Cannot cut: some selected nodes are locked', { lockedCount });
        return;
      }

      // Copy first
      get().copySelectedNodes();

      // Then delete
      selectedIds.forEach(id => {
        get().deleteNode(id as NodeId);
      });

      // Clear selection
      get().clearSelection();

      logger.info('[Clipboard] Cut nodes:', { count: selectedIds.length });
    },

    pasteNodes: (viewportCenter: Point) =>
      set(state => {
        if (state.clipboardNodes.length === 0) {
          logger.info('[Clipboard] Nothing to paste');
          return;
        }

        // Calculate centroid of clipboard nodes
        const avgX =
          state.clipboardNodes.reduce((sum, n) => sum + n.position.x, 0) /
          state.clipboardNodes.length;
        const avgY =
          state.clipboardNodes.reduce((sum, n) => sum + n.position.y, 0) /
          state.clipboardNodes.length;

        // Calculate offset to paste at viewport center
        const offsetX = viewportCenter.x - avgX;
        const offsetY = viewportCenter.y - avgY;

        // Create ID mapping (old ID -> new ID)
        const idMap = new Map<string, string>();
        state.clipboardNodes.forEach(node => {
          idMap.set(node.id, crypto.randomUUID());
        });

        // Create new nodes with offset positions
        const newNodeIds: string[] = [];
        state.clipboardNodes.forEach(node => {
          const newId = idMap.get(node.id)!;
          const newNode: CanvasNode = {
            ...node,
            id: newId as NodeId,
            workspace_id: state.workspaceId!,
            position: {
              x: node.position.x + offsetX,
              y: node.position.y + offsetY,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          // Write to Yjs using type-safe writer
          if (state.yjsWriter) {
            state.yjsWriter.writeNode(newNode);
          }

          // Sync to Zustand
          if (state.yjsNodes) {
            const fromYjs = state.yjsNodes.get(newId);
            if (fromYjs) {
              state.nodes.set(newId, fromYjs);
            }
          }

          newNodeIds.push(newId);
        });

        // Create new connections with remapped IDs
        state.clipboardConnections.forEach(conn => {
          const newSourceId = idMap.get(conn.source_node_id);
          const newTargetId = idMap.get(conn.target_node_id);

          if (newSourceId && newTargetId) {
            const newConnection: Connection = {
              ...conn,
              id: crypto.randomUUID() as ConnectionId,
              workspace_id: state.workspaceId!,
              source_node_id: newSourceId as NodeId,
              target_node_id: newTargetId as NodeId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            // Write to Yjs
            if (state.yjsWriter) {
              state.yjsWriter.writeConnection(newConnection);
            }

            // Sync to Zustand
            if (state.yjsConnections) {
              const fromYjs = state.yjsConnections.get(newConnection.id);
              if (fromYjs) {
                state.connections.set(newConnection.id, fromYjs);
              }
            }
          }
        });

        // Select newly pasted nodes
        state.selectedNodeIds.clear();
        newNodeIds.forEach(id => state.selectedNodeIds.add(id));

        logger.info('[Clipboard] Pasted from clipboard:', {
          nodes: newNodeIds.length,
          connections: state.clipboardConnections.length,
          offset: { x: offsetX, y: offsetY },
        });
      }),

    hasClipboardData: () => {
      return get().clipboardNodes.length > 0;
    },

    // ========================================================================
    // Dragging Actions - UNIFIED STATE (LOCAL ONLY - not synced)
    // ========================================================================

    initiateDrag: (target, screenStartPos, canvasStartPos, nodeId, button = 0, clickOffset) =>
      set(state => {
        // DEBUG: Log at very start of initiateDrag
        logger.info('[initiateDrag] CALLED:', {
          target,
          nodeId,
          yjsNodesExists: !!state.yjsNodes,
          yjsNodesSize: state.yjsNodes?.size ?? 'null',
          nodesSize: state.nodes.size,
          isYjsDataReady: state.isYjsDataReady,
        });

        // FIX: Warn if Yjs data isn't ready yet (may cause drag to fail)
        if (target === 'node' && !state.isYjsDataReady) {
          logger.warn(
            '[initiateDrag] Yjs data not ready yet - drag may fail. Retrying after data loads.'
          );
        }

        state.dragTarget = target;
        state.dragStartScreenPos = screenStartPos;
        state.dragLastScreenPos = screenStartPos;
        state.dragStartPos = canvasStartPos;
        state.dragNodeId = nodeId || null;
        state.dragButton = button;
        state.dragClickOffset = clickOffset || null;
        state.isDragging = false;
        state.dragHasMoved = false;

        // If dragging a node, auto-select it
        if (target === 'node' && nodeId && !state.selectedNodeIds.has(nodeId)) {
          state.selectedNodeIds.clear();
          state.selectedNodeIds.add(nodeId);
        }

        // Store initial positions of all selected nodes
        // CRITICAL: Ensure positions are numbers, not strings (Yjs/JSON may store as strings)
        // Fallback to Yjs if node not in Zustand (handles race conditions with new nodes)
        if (target === 'node') {
          state.dragInitialNodePositions = new Map();

          // FIX: First, directly add the dragged node's position (bypass Immer Set iteration issue)
          // Immer's Set proxy may not reflect .add() immediately in .forEach() within same draft
          if (nodeId) {
            let draggedNode = state.yjsNodes?.get(nodeId);
            const foundInYjs = !!draggedNode;
            if (!draggedNode) {
              draggedNode = state.nodes.get(nodeId);
            }
            if (draggedNode) {
              state.dragInitialNodePositions.set(nodeId, {
                x: Number(draggedNode.position.x),
                y: Number(draggedNode.position.y),
              });
              logger.info('[initiateDrag] Node position captured:', {
                nodeId,
                foundIn: foundInYjs ? 'yjsNodes' : 'nodes',
                position: { x: draggedNode.position.x, y: draggedNode.position.y },
              });
            } else {
              logger.warn('[initiateDrag] ⚠️ NODE NOT FOUND in yjsNodes or nodes:', {
                nodeId,
                yjsNodesSize: state.yjsNodes?.size ?? 'null',
                nodesSize: state.nodes.size,
                isYjsDataReady: state.isYjsDataReady,
              });
            }
          }

          // Then add any OTHER selected nodes (for multi-select drag)
          state.selectedNodeIds.forEach(id => {
            // Skip the dragged node we already added above
            if (id === nodeId) return;

            // ALWAYS try Yjs FIRST (source of truth), fallback to Zustand
            let node = state.yjsNodes?.get(id);
            if (!node) {
              node = state.nodes.get(id);
            }
            if (node) {
              state.dragInitialNodePositions!.set(id, {
                x: Number(node.position.x),
                y: Number(node.position.y),
              });
            }
          });
        }

        logger.debug('[Zustand] Drag initiated:', {
          target,
          screenStartPos,
          canvasStartPos,
          nodeId,
          clickOffset,
        });
      }),

    continueDrag: (screenCurrentPos, canvasCurrentPos, options = {}) =>
      set(state => {
        if (!state.dragStartScreenPos) {
          return;
        }

        state.dragLastScreenPos = screenCurrentPos;

        // Check if we've exceeded minimum drag distance
        if (!state.dragHasMoved) {
          const minDragDistance = options.minDragDistance || 10;
          const deltaX = screenCurrentPos.x - state.dragStartScreenPos.x;
          const deltaY = screenCurrentPos.y - state.dragStartScreenPos.y;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

          if (distance < minDragDistance) {
            return;
          }

          state.dragHasMoved = true;
          state.isDragging = true;
          // NOTE: Do NOT overwrite dragStartPos here!
          // It was correctly set in initiateDrag() and must remain unchanged
          // for delta calculations to work across the entire drag operation.
        }

        if (!state.isDragging) {
          return;
        }

        // Move nodes (updates Yjs for real-time sync)
        const canMoveNodes = !!(
          state.dragTarget === 'node' &&
          state.dragStartPos &&
          state.dragInitialNodePositions &&
          state.yjsDoc &&
          state.yjsNodes
        );

        if (!canMoveNodes && state.dragTarget === 'node') {
          logger.warn('[continueDrag] ⚠️ Cannot move nodes - missing dependencies:', {
            hasStartPos: !!state.dragStartPos,
            hasInitialPositions: !!state.dragInitialNodePositions,
            initialPositionsSize: state.dragInitialNodePositions?.size ?? 'null',
            hasYjsDoc: !!state.yjsDoc,
            hasYjsNodes: !!state.yjsNodes,
          });
        }

        if (canMoveNodes && state.dragStartPos) {
          const offsetX = state.dragClickOffset?.x ?? 0;
          const offsetY = state.dragClickOffset?.y ?? 0;

          const totalDeltaX = canvasCurrentPos.x - state.dragStartPos.x;
          const totalDeltaY = canvasCurrentPos.y - state.dragStartPos.y;

          // Use YjsSafeWriter.updateNodePosition() which:
          // 1. Reads from Yjs Y.Map directly (not Zustand state - no Immer proxies)
          // 2. Uses stripProxies() -> structuredClone() for guaranteed deep clone
          // 3. Handles transactions internally
          if (state.yjsWriter) {
            let skippedLockedNodes = 0;

            state.selectedNodeIds.forEach(nodeId => {
              // Skip locked nodes during group drag
              const node = state.yjsNodes?.get(nodeId) || state.nodes.get(nodeId);
              if (node && isNodeLocked(node)) {
                skippedLockedNodes++;
                return; // Skip this node
              }

              const initialPos = state.dragInitialNodePositions!.get(nodeId);
              if (initialPos) {
                const isFirstNode = nodeId === state.dragNodeId;
                const newX = Number(
                  isFirstNode ? canvasCurrentPos.x - offsetX : initialPos.x + totalDeltaX
                );
                const newY = Number(
                  isFirstNode ? canvasCurrentPos.y - offsetY : initialPos.y + totalDeltaY
                );
                state.yjsWriter!.updateNodePosition(nodeId as NodeId, newX, newY);
              }
            });

            // Log warning if any locked nodes were skipped
            if (skippedLockedNodes > 0) {
              logger.warn(
                `[continueDrag] Skipped ${skippedLockedNodes} locked nodes during group drag`
              );
            }
          }
        }

        // Update awareness cursor
        if (state.awareness) {
          state.awareness.setLocalStateField('user', {
            ...state.awareness.getLocalState()?.user,
            cursor: { x: screenCurrentPos.x, y: screenCurrentPos.y },
          });
        }

        logger.debug('[Zustand] Drag continued:', {
          hasMoved: state.dragHasMoved,
          isDragging: state.isDragging,
          screenPos: screenCurrentPos,
        });
      }),

    completeDrag: () =>
      set(state => {
        if (!state.dragStartScreenPos) {
          return;
        }

        logger.debug('[Zustand] Drag completed:', {
          target: state.dragTarget,
          hasMoved: state.dragHasMoved,
          isDragging: state.isDragging,
        });

        // Clear all drag state
        state.isDragging = false;
        state.dragTarget = null;
        state.dragNodeId = null;
        state.dragStartPos = null;
        state.dragStartScreenPos = null;
        state.dragLastScreenPos = null;
        state.dragHasMoved = false;
        state.dragButton = null;
        state.dragClickOffset = null;
        state.dragInitialNodePositions = null;
      }),

    clearDrag: () =>
      set(state => {
        if (state.dragStartScreenPos) {
          logger.debug('[Zustand] Drag cleared (forced)');
        }
        state.isDragging = false;
        state.dragTarget = null;
        state.dragNodeId = null;
        state.dragStartPos = null;
        state.dragStartScreenPos = null;
        state.dragLastScreenPos = null;
        state.dragHasMoved = false;
        state.dragButton = null;
        state.dragClickOffset = null;
        state.dragInitialNodePositions = null;
      }),

    // ========================================================================
    // Panning Actions (LOCAL ONLY - not synced)
    // ========================================================================

    startPan: () =>
      set(state => {
        state.isPanning = true;
      }),

    endPan: () =>
      set(state => {
        state.isPanning = false;
      }),

    // ========================================================================
    // Context Menu Actions (LOCAL ONLY - not synced)
    // ========================================================================

    showContextMenu: (position, context, items) =>
      set(state => {
        state.contextMenu = {
          visible: true,
          position,
          context,
          items,
        };
      }),

    hideContextMenu: () =>
      set(state => {
        state.contextMenu.visible = false;
      }),

    executeContextMenuAction: item =>
      set(state => {
        if (item.handler && state.contextMenu.context) {
          item.handler(state.contextMenu.context);
        }
        state.contextMenu.visible = false;
      }),

    // ========================================================================
    // Utility Methods
    // ========================================================================

    getNode: id => {
      const state = get();
      // Prefer Yjs as source of truth, but ALWAYS fall back to Zustand nodes if not found
      // This handles race conditions where Yjs hasn't synced yet
      if (state.yjsNodes) {
        const node = state.yjsNodes.get(id);
        if (node) return node;
        // Node not in Yjs, try Zustand fallback
        const fallbackNode = state.nodes.get(id);
        if (fallbackNode) {
          logger.info('[getNode] Node found in Zustand fallback (Yjs sync pending):', id);
        }
        return fallbackNode;
      }
      return state.nodes.get(id);
    },

    getSelectedNodes: () => {
      const state = get();
      // Prefer Yjs as source of truth
      const nodeSource = state.yjsNodes || state.nodes;
      return Array.from(state.selectedNodeIds)
        .map(id => nodeSource.get(id))
        .filter((node): node is CanvasNode => node !== undefined);
    },
  }))
);

// ============================================================================
// Selector Hooks (for optimized re-renders)
// ============================================================================

export const useViewport = () => useWorkspaceStore(state => state.viewport);

/**
 * @deprecated Use useYjsNodes from workspace-selectors.ts instead
 * This hook now delegates to Yjs for the source of truth
 */
export const useNodes = () =>
  useWorkspaceStore(
    useShallow(state => {
      // Prefer Yjs as source of truth, fall back to local state
      if (state.yjsNodes && state.yjsNodes.size > 0) {
        return Array.from(state.yjsNodes.values());
      }
      return Array.from(state.nodes.values());
    })
  );

/**
 * @deprecated Use useYjsConnections from workspace-selectors.ts instead
 * This hook now delegates to Yjs for the source of truth
 */
export const useConnections = () =>
  useWorkspaceStore(
    useShallow(state => {
      // Prefer Yjs as source of truth, fall back to local state
      if (state.yjsConnections && state.yjsConnections.size > 0) {
        return Array.from(state.yjsConnections.values());
      }
      return Array.from(state.connections.values());
    })
  );

export const useSelectedNodeIds = () => useWorkspaceStore(state => state.selectedNodeIds);

export const useSelectedConnectionIds = () =>
  useWorkspaceStore(state => state.selectedConnectionIds);

export const useIsDragging = () => useWorkspaceStore(state => state.isDragging);

export const useIsPanning = () => useWorkspaceStore(state => state.isPanning);

export const useIsOnline = () => useWorkspaceStore(state => state.isOnline);

export const useIsSynced = () => useWorkspaceStore(state => state.isSynced);

export const useRemoteCursors = () => useWorkspaceStore(state => state.remoteCursors);
