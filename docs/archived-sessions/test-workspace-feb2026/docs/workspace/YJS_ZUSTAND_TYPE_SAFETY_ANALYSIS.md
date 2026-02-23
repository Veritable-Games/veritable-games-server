# Yjs/Zustand Integration: Type Safety Analysis

**Date**: February 14, 2026
**Context**: Browser back navigation causing "revoked proxy" errors
**Severity**: HIGH - Impacts workspace reliability during navigation

---

## Executive Summary

The Yjs/Zustand integration has **fundamental type safety gaps** that allow proxy access after destruction. While runtime guards exist (`isDestroying` flag), **TypeScript provides no compile-time protection** against accessing destroyed state. The debounced observer pattern lacks proper cleanup typing, and async operations have no type-safe barriers.

**Key Finding**: Current architecture relies entirely on runtime checks, which can be bypassed by timing issues. We need **discriminated unions** and **branded types** to enforce cleanup safety at compile time.

---

## 1. Type Safety Gaps (Critical Issues)

### 1.1 No Compile-Time Destroyed State Protection

**Current State**: All Yjs references are typed as `Y.Map<T> | null`
```typescript
interface CanvasState {
  yjsDoc: Y.Doc | null;
  yjsNodes: Y.Map<CanvasNode> | null;
  yjsConnections: Y.Map<Connection> | null;
  isDestroying: boolean; // Runtime-only flag
}
```

**Problem**: TypeScript allows this:
```typescript
const observer = (event: Y.YMapEvent<CanvasNode>) => {
  // No compile-time error even if yjsNodes is destroyed!
  const node = state.yjsNodes?.get(key); // TypeScript thinks this is safe
  // But yjsNodes might be a REVOKED proxy
};
```

**Type Gap**: `null` check doesn't prevent revoked proxy access. Once `destroyYjs()` runs:
1. `yjsNodes` is set to `null` ✅
2. **BUT** observer callbacks may still hold **stale references** to the old Y.Map ❌
3. Accessing stale Y.Map = "Cannot perform 'get' on a proxy that has been revoked"

### 1.2 Debounced Functions Lack Cleanup Types

**Current Implementation**: (`/frontend/src/types/performance.ts:383-421`)
```typescript
export type DebouncedFunction<Args extends unknown[]> = {
  (...args: Args): void;
  cancel: () => void;    // ✅ Has cancel
  flush: () => void;     // ✅ Has flush
};

export const debounce = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number
): DebouncedFunction<Args> => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastArgs: Args | null = null;

  const debouncedFn = (...args: Args) => {
    lastArgs = args;
    if (timeoutId) clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      fn(...args);  // ⚠️ fn might access destroyed Yjs!
      timeoutId = null;
      lastArgs = null;
    }, delay);
  };

  debouncedFn.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
    }
  };

  return debouncedFn;
};
```

**Type Gaps**:
1. **No cleanup guarantee**: Nothing forces caller to call `.cancel()` before Yjs destruction
2. **No destroyed state detection**: `fn` has no way to know if Yjs is destroyed
3. **Stale closure risk**: `fn` captures `get()` at creation time, not execution time

**Evidence from workspace.ts:541-551**:
```typescript
const observerCleanups: (() => void)[] = [
  () => {
    nodes.unobserve(nodesObserver);
    // ✅ GOOD: Cancel is called
    if (WORKSPACE_FEATURES.OBSERVER_DEBOUNCE) {
      nodesObserverDebounced.cancel();
    }
  },
  // ...
];
```

**Critical**: Cleanup IS called, but TypeScript doesn't enforce it. If `OBSERVER_DEBOUNCE` flag changes or cleanup is refactored, compile-time checks won't catch missing `.cancel()`.

### 1.3 Async Callback Safety (No Type Guards)

**Problem**: Debounced callbacks are **asynchronous** (setTimeout). Between scheduling and execution:
1. User navigates away
2. `destroyYjs()` runs
3. `isDestroying = true`
4. Callback fires 16ms later
5. Callback accesses destroyed Yjs

