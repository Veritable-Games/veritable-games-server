# Godot Developer Console - Complete Documentation

## Overview

The **Godot Developer Console** is a comprehensive developer overlay that provides real-time visualization, editing, and management of Godot projects. It's accessed via the backtick (`) keyboard shortcut and displays a semi-transparent overlay over the application's home page.

**Access Control:** Admin or Developer role only

**Purpose:** Enable non-programmers and developers to understand script dependencies, manage multiple project versions, edit scripts, trigger builds, and monitor runtime execution—all through an interactive 3D visualization interface.

---

## Architecture & Layout

### Master Component: `GodotDevOverlay.tsx`

**Location:** `/frontend/src/components/godot/GodotDevOverlay.tsx`

**Visual Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  [Project Selector ▼] [Version Selector ▼]  [Mode Tabs] [×]     │  ← Header (toolbar)
├──────────────────────────┬──────────────────────────────────────┤
│                          │                                      │
│   DependencyGraphViewer  │  ScriptEditor Panel                 │
│   (3D Canvas)            │  (Monaco Editor)                    │
│   • Force-directed graph │  • Current script content            │
│   • Node labels          │  • Syntax highlighting               │
│   • Arrows (colored)     │  • [Save] [Delete] [Restore]        │
│   • Hover tooltips       │  • Unsaved changes indicator         │
│   • Auto-rotation toggle │                                      │
│   • Search box           │  Node Connection Details Panel       │
│   • Isolated node count  │  • Extends: [list]                   │
│   (60% width)            │  • Preloads: [list]                  │
│                          │  • Used by: [list]                   │
│                          │  (40% width)                         │
├──────────────────────────┴──────────────────────────────────────┤
│  Godot Runtime (Collapsible)                                    │
│  [HTML5 Export Preview]  [🔨 Build HTML5] [Build Status]       │
│  (300px height when expanded)                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
GodotDevOverlay (main container)
├── Header
│   ├── ProjectSelector (dropdown)
│   ├── VersionSelector (dropdown)
│   ├── TabSwitcher (dependencies | scenes | classes | files)
│   └── CloseButton
├── MainContent (resizable split panes)
│   ├── DependencyGraphViewer (left 60%)
│   │   ├── Canvas (Three.js)
│   │   ├── ControlPanel
│   │   │   ├── AutoRotateToggle
│   │   │   ├── SearchBox
│   │   │   ├── StatsPanel (nodes/edges/isolated)
│   │   │   └── Tooltips (hover state)
│   │   ├── ConnectionDetailsPanel (when node selected)
│   │   └── SelectableNodes (with event handlers)
│   │
│   └── ScriptEditor (right 40%)
│       ├── EditorHeader (filename, unsaved indicator)
│       ├── MonacoEditor (code content)
│       └── Toolbar
│           ├── SaveButton
│           ├── DeleteButton
│           └── RestoreButton
│
└── RuntimeSection (collapsible)
    ├── GodotRuntime (HTML5 iframe)
    ├── BuildControls
    │   ├── TriggerBuildButton (with status indicator)
    │   ├── BuildStatusDisplay (pending | building | success | failed)
    │   └── LastBuildTimestamp
    └── RuntimeEventMonitor (list of recent events)
