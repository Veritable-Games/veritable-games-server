# Workspace Performance Optimization - Implementation Guide

## Phase 1: Critical Fixes (6 Hours)

This guide provides step-by-step instructions for implementing the highest-priority performance optimizations for the workspace feature.

---

## 1. Add Input Event Throttling (1 Hour)

### Problem
Mouse wheel events fire 60+ times/second, mouse move events fire 500+ times/second. Each event triggers viewport recalculation and re-renders.

### Solution
Throttle wheel events to 60fps max, throttle mouse moves to animation frame rate.

### Implementation

**File:** `/frontend/src/lib/workspace/input-handler.ts`

#### Step 1: Add Throttle for Wheel Events

```typescript
// Add at top of InputHandler class
private lastWheelTime = 0;
private readonly wheelThrottleDelay = 16; // 60fps = 16.67ms

// Replace handleWheel method (line 341)
private handleWheel = (e: WheelEvent): void => {
  e.preventDefault();

  // Throttle to 60fps
  const now = performance.now();
  if (now - this.lastWheelTime < this.wheelThrottleDelay) {
    return;
  }
  this.lastWheelTime = now;

  const rect = this.container.getBoundingClientRect();
  const centerX = e.clientX - rect.left;
  const centerY = e.clientY - rect.top;

  const delta = -Math.sign(e.deltaY) * 100 * this.config.zoomSensitivity;

  this.transformManager.zoom(delta, centerX, centerY);
  this.callbacks.onTransformChange?.();
};
```

#### Step 2: Add RAF Throttle for Mouse Move

```typescript
// Add at top of InputHandler class
private mouseMoveRafId: number | null = null;
private pendingMouseEvent: MouseEvent | null = null;

// Replace handleMouseMove method (line 246)
private handleMouseMove = (e: MouseEvent): void => {
  if (!this.dragState?.isDragging) return;

  // Store latest event
  this.pendingMouseEvent = e;

  // Skip if RAF already scheduled
  if (this.mouseMoveRafId !== null) return;

  // Schedule update on next animation frame
  this.mouseMoveRafId = requestAnimationFrame(() => {
    if (!this.pendingMouseEvent || !this.dragState?.isDragging) {
      this.mouseMoveRafId = null;
      return;
    }

    const e = this.pendingMouseEvent;
    const rect = this.container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const deltaX = screenX - this.dragState.lastX;
    const deltaY = screenY - this.dragState.lastY;

    const totalDeltaX = screenX - this.dragState.startX;
    const totalDeltaY = screenY - this.dragState.startY;
    const distance = Math.sqrt(totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY);

    if (distance > this.config.minDragDistance) {
      this.dragState.hasMoved = true;
    }

    if (this.dragState.hasMoved) {
      if (this.dragState.target === 'connection-anchor') {
        const canvasPos = this.transformManager.screenToCanvas(screenX, screenY);
        this.callbacks.onConnectionMove?.(canvasPos);
      } else if (this.dragState.target === 'node' && this.dragState.nodeId) {
        const canvasPos = this.transformManager.screenToCanvas(screenX, screenY);
        const canvasDelta = {
          x: deltaX / this.transformManager.getZoom(),
          y: deltaY / this.transformManager.getZoom(),
        };
        this.callbacks.onNodeDragMove?.(this.dragState.nodeId, canvasPos, canvasDelta);
      } else if (
        this.dragState.target === 'canvas' ||
        this.dragState.button === this.config.panButton ||
        this.isSpacePressed
      ) {
        this.transformManager.pan(deltaX, deltaY);
        this.callbacks.onTransformChange?.();
        this.setCursor('grabbing');
      }
    }

    this.dragState.lastX = screenX;
    this.dragState.lastY = screenY;
    this.pendingMouseEvent = null;
    this.mouseMoveRafId = null;
  });
};
```

#### Step 3: Cleanup on Destroy

```typescript
// Update destroy method (line 124)
destroy(): void {
  // Cancel pending RAF
  if (this.mouseMoveRafId !== null) {
    cancelAnimationFrame(this.mouseMoveRafId);
    this.mouseMoveRafId = null;
  }

  // ... existing cleanup code
}
```