**Current Runtime Guard**: (`workspace.ts:419-421`)
```typescript
const nodesObserverRaw = (event: Y.YMapEvent<CanvasNode>) => {
  // ✅ GOOD: Runtime guard
  if (get().isDestroying) {
    return;
  }

  // ⚠️ But what if isDestroying changes DURING this function?
  const node = state.yjsNodes?.get(key); // Race condition window
};
```

**Type Gap**: `get()` is called ONCE at start. If destruction happens mid-execution:
- `isDestroying` check passes ✅
- Yjs gets destroyed ⚠️
- `state.yjsNodes` becomes `null` ⚠️
- **BUT observer still holds stale reference** ❌

### 1.4 State Initialization Has No Type-Safe Barriers

**Current Pattern**: Yjs state can be in 3 states, but types don't reflect this:
```typescript
// State 1: Uninitialized
yjsDoc: null, yjsNodes: null

// State 2: Active
yjsDoc: Y.Doc, yjsNodes: Y.Map<CanvasNode>

// State 3: Destroyed (DANGEROUS)
yjsDoc: null, yjsNodes: null, isDestroying: true
```

**Problem**: TypeScript sees all 3 states as identical:
```typescript
type YjsState = {
  yjsDoc: Y.Doc | null;
  yjsNodes: Y.Map<CanvasNode> | null;
};

// State 1 and State 3 are INDISTINGUISHABLE at compile time!
```

---

## 2. Recommended Type Patterns for Cleanup-Safe Code

### 2.1 Discriminated Union for Yjs Lifecycle

**Solution**: Make Yjs state machine explicit in types.

```typescript
// Phase 1: Define branded types for safety
type YjsDestroyed = { readonly __destroyed: unique symbol };
type YjsActive = { readonly __active: unique symbol };

// Phase 2: Discriminated union for Yjs state
type YjsLifecycleState =
  | { status: 'uninitialized'; yjsDoc: null; yjsNodes: null }
  | {
      status: 'active';
      yjsDoc: Y.Doc & YjsActive;
      yjsNodes: Y.Map<CanvasNode> & YjsActive;
      observers: ObserverCleanup[];
    }
  | {
      status: 'destroying';
      yjsDoc: null;
      yjsNodes: null;
      // Keep observer cleanups for one final flush
      observers: ObserverCleanup[];
    }
  | { status: 'destroyed'; yjsDoc: null; yjsNodes: null };

interface CanvasState {
  // Replace flat fields with discriminated union
  yjsLifecycle: YjsLifecycleState;

  // Actions become type-safe
  initializeYjs: (workspaceId: WorkspaceId, userId: string) => void;
  destroyYjs: () => void;
}
```

**Benefits**:
1. **Exhaustive checks**: TypeScript forces handling all states
2. **Compile-time safety**: Can't access `yjsNodes` in 'destroyed' state
3. **Clear transitions**: State machine is explicit

**Usage**:
```typescript
// ✅ SAFE: Compile-time checked
if (state.yjsLifecycle.status === 'active') {
  const node = state.yjsLifecycle.yjsNodes.get(key); // Type-safe!
}

// ❌ COMPILE ERROR: Property 'yjsNodes' does not exist on type 'destroyed'
if (state.yjsLifecycle.status === 'destroyed') {
  const node = state.yjsLifecycle.yjsNodes.get(key); // TypeScript error!
}
```

### 2.2 Cleanup-Safe Debounced Function Type

**Problem**: Current `DebouncedFunction` doesn't enforce cleanup.

