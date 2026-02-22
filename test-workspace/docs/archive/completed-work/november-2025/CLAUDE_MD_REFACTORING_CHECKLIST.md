# CLAUDE.md Refactoring Checklist

**Goal**: Trim CLAUDE.md from 732 lines to 600-650 lines by offloading details to specialized reference files.

**Status**: Ready to implement

---

## New Reference Files Created ✅

- [.claude/BANNED_PATTERNS.md](../.claude/BANNED_PATTERNS.md) - Patterns to never reintroduce
- [.claude/STATE_MANAGEMENT_PATTERNS.md](../.claude/STATE_MANAGEMENT_PATTERNS.md) - Zustand examples
- [.claude/DATABASE_QUERIES_QUICK_REF.md](../.claude/DATABASE_QUERIES_QUICK_REF.md) - SQL patterns
- [.claude/AGENT_USAGE.md](../.claude/AGENT_USAGE.md) - When to use which agent

---

## Specific CLAUDE.md Changes

### SECTION 1: Repository Structure (Lines 156-194)
**Current**: 38 lines
**Target**: 25-30 lines
**Action**: Remove verbose comments, keep only essential structure

**BEFORE** (38 lines):
```markdown
**Monorepo Layout:**
```
veritable-games-main/                # Root (git operations ONLY)
├── frontend/                        # ALL development work here
│   ├── src/
│   │   ├── app/                    # Next.js App Router
│   │   │   ├── api/               # API routes (forums, wiki, library, etc)
│   │   │   └── */                 # Page routes
...
```

**AFTER** (25 lines):
```markdown
**Monorepo Layout:**
```
veritable-games-main/
├── frontend/                # Development directory
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/        # API routes
│   │   │   └── */          # Page routes
│   │   ├── components/     # React components
│   │   ├── lib/            # Services & business logic
│   │   │   ├── database/
│   │   │   └── [domain]/   # Forums, wiki, etc
│   │   └── hooks/          # Custom React hooks
│   ├── data/               # 10 SQLite databases
│   ├── scripts/            # Utility scripts
│   └── __tests__/          # Tests
├── docs/                   # Complete documentation
├── .claude/                # Claude reference guides
└── CLAUDE.md               # Architecture guide
```
**Key**: No verbose comments in ASCII art.

---

### SECTION 2: Development Commands (Lines 202-279)
**Current**: 75 lines (detailed)
**Target**: 35-40 lines (essential only)
**Action**: Keep top 10 commands, move detailed table to link

**BEFORE** (Table with 29 rows):
```
| Task | Command | When to Use |
|------|---------|-------------|
| Type validation | `npm run type-check` | REQUIRED before every commit |
| Format code | `npm run format` | Auto-fix formatting issues |
[...27 more rows...]
```

**AFTER** (Compressed):
```
### Essential Commands
**From `frontend/` directory:**

**Development**:
- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run type-check` - TypeScript validation (REQUIRED before commit)
- `npm run format` - Auto-format code
- `npm test` - Run tests

**Database**:
- `npm run db:health` - Verify all 10 databases
- `npm run db:backup` - Backup databases

**Server Management** (from root):
- `./start-veritable-games.sh start|stop|restart|status|logs`

**Full command reference**: [docs/guides/COMMANDS_REFERENCE.md](../docs/guides/COMMANDS_REFERENCE.md)
```

---

### SECTION 3: Critical Architecture Rules (Lines 293-435)
**Current**: 142 lines
**Target**: 90-110 lines
**Action**: Keep essential patterns, move detailed examples to separate docs

**REMOVE**:
- Entire "5. Workspace Patterns" section (60 lines) → Already documented in docs/features/WORKSPACE_ARCHITECTURE.md
- "4. Content Sanitization" detailed explanations → Link to SECURITY doc
- Long code examples (reduce to 2-3 lines max)

**KEEP**:
- Database Access Pattern (essential, keep short)
- API Security Pattern (1 line)
- API Route Pattern (simplified)
- Next.js 15 Async Params (critical)

**BEFORE** (Database Access - 47 lines):
```typescript
// Full explanation with all database names listed...
```

**AFTER** (Database Access - 20 lines):
```typescript
// ✅ CORRECT - Use singleton pool
import { dbPool } from '@/lib/database/pool';
const db = dbPool.getConnection('users');
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// ❌ WRONG
import Database from 'better-sqlite3';
const db = new Database('path/to/db'); // Causes connection leaks

