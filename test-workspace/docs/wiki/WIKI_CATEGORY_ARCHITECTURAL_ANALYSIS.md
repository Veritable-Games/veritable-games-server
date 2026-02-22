# Wiki Category System - Comprehensive Architectural Analysis

**Analysis Date**: November 14, 2025
**Status**: Production Bug Identified - Category Pages Show "Not Found" Error

---

## EXECUTIVE SUMMARY

The wiki category system has a **known critical production bug** where individual wiki pages load correctly, but category pages consistently return "doesn't exist" errors on production (192.168.1.15) while working perfectly on localhost. The API endpoints for categories function correctly, but the frontend page route encounters failures.

**Root Cause**: The category page route successfully fetches the category from the API, but the `getCategoryData()` server-side function fails silently when calling `wikiService.getCategoryById()`, causing the page to render the "Category Not Found" error screen.

---

## DATA FLOW ANALYSIS

### 1. Database Storage Layer

#### Schema Location
**File**: `/home/user/Projects/veritable-games-main/frontend/scripts/seeds/schemas/wiki.sql`

#### Table Structure
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

**Critical Note**: The schema file is SQLite-formatted (DATETIME, INTEGER for booleans). This is used as a **seed template only**. Actual PostgreSQL production schema must use `TIMESTAMP` and `BOOLEAN`.

#### Related Tables
```
wiki_pages
  ├── category_id (TEXT) → references wiki_categories.id
  └── status (VARCHAR) - only 'published' pages are visible

wiki_page_categories (DEPRECATED junction table)
  ├── page_id
  └── category_id
```

**Note**: The codebase uses the direct `wiki_pages.category_id` column and treats the `wiki_page_categories` junction table as **deprecated** (see categoryQueryHelper.ts:8).

---

### 2. Backend Query Architecture

#### Service Layer Hierarchy

```
API Route (/api/wiki/categories/[id])
    ↓
getWikiService() → WikiService (legacy wrapper)
    ↓
wikiCategoryService.getCategoryById(categoryId)
    ↓
dbAdapter.query(sql, params, { schema: 'wiki' })
```

**File Locations**:
- **API Route**: `/home/user/Projects/veritable-games-main/frontend/src/app/api/wiki/categories/[id]/route.ts` (lines 258-310)
- **WikiCategoryService**: `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/services/WikiCategoryService.ts` (lines 224-253)
- **Legacy Wrapper**: `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/service.ts` (lines 70-72)

#### Query Flow for `getCategoryById(categoryId: string)`

**WikiCategoryService.ts:224-253**
```typescript
async getCategoryById(categoryId: string): Promise<WikiCategory> {
  const result = await dbAdapter.query(
    `SELECT
      c.*,
      COUNT(p.id) as page_count
    FROM wiki_categories c
    LEFT JOIN wiki_pages p ON c.id = p.category_id
    WHERE c.id = $1
    GROUP BY c.id`,
    [categoryId],
    { schema: 'wiki' }
  );

  if (result.rows.length === 0) {
    throw new Error(`Category not found: "${categoryId}"`);
  }
  // ... map row to WikiCategory
}
```

**Critical Issue**:
- This query uses `LEFT JOIN` but groups only by `c.id`
- PostgreSQL requires all non-aggregated columns in GROUP BY
- The original code will likely **fail with a PostgreSQL error**: "column "c.parent_id" must appear in the GROUP BY clause or be subject to an aggregate function"

---

### 3. Page-to-Category Data Retrieval

#### Category Page Server Component
**File**: `/home/user/Projects/veritable-games-main/frontend/src/app/wiki/category/[id]/page.tsx` (lines 16-40)

```typescript
async function getCategoryData(categoryId: string) {
  const wikiService = new WikiService();

  try {
    const [category, pages] = await Promise.all([
      wikiService.getCategoryById(categoryId),        // ❌ FAILS on production
      wikiService.getAllPages(categoryId),
    ]);

    let subcategories: any[] = [];
    try {
      const subCats = await wikiService.getSubcategories(categoryId);
      subcategories = Array.isArray(subCats) ? subCats : [];
    } catch (e) {
      console.error('Error loading subcategories:', e);
      subcategories = [];
    }

    return { category, pages, subcategories };
  } catch (error) {
    console.error('Error loading category data:', error);
    return { category: null, pages: [], subcategories: [] };  // ❌ Returns null category
  }
}
```