**Solution**: Add `CleanupRequired` branded type:
```typescript
// Branded type for functions requiring cleanup
type CleanupRequired = { readonly __requiresCleanup: unique symbol };

// Enhanced debounced function with cleanup tracking
export type SafeDebouncedFunction<Args extends unknown[]> = {
  (...args: Args): void;
  cancel: () => void;
  flush: () => void;
  isActive: () => boolean; // NEW: Check if cleanup needed
  [Symbol.dispose]: () => void; // TC39 Explicit Resource Management
} & CleanupRequired;

// Factory function ensures cleanup is registered
export const createSafeDebounce = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
  onCleanup?: () => void // Register cleanup callback
): SafeDebouncedFunction<Args> => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastArgs: Args | null = null;
  let isDestroyed = false;

  const debouncedFn = (...args: Args) => {
    if (isDestroyed) {
      console.warn('[SafeDebounce] Called after destruction - ignoring');
      return;
    }

    lastArgs = args;
    if (timeoutId) clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      if (!isDestroyed) {
        fn(...args);
      }
      timeoutId = null;
      lastArgs = null;
    }, delay);
  };

  debouncedFn.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
    }
  };

  debouncedFn.isActive = () => timeoutId !== null;

  // TC39 Explicit Resource Management (Stage 3)
  debouncedFn[Symbol.dispose] = () => {
    debouncedFn.cancel();
    isDestroyed = true;
    onCleanup?.();
  };

  return debouncedFn as SafeDebouncedFunction<Args>;
};
```

**Usage with cleanup enforcement**:
```typescript
// Option 1: Explicit cleanup (current pattern)
const nodesObserverDebounced = createSafeDebounce(nodesObserverRaw, 16);
const cleanup = () => {
  nodesObserverDebounced.cancel();
  nodes.unobserve(nodesObserverRaw);
};

// Option 2: Auto-cleanup with TC39 using/Symbol.dispose
{
  using nodesObserverDebounced = createSafeDebounce(nodesObserverRaw, 16);
  nodes.observe(nodesObserverDebounced);
  // Auto-cleanup when scope exits! No manual cancel() needed
}
```

### 2.3 Observer Callback with Destroyed State Detection

**Problem**: Observer callbacks can't detect mid-execution destruction.

**Solution**: Pass `isValid()` check function:
```typescript
// Enhanced observer type with validation
type SafeObserver<T> = {
  (event: Y.YMapEvent<T>, isValid: () => boolean): void;
  cleanup: () => void;
};

// Factory creates observer with built-in validation
const createSafeObserver = <T>(
  fn: (event: Y.YMapEvent<T>) => void,
  getState: () => YjsLifecycleState
): SafeObserver<T> => {
  const observer = (event: Y.YMapEvent<T>, isValid: () => boolean) => {
    // Check BEFORE operation
    if (!isValid()) return;

    fn(event);

    // Check AFTER operation (catch mid-execution destruction)
    if (!isValid()) {
      console.warn('[SafeObserver] State changed during execution - results may be stale');
    }
  };

  observer.cleanup = () => {
    // Cleanup logic
  };

  return observer;
};

// Usage
const nodesObserver = createSafeObserver<CanvasNode>(
  (event) => {
    // Process event
  },
  () => get().yjsLifecycle.status === 'active' // Validation function
);

nodes.observe((event) => {
  nodesObserver(event, () => get().yjsLifecycle.status === 'active');
});
```

---

## 3. Compile-Time Checks We Could Add

### 3.1 Enforce Cleanup Registration

**Pattern**: Require all async operations to register cleanup.

```typescript
// Registry of active async operations
type AsyncOperationRegistry = {
  register: (op: { cancel: () => void }) => symbol;
  unregister: (id: symbol) => void;
  cancelAll: () => void;
};

const asyncRegistry: AsyncOperationRegistry = {
  operations: new Map(),

  register(op) {
    const id = Symbol('async-op');
    this.operations.set(id, op);
    return id;
  },

  unregister(id) {
    this.operations.delete(id);
  },

  cancelAll() {
    this.operations.forEach(op => op.cancel());
    this.operations.clear();
  }
};

// Debounce now MUST register with registry
export const createTrackedDebounce = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
  registry: AsyncOperationRegistry // REQUIRED parameter
): SafeDebouncedFunction<Args> & { operationId: symbol } => {
  const debouncedFn = createSafeDebounce(fn, delay);
  const opId = registry.register(debouncedFn);

  return {
    ...debouncedFn,
    operationId: opId
  };
};

// destroyYjs now guarantees cleanup
destroyYjs: () => {
  set(state => { state.isDestroying = true; });

  // Cancel ALL tracked async operations (compile-time enforced)
  asyncRegistry.cancelAll();

  // Then cleanup Yjs
  yjsDoc?.destroy();
}
```

