# Multi-Drag Implementation Plan

## Overview

This document provides a detailed implementation plan to enable dragging multiple selected nodes simultaneously in the workspace canvas.

## Files That Need Changes

1. `frontend/src/lib/workspace/input-handler.ts` - Input tracking
2. `frontend/src/components/workspace/WorkspaceCanvas.tsx` - Drag callbacks and state
3. `frontend/src/lib/workspace/types.ts` - Type definitions (if needed)
4. `frontend/src/components/workspace/TextNode.tsx` - Node selection handling

## Detailed Changes

### Change 1: Update InputHandler Callbacks (input-handler.ts)

**Current Interface**:
```typescript
export interface InputCallbacks {
  onNodeDragStart?: (nodeId: string, canvasPos: Point) => void;
  onNodeDragMove?: (nodeId: string, canvasPos: Point, delta: Point) => void;
  onNodeDragEnd?: (nodeId: string, canvasPos: Point) => void;
  // ... other callbacks
}
```

**Issue**: Single-node only, no way to know if multiple are selected

**Solution**: Add callback parameter to indicate which nodes are selected, or add new callbacks

**Option A - Minimally Invasive** (Recommended):
Keep existing callbacks but have `onNodeDragStart` set state indicating multi-drag started. Caller checks `selectedNodeIds` in `onNodeDragMove`.

**Option B - Cleaner API**:
Replace with:
```typescript
export interface InputCallbacks {
  onNodeDragStart?: (nodeId: string, canvasPos: Point, selectedNodeIds: string[]) => void;
  onNodeDragMove?: (nodeId: string, canvasPos: Point, delta: Point, selectedNodeIds: string[]) => void;
  onNodeDragEnd?: (nodeId: string, canvasPos: Point, selectedNodeIds: string[]) => void;
  // ... other callbacks
}
```

Then in `handleMouseMove` (line 267-274):
```typescript
// BEFORE:
if (this.dragState.target === 'node' && this.dragState.nodeId) {
  const canvasPos = this.transformManager.screenToCanvas(screenX, screenY);
  const canvasDelta = {
    x: deltaX / this.transformManager.getZoom(),
    y: deltaY / this.transformManager.getZoom(),
  };
  this.callbacks.onNodeDragMove?.(this.dragState.nodeId, canvasPos, canvasDelta);
}

// AFTER:
if (this.dragState.target === 'node' && this.dragState.nodeId) {
  const canvasPos = this.transformManager.screenToCanvas(screenX, screenY);
  const canvasDelta = {
    x: deltaX / this.transformManager.getZoom(),
    y: deltaY / this.transformManager.getZoom(),
  };
  // NEW: Get selectedNodeIds from wherever it's stored
  // This requires passing selectedNodeIds to InputHandler or storing it differently
  this.callbacks.onNodeDragMove?.(
    this.dragState.nodeId,
    canvasPos,
    canvasDelta,
    this.dragState.selectedNodeIds || []  // NEW FIELD
  );
}
```

**Implementation Choice**: Use **Option A** (minimally invasive) to avoid breaking API:

In `WorkspaceCanvas.tsx`, track multi-drag state:
```typescript
const [multiDragNodeIds, setMultiDragNodeIds] = useState<Set<string>>(new Set());

// Then in onNodeDragStart callback:
onNodeDragStart: (nodeId, canvasPos) => {
  console.log('Node drag start:', nodeId, canvasPos);
  
  // NEW: Check if dragged node is in selection
  if (selectedNodeIds.has(nodeId)) {
    // Multi-drag: dragging one of the selected nodes
    setMultiDragNodeIds(new Set(selectedNodeIds));
  } else {
    // Single drag: dragging unselected node (shouldn't happen with new logic)
    setMultiDragNodeIds(new Set([nodeId]));
  }
  
  setDraggingNodeId(nodeId);
},
```

### Change 2: Fix Selection Preservation in WorkspaceCanvas (WorkspaceCanvas.tsx)

**Current Code (Line 720-722)**:
```typescript
onNodeClick: (nodeId, event) => {
  console.log('Node clicked:', nodeId);
  setSelectedNodes([nodeId]);  // ← BUG: Clears selection!
},
```

