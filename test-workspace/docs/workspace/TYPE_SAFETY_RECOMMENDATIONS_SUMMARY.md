# Type Safety Recommendations Summary

**Date**: February 14, 2026
**Issue**: Revoked proxy errors during browser back navigation
**Analysis**: See [YJS_ZUSTAND_TYPE_SAFETY_ANALYSIS.md](./YJS_ZUSTAND_TYPE_SAFETY_ANALYSIS.md)

---

## Quick Reference: What's Wrong?

| Issue | Current State | Risk Level | Fix Complexity |
|-------|---------------|------------|----------------|
| **No discriminated union** | `yjsDoc: Y.Doc \| null` can't distinguish uninitialized vs destroyed | HIGH | Medium |
| **Debounced callbacks unsafe** | Can fire after destruction | HIGH | Low |
| **Mid-execution checks missing** | Destruction during observer can corrupt state | MEDIUM | Low |
| **No cleanup verification** | Can't detect failed cleanups | MEDIUM | Low |
| **No async tracking** | Can't guarantee all async ops cancelled | MEDIUM | Medium |

---

## Priority 1: Immediate Fixes (1-2 hours)

### Fix 1: Add Mid-Execution Checks to Observers

**File**: `/frontend/src/stores/workspace.ts:440-468`

**Current Code**:
```typescript
event.changes.keys.forEach((change, key) => {
  if (change.action === 'add' || change.action === 'update') {
    const currentNodes = get().yjsNodes;
    const node = currentNodes?.get(key);
    if (node) {
      state.nodes.set(key, node);
    }
  } else if (change.action === 'delete') {
    state.nodes.delete(key);
  }
});
```

**Fixed Code**:
```typescript
event.changes.keys.forEach((change, key) => {
  // ✅ ADD: Mid-execution check
  if (get().isDestroying) {
    logger.warn('[Observer] Aborted mid-execution - Yjs destroying');
    return;
  }

  if (change.action === 'add' || change.action === 'update') {
    const currentNodes = get().yjsNodes;
    if (!currentNodes) return; // ✅ ADD: Explicit null check

    const node = currentNodes.get(key);
    if (node) {
      state.nodes.set(key, node);
    }
  } else if (change.action === 'delete') {
    state.nodes.delete(key);
  }
});
```

**Apply to**: Lines 419-476 (nodesObserverRaw) and Lines 479-505 (connectionsObserverRaw)

---

### Fix 2: Enhance Debounce with Validator

**File**: `/frontend/src/types/performance.ts:383-421`

**Current Code**:
```typescript
timeoutId = setTimeout(() => {
  fn(...args);  // ⚠️ No validation!
  timeoutId = null;
  lastArgs = null;
}, delay);
```

**Fixed Code**:
```typescript
export const debounce = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
  validator?: () => boolean  // ✅ ADD: Optional validator
): DebouncedFunction<Args> => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastArgs: Args | null = null;
  let isCancelled = false;  // ✅ ADD: Cancellation flag

  const debouncedFn = (...args: Args) => {
    if (isCancelled) return;  // ✅ ADD: Check cancelled

    lastArgs = args;
    if (timeoutId) clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      // ✅ ADD: Validate before execution
      if (isCancelled || (validator && !validator())) {
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
    isCancelled = true;  // ✅ ADD: Set flag
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
    }
  };

  debouncedFn.flush = () => {
    if (timeoutId && lastArgs && !isCancelled) {  // ✅ ADD: Check cancelled
      clearTimeout(timeoutId);

      // ✅ ADD: Validate before flush
      if (validator && !validator()) {
        timeoutId = null;
        lastArgs = null;
        return;
      }

      fn(...lastArgs);
      timeoutId = null;
      lastArgs = null;
    }
  };

  return debouncedFn;
};
```

**Usage in workspace.ts:511-512**:
```typescript
const nodesObserverDebounced = debounce(
  nodesObserverRaw,
  DEBOUNCE_DELAY,
  () => !get().isDestroying && get().yjsNodes !== null  // ✅ ADD: Validator
);

const connectionsObserverDebounced = debounce(
  connectionsObserverRaw,
  DEBOUNCE_DELAY,
  () => !get().isDestroying && get().yjsConnections !== null  // ✅ ADD: Validator
);
```

---

### Fix 3: Verify Cleanup Execution

**File**: `/frontend/src/stores/workspace.ts:686-697`