### 3.2 Branded Types for Destroyed Proxies

**Pattern**: Mark destroyed Y.Maps as unusable at type level.

```typescript
// Branded type for destroyed Yjs objects
type Destroyed<T> = T & { readonly __destroyed: unique symbol };

// Type guard function
function markDestroyed<T>(obj: T): Destroyed<T> {
  return obj as Destroyed<T>;
}

// Modified destroyYjs with type safety
destroyYjs: () => {
  const { yjsDoc, yjsNodes, yjsConnections } = get();

  // Mark as destroyed BEFORE calling destroy()
  set(state => {
    if (state.yjsNodes) state.yjsNodes = markDestroyed(state.yjsNodes);
    if (state.yjsConnections) state.yjsConnections = markDestroyed(state.yjsConnections);
  });

  // Now destroy (any lingering references are marked as Destroyed<T>)
  yjsDoc?.destroy();

  set(state => {
    state.yjsDoc = null;
    state.yjsNodes = null;
    state.yjsConnections = null;
  });
}

// Type guard prevents access to destroyed objects
function isDestroyed<T>(obj: T | Destroyed<T>): obj is Destroyed<T> {
  return (obj as any).__destroyed === true;
}

// Usage in observers
const nodesObserver = (event: Y.YMapEvent<CanvasNode>) => {
  const nodes = get().yjsNodes;

  // Compile-time error if trying to use Destroyed<Y.Map>
  if (isDestroyed(nodes)) {
    return; // TypeScript knows nodes is destroyed
  }

  // TypeScript knows nodes is NOT destroyed here
  const node = nodes.get(key); // Safe!
};
```

### 3.3 Exhaustive State Machine Checks

**Pattern**: Use TypeScript's exhaustive checking for state machine.

```typescript
// Discriminated union (from 2.1)
type YjsLifecycleState =
  | { status: 'uninitialized' }
  | { status: 'active'; yjsDoc: Y.Doc; yjsNodes: Y.Map<CanvasNode> }
  | { status: 'destroying' }
  | { status: 'destroyed' };

// Exhaustive check enforced by TypeScript
function handleYjsState(state: YjsLifecycleState): void {
  switch (state.status) {
    case 'uninitialized':
      // TypeScript error if you try to access yjsDoc
      // state.yjsDoc // ❌ Property doesn't exist
      return;

    case 'active':
      // TypeScript knows yjsDoc exists
      const doc = state.yjsDoc; // ✅ Safe
      return;

    case 'destroying':
      // Cancel async operations
      return;

    case 'destroyed':
      // Do nothing
      return;

    // ✅ CRITICAL: TypeScript ERROR if we forget a case!
    default:
      const exhaustiveCheck: never = state;
      throw new Error(`Unhandled state: ${exhaustiveCheck}`);
  }
}
```

---

## 4. Runtime Guards That Are Missing

### 4.1 Mid-Execution Destruction Detection

**Current**: Check only at start of callback.
**Needed**: Check DURING long-running operations.

```typescript
// Current (UNSAFE)
const nodesObserverRaw = (event: Y.YMapEvent<CanvasNode>) => {
  if (get().isDestroying) return; // ✅ Check at start

  // ⚠️ Long operation - destruction could happen during this
  event.changes.keys.forEach((change, key) => {
    const node = state.yjsNodes?.get(key); // No check!
  });
};

// Improved (SAFER)
const nodesObserverRaw = (event: Y.YMapEvent<CanvasNode>) => {
  if (get().isDestroying) return;

  event.changes.keys.forEach((change, key) => {
    // ✅ Check BEFORE each access
    if (get().isDestroying) return;

    const currentNodes = get().yjsNodes;
    if (!currentNodes) return; // ✅ Null check

    const node = currentNodes.get(key);
  });
};
```

### 4.2 Debounced Callback Validation

**Current**: No validation inside debounced callback.
**Needed**: Validate state before executing delayed callback.

