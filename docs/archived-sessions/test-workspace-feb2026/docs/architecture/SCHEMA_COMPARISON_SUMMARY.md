# Forum Schema Comparison Summary

**Date:** 2025-10-12
**Status:** ❌ CRITICAL MISMATCHES FOUND

---

## Quick Summary

**Problem:** TypeScript interfaces expect columns that don't exist in the database, causing production errors.

**Root Cause:** Three different schema sources (pool.ts, init-forums-db.js, add-forums-soft-delete.js) have diverged over time.

**Impact:** Missing columns cause SQL errors and incomplete features (soft delete attribution, edit tracking).

---

## Missing Columns by Table

### forum_topics (4 missing)
| Column | TypeScript | Database | Impact |
|--------|-----------|----------|--------|
| `deleted_by` | ✅ Expected | ❌ Missing | **CRITICAL** - Can't track WHO deleted |
| `last_edited_at` | ✅ Expected | ❌ Missing | Feature incomplete - no edit history |
| `last_edited_by` | ✅ Expected | ❌ Missing | Feature incomplete - no edit attribution |
| `author_id` | ✅ Expected | ❌ Missing | Naming mismatch (DB has `user_id`) |

### forum_replies (4 missing)
| Column | TypeScript | Database | Impact |
|--------|-----------|----------|--------|
| `deleted_by` | ✅ Expected | ❌ Missing | **CRITICAL** - Can't track WHO deleted |
| `last_edited_at` | ✅ Expected | ❌ Missing | Feature incomplete - no edit history |
| `last_edited_by` | ✅ Expected | ❌ Missing | Feature incomplete - no edit attribution |
| `author_id` | ✅ Expected | ❌ Missing | Naming mismatch (DB has `user_id`) |

### forum_categories (0 missing)
✅ **Perfect match** - all columns present and aligned

---

## Detailed Comparison

### 1. ForumCategory Interface

**Status:** ✅ **COMPLETE MATCH**

All 11 properties match between TypeScript interface and database schema.

### 2. ForumTopic Interface

**Status:** ❌ **4 CRITICAL MISMATCHES**

#### TypeScript Interface (27 properties)
```typescript
interface ForumTopic {
  id: TopicId;                    // ✅ Exists as INTEGER PRIMARY KEY
  title: string;                  // ✅ Exists as TEXT NOT NULL
  content: string;                // ✅ Exists as TEXT NOT NULL
  content_format: ContentFormat;  // ✅ Exists as TEXT DEFAULT 'markdown'
  category_id: CategoryId;        // ✅ Exists as INTEGER
  author_id: UserId;              // ❌ MISSING (DB has user_id instead)
  view_count: number;             // ✅ Exists as INTEGER DEFAULT 0
  reply_count: number;            // ✅ Exists as INTEGER DEFAULT 0
  is_pinned: boolean;             // ✅ Exists as INTEGER DEFAULT 0
  is_locked: boolean;             // ✅ Exists as INTEGER DEFAULT 0
  is_solved: boolean;             // ✅ Exists as INTEGER DEFAULT 0
  status: TopicStatus;            // ✅ Exists as TEXT DEFAULT 'open'
  created_at: string;             // ✅ Exists as DATETIME
  updated_at: string;             // ✅ Exists as DATETIME
  last_activity_at: string;       // ✅ Exists as DATETIME
  deleted_at: string | null;      // ✅ Exists as DATETIME (added by migration)
  deleted_by: UserId | null;      // ❌ MISSING
  last_edited_at: string | null;  // ❌ MISSING
  last_edited_by: UserId | null;  // ❌ MISSING

  // Optional joined data (not stored in DB)
  author?: ForumUser;             // ⚠️ Cannot populate without author data
  category?: ForumCategory;       // ✅ Can populate via JOIN
  tags?: ForumTag[];              // ❌ No tag support in current DB
}
```

#### Actual Database Schema (17 columns)
```sql
CREATE TABLE forum_topics (
  id INTEGER PRIMARY KEY,                          -- ✅ Matches
  category_id INTEGER,                             -- ✅ Matches
  user_id INTEGER,                                 -- ⚠️ TS expects author_id
  title TEXT NOT NULL,                             -- ✅ Matches
  content TEXT NOT NULL,                           -- ✅ Matches
  content_format TEXT DEFAULT 'markdown',          -- ✅ Matches
  is_locked INTEGER DEFAULT 0,                     -- ✅ Matches
  is_pinned INTEGER DEFAULT 0,                     -- ✅ Matches
  is_solved INTEGER DEFAULT 0,                     -- ✅ Matches
  status TEXT DEFAULT 'open',                      -- ✅ Matches
  vote_score INTEGER DEFAULT 0,                    -- ✅ Matches
  reply_count INTEGER DEFAULT 0,                   -- ✅ Matches
  view_count INTEGER DEFAULT 0,                    -- ✅ Matches
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,   -- ✅ Matches
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,   -- ✅ Matches
  last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- ✅ Matches
  deleted_at DATETIME                              -- ✅ Matches
);
```

