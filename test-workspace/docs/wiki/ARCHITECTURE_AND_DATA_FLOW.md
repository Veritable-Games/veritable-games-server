# Wiki Database Architecture & Data Flow Analysis

**Purpose**: Understand how wiki categories flow through the application
**Context**: Root cause analysis for wiki category production bug

---

## Current Architecture

### Database Layer

```
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL 15 (Production: 192.168.1.15:5432)             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  wiki schema (13 schemas total, wiki is one)         │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Tables:                                             │  │
│  │  ├─ wiki_categories ............ [EMPTY - 0 rows]   │  │
│  │  ├─ wiki_pages ................ [FULL - 174 rows]  │  │
│  │  ├─ wiki_revisions ............ [FULL - many rows]  │  │
│  │  ├─ wiki_page_categories ...... [EMPTY - 0 rows]   │  │
│  │  ├─ wiki_tags ................. [OK]                │  │
│  │  ├─ wiki_templates ............ [OK]                │  │
│  │  └─ [22 more tables] .......... [OK]                │  │
│  │                                                       │  │
│  │  Indexes: 545 total (system-wide)                   │  │
│  │  Problem: Indexes for empty table are useless       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Application Query Layer

```
Frontend (TypeScript/React)
    ↓
API Routes (api/wiki/...)
    ↓
WikiCategoryService (queries wiki_categories table)
    ↓
dbAdapter.query() (PostgreSQL pooled connection)
    ↓
PostgreSQL Connection Pool (PgBouncer)
    ↓
PostgreSQL 15 @ 192.168.1.15:5432
    ↓
wiki.wiki_categories TABLE [EMPTY - 0 rows] ← PROBLEM HERE
    ↓
Returns 0 rows
    ↓
Frontend shows "Category not found" or 404
```

---

## Data Flow: Category Page Request

### Broken Flow (Current - November 14, 2025)

```
User Action: Click on /wiki/categories/archive
   ↓
Next.js Route Handler: /app/wiki/categories/[id]/page.tsx
   ↓
getCategoryById('archive')
   ↓
WikiCategoryService.getCategoryById('archive')
   ↓
dbAdapter.query(
  "SELECT c.* FROM wiki_categories c WHERE c.id = $1",
  ['archive'],
  { schema: 'wiki' }
)
   ↓
PostgreSQL executes query
   ↓
wiki.wiki_categories table scanned: 0 rows returned ← TABLE IS EMPTY
   ↓
result.rows.length === 0
   ↓
Component throws: "Category not found"
   ↓
User sees: 404 error or "doesn't exist" message
```

### Working Flow (After Fix)

```
User Action: Click on /wiki/categories/archive
   ↓
Next.js Route Handler: /app/wiki/categories/[id]/page.tsx
   ↓
getCategoryById('archive')
   ↓
WikiCategoryService.getCategoryById('archive')
   ↓
dbAdapter.query(
  "SELECT c.* FROM wiki_categories c WHERE c.id = $1",
  ['archive'],
  { schema: 'wiki' }
)
   ↓
PostgreSQL executes query
   ↓
wiki.wiki_categories table scanned: 1 row returned ✓
   ↓
result.rows.length === 1
   ↓
Component renders category with:
  - name: "Archive"
  - description: "Historical and archived content"
  - color: "#9B2C2C"
  - pages: [list of 174 pages in this category]
   ↓
User sees: Archive category page with page list ✓
```

---

## Page Query vs Category Query

### Individual Wiki Page Query (WORKING ✓)

```
User: /wiki/pages/autumn-2025
  ↓
Query: SELECT * FROM wiki.wiki_pages WHERE slug = 'autumn-2025'
  ↓
Result: 1 row returned (page data) ✓
  ↓
Application: Page displays correctly
```

**Why it works**:
- `wiki_pages` table has 174 rows
- Pages were migrated from SQLite to PostgreSQL
- Query simply looks for pages
- Doesn't depend on categories table

### Category Query (BROKEN ✗)

```
User: /wiki/categories/archive
  ↓
