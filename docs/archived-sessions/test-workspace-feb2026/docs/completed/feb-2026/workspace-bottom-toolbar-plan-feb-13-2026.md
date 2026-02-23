# Workspace Bottom-Left Toolbar Retrofit Plan

**Date**: February 13, 2026
**Goal**: Consolidate workspace controls in bottom-left corner (matching Excalidraw/Miro pattern)
**Location**: Bottom-left corner alongside existing hints panel

---

## Current State Analysis

### What Already Exists

**Bottom-Right Corner** (lines 2300-2334):
```tsx
<div className="absolute bottom-4 right-4 flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-2 shadow-lg">
  <button onClick={zoomIn}>+</button>
  <button onClick={resetZoom}>{Math.round(scale * 100)}%</button>
  <button onClick={zoomOut}>−</button>
</div>
```
- ✅ Zoom In (+)
- ✅ Reset Zoom (shows current scale percentage)
- ✅ Zoom Out (−)
- ✅ Keyboard: Ctrl+0 for reset

**Bottom-Left Corner** (lines 2366-2419):
```tsx
<div className="absolute bottom-4 left-4 max-w-xs space-y-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-400">
  <div>{nodes.size} nodes</div>
  <div>Save status: Saving.../Saved/Error</div>
  <label>
    <input type="checkbox" checked={showDeletedNodes} />
    Show deleted nodes
  </label>
  <div>Right-click empty space to create node</div>
  <div>Drag empty space or middle mouse to pan</div>
  <div>Scroll wheel to zoom</div>
  <div>Click anchor to start connection</div>
</div>
```
- ✅ Node count display
- ✅ Save status indicator (with animated dot)
- ✅ "Show deleted nodes" toggle
- ✅ Interaction hints (right-click, drag, scroll, etc.)

### What's Missing (Keyboard-Only)

| Feature | Current Access | Should Have Button? |
|---------|---------------|---------------------|
| **Export to JSON** | Ctrl+E | ✅ Yes - file operation |
| **Import from JSON** | Ctrl+Shift+I | ✅ Yes - file operation |
| **Undo** | Ctrl+Z | ✅ Yes - common operation |
| **Redo** | Ctrl+Shift+Z or Ctrl+Y | ✅ Yes - common operation |
| **Select All** | Ctrl+A | ⚠️ Maybe - less common |
| **Grid Toggle** | None | ✅ Yes - Excalidraw has this |
| **Fit to Screen** | None | ⚠️ Maybe - nice-to-have |

---

## Proposed Layout

### Option 1: Split Bottom Corners (Recommended)

**Bottom-Left**: File & Edit Operations
**Bottom-Right**: View Controls (zoom + grid)

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                   [Infinite Canvas]                      │
│                                                          │
├────────────────────────────────────┬─────────────────────┤
│ [Bottom-Left Panel]                │  [Bottom-Right]     │
│ ┌────────────────────────────────┐ │  ┌──────────────┐   │
│ │ File Operations:               │ │  │ View:        │   │
│ │ [Export] [Import]              │ │  │ [+]          │   │
│ │                                │ │  │ [100%]       │   │
│ │ Edit Operations:               │ │  │ [−]          │   │
│ │ [Undo] [Redo]                  │ │  │              │   │
│ │                                │ │  │ [Grid: ✓]    │   │
│ │ Status:                        │ │  └──────────────┘   │
│ │ • 5 nodes  [●] Saved           │ │                     │
│ │ ☐ Show deleted                 │ │                     │
│ └────────────────────────────────┘ │                     │
└────────────────────────────────────┴─────────────────────┘
```

**Pros**:
- ✅ Keeps zoom controls separate (current pattern)
- ✅ File/Edit operations logically grouped
- ✅ Matches Miro pattern (controls in corners)
- ✅ Clean separation of concerns

**Cons**:
- ⚠️ Users need to look in two places for controls

### Option 2: Unified Bottom-Left (All Controls Together)

Move zoom controls to bottom-left and create one unified control panel.

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                   [Infinite Canvas]                      │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ [Bottom-Left Unified Panel]                             │
│ ┌────────────────────────────────────────────────────┐  │
│ │ [Export] [Import] | [Undo] [Redo] | [+] [100%] [−] │  │
│ │                                                     │  │
│ │ [Grid: ✓]  •  5 nodes  •  [●] Saved                │  │
│ │ ☐ Show deleted nodes                                │  │
│ └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Pros**:
- ✅ All controls in one place
- ✅ Easier to discover
- ✅ More compact horizontal layout

**Cons**:
- ⚠️ Panel might get crowded
- ⚠️ Breaks current split-corner pattern

### Option 3: Hybrid - Buttons Left, Zoom Right (Recommended)

Keep zoom in bottom-right (current), add toolbar buttons to bottom-left, keep hints collapsible.

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                   [Infinite Canvas]                      │
│                                                          │
├────────────────────────────────────┬─────────────────────┤
│ [Bottom-Left]                      │  [Bottom-Right]     │
│ ┌────────────────────────────────┐ │  ┌──────────────┐   │
│ │ [Export] [Import] [Undo] [Redo]│ │  │ [+]          │   │
│ │ [Grid: ✓] • 5 nodes • [●] Saved│ │  │ [100%]       │   │
│ │                                │ │  │ [−]          │   │
│ │ [?] Hints (click to toggle)    │ │  └──────────────┘   │
│ └────────────────────────────────┘ │                     │
└────────────────────────────────────┴─────────────────────┘
```

