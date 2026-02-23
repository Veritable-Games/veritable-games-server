# Phase 6: Search and Filtering Updates - Summary

## Overview

Updated the forum search and filtering system to support all four status bit
flags (`is_locked`, `is_pinned`, `is_solved`, `is_archived`) in the FTS5
(Full-Text Search) index.

## Changes Made

### 1. FTS Table Schema Update

**Before:**

```sql
CREATE VIRTUAL TABLE forum_search_fts USING fts5(
  content_id UNINDEXED,
  content_type UNINDEXED,
  title,
  content,
  author_username,
  category_name,
  category_id UNINDEXED,
  created_at UNINDEXED,
  vote_score UNINDEXED,
  topic_id UNINDEXED,
  is_locked UNINDEXED,    -- ✓ Had this
  is_pinned UNINDEXED,    -- ✓ Had this
  -- ❌ Missing is_solved and is_archived
  tokenize='porter unicode61 remove_diacritics 2'
);
```

**After:**

```sql
CREATE VIRTUAL TABLE forum_search_fts USING fts5(
  content_id UNINDEXED,
  content_type UNINDEXED,
  title,
  content,
  author_username,
  category_name,
  category_id UNINDEXED,
  created_at UNINDEXED,
  vote_score UNINDEXED,
  topic_id UNINDEXED,
  is_locked UNINDEXED,      -- ✓ Existing
  is_pinned UNINDEXED,      -- ✓ Existing
  is_solved UNINDEXED,      -- ✅ Added
  is_archived UNINDEXED,    -- ✅ Added
  tokenize='porter unicode61 remove_diacritics 2'
);
```

### 2. FTS Triggers Updated

All FTS triggers now extract all four status flags from the `status` INTEGER bit
field:

**Topic INSERT/UPDATE Trigger:**

```sql
CREATE TRIGGER forum_fts_topic_insert
AFTER INSERT ON forum_topics
BEGIN
  INSERT INTO forum_search_fts (
    content_id, content_type, title, content, author_username,
    category_name, category_id, created_at, vote_score,
    topic_id, is_locked, is_pinned, is_solved, is_archived
  )
  SELECT
    new.id, 'topic', new.title, new.content,
    'unknown',
    c.name, new.category_id, new.created_at, new.vote_score,
    new.id,
    (new.status & 1) > 0 AS is_locked,    -- Bit 0: LOCKED
    (new.status & 2) > 0 AS is_pinned,    -- Bit 1: PINNED
    (new.status & 4) > 0 AS is_solved,    -- Bit 2: SOLVED
    (new.status & 8) > 0 AS is_archived   -- Bit 3: ARCHIVED
  FROM forum_categories c
  WHERE c.id = new.category_id;
END;
```

**Reply INSERT/UPDATE Trigger:**

```sql
CREATE TRIGGER forum_fts_reply_insert
AFTER INSERT ON forum_replies
BEGIN
  INSERT INTO forum_search_fts (
    content_id, content_type, title, content, author_username,
    category_name, category_id, created_at, vote_score,
    topic_id, is_locked, is_pinned, is_solved, is_archived
  )
  SELECT
    new.id, 'reply', NULL, new.content,
    'unknown',
    c.name, t.category_id, new.created_at, new.vote_score,
    new.topic_id,
    (t.status & 1) > 0 AS is_locked,      -- Inherit from parent topic
    (t.status & 2) > 0 AS is_pinned,
    (t.status & 4) > 0 AS is_solved,
    (t.status & 8) > 0 AS is_archived
  FROM forum_topics t
  LEFT JOIN forum_categories c ON t.category_id = c.id
  WHERE t.id = new.topic_id;
END;
```

### 3. Search Repository Updates

**File:** `src/lib/forums/repositories/search-repository.ts`

**TypeScript Interface:**

```typescript
interface FTS5SearchResult {
  content_id: number;
  content_type: 'topic' | 'reply';
  title: string | null;
  content: string;
  author_username: string;
  category_name: string;
  category_id: number;
  created_at: string;
  vote_score: number;
  topic_id: number;
  is_locked: number;
  is_pinned: number;
  is_solved: number; // ✅ Added
  is_archived: number; // ✅ Added
  rank: number;
}
```

**SELECT Queries Updated:** All search queries now include the new columns:

```sql
SELECT
  content_id,
  content_type,
  title,
  content,
  author_username,
  category_name,
  category_id,
  created_at,
  vote_score,
  topic_id,
  is_locked,
  is_pinned,
  is_solved,      -- ✅ Added
  is_archived,    -- ✅ Added
  rank
FROM forum_search_fts
WHERE forum_search_fts MATCH ?
ORDER BY rank ASC
LIMIT ? OFFSET ?
```

**Result Transformation:**

```typescript
private transformSearchResult(row: FTS5SearchResult, query: string): SearchResultDTO {
  if (row.content_type === 'topic') {
    return {
      type: 'topic',
      topic: {
        // ... other fields
        is_pinned: Boolean(row.is_pinned),
        is_locked: Boolean(row.is_locked),
        is_solved: Boolean(row.is_solved),      // ✅ Added
        is_archived: Boolean(row.is_archived),  // ✅ Added
      },
      rank: row.rank,
      excerpt,
    };
  }
}
```

### 4. Migration Script

**File:** `scripts/migrations/update-fts-for-all-status-flags.js`

**What it does:**

1. Drops existing FTS table and triggers
2. Creates new FTS table with `is_solved` and `is_archived` columns
3. Recreates all 6 triggers with bit flag extraction
4. Rebuilds FTS index from existing topics and replies
5. Verifies migration success

**Run:**

