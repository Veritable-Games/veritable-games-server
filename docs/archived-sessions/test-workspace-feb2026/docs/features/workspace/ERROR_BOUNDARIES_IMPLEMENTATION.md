# Workspace Error Boundaries - Implementation Guide

**Date**: November 27, 2025
**Status**: ✅ Complete
**Coverage**: Workspace-level + Node-level error handling

---

## Overview

Error boundaries have been implemented to prevent component crashes from taking down the entire workspace application. This provides graceful error handling at two levels:

1. **Workspace Level**: Catches errors in the entire workspace canvas
2. **Node Level**: Catches errors in individual TextNode components

---

## Architecture

### Component Hierarchy

```
WorkspaceErrorBoundary (workspace-level)
└─ WorkspaceCanvas
   ├─ CanvasGrid
   ├─ ConnectionRenderer
   ├─ TextNodeErrorBoundary (node-level)
   │  └─ TextNode #1
   ├─ TextNodeErrorBoundary (node-level)
   │  └─ TextNode #2
   └─ ... (more nodes)
```

### Error Isolation

- **Workspace crash** → Shows full-screen error UI with reload option
- **Single node crash** → Shows inline error in place of the crashed node, workspace continues working
- **Connection crash** → (Future) Could add ConnectionErrorBoundary if needed

---

## Components

### 1. WorkspaceErrorBoundary

**File**: `src/components/workspace/WorkspaceErrorBoundary.tsx`

**Purpose**: Top-level error boundary for the entire workspace

**Features**:
- ✅ Catches all rendering errors in workspace
- ✅ Displays friendly error UI (production) or detailed error (development)
- ✅ Provides "Try Again" button to retry rendering
- ✅ Provides "Reload Page" button after multiple failures
- ✅ Logs errors with full context (workspace ID, component stack)
- ✅ Optional custom error handler for analytics/reporting
- ✅ Four fallback types: workspace, node, connection, minimal

**Props**:
```typescript
interface Props {
  children: ReactNode;
  fallbackType?: 'workspace' | 'node' | 'connection' | 'minimal';
  fallback?: ReactNode; // Custom fallback UI
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  workspaceId?: string;
  nodeId?: string;
}
```

**Example Usage**:
```typescript
<WorkspaceErrorBoundary
  fallbackType="workspace"
  workspaceId={workspace.id}
  onError={(error, errorInfo) => {
    // Send to error tracking service
    trackError(error, { workspace: workspace.id, ...errorInfo });
  }}
>
  <WorkspaceCanvas {...props} />
</WorkspaceErrorBoundary>
```

---

### 2. TextNodeErrorBoundary

**File**: `src/components/workspace/TextNodeErrorBoundary.tsx`

**Purpose**: Specialized error boundary wrapper for individual TextNode components

**Features**:
- ✅ Catches errors in single node rendering
- ✅ Shows inline error UI with same position/size as node
- ✅ Preserves workspace functionality (other nodes still work)
- ✅ Provides "Delete Node" button to remove broken node
- ✅ Provides "Reload Page" button as fallback
- ✅ Logs detailed node context (ID, position, size)

**Props**:
```typescript
interface TextNodeErrorBoundaryProps {
  children: ReactNode;
  nodeId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  onDelete?: () => void;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}
```

**Example Usage**:
```typescript
<TextNodeErrorBoundary
  nodeId={node.id}
  position={node.position}
  size={node.size}
  onDelete={() => handleNodeDelete(node.id)}
>
  <TextNode {...props} />
</TextNodeErrorBoundary>
```

---

## Implementation Details

### WorkspaceCanvas Integration

**Location**: `src/components/workspace/WorkspaceCanvas.tsx`

**Changes Made**:

1. **Imports** (lines 25-26):
```typescript
import TextNodeErrorBoundary from './TextNodeErrorBoundary';
import WorkspaceErrorBoundary from './WorkspaceErrorBoundary';
```

2. **Workspace-level wrapping** (lines 1485-1495, 1762-1763):
```typescript
return (
  <WorkspaceErrorBoundary
    fallbackType="workspace"
    workspaceId={initialWorkspace?.workspace.id || 'unknown'}
    onError={(error, errorInfo) => {
      console.error('Workspace crashed:', {
        workspaceId: initialWorkspace?.workspace.id,
        error,
        errorInfo,
      });
    }}
  >
    <div ref={containerRef} className="...">
      {/* All workspace content */}
    </div>
  </WorkspaceErrorBoundary>
);
```

3. **Node-level wrapping** (lines 1426-1449):
```typescript
<TextNodeErrorBoundary
  nodeId={node.id}
  position={node.position}
  size={node.size}
  onDelete={() => handleNodeDelete(node.id)}
>
  <TextNode
    node={node}
    isSelected={selectedNodeIds.has(node.id)}
    {...otherProps}
  />
</TextNodeErrorBoundary>
```

---

## Error Handling Flow

### Workspace-Level Error

1. Error occurs in workspace component (e.g., ConnectionRenderer crashes)
2. WorkspaceErrorBoundary catches error
3. Calls `componentDidCatch(error, errorInfo)`
4. Logs error with workspace context
5. Updates state: `hasError = true`
6. Renders fallback UI (full-screen error page)
7. User clicks "Try Again" → resets state → retries rendering
8. If error persists → user clicks "Reload Page" → `window.location.reload()`

### Node-Level Error

1. Error occurs in TextNode component (e.g., RichTextEditor crashes)
2. TextNodeErrorBoundary catches error
3. Calls `componentDidCatch(error, errorInfo)`
4. Logs error with node context (ID, position, size)
5. Updates state: `hasError = true`
6. Renders inline fallback UI (error box with same dimensions)
7. User has two options:
   - "Reload Page" → `window.location.reload()`
   - "Delete Node" → calls `onDelete()` → removes broken node from workspace