**Current Code**:
```typescript
yjsObserverCleanups.forEach(cleanup => {
  try {
    cleanup();
  } catch (error) {
    logger.warn('[Workspace] Error during observer cleanup', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
```

**Fixed Code**:
```typescript
// ✅ ADD: Track cleanup results
const cleanupResults: Array<{ index: number; success: boolean; error?: string }> = [];

yjsObserverCleanups.forEach((cleanup, index) => {
  try {
    cleanup();
    cleanupResults.push({ index, success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cleanupResults.push({ index, success: false, error: errorMessage });
    logger.warn('[Workspace] Cleanup failed', { index, error: errorMessage });
  }
});

// ✅ ADD: Verify all cleanups succeeded
const failedCleanups = cleanupResults.filter(r => !r.success);
if (failedCleanups.length > 0) {
  logger.error('[destroyYjs] Some cleanups failed!', {
    total: cleanupResults.length,
    failed: failedCleanups.length,
    failures: failedCleanups
  });
} else {
  logger.info('[destroyYjs] All cleanups executed successfully', {
    count: cleanupResults.length
  });
}
```

---

## Priority 2: Short-Term Improvements (1 week)

### Improvement 1: Discriminated Union for Yjs Lifecycle

**File**: Create `/frontend/src/stores/workspace-types.ts`

```typescript
import * as Y from 'yjs';
import { CanvasNode, Connection } from '@/lib/workspace/types';

// Branded types for lifecycle states
export type YjsDestroyed = { readonly __destroyed: unique symbol };
export type YjsActive = { readonly __active: unique symbol };

// Cleanup registry type
export interface CleanupRegistry {
  register: (cleanup: () => void) => symbol;
  executeAll: () => void;
  verify: () => boolean;
}

// Discriminated union for Yjs lifecycle
export type YjsLifecycleState =
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
      observerCleanups: (() => void)[];
    }
  | {
      status: 'destroying';
      doc: null;
      nodes: null;
      connections: null;
      cleanupRegistry: CleanupRegistry;
      observerCleanups: (() => void)[];
    }
  | {
      status: 'destroyed';
      doc: null;
      nodes: null;
      connections: null;
    };

// Type guard helpers
export function isYjsActive(
  state: YjsLifecycleState
): state is Extract<YjsLifecycleState, { status: 'active' }> {
  return state.status === 'active';
}

export function isYjsDestroyed(
  state: YjsLifecycleState
): state is Extract<YjsLifecycleState, { status: 'destroyed' | 'destroying' }> {
  return state.status === 'destroyed' || state.status === 'destroying';
}
```

**Migrate workspace.ts** to use `YjsLifecycleState`:
```typescript
interface CanvasState {
  // OLD: Flat fields with null
  // yjsDoc: Y.Doc | null;
  // yjsNodes: Y.Map<CanvasNode> | null;
  // yjsConnections: Y.Map<Connection> | null;
  // isDestroying: boolean;

  // NEW: Discriminated union
  yjsLifecycle: YjsLifecycleState;

  // ... rest of state
}
```

**Benefits**:
- ✅ Compile-time state verification
- ✅ Exhaustive pattern matching
- ✅ Can't access `yjsNodes` in 'destroyed' state
- ✅ Clear state transitions

---

### Improvement 2: Cleanup Registry Implementation

**File**: Create `/frontend/src/lib/workspace/cleanup-registry.ts`

