# Godot Script Visualization & Management System
## Implementation Guide & Project Status

**Last Updated:** December 2025
**Status:** Phase 1 Complete - Ready for Phase 2

---

## Executive Summary

A comprehensive system for visualizing, editing, and managing multiple versions of Godot projects through an interactive Three.js overlay accessible via backtick (`) keyboard shortcut. Designed for non-programmers to understand script dependencies and game architecture through real-time visual feedback.

**Key Features:**
- Secret admin/developer keyboard shortcut (backtick) for console access
- Multi-version project management (stored on server)
- Interactive 3D dependency graph visualization
- Script editing with save functionality
- Godot HTML5 export runtime embedding
- GitHub integration for version control

---

## Project Storage Architecture

### Filesystem Organization

**All Godot projects are stored on the server** in the following structure:

```
/home/user/Projects/veritable-games-main/frontend/godot-projects/
├── noxii/
│   ├── v1.0.0/
│   │   ├── project.godot
│   │   ├── scripts/
│   │   ├── scenes/
│   │   └── [all project files]
│   ├── v1.1.0/
│   └── v2.0.0/
├── enact/
│   ├── alpha-1/
│   └── beta-1/
└── [other-projects]/

/home/user/Projects/veritable-games-main/frontend/public/godot-builds/
├── noxii/
│   ├── v1.0.0/
│   │   ├── index.html     # HTML5 export
│   │   ├── index.wasm
│   │   └── index.pck
│   └── v1.1.0/
└── [other-projects]/
```

**Database Metadata:** PostgreSQL `content` schema stores project/version info, while actual project files and builds remain on filesystem.

---

## Current Implementation Status

### ✅ Phase 1: Foundation (COMPLETE)

#### 1. Database Schema
- **File:** `frontend/scripts/migrations/010-godot-schema.sql`
- **Tables Created:**
  - `godot_projects` - Project registry
  - `godot_versions` - Version tracking
  - `godot_scripts` - Script content and metadata
  - `godot_dependency_graph` - Cached dependency graphs
  - `godot_runtime_events` - Live runtime trace events
  - `godot_github_sync` - GitHub sync state
  - `godot_scenes` - Scene hierarchy cache

#### 2. Core Services
- **GodotParserService** (`frontend/src/lib/godot/parser-service.ts`)
  - Parses .gd files for structure, dependencies, signals, functions, exports
  - Parses .tscn files for scene hierarchies
  - Builds dependency graphs for visualization
  - Fully unit tested

- **GodotService** (`frontend/src/lib/godot/service.ts`)
  - CRUD operations for projects, versions, scripts
  - Script indexing and scanning
  - Dependency graph caching
  - Database integration via `dbAdapter`

#### 3. Frontend Components
- **GodotDevOverlay** (`frontend/src/components/godot/GodotDevOverlay.tsx`)
  - Main overlay UI
  - Project/version selectors
  - Resizable panels
  - Status indicators

- **DependencyGraphViewer** (`frontend/src/components/godot/DependencyGraphViewer.tsx`)
  - Three.js visualization
  - Interactive 3D node graph
  - OrbitControls for navigation
  - Node selection and highlighting

- **Home Page Integration** (`frontend/src/app/page.tsx`)
  - Backtick (`) keyboard shortcut to toggle overlay
  - Escape to close overlay
  - Admin/developer role checking

#### 4. API Endpoints
```
GET    /api/godot/projects                          - List all projects
POST   /api/godot/projects                          - Create project
GET    /api/godot/projects/[slug]/versions          - List versions
POST   /api/godot/projects/[slug]/upload            - Upload & extract ZIP
GET    /api/godot/versions/[id]/scripts             - List scripts
PUT    /api/godot/versions/[id]/scripts             - Update script
GET    /api/godot/versions/[id]/graph               - Get dependency graph
```

All endpoints secured with `withSecurity()` middleware and role-based access control.

---

## Important Note: Godot Version Updates