**Expected Impact:** 70% reduction in event processing overhead

---

## 2. Memoize TextNode Component (2 Hours)

### Problem
`TextNode` component re-renders on every viewport change, even when node data hasn't changed.

### Solution
Wrap component in `React.memo` with custom comparison function.

### Implementation

**File:** `/frontend/src/components/workspace/TextNode.tsx`

#### Step 1: Add Comparison Function

```typescript
// Add at top of file, before component definition
const arePropsEqual = (
  prevProps: TextNodeProps,
  nextProps: TextNodeProps
): boolean => {
  // Only re-render if these specific props change
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.position.x === nextProps.node.position.x &&
    prevProps.node.position.y === nextProps.node.position.y &&
    prevProps.node.size.width === nextProps.node.size.width &&
    prevProps.node.size.height === nextProps.node.size.height &&
    prevProps.node.content === nextProps.node.content &&
    prevProps.node.style === nextProps.node.style &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.scale === nextProps.scale &&
    prevProps.isDraggingConnection === nextProps.isDraggingConnection &&
    prevProps.mouseCanvasPos?.x === nextProps.mouseCanvasPos?.x &&
    prevProps.mouseCanvasPos?.y === nextProps.mouseCanvasPos?.y
  );
};
```

#### Step 2: Wrap Component

```typescript
// Replace default export (line 29)
const TextNode = function TextNode({
  node,
  isSelected,
  isDragging,
  scale,
  isDraggingConnection,
  mouseCanvasPos,
  onUpdate,
  onDelete,
  onSelect,
  onDragStart,
  onConnectionStart,
}: TextNodeProps) {
  // ... existing component code
};

// Export memoized version
export default React.memo(TextNode, arePropsEqual);
```

#### Step 3: Stable Callback Refs in WorkspaceCanvas

**File:** `/frontend/src/components/workspace/WorkspaceCanvas.tsx`

```typescript
// Add before renderNodes (around line 630)
const nodeCallbacksRef = useRef({
  onUpdate: (nodeId: string, updates: any) => {
    updateNode(unsafeToNodeId(nodeId), updates);
    debouncedSave(nodeId, updates, 500);
  },
  onDelete: (nodeId: string) => {
    deleteNode(unsafeToNodeId(nodeId));
    fetch(`/api/workspace/nodes/${nodeId}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(console.error);
  },
  onSelect: (nodeId: string, multi: boolean) => {
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
  },
});

