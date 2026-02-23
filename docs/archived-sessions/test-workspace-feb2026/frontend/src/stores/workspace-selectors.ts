/**
 * Yjs-First Selectors for Workspace System
 *
 * These hooks read directly from Yjs Y.Maps using useSyncExternalStore,
 * establishing Yjs as the SINGLE source of truth.
 *
 * Phase 1 of workspace refactoring - these selectors can be used alongside
 * existing hooks during migration, then become the only way to read state.
 *
 * IMPORTANT: Snapshots are cached using useRef to prevent infinite re-render loops.
 * Only update the cache when the observe callback fires.
 *
 * @see /home/user/.claude/plans/valiant-weaving-whisper.md
 */

import { useSyncExternalStore, useCallback, useMemo, useRef, useEffect } from 'react';
import { useWorkspaceStore } from './workspace';
import type { CanvasNode, Connection } from '@/lib/workspace/types';

// Module-level caches for server snapshot stability
const EMPTY_NODES_ARRAY: CanvasNode[] = [];
const EMPTY_CONNECTIONS_ARRAY: Connection[] = [];

/**
 * Subscribe to all nodes directly from Yjs Y.Map
 *
 * This hook:
 * 1. Gets the yjsNodes Y.Map from Zustand
 * 2. Uses useSyncExternalStore to subscribe to Yjs changes
 * 3. Returns an array of all nodes (reactive to Yjs updates)
 *
 * @returns Array of all canvas nodes from Yjs
 */