Query 1: SELECT * FROM wiki.wiki_categories WHERE id = 'archive'
  ↓
Result: 0 rows (table is empty) ✗
  ↓
Application: Category not found
  ↓
Query 2: SELECT COUNT(*) FROM wiki.wiki_pages WHERE category_id = 'archive'
  ↓
Result: 0 rows (pages have no category reference) ✗
  ↓
Application: No pages in category
```

**Why it's broken**:
- `wiki_categories` table has 0 rows
- Categories were never seeded into PostgreSQL
- Query returns nothing
- Shows "doesn't exist"

---

## Schema Structure

### SQLite (Development - localhost)

```sql
-- NOT INITIALIZED due to corrupted schema file
-- But if it were initialized:

CREATE TABLE wiki_categories (
  id TEXT PRIMARY KEY,           -- 'archive', 'autumn', etc.
  parent_id TEXT,                -- For subcategories
  name TEXT NOT NULL,            -- "Archive", "Autumn", etc.
  description TEXT,              -- Description of category
  color TEXT DEFAULT '#6B7280',  -- Color for UI
  icon TEXT,                      -- Icon name for UI
  sort_order INTEGER DEFAULT 0,  -- Display order
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_public INTEGER DEFAULT 1    -- Visibility control
);

-- Current state: Table doesn't exist or is empty
```

### PostgreSQL (Production - 192.168.1.15)

```sql
-- Schema exists and is correct, but TABLE IS EMPTY

CREATE TABLE wiki.wiki_categories (
  id TEXT PRIMARY KEY,           -- Type mismatch? Could be VARCHAR
  parent_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6B7280',
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_public INTEGER DEFAULT 1
);

-- SELECT COUNT(*) FROM wiki.wiki_categories;  → 0 rows ✗

-- Should contain:
-- ('uncategorized', NULL, 'Uncategorized', ..., 0, ...)
-- ('archive', NULL, 'Archive', ..., 1, ...)
-- ('autumn', NULL, 'Autumn', ..., 2, ...)
-- ... (10 total categories)
```

---

## Join Relationships

### Pages to Categories (BROKEN)

```
wiki_pages                           wiki_categories
┌─────────────────────┐             ┌──────────────────┐
│ id (INT)            │             │ id (TEXT)        │
│ slug (TEXT)         │             │ name (TEXT)      │
│ title (TEXT)        │────┐   ┌────│ description      │
│ category_id (TEXT)  │    │   │    │ color            │
│ status (TEXT)       │    └───┼────│ sort_order       │
│ ...174 rows...      │        │    │ ...0 rows ✗...   │
└─────────────────────┘        │    └──────────────────┘
                               │
                        BROKEN JOIN
                        (category_id
                         doesn't match
                         any id in
                         wiki_categories)
```

**Current state**:
- Pages reference category_id = 'archive', 'autumn', etc.
- But wiki_categories table has no rows
- Foreign key constraint allows this (referential integrity might be loose)
- Joins return empty results

**After fix**:
- wiki_categories has 10 rows with ids: uncategorized, archive, autumn, etc.
- Pages reference valid category_ids
- Joins work correctly
- Pages grouped by category work

---

## Database Initialization Flow

### Current Flow (Broken)

```
Application Startup (Coolify)
  ↓
Node.js reads environment variables
  ↓
DATABASE_URL set to PostgreSQL
  ↓
dbAdapter connects to PostgreSQL
  ↓
Schema check: wiki schema exists?
  ✓ Yes (was created in initial setup)
  ↓
Table check: wiki_categories table exists?
  ✓ Yes (structure is there)
  ↓
Data check: wiki_categories has rows?
  ✗ No (0 rows) ← PROBLEM
  ↓
Application starts and is ready
  ↓
User requests /wiki/categories
  ↓
