# Wiki Category System - Data Flow Diagram

## HIGH-LEVEL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER / CLIENT SIDE                       │
└─────────────────────────────────────────────────────────────────────┘

                          http://192.168.1.15:3000/wiki/category/[id]
                                        ↓
                    /app/wiki/category/[id]/page.tsx
                    (Server Component - getsCategoryData)
                                        ↓
        ┌───────────────────────────────┴───────────────────────────────┐
        ↓                                                               ↓
getCategoryData()                                    Special Routes:
├─ wikiService.getCategoryById(id)                   ├─ /wiki/category/journals → JournalsPageClient
├─ wikiService.getAllPages(id)                       └─ /wiki/category/library → redirect to /library
└─ wikiService.getSubcategories(id)
        ↓
    ❌ FAILS HERE (Production)
        ↓
    Returns null category
        ↓
    Page renders "Category Not Found" error


┌─────────────────────────────────────────────────────────────────────┐
│                    LEGACY WikiService WRAPPER                       │
│  /lib/wiki/service.ts - Backwards compatibility layer               │
└─────────────────────────────────────────────────────────────────────┘
        ↓ delegates to
┌─────────────────────────────────────────────────────────────────────┐
│              WikiServiceFactory (New Architecture)                  │
│  /lib/wiki/services/index.ts - Specialized services                │
│                                                                     │
│  - wikiPageService      → Page CRUD operations                      │
│  - wikiRevisionService  → Revision management                       │
│  - wikiCategoryService  → ❌ BROKEN in production                   │
│  - wikiSearchService    → Search/filtering                          │
│  - wikiTagService       → Tag management                            │
│  - wikiAnalyticsService → Activity tracking                         │
└─────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│           WikiCategoryService - THE BROKEN COMPONENT                │
│  /lib/wiki/services/WikiCategoryService.ts                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ getCategoryById(id)          ← ENTRY POINT FOR CATEGORY PAGES      │
│   │                                                                 │
│   └─ dbAdapter.query()                                             │
│       SQL: SELECT c.*, COUNT(p.id)                                │
│            FROM wiki_categories c                                  │
│            LEFT JOIN wiki_pages p ON c.id = p.category_id         │
│            WHERE c.id = $1                                        │
│            GROUP BY c.id  ← ❌ MISSING COLUMNS HERE              │
│       ↓                                                            │
│       ❌ PostgreSQL ERROR:                                         │
│       "column c.parent_id must appear in GROUP BY clause"          │
│       "or be subject to an aggregate function"                    │
│                                                                     │
│ getAllCategories(userRole)   ← USED BY: Listings, Popular Pages   │
│ getSubcategories(parentId)   ← USED BY: Hierarchy display         │
│ getRootCategories()          ← USED BY: Wiki landing page         │
│ getCategoryStats()           ← USED BY: Analytics                  │
│ searchCategories(query)      ← USED BY: Category search            │
│                                                                     │
│ All 6 methods have similar GROUP BY violations                     │
└─────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   DatabaseAdapter Layer                             │
│  /lib/database/adapter.ts - PostgreSQL Only (SQLite removed)       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ query(sql, params, options)                                        │
│   │                                                                │
│   ├─ options.schema = 'wiki'  ← Uses wiki schema                  │
│   │                                                                │
│   └─ pgPool.query(sql, params, schema)                            │
│       ↓                                                            │
│       PostgreSQL Client                                           │
│       ↓                                                            │
│       ❌ ERROR → Caught → Error logged (maybe truncated)          │
│       ↓                                                            │
│       Throws exception back up                                    │
└─────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database (Production)                  │
│  Host: 192.168.1.15:5432                                           │
│  Database: veritable_games                                         │
│  Schema: wiki                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ wiki_categories table:                                             │
│ ┌─────────────────────────────────────────────────────────┐        │
│ │ id | parent_id | name | description | color | icon | ...│       │
│ ├─────────────────────────────────────────────────────────┤        │
│ │journals  │ null     │Journal Entries│...                 │       │
│ │archive   │ null     │Archive        │...                 │       │
│ │tutorials │ null     │Tutorials      │...                 │       │
│ │library   │ null     │Library        │...                 │       │
│ └─────────────────────────────────────────────────────────┘        │
│                                                                     │
│ wiki_pages table:                                                  │
│ ┌───────────────────────────────────────────────────────┐          │
│ │ id │ slug │ title │ category_id │ status │ ...      │          │
│ ├───────────────────────────────────────────────────────┤          │
│ │ 42 │ my-first-journal │ ... │journals │published │ │          │
│ │ 43 │ another-page     │ ... │journals │published │ │          │
│ │ 44 │ tutorial-guide   │ ... │tutorials│published │ │          │
│ └───────────────────────────────────────────────────────┘          │
│                                                                     │
│ Relationships:                                                      │
│ - wiki_pages.category_id → wiki_categories.id (direct)            │
│ - wiki_page_categories (DEPRECATED junction table)                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## QUERY FLOW COMPARISON

