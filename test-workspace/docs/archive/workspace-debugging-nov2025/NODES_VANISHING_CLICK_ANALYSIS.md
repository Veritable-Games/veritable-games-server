# Nodes Vanishing on Click - Complete Analysis

## Summary
When clicking on nodes in the workspace, they vanish. This investigation has traced the complete click event flow and identified where and how `onUpdate` is being triggered.

---

## Complete Click Event Flow

### 1. Mouse Click Entry Point (InputHandler)

**File**: `/frontend/src/lib/workspace/input-handler.ts` (lines 178-321)

When a mouse button is pressed on a node:

```javascript
// InputHandler.handleMouseDown()
if (nodeId) {
  // Check if node is being edited
  if (this.callbacks.isNodeEditing?.(nodeId)) {
    return; // Skip drag entirely
  }

  // Initiate drag state in Zustand (lines 246-253)
  store.initiateDrag(
    'node',
    { x: screenX, y: screenY },     // Screen position
    canvasPos,                       // Canvas position
    nodeId,                          // Node ID
    e.button,                        // Button number
    clickOffset                      // Click offset (added in Phase 3.2)
  );
  return;
}
```

**Key Point**: InputHandler does NOT call `onUpdate` during mousedown. It only initiates a drag state.

---

### 2. TextNode Component Click Handler

**File**: `/frontend/src/components/workspace/TextNode.tsx` (lines 244-256)

```javascript
const handleClick = useCallback(
  (e: React.MouseEvent) => {
    console.log('[TextNode] handleClick called for node:', node.id, {
      isEditing,
      multi: e.shiftKey || e.metaKey || e.ctrlKey,
    });
    e.stopPropagation();
    if (!isEditing) {
      onSelect(e.shiftKey || e.metaKey || e.ctrlKey);  // CALL TO onSelect
    }
  },
  [isEditing, onSelect, node.id]
);
```

**Key Point**: This calls `onSelect()` callback passed from WorkspaceCanvas, NOT `onUpdate()`.

---

### 3. TextNode MouseDown Handler

**File**: `/frontend/src/components/workspace/TextNode.tsx` (lines 174-217)

```javascript
const handleMouseDown = useCallback(
  (e: React.MouseEvent) => {
    // Priority 1: Already editing/resizing - prevent interference
    if (isEditing || isResizing) {
      e.stopPropagation();
      return;
    }

    // Priority 2: Detect double-click - enter edit mode immediately
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTimeRef.current;

    if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD && e.button === 0) {
      console.log('[TextNode] Double-click detected! Entering edit mode immediately.');
      e.stopPropagation();
      setIsEditing(true);
      onEditingChange?.(true);
      lastClickTimeRef.current = 0;
      return;
    }

    // Update click timestamp
    lastClickTimeRef.current = now;

    // Priority 3: Not editing, not double-click - allow drag
    onDragStart(e);  // CALL TO onDragStart
  },
  [isEditing, isResizing, onDragStart, onEditingChange]
);
```

**Key Point**: This calls `onDragStart()`, also passed from WorkspaceCanvas.

---

### 4. WorkspaceCanvas Node Callbacks

**File**: `/frontend/src/components/workspace/WorkspaceCanvas.tsx` (lines 1437-1442)

```javascript
<TextNode
  node={node}
  isSelected={selectedNodeIds.has(node.id)}
  isDragging={isDragging && dragNodeId === node.id}
  scale={transformManagerRef.current?.getZoom() || 1}
  onUpdate={updates => handleNodeUpdate(node.id, updates)}  // ← onUpdate BINDING
  onDelete={() => handleNodeDelete(node.id)}
  onSelect={multi => handleNodeSelect(node.id, multi)}       // ← onSelect BINDING
  onEditingChange={isEditing => handleNodeEditingChange(node.id, isEditing)}
  onEditorReady={handleEditorReady}
  onDragStart={e => {
    // CRITICAL: Prevent native HTML5 drag which blocks mousemove events
    e.preventDefault();
    console.log('[WorkspaceCanvas] Blocked native drag');
  }}
/>
```

**Critical Discovery**: The `onUpdate` binding in line 1437 is:
```javascript
onUpdate={updates => handleNodeUpdate(node.id, updates)}
```

---

### 5. handleNodeUpdate Function

**File**: `/frontend/src/components/workspace/WorkspaceCanvas.tsx` (lines 1173-1182)

