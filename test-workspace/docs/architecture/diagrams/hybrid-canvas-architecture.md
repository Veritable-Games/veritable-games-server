# Hybrid Canvas Architecture (Proposed)

This diagram details the proposed hybrid rendering architecture that combines DOM for active editing with Canvas for static rendering.

## High-Level Architecture

```mermaid
graph TB
    subgraph "User Interaction Layer"
        UI1[Mouse/Touch Events]
        UI2[Keyboard Input]
    end

    subgraph "State Management"
        SM1[Zustand Store]
        SM2[Active Node ID]
        SM3[Viewport State]
        SM4[Render Mode]
    end

    subgraph "Rendering Decision Engine"
        RD1{Node State?}
        RD2{In Viewport?}
        RD3{Performance<br/>Threshold?}
    end

    subgraph "DOM Rendering Path"
        DOM1[React Component<br/>TextNode]
        DOM2[Tiptap Editor]
        DOM3[CSS Transforms]
        DOM4[Browser Layout]
    end

    subgraph "Canvas Rendering Path"
        CV1[Canvas Context<br/>2D]
        CV2[Offscreen Canvas<br/>Worker]
        CV3[Batch Rendering]
        CV4[GPU Composite]
    end

    subgraph "Output"
        OUT1[DOM Layer<br/>z-index: 100]
        OUT2[Canvas Layer<br/>z-index: 1]
        OUT3[Final Composite]
    end

    UI1 --> SM1
    UI2 --> SM1
    SM1 --> RD1

    RD1 -->|Editing| DOM1
    RD1 -->|Static| RD2
    RD2 -->|Yes| RD3
    RD2 -->|No| Skip[Skip]
    RD3 -->|<100 nodes| DOM1
    RD3 -->|>100 nodes| CV1

    DOM1 --> DOM2
    DOM2 --> DOM3
    DOM3 --> DOM4
    DOM4 --> OUT1

    CV1 --> CV2
    CV2 --> CV3
    CV3 --> CV4
    CV4 --> OUT2

    OUT1 --> OUT3
    OUT2 --> OUT3

    style RD1 fill:#4a5568,stroke:#718096,stroke-width:2px
    style DOM1 fill:#ecc94b,stroke:#d69e2e,stroke-width:2px
    style CV1 fill:#48bb78,stroke:#38a169,stroke-width:2px
    style OUT3 fill:#4299e1,stroke:#3182ce,stroke-width:2px
```

## Detailed Rendering Flow

```mermaid
sequenceDiagram
    participant User
    participant EventHandler
    participant Zustand
    participant RenderManager
    participant DOMRenderer
    participant CanvasRenderer
    participant Display

    User->>EventHandler: Click node to edit
    EventHandler->>Zustand: setActiveNode(nodeId)
    Zustand->>RenderManager: State change

    RenderManager->>RenderManager: Categorize nodes<br/>(active vs static)

    par Active Node (DOM)
        RenderManager->>DOMRenderer: Render active node
        DOMRenderer->>DOMRenderer: Mount Tiptap editor
        DOMRenderer->>Display: Draw @ z-index 100
    and Static Nodes (Canvas)
        RenderManager->>CanvasRenderer: Render static nodes
        CanvasRenderer->>CanvasRenderer: Batch draw calls
        CanvasRenderer->>Display: Draw @ z-index 1
    end

    Display-->>User: Composite view

    User->>EventHandler: Type text
    EventHandler->>DOMRenderer: Update editor
    DOMRenderer->>Display: Update active node only
    Note over CanvasRenderer: No redraw needed ✅

    User->>EventHandler: Click canvas
    EventHandler->>Zustand: setActiveNode(null)
    Zustand->>RenderManager: State change
    RenderManager->>CanvasRenderer: Re-render all to canvas
    RenderManager->>DOMRenderer: Unmount editor
```

## Node State Machine

```mermaid
stateDiagram-v2
    [*] --> Static
    Static --> EditMode: User clicks
    EditMode --> Static: Click away
    Static --> Dragging: Mouse down + move
    Dragging --> Static: Mouse up
    EditMode --> Dragging: Drag while editing
    Dragging --> EditMode: Release

    note right of Static
        Rendered on Canvas
        Batched with other nodes
        Fast, GPU-accelerated
    end note

    note right of EditMode
        Rendered in DOM
        Tiptap editor active
        Full text editing
    end note

    note right of Dragging
        Rendered in DOM
        Real-time position update
        Smooth 60 FPS
    end note
```

## Performance Optimization Strategy

```mermaid
graph TB
    subgraph "Frame Budget (16.67ms @ 60 FPS)"
        FB1[Input Handling<br/>1-2ms]
        FB2[State Update<br/>1ms]
        FB3[Render Decision<br/>0.5ms]
        FB4[DOM Render<br/>Active Only<br/>2-4ms]
        FB5[Canvas Render<br/>Static Batch<br/>3-6ms]
        FB6[Composite<br/>1-2ms]
        FB7[GPU Present<br/>1-2ms]

        FB1 --> FB2
        FB2 --> FB3
        FB3 --> FB4
        FB3 --> FB5
        FB4 --> FB6
        FB5 --> FB6
        FB6 --> FB7
    end

    subgraph "Optimizations"
        OPT1[Viewport Culling<br/>O log n with QuadTree]
        OPT2[Dirty Region Tracking<br/>Only redraw changed areas]
        OPT3[Offscreen Canvas<br/>Web Worker rendering]
        OPT4[Batch Draw Calls<br/>Single path2D operation]
        OPT5[requestAnimationFrame<br/>Throttle to display refresh]
    end

    FB3 --> OPT1
    FB5 --> OPT2
    FB5 --> OPT3
    FB5 --> OPT4
    FB7 --> OPT5

    style FB4 fill:#ecc94b,stroke:#d69e2e
    style FB5 fill:#48bb78,stroke:#38a169
    style FB7 fill:#4299e1,stroke:#3182ce
```

