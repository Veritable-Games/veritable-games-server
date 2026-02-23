# Godot Visualization System - Quick Start Guide

**For:** Developers continuing work on this system
**Read First:** [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)

---

## What Is This?

Interactive 3D visualization of Godot script dependencies. Press backtick (`) on home page to see it.

**Status:** Phase 1 Complete ✅
**Next:** Phase 2 (visualization modes)

---

## Project Files Location

All files stored on **server filesystem**:
- Projects: `/frontend/godot-projects/[slug]/[version]/`
- HTML5 builds: `/public/godot-builds/[slug]/[version]/`
- Metadata: PostgreSQL `content` schema

---

## Key Files to Know

| What | Where |
|------|-------|
| Main overlay | `src/components/godot/GodotDevOverlay.tsx` |
| 3D graph viewer | `src/components/godot/DependencyGraphViewer.tsx` |
| Script parser | `src/lib/godot/parser-service.ts` |
| Service layer | `src/lib/godot/service.ts` |
| Database schema | `scripts/migrations/010-godot-schema.sql` |
| API endpoints | `src/app/api/godot/` |
| Keyboard shortcut | `src/app/page.tsx` |

---

## How to Add a Feature

### Add Visualization Mode
1. Edit `DependencyGraphViewer.tsx` - add `mode` prop value
2. Create new component in `src/components/godot/`
3. Update API endpoint to support mode
4. Update dropdown UI in `GodotDevOverlay.tsx`

### Extend Script Parser
1. Add regex pattern to `GodotParserService`
2. Add field to `ScriptAnalysis` interface
3. Add database column to schema
4. Add unit tests

### Create New API Endpoint
```typescript
// src/app/api/godot/[route]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';

async function myHandler(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    throw new AuthenticationError('Admin required');
  }
  // Your code here
  return NextResponse.json({ success: true });
}

export const GET = withSecurity(myHandler);
```

---

## Database Queries

All use the established pattern:

```typescript
import { dbAdapter } from '@/lib/database/adapter';

// SELECT
const result = await dbAdapter.query<MyType>(
  `SELECT * FROM table WHERE id = $1`,
  [id],
  { schema: 'content' }
);

// INSERT
const result = await dbAdapter.query<MyType>(
  `INSERT INTO table (col1, col2) VALUES ($1, $2) RETURNING *`,
  [val1, val2],
  { schema: 'content' }
);

// UPDATE
const result = await dbAdapter.query<MyType>(
  `UPDATE table SET col1 = $1 WHERE id = $2 RETURNING *`,
  [newVal, id],
  { schema: 'content' }
);
```

**Always:** Include `{ schema: 'content' }` option!

---

## Testing Locally

### Setup
```bash
cd frontend

# Ensure PostgreSQL is running
psql -U postgres -h localhost

# Set database URL
export DATABASE_URL="postgresql://user:pass@localhost:5432/veritable_games"

# Run migration
npm run db:migrate
```

### Run App
```bash
npm run dev

# Open http://localhost:3000
# Press backtick (`) key
# Should see GodotDevOverlay
```

### Type Checking
```bash
npm run type-check  # Before committing!
```

---

## Common Issues

| Problem | Fix |
|---------|-----|
| "Cannot find module 'three'" | `npm install three` |
| "Admin access required" | User role must be 'admin' or 'developer' |
| "No graph data found" | Need to upload project first |
| "Database connection failed" | Set `DATABASE_URL` environment variable |
| "TypeError: Cannot read property 'rows'" | Add null check on query results |

---

## Godot Version Note ⚠️

**All projects should be upgraded to Godot 4.4+**

Why: Godot 4.3 HTML5 CLI export is broken.
How: Export manually from Godot Editor GUI, not CLI.
See: [GODOT_VERSION_STRATEGY.md](./GODOT_VERSION_STRATEGY.md)

---

## Key Concepts

### GodotParserService
Parses `.gd` and `.tscn` files and extracts:
- Class name
- Dependencies (extends, preload, load)
- Functions and their calls
- Signals
- Exports

Returns `ScriptAnalysis` object that gets stored in database.

### GodotService
CRUD layer for:
- Projects
- Versions
- Scripts
- Dependency graphs

All queries go through here → Database adapter.

### DependencyGraphViewer
Three.js component showing:
- Nodes (one per script)
- Edges (one per dependency)
- Interactive selection
- Zoom/pan controls

---

## Architecture at a Glance

```
User presses ` key
  ↓
GodotDevOverlay renders (secure: admin/dev only)
  ├─ Project dropdown → GET /api/godot/projects
  ├─ Version dropdown → GET /api/godot/projects/[slug]/versions
  └─ DependencyGraphViewer
       ├─ GET /api/godot/versions/[id]/graph
       ├─ Three.js renders graph
       └─ Click node → select script

Right panel (future):
  ├─ Script editor (Monaco)
  ├─ Save button → PUT /api/godot/versions/[id]/scripts
  └─ Build button → POST /api/godot/versions/[id]/build
```

---

## What's Implemented ✅

- Database schema
- Parser service with tests
- Service layer
- API endpoints (read/write)
- Overlay UI
- Keyboard shortcut
- Three.js visualization
- Security middleware

## What's Not Yet ⏳

- Script editor (Monaco integration)
- Build system (Godot CLI)
- GitHub integration
- Scene/class/file visualization modes
- Real-time runtime highlighting

---

## Typical Development Workflow

1. **Make changes**
   ```bash
   # Edit src/components/godot/GodotDevOverlay.tsx or other files
   ```

2. **Test locally**
   ```bash
   npm run dev
   # Press backtick, test feature
   ```

3. **Check types**
   ```bash
   npm run type-check
   # Fix any errors
   ```

4. **Format code**
   ```bash
   npm run format
   ```

5. **Commit**
   ```bash
   git add .
   git commit -m "feat: add [feature name]"
   git push
   ```

---

## Next Phase Checklist

### Phase 2: Visualization Enhancements
- [ ] Add scene tree mode
- [ ] Add class relationship mode
- [ ] Add file organization mode
- [ ] Mode switcher in header
- [ ] Details panel for selected node

### Phase 3: Script Editing
- [ ] Integrate Monaco editor
- [ ] Add save functionality
- [ ] Add syntax validation
- [ ] Show modified indicator

### Phase 4: Runtime
- [ ] Build status UI
- [ ] Embed Godot runtime
- [ ] Test changes in-browser

---

## Useful Commands

```bash
# Development
npm run dev                    # Start dev server
npm run type-check            # Check TypeScript
npm run format                # Format code
npm test                      # Run tests

# Database
npm run db:migrate            # Run migrations
npm run db:health             # Check connection

# Building
npm run build                 # Build for production
npm run start                 # Run production build

# Helpful utilities
npm run tsx -- script.ts      # Run TypeScript directly
npx playwright test           # Run e2e tests
```

---

## Files to Review First

1. **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - Full documentation
2. **[GODOT_VERSION_STRATEGY.md](./GODOT_VERSION_STRATEGY.md)** - Version management
3. **src/lib/godot/parser-service.ts** - How parsing works
4. **src/components/godot/GodotDevOverlay.tsx** - Main UI
5. **src/app/api/godot/projects/route.ts** - Example API pattern

---

## Questions?

- Check IMPLEMENTATION_GUIDE.md for detailed info
- See code comments for specific implementations
- Look at unit tests for usage examples
- Check git history: `git log --oneline src/lib/godot/`

---

**Last Updated:** December 26, 2025
**For Continuation:** Read IMPLEMENTATION_GUIDE.md first
