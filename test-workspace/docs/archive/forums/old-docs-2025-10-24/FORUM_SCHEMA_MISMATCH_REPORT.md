# Forum Database Schema Mismatch Report

**Generated:** 2025-10-12
**Purpose:** Comprehensive comparison of TypeScript interfaces vs actual database schema

---

## Executive Summary

**CRITICAL MISMATCHES FOUND:** Multiple columns expected by TypeScript interfaces are missing from the database schema, causing production errors.

### Root Causes
1. **Schema Initialization Scripts** (`init-forums-db.js`, `pool.ts`) define DIFFERENT schemas
2. **Migration Scripts** (`add-forums-soft-delete.js`) added some columns but not all
3. **TypeScript Interfaces** expect the FULL schema from documentation

### Impact
- Missing columns cause SQL errors: "no such column: deleted_by", "no such column: author_id", etc.
- Application cannot query for joined data (author, category info)
- Soft delete functionality incomplete

---

## 1. ForumCategory Interface vs Schema

### TypeScript Interface (`types.ts` lines 96-119)

```typescript
interface ForumCategory {
  readonly id: CategoryId;              // ✅ EXISTS
  readonly slug: string;                // ✅ EXISTS
  readonly name: string;                // ✅ EXISTS
  readonly description: string | null;  // ✅ EXISTS
  readonly color: string;               // ✅ EXISTS
  readonly sort_order: number;          // ✅ EXISTS
  readonly topic_count: number;         // ✅ EXISTS
  readonly post_count: number;          // ✅ EXISTS
  readonly last_post_at: string | null; // ✅ EXISTS
  readonly created_at: string;          // ✅ EXISTS
  readonly updated_at: string;          // ✅ EXISTS
}
```

### Actual Database Schema (`forum_categories`)

```sql
CREATE TABLE forum_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,        -- ✅ MATCHES
  slug TEXT NOT NULL UNIQUE,                   -- ✅ MATCHES
  name TEXT NOT NULL,                          -- ✅ MATCHES
  description TEXT,                            -- ✅ MATCHES
  color TEXT,                                  -- ✅ MATCHES
  sort_order INTEGER DEFAULT 0,                -- ✅ MATCHES
  topic_count INTEGER DEFAULT 0,               -- ✅ MATCHES
  post_count INTEGER DEFAULT 0,                -- ✅ MATCHES (same as reply_count)
  last_post_at DATETIME,                       -- ✅ MATCHES
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- ✅ MATCHES
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP  -- ✅ MATCHES
);
```

### ✅ Status: **COMPLETE MATCH**

No missing columns for categories.

---

## 2. ForumTopic Interface vs Schema

### TypeScript Interface (`types.ts` lines 127-178)

```typescript
interface ForumTopic {
  // Core fields
  readonly id: TopicId;                    // ✅ EXISTS
  readonly title: string;                  // ✅ EXISTS
  readonly content: string;                // ✅ EXISTS
  readonly content_format: ContentFormat;  // ✅ EXISTS
  readonly category_id: CategoryId;        // ✅ EXISTS
  readonly author_id: UserId;              // ❌ MISSING (expects 'author_id', DB has 'user_id')

  // Metrics
  readonly view_count: number;             // ✅ EXISTS
  readonly reply_count: number;            // ✅ EXISTS

  // Status flags
  readonly is_pinned: boolean;             // ✅ EXISTS
  readonly is_locked: boolean;             // ✅ EXISTS
  readonly is_solved: boolean;             // ✅ EXISTS
  readonly status: TopicStatus;            // ✅ EXISTS

  // Timestamps
  readonly created_at: string;             // ✅ EXISTS
  readonly updated_at: string;             // ✅ EXISTS
  readonly last_activity_at: string;       // ✅ EXISTS

  // Soft delete tracking
  readonly deleted_at: string | null;      // ✅ EXISTS
  readonly deleted_by: UserId | null;      // ❌ MISSING

  // Edit tracking
  readonly last_edited_at: string | null;  // ❌ MISSING
  readonly last_edited_by: UserId | null;  // ❌ MISSING

  // Joined data (optional)
  readonly author?: ForumUser;             // ❌ Cannot populate (no author data in DB)
  readonly category?: ForumCategory;       // ⚠️ Can populate via JOIN
  readonly tags?: readonly ForumTag[];     // ❌ No tag support (table doesn't exist in DB)
}
```