**Missing:** `deleted_by`, `last_edited_at`, `last_edited_by`, `author_id`

### 3. ForumReply Interface

**Status:** ❌ **4 CRITICAL MISMATCHES**

#### TypeScript Interface (22 properties)
```typescript
interface ForumReply {
  id: ReplyId;                    // ✅ Exists as INTEGER PRIMARY KEY
  topic_id: TopicId;              // ✅ Exists as INTEGER NOT NULL
  parent_id: ReplyId | null;      // ✅ Exists as INTEGER
  author_id: UserId;              // ❌ MISSING (DB has user_id instead)
  content: string;                // ✅ Exists as TEXT NOT NULL
  content_format: ContentFormat;  // ✅ Exists as TEXT DEFAULT 'markdown'
  reply_depth: number;            // ✅ Exists as INTEGER DEFAULT 0
  path: string;                   // ✅ Exists as TEXT DEFAULT ''
  is_solution: boolean;           // ✅ Exists as INTEGER DEFAULT 0
  created_at: string;             // ✅ Exists as DATETIME
  updated_at: string;             // ✅ Exists as DATETIME
  deleted_at: string | null;      // ✅ Exists as DATETIME (added by migration)
  deleted_by: UserId | null;      // ❌ MISSING
  last_edited_at: string | null;  // ❌ MISSING
  last_edited_by: UserId | null;  // ❌ MISSING

  // Optional joined data (not stored in DB)
  author?: ForumUser;             // ⚠️ Cannot populate without author data
  parent?: ForumReply;            // ✅ Can populate via JOIN
  children?: ForumReply[];        // ✅ Can populate via JOIN
}
```

#### Actual Database Schema (13 columns)
```sql
CREATE TABLE forum_replies (
  id INTEGER PRIMARY KEY,                          -- ✅ Matches
  topic_id INTEGER NOT NULL,                       -- ✅ Matches
  parent_id INTEGER,                               -- ✅ Matches
  user_id INTEGER NOT NULL,                        -- ⚠️ TS expects author_id
  content TEXT NOT NULL,                           -- ✅ Matches
  content_format TEXT DEFAULT 'markdown',          -- ✅ Matches
  reply_depth INTEGER DEFAULT 0,                   -- ✅ Matches
  path TEXT DEFAULT '',                            -- ✅ Matches
  is_solution INTEGER DEFAULT 0,                   -- ✅ Matches
  vote_score INTEGER DEFAULT 0,                    -- ✅ Matches
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,   -- ✅ Matches
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,   -- ✅ Matches
  deleted_at DATETIME                              -- ✅ Matches
);
```

**Missing:** `deleted_by`, `last_edited_at`, `last_edited_by`, `author_id`

---

## Schema Source Analysis

### Source 1: pool.ts (lines 454-658)
- Defines MINIMAL schema
- Has `deleted_at` but NOT `deleted_by`
- Has `user_id` NOT `author_id`
- NO edit tracking columns

### Source 2: init-forums-db.js (lines 197-341)
- Defines EXTENDED schema
- Has many extra columns (username, user_display_name, moderation fields)
- NO `deleted_at` or `deleted_by` columns
- Has edit tracking (`last_edited_at`, `last_edited_by`)
- Has moderation tracking (`moderated_at`, `moderated_by`, `moderation_reason`)

### Source 3: add-forums-soft-delete.js
- Migration script to add soft delete
- Adds ONLY `deleted_at` to both tables
- Adds `deleted_by` to both tables
- BUT script was run partially or not at all (deleted_by missing)

### Source 4: TypeScript types.ts
- Expects FULL feature set
- Assumes `author_id` (not `user_id`)
- Assumes `deleted_by` exists
- Assumes edit tracking exists

**Result:** Current database is a HYBRID of all sources, missing critical columns.

---

## Recommended Fix

### Option: Pragmatic Hybrid (Recommended)

**Step 1:** Run migration to add missing columns
```bash
cd /home/user/Projects/web/veritable-games-main/frontend
node scripts/fix-forum-schema-mismatches.js
```

This will add:
- `deleted_by` (CRITICAL for soft delete attribution)
- `last_edited_at` (for edit history)
- `last_edited_by` (for edit attribution)
- `author_id` (copy of `user_id` for TS compatibility)

**Step 2:** Update TypeScript interfaces to accept both naming conventions
```typescript
// Add this to ForumTopic and ForumReply interfaces
interface ForumTopic {
  readonly user_id: UserId;      // Database column
  readonly author_id: UserId;    // Alias for consistency
  // ... rest of properties
}
```

**Step 3:** Update all repository queries to use `user_id` internally

---

## SQL Migration Script

The migration script is ready to run at:
```
/home/user/Projects/web/veritable-games-main/frontend/scripts/fix-forum-schema-mismatches.js
```

### Dry Run (Safe Preview)
```bash
node scripts/fix-forum-schema-mismatches.js --dry-run
```

### Apply Changes
```bash
node scripts/fix-forum-schema-mismatches.js
```

