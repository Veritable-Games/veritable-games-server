# Component Decomposition: WorkspaceCanvas

This diagram shows the current "god component" problem and the recommended decomposition strategy.

## Current Architecture (Before)

```mermaid
graph TB
    subgraph "WorkspaceCanvas.tsx (1,741 lines)"
        GC1[State Management<br/>~300 lines]
        GC2[Event Handlers<br/>~400 lines]
        GC3[Rendering Logic<br/>~500 lines]
        GC4[Collaboration<br/>~200 lines]
        GC5[Clipboard/History<br/>~150 lines]
        GC6[Context Menus<br/>~100 lines]
        GC7[Utilities<br/>~91 lines]
    end

    style GC1 fill:#e53e3e,stroke:#c53030,stroke-width:2px
    style GC2 fill:#e53e3e,stroke:#c53030,stroke-width:2px
    style GC3 fill:#e53e3e,stroke:#c53030,stroke-width:2px
```

**Problems**:
- ❌ Hard to test (no unit tests possible)
- ❌ Hard to understand (too many responsibilities)
- ❌ Hard to maintain (any change affects everything)
- ❌ Hard to optimize (React.memo ineffective)
- ❌ Hard to collaborate (merge conflicts frequent)

## Recommended Architecture (After)

```mermaid
graph TB
    subgraph "Proposed: Focused Components"
        direction TB

        WC[WorkspaceCanvas.tsx<br/>Orchestrator<br/>~200 lines]

        subgraph "Core Components (~150 lines each)"
            SM[StateManager.tsx<br/>Yjs ↔ Zustand sync]
            EH[EventHandler.tsx<br/>Input processing]
            VR[ViewportRenderer.tsx<br/>Culling & display]
            CS[CollaborationSync.tsx<br/>WebSocket & awareness]
        end

        subgraph "Feature Components (~100 lines each)"
            CB[ClipboardManager.tsx<br/>Copy/cut/paste]
            HS[HistoryManager.tsx<br/>Undo/redo]
            CM[ContextMenuManager.tsx<br/>Right-click menus]
        end

        subgraph "Utilities (~50 lines each)"
            VC[viewport-culling.ts]
            II[input-handler.ts]
            EI[export-import.ts]
        end

        WC --> SM
        WC --> EH
        WC --> VR
        WC --> CS
        WC --> CB
        WC --> HS
        WC --> CM

        EH --> II
        VR --> VC
        CB --> EI
    end

    style WC fill:#48bb78,stroke:#38a169,stroke-width:2px
    style SM fill:#4299e1,stroke:#3182ce
    style EH fill:#4299e1,stroke:#3182ce
    style VR fill:#4299e1,stroke:#3182ce
    style CS fill:#4299e1,stroke:#3182ce
```

## Component Responsibilities

```mermaid
graph LR
    subgraph "WorkspaceCanvas (Orchestrator)"
        O1[Layout Structure]
        O2[Component Composition]
        O3[Global Error Boundary]
        O4[Loading States]
    end

    subgraph "StateManager"
        S1[Yjs Document Init]
        S2[Zustand Subscriptions]
        S3[State Sync Logic]
        S4[Persistence Triggers]
    end

    subgraph "EventHandler"
        E1[Mouse Events]
        E2[Keyboard Shortcuts]
        E3[Touch Gestures]
        E4[Event Delegation]
    end

    subgraph "ViewportRenderer"
        V1[Frustum Culling]
        V2[Node Visibility]
        V3[Connection Rendering]
        V4[Selection Overlays]
    end

    subgraph "CollaborationSync"
        C1[WebSocket Connection]
        C2[Awareness Protocol]
        C3[Cursor Positions]
        C4[Online Presence]
    end

    O2 --> S1
    O2 --> E1
    O2 --> V1
    O2 --> C1

    style O2 fill:#48bb78,stroke:#38a169
```

## Data Flow Architecture