### Actual Database Schema (`forum_topics`)

```sql
CREATE TABLE forum_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,                     -- ✅ MATCHES
  user_id INTEGER,                         -- ⚠️ TypeScript expects 'author_id'
  title TEXT NOT NULL,                     -- ✅ MATCHES
  content TEXT NOT NULL,                   -- ✅ MATCHES
  content_format TEXT DEFAULT 'markdown',  -- ✅ MATCHES
  is_locked INTEGER DEFAULT 0,             -- ✅ MATCHES
  is_pinned INTEGER DEFAULT 0,             -- ✅ MATCHES
  is_solved INTEGER DEFAULT 0,             -- ✅ MATCHES
  status TEXT DEFAULT 'open',              -- ✅ MATCHES
  vote_score INTEGER DEFAULT 0,            -- ✅ MATCHES
  reply_count INTEGER DEFAULT 0,           -- ✅ MATCHES
  view_count INTEGER DEFAULT 0,            -- ✅ MATCHES
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,    -- ✅ MATCHES
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,    -- ✅ MATCHES
  last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- ✅ MATCHES
  deleted_at DATETIME                      -- ✅ MATCHES (added by migration)
);
```

### ❌ Status: **CRITICAL MISMATCHES**

#### Missing Columns (4):
1. **`deleted_by`** - User who deleted the topic (NULL if not deleted)
2. **`last_edited_at`** - Last edit timestamp (NULL if never edited)
3. **`last_edited_by`** - User who made last edit (NULL if never edited)
4. **Author data columns** - TypeScript expects `author_id`, DB has `user_id`

#### Naming Mismatch:
- TypeScript: `author_id: UserId`
- Database: `user_id INTEGER`
- **Impact:** All queries must use `user_id` but TypeScript types expect `author_id`

---

## 3. ForumReply Interface vs Schema

### TypeScript Interface (`types.ts` lines 186-229)

```typescript
interface ForumReply {
  // Core fields
  readonly id: ReplyId;                    // ✅ EXISTS
  readonly topic_id: TopicId;              // ✅ EXISTS
  readonly parent_id: ReplyId | null;      // ✅ EXISTS
  readonly author_id: UserId;              // ❌ MISSING (expects 'author_id', DB has 'user_id')
  readonly content: string;                // ✅ EXISTS
  readonly content_format: ContentFormat;  // ✅ EXISTS

  // Nesting metadata
  readonly reply_depth: number;            // ✅ EXISTS
  readonly path: string;                   // ✅ EXISTS

  // Status
  readonly is_solution: boolean;           // ✅ EXISTS

  // Timestamps
  readonly created_at: string;             // ✅ EXISTS
  readonly updated_at: string;             // ✅ EXISTS

  // Soft delete tracking
  readonly deleted_at: string | null;      // ✅ EXISTS
  readonly deleted_by: UserId | null;      // ❌ MISSING

  // Edit tracking
  readonly last_edited_at: string | null;  // ❌ MISSING
  readonly last_edited_by: UserId | null;  // ❌ MISSING

  // Joined data (optional)
  readonly author?: ForumUser;             // ❌ Cannot populate (no author data in DB)
  readonly parent?: ForumReply;            // ⚠️ Can populate via JOIN
  readonly children?: readonly ForumReply[]; // ⚠️ Can populate via JOIN
}
```

### Actual Database Schema (`forum_replies`)

