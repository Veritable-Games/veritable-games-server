# Wiki Category vs Individual Page Route Analysis

## Problem Summary

**Working Route**: `/wiki/[slug]` → Individual wiki page renders successfully
**Broken Route**: `/wiki/category/[id]` → Returns "Category Not Found" error

Both routes use PostgreSQL-backed services, but one succeeds while the other fails. This analysis identifies the architectural differences causing the failure.

---

## 1. ROUTE STRUCTURE COMPARISON

### Working Individual Page Route
**File**: `/frontend/src/app/wiki/[slug]/page.tsx`

```
Data Flow:
  [slug]/page.tsx
      ↓
  getWikiPageData(slug)
      ↓
  parseWikiSlug(slug)                    ← Parse namespace from slug
      ↓
  wikiPageService.getPageBySlug()        ← From WikiPageService (refactored)
      ↓
  dbAdapter.query(..., { schema: 'wiki' })  ← Uses schema parameter
      ↓
  Success: Renders WikiPageView component
```

**Key Characteristics**:
- Uses `wikiPageService` directly from refactored services
- Proper error handling with `notFound()`
- Explicitly specifies `{ schema: 'wiki' }` in all database calls
- Handles namespace parsing for compound slugs (e.g., "library/doom-bible")

---

### Broken Category Page Route
**File**: `/frontend/src/app/wiki/category/[id]/page.tsx`

```
Data Flow:
  [id]/page.tsx
      ↓
  getCategoryData(categoryId)
      ↓
  new WikiService()                      ← Creates new instance (anti-pattern!)
      ↓
  wikiService.getCategoryById(categoryId)
      ↓
  factory.categories.getCategoryById()
      ↓
  dbAdapter.query(..., { schema: 'wiki' })
      ↓
  Throws: Error(`Category not found: "${categoryId}"`)
      ↓
  Caught by try/catch → returns { category: null, ... }
      ↓
  Renders "Category Not Found" error page
```

**Key Characteristics**:
- Creates NEW instance: `new WikiService()` instead of importing singleton
- Uses deprecated backward-compatibility wrapper (WikiService)
- Goes through 2-3 layers of indirection (WikiService → factory → wikiCategoryService)
- Proper error handling with try/catch → null return

---

## 2. THE ROOT CAUSE: Database Query Issue

### Individual Page Query (WORKING)
**File**: `WikiPageService.ts:509-527`

```typescript
async getPageBySlug(slug: string, namespace: string = 'main'): Promise<WikiPage> {
  const result = await dbAdapter.query(
    `SELECT
      p.*,
      r.content,
      r.content_format,
      r.size_bytes,
      c.id as category_id,
      c.name as category_name,
      COALESCE(SUM(pv.view_count), 0) as total_views
    FROM wiki_pages p
    LEFT JOIN wiki_revisions r ON p.id = r.page_id
      AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = p.id)
    LEFT JOIN wiki_categories c ON p.category_id = c.id
    LEFT JOIN wiki_page_views pv ON p.id = pv.page_id
    WHERE p.slug = $1 AND p.namespace = $2
    GROUP BY p.id, r.content, r.content_format, r.size_bytes, c.id, c.name`,
    [slug, namespace],
    { schema: 'wiki' }  ← SCHEMA SPECIFIED
  );
}
```

**What This Query Does**:
- Targets: `wiki_pages` table (primary)
- Joins: `wiki_revisions`, `wiki_categories`, `wiki_page_views`
- GROUP BY handles all non-aggregated columns
- Returns categories data EMBEDDED in page result
- Throws error message: `Page not found: slug="${slug}", namespace="${namespace}"`

---

### Category Query (BROKEN)
**File**: `WikiCategoryService.ts:224-239`

```typescript
async getCategoryById(categoryId: string): Promise<WikiCategory> {
  const result = await dbAdapter.query(
    `SELECT
      c.*,
      COUNT(p.id) as page_count
    FROM wiki_categories c
    LEFT JOIN wiki_pages p ON c.id = p.category_id
    WHERE c.id = $1
    GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at`,
    [categoryId],
    { schema: 'wiki' }  ← SCHEMA SPECIFIED (this part is correct)
  );

  if (result.rows.length === 0) {
    throw new Error(`Category not found: "${categoryId}"`);  ← THROWS HERE
  }
}
```

**What This Query Does**:
- Targets: `wiki_categories` table
- Joins: `wiki_pages` (to count pages in category)
- GROUP BY specifies all required columns
- Throws error: `Category not found: "${categoryId}"`

**🔴 THE PROBLEM: Query is syntactically correct, but no categories exist in the database!**

---

## 3. DATABASE STATE ISSUE

### Missing Data Root Cause

The query `wikiService.getCategoryById('autumn')` throws an error because:

1. **The category 'autumn' does not exist in `wiki_categories` table**
2. Unlike individual pages which are auto-created, categories must be explicitly created
3. WikiPageService has safeguards that auto-categorize new pages, but those categories need to exist first

