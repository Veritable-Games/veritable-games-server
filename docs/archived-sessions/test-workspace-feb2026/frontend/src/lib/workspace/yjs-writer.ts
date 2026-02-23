/**
 * YjsSafeWriter - Type-Safe Yjs Write Abstraction
 *
 * This class provides a centralized, type-safe interface for writing to Yjs Y.Maps.
 * It prevents Immer proxy leaks by stripping proxies before all writes and enforces
 * numeric validation to prevent string concatenation bugs.
 *
 * Core Responsibilities:
 * 1. Strip Immer proxies before Yjs writes (prevents revoked proxy errors)
 * 2. Sanitize numeric values (ensures position/size are numbers, not strings)
 * 3. Atomic transactions (all writes are transactional)
 * 4. Cascade deletes (deleting node removes connected connections)
 * 5. Compile-time type safety (branded ProxySafe<T> types)
 *
 * NOTE: Viewport is NOT included - it's local-only state per user
 *
 * Usage:
 * ```typescript
 * const writer = new YjsSafeWriter(doc, nodesMap, connectionsMap);
 * writer.writeNode(node); // ✅ Safe, no proxy leaks
 * ```
 */

import * as Y from 'yjs';
import type { CanvasNode, Connection, Point, Size } from './types';
import type { NodeId, ConnectionId } from './branded-types';
import { stripProxies, type ProxySafe } from './proxy-safety';

/**
 * Type-safe Yjs write abstraction
 *
 * All write methods strip Immer proxies before writing to Yjs.
 * Methods are atomic (wrapped in Y.Doc.transact).
 */
export class YjsSafeWriter {
  constructor(
    private readonly doc: Y.Doc,
    private readonly nodes: Y.Map<CanvasNode>,
    private readonly connections: Y.Map<Connection>,
    private readonly viewport: Y.Map<number> | null // Nullable for backward compatibility
  ) {}

  // ============================================================================
  // Node Operations
  // ============================================================================

  /**
   * Write node to Yjs (add or update)
   *
   * Strips Immer proxies and sanitizes numeric values before write.
   * This is the primary write method - all other node operations use this internally.
   *
   * @param node - Node to write (may contain Immer proxies)
   * @throws Error if node structure is invalid
   */
  writeNode(node: CanvasNode): void {
    // Strip proxies FIRST (prevents revoked proxy errors)
    const safe = stripProxies(node);

    // Sanitize numeric values (prevents string concatenation bugs)
    const sanitized = this.sanitizeNode(safe);

    // Atomic write
    this.doc.transact(() => {
      this.nodes.set(sanitized.id, sanitized);
    }, 'local'); // Tag as local write for origin tracking
  }

  /**
   * Update node position (optimized for drag operations)
   *
   * This is called 60+ times per second during drag, so it's optimized
   * to only update the position field (not full node).
   *
   * @param nodeId - Node to update
   * @param x - New X position
   * @param y - New Y position
   * @throws Error if node not found
   */
  updateNodePosition(nodeId: NodeId, x: number, y: number): void {
    const existing = this.nodes.get(nodeId);
    if (!existing) {
      throw new Error(`[YjsSafeWriter] Node ${nodeId} not found for position update`);
    }

    // Create updated node with new position
    const updated: CanvasNode = {
      ...existing,
      position: {
        x: Number(x),
        y: Number(y),
      },
      updated_at: new Date().toISOString(),
    };

    // Use writeNode for consistent proxy stripping
    this.writeNode(updated);
  }

  /**
   * Batch write multiple nodes (single transaction)
   *
   * More efficient than calling writeNode() multiple times
   * because all writes are in one transaction.
   *
   * @param nodes - Nodes to write
   */
  writeNodes(nodes: CanvasNode[]): void {
    // Strip proxies from all nodes first
    const safeNodes = nodes.map(n => this.sanitizeNode(stripProxies(n)));

    // Single atomic transaction
    this.doc.transact(() => {
      safeNodes.forEach(node => {
        this.nodes.set(node.id, node);
      });
    }, 'local');
  }

  /**
   * Delete node and cascade connected connections
   *
   * Automatically removes all connections that have this node
   * as either source or target.
   *
   * @param nodeId - Node to delete
   */
  deleteNode(nodeId: NodeId): void {
    this.doc.transact(() => {
      // Delete the node
      this.nodes.delete(nodeId);

      // Cascade: Delete all connected connections
      const toDelete: ConnectionId[] = [];
      this.connections.forEach((conn, connId) => {
        if (conn.source_node_id === nodeId || conn.target_node_id === nodeId) {
          // Type assertion: Y.Map.forEach() gives us plain string, cast to branded type
          toDelete.push(connId as ConnectionId);
        }
      });

      toDelete.forEach(id => this.connections.delete(id));
    }, 'local');
  }

  /**
   * Clear all nodes (for bulk replacement)
   *
   * Use with care - this deletes ALL nodes in the workspace.
   */
  clearNodes(): void {
    this.doc.transact(() => {
      this.nodes.clear();
    }, 'local');
  }

  // ============================================================================
  // Connection Operations
  // ============================================================================

  /**
   * Write connection to Yjs (add or update)
   *
   * @param connection - Connection to write
   */
  writeConnection(connection: Connection): void {
    const safe = this.sanitizeConnection(stripProxies(connection));

    this.doc.transact(() => {
      this.connections.set(safe.id, safe);
    }, 'local');
  }

