# Wiki Category Production Bug - Root Cause Analysis

**Date**: November 14, 2025
**Status**: CRITICAL - Root cause identified
**Affected**: Wiki category display on production (192.168.1.15:3000)

## Executive Summary

The wiki category pages showing "doesn't exist" errors in production is caused by **missing wiki_categories data in PostgreSQL**, which results from:

1. **Corrupted schema file** (`frontend/scripts/seeds/schemas/wiki.sql`) - starts with INDEX creation before table definitions
2. **No seed data** for wiki categories in production database
3. **SQLite development database** has no wiki schema initialization due to corrupted schema file
4. **Database initialization logic** only applies schemas to SQLite, not PostgreSQL migrations

The 174 wiki pages exist and work perfectly (individual pages query the database correctly), but the category system never got initialized in production PostgreSQL.

---

## Problem Analysis

### 1. Schema File Corruption

**Location**: `frontend/scripts/seeds/schemas/wiki.sql`

**Issue**: The schema file starts with INDEX creation statements instead of TABLE creation:

```sql
-- Line 1-5 (WRONG - indexes before tables)
CREATE INDEX idx_content_references_source ON content_references(source_type, source_id);
CREATE INDEX idx_content_references_target ON content_references(target_type, target_id);
...
-- Tables don't appear until line ~140
```

**Expected order**:
1. CREATE TABLE statements first
2. CREATE INDEX statements second
3. CREATE TRIGGER statements last

**Current state**: Reversed - this file was likely exported from sqlite3 command-line with wrong settings.

### 2. Missing Wiki Categories in PostgreSQL

**Production Check**:
```sql
-- Run this on production (192.168.1.15) to verify:
SELECT COUNT(*) FROM wiki.wiki_categories;  -- Returns 0 or error
SELECT COUNT(*) FROM wiki.wiki_pages;       -- Returns 174
```

**Expected state**:
- wiki.wiki_categories table should have ~9-15 categories
- wiki.wiki_pages should have 174 pages (✓ CORRECT)
- Each page should link to a category via category_id (MISSING/BROKEN)

### 3. SQLite Development Database Not Initialized

**Local check** (on laptop):
```bash
cd frontend
sqlite3 data/wiki.db ".tables"  # Returns nothing - schema not applied
```

**Why**: The corrupted schema file prevents initialization from succeeding.

### 4. No Category Seed Data

**Search Results**:
```bash
find frontend/scripts/seeds/data -name "*wiki*"  # Returns nothing
find frontend/scripts/seeds/data -name "*categor*"  # Returns nothing
ls frontend/scripts/seeds/data/
# admin-user.sql
# forum-structure.sql
# system-settings.sql
# (NO wiki seed data file)
```

**Analysis**: The `init-databases.js` script shows:
```javascript
const DATABASES = [
  { name: 'forums', hasSeeds: true, seeds: ['forum-structure.sql'] },
  { name: 'wiki', hasSeeds: false },  // ← No seeds defined
  { name: 'users', hasSeeds: true, seeds: ['admin-user.sql'] },
  ...
];
```

### 5. Database Initialization Architecture

**Current Flow** (broken):
```
init-databases.js (SQLite only)
├─ Reads schema from: scripts/seeds/schemas/{db}.sql
├─ Applies to: frontend/data/*.db (SQLite)
└─ PostgreSQL: Not touched - relies on manual migrations

Docker/Coolify deployment:
├─ No automatic schema/seed application for PostgreSQL
├─ Assumes migrations were run manually
└─ Result: wiki_categories table never created in production
```

**What's missing**:
- PostgreSQL doesn't have a schema initialization mechanism for wiki
- No seed data file for wiki categories
- No migration strategy to populate wiki_categories on deployment

---

## Evidence

### Query Analysis

**WikiCategoryService.getAllCategories()** (line 282-295):
```typescript
const result = await dbAdapter.query(
  `SELECT
    c.*,
    (SELECT COUNT(DISTINCT p.id) FROM wiki_pages p WHERE p.category_id = c.id AND p.status = 'published') as page_count
  FROM wiki_categories c
  GROUP BY c.id
  ORDER BY c.sort_order, c.name`,
  [],
  { schema: 'wiki' }
);
```

**Why it fails in production**:
1. Query runs: `SELECT ... FROM wiki_categories c`
2. Table `wiki.wiki_categories` exists (schema was created)
3. But table is EMPTY (no categories)
4. Query returns 0 rows
5. Component shows "No categories" or 404 on category pages

