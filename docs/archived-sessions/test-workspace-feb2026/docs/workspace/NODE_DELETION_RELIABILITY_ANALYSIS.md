# Node Deletion Reliability Analysis
**Date**: February 15, 2026
**Issue**: Marquee selection + Delete is more reliable than Click + Delete

## Problem Statement

Users report that deleting nodes via marquee selection (box select) is more reliable than clicking nodes and pressing Delete. This document analyzes the difference in behavior and identifies the root cause.

---

## Deletion Workflow Comparison

### Path 1: Click-and-Delete (Less Reliable)

1. **User clicks on a node**
   - File: `TextNode.tsx:276-288` (`handleClick`)
   - Calls: `onSelect(e.shiftKey || e.metaKey || e.ctrlKey)`

2. **Selection handler is invoked**
   - File: `WorkspaceCanvas.tsx:2046-2060` (`handleNodeSelect`)
   - Logic:
     ```typescript
     if (multi) {
       // Toggle or add to existing selection
       setSelectedNodes([...current, nodeId]);
     } else {
       // Replace selection with this node
       setSelectedNodes([nodeId]);
     }
     ```
   - **Key**: Adds `nodeId` to `selectedNodeIds` in Zustand store

3. **User presses Delete key**
   - File: `WorkspaceCanvas.tsx:808-833` (keyboard handler)
   - Reads: `selectedNodeIds` from Zustand store
   - Logic:
     ```typescript
     const nodeIdsToDelete = Array.from(selectedNodeIds);
     clearSelection();
     confirmedDeleteMultiple(nodeIdsToDelete);
     ```

4. **Confirmed delete executes**
   - File: `useConfirmedDelete.ts:126-194` (`confirmedDeleteMultiple`)
   - For each node ID:
     - Calls: `DELETE /api/workspace/nodes/${nodeId}`
     - If server returns 404/error: Logs error, continues to next node
     - If server returns 200: Calls `deleteNode(nodeId)` to remove from Yjs/Zustand

**Problem**: If `selectedNodeIds` contains ghost node IDs (nodes that were deleted remotely via Yjs, or removed by undo), the API will return 404 and the delete silently fails.

---

### Path 2: Marquee-and-Delete (More Reliable)

1. **User drags marquee selection box**
   - File: `input-handler.ts:320-331` (marquee drag initiation)
   - File: `input-handler.ts:469-477` (marquee drag end)
   - Calls: `onSelectionBoxEnd(start, end, modifiers)`

2. **Marquee selection handler is invoked**
   - File: `WorkspaceCanvas.tsx:1225-1295` (`handleMarqueeSelectionEnd`)
   - **CRITICAL LINE 1249**: `const currentNodes = nodesRef.current;`
   - Logic:
     ```typescript
     // Convert screen coords to canvas coords
     const canvasStart = transformManager.screenToCanvas(start.x, start.y);
     const canvasEnd = transformManager.screenToCanvas(end.x, end.y);

     // Get nodes within bounds using LATEST Yjs data
     const selectedNodes = viewportCuller.getNodesInSelectionPartial(
       nodesRef.current,  // ← Always uses fresh Yjs data!
       bounds.minX, bounds.minY, bounds.maxX, bounds.maxY
     );

     // Extract IDs from actual existing nodes
     const newNodeIds = new Set(selectedNodes.map(node => node.id));
     setSelectedNodes(Array.from(newNodeIds));
     ```

3. **User presses Delete key**
   - Same as Path 1, steps 3-4
   - But `selectedNodeIds` is guaranteed to contain only IDs of nodes that **actually exist** in Yjs

---

## Root Cause Analysis

### The Critical Difference: `nodesRef.current` vs `selectedNodeIds`

**Marquee selection** uses `nodesRef.current` to validate nodes exist at selection time:
```typescript
// WorkspaceCanvas.tsx:269-270
const nodesRef = useRef(nodes);
nodesRef.current = nodes; // Update on every render
```

**Comment at line 267-268**:
```typescript
// CRITICAL: Store nodes in a ref so InputHandler callbacks can access the LATEST nodes
// Without this, callbacks capture stale Zustand nodes after Yjs updates
```

