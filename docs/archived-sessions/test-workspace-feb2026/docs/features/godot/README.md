# Godot Integration Documentation

This directory contains complete documentation for Veritable Games' Godot integration, including the developer console UI, MCP router, and Claude Code integration.

---

## 📚 Documentation Files

### 1. **GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md** (Comprehensive - 1000+ lines)

The **primary technical reference** for the Godot developer console system.

**Covers**:
- Complete system architecture with diagrams
- Frontend React components and Three.js visualization
- Server API routes and SSE real-time communication
- Backend services (parser, graph layout, git operations)
- MCP Router architecture (Phase 3 - Multi-instance with Unix sockets)
- Database schema (projects, versions, scripts, graphs)
- Panel positioning system and collision detection
- Complete data flow for all operations
- Performance characteristics and security
- Troubleshooting guide
- Development workflow

**Read this if**: You need to understand how the system works, debug issues, or modify the Godot integration.

**Key sections**:
- Section 1: Complete system architecture diagram
- Section 2: Data flow for script selection and editing
- Section 4: MCP Router integration with Claude Code
- Section 9: Database schema
- Section 14: Development workflow

---

### 2. **GODOT_MCP_SETUP.md** (Setup Guide - 150 lines)

Quick reference for MCP server configuration and available tools.

**Covers**:
- MCP server configuration in `~/.claude/settings.local.json`
- 15 available tools for script analysis and builds
- 8 available resources for data access
- How to use in Claude Code CLI
- Troubleshooting connection issues
- Database requirements

**Read this if**: You want to use the MCP tools from Claude Code or need to troubleshoot MCP connectivity.

**Key sections**:
- Available Tools (section on tools)
- How to Use (examples)
- Troubleshooting

---

### 3. **DEPENDENCY_GRAPH_ENHANCEMENT.md** (Technical Reference - 700+ lines)

Comprehensive guide to the Godot Dependency Graph Enhancement system (4-phase implementation).

**Covers**:
- **Phase 1: Function Call Graph** - Extracting and using function calls for edges
  - buildFunctionRegistry and resolveFunctionCall methods
  - Resolution strategy for method calls and direct calls
  - Impact: +25-30 edges from function relationships

- **Phase 2: Scene Integration** - Indexing .tscn files and their dependencies
  - parseSceneResources for resource ID mapping
  - Scene nodes and edges in dependency graph
  - New getScenes() service method
  - Impact: +15-20 edges from scene→script relationships

- **Phase 3: Type Hint Extraction** - Parsing type annotations for implicit dependencies
  - extractParameterTypes and extractReturnType methods
  - Type registry mapping class names to scripts
  - Generic type handling (Array[Enemy] → Enemy)
  - Impact: +7-10 edges from type dependencies

- **Phase 4: Visualization Enhancements** - Color-coding and interactive filtering
  - 11 distinct edge types with semantic colors
  - Line styling (solid/dashed/dotted) for dependency strength
  - Interactive legend with 5 expandable categories
  - Real-time edge filtering without performance impact

**Results**:
- 7.5x improvement in graph density (10→75 edges for typical projects)
- All 11 dependency types now visible and filterable
- Semantic color palette aids understanding
- Production-ready with full TypeScript type safety

**Read this if**: You need to understand the dependency extraction system, add new edge types, or modify visualization behavior.

**Key sections**:
- Phase 1-4 implementation details with code examples
- Color palette and line styling specifications
- Legend UI and interaction patterns
- Expected results and graph density metrics
- Database schema updates
- Usage guide for developers

---

### 4. **ADDING_NEW_EDGE_TYPES.md** (Developer Guide - 400+ lines)

Step-by-step guide for adding new dependency relationship types to the graph system.

**Covers**:
- Complete example: Adding "import" edge type
- 7-step implementation process
  1. Define type in type system
  2. Extract relationships in parser
  3. Render with color/styling
  4. Add legend entry
  5. Write tests
  6. Update interfaces
  7. Documentation

- Testing strategies (unit and integration tests)
- Performance considerations
- Common patterns for extraction and resolution
- Suggested future edge types
- Full checklist before committing changes

**Read this if**: You want to add support for new dependency types (e.g., imports, exports, dynamic loads).

**Key sections**:
- Step-by-step example with code
- Testing patterns
- Common regex patterns for extraction
- Performance guidelines
- Suggested future edge types