```

---

## Core Sub-Components

### 1. **DependencyGraphViewer.tsx**

**Purpose:** Render the 3D dependency graph with interactive visualization

**Features:**

| Feature | Description | Implementation |
|---------|-------------|-----------------|
| **Force-Directed Layout** | Spatial positioning based on dependency relationships | Three-force physics simulation in `/lib/godot/graph-layout.ts` |
| **4 Visualization Modes** | dependencies \| scenes \| classes \| files | Tab switcher, different graph data per mode |
| **Node Rendering** | Spheres with labels positioned in 3D space | THREE.SphereGeometry + canvas text sprites |
| **Edge Rendering** | Directional arrows with color-coded types | THREE.ConeGeometry + THREE.LineSegments |
| **Node Labels** | Script names/paths above each sphere | Canvas-based sprites, distance-based scaling |
| **Edge Colors** | Red (extends) \| Blue (preload) \| Green (load) | Color coding based on dependency type |
| **Hover Tooltips** | Function count, signal count, file path | Raycasting detection + tooltip panel |
| **Click Selection** | Select node → show details panel + context | Raycasting + contextManager state update |
| **Search/Filter** | Find scripts by name, dim non-matches | Search box → ILIKE queries → scene dimming |
| **Auto-Rotation** | Toggleable continuous rotation | OrbitControls.autoRotate flag |
| **Manual Controls** | Drag to rotate, scroll to zoom, right-click pan | OrbitControls (Orbit, Zoom, Pan) |
| **Isolated Node Detection** | Highlight disconnected scripts | Graph analysis, color them red (0xff6b6b) |
| **Node Metadata Display** | Function/signal/export counts | Hover state + connection details panel |
| **Camera Reset** | Return to default view | Button in control panel |
| **Performance** | Handle 300+ nodes smoothly at 60fps | Distance-squared optimizations, lazy rendering |

**Key Properties:**
- **versionId**: Which Godot version to load graph for
- **mode**: Visualization mode (dependencies most common)
- **activeNodePath**: Currently selected script (controls highlighting)
- **onNodeSelect**: Callback when user clicks a node
- **onNodeHover**: Callback for hover detection

**Technical Details:**
- Force-directed layout computed server-side, positions cached in database
- Three.js with OrbitControls for smooth camera interaction
- Canvas text sprites for labels (scales with distance)
- Cone geometry for directional arrows
- Raycasting for click and hover detection
- Animation loop at 60fps with optimization flags

---

### 2. **ScriptEditor.tsx**

**Purpose:** Display and edit individual script files with Monaco editor

**Features:**

| Feature | Description |
|---------|-------------|
| **Syntax Highlighting** | Uses Python syntax (closest to GDScript) |
| **Line Numbers** | Track function positions and errors |
| **Save Button** | POST script content to API |
| **Delete Button** | Remove script from version |
| **Restore Button** | Revert unsaved changes |
| **Unsaved Indicator** | Visual badge when content modified |
| **Read-Only Mode** | When script is archived version |
| **Function Sidebar** | Jump to function definitions |
| **Error Display** | Show parsing errors and validation issues |

**Integration with DependencyGraphViewer:**
- When user clicks node in graph, selected scriptPath is passed
- ScriptEditor loads that script's content from database
- User can edit, save, or restore changes
- Saved changes trigger re-parsing for updated dependency graph

---

### 3. **GodotRuntime.tsx**

**Purpose:** Embed and manage Godot HTML5 exports for gameplay testing

**Features:**

| Feature | Description |
|---------|-------------|
| **iframe Embed** | Loads HTML5 export from `/godot-builds/` |
| **postMessage API** | Receives runtime events from game |
| **Build Integration** | Rebuilds and reloads on demand |
| **Error Handling** | Display build failures |
| **Loading State** | Show spinner during load |
| **Event Forwarding** | Send runtime events to visualization |

**Runtime Event Postage (inside Godot game):**

```gdscript
# res://addons/veritable_tracer/Tracer.gd (auto-included via autoload)
extends Node

func _ready():
    # Initialize tracer
    pass

func trace_function_call(script_path: String, function_name: String, timestamp: float = 0):
    var event = {
        "source": "godot-runtime",
        "event": {
            "type": "function_call",
            "scriptPath": script_path,
            "functionName": function_name,
            "timestamp": timestamp if timestamp > 0 else Time.get_ticks_msec()
        }
    }
    window.parent.postMessage(event, "*")
