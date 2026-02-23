/**
 * Tests for force-directed 3D graph layout algorithm
 */

import {
  computeForceDirectedLayout3D,
  distance3D,
  getDefaultLayoutConfig,
  getDenseGraphLayoutConfig,
  getSparseGraphLayoutConfig,
  selectLayoutConfig,
} from '../graph-layout';
import { GraphNode, GraphEdge } from '../parser-service';

describe('Force-Directed 3D Graph Layout', () => {
  describe('Basic Layout Computation', () => {
    it('should distribute nodes in true 3D space (not all z=0)', () => {
      const nodes: GraphNode[] = [
        {
          id: 'A',
          label: 'Node A',
          type: 'script',
          metadata: { functionCount: 1 },
        },
        {
          id: 'B',
          label: 'Node B',
          type: 'script',
          metadata: { functionCount: 1 },
        },
        {
          id: 'C',
          label: 'Node C',
          type: 'script',
          metadata: { functionCount: 1 },
        },
      ];
      const edges: GraphEdge[] = [
        {
          from: 'A',
          to: 'B',
          type: 'extends',
          weight: 2,
        },
      ];

      const config = getDefaultLayoutConfig();
      const result = computeForceDirectedLayout3D(nodes, edges, config);

      // All nodes should have positions
      result.forEach(node => {
        expect(node.position).toBeDefined();
        expect(typeof node.position?.x).toBe('number');
        expect(typeof node.position?.y).toBe('number');
        expect(typeof node.position?.z).toBe('number');
      });

      // CRITICAL: At least one node should have non-zero Z (not flat circle)
      const hasNonZeroZ = result.some(n => n.position && Math.abs(n.position.z) > 0.1);
      expect(hasNonZeroZ).toBe(true);

      // CRITICAL: Not all nodes should be at z=0 (would indicate circular layout)
      const allZeroZ = result.every(n => n.position?.z === 0);
      expect(allZeroZ).toBe(false);
    });

    it('should handle single node graph', () => {
      const nodes: GraphNode[] = [
        {
          id: 'A',
          label: 'Node A',
          type: 'script',
        },
      ];
      const edges: GraphEdge[] = [];

      const config = getDefaultLayoutConfig();
      const result = computeForceDirectedLayout3D(nodes, edges, config);

      expect(result).toHaveLength(1);
      expect(result[0].position).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should handle empty graph', () => {
      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];

      const config = getDefaultLayoutConfig();
      const result = computeForceDirectedLayout3D(nodes, edges, config);

      expect(result).toHaveLength(0);
    });
  });

  describe('Force Dynamics', () => {
    it('should bring connected nodes closer together', () => {
      const nodes: GraphNode[] = [
        {
          id: 'A',
          label: 'Node A',
          type: 'script',
        },
        {
          id: 'B',
          label: 'Node B',
          type: 'script',
        },
        {
          id: 'C',
          label: 'Node C',
          type: 'script',
        },
      ];

      // A and B are connected, C is isolated
      const edges: GraphEdge[] = [
        {
          from: 'A',
          to: 'B',
          type: 'extends',
          weight: 2,
        },
      ];

      const config = getDefaultLayoutConfig();
      const result = computeForceDirectedLayout3D(nodes, edges, config);

      const A = result.find(n => n.id === 'A')!;
      const B = result.find(n => n.id === 'B')!;
      const C = result.find(n => n.id === 'C')!;

      if (A.position && B.position && C.position) {
        const distAB = distance3D(A.position, B.position);
        const distAC = distance3D(A.position, C.position);
        const distBC = distance3D(B.position, C.position);

        // A and B are connected, should be closer than A-C or B-C
        expect(distAB).toBeLessThan(distAC);
        expect(distAB).toBeLessThan(distBC);
      }
    });

    it('should push disconnected nodes apart', () => {
      const nodes: GraphNode[] = [
        {
          id: 'A',
          label: 'Node A',
          type: 'script',
        },
        {
          id: 'B',
          label: 'Node B',
          type: 'script',
        },
      ];
      const edges: GraphEdge[] = []; // No connections

      const config = getDefaultLayoutConfig();
      const result = computeForceDirectedLayout3D(nodes, edges, config);

      const A = result.find(n => n.id === 'A')!;
      const B = result.find(n => n.id === 'B')!;

      if (A.position && B.position) {
        const dist = distance3D(A.position, B.position);
        // Repulsion should keep them from being too close
        expect(dist).toBeGreaterThan(2);
      }
    });

    it('should respect edge weights in attraction', () => {
      const nodes: GraphNode[] = [
        {
          id: 'A',
          label: 'Node A',
          type: 'script',
        },
        {
          id: 'B',
          label: 'Node B',
          type: 'script',
        },
        {
          id: 'C',
          label: 'Node C',
          type: 'script',
        },
      ];

      // A->B has weight 2 (extends), A->C has weight 1 (preload)
      const edges: GraphEdge[] = [
        {
          from: 'A',
          to: 'B',
          type: 'extends',
          weight: 2,
        },
        {
          from: 'A',
          to: 'C',
          type: 'preload',
          weight: 1,
        },
      ];

      const config = getDefaultLayoutConfig();
      const result = computeForceDirectedLayout3D(nodes, edges, config);

      const A = result.find(n => n.id === 'A')!;
      const B = result.find(n => n.id === 'B')!;
      const C = result.find(n => n.id === 'C')!;

      if (A.position && B.position && C.position) {
        const distAB = distance3D(A.position, B.position);
        const distAC = distance3D(A.position, C.position);

        // Higher weight (extends) should result in closer nodes
        expect(distAB).toBeLessThan(distAC);
      }
    });
  });

  describe('Convergence', () => {
    it('should detect and stop at convergence', () => {
      const nodes: GraphNode[] = Array.from({ length: 20 }, (_, i) => ({
        id: `node-${i}`,
        label: `Node ${i}`,
        type: 'script',
      }));

      const edges: GraphEdge[] = [];

      const config = getDefaultLayoutConfig();
      config.iterations = 1000; // High iteration limit to test early termination

      const startTime = performance.now();
      const result = computeForceDirectedLayout3D(nodes, edges, config);
      const elapsed = performance.now() - startTime;

      expect(result).toHaveLength(20);
      // Should converge and exit early, well before 1000 iterations
      // Each iteration takes ~2ms for 20 nodes, so 1000 would take ~20s
      // With early convergence, should be much faster
      expect(elapsed).toBeLessThan(5000); // Should complete in < 5 seconds
    });
  });

  describe('Performance', () => {
    it('should handle 50-node graph within reasonable time', () => {
      const nodes: GraphNode[] = Array.from({ length: 50 }, (_, i) => ({
        id: `node-${i}`,
        label: `Node ${i}`,
        type: 'script',
      }));

      const edges: GraphEdge[] = Array.from({ length: 100 }, (_, i) => ({
        from: `node-${i % 50}`,
        to: `node-${(i + 1) % 50}`,
        type: 'preload',
        weight: 1,
      }));

      const config = getDefaultLayoutConfig();
      const startTime = performance.now();
      const result = computeForceDirectedLayout3D(nodes, edges, config);
      const elapsed = performance.now() - startTime;

      expect(result).toHaveLength(50);
      expect(elapsed).toBeLessThan(2000); // Should complete in < 2 seconds
    });

    it('should handle 100-node graph within reasonable time', () => {
      const nodes: GraphNode[] = Array.from({ length: 100 }, (_, i) => ({
        id: `node-${i}`,
        label: `Node ${i}`,
        type: 'script',
      }));

      const edges: GraphEdge[] = Array.from({ length: 200 }, (_, i) => ({
        from: `node-${i % 100}`,
        to: `node-${(i + 1) % 100}`,
        type: 'preload',
        weight: 1,
      }));

      const config = getDefaultLayoutConfig();
      const startTime = performance.now();
      const result = computeForceDirectedLayout3D(nodes, edges, config);
      const elapsed = performance.now() - startTime;

      expect(result).toHaveLength(100);
      expect(elapsed).toBeLessThan(5000); // Should complete in < 5 seconds
    });
  });

  describe('Layout Configuration', () => {
    it('should select appropriate config based on node count', () => {
      const sparseConfig = selectLayoutConfig(10);
      const defaultConfig = selectLayoutConfig(50);
      const denseConfig = selectLayoutConfig(200);

      expect(sparseConfig.sphereRadius).toBeLessThan(defaultConfig.sphereRadius);
      expect(defaultConfig.sphereRadius).toBeLessThan(denseConfig.sphereRadius);

      expect(sparseConfig.iterations).toBeGreaterThan(defaultConfig.iterations);
      expect(defaultConfig.iterations).toBeGreaterThan(denseConfig.iterations);
    });

    it('should provide pre-configured layouts', () => {
      const sparse = getSparseGraphLayoutConfig();
      const defaults = getDefaultLayoutConfig();
      const dense = getDenseGraphLayoutConfig();

      expect(sparse).toHaveProperty('sphereRadius');
      expect(sparse).toHaveProperty('attractionStrength');
      expect(sparse).toHaveProperty('repulsionStrength');

      expect(defaults).toHaveProperty('sphereRadius');
      expect(dense).toHaveProperty('sphereRadius');
    });
  });

  describe('Utility Functions', () => {
    it('should calculate distance correctly', () => {
      const p1 = { x: 0, y: 0, z: 0 };
      const p2 = { x: 3, y: 4, z: 0 };

      const dist = distance3D(p1, p2);
      expect(dist).toBeCloseTo(5, 5);
    });

    it('should calculate 3D distance correctly', () => {
      const p1 = { x: 0, y: 0, z: 0 };
      const p2 = { x: 1, y: 1, z: 1 };

      const dist = distance3D(p1, p2);
      expect(dist).toBeCloseTo(Math.sqrt(3), 5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle highly connected graph (hub and spoke)', () => {
      const nodes: GraphNode[] = Array.from({ length: 11 }, (_, i) => ({
        id: `node-${i}`,
        label: `Node ${i}`,
        type: 'script',
      }));

      // Node 0 is connected to all others (hub)
      const edges: GraphEdge[] = Array.from({ length: 10 }, (_, i) => ({
        from: 'node-0',
        to: `node-${i + 1}`,
        type: 'preload',
        weight: 1,
      }));

      const config = getDefaultLayoutConfig();
      const result = computeForceDirectedLayout3D(nodes, edges, config);

      expect(result).toHaveLength(11);

      // Hub should have positions defined
      const hub = result.find(n => n.id === 'node-0')!;
      expect(hub.position).toBeDefined();
      expect(hub.position).toHaveProperty('x');
      expect(hub.position).toHaveProperty('y');
      expect(hub.position).toHaveProperty('z');
    });

    it('should handle disconnected components', () => {
      const nodes: GraphNode[] = [
        { id: 'A', label: 'A', type: 'script' },
        { id: 'B', label: 'B', type: 'script' },
        { id: 'C', label: 'C', type: 'script' },
        { id: 'D', label: 'D', type: 'script' },
      ];

      // Two separate components: A-B and C-D
      const edges: GraphEdge[] = [
        { from: 'A', to: 'B', type: 'extends', weight: 2 },
        { from: 'C', to: 'D', type: 'extends', weight: 2 },
      ];

      const config = getDefaultLayoutConfig();
      const result = computeForceDirectedLayout3D(nodes, edges, config);

      expect(result).toHaveLength(4);

      // All nodes should have valid positions
      result.forEach(node => {
        expect(node.position).toBeDefined();
        expect(node.position?.x).toBeDefined();
        expect(node.position?.y).toBeDefined();
        expect(node.position?.z).toBeDefined();
      });
    });

    it('should handle circular dependency chain', () => {
      const nodes: GraphNode[] = Array.from({ length: 5 }, (_, i) => ({
        id: `node-${i}`,
        label: `Node ${i}`,
        type: 'script',
      }));

      // Circular: 0->1->2->3->4->0
      const edges: GraphEdge[] = Array.from({ length: 5 }, (_, i) => ({
        from: `node-${i}`,
        to: `node-${(i + 1) % 5}`,
        type: 'preload',
        weight: 1,
      }));

      const config = getDefaultLayoutConfig();
      const result = computeForceDirectedLayout3D(nodes, edges, config);

      expect(result).toHaveLength(5);

      // Should not have any undefined positions
      result.forEach(node => {
        expect(node.position).toBeDefined();
        expect(isFinite(node.position?.x || 0)).toBe(true);
        expect(isFinite(node.position?.y || 0)).toBe(true);
        expect(isFinite(node.position?.z || 0)).toBe(true);
      });
    });
  });

  describe('Metadata Preservation', () => {
    it('should preserve node metadata after layout', () => {
      const nodes: GraphNode[] = [
        {
          id: 'A',
          label: 'Node A',
          type: 'script',
          metadata: {
            functionCount: 5,
            signalCount: 2,
            custom: 'value',
          },
        },
        {
          id: 'B',
          label: 'Node B',
          type: 'script',
          metadata: {
            functionCount: 3,
            signalCount: 1,
          },
        },
      ];
      const edges: GraphEdge[] = [{ from: 'A', to: 'B', type: 'extends', weight: 2 }];

      const config = getDefaultLayoutConfig();
      const result = computeForceDirectedLayout3D(nodes, edges, config);

      const nodeA = result.find(n => n.id === 'A')!;
      expect(nodeA.metadata).toEqual({
        functionCount: 5,
        signalCount: 2,
        custom: 'value',
      });

      const nodeB = result.find(n => n.id === 'B')!;
      expect(nodeB.metadata?.functionCount).toBe(3);
    });
  });
});