```typescript
// Current (UNSAFE)
export const debounce = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number
): DebouncedFunction<Args> => {
  let timeoutId: NodeJS.Timeout | null = null;

  const debouncedFn = (...args: Args) => {
    timeoutId = setTimeout(() => {
      fn(...args); // ⚠️ No validation!
    }, delay);
  };

  return debouncedFn;
};

// Improved (SAFER)
export const createSafeDebounce = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
  validator: () => boolean // NEW: Validation function
): SafeDebouncedFunction<Args> => {
  let timeoutId: NodeJS.Timeout | null = null;
  let isCancelled = false;

  const debouncedFn = (...args: Args) => {
    if (isCancelled) return;

    timeoutId = setTimeout(() => {
      // ✅ Validate BEFORE executing
      if (isCancelled || !validator()) {
        console.warn('[SafeDebounce] Skipping execution - state invalid');
        return;
      }

      fn(...args);
      timeoutId = null;
    }, delay);
  };

  debouncedFn.cancel = () => {
    isCancelled = true;
    if (timeoutId) clearTimeout(timeoutId);
  };

  return debouncedFn;
};

// Usage
const nodesObserverDebounced = createSafeDebounce(
  nodesObserverRaw,
  16,
  () => !get().isDestroying && get().yjsNodes !== null // Validator
);
```

### 4.3 Observer Cleanup Verification

**Current**: No verification that cleanup actually ran.
**Needed**: Track and verify all cleanups execute.

```typescript
// Cleanup registry with verification
class CleanupRegistry {
  private cleanups = new Map<symbol, () => void>();
  private executed = new Set<symbol>();

  register(cleanup: () => void): symbol {
    const id = Symbol('cleanup');
    this.cleanups.set(id, cleanup);
    return id;
  }

  executeAll(): void {
    this.cleanups.forEach((cleanup, id) => {
      try {
        cleanup();
        this.executed.add(id);
      } catch (error) {
        console.error('[CleanupRegistry] Cleanup failed:', error);
      }
    });
  }

  verify(): boolean {
    const registered = this.cleanups.size;
    const executed = this.executed.size;

    if (registered !== executed) {
      console.error(`[CleanupRegistry] Cleanup mismatch: ${executed}/${registered} executed`);
      return false;
    }

    return true;
  }
}

// Usage in destroyYjs
destroyYjs: () => {
  const cleanupRegistry = new CleanupRegistry();

  // Register all cleanups
  yjsObserverCleanups.forEach(cleanup => {
    cleanupRegistry.register(cleanup);
  });

  // Execute and verify
  cleanupRegistry.executeAll();

  if (!cleanupRegistry.verify()) {
    logger.error('[destroyYjs] Some cleanups did not execute!');
  }
}
```

---

## 5. Specific Recommendations

### Priority 1: Immediate (Prevent Current Errors)

1. **Add mid-execution checks to all observers** (Lines 419, 481)
   ```typescript
   event.changes.keys.forEach((change, key) => {
     if (get().isDestroying) return; // Add this check
     // ...
   });
   ```

2. **Add validator to debounced observers** (Lines 511-512)
   ```typescript
   const nodesObserverDebounced = createSafeDebounce(
     nodesObserverRaw,
     16,
     () => !get().isDestroying // Validator
   );
   ```

3. **Verify cleanup execution** (Line 688)
   ```typescript
   const cleanupResults = yjsObserverCleanups.map(cleanup => {
     try {
       cleanup();
       return true;
     } catch (error) {
       logger.error('[Cleanup] Failed:', error);
       return false;
     }
   });

   if (cleanupResults.some(r => !r)) {
     logger.error('[destroyYjs] Some cleanups failed!');
   }
   ```

### Priority 2: Short-Term (1-2 weeks)

1. **Implement discriminated union for Yjs lifecycle**
   - Refactor `CanvasState` to use `YjsLifecycleState`
   - Update all Yjs access to check `status` field
   - Leverage TypeScript exhaustive checking

2. **Add cleanup registry**
   - Track all async operations
   - Enforce cleanup in `destroyYjs()`
   - Add verification step