**Click selection** directly adds `nodeId` to `selectedNodeIds` without checking if the node still exists in Yjs.

---

### Why This Causes Reliability Issues

**Scenario 1: Remote Deletion**
1. User A clicks node X → selection = [X]
2. User B deletes node X remotely via Yjs
3. Yjs removes X from local `nodes` Map
4. User A's selection still contains X (not cleared)
5. User A presses Delete → API returns 404 → nothing happens

**Scenario 2: Undo After Creation**
1. User creates node Y → Y exists in Yjs
2. User clicks node Y → selection = [Y]
3. User presses Ctrl+Z (undo) → Y is removed from Yjs
4. Selection still contains Y
5. User presses Delete → API returns 404 → nothing happens

**Scenario 3: Race Condition**
1. User clicks node Z → selection = [Z]
2. Before Delete key is pressed, Z is deleted by another process (timed release, admin action, etc.)
3. User presses Delete → API returns 404 → nothing happens

---

## Why Marquee Selection Works Better

When using marquee selection:
1. Selection happens at **T1** (end of drag)
2. `getNodesInSelectionPartial()` queries `nodesRef.current` which contains **only nodes that exist at T1**
3. Ghost node IDs are never added to selection
4. Delete at **T2** operates on a clean set of valid node IDs

---

## Current Delete Flow (Server-Confirmed Pattern)