**Issue**: When clicking a node that's already selected, it clears all other selections

**Solution**: Only clear selection if node wasn't already selected
```typescript
onNodeClick: (nodeId, event) => {
  console.log('Node clicked:', nodeId);
  
  // NEW: Preserve selection if clicking already-selected node without modifiers
  if (selectedNodeIds.has(nodeId) && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    // Node was already selected and no modifiers - keep it selected
    console.log('Node already selected, preserving selection');
    return;
  }
  
  // Original logic for unselected nodes or when modifiers are pressed
  setSelectedNodes([nodeId]);
},
```

Wait - this is called AFTER the TextNode's `onSelect` callback, which already handles modifiers. Need to trace the flow:

1. TextNode.handleClick (Line 228-233) calls `onSelect(e.shiftKey || e.metaKey || e.ctrlKey)`
2. TextNode.onSelect passes `multi: boolean` to WorkspaceCanvas.handleNodeSelect (Line 863-874)
3. WorkspaceCanvas.handleNodeSelect updates selectedNodeIds correctly

BUT: InputHandler also has `onNodeClick` callback which fires from input-handler.ts:
- This is AFTER TextNode's click handlers
- This might be clearing the selection

Let me trace this more carefully...

Actually, looking at TextNode (Line 388):
```typescript
onClick={handleClick}
```

Where `handleClick` (Line 228-233) does:
```typescript
const handleClick = useCallback((e: React.MouseEvent) => {
  e.stopPropagation();
  if (!isEditing) {
    onSelect(e.shiftKey || e.metaKey || e.ctrlKey);
  }
}, [isEditing, onSelect]);
```

And `onSelect` is passed as prop (Line 1013 in Canvas):
```typescript
onSelect={(multi) => handleNodeSelect(node.id, multi)}
```

Then `handleNodeSelect` (Line 863-874) correctly preserves selection in multi mode.

But ALSO in InputHandler (Line 310-311):
```typescript
if (!this.dragState.hasMoved) {
  // Click event (no movement)
  if (this.dragState.nodeId) {
    this.callbacks.onNodeClick?.(this.dragState.nodeId, e);  // ← This fires too
```

And WorkspaceCanvas has:
```typescript
onNodeClick: (nodeId, event) => {
  console.log('Node clicked:', nodeId);
  setSelectedNodes([nodeId]);  // ← This OVERWRITES the TextNode selection!
}
```

**So the bug is**: InputHandler calls `onNodeClick` AFTER TextNode already updated selection via `onSelect`.

**Solution**: Remove or fix `onNodeClick` in WorkspaceCanvas, or make it respect existing selections:

```typescript
onNodeClick: (nodeId, event) => {
  console.log('Node clicked:', nodeId);
  
  // This callback fires AFTER TextNode's onClick which already handled selection
  // Only update if we're in a clean click (no modifiers, not editing)
  const target = event.target as HTMLElement;
  const isEditing = editingNodeId === nodeId;
  
  // Skip if already handled by TextNode component
  if ((event as any).ctrlKey || (event as any).metaKey || (event as any).shiftKey) {
    return; // TextNode already handled this
  }
  
  if (isEditing) {
    return; // Don't change selection while editing
  }
  
  // For plain clicks on unselected node, set as only selection
  if (!selectedNodeIds.has(nodeId)) {
    setSelectedNodes([nodeId]);
  }
  // If already selected, keep selection (no change needed)
},
```

Wait, the issue is that `event` here is from InputHandler, not React event. Let me check...

InputHandler passes `e` (MouseEvent), not React event. We lose the modifier key info here!

**Better Solution**: Don't call `onNodeClick` for drag-like interactions. Only call it for pure clicks. But that's not reliable since we check `hasMoved`.

**Best Solution**: Make InputHandler pass modifier keys to callback:

In input-handler.ts, change `onNodeClick`:
```typescript
// Line 310-311
if (!this.dragState.hasMoved) {
  if (this.dragState.nodeId) {
    this.callbacks.onNodeClick?.(
      this.dragState.nodeId,
      e,
      {
        ctrl: this.isCtrlPressed,
        shift: this.isShiftPressed,
        meta: (e as any).metaKey || (e as any).ctrlKey // fallback
      }
    );
  }
}
```