### Current Issue: Godot 4.3 HTML5 Export
**Problem:** Godot 4.3+ has known bugs with headless HTML5 export (GitHub Issue #95287)

### Recommendation: Upgrade to Latest Godot LTS
**Action:** Update all project versions to **Godot 4.4+** or **Godot 5.0+** to:
- Fix HTML5 export CLI issues
- Avoid sandbox limitations
- Get latest GDScript syntax improvements
- Ensure long-term support

**Implementation Steps:**
1. Export each project version from Godot Editor (not CLI, to avoid 4.3 bugs)
2. Place HTML5 builds in `/godot-builds/[project]/[version]/`
3. Update `godot_versions.build_status` to 'success' in database
4. Re-index all scripts for updated Godot syntax

### Build Storage Location
```
POST /api/godot/projects/[slug]/upload
→ Extracts to: /godot-projects/[slug]/[version]/
→ Sets build path: /public/godot-builds/[slug]/[version]/

GodotRuntime component loads from:
/godot-builds/[slug]/[version]/index.html
```

---

## How It Works: User Journey

### 1. Developer Opens Console
```
User presses backtick (`) key
→ Page checks if user.role === 'admin' || 'developer'
→ GodotDevOverlay component renders (z-index: 50)
→ Stellar viewer remains visible underneath
```

### 2. Select Project & Version
```
Project Dropdown → Fetches from GET /api/godot/projects
Version Dropdown → Fetches from GET /api/godot/projects/[slug]/versions
→ DependencyGraphViewer loads graph data
→ Three.js canvas initializes with script nodes
```

### 3. Explore Dependency Graph
```
Mouse drag → Rotate view (OrbitControls)
Mouse scroll → Zoom in/out
Click node → Highlights script, shows details
→ Node color changes (blue=inactive, yellow=active)
```

### 4. Edit Script (Future)
```
Click script in graph
→ Right panel shows script editor (Monaco)
→ Edit content
→ Click Save → PUT /api/godot/versions/[id]/scripts
→ Script marked as modified in database
```

### 5. Test in Godot
```
Click "Build" button
→ POST /api/godot/versions/[id]/build
→ Godot CLI exports to HTML5
→ Build status tracked in database
→ Embedded iframe loads runtime
→ Developer can test changes
```

---

## Key Technologies

### Frontend
- **React 19** - UI framework (client components)
- **Three.js r180** - 3D visualization
- **Tailwind CSS** - Styling
- **Zustand** (existing) - State management pattern
- **Monaco Editor** (existing, not yet integrated) - Code editing

### Backend
- **Next.js 15** - API routes
- **PostgreSQL** - Metadata storage
- **Node.js fs/path** - Filesystem operations
- **adm-zip** - ZIP extraction
- **Godot CLI** - Project building (future)

### Database
- Schema: `content` in PostgreSQL
- Pattern: `dbAdapter.query(sql, params, { schema: 'content' })`
- Example: `godot_projects`, `godot_scripts`, `godot_dependency_graph`

---

## Security Implementation

### Role-Based Access Control
```typescript
GET /api/godot/projects
→ Requires: admin OR developer role
→ Implemented via getCurrentUser() check in each endpoint

POST /api/godot/projects
→ Requires: admin role only

PUT /api/godot/versions/[id]/scripts
→ Requires: admin OR developer role
```

### API Security Pattern
All endpoints wrapped with `withSecurity()` middleware:
- CSRF token validation
- Rate limiting (configurable)
- Security headers

### File Upload Security
```typescript
// POST /api/godot/projects/[slug]/upload
1. Validate file is ZIP
2. Check max size (500MB default)
3. Extract with path traversal prevention
4. Scan for .gd and .tscn files only
5. Store in /godot-projects filesystem
```

---

## Database Integration Pattern

All database operations use the established adapter pattern:

```typescript
import { dbAdapter } from '@/lib/database/adapter';

// Query pattern
const result = await dbAdapter.query<T>(
  `SELECT * FROM table WHERE id = $1`,
  [paramValue],
  { schema: 'content' }  // Important: always specify schema
);