**Pros**:
- ✅ Keeps familiar zoom location (bottom-right)
- ✅ Adds missing functionality (Export, Import, Undo, Redo)
- ✅ Makes hints optional (click to expand/collapse)
- ✅ Clean horizontal button layout

**Cons**:
- ⚠️ Hints might be less discoverable if collapsed

---

## Recommended Approach: Option 3 (Hybrid)

### Component Structure

```tsx
// WorkspaceCanvas.tsx - Bottom-Left Section
<div className="absolute bottom-4 left-4 flex flex-col gap-2">
  {/* Toolbar - Always visible */}
  <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-2 shadow-lg">
    {/* File Operations */}
    <button onClick={handleExport} title="Export to JSON (Ctrl+E)">
      <ExportIcon /> Export
    </button>
    <button onClick={handleImport} title="Import from JSON (Ctrl+Shift+I)">
      <ImportIcon /> Import
    </button>

    <div className="h-6 w-px bg-neutral-700" /> {/* Divider */}

    {/* Edit Operations */}
    <button onClick={handleUndo} title="Undo (Ctrl+Z)" disabled={!canUndo}>
      <UndoIcon />
    </button>
    <button onClick={handleRedo} title="Redo (Ctrl+Shift+Z)" disabled={!canRedo}>
      <RedoIcon />
    </button>

    <div className="h-6 w-px bg-neutral-700" /> {/* Divider */}

    {/* View Controls */}
    <button onClick={toggleGrid} title="Toggle Grid">
      <GridIcon /> Grid: {showGrid ? '✓' : '✗'}
    </button>

    <div className="h-6 w-px bg-neutral-700" /> {/* Divider */}

    {/* Status Indicators */}
    <div className="flex items-center gap-2 text-xs text-neutral-400">
      <span>{nodes.size} nodes</span>
      <SaveStatusIndicator />
    </div>
  </div>

  {/* Hints Panel - Collapsible (optional) */}
  {showHints && (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-400">
      <label>
        <input type="checkbox" checked={showDeletedNodes} />
        Show deleted nodes
      </label>
      <div>Right-click empty space to create node</div>
      <div>Drag empty space or middle mouse to pan</div>
      {/* ... other hints */}
    </div>
  )}

  {/* Hints Toggle Button */}
  <button
    onClick={() => setShowHints(!showHints)}
    className="self-start rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs"
  >
    {showHints ? '▼' : '▶'} Hints
  </button>
</div>
```

### Visual Mockup (Final Design)

