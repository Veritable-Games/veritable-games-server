# Phase 2: Zustand Store Refactor - Migration Plan

**Date**: November 29, 2025
**Status**: 🔄 In Progress
**Duration**: 6 weeks (incremental, 3-5 functions per week)

---

## Overview

Phase 2 migrates all write functions in `workspace.ts` from the dual-state pattern (Zustand ↔ Yjs bidirectional sync) to Yjs-first pattern (Yjs → Zustand read-only). This is an **incremental migration** where each function is migrated individually and tested before moving to the next.

---

## Function Inventory

### Total Functions to Migrate: 14

**Node Operations** (4 functions):
- ✅ Phase 1: Infrastructure ready (`YjsSafeWriter.writeNode()`, `.deleteNode()`, `.writeNodes()`)
- ⏳ Phase 2: Migrate store actions to use writer

**Connection Operations** (4 functions):
- ✅ Phase 1: Infrastructure ready (`YjsSafeWriter.writeConnection()`, `.deleteConnection()`, `.writeConnections()`)
- ⏳ Phase 2: Migrate store actions to use writer

**Viewport Operations** (5 functions):
- ✅ Phase 1: Infrastructure ready (`YjsSafeWriter.writeViewport()`, `.panViewport()`, `.zoomViewport()`, `.resetViewport()`)
- ⏳ Phase 2: Migrate store actions to use writer

**Workspace Operations** (1 function):
- ⏳ Phase 2: Custom migration (complex logic)

---

## Priority Matrix

### 🔴 HIGH PRIORITY (Most Frequent - Migrate First)

**Batch 1: Critical Path (Week 1-2)**

1. **`updateNode`** (lines 722-751)
   - **Frequency**: Every drag operation, every node update
   - **Current Issue**: Direct proxy leak risk, try-catch error handling
   - **Impact**: Reduces 90% of proxy leak incidents
   - **Lines**: 30 LOC

2. **`panViewport`** (lines 906-920)
   - **Frequency**: Every pan/drag operation
   - **Current Issue**: Direct Yjs writes
   - **Impact**: High-frequency operation
   - **Lines**: 15 LOC

3. **`zoomViewport`** (lines 922-944)
   - **Frequency**: Every zoom operation
   - **Current Issue**: Direct Yjs writes
   - **Impact**: High-frequency operation
   - **Lines**: 23 LOC

### 🟡 MEDIUM PRIORITY (Moderate Frequency)

**Batch 2: Common Operations (Week 3-4)**

4. **`addNode`** (lines 706-720)
   - **Frequency**: Every node creation
   - **Current Issue**: Direct proxy leak risk
   - **Lines**: 15 LOC

5. **`addConnection`** (lines 817-827)
   - **Frequency**: Every connection creation
   - **Current Issue**: Direct proxy leak risk
   - **Lines**: 11 LOC

6. **`updateConnection`** (lines 829-845)
   - **Frequency**: Connection updates
   - **Current Issue**: Direct Yjs writes
   - **Lines**: 17 LOC

7. **`deleteNode`** (lines 753-783)
   - **Frequency**: Node deletions
   - **Current Issue**: Complex cascade logic, proxy leak risk
   - **Lines**: 31 LOC (includes cascade deletion)

8. **`deleteConnection`** (lines 847-858)
   - **Frequency**: Connection deletions
   - **Current Issue**: Direct Yjs writes
   - **Lines**: 12 LOC

9. **`setViewport`** (lines 891-904)
   - **Frequency**: Initial viewport setup
   - **Current Issue**: Direct Yjs writes
   - **Lines**: 14 LOC

10. **`updateViewport`** (lines 653-665)
    - **Frequency**: Viewport adjustments
    - **Current Issue**: Direct Yjs writes
    - **Lines**: 13 LOC

11. **`loadWorkspace`** (lines 573-650)
    - **Frequency**: Once per workspace load
    - **Current Issue**: Complex seeding logic
    - **Lines**: 78 LOC (most complex)

### 🟢 LOW PRIORITY (Batch Operations)