### ✅ LOCALHOST (SQLite) - WORKS

```
Browser Request
  ↓
/wiki/category/journals
  ↓
getCategoryData('journals')
  ↓
SELECT c.*, COUNT(p.id)
FROM wiki_categories c
LEFT JOIN wiki_pages p ON c.id = p.category_id
WHERE c.id = 'journals'
GROUP BY c.id
  ↓
SQLite (LENIENT): Allows non-grouped columns
  ↓
✅ Result returned with full category record
  ↓
Page loads with category data
```

---

### ❌ PRODUCTION (PostgreSQL) - FAILS

```
Browser Request
  ↓
/wiki/category/journals
  ↓
getCategoryData('journals')
  ↓
SELECT c.*, COUNT(p.id)
FROM wiki_categories c
LEFT JOIN wiki_pages p ON c.id = p.category_id
WHERE c.id = 'journals'
GROUP BY c.id
  ↓
PostgreSQL (STRICT): Requires all non-aggregated columns in GROUP BY
  ↓
ERROR: "column c.parent_id must appear in the GROUP BY clause
        or be subject to an aggregate function"
  ↓
Exception thrown
  ↓
catch (error) in getCategoryData()
  ↓
Returns { category: null, ... }
  ↓
Page renders "Category Not Found" error
```

---

## API ENDPOINTS (Currently Working but Hidden Issues)

### GET /api/wiki/categories/[id]

**File**: `/app/api/wiki/categories/[id]/route.ts`

```
Browser Request → /api/wiki/categories/journals
    ↓
getCategoryHandler()
    ↓
wikiService.getCategoryById('journals')
    ↓
wikiCategoryService.getCategoryById('journals')
    ↓
dbAdapter.query(sql, [journalsId], { schema: 'wiki' })
    ↓
❌ Same GROUP BY error as before
    ↓
Exception caught in route
    ↓
Returns 404 or 500 error
```

**Note**: The API endpoints may also return errors. Verify during testing.

---

### GET /api/wiki/categories

**File**: `/app/api/wiki/categories/route.ts`

```
Browser Request → /api/wiki/categories
    ↓
getCategoriesHandler()
    ↓
wikiService.getCategories()
  → delegates to getAllCategories()
    ↓
wikiCategoryService.getAllCategories(userRole)
    ↓
dbAdapter.query(sql, [], { schema: 'wiki' })
    ↓
❌ Similar GROUP BY error
    ↓
Returns empty array [] on error
```

---

## ENVIRONMENT-SPECIFIC QUERIES

### What SQLite Does

SQLite allows this:
```sql
SELECT c.*, COUNT(p.id) as page_count
FROM wiki_categories c
LEFT JOIN wiki_pages p ON c.id = p.category_id
WHERE c.id = 'journals'
GROUP BY c.id;
```

When you `GROUP BY c.id`, SQLite returns the first row's values for non-grouped columns. This happens to work because there's only one row per category ID (PRIMARY KEY).

---

### What PostgreSQL Requires

PostgreSQL enforces standard SQL compliance:
```sql
-- ✅ CORRECT - All selected columns in GROUP BY
SELECT
  c.id,
  c.parent_id,
  c.name,
  c.description,
  c.color,
  c.icon,
  c.sort_order,
  c.created_at,
  c.is_public,
  COUNT(p.id) as page_count
FROM wiki_categories c
LEFT JOIN wiki_pages p ON c.id = p.category_id
WHERE c.id = 'journals'
GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at, c.is_public;
```

Or use aggregation functions:
```sql
-- Alternative: Aggregate all columns (less efficient)
SELECT
  c.id,
  FIRST(c.parent_id) as parent_id,
  FIRST(c.name) as name,
  ...
  COUNT(p.id) as page_count
FROM wiki_categories c
LEFT JOIN wiki_pages p ON c.id = p.category_id
WHERE c.id = 'journals'
GROUP BY c.id;
```