```
Bottom-Left Corner:
┌─────────────────────────────────────────────────────────┐
│ [💾 Export] [📥 Import] | [↶] [↷] | [⊞ Grid: ✓] • 5 nodes • [●] Saved │
└─────────────────────────────────────────────────────────┘
[▶ Hints]  ← Click to expand hints panel

Bottom-Right Corner (unchanged):
┌──────┐
│  +   │
│ 100% │
│  −   │
└──────┘
```

---

## Implementation Details

### New State Variables Needed

```typescript
// Add to WorkspaceCanvas.tsx
const [showGrid, setShowGrid] = useState(true); // Grid visibility toggle
const [showHints, setShowHints] = useState(true); // Hints panel toggle (default open)
```

### New Handler Functions

```typescript
// Export handler (already exists via keyboard)
const handleExportClick = useCallback(() => {
  const selectedOnly = selectedNodeIds.size > 0;
  const exportData = useWorkspaceStore.getState().exportToJSON(selectedOnly);
  if (exportData) {
    const filename = generateExportFilename(projectSlug);
    downloadJSON(exportData, filename);
  }
}, [selectedNodeIds, projectSlug]);

// Import handler (trigger file picker)
const handleImportClick = useCallback(() => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      try {
        const exportData = await readJSONFile(file);
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        const viewportCenter = {
          x: (canvasRect.width / 2 - viewport.offsetX) / viewport.scale,
          y: (canvasRect.height / 2 - viewport.offsetY) / viewport.scale,
        };
        const importResult = importFromJSON(exportData, viewportCenter);
        // ... handle import
      } catch (error) {
        logger.error('Import failed:', error);
      }
    }
  };
  input.click();
}, [viewport, canvasRef]);

// Grid toggle
const handleToggleGrid = useCallback(() => {
  setShowGrid(prev => !prev);
}, []);

// Undo/Redo (already have functions from store)
const handleUndoClick = useCallback(() => {
  undo();
}, [undo]);

const handleRedoClick = useCallback(() => {
  redo();
}, [redo]);
```

### Icons Needed

```typescript
// Simple SVG icons (inline or import from library)
const ExportIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const ImportIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const UndoIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
  </svg>
);

const RedoIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
  </svg>
);

const GridIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z" />
  </svg>
);
```

### Grid Toggle Implementation

```typescript
// Modify CanvasGrid rendering
{showGrid && <CanvasGrid />}
```

### Disabled States for Undo/Redo

```typescript
// Check if undo/redo available from Yjs UndoManager
const canUndo = useWorkspaceStore(state => state.canUndo);
const canRedo = useWorkspaceStore(state => state.canRedo);

// In button:
<button
  onClick={handleUndoClick}
  disabled={!canUndo}
  className={`... ${!canUndo ? 'opacity-50 cursor-not-allowed' : ''}`}
>
  <UndoIcon />
</button>
```

---

## Button Design Specifications

### Button Styling (Match Existing)

```typescript
// Base button class (consistent with zoom buttons)
const buttonClass = "rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"

// Icon-only button (compact)
const iconButtonClass = "rounded bg-neutral-800 p-2 text-neutral-300 transition-colors hover:bg-neutral-700 disabled:opacity-50"

// Button with icon + text
const textButtonClass = "flex items-center gap-1 rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-700"
```

### Tooltip Pattern

```typescript
<button
  onClick={handleExport}
  className={textButtonClass}
  title="Export to JSON (Ctrl+E)"
  aria-label="Export workspace to JSON file"
>
  <ExportIcon />
  <span>Export</span>
</button>
```

---

## Testing Checklist

### Visual Testing
- [ ] Bottom-left panel renders correctly
- [ ] All buttons are properly aligned
- [ ] Icons display correctly at all zoom levels
- [ ] Tooltips appear on hover
- [ ] Disabled states show visually (opacity 50%)
- [ ] Panel doesn't overlap with canvas content

### Functional Testing
- [ ] Export button triggers JSON download
- [ ] Import button opens file picker
- [ ] Import successfully loads JSON file
- [ ] Undo button works (and shows disabled when no history)
- [ ] Redo button works (and shows disabled when no redo available)
- [ ] Grid toggle shows/hides grid
- [ ] Hints toggle shows/hides hints panel
- [ ] "Show deleted nodes" checkbox still works