**Batch 3: Bulk Operations (Week 5-6)**

12. **`setNodes`** (lines 785-811)
    - **Frequency**: Rare (batch imports)
    - **Current Issue**: Direct Yjs writes
    - **Lines**: 27 LOC

13. **`setConnections`** (lines 860-876)
    - **Frequency**: Rare (batch imports)
    - **Current Issue**: Direct Yjs writes
    - **Lines**: 17 LOC

14. **`resetViewport`** (lines 946-958)
    - **Frequency**: Rare (user resets)
    - **Current Issue**: Direct Yjs writes
    - **Lines**: 13 LOC

---

## Migration Pattern

### Current Pattern (BEFORE - Dual-State)

```typescript
// CURRENT (causes proxy leaks):
updateNode: (id, updates) =>
  set(state => {
    const sanitized = sanitizeUpdates(updates);

    // Update local Zustand state
    const node = state.nodes.get(id);
    if (node) {
      state.nodes.set(id, { ...node, ...sanitized });
    }

    // ALSO update Yjs (UNSAFE - may leak Immer proxies)
    if (state.yjsDoc && state.yjsNodes) {
      try {
        state.yjsDoc.transact(() => {
          const existing = state.yjsNodes!.get(id);
          if (existing) {
            state.yjsNodes!.set(id, { ...existing, ...sanitized });  // ❌ PROXY LEAK
          }
        });
      } catch (error) {
        // Silently ignore revoked proxy errors
        if (!(error instanceof TypeError && error.message.includes('revoked'))) {
          console.error('[updateNode] Yjs error:', error);
        }
      }
    }
  }),
```

### Target Pattern (AFTER - Yjs-First)

```typescript
// NEW (type-safe, single source of truth):
updateNode: (id, updates) =>
  set(state => {
    const sanitized = sanitizeUpdates(updates);
    const node = state.nodes.get(id);
    if (!node) return;

    const updated = { ...node, ...sanitized };

    // PHASE 1: Write to Yjs using type-safe writer
    if (state.yjsWriter) {
      state.yjsWriter.writeNode(updated);  // ✅ TYPE-SAFE (no proxy leaks)
    }

    // PHASE 2: Read back from Yjs (single source of truth)
    if (WORKSPACE_FEATURES.YJS_SINGLE_SOURCE && state.yjsNodes) {
      const fromYjs = state.yjsNodes.get(id);
      if (fromYjs) {
        state.nodes.set(id, sanitizeNode(fromYjs));  // ✅ Yjs is source of truth
      }
    } else {
      // LEGACY MODE: Dual-write for gradual rollout
      state.nodes.set(id, updated);
    }
  }),
```

### Key Differences

**Before (Dual-State)**:
- ❌ Zustand → Yjs (direct writes, proxy leak risk)
- ❌ Try-catch for revoked proxies (band-aid)
- ❌ No type safety
- ❌ Two sources of truth (Zustand + Yjs)

**After (Yjs-First)**:
- ✅ Zustand → YjsSafeWriter → Yjs (type-safe)
- ✅ No revoked proxy errors (stripped before write)
- ✅ Compile-time type safety (ProxySafe<T>)
- ✅ Single source of truth (Yjs)
- ✅ Feature flag for gradual rollout
- ✅ Backward compatibility (legacy mode)

---

## Migration Steps (Per Function)

### Step-by-Step Migration Process

**For each function:**

