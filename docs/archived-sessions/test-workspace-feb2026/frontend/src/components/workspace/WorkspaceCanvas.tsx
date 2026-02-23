'use client';

/**
 * Workspace Canvas Component
 *
 * Main client component for infinite canvas.
 * Handles rendering loop, input, and state synchronization.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { UserId } from '@/types/branded';
import { WorkspaceWithContent, AnchorSide, CanvasNode, Connection } from '@/lib/workspace/types';
import { useWorkspaceStore } from '@/stores/workspace';
import { TransformManager } from '@/lib/workspace/transform-manager';
import { InputHandler } from '@/lib/workspace/input-handler';
import { ViewportCuller } from '@/lib/workspace/viewport-culling';
import {
  unsafeToNodeId,
  unsafeToWorkspaceId,
  unsafeToConnectionId,
} from '@/lib/workspace/branded-types';
import { fetchWithCSRF } from '@/lib/utils/csrf';
import CanvasGrid from './CanvasGrid';
import TextNode from './TextNode';
import TextNodeErrorBoundary from './TextNodeErrorBoundary';
import WorkspaceErrorBoundary from './WorkspaceErrorBoundary';
import CanvasContextMenu from './CanvasContextMenu';
import NodeContextMenu from './NodeContextMenu';
import ConnectionRenderer from './ConnectionRenderer';
import NodeAnchors from './NodeAnchors';
import FloatingFormatToolbar from './FloatingFormatToolbar';
import MarkdownFloatingToolbar from './MarkdownFloatingToolbar';
import ConnectionToolbar from './ConnectionToolbar';
import { isMarkdownModeEnabled, type MarkdownEditorAPI } from '@/lib/workspace/markdown-utils';
import SelectionBoundingBox from './SelectionBoundingBox';
import { calculateBoundingBox, BoundingBox } from '@/lib/workspace/bounding-box-utils';
import {
  downloadJSON,
  readJSONFile,
  generateExportFilename,
  importFromJSON,
} from '@/lib/workspace/export-import';
import AlignmentToolbar from './AlignmentToolbar';
import CreationToolbar from './CreationToolbar';
import {
  calculateAlignment,
  calculateDistribution,
  getAlignmentSummary,
  canAlign,
  type AlignmentType,
  type DistributionType,
} from '@/lib/workspace/alignment-utils';
import { isNodeLocked } from '@/lib/workspace/types';
import type { Editor } from '@tiptap/react';
import { useWorkspaceYjs } from './hooks/useWorkspaceYjs';
import { RemoteCursors } from './RemoteCursors';
import { useConfirmedDelete } from '@/hooks/useConfirmedDelete';
import { useYjsNodes, useYjsConnections } from '@/stores/workspace-selectors';
import { logger } from '@/lib/utils/logger';

/**
 * SVG Icon Components for Bottom Toolbar
 */
const ExportIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
);

const ImportIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
    />
  </svg>
);

const ImageIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const UndoIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
    />
  </svg>
);

const RedoIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
    />
  </svg>
);

const LockIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

const UnlockIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
    />
  </svg>
);

const GridIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
    />
  </svg>
);

interface WorkspaceCanvasProps {
  projectSlug: string;
  userId: UserId;
  initialWorkspace: WorkspaceWithContent | null;
}