```
┌─────────────────────────────────────────────────────┐
│ useConfirmedDelete Hook                             │
├─────────────────────────────────────────────────────┤
│                                                      │
│  For each nodeId in selectedNodeIds:                │
│    1. DELETE /api/workspace/nodes/${nodeId}         │
│    2. Wait for server response                      │
│    3a. If 200 OK:                                   │
│        → deleteNode(nodeId)  [Remove from Yjs]      │
│    3b. If 404/error:                                │
│        → Log error, continue to next node           │
│        → Node remains visible (correct!)            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

This is **correct behavior** - failed deletes should not remove nodes from UI. The problem is that ghost node IDs should never be in `selectedNodeIds` in the first place.

---

## Proposed Solutions

### Solution 1: Filter Selection on Delete (Quick Fix)
**Before deleting, validate that all selected node IDs exist in `nodesRef.current`**

```typescript
// WorkspaceCanvas.tsx:808-833 (Delete key handler)
if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeIds.size > 0 && !isTyping) {
  e.preventDefault();

  // Filter out ghost node IDs that no longer exist
  const validNodeIds = Array.from(selectedNodeIds).filter(id =>
    nodesRef.current.has(id)
  );

  if (validNodeIds.length === 0) {
    logger.warn('[Workspace] No valid nodes to delete (all IDs are ghosts)');
    clearSelection();
    return;
  }

  if (validNodeIds.length < selectedNodeIds.size) {
    logger.warn(`[Workspace] Filtered out ${selectedNodeIds.size - validNodeIds.length} ghost node IDs`);
    // Update selection to remove ghost IDs
    setSelectedNodes(validNodeIds);
  }

  clearSelection();
  confirmedDeleteMultiple(validNodeIds);
}
```

**Pros**:
- Quick to implement (~5 lines)
- Fixes the symptom immediately
- Safe (no architectural changes)

**Cons**:
- Doesn't prevent ghost IDs from entering selection
- Band-aid solution

---

### Solution 2: Validate on Click Selection (Better Fix)
**Validate that clicked node exists in `nodesRef.current` before adding to selection**

```typescript
// WorkspaceCanvas.tsx:2046-2060 (handleNodeSelect)
const handleNodeSelect = useCallback(
  (nodeId: string, multi: boolean) => {
    // Validate that node actually exists in Yjs
    if (!nodesRef.current.has(nodeId)) {
      logger.warn(`[Selection] Attempted to select ghost node: ${nodeId}`);
      return; // Ignore selection of non-existent nodes
    }

    if (multi) {
      const current = Array.from(selectedNodeIds).filter(id =>
        nodesRef.current.has(id) // Also clean existing selection
      );
      if (current.includes(nodeId)) {
        setSelectedNodes(current.filter(id => id !== nodeId));
      } else {
        setSelectedNodes([...current, nodeId]);
      }
    } else {
      setSelectedNodes([nodeId]);
    }
  },
  [selectedNodeIds, setSelectedNodes, nodesRef]
);
```

**Pros**:
- Prevents ghost IDs at source
- Cleans existing selection during multi-select
- More architecturally sound

**Cons**:
- Slightly more complex
- Doesn't handle all cases (e.g., nodes deleted after selection)

---

### Solution 3: Clear Selection on Node Deletion (Best Fix)
**Automatically remove deleted node IDs from selection when nodes are removed from Yjs**

Add to Zustand workspace store:
```typescript
// stores/workspace.ts
deleteNode: (nodeId: NodeId) => {
  const state = get();

  // Remove from Yjs
  if (state.yjsNodes) {
    state.yjsNodes.delete(nodeId);
  }

  // Remove from local Map
  const newNodes = new Map(state.nodes);
  newNodes.delete(nodeId);

  // Remove from selection if present
  const newSelection = new Set(state.selectedNodeIds);
  if (newSelection.has(nodeId)) {
    newSelection.delete(nodeId);
    logger.info(`[Workspace] Auto-removed deleted node ${nodeId} from selection`);
  }

  set({
    nodes: newNodes,
    selectedNodeIds: newSelection
  });
}
```

**Pros**:
- Handles all deletion sources (local, remote, undo)
- Keeps selection state consistent with node state
- Most robust solution

**Cons**:
- Requires Zustand store modification
- Needs testing with Yjs collaboration

---

## Recommended Approach

**Implement all three solutions in order**:

1. **Solution 1 (Quick Fix)** - Deploy immediately to stop the bleeding
2. **Solution 2 (Click Validation)** - Add defensive validation at selection time
3. **Solution 3 (Auto-Clear)** - Final architectural fix for long-term robustness

This defense-in-depth approach ensures reliability at multiple layers.

---

## Additional Findings

### Why `nodesRef.current` Exists
From `WorkspaceCanvas.tsx:267-270`:
```typescript
// CRITICAL: Store nodes in a ref so InputHandler callbacks can access the LATEST nodes
// Without this, callbacks capture stale Zustand nodes after Yjs updates
const nodesRef = useRef(nodes);
nodesRef.current = nodes; // Update on every render
```

**Problem**: React closures capture state at callback creation time. If `handleMarqueeSelectionEnd` was recreated on every Yjs update, it would cause InputHandler to be destroyed/recreated constantly (performance issue).

**Solution**: Use `nodesRef.current` in callbacks, exclude `nodes` from dependency array (line 1292-1294).

---

### Why Selection Might Contain Ghost IDs

1. **Yjs Updates**: Nodes Map updates don't trigger selection cleanup
2. **Undo/Redo**: May remove nodes without clearing selection
3. **Remote Deletion**: Collaborative deletion doesn't clear local selection
4. **Race Conditions**: Selection set before node deletion completes

---

## Testing Recommendations

### Manual Test Cases

**Test 1: Remote Deletion**
1. Open workspace in two browser tabs (User A, User B)
2. User A: Click node X to select it
3. User B: Delete node X
4. User A: Press Delete key
5. **Expected**: No error, nothing happens (node already gone)
6. **Current**: API returns 404, silent failure

**Test 2: Undo After Selection**
1. Create a new node
2. Click the node to select it
3. Press Ctrl+Z to undo creation
4. Press Delete key
5. **Expected**: No error, nothing happens (node already gone)
6. **Current**: API returns 404, silent failure

**Test 3: Marquee Selection**
1. Create 5 nodes
2. Delete 2 nodes remotely (in another tab)
3. Drag marquee over all 5 node positions
4. Press Delete
5. **Expected**: Only 3 nodes deleted (the ones that exist)
6. **Current**: Works correctly ✅

---

## Conclusion

**Root Cause**: Selection state (`selectedNodeIds`) can contain ghost node IDs when nodes are deleted outside the click-selection flow. Marquee selection doesn't have this issue because it validates against `nodesRef.current` at selection time.

**Impact**: Click-and-delete fails silently when selection contains ghost IDs, causing user frustration.

**Fix Priority**: HIGH - Affects core workspace functionality

**Recommended Solution**: Implement all three defensive layers for maximum reliability.