```typescript
import { logger } from '@/lib/utils/logger';

export interface CleanupResult {
  id: symbol;
  success: boolean;
  error?: string;
}

export class WorkspaceCleanupRegistry {
  private cleanups = new Map<symbol, () => void>();
  private executed = new Set<symbol>();
  private results: CleanupResult[] = [];

  register(cleanup: () => void, description?: string): symbol {
    const id = Symbol(description || 'cleanup');
    this.cleanups.set(id, cleanup);
    logger.debug('[CleanupRegistry] Registered cleanup:', {
      id: id.toString(),
      description
    });
    return id;
  }

  unregister(id: symbol): void {
    this.cleanups.delete(id);
  }

  executeAll(): void {
    logger.info('[CleanupRegistry] Executing cleanups', {
      count: this.cleanups.size
    });

    this.cleanups.forEach((cleanup, id) => {
      try {
        cleanup();
        this.executed.add(id);
        this.results.push({ id, success: true });
        logger.debug('[CleanupRegistry] Cleanup succeeded:', {
          id: id.toString()
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.results.push({ id, success: false, error: errorMessage });
        logger.error('[CleanupRegistry] Cleanup failed:', {
          id: id.toString(),
          error: errorMessage
        });
      }
    });
  }

  verify(): boolean {
    const registered = this.cleanups.size;
    const executed = this.executed.size;
    const failed = this.results.filter(r => !r.success).length;

    if (registered !== executed) {
      logger.error('[CleanupRegistry] Cleanup count mismatch', {
        registered,
        executed,
        missing: registered - executed
      });
      return false;
    }

    if (failed > 0) {
      logger.error('[CleanupRegistry] Some cleanups failed', {
        total: registered,
        failed,
        failures: this.results.filter(r => !r.success)
      });
      return false;
    }

    logger.info('[CleanupRegistry] All cleanups verified', {
      count: registered
    });
    return true;
  }

  getResults(): CleanupResult[] {
    return [...this.results];
  }

  clear(): void {
    this.cleanups.clear();
    this.executed.clear();
    this.results = [];
  }
}
```

**Usage in workspace.ts:initializeYjs**:
```typescript
initializeYjs: (workspaceId: WorkspaceId, userId: string) => {
  const cleanupRegistry = new WorkspaceCleanupRegistry();

  // Register observer cleanup
  cleanupRegistry.register(
    () => {
      nodes.unobserve(nodesObserver);
      if (WORKSPACE_FEATURES.OBSERVER_DEBOUNCE) {
        nodesObserverDebounced.cancel();
      }
    },
    'nodes-observer'
  );

  // Store registry in state
  set(state => {
    state.yjsLifecycle = {
      status: 'active',
      doc,
      nodes,
      connections,
      cleanupRegistry,
      observerCleanups: []  // Deprecated - use cleanupRegistry
    };
  });
}
```

---

## Priority 3: Long-Term Architecture (1 month)

### Architecture 1: Safe Debounce Utility

**File**: Create `/frontend/src/lib/workspace/safe-debounce.ts`

```typescript
import { logger } from '@/lib/utils/logger';

export type SafeDebouncedFunction<Args extends unknown[]> = {
  (...args: Args): void;
  cancel: () => void;
  flush: () => void;
  isActive: () => boolean;
  isPending: () => boolean;
};

export interface SafeDebounceOptions<Args extends unknown[]> {
  validator?: () => boolean;
  onCancel?: () => void;
  onExecute?: (...args: Args) => void;
  description?: string;
}

export function createSafeDebounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
  options: SafeDebounceOptions<Args> = {}
): SafeDebouncedFunction<Args> {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastArgs: Args | null = null;
  let isCancelled = false;
  const description = options.description || 'debounced-fn';

  const debouncedFn = (...args: Args) => {
    if (isCancelled) {
      logger.warn(`[SafeDebounce:${description}] Called after cancellation - ignoring`);
      return;
    }

    lastArgs = args;
    if (timeoutId) clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      // Validate before execution
      if (isCancelled) {
        logger.warn(`[SafeDebounce:${description}] Cancelled before execution`);
        timeoutId = null;
        lastArgs = null;
        return;
      }

      if (options.validator && !options.validator()) {
        logger.warn(`[SafeDebounce:${description}] Validator failed - skipping execution`);
        timeoutId = null;
        lastArgs = null;
        return;
      }

      // Execute
      try {
        options.onExecute?.(...args);
        fn(...args);
      } catch (error) {
        logger.error(`[SafeDebounce:${description}] Execution error:`, error);
      } finally {
        timeoutId = null;
        lastArgs = null;
      }
    }, delay);
  };

  debouncedFn.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
      logger.debug(`[SafeDebounce:${description}] Cancelled`);
    }
    isCancelled = true;
    options.onCancel?.();
  };

  debouncedFn.flush = () => {
    if (timeoutId && lastArgs && !isCancelled) {
      clearTimeout(timeoutId);
      timeoutId = null;

      // Validate before flush
      if (options.validator && !options.validator()) {
        logger.warn(`[SafeDebounce:${description}] Validator failed - skipping flush`);
        lastArgs = null;
        return;
      }

      try {
        options.onExecute?.(...lastArgs);
        fn(...lastArgs);
      } catch (error) {
        logger.error(`[SafeDebounce:${description}] Flush error:`, error);
      } finally {
        lastArgs = null;
      }
    }
  };

  debouncedFn.isActive = () => timeoutId !== null;
  debouncedFn.isPending = () => lastArgs !== null;

  return debouncedFn;
}
```

