# Workspace System - Issues & Fixes Quick Reference

**Last Updated**: November 27, 2025

This document provides a quick reference for all identified issues and their fixes.

---

## 🔴 Critical Issues (Fix Immediately)

### Issue #1: Debug Logging in Production

**File**: `/api/workspace/nodes/route.ts` lines 17-64

**Problem**: 11 `console.error()` debug logs

**Fix**:
```typescript
// Remove these lines:
console.error('[DEBUG] POST /api/workspace/nodes - Start');
console.error('[DEBUG] Request body:', JSON.stringify(body));
// ... and 9 more

// OR wrap in environment check:
if (process.env.NODE_ENV === 'development') {
  console.log('[DEBUG] ...');
}
```

**Effort**: 15 minutes
**Impact**: Reduces log costs, improves performance

---

### Issue #2: Stack Traces Exposed (SECURITY)

**File**: `/api/workspace/nodes/route.ts` lines 65-72

**Problem**: Returning `error.stack` to client

**Fix**:
```typescript
// Current (INSECURE):
return NextResponse.json({
  error: 'Internal server error',
  stack: error instanceof Error ? error.stack : undefined, // ❌
}, { status: 500 });

// Fixed (SECURE):
return NextResponse.json({
  error: 'Internal server error',
  details: error instanceof Error ? error.message : String(error),
  ...(process.env.NODE_ENV === 'development' && {
    stack: error instanceof Error ? error.stack : undefined
  })
}, { status: 500 });
```

**Effort**: 5 minutes
**Impact**: Fixes OWASP A05:2021 security issue

---

### Issue #3: WebSocket Server Not Deployed

**File**: `lib/workspace/yjs-setup.ts` line 31

**Problem**: WS server doesn't exist, real-time sync fails silently

**Current**:
```typescript
wsUrl: string = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'
// ⚠️ This server doesn't exist!
```

**Fix (Option 1: Deploy y-websocket server)**:
```bash
# 1. Create WebSocket server
npm install y-websocket ws

# 2. Create server/websocket-server.ts
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setupWSConnection } from 'y-websocket/bin/utils';

const wss = new WebSocketServer({ port: 3001 });
wss.on('connection', setupWSConnection);

# 3. Start server
node server/websocket-server.ts

# 4. Set environment variable
NEXT_PUBLIC_WS_URL=ws://your-domain.com:3001
```

**Fix (Option 2: Use Yjs provider service)**:
```typescript
// Use hosted Yjs provider like:
// - Liveblocks (yjs adapter)
// - Hocuspocus
// - PartyKit
```

**Effort**: 1-2 days
**Impact**: Enables real-time collaboration

---

### Issue #4: No Error Boundaries

**File**: All workspace components

**Problem**: Component crash takes down entire canvas

**Fix**:
```typescript
// 1. Create error boundary component
// components/workspace/ErrorBoundary.tsx
'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback: React.ReactNode;
  onError?: (error: Error) => void;
}

export class WorkspaceErrorBoundary extends React.Component<Props, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
    console.error('Workspace component error:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// 2. Wrap critical components
import { WorkspaceErrorBoundary } from './ErrorBoundary';

// In WorkspaceCanvas.tsx:
{nodes.map(node => (
  <WorkspaceErrorBoundary
    key={node.id}
    fallback={
      <div className="error-node">
        ⚠️ Error rendering node
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    }
    onError={(error) => {
      // Log to error tracking service
      console.error('Node crash:', node.id, error);
    }}
  >
    <TextNode {...props} />
  </WorkspaceErrorBoundary>
))}
```

**Effort**: 2-3 hours
**Impact**: Prevents full canvas crashes

---

## ⚠️ High Priority Issues

### Issue #5: God Component (WorkspaceCanvas.tsx)

**File**: `components/workspace/WorkspaceCanvas.tsx` (1,741 lines)

**Problem**: Single component handles everything

**Fix** (Refactoring Plan):

**Step 1**: Extract hooks
```typescript
// hooks/useWorkspaceAutosave.ts
export function useWorkspaceAutosave(nodes, connections, viewport) {
  const debouncedSave = useCallback(...);
  // Move all autosave logic here
  return { save, isSaving };
}

// hooks/useWorkspaceKeyboard.ts
export function useWorkspaceKeyboard(selectedNodes, actions) {
  useEffect(() => {
    // Move all keyboard handling here
  }, [selectedNodes, actions]);
}

// hooks/useWorkspaceInput.ts
export function useWorkspaceInput(containerRef, transformManager) {
  useEffect(() => {
    // Move InputHandler setup here
  }, [containerRef]);
}
```

