# Workspace React Architecture Review
**Date**: February 14, 2026
**Reviewer**: Claude Sonnet 4.5
**Scope**: Performance and scalability analysis of infinite canvas workspace system

---

## Executive Summary

### Critical Findings

**Severity Level**: ⚠️ HIGH - Immediate action required for laptop performance

The workspace system exhibits severe **React re-render inefficiencies** causing performance issues on laptop hardware. Analysis of ~7,310 lines of workspace code reveals:

- ❌ **Zero React.memo usage** on high-frequency render components
- ❌ **Massive component re-renders** on every mouse move during drag operations
- ❌ **Yjs observer thrashing** - deep clones on every node update (JSON.parse/stringify)
- ❌ **2,806-line monolithic WorkspaceCanvas** with excessive responsibilities
- ⚠️ **Inefficient state selectors** converting Maps to Arrays on every render
- ⚠️ **74 useMemo/useCallback hooks** but not on critical paths

### Performance Impact

**User Experience**:
- Dragging nodes triggers **full re-render of entire canvas** (all nodes, connections, toolbars)
- Mouse move events during drag cause **60+ re-renders per second**
- Each node re-render performs expensive calculations (font scaling, warning states)
- Yjs selectors create **new array instances on every read** (breaks React memoization)

**Root Causes**:
1. **No component memoization** - TextNode, ConnectionRenderer, NodeAnchors re-render on every parent update
2. **Inefficient Yjs integration** - Deep clones entire node objects instead of shallow references
3. **Monolithic architecture** - WorkspaceCanvas manages too many concerns (2,806 lines)
4. **State selector issues** - `useYjsNodes()` returns new arrays, breaking dependency checks

---

## Architecture Overview

### Component Hierarchy

```
WorkspaceCanvas (2,806 lines - CRITICAL ISSUE)
├── CanvasGrid
├── ConnectionRenderer
│   └── SVG paths (re-renders on every viewport change)
├── TextNode (×N nodes, no memo)
│   ├── RichTextEditor / MarkdownTextEditor
│   ├── TextNodeWarningBadge
│   ├── NodeAnchors (×5 per node)
│   └── Resize handles (×8 per node)
├── NodeAnchors (global, re-renders on hover)
├── FloatingFormatToolbar (re-renders on every selection change)
├── MarkdownFloatingToolbar
├── SelectionBoundingBox (recalculates on every render)
├── AlignmentToolbar
├── CanvasContextMenu
└── NodeContextMenu
```

### State Management Architecture

**Zustand Store** (`workspace.ts` - 1,886 lines):
- Manages 28+ state slices (nodes, connections, viewport, selection, drag, etc.)
- **Critical Issue**: Uses Immer middleware causing proxy pollution
- **Yjs Integration**: Dual state - Yjs Y.Maps + Zustand mirrors (sync issues)

