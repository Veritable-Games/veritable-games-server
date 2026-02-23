# Deep Dive: Drag Implementation Analysis - Root Cause Found

## Summary
The incremental movement bug is caused by **the coordinate transformation logic dividing by zoom when it should multiply**. Additionally, there are **three compounding factors** that mask the severity of the first bug and prevent smooth dragging from working as expected.

---

## The Complete Drag Flow (Traced End-to-End)

### 1. User Presses Mouse Down (lines 204-214 in input-handler.ts)
```typescript
this.dragState = {
  isDragging: false,          // Will activate after minDragDistance (10px)
  startX: screenX,            // Store initial screen position
  startY: screenY,
  lastX: screenX,             // Will be updated each move
  lastY: screenY,
  button: e.button,
  target: 'node',
  nodeId,
  hasMoved: false,
};
```

### 2. User Moves Mouse - Delta Calculation (lines 287-288)
```typescript
const deltaX = screenX - this.dragState.lastX;
const deltaY = screenY - this.dragState.lastY;
```
At this point: `lastX` equals `startX` on first move, so delta is small
Example: If mouse moved 50px, delta = 50px

### 3. KEY BUG - Coordinate Transformation (lines 321-324)
```typescript
const canvasDelta = {
  x: deltaX / this.transformManager.getZoom(),   // ❌ WRONG: DIVIDING by zoom
  y: deltaY / this.transformManager.getZoom(),
};
```

**The Problem:**
- At zoom = 1.0: `50 / 1.0 = 50` ✓ Correct
- At zoom = 2.0: `50 / 2.0 = 25` ❌ WRONG (half the distance!)
- At zoom = 0.5: `50 / 0.5 = 100` ❌ WRONG (double the distance!)

**The Mathematics:**
When zoomed in (scale > 1), the screen distance is LARGER in canvas space, not smaller.
- At 2x zoom: 50 screen pixels = 100 canvas units
- Should be: `deltaX * zoom` not `deltaX / zoom`

**Correct formula should be:**
```typescript
const canvasDelta = {
  x: deltaX * this.transformManager.getZoom(),   // ✅ CORRECT: MULTIPLY by zoom
  y: deltaY * this.transformManager.getZoom(),
};
```

### 4. Callback to WorkspaceCanvas (line 325)
```typescript
this.callbacks.onNodeDragMove?.(this.dragState.nodeId, canvasPos, canvasDelta);
```
Passes the WRONG (too-small) delta to the callback.

### 5. Store Update in WorkspaceCanvas (lines 807-835)
```typescript
onNodeDragMove: (nodeId, canvasPos, delta) => {
  if (dragStartPositions && dragStartPositions.size > 1) {
    dragStartPositions.forEach((startPos, id) => {
      const node = nodes.get(id);
      if (node) {
        useWorkspaceStore.getState().updateNode(unsafeToNodeId(id), {
          position: {
            x: node.position.x + delta.x,  // ❌ Uses CURRENT position + delta
            y: node.position.y + delta.y,
          },
        });
      }
    });
  } else {
    // Single node drag
    useWorkspaceStore.getState().updateNode(unsafeToNodeId(nodeId), {
      position: {
        x: node.position.x + delta.x,
        y: node.position.y + delta.y,
      },
    });
  }
};
```

### 6. Store Updates Position (lines 206-212 in workspace.ts)
```typescript
updateNode: (id, updates) =>
  set((state) => {
    const node = state.nodes.get(id);
    if (node) {
      state.nodes.set(id, { ...node, ...updates });  // Merges updates into node
    }
  }),
```

### 7. TextNode Renders (line 381-382 in TextNode.tsx)
```typescript
style={{
  left: `${node.position.x}px`,
  top: `${node.position.y}px`,
  // ... other styles
}}
```

### 8. lastX/lastY Updated (lines 365-366)
```typescript
this.dragState.lastX = screenX;
this.dragState.lastY = screenY;
```

---

## Three Compounding Issues

### Issue #1: ZOOM CALCULATION ERROR (PRIMARY BUG)
**Location:** `input-handler.ts` lines 321-324

**What's wrong:**
- Dividing by zoom instead of multiplying
- Worse the more zoomed in you are
- At 2x zoom: movements are half as large
- At 0.5x zoom: movements are twice as large

**Impact:** Movement scales inversely with zoom level

---

### Issue #2: INCREMENTAL DELTA ACCUMULATION
**Location:** `input-handler.ts` lines 365-366 (lastX/lastY update)

**What's wrong:**
The current implementation uses **incremental deltas** (difference from last frame):
- Frame 1: moved 50px → delta = 50px → position += 50
- Frame 2: moved 50px more → delta = 50px → position += 50
- Frame 3: moved 50px more → delta = 50px → position += 50

This WORKS but only if `lastX/lastY` is updated every frame. However, if there's:
- Frame rate drops
- Network lag during concurrent updates
- Other interference

The lastX/lastY might not update consistently, causing skipped deltas or reused deltas.

**Evidence of this issue:**
Looking at line 815-820 in WorkspaceCanvas.tsx:
```typescript
dragStartPositions.forEach((startPos, id) => {
  const node = nodes.get(id);
  if (node) {
    useWorkspaceStore.getState().updateNode(unsafeToNodeId(id), {
      position: {
        x: node.position.x + delta.x,  // ← Getting node.position.x EVERY callback
        y: node.position.y + delta.y,
      },
    });
  }
});
```