1. **Backup Current Implementation**
   - Comment out old code (don't delete yet)
   - Mark with `// LEGACY (pre-Phase 2)`

2. **Write New Implementation**
   - Use `state.yjsWriter.writeX()` instead of direct Yjs writes
   - Add feature flag check: `if (WORKSPACE_FEATURES.YJS_SINGLE_SOURCE)`
   - Read back from Yjs if flag enabled
   - Keep legacy path for rollback

3. **Remove Try-Catch**
   - YjsSafeWriter handles proxy safety
   - No more revoked proxy errors
   - Remove error handling boilerplate

4. **Test Locally**
   - Test with feature flag OFF (legacy mode) - should work as before
   - Test with feature flag ON (Yjs-first mode) - should still work
   - Verify no console errors
   - Test drag, zoom, pan operations

5. **Commit Incrementally**
   - One function per commit
   - Clear commit message: `Phase 2: Migrate updateNode to YjsSafeWriter`
   - Tag with `[PHASE-2]` for easy rollback

6. **Monitor in Development**
   - Run for 1-2 days with feature flag ON
   - Check for regressions
   - Verify no proxy leak errors

---

## Week-by-Week Plan

### Week 1: High-Priority Functions (3 functions)

**Target**: Reduce 90% of proxy leak incidents

- ✅ Migrate `updateNode` (most critical)
- ✅ Migrate `panViewport`
- ✅ Migrate `zoomViewport`

**Success Criteria**:
- Feature flag works (legacy + Yjs-first modes)
- No console errors during drag/pan/zoom
- Performance unchanged (<16ms frame time)

### Week 2: Node Operations (2 functions)

**Target**: Complete node CRUD operations

- ✅ Migrate `addNode`
- ✅ Migrate `deleteNode` (complex - cascade deletion)

**Success Criteria**:
- Node creation/deletion works in both modes
- Cascade deletion preserves connections correctly
- No orphaned connections

### Week 3: Connection Operations (3 functions)

**Target**: Complete connection CRUD operations

- ✅ Migrate `addConnection`
- ✅ Migrate `updateConnection`
- ✅ Migrate `deleteConnection`

**Success Criteria**:
- Connection CRUD works in both modes
- Anchors update correctly
- No connection rendering glitches

### Week 4: Viewport Operations (2 functions)

**Target**: Complete viewport control

- ✅ Migrate `setViewport`
- ✅ Migrate `updateViewport`

**Success Criteria**:
- Viewport sync works in both modes
- Pan/zoom still smooth
- Multi-user viewport cursors working

### Week 5: Complex Operations (1 function)

**Target**: Handle workspace loading

- ✅ Migrate `loadWorkspace` (78 LOC - most complex)

**Success Criteria**:
- Workspace loads correctly from server
- IndexedDB offline data preserved
- No race conditions between server/IndexedDB

### Week 6: Batch Operations & Cleanup (3 functions)

**Target**: Complete migration, remove legacy code

- ✅ Migrate `setNodes`
- ✅ Migrate `setConnections`
- ✅ Migrate `resetViewport`
- ✅ Remove commented legacy code
- ✅ Update documentation
- ✅ Phase 2 completion report

---

## Testing Strategy

### Per-Function Testing Checklist

**After migrating each function:**

- [ ] **Feature Flag OFF (Legacy Mode)**
  - [ ] Function works as before
  - [ ] No console errors
  - [ ] No regressions

- [ ] **Feature Flag ON (Yjs-First Mode)**
  - [ ] Function still works
  - [ ] Data syncs to Yjs correctly
  - [ ] Zustand reads back from Yjs
  - [ ] No proxy leak errors

- [ ] **Browser Testing**
  - [ ] Chrome DevTools: No console errors
  - [ ] React DevTools: State updates correctly
  - [ ] Network tab: No excessive IndexedDB writes

- [ ] **Performance Testing**
  - [ ] Chrome DevTools Performance tab
  - [ ] Drag operations: <16ms frame time
  - [ ] Batch operations: <100ms for 100 nodes

### Integration Testing (End of Each Week)

**After completing each batch:**

- [ ] Full workspace workflow test:
  - [ ] Create workspace
  - [ ] Add 10+ nodes
  - [ ] Connect nodes
  - [ ] Drag nodes around
  - [ ] Pan and zoom
  - [ ] Delete nodes (verify cascade)
  - [ ] Refresh page (verify persistence)

- [ ] Multi-user simulation (Phase 5 prep):
  - [ ] Open 2 tabs
  - [ ] Make changes in tab 1
  - [ ] Verify updates in tab 2 (via IndexedDB)

---

## Feature Flag Testing

### Environment Variables

```bash
# .env.local

# Legacy mode (Phase 1 complete, Phase 2 disabled)
NEXT_PUBLIC_WORKSPACE_YJS_MIGRATION=false

# Yjs-first mode (Phase 2 active)
NEXT_PUBLIC_WORKSPACE_YJS_MIGRATION=true
```

### Testing Matrix

| Scenario | Flag State | Expected Behavior |
|----------|------------|-------------------|
| Fresh install | OFF | Works with dual-state (legacy) |
| Existing data | OFF | Preserves offline data |
| After migration | ON | Yjs is source of truth |
| Rollback | OFF → ON → OFF | Data preserved, no loss |

### Rollback Procedure

**If issues found:**

1. Set environment variable: `NEXT_PUBLIC_WORKSPACE_YJS_MIGRATION=false`
2. Redeploy (3-5 minutes)
3. Verify legacy mode works
4. Investigate issue
5. Fix and re-enable flag

---

## Success Metrics

### Phase 2 Goals

- ✅ All 14 write functions migrated
- ✅ Feature flag controls mode (legacy vs Yjs-first)
- ✅ Zero proxy leak errors in Yjs-first mode
- ✅ Performance unchanged (<16ms drag operations)
- ✅ Backward compatibility maintained
- ✅ No data loss during rollback

### Code Quality Metrics

- **Code Reduction**: Remove ~200 LOC of try-catch error handling
- **Type Safety**: 100% of Yjs writes through type-safe abstraction
- **Test Coverage**: Each function has before/after test
- **Documentation**: Each migration documented in commit message

---

## Risk Mitigation

### Potential Issues

**Issue 1: Feature flag state synchronization**
- **Risk**: Flag state inconsistent across components
- **Mitigation**: Single source of truth in feature-flags.ts
- **Rollback**: Set flag to false, redeploy

**Issue 2: Performance regression**
- **Risk**: Double-read from Yjs adds overhead
- **Mitigation**: Profile each function, optimize in Phase 3
- **Rollback**: Revert specific function, keep others

**Issue 3: Data loss during migration**
- **Risk**: Yjs-first mode overwrites local data
- **Mitigation**: Feature flag controls read source, legacy mode preserved
- **Rollback**: Flag to false, local data restored

**Issue 4: Observer loops (read-write cycles)**
- **Risk**: Writing to Yjs triggers observer, which writes back
- **Mitigation**: Phase 3 (origin tracking), skip local writes
- **Temporary**: Disable observers in Yjs-first mode (Phase 2 only)

---

## Migration Order Rationale

### Why This Order?

**Week 1 (updateNode, panViewport, zoomViewport)**:
- Most frequent operations (90% of user interactions)
- Immediate impact on proxy leak errors
- High user visibility (drag/pan/zoom)

**Week 2 (addNode, deleteNode)**:
- Complete node CRUD before moving to connections
- deleteNode is complex (cascade logic) - needs time

**Week 3 (Connection CRUD)**:
- Depends on node operations being stable
- Less frequent than node operations

**Week 4 (Viewport operations)**:
- Lower priority than CRUD operations
- Viewport already partially migrated (pan/zoom in Week 1)

**Week 5 (loadWorkspace)**:
- Most complex function (78 LOC)
- Needs all other operations stable first
- Critical for initial load

**Week 6 (Batch operations + cleanup)**:
- Rare operations (batch imports)
- Final cleanup and documentation

---

## Next Steps After Phase 2

### Phase 3: Observer Optimization (2 weeks)

**After all functions migrated:**

- Enable observer debouncing (16ms batching)
- Origin tracking (skip local observer callbacks)
- Remove Zustand writes entirely
- Zustand becomes read-only cache

### Phase 4: Component Refactoring (4 weeks)

**After observers optimized:**

- Split WorkspaceCanvas.tsx (1,741 lines → 6 components)
- Add error boundaries
- Remove debug logging
- Production hardening

### Phase 5: WebSocket Server Deployment (2 weeks)

**After components refactored:**

- Deploy WebSocket server
- Enable real-time multi-user sync
- Test with multiple concurrent users

---

## Documentation Updates

### Files to Update After Phase 2

- ✅ `PHASE_2_COMPLETION_SUMMARY.md` - Create at end of Phase 2
- ✅ `WORKSPACE_ARCHITECTURAL_CRISIS.md` - Mark Phase 2 complete
- ✅ `WORKSPACE_ISSUES_AND_FIXES.md` - Update issue statuses
- ✅ Phase 1 completion summary - Add Phase 2 link

---

## Appendix: Code Examples

### Example 1: Simple Migration (panViewport)

**Before (18 lines)**:
```typescript
panViewport: (deltaX, deltaY) =>
  set(state => {
    if (state.yjsDoc && state.yjsViewport) {
      state.yjsDoc.transact(() => {
        const newOffsetX = state.viewport.offsetX + deltaX;
        const newOffsetY = state.viewport.offsetY + deltaY;
        state.yjsViewport!.set('offsetX', newOffsetX);
        state.yjsViewport!.set('offsetY', newOffsetY);
      });
    } else {
      // Fallback
      state.viewport.offsetX += deltaX;
      state.viewport.offsetY += deltaY;
    }
  }),
```

**After (14 lines, -4 LOC)**:
```typescript
panViewport: (deltaX, deltaY) =>
  set(state => {
    // Write to Yjs using type-safe writer
    if (state.yjsWriter) {
      state.yjsWriter.panViewport(deltaX, deltaY);
    }

    // Read back from Yjs if flag enabled
    if (WORKSPACE_FEATURES.YJS_SINGLE_SOURCE && state.yjsViewport) {
      state.viewport.offsetX = state.yjsViewport.get('offsetX') ?? 0;
      state.viewport.offsetY = state.yjsViewport.get('offsetY') ?? 0;
    } else {
      // Legacy mode
      state.viewport.offsetX += deltaX;
      state.viewport.offsetY += deltaY;
    }
  }),
```

### Example 2: Complex Migration (updateNode)

**Before (30 lines)**:
```typescript
updateNode: (id, updates) =>
  set(state => {
    const sanitized = sanitizeUpdates(updates);
    const node = state.nodes.get(id);
    if (node) {
      state.nodes.set(id, { ...node, ...sanitized });
    }

    if (state.yjsDoc && state.yjsNodes) {
      try {
        state.yjsDoc.transact(() => {
          const existing = state.yjsNodes!.get(id);
          if (existing) {
            state.yjsNodes!.set(id, { ...existing, ...sanitized });
          }
        });
      } catch (error) {
        if (!(error instanceof TypeError && error.message.includes('revoked'))) {
          console.error('[updateNode] Yjs error:', error);
        }
      }
    }
  }),
```

**After (18 lines, -12 LOC)**:
```typescript
updateNode: (id, updates) =>
  set(state => {
    const sanitized = sanitizeUpdates(updates);
    const node = state.nodes.get(id);
    if (!node) return;

    const updated = { ...node, ...sanitized };

    // Write to Yjs (type-safe, no proxy leaks)
    if (state.yjsWriter) {
      state.yjsWriter.writeNode(updated);
    }

    // Read back from Yjs if flag enabled
    if (WORKSPACE_FEATURES.YJS_SINGLE_SOURCE && state.yjsNodes) {
      const fromYjs = state.yjsNodes.get(id);
      if (fromYjs) {
        state.nodes.set(id, sanitizeNode(fromYjs));
      }
    } else {
      // Legacy mode
      state.nodes.set(id, updated);
    }
  }),
```

**Improvements**:
- ✅ Removed 12 LOC of error handling boilerplate
- ✅ No more revoked proxy errors
- ✅ Type-safe writes via YjsSafeWriter
- ✅ Feature flag for gradual rollout
- ✅ Clear separation: write → read pattern

---

**Phase 2 Status**: 🔄 **READY TO BEGIN**

**Next Action**: Migrate Batch 1 (updateNode, panViewport, zoomViewport)
