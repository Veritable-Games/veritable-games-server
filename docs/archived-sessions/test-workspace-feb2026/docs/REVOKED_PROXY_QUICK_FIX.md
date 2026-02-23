# Quick Fix: Yjs Observer Revoked Proxy Errors

## Problem in 1 Sentence
**Observers try to access Yjs proxies that have been revoked, causing silent node deletions and React Strict Mode crashes.**

---

## The Issue at a Glance

### Current Code (BROKEN - Lines 231-258)
```typescript
nodes.observe(event => {
  console.log('[Yjs Observer] Nodes changed...');

  set(state => {
    event.changes.keys.forEach((change, key) => {
      if (change.action === 'add' || change.action === 'update') {
        const node = nodes.get(key);  // ❌ CAN THROW "revoked proxy"
        if (node) {
          state.nodes.set(key, node);  // ❌ No error handling
        }
      } else if (change.action === 'delete') {
        state.nodes.delete(key);  // ❌ Can delete before error caught
      }
    });
  });
});
```

### Why It's Broken
1. **No try-catch** around observer callback
2. **No try-catch** around `nodes.get(key)` access
3. **React Strict Mode** revokes proxies during double-render
4. **Delete happens** before error caught → state corruption

---

## The Fix (3 Options)

### Option 1: Minimal Fix (Recommended for Now)
**Add error handling around proxy access:**