// Database names: forums, wiki, users, system, content, library, auth, messaging
// See docs/DATABASE.md for complete list and use cases.
```

---

### SECTION 4: Platform Features (Lines 437-585)
**Current**: 148 lines (detailed)
**Target**: 40-50 lines (summary only)
**Action**: Compress each feature to 2-3 line description + link

**BEFORE** (Forums - 52 lines):
```markdown
### Forums System

✅ **Fully functional production-ready forum** with complete architectural documentation.

**System Stats**:
- **17 API endpoints** across 9 endpoint groups
- **6 specialized services** (2,950 LOC)
- **5 repositories** with Result pattern (1,450 LOC)
[...more details...]
```

**AFTER** (Forums - 4 lines):
```markdown
### Forums System
✅ Production-ready forums (17 API routes, 6 services, real-time SSE).
Features: Bitflag status system, FTS5 search, React 19 optimistic UI.
See [docs/forums/FORUMS_DOCUMENTATION_INDEX.md](../docs/forums/FORUMS_DOCUMENTATION_INDEX.md)
```

**Apply same pattern to**: Wiki, Library, Projects, Stellar Visualization

---

### SECTION 5: React & Next.js Patterns (Lines 681-686)
**Current**: 6 lines
**Target**: 15-20 lines (expanded)
**Action**: Add summary of banned patterns with links

**BEFORE** (6 lines):
```markdown
**BANNED**: `template.tsx`, TanStack Query, multiple client wrappers (caused hydration errors, removed October 2025)
**USE**: Server Components by default, `'use client'` only for interactivity, direct fetch() for mutations

**Complete patterns**: See [docs/REACT_PATTERNS.md](./docs/REACT_PATTERNS.md)
```

**AFTER** (18 lines):
```markdown
## ⚠️ BANNED PATTERNS (NEVER Reintroduce)

**CRITICAL**: These were removed in October 2025 after causing persistent bugs:
- ❌ `template.tsx` (remounts on every navigation)
- ❌ TanStack Query (900+ lines dead code)
- ❌ Multiple client wrappers (competing render cycles)
- ❌ String concat in SQL (injection risk)
- ❌ Creating Database instances directly (connection leaks)

**See**: [.claude/BANNED_PATTERNS.md](./.claude/BANNED_PATTERNS.md) for details and correct patterns.

**Correct patterns**: Server Components by default, direct fetch() for mutations, Zustand for state.
See [docs/REACT_PATTERNS.md](./docs/REACT_PATTERNS.md)
```

---

### SECTION 6: Additional Documentation (Lines 587-601)
**Current**: 15 lines
**Target**: 20-25 lines (better organized)
**Action**: Add new reference files, organize by category

**BEFORE** (unsorted list):
```markdown
**Complete documentation index**: [docs/README.md](./docs/README.md)

**Quick Links**:
- **[docs/REACT_PATTERNS.md](./docs/REACT_PATTERNS.md)** - React 19 + Next.js 15 patterns
- **[docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)** - Common fixes and diagnostic commands
[...8 more links...]
```

**AFTER** (organized):
```markdown
## Additional Documentation

**Architecture Guides** (.claude/ directory):
- [BANNED_PATTERNS.md](./.claude/BANNED_PATTERNS.md) - Patterns NEVER to reintroduce
- [STATE_MANAGEMENT_PATTERNS.md](./.claude/STATE_MANAGEMENT_PATTERNS.md) - Zustand examples
- [DATABASE_QUERIES_QUICK_REF.md](./.claude/DATABASE_QUERIES_QUICK_REF.md) - SQL patterns
- [AGENT_USAGE.md](./.claude/AGENT_USAGE.md) - When to use Claude Code agents