**Yjs Selectors** (`workspace-selectors.ts`):
```typescript
// ❌ PERFORMANCE ISSUE: Creates new array on EVERY call
export function useYjsNodes(): CanvasNode[] {
  const allNodes = Array.from(yjsNodes.values()).map(
    node => JSON.parse(JSON.stringify(node))  // Deep clone EVERY render!
  );
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

**Impact**: Every component using `useYjsNodes()` gets a brand new array reference, breaking `useMemo` dependencies.

---

## Critical Performance Issues

### 1. No React.memo on High-Frequency Components

**Issue**: TextNode and ConnectionRenderer re-render on **every canvas update**, even when their props haven't changed.

**Evidence**:
```typescript
// TextNode.tsx - No memo wrapper
export default function TextNode({ node, isSelected, ... }: TextNodeProps) {
  // 750 lines of logic
  // Re-executes on EVERY parent render
  const effectiveFontSize = useMemo(() => {
    // Expensive calculation runs even when node hasn't changed
    return calculateOptimalFontSize(content, node.size.width, node.size.height, {...});
  }, [content, node.size.width, node.size.height, ...]);
}
```

**Fix Required**:
```typescript
const TextNode = React.memo(function TextNode({ node, isSelected, ... }: TextNodeProps) {
  // Component body
}, (prevProps, nextProps) => {
  // Custom comparator - only re-render if node data actually changed
  return prevProps.node.id === nextProps.node.id &&
         prevProps.node.position.x === nextProps.node.position.x &&
         prevProps.node.position.y === nextProps.node.position.y &&
         prevProps.isSelected === nextProps.isSelected &&
         prevProps.isDragging === nextProps.isDragging;
});
```

**Components Needing Memo**:
- ✅ TextNode (750 lines)
- ✅ ConnectionRenderer (263 lines)
- ✅ NodeAnchors (individual anchor points)
- ✅ TextNodeWarningBadge
- ✅ SelectionBoundingBox

### 2. Yjs Selector Performance Disaster

**Issue**: `useYjsNodes()` performs **deep clone via JSON.parse/stringify** on every observer callback, creating new array references that break React memoization.

**Code Analysis**:
```typescript
// workspace-selectors.ts:34-78
export function useYjsNodes(): CanvasNode[] {
  const subscribe = useCallback((callback: () => void) => {
    const observer = () => {
      // ❌ DEEP CLONE ON EVERY NODE UPDATE
      cacheRef.current = Array.from(yjsNodes.values()).map(
        node => JSON.parse(JSON.stringify(node))  // 🔥 PERFORMANCE KILLER
      );
      versionRef.current++;
      callback();  // Triggers ALL components using this hook
    };
    yjsNodes.observe(observer);
    return () => yjsNodes.unobserve(observer);
  }, [yjsNodes]);
}
```

**Why This Is Bad**:
1. **Deep clone is expensive** - Serializes entire node object graph (position, size, content, style, metadata)
2. **Creates new references** - Every node gets a new object identity, breaking `===` checks
3. **Triggers cascading re-renders** - 32 nodes in production = 32 new objects every update
4. **Runs on EVERY Yjs event** - Mouse move during drag = 60 clones/second

**Better Approach**:
```typescript
export function useYjsNodes(): CanvasNode[] {
  const subscribe = useCallback((callback: () => void) => {
    const observer = (event: Y.YMapEvent<CanvasNode>) => {
      // ✅ Only update cache for CHANGED nodes
      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add' || change.action === 'update') {
          const node = yjsNodes.get(key);
          if (node) {
            // Shallow clone is sufficient - Yjs already clones internally
            cacheRef.current.set(key, { ...node });
          }
        } else if (change.action === 'delete') {
          cacheRef.current.delete(key);
        }
      });
      callback();
    };
    yjsNodes.observe(observer);
  }, [yjsNodes]);

  // Return stable Map reference, not array (use Map.values() in components)
  return useMemo(() => Array.from(cacheRef.current.values()), [cacheRef.current]);
}
```

### 3. Monolithic WorkspaceCanvas Component

**Issue**: 2,806 lines managing too many concerns - rendering, event handling, state sync, API calls, keyboard shortcuts.

**Responsibilities Breakdown**:
- Lines 1-200: State hooks and refs (18 useState, 15 useRef)
- Lines 200-600: Callback definitions (30+ useCallback hooks)
- Lines 600-1200: Event handlers (keyboard, mouse, context menus)
- Lines 1200-1800: Node/connection CRUD operations
- Lines 1800-2806: Render logic (JSX spanning 1,000 lines!)

**Render Complexity**:
```typescript
// WorkspaceCanvas.tsx:1800-2806
return (
  <div>
    {/* 1,000+ lines of nested JSX */}
    {nodes.map(node => (
      <TextNodeErrorBoundary key={node.id}>
        <TextNode
          node={node}
          isSelected={selectedNodeIds.has(node.id)}
          isDragging={dragNodeId === node.id}
          scale={viewport.scale}
          onUpdate={handleNodeUpdate}
          onDelete={handleNodeDelete}
          onSelect={handleNodeSelect}
          onDragStart={handleNodeDragStart}
          onEditingChange={handleEditingChange}
          onEditorReady={handleEditorReady}
          onTyping={handleTyping}
          onContextMenu={handleNodeContextMenu}
          onSaveNode={handleSaveNode}
        />
      </TextNodeErrorBoundary>
    ))}
    {/* More complex JSX... */}
  </div>
);
```

**Why This Hurts Performance**:
1. **Huge reconciliation tree** - React diffing 2,806 lines on every render
2. **Callback churn** - 30+ callbacks recreated on state changes (even with useCallback, deps change frequently)
3. **Poor code splitting** - Can't lazy load subsystems (toolbars, context menus, etc.)

**Recommended Split**:
```
WorkspaceCanvas (orchestrator only)
├── WorkspaceNodes (memoized list renderer)
│   └── TextNode (memoized)
├── WorkspaceConnections (memoized SVG layer)
├── WorkspaceToolbar (lazy loaded, memoized)
├── WorkspaceContextMenus (lazy loaded)
└── WorkspaceViewport (grid, zoom controls)
```

### 4. Inefficient Viewport Culling Implementation

**Issue**: Viewport culling checks run **inside render loop**, not in selector.

**Current Implementation**:
```typescript
// WorkspaceCanvas.tsx - Culling happens AFTER Yjs selector
const yjsNodesArray = useYjsNodes();  // ❌ All nodes retrieved and deep cloned
const nodes = new Map<string, CanvasNode>(
  yjsNodesArray.map(node => [node.id as string, node])
);

