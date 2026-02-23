/**
 * Unit Tests: YjsSafeWriter
 *
 * Tests for type-safe Yjs write abstraction
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as Y from 'yjs';
import { YjsSafeWriter } from '../yjs-writer';
import type { CanvasNode, Connection } from '../types';
import type { NodeId, ConnectionId, WorkspaceId } from '../branded-types';
import type { UserId } from '@/types/branded';

describe('YjsSafeWriter', () => {
  let doc: Y.Doc;
  let nodes: Y.Map<CanvasNode>;
  let connections: Y.Map<Connection>;
  let viewport: Y.Map<number>;
  let writer: YjsSafeWriter;

  // Helper to create test node
  const createTestNode = (overrides?: Partial<CanvasNode>): CanvasNode => ({
    id: 'test-node-1' as NodeId,
    workspace_id: 'workspace-1' as WorkspaceId,
    position: { x: 100, y: 200 },
    size: { width: 300, height: 400 },
    content: { text: 'Test node' },
    z_index: 0,
    created_by: 'user-1' as UserId,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  });

  // Helper to create test connection
  const createTestConnection = (overrides?: Partial<Connection>): Connection => ({
    id: 'test-conn-1' as ConnectionId,
    workspace_id: 'workspace-1' as WorkspaceId,
    source_node_id: 'node-1' as NodeId,
    target_node_id: 'node-2' as NodeId,
    source_anchor: { side: 'right', offset: 0.5 },
    target_anchor: { side: 'left', offset: 0.5 },
    z_index: 0,
    created_by: 'user-1' as UserId,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  });

  beforeEach(() => {
    // Create fresh Yjs document for each test
    doc = new Y.Doc();
    nodes = doc.getMap('nodes');
    connections = doc.getMap('connections');
    viewport = doc.getMap('viewport');
    writer = new YjsSafeWriter(doc, nodes, connections, viewport);
  });

  describe('Node Operations', () => {
    describe('writeNode', () => {
      it('should write node to Yjs map', () => {
        const node = createTestNode();
        writer.writeNode(node);

        const stored = nodes.get(node.id);
        expect(stored).toBeDefined();
        expect(stored?.id).toBe(node.id);
        expect(stored?.position).toEqual({ x: 100, y: 200 });
      });

      it('should sanitize numeric position values', () => {
        const node = createTestNode({
          position: { x: '100' as any, y: '200' as any },
        });

        writer.writeNode(node);

        const stored = nodes.get(node.id);
        expect(typeof stored?.position.x).toBe('number');
        expect(typeof stored?.position.y).toBe('number');
        expect(stored?.position.x).toBe(100);
        expect(stored?.position.y).toBe(200);
      });

      it('should sanitize numeric size values', () => {
        const node = createTestNode({
          size: { width: '300' as any, height: '400' as any },
        });

        writer.writeNode(node);

        const stored = nodes.get(node.id);
        expect(typeof stored?.size.width).toBe('number');
        expect(typeof stored?.size.height).toBe('number');
        expect(stored?.size.width).toBe(300);
        expect(stored?.size.height).toBe(400);
      });

      it('should use fallback values for invalid numbers', () => {
        const node = createTestNode({
          position: { x: NaN, y: Infinity },
          size: { width: -100, height: 0 },
        });

        writer.writeNode(node);

        const stored = nodes.get(node.id);
        expect(stored?.position.x).toBe(100); // Fallback
        expect(stored?.position.y).toBe(100); // Fallback
        expect(stored?.size.width).toBe(200); // Fallback (negative width)
        expect(stored?.size.height).toBe(100); // Fallback (zero height)
      });

      it('should update existing node', () => {
        const node = createTestNode();
        writer.writeNode(node);

        const updated = createTestNode({
          content: { text: 'Updated text' },
        });
        writer.writeNode(updated);

        const stored = nodes.get(node.id);
        expect(stored?.content.text).toBe('Updated text');
        expect(nodes.size).toBe(1); // Still only one node
      });

      it('should tag transaction with "local" origin', () => {
        const node = createTestNode();

        // Spy on transact to check origin
        const transactSpy = jest.spyOn(doc, 'transact');

        writer.writeNode(node);

        expect(transactSpy).toHaveBeenCalledWith(expect.any(Function), 'local');
      });

      it('should strip Immer proxies before write', () => {
        // Create a revocable proxy (simulating Immer draft)
        const { proxy, revoke } = Proxy.revocable(createTestNode(), {
          get(target, prop) {
            return Reflect.get(target, prop);
          },
        });

        // Write while proxy is still active
        writer.writeNode(proxy as CanvasNode);

        // Revoke proxy (simulating end of Immer transaction)
        revoke();

        // Data in Yjs should still be accessible (no revoked proxy)
        const stored = nodes.get('test-node-1' as NodeId);
        expect(stored).toBeDefined();
        expect(stored?.position.x).toBe(100);
        expect(() => stored?.position.x).not.toThrow();
      });
    });

    describe('updateNodePosition', () => {
      it('should update only position', () => {
        const node = createTestNode({ content: { text: 'Original' } });
        writer.writeNode(node);

        writer.updateNodePosition(node.id, 500, 600);

        const stored = nodes.get(node.id);
        expect(stored?.position).toEqual({ x: 500, y: 600 });
        expect(stored?.content.text).toBe('Original'); // Unchanged
      });

      it('should sanitize position values', () => {
        const node = createTestNode();
        writer.writeNode(node);

        writer.updateNodePosition(node.id, '500' as any, '600' as any);

        const stored = nodes.get(node.id);
        expect(typeof stored?.position.x).toBe('number');
        expect(stored?.position.x).toBe(500);
      });

      it('should throw if node not found', () => {
        expect(() => {
          writer.updateNodePosition('nonexistent' as NodeId, 100, 200);
        }).toThrow('Node nonexistent not found');
      });

      it('should update timestamp', () => {
        const node = createTestNode({ updated_at: '2025-01-01T00:00:00Z' });
        writer.writeNode(node);

        writer.updateNodePosition(node.id, 500, 600);

        const stored = nodes.get(node.id);
        expect(stored?.updated_at).not.toBe('2025-01-01T00:00:00Z');
        expect(new Date(stored!.updated_at).getTime()).toBeGreaterThan(
          new Date('2025-01-01T00:00:00Z').getTime()
        );
      });
    });

    describe('writeNodes (batch)', () => {
      it('should write multiple nodes in single transaction', () => {
        const node1 = createTestNode({ id: 'node-1' as NodeId });
        const node2 = createTestNode({ id: 'node-2' as NodeId });
        const node3 = createTestNode({ id: 'node-3' as NodeId });

        const transactSpy = jest.spyOn(doc, 'transact');

        writer.writeNodes([node1, node2, node3]);

        expect(nodes.size).toBe(3);
        expect(nodes.get('node-1' as NodeId)).toBeDefined();
        expect(nodes.get('node-2' as NodeId)).toBeDefined();
        expect(nodes.get('node-3' as NodeId)).toBeDefined();

        // Should only call transact once (batch operation)
        expect(transactSpy).toHaveBeenCalledTimes(1);
      });

      it('should sanitize all nodes', () => {
        const nodes_input = [
          createTestNode({ id: 'n1' as NodeId, position: { x: '100' as any, y: 200 } }),
          createTestNode({ id: 'n2' as NodeId, size: { width: '300' as any, height: 400 } }),
        ];

        writer.writeNodes(nodes_input);

        const n1 = nodes.get('n1' as NodeId);
        const n2 = nodes.get('n2' as NodeId);

        expect(typeof n1?.position.x).toBe('number');
        expect(typeof n2?.size.width).toBe('number');
      });
    });

    describe('deleteNode', () => {
      it('should delete node from map', () => {
        const node = createTestNode();
        writer.writeNode(node);
        expect(nodes.size).toBe(1);

        writer.deleteNode(node.id);

        expect(nodes.size).toBe(0);
        expect(nodes.get(node.id)).toBeUndefined();
      });

      it('should cascade delete connected connections', () => {
        const node1 = createTestNode({ id: 'node-1' as NodeId });
        const node2 = createTestNode({ id: 'node-2' as NodeId });
        writer.writeNode(node1);
        writer.writeNode(node2);

        const conn1 = createTestConnection({
          id: 'conn-1' as ConnectionId,
          source_node_id: 'node-1' as NodeId,
          target_node_id: 'node-2' as NodeId,
        });
        const conn2 = createTestConnection({
          id: 'conn-2' as ConnectionId,
          source_node_id: 'node-2' as NodeId,
          target_node_id: 'node-1' as NodeId,
        });
        writer.writeConnection(conn1);
        writer.writeConnection(conn2);

        expect(connections.size).toBe(2);

        // Delete node-1
        writer.deleteNode('node-1' as NodeId);

        // Both connections should be deleted (cascade)
        expect(connections.size).toBe(0);
      });

      it('should delete connections where node is source', () => {
        const node1 = createTestNode({ id: 'node-1' as NodeId });
        const node2 = createTestNode({ id: 'node-2' as NodeId });
        writer.writeNode(node1);
        writer.writeNode(node2);

        const conn = createTestConnection({
          source_node_id: 'node-1' as NodeId,
          target_node_id: 'node-2' as NodeId,
        });
        writer.writeConnection(conn);

        writer.deleteNode('node-1' as NodeId);

        expect(connections.get(conn.id)).toBeUndefined();
      });

      it('should delete connections where node is target', () => {
        const node1 = createTestNode({ id: 'node-1' as NodeId });
        const node2 = createTestNode({ id: 'node-2' as NodeId });
        writer.writeNode(node1);
        writer.writeNode(node2);

        const conn = createTestConnection({
          source_node_id: 'node-1' as NodeId,
          target_node_id: 'node-2' as NodeId,
        });
        writer.writeConnection(conn);

        writer.deleteNode('node-2' as NodeId);

        expect(connections.get(conn.id)).toBeUndefined();
      });
    });

    describe('clearNodes', () => {
      it('should remove all nodes', () => {
        writer.writeNode(createTestNode({ id: 'n1' as NodeId }));
        writer.writeNode(createTestNode({ id: 'n2' as NodeId }));
        writer.writeNode(createTestNode({ id: 'n3' as NodeId }));

        expect(nodes.size).toBe(3);

        writer.clearNodes();

        expect(nodes.size).toBe(0);
      });
    });
  });

  describe('Connection Operations', () => {
    describe('writeConnection', () => {
      it('should write connection to Yjs map', () => {
        const conn = createTestConnection();
        writer.writeConnection(conn);

        const stored = connections.get(conn.id);
        expect(stored).toBeDefined();
        expect(stored?.source_node_id).toBe('node-1');
        expect(stored?.target_node_id).toBe('node-2');
      });

      it('should sanitize numeric anchor offsets', () => {
        const conn = createTestConnection({
          source_anchor: { side: 'right', offset: '0.5' as any },
          target_anchor: { side: 'left', offset: '0.7' as any },
        });

        writer.writeConnection(conn);

        const stored = connections.get(conn.id);
        expect(typeof stored?.source_anchor.offset).toBe('number');
        expect(typeof stored?.target_anchor.offset).toBe('number');
        expect(stored?.source_anchor.offset).toBe(0.5);
        expect(stored?.target_anchor.offset).toBe(0.7);
      });

      it('should use fallback for invalid offsets', () => {
        const conn = createTestConnection({
          source_anchor: { side: 'right', offset: NaN },
          target_anchor: { side: 'left', offset: Infinity },
        });

        writer.writeConnection(conn);

        const stored = connections.get(conn.id);
        expect(stored?.source_anchor.offset).toBe(0.5); // Fallback
        expect(stored?.target_anchor.offset).toBe(0.5); // Fallback
      });
    });

    describe('writeConnections (batch)', () => {
      it('should write multiple connections in single transaction', () => {
        const conn1 = createTestConnection({ id: 'c1' as ConnectionId });
        const conn2 = createTestConnection({ id: 'c2' as ConnectionId });

        const transactSpy = jest.spyOn(doc, 'transact');

        writer.writeConnections([conn1, conn2]);

        expect(connections.size).toBe(2);
        expect(transactSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('deleteConnection', () => {
      it('should delete connection from map', () => {
        const conn = createTestConnection();
        writer.writeConnection(conn);

        writer.deleteConnection(conn.id);

        expect(connections.get(conn.id)).toBeUndefined();
      });
    });

    describe('clearConnections', () => {
      it('should remove all connections', () => {
        writer.writeConnection(createTestConnection({ id: 'c1' as ConnectionId }));
        writer.writeConnection(createTestConnection({ id: 'c2' as ConnectionId }));

        writer.clearConnections();

        expect(connections.size).toBe(0);
      });
    });
  });

  describe('Viewport Operations - DEPRECATED', () => {
    // Viewport is now local-only state (not synced via Yjs)
    // These tests verify that deprecated methods exist but do nothing

    describe('writeViewport', () => {
      it('should be deprecated and do nothing', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        writer.writeViewport(100, 200, 1.5);

        // Should warn about deprecation
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('writeViewport() is deprecated')
        );

        // Should NOT write to viewport Y.Map
        expect(viewport.get('offsetX')).toBeUndefined();
        expect(viewport.get('offsetY')).toBeUndefined();
        expect(viewport.get('scale')).toBeUndefined();

        consoleSpy.mockRestore();
      });
    });

    describe('panViewport', () => {
      it('should be deprecated and do nothing', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        writer.panViewport(50, 75);

        // Should warn about deprecation
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('panViewport() is deprecated')
        );

        // Should NOT write to viewport Y.Map
        expect(viewport.get('offsetX')).toBeUndefined();
        expect(viewport.get('offsetY')).toBeUndefined();

        consoleSpy.mockRestore();
      });
    });

    describe('zoomViewport', () => {
      it('should be deprecated and do nothing', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        writer.zoomViewport(2.0);

        // Should warn about deprecation
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('zoomViewport() is deprecated')
        );

        // Should NOT write to viewport Y.Map
        expect(viewport.get('scale')).toBeUndefined();

        consoleSpy.mockRestore();
      });
    });

    describe('resetViewport', () => {
      it('should be deprecated and do nothing', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        writer.resetViewport();

        // Should warn about deprecation
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('resetViewport() is deprecated')
        );

        // Should NOT write to viewport Y.Map
        expect(viewport.get('offsetX')).toBeUndefined();
        expect(viewport.get('offsetY')).toBeUndefined();
        expect(viewport.get('scale')).toBeUndefined();

        consoleSpy.mockRestore();
      });
    });
  });

  describe('Utility Methods', () => {
    describe('getState', () => {
      it('should return current document state (without viewport)', () => {
        writer.writeNode(createTestNode({ id: 'n1' as NodeId }));
        writer.writeNode(createTestNode({ id: 'n2' as NodeId }));
        writer.writeConnection(createTestConnection());

        const state = writer.getState();

        expect(state.nodeCount).toBe(2);
        expect(state.connectionCount).toBe(1);
        // Viewport removed from getState() return type
        expect(state).not.toHaveProperty('viewport');
      });

      it('should handle empty state', () => {
        const state = writer.getState();

        expect(state.nodeCount).toBe(0);
        expect(state.connectionCount).toBe(0);
        expect(state).not.toHaveProperty('viewport');
      });
    });
  });

  describe('Transaction Atomicity', () => {
    it('should perform all operations in writeNode atomically', () => {
      const node = createTestNode();
      let transactionCount = 0;

      doc.on('afterTransaction', () => {
        transactionCount++;
      });

      writer.writeNode(node);

      expect(transactionCount).toBe(1); // Single transaction
    });

    it('should perform cascade delete atomically', () => {
      const node1 = createTestNode({ id: 'n1' as NodeId });
      const node2 = createTestNode({ id: 'n2' as NodeId });
      writer.writeNode(node1);
      writer.writeNode(node2);

      const conn1 = createTestConnection({
        id: 'c1' as ConnectionId,
        source_node_id: 'n1' as NodeId,
      });
      const conn2 = createTestConnection({
        id: 'c2' as ConnectionId,
        target_node_id: 'n1' as NodeId,
      });
      writer.writeConnection(conn1);
      writer.writeConnection(conn2);

      let transactionCount = 0;
      doc.on('afterTransaction', () => {
        transactionCount++;
      });

      writer.deleteNode('n1' as NodeId);

      expect(transactionCount).toBe(1); // Single transaction
      expect(nodes.get('n1' as NodeId)).toBeUndefined();
      expect(connections.get('c1' as ConnectionId)).toBeUndefined();
      expect(connections.get('c2' as ConnectionId)).toBeUndefined();
    });
  });
});