---

## 🎯 Quick Navigation

### For Different Users

**Frontend Developer** (modifying UI):
1. Read: [GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md](./GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md) - Section 6 (Components) & Section 8 (Hooks)
2. Start point: `/frontend/src/components/godot/GodotDevOverlay.tsx`

**Backend Developer** (modifying API):
1. Read: [GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md](./GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md) - Section 5 (API Routes) & Section 6 (Services)
2. Start point: `/frontend/src/app/api/godot/`

**MCP Router Developer** (modifying Claude integration):
1. Read: [GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md](./GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md) - Section 4 (MCP Router)
2. Start point: `/frontend/mcp-servers/godot-router/src/router-phase3.ts`

**Claude Code User** (using Godot tools):
1. Read: [GODOT_MCP_SETUP.md](./GODOT_MCP_SETUP.md)
2. Just ask Claude about your Godot projects!

**Parser/Graph Developer** (modifying dependency extraction):
1. Read: [DEPENDENCY_GRAPH_ENHANCEMENT.md](./DEPENDENCY_GRAPH_ENHANCEMENT.md) - Phases 1-3
2. Start point: `/frontend/src/lib/godot/parser-service.ts` (functions, scenes, types)
3. Test: `/frontend/src/lib/godot/__tests__/` (when tests are added)

**Visualization Developer** (modifying graph rendering):
1. Read: [DEPENDENCY_GRAPH_ENHANCEMENT.md](./DEPENDENCY_GRAPH_ENHANCEMENT.md) - Phase 4
2. Start point: `/frontend/src/lib/godot/visualization-utils.ts` (colors, line styles)
3. UI Components: `/frontend/src/components/godot/DependencyGraphViewer.tsx` (legend, filtering)

**DevOps / Infrastructure**:
1. Read: [GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md](./GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md) - Section 14 (Troubleshooting)
2. Reference: [SYSTEM_ARCHITECTURE_AND_DEPLOYMENT_WORKFLOW.md](../../deployment/SYSTEM_ARCHITECTURE_AND_DEPLOYMENT_WORKFLOW.md)

---

## 🔗 System Overview

