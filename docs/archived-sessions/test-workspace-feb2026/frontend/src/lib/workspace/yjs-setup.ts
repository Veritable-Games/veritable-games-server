import * as Y from 'yjs';
import { UndoManager } from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WorkspaceId } from './branded-types';
import { CanvasNode, Connection, ViewportState } from './types';
import { logger } from '@/lib/utils/logger';

// Yjs document shared types
// NOTE: Viewport is NOT included - it's local-only per user
export interface YjsWorkspaceData {
  nodes: Y.Map<CanvasNode>;
  connections: Y.Map<Connection>;
}

// Create or get Yjs document for workspace
export function setupYjsDocument(workspaceId: WorkspaceId) {
  const doc = new Y.Doc();

  // Define shared types
  const nodes = doc.getMap<CanvasNode>('nodes');
  const connections = doc.getMap<Connection>('connections');
  // REMOVED: viewport Y.Map - viewport is now LOCAL ONLY (not synced)

  return { doc, nodes, connections };
}

// Set up WebSocket provider
export function setupWebSocketProvider(
  doc: Y.Doc,
  workspaceId: WorkspaceId,
  wsUrl: string = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002'
): WebsocketProvider | null {
  try {
    // FIX: Don't auto-connect to prevent race conditions during navigation
    // Connection will be established after component fully mounts
    const provider = new WebsocketProvider(wsUrl, workspaceId, doc, {
      connect: false, // Delay connection until after mount
      params: { workspace: workspaceId },
    });

    // Connection status logging
    provider.on('status', (event: { status: string }) => {
      logger.info(`🔌 WebSocket status: ${event.status}`);
    });

    provider.on('sync', (isSynced: boolean) => {
      if (isSynced) {
        logger.info('✅ Workspace synced with server');
      }
    });

    // FIX: Connect after event listeners are attached
    // This ensures we can properly track connection state changes
    // and prevents "connection interrupted" errors during navigation
    requestAnimationFrame(() => {
      if (provider.wsconnected === false && provider.wsconnecting === false) {
        provider.connect();
        logger.info('[Yjs] WebSocket connection initiated');
      }
    });

    return provider;
  } catch (error) {
    logger.error('[Yjs] Failed to create WebSocket provider:', error);
    return null;
  }
}

// Set up IndexedDB persistence for offline support
export function setupIndexedDBPersistence(
  doc: Y.Doc,
  workspaceId: WorkspaceId
): IndexeddbPersistence | null {
  try {
    const persistence = new IndexeddbPersistence(`workspace-${workspaceId}`, doc);

    persistence.on('synced', () => {
      logger.info('💾 Workspace synced with IndexedDB');
    });

    return persistence;
  } catch (error) {
    logger.error('[Yjs] Failed to create IndexedDB persistence:', error);
    return null;
  }
}

// Convert Yjs Map to plain object for Zustand
export function yjsMapToObject<T>(yjsMap: Y.Map<T>): Map<string, T> {
  const result = new Map<string, T>();
  yjsMap.forEach((value, key) => {
    result.set(key, value);
  });
  return result;
}

// Convert plain Map to Yjs Map
export function objectToYjsMap<T>(yjsMap: Y.Map<T>, plainMap: Map<string, T>) {
  plainMap.forEach((value, key) => {
    yjsMap.set(key, value);
  });
}

// Set up awareness for presence (cursors, selections)
export function setupAwareness(provider: WebsocketProvider, userId: string) {
  const awareness = provider.awareness;

  awareness.setLocalStateField('user', {
    id: userId,
    name: 'User ' + userId.slice(0, 6), // Could load from user profile
    color: generateUserColor(userId),
    cursor: null,
    selection: null,
  });

  return awareness;
}

// Generate consistent color from user ID
function generateUserColor(userId: string): string {
  const colors = [
    '#DC2626', // red
    '#EA580C', // orange
    '#0891B2', // cyan
    '#7C3AED', // violet
    '#059669', // emerald
    '#4338CA', // indigo
  ];

  const hash = userId.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  return colors[Math.abs(hash) % colors.length]!;
}

/**
 * Set up Yjs UndoManager for undo/redo support
 *
 * The UndoManager tracks changes to the specified shared types and allows
 * undoing/redoing those changes. Changes within captureTimeout are grouped
 * into a single undo step.
 *
 * @param doc - The Yjs document
 * @param nodes - The Y.Map containing canvas nodes
 * @param connections - The Y.Map containing connections
 * @returns UndoManager instance
 */
export function setupUndoManager(
  doc: Y.Doc,
  nodes: Y.Map<CanvasNode>,
  connections: Y.Map<Connection>
): UndoManager {
  const undoManager = new UndoManager([nodes, connections], {
    // Group changes within 500ms into a single undo step
    // This groups rapid changes like dragging or typing
    captureTimeout: 500,
    // Track changes from all origins (local and remote)
    // We only track local changes to avoid undoing others' work
    trackedOrigins: new Set(['local']),
  });

  logger.info('[Yjs] UndoManager initialized', {
    trackedTypes: 2, // nodes + connections
    captureTimeout: 500,
  });

  return undoManager;
}
