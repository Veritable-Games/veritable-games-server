# Excalidraw & Miro UI Research - February 13, 2026

**Research Focus**: Toolbar layout, tool organization, and interface patterns for workspace collaboration tools

---

## Excalidraw Interface Analysis

### Overall Philosophy
Excalidraw embraces **extreme minimalism** - when you open the app, you see a blank canvas and a small toolbar at the top. That's it. The focus is on getting out of the user's way.

### UI Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  [Top Toolbar - All Drawing Tools]                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Contextual Menu]    [Infinite Canvas]            │
│  (Left Side)          (Main Area)                  │
│  - Shape properties                                │
│  - Alignment tools                                 │
│  - Style options                                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Top Toolbar - Creation Tools

Located at the top of the canvas, includes:

| Tool | Keyboard Shortcut | Description |
|------|-------------------|-------------|
| **Selection** | V or 1 | Move and select objects |
| **Rectangle** | R | Draw rectangles |
| **Circle/Ellipse** | O | Draw circles/ellipses |
| **Diamond** | D | Draw diamond shapes |
| **Arrow** | A | Draw arrows with connectors |
| **Line** | L | Draw straight lines |
| **Freehand Drawing** | - | Sketch freely |
| **Text** | T | Add text boxes |
| **Image** | - | Insert images |
| **Eraser** | E | Delete elements |