export default function WorkspaceCanvas({
  projectSlug,
  userId,
  initialWorkspace,
}: WorkspaceCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasLayerRef = useRef<HTMLDivElement>(null);
  const gridLayerRef = useRef<HTMLDivElement>(null);
  const transformManagerRef = useRef<TransformManager | null>(null);
  const inputHandlerRef = useRef<InputHandler | null>(null);
  const viewportCullerRef = useRef<ViewportCuller | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState(!initialWorkspace);
  // PHASE 2.3: draggingNodeId now comes from Zustand, not local state
  const [activeEditor, setActiveEditor] = useState<{
    nodeId: string;
    editor: Editor | MarkdownEditorAPI;
    position: { x: number; y: number };
  } | null>(null); // Track active editor for floating toolbar (supports both Tiptap and Markdown editors)
  const [hasPendingSaves, setHasPendingSaves] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
  } | null>(null);

  // Node context menu state
  const [nodeContextMenu, setNodeContextMenu] = useState<{
    x: number;
    y: number;
    targetNodeId: string;
  } | null>(null);

  // Connection state (direct manipulation - no mode needed)
  const [connectionSource, setConnectionSource] = useState<{
    nodeId: string;
    side: AnchorSide;
    offset: number;
  } | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredAnchor, setHoveredAnchor] = useState<{
    nodeId: string;
    side: AnchorSide;
    offset: number;
  } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hoveredNodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Marquee selection state
  const [marqueeBox, setMarqueeBox] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null>(null);

  // Global mouse tracking for connection drawing
  useEffect(() => {
    if (!connectionSource || !transformManagerRef.current || !containerRef.current) {
      return;
    }

    const handleDocumentMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const canvasPos = transformManagerRef.current!.screenToCanvas(screenX, screenY);

      setCursorPosition(canvasPos);
    };

    // Add document-level listener
    document.addEventListener('mousemove', handleDocumentMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
    };
  }, [connectionSource]);

  // UI state for bottom-left toolbar
  const [showGrid, setShowGrid] = useState(true); // Grid visibility toggle

  // Group drag state - tracks initial positions of all selected nodes (using ref to avoid InputHandler recreation)
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }> | null>(null);

  // Debounce timers for autosave
  const saveTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const viewportSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Zustand store (actions and non-node state)
  const {
    workspaceId,
    viewport,
    selectedNodeIds,
    selectedConnectionIds,
    isDragging,
    dragNodeId,
    dragTarget,
    dragHasMoved,
    editingNodeId, // Phase 2: Mode state from store (single source of truth)
    isIndexedDBSynced, // Phase 3: Track IndexedDB sync status
    awareness, // Yjs awareness for collaborative cursors
    awarenessThrottle, // Throttle cursor updates to 20/sec
    setWorkspaceId,
    loadWorkspace,
    updateViewport,
    setSelectedNodes,
    addNode,
    updateNode,
    clearSelection,
    clearConnectionSelection,
    clearDrag,
    undo, // Phase 6: Undo/redo support
    redo,
    canUndo,
    canRedo,
    copySelectedNodes, // Clipboard operations
    cutSelectedNodes,
    pasteNodes,
  } = useWorkspaceStore();

  // Yjs-first: Read nodes directly from Yjs (single source of truth)
  const yjsNodesArray = useYjsNodes();
  // Convert to Map for compatibility with existing code that uses nodes.get(), nodes.size
  // Use string keys for compatibility with existing code that passes string IDs
  const nodes = new Map<string, CanvasNode>(yjsNodesArray.map(node => [node.id as string, node]));

  // Yjs-first: Read connections directly from Yjs
  const yjsConnectionsArray = useYjsConnections();
  const connections = new Map<string, Connection>(
    yjsConnectionsArray.map(conn => [conn.id as string, conn])
  );

  // CRITICAL: Store nodes in a ref so InputHandler callbacks can access the LATEST nodes
  // Without this, callbacks capture stale Zustand nodes after Yjs updates
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes; // Update on every render

  // Confirmed delete hook - server confirms before removing from state
  const {
    confirmedDeleteMultiple,
    isDeleting: isDeleteInProgress,
    error: deleteError,
  } = useConfirmedDelete();

  // Initialize Yjs collaboration (real-time sync + offline support)
  // Use initialWorkspace.workspace.id if available, since Zustand workspaceId may not be set yet
  // This breaks the circular dependency: Yjs needs workspaceId, but loadWorkspace waits for IndexedDB sync
  const effectiveWorkspaceId = workspaceId || initialWorkspace?.workspace?.id;

  useEffect(() => {
    // FIX: Add mount guard to prevent connection during navigation transition
    // This prevents "connection interrupted" errors with browser back button
    let isMounted = true;
    let isInitialized = false;

    if (effectiveWorkspaceId) {
      // Delay initialization until component is fully mounted and navigation is stable
      // This prevents race conditions when using browser back/forward buttons
      const timeoutId = setTimeout(() => {
        if (isMounted) {
          const { initializeYjs } = useWorkspaceStore.getState();
          initializeYjs(unsafeToWorkspaceId(effectiveWorkspaceId), userId);
          isInitialized = true;
          logger.info('[WorkspaceCanvas] Yjs initialized after mount delay');
        }
      }, 100); // Small delay to ensure DOM is ready and navigation is complete

      return () => {
        isMounted = false;
        clearTimeout(timeoutId);

        // Only destroy if we actually initialized
        if (isInitialized) {
          const { destroyYjs } = useWorkspaceStore.getState();
          destroyYjs();
          logger.info('[WorkspaceCanvas] Yjs cleanup on unmount');
        }
      };
    }
  }, [effectiveWorkspaceId, userId]);

  /**
   * Debounced save utility
   * Delays save until user stops interacting (500ms after last change)
   */
  const debouncedSave = useCallback((nodeId: string, updates: any, delay: number = 500) => {
    // Clear existing timer for this node
    const existingTimer = saveTimersRef.current.get(nodeId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        const response = await fetchWithCSRF(`/api/workspace/nodes/${nodeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Save failed: ${response.status} ${errorText}`);
        }

        saveTimersRef.current.delete(nodeId);
        setHasPendingSaves(saveTimersRef.current.size > 0);
        setSaveStatus('saved');
        setSaveError(null); // Clear any previous errors
      } catch (error) {
        logger.error('Failed to save node:', error);
        setSaveStatus('error');
        setSaveError(error instanceof Error ? error.message : 'Failed to save changes');
        saveTimersRef.current.delete(nodeId);
        setHasPendingSaves(saveTimersRef.current.size > 0);
      }
    }, delay);

    saveTimersRef.current.set(nodeId, timer);
    setHasPendingSaves(true);
    setSaveStatus('saving');
  }, []);

  /**
   * Debounced viewport save
   * Delays save until user stops panning/zooming (1500ms after last change)
   */
  const debouncedSaveViewport = useCallback(
    (transform: { offsetX: number; offsetY: number; scale: number }, delay: number = 1500) => {
      if (!workspaceId) return;

      // Clear existing timer
      if (viewportSaveTimerRef.current) {
        clearTimeout(viewportSaveTimerRef.current);
      }

      // Set new timer
      viewportSaveTimerRef.current = setTimeout(async () => {
        try {
          await fetchWithCSRF('/api/workspace/viewport', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspaceId,
              transform,
            }),
          });
          logger.info('Viewport saved:', transform);
        } catch (error) {
          logger.error('Failed to save viewport:', error);
        }

        viewportSaveTimerRef.current = null;
      }, delay);
    },
    [workspaceId]
  );

  /**
   * Flush all pending saves immediately
   * Called before unmount or navigation
   */
  const flushPendingSaves = useCallback(async () => {
    const pendingSaves: Promise<any>[] = [];

    saveTimersRef.current.forEach((timer, nodeId) => {
      clearTimeout(timer);
      const node = nodes.get(nodeId);
      if (node) {
        // Fire save immediately
        const savePromise = fetchWithCSRF(`/api/workspace/nodes/${nodeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            position: node.position,
            size: node.size,
            content: node.content,
            style: node.style,
          }),
        }).catch(error => logger.error('Failed to flush save:', error));
        pendingSaves.push(savePromise);
      }
    });

    saveTimersRef.current.clear();
    await Promise.all(pendingSaves);
  }, [nodes]);

  /**
   * Cleanup: flush pending saves on unmount
   * NOTE: Empty dependency array ensures this only runs on unmount, not on every nodes change
   * The cleanup captures the latest nodes/viewport values via closure at unmount time
   */
  useEffect(() => {
    return () => {
      // Synchronously fire all pending saves before unmount
      saveTimersRef.current.forEach((timer, nodeId) => {
        clearTimeout(timer);
        const node = nodes.get(nodeId);
        if (node) {
          // Use fetch with keepalive for reliable save on page unload
          fetchWithCSRF(`/api/workspace/nodes/${nodeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true, // Ensures request completes even after page unload
            body: JSON.stringify({
              position: node.position,
              size: node.size,
              content: node.content,
              style: node.style,
            }),
          }).catch(error => logger.error('Failed to save on unmount:', error));
        }
      });
      saveTimersRef.current.clear();

      // Flush viewport save
      if (viewportSaveTimerRef.current) {
        clearTimeout(viewportSaveTimerRef.current);
        if (viewport && workspaceId) {
          fetchWithCSRF('/api/workspace/viewport', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({
              workspaceId,
              transform: viewport,
            }),
          }).catch(error => logger.error('Failed to save viewport on unmount:', error));
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array: cleanup only runs on unmount, captures latest values via closure

  /**
   * Flush pending saves before page unload
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveTimersRef.current.size > 0) {
        // Fire all pending saves using fetch with keepalive
        saveTimersRef.current.forEach((timer, nodeId) => {
          clearTimeout(timer);
          const node = nodes.get(nodeId);
          if (node) {
            fetchWithCSRF(`/api/workspace/nodes/${nodeId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              keepalive: true, // Persists across page unload
              body: JSON.stringify({
                position: node.position,
                size: node.size,
                content: node.content,
                style: node.style,
              }),
            }).catch(error => logger.error('Failed to save on beforeunload:', error));
          }
        });
        saveTimersRef.current.clear();
      }

      // Flush viewport save
      if (viewportSaveTimerRef.current && viewport && workspaceId) {
        clearTimeout(viewportSaveTimerRef.current);
        fetchWithCSRF('/api/workspace/viewport', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            workspaceId,
            transform: viewport,
          }),
        }).catch(error => logger.error('Failed to save viewport on beforeunload:', error));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [nodes, viewport, workspaceId]);

  /**
   * Initialize workspace data
   *
   * PHASE 3: Wait for IndexedDB sync before loading from server.
   * This ensures offline data (from y-indexeddb) is loaded first,
   * and loadWorkspace won't overwrite it with potentially stale server data.
   */
  useEffect(() => {
    logger.debug('Workspace loading check:', {
      initialWorkspace: !!initialWorkspace,
      projectSlug,
      workspaceId,
      isIndexedDBSynced,
    });

    // If initialWorkspace is provided, use it and skip API fetch
    if (initialWorkspace) {
      logger.debug('Using initialWorkspace (SSR data), skipping API fetch');
      loadWorkspace(initialWorkspace);
      setIsLoading(false);
      return;
    }

    // PHASE 3: Wait for IndexedDB to sync before loading server data
    // This gives y-indexeddb a chance to load any offline data first
    if (!isIndexedDBSynced) {
      logger.debug('Waiting for IndexedDB sync before loading server data...');
      return;
    }

    logger.debug('IndexedDB synced, loading workspace data');

    logger.debug('Fetching workspace from API:', `/api/workspace/${projectSlug}`);

    // Fetch workspace data from API
    fetch(`/api/workspace/${projectSlug}`, {
      credentials: 'include', // Include session cookies
    })
      .then(res => {
        logger.debug('API response status:', res.status);
        return res.json();
      })
      .then(data => {
        logger.debug('API response data:', data);
        loadWorkspace(data);
        setIsLoading(false);
      })
      .catch(error => {
        logger.error('[DEBUG] Failed to load workspace:', error);
        setIsLoading(false);
      });
  }, [projectSlug, loadWorkspace, isIndexedDBSynced, initialWorkspace]);

  /**
   * Create a new sticky note at position
   */
  const createNode = useCallback(
    async (canvasX: number, canvasY: number) => {
      logger.debug('createNode called - workspaceId:', workspaceId);
      if (!workspaceId) {
        logger.error('[DEBUG] FAILURE: createNode - workspaceId is null/undefined!');
        return;
      }

      logger.info('Creating sticky note at:', canvasX, canvasY);

      try {
        const response = await fetchWithCSRF('/api/workspace/nodes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspace_id: workspaceId,
            position: { x: canvasX, y: canvasY },
            size: { width: 120, height: 120 }, // Square sticky note (Miro-style)
            content: { text: '', title: 'New Note' },
            style: { backgroundColor: '#404040' },
            metadata: { nodeType: 'note' }, // Explicit type for sticky notes
          }),
        });

        if (response.ok) {
          const newNode = await response.json();
          logger.info('Sticky note created:', newNode);
          addNode(newNode);
          setSelectedNodes([newNode.id]);
        } else {
          logger.error('Failed to create sticky note - Status:', response.status);
          const errorText = await response.text();
          logger.error('Error response:', errorText);
          try {
            const errorJson = JSON.parse(errorText);
            logger.error('Error JSON:', errorJson);
          } catch (e) {
            logger.error('Could not parse error as JSON');
          }
        }
      } catch (error) {
        logger.error('Error creating sticky note:', error);
      }
    },
    [workspaceId, addNode]
  );

  /**
   * Create a new text box at position
   */
  const createTextBox = useCallback(
    async (canvasX: number, canvasY: number) => {
      logger.debug('createTextBox called - workspaceId:', workspaceId);
      if (!workspaceId) {
        logger.error('[DEBUG] FAILURE: createTextBox - workspaceId is null/undefined!');
        return;
      }

      logger.info('Creating text box at:', canvasX, canvasY);

      try {
        const response = await fetchWithCSRF('/api/workspace/nodes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspace_id: workspaceId,
            position: { x: canvasX, y: canvasY },
            size: { width: 110, height: 36 }, // Wide enough to fit "Type here" without wrapping
            content: { text: '' }, // NO title property - this makes it a text box
            style: {}, // No background color - transparent
            metadata: { nodeType: 'text' }, // Explicit type for text boxes
          }),
        });

        if (response.ok) {
          const newNode = await response.json();
          logger.info('Text box created:', newNode);
          addNode(newNode);
          setSelectedNodes([newNode.id]);
        } else {
          logger.error('Failed to create text box - Status:', response.status);
          const errorText = await response.text();
          logger.error('Error response:', errorText);
          try {
            const errorJson = JSON.parse(errorText);
            logger.error('Error details:', errorJson);
          } catch (e) {
            logger.error('Could not parse error as JSON');
          }
        }
      } catch (error) {
        logger.error('Failed to create text box:', error);
      }
    },
    [workspaceId, addNode]
  );

  /**
   * Handle anchor hover
   */
  const handleAnchorHover = useCallback((nodeId: string, side: AnchorSide, offset: number) => {
    setHoveredAnchor({ nodeId, side, offset });
  }, []);

  /**
   * Handle anchor leave
   */
  const handleAnchorLeave = useCallback(() => {
    setHoveredAnchor(null);
  }, []);

  /**
   * Handle canvas click (cancel connection if clicking empty space)
   */
  const handleCanvasClickForConnection = useCallback(() => {
    if (connectionSource) {
      setConnectionSource(null);
      setCursorPosition(null);
      setHoveredAnchor(null);
    }
  }, [connectionSource]);

  /**
   * Get cursor style based on connection state
   */
  const getCursorStyle = useCallback(() => {
    if (connectionSource) {
      // Connection in progress
      if (hoveredAnchor) {
        // Hovering over an anchor
        return hoveredAnchor.nodeId === connectionSource.nodeId
          ? 'not-allowed' // Same node - invalid
          : 'crosshair'; // Different node - valid target
      }
      return 'crosshair'; // Creating connection, moving cursor
    }
    if (hoveredAnchor) {
      return 'pointer'; // Hovering anchor, no connection active
    }
    return 'default'; // Normal state
  }, [connectionSource, hoveredAnchor]);

  /**
   * Handle anchor click (start or complete connection)
   * Direct manipulation - no mode needed, just click anchors
   */
  const handleAnchorClick = useCallback(
    async (nodeId: string, side: AnchorSide, offset: number) => {
      if (!workspaceId) return;

      if (!connectionSource) {
        // First click - set source anchor
        setConnectionSource({ nodeId, side, offset });
      } else {
        // Second click - create connection
        if (connectionSource.nodeId === nodeId) {
          logger.info('Cannot connect node to itself');
          return;
        }

        try {
          const response = await fetchWithCSRF('/api/workspace/connections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspace_id: workspaceId,
              source_node_id: connectionSource.nodeId,
              source_anchor: {
                side: connectionSource.side,
                offset: connectionSource.offset,
              },
              target_node_id: nodeId,
              target_anchor: {
                side,
                offset,
              },
            }),
          });

          if (response.ok) {
            const newConnection = await response.json();
            useWorkspaceStore.getState().addConnection(newConnection);
            logger.info('Connection created:', newConnection);
          } else {
            logger.error('Failed to create connection:', response.status);
          }
        } catch (error) {
          logger.error('Failed to create connection:', error);
        }

        // Reset source and cursor tracking
        setConnectionSource(null);
        setCursorPosition(null);
      }
    },
    [connectionSource, workspaceId]
  );

  /**
   * Handle connection click (selection)
   */
  const handleConnectionClick = useCallback((connectionId: string) => {
    useWorkspaceStore.getState().selectConnection(unsafeToConnectionId(connectionId));
  }, []);

  /**
   * Handle connection delete
   */
  const handleConnectionDelete = useCallback(async (connectionId: string) => {
    try {
      const response = await fetchWithCSRF(`/api/workspace/connections/${connectionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        useWorkspaceStore.getState().deleteConnection(unsafeToConnectionId(connectionId));
        logger.info('Connection deleted:', connectionId);
      } else {
        logger.error('Failed to delete connection:', response.status);
      }
    } catch (error) {
      logger.error('Failed to delete connection:', error);
    }
  }, []);

  /**
   * Handle connection color change from toolbar
   */
  const handleConnectionColorChange = useCallback(
    async (connectionId: string, color: string) => {
      const connection = connections.get(connectionId);
      if (!connection) return;

      const updatedStyle = {
        ...connection.style,
        color,
      };

      // Update local state immediately
      useWorkspaceStore.getState().updateConnection(unsafeToConnectionId(connectionId), {
        style: updatedStyle,
      });

      // Persist to database
      try {
        await fetchWithCSRF(`/api/workspace/connections/${connectionId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            style: updatedStyle,
          }),
        });
      } catch (error) {
        logger.error('Failed to update connection color:', error);
      }
    },
    [connections]
  );

  /**
   * Handle connection width change from toolbar
   */
  const handleConnectionWidthChange = useCallback(
    async (connectionId: string, width: number) => {
      const connection = connections.get(connectionId);
      if (!connection) return;

      const updatedStyle = {
        ...connection.style,
        width,
      };

      useWorkspaceStore.getState().updateConnection(unsafeToConnectionId(connectionId), {
        style: updatedStyle,
      });

      try {
        await fetchWithCSRF(`/api/workspace/connections/${connectionId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            style: updatedStyle,
          }),
        });
      } catch (error) {
        logger.error('Failed to update connection width:', error);
      }
    },
    [connections]
  );

  /**
   * Handle connection dash array change from toolbar
   */
  const handleConnectionDashArrayChange = useCallback(
    async (connectionId: string, dashArray: number[] | undefined) => {
      const connection = connections.get(connectionId);
      if (!connection) return;

      const updatedStyle = {
        ...connection.style,
        dashArray,
      };

      useWorkspaceStore.getState().updateConnection(unsafeToConnectionId(connectionId), {
        style: updatedStyle,
      });

      try {
        await fetchWithCSRF(`/api/workspace/connections/${connectionId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            style: updatedStyle,
          }),
        });
      } catch (error) {
        logger.error('Failed to update connection dash array:', error);
      }
    },
    [connections]
  );

  /**
   * Handle connection arrow type change from toolbar
   */
  const handleConnectionArrowTypeChange = useCallback(
    async (connectionId: string, arrowType: 'none' | 'arrow' | 'circle' | 'diamond') => {
      const connection = connections.get(connectionId);
      if (!connection) return;

      const updatedStyle = {
        ...connection.style,
        arrowType,
      };

      useWorkspaceStore.getState().updateConnection(unsafeToConnectionId(connectionId), {
        style: updatedStyle,
      });

      try {
        await fetchWithCSRF(`/api/workspace/connections/${connectionId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            style: updatedStyle,
          }),
        });
      } catch (error) {
        logger.error('Failed to update connection arrow type:', error);
      }
    },
    [connections]
  );

  /**
   * Handle connection opacity change from toolbar
   */
  const handleConnectionOpacityChange = useCallback(
    async (connectionId: string, opacity: number) => {
      const connection = connections.get(connectionId);
      if (!connection) return;

      const updatedStyle = {
        ...connection.style,
        opacity,
      };

      useWorkspaceStore.getState().updateConnection(unsafeToConnectionId(connectionId), {
        style: updatedStyle,
      });

      try {
        await fetchWithCSRF(`/api/workspace/connections/${connectionId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            style: updatedStyle,
          }),
        });
      } catch (error) {
        logger.error('Failed to update connection opacity:', error);
      }
    },
    [connections]
  );

  /**
   * Track mouse position for collaborative cursors
   * Sends local cursor position to remote users via Yjs awareness
   */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (
        !awareness ||
        !awarenessThrottle ||
        !containerRef.current ||
        !transformManagerRef.current
      ) {
        return;
      }

      // Convert screen coordinates to canvas coordinates
      const rect = containerRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Transform to canvas coordinates (accounting for pan/zoom)
      const canvasPos = transformManagerRef.current.screenToCanvas(screenX, screenY);

      // Send to remote users via awareness (throttled to 20 updates/sec)
      awarenessThrottle.updateCursor(awareness, {
        x: canvasPos.x,
        y: canvasPos.y,
      });
    },
    [awareness, awarenessThrottle]
  );

  /**
   * Clear cursor when mouse leaves canvas
   * Removes cursor indicator for remote users
   */
  const handleMouseLeave = useCallback(() => {
    if (!awareness || !awarenessThrottle) return;
    awarenessThrottle.clearCursor(awareness);
  }, [awareness, awarenessThrottle]);

  /**
   * Keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in input/textarea or when actively editing a node
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        editingNodeId !== null || // Actually editing a node (not just focused/selected)
        target.closest('[contenteditable="true"]') !== null; // Inside contentEditable area

      // Delete or Backspace key for selected nodes (not when typing)
      // Uses confirmed delete pattern: server confirms FIRST, then remove from UI
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeIds.size > 0 && !isTyping) {
        e.preventDefault();

        // Prevent duplicate delete attempts while one is in progress
        if (isDeleteInProgress) {
          logger.info('[Workspace] Delete already in progress, ignoring');
          return;
        }

        const selectedIds = Array.from(selectedNodeIds);
        logger.info('[Workspace] Delete requested for nodes:', selectedIds);

        // Filter out ghost node IDs that no longer exist in Yjs
        const validNodeIds = selectedIds.filter(id => nodesRef.current.has(id));

        if (validNodeIds.length === 0) {
          logger.warn('[Workspace] No valid nodes to delete (all IDs are ghosts)');
          clearSelection();
          return;
        }

        if (validNodeIds.length < selectedIds.length) {
          const ghostCount = selectedIds.length - validNodeIds.length;
          logger.warn(
            `[Workspace] Filtered out ${ghostCount} ghost node ID(s) from selection`,
            selectedIds.filter(id => !nodesRef.current.has(id))
          );
          // Update selection to remove ghost IDs
          setSelectedNodes(validNodeIds);
        }

        logger.info('[Workspace] Initiating confirmed delete for valid nodes:', validNodeIds);

        // Clear selection immediately for better UX feedback
        clearSelection();

        // Perform confirmed delete - waits for server confirmation before removing from state
        confirmedDeleteMultiple(validNodeIds).then(result => {
          if (!result.success) {
            logger.error('[Workspace] Delete failed:', result.error);
            // Could show a toast notification here
            // Note: nodes that failed to delete will still be visible (correct behavior!)
          } else {
            logger.info('[Workspace] Delete confirmed by server');
          }
        });
      }

      // Ctrl+C - Copy selected nodes
      if (e.key === 'c' && (e.ctrlKey || e.metaKey) && !isTyping) {
        e.preventDefault();
        copySelectedNodes();
      }

      // Ctrl+X - Cut selected nodes
      if (e.key === 'x' && (e.ctrlKey || e.metaKey) && !isTyping) {
        e.preventDefault();
        cutSelectedNodes();
      }

      // Ctrl+V - Paste nodes from clipboard
      if (e.key === 'v' && (e.ctrlKey || e.metaKey) && !isTyping) {
        e.preventDefault();

        // Calculate viewport center for paste position
        const canvasRect = containerRef.current?.getBoundingClientRect();
        if (!canvasRect) {
          logger.error('[Paste] Cannot paste: canvas container element not found');
          return;
        }

        const viewportCenter = {
          x: (canvasRect.width / 2 - viewport.offsetX) / viewport.scale,
          y: (canvasRect.height / 2 - viewport.offsetY) / viewport.scale,
        };

        pasteNodes(viewportCenter);
      }

      // Ctrl+E - Export to JSON (selected nodes or all if none selected)
      if (e.key === 'e' && (e.ctrlKey || e.metaKey) && !isTyping) {
        e.preventDefault();

        const selectedOnly = selectedNodeIds.size > 0;
        const exportData = useWorkspaceStore.getState().exportToJSON(selectedOnly);

        if (exportData) {
          const filename = generateExportFilename(projectSlug);
          downloadJSON(exportData, filename);
          logger.info(`Exported ${exportData.metadata.nodeCount} nodes to ${filename}`, {
            selectedOnly,
          });
        } else {
          logger.warn('No nodes to export');
        }
      }

      // Ctrl+Shift+I - Import from JSON
      if (e.key === 'I' && (e.ctrlKey || e.metaKey) && e.shiftKey && !isTyping && workspaceId) {
        e.preventDefault();

        // Create file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';

        fileInput.onchange = async (event: Event) => {
          const target = event.target as HTMLInputElement;
          const file = target.files?.[0];
          if (!file) return;

          try {
            // Read and parse JSON file
            const exportData = await readJSONFile(file);

            // Calculate viewport center for paste offset
            const canvasRect = containerRef.current?.getBoundingClientRect();
            if (!canvasRect) {
              logger.error('Cannot import: canvas container element not found');
              return;
            }

            const viewportCenter = {
              x: (canvasRect.width / 2 - viewport.offsetX) / viewport.scale,
              y: (canvasRect.height / 2 - viewport.offsetY) / viewport.scale,
            };

            // Import nodes and connections
            const { importFromJSON } = await import('@/lib/workspace/export-import');
            const importResult = importFromJSON(exportData, viewportCenter);

            logger.info(
              `Importing ${importResult.nodes.length} nodes, ${importResult.connections.length} connections`
            );

            // Create nodes via API
            const newNodeIds: string[] = [];
            const pastePromises = importResult.nodes.map(async node => {
              const response = await fetchWithCSRF('/api/workspace/nodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                addNode(newNode);
                newNodeIds.push(newNode.id);
                return newNode;
              } else {
                logger.error('Failed to import node - Status:', response.status);
                return null;
              }
            });

            // Create connections via API
            const connectionPromises = importResult.connections.map(async conn => {
              const response = await fetchWithCSRF('/api/workspace/connections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  workspace_id: workspaceId,
                  source_node_id: conn.source_node_id,
                  target_node_id: conn.target_node_id,
                  source_anchor: conn.source_anchor,
                  target_anchor: conn.target_anchor,
                  label: conn.label,
                  style: conn.style || {},
                }),
              });

              if (!response.ok) {
                logger.error('Failed to import connection - Status:', response.status);
              }
              return response.ok;
            });

            // Wait for all imports to complete
            Promise.all([...pastePromises, ...connectionPromises])
              .then(() => {
                // Select the newly imported nodes
                setSelectedNodes(newNodeIds);
                logger.info(
                  `Import complete: ${importResult.nodes.length} nodes, ${importResult.connections.length} connections`
                );
              })
              .catch(error => logger.error('Failed to import:', error));
          } catch (error) {
            logger.error('Failed to read/parse JSON file:', error);
            // Could show a toast notification here
          } finally {
            // Clean up file input
            document.body.removeChild(fileInput);
          }
        };

        // Trigger file picker
        document.body.appendChild(fileInput);
        fileInput.click();
      }

      // Ctrl+L - Toggle lock for selected nodes
      if (e.key === 'l' && (e.ctrlKey || e.metaKey) && !isTyping) {
        e.preventDefault();

        if (selectedNodeIds.size === 0) {
          logger.warn('No nodes selected to lock/unlock');
          return;
        }

        const store = useWorkspaceStore.getState();

        // Check if all selected nodes are locked
        const selectedNodes = Array.from(selectedNodeIds)
          .map(id => nodes.get(id))
          .filter((n): n is CanvasNode => n !== undefined);

        const lockedCount = selectedNodes.filter(n => n.metadata?.locked === true).length;
        const allLocked = lockedCount === selectedNodes.length;
        const anyLocked = lockedCount > 0;

        // If all selected nodes are locked, unlock them
        // If some or none are locked, lock them all
        if (allLocked) {
          store.unlockSelectedNodes();
          logger.info(`Unlocked ${selectedNodeIds.size} nodes`);
        } else {
          store.lockSelectedNodes();
          logger.info(
            `Locked ${selectedNodeIds.size} nodes${anyLocked ? ` (${selectedNodeIds.size - lockedCount} were already locked)` : ''}`
          );
        }
      }

      // Ctrl+Shift+L - Align Left
      if (e.key === 'L' && (e.ctrlKey || e.metaKey) && e.shiftKey && !isTyping) {
        e.preventDefault();
        handleAlign('left');
      }

      // Ctrl+Shift+R - Align Right
      if (e.key === 'R' && (e.ctrlKey || e.metaKey) && e.shiftKey && !isTyping) {
        e.preventDefault();
        handleAlign('right');
      }

      // Ctrl+Shift+T - Align Top
      if (e.key === 'T' && (e.ctrlKey || e.metaKey) && e.shiftKey && !isTyping) {
        e.preventDefault();
        handleAlign('top');
      }

      // Ctrl+Shift+B - Align Bottom
      if (e.key === 'B' && (e.ctrlKey || e.metaKey) && e.shiftKey && !isTyping) {
        e.preventDefault();
        handleAlign('bottom');
      }

      // Ctrl+Shift+H - Center Horizontally
      if (e.key === 'H' && (e.ctrlKey || e.metaKey) && e.shiftKey && !isTyping) {
        e.preventDefault();
        handleAlign('center-horizontal');
      }

      // Ctrl+Shift+V - Center Vertically
      if (e.key === 'V' && (e.ctrlKey || e.metaKey) && e.shiftKey && !isTyping) {
        e.preventDefault();
        handleAlign('center-vertical');
      }

      // Ctrl+Shift+[ - Distribute Horizontally
      if (e.key === '[' && (e.ctrlKey || e.metaKey) && e.shiftKey && !isTyping) {
        e.preventDefault();
        handleDistribute('horizontal');
      }

      // Ctrl+Shift+] - Distribute Vertically
      if (e.key === ']' && (e.ctrlKey || e.metaKey) && e.shiftKey && !isTyping) {
        e.preventDefault();
        handleDistribute('vertical');
      }

      // Escape - Cancel connection, marquee, or clear selection
      if (e.key === 'Escape') {
        e.preventDefault();
        if (marqueeBox) {
          // Cancel active marquee selection
          setMarqueeBox(null);
          if (inputHandlerRef.current) {
            // Clear the drag state in InputHandler
            inputHandlerRef.current.cancelDrag();
          }
        } else if (connectionSource) {
          // Cancel active connection
          setConnectionSource(null);
          setCursorPosition(null);
          setHoveredAnchor(null);
        } else {
          clearSelection();
          clearConnectionSelection();
        }
        setContextMenu(null); // Close canvas context menu
        setNodeContextMenu(null); // Close node context menu
      }

      // Ctrl+Z - Undo (Phase 6: Yjs UndoManager)
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !isTyping) {
        e.preventDefault();
        undo();
      }

      // Ctrl+Shift+Z or Ctrl+Y - Redo (Phase 6: Yjs UndoManager)
      if (
        ((e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
          (e.key === 'y' && (e.ctrlKey || e.metaKey))) &&
        !isTyping
      ) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedNodeIds,
    nodes,
    setSelectedNodes,
    clearSelection,
    clearConnectionSelection,
    connectionSource,
    workspaceId,
    addNode,
    copySelectedNodes,
    cutSelectedNodes,
    pasteNodes,
    marqueeBox,
    isDeleteInProgress,
    confirmedDeleteMultiple,
    undo,
    redo,
    editingNodeId, // Need this to check if actively editing when Delete is pressed
  ]);

  /**
   * Helper to restart animation loop when needed
   * Called when user starts panning/zooming
   */
  const startAnimationLoop = useCallback(() => {
    // Don't start if already running
    if (animationFrameRef.current !== null) return;

    const animate = () => {
      if (transformManagerRef.current) {
        const hasChanges = transformManagerRef.current.update();

        if (hasChanges) {
          // Update CSS transform for ALL layers synchronously
          const transform = transformManagerRef.current.toCSSTransform();

          // Update nodes layer
          if (canvasLayerRef.current) {
            canvasLayerRef.current.style.transform = transform;
          }

          // Update grid layer
          if (gridLayerRef.current) {
            gridLayerRef.current.style.transform = transform;
          }

          // Update viewport state in Zustand for live percentage display
          // This ensures the zoom percentage updates during animation, not just at the end
          const currentTransform = transformManagerRef.current.getTransform();
          updateViewport(currentTransform);

          // Continue animation loop only if still animating
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete - stop RAF loop to save CPU/battery
          animationFrameRef.current = null;

          // Final viewport update to ensure exact target value
          const finalTransform = transformManagerRef.current.getTransform();
          updateViewport(finalTransform);

          // Trigger debounced save when animation completes
          debouncedSaveViewport(finalTransform);
        }
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [updateViewport, debouncedSaveViewport]);

  /**
   * Initialize transform manager and viewport culler ONCE
   */
  useEffect(() => {
    // Initialize transform manager (only once)
    const transformManager = new TransformManager(
      viewport || { offsetX: 0, offsetY: 0, scale: 1.0 }
    );
    transformManagerRef.current = transformManager;

    // Initialize viewport culler (only once)
    const viewportCuller = new ViewportCuller();
    viewportCullerRef.current = viewportCuller;
  }, []); // Empty deps - run only once

  // Track whether viewport has been initialized to avoid circular updates
  const viewportInitializedRef = useRef(false);

  /**
   * Update TransformManager when viewport loads from server (ONCE only)
   * This ensures saved pan/zoom position is restored on page load
   *
   * CRITICAL: Do NOT re-run when viewport changes during user interaction (panning/zooming)
   * to avoid circular dependency: TransformManager → Zustand → useEffect → TransformManager
   */
  useEffect(() => {
    if (!isLoading && transformManagerRef.current && viewport && !viewportInitializedRef.current) {
      // Apply loaded viewport state to TransformManager
      transformManagerRef.current.setTransform(viewport);

      // Apply CSS transform immediately to reflect loaded position
      const cssTransform = transformManagerRef.current.toCSSTransform();
      if (canvasLayerRef.current) {
        canvasLayerRef.current.style.transform = cssTransform;
      }
      if (gridLayerRef.current) {
        gridLayerRef.current.style.transform = cssTransform;
      }

      // Mark viewport as initialized - never update from Zustand again
      viewportInitializedRef.current = true;
      logger.info('[WorkspaceCanvas] Viewport initialized from server:', viewport);
    }
  }, [isLoading, viewport]); // Still watch viewport for initial load, but guard with ref

  /**
   * Handle marquee selection end
   * Converts screen coordinates to canvas coordinates and selects nodes within bounds
   */
  const handleMarqueeSelectionEnd = useCallback(
    (
      start: { x: number; y: number },
      end: { x: number; y: number },
      modifiers: { shift: boolean; ctrl: boolean }
    ) => {
      if (!transformManagerRef.current || !viewportCullerRef.current) return;

      // Convert screen coordinates to canvas coordinates
      const canvasStart = transformManagerRef.current.screenToCanvas(start.x, start.y);
      const canvasEnd = transformManagerRef.current.screenToCanvas(end.x, end.y);

      // Calculate selection bounds (handle drag in any direction)
      const bounds = {
        minX: Math.min(canvasStart.x, canvasEnd.x),
        minY: Math.min(canvasStart.y, canvasEnd.y),
        maxX: Math.max(canvasStart.x, canvasEnd.x),
        maxY: Math.max(canvasStart.y, canvasEnd.y),
      };

      logger.info('[Marquee Debug] Selection bounds (canvas):', bounds);

      // Get nodes within selection bounds (using partial overlap for better UX)
      // Use nodesRef.current to avoid unstable dependency on nodes Map
      const currentNodes = nodesRef.current;
      const selectedNodes = viewportCullerRef.current.getNodesInSelectionPartial(
        currentNodes,
        bounds.minX,
        bounds.minY,
        bounds.maxX,
        bounds.maxY
      );
      const newNodeIds = new Set(selectedNodes.map(node => node.id));

      logger.info(
        '[Marquee Debug] Nodes found:',
        selectedNodes.length,
        selectedNodes.map(n => n.id)
      );
      logger.info('[Marquee Debug] Modifiers:', modifiers);

      // Update selection based on modifier keys (Miro-style)
      if (modifiers.shift) {
        // Shift: Add to existing selection (union)
        const updatedSelection = new Set([...selectedNodeIds, ...newNodeIds]);
        setSelectedNodes(Array.from(updatedSelection));
      } else if (modifiers.ctrl) {
        // Ctrl/Cmd: Toggle selection (XOR)
        const updatedSelection = new Set(selectedNodeIds);
        newNodeIds.forEach(id => {
          if (updatedSelection.has(id)) {
            updatedSelection.delete(id); // Remove if already selected
          } else {
            updatedSelection.add(id); // Add if not selected
          }
        });
        setSelectedNodes(Array.from(updatedSelection));
      } else {
        // No modifier: Replace selection
        if (newNodeIds.size > 0) {
          setSelectedNodes(Array.from(newNodeIds));
        } else {
          // Empty selection - clear selection
          clearSelection();
        }
      }
    },
    // NOTE: Removed 'nodes' from dependencies - use nodesRef.current instead
    // This prevents InputHandler from being recreated on every Yjs update
    [selectedNodeIds, setSelectedNodes, clearSelection]
  );

  /**
   * Initialize input handler (after container is mounted)
   * Force re-initialization when loading completes and container is ready
   */
  useEffect(() => {
    // Wait for loading to complete
    if (isLoading) {
      return;
    }

    // Wait for refs to be ready
    if (!containerRef.current || !transformManagerRef.current) {
      return;
    }

    // 🔧 FIX: Force clear orphaned drag state before creating handler
    // Prevents race condition where InputHandler is recreated while completeDrag() is executing
    clearDrag();

    // Initialize input handler (reuses existing transformManager)
    const inputHandler = new InputHandler(containerRef.current, transformManagerRef.current, {
      onNodeClick: (nodeId, event) => {
        // TextNode already handles its own click events with multi-select logic
        // This callback is only used for non-React click detection (if needed)
        // For now, do nothing - let TextNode's onClick handle selection
        logger.info('InputHandler onNodeClick (delegated to TextNode):', nodeId);
      },
      onCanvasClick: (canvasPos, event) => {
        // Single click on canvas just deselects nodes and connections
        // Double-click removed - use right-click context menu to create nodes
        logger.info('Canvas click:', canvasPos);
        setSelectedNodes([]);
        clearConnectionSelection();
      },
      onCanvasRightClick: (screenPos, canvasPos) => {
        logger.info('Canvas right-click:', { screenPos, canvasPos });
        setContextMenu({
          x: screenPos.x,
          y: screenPos.y,
          canvasX: canvasPos.x,
          canvasY: canvasPos.y,
        });
      },
      onNodeDragStart: (nodeId, canvasPos) => {
        logger.info('Node drag start:', nodeId, canvasPos);
        // PHASE 2.3: Drag state already managed by Zustand via InputHandler

        // Check if dragged node is in current selection
        const { selectedNodeIds } = useWorkspaceStore.getState();
        const isInSelection = selectedNodeIds.has(nodeId);

        const nodes = nodesRef.current; // Use ref for latest Yjs data
        const initialPositions = new Map<string, { x: number; y: number }>();

        // If dragging a selected node in multi-select, track ALL selected nodes' positions
        if (isInSelection && selectedNodeIds.size > 1) {
          selectedNodeIds.forEach(id => {
            const node = nodes.get(id);
            if (node) {
              initialPositions.set(id, {
                x: node.position.x,
                y: node.position.y,
              });
            }
          });

          dragStartPositionsRef.current = initialPositions;
          logger.info(`Group drag started with ${initialPositions.size} nodes`);
        } else {
          // Single node drag - ALSO track start position to avoid reading stale ref during drag
          const node = nodes.get(nodeId as string);
          if (node) {
            initialPositions.set(nodeId as string, {
              x: node.position.x,
              y: node.position.y,
            });
          }
          dragStartPositionsRef.current = initialPositions;
          logger.info('Single node drag started');
        }
      },
      onNodeDragMove: (nodeId, canvasPos, delta) => {
        if (!dragStartPositionsRef.current) return;

        // Get drag start canvas position from store to calculate cumulative delta
        const { dragStartPos } = useWorkspaceStore.getState();
        if (!dragStartPos) return;

        // Calculate cumulative delta from drag start
        const cumulativeDelta = {
          x: canvasPos.x - dragStartPos.x,
          y: canvasPos.y - dragStartPos.y,
        };

        // Move all nodes in the drag (single or multiple) by cumulative delta from their start positions
        dragStartPositionsRef.current.forEach((startPos, id) => {
          useWorkspaceStore.getState().updateNode(unsafeToNodeId(id), {
            position: {
              x: startPos.x + cumulativeDelta.x,
              y: startPos.y + cumulativeDelta.y,
            },
          });
        });
      },
      onNodeDragEnd: (nodeId, canvasPos) => {
        logger.info('Node drag end:', nodeId);
        // PHASE 2.3: Drag state already managed by Zustand via InputHandler

        if (!dragStartPositionsRef.current) return;

        // Save ALL moved nodes to database (single or multiple)
        // Read from store/Yjs instead of stale ref
        const { yjsNodes } = useWorkspaceStore.getState();
        const savePromises: Promise<any>[] = [];

        dragStartPositionsRef.current.forEach((startPos, id) => {
          // Try Yjs first (most up-to-date), fallback to ref
          const node = yjsNodes?.get(id) || nodesRef.current.get(id);
          if (node) {
            // Only save if position actually changed
            if (node.position.x !== startPos.x || node.position.y !== startPos.y) {
              const savePromise = fetchWithCSRF(`/api/workspace/nodes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ position: node.position }),
              }).catch(error => logger.error(`Failed to save node ${id} position:`, error));

              savePromises.push(savePromise);
            }
          }
        });

        // Wait for all saves to complete
        Promise.all(savePromises).then(() => {
          logger.info(`Saved ${savePromises.length} node(s) from drag operation`);
        });

        // Clear drag state
        dragStartPositionsRef.current = null;
      },
      onTransformChange: () => {
        // Update viewport in store
        if (transformManagerRef.current) {
          const transform = transformManagerRef.current.getTransform();
          updateViewport(transform);
          // Debounced save to database
          debouncedSaveViewport(transform);

          // Apply CSS transform immediately for instant zoom/pan
          // (Animation loop won't run if isAnimating is false)
          const cssTransform = transformManagerRef.current.toCSSTransform();
          if (canvasLayerRef.current) {
            canvasLayerRef.current.style.transform = cssTransform;
          }
          if (gridLayerRef.current) {
            gridLayerRef.current.style.transform = cssTransform;
          }

          // Start animation loop for smooth zoom/pan (will stop immediately if not animating)
          startAnimationLoop();
        }
      },
      isNodeEditing: nodeId => {
        // Check if this node is currently being edited (read from store for fresh data)
        return useWorkspaceStore.getState().editingNodeId === nodeId;
      },
      getSelectionBoundingBox: () => {
        // Get current selection from store (on-demand, fresh data)
        const { selectedNodeIds, nodes } = useWorkspaceStore.getState();

        // Need at least 2 nodes for group drag
        if (selectedNodeIds.size < 2) {
          return null;
        }

        // Calculate bounding box from selected nodes
        const selectedNodesArray = Array.from(nodes.values()).filter(node =>
          selectedNodeIds.has(node.id)
        );

        if (selectedNodesArray.length < 2) {
          return null;
        }

        const boundingBox = calculateBoundingBox(selectedNodesArray);
        if (!boundingBox) {
          return null;
        }

        // Return bounding box and first node ID for group drag reference
        const firstNodeId = selectedNodesArray[0]?.id;
        if (!firstNodeId) {
          return null;
        }

        return {
          boundingBox,
          firstNodeId,
        };
      },
      onSelectionBoxUpdate: (start, end) => {
        // Live update marquee box visual
        setMarqueeBox({ start, end });
      },
      onSelectionBoxEnd: (start, end, modifiers) => {
        // Finalize selection and clear visual
        handleMarqueeSelectionEnd(start, end, modifiers);
        setMarqueeBox(null);
      },
    });
    inputHandlerRef.current = inputHandler;

    return () => {
      inputHandler.destroy();
    };
  }, [
    isLoading,
    createNode,
    updateViewport,
    setSelectedNodes,
    debouncedSaveViewport,
    startAnimationLoop,
    clearConnectionSelection,
    handleMarqueeSelectionEnd,
  ]);

  /**
   * Animation loop - Updates transforms ONLY when animating
   * Optimization: Only runs during pan/zoom, stops when idle
   */
  useEffect(() => {
    // Start initial loop
    startAnimationLoop();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [startAnimationLoop]);

  /**
   * Handle node update (content, size, style changes)
   * Uses debounced save to prevent spam on every keystroke
   */
  const handleNodeUpdate = useCallback(
    (nodeId: string, updates: any) => {
      // Update store immediately for responsive UI
      updateNode(unsafeToNodeId(nodeId), updates);

      // Debounced save (waits 500ms after last change)
      debouncedSave(nodeId, updates, 500);
    },
    [updateNode, debouncedSave]
  );

  /**
   * Handle typing notification - shows "Saving..." indicator immediately
   * Called by TextNode on every keystroke for real-time feedback
   */
  const handleTyping = useCallback(() => {
    setSaveStatus('saving');
    setHasPendingSaves(true);
  }, []);

  /**
   * Handle node delete (uses confirmed delete pattern)
   * Note: Uses confirmedDelete from useConfirmedDelete hook called at top of component
   */
  const { confirmedDelete: confirmedDeleteSingle } = useConfirmedDelete();
  const handleNodeDelete = useCallback(
    async (nodeId: string) => {
      logger.info('[Workspace] handleNodeDelete called for:', nodeId);

      // Use confirmed delete - waits for server confirmation before removing from state
      const result = await confirmedDeleteSingle(nodeId);
      if (!result.success) {
        logger.error('[Workspace] Failed to delete node:', result.error);
        // Node will remain visible since server didn't confirm
      }
    },
    [confirmedDeleteSingle]
  );

  /**
   * Handle node duplicate
   */
  const handleNodeDuplicate = useCallback(
    async (nodeId: string) => {
      if (!workspaceId) return;

      const originalNode = nodes.get(nodeId);
      if (!originalNode) {
        logger.error('Cannot duplicate - node not found:', nodeId);
        return;
      }

      logger.info('Duplicating node:', nodeId, originalNode);

      // Create duplicate with offset position
      const DUPLICATE_OFFSET = 20; // Offset in pixels (Miro-style)
      try {
        const response = await fetchWithCSRF('/api/workspace/nodes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspace_id: workspaceId,
            position: {
              x: originalNode.position.x + DUPLICATE_OFFSET,
              y: originalNode.position.y + DUPLICATE_OFFSET,
            },
            size: originalNode.size,
            content: originalNode.content,
            style: originalNode.style || {},
            metadata: originalNode.metadata || {},
          }),
        });

        if (response.ok) {
          const newNode = await response.json();
          logger.info('Node duplicated:', newNode);
          addNode(newNode);
          // Select the new duplicated node
          setSelectedNodes([newNode.id]);
        } else {
          logger.error('Failed to duplicate node - Status:', response.status);
          const errorText = await response.text();
          logger.error('Error response:', errorText);
        }
      } catch (error) {
        logger.error('Failed to duplicate node:', error);
      }
    },
    [workspaceId, nodes, addNode, setSelectedNodes]
  );

  /**
   * Handle bring to front
   */
  const handleBringToFront = useCallback(
    async (nodeId: string) => {
      // Find the maximum z_index among all nodes
      let maxZIndex = 0;
      nodes.forEach(node => {
        if (node.z_index > maxZIndex) {
          maxZIndex = node.z_index;
        }
      });

      const newZIndex = maxZIndex + 1;
      logger.info('Bringing node to front:', nodeId, 'New z-index:', newZIndex);

      // Update node z_index
      handleNodeUpdate(nodeId, { z_index: newZIndex });
    },
    [nodes, handleNodeUpdate]
  );

  /**
   * Handle send to back
   */
  const handleSendToBack = useCallback(
    async (nodeId: string) => {
      logger.info('Sending node to back:', nodeId, 'New z-index: 0');

      // Update node z_index to 0 (behind all other nodes)
      handleNodeUpdate(nodeId, { z_index: 0 });
    },
    [handleNodeUpdate]
  );

  /**
   * Handle alignment of selected nodes
   */
  const handleAlign = useCallback(
    (alignmentType: AlignmentType) => {
      const selectedNodes = Array.from(selectedNodeIds)
        .map(id => nodes.get(id))
        .filter((n): n is CanvasNode => n !== undefined);

      if (selectedNodes.length < 2) {
        logger.warn('[Alignment] Need at least 2 nodes to align');
        return;
      }

      // Calculate alignment positions
      const results = calculateAlignment(selectedNodes, alignmentType);

      if (results.length === 0) {
        logger.warn('[Alignment] No unlocked nodes to align');
        return;
      }

      // Apply alignment (batch update all nodes)
      results.forEach(({ nodeId, newPosition }) => {
        handleNodeUpdate(nodeId as string, { position: newPosition });
      });

      const summary = getAlignmentSummary(selectedNodes, alignmentType);
      logger.info(`[Alignment] ${summary.alignmentType}: ${summary.alignedNodes} nodes aligned`, {
        skipped: summary.skippedNodes,
      });
    },
    [selectedNodeIds, nodes, handleNodeUpdate]
  );

  /**
   * Handle distribution of selected nodes
   */
  const handleDistribute = useCallback(
    (distributionType: DistributionType) => {
      const selectedNodes = Array.from(selectedNodeIds)
        .map(id => nodes.get(id))
        .filter((n): n is CanvasNode => n !== undefined);

      if (selectedNodes.length < 3) {
        logger.warn('[Distribution] Need at least 3 nodes to distribute');
        return;
      }

      // Calculate distribution positions
      const results = calculateDistribution(selectedNodes, distributionType);

      if (results.length === 0) {
        logger.warn('[Distribution] No unlocked nodes to distribute');
        return;
      }

      // Apply distribution (batch update all nodes)
      results.forEach(({ nodeId, newPosition }) => {
        handleNodeUpdate(nodeId as string, { position: newPosition });
      });

      const summary = getAlignmentSummary(selectedNodes, distributionType);
      logger.info(
        `[Distribution] ${summary.alignmentType}: ${summary.alignedNodes} nodes distributed`,
        {
          skipped: summary.skippedNodes,
        }
      );
    },
    [selectedNodeIds, nodes, handleNodeUpdate]
  );

  /**
   * Handle Export to JSON button click
   */
  const handleExportClick = useCallback(() => {
    const selectedOnly = selectedNodeIds.size > 0;
    const exportData = useWorkspaceStore.getState().exportToJSON(selectedOnly);
    if (exportData) {
      const filename = generateExportFilename(projectSlug);
      downloadJSON(exportData, filename);
      logger.info(`[Export] Exported ${selectedOnly ? 'selected' : 'all'} nodes to JSON`);
    }
  }, [selectedNodeIds, projectSlug]);

  /**
   * Handle Export to PNG button click
   * Captures the workspace as a PNG image
   */
  const handleExportPNGClick = useCallback(async () => {
    if (!containerRef.current) {
      logger.error('[PNG Export] Container ref not available');
      return;
    }

    try {
      const selectedOnly = selectedNodeIds.size > 0;
      const nodesToExport = selectedOnly
        ? Array.from(selectedNodeIds)
            .map(id => nodes.get(id))
            .filter((n): n is CanvasNode => n !== undefined)
        : Array.from(nodes.values());

      if (nodesToExport.length === 0) {
        logger.warn('[PNG Export] No nodes to export');
        return;
      }

      // Calculate bounding box of nodes to export
      const bounds = calculateBoundingBox(nodesToExport);
      if (!bounds) {
        logger.error('[PNG Export] Failed to calculate bounding box');
        return;
      }

      // Add padding around the content
      const PADDING = 40;
      const width = bounds.width + PADDING * 2;
      const height = bounds.height + PADDING * 2;

      // Create temporary canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        logger.error('[PNG Export] Failed to get canvas context');
        return;
      }

      // Fill background
      ctx.fillStyle = '#1f2937'; // neutral-800
      ctx.fillRect(0, 0, width, height);

      // Draw grid (optional)
      if (showGrid) {
        ctx.strokeStyle = '#374151'; // neutral-700
        ctx.lineWidth = 1;
        const gridSize = 20;
        for (let x = 0; x < width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }

      // Sort nodes by z-index
      const sortedNodes = [...nodesToExport].sort((a, b) => a.z_index - b.z_index);

      // Draw each node
      for (const node of sortedNodes) {
        const x = node.position.x - bounds.x + PADDING;
        const y = node.position.y - bounds.y + PADDING;

        // Draw node background
        ctx.fillStyle = node.style?.backgroundColor || '#374151';
        ctx.strokeStyle = node.style?.borderColor || '#4b5563';
        ctx.lineWidth = node.style?.borderWidth || 1;

        const borderRadius = node.style?.borderRadius || 8;

        // Draw rounded rectangle
        ctx.beginPath();
        ctx.moveTo(x + borderRadius, y);
        ctx.lineTo(x + node.size.width - borderRadius, y);
        ctx.quadraticCurveTo(x + node.size.width, y, x + node.size.width, y + borderRadius);
        ctx.lineTo(x + node.size.width, y + node.size.height - borderRadius);
        ctx.quadraticCurveTo(
          x + node.size.width,
          y + node.size.height,
          x + node.size.width - borderRadius,
          y + node.size.height
        );
        ctx.lineTo(x + borderRadius, y + node.size.height);
        ctx.quadraticCurveTo(x, y + node.size.height, x, y + node.size.height - borderRadius);
        ctx.lineTo(x, y + borderRadius);
        ctx.quadraticCurveTo(x, y, x + borderRadius, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw title if exists
        if (node.content.title) {
          ctx.fillStyle = '#e5e7eb'; // neutral-200
          ctx.font = 'bold 14px system-ui';
          ctx.fillText(node.content.title, x + 12, y + 24);
        }

        // Draw text content (simplified)
        const text = node.content.text || node.content.markdown || '';
        if (text) {
          ctx.fillStyle = '#d1d5db'; // neutral-300
          ctx.font = '12px system-ui';
          const startY = node.content.title ? y + 44 : y + 24;
          const lines = text.split('\n').slice(0, 10); // Max 10 lines
          lines.forEach((line, i) => {
            const truncated = line.length > 40 ? line.substring(0, 37) + '...' : line;
            ctx.fillText(truncated, x + 12, startY + i * 16);
          });
        }
      }

      // Draw connections
      const connectionsToExport = Array.from(connections.values()).filter(
        conn =>
          nodesToExport.some(n => n.id === conn.source_node_id) &&
          nodesToExport.some(n => n.id === conn.target_node_id)
      );

      for (const conn of connectionsToExport) {
        const sourceNode = nodes.get(conn.source_node_id as string);
        const targetNode = nodes.get(conn.target_node_id as string);
        if (!sourceNode || !targetNode) continue;

        // Calculate connection endpoints
        const sourceX = sourceNode.position.x - bounds.x + PADDING + sourceNode.size.width / 2;
        const sourceY = sourceNode.position.y - bounds.y + PADDING + sourceNode.size.height / 2;
        const targetX = targetNode.position.x - bounds.x + PADDING + targetNode.size.width / 2;
        const targetY = targetNode.position.y - bounds.y + PADDING + targetNode.size.height / 2;

        // Draw connection line
        ctx.strokeStyle = conn.style?.color || '#6b7280';
        ctx.lineWidth = conn.style?.width || 2;
        ctx.beginPath();
        ctx.moveTo(sourceX, sourceY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();

        // Draw arrow head
        const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
        const arrowSize = 10;
        ctx.fillStyle = conn.style?.color || '#6b7280';
        ctx.beginPath();
        ctx.moveTo(targetX, targetY);
        ctx.lineTo(
          targetX - arrowSize * Math.cos(angle - Math.PI / 6),
          targetY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          targetX - arrowSize * Math.cos(angle + Math.PI / 6),
          targetY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }

      // Convert to blob and download
      canvas.toBlob(blob => {
        if (!blob) {
          logger.error('[PNG Export] Failed to create blob');
          return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectSlug}-workspace-${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        logger.info(`[PNG Export] Exported ${nodesToExport.length} nodes to PNG`);
      }, 'image/png');
    } catch (error) {
      logger.error('[PNG Export] Failed to export:', error);
    }
  }, [selectedNodeIds, nodes, connections, projectSlug, showGrid]);

  /**
   * Handle Import from JSON button click
   */
  const handleImportClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const exportData = await readJSONFile(file);

        // Calculate viewport center for paste position
        const canvasRect = containerRef.current?.getBoundingClientRect();
        if (!canvasRect || !viewport) return;

        const viewportCenter = {
          x: (canvasRect.width / 2 - viewport.offsetX) / viewport.scale,
          y: (canvasRect.height / 2 - viewport.offsetY) / viewport.scale,
        };

        // importFromJSON throws errors if validation fails
        const importResult = importFromJSON(exportData, viewportCenter);

        // Import nodes and connections via store
        // Type assertion is safe here - importFromJSON returns Partial<> to allow flexible input,
        // but it guarantees all required fields are present after validation
        importResult.nodes.forEach((node: Partial<CanvasNode>) => {
          addNode(node as CanvasNode);
        });

        importResult.connections.forEach((conn: Partial<Connection>) => {
          useWorkspaceStore.getState().addConnection(conn as Connection);
        });

        logger.info(
          `[Import] Imported ${importResult.nodes.length} nodes, ${importResult.connections.length} connections`
        );
      } catch (error) {
        logger.error('[Import] Error:', error);
        setSaveError(error instanceof Error ? error.message : 'Import failed');
      }
    };
    input.click();
  }, [viewport, containerRef, addNode, setSaveError]);

  /**
   * Handle Grid toggle button click
   */
  const handleToggleGrid = useCallback(() => {
    setShowGrid(prev => !prev);
    logger.info(`[Grid] Toggled: ${!showGrid}`);
  }, [showGrid]);

  /**
   * Handle Undo button click
   */
  const handleUndoClick = useCallback(() => {
    undo();
    logger.info('[Undo] Performed undo operation');
  }, [undo]);

  /**
   * Handle Redo button click
   */
  const handleRedoClick = useCallback(() => {
    redo();
    logger.info('[Redo] Performed redo operation');
  }, [redo]);

  /**
   * Handle Add Text from top toolbar
   */
  const handleAddTextClick = useCallback(() => {
    // Create text node at viewport center
    const canvasRect = containerRef.current?.getBoundingClientRect();
    if (!canvasRect || !viewport) return;

    const viewportCenterX = (canvasRect.width / 2 - viewport.offsetX) / viewport.scale;
    const viewportCenterY = (canvasRect.height / 2 - viewport.offsetY) / viewport.scale;

    createTextBox(viewportCenterX - 55, viewportCenterY - 18);
    logger.info('[CreationToolbar] Created text node at viewport center');
  }, [viewport, containerRef, createTextBox]);

  /**
   * Handle node select
   * Layer 2 defense: Validate that node exists in Yjs before adding to selection
   */
  const handleNodeSelect = useCallback(
    (nodeId: string, multi: boolean) => {
      // Validate that node actually exists in Yjs (prevent ghost IDs)
      if (!nodesRef.current.has(nodeId)) {
        logger.warn(`[Selection] Attempted to select ghost node: ${nodeId}`);
        return; // Ignore selection of non-existent nodes
      }

      if (multi) {
        // Also clean existing selection of ghost IDs during multi-select
        const current = Array.from(selectedNodeIds).filter(id => nodesRef.current.has(id));

        if (current.includes(nodeId)) {
          // Deselect: remove from selection
          setSelectedNodes(current.filter(id => id !== nodeId));
        } else {
          // Select: add to cleaned selection
          setSelectedNodes([...current, nodeId]);
        }

        // Log if we cleaned any ghost IDs
        const ghostCount = selectedNodeIds.size - current.length;
        if (ghostCount > 0) {
          logger.info(`[Selection] Cleaned ${ghostCount} ghost node ID(s) during multi-select`);
        }
      } else {
        // Single select: replace selection
        setSelectedNodes([nodeId]);
      }
    },
    [selectedNodeIds, setSelectedNodes]
  );

  /**
   * Node Context Menu Action Handlers
   * These handle actions from the right-click context menu on nodes
   */

  /**
   * Handle lock nodes from context menu
   * Layer 2 defense: Validate nodes exist before locking
   */
  const handleLockNodes = useCallback((nodeIds: string[]) => {
    const validNodeIds = nodeIds.filter(id => nodesRef.current.has(id));

    if (validNodeIds.length === 0) {
      logger.warn('[Context Menu] Cannot lock - all node IDs are ghosts');
      return;
    }

    if (validNodeIds.length < nodeIds.length) {
      logger.warn(
        `[Context Menu] Filtered out ${nodeIds.length - validNodeIds.length} ghost node ID(s) before lock`
      );
    }

    const store = useWorkspaceStore.getState();
    validNodeIds.forEach(id => store.lockNode(unsafeToNodeId(id)));
    logger.info(`Locked ${validNodeIds.length} nodes from context menu`);
  }, []);

  /**
   * Handle unlock nodes from context menu
   * Layer 2 defense: Validate nodes exist before unlocking
   */
  const handleUnlockNodes = useCallback((nodeIds: string[]) => {
    const validNodeIds = nodeIds.filter(id => nodesRef.current.has(id));

    if (validNodeIds.length === 0) {
      logger.warn('[Context Menu] Cannot unlock - all node IDs are ghosts');
      return;
    }

    if (validNodeIds.length < nodeIds.length) {
      logger.warn(
        `[Context Menu] Filtered out ${nodeIds.length - validNodeIds.length} ghost node ID(s) before unlock`
      );
    }

    const store = useWorkspaceStore.getState();
    validNodeIds.forEach(id => store.unlockNode(unsafeToNodeId(id)));
    logger.info(`Unlocked ${validNodeIds.length} nodes from context menu`);
  }, []);

  /**
   * Handle delete nodes from context menu
   * Layer 2 defense: Validate nodes exist before deleting
   */
  const handleDeleteNodes = useCallback(
    async (nodeIds: string[]) => {
      if (isDeleteInProgress) {
        logger.info('Delete already in progress, ignoring context menu delete');
        return;
      }

      // Filter out ghost node IDs
      const validNodeIds = nodeIds.filter(id => nodesRef.current.has(id));

      if (validNodeIds.length === 0) {
        logger.warn('[Context Menu] Cannot delete - all node IDs are ghosts');
        clearSelection();
        return;
      }

      if (validNodeIds.length < nodeIds.length) {
        logger.warn(
          `[Context Menu] Filtered out ${nodeIds.length - validNodeIds.length} ghost node ID(s) before delete`
        );
      }

      logger.info(`Deleting ${validNodeIds.length} nodes from context menu`);

      // Clear selection immediately for better UX
      clearSelection();

      // Perform confirmed delete - waits for server confirmation
      const result = await confirmedDeleteMultiple(validNodeIds);
      if (!result.success) {
        logger.error('Context menu delete failed:', result.error);
      } else {
        logger.info('Context menu delete confirmed by server');
      }
    },
    [isDeleteInProgress, clearSelection, confirmedDeleteMultiple]
  );

  /**
   * Handle duplicate nodes from context menu
   */
  const handleDuplicateNodes = useCallback(
    async (nodeIds: string[]) => {
      if (!workspaceId) return;

      const DUPLICATE_OFFSET = 20;
      const newNodeIds: string[] = [];

      for (const nodeId of nodeIds) {
        const originalNode = nodes.get(nodeId);
        if (!originalNode) continue;

        try {
          const response = await fetchWithCSRF('/api/workspace/nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspace_id: workspaceId,
              position: {
                x: originalNode.position.x + DUPLICATE_OFFSET,
                y: originalNode.position.y + DUPLICATE_OFFSET,
              },
              size: originalNode.size,
              content: originalNode.content,
              style: originalNode.style || {},
              metadata: originalNode.metadata || {},
            }),
          });

          if (response.ok) {
            const newNode = await response.json();
            addNode(newNode);
            newNodeIds.push(newNode.id);
          } else {
            logger.error('Failed to duplicate node:', nodeId);
          }
        } catch (error) {
          logger.error(`Failed to duplicate node ${nodeId}:`, error);
        }
      }

      // Select all newly duplicated nodes
      if (newNodeIds.length > 0) {
        setSelectedNodes(newNodeIds);
        logger.info(`Duplicated ${newNodeIds.length} nodes from context menu`);
      }
    },
    [workspaceId, nodes, addNode, setSelectedNodes]
  );

  /**
   * Handle copy nodes from context menu (to clipboard)
   * Layer 2 defense: Validate nodes exist before selecting them
   */
  const handleCopyNodes = useCallback(
    (nodeIds: string[]) => {
      // Filter out ghost node IDs
      const validNodeIds = nodeIds.filter(id => nodesRef.current.has(id));

      if (validNodeIds.length === 0) {
        logger.warn('[Context Menu] Cannot copy - all node IDs are ghosts');
        return;
      }

      if (validNodeIds.length < nodeIds.length) {
        logger.warn(
          `[Context Menu] Filtered out ${nodeIds.length - validNodeIds.length} ghost node ID(s) before copy`
        );
      }

      // Select the valid nodes to copy
      setSelectedNodes(validNodeIds);
      // Copy to clipboard using store method
      copySelectedNodes();
      logger.info(`[Context Menu] Copied ${validNodeIds.length} nodes`);
    },
    [setSelectedNodes, copySelectedNodes]
  );

  /**
   * Handle bring nodes to front from context menu
   * Layer 2 defense: Validate nodes exist before z-index changes
   */
  const handleBringNodesToFront = useCallback(
    (nodeIds: string[]) => {
      const validNodeIds = nodeIds.filter(id => nodesRef.current.has(id));

      if (validNodeIds.length === 0) {
        logger.warn('[Context Menu] Cannot bring to front - all node IDs are ghosts');
        return;
      }

      if (validNodeIds.length < nodeIds.length) {
        logger.warn(
          `[Context Menu] Filtered out ${nodeIds.length - validNodeIds.length} ghost node ID(s) before bring to front`
        );
      }

      let maxZIndex = 0;
      nodes.forEach(node => {
        if (node.z_index > maxZIndex) {
          maxZIndex = node.z_index;
        }
      });

      // Bring each valid node to front with incrementing z-index
      validNodeIds.forEach((nodeId, index) => {
        const newZIndex = maxZIndex + index + 1;
        handleNodeUpdate(nodeId, { z_index: newZIndex });
      });

      logger.info(`Brought ${validNodeIds.length} nodes to front from context menu`);
    },
    [nodes, handleNodeUpdate]
  );

  /**
   * Handle send nodes to back from context menu
   * Layer 2 defense: Validate nodes exist before z-index changes
   */
  const handleSendNodesToBack = useCallback(
    (nodeIds: string[]) => {
      const validNodeIds = nodeIds.filter(id => nodesRef.current.has(id));

      if (validNodeIds.length === 0) {
        logger.warn('[Context Menu] Cannot send to back - all node IDs are ghosts');
        return;
      }

      if (validNodeIds.length < nodeIds.length) {
        logger.warn(
          `[Context Menu] Filtered out ${nodeIds.length - validNodeIds.length} ghost node ID(s) before send to back`
        );
      }

      // Send all valid nodes to z-index 0
      validNodeIds.forEach(nodeId => {
        handleNodeUpdate(nodeId, { z_index: 0 });
      });

      logger.info(`Sent ${validNodeIds.length} nodes to back from context menu`);
    },
    [handleNodeUpdate]
  );

  /**
   * Handle node right-click - show context menu
   */
  const handleNodeContextMenu = useCallback((nodeId: string, screenX: number, screenY: number) => {
    // Close canvas context menu if open
    setContextMenu(null);

    // Show node context menu at cursor position
    setNodeContextMenu({
      x: screenX,
      y: screenY,
      targetNodeId: nodeId,
    });

    logger.info('Node context menu opened for:', nodeId);
  }, []);

  /**
   * Handle editor ready - receive editor instance and position for toolbar
   */
  const handleEditorReady = useCallback(
    (
      nodeId: string,
      editor: Editor | MarkdownEditorAPI | null,
      position: { x: number; y: number } | null
    ) => {
      if (editor && position) {
        setActiveEditor({ nodeId, editor, position });
      } else {
        setActiveEditor(null);
      }
    },
    []
  );

  /**
   * Handle node color change from toolbar
   */
  const handleNodeColorChange = useCallback(
    (nodeId: string, color: string) => {
      const node = nodes.get(nodeId);
      if (!node) return;

      updateNode(unsafeToNodeId(nodeId), {
        style: {
          ...node.style,
          backgroundColor: color,
        },
      });

      // Persist to database
      debouncedSave(
        nodeId,
        {
          style: {
            ...node.style,
            backgroundColor: color,
          },
        },
        500
      );
    },
    [nodes, updateNode, debouncedSave]
  );

  /**
   * Handle node font size change from toolbar
   * Sets a fixed font size for the node (overrides auto-scaling)
   * Pass null to return to auto-scaling mode
   */
  const handleNodeFontSizeChange = useCallback(
    (nodeId: string, fontSize: number | null) => {
      const node = nodes.get(nodeId);
      if (!node) return;

      const newFormat = {
        ...node.content?.format,
        fontSize: fontSize ?? undefined, // null -> undefined (auto mode)
      };

      updateNode(unsafeToNodeId(nodeId), {
        content: {
          ...node.content,
          format: newFormat,
        },
      });

      // Persist to database
      debouncedSave(
        nodeId,
        {
          content: {
            ...node.content,
            format: newFormat,
          },
        },
        500
      );
    },
    [nodes, updateNode, debouncedSave]
  );

  /**
   * Handle node border width change from toolbar
   */
  const handleNodeBorderWidthChange = useCallback(
    (nodeId: string, width: number) => {
      const node = nodes.get(nodeId);
      if (!node) return;

      updateNode(unsafeToNodeId(nodeId), {
        style: {
          ...node.style,
          borderWidth: width,
        },
      });

      // Persist to database
      debouncedSave(
        nodeId,
        {
          style: {
            ...node.style,
            borderWidth: width,
          },
        },
        500
      );
    },
    [nodes, updateNode, debouncedSave]
  );

  /**
   * Handle node border color change from toolbar
   */
  const handleNodeBorderColorChange = useCallback(
    (nodeId: string, color: string) => {
      const node = nodes.get(nodeId);
      if (!node) return;

      updateNode(unsafeToNodeId(nodeId), {
        style: {
          ...node.style,
          borderColor: color,
        },
      });

      // Persist to database
      debouncedSave(
        nodeId,
        {
          style: {
            ...node.style,
            borderColor: color,
          },
        },
        500
      );
    },
    [nodes, updateNode, debouncedSave]
  );

  /**
   * Handle node border radius change from toolbar
   */
  const handleNodeBorderRadiusChange = useCallback(
    (nodeId: string, radius: number) => {
      const node = nodes.get(nodeId);
      if (!node) return;

      updateNode(unsafeToNodeId(nodeId), {
        style: {
          ...node.style,
          borderRadius: radius,
        },
      });

      // Persist to database
      debouncedSave(
        nodeId,
        {
          style: {
            ...node.style,
            borderRadius: radius,
          },
        },
        500
      );
    },
    [nodes, updateNode, debouncedSave]
  );

  /**
   * Render visible nodes
   */
  const renderNodes = useCallback(() => {
    if (!containerRef.current || !viewportCullerRef.current || !transformManagerRef.current)
      return null;

    const rect = containerRef.current.getBoundingClientRect();
    const viewportBounds = transformManagerRef.current.getVisibleBounds(
      rect.width,
      rect.height,
      viewportCullerRef.current.getMargin()
    );

    if (!viewportBounds) return null;

    const visibleNodes = viewportCullerRef.current.cullNodes(nodes, viewportBounds);

    const allNodeIds = Array.from(nodes.keys());
    const visibleNodeIds = visibleNodes.map(n => n.id);
    const culledNodeIds = allNodeIds.filter(id => !visibleNodeIds.includes(unsafeToNodeId(id)));

    // Show positions of all nodes
    const nodePositions = Array.from(nodes.values()).map(n => ({
      id: n.id.substring(0, 20),
      pos: n.position,
      visible: visibleNodeIds.includes(n.id),
    }));

    logger.info('[WorkspaceCanvas] Rendering:', {
      totalNodes: nodes.size,
      visibleNodes: visibleNodes.length,
      culledNodes: culledNodeIds.length,
      viewportBounds,
      nodePositions,
    });

    return visibleNodes.map(node => (
      <div
        key={node.id}
        onMouseEnter={() => {
          // Clear any pending clear timeout
          if (hoveredNodeTimeoutRef.current) {
            clearTimeout(hoveredNodeTimeoutRef.current);
            hoveredNodeTimeoutRef.current = null;
          }
          setHoveredNodeId(node.id);
        }}
        onMouseLeave={() => {
          // Delay clearing hover to allow smooth transition to anchors
          hoveredNodeTimeoutRef.current = setTimeout(() => {
            setHoveredNodeId(null);
          }, 100);
        }}
      >
        <TextNodeErrorBoundary
          nodeId={node.id}
          position={node.position}
          size={node.size}
          onDelete={() => handleNodeDelete(node.id)}
        >
          <TextNode
            node={node}
            isSelected={selectedNodeIds.has(node.id)}
            isDragging={isDragging && dragNodeId === node.id}
            scale={transformManagerRef.current?.getZoom() || 1}
            onUpdate={updates => handleNodeUpdate(node.id, updates)}
            onDelete={() => handleNodeDelete(node.id)}
            onSelect={multi => handleNodeSelect(node.id, multi)}
            onEditorReady={handleEditorReady}
            onTyping={handleTyping}
            onContextMenu={(screenX, screenY) => handleNodeContextMenu(node.id, screenX, screenY)}
            onSaveNode={() => {
              // Get current node state from Yjs (updated by onUpdate during resize)
              const currentNode = nodes.get(node.id);
              if (currentNode) {
                debouncedSave(
                  node.id,
                  { position: currentNode.position, size: currentNode.size },
                  0
                );
              }
            }}
            onDragStart={e => {
              // CRITICAL: Prevent native HTML5 drag which blocks mousemove events
              // The browser's drag/drop interferes with our custom InputHandler drag
              e.preventDefault();
              logger.info('[WorkspaceCanvas] Blocked native drag');
            }}
          />
        </TextNodeErrorBoundary>
      </div>
    ));
  }, [
    nodes,
    selectedNodeIds,
    isDragging,
    dragNodeId,
    handleNodeUpdate,
    handleNodeDelete,
    handleNodeSelect,
    handleEditorReady,
    handleTyping,
    debouncedSave,
  ]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-neutral-950">
        {/* Spinner */}
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-4 border-neutral-800"></div>
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-t-blue-500"></div>
        </div>

        {/* Loading text */}
        <div className="text-sm text-neutral-400">Loading workspace...</div>

        {/* Skeleton hint */}
        <div className="absolute bottom-4 left-4 rounded-lg border border-neutral-800/50 bg-neutral-900/50 px-3 py-2 text-xs text-neutral-500">
          <div className="animate-pulse">Initializing canvas...</div>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceErrorBoundary
      fallbackType="workspace"
      workspaceId={initialWorkspace?.workspace.id || 'unknown'}
      onError={(error, errorInfo) => {
        logger.error('Workspace crashed:', {
          workspaceId: initialWorkspace?.workspace.id,
          error,
          errorInfo,
        });
      }}
    >
      <div
        ref={containerRef}
        data-testid="workspace-canvas"
        className="relative h-full w-full overflow-hidden bg-neutral-950"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Background Grid */}
        {showGrid && (
          <div
            ref={gridLayerRef}
            className="pointer-events-none absolute inset-0 origin-top-left"
            style={{ transformOrigin: '0 0' }}
          >
            <CanvasGrid />
          </div>
        )}

        {/* Canvas Layer (transforms via CSS) */}
        <div
          ref={canvasLayerRef}
          className="pointer-events-none absolute inset-0 origin-top-left"
          style={{
            transform: transformManagerRef.current?.toCSSTransform() || 'none',
            transformOrigin: '0 0',
            cursor: getCursorStyle(),
          }}
        >
          {/* Connection Layer (renders behind nodes) */}
          <ConnectionRenderer
            onConnectionClick={handleConnectionClick}
            onConnectionDelete={handleConnectionDelete}
            previewConnection={
              connectionSource && cursorPosition && nodes.get(connectionSource.nodeId)
                ? {
                    sourceNode: nodes.get(connectionSource.nodeId)!,
                    sourceAnchor: {
                      side: connectionSource.side,
                      offset: connectionSource.offset,
                    },
                    cursorPosition,
                  }
                : null
            }
          />

          {/* Render visible nodes */}
          {renderNodes()}

          {/* Selection Bounding Box (shown when multiple nodes are selected) */}
          {selectedNodeIds.size > 1 &&
            transformManagerRef.current &&
            (() => {
              // Calculate bounding box for all selected nodes
              const selectedNodesArray = Array.from(selectedNodeIds)
                .map(id => nodes.get(id))
                .filter((node): node is NonNullable<typeof node> => node !== undefined);

              const boundingBox = calculateBoundingBox(selectedNodesArray);

              return boundingBox ? (
                <SelectionBoundingBox
                  boundingBox={boundingBox}
                  scale={transformManagerRef.current?.getZoom() || 1}
                  isDragging={
                    isDragging &&
                    dragStartPositionsRef.current !== null &&
                    dragStartPositionsRef.current.size > 1
                  }
                  onDragStart={e => {
                    // Let InputHandler handle bounding box drag
                    // No stopPropagation needed - InputHandler detects clicks inside selection bounds
                  }}
                />
              ) : null;
            })()}

          {/* Node Anchors (shown when selected, hovered, or drawing connection) */}
          {transformManagerRef.current && (
            <>
              {Array.from(nodes.values()).map(node => {
                // Show anchors if:
                // 1. Node is selected, OR
                // 2. Node is being hovered, OR
                // 3. An anchor on this node is being hovered, OR
                // 4. A connection is being drawn (to show potential targets)
                const isNodeSelected = selectedNodeIds.has(node.id);
                const isNodeHovered = hoveredNodeId === node.id;
                const hasHoveredAnchor = hoveredAnchor?.nodeId === node.id;
                const isDrawingConnection = connectionSource !== null;
                const shouldShowAnchors =
                  isNodeSelected || isNodeHovered || hasHoveredAnchor || isDrawingConnection;

                return (
                  <NodeAnchors
                    key={`anchors-${node.id}`}
                    node={node}
                    visible={shouldShowAnchors}
                    scale={transformManagerRef.current?.getZoom() || 1}
                    onAnchorClick={handleAnchorClick}
                    selectedSource={connectionSource}
                    hoveredAnchor={hoveredAnchor}
                    onAnchorHover={handleAnchorHover}
                    onAnchorLeave={handleAnchorLeave}
                  />
                );
              })}
            </>
          )}
        </div>

        {/* Zoom Controls - Bottom Right */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-2 shadow-lg">
          <button
            onClick={() => {
              if (inputHandlerRef.current) {
                inputHandlerRef.current.zoomIn();
              }
            }}
            className="rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-700"
            title="Zoom in (+)"
          >
            +
          </button>
          <button
            onClick={() => {
              if (inputHandlerRef.current) {
                inputHandlerRef.current.resetZoom();
              }
            }}
            className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-300 transition-colors hover:bg-neutral-700"
            title="Reset zoom (Ctrl+0)"
          >
            {Math.round((viewport?.scale || 1.0) * 100)}%
          </button>
          <button
            onClick={() => {
              if (inputHandlerRef.current) {
                inputHandlerRef.current.zoomOut();
              }
            }}
            className="rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-700"
            title="Zoom out (-)"
          >
            −
          </button>
        </div>

        {/* Error Toast - Top Center */}
        {saveError && (
          <div className="absolute left-1/2 top-4 z-50 flex max-w-md -translate-x-1/2 transform items-center gap-3 rounded-lg bg-red-500 px-4 py-3 text-white shadow-lg">
            <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <div className="font-semibold">Save Failed</div>
              <div className="text-sm opacity-90">{saveError}</div>
            </div>
            <button
              onClick={() => setSaveError(null)}
              className="text-white transition-colors hover:text-red-100"
              aria-label="Dismiss error"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Creation Toolbar - Top Left */}
        <CreationToolbar onAddText={handleAddTextClick} disabled={isLoading || !workspaceId} />

        {/* Workspace Toolbar - Bottom Left */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2">
          {/* Main Toolbar - Always Visible */}
          <div className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 p-1.5 shadow-lg">
            {/* Edit Operations */}
            <button
              onClick={handleUndoClick}
              disabled={!canUndo()}
              className="flex h-8 w-8 items-center justify-center rounded bg-neutral-800 text-neutral-300 transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
              title="Undo (Ctrl+Z)"
              aria-label="Undo last action"
            >
              <UndoIcon />
            </button>
            <button
              onClick={handleRedoClick}
              disabled={!canRedo()}
              className="flex h-8 w-8 items-center justify-center rounded bg-neutral-800 text-neutral-300 transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo last undone action"
            >
              <RedoIcon />
            </button>

            {/* Divider */}
            <div className="mx-1 h-6 w-px bg-neutral-700" />

            {/* Lock/Unlock Toggle */}
            <button
              onClick={() => {
                if (selectedNodeIds.size === 0) return;

                const selectedNodes = Array.from(selectedNodeIds)
                  .map(id => nodes.get(id))
                  .filter((n): n is CanvasNode => n !== undefined);

                const lockedCount = selectedNodes.filter(n => n.metadata?.locked === true).length;
                const allLocked = lockedCount === selectedNodes.length;

                const store = useWorkspaceStore.getState();
                if (allLocked) {
                  store.unlockSelectedNodes();
                } else {
                  store.lockSelectedNodes();
                }
              }}
              disabled={selectedNodeIds.size === 0}
              className="flex h-8 w-8 items-center justify-center rounded bg-neutral-800 text-neutral-300 transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                selectedNodeIds.size === 0
                  ? 'Lock/Unlock (Ctrl+L) - Select nodes first'
                  : (() => {
                      const selectedNodes = Array.from(selectedNodeIds)
                        .map(id => nodes.get(id))
                        .filter((n): n is CanvasNode => n !== undefined);
                      const lockedCount = selectedNodes.filter(
                        n => n.metadata?.locked === true
                      ).length;
                      const allLocked = lockedCount === selectedNodes.length;
                      return allLocked
                        ? `Unlock ${selectedNodeIds.size} node${selectedNodeIds.size > 1 ? 's' : ''} (Ctrl+L)`
                        : `Lock ${selectedNodeIds.size} node${selectedNodeIds.size > 1 ? 's' : ''} (Ctrl+L)`;
                    })()
              }
              aria-label="Toggle lock state of selected nodes"
            >
              {(() => {
                if (selectedNodeIds.size === 0) return <LockIcon />;

                const selectedNodes = Array.from(selectedNodeIds)
                  .map(id => nodes.get(id))
                  .filter((n): n is CanvasNode => n !== undefined);
                const lockedCount = selectedNodes.filter(n => n.metadata?.locked === true).length;
                const allLocked = lockedCount === selectedNodes.length;

                return allLocked ? <UnlockIcon /> : <LockIcon />;
              })()}
            </button>

            {/* Divider */}
            <div className="mx-1 h-6 w-px bg-neutral-700" />

            {/* View Controls */}
            <button
              onClick={handleToggleGrid}
              className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
                showGrid
                  ? 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
              title="Toggle Grid"
              aria-label="Toggle background grid visibility"
            >
              <GridIcon />
            </button>

            {/* Divider */}
            <div className="mx-1 h-6 w-px bg-neutral-700" />

            {/* File Operations */}
            <button
              onClick={handleExportClick}
              className="flex h-8 w-8 items-center justify-center rounded bg-neutral-800 text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-white"
              title="Export to JSON (Ctrl+E)"
              aria-label="Export workspace to JSON file"
            >
              <ExportIcon />
            </button>
            <button
              onClick={handleExportPNGClick}
              className="flex h-8 w-8 items-center justify-center rounded bg-neutral-800 text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-white"
              title="Export to PNG"
              aria-label="Export workspace to PNG image"
            >
              <ImageIcon />
            </button>
            <button
              onClick={handleImportClick}
              className="flex h-8 w-8 items-center justify-center rounded bg-neutral-800 text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-white"
              title="Import from JSON (Ctrl+Shift+I)"
              aria-label="Import workspace from JSON file"
            >
              <ImportIcon />
            </button>

            {/* Divider */}
            <div className="mx-1 h-6 w-px bg-neutral-700" />

            {/* Status Indicators */}
            <div className="flex items-center gap-2 px-2 text-xs text-neutral-400">
              <span>{nodes.size} nodes</span>
              {saveStatus === 'saving' || hasPendingSaves ? (
                <span className="flex items-center gap-1 text-[10px] text-amber-500">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"></span>
                  Saving
                </span>
              ) : saveStatus === 'error' ? (
                <span className="flex items-center gap-1 text-[10px] text-red-500">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500"></span>
                  Error
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-emerald-500">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  Saved
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Canvas Context Menu */}
        {contextMenu && (
          <CanvasContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onAddText={() => {
              createTextBox(contextMenu.canvasX - 55, contextMenu.canvasY - 18);
              setContextMenu(null);
            }}
            onCreateNote={() => {
              createNode(contextMenu.canvasX - 150, contextMenu.canvasY - 100);
              setContextMenu(null);
            }}
            onClose={() => setContextMenu(null)}
          />
        )}

        {/* Node Context Menu */}
        {nodeContextMenu && (
          <NodeContextMenu
            x={nodeContextMenu.x}
            y={nodeContextMenu.y}
            targetNodeId={nodeContextMenu.targetNodeId}
            selectedNodeIds={selectedNodeIds}
            nodes={nodes}
            onClose={() => setNodeContextMenu(null)}
            onLock={handleLockNodes}
            onUnlock={handleUnlockNodes}
            onDelete={handleDeleteNodes}
            onDuplicate={handleDuplicateNodes}
            onCopy={handleCopyNodes}
            onBringToFront={handleBringNodesToFront}
            onSendToBack={handleSendNodesToBack}
          />
        )}

        {/* Floating Format Toolbar - Appears when editing (Markdown or HTML mode) */}
        {activeEditor &&
          (isMarkdownModeEnabled() ? (
            <MarkdownFloatingToolbar
              editor={activeEditor.editor as MarkdownEditorAPI}
              visible={true}
              position={activeEditor.position}
              nodeType={(() => {
                const node = nodes.get(activeEditor.nodeId);
                return node?.content?.title ? 'note' : 'text';
              })()}
              nodeColor={(() => {
                const node = nodes.get(activeEditor.nodeId);
                return node?.style?.backgroundColor || '#FEF08A';
              })()}
              fontSize={(() => {
                const node = nodes.get(activeEditor.nodeId);
                return node?.content?.format?.fontSize;
              })()}
              borderWidth={(() => {
                const node = nodes.get(activeEditor.nodeId);
                return node?.style?.borderWidth ?? 0;
              })()}
              borderColor={(() => {
                const node = nodes.get(activeEditor.nodeId);
                return node?.style?.borderColor || '#6B7280';
              })()}
              borderRadius={(() => {
                const node = nodes.get(activeEditor.nodeId);
                return node?.style?.borderRadius ?? 0;
              })()}
              onFontSizeChange={size => handleNodeFontSizeChange(activeEditor.nodeId, size)}
              onColorChange={color => handleNodeColorChange(activeEditor.nodeId, color)}
              onBorderWidthChange={width => handleNodeBorderWidthChange(activeEditor.nodeId, width)}
              onBorderColorChange={color => handleNodeBorderColorChange(activeEditor.nodeId, color)}
              onBorderRadiusChange={radius =>
                handleNodeBorderRadiusChange(activeEditor.nodeId, radius)
              }
              onDuplicate={() => handleNodeDuplicate(activeEditor.nodeId)}
              onBringToFront={() => handleBringToFront(activeEditor.nodeId)}
              onSendToBack={() => handleSendToBack(activeEditor.nodeId)}
              onDelete={() => handleNodeDelete(activeEditor.nodeId)}
            />
          ) : (
            <FloatingFormatToolbar
              editor={activeEditor.editor as Editor}
              visible={true}
              position={activeEditor.position}
              nodeType={(() => {
                const node = nodes.get(activeEditor.nodeId);
                return node?.content?.title ? 'note' : 'text';
              })()}
              nodeColor={(() => {
                const node = nodes.get(activeEditor.nodeId);
                return node?.style?.backgroundColor || '#FEF08A';
              })()}
              fontSize={(() => {
                const node = nodes.get(activeEditor.nodeId);
                return node?.content?.format?.fontSize;
              })()}
              borderWidth={(() => {
                const node = nodes.get(activeEditor.nodeId);
                return node?.style?.borderWidth ?? 0;
              })()}
              borderColor={(() => {
                const node = nodes.get(activeEditor.nodeId);
                return node?.style?.borderColor || '#6B7280';
              })()}
              borderRadius={(() => {
                const node = nodes.get(activeEditor.nodeId);
                return node?.style?.borderRadius ?? 0;
              })()}
              onFontSizeChange={size => handleNodeFontSizeChange(activeEditor.nodeId, size)}
              onColorChange={color => handleNodeColorChange(activeEditor.nodeId, color)}
              onBorderWidthChange={width => handleNodeBorderWidthChange(activeEditor.nodeId, width)}
              onBorderColorChange={color => handleNodeBorderColorChange(activeEditor.nodeId, color)}
              onBorderRadiusChange={radius =>
                handleNodeBorderRadiusChange(activeEditor.nodeId, radius)
              }
              onDuplicate={() => handleNodeDuplicate(activeEditor.nodeId)}
              onBringToFront={() => handleBringToFront(activeEditor.nodeId)}
              onSendToBack={() => handleSendToBack(activeEditor.nodeId)}
              onDelete={() => handleNodeDelete(activeEditor.nodeId)}
            />
          ))}

        {/* Alignment Toolbar - Appears when 2+ nodes selected (not editing) */}
        {selectedNodeIds.size >= 2 &&
          !activeEditor &&
          (() => {
            const selectedNodes = Array.from(selectedNodeIds)
              .map(id => nodes.get(id))
              .filter((n): n is CanvasNode => n !== undefined);

            if (selectedNodes.length < 2) return null;

            // Calculate bounding box for toolbar positioning
            const bounds = calculateBoundingBox(selectedNodes);
            if (!bounds) return null;

            // Convert canvas coordinates to screen coordinates
            const screenX =
              bounds.x * viewport.scale + viewport.offsetX + (bounds.width * viewport.scale) / 2;
            const screenY = bounds.y * viewport.scale + viewport.offsetY;

            // Count locked nodes
            const lockedCount = selectedNodes.filter(isNodeLocked).length;

            return (
              <AlignmentToolbar
                visible={true}
                position={{ x: screenX, y: screenY }}
                nodeCount={selectedNodes.length}
                lockedCount={lockedCount}
                onAlign={handleAlign}
                onDistribute={handleDistribute}
              />
            );
          })()}

        {/* Connection Toolbar - Appears when a connection is selected */}
        {selectedConnectionIds.size === 1 &&
          (() => {
            const connectionId = Array.from(selectedConnectionIds)[0] as string;
            const connection = connections.get(connectionId);
            if (!connection) return null;

            // Get source and target nodes to calculate toolbar position
            const sourceNode = nodes.get(connection.source_node_id as string);
            const targetNode = nodes.get(connection.target_node_id as string);
            if (!sourceNode || !targetNode) return null;

            // Calculate midpoint between source and target
            const midX = (sourceNode.position.x + targetNode.position.x) / 2;
            const midY = (sourceNode.position.y + targetNode.position.y) / 2;

            // Convert canvas coordinates to screen coordinates
            const screenX = midX * viewport.scale + viewport.offsetX;
            const screenY = midY * viewport.scale + viewport.offsetY;

            return (
              <ConnectionToolbar
                visible={true}
                position={{ x: screenX, y: screenY }}
                color={connection.style?.color}
                width={connection.style?.width}
                dashArray={connection.style?.dashArray}
                arrowType={connection.style?.arrowType}
                opacity={connection.style?.opacity}
                onColorChange={color => handleConnectionColorChange(connectionId, color)}
                onWidthChange={width => handleConnectionWidthChange(connectionId, width)}
                onDashArrayChange={dashArray =>
                  handleConnectionDashArrayChange(connectionId, dashArray)
                }
                onArrowTypeChange={arrowType =>
                  handleConnectionArrowTypeChange(connectionId, arrowType)
                }
                onOpacityChange={opacity => handleConnectionOpacityChange(connectionId, opacity)}
                onDelete={() => handleConnectionDelete(connectionId)}
              />
            );
          })()}

        {/* Remote User Cursors - Real-time collaboration presence */}
        <RemoteCursors />

        {/* Marquee Selection Box */}
        {marqueeBox && (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-blue-500 bg-blue-500/10"
            style={{
              left: `${Math.min(marqueeBox.start.x, marqueeBox.end.x)}px`,
              top: `${Math.min(marqueeBox.start.y, marqueeBox.end.y)}px`,
              width: `${Math.abs(marqueeBox.end.x - marqueeBox.start.x)}px`,
              height: `${Math.abs(marqueeBox.end.y - marqueeBox.start.y)}px`,
              zIndex: 9999, // Above everything else
            }}
          />
        )}
      </div>
    </WorkspaceErrorBoundary>
  );
}