---

## CACHING LAYER

The service attempts to cache results, but disabled for testing:

```
WikiCategoryService.getAllCategories()
  │
  ├─ Check: cache.get('categories:all:admin')
  │          (TEMPORARILY DISABLED - see line 259-264)
  │
  ├─ Query database (❌ FAILS)
  │
  └─ Set: cache.set('categories:all:admin', result)
         (Never reached due to exception)
```

**Impact**: Caching is bypassed due to database error, so this isn't the issue.

---

## SEARCH INTEGRATION

CategoryQueryHelper is used for efficient searching:

```
WikiSearchService.searchPages(query)
  ↓
CategoryQueryHelper.getPagesInCategory(categoryId)
  ↓
Uses STRING_AGG for PostgreSQL (not GROUP_CONCAT)
  ↓
Requires proper GROUP BY clause
  ↓
Works correctly IF CategoryService.getCategoryById() works
```

**Problem**: Most queries in WikiCategoryService have issues first, preventing search from functioning properly.

---

## PAGE COUNT ACCURACY

Current approach (broken):
```sql
SELECT COUNT(DISTINCT p.id) as page_count
FROM wiki_categories c
LEFT JOIN wiki_pages p ON c.id = p.category_id
```

Issue: Returns count even when category_id NULL (LEFT JOIN issue).

Better approach:
```sql
SELECT COUNT(*) as page_count
FROM wiki_pages
WHERE category_id = $1 AND status = 'published'
```

This is actually already implemented in CategoryQueryHelper.getPageCountQuery() (lines 42-54) but not used by WikiCategoryService.

---

## VISIBILITY FILTERING LOGIC

Current hardcoded rules in multiple services:

1. **'library' category**: Admin/Moderator only
   ```typescript
   if (categoryId === 'library') {
     return userRole === 'admin' || userRole === 'moderator';
   }
   ```

2. **is_public field** (added but not fully integrated):
   ```typescript
   if (category.is_public === false) {
     return userRole === 'admin';
   }
   ```

3. **Access control in page queries**:
   ```typescript
   if (userRole !== 'admin') {
     query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`
   }
   ```

**Note**: The `is_public` column exists in schema but filtering is inconsistent across services.

---

## DATA CONSISTENCY CONCERNS

The system maintains two different ways to link pages to categories:

1. **Direct column** (Primary): `wiki_pages.category_id`
   - Used by most recent queries
   - Recommended approach
   - Single category per page

2. **Junction table** (Deprecated): `wiki_page_categories`
   - Used by legacy code
   - Multiple categories per page support
   - No longer maintained
   - Comments note it's deprecated (categoryQueryHelper.ts:8)

**Problem**: When creating pages, BOTH are populated (WikiPageService.ts:88-93):
```typescript
// Direct column
category_id = 'journals'

// Also junction table
INSERT INTO wiki_page_categories (page_id, category_id, added_at)
VALUES (pageId, categoryId, NOW())
```

This dual-write could cause inconsistencies if one is updated without the other.

---

## MIGRATION CONTEXT

The system was migrated from SQLite to PostgreSQL:

- Original: SQLite file-based (10 databases)
- Current: PostgreSQL 15 (13 schemas)
- Status: ~99.99% successful migration (50,646 rows)

The migration tool likely didn't catch the GROUP BY issue because:
1. DDL (schema) was migrated, not query logic
2. Migration test was probably on a single environment
3. SELECT * allows queries to work without explicit column lists
4. GROUP BY strictness difference is PostgreSQL-specific

---

## SUMMARY

The wiki category system has a **cascading failure** in PostgreSQL:

```
Production failure starts here:
    ↓
WikiCategoryService.getCategoryById()
    ↓
PostgreSQL GROUP BY violation
    ↓
Exception thrown
    ↓
Caught by category page route
    ↓
Page renders "Category Not Found"
    ↓
User sees broken feature
```

**Total affected methods**: 6 in WikiCategoryService
**Total affected endpoints**: 7 API routes + category page routes
**Root cause**: GROUP BY clause missing non-grouped columns
**Fix complexity**: Medium (need to update 6 methods, straightforward SQL fix)
**Testing difficulty**: Low (easy to verify - navigate to category pages)