The code reads `node.position.x` from the store FRESH each time. If the store update is:
- Slow to propagate
- Batched by React
- Stale from closure captures

Then the incremental delta approach can accumulate errors.

---

### Issue #3: GROUP DRAG USES DIFFERENT NODES REFERENCE
**Location:** `WorkspaceCanvas.tsx` lines 813-823

**What's wrong:**
In group drag:
```typescript
dragStartPositions.forEach((startPos, id) => {
  const node = nodes.get(id);  // ← Gets node from OUTER scope (closure)
  if (node) {
    useWorkspaceStore.getState().updateNode(...);  // ← Updates store
  }
});
```

Two problems:
1. **Stale reference:** `nodes` comes from component props/state, might be outdated
2. **No use of startPos:** The `dragStartPositions` has the initial positions but aren't used!

**Better approach:** Use the initial position stored in dragStartPositions:
```typescript
dragStartPositions.forEach((startPos, id) => {
  useWorkspaceStore.getState().updateNode(unsafeToNodeId(id), {
    position: {
      x: startPos.x + totalDelta.x,  // Use cumulative delta from start
      y: startPos.y + totalDelta.y,
    },
  });
});
```

---

## Summary of Root Causes

| Issue | Location | Impact | Severity |
|-------|----------|--------|----------|
| **Zoom division** | input-handler.ts:321-324 | Movement scales inversely with zoom | CRITICAL |
| **Incremental deltas** | WorkspaceCanvas.tsx:818-820 | Prone to accumulation errors | HIGH |
| **Stale node reference** | WorkspaceCanvas.tsx:813-815 | Group drag uses outdated positions | HIGH |

---

## Why "Inch-by-Inch" Movement Happens

1. **Zoom bug divides movement by zoom factor** (e.g., at 2x zoom, 100px screen distance becomes 50px)
2. **Incremental deltas only move one frame's worth** if lastX/lastY isn't updated
3. **Stale references** mean each update doesn't see the previous frame's position
4. **Combination:** Node only moves the actual delta amount per frame, which is tiny

Example timeline at 2x zoom:
```
Frame 1: User drags 100px → delta = 100 → canvasDelta = 100/2 = 50 → position += 50
Frame 2: User drags 100px more → delta = 100 → canvasDelta = 100/2 = 50 → position += 50
Result: Moves 50px per 100px drag (half speed) + divided by zoom factor = inch-by-inch feel
```

---

## The Fix

Three changes needed:

### Fix #1: Multiply by Zoom (PRIMARY)
**File:** `frontend/src/lib/workspace/input-handler.ts`
**Lines 321-324:**
```typescript
// FROM:
const canvasDelta = {
  x: deltaX / this.transformManager.getZoom(),
  y: deltaY / this.transformManager.getZoom(),
};

// TO:
const canvasDelta = {
  x: deltaX * this.transformManager.getZoom(),
  y: deltaY * this.transformManager.getZoom(),
};
```

### Fix #2: Use Starting Positions in Group Drag
**File:** `frontend/src/components/workspace/WorkspaceCanvas.tsx`
**Lines 807-835:**

Replace incremental approach with:
```typescript
onNodeDragMove: (nodeId, canvasPos, delta) => {
  if (dragStartPositions && dragStartPositions.size > 1) {
    // Calculate total delta from drag start
    const totalDelta = { x: delta.x, y: delta.y };  // From canvasPos tracking
    
    dragStartPositions.forEach((startPos, id) => {
      useWorkspaceStore.getState().updateNode(unsafeToNodeId(id), {
        position: {
          x: startPos.x + totalDelta.x,
          y: startPos.y + totalDelta.y,
        },
      });
    });
  } else {
    // Single node drag - calculate total delta
    const totalDelta = { x: delta.x, y: delta.y };
    const initialPos = { x: 0, y: 0 };  // Track from onNodeDragStart
    
    useWorkspaceStore.getState().updateNode(unsafeToNodeId(nodeId), {
      position: {
        x: initialPos.x + totalDelta.x,
        y: initialPos.y + totalDelta.y,
      },
    });
  }
};
```

### Fix #3: Track Cumulative Delta
Need to pass cumulative delta from start, not incremental delta:

**File:** `frontend/src/lib/workspace/input-handler.ts`
**Lines 321-325:**
```typescript
// Calculate CUMULATIVE delta from drag start
const cumulativeDeltaX = screenX - this.dragState.startX;
const cumulativeDeltaY = screenY - this.dragState.startY;

const canvasDelta = {
  x: cumulativeDeltaX * this.transformManager.getZoom(),
  y: cumulativeDeltaY * this.transformManager.getZoom(),
};
```

This ensures:
- Movement is always calculated from the actual drag start, not accumulated errors
- Zoom is correctly multiplied
- No stale reference issues

---

## Verification Steps

1. **Before fix:** Drag node → moves 1-2 inches per large drag gesture
2. **After fix:** Drag node → smooth 1:1 movement with mouse
3. **Test at different zoom levels:**
   - At 0.5x zoom: Should feel smooth
   - At 1.0x zoom: Should feel normal
   - At 2.0x zoom: Should feel responsive (not slow)

