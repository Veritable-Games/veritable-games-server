# Forum `is_solved` Column Fix - Summary

## Problem

Database schema mismatch causing runtime error:
```
Error: "no such column: is_solved"
```

## Root Cause

The forum database schema (`forum_topics` table) does **not** have an `is_solved` column. Instead, it uses a `status` column with three possible values:
- `'open'` - Active, unsolved topic
- `'closed'` - Closed topic
- `'solved'` - Topic has been marked as solved

However, the repository code was attempting to `SELECT is_solved` directly from the database, causing the error.

## Database Schema (Actual)

```sql
CREATE TABLE forum_topics (
  -- ... other columns ...
  status TEXT DEFAULT 'open' NOT NULL CHECK(status IN ('open', 'closed', 'solved')),
  is_pinned INTEGER DEFAULT 0 NOT NULL CHECK(is_pinned IN (0, 1)),
  is_locked INTEGER DEFAULT 0 NOT NULL CHECK(is_locked IN (0, 1)),
  -- ... other columns ...
)
```

**Note:** There is **NO** `is_solved` column in the database.

## TypeScript Types (Correct)

The `ForumTopic` interface correctly includes `is_solved`:

```typescript
export interface ForumTopic {
  // ... other fields ...
  is_solved: boolean;  // ✅ Correct - derived from status
  status: TopicStatus; // 'open' | 'closed' | 'solved'
  // ... other fields ...
}
```

## Solution Implemented

**Strategy:** Map the `status` column to `is_solved` in the repository transformation layer.

### Changes Made

#### 1. Updated `TopicRow` Interface
**File:** `/src/lib/forums/repositories/topic-repository.ts`

```typescript
// ❌ BEFORE
interface TopicRow {
  // ... other fields ...
  is_solved: number;  // Non-existent column
  status: TopicStatus;
}

// ✅ AFTER
interface TopicRow {
  // ... other fields ...
  status: TopicStatus;  // Only status column exists
}
```

#### 2. Removed `is_solved` from SELECT Queries

Updated all SELECT queries in `topic-repository.ts` (5 locations):
- `create()` method
- `findById()` method
- `findByCategory()` method
- `update()` method
- `getRecent()` method

```sql
-- ❌ BEFORE
SELECT
  id,
  title,
  -- ... other columns ...
  is_solved,  -- Non-existent column
  status
FROM forum_topics

-- ✅ AFTER
SELECT
  id,
  title,
  -- ... other columns ...
  status  -- Only status column
FROM forum_topics
```

#### 3. Updated `solved_only` Filter Logic

**File:** `/src/lib/forums/repositories/topic-repository.ts`

```typescript
// ❌ BEFORE
if (solved_only) {
  conditions.push('is_solved = 1');
}

// ✅ AFTER
if (solved_only) {
  conditions.push("status = 'solved'");
}
```

#### 4. Updated `markSolved()` Method

**File:** `/src/lib/forums/repositories/topic-repository.ts`

```typescript
// ❌ BEFORE
db.prepare(
  'UPDATE forum_topics SET is_solved = 1, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
).run('solved', id);

// ✅ AFTER
db.prepare(
  "UPDATE forum_topics SET status = 'solved', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
).run(id);
```

#### 5. Updated `transformTopic()` to Derive `is_solved`

**File:** `/src/lib/forums/repositories/topic-repository.ts`

```typescript
// ❌ BEFORE
private transformTopic(row: TopicRow): ForumTopic {
  return {
    // ... other fields ...
    is_solved: Boolean(row.is_solved),  // Non-existent column
    status: row.status,
  };
}

// ✅ AFTER
private transformTopic(row: TopicRow): ForumTopic {
  return {
    // ... other fields ...
    is_solved: row.status === 'solved',  // Derive from status
    status: row.status,
  };
}
```

#### 6. Fixed Reply Repository

**File:** `/src/lib/forums/repositories/reply-repository.ts`

Updated `markAsSolution()` method to only update `status`:

```typescript
// ❌ BEFORE
db.prepare(
  `UPDATE forum_topics
  SET is_solved = 1, status = 'solved', updated_at = CURRENT_TIMESTAMP
  WHERE id = ?`
).run(reply.topic_id);

// ✅ AFTER
db.prepare(
  `UPDATE forum_topics
  SET status = 'solved', updated_at = CURRENT_TIMESTAMP
  WHERE id = ?`
).run(reply.topic_id);
```

## Files Modified

1. `/src/lib/forums/repositories/topic-repository.ts` - 7 changes
2. `/src/lib/forums/repositories/reply-repository.ts` - 1 change

## Files NOT Modified (Intentional)

### Search Repository
**File:** `/src/lib/forums/repositories/search-repository.ts`

Uses hardcoded defaults `is_solved: false` and `status: 'open'` in search results. This is **acceptable** because:
- FTS5 search table doesn't store these fields
- Service layer enriches results with real data from topics table
- Default values are safe placeholders

### Type Definitions
**File:** `/src/lib/forums/types.ts`

The `ForumTopic` interface already correctly includes `is_solved: boolean`. No changes needed.

### Components
**Files:** `/src/components/forums/*.tsx`

All components correctly use `topic.is_solved` from the TypeScript interface. No changes needed.

## Verification

### Manual Testing
```bash
# Query topics without is_solved column
node -e "
const Database = require('better-sqlite3');
const db = new Database('data/forums.db', { readonly: true });
const topic = db.prepare(\`
  SELECT id, title, status
  FROM forum_topics LIMIT 1
\`).get();
console.log('Topic status:', topic.status);
console.log('Derived is_solved:', topic.status === 'solved');
db.close();
"
```

### Expected Behavior

| Database `status` | Derived `is_solved` |
|-------------------|---------------------|
| `'open'`          | `false`            |
| `'closed'`        | `false`            |
| `'solved'`        | `true`             |

## Migration Notes

**No database migration required.** This fix maps existing database structure to the application's type system without schema changes.

## Related Documentation

- Database schema: `/scripts/init-forums-db.js`
- Type definitions: `/src/lib/forums/types.ts`
- Repository pattern: `/src/lib/forums/repositories/README.md`

## Status

✅ **FIXED** - Schema mismatch resolved by deriving `is_solved` from `status` column.