```typescript
nodes.observe(event => {
  try {
    console.log('[Yjs Observer] Nodes changed, processing event:', {
      keysChanged: Array.from(event.changes.keys.keys()),
    });

    set(state => {
      try {
        event.changes.keys.forEach((change, key) => {
          try {
            if (change.action === 'add' || change.action === 'update') {
              const node = nodes.get(key);  // ✅ Wrapped in try-catch
              if (node) {
                state.nodes.set(key, node);
              }
            } else if (change.action === 'delete') {
              state.nodes.delete(key);
            }
          } catch (err) {
            // Skip revoked proxies silently
            if (!(err instanceof TypeError && err.message.includes('revoked'))) {
              console.error(`[Yjs Observer] Error on node ${key}:`, err);
            }
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

**Changes**:
- ✅ 3 nested try-catch blocks (observer → set → foreach)
- ✅ Each error is caught before it crashes
- ✅ Revoked proxy errors are silently ignored (normal in dev)
- ✅ Real errors still get logged

**Why this works**:
- Prevents observer crashes
- Prevents partial state deletion
- Allows graceful handling of React Strict Mode
- Matches pattern already used in action creators

---

### Option 2: Stabilize Proxy Access (Better)
**Read from Yjs, copy data, then update state:**

```typescript
nodes.observe(event => {
  // Step 1: Collect data from Yjs (where proxies are valid)
  const updates: Array<{ key: string; action: string; data?: CanvasNode }> = [];

  try {
    event.changes.keys.forEach((change, key) => {
      try {
        if (change.action === 'add' || change.action === 'update') {
          const node = nodes.get(key);
          if (node) {
            // Deep copy to stabilize the object
            updates.push({
              key,
              action: 'update',
              data: JSON.parse(JSON.stringify(node))
            });
          }
        } else if (change.action === 'delete') {
          updates.push({ key, action: 'delete' });
        }
      } catch (err) {
        if (!(err instanceof TypeError && err.message.includes('revoked'))) {
          console.error(`[Yjs Observer] Error reading node ${key}:`, err);
        }
      }
    });
  } catch (err) {
    console.error('[Yjs Observer] Observer error:', err);
    return;
  }

  // Step 2: Apply updates in set() (proxies no longer needed)
  set(state => {
    updates.forEach(update => {
      if (update.action === 'delete') {
        state.nodes.delete(update.key);
      } else if (update.data) {
        state.nodes.set(update.key, update.data);
      }
    });
  });
});
```

**Advantages**:
- ✅ Proxies only accessed in valid scope
- ✅ No stale data issues
- ✅ Deep copy ensures object stability
- ✅ Cleaner separation of concerns

**Disadvantages**:
- More code
- JSON parse/stringify overhead (minor)

---

### Option 3: Skip Invalid Changes (Workaround)
**Only process changes if proxies are still valid:**

```typescript
nodes.observe(event => {
  // Skip if no changes
  if (event.changes.keys.size === 0) {
    return;
  }

  try {
    set(state => {
      event.changes.keys.forEach((change, key) => {
        try {
          if (change.action === 'add' || change.action === 'update') {
            try {
              const node = nodes.get(key);
              if (node) {
                state.nodes.set(key, node);
              } else {
                console.warn(`[Yjs Observer] Node not found in Yjs:`, key);
              }
            } catch (err) {
              if (err instanceof TypeError && err.message.includes('revoked')) {
                console.debug(`[Yjs Observer] Proxy revoked for node:`, key);
              } else {
                throw err;
              }
            }
          } else if (change.action === 'delete') {
            state.nodes.delete(key);
          }
        } catch (err) {
          console.error(`[Yjs Observer] Error processing node ${key}:`, err);
        }
      });
    });
  } catch (err) {
    console.error('[Yjs Observer] Observer error:', err);
  }
});
```

**When to use**:
- When you want minimal changes
- When you want to keep existing code structure

---

## Affected Observers (All Need Same Fix)

### 1. Nodes Observer (Lines 231-258)
**Status**: ❌ BROKEN - needs fix

### 2. Connections Observer (Lines 261-275)
**Status**: ❌ BROKEN - same issue

```typescript
connections.observe(event => {
  set(state => {
    event.changes.keys.forEach((change, key) => {
      // ❌ No error handling here either
      if (change.action === 'add' || change.action === 'update') {
        const connection = connections.get(key);
        if (connection) {
          state.connections.set(key, connection);
        }
      } else if (change.action === 'delete') {
        state.connections.delete(key);
      }
    });
  });
});
```

### 3. Viewport Observer (Lines 278-286)
**Status**: ✅ SAFER - reads individual values not objects

```typescript
viewport.observe(() => {
  set(state => {
    // Reading primitive values (numbers) is safer than objects
    state.viewport = {
      offsetX: viewport.get('offsetX') ?? 0,
      offsetY: viewport.get('offsetY') ?? 0,
      scale: viewport.get('scale') ?? 1,
    };
  });
});
```

**Still should add try-catch for completeness**

---

## Step-by-Step Fix Guide

### Step 1: Backup Current File
```bash
cp frontend/src/stores/workspace.ts frontend/src/stores/workspace.ts.backup
```

### Step 2: Apply Option 1 Fix
Replace lines 231-258 with:
```typescript
nodes.observe(event => {
  try {
    console.log('[Yjs Observer] Nodes changed, processing event:', {
      keysChanged: Array.from(event.changes.keys.keys()),
    });

    set(state => {
      try {
        event.changes.keys.forEach((change, key) => {
          try {
            if (change.action === 'add' || change.action === 'update') {
              const node = nodes.get(key);
              if (node) {
                console.log(`[Yjs Observer] ${change.action} node:`, key, node);
                state.nodes.set(key, node);
              } else {
                console.warn(`[Yjs Observer] ${change.action} action but node not found in Yjs:`, key);
              }
            } else if (change.action === 'delete') {
              console.warn('[Yjs Observer] DELETE action detected for node:', key);
              console.trace('[Yjs Observer] Delete stack trace');
              state.nodes.delete(key);
            }
          } catch (err) {
            if (!(err instanceof TypeError && err.message.includes('revoked'))) {
              console.error(`[Yjs Observer] Error processing node ${key}:`, err);
            }
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

### Step 3: Apply Same Pattern to Connections Observer
Replace lines 261-275 with same error handling pattern

### Step 4: Test
```bash
npm run dev
# Open browser
# Enable React Strict Mode (should already be on in dev)
# Try adding/deleting nodes
# Watch console - no "illegal operation" errors should appear
```

### Step 5: Type Check
```bash
cd frontend
npm run type-check
```

### Step 6: Commit
```bash
git add frontend/src/stores/workspace.ts
git commit -m "Fix: Add error handling to Yjs observers for revoked proxy errors"
```

---

## How to Know If It's Working

### Signs of Success ✅
- No "illegal operation attempted on a revoked proxy" errors in console
- Nodes add/delete without disappearing mysteriously
- Yjs sync works correctly with Strict Mode enabled
- React DevTools shows stable component state

### Signs of Failure ❌
- Console shows "illegal operation" errors
- Nodes disappear after operations
- State mismatch between local and Yjs
- Console errors during React Strict Mode double-render

---

## Code Locations to Change

**File**: `/frontend/src/stores/workspace.ts`

| Section | Lines | Issue | Fix |
|---------|-------|-------|-----|
| Nodes Observer | 231-258 | No error handling | Add try-catch |
| Connections Observer | 261-275 | No error handling | Add try-catch |
| Viewport Observer | 278-286 | Safer (primitives) | Add try-catch anyway |
| updateNode | 527-553 | ✅ Has error handling | No change |
| deleteNode | 555-585 | ✅ Has error handling | No change |
| setNodes | 587-609 | ✅ Has error handling | No change |

---

## Performance Impact

- **Option 1** (minimal): Negligible - just adds catch blocks
- **Option 2** (stabilize): Small - adds JSON parse/stringify (fast for small objects)
- **Option 3** (skip invalid): Minimal - just adds a guard clause

**Recommendation**: Option 1 for quick fix, Option 2 for long-term stability

---

## Related Code That Already Has Fixes

These action creators already have proper error handling (✅ Good Example):

```typescript
updateNode: (id, updates) =>
  set(state => {
    // ... local state update ...

    // ALSO update Yjs for real-time sync (if available)
    // Wrap in try-catch to handle revoked proxies (React Strict Mode in dev)
    if (state.yjsDoc && state.yjsNodes) {
      try {  // ✅ Error handling present
        state.yjsDoc.transact(() => {
          const existing = state.yjsNodes!.get(id);
          if (existing) {
            state.yjsNodes!.set(id, { ...existing, ...updates });
          }
        });
      } catch (error) {
        // Silently ignore revoked proxy errors in development
        if (!(error instanceof TypeError && error.message.includes('revoked'))) {
          console.error('[updateNode] Yjs error:', error);
        }
      }
    }
  }),
```

**The observers need the same pattern.**

---

## Summary

1. **Problem**: Observers access revoked proxies without error handling
2. **Cause**: React Strict Mode double-renders + Yjs proxy lifecycle
3. **Symptom**: "illegal operation attempted on a revoked proxy" errors
4. **Impact**: Silent node deletions, state corruption
5. **Solution**: Wrap observer callbacks in try-catch (like action creators already do)
6. **Effort**: 10-15 minutes to implement, 5 minutes to test
7. **Risk**: Low - just adding error handling, no logic changes

**Recommendation**: Implement immediately, test with React Strict Mode.