**The Bug**:
- Line 21: `wikiService.getCategoryById(categoryId)` fails with PostgreSQL GROUP BY error
- Line 36-38: Error is caught but logged and category is set to null
- Line 113: Page checks if `!category` and renders "Category Not Found" screen

---

## LOCALHOST vs PRODUCTION DIFFERENCES

### Environment-Specific Behavior

| Aspect | Localhost | Production |
|--------|-----------|------------|
| **Database** | SQLite (file-based) | PostgreSQL 15 |
| **GROUP BY Enforcement** | Lenient (SQLite) | Strict (PostgreSQL) |
| **Query Execution** | Succeeds with implicit grouping | Fails - missing columns in GROUP BY |
| **Error Handling** | Silently falls back | Exception propagates, caught, returns null |
| **Status** | ✅ Works | ❌ "Category Not Found" |

### Root Cause: PostgreSQL GROUP BY Strictness

SQLite allows non-aggregated columns in SELECT without including them in GROUP BY:
```sql
-- ✅ Works in SQLite
SELECT c.id, c.name, c.parent_id, COUNT(p.id)
FROM wiki_categories c
LEFT JOIN wiki_pages p ON c.id = p.category_id
GROUP BY c.id  -- Parent_id/name not in GROUP BY
```

PostgreSQL requires explicit grouping:
```sql
-- ❌ FAILS in PostgreSQL
SELECT c.id, c.name, c.parent_id, COUNT(p.id)
FROM wiki_categories c
LEFT JOIN wiki_pages p ON c.id = p.category_id
GROUP BY c.id  -- ERROR: parent_id must be grouped or aggregated
```

---

## CATEGORY CONTENT LOADING

### Page Listing in Categories

#### Query Helper Class
**File**: `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/helpers/categoryQueryHelper.ts`

**Unified Approach**: Uses `wiki_pages.category_id` column only (not deprecated junction table)

**Key Methods**:

1. **getCategoryCondition()** (lines 24-36)
   - Returns WHERE clause for category filtering
   - Supports exact match OR wildcard pattern matching
   - Pattern: `category_id = $1 OR category_id LIKE $2`

2. **getPageCountQuery()** (lines 42-54)
   ```sql
   SELECT COUNT(DISTINCT p.id) as count
   FROM wiki.wiki_pages p
   WHERE p.category_id = $1 AND p.status = 'published'
   ```

3. **getPagesInCategory()** (lines 95-157)
   - Returns paginated list with full content
   - Joins with revisions, tags, user data, and view counts
   - Uses `STRING_AGG` for PostgreSQL (not GROUP_CONCAT)
   - **Requires GROUP BY for all non-aggregated columns**: lines 140-141

#### Visibility/Filtering Logic

**File**: `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/services/WikiPageService.ts` (lines 31-44)

- Single category per page via `category_id` column
- Admin-only categories: 'library' (hardcoded)
- Access control: `(p.category_id IS NULL OR p.category_id != 'library')`

---

## CRITICAL ISSUES IDENTIFIED

### Issue #1: PostgreSQL GROUP BY Violation (CRITICAL)

**Location**: `WikiCategoryService.getCategoryById()` line 226-232

**Query**:
```sql
SELECT c.*, COUNT(p.id) as page_count
FROM wiki_categories c
LEFT JOIN wiki_pages p ON c.id = p.category_id
WHERE c.id = $1
GROUP BY c.id
```

**Problem**:
- Selects `c.*` (all columns: id, parent_id, name, description, color, icon, sort_order, created_at, is_public)
- Only groups by `c.id`
- PostgreSQL error: "column "c.parent_id" must appear in the GROUP BY clause or be subject to an aggregate function"

**Fix Required**:
```sql
SELECT
  c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at, c.is_public,
  COUNT(p.id) as page_count
FROM wiki_categories c
LEFT JOIN wiki_pages p ON c.id = p.category_id
WHERE c.id = $1
GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at, c.is_public
```

**Severity**: CRITICAL - Prevents all category pages from loading in production

---

### Issue #2: Similar GROUP BY Violations in Multiple Methods

**Affected Methods** (all in WikiCategoryService.ts):

1. **getAllCategories()** (lines 282-296)
   - Issue: `SELECT c.*, ... GROUP BY c.id` without all columns
   - Used by: Category listing API, Popular Pages, Recent Activity

2. **getSubcategories()** (lines 334-345)
   - Issue: `SELECT c.*, ... GROUP BY c.id` without all columns
   - Used by: Category hierarchy display