// Transaction pattern (future)
// Currently not implemented, but available via dbAdapter
```

---

## Next Steps: Phase 2 & Beyond

### Phase 2: Parser & Visualization (Weeks 3-4)
- ✅ GDScript parser → Already implemented
- ✅ Dependency graph builder → Already implemented
- ✅ Three.js visualization (dependencies mode) → Already implemented
- API endpoints for graph data → Done
- Node selection and details panel → In progress

### Phase 3: Script Editing (Weeks 4-5)
- Monaco editor integration in right panel
- Save/restore functionality
- Syntax validation
- Modified script tracking (database column ready)

### Phase 4: Godot Runtime (Weeks 5-6)
- HTML5 export build system
- Build status monitoring
- Runtime embed component (GodotRuntime.tsx - stubbed)
- Basic postMessage communication

### Phase 5: Advanced Visualization (Weeks 6-7)
- Scene tree mode visualization
- Class relationship mode
- File organization mode (3D folder structure)
- Mode switcher UI in overlay header

### Phase 6: Real-time Features (Weeks 7-8)
- WebSocket server extension for godot-trace
- Godot Tracer plugin (res://addons/veritable_tracer/)
- Live event streaming
- Runtime node highlighting during playtest

### Phase 7: GitHub Integration (Weeks 8-9)
- Git repository initialization
- Commit workflow UI (dialog for message/branch)
- Push to remote
- Conflict detection
- Sync status tracking

### Phase 8: Polish & Optimization (Weeks 9-10)
- Performance optimization (caching, incremental parsing)
- Error handling and recovery
- User documentation
- Testing with real projects
- Deployment preparation

---

## Critical Files Reference

### Database & Migrations
- `frontend/scripts/migrations/010-godot-schema.sql` - Schema definition

### Services & Libraries
- `frontend/src/lib/godot/parser-service.ts` - GDScript parser
- `frontend/src/lib/godot/service.ts` - Main service layer
- `frontend/src/lib/database/adapter.ts` - Database integration (existing)
- `frontend/src/lib/security/middleware.ts` - Security (existing)

### Components
- `frontend/src/components/godot/GodotDevOverlay.tsx` - Main overlay
- `frontend/src/components/godot/DependencyGraphViewer.tsx` - Visualization
- `frontend/src/app/page.tsx` - Keyboard shortcut integration

### API Routes
- `frontend/src/app/api/godot/projects/route.ts`
- `frontend/src/app/api/godot/projects/[slug]/versions/route.ts`
- `frontend/src/app/api/godot/projects/[slug]/upload/route.ts`
- `frontend/src/app/api/godot/versions/[id]/scripts/route.ts`
- `frontend/src/app/api/godot/versions/[id]/graph/route.ts`

### Tests
- `frontend/src/lib/godot/__tests__/parser-service.test.ts` - Unit tests

---

## Running the System

### First Time Setup

1. **Create database schema:**
   ```bash
   cd frontend
   npm run db:migrate  # Runs migration 010-godot-schema.sql
   ```

2. **Create test project (manual via UI):**
   - Press backtick (`) on home page
   - Create project via admin panel (future UI)
   - Or POST to `/api/godot/projects`

3. **Upload a Godot project:**
   - Export project to ZIP from Godot Editor
   - POST to `/api/godot/projects/[slug]/upload?versionTag=v1.0.0`
   - System auto-indexes all scripts

4. **View visualization:**
   - Select project and version in overlay
   - Three.js graph loads automatically
   - Click nodes to explore dependencies

### Development

```bash
# Run dev server
npm run dev

# Type checking
npm run type-check

# Tests
npm test

# Format code
npm run format
```

### Important: Localhost Testing
SQLite fallback is disabled - requires PostgreSQL connection:
```bash
# Ensure DATABASE_URL or POSTGRES_URL is set
export DATABASE_URL="postgresql://user:pass@localhost:5432/veritable_games"
npm run dev
```

---

## Known Limitations & Solutions

### Limitation 1: Godot 4.3 HTML5 Export CLI
**Status:** Waiting for user action
**Solution:** Upgrade projects to Godot 4.4+ and export manually from Editor

### Limitation 2: GDScript Syntax Highlighting
**Issue:** Monaco doesn't have built-in GDScript support
**Current:** Using Python syntax as closest match
**Future:** Create custom TextMate grammar or integrate gdscript-language-server

### Limitation 3: Real-time Event Capture
**Issue:** HTML5 export is sandboxed
**Solution 1:** Manual instrumentation via Tracer.gd autoload (MVP)
**Solution 2:** Pre-process scripts to inject trace calls
**Solution 3:** Use server-side streaming with full control (future)

### Limitation 4: Managing Dozens of Versions
**Issue:** Parsing efficiency
**Solution:**
- Lazy load (only parse active version)
- Cache parsed data in database
- Incremental parsing on file changes
- Archive old versions to cold storage

---

## Architecture Diagrams