### Evidence

Looking at `WikiCategoryService.createCategory()` (lines 15-65):
```typescript
// Validates parent_id exists
// Validates no duplicate category ID
// Creates category with explicit ID: data.id
```

The categories are keyed by ID string (e.g., 'autumn', 'cosmic-knights'), not auto-generated.

### Why Individual Pages Work but Categories Don't

**Individual Pages**:
- Created dynamically via API
- Auto-categorize themselves (lines 100-107 in WikiPageService)
- Can work even with minimal category data
- Fallback to 'uncategorized' if no category provided

**Categories**:
- Must be pre-created in `wiki_categories` table
- No auto-creation mechanism
- Route expects category to already exist in database
- No fallback if category doesn't exist

---

## 4. ARCHITECTURAL DIFFERENCES COMPARISON

| Aspect | Individual Page | Category |
|--------|-----------------|----------|
| **Route File** | `/wiki/[slug]/page.tsx` | `/wiki/category/[id]/page.tsx` |
| **Service Usage** | Direct: `wikiPageService` | Indirect: `new WikiService()` wrapper |
| **Service Instance** | Singleton imported | New instance created |
| **Error Handling** | Uses `notFound()` | Try/catch → null |
| **Data Fetching** | Direct call to service | Parallel Promise.all() |
| **Database Assumptions** | Page might not exist (OK) | Category must exist (FAILS) |
| **Schema Specification** | ✓ Explicit `{ schema: 'wiki' }` | ✓ Explicit `{ schema: 'wiki' }` |
| **Query Complexity** | 4 JOINs + subquery | 1 JOIN |
| **Error Message** | Page not found + 404 | Category not found + custom page |
| **Success Path** | Direct rendering | Client component rendering |

---

## 5. QUERY ANALYSIS IN DETAIL

### The Critical Difference

**Individual Page Query Issues**:
- The `GROUP BY` includes: `p.id, r.content, r.content_format, r.size_bytes, c.id, c.name`
- With LEFT JOINs, PostgreSQL requires these columns in GROUP BY
- ✓ CORRECT: Handles aggregate function `SUM(pv.view_count)`

**Category Query Issues**:
- The `GROUP BY` includes: `c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at`
- ✓ CORRECT: All non-aggregated columns specified
- ✓ CORRECT: Uses `COUNT(p.id)` aggregate

**Neither query has syntax errors! The problem is DATA, not queries.**

---

## 6. ERROR HANDLING COMPARISON

### Individual Page (Working Flow)
```typescript
async function getWikiPageData(slug: string) {
  try {
    const page = await wikiPageService.getPageBySlug(actualSlug, namespace);

    if (!page) {
      return null;  // Returns null on missing page
    }
    return { page, allTags };
  } catch (error) {
    console.error('Error fetching wiki page:', error);
    return null;  // Catches errors, returns null
  }
}

// In page component
const data = await getWikiPageData(slug);
if (!data) {
  notFound();  // Uses Next.js notFound() → 404 page
}
```

### Category Page (Broken Flow)
```typescript
async function getCategoryData(categoryId: string) {
  const wikiService = new WikiService();

  try {
    const [category, pages] = await Promise.all([
      wikiService.getCategoryById(categoryId),  // Throws on category not found
      wikiService.getAllPages(categoryId),
    ]);
    return { category, pages, subcategories };
  } catch (error) {
    console.error('Error loading category data:', error);
    return { category: null, pages: [], subcategories: [] };  // Returns null
  }
}

// In page component
const { category, pages, subcategories } = await getCategoryData(id);

if (!category) {
  return (
    <div>
      <UnifiedSearchHeader title="Category Not Found" ... />
      {/* Custom error page */}
    </div>
  );
}
```

**Both error paths converge on: "Category/Page doesn't exist" → Show error UI**

---

## 7. SERVICE ARCHITECTURE ISSUE

### The Wrapper Pattern Problem

**Location**: `/frontend/src/app/wiki/category/[id]/page.tsx:17`

```typescript
async function getCategoryData(categoryId: string) {
  const wikiService = new WikiService();  // ❌ ANTI-PATTERN: New instance

  try {
    const [category, pages] = await Promise.all([
      wikiService.getCategoryById(categoryId),
      wikiService.getAllPages(categoryId),
    ]);
  }
}
```

**Better Approach** (used in individual page):

```typescript
// Individual page imports singleton
import { wikiPageService } from '@/lib/wiki/services';

async function getWikiPageData(slug: string) {
  const page = await wikiPageService.getPageBySlug(actualSlug, namespace);
}
```

**Why This Matters**:
1. `new WikiService()` creates a factory instance which creates a factory instance (nested factories)
2. Bypasses any singleton benefits
3. Adds 2 layers of indirection: WikiService → WikiServiceFactory → wikiCategoryService
4. Individual page uses direct import: 0 layers of indirection