**Source**: [Awesome Excalidraw Keyboard Shortcuts](https://csswolf.com/excalidraw-keyboard-shortcuts-pdf/)

### Contextual Left Menu

When you select object(s), a contextual menu appears on the **left side** showing:
- Shape properties (stroke, fill, opacity)
- Alignment options (align left/right/top/bottom)
- Distribution tools
- Layer order controls (bring to front, send to back)

**Source**: [General guide on how to use Excalidraw](https://hackmd.io/@alkemio/SJuewkPwn)

### Alignment & Distribution

**Access Method**: Right-click context menu when multiple objects selected

**Operations Available**:
- Align horizontally
- Align vertically
- Distribute horizontally
- Distribute vertically

**Keyboard Shortcuts**:
- Align objects: `Ctrl + Shift + Arrow Keys`
- Object snapping: `Alt/Option + S` (aligns to anchor points, baselines, imaginary grid lines)

**Source**: [Excalidraw align distribute objects](https://github.com/excalidraw/excalidraw/issues/1316)

### Menu Bar (Top Right)

Contains global actions:
- Background color picker
- Clear canvas
- Load/Save
- Export dialog (export to PNG, SVG, clipboard)
- Theme toggle (light/dark mode)

**Source**: [UIOptions | Excalidraw developer docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/ui-options)

### Recent 2026 Updates

1. **Mobile-optimized layout** - Dedicated toolbar and compact design for smaller screens
2. **Seamless shape switching** - Use Tab key to switch between rectangle/diamond/ellipse while drawing
3. **Prominent keyboard shortcuts** - Shortcuts now displayed with hints throughout the UI

**Source**: [Excalidraw+ Changelog](https://plus.excalidraw.com/changelog)

### Customization Features

Excalidraw supports extensive UI customization through:
- **UIOptions** - Toggle visibility of menu items, tools, sidebar
- **Render props** - Custom components
- **Theme system** - Light/dark mode, custom colors
- **CSS overrides** - Direct styling

**Source**: [Custom UI and Styling](https://deepwiki.com/excalidraw/excalidraw/10.3-custom-ui-and-styling)

---

## Miro Interface Analysis

### Overall Philosophy
Miro follows a **feature-rich professional tool** approach with multiple specialized toolbars for different functions. The interface is more complex but offers more immediate access to advanced features.

### UI Layout Structure (New 2026 Interface)

```
┌──────────────────────────────────────────────────┐
│         [Collaboration Bar - Top Right]          │
│         - Share, Reactions, Timer, etc.          │
├────┬─────────────────────────────────────────────┤
│    │                                             │
│ C  │         [Infinite Canvas]                   │
│ r  │         (Main Area)                         │
│ e  │                                             │
│ a  │                                             │
│ t  │                                             │
│ i  │                                             │
│ o  │                                             │
│ n  │                                             │
│    │                                             │
│ B  │                                             │
│ a  │                [Canvas Controls]            │
│ r  │                (Bottom Right)               │
│    │                - Zoom, Frames, Layers       │
└────┴─────────────────────────────────────────────┘
```

### Creation Bar (Left Side - Primary Toolbar)

Vertical toolbar on the left side with essential creation tools:

| Tool | Shortcut | Description |
|------|----------|-------------|
| **Select** | V | Selection tool |
| **Sticky Note** | N | Create sticky notes (16 colors available) |
| **Text** | T | Add text boxes (6,000 char limit) |
| **Shapes** | - | Various shapes (Basic, Flowchart, BPMN, AWS, etc.) |
| **Connection Lines** | - | Connect objects with arrows |
| **Pen** | - | Freehand drawing |
| **Comment** | - | Add comments to objects |
| **Frames** | F | Create frames/containers for grouping |
| **Upload** | - | Insert images/files |

**Key Feature**: Tools can be **reordered** by drag-and-drop and **pinned/unpinned** based on preference

**Source**: [Miro's new simplified user interface](https://help.miro.com/hc/en-us/articles/20967864443410-Miro-s-new-simplified-user-interface)

### Collaboration Bar (Top Right)

Contains collaboration and facilitation tools:
- **Share** - Invite collaborators
- **Reactions** - Emoji responses for engagement
- **Timer** - Session timing
- **Voting** - Poll participants
- **Present** - Presentation mode
- **Comments** - Review and feedback

**Source**: [Meet the new version of Miro](https://miro.com/blog/customizable-platform/)

### Canvas Controls (Bottom Right)

Navigation and view controls:
- **Zoom In/Out** - Adjust canvas scale
- **Fit to Screen** - Auto-zoom to fit content
- **Frames List** - Navigate between frames
- **Layers Panel** - Manage object layers

### Alignment & Distribution Tools

**Access Method**: Select multiple objects → Context menu appears

**Operations Available**:
- Align left/right/top/bottom
- Align horizontally/vertically (centers objects)
- Distribute horizontally (even spacing)
- Distribute vertically (even spacing)

**Important Note**: Alignment/distribution works differently inside frames - objects must be moved out of frames for full control

**Auto Layout Feature**: Select widgets → Click grey icon in upper right corner → Drag horizontally to auto-align and distribute

**Source**: [Structuring board content](https://help.miro.com/hc/en-us/articles/360017730973-Structuring-board-content)

### Arrange/Layer Controls

**Access Method**: Right-click object → Three dots (...) menu

**Operations**:
- Bring to front
- Send to back
- Bring forward (one layer up)
- Send backward (one layer down)

**Limitation**: Cannot arrange grouped objects or objects within tables

**Source**: [Working with objects](https://help.miro.com/hc/en-us/articles/360017730953-Working-with-objects)

### Object Properties Panel

When object(s) selected, a properties panel appears showing:
- Style options (colors, borders, fonts)
- Size and position
- Lock/unlock
- Links and connections
- Custom metadata

### Toolbar Customization

**Customization Options**:
- ✅ Reorder tools by drag-and-drop
- ✅ Pin/unpin tools to show/hide
- ❌ Not supported on touchscreen devices

**Source**: [Customizable platform](https://miro.com/blog/customizable-platform/)

---

## Comparison Matrix

| Feature | Excalidraw | Miro |
|---------|-----------|------|
| **Primary Toolbar Location** | Top (horizontal) | Left (vertical) |
| **Toolbar Philosophy** | Minimal, all tools in one bar | Separated by function (creation, collaboration, navigation) |
| **Alignment Access** | Right-click context menu + left panel | Right-click context menu |
| **Keyboard Shortcuts** | Heavily emphasized (shown in UI) | Available but less prominent |
| **Customization** | Extensive (UIOptions, themes, CSS) | Limited (reorder/pin tools only) |
| **Mobile Support** | Dedicated mobile layout (2026) | Responsive but desktop-first |
| **Tool Count** | ~10 core tools | ~20+ core tools |
| **Contextual Menus** | Left side panel | Multiple floating panels |
| **Collaboration Tools** | Basic (multiplayer cursors) | Advanced (reactions, timer, voting) |
| **Object Snapping** | Yes (Alt+S toggle) | Yes (automatic) |
| **Frames/Containers** | No native frames | Yes (Frames tool) |

---

## Key UX Patterns

### Excalidraw Patterns

1. **Single Top Toolbar** - All creation tools in one horizontal bar at top
2. **Keyboard-First** - Shortcuts prominently displayed and encouraged
3. **Contextual Left Panel** - Properties/alignment appear when objects selected
4. **Right-Click Context Menu** - Alignment, distribution, arrangement
5. **Minimal Distractions** - No persistent collaboration UI cluttering canvas

**Design Goal**: Get users creating immediately with minimal learning curve

### Miro Patterns

1. **Vertical Creation Bar** - Primary tools on left edge (always visible)
2. **Separated Toolbars** - Different functions in different locations (creation left, collaboration top-right, navigation bottom-right)
3. **Floating Context Menus** - Properties panel appears near selected objects
4. **Rich Collaboration UI** - Dedicated top bar for teamwork features
5. **Frame-Based Organization** - Use frames to group and structure content

**Design Goal**: Professional tool with immediate access to advanced features

---

## Alignment Tools Deep Dive

### Excalidraw Alignment

**Trigger**: Right-click on 2+ selected objects

**Options**:
```
┌─────────────────────────┐
│ Context Menu            │
├─────────────────────────┤
│ Align left              │
│ Align right             │
│ Align top               │
│ Align bottom            │
│ Align horizontally      │
│ Align vertically        │
│ ────────────────────    │
│ Distribute horizontally │
│ Distribute vertically   │
│ ────────────────────    │
│ Send to back            │
│ Bring to front          │
└─────────────────────────┘
```

**Also Available In**: Left contextual panel (when objects selected)

**Keyboard Shortcuts**: Ctrl+Shift+Arrow Keys

**Source**: [Excalidraw alignment features](https://github.com/excalidraw/excalidraw/issues/1316)

### Miro Alignment

**Trigger**: Select 2+ objects → Click "Align objects" button in context menu

**Options**:
```
┌─────────────────────────┐
│ Align objects           │
├─────────────────────────┤
│ Align left              │
│ Align right             │
│ Align top               │
│ Align bottom            │
│ Align center (H)        │
│ Align middle (V)        │
│ ────────────────────    │
│ Distribute horizontally │
│ Distribute vertically   │
└─────────────────────────┘
```

**Limitation**: Doesn't adjust spacing - only aligns edges. Distribution depends on distance between first and last objects.

**Special Feature**: Auto Layout (drag grey icon to quickly align widgets)

**Source**: [Miro alignment tools](https://help.miro.com/hc/en-us/articles/360017730973-Structuring-board-content)

---

## Recommendations for Workspace Implementation

### Learn From Excalidraw

1. **✅ Top Horizontal Toolbar** - Simple, familiar, doesn't take vertical space
2. **✅ Keyboard Shortcuts Everywhere** - Show shortcuts in tooltips and menus
3. **✅ Minimal by Default** - Don't overwhelm with too many buttons
4. **✅ Contextual Alignment Panel** - Show alignment tools when 2+ nodes selected (already implemented!)
5. **✅ Right-Click Context Menu** - Quick access to common operations (already implemented!)

### Learn From Miro

1. **⚠️ Vertical Left Toolbar** - Good for many tools, but takes horizontal space
2. **⚠️ Separated Toolbars** - Clear organization, but can feel fragmented
3. **✅ Customizable Toolbar** - Let users pin/unpin and reorder tools
4. **✅ Collaboration Bar** - Separate collaboration features from creation tools
5. **⚠️ Auto Layout Feature** - Interesting but might be complex to implement

### Best Hybrid Approach for Veritable Games Workspace

Based on research, recommended approach:

```
┌────────────────────────────────────────────────────────────┐
│ [Minimal Top Toolbar]                                      │
│ [Export] [Import] | [Undo] [Redo] | [+Text] [+Note] |...  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                   [Infinite Canvas]                        │
│                                                            │
│   [Contextual Toolbars - Floating]                        │
│   - AlignmentToolbar (2+ nodes) ✅ Already implemented    │
│   - FloatingFormatToolbar (editing) ✅ Already implemented│
│   - NodeContextMenu (right-click) ✅ Already implemented  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Rationale**:
1. **Minimal Top Toolbar** - Like Excalidraw, but with essential file operations
2. **Floating Contextual Tools** - Keep existing pattern (AlignmentToolbar, etc.)
3. **Keyboard-First** - Emphasize shortcuts like Excalidraw
4. **Non-Intrusive** - Don't clutter canvas with permanent UI like Miro

**What to Include in Top Toolbar**:
- File operations: Export JSON, Import JSON (currently keyboard-only)
- Edit operations: Undo, Redo (currently keyboard-only)
- Creation shortcuts: Add Text, Create Note (currently right-click only)
- View controls: Zoom, Grid toggle (nice-to-have)

**What to Keep Floating/Contextual**:
- ✅ AlignmentToolbar (2+ nodes selected)
- ✅ FloatingFormatToolbar (editing text)
- ✅ NodeContextMenu (right-click on node)
- ✅ CanvasContextMenu (right-click on canvas)

---

## Implementation Priority

### Priority 1: Top Toolbar (Excalidraw-Style)

**Components**:
```typescript
// WorkspaceToolbar.tsx (NEW)
- Export to JSON button (Ctrl+E tooltip)
- Import from JSON button (Ctrl+Shift+I tooltip)
- Divider
- Undo button (Ctrl+Z tooltip)
- Redo button (Ctrl+Shift+Z tooltip)
- Divider
- Add Text button (click to create)
- Create Note button (click to create)
```

**Effort**: 4-6 hours
**Impact**: High - Makes keyboard-only features discoverable

### Priority 2: Keyboard Shortcut Hints

**Enhancement**: Add keyboard shortcuts to all tooltips and menus
- AlignmentToolbar buttons show "Ctrl+Shift+L" etc.
- NodeContextMenu shows shortcuts next to labels
- FloatingFormatToolbar shows shortcuts

**Effort**: 1-2 hours
**Impact**: Medium - Improves discoverability

### Priority 3: Toolbar Customization (Miro-Style)

**Feature**: Allow users to pin/unpin tools in top toolbar
**Storage**: LocalStorage or user preferences

**Effort**: 6-8 hours
**Impact**: Medium - Power user feature

---

## Sources

### Excalidraw Research
- [The Ultimate Excalidraw Tutorial for Beginners - 2026](https://csswolf.com/the-ultimate-excalidraw-tutorial-for-beginners/)
- [Awesome Excalidraw Keyboard Shortcuts (With Printable PDF)](https://csswolf.com/excalidraw-keyboard-shortcuts-pdf/)
- [General guide on how to use Excalidraw - HackMD](https://hackmd.io/@alkemio/SJuewkPwn)
- [UIOptions | Excalidraw developer docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/ui-options)
- [Custom UI and Styling | excalidraw/excalidraw | DeepWiki](https://deepwiki.com/excalidraw/excalidraw/10.3-custom-ui-and-styling)
- [Excalidraw+ Changelog – Latest Updates & New Features](https://plus.excalidraw.com/changelog)
- [Feature: Align items · Issue #1316 · excalidraw/excalidraw](https://github.com/excalidraw/excalidraw/issues/1316)

### Miro Research
- [Miro's new simplified user interface – Miro Help Center](https://help.miro.com/hc/en-us/articles/20967864443410-Miro-s-new-simplified-user-interface)
- [Meet the new version of Miro – it's customizable now!](https://miro.com/blog/customizable-platform/)
- [Toolbars – Miro Help Center](https://help.miro.com/hc/en-us/articles/360017730553-Toolbars)
- [Shortcuts and hotkeys – Miro Help Center](https://help.miro.com/hc/en-us/articles/360017731033-Shortcuts-and-hotkeys)
- [Structuring board content – Miro Help Center](https://help.miro.com/hc/en-us/articles/360017730973-Structuring-board-content)
- [Working with objects – Miro Help Center](https://help.miro.com/hc/en-us/articles/360017730953-Working-with-objects)
- [Sticky notes – Miro Help Center](https://help.miro.com/hc/en-us/articles/360017572054-Sticky-notes)
- [Shapes – Miro Help Center](https://help.miro.com/hc/en-us/articles/360017730713-Shapes)
- [Text – Miro Help Center](https://help.miro.com/hc/en-us/articles/360017572094-Text)
- [Connection lines – Miro Help Center](https://help.miro.com/hc/en-us/articles/360017730733-Connection-lines)

---

**Research Completed**: February 13, 2026
**Recommendation**: Implement **Excalidraw-style top toolbar** with minimal file operations
**Next Step**: Create WorkspaceToolbar.tsx component
