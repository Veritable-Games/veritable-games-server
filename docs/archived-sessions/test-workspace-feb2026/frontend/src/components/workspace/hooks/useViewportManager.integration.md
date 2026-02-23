# useViewportManager Integration Guide

This document shows how to integrate the `useViewportManager` hook into
`WorkspaceCanvas.tsx`.

## Phase 2.1: Viewport Manager Hook Integration

### Step 1: Import the Hook

```typescript
import { useViewportManager } from './hooks/useViewportManager';
```

### Step 2: Replace Viewport-Related Refs and State

**BEFORE (lines 54-57, 129-130):**

```typescript
const transformManagerRef = useRef<TransformManager | null>(null);
const viewportCullerRef = useRef<ViewportCuller | null>(null);
const animationFrameRef = useRef<number | null>(null);
const viewportSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
```

**AFTER:**

```typescript
// Initialize viewport manager hook
const viewportManager = useViewportManager({
  initialViewport: viewport,
  workspaceId,
  isLoading,
  onViewportChange: transform => {
    updateViewport(transform);
  },
});

// For backward compatibility, expose refs that InputHandler needs
const transformManagerRef = viewportManager.transformManagerRef;
const viewportCullerRef = viewportManager.viewportCullerRef;
```

### Step 3: Remove Duplicate Viewport Initialization Code

**DELETE these useEffects (lines 875-905):**

```typescript
// ❌ DELETE - now handled by useViewportManager
useEffect(() => {
  const transformManager = new TransformManager(
    viewport || { offsetX: 0, offsetY: 0, scale: 1.0 }
  );
  transformManagerRef.current = transformManager;

  const viewportCuller = new ViewportCuller();
  viewportCullerRef.current = viewportCuller;
}, []);

// ❌ DELETE - now handled by useViewportManager
useEffect(() => {
  if (!isLoading && transformManagerRef.current && viewport) {
    transformManagerRef.current.setTransform(viewport);
    const cssTransform = transformManagerRef.current.toCSSTransform();
    if (canvasLayerRef.current) {
      canvasLayerRef.current.style.transform = cssTransform;
    }
    if (gridLayerRef.current) {
      gridLayerRef.current.style.transform = cssTransform;
    }
  }
}, [isLoading, viewport]);
```

### Step 4: Remove Old startAnimationLoop

**DELETE (lines 838-870):**

```typescript
// ❌ DELETE - now in useViewportManager
const startAnimationLoop = useCallback(() => {
  if (animationFrameRef.current !== null) return;

  const animate = () => {
    if (transformManagerRef.current) {
      const hasChanges = transformManagerRef.current.update();

      if (hasChanges) {
        const transform = transformManagerRef.current.toCSSTransform();

        if (canvasLayerRef.current) {
          canvasLayerRef.current.style.transform = transform;
        }

        if (gridLayerRef.current) {
          gridLayerRef.current.style.transform = transform;
        }

        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    }
  };

  animationFrameRef.current = requestAnimationFrame(animate);
}, []);
```

**REPLACE with hook method:**

```typescript
// ✅ Use hook's startAnimationLoop
const startAnimationLoop = useCallback(() => {
  viewportManager.startAnimationLoop(canvasLayerRef, gridLayerRef);
}, [viewportManager]);
```

### Step 5: Remove Old debouncedSaveViewport

**DELETE (lines 237-266):**

```typescript
// ❌ DELETE - now in useViewportManager
const debouncedSaveViewport = useCallback(
  (
    transform: { offsetX: number; offsetY: number; scale: number },
    delay: number = 1500
  ) => {
    if (!workspaceId) return;

    if (viewportSaveTimerRef.current) {
      clearTimeout(viewportSaveTimerRef.current);
    }

    viewportSaveTimerRef.current = setTimeout(async () => {
      try {
        await fetchWithCSRF('/api/workspace/viewport', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            transform,
          }),
        });
        logger.info('Viewport saved:', transform);
      } catch (error) {
        logger.error('Failed to save viewport:', error);
      }

      viewportSaveTimerRef.current = null;
    }, delay);
  },
  [workspaceId]
);
```