---

## 8. THE MISSING PIECE: Category Initialization

### What Needs to Exist in Database

For `/wiki/category/autumn` to work:

```sql
-- Must have entry in wiki_categories table
INSERT INTO wiki_categories (id, name, parent_id, description, color, icon, sort_order)
VALUES ('autumn', 'Autumn', NULL, 'Autumn category', '#D2691E', NULL, 0);
```

### Current State

Looking at route handler (lines 88-92):

```typescript
// Redirect library category to the main library page
if (id === 'library') {
  redirect('/library');
}

// Special handling for journals category
if (id === 'journals') {
  // ...
}
```

Hard-coded redirects exist for special categories ('library', 'journals'), but no initialization of other categories.

---

## 9. QUERY EXECUTION COMPARISON

### Individual Page Query Execution
```
SELECT ... FROM wiki_pages p
LEFT JOIN wiki_revisions r ON ...
LEFT JOIN wiki_categories c ON p.category_id = c.id
LEFT JOIN wiki_page_views pv ON ...
WHERE p.slug = ? AND p.namespace = ?
GROUP BY p.id, ...

Returns: Rows for matching page(s)
         Category info embedded if page has category_id
         View count aggregated
         Error if no rows found
```

### Category Query Execution
```
SELECT c.*, COUNT(p.id) as page_count
FROM wiki_categories c
LEFT JOIN wiki_pages p ON c.id = p.category_id
WHERE c.id = ?
GROUP BY c.id, c.parent_id, ...

Returns: Row with category info + page count (0 if no pages)
         Error if no rows found (category doesn't exist)
```

**The issue**: Category query returns 0 rows because 'autumn' category was never created.

---

## 10. SIDE-BY-SIDE COMPARISON TABLE

| Component | Individual Page | Category Page | Status |
|-----------|-----------------|---------------|--------|
| **Service Access Pattern** | `import wikiPageService` | `new WikiService()` | Category is anti-pattern |
| **Service Layers** | 0 (direct) | 3 (wrapper → factory → service) | Category is indirect |
| **Database Schema** | `{ schema: 'wiki' }` | `{ schema: 'wiki' }` | Both correct |
| **Query Type** | Complex with JOINs | Simple with JOIN | Both valid |
| **Data Requirement** | Page in database | Category in database | Category missing |
| **Error Handling** | catch → return null | catch → return null | Both similar |
| **Route Fallback** | `notFound()` → 404 | Custom error page | Both handle it |
| **Root Cause of Failure** | N/A (works) | Missing category data | **DATA ISSUE** |

---

## ROOT CAUSE SUMMARY

The broken category route fails because:

1. **Primary Issue**: The category 'autumn' (and other categories) don't exist in the `wiki_categories` table
   - Query is correct
   - Schema parameter is correct
   - Database connection works (individual pages prove this)
   - Categories simply weren't created

2. **Secondary Issue**: Poor service architecture in category page
   - Uses `new WikiService()` instead of singleton import
   - Adds unnecessary wrapper indirection
   - Individual page uses superior pattern

3. **Why Individual Pages Work**:
   - Pages are created dynamically (API routes handle creation)
   - Pages auto-categorize themselves
   - Pages have fallback ('uncategorized') if category missing
   - Service architecture is superior (singleton, direct access)

---

## RECOMMENDED FIX APPROACH

### Fix Strategy (Two-Part)

**Part 1: Fix Service Architecture** (Best Practice)
- Change from `new WikiService()` to `import { wikiCategoryService }`
- Removes unnecessary wrapper indirection
- Matches pattern used in individual page route

**Part 2: Initialize Categories** (Data Layer)
- Create categories in database before use
- Could be done via migration or seed script
- Ensure 'autumn', 'cosmic-knights', etc. exist as rows in `wiki_categories`

### Implementation Priority
1. **High**: Add category initialization (data issue is blocking)
2. **Medium**: Refactor service architecture (best practice alignment)
3. **Low**: Error message improvements (not blocking)

---

## KEY FINDINGS

### What Works
- ✓ PostgreSQL adapter correctly uses `{ schema: 'wiki' }`
- ✓ Individual page query with 4 JOINs + subquery executes properly
- ✓ Category query syntax is correct
- ✓ Error handling catches missing data appropriately

### What Doesn't Work
- ❌ Categories don't exist in database (data layer issue)
- ❌ Category page uses `new WikiService()` anti-pattern
- ❌ No category initialization mechanism
- ❌ Service architecture inconsistency between routes

### The Architectural Difference
The individual page route works because:
1. It uses superior service architecture (direct singleton import)
2. It has auto-categorization fallback
3. It doesn't require pre-existing category data

The category page fails because:
1. It depends on pre-existing categories in database
2. Categories were never initialized
3. It uses inferior service architecture (wrapper pattern)
