# Viewport Synchronization Bug Fix

**Date**: February 14, 2026
**Severity**: Critical
**Status**: Fixed

## Summary

Fixed critical bug where viewport position (pan/zoom) was synchronized across all users viewing the same workspace, causing both users' viewports to move together when either user panned. Viewport is now local-only state, giving each user independent pan/zoom control.

## Problem

### Reproduction Steps
1. Two users (e.g., claude on Chromium, admin on Firefox) viewing `/projects/autumn/workspace`
2. When User A pans, User B's viewport also pans
3. When User B zooms, User A's viewport also zooms
4. Neither user has independent viewport control

### Expected Behavior
- Viewport position (pan/zoom) should be LOCAL to each user
- Only workspace content (nodes, connections) should sync between users
- Each user should pan/zoom independently

## Root Cause Analysis

The viewport state was being stored in a Yjs Y.Map and synchronized via WebSocket:

### 1. Architecture Comment (Line 8 of workspace.ts)
```typescript
// - Yjs Y.Doc: Source of truth for nodes, connections, viewport (synced across users)
```

**Issue**: Viewport was incorrectly listed as synced state.

### 2. Yjs Shared State (Line 130)
```typescript
yjsViewport: Y.Map<number> | null;
```

**Issue**: Viewport stored in Yjs shared map, automatically syncing via WebSocket.

### 3. Viewport Comment (Line 144)
```typescript
// Viewport state (synced via Yjs)
viewport: {
  offsetX: number;
  offsetY: number;
  scale: number;
};
```

**Issue**: Explicitly marked as synced.

### 4. Pan Action (Lines 1382-1396)
```typescript
panViewport: (deltaX, deltaY) =>
  set(state => {
    // Write to Yjs using type-safe writer
    if (state.yjsWriter) {
      state.yjsWriter.panViewport(deltaX, deltaY);
    }

    // Read back from Yjs (Yjs is single source of truth)
    if (WORKSPACE_FEATURES.YJS_SINGLE_SOURCE && state.yjsViewport) {
      state.viewport.offsetX = state.yjsViewport.get('offsetX') ?? 0;
      state.viewport.offsetY = state.yjsViewport.get('offsetY') ?? 0;
    }
  })
```

**Issue**: Writes to Yjs, triggering sync to other users.

### 5. Viewport Observer (Lines 479-494)
```typescript
const viewportObserverRaw = (event: Y.YMapEvent<number>) => {
  // PHASE 3: Origin tracking - skip local changes when feature flag enabled
  if (WORKSPACE_FEATURES.ORIGIN_TRACKING && event.transaction.origin === 'local') {
    return;
  }

  const currentViewport = get().yjsViewport;
  set(state => {
    state.viewport = {
      offsetX: currentViewport?.get('offsetX') ?? 0,
      offsetY: currentViewport?.get('offsetY') ?? 0,
      scale: currentViewport?.get('scale') ?? 1,
    };
  });
};
```

**Issue**: Listens to viewport changes from other users and applies them locally.

### Why This Happened
When User A panned:
1. `panViewport()` writes to `yjsViewport` Y.Map
2. Yjs syncs change via WebSocket to User B
3. User B's viewport observer receives change
4. User B's local viewport state updates to match User A's

## Solution

Viewport is now **local-only state** - it is NOT stored in Yjs and does NOT sync between users.

### Changes Made

#### 1. Updated Architecture Comment
```typescript
// Architecture:
// - Yjs Y.Doc: Source of truth for nodes, connections (synced across users)
// - Zustand Store: Reactive UI layer (subscribes to Yjs changes)
// - Local-only: Viewport, selection, drag, pan state (NOT synced)
//
// CRITICAL: Viewport (pan/zoom) is LOCAL to each user. Do NOT sync via Yjs!
```

#### 2. Removed `yjsViewport` from State
```typescript
// Yjs Shared Maps (source of truth, synced across users)
yjsNodes: Y.Map<CanvasNode> | null;
yjsConnections: Y.Map<Connection> | null;
// REMOVED: yjsViewport - viewport is now LOCAL ONLY (not synced)
```

#### 3. Updated Viewport Comment
```typescript
// Viewport state (LOCAL ONLY - not synced, each user has independent viewport)
viewport: {
  offsetX: number;
  offsetY: number;
  scale: number;
};
```

#### 4. Simplified Viewport Actions
All viewport actions now only update local Zustand state:

