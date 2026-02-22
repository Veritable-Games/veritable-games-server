# Workspace System: Architectural Crisis Report

**Date**: November 28, 2025
**Status**: UNSTABLE - Ongoing debugging session
**Author**: Claude Code (documenting debugging session)

---

## Executive Summary

The workspace infinite canvas system has **fundamental architectural problems** that manifest as a game of whack-a-mole: fixing one bug reveals another, suggesting the issues are systemic rather than isolated.

**This document does NOT claim anything is fixed or production-ready.** It documents what we've learned, what we've tried, and what the underlying architectural issues appear to be.

---

## Session Timeline: What We've Tried

### Round 1: Nodes Disappearing on Click

**Symptom**: Clicking on a node would delete it from the canvas.

**Attempted Fix**: Added `sanitizeNode()` helper to ensure position/size values are numbers, not strings. String concatenation during drag (`"100" + 50 = "10050"`) was causing position corruption.

**Result**: Partially helped, but revealed more issues.

### Round 2: Drag Only Works Once

**Symptoms**:
- Can drag nodes ~1 inch, then canvas freezes
- After moving ANY node, cannot create new nodes
- PUT requests returning 404
- WebSocket connection failing

**Attempted Fixes**:
1. SQL parameter ordering fix in `service.ts` - made parameter indexing explicit
2. Observer cleanup in `workspace.ts` - added `.unobserve()` pattern
3. Fixed stale closure references - changed to use `get().yjsNodes`

**Result**: Some 404 errors may be fixed, but core issues persist.

### Round 3: Edited Nodes Become Corrupted

**Symptoms** (current):
- On fresh page load: ALL operations work
- After editing ANY node (text OR position): that SPECIFIC node becomes corrupted
- Connections can ONLY be drawn between UNEDITED nodes
- Moving a node corrupts it

**Latest Attempted Fix**: Wrapped `continueDrag` Yjs write in `sanitizeNode()` to break Immer draft proxy references.

**Result**: UNKNOWN - just deployed, user reports issues persist.

---

## Fundamental Architectural Problems

### 1. Dual State Management (The Core Problem)

The system maintains the same data in TWO places that must stay synchronized:

```
┌─────────────────────┐     ┌─────────────────────┐
│   Zustand Store     │ ←→  │      Yjs Y.Map      │
│   (state.nodes)     │     │   (state.yjsNodes)  │
│                     │     │                     │
│  - React rendering  │     │  - CRDT sync        │
│  - UI state         │     │  - IndexedDB        │
│  - Immer proxies    │     │  - WebSocket        │
└─────────────────────┘     └─────────────────────┘
           ↓                          ↓
    Components read              Persistence &
    from here                    collaboration
```

**The Problem**: Every operation must update BOTH, and they use incompatible data models:
- Zustand/Immer uses **proxy objects** for immutability
- Yjs requires **plain objects** for serialization

When proxy objects leak into Yjs, they become "revoked" after the Immer transaction, corrupting that data permanently.

### 2. Circular Update Pattern

```
User Action
    ↓
Zustand set() callback
    ↓
Updates state.yjsNodes (Y.Map)
    ↓
Yjs observer fires
    ↓
Observer calls set() to update state.nodes
    ↓
??? (potential infinite loop, race conditions)
```

The observers are supposed to sync Yjs → Zustand, but actions also sync Zustand → Yjs. This bidirectional flow creates:
- Race conditions
- Duplicate updates
- Potential infinite loops (guarded by change detection, but fragile)

### 3. Multiple Uncoordinated Write Paths

Yjs is written to from at least 6 different locations:

| Location | Action | Properly Sanitized? |
|----------|--------|---------------------|
| `initializeYjs` | Initial load from server | Probably |
| `updateNode` | Text edits | Yes (uses `sanitizeUpdates`) |
| `deleteNode` | Node deletion | N/A (delete operation) |
| `setNodes` | Bulk set | Yes (uses `sanitizeNode`) |
| `continueDrag` | Drag position | **JUST FIXED** (was not sanitized) |
| `addConnection` | New connections | Unclear |

Each write path must:
1. Convert Immer drafts to plain objects
2. Ensure numeric values are actually numbers
3. Not corrupt existing data
4. Trigger proper observer updates

**We keep finding paths that aren't properly sanitized.**

### 4. Silent Error Suppression

The codebase has patterns like this:

```typescript
catch (error) {
  // Silently ignore revoked proxy errors in development
  if (!(error instanceof TypeError && error.message.includes('revoked'))) {
    console.error('[updateNode] Yjs error:', error);
  }
}
```

This **hides bugs** instead of fixing them. The revoked proxy errors ARE the bug - silencing them just makes debugging harder.

### 5. No Single Source of Truth

Where is the canonical state?

| Data Location | When It's "Truth" |
|---------------|-------------------|
| PostgreSQL | After page refresh |
| Yjs Y.Map | During real-time editing |
| Zustand store | For React rendering |
| IndexedDB | When offline |

The answer is "it depends," which means:
- Data can diverge between locations
- Operations can succeed in one place and fail in another
- State corruption in one propagates unpredictably

### 6. HTTP and CRDT Conflict

The system makes HTTP calls (`PUT /api/workspace/nodes/[id]`) to persist changes to PostgreSQL, but ALSO persists via:
- Yjs → IndexedDB (offline persistence)
- Yjs → WebSocket → other clients (real-time sync)

