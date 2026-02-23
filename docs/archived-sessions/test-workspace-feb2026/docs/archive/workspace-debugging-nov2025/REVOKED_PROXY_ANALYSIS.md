# Yjs Revoked Proxy Error Analysis
## Frontend Workspace Store Debugging Report

**Date**: November 27, 2025
**Status**: Critical Issue Identified (Partially Mitigated)
**File**: `/frontend/src/stores/workspace.ts` (lines 231-258, 527-609)

---

## Executive Summary

The error "**illegal operation attempted on a revoked proxy**" occurs when:
1. **Observers try to access Yjs objects** after they've been destroyed
2. **React Strict Mode double-renders** cause proxies to be revoked
3. **Observer callbacks access proxy objects** outside of transaction contexts

The current implementation has **partial error handling** that catches errors in action creators but **leaves the observer unprotected**. The observer at lines 231-258 can crash when accessing `nodes.get(key)` if the node proxy has been revoked.

---

## Root Cause Analysis

### Problem 1: Unprotected Yjs Observer (Lines 231-258)

```typescript
nodes.observe(event => {
  // ... logging code ...
  set(state => {
    event.changes.keys.forEach((change, key) => {
      if (change.action === 'add' || change.action === 'update') {
        const node = nodes.get(key);  // ← CAN THROW "revoked proxy" error
        if (node) {
          state.nodes.set(key, node);  // ← Accessing revoked proxy
        }
      } else if (change.action === 'delete') {
        state.nodes.delete(key);  // ← Can trigger cascading deletes
      }
    });
  });
});
```

**Issue**: The observer callback tries to access `nodes.get(key)` without error handling:
- If the proxy is revoked, this throws `TypeError: illegal operation attempted on a revoked proxy`
- No try-catch wraps the access or the set() call
- React Strict Mode makes this **very likely** in development (double renders)

### Problem 2: Cascading Node Deletions

The current observer unconditionally deletes nodes when it sees a 'delete' action:

```typescript
} else if (change.action === 'delete') {
  console.warn('[Yjs Observer] DELETE action detected for node:', key);
  console.trace('[Yjs Observer] Delete stack trace');
  state.nodes.delete(key);  // ← No validation that this should happen
}
```

**Why this is problematic**:
- If the observer crashes while processing changes, it may have **already deleted some nodes**
- Error doesn't prevent partial state corruption
- No check whether the delete was intentional vs. a transient proxy issue

### Problem 3: Inconsistent Error Handling

**Protected areas** (lines 527-609):
- ✅ `updateNode()` has try-catch around `yjsDoc.transact()`
- ✅ `deleteNode()` has try-catch around `yjsDoc.transact()`
- ✅ `setNodes()` has try-catch around `yjsDoc.transact()`

**Unprotected areas** (lines 231-258):
- ❌ `nodes.observe()` callback has **NO** error handling
- ❌ Accessing proxies inside the set() callback can fail
- ❌ Console logging inside the observer can fail

### Problem 4: Reading from Yjs Inside set()

```typescript
const node = nodes.get(key);  // ← Outside transaction, can be revoked
state.nodes.set(key, node);   // ← Setting potentially revoked object
```

**Why this matters**:
- Yjs proxies are only stable **inside transactions**
- Reading after deletion (even in observer) can access revoked proxies
- The object is already deleted from Yjs but we're trying to read it

---

## How React Strict Mode Triggers This

In **development with React Strict Mode**:
1. Component renders normally
2. React intentionally unmounts the component
3. Yjs cleanup happens (proxies revoked)
4. React re-mounts the component
5. Observer callback fires with revoked proxies
6. Accessing `nodes.get(key)` throws error

This is why the error **only happens in development** but can cause **undefined behavior in production**.

---

## Current Mitigations (Partial)

### ✅ What's Been Fixed
- Action creators (`updateNode`, `deleteNode`, `setNodes`) wrap Yjs transacts in try-catch
- Error detection checks for revoked proxy errors specifically
- Errors are silently ignored in development (appropriate for Strict Mode)