```javascript
const handleNodeUpdate = useCallback(
  (nodeId: string, updates: any) => {
    // Update store immediately for responsive UI
    updateNode(unsafeToNodeId(nodeId), updates);

    // Debounced save (waits 500ms after last change)
    debouncedSave(nodeId, updates, 500);
  },
  [updateNode, debouncedSave]
);
```

This calls:
1. **`updateNode()`** - Updates Zustand store immediately
2. **`debouncedSave()`** - Sends a PUT request to `/api/workspace/nodes/${nodeId}` after 500ms

---

### 6. Zustand updateNode Action

**File**: `/frontend/src/stores/workspace.ts` (lines 527-553)

```javascript
updateNode: (id, updates) =>
  set(state => {
    // ALWAYS update local state for immediate UI updates
    const node = state.nodes.get(id);
    if (node) {
      state.nodes.set(id, { ...node, ...updates });
    }

    // ALSO update Yjs for real-time sync (if available)
    if (state.yjsDoc && state.yjsNodes) {
      try {
        state.yjsDoc.transact(() => {
          const existing = state.yjsNodes!.get(id);
          if (existing) {
            state.yjsNodes!.set(id, { ...existing, ...updates });
          }
        });
      } catch (error) {
        // Handle errors...
      }
    }
  }),
```

**Key Point**: `updateNode` uses object spread (`{ ...node, ...updates }`) to merge updates.

---

## The Critical Question: Where Does onUpdate Get Called?

After tracing the complete flow:

1. **TextNode.handleClick()** → calls `onSelect()` (NOT onUpdate)
2. **TextNode.handleMouseDown()** → calls `onDragStart()` (NOT onUpdate)
3. **TextNode.handleDoubleClick()** → sets editing mode (NOT onUpdate)
4. **RichTextEditor onChange** → would call `setContent()` → onBlur calls `onUpdate()` (editing scenario)
5. **TextNode Resize** → calls `onUpdate()` (via handleResizeStart) with position/size

---

## Potential Issues Causing Vanishing Nodes

### Issue #1: Incomplete Updates Being Spread

When `handleNodeUpdate()` is called from TextNode components, it might be sending partial updates that don't include all required node properties:

```javascript
// Example problematic flow:
onUpdate({ position: { x: 100, y: 200 } })  // Only sends position
  → updateNode(nodeId, { position: { x: 100, y: 200 } })
  → { ...node, position: { x: 100, y: 200 } }
  // This REPLACES node.position, but should be fine with spread
```

**However**, there's a subtle issue with nested objects:

```javascript
// If updates come as:
{ position: { x: 100 } }  // Missing y!

// This creates:
{ ...node, position: { x: 100 } }
// This REPLACES the entire position object, losing y coordinate!
```

This would cause nodes to have invalid positions (position.y undefined) and could render off-screen or disappear.

---

### Issue #2: Click Triggering Drag Start With Bad Offset

**File**: `/frontend/src/lib/workspace/input-handler.ts` (lines 238-253)

```javascript
// PHASE 3.2: Calculate click offset (difference between click and node position)
const store = useWorkspaceStore.getState();
const node = store.getNode(nodeId as any);
const clickOffset = node
  ? { x: canvasPos.x - node.position.x, y: canvasPos.y - node.position.y }
  : undefined;

// PHASE 2.2: Delegate to Zustand instead of managing local dragState
store.initiateDrag(
  'node',
  { x: screenX, y: screenY },
  canvasPos,
  nodeId as any,
  e.button,
  clickOffset
);
```

The `clickOffset` is calculated but might not be used correctly downstream.

---

### Issue #3: Silent API Failures Not Causing Rollback

**File**: `/frontend/src/components/workspace/WorkspaceCanvas.tsx` (lines 168-206)