**NOTE:** This is now handled internally by `useViewportManager`

### Step 6: Update renderNodes to Use Hook Method

**BEFORE (lines 1484-1497):**

```typescript
const renderNodes = useCallback(() => {
  if (
    !containerRef.current ||
    !viewportCullerRef.current ||
    !transformManagerRef.current
  )
    return null;

  const rect = containerRef.current.getBoundingClientRect();
  const viewportBounds = transformManagerRef.current.getVisibleBounds(
    rect.width,
    rect.height,
    viewportCullerRef.current.getMargin()
  );

  if (!viewportBounds) return null;

  const visibleNodes = viewportCullerRef.current.cullNodes(
    nodes,
    viewportBounds
  );
  // ... rest of function
}, [nodes, viewportCullerRef, transformManagerRef]);
```

**AFTER:**

```typescript
const renderNodes = useCallback(() => {
  if (!containerRef.current) return null;

  const rect = containerRef.current.getBoundingClientRect();
  const visibleNodes = viewportManager.getVisibleNodes(
    nodes,
    rect.width,
    rect.height
  );

  // ... rest of function
}, [nodes, viewportManager]);
```

### Step 7: Apply Transform on Mount

**BEFORE (lines 1222-1231):**

```typescript
useEffect(() => {
  startAnimationLoop();

  return () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };
}, [startAnimationLoop]);
```

**AFTER:**

```typescript
useEffect(() => {
  // Apply initial transform to layers
  viewportManager.applyTransformToLayers(canvasLayerRef, gridLayerRef);

  // Start animation loop
  startAnimationLoop();
}, [viewportManager, startAnimationLoop]);
```

### Step 8: Update InputHandler Configuration

The InputHandler configuration can stay the same because we expose
`transformManagerRef` for backward compatibility. No changes needed!

```typescript
// ✅ Still works - uses exposed transformManagerRef
const inputHandler = new InputHandler(
  containerRef.current,
  transformManagerRef.current,
  {
    // ... callbacks
  }
);
```

## Benefits of This Refactor

1. **Reduced Component Size**: Removed ~180 lines of viewport management code
   from WorkspaceCanvas
2. **Better Separation of Concerns**: Viewport logic is now encapsulated in a
   dedicated hook
3. **Reusability**: The hook can be reused in other canvas components
4. **Easier Testing**: Viewport logic can be unit tested independently
5. **Improved Maintainability**: Changes to viewport behavior are isolated to
   one file

## Migration Strategy

1. ✅ Create `useViewportManager` hook (DONE)
2. ✅ Type-check hook (DONE)
3. ⏳ Integrate into WorkspaceCanvas (IN PROGRESS)
4. ⏳ Run type-check and fix any errors
5. ⏳ Test manually to verify no regressions
6. ⏳ Create unit tests for the hook
7. ⏳ Remove old code that's been replaced

## Potential Issues and Solutions

### Issue 1: InputHandler Compatibility

**Problem**: InputHandler expects refs, not hook methods **Solution**: Expose
`transformManagerRef` and `viewportCullerRef` from hook for backward
compatibility

### Issue 2: Callback Recreation

**Problem**: Callbacks in the hook might be recreated too often **Solution**:
Use refs for stable callbacks where needed, or accept minor recreation

### Issue 3: Animation Loop Timing

**Problem**: Animation loop might not start correctly **Solution**: Test
thoroughly and ensure `startAnimationLoop` is called at the right time

## Next Steps

After integration is complete:

1. Run comprehensive type-check
2. Manual testing of pan/zoom/node creation
3. Create unit tests for `useViewportManager`
4. Move to next refactoring step (InputHandler extraction)