But that requires changing the callback interface. Simpler approach: **Just remove `onNodeClick` entirely** since TextNode is handling it!

The TextNode component already calls `onSelect` which properly updates selection. The InputHandler's `onNodeClick` is redundant and broken.

### Change 3: Update onNodeDragMove in WorkspaceCanvas (WorkspaceCanvas.tsx)

**Current Code (Line 744-756)**:
```typescript
onNodeDragMove: (nodeId, canvasPos, delta) => {
  // Get current node position from store
  const node = useWorkspaceStore.getState().nodes.get(nodeId as string);
  if (!node) return;

  // Move node by delta (incremental movement preserves grab offset)
  useWorkspaceStore.getState().updateNode(unsafeToNodeId(nodeId), {
    position: {
      x: node.position.x + delta.x,
      y: node.position.y + delta.y,
    },
  });
},
```

**Issue**: Only updates the dragged node, ignores other selected nodes

**Solution**: 
```typescript
onNodeDragMove: (nodeId, canvasPos, delta) => {
  const store = useWorkspaceStore.getState();
  
  // NEW: If multiple nodes are being dragged, move them all
  if (multiDragNodeIds.size > 1) {
    // Multi-drag: move all selected nodes by the same delta
    multiDragNodeIds.forEach((id) => {
      const node = store.nodes.get(id as string);
      if (!node) return;
      
      store.updateNode(unsafeToNodeId(id), {
        position: {
          x: node.position.x + delta.x,
          y: node.position.y + delta.y,
        },
      });
    });
  } else {
    // Single drag: original behavior
    const node = store.nodes.get(nodeId as string);
    if (!node) return;

    store.updateNode(unsafeToNodeId(nodeId), {
      position: {
        x: node.position.x + delta.x,
        y: node.position.y + delta.y,
      },
    });
  }
},
```

### Change 4: Update onNodeDragEnd in WorkspaceCanvas (WorkspaceCanvas.tsx)

**Current Code (Line 757-771)**:
```typescript
onNodeDragEnd: (nodeId, canvasPos) => {
  console.log('Node drag end:', nodeId);
  setDraggingNodeId(null);

  // Get final node position from store
  const node = useWorkspaceStore.getState().nodes.get(nodeId as string);
  if (!node) return;

  // Persist actual node position to database (intentional user action)
  fetchWithCSRF(`/api/workspace/nodes/${nodeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position: node.position }),
  }).catch(error => console.error('Failed to save node position:', error));
},
```

**Issue**: Only persists the dragged node, not multi-drag

**Solution**:
```typescript
onNodeDragEnd: (nodeId, canvasPos) => {
  console.log('Node drag end:', nodeId);
  setDraggingNodeId(null);

  const store = useWorkspaceStore.getState();
  
  // NEW: Persist ALL dragged nodes if multi-drag
  if (multiDragNodeIds.size > 1) {
    // Multi-drag: persist all selected nodes
    multiDragNodeIds.forEach((id) => {
      const node = store.nodes.get(id as string);
      if (!node) return;

      fetchWithCSRF(`/api/workspace/nodes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: node.position }),
      }).catch(error => console.error(`Failed to save node ${id} position:`, error));
    });
  } else {
    // Single drag: original behavior
    const node = store.nodes.get(nodeId as string);
    if (!node) return;

    fetchWithCSRF(`/api/workspace/nodes/${nodeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: node.position }),
    }).catch(error => console.error('Failed to save node position:', error));
  }
  
  // Clear multi-drag state
  setMultiDragNodeIds(new Set());
},
```

### Change 5: Add Selection Bounding Box Visualization (Optional but Recommended)

**Location**: `WorkspaceCanvas.tsx` render section

Add visual feedback showing bounding box around selected nodes:

```typescript
/**
 * Calculate bounding box for selected nodes
 */