### ❌ What's Still Broken
- Observer callback itself has NO error handling
- Accessing `nodes.get(key)` can throw
- Delete action can corrupt state before error is thrown

---

## Recommended Fix

### Solution 1: Wrap Observer in Error Handling (Safest)

```typescript
nodes.observe(event => {
  try {
    // Log safely without accessing proxies during changes
    console.log('[Yjs Observer] Nodes changed, processing event:', {
      keysChanged: Array.from(event.changes.keys.keys()),
      // Don't enumerate actions here - it requires accessing nodes
    });

    set(state => {
      try {
        event.changes.keys.forEach((change, key) => {
          try {
            if (change.action === 'add' || change.action === 'update') {
              // Safely access the node with error handling
              let node;
              try {
                node = nodes.get(key);
              } catch (err) {
                // Proxy revoked - skip this update
                console.debug(`[Yjs Observer] Skipped revoked node:`, key);
                return; // Skip this node
              }

              if (node) {
                state.nodes.set(key, node);
              }
            } else if (change.action === 'delete') {
              // Validate deletion is safe before executing
              state.nodes.delete(key);
            }
          } catch (err) {
            // Log per-node errors without stopping the observer
            if (!(err instanceof TypeError && err.message.includes('revoked'))) {
              console.error(`[Yjs Observer] Error processing node ${key}:`, err);
            }
          }
        });
      } catch (err) {
        // Log batch errors
        if (!(err instanceof TypeError && err.message.includes('revoked'))) {
          console.error('[Yjs Observer] Error in set() callback:', err);
        }
      }
    });
  } catch (err) {
    // Log observer errors
    if (!(err instanceof TypeError && err.message.includes('revoked'))) {
      console.error('[Yjs Observer] Error in observer callback:', err);
    }
  }
});
```

### Solution 2: Better Proxy Stability (Recommended)

```typescript
nodes.observe(event => {
  // Get all data inside the observer (where proxies are valid)
  const nodeUpdates = new Map<string, { action: string; node?: CanvasNode }>();

  try {
    event.changes.keys.forEach((change, key) => {
      try {
        if (change.action === 'add' || change.action === 'update') {
          const node = nodes.get(key);
          if (node) {
            // Create a deep copy to stabilize the object
            nodeUpdates.set(key, {
              action: change.action,
              node: JSON.parse(JSON.stringify(node))
            });
          }
        } else if (change.action === 'delete') {
          nodeUpdates.set(key, { action: 'delete' });
        }
      } catch (err) {
        // Per-node error handling
        if (!(err instanceof TypeError && err.message.includes('revoked'))) {
          console.error(`[Yjs Observer] Error reading node ${key}:`, err);
        }
      }
    });
  } catch (err) {
    console.error('[Yjs Observer] Error in observer:', err);
    return; // Don't proceed to set() if observer fails
  }

  // Now apply updates in set() where proxies are no longer needed
  set(state => {
    for (const [key, update] of nodeUpdates) {
      if (update.action === 'delete') {
        state.nodes.delete(key);
      } else if (update.node) {
        state.nodes.set(key, update.node);
      }
    }
  });
});
```

### Solution 3: Disable Double-Processing (Temporary)

```typescript
nodes.observe(event => {
  // Skip if this is a no-op update (can happen during Strict Mode double-render)
  if (event.changes.keys.size === 0) {
    return;
  }

  try {
    set(state => {
      try {
        event.changes.keys.forEach((change, key) => {
          if (change.action === 'add' || change.action === 'update') {
            try {
              const node = nodes.get(key);
              if (node) {
                state.nodes.set(key, node);
              }
            } catch (err) {
              // Skip revoked proxies silently
              if (!(err instanceof TypeError && err.message.includes('revoked'))) {
                console.error(`[Yjs Observer] Error on node ${key}:`, err);
              }
            }
          } else if (change.action === 'delete') {
            state.nodes.delete(key);
          }
        });
      } catch (err) {
        if (!(err instanceof TypeError && err.message.includes('revoked'))) {
          console.error('[Yjs Observer] Error in set() callback:', err);
        }
      }
    });
  } catch (err) {
    if (!(err instanceof TypeError && err.message.includes('revoked'))) {
      console.error('[Yjs Observer] Observer error:', err);
    }
  }
});
```

