# Workspace Tools Interface Summary

**Date**: February 13, 2026
**Status**: Interface Review - Partial UI Coverage

---

## Current Tool Access Methods

### ✅ Tools with Visual UI

| Tool | UI Component | Trigger | Operations |
|------|-------------|---------|------------|
| **Alignment Tools** | AlignmentToolbar | 2+ nodes selected | • Align Left/Right/Top/Bottom<br>• Center H/V<br>• Distribute H/V (3+ nodes)<br>• Shows locked node count |
| **Node Operations** | NodeContextMenu | Right-click on node | • Lock/Unlock<br>• Copy<br>• Duplicate<br>• Bring to Front<br>• Send to Back<br>• Delete |
| **Text Formatting** | FloatingFormatToolbar | Editing Tiptap node | • Bold, Italic, Underline<br>• Headings, Lists<br>• Links, Code blocks |
| **Markdown Formatting** | MarkdownFloatingToolbar | Editing Markdown node | • Markdown syntax helpers |
| **Canvas Operations** | CanvasContextMenu | Right-click on canvas | • Add Text<br>• Create Note |

### ⚠️ Keyboard-Only Tools (No Visual UI)

| Tool | Shortcut | Description | Has UI? |
|------|----------|-------------|---------|
| **Export to JSON** | Ctrl+E | Export selected/all nodes to JSON file | ❌ No button |
| **Import from JSON** | Ctrl+Shift+I | Import nodes from JSON file | ❌ No button |
| **Paste** | Ctrl+V | Paste copied nodes (supports multiple) | ❌ No button |
| **Undo** | Ctrl+Z | Undo last operation (Yjs) | ❌ No button |
| **Redo** | Ctrl+Shift+Z or Ctrl+Y | Redo operation | ❌ No button |
| **Select All** | Ctrl+A | Select all nodes in workspace | ❌ No button |

---

## Missing UI Elements

### 🚫 No Main Workspace Toolbar

**Current State**: No persistent toolbar showing all available workspace operations

**What's Missing**:
- No visual discovery for keyboard shortcuts
- No toolbar buttons for Export/Import JSON
- No undo/redo buttons
- No "select all" button
- No visual indication of available tools

**User Impact**:
- New users don't know about Export/Import feature (keyboard-only)
- No way to discover alignment shortcuts without reading docs
- Context menus require right-click (not always intuitive)

---

## Current UI Architecture

```
WorkspaceCanvas.tsx
├── CanvasContextMenu (right-click on canvas)
│   ├── Add Text
│   └── Create Note
│
├── NodeContextMenu (right-click on node)
│   ├── Lock/Unlock (Ctrl+L)
│   ├── Copy (Ctrl+C)
│   ├── Duplicate (Ctrl+D)
│   ├── Bring to Front
│   ├── Send to Back
│   └── Delete (Del)
│
├── AlignmentToolbar (2+ nodes selected)
│   ├── Align Left/Right/Top/Bottom (Ctrl+Shift+L/R/T/B)
│   ├── Center H/V (Ctrl+Shift+H/V)
│   └── Distribute H/V (Ctrl+Shift+[/])
│
├── FloatingFormatToolbar (editing Tiptap node)
│   └── Text formatting controls
│
└── MarkdownFloatingToolbar (editing Markdown node)
    └── Markdown syntax helpers
```

---

## Proposed Solution: Unified Workspace Toolbar

### Option 1: Top Toolbar (Always Visible)

**Location**: Fixed at top of workspace canvas
**Contents**:
- File operations: Export JSON, Import JSON
- Edit operations: Undo, Redo, Select All
- Node operations: Add Text, Create Note
- View controls: Zoom, Grid toggle

**Mockup**:
```
┌─────────────────────────────────────────────────────────────┐
│ [Export] [Import] | [Undo] [Redo] | [+Text] [+Note] | [Grid]│
└─────────────────────────────────────────────────────────────┘
```

**Pros**:
- Always visible, easy to discover
- Standard desktop app pattern (Figma, Miro, Excalidraw)
- Clear visual hierarchy

**Cons**:
- Takes vertical space (can minimize canvas area)
- Some tools might feel redundant with keyboard shortcuts

### Option 2: Context-Aware Toolbar (Dynamic)

**Location**: Floating toolbar that changes based on selection
**Behavior**:
- 0 nodes selected → Show file/canvas operations
- 1 node selected → Show node operations (lock, delete, duplicate)
- 2+ nodes selected → Show alignment tools (current behavior)

**Pros**:
- No permanent screen space used
- Contextual (only shows relevant tools)
- Cleaner canvas appearance

**Cons**:
- Less discoverable (toolbar not always visible)
- Context switching might be confusing

### Option 3: Hybrid Approach (Minimal + Contextual)

**Location**: Minimal top toolbar + contextual floating toolbars
**Contents**:
- **Top toolbar**: Export, Import, Undo/Redo (core file operations)
- **Floating toolbars**: Keep existing (alignment, formatting, context menus)

**Mockup**:
```
Top (minimal):
┌─────────────────────────────────────┐
│ [Export] [Import] | [↶ Undo] [↷ Redo]│
└─────────────────────────────────────┘

Floating (contextual):
- AlignmentToolbar (2+ nodes)
- FloatingFormatToolbar (editing)
- Context menus (right-click)
```

**Pros**:
- Discoverable (file operations always visible)
- Minimal space usage (only essential buttons)
- Keeps contextual tools clean

**Cons**:
- Split interface (some tools in top bar, some floating)

### Option 4: Command Palette (Keyboard-First)

**Trigger**: Ctrl+K or Ctrl+P
**Behavior**: Searchable command list (like VS Code)