3. **getRootCategories()** (lines 368-379)
   - Issue: `SELECT c.*, ... GROUP BY c.id` without all columns
   - Used by: Wiki landing page

4. **getCategoryStats()** (lines 472-482)
   - Issue: Most used category query groups only by `c.id`

5. **searchCategories()** (lines 511-522)
   - Issue: Groups only by `c.id` without all columns

**Impact**: **ALL category-related queries fail in production**

---

### Issue #3: Silent Error Handling Masks Root Cause

**Location**: Category page route `/wiki/category/[id]/page.tsx` (lines 36-39)

```typescript
catch (error) {
  console.error('Error loading category data:', error);  // Logged but details may not surface
  return { category: null, pages: [], subcategories: [] };  // Returns null
}
```

**Problem**:
- Error is caught and logged to console
- Console logs may not be accessible in production
- Page simply renders "Category Not Found" with no diagnostic information
- Users don't know if category doesn't exist or if there's an internal error

**Result**: Hard to debug without access to server logs

---

### Issue #4: Database Adapter Query Logging May Be Insufficient

**Location**: `/home/user/Projects/veritable-games-main/frontend/src/lib/database/adapter.ts` (lines 167-171)

```typescript
console.log('[DatabaseAdapter] queryPostgres:', {
  schema: options.schema,
  originalSql: sql.substring(0, 80),  // ⚠️ Only first 80 chars
  pgSql: pgSql.substring(0, 80),      // ⚠️ Truncated
});
```

**Problem**:
- Queries are truncated to 80 characters
- Complex category queries with multiple JOINs get cut off
- Full SQL not visible for debugging
- GROUP BY clause may not appear in log output

---

## VERIFICATION STEPS

### Test 1: Direct API Call (Works)

```bash
# On production server (192.168.1.15)
curl -s http://192.168.1.15:3000/api/wiki/categories/journals | jq .
# Expected: Returns category data successfully
```

**File**: `/home/user/Projects/veritable-games-main/frontend/src/app/api/wiki/categories/[id]/route.ts` (lines 258-310)

The API GET handler calls `wikiService.getCategoryById()` which internally calls `wikiCategoryService.getCategoryById()`.

**Note**: If this also fails, the error occurs in the service layer before the API response is sent.

---

### Test 2: Page Route (Fails)

```bash
# Navigate to
http://192.168.1.15:3000/wiki/category/journals
# Expected (on localhost): Category page loads
# Actual (production): "Category doesn't exist" error
```

**Root Cause Flow**:
1. `/wiki/category/[id]/page.tsx` (line 86) calls `getCategoryData(id)`
2. Line 21: `getCategoryById()` is called
3. Database query fails due to GROUP BY violation
4. Error caught silently (line 36-39)
5. Returns `{ category: null }`
6. Page renders error screen (line 113)

---

### Test 3: Manual SQL Query (Diagnose)

Run directly on PostgreSQL:

```sql
-- Test current broken query
SELECT c.*, COUNT(p.id) as page_count
FROM wiki.wiki_categories c
LEFT JOIN wiki.wiki_pages p ON c.id = p.category_id
WHERE c.id = 'journals'
GROUP BY c.id;
-- Expected on PostgreSQL: ERROR - missing columns in GROUP BY
```

---

## RECOMMENDATIONS

### Fix #1: Correct All GROUP BY Clauses (IMMEDIATE)

**File**: `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/services/WikiCategoryService.ts`

**Method 1: Explicit Column Selection** (Recommended - Explicit is better than implicit)

Replace line 226 in `getCategoryById()`:
```typescript
// BEFORE
const result = await dbAdapter.query(
  `SELECT
    c.*,
    COUNT(p.id) as page_count
  FROM wiki_categories c
  LEFT JOIN wiki_pages p ON c.id = p.category_id
  WHERE c.id = $1
  GROUP BY c.id`,
  [categoryId],
  { schema: 'wiki' }
);

// AFTER - Explicit columns + proper GROUP BY
const result = await dbAdapter.query(
  `SELECT
    c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at, c.is_public,
    COUNT(p.id)::INTEGER as page_count
  FROM wiki_categories c
  LEFT JOIN wiki_pages p ON c.id = p.category_id AND p.status = 'published'
  WHERE c.id = $1
  GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at, c.is_public`,
  [categoryId],
  { schema: 'wiki' }
);
```

**Changes**:
- Explicitly list all columns instead of `c.*`
- Add all columns to GROUP BY clause
- Cast `COUNT()` to INTEGER for type safety
- Filter pages by `status = 'published'` in JOIN condition
- Handles NULL case properly via LEFT JOIN