```

---

## State Management

### ProjectSelector

**Purpose:** Switch between NOXII, NOXII-LEGACY, ENACT projects

**Data Flow:**
```
1. User selects project from dropdown
2. State updated: currentProject = "noxii"
3. VersionSelector refreshed with that project's versions
4. DependencyGraphViewer reloaded with version 1
5. MCP context updated via set_context_node tool
```

### VersionSelector

**Purpose:** Choose which version of project to view/edit

**Data Flow:**
```
1. User selects version (e.g., "v0.02")
2. State updated: currentVersion = 2 (versionId)
3. DependencyGraphViewer reloads graph for that version
4. ScriptEditor clears previous content
5. GodotRuntime updates iframe src to point to new build
6. MCP server notified: currentVersionId = 2
```

### ActiveNodePath

**Purpose:** Track which script is currently selected

**Data Flow:**
```
1. User clicks node in 3D graph OR uses search to select
2. onNodeSelect callback fires with scriptPath
3. ScriptEditor loads content for that script
4. ConnectionDetailsPanel shows dependencies
5. Node highlighted in graph (blue + larger)
6. MCP server notified: selectedNodePath = "res://Player.gd"
```

---

## Keyboard & Interaction Controls

### Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| **Backtick (`)** | Toggle overlay | Any page (if admin/dev) |
| **Escape** | Close overlay | When open |
| **Ctrl+S** | Save current script | In editor |
| **Ctrl+K** | Open search/jump | In graph view |
| **Ctrl+Z** | Undo edits (Monaco) | In editor |
| **Ctrl+Shift+Z** | Redo edits | In editor |

### Mouse Controls (3D Graph)

| Gesture | Action |
|---------|--------|
| **Left Drag** | Rotate view (OrbitControls) |
| **Middle Drag / Scroll** | Zoom in/out |
| **Right Drag** | Pan camera |
| **Click Node** | Select node / show details |
| **Hover Node** | Show tooltip |
| **Double-Click Node** | Center camera on node (future) |

---

## API Integration Points

### GET Endpoints (Read)

```
GET /api/godot/projects
→ Returns: { projects: [{id, slug, title, versionCount}] }

GET /api/godot/projects/{slug}/versions
→ Returns: { versions: [{id, tag, isActive, buildStatus, createdAt}] }

GET /api/godot/versions/{id}/graph?mode=dependencies|scenes|classes|files
→ Returns: { nodes: [...], edges: [...], stats: {...} }

GET /api/godot/versions/{id}/scripts?path=res://Player.gd
→ Returns: { content: "...", metadata: {...}, isModified: false }

GET /api/godot/versions/{id}/build
→ Returns: { status: 'success|building|failed', buildPath, error }

GET /api/godot/versions/{id}/events (SSE)
→ Streams: { type: 'connected|heartbeat|runtime_event', event: {...} }
```

### POST/PUT Endpoints (Write)

```
PUT /api/godot/versions/{id}/scripts
Body: { scriptPath: "res://Player.gd", content: "..." }
→ Returns: { success: true }

POST /api/godot/versions/{id}/build
→ Triggers async build, returns: { buildId, status: 'building' }

POST /api/godot/versions/{id}/runtime-event
Body: { type: 'function_call', scriptPath, functionName, timestamp }
→ Broadcasts to all connected SSE clients
```

---

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Load 300-node graph | <500ms | From database cache (JSONB) |
| Render in Three.js | <1000ms | Including label sprites and edges |
| Click to script load | <200ms | HTTP fetch + editor mount |
| Save script content | <500ms | Database write + re-parse dependency graph |
| Trigger build | <2s | Returns immediately, build runs async |
| Runtime event broadcast | <100ms | SSE push to all clients |
| Search 300 nodes | <50ms | ILIKE database query |

---

## Error Handling

### User-Facing Errors

| Error | Display | Action |
|-------|---------|--------|
| **Build Failed** | Red "❌ Failed" badge | Show error message in tooltip |
| **Script Save Error** | "Save failed" toast | Retry button offered |
| **Graph Load Timeout** | "Failed to load graph" | Refresh button in control panel |
| **Runtime Load Error** | "Failed to load Godot runtime" | Trigger rebuild and reload |

### Server-Side Errors

| Error | Handling | Logging |
|-------|----------|---------|
| **Database connection** | Fallback to API | console.error with timestamp |
| **API 401 (Unauthorized)** | Redirect to login | Auth middleware handles |
| **API 404 (Not Found)** | Show "Script not found" | Check version/path validity |
| **Build process crash** | Mark status as 'failed' | Capture stderr from Godot CLI |

---

## Visual Styling

**Color Palette:**