## Canvas Rendering Pipeline Detail

```mermaid
graph LR
    subgraph "Canvas Render Cycle"
        CR1[Get Visible Nodes<br/>QuadTree Query]
        CR2[Sort by Z-Index]
        CR3[Group by Type<br/>Text/Connection]
        CR4[Clear Canvas<br/>Dirty Regions Only]
        CR5[Draw Connections<br/>Batched Paths]
        CR6[Draw Node Backgrounds<br/>Batched Rects]
        CR7[Draw Text<br/>Cached Metrics]
        CR8[Draw Selections<br/>Overlay]
        CR9[Present Frame]

        CR1 --> CR2
        CR2 --> CR3
        CR3 --> CR4
        CR4 --> CR5
        CR5 --> CR6
        CR6 --> CR7
        CR7 --> CR8
        CR8 --> CR9
    end

    subgraph "Caching"
        C1[(Font Metrics<br/>LRU 1000)]
        C2[(Path2D Objects<br/>Per Connection)]
        C3[(Bitmap Cache<br/>Complex Nodes)]
    end

    CR7 -.->|Read| C1
    CR5 -.->|Read| C2
    CR6 -.->|Read| C3

    style CR1 fill:#4a5568,stroke:#718096
    style CR9 fill:#48bb78,stroke:#38a169
```

## Implementation Phases

```mermaid
gantt
    title Hybrid Canvas Implementation Timeline
    dateFormat YYYY-MM-DD
    section Phase 1: Foundation
    Canvas infrastructure setup           :2026-04-01, 5d
    Offscreen canvas + worker            :2026-04-06, 7d
    Basic shape rendering                :2026-04-13, 5d
    section Phase 2: Integration
    DOM-Canvas switching logic           :2026-04-18, 7d
    Viewport culling with QuadTree       :2026-04-25, 10d
    Event handling coordination          :2026-05-05, 5d
    section Phase 3: Optimization
    Dirty region tracking                :2026-05-10, 7d
    Batch rendering optimizations        :2026-05-17, 7d
    Performance testing & tuning         :2026-05-24, 7d
    section Phase 4: Polish
    Edge case handling                   :2026-05-31, 5d
    Accessibility improvements           :2026-06-05, 5d
    Documentation & rollout              :2026-06-10, 3d
```

## Expected Performance Improvements

| Metric | Current (DOM) | Hybrid | Improvement |
|--------|---------------|--------|-------------|
| **FPS @ 100 nodes** | 55-58 | 60 | +3-9% |
| **FPS @ 500 nodes** | 35-40 | 50-55 | +43-57% |
| **FPS @ 1000 nodes** | 25-30 | 45-50 | +67-100% |
| **FPS @ 2000 nodes** | 15-20 | 35-40 | +100-167% |
| **Memory @ 1000 nodes** | 180 MB | 120 MB | -33% |
| **Initial render** | 400ms | 150ms | -63% |

## Code Structure

```
/frontend/src/components/workspace/
├── WorkspaceCanvas.tsx          (Orchestrator - 300 lines)
│   ├── State management
│   ├── Event routing
│   └── Layer coordination
│
├── renderers/
│   ├── DOMRenderer.tsx          (Active nodes - 200 lines)
│   │   └── Tiptap integration
│   │
│   └── CanvasRenderer.tsx       (Static nodes - 400 lines)
│       ├── OffscreenCanvas worker
│       ├── Batch rendering
│       └── Dirty tracking
│
├── layers/
│   ├── DOMLayer.tsx             (z-index: 100)
│   └── CanvasLayer.tsx          (z-index: 1)
│
└── utils/
    ├── viewport-culling.ts      (QuadTree spatial index)
    ├── render-decision.ts       (Route to DOM vs Canvas)
    └── canvas-batching.ts       (Optimize draw calls)
```

## Migration Strategy

1. **Feature flag**: `ENABLE_HYBRID_CANVAS=true/false`
2. **A/B testing**: 50% users on hybrid, 50% on DOM
3. **Performance monitoring**: Track FPS, memory, crashes
4. **Gradual rollout**:
   - Week 1: Internal testing
   - Week 2: Beta users (10%)
   - Week 3: Expand to 50%
   - Week 4: Full rollout

## References

- Current Implementation: `/frontend/src/components/workspace/WorkspaceCanvas.tsx`
- Viewport Culling: `/frontend/src/lib/workspace/viewport-culling.ts`
- Performance Analysis: `/docs/architecture/workspace-technical-comparison-feb-2026.md`
- Effort Estimate: 40-50 hours (Q2 2026)