### What it does:
1. Adds `deleted_by INTEGER DEFAULT NULL` to forum_topics
2. Adds `deleted_by INTEGER DEFAULT NULL` to forum_replies
3. Adds `last_edited_at DATETIME DEFAULT NULL` to forum_topics
4. Adds `last_edited_at DATETIME DEFAULT NULL` to forum_replies
5. Adds `last_edited_by INTEGER DEFAULT NULL` to forum_topics
6. Adds `last_edited_by INTEGER DEFAULT NULL` to forum_replies
7. Adds `author_id INTEGER` to forum_topics
8. Adds `author_id INTEGER` to forum_replies
9. Copies `user_id` to `author_id` for all existing rows

---

## Impact Assessment

### Code That Will Break (Before Fix)
```typescript
// ❌ FAILS - deleted_by doesn't exist
const topic = await db.prepare('SELECT * FROM forum_topics WHERE id = ?').get(id);
console.log(topic.deleted_by); // undefined, causes errors

// ❌ FAILS - author_id doesn't exist
const reply = await db.prepare('SELECT * FROM forum_replies WHERE id = ?').get(id);
console.log(reply.author_id); // undefined, causes errors

// ❌ FAILS - last_edited_at doesn't exist
const editTime = topic.last_edited_at; // undefined
```

### Code That Will Work (After Fix)
```typescript
// ✅ WORKS - all columns exist
const topic = await db.prepare('SELECT * FROM forum_topics WHERE id = ?').get(id);
console.log(topic.deleted_by);    // null or number
console.log(topic.author_id);     // matches user_id
console.log(topic.last_edited_at); // null or ISO string
```

---

## Prevention Measures

### 1. Single Source of Truth
Keep schema definition in ONE place only. Recommend consolidating into `pool.ts` and removing `init-forums-db.js`.

### 2. Automated Schema Validation Tests
```javascript
// Add to test suite
describe('Schema Integrity', () => {
  test('ForumTopic matches database schema', () => {
    const dbColumns = getTableColumns('forum_topics');
    const tsProperties = getInterfaceProperties('ForumTopic');
    expect(dbColumns).toIncludeAllOf(tsProperties);
  });
});
```

### 3. Migration Versioning
Use a proper migration system:
- Track applied migrations in a `schema_migrations` table
- Version each migration (001_initial.sql, 002_add_soft_delete.sql, etc.)
- Never modify past migrations, only add new ones

---

## Files Affected

### Schema Definition Files
- ✅ `/home/user/Projects/web/veritable-games-main/frontend/src/lib/database/pool.ts` (lines 454-658)
- ✅ `/home/user/Projects/web/veritable-games-main/frontend/scripts/init-forums-db.js` (lines 197-341)
- ✅ `/home/user/Projects/web/veritable-games-main/frontend/scripts/add-forums-soft-delete.js` (entire file)

### Type Definition Files
- ✅ `/home/user/Projects/web/veritable-games-main/frontend/src/lib/forums/types.ts` (lines 96-229)

### Migration Scripts
- ✅ `/home/user/Projects/web/veritable-games-main/frontend/scripts/fix-forum-schema-mismatches.js` (NEW - created by this analysis)

### Repository Files (Will Need Updates)
- `/home/user/Projects/web/veritable-games-main/frontend/src/lib/forums/repositories/topic-repository.ts`
- `/home/user/Projects/web/veritable-games-main/frontend/src/lib/forums/repositories/reply-repository.ts`
- `/home/user/Projects/web/veritable-games-main/frontend/src/lib/forums/repositories/category-repository.ts`

### API Route Files (Will Need Updates)
- `/home/user/Projects/web/veritable-games-main/frontend/src/app/api/forums/topics/[id]/route.ts`
- `/home/user/Projects/web/veritable-games-main/frontend/src/app/api/forums/replies/[id]/route.ts`

---

## Next Steps

### Immediate (Production Hotfix)
1. ✅ Review dry-run output: `node scripts/fix-forum-schema-mismatches.js --dry-run`
2. ✅ Apply migration: `node scripts/fix-forum-schema-mismatches.js`
3. ✅ Verify changes: `node scripts/inspect-forum-schema.js`

### Short-term (Next Sprint)
4. Update all repository queries to use `user_id` internally (while mapping to `author_id` in return types)
5. Implement edit tracking in update endpoints
6. Add soft delete attribution to delete endpoints

### Long-term (Technical Debt)
7. Consolidate schema definitions (remove redundancy)
8. Add automated schema validation tests
9. Implement proper migration versioning system
10. Generate TypeScript types from schema automatically

---

## Conclusion

**Root Cause:** Schema drift across three different definition sources (pool.ts, init-forums-db.js, TypeScript types)

**Critical Impact:** Missing columns cause production errors and incomplete features

**Solution:** Run migration script to add missing columns, then gradually align naming and consolidate definitions

**Priority:** **HIGH** - Blocking production errors occurring

**Estimated Fix Time:** 5 minutes (migration) + 2 hours (code updates) + 1 hour (testing)
