# Revoked Proxy Error: Root Cause & Solution Summary

**Error**: `TypeError: illegal operation attempted on a revoked proxy`
**File**: `/frontend/src/stores/workspace.ts` (lines 231-286)
**Status**: Critical (partial mitigation exists)
**Date Identified**: November 27, 2025

---

## The Core Problem (1 Paragraph)

The Yjs observer callbacks (lines 231-258 for nodes, 261-275 for connections) try to access proxy objects without error handling. When React's Strict Mode double-renders or Yjs destroys proxies, accessing them with `nodes.get(key)` throws "illegal operation attempted on a revoked proxy". Because there's no try-catch, the observer crashes and nodes get deleted from state before the error is caught. This causes **silent data loss**.

---

## Smoking Gun: Why Nodes Are Deleted

### The Code Path That Deletes Nodes

```typescript
nodes.observe(event => {
  set(state => {
    event.changes.keys.forEach((change, key) => {
      // ... earlier code ...
      if (change.action === 'add' || change.action === 'update') {
        const node = nodes.get(key);  // ← Line 244: CAN THROW HERE
        if (node) {
          state.nodes.set(key, node);
        }
      } else if (change.action === 'delete') {
        state.nodes.delete(key);      // ← Line 254: DELETE HAPPENS
      }
    });
  });
});
```

### What Happens on Revoked Proxy

1. **Observer fires** with a batch of changes (mix of add/update/delete)
2. **foreach loop processes** changes in order
3. **Access to nodes.get(key)** for an ADD/UPDATE throws "revoked proxy" error
4. **Error bubbles up** - no try-catch to catch it
5. **forEach loop exits early** - subsequent items not processed
6. **But DELETE items that came BEFORE the error are already executed**
7. **Result**: Some nodes deleted, some not - STATE CORRUPTION

### Example Sequence

```
Observer sees changes:
  1. ADD node_A
  2. UPDATE node_B
  3. DELETE node_C
  4. ADD node_D

Execution:
  1. ADD node_A ✓ (works fine)
  2. UPDATE node_B ✓ (works fine)
  3. DELETE node_C ✓ (nodes.delete(key) executes)
  4. ADD node_D ✗ (nodes.get('D') throws revoked proxy)
     → Error thrown
     → forEach exits
     → node_C is permanently deleted
     → node_D never added
```

**Result**: Node mysteriously deleted with no clear reason.

---

## Why It Only Shows in Development

### React Strict Mode Triggers Proxy Revocation

In development, React's StrictMode **intentionally unmounts and remounts components** to detect bugs:

1. Component renders normally
2. React unmounts component (Yjs providers destroyed)
3. **Yjs proxies are revoked** during destruction
4. React remounts component
5. Observer callback fires **with revoked proxies**
6. Error occurs

This **doesn't happen in production** (Strict Mode disabled) but creates **undefined behavior** if the bug is hidden.

---

## Why It's Hard to Debug

### The Error Is Silent

```typescript
nodes.observe(event => {
  set(state => {
    event.changes.keys.forEach((change, key) => {
      const node = nodes.get(key);  // ← Error thrown here
      // ... rest of code never executes ...
    });
  });
});
```

**No try-catch** means:
- ❌ Error logs to console (might not be visible in all environments)
- ❌ Execution stops mid-way through processing
- ❌ State partially updates (some deletes, some not)
- ❌ No indication which node caused the problem
- ❌ Looks like random data loss

---

## The Fix (Conceptual)

### What's Already Protected (✅)

Action creators have proper error handling:

```typescript
updateNode: (id, updates) =>
  set(state => {
    // ... code ...
    if (state.yjsDoc && state.yjsNodes) {
      try {  // ← ERROR HANDLING EXISTS
        state.yjsDoc.transact(() => {
          const existing = state.yjsNodes!.get(id);
          if (existing) {
            state.yjsNodes!.set(id, { ...existing, ...updates });
          }
        });
      } catch (error) {  // ← CATCHES REVOKED PROXY ERRORS
        if (!(error instanceof TypeError && error.message.includes('revoked'))) {
          console.error('[updateNode] Yjs error:', error);
        }
      }
    }
  }),
```

### What Needs Protection (❌)

Observers don't have error handling:

```typescript
nodes.observe(event => {  // ← NO TRY-CATCH
  set(state => {  // ← NO TRY-CATCH
    event.changes.keys.forEach((change, key) => {  // ← NO TRY-CATCH
      const node = nodes.get(key);  // ← CAN THROW
      // ...
    });
  });
});
```

### The Solution

Copy the error handling pattern from action creators to observers:

```typescript
nodes.observe(event => {
  try {  // ← ADD THIS
    set(state => {
      try {  // ← ADD THIS
        event.changes.keys.forEach((change, key) => {
          try {  // ← ADD THIS
            const node = nodes.get(key);
            // ... rest of code ...
          } catch (error) {  // ← ADD THIS
            if (!(error instanceof TypeError && error.message.includes('revoked'))) {
              console.error(`[Yjs Observer] Error on node ${key}:`, error);
            }
          }
        });
      } catch (error) {  // ← ADD THIS
        if (!(error instanceof TypeError && error.message.includes('revoked'))) {
          console.error('[Yjs Observer] Error in set() callback:', error);
        }
      }
    });
  } catch (error) {  // ← ADD THIS
    if (!(error instanceof TypeError && error.message.includes('revoked'))) {
      console.error('[Yjs Observer] Observer error:', error);
    }
  }
});
```

---