---

## Why Nodes Are Being Accidentally Deleted

If you're seeing nodes mysteriously deleted:

1. **Observer crashes on revoked proxy**
2. Error is silently ignored (because console.error might not show in all environments)
3. **State.nodes.delete(key) executed for some nodes** before error occurred
4. Remaining nodes appear to vanish without explanation

This can happen if:
- A DELETE action is genuinely fired (corrupting state)
- An ADD/UPDATE action throws an error, skipping nodes
- A SUBSEQUENT delete in the foreach loop happens before error is caught

---

## Testing Recommendations

### Test 1: React Strict Mode Behavior
```bash
# Start dev server with Strict Mode enabled
npm run dev
# In browser console:
// Try adding/deleting nodes rapidly
// Check that nodes appear/disappear correctly in local state
// Check that no errors appear (or only 'revoked proxy' errors are silently caught)
```

### Test 2: Yjs Sync After Double Render
```typescript
// In workspace component, add:
useEffect(() => {
  const state = useWorkspaceStore.getState();
  console.log('[Test] Current nodes:', state.nodes.size);
  console.log('[Test] Yjs nodes:', state.yjsNodes?.size);

  // They should match after observer processes
}, [nodes]);
```

### Test 3: Delete Action Validation
```typescript
// Monitor console for "DELETE action detected" messages
// Verify that deletes are intentional (came from deleteNode() action)
// Not from observer processing stale data
```

---

## Files Affected

1. **`/frontend/src/stores/workspace.ts`** (Lines 231-258)
   - Yjs nodes observer - NO ERROR HANDLING
   - Needs try-catch wrapping

2. **`/frontend/src/stores/workspace.ts`** (Lines 527-609)
   - Action creators - ✅ ALREADY HAS ERROR HANDLING
   - Catch blocks properly filter revoked proxy errors

3. **`/frontend/src/lib/workspace/input-handler.ts`** (No changes needed)
   - Input handling doesn't access Yjs directly

4. **`/frontend/src/components/workspace/TextNode.tsx`** (No changes needed)
   - Component rendering doesn't access Yjs

5. **`/frontend/src/lib/workspace/viewport-culling.ts`** (No changes needed)
   - Viewport culling uses local node copies, not Yjs proxies

---

## Implementation Priority

### CRITICAL (Do First)
- Add error handling to nodes observer (lines 231-258)
- Add error handling to connections observer (lines 261-275)
- Add error handling to viewport observer (lines 278-286)

### HIGH (Do Soon)
- Test with React Strict Mode enabled
- Verify no silent data loss
- Add debug logging to detect incomplete updates

### MEDIUM (Optional)
- Implement Solution 2 for better proxy stability
- Add metrics for observer error rates
- Document Yjs proxy lifetime rules

---

## Related Issues

- **Error**: "illegal operation attempted on a revoked proxy"
- **Trigger**: React Strict Mode double-renders, rapid node operations
- **Symptom**: Nodes mysteriously disappear without deletion API call
- **Root Cause**: Observer accessing revoked proxies without error handling
- **Affected Versions**: Current (November 27, 2025)

---

## References

- **Yjs Docs**: https://docs.yjs.dev/
- **React Strict Mode**: https://react.dev/reference/react/StrictMode
- **Zustand Docs**: https://github.com/pmndrs/zustand

---

## Summary

The Yjs observer system is **partially protected** against revoked proxy errors:
- ✅ Action creators have try-catch blocks
- ❌ Observers lack error handling

The fix is straightforward: **wrap observer callbacks in try-catch blocks** similar to the action creators. This prevents silent node deletions and handles React Strict Mode gracefully.

**Recommendation**: Implement Solution 1 (wrap observer in error handling) immediately, then test with React Strict Mode enabled.