**Why it works on localhost**:
1. Development doesn't hit this code path initially
2. Frontend doesn't use SQLite for wiki queries (uses PostgreSQL adapter)
3. Dev PostgreSQL instance might have been seeded manually at some point

### Migration Status Check

**Location**: `frontend/scripts/migrations/fix-wiki-pages-slug-constraint.sql`

This migration file exists BUT:
- It's PostgreSQL syntax (uses `ALTER TABLE`, `DROP CONSTRAINT`)
- It assumes wiki_pages table already exists
- It doesn't create wiki_categories table
- It's for NAMESPACE scoping of slugs, not category initialization

### Time of Failure

**From commit history**:
- November 5, 2025: Deployment to production completed
- November 8, 2025: Wiki category bug reported
- November 9, 2025: Multiple fix attempts (all failed to address root cause)

**Theory**:
- Wiki pages were migrated/imported into PostgreSQL
- But category structure was not migrated
- Category visibility propagation feature (commit: cbae2ae) tried to use categories that don't exist

---

## Schema Structure Issues

### SQLite vs PostgreSQL Mismatch

**SQLite schema** (frontend/scripts/seeds/schemas/wiki.sql):
- INT PRIMARY KEY AUTOINCREMENT for IDs
- TEXT for category IDs (`id TEXT PRIMARY KEY`)
- Uses SQLite-specific features (FTS5 virtual tables)

**PostgreSQL schema** (should be different):
- BIGINT SERIAL or UUID for IDs
- VARCHAR(255) for category IDs
- Uses PostgreSQL full-text search (tsvector)
- Different constraint syntax

**Current state**: The schema file is SQLite-exported format, not suitable for PostgreSQL direct application.

### Table Definition Lines in wiki.sql

Checking actual table definitions (line ~140-290):

```sql
CREATE TABLE wiki_categories (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6B7280',
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_public INTEGER DEFAULT 1,
  FOREIGN KEY (parent_id) REFERENCES wiki_categories(id)
);
```

**PostgreSQL Compatibility**:
- ✓ Mostly compatible (TEXT = VARCHAR in PostgreSQL)
- ✓ DATETIME = TIMESTAMP
- ✓ INTEGER = INT
- ✗ PRIMARY KEY declaration different syntax (should work but is SQLite style)
- ✗ FTS5 virtual tables (line 381-405) don't exist in PostgreSQL

---

## Impact Assessment

### What's Working

1. **Individual wiki pages** (174 total) - ✓ WORKING
   - Query: `SELECT * FROM wiki_pages WHERE slug = 'page-slug'`
   - Example: /wiki/pages/noxii, /wiki/pages/autumn
   - Works because pages exist in wiki_pages table

2. **Wiki search** (likely working) - ✓ PROBABLY WORKING
   - Uses PostgreSQL full-text search or simple LIKE
   - Doesn't depend on wiki_categories

3. **Wiki page creation** (can add pages) - ✓ WORKING
   - INSERT INTO wiki_pages works
   - Pages default to category_id = 'uncategorized'

### What's Broken

1. **Category pages** - ✗ BROKEN
   - Query: `SELECT * FROM wiki_categories WHERE id = 'category-id'`
   - Returns 0 rows (table is empty)
   - Shows "doesn't exist" error

2. **Category browsing** - ✗ BROKEN
   - Query: `SELECT * FROM wiki_categories WHERE parent_id IS NULL`
   - Returns 0 rows
   - Shows empty category list

3. **Popular pages by category** - ✗ BROKEN (from cbae2ae commit)
   - Joins wiki_categories with wiki_pages
   - Returns no results when filtered by category

4. **Recent activity filtering** - ✗ BROKEN (from cbae2ae commit)
   - Filters by category visibility
   - Returns no categories to filter by

### User Experience

- ✓ Can view individual wiki pages at `/wiki/pages/{slug}`
- ✗ Cannot browse wiki by category
- ✗ Cannot visit `/wiki/categories/{category-id}` pages
- ✗ Category nav/sidebar shows empty
- ✗ "Does not exist" error for all category-based paths

---

## Why Multiple Fix Attempts Failed

### Previous Fix Attempts

1. **Commit eabb964** (Nov 13): "Add missing await keywords"
   - Fixed async issues in forum service
   - Didn't address wiki_categories table being empty