## Why This Pattern Works

### 3-Layer Error Handling

1. **Outermost try-catch** (observer function)
   - Prevents observer from crashing
   - Continues processing next event

2. **Middle try-catch** (set callback)
   - Prevents state update from failing
   - Ensures state remains consistent

3. **Innermost try-catch** (per-item)
   - Allows other items to process even if one fails
   - Prevents cascading deletions

### Filtering Revoked Proxy Errors

```typescript
if (!(err instanceof TypeError && err.message.includes('revoked'))) {
  console.error('[...] Error:', err);
}
```

- ✅ Silently ignores revoked proxy errors (expected in React Strict Mode)
- ✅ Still logs real errors (actual bugs)
- ✅ Prevents noise in development logs
- ✅ Matches pattern in action creators

---

## Impact Assessment

### Current State (BROKEN)
- ❌ Observers crash on revoked proxies
- ❌ Partial state updates (nodes deleted before error caught)
- ❌ Silent data loss (no clear error message)
- ❌ Affects all three observers (nodes, connections, viewport)
- ⚠️ Only visible in React Strict Mode (dev only)

### After Fix (SAFE)
- ✅ Observers gracefully handle revoked proxies
- ✅ State updates fully process or fully fail
- ✅ Clear error messages for real bugs
- ✅ Yjs sync works reliably
- ✅ Production unaffected (Strict Mode only in dev)

---

## Files Involved

### Primary File (Needs Changes)
- **`/frontend/src/stores/workspace.ts`**
  - Lines 231-258: Nodes observer
  - Lines 261-275: Connections observer
  - Lines 278-286: Viewport observer

### Reference Files (Already Correct)
- **`/frontend/src/stores/workspace.ts`** (lines 527-609)
  - updateNode, deleteNode, setNodes already have error handling
  - Shows the pattern to copy to observers

### Test Files
- **`/frontend/src/components/workspace/WorkspaceCanvas.tsx`**
  - Component that uses the store
  - Re-renders during testing

---

## How to Verify the Fix

### Before Fix (See Errors)
```bash
npm run dev
# In browser console, enable verbose logging
# Add/delete nodes rapidly
# Look for: "illegal operation attempted on a revoked proxy"
# Observe: Nodes mysteriously disappear
```

### After Fix (No Errors)
```bash
npm run dev
# In browser console
# Add/delete nodes rapidly
# Look for: (no "illegal operation" errors)
# Observe: Nodes persist correctly
# May see: "[Yjs Observer] ... Proxy revoked" messages (debug level, expected)
```

---

## Related Commits

- **369b624**: Initial revoked proxy fix attempt (added error handling to action creators only)
  - ✅ Fixed updateNode, deleteNode, setNodes
  - ❌ Missed the observers

- **698f419**: Update both local state and Yjs for immediate UI updates
  - Related work on state synchronization

---

## Technical Details

### Why Proxies Get Revoked

**Yjs proxies are only valid during**:
1. The transaction that created them
2. The lifecycle of their parent object
3. The observer callback (if accessed immediately)

**Proxies become revoked when**:
1. Parent object is deleted
2. Observer is unsubscribed
3. Yjs document is destroyed
4. React Strict Mode unmounts/remounts components
5. A different observer modifies the object

### Why `.get(key)` Throws But `.delete(key)` Doesn't

- `.get(key)`: Returns a proxy object - **fails if proxy is revoked**
- `.delete(key)`: Only needs the key - **doesn't access the object itself**

This is why some operations execute before the error stops the loop.

---

## Lessons for Future Development

### Pattern to Follow

```typescript
// When working with Yjs proxies in callbacks:
try {
  const item = yjsMap.get(key);  // Proxy access can throw
  if (item) {
    // Use the item safely
  }
} catch (error) {
  if (!(error instanceof TypeError && error.message.includes('revoked'))) {
    console.error('Real error:', error);
  }
  // Continue processing other items
}
```

### Anti-Pattern to Avoid

```typescript
// ❌ DON'T DO THIS:
event.changes.keys.forEach((change, key) => {
  const item = yjsMap.get(key);  // Can throw!
  // ...
});
```

### Best Practice

```typescript
// ✅ DO THIS:
// 1. Add error handling
// 2. Wrap at multiple levels (observer → callback → item)
// 3. Filter revoked proxy errors
// 4. Log real errors
```

---

## Summary

| Aspect | Details |
|--------|---------|
| **Error** | "illegal operation attempted on a revoked proxy" |
| **Location** | Lines 231-286 in `/frontend/src/stores/workspace.ts` |
| **Root Cause** | Observers access proxies without error handling |
| **Trigger** | React Strict Mode, rapid node operations |
| **Impact** | Silent node deletions, state corruption |
| **Scope** | Development only (Strict Mode), but affects reliability |
| **Fix Complexity** | Low (copy existing pattern from action creators) |
| **Fix Size** | Add ~50 lines of error handling |
| **Testing** | npm run dev + browser testing with Strict Mode |
| **Risk** | Low (no logic changes, only error handling) |
| **Time to Fix** | 15-20 minutes implementation + 5-10 minutes testing |

---

## Next Steps

1. **Review** these analysis documents
2. **Apply** the fixes from `EXACT_FIXES_NEEDED.md`
3. **Test** with `npm run dev`
4. **Verify** with React Strict Mode double-renders
5. **Commit** with message: "Fix: Add error handling to Yjs observers for revoked proxy errors"

**The fix is straightforward: add try-catch blocks that already exist in action creators to the observers.**