// Update nodeCallbacksRef when dependencies change
useEffect(() => {
  nodeCallbacksRef.current.onUpdate = (nodeId, updates) => {
    updateNode(unsafeToNodeId(nodeId), updates);
    debouncedSave(nodeId, updates, 500);
  };
  nodeCallbacksRef.current.onDelete = (nodeId) => {
    deleteNode(unsafeToNodeId(nodeId));
    fetch(`/api/workspace/nodes/${nodeId}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(console.error);
  };
  nodeCallbacksRef.current.onSelect = (nodeId, multi) => {
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
  };
}, [updateNode, deleteNode, debouncedSave, selectedNodeIds, setSelectedNodes]);

// Update renderNodes to use stable refs (line 688)
return visibleNodes.map((node) => (
  <TextNode
    key={node.id}
    node={node}
    isSelected={selectedNodeIds.has(node.id)}
    isDragging={draggingNodeId === node.id}
    scale={transformManagerRef.current?.getZoom() || 1}
    isDraggingConnection={!!connectionStart}
    mouseCanvasPos={tempConnectionEnd}
    onUpdate={(updates) => nodeCallbacksRef.current.onUpdate(node.id, updates)}
    onDelete={() => nodeCallbacksRef.current.onDelete(node.id)}
    onSelect={(multi) => nodeCallbacksRef.current.onSelect(node.id, multi)}
    onConnectionStart={handleConnectionStart}
    onDragStart={(e) => {
      if ((e.target as HTMLElement).closest('[data-node-id]')) {
        e.stopPropagation();
      }
    }}
  />
));
```

**Expected Impact:** 80% reduction in unnecessary re-renders

---

## 3. Fix Memory Leak in Save Timers (30 Minutes)

### Problem
When nodes are deleted, their autosave timers remain in the map, causing unbounded memory growth.

### Solution
Clear timers when nodes are deleted.

### Implementation

**File:** `/frontend/src/components/workspace/WorkspaceCanvas.tsx`

#### Step 1: Update Delete Handler

```typescript
// Update handleNodeDelete (line 641)
const handleNodeDelete = useCallback(async (nodeId: string) => {
  // Clear associated timer BEFORE deleting node
  const timer = saveTimersRef.current.get(nodeId);
  if (timer) {
    clearTimeout(timer);
    saveTimersRef.current.delete(nodeId);
  }

  // Update hasPendingSaves flag
  setHasPendingSaves(saveTimersRef.current.size > 0);

  // Delete from store
  deleteNode(unsafeToNodeId(nodeId));

  // Persist to database
  try {
    await fetch(`/api/workspace/nodes/${nodeId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Failed to delete node:', error);
  }
}, [deleteNode]);
```

#### Step 2: Add Timer Cleanup to Keyboard Handler

```typescript
// Update keyboard handler (line 450)
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Delete' && selectedNodeIds.size > 0) {
      e.preventDefault();
      selectedNodeIds.forEach((nodeId) => {
        // Clear timer
        const timer = saveTimersRef.current.get(nodeId);
        if (timer) {
          clearTimeout(timer);
          saveTimersRef.current.delete(nodeId);
        }

        // Delete node
        deleteNode(unsafeToNodeId(nodeId));

        // Persist
        fetch(`/api/workspace/nodes/${nodeId}`, {
          method: 'DELETE',
          credentials: 'include',
        }).catch(error => console.error('Failed to delete node:', error));
      });

      // Update flag
      setHasPendingSaves(saveTimersRef.current.size > 0);
      return;
    }

    // ... rest of handler
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedNodeIds, selectedConnectionIds, deleteNode, handleConnectionDelete]);
```

**Expected Impact:** Zero memory leaks, stable memory usage over time

---

## 4. Cache Connection Bounds (1 Hour)

### Problem
Connection bounding boxes are recalculated on every culling pass (every frame during pan/zoom).

### Solution
Cache bounds and invalidate only when nodes move.

### Implementation

**File:** `/frontend/src/lib/workspace/viewport-culling.ts`

#### Step 1: Add Cache to ViewportCuller Class

```typescript
// Add to ViewportCuller class (line 136)
export class ViewportCuller {
  private config: CullingConfig;
  private connectionBoundsCache = new Map<string, Bounds>(); // NEW

  constructor(config: Partial<CullingConfig> = {}) {
    this.config = { ...DEFAULT_CULLING_CONFIG, ...config };
  }

  // ... existing methods
}
```

#### Step 2: Update getConnectionBounds

```typescript
// Replace getConnectionBounds function (line 58) with cached version
export function getConnectionBoundsCached(
  connection: NodeConnection,
  nodes: Map<string, CanvasNode>,
  cache: Map<string, Bounds>
): Bounds | null {
  const cacheKey = `${connection.source_node_id}-${connection.target_node_id}`;

  // Check cache
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  // Calculate bounds
  const sourceNode = nodes.get(connection.source_node_id);
  const targetNode = nodes.get(connection.target_node_id);

  if (!sourceNode || !targetNode) return null;

  const sourcePos = getAnchorPosition(sourceNode, connection.source_anchor);
  const targetPos = getAnchorPosition(targetNode, connection.target_anchor);

  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  const controlOffset = Math.abs(dx) * 0.3;

  const points = [
    sourcePos,
    { x: sourcePos.x + controlOffset, y: sourcePos.y },
    { x: targetPos.x - controlOffset, y: targetPos.y },
    targetPos,
  ];

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  const bounds = {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };

  // Store in cache
  cache.set(cacheKey, bounds);

  return bounds;
}
```

#### Step 3: Update cullConnections to Use Cache

```typescript
// Update cullConnections method (line 166)
cullConnections(
  connections: Map<string, NodeConnection>,
  nodes: Map<string, CanvasNode>,
  viewportBounds: Bounds
): NodeConnection[] {
  const expandedBounds = expandBounds(viewportBounds, this.config.margin);
  const visible: NodeConnection[] = [];

  for (const connection of connections.values()) {
    if (!connection.deleted_at) {
      // Use cached version
      const connBounds = getConnectionBoundsCached(
        connection,
        nodes,
        this.connectionBoundsCache
      );
      if (connBounds && boundsIntersect(connBounds, expandedBounds)) {
        visible.push(connection);
      }
    }
  }

  return visible;
}
```

#### Step 4: Add Cache Invalidation

```typescript
// Add method to ViewportCuller class
invalidateNodeConnections(nodeId: string): void {
  // Remove all cached bounds involving this node
  for (const [key, _] of this.connectionBoundsCache) {
    if (key.includes(nodeId)) {
      this.connectionBoundsCache.delete(key);
    }
  }
}