3. **Enhance debounce with cleanup tracking**
   - Implement `SafeDebouncedFunction` type
   - Add `isActive()` and `Symbol.dispose`
   - Register with cleanup registry

### Priority 3: Long-Term (Architecture)

1. **Branded types for destroyed proxies**
   - Add `Destroyed<T>` type
   - Mark destroyed Y.Maps
   - Prevent access at compile time

2. **State machine visualization**
   - Document all state transitions
   - Add runtime state tracking
   - Create visualization tool for debugging

3. **Testing infrastructure**
   - Add tests for destruction edge cases
   - Test debounced callback cancellation
   - Test observer cleanup race conditions

---

## 6. Implementation Example

Here's a complete example implementing all recommendations:

```typescript
// ============================================================================
// Phase 1: Enhanced Type Definitions
// ============================================================================

// Branded types
type YjsDestroyed = { readonly __destroyed: unique symbol };
type YjsActive = { readonly __active: unique symbol };
type CleanupRequired = { readonly __requiresCleanup: unique symbol };

// Lifecycle state machine
type YjsLifecycleState =
  | {
      status: 'uninitialized';
      doc: null;
      nodes: null;
      connections: null;
    }
  | {
      status: 'active';
      doc: Y.Doc & YjsActive;
      nodes: Y.Map<CanvasNode> & YjsActive;
      connections: Y.Map<Connection> & YjsActive;
      cleanupRegistry: CleanupRegistry;
    }
  | {
      status: 'destroying';
      doc: null;
      nodes: null;
      connections: null;
      cleanupRegistry: CleanupRegistry;
    }
  | {
      status: 'destroyed';
      doc: null;
      nodes: null;
      connections: null;
    };

// Enhanced debounced function
type SafeDebouncedFunction<Args extends unknown[]> = {
  (...args: Args): void;
  cancel: () => void;
  flush: () => void;
  isActive: () => boolean;
  [Symbol.dispose]: () => void;
} & CleanupRequired;

// ============================================================================
// Phase 2: Safe Debounce Implementation
// ============================================================================

export const createSafeDebounce = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
  options?: {
    validator?: () => boolean;
    onCleanup?: () => void;
  }
): SafeDebouncedFunction<Args> => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastArgs: Args | null = null;
  let isCancelled = false;

  const debouncedFn = (...args: Args) => {
    if (isCancelled) {
      logger.warn('[SafeDebounce] Called after cancellation - ignoring');
      return;
    }

    lastArgs = args;
    if (timeoutId) clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      // Validate state before execution
      if (isCancelled || (options?.validator && !options.validator())) {
        logger.warn('[SafeDebounce] Skipping execution - state invalid');
        timeoutId = null;
        lastArgs = null;
        return;
      }

      fn(...args);
      timeoutId = null;
      lastArgs = null;
    }, delay);
  };

  debouncedFn.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
    }
    isCancelled = true;
    options?.onCleanup?.();
  };

  debouncedFn.flush = () => {
    if (timeoutId && lastArgs && !isCancelled) {
      clearTimeout(timeoutId);
      fn(...lastArgs);
      timeoutId = null;
      lastArgs = null;
    }
  };

  debouncedFn.isActive = () => timeoutId !== null;

  debouncedFn[Symbol.dispose] = () => {
    debouncedFn.cancel();
  };

  return debouncedFn as SafeDebouncedFunction<Args>;
};

// ============================================================================
// Phase 3: Enhanced Observer with Mid-Execution Checks
// ============================================================================

const createSafeYjsObserver = <T>(
  fn: (event: Y.YMapEvent<T>) => void,
  getLifecycle: () => YjsLifecycleState
) => {
  return (event: Y.YMapEvent<T>) => {
    const lifecycle = getLifecycle();

    // Pre-execution check
    if (lifecycle.status !== 'active') {
      logger.warn('[SafeObserver] Skipping - Yjs not active:', lifecycle.status);
      return;
    }

    // Origin tracking - skip local changes
    if (WORKSPACE_FEATURES.ORIGIN_TRACKING && event.transaction.origin === 'local') {
      return;
    }

    try {
      // Process changes with mid-execution checks
      event.changes.keys.forEach((change, key) => {
        // Mid-execution check
        const currentLifecycle = getLifecycle();
        if (currentLifecycle.status !== 'active') {
          logger.warn('[SafeObserver] State changed during execution - aborting');
          return;
        }

        fn(event);
      });
    } catch (error) {
      // Silently ignore revoked proxy errors
      if (!(error instanceof TypeError && error.message.includes('revoked'))) {
        logger.error('[SafeObserver] Error processing event:', error);
      }
    }

    // Post-execution check
    const finalLifecycle = getLifecycle();
    if (finalLifecycle.status !== 'active') {
      logger.warn('[SafeObserver] State changed during execution - results may be stale');
    }
  };
};

// ============================================================================
// Phase 4: Enhanced initializeYjs with Lifecycle State Machine
// ============================================================================

initializeYjs: (workspaceId: WorkspaceId, userId: string) => {
  // Reset to uninitialized state
  set(state => {
    state.yjsLifecycle = {
      status: 'uninitialized',
      doc: null,
      nodes: null,
      connections: null
    };
  });

  const { doc, nodes, connections } = setupYjsDocument(workspaceId);
  const cleanupRegistry = new CleanupRegistry();

  // Setup providers...
  const wsProvider = WORKSPACE_FEATURES.WEBSOCKET_ENABLED
    ? setupWebSocketProvider(doc, workspaceId, wsUrl)
    : null;
  const indexedDBProvider = setupIndexedDBPersistence(doc, workspaceId);

  // Create safe observers with validation
  const nodesObserverRaw = createSafeYjsObserver<CanvasNode>(
    (event) => {
      set(state => {
        event.changes.keys.forEach((change, key) => {
          if (change.action === 'add' || change.action === 'update') {
            const lifecycle = get().yjsLifecycle;
            if (lifecycle.status !== 'active') return;

            const node = lifecycle.nodes.get(key);
            if (node) state.nodes.set(key, node);
          } else if (change.action === 'delete') {
            state.nodes.delete(key);
          }
        });
      });
    },
    () => get().yjsLifecycle
  );

  // Create debounced version with validator
  const nodesObserverDebounced = createSafeDebounce(
    nodesObserverRaw,
    16,
    {
      validator: () => get().yjsLifecycle.status === 'active',
      onCleanup: () => logger.info('[Cleanup] Nodes observer debounced cleanup')
    }
  );

  // Register cleanup
  const nodesCleanupId = cleanupRegistry.register(() => {
    nodes.unobserve(nodesObserver);
    nodesObserverDebounced.cancel();
  });

  // Select observer based on feature flag
  const nodesObserver = WORKSPACE_FEATURES.OBSERVER_DEBOUNCE
    ? nodesObserverDebounced
    : nodesObserverRaw;

  // Subscribe to Yjs changes
  nodes.observe(nodesObserver);

  // Set ACTIVE state
  set(state => {
    state.yjsLifecycle = {
      status: 'active',
      doc: doc as Y.Doc & YjsActive,
      nodes: nodes as Y.Map<CanvasNode> & YjsActive,
      connections: connections as Y.Map<Connection> & YjsActive,
      cleanupRegistry
    };
  });

  logger.info('[Yjs] Initialized - State: ACTIVE');
},

// ============================================================================
// Phase 5: Enhanced destroyYjs with State Machine
// ============================================================================

destroyYjs: () => {
  const lifecycle = get().yjsLifecycle;

  // Guard: Can't destroy if already destroying/destroyed
  if (lifecycle.status === 'destroying' || lifecycle.status === 'destroyed') {
    logger.warn('[destroyYjs] Already destroying/destroyed - ignoring');
    return;
  }

  // Transition to DESTROYING state
  set(state => {
    if (state.yjsLifecycle.status === 'active') {
      state.yjsLifecycle = {
        status: 'destroying',
        doc: null,
        nodes: null,
        connections: null,
        cleanupRegistry: state.yjsLifecycle.cleanupRegistry
      };
    }
  });

  logger.info('[Yjs] State transition: ACTIVE -> DESTROYING');

  // Execute all cleanups with verification
  const currentLifecycle = get().yjsLifecycle;
  if (currentLifecycle.status === 'destroying') {
    const { cleanupRegistry } = currentLifecycle;

    try {
      cleanupRegistry.executeAll();

      if (!cleanupRegistry.verify()) {
        logger.error('[destroyYjs] Some cleanups did not execute!');
      } else {
        logger.info('[destroyYjs] All cleanups executed successfully');
      }
    } catch (error) {
      logger.error('[destroyYjs] Cleanup execution failed:', error);
    }
  }

  // Destroy Yjs providers
  if (lifecycle.status === 'active') {
    const { doc } = lifecycle;

    // Disconnect WebSocket before destroying
    wsProvider?.disconnect();

    // Destroy providers
    wsProvider?.destroy();
    indexedDBProvider?.destroy();
    doc.destroy();
  }

  // Transition to DESTROYED state
  set(state => {
    state.yjsLifecycle = {
      status: 'destroyed',
      doc: null,
      nodes: null,
      connections: null
    };
  });

  logger.info('[Yjs] State transition: DESTROYING -> DESTROYED');
}
```