// Later in render...
{nodes.map(node => {
  // ❌ Culling check happens INSIDE map iteration
  if (viewportCuller.isVisible(node)) {
    return <TextNode ... />;
  }
  return null;
})}
```

**Why This Is Inefficient**:
1. **All nodes cloned** via `useYjsNodes()` even if off-screen
2. **Map iteration happens every render**
3. **Culling logic in render phase** instead of data fetching phase

**Better Approach**:
```typescript
// Create a memoized selector that culls BEFORE conversion
export function useVisibleYjsNodes(viewport: Viewport): CanvasNode[] {
  const yjsNodes = useWorkspaceStore(state => state.yjsNodes);

  return useMemo(() => {
    if (!yjsNodes) return [];

    const visible: CanvasNode[] = [];
    yjsNodes.forEach((node, key) => {
      // ✅ Cull BEFORE cloning
      if (isNodeVisible(node, viewport)) {
        visible.push({ ...node });  // Shallow clone only visible nodes
      }
    });
    return visible;
  }, [yjsNodes, viewport.offsetX, viewport.offsetY, viewport.scale]);
}

// Usage in component
const visibleNodes = useVisibleYjsNodes(viewport);  // ✅ Only visible, already culled
```

### 5. Connection Renderer Re-renders on Mouse Move

**Issue**: ConnectionRenderer recalculates ALL connection paths on every viewport change or node drag.

**Code Analysis**:
```typescript
// ConnectionRenderer.tsx:48-79
const connectionPaths = useMemo(() => {
  return connections.map(connection => {
    const sourceNode = nodesMap.get(connection.source_node_id);
    const targetNode = nodesMap.get(connection.target_node_id);

    // ❌ Expensive calculations run for ALL connections
    const startPoint = calculateAnchorPosition(sourceNode, connection.source_anchor);
    const endPoint = calculateAnchorPosition(targetNode, connection.target_anchor);
    const path = generateConnectionPath(startPoint, endPoint, ...);

    return { connection, path, startPoint, endPoint };
  });
}, [connections, nodesMap]);  // ❌ nodesMap changes on EVERY node update
```

**Why This Re-renders Too Much**:
1. **Dependency on nodesMap** - Changes whenever ANY node moves (even unrelated)
2. **No per-connection memoization** - All 30 connections recalculate when 1 node moves
3. **Runs during drag** - 60 recalculations per second during node dragging

**Fix Strategy**:
```typescript
// Create per-connection memo wrapper
const ConnectionPath = React.memo(({ connection, sourceNode, targetNode }) => {
  const path = useMemo(() => {
    const start = calculateAnchorPosition(sourceNode, connection.source_anchor);
    const end = calculateAnchorPosition(targetNode, connection.target_anchor);
    return generateConnectionPath(start, end, ...);
  }, [sourceNode.position, targetNode.position, connection.source_anchor, connection.target_anchor]);

  return <path d={path} ... />;
}, (prev, next) => {
  // ✅ Only re-render if THESE TWO nodes moved
  return prev.sourceNode.position.x === next.sourceNode.position.x &&
         prev.sourceNode.position.y === next.sourceNode.position.y &&
         prev.targetNode.position.x === next.targetNode.position.x &&
         prev.targetNode.position.y === next.targetNode.position.y;
});
```

### 6. Text Node Font Scaling Recalculation

**Issue**: `calculateOptimalFontSize()` runs on EVERY render for EVERY node, even when dimensions haven't changed.

**Code Analysis**:
```typescript
// TextNode.tsx:94-112
const effectiveFontSize = useMemo(() => {
  const manualFontSize = node.content?.format?.fontSize;
  if (manualFontSize !== undefined && manualFontSize > 0) {
    return manualFontSize;
  }

  // ❌ Expensive calculation (text measurement via canvas API)
  const autoFontSize = calculateOptimalFontSize(
    content,
    node.size.width,
    node.size.height,
    { minFontSize: 8, maxFontSize: 72, ... }
  );
  return autoFontSize;
}, [content, node.size.width, node.size.height, isNote, node.content?.format?.fontSize]);
```

**What Makes This Expensive** (`font-scaling.ts`):
```typescript
export function calculateOptimalFontSize(text: string, width: number, height: number, ...): number {
  // Creates temporary canvas element
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Binary search over font sizes (12-20 iterations)
  let low = options.minFontSize;
  let high = options.maxFontSize;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    ctx.font = `${mid}px ${options.fontFamily}`;

    // ❌ measureText() is expensive (DOM measurement)
    const metrics = ctx.measureText(text);
    // ... binary search logic
  }
}
```

**Why This Hurts Performance**:
1. **DOM manipulation** - Creates canvas element 32 times per render cycle
2. **Text measurement API** - `measureText()` forces layout/reflow
3. **Binary search overhead** - 12-20 iterations per calculation
4. **Runs for ALL nodes** - Not just the one being edited

**Optimization Strategy**:
```typescript
// Cache font sizes at module level
const fontSizeCache = new Map<string, number>();