```mermaid
graph TB
    subgraph "User Interaction"
        UI1[Mouse/Keyboard/Touch]
    end

    subgraph "EventHandler Layer"
        EH1[Input Normalization]
        EH2[Gesture Recognition]
        EH3[Command Dispatch]
    end

    subgraph "State Layer"
        ST1[Zustand Actions]
        ST2[Yjs Updates]
        ST3[Validation]
    end

    subgraph "Sync Layer"
        SY1[CollaborationSync]
        SY2[PostgreSQL Debounce]
    end

    subgraph "Render Layer"
        RN1[ViewportRenderer]
        RN2[Component Updates]
        RN3[React Reconciliation]
    end

    UI1 --> EH1
    EH1 --> EH2
    EH2 --> EH3
    EH3 --> ST1
    ST1 --> ST2
    ST2 --> ST3
    ST3 --> SY1
    ST3 --> SY2
    ST3 --> RN1
    RN1 --> RN2
    RN2 --> RN3

    style EH3 fill:#4a5568,stroke:#718096
    style ST2 fill:#ecc94b,stroke:#d69e2e
    style RN1 fill:#48bb78,stroke:#38a169
```

## File Structure (Proposed)

```
/frontend/src/components/workspace/
│
├── WorkspaceCanvas.tsx              (Orchestrator - 200 lines)
│   └── Main component composition
│
├── core/
│   ├── StateManager.tsx             (150 lines)
│   ├── EventHandler.tsx             (150 lines)
│   ├── ViewportRenderer.tsx         (180 lines)
│   └── CollaborationSync.tsx        (120 lines)
│
├── features/
│   ├── ClipboardManager.tsx         (100 lines)
│   ├── HistoryManager.tsx           (100 lines)
│   └── ContextMenuManager.tsx       (80 lines)
│
├── nodes/
│   ├── TextNode.tsx                 (750 lines - already separate)
│   └── ConnectionRenderer.tsx       (300 lines - already separate)
│
├── toolbars/
│   ├── AlignmentToolbar.tsx         (Already separate ✅)
│   ├── ControlsModal.tsx            (Already separate ✅)
│   ├── CanvasContextMenu.tsx        (Already separate ✅)
│   └── NodeContextMenu.tsx          (Already separate ✅)
│
└── utils/
    ├── viewport-culling.ts          (Already separate ✅)
    ├── input-handler.ts             (Already separate ✅)
    └── export-import.ts             (Already separate ✅)
```

**Total**: ~1,080 lines (down from 1,741 = -38%)

## Testing Strategy

```mermaid
graph TB
    subgraph "Unit Tests (~40 tests)"
        UT1[StateManager Tests<br/>Yjs sync logic]
        UT2[EventHandler Tests<br/>Input processing]
        UT3[ViewportRenderer Tests<br/>Culling algorithms]
        UT4[Utility Tests<br/>Pure functions]
    end

    subgraph "Integration Tests (~15 tests)"
        IT1[State → Render flow]
        IT2[Event → State flow]
        IT3[Collaboration sync]
    end

    subgraph "E2E Tests (~8 tests)"
        E2E1[Create & edit nodes]
        E2E2[Multi-user collaboration]
        E2E3[Export/import workflow]
    end

    UT1 --> IT1
    UT2 --> IT2
    UT3 --> IT1
    UT1 --> IT3

    IT1 --> E2E1
    IT2 --> E2E1
    IT3 --> E2E2

    style UT1 fill:#4299e1,stroke:#3182ce
    style IT1 fill:#ecc94b,stroke:#d69e2e
    style E2E1 fill:#48bb78,stroke:#38a169
```

## Migration Steps