When HTTP fails (404 errors), the data is still in Yjs/IndexedDB. This creates divergence:
- Client thinks save succeeded (Yjs has data)
- Server never received update (PostgreSQL doesn't have data)
- Next page refresh loads stale data from PostgreSQL

### 7. WebSocket Server Not Deployed

Real-time collaboration requires a WebSocket server (`npm run ws:server`). In production:
- WebSocket server is NOT running
- Port 3002 is NOT exposed
- Client gets connection errors
- Falls back to "offline mode" silently

Users may think they're collaborating but aren't.

### 8. God Component

`WorkspaceCanvas.tsx` is **1,741 lines** handling:
- Canvas rendering
- Node rendering
- Connection rendering
- Drag and drop
- Mouse events (click, move, up, down)
- Keyboard events
- Multi-selection
- Marquee selection
- Panning
- Zooming
- Right-click menus
- And more...

This violates single-responsibility and makes state flow nearly impossible to trace.

---

## Code Locations of Known Issues

### workspace.ts (Zustand Store)

| Lines | Function | Issue |
|-------|----------|-------|
| 318-361 | `nodesObserver` | Complex observer with silent error handling |
| 704-733 | `updateNode` | Dual writes to both state.nodes and yjsNodes |
| 1104-1125 | `continueDrag` | Just "fixed" but pattern is fragile |
| 496-531 | `destroyYjs` | Observer cleanup added but may be incomplete |

### WorkspaceCanvas.tsx

| Lines | Area | Issue |
|-------|------|-------|
| ~1070-1112 | Drag end handler | Complex interaction with store |
| ~1219-1228 | `handleNodeUpdate` | Multiple state update paths |
| Throughout | Event handlers | Read from refs, store, and props inconsistently |

### service.ts (Backend)

| Lines | Function | Issue |
|-------|----------|-------|
| 325-352 | `updateNode` SQL | Parameter ordering was fragile |
| Various | Error handling | NODE_NOT_FOUND → 404 may mask real issues |

---

## What Would Actually Fix This

### Option A: Single Source of Truth (Recommended)

Make Yjs the ONLY source of truth. Zustand becomes a read-only cache:

```
Yjs Y.Map (source of truth)
    ↓
Observer updates Zustand (read-only cache)
    ↓
React renders from Zustand

User actions:
    ↓
Write ONLY to Yjs
    ↓
Observer propagates to Zustand automatically
```

**Benefits**:
- Eliminates dual-write bugs
- Clear data flow
- No proxy contamination (writes go directly to Yjs)

**Effort**: Major refactor (~2-3 weeks)

### Option B: Remove Yjs Entirely

If real-time collaboration isn't shipping soon, remove the complexity:

```
User Action → Zustand → HTTP → PostgreSQL
                ↓
            React renders
```

**Benefits**:
- Dramatic simplification
- No CRDT complexity
- No proxy issues
- Standard React patterns

**Effort**: Medium refactor (~1-2 weeks)

### Option C: Band-Aid Fixes (Current Approach)

Keep finding and fixing individual issues:
- Add `sanitizeNode()` everywhere
- Add more error handling
- Hope we catch all the cases

**Problems**:
- Endless game of whack-a-mole
- No confidence in stability
- Technical debt compounds

---

## Files Modified This Session

| File | Change | Commit |
|------|--------|--------|
| `frontend/src/stores/workspace.ts` | SQL param fix, observer cleanup | `67dd4f6` |
| `frontend/src/stores/workspace.ts` | sanitizeNode in continueDrag | `5b1b506` |
| `frontend/src/lib/workspace/service.ts` | Added debug logging | `67dd4f6` |

---

## What We Still Don't Know

1. **Are there other write paths that need sanitization?**
   - `addConnection` - unclear if properly sanitized
   - Bulk operations - unclear

2. **Is the observer cleanup actually working?**
   - Added `.unobserve()` but may have edge cases

3. **What happens when HTTP and Yjs diverge?**
   - No reconciliation strategy documented

4. **Why do connections fail on edited nodes specifically?**
   - May be validation checking against corrupted data
   - May be reading from wrong source (Yjs vs Zustand)

5. **What's the actual production state?**
   - WebSocket failing, IndexedDB state, PostgreSQL state may all differ

---

## Recommendations

### Immediate (Stabilization)

1. **Add comprehensive logging** to trace exact data flow during operations
2. **Remove silent error suppression** - let errors surface
3. **Add data integrity checks** - validate node structure before/after operations

### Short-term (Architecture)

1. **Decide on single source of truth** - either commit to Yjs or remove it
2. **Extract state logic from WorkspaceCanvas** - separate concerns
3. **Add integration tests** - test actual user workflows, not just units

### Long-term (If Keeping Yjs)

1. **Major refactor** to make Yjs the sole source of truth
2. **Deploy WebSocket server** or remove collaboration features
3. **Add conflict resolution** for HTTP/Yjs divergence

---

## Conclusion

The workspace system has **architectural problems that cannot be fully solved with targeted fixes**. Each fix reveals another issue because the fundamental design creates opportunities for state divergence, proxy contamination, and race conditions.

A decision needs to be made:
1. **Invest in proper architecture** (2-3 weeks) to make the system reliable
2. **Simplify by removing Yjs** (1-2 weeks) if collaboration isn't needed soon
3. **Accept instability** and continue band-aid fixes

The current approach of incremental fixes is not converging toward stability.

---

*This document will be updated as debugging continues.*
