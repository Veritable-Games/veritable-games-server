# Workspace Multi-Select and Multi-Drag Investigation

## Executive Summary

The workspace implementation has **multi-select capability** but **NO multi-drag support**. Currently:
- Single nodes can be dragged and moved
- Multiple nodes can be selected (via marquee, Ctrl+click, Shift+click)
- **BUG**: When multiple nodes are selected, dragging only moves the individual dragged node, not the entire selection

## Key Findings

### 1. Selection State Management

**File**: `frontend/src/stores/workspace.ts`

**Selected Node Storage**:
```typescript
selectedNodeIds: Set<string>;  // Line 43

setSelectedNodes: (nodeIds) =>
  set((state) => {
    state.selectedNodeIds.clear();
    nodeIds.forEach((id) => state.selectedNodeIds.add(id));
  }),
```

**Good**: Uses `Set<string>` which is efficient for checking membership and prevents duplicates.
**Exposed via**: `useWorkspaceStore()` hook which returns the `selectedNodeIds` Set

### 2. Single Node Drag Handling

**File**: `frontend/src/lib/workspace/input-handler.ts` (Lines 267-274)

```typescript
if (this.dragState.target === 'node' && this.dragState.nodeId) {
  // Dragging a node
  const canvasPos = this.transformManager.screenToCanvas(screenX, screenY);
  const canvasDelta = {
    x: deltaX / this.transformManager.getZoom(),
    y: deltaY / this.transformManager.getZoom(),
  };
  this.callbacks.onNodeDragMove?.(this.dragState.nodeId, canvasPos, canvasDelta);
}
```

**Issues**:
- Only passes `this.dragState.nodeId` (single node)
- Doesn't check if multiple nodes are selected
- No multi-drag delta calculation

### 3. Multi-Drag Bug in Canvas Component

**File**: `frontend/src/components/workspace/WorkspaceCanvas.tsx` (Lines 740-756)

```typescript
onNodeDragStart: (nodeId, canvasPos) => {
  console.log('Node drag start:', nodeId, canvasPos);
  setDraggingNodeId(nodeId);
},
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

**Critical Bug**:
- `onNodeDragMove` ONLY updates the dragged node (`nodeId`)
- Doesn't iterate through `selectedNodeIds` to move all selected nodes
- Multi-select is ignored during drag

### 4. Node Selection in TextNode Component

**File**: `frontend/src/components/workspace/TextNode.tsx` (Lines 228-233, 863-874)

```typescript
const handleNodeSelect = useCallback((nodeId: string, multi: boolean) => {
  if (multi) {
    const current = Array.from(selectedNodeIds);
    if (current.includes(nodeId)) {
      setSelectedNodes(current.filter(id => id !== nodeId));
    } else {
      setSelectedNodes([...current, nodeId]);
    }
  } else {
    setSelectedNodes([nodeId]);
  }
}, [selectedNodeIds, setSelectedNodes]);
```

**Good**: Properly implements Shift/Ctrl for multi-select via `onSelect(e.shiftKey || e.metaKey || e.ctrlKey)`

### 5. Marquee Selection Support

**File**: `frontend/src/components/workspace/WorkspaceCanvas.tsx` (Lines 798-806, 887-935)

Marquee selection EXISTS and properly handles:
- Screen to canvas coordinate conversion
- Modifier keys (Shift for add, Ctrl for toggle)
- Empty selection deselection

```typescript
onSelectionBoxEnd: (start, end, modifiers) => {
  handleMarqueeSelectionEnd(start, end, modifiers);
  setMarqueeBox(null);
},
```

And the handler:
```typescript
const handleMarqueeSelectionEnd = useCallback((
  start: { x: number; y: number },
  end: { x: number; y: number },
  modifiers: { shift: boolean; ctrl: boolean }
) => {
  // ... coordinate conversion ...
  const selectedNodes = viewportCullerRef.current.getNodesInSelection(nodes, bounds);
  const newNodeIds = new Set(selectedNodes.map(node => node.id));

  if (modifiers.shift) {
    // Shift: Add to existing selection (union)
    const updatedSelection = new Set([...selectedNodeIds, ...newNodeIds]);
    setSelectedNodes(Array.from(updatedSelection));
  } else if (modifiers.ctrl) {
    // Ctrl/Cmd: Toggle selection (XOR)
    // ...
  }
}, ...);
```

### 6. Existing Bounding Box Rendering

**File**: `frontend/src/components/workspace/WorkspaceCanvas.tsx` (Lines 1263-1275)

Marquee selection box already renders:
```typescript
{marqueeBox && (
  <div
    className="absolute pointer-events-none border-2 border-dashed border-blue-500 bg-blue-500/10"
    style={{
      left: `${Math.min(marqueeBox.start.x, marqueeBox.end.x)}px`,
      top: `${Math.min(marqueeBox.start.y, marqueeBox.end.y)}px`,
      width: `${Math.abs(marqueeBox.end.x - marqueeBox.start.x)}px`,
      height: `${Math.abs(marqueeBox.end.y - marqueeBox.start.y)}px`,
      zIndex: 9999,
    }}
  />
)}
```

**Note**: This is for marquee selection visualization, not a bounding box around selected nodes.

### 7. Empty Node Filtering

**File**: `frontend/src/components/workspace/viewport-culling.ts` (Lines 102-124)

```typescript
getNodesInSelection(
  nodes: Map<string, CanvasNode>,
  selectionBounds: Bounds
): CanvasNode[] {
  const selected: CanvasNode[] = [];

  for (const node of nodes.values()) {
    if (!node.deleted_at) {
      const nodeBounds = getNodeBounds(node);
      // Node must be fully contained in selection
      if (
        nodeBounds.minX >= selectionBounds.minX &&
        nodeBounds.maxX <= selectionBounds.maxX &&
        nodeBounds.minY >= selectionBounds.minY &&
        nodeBounds.maxY <= selectionBounds.maxY
      ) {
        selected.push(node);
      }
    }
  }

  return selected;
}
```

**Issue**: There is NO filtering to exclude empty nodes. Any node that fits in the marquee is selected, regardless of content.

## Problems Identified

### Problem 1: Multi-Drag Not Implemented
**Severity**: HIGH
**Location**: `WorkspaceCanvas.tsx`, `input-handler.ts`
**Description**: 
- Input handler passes only single `nodeId` to `onNodeDragMove`
- Canvas handler only updates the dragged node, ignoring `selectedNodeIds`
- Need to pass ALL selected nodes' positions and apply delta to each

### Problem 2: No Bounding Box for Selected Nodes
**Severity**: MEDIUM
**Location**: `WorkspaceCanvas.tsx`
**Description**: 
- No visual indication of the selection bounding box around multiple selected nodes
- Only marquee selection shows visual feedback
- User can't see the bounds of their selection

### Problem 3: Empty Node Selection
**Severity**: LOW
**Location**: `viewport-culling.ts`
**Description**: 
- No filter to exclude empty nodes from marquee selection
- Nodes with no content or whitespace are still selected
- May be intentional, but unclear

### Problem 4: Drag State Only Tracks One Node
**Severity**: HIGH
**Location**: `input-handler.ts`
**Description**: 
- `DragState` interface only has single `nodeId` property (Line 52)
- Can't track which nodes are being dragged when multiple are selected
- No way to know if drag is involving selection or single node

```typescript
interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  button: number;
  target: 'canvas' | 'node' | 'marquee';
  nodeId?: string;  // ← Only ONE node
  hasMoved: boolean;
}
```

### Problem 5: No Selection-Aware Drag Initiation
**Severity**: HIGH
**Location**: `WorkspaceCanvas.tsx` (Lines 1013)
**Description**: 
- `onNodeClick` callback doesn't check if node was part of selection
- Dragging an already-selected node clears other selections and starts fresh

```typescript
onNodeClick: (nodeId, event) => {
  console.log('Node clicked:', nodeId);
  setSelectedNodes([nodeId]);  // ← Clears other selections!
},
```

Should instead preserve selection if Shift/Ctrl isn't pressed.

## Implementation Flow Diagram

```
User clicks node with multiple selected
  ↓