**Step 2**: Extract components
```typescript
// CanvasInput.tsx
export function CanvasInput({ containerRef, transformManager }) {
  useWorkspaceInput(containerRef, transformManager);
  return null; // Logic-only component
}

// CanvasAutosave.tsx
export function CanvasAutosave({ nodes, connections, viewport }) {
  const { save, isSaving } = useWorkspaceAutosave(nodes, connections, viewport);
  return isSaving ? <SaveIndicator /> : null;
}

// CanvasKeyboardShortcuts.tsx
export function CanvasKeyboardShortcuts({ selectedNodes, actions }) {
  useWorkspaceKeyboard(selectedNodes, actions);
  return null; // Logic-only component
}

// CanvasContent.tsx
export function CanvasContent({ nodes, connections, scale, viewport }) {
  return (
    <>
      <CanvasGrid {...viewport} />
      <ConnectionRenderer connections={connections} />
      {nodes.map(node => <TextNode key={node.id} {...node} />)}
    </>
  );
}
```

**Step 3**: Refactor main component
```typescript
// WorkspaceCanvas.tsx (NOW ~200 lines instead of 1,741)
export function WorkspaceCanvas({ initialWorkspace }) {
  const containerRef = useRef(null);
  const transformManager = useTransformManager();

  return (
    <div ref={containerRef} className="workspace-canvas">
      <CanvasInput containerRef={containerRef} transformManager={transformManager} />
      <CanvasAutosave nodes={nodes} connections={connections} viewport={viewport} />
      <CanvasKeyboardShortcuts selectedNodes={selectedNodes} actions={actions} />
      <CanvasContent nodes={nodes} connections={connections} scale={scale} viewport={viewport} />
      <SelectionBoundingBox selection={selectedNodes} />
      <FloatingFormatToolbar />
      <CanvasContextMenu />
      <RemoteCursors />
    </div>
  );
}
```

**Effort**: 2-3 weeks
**Impact**: Massive maintainability improvement

---

### Issue #6: Type Safety Gaps

**Multiple files**

#### Gap #1: InputHandler uses `as any`

**File**: `lib/workspace/input-handler.ts` (8 locations)

**Fix**:
```typescript
// Current (UNSAFE):
export interface InputCallbacks {
  onNodeClick?: (nodeId: string, event: MouseEvent | TouchEvent) => void;
  //                      ^^^^^^ Should be NodeId
}

const node = store.getNode(nodeId as any); // ❌

// Fixed (TYPE-SAFE):
import { NodeId } from './branded-types';

export interface InputCallbacks {
  onNodeClick?: (nodeId: NodeId, event: MouseEvent | TouchEvent) => void;
  onNodeDragStart?: (nodeId: NodeId, canvasPos: Point) => void;
  onNodeDragMove?: (nodeId: NodeId, canvasPos: Point, delta: Point) => void;
  onNodeDragEnd?: (nodeId: NodeId, canvasPos: Point) => void;
}

const node = store.getNode(nodeId); // ✅ No cast needed
```

**Effort**: 30 minutes

---

#### Gap #2: Database rows untyped

**File**: `lib/workspace/service.ts`

**Fix**:
```typescript
// Current (UNSAFE):
private mapRowToNode(row: any): CanvasNode { // ❌
  return {
    id: unsafeToNodeId(row.id),
    workspace_id: unsafeToWorkspaceId(row.workspace_id),
    // ...
  };
}

// Fixed (TYPE-SAFE):
interface CanvasNodeRow {
  id: string;
  workspace_id: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  content: string; // JSON
  style: string | null; // JSON
  metadata: string | null; // JSON
  z_index: number;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

interface NodeConnectionRow {
  id: string;
  workspace_id: string;
  source_node_id: string;
  source_anchor_side: string;
  source_anchor_offset: number;
  target_node_id: string;
  target_anchor_side: string;
  target_anchor_offset: number;
  label: string | null;
  style: string | null; // JSON
  z_index: number;
  metadata: string | null; // JSON
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

private mapRowToNode(row: CanvasNodeRow): CanvasNode { // ✅ Type-safe
  // TypeScript will error if we typo a column name
}
```

**Effort**: 1 hour

---

#### Gap #3: Awareness API untyped

**File**: `stores/workspace.ts` line 50