const getSelectionBounds = useCallback(() => {
  if (selectedNodeIds.size === 0 || selectedNodeIds.size === 1) return null;
  
  const store = useWorkspaceStore.getState();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  selectedNodeIds.forEach((nodeId) => {
    const node = store.nodes.get(nodeId);
    if (node) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + node.size.width);
      maxY = Math.max(maxY, node.position.y + node.size.height);
    }
  });
  
  if (!isFinite(minX)) return null;
  
  return {
    left: minX,
    top: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}, [selectedNodeIds]);

const selectionBounds = getSelectionBounds();
```

Then in render (after TextNode rendering):
```typescript
{/* Selection Bounding Box - Shows when multiple nodes selected */}
{selectionBounds && selectedNodeIds.size > 1 && (
  <div
    className="absolute pointer-events-none border-2 border-blue-400 rounded-lg"
    style={{
      left: `${selectionBounds.left}px`,
      top: `${selectionBounds.top}px`,
      width: `${selectionBounds.width}px`,
      height: `${selectionBounds.height}px`,
      boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.3)',
      zIndex: 10, // Above nodes but below UI
    }}
  />
)}
```

**Note**: This needs to be applied AFTER transforms like the marquee box.

## Summary of Changes

| File | Change | Priority | Lines |
|------|--------|----------|-------|
| WorkspaceCanvas.tsx | Add `multiDragNodeIds` state | HIGH | - |
| WorkspaceCanvas.tsx | Fix `onNodeClick` to not clear selection | HIGH | 720 |
| WorkspaceCanvas.tsx | Update `onNodeDragStart` to set multi-drag state | HIGH | 740 |
| WorkspaceCanvas.tsx | Update `onNodeDragMove` to move all selected | HIGH | 744 |
| WorkspaceCanvas.tsx | Update `onNodeDragEnd` to persist all selected | HIGH | 757 |
| WorkspaceCanvas.tsx | Add selection bounding box rendering | MEDIUM | render |
| input-handler.ts | No changes needed (passes callbacks through) | - | - |
| TextNode.tsx | No changes needed (selection logic correct) | - | - |

## Testing Checklist

After implementation:

- [ ] Select single node, drag it - should move normally
- [ ] Select single node with Ctrl+click, then select another - should have 2 selected
- [ ] Drag one of the selected nodes - should move all 2
- [ ] Select 3+ nodes with marquee, drag - should move all
- [ ] Shift+click to add to selection, drag - should move all
- [ ] Ctrl+click to toggle, drag - should move toggled set
- [ ] Drag node while other node is being edited - should not allow drag
- [ ] Refresh page - positions should persist
- [ ] Multi-drag followed by single-click should preserve selection of that node
- [ ] Selection bounding box should appear around multiple selected nodes
- [ ] Selection bounding box should update as nodes move

## Potential Issues & Mitigations

### Issue 1: Performance with Many Selected Nodes
If user selects 100+ nodes and drags, updating all in state + sending API requests could be slow.

**Mitigation**: 
- Batch updates: Collect all node updates and send one batch PUT request
- Debounce: Only persist every 100ms during drag

### Issue 2: Network Requests
Current code sends one PUT per node on drag end. With 10 selected nodes = 10 requests.

**Mitigation**:
- Create `/api/workspace/nodes/batch` endpoint for bulk updates
- Send: `{ positions: { nodeId1: {x, y}, nodeId2: {x, y}, ... } }`

### Issue 3: Race Conditions
If two nodes are dragged simultaneously in multi-view, could have conflicts.

**Mitigation**:
- Add `updated_at` timestamp field to nodes
- Check timestamp on save, reject if stale
- Or use optimistic locking with version field

## Expected Behavior After Implementation

```
User selects 3 nodes with marquee selection
  ↓
Selection bounding box appears around the 3 nodes
  ↓
User clicks and drags one of the selected nodes
  ↓
All 3 nodes move together maintaining relative positions
  ↓
On mouse up, all 3 node positions are saved to database
  ↓
User can Ctrl+click another node to add to selection
  ↓
Now 4 nodes selected, dragging moves all 4
```

This matches the behavior of professional tools like Figma, Miro, and Excalidraw.