function getCacheKey(text: string, width: number, height: number): string {
  return `${text.length}_${width}_${height}`;
}

export function calculateOptimalFontSize(...): number {
  const key = getCacheKey(text, width, height);

  // ✅ Return cached result if dimensions haven't changed
  if (fontSizeCache.has(key)) {
    return fontSizeCache.get(key)!;
  }

  // Expensive calculation only on cache miss
  const result = binarySearchFontSize(...);
  fontSizeCache.set(key, result);

  // Limit cache size (prevent memory leak)
  if (fontSizeCache.size > 200) {
    const firstKey = fontSizeCache.keys().next().value;
    fontSizeCache.delete(firstKey);
  }

  return result;
}
```

---

## React 19 Optimization Opportunities

### Server Components - Not Applicable

**Analysis**: This is a **client-side interactive canvas** requiring:
- Mouse/keyboard event handling
- Real-time drag-and-drop
- WebSocket sync (Yjs collaboration)
- Canvas rendering with requestAnimationFrame

**Verdict**: ❌ Cannot use Server Components - entire workspace MUST be 'use client'

### Suspense Boundaries - Partially Applicable

**Current Usage**: None detected

**Opportunities**:
```typescript
// ✅ Lazy load heavy components
const FloatingFormatToolbar = lazy(() => import('./FloatingFormatToolbar'));
const AlignmentToolbar = lazy(() => import('./AlignmentToolbar'));