### The Three Layers

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Web Console (React UI)                        │
│  ├─ Home page: Press backtick (`) to toggle console    │
│  ├─ Components: DependencyGraphViewer, ScriptEditorPanel
│  └─ Real-time updates: SSE (Server-Sent Events)        │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Layer 2: API Routes (Next.js)                         │
│  ├─ /api/godot/projects                               │
│  ├─ /api/godot/versions/[id]/scripts                  │
│  ├─ /api/godot/versions/[id]/graph                    │
│  └─ /api/godot/versions/[id]/events (SSE)             │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Layer 3: MCP Router (Standalone Service)              │
│  ├─ Accepts: stdio (JSON-RPC from Claude Code)        │
│  ├─ Auto-detects: Godot version from working dir      │
│  ├─ Manages: Multi-instance lifecycle                  │
│  └─ Communicates: Unix socket IPC to instances        │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Database: PostgreSQL (8 tables)                        │
│  ├─ godot_projects                                      │
│  ├─ godot_versions                                      │
│  ├─ godot_scripts                                       │
│  └─ godot_dependency_graph                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Access Methods

| Method | Entry Point | For | Status |
|--------|-------------|-----|--------|
| **Web Console** | Home page (`/`) + backtick | Developers | ✅ Production |
| **MCP CLI** | `claude code` + ask | Claude Code users | ✅ Configured |
| **API Directly** | `/api/godot/**` | Scripts/automation | ✅ Available |
| **Database** | PostgreSQL | Direct queries | ✅ Available |

---

## 🚀 Quick Start

### For Console Users (Web)

```bash
# 1. Visit home page
https://localhost:3000/ (dev) or https://www.veritablegames.com (prod)

# 2. Press backtick (`)
# 3. Select project from dropdown
# 4. Select version (auto-loads dependency graph)
# 5. Click nodes in graph to view scripts
# 6. Edit scripts (Ctrl+S to save)
```

### For MCP Users (Claude Code)

```bash
# MCP is already configured!
# Just ask Claude about your Godot projects:

claude code
# Then ask:
# - "Show me the dependency graph for Player.gd"
# - "List all scripts in the physics system"
# - "What's the build status?"
# - "Analyze dependencies for [script name]"
```

### For Developers (Local Development)

```bash
# Terminal 1: Start Next.js dev server
cd frontend/
npm run dev

# Terminal 2 (optional): Start MCP router locally
cd frontend/mcp-servers/godot-router/
npm run build
node dist/router-phase3.js

# Browser: Open console
# Press backtick (`) on home page
```

---

## 📊 Key Features

### Web Console Features
- ✅ **3D Visualization**: Interactive dependency graph with Three.js
- ✅ **Script Editing**: Edit GDScript files with syntax highlighting
- ✅ **Real-time Updates**: SSE for live graph updates
- ✅ **Panel Layout**: Draggable panels with collision detection
- ✅ **Search**: Find scripts by name or path
- ✅ **Multi-version**: Support for multiple Godot versions per project
- ✅ **Admin Only**: Requires admin/developer role

### MCP Router Features
- ✅ **Auto-detection**: Automatically finds Godot version from CWD
- ✅ **Multi-instance**: Separate process per version, isolated state
- ✅ **Idle Cleanup**: 30-minute timeout with automatic shutdown
- ✅ **Health Monitoring**: Tracks instance status via database
- ✅ **Zero Config**: No configuration needed, works out of the box
- ✅ **Claude Integration**: 15 specialized tools for script analysis

### Backend Services
- ✅ **GDScript Parser**: Extracts functions, signals, exports, dependencies
- ✅ **Dependency Analysis**: Builds complete graph of script relationships
- ✅ **Graph Layout**: Force-directed 3D layout algorithm
- ✅ **Git Integration**: Commits script changes with metadata
- ✅ **Build System**: Triggers Godot HTML5 exports

---

## 🔧 Configuration

### Web Console (Automatic)
No configuration needed! Console is built into the home page.

### MCP Server (Already Configured)
Located at: `~/.claude/settings.local.json`

```json
{
  "mcpServers": {
    "godot": {
      "command": "bash",
      "args": ["/home/user/Projects/veritable-games-main/frontend/mcp-servers/godot/start.sh"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/veritable_games",
        "API_BASE_URL": "http://localhost:3002"
      }
    }
  }
}
```

### MCP Router (Development)
For local development or custom setup:

```bash
# Build
cd frontend/mcp-servers/godot-router
npm run build

# Run
node dist/router-phase3.js

# Or with custom database
DATABASE_URL="postgresql://..." node dist/router-phase3.js
```

---

## 🐛 Troubleshooting

### "Console won't open (backtick does nothing)"

1. Check you're logged in as admin/developer:
   ```bash
   curl http://localhost:3000/api/auth/me | jq .role
   ```

2. Check projects exist in database:
   ```bash
   psql postgresql://... -c "SELECT * FROM godot_projects;"
   ```

3. Check browser console for errors (F12 → Console tab)

**Solution**: See [GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md](./GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md) Section 15 (Troubleshooting)

### "Dependency graph doesn't load"

1. Check project has versions:
   ```bash
   psql postgresql://... -c "SELECT * FROM godot_versions WHERE project_slug = 'noxii';"
   ```

2. Check version has scripts:
   ```bash
   psql postgresql://... -c "SELECT COUNT(*) FROM godot_scripts WHERE version_id = '[uuid]';"
   ```

3. Rebuild graph:
   ```
   From console: Click "Rebuild" button
   Or via curl:
   curl -X POST http://localhost:3000/api/godot/versions/[uuid]/reindex
   ```

### "MCP can't find my Godot version"

1. Check working directory includes Godot path:
   ```bash
   pwd  # Should contain "godot-projects/[slug]/[tag]/..."
   ```

2. Check version exists in database:
   ```bash
   psql postgresql://... -c "SELECT * FROM godot_versions WHERE project_slug = 'noxii';"
   ```

3. Check detector is working:
   ```bash
   # From godot-router directory
   npm run test:detector
   ```

**Full troubleshooting**: See [GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md](./GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md) Section 15

---

## 📁 File Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx                          ← Home page (toggle with backtick)
│   │   └── api/godot/                        ← API routes
│   │       ├── projects/route.ts
│   │       ├── projects/[slug]/versions/route.ts
│   │       └── versions/[id]/
│   │           ├── scripts/route.ts
│   │           ├── graph/route.ts
│   │           └── events/route.ts            ← SSE endpoint
│   │
│   ├── components/godot/                      ← React components
│   │   ├── GodotDevOverlay.tsx                ← Main console
│   │   ├── DependencyGraphViewer.tsx          ← 3D graph
│   │   ├── ScriptEditorPanel.tsx              ← Editor
│   │   └── TerminalPanel.tsx
│   │
│   ├── contexts/
│   │   └── PanelLayoutContext.tsx             ← Grid layout system
│   │
│   ├── hooks/
│   │   └── useGodotRuntimeEvents.ts           ← SSE hook
│   │
│   └── lib/godot/                             ← Services
│       ├── service.ts                         ← Main service
│       ├── parser-service.ts                  ← GDScript parser
│       ├── git-service.ts                     ← Git operations
│       └── ...
│
└── mcp-servers/
    └── godot-router/                          ← MCP Router (separate service)
        ├── src/
        │   ├── router-phase3.ts               ← Main router
        │   ├── detector.ts                    ← Version detection
        │   ├── spawner.ts                     ← Instance management
        │   └── ...
        ├── start-router.sh                    ← Startup script
        └── README.md                          ← MCP Router docs
```

---

## 🔄 Architecture Phases

| Phase | Status | Features | Notes |
|-------|--------|----------|-------|
| **1** | ✅ Complete | UI Foundation: Projects, versions, scripts, basic graph | Core console functionality |
| **2** | ✅ Complete | Real-time: SSE, live updates, script editing, draggable panels | Two-phase save operation |
| **3** | ✅ Complete | MCP Router: Auto-detection, multi-instance, Unix socket IPC | Claude Code integration |
| **4** | ⏳ In Progress | Instance Sockets: Direct socket communication | Godot instance MCP interface |
| **5** | 📋 Planned | Monitoring: Dashboard, advanced features, WebSocket | Phase 4 completion required |

---

## 🎓 Learning Path

### Beginner: Just Use It
1. Press backtick (`) on home page
2. Explore the dependency graph
3. Edit scripts

### Intermediate: Understand the Flow
1. Read: [GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md](./GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md) Section 2 (Data Flow)
2. Try: Edit a script and watch Phase 1 & 2

### Advanced: Modify the System
1. Read: [GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md](./GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md) Sections 5-7 (API Routes & Components)
2. Modify: A component or API route
3. Deploy: Push to main, auto-deploys in 2-5 min

### Expert: MCP Router Development
1. Read: [GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md](./GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md) Section 4 (MCP Router)
2. Modify: Router logic in `/godot-router/src/`
3. Test: Local development with `npm run build && node dist/router-phase3.js`

---

## 🚢 Deployment

### Web Console
- **Location**: Production container at 192.168.1.15:3000
- **Auto-deployment**: Every commit to main (via Coolify)
- **Timeline**: 2-5 minutes from commit to live

### MCP Router
- **Location**: Can run on same server or locally
- **Configuration**: Already in `~/.claude/settings.local.json`
- **Timeline**: Auto-starts with Claude Code session

---

## 📞 Support

**For issues with**:
- **Console UI**: See Section 15 in [GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md](./GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md)
- **MCP Connection**: See [GODOT_MCP_SETUP.md](./GODOT_MCP_SETUP.md) Troubleshooting
- **Deployment**: See [SYSTEM_ARCHITECTURE_AND_DEPLOYMENT_WORKFLOW.md](../../deployment/SYSTEM_ARCHITECTURE_AND_DEPLOYMENT_WORKFLOW.md)
- **Database**: Check PostgreSQL is running and reachable

---

## 📚 Related Documentation

- **System Infrastructure**: [SYSTEM_ARCHITECTURE_AND_DEPLOYMENT_WORKFLOW.md](../../deployment/SYSTEM_ARCHITECTURE_AND_DEPLOYMENT_WORKFLOW.md)
- **Database Schema**: [docs/database/README.md](../../database/README.md) (godot_* tables)
- **API Reference**: [CRITICAL_PATTERNS.md](../../architecture/CRITICAL_PATTERNS.md) (API security patterns)
- **CLAUDE.md**: [Root CLAUDE.md](../../../CLAUDE.md) (Project overview)

---

**Last Updated**: January 1, 2026
**Status**: Phase 3 Complete, Phase 4 In Progress
**Maintained By**: Automated documentation system