```sql
CREATE TABLE forum_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,               -- ✅ MATCHES
  parent_id INTEGER,                       -- ✅ MATCHES
  user_id INTEGER NOT NULL,                -- ⚠️ TypeScript expects 'author_id'
  content TEXT NOT NULL,                   -- ✅ MATCHES
  content_format TEXT DEFAULT 'markdown',  -- ✅ MATCHES
  reply_depth INTEGER DEFAULT 0,           -- ✅ MATCHES
  path TEXT DEFAULT '',                    -- ✅ MATCHES
  is_solution INTEGER DEFAULT 0,           -- ✅ MATCHES
  vote_score INTEGER DEFAULT 0,            -- ✅ MATCHES
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- ✅ MATCHES
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- ✅ MATCHES
  deleted_at DATETIME                      -- ✅ MATCHES (added by migration)
);
```

### ❌ Status: **CRITICAL MISMATCHES**

#### Missing Columns (3):
1. **`deleted_by`** - User who deleted the reply (NULL if not deleted)
2. **`last_edited_at`** - Last edit timestamp (NULL if never edited)
3. **`last_edited_by`** - User who made last edit (NULL if never edited)

#### Naming Mismatch:
- TypeScript: `author_id: UserId`
- Database: `user_id INTEGER`
- **Impact:** All queries must use `user_id` but TypeScript types expect `author_id`

---

## 4. Schema Inconsistencies Across Files

### Schema Source 1: `pool.ts` (lines 454-658)

```sql
-- forum_topics in pool.ts
CREATE TABLE IF NOT EXISTS forum_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  user_id INTEGER,
  -- ... basic columns only ...
  deleted_at DATETIME  -- ✅ Has soft delete column
);
```

### Schema Source 2: `init-forums-db.js` (lines 197-341)

```sql
-- forum_topics in init-forums-db.js
CREATE TABLE IF NOT EXISTS forum_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  -- ... EXTENDED columns including: ...
  username TEXT,              -- ❌ Not in pool.ts or actual DB
  user_display_name TEXT,     -- ❌ Not in pool.ts or actual DB
  last_reply_at DATETIME,     -- ❌ Not in pool.ts or actual DB
  last_reply_user_id INTEGER, -- ❌ Not in pool.ts or actual DB
  last_reply_username TEXT,   -- ❌ Not in pool.ts or actual DB
  last_edited_at DATETIME,    -- ❌ Not in pool.ts or actual DB
  last_edited_by INTEGER,     -- ❌ Not in pool.ts or actual DB
  moderated_at DATETIME,      -- ❌ Not in pool.ts or actual DB
  moderated_by INTEGER,       -- ❌ Not in pool.ts or actual DB
  moderation_reason TEXT      -- ❌ Not in pool.ts or actual DB
  -- NO deleted_at column!   -- ❌ Missing soft delete
);
```

### Schema Source 3: `add-forums-soft-delete.js`

```sql
-- Migration adds:
ALTER TABLE forum_topics ADD COLUMN deleted_at DATETIME DEFAULT NULL;
ALTER TABLE forum_topics ADD COLUMN deleted_by INTEGER DEFAULT NULL;
ALTER TABLE forum_replies ADD COLUMN deleted_at DATETIME DEFAULT NULL;
ALTER TABLE forum_replies ADD COLUMN deleted_by INTEGER DEFAULT NULL;
```

### ⚠️ Problem: Three Different Schema Definitions

1. **`pool.ts`** defines a MINIMAL schema with `deleted_at` but no edit tracking
2. **`init-forums-db.js`** defines an EXTENDED schema WITHOUT soft delete columns
3. **`add-forums-soft-delete.js`** adds soft delete columns BUT only `deleted_at`, not `deleted_by`

**Current Database State:** Hybrid of all three, missing several columns from each.

---

## 5. Recommended Fixes

### Option A: Align Database with TypeScript (RECOMMENDED)

Add the missing columns to match TypeScript interfaces:

