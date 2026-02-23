/**
 * Unit Tests: Proxy Safety Utilities
 *
 * Tests for stripProxies, isRevokedProxy, and branded type system
 */

import {
  stripProxies,
  isRevokedProxy,
  isProxySafe,
  assertProxySafe,
  type ProxySafe,
} from '../proxy-safety';

describe('proxy-safety', () => {
  describe('stripProxies', () => {
    it('should handle primitives', () => {
      expect(stripProxies(null)).toBe(null);
      expect(stripProxies(undefined)).toBe(undefined);
      expect(stripProxies(42)).toBe(42);
      expect(stripProxies('hello')).toBe('hello');
      expect(stripProxies(true)).toBe(true);
    });

    it('should deep clone objects', () => {
      const original = {
        position: { x: 100, y: 200 },
        size: { width: 300, height: 400 },
        nested: { deep: { value: 'test' } },
      };

      const cloned = stripProxies(original);

      // Should be equal in value
      expect(cloned).toEqual(original);

      // But not the same reference
      expect(cloned).not.toBe(original);
      expect(cloned.position).not.toBe(original.position);
      expect(cloned.nested.deep).not.toBe(original.nested.deep);
    });

    it('should handle arrays', () => {
      const original = [
        { id: '1', value: 10 },
        { id: '2', value: 20 },
      ];

      const cloned = stripProxies(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned[0]).not.toBe(original[0]);
    });

    it('should handle Date objects', () => {
      const date = new Date('2025-01-01T00:00:00Z');
      const cloned = stripProxies({ created_at: date });

      expect(cloned.created_at).toBeInstanceOf(Date);
      expect(cloned.created_at.toISOString()).toBe(date.toISOString());
      expect(cloned.created_at).not.toBe(date); // Different instance
    });

    it('should handle Map objects', () => {
      const map = new Map([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ]);

      const cloned = stripProxies({ data: map });

      expect(cloned.data).toBeInstanceOf(Map);
      expect(cloned.data.get('key1')).toBe('value1');
      expect(cloned.data).not.toBe(map); // Different instance
    });

    it('should handle Set objects', () => {
      const set = new Set(['a', 'b', 'c']);
      const cloned = stripProxies({ data: set });

      expect(cloned.data).toBeInstanceOf(Set);
      expect(cloned.data.has('a')).toBe(true);
      expect(cloned.data).not.toBe(set); // Different instance
    });

    it('should return ProxySafe branded type', () => {
      const original = { x: 100, y: 200 };
      const safe = stripProxies(original);

      // Type assertion - if this compiles, the brand is working
      const _typeCheck: ProxySafe<typeof original> = safe;
      expect(_typeCheck).toBeDefined();
    });

    it('should handle complex nested structures', () => {
      const complex = {
        nodes: new Map([
          [
            'node1',
            {
              id: 'node1',
              position: { x: 100, y: 200 },
              size: { width: 300, height: 400 },
              created_at: new Date(),
              tags: new Set(['tag1', 'tag2']),
            },
          ],
        ]),
        connections: [
          {
            id: 'conn1',
            source: 'node1',
            target: 'node2',
            anchors: [
              { side: 'right', offset: 0.5 },
              { side: 'left', offset: 0.5 },
            ],
          },
        ],
      };

      const cloned = stripProxies(complex);

      expect(cloned.nodes).toBeInstanceOf(Map);
      expect(cloned.nodes.get('node1')?.tags).toBeInstanceOf(Set);
      expect(cloned.connections[0]).toEqual(complex.connections[0]);
      expect(cloned.connections[0]).not.toBe(complex.connections[0]);
    });
  });

  describe('isRevokedProxy', () => {
    it('should return false for primitives', () => {
      expect(isRevokedProxy(null)).toBe(false);
      expect(isRevokedProxy(undefined)).toBe(false);
      expect(isRevokedProxy(42)).toBe(false);
      expect(isRevokedProxy('hello')).toBe(false);
      expect(isRevokedProxy(true)).toBe(false);
    });

    it('should return false for plain objects', () => {
      const obj = { x: 100, y: 200 };
      expect(isRevokedProxy(obj)).toBe(false);
    });

    it('should return false for arrays', () => {
      const arr = [1, 2, 3];
      expect(isRevokedProxy(arr)).toBe(false);
    });

    it('should detect revoked proxies (simulated)', () => {
      // Create a proxy that throws when accessed
      const revokedProxy = new Proxy(
        {},
        {
          ownKeys() {
            throw new TypeError("Cannot perform 'ownKeys' on a proxy that has been revoked");
          },
        }
      );

      expect(isRevokedProxy(revokedProxy)).toBe(true);
    });

    it('should handle proxies that throw non-revoked errors', () => {
      const throwingProxy = new Proxy(
        {},
        {
          ownKeys() {
            throw new Error('Some other error');
          },
        }
      );

      // Should return false - not a revoked proxy error
      expect(isRevokedProxy(throwingProxy)).toBe(false);
    });
  });

  describe('isProxySafe', () => {
    it('should return true for plain objects', () => {
      const obj = { x: 100, y: 200 };
      expect(isProxySafe(obj)).toBe(true);
    });

    it('should return true for stripped proxies', () => {
      const original = { x: 100, y: 200 };
      const safe = stripProxies(original);
      expect(isProxySafe(safe)).toBe(true);
    });

    it('should return false for revoked proxies', () => {
      const revokedProxy = new Proxy(
        {},
        {
          ownKeys() {
            throw new TypeError("Cannot perform 'ownKeys' on a proxy that has been revoked");
          },
        }
      );

      expect(isProxySafe(revokedProxy)).toBe(false);
    });
  });

  describe('assertProxySafe', () => {
    it('should not throw for plain objects', () => {
      const obj = { x: 100, y: 200 };
      expect(() => assertProxySafe(obj, 'test')).not.toThrow();
    });

    it('should not throw for stripped proxies', () => {
      const original = { x: 100, y: 200 };
      const safe = stripProxies(original);
      expect(() => assertProxySafe(safe, 'test')).not.toThrow();
    });

    it('should throw for revoked proxies', () => {
      const revokedProxy = new Proxy(
        {},
        {
          ownKeys() {
            throw new TypeError("Cannot perform 'ownKeys' on a proxy that has been revoked");
          },
        }
      );

      expect(() => assertProxySafe(revokedProxy, 'testFunction')).toThrow(
        '[testFunction] Assertion failed: Value contains revoked proxy'
      );
    });

    it('should include context in error message', () => {
      const revokedProxy = new Proxy(
        {},
        {
          ownKeys() {
            throw new TypeError('revoked');
          },
        }
      );

      expect(() => assertProxySafe(revokedProxy, 'writeNode')).toThrow('[writeNode]');
    });
  });

  describe('Integration: Simulating Immer proxy lifecycle', () => {
    it('should handle the Immer draft → revoke lifecycle', () => {
      // Simulate Immer draft creation
      let draftProxy: any;
      let revokeProxy: () => void;

      // Create a revocable proxy (similar to how Immer works)
      const { proxy, revoke } = Proxy.revocable(
        { position: { x: 100, y: 200 } },
        {
          get(target, prop) {
            return Reflect.get(target, prop);
          },
        }
      );

      draftProxy = proxy;
      revokeProxy = revoke;

      // Phase 1: Proxy is active (can be accessed)
      expect(isRevokedProxy(draftProxy)).toBe(false);
      expect(draftProxy.position.x).toBe(100);

      // Phase 2: Strip proxies BEFORE revocation (this is what we do)
      const safeCopy = stripProxies(draftProxy);
      expect(isRevokedProxy(safeCopy)).toBe(false);

      // Phase 3: Immer revokes the proxy (end of transaction)
      revokeProxy();

      // Phase 4: Original proxy is now revoked
      expect(isRevokedProxy(draftProxy)).toBe(true);
      expect(() => draftProxy.position).toThrow();

      // Phase 5: Safe copy is still accessible (this is the key!)
      expect(isRevokedProxy(safeCopy)).toBe(false);
      expect(safeCopy.position.x).toBe(100);
    });

    it('should prevent writing revoked proxy to Yjs (error case)', () => {
      const { proxy, revoke } = Proxy.revocable({ x: 100 }, {});

      // Revoke immediately
      revoke();

      // Attempting to strip an already-revoked proxy should throw
      expect(() => stripProxies(proxy)).toThrow('stripProxies failed - revoked proxy detected');
    });
  });

  describe('Edge cases', () => {
    it('should handle circular references', () => {
      const circular: any = { x: 100 };
      circular.self = circular;

      // structuredClone handles circular refs
      const cloned = stripProxies(circular);
      expect(cloned.x).toBe(100);
      expect(cloned.self).toBe(cloned); // Circular ref preserved
    });

    it('should handle symbols', () => {
      const sym = Symbol('test');
      const obj = { [sym]: 'value', regular: 'prop' };

      const cloned = stripProxies(obj);
      expect(cloned.regular).toBe('prop');
      // Symbols are not cloned by structuredClone (spec behavior)
    });

    it('should handle functions (not cloneable)', () => {
      const obj = {
        data: 42,
        method() {
          return this.data;
        },
      };

      // structuredClone throws on functions
      expect(() => stripProxies(obj)).toThrow();
    });

    it('should handle undefined values in objects', () => {
      const obj = { a: 1, b: undefined, c: null };
      const cloned = stripProxies(obj);

      expect(cloned).toEqual(obj);
      expect(cloned.b).toBeUndefined();
      expect(cloned.c).toBeNull();
    });

    it('should handle empty objects and arrays', () => {
      expect(stripProxies({})).toEqual({});
      expect(stripProxies([])).toEqual([]);
    });

    it('should handle large objects efficiently', () => {
      const large = {
        nodes: Array.from({ length: 1000 }, (_, i) => ({
          id: `node-${i}`,
          position: { x: i * 10, y: i * 10 },
          size: { width: 200, height: 100 },
          content: { text: `Node ${i}` },
        })),
      };

      const start = performance.now();
      const cloned = stripProxies(large);
      const duration = performance.now() - start;

      expect(cloned.nodes).toHaveLength(1000);
      expect(duration).toBeLessThan(100); // Should be fast (<100ms)
    });
  });
});