**Feature Documentation** (docs/ directory):
- [REACT_PATTERNS.md](./docs/REACT_PATTERNS.md) - React 19 + Next.js 15
- [DATABASE.md](./docs/DATABASE.md) - Database architecture
- [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) - Common fixes
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Production deployment
- [guides/COMMANDS_REFERENCE.md](./docs/guides/COMMANDS_REFERENCE.md) - All npm scripts

**Complete Index**: [docs/README.md](./docs/README.md)
```

---

### SECTION 7: Delete "Recent Changes" (Lines 719-724)
**Current**: 6 lines
**Target**: Delete (0 lines)
**Reason**: Becomes stale; historical info belongs in git log

```markdown
// DELETE THIS SECTION
## Recent Changes (October 2025)

**Simplification:** Removed admin dashboard, monitoring endpoints, TanStack Query, ESLint (hydration fixes)
...
```

---

## Line Count Verification

| Section | Before | After | Change |
|---------|--------|-------|--------|
| Date Handling | 5 | 5 | - |
| TOC | 10 | 10 | - |
| Start Here | 28 | 28 | - |
| Quick Decision Tree | 94 | 94 | - |
| Repository Structure | 38 | 25 | -13 |
| Workflow Rules | 4 | 4 | - |
| Essential Commands | 75 | 35 | -40 |
| CRITICAL PATTERNS | 10 | 10 | - |
| Critical Rules | 142 | 95 | -47 |
| **BANNED PATTERNS** (new) | - | 18 | +18 |
| Platform Features | 148 | 45 | -103 |
| Common Pitfalls | 20 | 20 | - |
| React & Next.js | 6 | 18 | +12 |
| Important Notes | 8 | 8 | - |
| Common Warnings | 12 | 12 | - |
| Additional Docs | 15 | 25 | +10 |
| Build & Deploy | 3 | 3 | - |
| **Recent Changes** | 6 | - | -6 |
| **TOTAL** | **732** | **600** | **-132** |

---

## Implementation Order

### Phase 1: Verify New Files Work (No changes to CLAUDE.md)
1. Commit new .claude/ files
2. Test all cross-references
3. Verify no broken links

### Phase 2: Trim CLAUDE.md
1. Delete "Recent Changes" section (6 lines)
2. Compress Repository Structure (38→25 lines)
3. Compress Development Commands (75→35 lines)
4. Trim Critical Architecture Rules (142→95 lines)
5. Compress Platform Features (148→45 lines)
6. Expand React & Next.js Patterns with banned links (6→18 lines)
7. Reorganize Additional Documentation (15→25 lines)

### Phase 3: Verify & Commit
1. Run: `wc -l CLAUDE.md` (should be 600 lines)
2. Test all links work
3. Read through for flow
4. Commit with message: "refactor: Trim CLAUDE.md, offload details to .claude/ guides"

---

## Success Checklist

- [ ] All 4 new .claude/ files created and working
- [ ] All links in CLAUDE.md are valid
- [ ] CLAUDE.md is 600 ± 20 lines
- [ ] Quick Decision Tree unchanged (still comprehensive)
- [ ] Start Here section still complete
- [ ] Critical Patterns still visible
- [ ] Common Pitfalls still visible
- [ ] All referenced files are easy to find
- [ ] No important information removed (only moved to appropriate files)
- [ ] Future Claude instances can find everything via links

---

## Notes

- Keep the **Quick Decision Tree** as centerpiece - it's the #1 value of CLAUDE.md
- **Start Here: First 5 Minutes** is onboarding critical - do not trim
- **Critical Patterns** quick checklist must stay - prevents mistakes
- All trimmed content is NOT deleted, just moved to more appropriate files
- CLAUDE.md becomes a high-signal reference with links to detailed docs