```sql
-- For forum_topics
ALTER TABLE forum_topics ADD COLUMN deleted_by INTEGER DEFAULT NULL;
ALTER TABLE forum_topics ADD COLUMN last_edited_at DATETIME DEFAULT NULL;
ALTER TABLE forum_topics ADD COLUMN last_edited_by INTEGER DEFAULT NULL;
ALTER TABLE forum_topics ADD COLUMN author_id INTEGER; -- Then copy from user_id

-- For forum_replies
ALTER TABLE forum_replies ADD COLUMN deleted_by INTEGER DEFAULT NULL;
ALTER TABLE forum_replies ADD COLUMN last_edited_at DATETIME DEFAULT NULL;
ALTER TABLE forum_replies ADD COLUMN last_edited_by INTEGER DEFAULT NULL;
ALTER TABLE forum_replies ADD COLUMN author_id INTEGER; -- Then copy from user_id

-- Copy user_id to author_id for consistency
UPDATE forum_topics SET author_id = user_id WHERE author_id IS NULL;
UPDATE forum_replies SET author_id = user_id WHERE author_id IS NULL;
```

**Pros:**
- TypeScript code works without changes
- Full feature support (edit tracking, soft delete attribution)
- Future-proof for auditing

**Cons:**
- Requires migration script
- Duplicate column (`user_id` and `author_id`)

### Option B: Align TypeScript with Database

Update TypeScript interfaces to match current database:

```typescript
// Change in types.ts
interface ForumTopic {
  readonly user_id: UserId;  // Changed from author_id
  // Remove:
  // readonly deleted_by: UserId | null;
  // readonly last_edited_at: string | null;
  // readonly last_edited_by: UserId | null;
}

interface ForumReply {
  readonly user_id: UserId;  // Changed from author_id
  // Remove:
  // readonly deleted_by: UserId | null;
  // readonly last_edited_at: string | null;
  // readonly last_edited_by: UserId | null;
}
```

**Pros:**
- No database changes needed
- Matches current reality