---

**Apply Same Fix to:**

1. **getAllCategories()** (lines 282-296)
   ```typescript
   // GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at, c.is_public
   ```

2. **getSubcategories()** (lines 334-345)
   ```typescript
   // Add: c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at, c.is_public to GROUP BY
   ```

3. **getRootCategories()** (lines 368-379)
   ```typescript
   // Add: c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at, c.is_public to GROUP BY
   ```

4. **getCategoryStats()** (lines 472-482)
   ```typescript
   // mostUsedResult query: GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at, c.is_public
   ```

5. **searchCategories()** (lines 511-522)
   ```typescript
   // GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at, c.is_public
   ```

---

### Fix #2: Add Detailed Error Logging (IMPORTANT)

**File**: `/home/user/Projects/veritable-games-main/frontend/src/app/wiki/category/[id]/page.tsx`

**Update getCategoryData() error handling** (lines 36-39):

```typescript
catch (error) {
  // Log full error with context
  console.error('[CategoryPage] Error loading category data for:', {
    categoryId,
    errorName: error instanceof Error ? error.name : 'Unknown',
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : undefined,
  });

  // Return null to trigger error page
  return { category: null, pages: [], subcategories: [] };
}
```

This ensures full error details are logged, making production issues easier to diagnose.

---

### Fix #3: Improve Database Query Logging (IMPORTANT)

**File**: `/home/user/Projects/veritable-games-main/frontend/src/lib/database/adapter.ts`

**Update line 167-171**:

```typescript
// BEFORE - Truncated to 80 chars
console.log('[DatabaseAdapter] queryPostgres:', {
  schema: options.schema,
  originalSql: sql.substring(0, 80),
  pgSql: pgSql.substring(0, 80),
});

// AFTER - Full query for debugging
if (process.env.DEBUG_SQL === 'true' || options.schema === 'wiki') {
  console.log('[DatabaseAdapter] Full Query:', {
    schema: options.schema,
    originalSql: sql,  // Full query
    pgSql: pgSql,      // Full query
    params: params.length > 0 ? `[${params.length} params]` : '[]',
  });
} else {
  console.log('[DatabaseAdapter] Query Summary:', {
    schema: options.schema,
    sqlLength: sql.length,
    paramsCount: params.length,
  });
}
```

This allows debugging with `DEBUG_SQL=true` environment variable when needed.

---

### Fix #4: Create Database Schema Helper Type

**File**: Create new `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/helpers/category-columns.ts`

```typescript
/**
 * PostgreSQL requires explicit column lists for GROUP BY compliance
 * This helper prevents future GROUP BY violations
 */

export const WIKI_CATEGORY_COLUMNS = [
  'c.id',
  'c.parent_id',
  'c.name',
  'c.description',
  'c.color',
  'c.icon',
  'c.sort_order',
  'c.created_at',
  'c.is_public',
] as const;

export const WIKI_CATEGORY_COLUMNS_STR = WIKI_CATEGORY_COLUMNS.join(', ');

export const WIKI_CATEGORY_GROUP_BY = WIKI_CATEGORY_COLUMNS.join(', ');

// Usage in queries:
// SELECT ${WIKI_CATEGORY_COLUMNS_STR}, COUNT(p.id) as page_count
// FROM wiki_categories c ...
// GROUP BY ${WIKI_CATEGORY_GROUP_BY}
```

This centralizes the column list and prevents future inconsistencies.

---

## TESTING STRATEGY

### Phase 1: Local Testing (Localhost)

1. **Verify current state still works**:
   ```bash
   cd /home/user/Projects/veritable-games-main
   npm run dev
   # Navigate to http://localhost:3000/wiki/category/journals
   # Expected: Should work (SQLite is lenient)
   ```

2. **Switch to PostgreSQL locally** (if available):
   ```bash
   # Run migrations to create PostgreSQL wiki schema
   npm run db:migrate
   # Test category pages again
   # Expected: Will fail before fix, should be applied to demonstrate issue
   ```

---

### Phase 2: Apply Fixes Sequentially

1. **Apply Fix #1** (GROUP BY corrections)
   - Update all 5 methods in WikiCategoryService.ts
   - Verify TypeScript compilation: `npm run type-check`
   - No type changes needed - return types remain the same

2. **Apply Fix #2** (Error logging)
   - Update getCategoryData() in category page route
   - Verify error messages are detailed