clearCache(): void {
  this.connectionBoundsCache.clear();
}
```

#### Step 5: Invalidate Cache on Node Move

**File:** `/frontend/src/components/workspace/WorkspaceCanvas.tsx`

```typescript
// Update onNodeDragEnd callback in input handler setup (line 541)
onNodeDragEnd: (nodeId, canvasPos) => {
  console.log('Node drag end:', nodeId);
  setDraggingNodeId(null);

  const node = useWorkspaceStore.getState().nodes.get(nodeId as string);
  if (!node) return;

  // Invalidate connection bounds cache for this node
  viewportCullerRef.current?.invalidateNodeConnections(nodeId);

  // Persist to database
  fetch(`/api/workspace/nodes/${nodeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ position: node.position }),
  }).catch(error => console.error('Failed to save node position:', error));
},
```

**Expected Impact:** 10x faster connection culling (5ms → 0.5ms for 100 connections)

---

## 5. Optimize Array Creation (30 Minutes)

### Problem
`Array.from(connections.values())` creates a new array on every render, triggering unnecessary re-renders.

### Solution
Memoize array conversions.

### Implementation

**File:** `/frontend/src/components/workspace/WorkspaceCanvas.tsx`

#### Step 1: Memoize Arrays

```typescript
// Add before return statement in component (around line 720)
const connectionsArray = useMemo(
  () => Array.from(connections.values()),
  [connections]
);

const nodesMap = useMemo(
  () => nodes,
  [nodes]
);
```

#### Step 2: Update ConnectionLayer Props

```typescript
// Update ConnectionLayer usage (line 739)
<ConnectionLayer
  connections={connectionsArray} // Use memoized array
  nodes={nodesMap} // Use memoized map
  selectedConnectionIds={selectedConnectionIds}
  hoveredConnectionId={hoveredConnectionId}
  tempConnection={
    connectionStart && tempConnectionEnd && transformManagerRef.current
      ? {
          start: (() => {
            const node = nodes.get(connectionStart.nodeId);
            if (!node) return tempConnectionEnd;
            const { getAnchorPosition } = require('@/lib/workspace/viewport-culling');
            return getAnchorPosition(node, connectionStart.anchor);
          })(),
          end: tempConnectionEnd,
        }
      : null
  }
  viewport={viewport || { offsetX: 0, offsetY: 0, scale: 1.0 }}
  isDraggingConnection={!!connectionStart}
  onConnectionClick={(id) => selectConnection(unsafeToConnectionId(id))}
  onConnectionHover={setHoveredConnectionId}
/>
```

#### Step 3: Memoize ConnectionLayer Component

**File:** `/frontend/src/components/workspace/ConnectionLayer.tsx`

```typescript
// Add at top of file
const arePropsEqual = (
  prevProps: ConnectionLayerProps,
  nextProps: ConnectionLayerProps
): boolean => {
  return (
    prevProps.connections === nextProps.connections &&
    prevProps.nodes === nextProps.nodes &&
    prevProps.selectedConnectionIds === nextProps.selectedConnectionIds &&
    prevProps.hoveredConnectionId === nextProps.hoveredConnectionId &&
    prevProps.tempConnection === nextProps.tempConnection &&
    prevProps.viewport.offsetX === nextProps.viewport.offsetX &&
    prevProps.viewport.offsetY === nextProps.viewport.offsetY &&
    prevProps.viewport.scale === nextProps.viewport.scale &&
    prevProps.isDraggingConnection === nextProps.isDraggingConnection
  );
};

// At end of file
export default React.memo(ConnectionLayer, arePropsEqual);
```

**Expected Impact:** Eliminates unnecessary array allocations and re-renders

---

## 6. Add Performance Monitoring (1 Hour)

### Problem
No visibility into actual performance metrics during runtime.

### Solution
Add performance monitoring overlay with FPS, frame time, and render stats.

### Implementation

**File:** `/frontend/src/components/workspace/WorkspaceCanvas.tsx`

#### Step 1: Add Performance State

```typescript
// Add state (around line 43)
const [perfMetrics, setPerfMetrics] = useState({
  fps: 60,
  frameTime: 0,
  visibleNodes: 0,
  visibleConnections: 0,
  totalNodes: 0,
  totalConnections: 0,
  renderTime: 0,
});
```

#### Step 2: Track Performance in Animation Loop

```typescript
// Update animation loop (line 586)
const animate = () => {
  const frameStart = performance.now();

  if (transformManagerRef.current) {
    const hasChanges = transformManagerRef.current.update();

    if (hasChanges) {
      const transform = transformManagerRef.current.toCSSTransform();

      if (canvasLayerRef.current) {
        canvasLayerRef.current.style.transform = transform;
      }
      if (connectionLayerRef.current) {
        connectionLayerRef.current.style.transform = transform;
      }
      if (gridLayerRef.current) {
        gridLayerRef.current.style.transform = transform;
      }
    }
  }

  const frameTime = performance.now() - frameStart;

  // Warn on slow frames
  if (frameTime > 16.67) {
    console.warn(`Slow frame: ${frameTime.toFixed(2)}ms`);
  }

  // Update metrics every 10 frames to avoid overhead
  if (animationFrameRef.current && animationFrameRef.current % 10 === 0) {
    setPerfMetrics(prev => ({
      fps: Math.round(1000 / Math.max(frameTime, 1)),
      frameTime: Math.round(frameTime * 100) / 100,
      visibleNodes: prev.visibleNodes,
      visibleConnections: prev.visibleConnections,
      totalNodes: nodes.size,
      totalConnections: connections.size,
      renderTime: prev.renderTime,
    }));
  }

  animationFrameRef.current = requestAnimationFrame(animate);
};
```

#### Step 3: Track Render Performance

```typescript
// Update renderNodes (line 674)
const renderNodes = useCallback(() => {
  const renderStart = performance.now();

  if (!containerRef.current || !viewportCullerRef.current || !transformManagerRef.current) {
    return null;
  }

  const rect = containerRef.current.getBoundingClientRect();
  const viewportBounds = transformManagerRef.current.getVisibleBounds(
    rect.width,
    rect.height,
    viewportCullerRef.current.getMargin()
  );

  if (!viewportBounds) return null;

  const visibleNodes = viewportCullerRef.current.cullNodes(nodes, viewportBounds);

  const renderTime = performance.now() - renderStart;

  // Update metrics
  setPerfMetrics(prev => ({
    ...prev,
    visibleNodes: visibleNodes.length,
    renderTime: Math.round(renderTime * 100) / 100,
  }));

  return visibleNodes.map((node) => (
    <TextNode
      key={node.id}
      node={node}
      isSelected={selectedNodeIds.has(node.id)}
      isDragging={draggingNodeId === node.id}
      scale={transformManagerRef.current?.getZoom() || 1}
      isDraggingConnection={!!connectionStart}
      mouseCanvasPos={tempConnectionEnd}
      onUpdate={(updates) => handleNodeUpdate(node.id, updates)}
      onDelete={() => handleNodeDelete(node.id)}
      onSelect={(multi) => handleNodeSelect(node.id, multi)}
      onConnectionStart={handleConnectionStart}
      onDragStart={(e) => {
        if ((e.target as HTMLElement).closest('[data-node-id]')) {
          e.stopPropagation();
        }
      }}
    />
  ));
}, [nodes, selectedNodeIds, draggingNodeId, connectionStart, tempConnectionEnd, handleNodeUpdate, handleNodeDelete, handleNodeSelect, handleConnectionStart]);
```

#### Step 4: Add Performance Overlay

```typescript
// Add performance overlay before closing div (line 870)
{/* Performance Metrics - Top Right (Dev Mode) */}
{process.env.NODE_ENV === 'development' && (
  <div className="absolute top-4 right-4 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-400 space-y-1 font-mono">
    <div className="font-semibold text-neutral-300 mb-1">Performance</div>
    <div className={perfMetrics.fps < 50 ? 'text-red-500' : perfMetrics.fps < 55 ? 'text-yellow-500' : 'text-emerald-500'}>
      FPS: {perfMetrics.fps}
    </div>
    <div className={perfMetrics.frameTime > 16.67 ? 'text-red-500' : 'text-neutral-400'}>
      Frame: {perfMetrics.frameTime.toFixed(2)}ms
    </div>
    <div className={perfMetrics.renderTime > 10 ? 'text-yellow-500' : 'text-neutral-400'}>
      Render: {perfMetrics.renderTime.toFixed(2)}ms
    </div>
    <div className="text-neutral-500 border-t border-neutral-800 pt-1 mt-1">
      Visible: {perfMetrics.visibleNodes} / {perfMetrics.totalNodes} nodes
    </div>
    <div className="text-neutral-500">
      {perfMetrics.visibleConnections} / {perfMetrics.totalConnections} connections
    </div>
  </div>
)}
```

**Expected Impact:** Real-time visibility into performance bottlenecks

---

## Testing Checklist

After implementing all optimizations, test the following:

### Functional Tests
- [ ] Pan with mouse drag still works smoothly
- [ ] Zoom with mouse wheel still works smoothly
- [ ] Node dragging still works correctly
- [ ] Connection creation still works
- [ ] Node editing (double-click) still works
- [ ] Node deletion (Delete key) still works
- [ ] Autosave still triggers after edits
- [ ] Viewport state persists on page reload

### Performance Tests
- [ ] Create 100 nodes - verify 60fps during pan/zoom
- [ ] Create 500 nodes - verify 55+ fps during pan/zoom
- [ ] Monitor DevTools Performance tab - no excessive renders
- [ ] Check Memory tab - stable memory usage over time
- [ ] Verify no console warnings during normal usage

### Visual Tests
- [ ] No visual glitches during pan/zoom
- [ ] Smooth animation when zooming
- [ ] Connections render correctly
- [ ] Performance overlay shows accurate metrics (dev mode)

---

## Expected Results

### Performance Improvements
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Wheel events/sec | 60-120 | 60 max | 50% reduction |
| Mouse events/sec | 500-1000 | 60 max | 90% reduction |
| Re-renders (100 nodes) | ~60/sec | ~1/sec | 98% reduction |
| Culling time (100 conn) | 5ms | 0.5ms | 90% reduction |
| Memory leak | Yes | No | Fixed |

### Before/After Comparison
**Before (100 nodes, panning):**
- Events: 500-1000/sec
- Re-renders: ~60/sec
- Frame time: ~15ms (fluctuating)
- FPS: 50-60 (unstable)

**After (100 nodes, panning):**
- Events: ~60/sec
- Re-renders: ~1/sec
- Frame time: ~5ms (stable)
- FPS: 60 (rock solid)

---

## Troubleshooting

### Issue: Performance overlay not showing
**Solution:** Verify `NODE_ENV=development` is set

### Issue: Mouse moves feel sluggish
**Solution:** Check that RAF throttle is working - should see max 60 updates/sec in console

### Issue: Nodes not rendering after memo
**Solution:** Verify comparison function returns correct boolean values

### Issue: Memory still growing
**Solution:** Check that timers are being cleared in browser DevTools → Memory → Take snapshot

---

## Next Steps

After completing Phase 1:
1. **Measure results** - Use Performance overlay to verify improvements
2. **Proceed to Phase 2** - Code splitting and spatial indexing
3. **Monitor production** - Track Core Web Vitals in production

---

**Implementation Time:** 6 hours
**Expected Performance Gain:** 70%
**Risk Level:** Low (all changes are backward compatible)