---

## 7. Testing Recommendations

### 7.1 Unit Tests for Cleanup

```typescript
describe('YjsSafeWriter', () => {
  test('should reject writes to destroyed doc', () => {
    const doc = new Y.Doc();
    const nodes = doc.getMap<CanvasNode>('nodes');
    const writer = new YjsSafeWriter(doc, nodes, null, null);

    doc.destroy();

    expect(() => {
      writer.writeNode({ id: 'test', /* ... */ });
    }).toThrow('Cannot write - Yjs doc is destroyed');
  });
});

describe('SafeDebounce', () => {
  test('should cancel pending callback on destroy', async () => {
    const fn = jest.fn();
    const validator = jest.fn(() => true);

    const debounced = createSafeDebounce(fn, 100, { validator });
    debounced('test');

    // Cancel before execution
    debounced.cancel();

    await new Promise(resolve => setTimeout(resolve, 150));
    expect(fn).not.toHaveBeenCalled();
  });

  test('should skip execution if validator fails', async () => {
    const fn = jest.fn();
    const validator = jest.fn(() => false); // Always invalid

    const debounced = createSafeDebounce(fn, 100, { validator });
    debounced('test');

    await new Promise(resolve => setTimeout(resolve, 150));
    expect(fn).not.toHaveBeenCalled();
    expect(validator).toHaveBeenCalled();
  });
});
```