```
Background:     #0f172a (slate-950)
Text Primary:   #ffffff (white)
Text Secondary: #cbd5e1 (slate-200)
Text Tertiary:  #64748b (slate-500)

Component BG:   #1e293b (slate-800)
Hover BG:       #334155 (slate-700)
Accent BG:      #1e40af (blue-900)

Node Colors:
  Selected:     #3b82f6 (blue-500)
  Isolated:     #ff6b6b (red-600)
  Default:      #64748b (slate-500)

Edge Colors:
  extends:      #ff6b6b (red-600)  -- inheritance
  preload:      #4dabf7 (blue-500) -- static resources
  load:         #82c91e (green-600)-- dynamic resources

Status Colors:
  Success:      #10b981 (green-500)
  Building:     #f59e0b (amber-500)
  Failed:       #ef4444 (red-500)
  Pending:      #6b7280 (gray-500)
```

**Layout:**
- Overlay z-index: 1000+
- Backdrop: `bg-black/40` (40% opacity)
- Container: `w-screen h-screen` (full viewport)
- Header: `h-12` (48px) with `flex-row`
- Main split: 60% graph, 40% editor
- Runtime section: collapsible, 300px when expanded
- Control panels: `absolute` positioning with `z-20`

---

## Integration with MCP Server

### Context Awareness

When user selects a node in the visualization:

```
1. onClick handler fires with scriptPath
2. contextManager.setContextNode(versionId, scriptPath) called
3. MCP server state updated in memory
4. User asks Claude Code: "What does this script do?"
5. Claude Code calls MCP tools with context from godot://context resource
6. Tools return script content, dependencies, usage analysis
7. Claude provides explanation based on graph structure
```

### Build Status Sync

```
1. User clicks "🔨 Build HTML5" button
2. trigger_build() tool called, returns buildId
3. UI shows "⏳ Building..." badge
4. Poll get_build_status() every 2 seconds
5. When status = 'success':
   - Badge shows "✅ Built"
   - GodotRuntime iframe reloaded
   - MCP server cache invalidated
6. User can now interact with rebuilt game
```

### Runtime Event Visualization

```
1. Game runs in embedded GodotRuntime iframe
2. Tracer.gd sends postMessage events (function calls, signals)
3. GodotRuntime forwards to /api/godot/versions/{id}/runtime-event
4. SSE endpoint broadcasts to all connected viewers
5. DependencyGraphViewer receives event in real-time
6. Selected node pulses yellow for 2 seconds
7. MCP getRuntimeEvents() returns aggregated execution trace
8. Claude Code can identify hotspots: "Player._process called 500x, Enemy._process called 300x"
```

---

## Typical Developer Workflow

1. **Open Overlay** → Press backtick (`)
2. **Select Project** → Dropdown "NOXII"
3. **Select Version** → Dropdown "v0.02"
4. **View Graph** → 3D visualization loads with all 301 scripts
5. **Click Node** → "res://Player.gd" highlighted in blue
6. **See Dependencies** → Connection details show:
   - Extends: Entity.gd, CharacterBody2D
   - Preloads: PlayerAnimator.gd, SoundManager.gd
   - Used by: GameManager.gd, Enemy.gd
7. **Edit Script** → Monaco editor shows Player.gd content
8. **Make Changes** → Type code, unsaved badge appears
9. **Save** → Click Save button, changes persisted
10. **Trigger Build** → Click "🔨 Build HTML5", status goes to "⏳ Building..."
11. **Play Game** → HTML5 export loads in iframe at bottom
12. **Monitor Runtime** → Nodes pulse yellow as functions execute
13. **Ask Claude Code** → "Why is Player._process being called so much?"
14. → Claude uses MCP to fetch runtime events, provides analysis

This console consolidates the entire Godot development workflow into a single interface accessible from the web application.

---

## Related Documentation

- [Godot System Architecture](/docs/godot/ARCHITECTURE.md) - Overall system design
- [MCP Server Integration](/docs/godot/MCP_SERVER.md) - Claude Code integration details
- [Script Parser Service](/docs/godot/PARSER_SERVICE.md) - GDScript analysis
- [3D Visualization](/docs/godot/VISUALIZATION.md) - Three.js implementation