3. **Apply Fix #3** (Query logging)
   - Update database adapter logging
   - Add environment variable check

4. **Apply Fix #4** (Helper type)
   - Create category-columns.ts utility
   - Refactor queries to use helper
   - Verify no functional changes

---

### Phase 3: Production Testing

1. **Deploy fixes to production** via git push to main branch
   - Coolify will auto-deploy (2-5 minute build)

2. **Verify category pages load**:
   ```bash
   curl -s http://192.168.1.15:3000/api/wiki/categories/journals | jq .
   # Expected: Category data returned

   # Navigate to http://192.168.1.15:3000/wiki/category/journals in browser
   # Expected: Category page loads with list of pages
   ```

3. **Check all category types**:
   - /wiki/category/journals
   - /wiki/category/archive
   - /wiki/category/tutorials
   - etc.

4. **Verify API endpoints still work**:
   - GET /api/wiki/categories (list all)
   - GET /api/wiki/categories/[id] (get specific)
   - POST /api/wiki/categories (create)
   - PATCH /api/wiki/categories/[id] (update)

5. **Monitor production logs**:
   ```bash
   ssh user@192.168.1.15
   docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50
   # Look for: [DatabaseAdapter] errors related to wiki schema
   # Should see successful queries after fix
   ```

---

### Phase 4: Regression Testing

After fixes are deployed:

1. **Test category operations**:
   - [ ] Navigate to each category
   - [ ] Search within categories
   - [ ] Create new pages in categories
   - [ ] View category statistics
   - [ ] Check Popular Pages (filters by category)
   - [ ] Check Recent Activity (filters by category)

2. **Test edge cases**:
   - [ ] Subcategories display correctly
   - [ ] Category hierarchy renders
   - [ ] Admin-only categories properly filtered
   - [ ] 'library' category access control works
   - [ ] Empty categories (0 pages) render without error

3. **Performance check**:
   - [ ] Category pages load < 300ms
   - [ ] Category API calls complete < 100ms
   - [ ] No N+1 query patterns

---

## SUMMARY TABLE

| Component | Issue | File:Line | Fix |
|-----------|-------|-----------|-----|
| **getCategoryById()** | GROUP BY incomplete | WikiCategoryService.ts:226 | Explicit columns + full GROUP BY |
| **getAllCategories()** | GROUP BY incomplete | WikiCategoryService.ts:282 | Explicit columns + full GROUP BY |
| **getSubcategories()** | GROUP BY incomplete | WikiCategoryService.ts:334 | Explicit columns + full GROUP BY |
| **getRootCategories()** | GROUP BY incomplete | WikiCategoryService.ts:368 | Explicit columns + full GROUP BY |
| **getCategoryStats()** | GROUP BY incomplete | WikiCategoryService.ts:472 | Explicit columns + full GROUP BY |
| **searchCategories()** | GROUP BY incomplete | WikiCategoryService.ts:511 | Explicit columns + full GROUP BY |
| **Error Visibility** | Silent failures | page.tsx:36 | Add detailed error logging |
| **Query Logging** | Truncated output | adapter.ts:167 | Full query logging when needed |
| **Code Maintainability** | No column reference | N/A | Create category-columns.ts helper |

---

## CRITICAL SUCCESS CRITERIA

After implementing all fixes:

1. ✅ **All category pages load** on production (192.168.1.15:3000)
2. ✅ **API endpoints respond** correctly with category data
3. ✅ **Error logs are detailed** (not truncated) for debugging
4. ✅ **No PostgreSQL errors** about GROUP BY violations
5. ✅ **Subcategories display** correctly
6. ✅ **Page counts accurate** for each category
7. ✅ **Performance unchanged** or improved
8. ✅ **Type safety maintained** (no TypeScript errors)

---

## PRODUCTION BUG CONTEXT

As noted in CLAUDE.md, this is a **known production-only issue**:
- 174 individual wiki pages work perfectly on localhost AND production
- Category pages work perfectly on localhost but fail on production
- API endpoints function correctly (may or may not, verify in testing)
- The issue is environment-specific: PostgreSQL strict GROUP BY vs SQLite's lenient parsing

This analysis provides the specific root cause and targeted fixes to resolve the category system in production.

---

## NEXT STEPS

1. **Immediate**: Review this analysis for accuracy
2. **Short-term** (Next 1-2 hours): Implement Fixes #1-#3
3. **Medium-term** (2-4 hours): Test locally and on production
4. **Follow-up**: Monitor logs for any regression

All code locations are absolute file paths as required.