### Keyboard Shortcut Testing
- [ ] Ctrl+E still triggers export
- [ ] Ctrl+Shift+I still triggers import
- [ ] Ctrl+Z still triggers undo
- [ ] Ctrl+Shift+Z still triggers redo
- [ ] Buttons and keyboard shortcuts stay in sync

### Accessibility Testing
- [ ] All buttons have aria-labels
- [ ] Tooltips are keyboard-accessible
- [ ] Tab navigation works through all buttons
- [ ] Screen reader announces button states

---

## Files to Modify

### 1. WorkspaceCanvas.tsx (PRIMARY)

**Lines to modify**:
- Add state: `showGrid`, `showHints` (after line 140)
- Add handlers: `handleExportClick`, `handleImportClick`, `handleToggleGrid`, etc. (after line 1750)
- Replace bottom-left panel (lines 2366-2419) with new toolbar
- Conditionally render CanvasGrid based on `showGrid` (line 2203)

### 2. No new files needed

All changes are in WorkspaceCanvas.tsx (inline SVG icons, inline handlers).

---

## Alternative: Create Separate Component (Optional)

If the toolbar grows too complex, extract to:

```typescript
// WorkspaceToolbar.tsx (NEW - optional)
interface WorkspaceToolbarProps {
  onExport: () => void;
  onImport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleGrid: () => void;
  canUndo: boolean;
  canRedo: boolean;
  showGrid: boolean;
  nodeCount: number;
  saveStatus: 'saving' | 'saved' | 'error';
}

export default function WorkspaceToolbar({ ... }: WorkspaceToolbarProps) {
  // Render toolbar UI
}
```

**When to extract**:
- If toolbar exceeds ~100 lines
- If you want to reuse across multiple workspace views
- If you want separate testing for toolbar

---

## Migration Strategy

### Phase 1: Add Buttons (Keep Current Panel)
1. Add new button row above existing hints panel
2. Keep all existing functionality intact
3. Test buttons work correctly

### Phase 2: Make Hints Collapsible
1. Add toggle button for hints
2. Save preference to localStorage
3. Default to expanded for existing users

### Phase 3: Polish
1. Add animations (fade in/out for hints)
2. Refine spacing and alignment
3. Add keyboard shortcuts display

---

## Estimated Effort

| Task | Time | Complexity |
|------|------|------------|
| Add state variables | 5 min | Low |
| Create handler functions | 15 min | Low |
| Design button layout | 30 min | Medium |
| Create inline SVG icons | 20 min | Low |
| Implement grid toggle | 10 min | Low |
| Make hints collapsible | 20 min | Low |
| Test all functionality | 30 min | Medium |
| Polish and refine | 30 min | Low |
| **Total** | **~2.5 hours** | **Low-Medium** |

---

## Success Criteria

✅ Export button triggers JSON download
✅ Import button opens file picker and loads JSON
✅ Undo/Redo buttons work and show disabled states correctly
✅ Grid toggle shows/hides grid background
✅ All keyboard shortcuts still work
✅ Save status indicator still visible
✅ Node count still visible
✅ Panel layout is clean and organized
✅ No visual regressions (zoom controls still work)
✅ Mobile-responsive (buttons stack on small screens)

---

## Future Enhancements (Out of Scope)

- **Fit to Screen** button (zoom to show all nodes)
- **Select All** button (Ctrl+A)
- **Clear Canvas** button (with confirmation dialog)
- **Minimap** (thumbnail view of canvas)
- **Toolbar customization** (let users pin/unpin buttons like Miro)
- **Keyboard shortcuts reference** (modal showing all shortcuts)
- **Collaborative indicators** (show online users)

---

**Plan Status**: ✅ Ready for Implementation
**Recommended Approach**: Option 3 (Hybrid - buttons left, zoom right)
**Next Step**: Implement bottom-left toolbar in WorkspaceCanvas.tsx
**Estimated Time**: 2.5 hours
