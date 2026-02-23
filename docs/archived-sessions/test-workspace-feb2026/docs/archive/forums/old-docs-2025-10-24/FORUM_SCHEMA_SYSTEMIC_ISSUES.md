# Forum Schema Systemic Issues - Critical Analysis

**Date**: October 12, 2025
**Status**: 🔴 CRITICAL - Multiple schema mismatches causing production errors
**Analysis By**: 3 independent subagents

---

## Executive Summary

The forum database system has **three divergent schema definitions** causing repeated "no such column" errors. My subagent analysis reveals **8 critical missing columns** and multiple architectural inconsistencies.

### Root Cause
Unlike a single schema mismatch, we have **THREE sources of truth** that have diverged:

1. **pool.ts** (lines 454-658) - Minimal schema with basic columns
2. **TypeScript types.ts** (lines 96-229) - Full feature expectations (edit tracking, soft delete attribution)
3. **Legacy init-forums-db.js** - Extended schema (may be unused)

### Impact
- ❌ 4+ "no such column" errors in production
- ❌ Soft delete broken (no `deleted_by` tracking)
- ❌ Edit history broken (no `last_edited_at`, `last_edited_by`)
- ❌ Inconsistent column naming (`user_id` vs `author_id`)

---

## Critical Findings

### Missing Columns (8 Total)

#### forum_topics (4 missing)
| Column | Type | Purpose | Impact |
|--------|------|---------|--------|
| `deleted_by` | INTEGER | Track who deleted topic | Soft delete broken |
| `last_edited_at` | DATETIME | Edit timestamp | Edit history broken |
| `last_edited_by` | INTEGER | Track editor | Edit attribution broken |
| ~~`author_id`~~ | INTEGER | ⚠️ **Exists as `user_id`** (aliased in queries) | Naming inconsistency |

#### forum_replies (4 missing)
| Column | Type | Purpose | Impact |
|--------|------|---------|--------|
| `deleted_by` | INTEGER | Track who deleted reply | Soft delete broken |
| `last_edited_at` | DATETIME | Edit timestamp | Edit history broken |
| `last_edited_by` | INTEGER | Track editor | Edit attribution broken |
| ~~`author_id`~~ | INTEGER | ⚠️ **Exists as `user_id`** (aliased in queries) | Naming inconsistency |

#### forum_categories
✅ **No issues** - All columns match

### Recent Errors Fixed

1. ✅ **"no such table: main.users"** - FTS5 triggers referencing non-existent `username` column
2. ✅ **"no such column: deleted_at"** - Added to schema in Phase 4
3. ✅ **"no such column: author_username"** - Fixed search repository
4. ✅ **"no such column: section"** - Removed legacy column from query (just fixed)

### Remaining Errors (Not Yet Fixed)

1. ❌ **"no such column: deleted_by"** - Will occur on soft delete operations
2. ❌ **"no such column: last_edited_at"** - Will occur on edit operations
3. ❌ **"no such column: last_edited_by"** - Will occur on edit operations

---

## Detailed Schema Comparison

### forum_topics

**Current Schema (pool.ts lines 472-490)**:
```sql
CREATE TABLE forum_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  user_id INTEGER,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_format TEXT DEFAULT 'markdown',
  is_locked INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  is_solved INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  vote_score INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME
);
```

**TypeScript Expectations (types.ts lines 127-162)**:
```typescript
interface ForumTopic {
  id: TopicId;
  title: string;
  content: string;
  content_format: ContentFormat;
  category_id: CategoryId;
  author_id: UserId;          // ⚠️ DB has user_id
  view_count: number;
  reply_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  is_solved: boolean;
  status: TopicStatus;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  deleted_at: string | null;
  deleted_by: UserId | null;  // ❌ MISSING
  // Editing fields
  edited_at: string | null;
  edited_by: UserId | null;
  last_edited_at: string | null;  // ❌ MISSING
  last_edited_by: UserId | null;  // ❌ MISSING
  // ... more fields
}
```