**Cons:**
- Loses edit tracking metadata
- Loses soft delete attribution (can't track WHO deleted)
- Breaks existing code that uses `author_id`

### Option C: Hybrid Approach (PRAGMATIC)

1. **Add critical missing columns:**
   ```sql
   ALTER TABLE forum_topics ADD COLUMN deleted_by INTEGER DEFAULT NULL;
   ALTER TABLE forum_replies ADD COLUMN deleted_by INTEGER DEFAULT NULL;
   ```

2. **Update TypeScript to use `user_id` instead of `author_id`:**
   ```typescript
   interface ForumTopic {
     readonly user_id: UserId;  // Changed from author_id
     readonly deleted_by: UserId | null;  // Keep this
     // Remove edit tracking for now
   }
   ```

3. **Add edit tracking columns later** when needed

**Pros:**
- Minimal changes
- Fixes immediate production errors
- Edit tracking deferred until actually needed

**Cons:**
- Still loses edit tracking
- Naming inconsistency (`user_id` vs `author_id` convention)

---

## 6. Migration Script (Option A - Full Fix)

```javascript
#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'forums.db');

console.log('Aligning forum database with TypeScript interfaces...');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const migrate = db.transaction(() => {
  // Check existing columns
  const topicsColumns = db.prepare("PRAGMA table_info(forum_topics)").all();
  const repliesColumns = db.prepare("PRAGMA table_info(forum_replies)").all();

  const topicColumnNames = topicsColumns.map(c => c.name);
  const replyColumnNames = repliesColumns.map(c => c.name);

  // Add missing columns to forum_topics
  if (!topicColumnNames.includes('deleted_by')) {
    console.log('Adding deleted_by to forum_topics...');
    db.prepare('ALTER TABLE forum_topics ADD COLUMN deleted_by INTEGER DEFAULT NULL').run();
  }

  if (!topicColumnNames.includes('last_edited_at')) {
    console.log('Adding last_edited_at to forum_topics...');
    db.prepare('ALTER TABLE forum_topics ADD COLUMN last_edited_at DATETIME DEFAULT NULL').run();
  }

  if (!topicColumnNames.includes('last_edited_by')) {
    console.log('Adding last_edited_by to forum_topics...');
    db.prepare('ALTER TABLE forum_topics ADD COLUMN last_edited_by INTEGER DEFAULT NULL').run();
  }

  if (!topicColumnNames.includes('author_id')) {
    console.log('Adding author_id to forum_topics...');
    db.prepare('ALTER TABLE forum_topics ADD COLUMN author_id INTEGER').run();
    console.log('Copying user_id to author_id...');
    db.prepare('UPDATE forum_topics SET author_id = user_id').run();
  }

  // Add missing columns to forum_replies
  if (!replyColumnNames.includes('deleted_by')) {
    console.log('Adding deleted_by to forum_replies...');
    db.prepare('ALTER TABLE forum_replies ADD COLUMN deleted_by INTEGER DEFAULT NULL').run();
  }

  if (!replyColumnNames.includes('last_edited_at')) {
    console.log('Adding last_edited_at to forum_replies...');
    db.prepare('ALTER TABLE forum_replies ADD COLUMN last_edited_at DATETIME DEFAULT NULL').run();
  }

  if (!replyColumnNames.includes('last_edited_by')) {
    console.log('Adding last_edited_by to forum_replies...');
    db.prepare('ALTER TABLE forum_replies ADD COLUMN last_edited_by INTEGER DEFAULT NULL').run();
  }

  if (!replyColumnNames.includes('author_id')) {
    console.log('Adding author_id to forum_replies...');
    db.prepare('ALTER TABLE forum_replies ADD COLUMN author_id INTEGER').run();
    console.log('Copying user_id to author_id...');
    db.prepare('UPDATE forum_replies SET author_id = user_id').run();
  }
});

migrate();
db.close();

console.log('✅ Migration completed successfully!');
```

---

## 7. Summary Table

| Column | TypeScript Expects | Database Has | Status | Fix Required |
|--------|-------------------|--------------|--------|--------------|
| **forum_topics** | | | | |
| `id` | ✅ TopicId | ✅ INTEGER PK | ✅ Match | None |
| `category_id` | ✅ CategoryId | ✅ INTEGER | ✅ Match | None |
| `author_id` | ✅ UserId | ❌ Missing | ❌ Mismatch | Add column or rename in TS |
| `user_id` | ❌ Not in interface | ✅ INTEGER | ⚠️ Extra | Keep (used by DB) |
| `deleted_by` | ✅ UserId \| null | ❌ Missing | ❌ Critical | **ADD COLUMN** |
| `last_edited_at` | ✅ string \| null | ❌ Missing | ⚠️ Feature loss | ADD COLUMN |
| `last_edited_by` | ✅ UserId \| null | ❌ Missing | ⚠️ Feature loss | ADD COLUMN |
| **forum_replies** | | | | |
| `id` | ✅ ReplyId | ✅ INTEGER PK | ✅ Match | None |
| `topic_id` | ✅ TopicId | ✅ INTEGER | ✅ Match | None |
| `author_id` | ✅ UserId | ❌ Missing | ❌ Mismatch | Add column or rename in TS |
| `user_id` | ❌ Not in interface | ✅ INTEGER | ⚠️ Extra | Keep (used by DB) |
| `deleted_by` | ✅ UserId \| null | ❌ Missing | ❌ Critical | **ADD COLUMN** |
| `last_edited_at` | ✅ string \| null | ❌ Missing | ⚠️ Feature loss | ADD COLUMN |
| `last_edited_by` | ✅ UserId \| null | ❌ Missing | ⚠️ Feature loss | ADD COLUMN |

---

## 8. Impact on Existing Code

### Queries That Will Fail

1. **Soft Delete Attribution:**
   ```typescript
   // ❌ FAILS - deleted_by doesn't exist
   const deletedBy = row.deleted_by;
   ```

2. **Edit Tracking:**
   ```typescript
   // ❌ FAILS - last_edited_at doesn't exist
   const lastEdit = row.last_edited_at;
   ```

3. **Author Access:**
   ```typescript
   // ❌ FAILS - author_id doesn't exist
   const authorId = row.author_id;

   // ✅ WORKS - user_id exists
   const userId = row.user_id;
   ```

### Code Locations to Update

Search for these patterns:
```bash
# Find author_id usage
grep -r "author_id" frontend/src/lib/forums/
grep -r "author_id" frontend/src/app/api/forums/

# Find deleted_by usage
grep -r "deleted_by" frontend/src/lib/forums/
grep -r "deleted_by" frontend/src/app/api/forums/

# Find edit tracking usage
grep -r "last_edited_at" frontend/src/lib/forums/
grep -r "last_edited_by" frontend/src/lib/forums/
```

---

## 9. Recommended Action Plan

### Immediate (Production Hotfix)
1. ✅ **Add `deleted_by` columns** (prevents errors when tracking deletions)
   ```sql
   ALTER TABLE forum_topics ADD COLUMN deleted_by INTEGER DEFAULT NULL;
   ALTER TABLE forum_replies ADD COLUMN deleted_by INTEGER DEFAULT NULL;
   ```

2. ✅ **Update all queries to use `user_id` instead of `author_id`**
   - Find: `row.author_id`
   - Replace: `row.user_id`
   - Update type mappings

### Short-term (Next Release)
3. ✅ **Add edit tracking columns** (enables audit trail)
   ```sql
   ALTER TABLE forum_topics ADD COLUMN last_edited_at DATETIME DEFAULT NULL;
   ALTER TABLE forum_topics ADD COLUMN last_edited_by INTEGER DEFAULT NULL;
   ALTER TABLE forum_replies ADD COLUMN last_edited_at DATETIME DEFAULT NULL;
   ALTER TABLE forum_replies ADD COLUMN last_edited_by INTEGER DEFAULT NULL;
   ```

4. ✅ **Implement edit tracking in update endpoints**

### Long-term (Technical Debt)
5. ✅ **Consolidate schema definitions** - Pick ONE source of truth
   - Option 1: Use `pool.ts` as master, remove `init-forums-db.js`
   - Option 2: Use `init-forums-db.js` as master, update `pool.ts`

6. ✅ **Add schema validation tests** - Prevent drift
   ```javascript
   // Test that TypeScript interfaces match database schema
   test('forum_topics schema matches TypeScript', () => {
     const columns = db.prepare('PRAGMA table_info(forum_topics)').all();
     expect(columns).toMatchTypeScriptInterface(ForumTopic);
   });
   ```

---

## 10. Prevention Measures

### A. Single Source of Truth
- Keep schema definition in ONE place only
- Auto-generate TypeScript types from schema OR vice versa
- Use migration versioning (Prisma, Drizzle, or custom)

### B. Automated Testing
```javascript
// Add to test suite
describe('Schema Integrity', () => {
  test('TypeScript ForumTopic matches database', () => {
    const schema = getTableSchema('forum_topics');
    const tsInterface = getTypeScriptInterface('ForumTopic');
    expect(schema).toMatchInterface(tsInterface);
  });
});
```

### C. Migration Workflow
1. Update schema in master file (e.g., `schema.sql`)
2. Generate migration script automatically
3. Generate TypeScript types from schema
4. Run tests to verify alignment

---

## Conclusion

**Root Cause:** Multiple schema definitions in `pool.ts`, `init-forums-db.js`, and TypeScript interfaces have diverged over time.

**Critical Issues:**
- ❌ `deleted_by` missing (soft delete attribution broken)
- ❌ `author_id` vs `user_id` naming mismatch
- ⚠️ Edit tracking columns missing (feature incomplete)

**Recommended Fix:** Run migration to add missing columns (Option C - Hybrid Approach), then gradually align naming and add edit tracking.

**Priority:** **HIGH** - Production errors occurring due to missing columns.
