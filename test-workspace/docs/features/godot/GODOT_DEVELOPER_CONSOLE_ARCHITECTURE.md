# Godot Developer Console Architecture

**Date**: January 1, 2026
**Purpose**: Complete guide to the Godot developer console, MCP router, and real-time visualization system
**Status**: Phase 3 Complete (Multi-Instance with Unix Sockets), Phase 4+ In Progress

---

## Executive Summary

The Godot developer console is an **integrated web-based IDE** for managing, analyzing, and debugging Godot projects. It consists of:

1. **Frontend Console** (React UI on home page)
   - Accessed via backtick (`) keyboard shortcut
   - 3D dependency graph visualization (Three.js)
   - Script editor with real-time updates
   - Panel layout system with grid-based repositioning

2. **Backend Services** (Next.js API routes)
   - RESTful API for projects/versions/scripts
   - Server-Sent Events (SSE) for real-time updates
   - PostgreSQL storage for metadata
   - Script parsing and graph computation

3. **MCP Router** (Standalone service)
   - Runs as separate Node.js process
   - Provides Claude Code MCP interface to Godot projects
   - Auto-detects Godot version from working directory
   - Manages multi-instance lifecycle with Unix sockets

---

## 1. Complete System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Browser (User Device)                     │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │         Home Page (Stellar Viewer + Console)              │  │
│  │                                                             │  │
│  │  Press: Backtick (`) to toggle console                    │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │ GodotDevOverlay (Main Console Container)             │ │  │
│  │  │                                                        │ │  │
│  │  │  ┌────────────────────┐         ┌──────────────────┐ │ │  │
│  │  │  │ Project Selector   │         │ Version Selector │ │ │  │
│  │  │  └────────────────────┘         └──────────────────┘ │ │  │
│  │  │                                                        │ │  │
│  │  │  ┌───────────────────────────────────────────────┐   │ │  │
│  │  │  │                                               │   │ │  │
│  │  │  │  DependencyGraphViewer                        │   │ │  │
│  │  │  │  (3D Graph, 60% width)                        │   │ │  │
│  │  │  │  - Three.js + OrbitControls                   │   │ │  │
│  │  │  │  - Draggable info panels                      │   │ │  │
│  │  │  │  - Click to select scripts                    │   │ │  │
│  │  │  │  - Ctrl+L toggle labels                       │   │ │  │
│  │  │  │                                               │   │ │  │
│  │  │  └───────────────────────────────────────────────┘   │ │  │
│  │  │  │ ScriptEditorPanel (40% width)                    │ │  │
│  │  │  │ - Show selected script                           │ │  │
│  │  │  │ - Ctrl+S to save                                 │ │  │
│  │  │  │ - Triggers graph rebuild                         │ │  │
│  │  │  └──────────────────────────────────────────────────┘ │ │  │
│  │  │                                                        │ │  │
│  │  │  ┌──────────────────────────────────────────────────┐ │ │  │
│  │  │  │ TerminalPanel (Draggable)                        │ │ │  │
│  │  │  │ - MCP startup commands                           │ │ │  │
│  │  │  │ - Available tools list                           │ │ │  │
│  │  │  └──────────────────────────────────────────────────┘ │ │  │
│  │  │                                                        │ │  │
│  │  │  Grid-Based Layout:                                 │ │  │
│  │  │  - Panels snap to 64px grid                          │ │  │
│  │  │  - Ctrl+Click to reposition                          │ │  │
│  │  │  - Collision detection prevents overlaps             │ │  │
│  │  └────────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                    (HTTP/WebSocket)                              │
└────────────────────────────────┼────────────────────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
         ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐
         │ API Routes       │  │ SSE Events       │  │ WebSocket    │
         │ RESTful          │  │ Real-time updates│  │ (Future)     │
         │ /api/godot/**    │  │ /events          │  │              │
         └────────┬─────────┘  └────────┬─────────┘  └──────────────┘
                  │                     │
                  └─────────────┬───────┘
                                │
         ┌──────────────────────┴──────────────────────┐
         │                                              │
    ┌────▼────────────────────────────────────────────▼────┐
    │    Production Server (192.168.1.15)                   │
    │    Ubuntu Server 22.04 LTS, Docker, PostgreSQL 15    │
    │                                                        │
    │  ┌──────────────────────────────────────────────────┐ │
    │  │ Next.js Application Container (port 3000)        │ │
    │  │                                                   │ │
    │  │  API Routes:                                     │ │
    │  │  ├─ /api/godot/projects                          │ │
    │  │  ├─ /api/godot/projects/[slug]/versions         │ │
    │  │  ├─ /api/godot/versions/[id]/scripts            │ │
    │  │  ├─ /api/godot/versions/[id]/graph              │ │
    │  │  ├─ /api/godot/versions/[id]/events (SSE)       │ │
    │  │  └─ /api/godot/versions/[id]/runtime-event      │ │
    │  │                                                   │ │
    │  │  Services:                                        │ │
    │  │  ├─ GodotService (database operations)           │ │
    │  │  ├─ GodotParserService (GDScript analysis)       │ │
    │  │  ├─ GodotGitService (version control)            │ │
    │  │  ├─ GraphLayoutService (3D visualization)        │ │
    │  │  └─ PanelLayoutContext (UI state)                │ │
    │  │                                                   │ │
    │  └──────────────────────────────────────────────────┘ │
    │                           │                             │
    │                           ▼                             │
    │  ┌──────────────────────────────────────────────────┐ │
    │  │ PostgreSQL 15 Database (veritable-games schema) │ │
    │  │                                                   │ │
    │  │  Tables:                                         │ │
    │  │  ├─ godot_projects (project metadata)            │ │
    │  │  ├─ godot_versions (version + instance tracking) │ │
    │  │  ├─ godot_scripts (script content + parsed data) │ │
    │  │  └─ godot_dependency_graph (cached graph JSON)   │ │
    │  │                                                   │ │
    │  └──────────────────────────────────────────────────┘ │
    │                                                        │
    │  ┌──────────────────────────────────────────────────┐ │
    │  │ WebSocket Server (port 3002, background)        │ │
    │  │ - Real-time events (future phase 4)             │ │
    │  │ - Workspace collaborative updates               │ │
    │  │                                                   │ │
    │  └──────────────────────────────────────────────────┘ │
    │                                                        │
    └────────────────────────────────────────────────────────┘
                                 │
                                 │ (via Docker Unix socket)
                                 ▼
    ┌────────────────────────────────────────────────────────┐
    │  Docker Volumes (persistent data)                       │
    │                                                         │
    │  /home/user/docker-ssd/volumes/                        │
    │  ├─ m4s0kwo4-godot-projects/ (project files)          │
    │  ├─ m4s0kwo4-godot-builds/ (HTML5 exports)            │
    │  └─ generated_postgres_datadir/ (PostgreSQL data)     │
    │                                                         │
    └────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│              Godot MCP Router (Separate Node.js Service)              │
│              Can run on same server or locally for development        │
│                                                                        │
│  Input: stdio (JSON-RPC from Claude Code)                            │
│  Process: router-phase3.ts                                            │
│    ├─ Auto-detect Godot version from working directory              │
│    ├─ Query database for versionId                                  │
│    ├─ Get or spawn instance for version                             │
│    └─ Connect to instance via Unix socket                           │
│  Output: stdio (JSON-RPC response to Claude Code)                   │
│                                                                        │
│  Instance Pool:                                                       │
│  ├─ Instance (noxii/0.16) → /tmp/godot-mcp-noxii-0.16.sock        │
│  ├─ Instance (enact/0.09) → /tmp/godot-mcp-enact-0.09.sock        │
│  └─ Instance (...)       → ...                                      │
│                                                                        │
│  Features:                                                            │
│  ✅ Auto-detection from CWD                                          │
│  ✅ Multi-instance isolation                                         │
│  ✅ Idle timeout cleanup (30 minutes)                                │
│  ✅ Health monitoring via database                                   │
│  ✅ Circuit breaker & retry logic                                    │
│  ✅ Unix socket IPC for efficiency                                   │
│                                                                        │
│  Available Tools:                                                     │
│  ├─ get_dependency_graph [options]                                   │
│  ├─ analyze_script [path]                                            │
│  ├─ list_scripts [filter]                                            │
│  ├─ search_scripts [query]                                           │
│  ├─ get_script_metadata [path]                                       │
│  └─ ... 10+ more Godot-specific tools                               │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow: Selecting and Editing a Script

### Step 1: Open Console & Select Project

```
User presses backtick (`)
  │
  ├─ GodotDevOverlay mounts
  └─ Calls: GET /api/godot/projects
       │
       ├─ GodotService.getProjects()
       │   └─ Query: SELECT * FROM godot_projects
       │
       └─ Returns: [
           { slug: "noxii", title: "Noxii Game" },
           { slug: "enact", title: "Enact Engine" }
          ]
       │
       └─ Display dropdown
```

### Step 2: Select Version

```
User selects "Noxii" project
  │
  └─ Calls: GET /api/godot/projects/noxii/versions
       │
       ├─ GodotService.getVersions("noxii")
       │   └─ Query: SELECT * FROM godot_versions WHERE project_slug = 'noxii'
       │      Returns: [
       │        { id: "uuid1", tag: "0.16", is_active: true, instance_pid: 2345 },
       │        { id: "uuid2", tag: "0.15", is_active: false }
       │      ]
       │
       └─ Auto-select active version (is_active = true)
            │
            └─ Pass versionId to DependencyGraphViewer
```

### Step 3: Load Dependency Graph

```
DependencyGraphViewer mounts with versionId="uuid1"
  │
  └─ Calls: GET /api/godot/versions/uuid1/graph
       │
       ├─ GodotService.getDependencyGraph("uuid1")
       │   └─ Query: SELECT graph_data FROM godot_dependency_graph WHERE version_id = 'uuid1'
       │      Returns: {
       │        "nodes": [
       │          { id: "Main.gd", label: "Main.gd", ... },
       │          { id: "Player.gd", label: "Player.gd", ... }
       │        ],
       │        "links": [
       │          { source: "Main.gd", target: "Player.gd" }
       │        ]
       │      }
       │
       └─ Three.js renders force-directed 3D graph
            │
            └─ User can click nodes, rotate view, etc.
```

### Step 4: Click Script Node & Load Script

```
User clicks "Player.gd" node in graph
  │
  ├─ DependencyGraphViewer detects click
  │   └─ Extracts script path from node
  │
  └─ Calls: GET /api/godot/versions/uuid1/scripts?path=Player.gd
       │
       ├─ GodotService.getScript("uuid1", "Player.gd")
       │   └─ Query: SELECT content, dependencies, functions, signals FROM godot_scripts
       │      WHERE version_id = 'uuid1' AND file_path = 'Player.gd'
       │
       ├─ Returns: {
       │   "path": "Player.gd",
       │   "content": "extends Node2D\nfunc _process(delta): ...",
       │   "dependencies": ["res://Main.gd"],
       │   "functions": [
       │     { name: "_process", signature: "_process(delta)", line: 5 }
       │   ]
       │ }
       │
       └─ ScriptEditorPanel displays content with syntax highlighting
            │
            └─ Show "Save (Ctrl+S)" button
```

### Step 5: User Edits & Saves

```
User modifies Player.gd content
  │
  └─ User presses Ctrl+S
       │
       └─ Calls: PUT /api/godot/versions/uuid1/scripts
            │
            ├─ Request body: {
            │    "path": "Player.gd",
            │    "content": "extends Node2D\nfunc _process(delta): ...\nfunc new_method(): ..."
            │  }
            │
            ├─ ╔════════════════════════════════════════════════════╗
            │  ║ PHASE 1 (BLOCKING - Client waits)                 ║
            │  ╚════════════════════════════════════════════════════╝
            │
            ├─ Step 1a: Update database
            │   └─ Query: UPDATE godot_scripts SET content = $1 WHERE ...
            │
            ├─ Step 1b: Re-parse script
            │   └─ GodotParserService.parseScript(newContent)
            │       Returns: { dependencies: [...], functions: [...], signals: [...] }
            │
            ├─ Step 1c: Update metadata
            │   └─ Query: UPDATE godot_scripts SET dependencies = $1, functions = $2, ...
            │
            ├─ Step 1d: Rebuild dependency graph
            │   └─ GraphLayoutService.computeLayout(allScripts)
            │       Uses force-directed algorithm
            │       Returns: new graph JSON
            │
            ├─ Step 1e: Store graph
            │   └─ Query: UPDATE godot_dependency_graph SET graph_data = $1, computed_at = NOW()
            │
            ├─ Step 1f: Return response
            │   └─ Response: { success: true, graph: {...} }
            │
            ├─ ╔════════════════════════════════════════════════════╗
            │  ║ PHASE 2 (ASYNC - Client continues)                ║
            │  ╚════════════════════════════════════════════════════╝
            │
            ├─ 2a: Sync to filesystem (background)
            │   └─ GodotGitService.syncScriptToFilesystem(versionId, path, content)
            │       └─ Write file: /app/godot-projects/noxii/0.16/Player.gd
            │
            ├─ 2b: Git commit (background)
            │   └─ GodotGitService.commitScriptChange(versionId, path)
            │       └─ git add Player.gd && git commit -m "Update Player.gd"
            │
            ├─ 2c: Broadcast update via SSE
            │   └─ broadcastGraphUpdate(versionId)
            │       └─ Send SSE event: "graph_update" to all connected clients for this version
            │
            └─ DependencyGraphViewer updates 3D graph with new layout
```

---

## 3. Real-Time Communication (SSE)

### SSE Connection Setup

```
DependencyGraphViewer mounts
  │
  └─ useGodotRuntimeEvents hook initializes
       │
       └─ Creates EventSource("/api/godot/versions/uuid1/events")
            │
            ├─ Browser creates persistent HTTP connection
            │
            └─ Server (route.ts) handles connection
                 │
                 ├─ Get versionId from route params
                 ├─ Add to clientsByVersion map
                 │   clientsByVersion[versionId] = Set(controller1, controller2, ...)
                 │
                 ├─ Send initial event: "connected"
                 │   └─ client.data = JSON.stringify({ type: "connected", timestamp: ... })
                 │
                 └─ Start heartbeat (every 30s)
                     └─ client.data = JSON.stringify({ type: "heartbeat" })
```

### Event Broadcasting

```
When script is saved (Phase 2 above):
  │
  └─ broadcastGraphUpdate(versionId)
       │
       ├─ Get all controllers for versionId from clientsByVersion
       │   controllers = clientsByVersion[versionId]
       │
       └─ For each controller:
            │
            └─ controller.enqueue({
                 "data": JSON.stringify({
                   type: "graph_update",
                   timestamp: new Date(),
                   newGraph: {...}
                 })
               })
                 │
                 └─ Browser's onmessage handler receives event
                      │
                      └─ useGodotRuntimeEvents updates state
                           │
                           └─ DependencyGraphViewer re-renders with new graph
```

### Connection Lifecycle

```
┌─────────────────────────────────────────────────────┐
│ Client Connects                                     │
├─────────────────────────────────────────────────────┤
│ Server:                                             │
│  ├─ Add to clientsByVersion[versionId]             │
│  ├─ Send: "connected" event                        │
│  └─ Start 30s heartbeat timer                      │
│                                                     │
│ Client:                                             │
│  ├─ EventSource.onmessage receives "connected"     │
│  ├─ Set state.connected = true                     │
│  └─ Start 3s reconnect timer (reset each heartbeat)│
└─────────────────────────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
    Server Sends    Client Sees    Connection
    Event Type       Timestamp     Status
       │               │               │
    heartbeat → no action       Timer resets
       │
    graph_update
       │
       └─ Update graph in 3D viewer
```

---

## 4. MCP Router Integration

### How Claude Code Interacts with Godot

```
Developer's Terminal / Claude Code
  │
  ├─ CWD: /home/user/Projects/veritable-games-main/frontend/godot-projects/noxii/0.16/scripts/
  │
  ├─ Invokes: node dist/router-phase3.js
  │  (via stdio)
  │
  └─ Sends JSON-RPC request:
     {
       "jsonrpc": "2.0",
       "id": 1,
       "method": "tools/call",
       "params": {
         "name": "get_dependency_graph",
         "arguments": { "filters": { "includeExternal": false } }
       }
     }
       │
       └─ Router process (router-phase3.ts)
            │
            ├─ Parse JSON-RPC request
            │
            ├─ Auto-detect version from CWD
            │   └─ Extract: noxii/0.16 from path
            │       └─ Query: SELECT id FROM godot_versions WHERE ... tag = '0.16' AND project_slug = 'noxii'
            │           └─ Returns: versionId = "uuid1"
            │
            ├─ Get or spawn instance
            │   └─ Query: SELECT instance_socket_path FROM godot_versions WHERE id = 'uuid1'
            │       └─ If not running: spawn new instance
            │           └─ Calls: spawner.spawnInstance("uuid1")
            │               └─ Starts: node dist/godot-mcp-instance.js
            │                   └─ Listens on Unix socket: /tmp/godot-mcp-noxii-0.16.sock
            │                       └─ Updates DB: instance_socket_path, instance_pid, instance_status
            │
            ├─ Connect to instance
            │   └─ socket-transport.connectToSocket("/tmp/godot-mcp-noxii-0.16.sock")
            │       └─ Opens Unix socket client
            │
            ├─ Forward request to instance
            │   └─ Send same JSON-RPC request over socket
            │       └─ Instance processes it (queries local version data)
            │
            ├─ Receive response from instance
            │   └─ {
            │       "jsonrpc": "2.0",
            │       "id": 1,
            │       "result": {
            │         "nodes": [...],
            │         "links": [...],
            │         "metadata": {...}
            │       }
            │     }
            │
            ├─ Record activity (for idle timeout)
            │   └─ Query: UPDATE godot_versions SET instance_last_heartbeat = NOW() WHERE id = 'uuid1'
            │
            └─ Return response to Claude Code (via stdio)
                 │
                 └─ Claude Code receives graph and can analyze/modify
```

### Instance Lifecycle Management

```
Instance Spawned
  ├─ PID 12345 created
  ├─ Socket /tmp/godot-mcp-noxii-0.16.sock created
  ├─ DB updated: instance_pid = 12345, instance_status = 'running'
  │
  └─ Activity Loop
      ├─ Requests received → last_heartbeat updated
      ├─ Idle timeout = 30 minutes
      │   └─ If no activity for 30 min, mark for cleanup
      │
      └─ Cleanup triggered
          ├─ Kill process: kill(12345)
          ├─ Remove socket: unlink(/tmp/godot-mcp-noxii-0.16.sock)
          ├─ Update DB: instance_status = 'stopped', instance_pid = NULL
          │
          └─ Next request with same version → Spawn new instance
```

### Available Tools

When Claude Code calls tools on a Godot version:

```
Meta Tools:
├─ ping() → Echo test
├─ debug_detection() → Show detected versionId
└─ debug_instances() → List all running instances

Script Analysis:
├─ get_dependency_graph(filters?) → Full dependency visualization
├─ analyze_script(path) → Detailed script analysis
├─ list_scripts(filter?) → All scripts in version
├─ search_scripts(query) → Find scripts by name/content
└─ get_script_metadata(path) → Functions, signals, exports

Script Modification:
├─ update_script(path, content) → Change script (triggers rebuild)
├─ create_script(path, content) → New script
└─ delete_script(path) → Remove script

Build & Index:
├─ build_html5() → Compile for web export
├─ reindex_scripts() → Scan filesystem for changes
└─ get_build_status() → Check build progress

Version Management:
├─ create_version(tag, path) → New version
├─ list_versions() → All versions for project
└─ set_active_version(tag) → Make version active
```

---

## 5. Database Schema

### godot_projects
```sql
CREATE TABLE godot_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_slug TEXT UNIQUE NOT NULL,  -- 'noxii', 'enact', etc.
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### godot_versions
```sql
CREATE TABLE godot_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_slug TEXT NOT NULL REFERENCES godot_projects(project_slug),
  version_tag TEXT NOT NULL,          -- '0.16', '0.15', etc.
  is_active BOOLEAN DEFAULT false,
  extracted_path TEXT,                -- /app/godot-projects/noxii/0.16
  build_path TEXT,                    -- /app/godot-builds/noxii/0.16
  build_status TEXT DEFAULT 'pending', -- 'pending', 'building', 'success', 'failed'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Phase 3 additions (MCP Router tracking):
  instance_socket_path TEXT,          -- /tmp/godot-mcp-noxii-0.16.sock
  instance_pid INTEGER,
  instance_status TEXT,               -- 'running', 'stopped', 'error'
  instance_last_heartbeat TIMESTAMP,
  instance_created_at TIMESTAMP,
  instance_error_message TEXT,

  UNIQUE(project_slug, version_tag)
);
```

### godot_scripts
```sql
CREATE TABLE godot_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES godot_versions(id),
  file_path TEXT NOT NULL,            -- 'Player.gd', 'Enemies/Goblin.gd'
  script_name TEXT,                   -- 'Player'
  content TEXT NOT NULL,
  original_content TEXT,              -- For diff tracking
  is_modified BOOLEAN DEFAULT false,
  dependencies JSONB,                 -- ["res://Main.gd", ...]
  functions JSONB,                    -- [{ name: "...", signature: "...", line: ... }, ...]
  signals JSONB,                      -- [{ name: "...", args: [...] }, ...]
  exports JSONB,                      -- [{ name: "...", type: "...", default: ... }, ...]
  last_edited_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(version_id, file_path)
);
```

### godot_dependency_graph
```sql
CREATE TABLE godot_dependency_graph (
  version_id UUID PRIMARY KEY REFERENCES godot_versions(id),
  graph_data JSONB,                   -- { nodes: [...], links: [...] }
  computed_at TIMESTAMP DEFAULT NOW(),

  -- Structure:
  -- {
  --   "nodes": [
  --     { "id": "Player.gd", "label": "Player", "x": 10, "y": 5, "z": -3 },
  --     { "id": "Main.gd", "label": "Main", ... }
  --   ],
  --   "links": [
  --     { "source": "Main.gd", "target": "Player.gd", "type": "extends" }
  --   ],
  --   "metadata": { "totalScripts": 15, "totalDependencies": 42 }
  -- }
);
```

---

## 6. Frontend Component Hierarchy

```
page.tsx (Home page)
  │
  ├─ <IframeBrowser> (Stellar viewer)
  │   └─ window.postMessage for pause/resume
  │
  └─ {admin && <GodotDevOverlay>} (Toggle with backtick)
      │
      ├─ <ProjectVersionSelector>
      │   ├─ Project dropdown → GET /api/godot/projects
      │   └─ Version dropdown → GET /api/godot/projects/[slug]/versions
      │
      ├─ <PanelLayoutProvider>
      │   │ (Manages grid-based panel layout)
      │   │
      │   ├─ <DependencyGraphViewer>
      │   │   ├─ <Canvas> (Three.js)
      │   │   │   └─ Force-directed graph layout
      │   │   │
      │   │   ├─ <ScriptInfoPanel> (draggable)
      │   │   │   └─ Shows selected script metadata
      │   │   │
      │   │   └─ <SearchPanel> (draggable)
      │   │       └─ Filter/find scripts
      │   │
      │   ├─ <ScriptEditorPanel>
      │   │   ├─ Displays script content
      │   │   ├─ Syntax highlighting
      │   │   └─ Save button (Ctrl+S)
      │   │
      │   └─ <TerminalPanel> (draggable)
      │       └─ MCP commands reference
      │
      └─ useGodotRuntimeEvents
          └─ EventSource to /api/godot/versions/[id]/events
              └─ Updates DependencyGraphViewer on graph_update
```

---

## 7. API Route Tree

```
/api/godot/
├─ GET /projects
│   └─ List all projects
│
├─ GET /projects/[slug]
│   └─ Get specific project
│
├─ POST /projects
│   └─ Create new project (admin only)
│
├─ GET /projects/[slug]/versions
│   └─ List versions for project
│
└─ /versions/[id]/
    ├─ GET / (info)
    │
    ├─ GET /scripts
    │   └─ List all scripts or get single script (?path=...)
    │
    ├─ PUT /scripts
    │   └─ Update script (triggers Phase 1 & 2)
    │
    ├─ POST /scripts/search
    │   └─ Search scripts
    │
    ├─ GET /graph
    │   └─ Fetch dependency graph JSON
    │
    ├─ GET /events (SSE)
    │   └─ Real-time updates connection
    │
    ├─ POST /runtime-event
    │   └─ Receive events from GodotRuntime
    │
    ├─ GET /panel-positions
    │   └─ Retrieve saved panel layout
    │
    ├─ POST /panel-positions
    │   └─ Save panel layout
    │
    ├─ POST /build
    │   └─ Trigger HTML5 export
    │
    └─ POST /reindex
        └─ Rescan filesystem for scripts
```

---

## 8. Key Hooks & Utilities

### useGodotRuntimeEvents
```typescript
const { events, connected, error } = useGodotRuntimeEvents(versionId);
// Returns stream of: { type: "connected" | "heartbeat" | "graph_update" | "runtime_event", ... }
// Auto-reconnects every 3s if disconnected
```

### useDraggable (for Panels)
```typescript
const { position, isDragging, handlers } = useDraggable(panelId, initialPosition);
// Snaps to 64px grid
// Detects collisions with other panels
// Stores position in localStorage
```

### PanelLayoutContext
```typescript
const { registerPanel, unregisterPanel, getPanelPosition, movePanelGridDelta } = usePanelLayout();
// Manages all draggable panels in console
// Prevents overlaps
// Shows grid overlay on Ctrl+hold
```

### Graph Layout Utilities
```typescript
const layout = computeForceDirectedLayout(nodes, links, iterations);
// Returns: { x, y, z } for each node
// Uses 3D force-directed algorithm
// Optimized for interaction responsiveness
```

---

## 9. Script Parsing

### GodotParserService

Analyzes GDScript to extract:

```typescript
interface ScriptMetadata {
  path: string;
  className: string;
  dependencies: string[]; // ["res://Main.gd", "res://Utils/Math.gd"]
  functions: Array<{
    name: string;
    signature: string; // "_ready()" or "calculate_damage(attacker: Node, damage: int) -> int"
    isSignal: boolean;
    line: number;
  }>;
  signals: Array<{
    name: string;
    args: string[];
  }>;
  exports: Array<{
    name: string;
    type: string;
    defaultValue: any;
  }>;
}
```

**Parse targets**:
- `extends SomeClass` → dependency
- `preload("res://path.gd")` → dependency
- `func name(args):` → function
- `signal name(args):` → signal
- `@export var name: Type:` → export

---

## 10. Panel Positioning System

### Grid System

```
Grid size: 64 pixels
Window: 1600 × 900

Example positions:
┌──────────────────────────────────┐
│ (0, 0)                       (25, 0)
│
│ (0, 7)                       (15, 7)
│   ┌─────────────────────────┐
│   │ DependencyGraphViewer   │
│   │ (960 × 448px)           │
│   └─────────────────────────┘
│
│ (0, 14)         (10, 14)      (15, 14)
│   ┌──────────────┬─────────────────┐
│   │  Editor      │   Terminal      │
│   │              │   (drag me!)    │
│   └──────────────┴─────────────────┘
│
└──────────────────────────────────┘

When dragging with Ctrl+Click:
1. Show grid overlay
2. Snap mouse to nearest grid point
3. Move panel
4. Check for collisions
5. If collision: push other panels away
6. Store position in localStorage
```

### Collision Detection Algorithm

```typescript
function detectCollision(panel1, panel2): boolean {
  return !(
    panel1.right < panel2.left ||
    panel1.left > panel2.right ||
    panel1.bottom < panel2.top ||
    panel1.top > panel2.bottom
  );
}

function resolveCollisions(panels, movedPanel) {
  for (let other of panels) {
    if (detectCollision(movedPanel, other)) {
      const pushDirection = calculatePushDirection(movedPanel, other);
      other.position += (pushDirection * gridSize);
      // Recursively check new position
      resolveCollisions(panels, other);
    }
  }
}
```

---

## 11. Security & Authorization

```typescript
// All API routes wrapped with withSecurity:
export const GET = withSecurity(async (request) => {
  const user = await getCurrentUser(request);

  if (!user || !["admin", "developer"].includes(user.role)) {
    return errorResponse(
      new PermissionError("Godot console requires admin/developer role")
    );
  }

  // Route handler
});
```

**SSE Security Note**: Uses session cookies (EventSource limitation, no custom headers)

---

## 12. Performance Characteristics

| Operation | Time | Details |
|-----------|------|---------|
| Load projects | <100ms | Simple DB query, cached |
| Load versions | <100ms | DB query on project_slug |
| Load dependency graph | 200-500ms | Depends on graph size (10-50 nodes typical) |
| Compute layout | 500-2000ms | Force-directed algorithm iterations |
| Render 3D graph | 16ms/frame | Three.js rendering |
| Script save | 1-3 sec | Phase 1 (blocking) includes graph rebuild |
| Graph broadcast | <50ms | SSE push to all connected clients |

---

## 13. Phase Progression

### Phase 1: UI Foundation (Complete)
- ✅ Project/version selection
- ✅ Script viewing
- ✅ Basic dependency graph
- ✅ Panel layout system

### Phase 2: Real-Time (Complete)
- ✅ SSE for graph updates
- ✅ Script editing & saving
- ✅ Two-phase save operation
- ✅ Draggable panels

### Phase 3: MCP Router (Complete)
- ✅ Auto-detection from CWD
- ✅ Multi-instance lifecycle
- ✅ Unix socket IPC
- ✅ Database-backed registry
- ✅ Tool forwarding

### Phase 4: Instance Sockets (In Progress)
- ⏳ Godot MCP instance listening on Unix socket
- ⏳ Direct socket communication
- ⏳ Persistent instance state

### Phase 5: Advanced Features (Planned)
- 📋 Automated monitoring dashboard
- 📋 Script validation & linting
- 📋 Collaborative editing
- 📋 WebSocket upgrade from SSE

---

## 14. Development Workflow

### For Frontend Changes

```bash
# Edit component (e.g., DependencyGraphViewer.tsx)
vim frontend/src/components/godot/DependencyGraphViewer.tsx

# Type check
npm run type-check

# Test in dev
npm run dev
# Open browser, press backtick, navigate console

# Commit
git add frontend/src/components/godot/DependencyGraphViewer.tsx
git commit -m "feat: [description]"
git push origin main
# Auto-deploys to production in 2-5 min
```

### For API Route Changes

```bash
# Edit route (e.g., /api/godot/versions/[id]/graph)
vim frontend/src/app/api/godot/versions/\[id\]/graph/route.ts

# Type check
npm run type-check

# Test manually
curl http://localhost:3000/api/godot/versions/[uuid]/graph

# Commit & deploy
git add frontend/src/app/api/godot/versions/\[id\]/graph/route.ts
git commit -m "feat: [description]"
git push origin main
```

### For MCP Router Changes

```bash
# Edit router (e.g., detector.ts)
vim frontend/mcp-servers/godot-router/src/detector.ts

# Build
npm run build  # from godot-router directory

# Test
npm run test

# Deploy
# Restart router process manually or via deployment system
./start-router.sh
```

---

## 15. Troubleshooting

### Console Won't Open

**Symptoms**: Backtick (`) does nothing
**Check**:
1. User is logged in as admin/developer?
   ```bash
   curl http://localhost:3000/api/auth/me | jq .role
   ```
2. Page fully loaded? Try after 2 seconds
3. Browser DevTools → Errors? Check `/api/godot/projects` response

**Fix**:
```bash
# Check permissions
curl http://localhost:3000/api/godot/projects -H "Cookie: session=..."

# Check database
psql postgresql://... -c "SELECT * FROM godot_projects LIMIT 1;"
```

### Graph Doesn't Load

**Symptoms**: DependencyGraphViewer shows blank canvas
**Check**:
```bash
curl http://localhost:3000/api/godot/versions/[uuid]/graph | jq .

# Check database
psql postgresql://... -c "SELECT COUNT(*) FROM godot_scripts WHERE version_id = '[uuid]';"
```

**Fix**: Rebuild graph
```bash
# From browser console
fetch('/api/godot/versions/[uuid]/reindex', { method: 'POST' })
```

### MCP Router Can't Find Version

**Symptoms**: Claude Code reports "Unknown Godot version"
**Check**:
1. Working directory is correct?
   ```bash
   pwd  # Should contain "godot-projects/[slug]/[tag]/..."
   ```
2. Version exists in database?
   ```bash
   psql postgresql://... -c "SELECT * FROM godot_versions WHERE project_slug = 'noxii';"
   ```

**Fix**: Create version entry
```bash
# Insert into database manually, or
# Use admin UI to create version
```

### SSE Connection Drops

**Symptoms**: Real-time updates stop after 1-2 minutes
**Check**: Browser console for connection errors
**Fix**:
1. Check server-side SSE route
2. Ensure heartbeat is sending every 30s
3. Client should auto-reconnect (3s interval)

---

## 16. References & Documentation

- **Frontend Code**: `/frontend/src/components/godot/`
- **API Routes**: `/frontend/src/app/api/godot/`
- **Services**: `/frontend/src/lib/godot/`
- **MCP Router**: `/frontend/mcp-servers/godot-router/`
- **Database Schema**: `/docs/database/README.md` (godot_* tables)
- **System Infrastructure**: `/docs/deployment/SYSTEM_ARCHITECTURE_AND_DEPLOYMENT_WORKFLOW.md`

---

**Generated**: January 1, 2026
**Status**: Phase 3 complete, Phase 4 in progress
**Last Updated**: By automated documentation system