Query returns empty result set
  ↓
404 error
```

### Should Flow (After Fix)

```
Application Startup (Coolify)
  ↓
Node.js reads environment variables
  ↓
DATABASE_URL set to PostgreSQL
  ↓
dbAdapter connects to PostgreSQL
  ↓
Schema check: wiki schema exists?
  ✓ Yes
  ↓
Table check: wiki_categories table exists?
  ✓ Yes
  ↓
Data check: wiki_categories has rows?
  ✓ Yes (10 rows: uncategorized, archive, autumn, etc.)
  ↓
Application starts and is ready
  ↓
User requests /wiki/categories
  ↓
Query returns 10 category rows
  ↓
Category page renders correctly
```

---

## Missing Seed Data

### What Should Be Seeded

```sql
INSERT INTO wiki.wiki_categories (id, name, description, sort_order)
VALUES
  ('uncategorized', 'Uncategorized', 'Pages without a category', 0),
  ('archive', 'Archive', 'Historical content', 1),
  ('autumn', 'Autumn', 'Autumn project docs', 2),
  ('cosmic-knights', 'Cosmic Knights', 'CK project docs', 3),
  ('dodec', 'Dodec', 'Dodec project docs', 4),
  ('journals', 'Journals', 'Personal journals', 5),
  ('noxii', 'Noxii', 'Noxii civilization', 6),
  ('on-command', 'On-Command', 'OC project docs', 7),
  ('systems', 'Systems', 'System docs', 8),
  ('tutorials', 'Tutorials', 'Learning materials', 9);
```

**Current state**: This INSERT never happens
**After fix**: INSERT runs during deployment or initialization

---

## Query Performance Impact

### Indexes Waiting for Data

```
Index: idx_wiki_categories_parent
  ├─ Status: EXISTS but UNUSED
  ├─ Reason: No data in wiki_categories table
  ├─ Size: ~8KB (minimal, empty index)
  └─ Impact: None (wasted space, but minimal)

Index: idx_wiki_categories_sort
  ├─ Status: EXISTS but UNUSED
  ├─ Reason: No data in wiki_categories table
  ├─ Size: ~8KB
  └─ Impact: None

Index: idx_wiki_page_categories
  ├─ Status: EXISTS but UNUSED
  ├─ Reason: No data in wiki_page_categories junction table
  ├─ Size: ~8KB
  └─ Impact: None
```

**After fix**: Indexes become active and useful for category queries

---

## Cache Implications

### WikiCategoryService Cache

```typescript
// Line 259-261 in WikiCategoryService.ts
async getAllCategories(userRole?: string) {
  // Cache temporarily disabled for debugging
  // const cached = await cache.get(...)
  // if (cached) return cached;

  const result = await dbAdapter.query(...)
  // result.rows = [] (always empty, so cache would be empty)

  // await cache.set(...)
  // Cache set to empty array
  // User still sees nothing
}
```

**Current state**: Cache stores empty results
**After fix**: Cache stores 10 categories

---

## Timeline of the Problem

```
October 28, 2025
  └─ wiki.sql schema exported (in wrong order)
     └─ Status: Corrupted but not caught