export function useYjsNodes(): CanvasNode[] {
  const yjsNodes = useWorkspaceStore(state => state.yjsNodes);
  const cacheRef = useRef<CanvasNode[]>(EMPTY_NODES_ARRAY);
  const versionRef = useRef(0);

  // Update cache when yjsNodes changes
  // Deep clone to avoid Yjs proxy issues (proxies don't spread correctly)
  useEffect(() => {
    if (yjsNodes) {
      cacheRef.current = Array.from(yjsNodes.values()).map(
        node => JSON.parse(JSON.stringify(node)) as CanvasNode
      );
      versionRef.current++;
    } else {
      cacheRef.current = EMPTY_NODES_ARRAY;
    }
  }, [yjsNodes]);

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!yjsNodes) return () => {};

      const observer = () => {
        // Deep clone to avoid Yjs proxy issues
        cacheRef.current = Array.from(yjsNodes.values()).map(
          node => JSON.parse(JSON.stringify(node)) as CanvasNode
        );
        versionRef.current++;
        callback();
      };

      yjsNodes.observe(observer);
      return () => yjsNodes.unobserve(observer);
    },
    [yjsNodes]
  );

  // getSnapshot returns the cached array - same reference until observer fires
  const getSnapshot = useCallback(() => cacheRef.current, []);

  // Server snapshot must be stable - return module-level constant
  const getServerSnapshot = useCallback(() => EMPTY_NODES_ARRAY, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Subscribe to all connections directly from Yjs Y.Map
 *
 * @returns Array of all connections from Yjs
 */
export function useYjsConnections(): Connection[] {
  const yjsConnections = useWorkspaceStore(state => state.yjsConnections);
  const cacheRef = useRef<Connection[]>(EMPTY_CONNECTIONS_ARRAY);
  const versionRef = useRef(0);

  // Update cache when yjsConnections changes
  // Deep clone to avoid Yjs proxy issues
  useEffect(() => {
    if (yjsConnections) {
      cacheRef.current = Array.from(yjsConnections.values()).map(
        conn => JSON.parse(JSON.stringify(conn)) as Connection
      );
      versionRef.current++;
    } else {
      cacheRef.current = EMPTY_CONNECTIONS_ARRAY;
    }
  }, [yjsConnections]);

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!yjsConnections) return () => {};

      const observer = () => {
        // Deep clone to avoid Yjs proxy issues
        cacheRef.current = Array.from(yjsConnections.values()).map(
          conn => JSON.parse(JSON.stringify(conn)) as Connection
        );
        versionRef.current++;
        callback();
      };

      yjsConnections.observe(observer);
      return () => yjsConnections.unobserve(observer);
    },
    [yjsConnections]
  );

  // getSnapshot returns the cached array - same reference until observer fires
  const getSnapshot = useCallback(() => cacheRef.current, []);

  // Server snapshot must be stable - return module-level constant
  const getServerSnapshot = useCallback(() => EMPTY_CONNECTIONS_ARRAY, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Get a single node by ID from Yjs
 *
 * @param nodeId - The ID of the node to retrieve
 * @returns The node if found, undefined otherwise
 */
export function useYjsNode(nodeId: string | null): CanvasNode | undefined {
  const yjsNodes = useWorkspaceStore(state => state.yjsNodes);
  const cacheRef = useRef<CanvasNode | undefined>(undefined);

  // Update cache when yjsNodes or nodeId changes
  useEffect(() => {
    if (yjsNodes && nodeId) {
      cacheRef.current = yjsNodes.get(nodeId);
    } else {
      cacheRef.current = undefined;
    }
  }, [yjsNodes, nodeId]);

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!yjsNodes) return () => {};

      const observer = () => {
        if (nodeId) {
          cacheRef.current = yjsNodes.get(nodeId);
        }
        callback();
      };

      yjsNodes.observe(observer);
      return () => yjsNodes.unobserve(observer);
    },
    [yjsNodes, nodeId]
  );

  const getSnapshot = useCallback(() => cacheRef.current, []);

  const getServerSnapshot = useCallback(() => undefined, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Get nodes filtered by a predicate from Yjs
 *
 * @param predicate - Function to filter nodes
 * @returns Array of nodes matching the predicate
 */
export function useYjsNodesFiltered(predicate: (node: CanvasNode) => boolean): CanvasNode[] {
  const allNodes = useYjsNodes();

  return useMemo(() => {
    return allNodes.filter(predicate);
  }, [allNodes, predicate]);
}

/**
 * Get connections for a specific node from Yjs
 *
 * @param nodeId - The ID of the node
 * @returns Array of connections involving this node
 */
export function useYjsNodeConnections(nodeId: string | null): Connection[] {
  const allConnections = useYjsConnections();

  return useMemo(() => {
    if (!nodeId) return [];
    return allConnections.filter(
      conn => conn.source_node_id === nodeId || conn.target_node_id === nodeId
    );
  }, [allConnections, nodeId]);
}

/**
 * Get node count from Yjs (useful for conditional rendering)
 *
 * @returns Number of nodes in Yjs
 */
export function useYjsNodeCount(): number {
  const yjsNodes = useWorkspaceStore(state => state.yjsNodes);

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!yjsNodes) return () => {};
      yjsNodes.observe(callback);
      return () => yjsNodes.unobserve(callback);
    },
    [yjsNodes]
  );

  const getSnapshot = useCallback(() => {
    return yjsNodes?.size ?? 0;
  }, [yjsNodes]);

  const getServerSnapshot = useCallback(() => 0, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Check if Yjs has any nodes (useful for empty state)
 *
 * @returns true if there are nodes in Yjs
 */
export function useYjsHasNodes(): boolean {
  const count = useYjsNodeCount();
  return count > 0;
}

/**
 * Get selected nodes from Yjs based on selection state
 *
 * @returns Array of selected nodes
 */
export function useYjsSelectedNodes(): CanvasNode[] {
  const selectedNodeIds = useWorkspaceStore(state => state.selectedNodeIds);
  const allNodes = useYjsNodes();

  return useMemo(() => {
    const selectedSet = new Set(selectedNodeIds);
    return allNodes.filter(node => selectedSet.has(node.id));
  }, [allNodes, selectedNodeIds]);
}

/**
 * Get a Map of nodes by ID from Yjs
 * Useful when you need O(1) lookup by ID
 *
 * @returns Map of node ID to node
 */
export function useYjsNodesMap(): Map<string, CanvasNode> {
  const allNodes = useYjsNodes();

  return useMemo(() => {
    const map = new Map<string, CanvasNode>();
    for (const node of allNodes) {
      map.set(node.id, node);
    }
    return map;
  }, [allNodes]);
}