// Wrap in Suspense
<Suspense fallback={<ToolbarSkeleton />}>
  {activeEditor && <FloatingFormatToolbar editor={activeEditor} />}
</Suspense>
```

**Benefits**:
- Reduce initial bundle size by ~50KB (toolbars only load when needed)
- Improve TTI (Time to Interactive) for initial canvas load

### Transitions - Highly Applicable

**Opportunity**: Use `useTransition()` for non-urgent state updates.

**Example**:
```typescript
const [isPending, startTransition] = useTransition();

// When dragging node, prioritize visual update over state sync
const handleNodeDrag = (nodeId: string, newPosition: Point) => {
  // ✅ Immediate: Update visual position (DOM)
  nodeRef.current.style.transform = `translate(${newPosition.x}px, ${newPosition.y}px)`;

  // ⏳ Deferred: Update Zustand/Yjs state (can lag behind)
  startTransition(() => {
    updateNode(nodeId, { position: newPosition });
  });
};
```

**Benefits**:
- Keeps drag interaction smooth (60fps) even if state updates lag
- React prioritizes user input over background state sync

---

## Architectural Recommendations

### Priority 1: Component Memoization (Immediate Impact)

**Estimated Performance Gain**: 60-80% reduction in re-renders

**Implementation Plan**:

1. **Wrap TextNode in React.memo** (1-2 hours)
```typescript
const TextNode = React.memo(
  function TextNode(props: TextNodeProps) { /* existing code */ },
  (prev, next) => {
    // Only re-render if these specific props changed
    return (
      prev.node.id === next.node.id &&
      prev.node.position.x === next.node.position.x &&
      prev.node.position.y === next.node.position.y &&
      prev.node.size.width === next.node.size.width &&
      prev.node.size.height === next.node.size.height &&
      prev.node.content === next.node.content &&
      prev.isSelected === next.isSelected &&
      prev.isDragging === next.isDragging &&
      prev.scale === next.scale
    );
  }
);
```

2. **Wrap ConnectionRenderer in React.memo** (1 hour)
3. **Create memoized ConnectionPath sub-component** (2 hours)
4. **Wrap NodeAnchors in React.memo** (1 hour)

**Testing**: Verify with React DevTools Profiler - should see 90%+ components skip re-render during drag.

### Priority 2: Fix Yjs Selector Performance (Critical)

**Estimated Performance Gain**: 40-60% reduction in Yjs overhead

**Implementation**:

```typescript
// Replace JSON.parse/stringify with shallow clones
export function useYjsNodes(): CanvasNode[] {
  const yjsNodes = useWorkspaceStore(state => state.yjsNodes);
  const cacheRef = useRef<Map<string, CanvasNode>>(new Map());

  const subscribe = useCallback((callback: () => void) => {
    if (!yjsNodes) return () => {};

    const observer = (event: Y.YMapEvent<CanvasNode>) => {
      // ✅ Only update changed nodes
      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add' || change.action === 'update') {
          const node = yjsNodes.get(key);
          if (node) {
            // ✅ Shallow clone (10x faster than JSON.parse)
            cacheRef.current.set(key, {
              ...node,
              position: { ...node.position },
              size: { ...node.size }
            });
          }
        } else if (change.action === 'delete') {
          cacheRef.current.delete(key);
        }
      });
      callback();
    };

    yjsNodes.observe(observer);
    return () => yjsNodes.unobserve(observer);
  }, [yjsNodes]);

  // ✅ Return stable array reference using useMemo
  return useMemo(
    () => Array.from(cacheRef.current.values()),
    [cacheRef.current.size]  // Only re-create array if count changed
  );
}
```

**Testing**: Measure with `performance.now()` - should see 80%+ reduction in selector execution time.

### Priority 3: Split WorkspaceCanvas (Moderate Effort)

**Estimated Development Time**: 8-12 hours

**New Architecture**:

```
WorkspaceCanvas.tsx (300 lines - orchestrator only)
├── WorkspaceNodes.tsx (memoized node list)
│   ├── Uses useVisibleYjsNodes() for culling
│   └── Renders TextNode components
├── WorkspaceConnections.tsx (memoized connection layer)
├── WorkspaceToolbars.tsx (lazy loaded)
│   ├── FloatingFormatToolbar
│   ├── AlignmentToolbar
│   └── MarkdownFloatingToolbar
├── WorkspaceContextMenus.tsx (lazy loaded)
├── WorkspaceEventHandlers.tsx (custom hook)
└── WorkspaceKeyboardShortcuts.tsx (custom hook)
```

**Example Split**:

```typescript
// WorkspaceNodes.tsx
const WorkspaceNodes = React.memo(function WorkspaceNodes({
  viewport,
  selectedNodeIds,
  dragNodeId,
  onNodeUpdate,
  onNodeDelete,
  ...callbacks
}: WorkspaceNodesProps) {
  // ✅ Only visible nodes fetched and rendered
  const visibleNodes = useVisibleYjsNodes(viewport);

  return (
    <>
      {visibleNodes.map(node => (
        <TextNodeErrorBoundary key={node.id}>
          <TextNode
            node={node}
            isSelected={selectedNodeIds.has(node.id)}
            isDragging={dragNodeId === node.id}
            {...callbacks}
          />
        </TextNodeErrorBoundary>
      ))}
    </>
  );
}, shallowEqual);  // ✅ Only re-render if props actually changed
```

### Priority 4: Optimize Font Scaling (Low Hanging Fruit)

**Estimated Time**: 2-3 hours

**Implementation**:

1. **Add LRU cache** to `calculateOptimalFontSize()` (shown above)
2. **Move calculation to Web Worker** (advanced)
```typescript
// font-scaling-worker.ts
self.onmessage = (e) => {
  const { text, width, height, options } = e.data;
  const fontSize = calculateOptimalFontSize(text, width, height, options);
  self.postMessage({ fontSize });
};