**Usage in workspace.ts**:
```typescript
import { createSafeDebounce } from '@/lib/workspace/safe-debounce';

const nodesObserverDebounced = createSafeDebounce(
  nodesObserverRaw,
  DEBOUNCE_DELAY,
  {
    validator: () => {
      const lifecycle = get().yjsLifecycle;
      return lifecycle.status === 'active' && lifecycle.nodes !== null;
    },
    onCancel: () => {
      logger.info('[Workspace] Nodes observer debounce cancelled');
    },
    description: 'nodes-observer'
  }
);
```

---

## Testing Requirements

### Unit Tests

**File**: Create `/frontend/src/lib/workspace/__tests__/safe-debounce.test.ts`

```typescript
import { createSafeDebounce } from '../safe-debounce';

describe('createSafeDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should execute after delay', () => {
    const fn = jest.fn();
    const debounced = createSafeDebounce(fn, 100);

    debounced('arg1');
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('arg1');
  });

  test('should cancel pending execution', () => {
    const fn = jest.fn();
    const debounced = createSafeDebounce(fn, 100);

    debounced('arg1');
    debounced.cancel();

    jest.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
  });

  test('should skip execution if validator fails', () => {
    const fn = jest.fn();
    const validator = jest.fn(() => false);
    const debounced = createSafeDebounce(fn, 100, { validator });

    debounced('arg1');
    jest.advanceTimersByTime(100);

    expect(validator).toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });

  test('should flush immediately', () => {
    const fn = jest.fn();
    const debounced = createSafeDebounce(fn, 100);

    debounced('arg1');
    debounced.flush();

    expect(fn).toHaveBeenCalledWith('arg1');
  });

  test('should track active state', () => {
    const fn = jest.fn();
    const debounced = createSafeDebounce(fn, 100);

    expect(debounced.isActive()).toBe(false);

    debounced('arg1');
    expect(debounced.isActive()).toBe(true);

    jest.advanceTimersByTime(100);
    expect(debounced.isActive()).toBe(false);
  });
});
```

---

## Migration Checklist

- [ ] **Priority 1 - Immediate** (1-2 hours)
  - [ ] Add mid-execution checks to nodesObserverRaw (line 440)
  - [ ] Add mid-execution checks to connectionsObserverRaw (line 490)
  - [ ] Enhance debounce function with validator parameter
  - [ ] Update observer debounce calls with validators
  - [ ] Add cleanup execution verification

- [ ] **Priority 2 - Short-Term** (1 week)
  - [ ] Create workspace-types.ts with discriminated union
  - [ ] Create cleanup-registry.ts implementation
  - [ ] Migrate workspace.ts to use YjsLifecycleState
  - [ ] Update all Yjs access to check lifecycle.status
  - [ ] Add exhaustive state machine checks

- [ ] **Priority 3 - Long-Term** (1 month)
  - [ ] Create safe-debounce.ts utility
  - [ ] Migrate all debounce calls to createSafeDebounce
  - [ ] Add comprehensive test suite
  - [ ] Add state machine visualization
  - [ ] Document all state transitions

---

## Expected Outcomes

### After Priority 1 (Immediate):
- ✅ Mid-execution destruction handled safely
- ✅ Debounced callbacks validated before execution
- ✅ Cleanup failures detected and logged
- ✅ **Estimated bug reduction: 70%**

### After Priority 2 (Short-Term):
- ✅ Compile-time state verification
- ✅ Exhaustive pattern matching for Yjs states
- ✅ Centralized cleanup tracking
- ✅ **Estimated bug reduction: 90%**

### After Priority 3 (Long-Term):
- ✅ Comprehensive type safety
- ✅ Robust test coverage
- ✅ Clear architectural patterns
- ✅ **Estimated bug reduction: 95%+**

---

## References

- Full analysis: [YJS_ZUSTAND_TYPE_SAFETY_ANALYSIS.md](./YJS_ZUSTAND_TYPE_SAFETY_ANALYSIS.md)
- Related issue: Browser back navigation revoked proxy errors
- TypeScript discriminated unions: https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html#discriminating-unions
- TC39 Explicit Resource Management: https://github.com/tc39/proposal-explicit-resource-management
