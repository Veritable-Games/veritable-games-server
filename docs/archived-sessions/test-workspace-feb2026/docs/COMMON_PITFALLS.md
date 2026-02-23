📍 **Navigation**: [CLAUDE.md](../CLAUDE.md) > [docs/](./README.md) > Common Pitfalls

---

# Common Pitfalls to Avoid

**⚠️ Learn from past mistakes** - This guide lists the most common errors developers make in this codebase and how to avoid them.

## Table of Contents

- [Database Issues](#database-issues)
- [Architecture Violations](#architecture-violations)
- [Working Directory Confusion](#working-directory-confusion)
- [Next.js 15 Specific Issues](#nextjs-15-specific-issues)
- [Security Issues](#security-issues)
- [State Management Issues](#state-management-issues)
- [Workspace/Canvas Issues](#workspacecanvas-issues)
- [Testing Issues](#testing-issues)
- [Deployment Issues](#deployment-issues)

---

## Database Issues

### ❌ #1: Creating Database Instances Directly

**Problem**: Connection leaks, performance degradation

```typescript
// ❌ WRONG
import Database from 'better-sqlite3';
const db = new Database('./data/users.db');
```

**Solution**: Always use dbAdapter

```typescript
// ✅ CORRECT
import { dbAdapter } from '@/lib/database/adapter';
const result = await dbAdapter.query(
  'SELECT * FROM users WHERE id = ?',
  [userId],
  { schema: 'users' }
);
```

📝 **See**: [docs/architecture/CRITICAL_PATTERNS.md](./architecture/CRITICAL_PATTERNS.md#1-database-access-pattern-must-follow)

---

### ❌ #2: Cross-Database JOINs

**Problem**: SQLite cannot JOIN across separate database files

```typescript
// ❌ WRONG
const query = `
  SELECT u.*, p.bio
  FROM users.users u
  JOIN wiki.wiki_pages p ON u.id = p.author_id
`;
```

**Solution**: Use ProfileAggregatorService for cross-domain data

```typescript
// ✅ CORRECT
import { profileAggregatorService } from '@/lib/profiles/aggregator';
const profile = await profileAggregatorService.getFullProfile(userId);
```

📝 **See**: [docs/DATABASE.md](./DATABASE.md)

---

### ❌ #3: String Concatenation in SQL

**Problem**: SQL injection vulnerability

```typescript
// ❌ WRONG - SQL injection risk
const query = `SELECT * FROM users WHERE id = ${userId}`;
db.prepare(query).get();
```

**Solution**: Always use prepared statements with parameters

```typescript
// ✅ CORRECT
const query = 'SELECT * FROM users WHERE id = ?';
const user = db.prepare(query).get(userId);
```

📝 **See**: [docs/architecture/SECURITY_ARCHITECTURE.md](./architecture/SECURITY_ARCHITECTURE.md)

---

### ❌ #4: Deploying Code Before Running Migrations

**Problem**: Code references database columns that don't exist in production, causing silent query failures

**Critical Incident**: 2026-02-12 - All journals and categories disappeared after deployment

```typescript
// ❌ Code deployed WITHOUT migration
const result = await dbAdapter.query(
  `SELECT id, title, is_deleted FROM wiki_pages WHERE namespace = 'journals'`,
  [],
  { schema: 'wiki' }
);
// Error: column "is_deleted" does not exist
// Result: Returns 0 rows instead of 322 journals
```

**Solution**: ALWAYS apply migrations to production BEFORE deploying code

```bash
# Step 1: Create migration file
# frontend/scripts/migrations/016-journal-deletion-tracking.sql

# Step 2: Apply to production FIRST
npm run db:migrate:production
# OR manual:
ssh user@192.168.1.15 "docker exec veritable-games-postgres psql -U postgres -d veritable_games -f /path/to/migration.sql"

# Step 3: Verify migration succeeded
ssh user@192.168.1.15 "docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \"SELECT column_name FROM information_schema.columns WHERE table_name='wiki_pages';\""

# Step 4: THEN deploy code
git push origin main
```

**Prevention**:
- ✅ Use [Pre-Deployment Checklist](./deployment/PRE_DEPLOYMENT_CHECKLIST.md)
- ✅ Track migrations in [Migration Tracking](./database/MIGRATION_TRACKING.md)
- ✅ Add schema validation to CI/CD pipeline
- ✅ Test against production-like schema before deploy

📝 **See**:
- [Incident Report](./incidents/2026-02-12-journals-missing-columns.md)
- [Migration Tracking](./database/MIGRATION_TRACKING.md)
- [Pre-Deployment Checklist](./deployment/PRE_DEPLOYMENT_CHECKLIST.md)

---

### ❌ #11: Missing Databases on Fresh Setup

**Problem**: Databases don't exist after cloning repo

**Solution**: Run database health check

```bash
cd frontend
npm run db:health
```

This creates missing databases automatically.

---

### ❌ #17: Not Checking Workspace Tables

**Problem**: Workspace features fail due to missing tables

**Solution**: Verify workspace tables exist

```bash
cd frontend
npm run workspace:check
```

If missing, run: `npm run workspace:init`

---

## Architecture Violations

### ❌ #4: Working in Root Directory

**Problem**: npm commands fail because package.json is in `frontend/`

```bash
# ❌ WRONG - from root directory
npm run dev  # Error: script not found
```

**Solution**: ALL development work happens in `frontend/`

```bash
# ✅ CORRECT
cd frontend
npm run dev
```

**Exception**: Git commands and `./start-veritable-games.sh` run from root.

📝 **See**: [CLAUDE.md](../CLAUDE.md#repository-structure)

---

### ❌ #10: Using WikiService for Projects

**Problem**: Projects have standalone revision system

```typescript
// ❌ WRONG
import { wikiService } from '@/lib/wiki/service';
await wikiService.createRevision(projectId, content);
```

**Solution**: Use ProjectRevisionsService

```typescript
// ✅ CORRECT
import { projectRevisionsService } from '@/lib/content/project-revisions-service';
await projectRevisionsService.createRevision(projectSlug, content);
```

📝 **See**: [docs/features/PROJECT_REFERENCES_ARCHITECTURE.md](./features/PROJECT_REFERENCES_ARCHITECTURE.md)

---

### ❌ #12: Workspace in Wrong Database

**Problem**: Looking for workspace data in wiki.db or library.db

**Solution**: Workspace data lives in the `content` schema

```typescript
// ✅ CORRECT
const result = await dbAdapter.query(
  'SELECT * FROM workspaces WHERE id = ?',
  [id],
  { schema: 'content' }
);
const workspace = result.rows[0];
```

---

### ❌ #21: Middleware in Wrong Location

**Problem**: Middleware compiles but never executes

```bash
# ❌ WRONG - middleware.ts in root
veritable-games-main/middleware.ts

# ✅ CORRECT - middleware.ts in src/
veritable-games-main/frontend/src/middleware.ts
```

**Why**: With `src/` directory, Next.js only recognizes middleware at `src/middleware.ts`.

📝 **See**: [docs/architecture/MIDDLEWARE_AUTHENTICATION_ARCHITECTURE.md](./architecture/MIDDLEWARE_AUTHENTICATION_ARCHITECTURE.md)

---

### ❌ #22: Database Validation in Middleware

**Problem**: Trying to access database in middleware

```typescript
// ❌ WRONG - Middleware runs on Edge Runtime (no DB access)
export function middleware(request: NextRequest) {
  const session = await getSession(request); // ERROR: DB not available
}
```

**Solution**: Only check cookies in middleware, validate sessions in API routes

```typescript
// ✅ CORRECT - Middleware
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has('session');
  if (!hasSession) return NextResponse.redirect('/auth/login');
}

// ✅ CORRECT - API route
export const GET = withSecurity(async (request) => {
  const user = await getCurrentUser(request); // DB validation here
  if (!user) throw new AuthenticationError();
});
```

---

## Working Directory Confusion

### ❌ #16: Running npm Commands from Root

**Problem**: 95% of "command not found" errors stem from this

```bash
# ❌ WRONG - from root directory
npm test  # Error: script not found
npm run type-check  # Error: script not found
```

**Solution**: Must be in `frontend/` directory

```bash
# ✅ CORRECT
cd frontend
npm test
npm run type-check
```

**Critical Commands by Directory**:

| Command Type | Directory | Examples |
|--------------|-----------|----------|
| npm commands | `frontend/` | `npm run dev`, `npm test`, `npm run type-check` |
| git commands | root | `git add .`, `git commit`, `git push` |
| server script | root | `./start-veritable-games.sh start` |

---

## Next.js 15 Specific Issues

### ❌ #7: Not Awaiting Params in Route Handlers

**Problem**: Next.js 15 made params asynchronous

```typescript
// ❌ WRONG - Next.js 14 pattern
export async function GET(req, { params }: { params: { slug: string } }) {
  const id = params.slug; // ERROR in Next.js 15
}
```

**Solution**: Await params before accessing

```typescript
// ✅ CORRECT - Next.js 15
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const params = await context.params;
  const id = params.slug;
}
```

📝 **See**: [docs/REACT_PATTERNS.md](./REACT_PATTERNS.md)

---

### ❌ #8: Using localStorage in Server Components

**Problem**: Server Components don't have access to browser APIs

```typescript
// ❌ WRONG - Server Component
export default async function Page() {
  const stored = localStorage.getItem('key'); // ERROR: not defined
}
```

**Solution**: Wrap in client-side checks or use Client Components

```typescript
// ✅ CORRECT - Client Component
'use client'
import { useEffect, useState } from 'react';

export default function Page() {
  const [stored, setStored] = useState(null);

  useEffect(() => {
    setStored(localStorage.getItem('key'));
  }, []);

  return <div>{stored}</div>;
}
```

📝 **See**: [docs/REACT_PATTERNS.md](./REACT_PATTERNS.md#ssr-safe-client-code)

---

## Security Issues

### ❌ #5: Manual Error Responses

**Problem**: Inconsistent error handling, missing security headers

```typescript
// ❌ WRONG
export async function POST(request: NextRequest) {
  try {
    // ... logic
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

**Solution**: Use custom error classes and errorResponse()

```typescript
// ✅ CORRECT
import { errorResponse, ValidationError } from '@/lib/utils/api-errors';

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    if (!data.title) throw new ValidationError('Title required');
    // ... logic
  } catch (error) {
    return errorResponse(error);
  }
});
```

📝 **See**: [docs/architecture/CRITICAL_PATTERNS.md](./architecture/CRITICAL_PATTERNS.md#3-api-route-pattern)

---

## State Management Issues

### ❌ #9: Service Instantiation Without Default Exports

**Problem**: Service registry expects singleton instances

```typescript
// ❌ WRONG - Only class export
export class WikiService {
  // ... methods
}

// Import fails in service registry
import { wikiService } from '@/lib/wiki/service'; // undefined
```

**Solution**: Export both class and singleton instance

```typescript
// ✅ CORRECT
export class WikiService {
  // ... methods
}

// Export singleton (REQUIRED)
export const wikiService = new WikiService();
```

📝 **See**: [docs/architecture/CRITICAL_PATTERNS.md](./architecture/CRITICAL_PATTERNS.md#5-service-export-pattern)

---

## Workspace/Canvas Issues

### ❌ #13: Not Cleaning Up InputHandler

**Problem**: Memory leaks from event listeners

```typescript
// ❌ WRONG
useEffect(() => {
  const inputHandler = new InputHandler(canvasRef.current);
  inputHandler.init();
  // Missing cleanup
}, []);
```

**Solution**: Always destroy in cleanup

```typescript
// ✅ CORRECT
useEffect(() => {
  const inputHandler = new InputHandler(canvasRef.current);
  inputHandler.init();

  return () => {
    inputHandler.destroy(); // Removes event listeners
  };
}, []);
```

---

### ❌ #14: Using Smooth Transforms for Input

**Problem**: Laggy, unresponsive feel

```typescript
// ❌ WRONG
transformManager.pan(deltaX, deltaY); // Smooth animation
```

**Solution**: Use instant transforms for input

```typescript
// ✅ CORRECT
transformManager.panInstant(deltaX, deltaY); // Immediate response
transformManager.zoomInstant(scaleDelta);
```

---

### ❌ #15: Forgetting Screen/Canvas Coordinate Conversion

**Problem**: Mouse clicks don't align with canvas elements

```typescript
// ❌ WRONG - Using screen coordinates directly
const node = { x: event.clientX, y: event.clientY };
```

**Solution**: Always convert coordinates

```typescript
// ✅ CORRECT
const canvasPos = transformManager.screenToCanvas(event.clientX, event.clientY);
const node = { x: canvasPos.x, y: canvasPos.y };
```

---

## Testing Issues

### ❌ #26: Test Files in Wrong Location

**Problem**: Tests not discovered or in wrong directory structure

```bash
# ❌ WRONG - Tests in root
veritable-games-main/__tests__/
veritable-games-main/tests/

# ✅ CORRECT - Co-located with code
frontend/src/components/forums/__tests__/TopicCard.test.tsx
frontend/src/lib/auth/__tests__/service.test.tsx

# ✅ CORRECT - E2E tests
frontend/e2e/specs/forum-creation.spec.ts
```

**Rule**: Unit/integration tests in `__tests__/` next to code. E2E tests in `e2e/specs/`.

📝 **See**: [docs/guides/TESTING.md](./guides/TESTING.md)

---

## Deployment Issues

### ❌ #6: Skipping Type-Check Before Commit

**Problem**: TypeScript errors break production builds

```bash
# ❌ WRONG - Commit without checking
git add .
git commit -m "add feature"
# Breaks CI/CD
```

**Solution**: Always run type-check before committing

```bash
# ✅ CORRECT
cd frontend
npm run type-check  # CRITICAL - must pass
npm run format
npm test
# If all pass:
cd ..
git add .
git commit -m "add feature"
```

---

### ❌ #18: Blocking Main Thread with 3D Calculations

**Problem**: UI freezes during physics calculations

```typescript
// ❌ WRONG - Heavy computation on main thread
function calculateOrbits() {
  for (let i = 0; i < 10000; i++) {
    // Complex orbital physics
  }
}
```

**Solution**: Use Web Workers (already implemented for stellar system)

```typescript
// ✅ CORRECT
const worker = new Worker('/stellar/physics-worker.js');
worker.postMessage({ type: 'calculate', data: planets });
worker.onmessage = (e) => {
  updateScene(e.data.positions);
};
```

📝 **See**: `public/stellar/` and `src/lib/stellar/`

---

### ❌ #19: Not Using Dry-Run for Destructive Operations

**Problem**: Accidentally delete production data

```bash
# ❌ WRONG - Run cleanup without testing
npm run gallery:cleanup
# Deletes 500 images immediately
```

**Solution**: Always test with --dry-run first

```bash
# ✅ CORRECT
npm run gallery:cleanup:dry-run  # Preview what will be deleted
# Review output
npm run gallery:cleanup  # Actually delete
```

---

### ❌ #20: Modifying Gallery Files Directly

**Problem**: Database and filesystem out of sync

```bash
# ❌ WRONG - Delete files manually
rm frontend/public/uploads/galleries/project-slug/image.jpg
```

**Solution**: Use migration scripts or API endpoints

```bash
# ✅ CORRECT - Use script
npm run gallery:cleanup

# Or use API
DELETE /api/projects/[slug]/references/[imageId]
```

---

### ❌ #23: Not Tracking Deleted Gallery Images

**Problem**: Images deleted but not marked in database

**Solution**: Use soft delete strategy

```typescript
// ✅ CORRECT - Soft delete (recoverable for 30 days)
await db.prepare(`
  UPDATE project_gallery_images
  SET deleted_at = datetime('now')
  WHERE id = ?
`).run(imageId);

// Hard cleanup after 30 days
npm run gallery:cleanup
```

📝 **See**: [docs/features/GALLERY_DELETE_STRATEGY.md](./features/GALLERY_DELETE_STRATEGY.md)

---

### ❌ #24: Lost Admin Access

**Problem**: Admin password forgotten or corrupted

**Solution**: Run password reset script

```bash
cd frontend
npm run user:reset-admin-password

# Login with:
# Username: admin
# Password: Admin123!

# IMMEDIATELY change password in settings after login
```

---

### ❌ #25: Gallery Audit Shows Mismatches

**Problem**: Database and filesystem inconsistencies

**Solution**: Run comprehensive audit before cleanup

```bash
# Check for issues
npm run gallery:audit

# Or simple count check
npm run gallery:audit:simple

# Debug specific path issues
npm run debug:gallery:paths
```

📝 **See**: [docs/guides/GALLERY_AUDIT_USAGE.md](./guides/GALLERY_AUDIT_USAGE.md)

---

## Quick Reference Checklist

Before starting any task, review this checklist:

### Database
- [ ] Using `dbAdapter.query()` (not `new Database()`)
- [ ] No cross-schema JOINs (use ProfileAggregatorService)
- [ ] Using parameterized queries (not string concatenation)

### Working Directory
- [ ] Running npm commands from `frontend/`
- [ ] Running git commands from root
- [ ] Using `./start-veritable-games.sh` from root

### Next.js 15
- [ ] Awaiting params before accessing properties
- [ ] Wrapping browser APIs in SSR-safe guards
- [ ] Using Server Components by default

### Security
- [ ] API routes wrapped with `withSecurity()`
- [ ] Errors handled via `errorResponse()`
- [ ] Input validated before processing

### Testing
- [ ] Running `npm run type-check` before commit
- [ ] Tests co-located with code
- [ ] Using dry-run for destructive operations

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main development guide
- [docs/architecture/CRITICAL_PATTERNS.md](./architecture/CRITICAL_PATTERNS.md) - Must-follow patterns
- [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and fixes
- [docs/KNOWN_ISSUES.md](./KNOWN_ISSUES.md) - Current known issues
- [.claude/BANNED_PATTERNS.md](../.claude/BANNED_PATTERNS.md) - Patterns NEVER to reintroduce

---

**Last Updated**: November 12, 2025