### 7.2 Integration Tests for Browser Navigation

```typescript
describe('Workspace Yjs Cleanup', () => {
  test('should handle browser back navigation', async () => {
    // Setup workspace
    const { result } = renderHook(() => useWorkspaceStore());
    act(() => {
      result.current.initializeYjs('workspace-1', 'user-1');
    });

    // Add some nodes
    act(() => {
      result.current.addNode({ id: 'node-1', /* ... */ });
    });

    // Simulate browser back
    act(() => {
      result.current.destroyYjs();
    });

    // Verify cleanup
    expect(result.current.yjsLifecycle.status).toBe('destroyed');
    expect(result.current.nodes.size).toBe(0);
  });
});
```

---

## Conclusion

The Yjs/Zustand integration has **solid runtime guards** but **weak type safety**. The `isDestroying` flag prevents most errors, but:

1. **No compile-time protection** against accessing destroyed state
2. **Debounced callbacks** can fire after destruction (missing validation)
3. **Mid-execution destruction** not detected in all paths
4. **State machine** not reflected in types (uninitialized === destroyed)

**Recommended Actions**:
1. ✅ **Immediate**: Add mid-execution checks and debounce validators
2. ✅ **Short-term**: Implement discriminated union for lifecycle
3. ✅ **Long-term**: Add branded types and comprehensive testing

This will transform the codebase from **runtime-safe** to **compile-time-safe**, catching errors during development instead of production.