**Critical Benefit**: Other nodes continue working normally!

---

## Error UI Variations

### Production Mode

**Workspace Error**:
- ❌ Shows generic message: "Something went wrong loading the workspace"
- ❌ Does NOT show error details, stack traces, or component stack
- ✅ Shows "Try Again" and "Reload Page" buttons
- ✅ Friendly, user-facing language

**Node Error**:
- ❌ Shows: "Node Error - This node couldn't be rendered"
- ❌ Does NOT show error details
- ✅ Shows "Reload Page" and "Delete Node" buttons

### Development Mode

**Workspace Error**:
- ✅ Shows error message: `error.message`
- ✅ Shows component stack (expandable details)
- ✅ Shows error count
- ✅ Helpful for debugging

**Node Error**:
- ✅ Shows error message
- ✅ Shows node ID for debugging
- ✅ Helps developers identify which node is broken

---

## Testing Error Boundaries

### Manual Testing

1. **Test Workspace Crash**:
   ```typescript
   // Temporarily add to WorkspaceCanvas.tsx
   useEffect(() => {
     throw new Error('Test workspace error');
   }, []);
   ```
   Expected: Full-screen error UI appears

2. **Test Node Crash**:
   ```typescript
   // Temporarily add to TextNode.tsx
   if (node.id === 'specific-node-id') {
     throw new Error('Test node error');
   }
   ```
   Expected: Single node shows error, others still render

3. **Test Error Recovery**:
   - Click "Try Again" → should attempt to re-render
   - Click "Delete Node" → should remove broken node
   - Click "Reload Page" → should refresh browser

### Automated Testing (Future)

```typescript
// Example test (not implemented yet)
describe('WorkspaceErrorBoundary', () => {
  it('should catch errors and display fallback UI', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <WorkspaceErrorBoundary fallbackType="workspace">
        <ThrowError />
      </WorkspaceErrorBoundary>
    );

    expect(screen.getByText(/Workspace Error/i)).toBeInTheDocument();
    expect(screen.getByText(/Try Again/i)).toBeInTheDocument();
  });
});
```

---

## Integration with Error Tracking

### Adding Sentry / LogRocket / etc.

Modify `WorkspaceErrorBoundary.tsx` (line 85-88):

```typescript
// In production, send to error tracking service
if (process.env.NODE_ENV === 'production') {
  // Example: Sentry
  Sentry.captureException(error, {
    contexts: {
      workspace: {
        id: this.props.workspaceId,
        nodeId: this.props.nodeId,
      },
      react: {
        componentStack: errorInfo.componentStack,
      },
    },
  });

  // Example: LogRocket
  LogRocket.captureException(error, {
    tags: {
      workspace: this.props.workspaceId,
      errorBoundary: this.props.fallbackType,
    },
  });
}
```

---

## Performance Considerations

### Error Boundary Overhead

- **Minimal**: React error boundaries have negligible performance impact
- **No runtime cost** when no errors occur
- **Memory**: Each boundary adds ~1KB of component state

### Rendering Cost

- **Workspace boundary**: 1 extra wrapper component (minimal)
- **Node boundaries**: 1 wrapper per node
  - Example: 100 nodes = 100 error boundaries = ~100KB total overhead
  - This is acceptable for the safety it provides

---

## Known Limitations

1. **Cannot catch errors in**:
   - Event handlers (use try/catch)
   - Async code (use try/catch or .catch())
   - Server-side rendering
   - Errors in the error boundary itself

2. **React 18 behavior**:
   - Error boundaries trigger Suspense boundaries
   - May cause loading states to show

3. **Development mode**:
   - React shows error overlay in addition to error boundary
   - Press ESC to dismiss React's overlay and see boundary UI

---

## Future Improvements

### 1. Connection Error Boundaries

Add similar error handling for connection rendering:

```typescript
<ConnectionErrorBoundary connectionId={conn.id}>
  <Connection {...props} />
</ConnectionErrorBoundary>
```

### 2. Error Analytics

Track error patterns:
- Which nodes crash most frequently?
- What errors are most common?
- Browser/OS correlation?

### 3. Automatic Recovery

Try to auto-fix common errors:
- Invalid content JSON → reset to default
- Missing required props → fill with defaults
- Corrupted state → reload from database

### 4. User Notification

Add toast notifications for background errors:
```typescript
onError={(error) => {
  toast.error('A node encountered an error and was hidden');
}}
```

---

## Files Changed

- ✅ `src/components/workspace/WorkspaceErrorBoundary.tsx` (new, 283 lines)
- ✅ `src/components/workspace/TextNodeErrorBoundary.tsx` (new, 101 lines)
- ✅ `src/components/workspace/WorkspaceCanvas.tsx` (modified, +12 lines)

---

## Benefits

**Before Error Boundaries**:
- ❌ Any component crash → entire workspace disappears
- ❌ User loses all work, has to reload page
- ❌ No error context for debugging
- ❌ Poor user experience

**After Error Boundaries**:
- ✅ Workspace crashes → friendly error UI, can retry
- ✅ Single node crashes → other nodes still work
- ✅ Detailed error logs with context
- ✅ User can recover without losing work
- ✅ Can delete broken nodes without reloading
- ✅ Production-ready error handling

---

**Implemented by**: Claude Code
**Tested by**: Manual testing
**Production Ready**: Yes ✅
**TypeScript**: 0 errors ✅
