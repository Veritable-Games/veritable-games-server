# Visual Explanation: Yjs Revoked Proxy Error

## The Problem in a Diagram

### Current Architecture (BROKEN)

```
┌─────────────────────────────────────────────────────┐
│           React Strict Mode Double-Render          │
│                                                      │
│  1. Mount Component                                │
│     ↓                                              │
│  2. Yjs initialized                               │
│     ↓                                              │
│  3. Observers created (nodes, connections)        │
│     ↓                                              │
│  4. Unmount Component (intentional)               │
│     ↓                                              │
│  5. ❌ Yjs PROXIES REVOKED (destroyed)            │
│     ↓                                              │
│  6. Remount Component                             │
│     ↓                                              │
│  7. Observer callback fires with changes          │
│     ↓                                              │
│  8. ❌ Code tries to access REVOKED proxies       │
│     ↓                                              │
│  9. CRASH: "illegal operation on revoked proxy"   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## State Update Flow (BROKEN - Current)

```
Observer Event Fires
│
├─ nodes.observe(event => {
│  │
│  └─ set(state => {
│     │
│     └─ event.changes.keys.forEach((change, key) => {
│        │
│        ├─ [PROCESS 1] nodes.get(key) ✓ Works
│        │
│        ├─ [PROCESS 2] nodes.get(key) ✓ Works
│        │
│        ├─ [PROCESS 3] state.nodes.delete(key) ✓ EXECUTES
│        │
│        ├─ [PROCESS 4] nodes.get(key) ✗ THROWS ERROR
│        │   → "illegal operation on revoked proxy"
│        │   → No catch block!
│        │   → Execution stops
│        │
│        └─ [PROCESS 5-10] ❌ NEVER EXECUTED
│
│   RESULT: Partial state corruption
│   - Some nodes deleted (3)
│   - Some nodes never added (5-10)
│   - Observer crashed
│   - Data loss
```

---

## The Three Problems Illustrated

### Problem 1: No Observer Error Handling

```
┌─────────────────────────────────────┐
│    nodes.observe(event => {         │
│      // ❌ No try-catch here!       │
│      set(state => {                 │
│        // ...                       │
│        const node = nodes.get(key)  │ ← Can throw!
│        // ...                       │
│      });                            │
│    });                              │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│    nodes.observe(event => {         │
│      try {  ✅ ADD THIS             │
│        set(state => {               │
│          try {  ✅ ADD THIS         │
│            // ...                   │
│            const node = nodes.get() │
│            // ...                   │
│          } catch(e) {  ✅ ADD THIS  │
│            // handle error          │
│          }                          │
│        });                          │
│      } catch(e) {  ✅ ADD THIS      │
│        // handle observer error     │
│      }                              │
│    });                              │
└─────────────────────────────────────┘
```

### Problem 2: Delete Before Error Caught

```
forEach Loop Execution Timeline (BROKEN)
┌─────────────────────────────────────┐
│ Item 1: ADD node_A                 │
│   └─ nodes.get('A') ✓              │
│   └─ state.nodes.set('A', ...) ✓   │
├─────────────────────────────────────┤
│ Item 2: UPDATE node_B               │
│   └─ nodes.get('B') ✓              │
│   └─ state.nodes.set('B', ...) ✓   │
├─────────────────────────────────────┤
│ Item 3: DELETE node_C               │
│   └─ state.nodes.delete('C') ✓ DONE│  ← Already executed!
├─────────────────────────────────────┤
│ Item 4: ADD node_D                  │
│   └─ nodes.get('D') ✗ THROWS        │  ← Error occurs here
│      "illegal operation"            │
│   └─ Loop exits (no catch)          │
├─────────────────────────────────────┤
│ Item 5-10: ❌ NEVER PROCESSED       │  ← But delete already done
└─────────────────────────────────────┘

RESULT: node_C deleted but node_D never added
```

### Problem 3: Inconsistent Error Handling

```
Current Code Pattern
┌──────────────────────────────────┐
│ ACTION CREATORS (✅ Protected)    │
├──────────────────────────────────┤
│ updateNode: (id, updates) =>     │
│   set(state => {                 │
│     if (yjsDoc && yjsNodes) {    │
│       try {  ✅ HAS ERROR         │
│         yjsDoc.transact(() => {  │
│           const existing =       │
│             yjsNodes.get(id)     │
│           yjsNodes.set(id, ...)  │
│         });                      │
│       } catch (error) {  ✅      │
│         if (error includes       │
│             'revoked') {         │
│           // ignore silently     │
│         }                        │
│       }                          │
│     }                            │
│   })                             │
└──────────────────────────────────┘
              vs.
┌──────────────────────────────────┐
│ OBSERVERS (❌ Not Protected)     │
├──────────────────────────────────┤
│ nodes.observe(event => {         │
│   set(state => {  ❌ NO CATCH    │
│     event.changes.keys           │
│       .forEach((change, key) => {│
│         const node =             │
│           nodes.get(key)  ❌     │
│         state.nodes.set(key,     │
│           node)                  │
│       })                         │
│   })                             │
│ })                               │
└──────────────────────────────────┘

INCONSISTENCY: Same pattern, different protection!
```

---

## The Fix Visually

### Before → After

```
BEFORE (Lines 231-258)                AFTER (Lines 231-258)
─────────────────────────            ─────────────────────────

nodes.observe(event => {              nodes.observe(event => {
  set(state => {                        try {
    event.changes.keys                   set(state => {
      .forEach(...) => {                  try {
        const node =                        event.changes.keys
          nodes.get(key)      ❌           .forEach(...) => {
        if (node) {                         try {
          state.nodes.set(                  const node =
            key, node)                       nodes.get(key)
        }                                   if (node) {
      })                                     state.nodes.set(
  })                                         key, node)
})                                         }
                                         } catch(e) {  ✅
                                           // handle
                                         }
                                       })
                                     } catch(e) {  ✅
                                       // handle
                                     }
                                   })
                                 } catch(e) {  ✅
                                   // handle
                                 }
                               })
```

---

## Error Handling Strategy

### Three Levels of Defense

```
┌─────────────────────────────────────────────────────┐
│ Level 3: Observer Callback (Outermost)             │
│ ┌───────────────────────────────────────────────┐  │
│ │ try {                                         │  │
│ │   Level 2: set() Callback (Middle)           │  │
│ │   ┌─────────────────────────────────────┐   │  │
│ │   │ try {                               │   │  │
│ │   │   Level 1: Per-Item (Innermost)    │   │  │
│ │   │   ┌─────────────────────────────┐  │   │  │
│ │   │   │ try {                       │  │   │  │
│ │   │   │   nodes.get(key)  ← Error  │  │   │  │
│ │   │   │ } catch(e) { ... }  ✅     │  │   │  │
│ │   │   └─────────────────────────────┘  │   │  │
│ │   │ } catch(e) { ... }  ✅             │   │  │
│ │   └─────────────────────────────────────┘   │  │
│ │ } catch(e) { ... }  ✅                      │  │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│ ✅ If innermost fails: other items continue       │
│ ✅ If middle fails: state still consistent        │
│ ✅ If outer fails: observer still works           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Error Processing Flow

```
Error Caught
    ↓
Is it a TypeError? ─ NO → Log it (it's a real bug)
    │
   YES
    ↓
Does message include 'revoked'? ─ NO → Log it (real bug)
    │
   YES
    ↓
Silently ignore (expected in React Strict Mode)
```

---

## Timeline: What Happens

### React Strict Mode Trigger

```
NORMAL RENDER (Production)
═════════════════════════════════════════════════
  1. Component mounts
  2. Yjs initialized
  3. Observers created
  4. User interaction (add node)
  5. Observer fires
  6. ✓ Everything works

STRICT MODE RENDER (Development)
═════════════════════════════════════════════════
  1. Component mounts
  2. Yjs initialized
  3. Observers created
  4. React unmounts component (intentional)
  5. Yjs destroyed
     ├─ Proxies revoked  ← THE PROBLEM
     ├─ Observers unsubscribed
     └─ State frozen
  6. React remounts component
  7. Yjs re-initialized
  8. Observers re-created
  9. Observer fires with REVOKED proxies
 10. ✗ Code tries to access revoked proxy
 11. ERROR: "illegal operation on revoked proxy"
```

---

## Visual State Corruption Example

### Before Fix

```
INITIAL STATE
┌────────────────────────┐
│ Nodes:                 │
│ • node_1 (text)        │
│ • node_2 (note)        │
│ • node_3 (image)       │
└────────────────────────┘

OBSERVER PROCESSES CHANGES:
  [ADD node_4]    → state.nodes.set('node_4', ...) ✓
  [UPDATE node_2] → state.nodes.set('node_2', ...) ✓
  [DELETE node_1] → state.nodes.delete('node_1') ✓ DONE
  [ADD node_5]    → nodes.get('node_5') ✗ THROWS ERROR
                     Loop exits, no catch

FINAL STATE (CORRUPTED)
┌────────────────────────┐
│ Nodes:                 │
│ • node_2 (updated) ✓   │
│ • node_3 (unchanged)✓  │
│ • node_4 (added)   ✓   │
│ ❌ node_1 DELETED     │  ← Permanent loss!
│ ❌ node_5 NOT ADDED   │  ← Never created
└────────────────────────┘

USER SEES: "Where did node_1 go?"
```

### After Fix

```
INITIAL STATE
┌────────────────────────┐
│ Nodes:                 │
│ • node_1 (text)        │
│ • node_2 (note)        │
│ • node_3 (image)       │
└────────────────────────┘

OBSERVER PROCESSES CHANGES:
  [ADD node_4]    → state.nodes.set('node_4', ...) ✓
  [UPDATE node_2] → state.nodes.set('node_2', ...) ✓
  [DELETE node_1] → state.nodes.delete('node_1') ✓ DONE
  [ADD node_5]    → nodes.get('node_5') ✗ Caught by try-catch ✓
                     Error silently ignored
                     Loop continues (or breaks gracefully)

FINAL STATE (SAFE)
┌────────────────────────┐
│ Nodes:                 │
│ • node_1 (unchanged)✓  │  ← Preserved!
│ • node_2 (updated) ✓   │
│ • node_3 (unchanged)✓  │
│ • node_4 (added)   ✓   │
│ • node_5 (added)   ✓   │  ← Successfully added or skipped gracefully
└────────────────────────┘

USER SEES: Everything works as expected
```

---

## Code Comparison: Action Creators vs Observers

### What Action Creators Do (✅ Right)

```typescript
updateNode: (id, updates) =>
  set(state => {
    // Local update (always works)
    const node = state.nodes.get(id);
    if (node) {
      state.nodes.set(id, { ...node, ...updates });
    }

    // Yjs update (might fail)
    if (state.yjsDoc && state.yjsNodes) {
      try {  ✅ PROTECTED
        state.yjsDoc.transact(() => {
          const existing = state.yjsNodes!.get(id);
          if (existing) {
            state.yjsNodes!.set(id, { ...existing, ...updates });
          }
        });
      } catch (error) {  ✅ ERROR HANDLING
        if (!(error instanceof TypeError && error.message.includes('revoked'))) {
          console.error('[updateNode] Yjs error:', error);
        }
      }
    }
  }),
```

### What Observers Do (❌ Wrong)

```typescript
nodes.observe(event => {
  set(state => {
    event.changes.keys.forEach((change, key) => {
      if (change.action === 'add' || change.action === 'update') {
        const node = nodes.get(key);  ❌ NO PROTECTION
        if (node) {
          state.nodes.set(key, node);
        }
      } else if (change.action === 'delete') {
        state.nodes.delete(key);  ❌ NO PROTECTION
      }
    });
  });
});
```

### What Observers Should Do (✅ Fixed)

Copy the same error handling pattern from action creators!

---

## Summary Diagram

```
                   Current Status
                  (November 27, 2025)
                        │
         ┌──────────────┼──────────────┐
         │              │              │
    Action Creators  Observers      Observers
    (updateNode,  (nodes, conns)  (viewport)
     deleteNode,     │                │
      setNodes)      │                │
         │           │                │
        ✅           ❌               ❌
    Protected    UNPROTECTED       UNPROTECTED
    with         with             with
    try-catch    NO              NO
              error           error
              handling        handling
                │                │
         Has these issues:  Has these issues:
         ❌ Can throw       ❌ Can throw
         ❌ Crashes         ❌ Crashes
         ❌ Data loss       ❌ Data loss
         ❌ Partial updates ❌ Partial updates
```

---

## How to Read This Document

1. **Start with**: "The Problem in a Diagram" (top section)
2. **Then read**: "The Three Problems Illustrated"
3. **Then understand**: "The Fix Visually"
4. **Finally verify**: "Visual State Corruption Example"

**Key insight**: Error handling exists in action creators but not observers. Copy that pattern to fix observers.