**Contents**:
- "Export to JSON..."
- "Import from JSON..."
- "Align Left"
- "Align Right"
- "Distribute Horizontally"
- etc.

**Pros**:
- No screen space used
- Very discoverable (search by name)
- Fast for power users

**Cons**:
- Requires keyboard to access
- Less visual than toolbar buttons

---

## Feature Coverage Analysis

### ✅ Fully Accessible (UI + Keyboard)

- **Alignment Tools**: AlignmentToolbar + Ctrl+Shift+L/R/T/B/H/V/[/]
- **Lock/Unlock**: NodeContextMenu + Ctrl+L
- **Copy**: NodeContextMenu + Ctrl+C
- **Duplicate**: NodeContextMenu + Ctrl+D
- **Delete**: NodeContextMenu + Del
- **Add Text**: CanvasContextMenu + click on canvas
- **Text Formatting**: FloatingFormatToolbar + rich text editor

### ⚠️ Keyboard-Only (Missing UI)

- **Export to JSON**: Ctrl+E only - ❌ No button
- **Import from JSON**: Ctrl+Shift+I only - ❌ No button
- **Paste**: Ctrl+V only - ❌ No button
- **Undo/Redo**: Ctrl+Z/Ctrl+Shift+Z only - ❌ No buttons
- **Select All**: Ctrl+A only - ❌ No button

### 🔍 Discoverability Issue

**Problem**: Users won't know about powerful features like JSON Export/Import unless they:
1. Read documentation
2. Accidentally press keyboard shortcuts
3. Are told by someone else

**Solution**: Add visual UI for keyboard-only features

---

## Implementation Options

### Quick Win: Add to NodeContextMenu

**Add menu items**:
- Export Selection to JSON
- Import Nodes from JSON...

**Location**: NodeContextMenu.tsx (when nodes selected)

**Effort**: Low (~1 hour)
**Impact**: Medium (makes export/import discoverable)

**Code**:
```typescript
// NodeContextMenu.tsx
items.push({
  id: 'export-json',
  label: 'Export to JSON',
  icon: '💾',
  action: 'export-json',
  shortcut: 'Ctrl+E',
});
```

### Medium Effort: Top Toolbar Component

**Create**: WorkspaceToolbar.tsx
**Location**: Top of WorkspaceCanvas
**Contents**: Export, Import, Undo, Redo

**Effort**: Medium (~4 hours)
**Impact**: High (professional UI, better UX)

**Files**:
```
frontend/src/components/workspace/WorkspaceToolbar.tsx (NEW - ~200 lines)
frontend/src/components/workspace/WorkspaceCanvas.tsx (MODIFY - add toolbar)
```

### Full Solution: Command Palette

**Create**: WorkspaceCommandPalette.tsx
**Trigger**: Ctrl+K
**Contents**: Searchable list of all workspace operations

**Effort**: High (~8 hours)
**Impact**: Very High (VS Code-like UX)

**Dependencies**:
- Search/fuzzy matching library
- Modal/overlay component
- Icon library for command icons

---

## Recommended Action Plan

### Phase 1: Quick Wins (1-2 hours)
1. ✅ Add Export/Import to NodeContextMenu (right-click on nodes)
2. ✅ Add visual indicators for keyboard shortcuts in existing menus
3. ✅ Update tooltips to show all available shortcuts

### Phase 2: Top Toolbar (4-6 hours)
1. Create WorkspaceToolbar.tsx component
2. Add buttons: Export, Import, Undo, Redo
3. Integrate into WorkspaceCanvas.tsx (fixed top position)
4. Add tooltips with keyboard shortcuts

### Phase 3: Command Palette (Optional - 8-10 hours)
1. Create WorkspaceCommandPalette.tsx
2. Implement fuzzy search (use existing library)
3. Add Ctrl+K trigger
4. List all workspace operations with icons

---

## Keyboard Shortcuts Reference

### Current Shortcuts (Need Visual UI)

| Category | Shortcut | Action |
|----------|----------|--------|
| **File** | Ctrl+E | Export to JSON |
| | Ctrl+Shift+I | Import from JSON |
| **Edit** | Ctrl+C | Copy |
| | Ctrl+V | Paste |
| | Ctrl+D | Duplicate |
| | Ctrl+Z | Undo |
| | Ctrl+Shift+Z | Redo |
| | Ctrl+Y | Redo (alt) |
| | Del | Delete |
| | Ctrl+A | Select All |
| **Lock** | Ctrl+L | Lock/Unlock |
| **Align** | Ctrl+Shift+L | Align Left |
| | Ctrl+Shift+R | Align Right |
| | Ctrl+Shift+T | Align Top |
| | Ctrl+Shift+B | Align Bottom |
| | Ctrl+Shift+H | Center Horizontally |
| | Ctrl+Shift+V | Center Vertically |
| **Distribute** | Ctrl+Shift+[ | Distribute Horizontally |
| | Ctrl+Shift+] | Distribute Vertically |

---

## Conclusion

**Current State**:
- ✅ Strong keyboard shortcut support
- ✅ Contextual toolbars (alignment, formatting)
- ⚠️ Missing persistent toolbar for file operations
- ⚠️ Export/Import features hidden (keyboard-only)

**Recommendation**:
1. **Immediate**: Add Export/Import to NodeContextMenu (Quick Win)
2. **Short-term**: Create minimal top toolbar (WorkspaceToolbar.tsx)
3. **Long-term**: Consider command palette for power users

**User Impact**:
- Better discoverability of powerful features
- More professional UI (matches Figma/Miro patterns)
- Easier onboarding for new users

---

**Report Generated**: February 13, 2026
**Status**: Interface Gap Identified
**Next Step**: User decision on toolbar implementation