InputHandler.handleMouseDown (Line 161-196)
  ├─ Checks if node being edited (skips drag)
  ├─ Detects double-click (enters edit mode)
  └─ Sets dragState with single nodeId
      ↓
  InputHandler.handleMouseMove (Line 233-297)
    ├─ Checks distance > minDragDistance
    └─ Calls onNodeDragStart with single nodeId
        ↓
  WorkspaceCanvas callback (Line 740-742)
    └─ Only tracks which node is dragging
        ↓
  InputHandler continues handleMouseMove
    └─ Calls onNodeDragMove with single nodeId
        ↓
  WorkspaceCanvas callback (Line 744-756)
    ├─ Gets node position from store
    └─ Updates ONLY that node by delta
        ✗ MISSING: Check selectedNodeIds and move all
        ✗ MISSING: Persist multi-node updates to DB
```

## Current Workarounds (None Available)

There are NO workarounds to move multiple nodes at once. Users must:
1. Drag and drop each node individually
2. Or recreate nodes in new positions

## Code Quality Assessment

**Strengths**:
- Selection state properly stored as Set for O(1) lookup
- Marquee selection has proper coordinate conversion
- Individual node drag is smooth with delta-based movement
- Modifier key handling is correct (Shift, Ctrl, Meta)

**Weaknesses**:
- Multi-drag completely unimplemented
- Drag state only tracks single node
- No callback to indicate "dragging selection"
- DB persistence only handles single node saves
- Visual feedback incomplete (no selection bounding box)

## Required Fixes

To implement multi-drag, need to:

1. **Modify InputHandler**: Pass ALL selected nodes to drag callbacks (or indicate "drag selection")
2. **Modify WorkspaceCanvas**: Update ALL selected nodes in `onNodeDragMove`
3. **Add DB Persistence**: Save multiple node position updates
4. **Add Visual Feedback**: Render bounding box around selected nodes
5. **Fix Selection Preservation**: Don't clear selection when clicking already-selected node with Shift/Ctrl
6. **Modify DragState**: Track whether drag involves selection or single node

See `MULTI_DRAG_IMPLEMENTATION_PLAN.md` for detailed fix requirements.