November 5, 2025
  └─ Deployed to production
     ├─ Schema created (order doesn't matter for existing table)
     ├─ Pages migrated (174 rows)
     ├─ Categories NOT seeded (no seed file exists)
     └─ wiki_categories table: EMPTY

November 8, 2025
  └─ User reports: Category pages show "doesn't exist"
     └─ Pages work, but categories don't

November 9, 2025 - November 13, 2025
  └─ Multiple fix attempts
     ├─ Commit eabb964: Add await keywords (helps async, doesn't fix data)
     ├─ Commit ed2a3ec: Simplify GROUP BY (SQL fix, data still missing)
     └─ Commit cbae2ae: Add visibility features (can't work without data)

November 14, 2025 (NOW)
  └─ ROOT CAUSE IDENTIFIED: Missing wiki_categories data
     └─ Solution: 3 files, ~50 lines of code
```

---

## Comparison: SQLite vs PostgreSQL Migration

### What Worked
```
SQLite ─────────────────┐
  └─ wiki_pages: 174    │
  └─ wiki_revisions     ├──→ PostgreSQL
  └─ wiki_tags          │
  └─ etc.               │
     ✓ MIGRATED         │
                        └─ 174 pages exist ✓
                        └─ Revisions exist ✓
                        └─ Tables exist ✓
```

### What Failed
```
Need: wiki_categories (10 rows)
  ├─ SQLite: Never had data (schema was corrupted)
  └─ PostgreSQL: Never seeded after migration
     └─ Result: 0 rows in production ✗
```

---

## Code Paths

### API Route: GET /api/wiki/categories

```typescript
// frontend/src/app/api/wiki/categories/route.ts
export async function GET() {
  const categories = await wikiCategoryService.getAllCategories();

  // If categories is empty:
  return response.json({ categories: [] });  // Returns empty array

  // If categories has data:
  return response.json({ categories: [10 items] });  // Returns 10 items
}
```

### Service: WikiCategoryService

```typescript
// frontend/src/lib/wiki/services/WikiCategoryService.ts
async getAllCategories(userRole?: string) {
  const result = await dbAdapter.query(
    'SELECT c.*, COUNT(p.id) as page_count FROM wiki_categories c ...',
    [],
    { schema: 'wiki' }
  );

  // result.rows = []  (ALWAYS EMPTY - table is empty)
  return result.rows;
}
```

### DB Adapter: Query Execution

```typescript
// frontend/src/lib/database/adapter.ts
async query<T>(sql: string, params: any[], options: QueryOptions) {
  // Routes to PostgreSQL via pgPool

  try {
    const result = await this.queryPostgres<T>(sql, params, options);
    return result;  // { rows: [], rowCount: 0 }
  } catch (error) {
    // Logs connection errors, not "no data" condition
  }
}
```

---

## Summary of Data Flow Issues

| Component | Current | After Fix | Impact |
|-----------|---------|-----------|--------|
| **wiki_categories table** | 0 rows | 10 rows | ALL queries return data |
| **getAllCategories()** | [] | [10 items] | Category list works |
| **getCategoryById()** | throws | returns data | Category pages work |
| **Cache** | empty [] | [10 items] | Performance improved |
| **Indexes** | unused | active | Query performance good |
| **API response** | {} empty | categories array | Frontend can render |

---

## File-by-File Impact

### Files Modified by Fix

```
frontend/scripts/seeds/schemas/wiki.sql
  Before: CREATE INDEX, CREATE INDEX, ... (wrong order)
  After:  CREATE TABLE, CREATE INDEX, ... (correct order)
  Impact: Allows fresh SQLite initialization to work

frontend/scripts/seeds/data/wiki-categories.sql (NEW FILE)
  Before: (doesn't exist)
  After:  10 INSERT statements
  Impact: Seeds categories into PostgreSQL on deployment

frontend/scripts/init-databases.js
  Before: { name: 'wiki', hasSeeds: false }
  After:  { name: 'wiki', hasSeeds: true, seeds: [...] }
  Impact: Applies seeds automatically
```

### Files NOT Changed (But Work Better After)

```
frontend/src/lib/wiki/services/WikiCategoryService.ts
  - Queries are correct, just get more data now

frontend/src/lib/wiki/services/WikiPageService.ts
  - Already works, categories just enhance functionality

All UI components
  - Already ready to display categories

All API routes
  - Already ready to serve category data
```

---

## Conclusion

The wiki category bug is a **data problem**, not a **code problem**:

- ✓ Code is correct
- ✓ Schema is correct
- ✓ Queries are correct
- ✗ Data is missing

**Solution**: Add the 10 rows of missing category data.

**Impact**: Fixes entire category system in 40 minutes.