```bash
cd frontend
node scripts/migrations/update-fts-for-all-status-flags.js
```

**Output:**

```
✅ FTS table created with 4 status columns
✓ Topic INSERT trigger created
✓ Topic UPDATE trigger created
✓ Topic DELETE trigger created
✓ Reply INSERT trigger created
✓ Reply UPDATE trigger created
✓ Reply DELETE trigger created
✓ Indexed 20 topics
✓ Indexed 18 replies
✅ Migration completed successfully!
```

## Bit Flag Mapping

The FTS triggers extract boolean values from the `status` INTEGER field using
bitwise operations:

| Flag          | Bit Position | Bitmask  | SQL Expression     | Description                  |
| ------------- | ------------ | -------- | ------------------ | ---------------------------- |
| `is_locked`   | 0            | 1 (0x01) | `(status & 1) > 0` | Topic cannot be replied to   |
| `is_pinned`   | 1            | 2 (0x02) | `(status & 2) > 0` | Topic appears at top of list |
| `is_solved`   | 2            | 4 (0x04) | `(status & 4) > 0` | Topic has accepted solution  |
| `is_archived` | 3            | 8 (0x08) | `(status & 8) > 0` | Topic is archived            |

## Search Functionality

### Current Features

1. **Full-Text Search** - Search across topic titles, content, and reply content
2. **Category Filtering** - Filter results by category ID
3. **Sorting** - Sort by relevance, date, or votes
4. **Status Fields** - All four status flags are indexed and returned in search
   results

### Future Enhancements (Not Yet Implemented)

These could be added in the future:

1. **Status Filtering in Search UI**

```typescript
// Example: Add status filters to search interface
const [filters, setFilters] = useState({
  showLocked: true,
  showUnlocked: true,
  showPinned: true,
  showSolved: true,
  showUnsolved: true,
  showArchived: false, // Default: hide archived
});
```

2. **Advanced Search with WHERE Clauses**

```sql
SELECT * FROM forum_search_fts
WHERE forum_search_fts MATCH ?
  AND is_archived = 0     -- Exclude archived
  AND is_locked = 0       -- Only unlocked topics
  AND is_solved = 1       -- Only solved topics
ORDER BY rank ASC;
```

3. **Search Repository Enhancement**

```typescript
// Add to SearchRepository
searchTopics(query: string, options: {
  includeArchived?: boolean;
  includeLocked?: boolean;
  onlySolved?: boolean;
  onlyPinned?: boolean;
}): Result<PaginatedResponse<SearchResultDTO>, RepositoryError> {
  // Build WHERE clause based on filters
  const conditions = [];
  if (!options.includeArchived) conditions.push('is_archived = 0');
  if (!options.includeLocked) conditions.push('is_locked = 0');
  if (options.onlySolved) conditions.push('is_solved = 1');
  if (options.onlyPinned) conditions.push('is_pinned = 1');

  // ... execute query with conditions
}
```

## Verification

### Check FTS Schema

```bash
sqlite3 data/forums.db ".schema forum_search_fts"
```

### Check FTS Triggers

```bash
node -e "const Database = require('better-sqlite3'); const db = new Database('./data/forums.db', { readonly: true }); const triggers = db.prepare(\"SELECT name, sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'forum_fts_%'\").all(); console.log(JSON.stringify(triggers, null, 2)); db.close();"
```

### Test Search with Status Fields

```bash
node -e "const Database = require('better-sqlite3'); const db = new Database('./data/forums.db', { readonly: true }); const results = db.prepare('SELECT content_id, content_type, title, is_locked, is_pinned, is_solved, is_archived FROM forum_search_fts LIMIT 5').all(); console.log(JSON.stringify(results, null, 2)); db.close();"
```

## Files Modified

1. `src/lib/forums/repositories/search-repository.ts` - Updated FTS5SearchResult
   interface and SELECT queries
2. `data/forums.db` - Updated FTS table schema and triggers (via migration
   script)

## Files Created

1. `scripts/migrations/update-fts-for-all-status-flags.js` - Migration script
2. `docs/forums/PHASE_6_SEARCH_FILTERING_SUMMARY.md` - This documentation

## Impact

### ✅ Benefits

1. **Complete Status Tracking** - All four status flags are now indexed and
   searchable
2. **Future-Proof** - Ready for advanced filtering features when needed
3. **Consistent Data** - FTS index automatically stays in sync with topics table
   via triggers
4. **No Breaking Changes** - Existing search functionality continues to work as
   before
5. **Better Search Results** - Search results include complete topic status
   information

### ⚠️ Considerations

1. **Index Size** - FTS index is slightly larger (2 extra columns per row)
2. **Migration Required** - One-time migration needed to update existing
   databases
3. **Trigger Complexity** - Bit flag extraction adds minimal overhead to
   INSERT/UPDATE operations

## Testing Recommendations

See [PHASE_7_TESTING_VALIDATION.md](./PHASE_7_TESTING_VALIDATION.md) for
comprehensive testing guide.

## Related Documentation

- [Status Bit Flags](./STATUS_FLAGS.md) - Complete bit flag system documentation
- [SSE Events Reference](./SSE_EVENTS.md) - Real-time event system
- [Optimistic UI Integration](./OPTIMISTIC_UI_INTEGRATION.md) - Instant feedback
  system
- [Search Repository](../../src/lib/forums/repositories/search-repository.ts) -
  Search implementation

## Summary

Phase 6 successfully updated the FTS system to support all four status bit
flags. The search system now properly indexes `is_locked`, `is_pinned`,
`is_solved`, and `is_archived` for both topics and replies. This provides a
foundation for future advanced filtering features while maintaining backward
compatibility with existing search functionality.
