/**
 * Type Safety for Yjs Integration
 *
 * This module provides branded types and utilities to prevent Immer proxy objects
 * from leaking into Yjs Y.Maps, which would cause "revoked proxy" errors.
 *
 * Core Problem:
 * - Zustand uses Immer for immutable updates (creates proxy objects)
 * - Yjs requires plain objects for serialization
 * - When Immer proxies leak into Yjs, they become "revoked" after transaction
 * - Result: "Cannot perform 'get' on a proxy that has been revoked"
 *
 * Solution:
 * - Use ProxySafe<T> branded type to mark data as safe for Yjs
 * - stripProxies() deep clones to remove all Immer drafts
 * - Compile-time enforcement via TypeScript type system
 */

/**
 * Branded type indicating data is safe to write to Yjs
 * (no Immer proxies, no revoked objects)
 *
 * @example
 * ```typescript
 * const node: CanvasNode = { ... };
 * const safeNode = stripProxies(node); // Returns ProxySafe<CanvasNode>
 * yjsNodes.set(safeNode.id, safeNode); // ✅ Type-safe, no proxy leaks
 * ```
 */
export type ProxySafe<T> = T & { readonly __proxySafe: unique symbol };

/**
 * Check if a value might be a revoked proxy
 *
 * Revoked proxies throw when accessed. We detect them by attempting
 * an operation that would throw on a revoked proxy.
 *
 * @param value - Value to check
 * @returns true if value is a revoked proxy
 */
export function isRevokedProxy(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  try {
    // This will throw if value is a revoked proxy
    Object.keys(value);
    return false;
  } catch (error) {
    // Check if error is specifically a revoked proxy error
    return (
      error instanceof TypeError &&
      (error.message.includes('revoked') || error.message.includes('Cannot perform'))
    );
  }
}

/**
 * Deep clone to strip all Immer proxy objects
 *
 * Uses structuredClone() which is faster than JSON.parse(JSON.stringify())
 * and handles more data types (Date, Map, Set, etc.)
 *
 * @param value - Value to strip proxies from
 * @returns Proxy-safe clone with branded type
 * @throws Error if value contains a revoked proxy (unrecoverable)
 */
export function stripProxies<T>(value: T): ProxySafe<T> {
  // Fast path for primitives
  if (value === null || typeof value !== 'object') {
    return value as ProxySafe<T>;
  }

  // Deep clone to remove proxy wrappers
  const cloned = structuredClone(value);

  // Verify no revoked proxies remain
  if (isRevokedProxy(cloned)) {
    throw new Error(
      'stripProxies failed - revoked proxy detected. ' +
        'This indicates a timing issue where Immer already revoked the proxy. ' +
        'Data may be corrupted.'
    );
  }

  // Return with branded type
  return cloned as ProxySafe<T>;
}

/**
 * Type guard to check if value is already ProxySafe
 *
 * Note: This is a compile-time check only. At runtime, we cannot
 * distinguish ProxySafe<T> from T. Use stripProxies() to guarantee safety.
 *
 * @param value - Value to check
 */
export function isProxySafe<T>(value: T | ProxySafe<T>): value is ProxySafe<T> {
  // Runtime: We can't actually detect the brand, so we check for proxies
  return !isRevokedProxy(value);
}

/**
 * Assert that a value is ProxySafe (throws if not)
 *
 * Use this when you're certain a value should be safe but want runtime verification.
 *
 * @param value - Value to assert
 * @param context - Context for error message (e.g., function name)
 * @throws Error if value is a revoked proxy
 */
export function assertProxySafe<T>(
  value: T,
  context: string = 'Unknown'
): asserts value is ProxySafe<T> {
  if (isRevokedProxy(value)) {
    throw new Error(
      `[${context}] Assertion failed: Value contains revoked proxy. ` +
        'This should never happen if stripProxies() is used correctly.'
    );
  }
}