```javascript
const debouncedSave = useCallback((nodeId: string, updates: any, delay: number = 500) => {
  const timer = setTimeout(async () => {
    try {
      setSaveStatus('saving');
      const response = await fetchWithCSRF(`/api/workspace/nodes/${nodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Save failed: ${response.status} ${errorText}`);
      }
      // Success - but local state already updated!
    } catch (error) {
      console.error('Failed to save node:', error);
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : 'Failed to save changes');
      // NO ROLLBACK - local state is corrupted!
    }
  }, delay);
  // ...
}, []);
```

**Critical Issue**: If the API save fails:
- Local Zustand state is ALREADY updated (line 1176)
- API PUT request fails and shows error toast
- **But there's no rollback to restore the node state**

If the API receives invalid/incomplete update data (e.g., missing `position.y`), it might:
1. Update local state immediately (node becomes corrupted)
2. Try to save corrupt state to database
3. API silently rejects or partially updates
4. Node remains corrupted in UI

---

## Where Nodes Likely Vanish

### Scenario 1: Incomplete Position Update
If a click-based drag sends:
```javascript
onUpdate({ position: { x: 100 } })  // MISSING y!
```

Then:
1. Local state becomes: `{ ...node, position: { x: 100 } }` → position.y = undefined
2. Node renders at `position.y = undefined` → likely renders off-screen
3. Node vanishes from view

### Scenario 2: Corrupted Size
Similar issue if resize sends:
```javascript
onUpdate({ size: { width: 100 } })  // MISSING height!
```

### Scenario 3: API Fails Silently
Click triggers save → API fails → no rollback → node corrupted permanently

---

## Logs to Check

In browser console, look for:

1. **InputHandler logs:**
   ```
   [InputHandler] === MOUSEDOWN ===
   [InputHandler] Node detection
   [InputHandler] Initiating node drag
   [InputHandler] === MOUSEUP ===
   ```

2. **TextNode logs:**
   ```
   [TextNode] handleClick called for node
   [TextNode] mouseDown
   [TextNode] Double-click detected
   ```

3. **WorkspaceCanvas logs:**
   ```
   [WorkspaceCanvas] Rendering: { totalNodes, visibleNodes, nodePositions }
   ```

4. **API errors:**
   ```
   Failed to save node: <error message>
   Failed to save on unmount: <error message>
   ```

---

## Root Cause: Most Likely

The most likely culprit is **incomplete updates with nested object spreading**:

When a node is clicked and a single drag movement occurs, something is sending updates like:
```javascript
{ position: { x: value } }    // Missing y
{ size: { width: value } }    // Missing height
{ content: { text: "" } }     // Wiping markdown property
```

Instead of the complete objects.

---

## Files to Check for Fix

1. **TextNode.tsx** - Verify `onUpdate` calls always include complete objects
2. **input-handler.ts** - Check how drag delta is calculated and passed
3. **WorkspaceCanvas.tsx** - Verify `handleNodeUpdate` receives complete data
4. **workspace.ts** - Consider deep merge instead of shallow spread for nested updates
5. **API response** - Check if API validation is rejecting or modifying bad requests

---

## Recommended Diagnostic Steps

1. **Add logging to TextNode.onUpdate:**
   ```javascript
   const handleBlur = useCallback(() => {
     console.log('[TextNode] Saving content:', { updates: { content } });
     onUpdate({
       content: {
         ...node.content,
         text: content,
         markdown: content,
       },
     });
   }, []);
   ```

2. **Add logging to handleNodeUpdate:**
   ```javascript
   const handleNodeUpdate = useCallback(
     (nodeId: string, updates: any) => {
       console.log('[handleNodeUpdate] Received updates:', { nodeId, updates });
       console.log('[handleNodeUpdate] Current node:', nodes.get(nodeId));
       updateNode(unsafeToNodeId(nodeId), updates);
     },
     [updateNode, debouncedSave]
   );
   ```

3. **Add validation in Zustand updateNode:**
   ```javascript
   updateNode: (id, updates) =>
     set(state => {
       const node = state.nodes.get(id);
       console.log('[updateNode] Merging:', {
         current: node,
         updates,
         result: { ...node, ...updates }
       });
       if (node) {
         state.nodes.set(id, { ...node, ...updates });
       }
     }),
   ```

4. **Check API logs** on server for what data is being received in PUT requests

---

## Summary of Findings

| Component | Handler | Calls | Issue |
|-----------|---------|-------|-------|
| TextNode | handleClick | onSelect() | Selection, not update |
| TextNode | handleMouseDown | onDragStart() | Drag prevention, not update |
| TextNode | handleDoubleClick | setIsEditing() | Edit mode, not update |
| TextNode | handleBlur | onUpdate() | Content saved ✓ |
| TextNode | handleResizeStart → handleMouseMove | onUpdate() | Position/size updated |
| WorkspaceCanvas | handleNodeUpdate | updateNode(), debouncedSave() | Both local and API |
| Zustand | updateNode | spread merge | **Potential issue with nested objects** |

The nodes are vanishing because something is sending incomplete update objects that lose position or size properties when spread-merged.