// TextNode.tsx
useEffect(() => {
  if (!worker) {
    worker = new Worker('/workers/font-scaling-worker.js');
  }

  worker.postMessage({ text: content, width: node.size.width, height: node.size.height });
  worker.onmessage = (e) => setFontSize(e.data.fontSize);
}, [content, node.size.width, node.size.height]);
```

**Benefits**:
- Cache eliminates 95%+ of redundant calculations
- Web Worker offloads computation from main thread (prevents jank during drag)

---

## State Management Analysis

### Current Zustand Store Issues

**Problem 1: Excessive State Slices**

The store manages 28+ state slices, many of which could be derived:

```typescript
interface CanvasState {
  // Core data (necessary)
  yjsNodes: Y.Map<CanvasNode> | null;
  yjsConnections: Y.Map<Connection> | null;
  viewport: { offsetX, offsetY, scale };

  // ❌ Redundant mirrors of Yjs data
  nodes: Map<string, CanvasNode>;  // Duplicate of yjsNodes
  connections: Map<string, Connection>;  // Duplicate of yjsConnections

  // ✅ Local UI state (necessary)
  selectedNodeIds: Set<string>;
  isDragging: boolean;
  dragNodeId: NodeId | null;

  // ❌ Could be derived
  remoteCursors: Map<...>;  // Could be computed from awareness.getStates()
  isOnline: boolean;  // Could be wsProvider.connected
  isSynced: boolean;  // Could be wsProvider.synced
}
```

**Recommendation**: Remove redundant state, use selectors to derive from Yjs.

**Problem 2: Immer Proxy Pollution**

```typescript
// workspace.ts:14
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