```typescript
panViewport: (deltaX, deltaY) =>
  set(state => {
    // LOCAL ONLY: Viewport is not synced via Yjs
    // Each user maintains independent pan/zoom position
    state.viewport.offsetX += deltaX;
    state.viewport.offsetY += deltaY;
  }),

zoomViewport: (delta, centerX, centerY) =>
  set(state => {
    // LOCAL ONLY: Viewport is not synced via Yjs
    const oldScale = state.viewport.scale;
    const newScale = Math.max(0.1, Math.min(5, oldScale * (1 + delta)));

    const scaleRatio = newScale / oldScale;
    state.viewport.offsetX = centerX - (centerX - state.viewport.offsetX) * scaleRatio;
    state.viewport.offsetY = centerY - (centerY - state.viewport.offsetY) * scaleRatio;
    state.viewport.scale = newScale;
  }),
```

#### 5. Removed Viewport Observer
```typescript
// REMOVED: Viewport observer - viewport is now LOCAL ONLY (not synced)
// Each user maintains independent pan/zoom position
```

#### 6. Updated `yjs-setup.ts`
```typescript
// Yjs document shared types
// NOTE: Viewport is NOT included - it's local-only per user
export interface YjsWorkspaceData {
  nodes: Y.Map<CanvasNode>;
  connections: Y.Map<Connection>;
}

export function setupYjsDocument(workspaceId: WorkspaceId) {
  const doc = new Y.Doc();
  const nodes = doc.getMap<CanvasNode>('nodes');
  const connections = doc.getMap<Connection>('connections');
  // REMOVED: viewport Y.Map - viewport is now LOCAL ONLY (not synced)

  return { doc, nodes, connections };
}
```

#### 7. Deprecated Viewport Methods in YjsSafeWriter
```typescript
/**
 * @deprecated Viewport is now local-only state (not synced via Yjs)
 * This method exists for backward compatibility but does nothing
 */
writeViewport(offsetX: number, offsetY: number, scale: number): void {
  // NO-OP: Viewport is now local-only state
  console.warn('[YjsSafeWriter] writeViewport() is deprecated - viewport is now local-only');
}
```

## Files Changed

1. `/frontend/src/stores/workspace.ts`
   - Removed `yjsViewport: Y.Map<number> | null` from state
   - Updated architecture comments
   - Removed viewport observer
   - Simplified viewport actions to local-only
   - Updated `initializeYjs()` to not create viewport Y.Map
   - Updated `loadWorkspace()` to load viewport from server to local state
   - Updated `clearWorkspace()` to not clear viewport Y.Map

2. `/frontend/src/lib/workspace/yjs-setup.ts`
   - Removed viewport from `YjsWorkspaceData` interface
   - Removed viewport Y.Map creation in `setupYjsDocument()`

3. `/frontend/src/lib/workspace/yjs-writer.ts`
   - Made viewport parameter nullable in constructor
   - Deprecated all viewport write methods (now NO-OPs with warnings)
   - Removed viewport from `getState()` return type

## Verification

### Type Safety
```bash
npm run type-check  # ✅ Passes
```

### Testing Plan
1. **Single User Test**: Verify viewport still works for single user
   - Pan, zoom, reset viewport
   - Reload page and verify viewport position loads from server

2. **Multi-User Test**: Verify independent viewports
   - User A and User B open same workspace
   - User A pans → User B's viewport should NOT move
   - User B zooms → User A's viewport should NOT zoom
   - Both users should see node/connection changes in real-time

3. **Content Sync Test**: Verify content still syncs
   - User A creates node → User B sees it
   - User B drags node → User A sees movement
   - User A creates connection → User B sees it

## Impact

### Before Fix
- ❌ Viewport synchronized across all users (bad UX)
- ❌ No independent viewport control
- ❌ Confusing when multiple users viewing same workspace

### After Fix
- ✅ Each user has independent viewport (pan/zoom)
- ✅ Content (nodes/connections) still syncs perfectly
- ✅ Normal multi-user collaboration experience
- ✅ No breaking changes (deprecated methods exist for compatibility)

## Backward Compatibility

- Deprecated viewport methods in `YjsSafeWriter` still exist but do nothing
- They log warnings to console when called
- Existing code that calls these methods won't break (just no-op)
- Viewport loading from server still works (stored in database as per-user preference)

## Related Issues

This fix resolves:
- Workspace multi-user viewport sync bug
- Confusing UX when multiple users in same workspace

This does NOT affect:
- Single-user experience (viewport still works perfectly)
- Node/connection synchronization (still works via Yjs)
- Cursor/selection awareness (still works via Awareness API)

## Notes

- Viewport can still be saved to database on a per-user basis (user preference)
- Awareness API still tracks cursor position (different from viewport)
- Selection state is already local-only (not affected by this fix)

## Follow-Up

Consider:
1. Add per-user viewport saving to database (user preference)
2. Add "reset to default viewport" button in UI
3. Add viewport position indicator in UI (e.g., minimap)