### System Overview
```
┌─────────────────────────────────────────────────┐
│         Home Page (Stellar Viewer)              │
│   Press ` → GodotDevOverlay (z-index: 50)      │
├─────────────────────────────────────────────────┤
│  [Project: NOXII ▼] [Version: v1.0.0 ▼]  [×]   │
├──────────────┬──────────────────────────────────┤
│              │                                  │
│  Three.js    │  Script Editor / Info Panel     │
│  Graph       │  (right panel)                  │
│  (60% width) │  (40% width)                    │
│              │                                  │
├──────────────┴──────────────────────────────────┤
│  Godot HTML5 Runtime (iframe) - Optional       │
└─────────────────────────────────────────────────┘
```

### Data Flow
```
Upload ZIP
  ↓
POST /api/godot/projects/[slug]/upload
  ↓
Extract to /godot-projects/[slug]/[version]/
  ↓
GodotService.indexScripts()
  ↓
Scan for .gd files → Parse each → Store in DB
  ↓
Build dependency graph → Cache in DB
  ↓
GET /api/godot/versions/[id]/graph
  ↓
Three.js renders graph in browser
```

### Script Parsing Pipeline
```
.gd file content
  ↓
GodotParserService.parseScript()
  ├─ Extract: class_name, extends, preload/load
  ├─ Extract: signal declarations
  ├─ Extract: function definitions & calls
  ├─ Extract: @export annotations
  └─ Return: ScriptAnalysis object
  ↓
Store in godot_scripts table
  ├─ file_path
  ├─ script_name
  ├─ dependencies (JSONB)
  ├─ functions (JSONB)
  ├─ signals (JSONB)
  └─ exports (JSONB)
  ↓
Build dependency graph
  ├─ Nodes: one per script
  ├─ Edges: one per dependency
  └─ Store in godot_dependency_graph table
```

---

## Troubleshooting Guide

### Issue: "Admin or developer access required"
**Cause:** User role is not 'admin' or 'developer'
**Solution:** Check user role in database, assign via admin panel, or use test account

### Issue: "No graph data found for this version"
**Cause:** Version exists but scripts weren't indexed
**Solution:**
1. Re-upload the project
2. Check that .gd files were extracted
3. Verify scripts are in `/godot-projects/[slug]/[version]/scripts/`

### Issue: "Failed to find THREE" in DependencyGraphViewer
**Cause:** Three.js not installed or import path wrong
**Solution:**
```bash
npm install three
# Verify package.json has: "three": "^0.180.0"
```

### Issue: TypeScript errors with adm-zip
**Cause:** Missing type declarations
**Solution:** Add `// @ts-ignore` above import or install @types/adm-zip

### Issue: Database connection fails
**Cause:** PostgreSQL not running or DATABASE_URL not set
**Solution:**
```bash
# Check PostgreSQL is running
psql -U postgres -h localhost

# Set DATABASE_URL
export DATABASE_URL="postgresql://user:pass@localhost:5432/veritable_games"

# Or add to .env.local
echo 'DATABASE_URL=postgresql://user:pass@localhost:5432/veritable_games' > .env.local
```

---

## Future Enhancements

### Short Term (Phase 2-3)
- Script editor integration (Monaco)
- Save/restore workflow
- Build status tracking
- Runtime embedding

### Medium Term (Phase 4-5)
- Scene tree visualization
- Class relationship graphs
- File organization mode
- Performance profiling

### Long Term (Phase 6+)
- Real-time runtime highlighting
- GitHub integration
- Collaborative editing
- Automated testing framework

---

## Contributing & Maintenance

### Adding New Visualization Modes
1. Update `DependencyGraphViewer.tsx` interface to accept new `mode` prop
2. Add case in visualization switch
3. Create new visualization component in `frontend/src/components/godot/`
4. Update API endpoint to support new mode

### Extending Parser
1. Add new regex pattern to `GodotParserService`
2. Add new field to `ScriptAnalysis` interface
3. Update database schema column
4. Add unit tests
5. Update parser tests

### Database Schema Changes
1. Create new migration file: `011-godot-[feature].sql`
2. Run migration: `npm run db:migrate`
3. Update TypeScript interfaces in services
4. Update API endpoints as needed

---

## Contact & Support

For questions about this system:
1. Check this document first
2. Review Phase 1 implementation in code
3. Consult plan file: `/home/user/.claude/plans/agile-wibbling-meteor.md`
4. Check git history for recent changes

---

**Document Version:** 1.0
**Last Updated:** December 26, 2025
**Next Review:** After Phase 2 completion