**Fix**:
```typescript
// Current (UNSAFE):
awareness: any | null; // ❌

// Fixed (TYPE-SAFE):
import { Awareness } from 'y-protocols/awareness';

interface AwarenessUserState {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: string[]; // NodeId[]
}

interface AwarenessState {
  user?: AwarenessUserState;
}

interface CanvasState {
  // ...
  awareness: Awareness | null; // ✅
}

// Usage:
awareness.on('change', () => {
  const states = awareness.getStates() as Map<number, AwarenessState>;
  states.forEach((state, clientId) => {
    if (state.user?.cursor) {
      // ✅ Type-safe access
    }
  });
});
```

**Effort**: 45 minutes

---

#### Gap #4: NodeMetadata too permissive

**File**: `lib/workspace/types.ts`

**Fix**:
```typescript
// Current (UNSAFE):
metadata?: Record<string, any>; // ❌

// Fixed (TYPE-SAFE):
export interface NodeMetadata {
  /** Node type discriminator */
  nodeType?: 'note' | 'text';
  /** Font scale multiplier (0.1 to 5.0) */
  textScale?: number;
  /** Enable automatic resizing */
  autoResize?: boolean;
  /** Custom properties */
  custom?: Record<string, unknown>; // Explicitly scoped
}

export interface CanvasNode {
  // ...
  metadata?: NodeMetadata; // ✅
}
```

**Effort**: 30 minutes

---

## 💡 Medium Priority Issues

### Issue #7: No React.memo

**Files**: `TextNode.tsx`, `ConnectionRenderer.tsx`

**Fix**:
```typescript
// TextNode.tsx
const TextNodeComponent = ({ node, isSelected, scale }: TextNodeProps) => {
  // ... existing code
};

export const TextNode = React.memo(TextNodeComponent, (prev, next) => {
  return (
    prev.node === next.node &&
    prev.isSelected === next.isSelected &&
    prev.scale === next.scale
  );
});

// ConnectionRenderer.tsx
const ConnectionRendererComponent = ({ connections, scale }: Props) => {
  // ... existing code
};

export const ConnectionRenderer = React.memo(ConnectionRendererComponent);
```

**Effort**: 1 hour
**Impact**: Reduces unnecessary re-renders

---

### Issue #8: Cursor Updates Not Throttled

**File**: `stores/workspace.ts` lines 911-915

**Fix**:
```typescript
// Import existing throttle class
import { AwarenessThrottle } from '../lib/workspace/awareness-throttle';

// In store initialization:
const awarenessThrottle = new AwarenessThrottle(100); // 100ms throttle

// In continueDrag():
if (state.awareness) {
  awarenessThrottle.updateCursor(state.awareness, {
    x: screenCurrentPos.x,
    y: screenCurrentPos.y
  });
}
```

**Effort**: 30 minutes
**Impact**: Reduces network traffic in multi-user

---

## 🟢 Low Priority Issues

### Issue #9: Unused Import

**File**: `/api/workspace/connections/route.ts` line 14

**Fix**:
```typescript
// Remove unused import:
import { unsafeToUserId } from '@/types/branded'; // ❌ Remove this

// Or fix the usage on line 81:
// Current:
unsafeToUserId(user.id)
// Should be:
userIdFromNumber(user.id)
```

**Effort**: 2 minutes

---

## Quick Fix Checklist

**Can be done in 1 day:**

- [ ] Remove debug logging (15 min)
- [ ] Hide stack traces in production (5 min)
- [ ] Fix InputHandler type assertions (30 min)
- [ ] Define database row types (1 hour)
- [ ] Type Awareness API (45 min)
- [ ] Define NodeMetadata interface (30 min)
- [ ] Add React.memo to components (1 hour)
- [ ] Remove unused import (2 min)
- [ ] Add cursor throttling (30 min)

**Total:** ~5 hours for all quick fixes

---

**Can be done in 1 week:**

- [ ] Add error boundaries (2-3 hours)
- [ ] Extract 3 custom hooks from WorkspaceCanvas (1-2 days)
- [ ] Deploy WebSocket server (if needed) (1-2 days)

---

**Requires dedicated sprint (2-4 weeks):**

- [ ] Split WorkspaceCanvas into focused components
- [ ] Full multi-user testing and optimization
- [ ] Add comprehensive test suite

---

## Effort Summary

| Category | Time | Impact |
|----------|------|--------|
| **Security Fixes** | 30 min | Critical |
| **Type Safety Fixes** | 3-4 hours | High |
| **Performance Fixes** | 2-3 hours | Medium |
| **Error Handling** | 2-3 hours | High |
| **Component Refactoring** | 2-3 weeks | Very High |
| **Multi-User Setup** | 1-2 weeks | High |

---

**Last Updated**: November 27, 2025