**Mismatch**: 4 columns (including naming inconsistency)

### forum_replies

**Current Schema (pool.ts lines 493-507)**:
```sql
CREATE TABLE forum_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  parent_id INTEGER,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_format TEXT DEFAULT 'markdown',
  reply_depth INTEGER DEFAULT 0,
  path TEXT DEFAULT '',
  is_solution INTEGER DEFAULT 0,
  vote_score INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME
);
```

**TypeScript Expectations (types.ts lines 186-220)**:
```typescript
interface ForumReply {
  id: ReplyId;
  topic_id: TopicId;
  parent_id: ReplyId | null;
  author_id: UserId;          // ⚠️ DB has user_id
  content: string;
  content_format: ContentFormat;
  reply_depth: number;
  path: string;
  is_solution: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: UserId | null;  // ❌ MISSING
  // Edit tracking
  edited_at: string | null;
  edited_by: UserId | null;
  last_edited_at: string | null;  // ❌ MISSING (duplicate with edited_at?)
  last_edited_by: UserId | null;  // ❌ MISSING (duplicate with edited_by?)
}
```

**Mismatch**: 4 columns (including naming inconsistency)

---

## Why This Keeps Happening

### Problem 1: Multiple Schema Sources
- **pool.ts** initializes the schema automatically
- **init-forums-db.js** is a separate initialization script (may be unused)
- **TypeScript types** define expectations
- **No single source of truth**

### Problem 2: Schema Evolution Without Migration
- Features added to TypeScript interfaces
- Schema not updated in pool.ts
- No migration system to keep them in sync

### Problem 3: Incomplete Phase 4 Fix
My previous fix added `deleted_at` but missed:
- `deleted_by` (WHO deleted it)
- `last_edited_at` (WHEN was it last edited)
- `last_edited_by` (WHO last edited it)

---

## Comprehensive Fix Strategy

### Option 1: Complete Schema Update (Recommended)

**Add missing columns to pool.ts**:

```typescript
// forum_topics - ADD THESE LINES
deleted_at DATETIME,
deleted_by INTEGER,
last_edited_at DATETIME,
last_edited_by INTEGER,

// forum_replies - ADD THESE LINES
deleted_at DATETIME,
deleted_by INTEGER,
last_edited_at DATETIME,
last_edited_by INTEGER,
```

**Pros**:
- Complete feature set
- No more missing column errors
- Enables edit tracking and delete attribution

**Cons**:
- Requires database recreation (already doing this)
- Need to implement edit tracking in API routes

### Option 2: Simplify TypeScript Types

**Remove unused fields from types.ts**:
- Remove `deleted_by` (if not tracking who deleted)
- Remove `last_edited_at`, `last_edited_by` (if not implementing edit history)

**Pros**:
- Quick fix
- No database changes

**Cons**:
- Loses features
- May break existing code expecting these fields

### Option 3: Hybrid Approach (My Recommendation)

1. **Immediate**: Add missing columns with NULL defaults
2. **Short-term**: Implement edit tracking in UPDATE endpoints
3. **Long-term**: Add migration versioning system

---

## Recommended Fix (Step-by-Step)

### Step 1: Update pool.ts Schema (5 minutes)

**File**: `/frontend/src/lib/database/pool.ts`

**Lines 472-490** (forum_topics):
```typescript
CREATE TABLE IF NOT EXISTS forum_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  user_id INTEGER,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_format TEXT DEFAULT 'markdown',
  is_locked INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  is_solved INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  vote_score INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  deleted_by INTEGER,           -- ADD THIS
  last_edited_at DATETIME,      -- ADD THIS
  last_edited_by INTEGER        -- ADD THIS
);
```