export const useWorkspaceStore = create<CanvasState>()(
  immer((set, get) => ({
    // ❌ Immer wraps everything in proxies
    nodes: new Map(),  // Becomes Immer proxy
    connections: new Map(),  // Becomes Immer proxy
  }))
);
```

**Issue**: Immer proxies don't play well with Yjs CRDT proxies. Code has extensive workarounds:

```typescript
// workspace.ts:67-84 - "sanitizeNode" function to strip proxies
function sanitizeNode(node: CanvasNode): CanvasNode {
  return {
    ...node,
    position: { x: Number(node.position.x), y: Number(node.position.y) },
    size: { width: Number(node.size.width), height: Number(node.size.height) }
  };
}
```

**Recommendation**: Remove Immer middleware for workspace store. Use vanilla Zustand with immutable updates.

---

## Render Performance Metrics (Estimated)

### Current Performance (Laptop Hardware)

**32 nodes, 30 connections, drag operation**:

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| **FPS during drag** | 20-30 fps | 60 fps | ❌ Poor |
| **Re-renders per drag** | ~2,000 | ~100 | ❌ 20x too many |
| **Yjs selector time** | 15-25ms | <2ms | ❌ 10x too slow |
| **Font calc per node** | 8-12ms | <1ms | ❌ Cacheable |
| **Connection recalc** | 30 connections | 2 connections | ❌ No memo |

### After Optimizations (Projected)

| Metric | Optimized | Improvement |
|--------|-----------|-------------|
| **FPS during drag** | 55-60 fps | +200% |
| **Re-renders per drag** | 50-100 | -95% |
| **Yjs selector time** | <2ms | -90% |
| **Font calc per node** | <0.1ms (cached) | -99% |
| **Connection recalc** | 2 connections | -93% |

---

## Code Quality Assessment

### Positive Patterns

1. **TypeScript Strict Mode** - No 'any' types, comprehensive interfaces
2. **Branded Types** - Prevents ID confusion at compile time (`NodeId`, `ConnectionId`)
3. **Error Boundaries** - `TextNodeErrorBoundary`, `WorkspaceErrorBoundary`
4. **Custom Hooks** - Good separation (useViewportManager, useWorkspaceYjs)
5. **Accessibility** - ARIA labels, keyboard shortcuts, screen reader announcements

### Areas for Improvement

1. **Console Statements**: Only 4 found (much better than Nov 2025's 47!)
2. **Component Size**: WorkspaceCanvas at 2,806 lines violates SRP
3. **Callback Dependencies**: Many useCallback hooks have unstable deps
4. **Testing**: No React Testing Library tests found for workspace components

---

## Migration Path (Phased Rollout)

### Phase 1: Quick Wins (Week 1)
**Effort**: 8-12 hours
**Impact**: 50-60% performance improvement

- [ ] Add React.memo to TextNode with custom comparator
- [ ] Add React.memo to ConnectionRenderer
- [ ] Add React.memo to NodeAnchors
- [ ] Implement font size cache in calculateOptimalFontSize()
- [ ] Add profiling instrumentation (React DevTools markers)

### Phase 2: Yjs Selector Refactor (Week 2)
**Effort**: 12-16 hours
**Impact**: 30-40% performance improvement

- [ ] Replace JSON.parse/stringify with shallow clones
- [ ] Implement per-change Yjs observer updates
- [ ] Create useVisibleYjsNodes() selector with culling
- [ ] Remove redundant Zustand mirrors (use Yjs directly)
- [ ] Add selector benchmark suite

### Phase 3: Component Architecture (Week 3-4)
**Effort**: 20-30 hours
**Impact**: Code maintainability + 10-15% performance

- [ ] Split WorkspaceCanvas into 6 focused components
- [ ] Extract event handling to custom hooks
- [ ] Lazy load toolbars and context menus
- [ ] Add Suspense boundaries around lazy components
- [ ] Implement per-connection memoization

### Phase 4: Advanced Optimizations (Week 5+)
**Effort**: 15-20 hours
**Impact**: 5-10% performance + scalability

- [ ] Move font scaling to Web Worker
- [ ] Implement virtual scrolling for 500+ nodes
- [ ] Add canvas-level memoization (OffscreenCanvas)
- [ ] Optimize Yjs transaction batching
- [ ] Add performance monitoring (Web Vitals)

---

## Testing Strategy

### Performance Regression Tests

```typescript
// __tests__/workspace-performance.test.tsx
describe('Workspace Performance', () => {
  it('should render 100 nodes in <100ms', () => {
    const start = performance.now();
    render(<WorkspaceCanvas nodes={generate100Nodes()} />);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  it('should handle drag with <5 re-renders per node', () => {
    const renderCounts = new Map<string, number>();

    // Spy on TextNode renders
    jest.spyOn(TextNode, 'render').mockImplementation((props) => {
      renderCounts.set(props.node.id, (renderCounts.get(props.node.id) || 0) + 1);
      return originalRender(props);
    });

    const { getByTestId } = render(<WorkspaceCanvas nodes={[node1, node2]} />);

    // Simulate drag
    fireEvent.mouseDown(getByTestId('node-1'));
    fireEvent.mouseMove(document, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(document);

    // Only dragged node should re-render multiple times
    expect(renderCounts.get('node-1')).toBeLessThan(10);
    expect(renderCounts.get('node-2')).toBe(1);  // Should not re-render
  });
});
```

### React DevTools Profiler

**Recommended Workflow**:

1. Enable Profiler in React DevTools
2. Start recording
3. Perform drag operation (10 nodes)
4. Stop recording
5. **Look for**:
   - Components rendering >5 times per drag
   - Components with >10ms render time
   - Unnecessary re-renders (no props changed)

**Baseline Targets**:
- TextNode: <3ms per render
- ConnectionRenderer: <5ms per render
- WorkspaceCanvas: <10ms per render

---

## Risk Assessment

### High Risk

**Breaking Changes**:
- Yjs selector refactor affects ALL components reading nodes/connections
- Removing Immer may break existing state update patterns
- Component splits may introduce subtle bugs in event propagation

**Mitigation**:
- Comprehensive integration tests before/after
- Feature flag new selectors (gradual rollout)
- Maintain backward compatibility layer during migration

### Medium Risk

**Performance Regressions**:
- Overly aggressive memoization can hide bugs
- Custom comparators may miss edge cases
- Cache invalidation bugs in font scaling

**Mitigation**:
- Extensive performance benchmarks
- Visual regression testing (Percy/Chromatic)
- Gradual rollout with monitoring

### Low Risk

**Component splits** are mostly safe (pure refactoring), but:
- May affect hot module reloading in dev
- Bundle size may increase slightly (more module boundaries)

---

## Conclusion

The workspace system has a **solid foundation** but suffers from **severe React performance issues** that make it unusable on laptop hardware. The root causes are:

1. **No memoization** on high-frequency components
2. **Inefficient Yjs selectors** (deep clones on every update)
3. **Monolithic architecture** (2,806-line component)

**The good news**: These are all **fixable** with systematic refactoring. The recommended phased approach can deliver:

- **Week 1**: 50-60% improvement (memo + font cache)
- **Week 2**: Additional 30-40% improvement (Yjs selectors)
- **Week 3-4**: Maintainability + 10-15% improvement (architecture)

**Total Projected Improvement**: **90-115% performance gain** (2-4x faster, 60fps on laptop)

---

## Appendix: File Reference

### Key Files Reviewed

**Components** (7,310 total lines):
- WorkspaceCanvas.tsx (2,806 lines)
- TextNode.tsx (750 lines)
- ConnectionRenderer.tsx (263 lines)
- RichTextEditor.tsx (540 lines)
- FloatingFormatToolbar.tsx (380 lines)

**State Management** (2,159 total lines):
- workspace.ts (1,886 lines - Zustand store)
- workspace-selectors.ts (273 lines - Yjs hooks)

**Utilities**:
- input-handler.ts (600+ lines)
- transform-manager.ts
- font-scaling.ts (performance bottleneck)
- connection-utils.ts

### Related Documentation

- [Workspace Comprehensive Analysis (Nov 2025)](../docs/features/WORKSPACE_COMPREHENSIVE_ANALYSIS_NOV_2025.md)
- [Critical Patterns](../docs/architecture/CRITICAL_PATTERNS.md)
- [React Patterns](../docs/REACT_PATTERNS.md)

---

**End of Report**