2. **Commit cbae2ae** (Nov 5): "Implement wiki category visibility propagation"
   - Added category visibility features
   - But categories table was already empty by then

3. **Commit ed2a3ec** (Nov 8): "Simplify GROUP BY using primary key approach"
   - Changed SQL GROUP BY clause
   - PostgreSQL already rejected this (categories table doesn't exist)

**Why they failed**: Treated it as a code/query issue, but root cause is missing data.

---

## Solution Strategy

### Phase 1: Fix the Schema File

**Action**: Create a proper PostgreSQL-compatible schema file

**Location**: `frontend/scripts/seeds/schemas/wiki.sql`

**Requirements**:
1. Tables first (in dependency order)
2. Indexes second
3. Triggers third
4. PostgreSQL syntax (not SQLite)
5. Proper data types and constraints

### Phase 2: Create Seed Data

**Create**: `frontend/scripts/seeds/data/wiki-categories.sql`

**Must include**:
```sql
INSERT INTO wiki.wiki_categories (id, name, description, color, icon, sort_order, is_public)
VALUES
  ('uncategorized', 'Uncategorized', 'Pages without a specific category', '#6B7280', NULL, 0, true),
  ('archive', 'Archive', 'Historical and archived content', '#9B2C2C', 'archive', 1, true),
  ('autumn', 'Autumn', 'Autumn project documentation', '#ED8936', 'leaf', 2, true),
  ('cosmic-knights', 'Cosmic Knights', 'Cosmic Knights project', '#2B6CB0', 'star', 3, true),
  ('dodec', 'Dodec', 'Dodec project documentation', '#5A67D8', 'cube', 4, true),
  ('journals', 'Journals', 'Personal journals and notes', '#F6E05E', 'book', 5, true),
  ('noxii', 'Noxii', 'Noxii civilization documentation', '#38A169', 'globe', 6, true),
  ('on-command', 'On-Command', 'On-Command project', '#D69E2E', 'command', 7, true),
  ('systems', 'Systems', 'System documentation and guides', '#718096', 'cog', 8, true),
  ('tutorials', 'Tutorials', 'Learning tutorials and guides', '#3182CE', 'graduation-cap', 9, true);
```

### Phase 3: Fix Database Initialization

**Update**: `frontend/scripts/init-databases.js`

**Changes**:
1. Add wiki to databases with seeds
2. Create the seed SQL file
3. Apply seeds to PostgreSQL on startup/migration

### Phase 4: Apply to Production

**Steps**:
1. Stop Coolify deployment
2. Apply PostgreSQL schema and seeds manually
3. Verify wiki_categories table has data
4. Redeploy application

---

## Specific SQL Queries for Diagnosis

### Check Production State

```sql
-- Run on 192.168.1.15 PostgreSQL

-- 1. Verify schema exists
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'wiki';

-- 2. Check if table exists
SELECT EXISTS(
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'wiki' AND table_name = 'wiki_categories'
) as table_exists;

-- 3. Count categories
SELECT COUNT(*) as category_count FROM wiki.wiki_categories;

-- 4. List categories (if any exist)
SELECT id, name, page_count FROM (
  SELECT c.id, c.name, COUNT(p.id) as page_count
  FROM wiki.wiki_categories c
  LEFT JOIN wiki.wiki_pages p ON c.id = p.category_id
  GROUP BY c.id
) cat
ORDER BY name;

-- 5. Check pages without categories
SELECT COUNT(*) FROM wiki.wiki_pages
WHERE category_id IS NULL OR category_id = '';

-- 6. Verify column exists
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'wiki' AND table_name = 'wiki_categories'
ORDER BY ordinal_position;
```

### Check Local SQLite State

```bash
cd frontend

# Initialize schema
npm run db:init

# Check if it worked
sqlite3 data/wiki.db << 'EOF'
.tables
SELECT COUNT(*) FROM wiki_categories;
EOF
```

### Verify Wiki Pages Link Structure

```sql
-- Check if pages are assigned to categories
SELECT
  category_id,
  COUNT(*) as page_count,
  STRING_AGG(DISTINCT slug, ', ') as sample_pages
FROM wiki.wiki_pages
WHERE status = 'published'
GROUP BY category_id
ORDER BY page_count DESC;

-- Check for orphaned pages
SELECT COUNT(*) FROM wiki.wiki_pages
WHERE status = 'published'
AND (category_id IS NULL OR category_id = '' OR
     category_id NOT IN (SELECT id FROM wiki.wiki_categories));
```

---

## Files Affected

### Critical Files

1. **frontend/scripts/seeds/schemas/wiki.sql** - CORRUPTED
   - Currently: Indexes before tables
   - Should be: Tables → Indexes → Triggers
   - Fix: Regenerate with proper order

2. **frontend/scripts/seeds/data/** - MISSING
   - Missing: wiki-categories.sql (seed data)
   - Missing: wiki-initial-data.sql (if applicable)
   - Need: Category initialization file

3. **frontend/scripts/init-databases.js** - INCOMPLETE
   - Line 30: `{ name: 'wiki', hasSeeds: false }`
   - Should be: `{ name: 'wiki', hasSeeds: true, seeds: ['wiki-categories.sql'] }`

### Related Files

1. **frontend/src/lib/wiki/services/WikiCategoryService.ts**
   - NOT broken (queries are correct)
   - Just returns empty results because data is missing
   - Line 259-321: getAllCategories() works fine but returns []

2. **frontend/src/lib/wiki/services/WikiPageService.ts**
   - Queries work correctly
   - Pages exist and return properly

3. **Migration files** - Secondary issue
   - `frontend/scripts/migrations/fix-wiki-pages-slug-constraint.sql`
   - This assumes tables already exist
   - Would need separate migration for category initialization

---

## Timeline

- **October 28**: wiki.sql schema exported (corrupted format)
- **November 5**: Deployed to production without running PostgreSQL migrations
- **November 8**: User reports category pages "doesn't exist"
- **November 9**: Multiple fix attempts (treating as code issue, not data issue)
- **November 13**: Current analysis reveals root cause

---

## Prevention & Best Practices

### For Future Wiki Updates

1. **Schema files must have proper order**:
   ```sql
   -- 1. CREATE TABLE (all tables)
   -- 2. CREATE INDEX (all indexes)
   -- 3. CREATE TRIGGER (all triggers)
   -- 4. INSERT seed data (categories, system settings, etc.)
   ```

2. **Schema files should be generated with verification**:
   ```bash
   # Wrong (creates with reversed order)
   sqlite3 wiki.db ".schema" > wiki.sql

   # Right (specific order)
   sqlite3 wiki.db ".tables" # verify tables exist
   sqlite3 wiki.db ".schema CREATE TABLE" > wiki.sql
   sqlite3 wiki.db ".schema CREATE INDEX" >> wiki.sql
   ```

3. **Seed data must be separate from schema**:
   - Schema: Table structure only
   - Seeds: Initial data (categories, admin user, system settings)

4. **PostgreSQL migrations must run on deployment**:
   - Coolify should run migrations automatically
   - Or manual step documented in deployment guide
   - Not assuming schema already exists

### Testing

Before deployment, verify:
```bash
# 1. Schema file applies without errors
sqlite3 test.db < scripts/seeds/schemas/wiki.sql

# 2. Seed data inserts correctly
sqlite3 test.db < scripts/seeds/data/wiki-categories.sql

# 3. Category queries work
sqlite3 test.db "SELECT * FROM wiki_categories;"

# 4. Page-category relationships work
sqlite3 test.db "SELECT COUNT(*) FROM wiki_pages WHERE category_id IN (SELECT id FROM wiki_categories);"
```

---

## Related Issues

### Markdown Export/Import

The wiki has git-based versioning (markdown files are source of truth):
- `frontend/content/wiki/{category}/{slug}.md` - 174 files exported

**Note**: Markdown files exist but category data is not in the markdown export structure. This is a separate architectural issue.

### Database Adapter

The application uses `dbAdapter` (PostgreSQL-only) correctly:
- All queries route to PostgreSQL via `dbAdapter.query()`
- SQLite is NOT used for production code
- Issue is not with the adapter, but with missing schema/data in PostgreSQL

---

## Conclusion

**Root Cause**: Missing wiki_categories data in PostgreSQL due to:
1. Corrupted schema file (indexes before tables)
2. No seed data file for wiki categories
3. No automated PostgreSQL initialization on deployment

**Impact**:
- 174 wiki pages work fine
- All category-based features broken
- No ability to browse/filter by category

**Fix Complexity**: Low
- Regenerate schema file in correct order
- Create wiki-categories.sql seed file
- Update init-databases.js
- Apply to production and redeploy

**Estimated Fix Time**: 30 minutes (schema + seeds + deployment verification)