  /**
   * Batch write multiple connections (single transaction)
   *
   * @param connections - Connections to write
   */
  writeConnections(connections: Connection[]): void {
    const safeConnections = connections.map(c => this.sanitizeConnection(stripProxies(c)));

    this.doc.transact(() => {
      safeConnections.forEach(conn => {
        this.connections.set(conn.id, conn);
      });
    }, 'local');
  }

  /**
   * Delete connection
   *
   * @param connectionId - Connection to delete
   */
  deleteConnection(connectionId: ConnectionId): void {
    this.doc.transact(() => {
      this.connections.delete(connectionId);
    }, 'local');
  }

  /**
   * Clear all connections (for bulk replacement)
   *
   * Use with care - this deletes ALL connections in the workspace.
   */
  clearConnections(): void {
    this.doc.transact(() => {
      this.connections.clear();
    }, 'local');
  }

  // ============================================================================
  // Viewport Operations - DEPRECATED (viewport is now local-only)
  // ============================================================================

  /**
   * @deprecated Viewport is now local-only state (not synced via Yjs)
   * This method exists for backward compatibility but does nothing
   */
  writeViewport(offsetX: number, offsetY: number, scale: number): void {
    // NO-OP: Viewport is now local-only state
    console.warn('[YjsSafeWriter] writeViewport() is deprecated - viewport is now local-only');
  }

  /**
   * @deprecated Viewport is now local-only state (not synced via Yjs)
   * This method exists for backward compatibility but does nothing
   */
  panViewport(deltaX: number, deltaY: number): void {
    // NO-OP: Viewport is now local-only state
    console.warn('[YjsSafeWriter] panViewport() is deprecated - viewport is now local-only');
  }

  /**
   * @deprecated Viewport is now local-only state (not synced via Yjs)
   * This method exists for backward compatibility but does nothing
   */
  zoomViewport(newScale: number): void {
    // NO-OP: Viewport is now local-only state
    console.warn('[YjsSafeWriter] zoomViewport() is deprecated - viewport is now local-only');
  }

  /**
   * @deprecated Viewport is now local-only state (not synced via Yjs)
   * This method exists for backward compatibility but does nothing
   */
  resetViewport(): void {
    // NO-OP: Viewport is now local-only state
    console.warn('[YjsSafeWriter] resetViewport() is deprecated - viewport is now local-only');
  }

  // ============================================================================
  // Sanitization Helpers (Private)
  // ============================================================================

  /**
   * Sanitize node to ensure numeric position/size values
   *
   * Problem: PostgreSQL can return position/size as strings ("100" instead of 100)
   * which causes string concatenation during drag: "100" + 50 = "10050"
   *
   * Solution: Force convert all numeric values to actual numbers.
   *
   * @param node - Node to sanitize (already proxy-safe)
   * @returns Sanitized node with guaranteed numeric values
   */
  private sanitizeNode(node: ProxySafe<CanvasNode>): ProxySafe<CanvasNode> {
    // Extract numeric values with fallbacks
    const x = Number(node.position?.x ?? 100);
    const y = Number(node.position?.y ?? 100);
    const width = Number(node.size?.width ?? 200);
    const height = Number(node.size?.height ?? 100);
    const zIndex = Number(node.z_index ?? 0);

    // Validate finite numbers (NaN/Infinity check)
    const sanitized: CanvasNode = {
      ...node,
      position: {
        x: Number.isFinite(x) ? x : 100,
        y: Number.isFinite(y) ? y : 100,
      },
      size: {
        width: Number.isFinite(width) && width > 0 ? width : 200,
        height: Number.isFinite(height) && height > 0 ? height : 100,
      },
      z_index: Number.isFinite(zIndex) ? zIndex : 0,
    };

    // Re-strip proxies to ensure nested objects are clean
    return stripProxies(sanitized);
  }

  /**
   * Sanitize connection to ensure numeric anchor offsets
   *
   * @param connection - Connection to sanitize (already proxy-safe)
   * @returns Sanitized connection
   */
  private sanitizeConnection(connection: ProxySafe<Connection>): ProxySafe<Connection> {
    const sourceOffset = Number(connection.source_anchor?.offset ?? 0.5);
    const targetOffset = Number(connection.target_anchor?.offset ?? 0.5);
    const zIndex = Number(connection.z_index ?? 0);

    const sanitized: Connection = {
      ...connection,
      source_anchor: {
        ...connection.source_anchor,
        offset: Number.isFinite(sourceOffset) ? sourceOffset : 0.5,
      },
      target_anchor: {
        ...connection.target_anchor,
        offset: Number.isFinite(targetOffset) ? targetOffset : 0.5,
      },
      z_index: Number.isFinite(zIndex) ? zIndex : 0,
    };

    return stripProxies(sanitized);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get current document state (for debugging)
   *
   * @returns Object with counts and sample data
   */
  getState(): {
    nodeCount: number;
    connectionCount: number;
  } {
    return {
      nodeCount: this.nodes.size,
      connectionCount: this.connections.size,
    };
  }

  /**
   * Validate that Yjs doc is not destroyed
   *
   * @throws Error if doc is destroyed
   */
  private validateDoc(): void {
    if (this.doc.isDestroyed) {
      throw new Error('[YjsSafeWriter] Cannot write - Yjs doc is destroyed');
    }
  }
}