```mermaid
graph LR
    subgraph "Phase 1: Extract State (Week 1)"
        P1A[Create StateManager.tsx] --> P1B[Move Yjs setup]
        P1B --> P1C[Move Zustand logic]
        P1C --> P1D[Add unit tests]
    end

    subgraph "Phase 2: Extract Events (Week 2)"
        P2A[Create EventHandler.tsx] --> P2B[Move event listeners]
        P2B --> P2C[Move keyboard shortcuts]
        P2C --> P2D[Add unit tests]
    end

    subgraph "Phase 3: Extract Rendering (Week 3)"
        P3A[Create ViewportRenderer.tsx] --> P3B[Move culling logic]
        P3B --> P3C[Move render loop]
        P3C --> P3D[Add unit tests]
    end

    subgraph "Phase 4: Extract Features (Week 4)"
        P4A[Create feature components] --> P4B[Move clipboard/history]
        P4B --> P4C[Move context menus]
        P4C --> P4D[Add integration tests]
    end

    P1D --> P2A
    P2D --> P3A
    P3D --> P4A
    P4D --> Done[Decomposition Complete]

    style Done fill:#48bb78,stroke:#38a169,stroke-width:3px
```

## Before vs After Comparison

| Aspect | Before (God Component) | After (Decomposed) | Improvement |
|--------|------------------------|-------------------|-------------|
| **Lines per file** | 1,741 | 80-200 | -82-89% |
| **Responsibilities** | 7+ | 1-2 per component | -70% |
| **Testability** | 0% (no tests) | 60% target | +60% |
| **Merge conflicts** | High (monolithic) | Low (isolated) | -80% |
| **Onboarding time** | 2-3 days | 4-6 hours | -75% |
| **React.memo effectiveness** | Poor (deep deps) | Good (shallow) | +300% |
| **Performance** | 35-40 FPS | 45-50 FPS (with memoization) | +25% |

## Example: StateManager Component

```typescript
// StateManager.tsx (~150 lines)
import { useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/workspace';
import { setupYjsDocument } from '@/lib/workspace/yjs-setup';

interface StateManagerProps {
  workspaceId: string;
  projectSlug: string;
}

export default function StateManager({
  workspaceId,
  projectSlug
}: StateManagerProps) {
  const {
    setNodes,
    setConnections,
    setViewport
  } = useWorkspaceStore();

  useEffect(() => {
    // Initialize Yjs document
    const { doc, provider, awareness } = setupYjsDocument(
      workspaceId,
      projectSlug
    );

    // Subscribe to Yjs updates
    const nodesMap = doc.getMap('nodes');
    const connectionsMap = doc.getMap('connections');
    const viewportMap = doc.getMap('viewport');

    nodesMap.observe(() => {
      const nodes = nodesMap.toJSON(); // Fixed: no deep clone
      setNodes(nodes);
    });

    connectionsMap.observe(() => {
      setConnections(connectionsMap.toJSON());
    });

    viewportMap.observe(() => {
      setViewport(viewportMap.toJSON());
    });

    // Cleanup
    return () => {
      provider.destroy();
      doc.destroy();
    };
  }, [workspaceId, projectSlug]);

  // This component doesn't render anything
  return null;
}
```

**Benefits**:
- ✅ Single responsibility (state sync only)
- ✅ Easy to test (mock Yjs, assert Zustand calls)
- ✅ Easy to understand (150 lines vs 1,741)
- ✅ Reusable (could extract to custom hook)

## Effort Estimate

| Phase | Component | Effort | Tests |
|-------|-----------|--------|-------|
| 1 | StateManager | 3-4 hours | 2 hours |
| 2 | EventHandler | 3-4 hours | 2 hours |
| 3 | ViewportRenderer | 4-5 hours | 2 hours |
| 4 | CollaborationSync | 2-3 hours | 1 hour |
| 5 | Feature components | 3-4 hours | 2 hours |
| 6 | Integration & refactoring | 3-4 hours | 3 hours |
| **Total** | | **18-24 hours** | **12 hours** |

**Grand Total**: 30-36 hours (including comprehensive testing)

**Timeline**: 4 weeks at 8-10 hours/week

## References

- Current Implementation: `/frontend/src/components/workspace/WorkspaceCanvas.tsx` (1,741 lines)
- Zustand Store: `/frontend/src/stores/workspace.ts` (1,886 lines)
- Testing Guide: `/docs/guides/TESTING.md`
- React Patterns: `/docs/REACT_PATTERNS.md`
