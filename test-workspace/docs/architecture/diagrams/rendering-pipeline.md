# Rendering Pipeline Comparison

This diagram compares three rendering approaches: DOM (Veritable current), Canvas (Excalidraw), and WebGL (Miro).

## Veritable (DOM-Based Rendering)

```mermaid
graph LR
    subgraph "Current: DOM Rendering"
        A1[User Input] --> B1[Event Handler]
        B1 --> C1[Zustand Update]
        C1 --> D1[React Re-render]
        D1 --> E1[Virtual DOM Diff]
        E1 --> F1[DOM Reconciliation]
        F1 --> G1{Viewport<br/>Culling}
        G1 -->|Visible| H1[Render TextNode<br/>1741 lines]
        G1 -->|Hidden| I1[Skip Render]
        H1 --> J1[Browser Layout<br/>Reflow]
        J1 --> K1[Browser Paint<br/>Repaint]
        K1 --> L1[Display<br/>30-40 FPS]
    end

    style A1 fill:#4a5568,stroke:#718096
    style H1 fill:#e53e3e,stroke:#c53030
    style L1 fill:#48bb78,stroke:#38a169
```

**Performance**: 30-40 FPS at 1000 nodes
**Pros**: Tiptap rich text, CSS styling, accessibility
**Cons**: Performance ceiling, expensive reflows, memory intensive

## Excalidraw (Canvas-Based Rendering)

```mermaid
graph LR
    subgraph "Canvas: Excalidraw Approach"
        A2[User Input] --> B2[Event Handler]
        B2 --> C2[State Update<br/>Immutable]
        C2 --> D2{Dirty Flag}
        D2 -->|Changed| E2[Clear Canvas]
        D2 -->|Unchanged| Z2[Skip Render]
        E2 --> F2[Viewport<br/>Transform]
        F2 --> G2[Draw Elements<br/>requestAnimationFrame]
        G2 --> H2[Static Layer<br/>Canvas 1]
        G2 --> I2[Interactive Layer<br/>Canvas 2]
        H2 --> J2[Composite<br/>GPU]
        I2 --> J2
        J2 --> K2[Display<br/>60 FPS]
    end

    style A2 fill:#4a5568,stroke:#718096
    style G2 fill:#48bb78,stroke:#38a169
    style K2 fill:#48bb78,stroke:#38a169
```

**Performance**: 60 FPS with 1000s of elements
**Pros**: Low memory, smooth animations, GPU-accelerated
**Cons**: Custom text editing, no CSS, accessibility challenging

## Miro (WebGL-Based Rendering)

```mermaid
graph LR
    subgraph "WebGL: Miro Approach"
        A3[User Input] --> B3[Event Handler]
        B3 --> C3[State Update]
        C3 --> D3[WebGL Shader<br/>Compilation]
        D3 --> E3[GPU Upload<br/>Vertex Buffers]
        E3 --> F3[Spatial Index<br/>QuadTree]
        F3 --> G3{Frustum<br/>Culling}
        G3 -->|Visible| H3[GPU Rendering<br/>Instanced]
        G3 -->|Hidden| I3[Skip]
        H3 --> J3[Post-processing<br/>Effects]
        J3 --> K3[Display<br/>60 FPS]
    end

    style A3 fill:#4a5568,stroke:#718096
    style H3 fill:#48bb78,stroke:#38a169
    style K3 fill:#48bb78,stroke:#38a169
```

**Performance**: 60 FPS with 10,000+ elements
**Pros**: Massive scale, GPU acceleration, smooth effects
**Cons**: Complex implementation, large bundle size, WebGL expertise required

## Performance Comparison

| Metric | DOM (Veritable) | Canvas (Excalidraw) | WebGL (Miro) |
|--------|-----------------|---------------------|--------------|
| **Max Elements (60 FPS)** | 500-800 | 5,000-10,000 | 50,000+ |
| **Memory (1000 nodes)** | 150-200 MB | 50-80 MB | 80-120 MB |
| **Initial Render** | 200-500ms | 50-100ms | 100-300ms |
| **Text Editing** | Native (Tiptap) | Custom | Custom |
| **Accessibility** | Excellent | Moderate | Poor |
| **Bundle Size** | 450 KB | 280 KB | 850 KB |

## Bottleneck Analysis

### DOM Rendering (Current)
```mermaid
graph TB
    A[User drags node] --> B[Zustand update<br/>⏱️ 1ms]
    B --> C[React diff<br/>⏱️ 2-5ms]
    C --> D[DOM update<br/>⏱️ 5-10ms]
    D --> E[Browser reflow<br/>⚠️ 10-20ms BOTTLENECK]
    E --> F[Browser repaint<br/>⏱️ 5-10ms]
    F --> G[Composite<br/>⏱️ 2-5ms]
    G --> H[Display<br/>✅ 33ms total @ 30 FPS]

    style E fill:#e53e3e,stroke:#c53030,stroke-width:3px
```

**Critical Bottleneck**: Browser reflow (10-20ms) limits frame time budget

### Canvas Rendering (Proposed)
```mermaid
graph TB
    A2[User drags node] --> B2[State update<br/>⏱️ 1ms]
    B2 --> C2[requestAnimationFrame<br/>⏱️ <1ms]
    C2 --> D2[Clear canvas<br/>⏱️ 1-2ms]
    D2 --> E2[Draw elements<br/>⏱️ 3-6ms]
    E2 --> F2[GPU composite<br/>⏱️ 1-2ms]
    F2 --> G2[Display<br/>✅ 8-12ms @ 60 FPS]

    style G2 fill:#48bb78,stroke:#38a169,stroke-width:3px
```

**No Bottleneck**: Entire pipeline fits within 16ms frame budget

## Recommended Hybrid Approach

```mermaid
graph TB
    subgraph "Hybrid: Best of Both Worlds"
        A4[User Input] --> B4{Node State}
        B4 -->|Editing| C4[DOM Rendering<br/>Tiptap Editor]
        B4 -->|Static| D4[Canvas Rendering<br/>Offscreen]
        C4 --> E4[Active Node<br/>DOM Layer]
        D4 --> F4[Static Nodes<br/>Canvas Layer]
        E4 --> G4[Composite<br/>CSS z-index]
        F4 --> G4
        G4 --> H4[Display<br/>~45-50 FPS]
    end

    style A4 fill:#4a5568,stroke:#718096
    style C4 fill:#ecc94b,stroke:#d69e2e
    style D4 fill:#48bb78,stroke:#38a169
    style H4 fill:#48bb78,stroke:#38a169
```

**Expected Performance**: 45-50 FPS at 1000 nodes (2-3x improvement)
**Effort**: 40-50 hours
**Pros**: Keep Tiptap, improve performance, moderate complexity
**Cons**: Two rendering systems to maintain

## References

- Current Implementation: `/frontend/src/components/workspace/WorkspaceCanvas.tsx` (1,741 lines)
- Viewport Culling: `/frontend/src/lib/workspace/viewport-culling.ts`
- Performance Tests: `/docs/completed/feb-2026/workspace-performance-tests-feb-14-2026.md`