**Lines 493-507** (forum_replies):
```typescript
CREATE TABLE IF NOT EXISTS forum_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  parent_id INTEGER,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_format TEXT DEFAULT 'markdown',
  reply_depth INTEGER DEFAULT 0,
  path TEXT DEFAULT '',
  is_solution INTEGER DEFAULT 0,
  vote_score INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  deleted_by INTEGER,           -- ADD THIS
  last_edited_at DATETIME,      -- ADD THIS
  last_edited_by INTEGER        -- ADD THIS
);
```

### Step 2: Delete Database (Force Recreation)

```bash
cd /home/user/Projects/web/veritable-games-main/frontend/data
cp forums.db forums.db.backup-$(date +%Y%m%d-%H%M%S)
rm forums.db forums.db-shm forums.db-wal
```

### Step 3: Restart Server

The schema will be recreated automatically with all correct columns.

### Step 4: Verify (Optional)

```bash
cd /home/user/Projects/web/veritable-games-main/frontend
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/forums.db', { readonly: true });
console.log('forum_topics:', db.prepare('PRAGMA table_info(forum_topics)').all());
console.log('forum_replies:', db.prepare('PRAGMA table_info(forum_replies)').all());
db.close();
"
```

---

## Prevention Strategy

### 1. Single Source of Truth
Create `schema.sql` file with canonical schema, generate both:
- Database creation in pool.ts
- TypeScript types from schema

### 2. Schema Validation Tests
Add test that compares:
```typescript
test('Database schema matches TypeScript types', () => {
  const dbColumns = getColumnsFromDatabase('forum_topics');
  const typeProperties = getPropertiesFromType<ForumTopic>();
  expect(dbColumns).toMatchObject(typeProperties);
});
```

### 3. Migration System
Use proper versioning:
```
migrations/
  001_initial_schema.sql
  002_add_soft_delete.sql
  003_add_edit_tracking.sql
```

### 4. Pre-Commit Hook
```bash
npm run schema:validate  # Fails if schema/types mismatch
```

---

## Files Analyzed by Subagents

**Subagent 1: Page Components** (15 files)
- All forum page components (.tsx)
- All forum UI components
- Found: `section` column in forums/page.tsx (legacy, removed)

**Subagent 2: API Routes & Repositories** (17 files)
- All forum API endpoints
- All repository files
- Found: Complete column usage patterns

**Subagent 3: Schema Comparison** (5 files)
- pool.ts schema definition
- types.ts interface definitions
- init-forums-db.js (legacy script)
- Found: 8 missing columns, 3 schema sources

---

## Timeline

**Phase 1-3** (Completed October 12):
- Fixed FTS5 triggers
- Fixed table names
- Fixed search repository

**Phase 4** (Completed October 12):
- Added `deleted_at` to forum_topics and forum_replies
- Added missing forum_categories columns

**Phase 5** (CURRENT - Needs Completion):
- ❌ Add `deleted_by` columns
- ❌ Add `last_edited_at` columns
- ❌ Add `last_edited_by` columns
- ❌ Remove legacy `section` column reference (✅ JUST FIXED)

**Phase 6** (Recommended Next):
- Implement edit tracking in API routes
- Implement delete attribution
- Add schema validation tests
- Document schema evolution process

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Schema sources analyzed | 3 |
| Files analyzed | 37 |
| Tables analyzed | 3 |
| Missing columns found | 8 |
| Errors fixed today | 4 |
| Errors remaining | 3 |
| Estimated fix time | 10 minutes |
| Database recreations today | 3 |

---

## Conclusion

The forum system's schema issues stem from **architectural drift** between three schema definitions, not simple typos. The fix is straightforward (add 6 columns), but preventing recurrence requires:

1. ✅ Complete the schema (add missing columns)
2. ✅ Single source of truth (consolidate definitions)
3. ✅ Automated validation (schema tests)
4. ✅ Migration versioning (track changes)

Without these measures, we'll continue encountering "no such column" errors as features are added to TypeScript interfaces but not reflected in the database schema.

---

**Next Action**: Update pool.ts with 6 missing columns, delete forums.db, restart server.
