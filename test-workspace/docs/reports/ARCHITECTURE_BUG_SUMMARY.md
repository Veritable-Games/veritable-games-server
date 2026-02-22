# Architecture Bug Summary: Popular Pages Visibility Filter

**Analysis Complete**: November 13, 2025
**Severity**: HIGH (Security/Access Control)
**Status**: ROOT CAUSE IDENTIFIED - Ready for Fix

---

## One-Paragraph Executive Summary

The Popular Pages feature fails to filter wiki pages by category visibility (`is_public` field). While journals use user ownership to control access, Popular Pages use hardcoded category checks that miss hidden categories. The `WikiSearchService.getPopularPages()` method checks only `p.category_id != 'library'` instead of checking the `c.is_public` field from the `wiki_categories` table. This allows non-admin users to see pages from admin-only categories, bypassing the visibility control system that exists in the database but isn't being used.

---

## The Three Questions You Asked

### 1. Which Architectural Pattern Difference Causes the Bug?

**Journals (Working)**:
- User-scoped access control: `WHERE created_by = current_user_id`
- Database-level filter: WHERE clause filters at query time
- Implicit security: Owner = only person who can see

**Popular Pages (Broken)**:
- Category-scoped access control: Should filter by `c.is_public` field
- Split filtering: WHERE clause incomplete + component-level backup
- Broken pattern: Hardcoded category names instead of data-driven field

**Root Difference**: Journals use ownership model (WHO created it), Popular Pages should use visibility model (IS IT PUBLIC), but the visibility field isn't checked in the query.

### 2. Where Is the is_public Filter Supposed to Be?

**Currently**: Missing from ALL Popular Pages queries
- `WikiSearchService.getPopularPages()` - Line 218-225
- `WikiSearchService.getRecentPages()` - Line 286-289
- `WikiAnalyticsService.getRecentActivity()` - Line 129-131

**Should be**: In the WHERE clause of each query

```sql
WHERE p.status = 'published'
  AND p.namespace != 'journals'
  AND (
    p.category_id IS NULL
    OR c.is_public IS NULL
    OR c.is_public = true
    OR current_user_is_admin  -- Optional, based on userRole parameter
  )
```

### 3. Which Layer Should Filter?

**Current (Wrong)**: Database layer (incomplete) + Component layer (cleanup)
**Correct (Target)**: Database layer (complete) + Component layer (render only)

The database layer should return ONLY data the user is allowed to see. The component should never need to filter.

---

## Files With Code Locations

### Working Pattern: Journals
- **Fetch**: `/frontend/src/app/wiki/category/[id]/page.tsx` (Lines 42-83)
- **Query**: Direct SQL with `WHERE created_by = userId`
- **Pattern**: User-scoped, database-filtered, no service abstraction

### Broken Pattern: Popular Pages
- **Fetch**: `/frontend/src/app/wiki/page.tsx` (Line 26)
- **Service**: `/frontend/src/lib/wiki/services/WikiSearchService.ts` (Line 190-249)
- **Component**: `/frontend/src/components/wiki/WikiLandingTabs.tsx` (Lines 34-260)
- **Bug Location**: Line 224 in WikiSearchService.ts - Missing is_public check

### Correct Pattern Reference: Categories
- **Service**: `/frontend/src/lib/wiki/services/WikiCategoryService.ts` (Lines 303-311)
- **Pattern**: Filters by `category.is_public === false` to identify admin-only
- **This is what Popular Pages should copy**

---

## The Bug in Context

### Database Structure (What Exists)
```
wiki_categories
├── id (text)
├── name (text)
├── is_public (boolean)  // ← THIS FIELD EXISTS AND IS USED
└── ... other fields

wiki_pages
├── id (integer)
├── category_id (text) → references wiki_categories
├── status (published | archived)
├── namespace (journals | main)
└── ... other fields
```

The `is_public` field is:
- ✅ Defined in schema
- ✅ Used in WikiCategoryService.getAllCategories()
- ✅ Used in Category API endpoint
- ❌ NOT used in getPopularPages()
- ❌ NOT used in getRecentPages()
- ❌ NOT used in getRecentActivity()

### What Currently Happens
```
1. Non-admin user visits /wiki
2. Server calls WikiSearchService.getPopularPages(5, 'user')
3. Query executes:
   SELECT ... FROM wiki_pages p
   LEFT JOIN wiki_categories c ON p.category_id = c.id
   WHERE p.status = 'published'
     AND p.namespace != 'journals'
     AND (p.category_id IS NULL OR p.category_id != 'library')
     ↑↑↑ Only checks 'library', ignores is_public field
4. Returns pages from:
   - Public categories (correct)
   - 'archive' category (wrong - it has is_public = false)
   - Any custom hidden category (wrong)
5. Component renders all received pages (no filtering)
6. User sees admin-only pages
```

### What Should Happen
```
1. Non-admin user visits /wiki
2. Server calls WikiSearchService.getPopularPages(5, 'user')
3. Query executes:
   SELECT ... FROM wiki_pages p
   LEFT JOIN wiki_categories c ON p.category_id = c.id
   WHERE p.status = 'published'
     AND p.namespace != 'journals'
     AND (
       p.category_id IS NULL
       OR c.is_public IS NULL
       OR c.is_public = true
     )
     ↑↑↑ Checks is_public field
4. Returns pages from:
   - Public categories only (correct)
   - Null category pages (correct - backward compatible)
5. Component renders all received pages
6. User sees only appropriate pages
```

---

## Architectural Principles Violated

### 1. Single Responsibility Principle
- **Current**: Database + Service + Component all do filtering
- **Correct**: Database filters, Service passes through, Component renders

### 2. Data-Driven Design
- **Current**: Hardcoded category list ('library')
- **Correct**: Use database field that exists for this purpose (is_public)

### 3. DRY (Don't Repeat Yourself)
- **Current**: Same hardcoded 'library' check in 3 places
- **Correct**: One query pattern, use database metadata

### 4. Consistency
- **Current**: Categories use is_public filter (correct), Pages don't (wrong)
- **Correct**: All visibility checks use same pattern

### 5. Defense in Depth
- **Current**: Tries to use component layer as backup (but it doesn't work)
- **Correct**: Database layer is authoritative, component is presentation only

---

## Type Safety Issues

### WikiPage Type Missing Information
```typescript
// Current (Incomplete)
interface WikiPage {
  categories?: string[];      // Only category name
  category_ids?: string[];    // Only category ID
  // Missing: category object with is_public field
}

// Should be
interface WikiPage {
  category?: {
    id: string;
    name: string;
    is_public?: boolean;      // Add this
  };
  // Keep backward compat fields:
  categories?: string[];
  category_ids?: string[];
}
```

**Impact**: No way for component to verify visibility at render time (not that it should need to).

---

## The Fix (Three Methods)

### Fix #1: WikiSearchService.getPopularPages()
**File**: `/frontend/src/lib/wiki/services/WikiSearchService.ts` (Lines 222-225)

**Current**:
```typescript
if (userRole !== 'admin') {
  query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
}
```

**Fixed**:
```typescript
if (userRole !== 'admin' && userRole !== 'moderator') {
  query += ` AND (
    p.category_id IS NULL
    OR c.is_public IS NULL
    OR c.is_public = true
  )`;
}
```

### Fix #2: WikiSearchService.getRecentPages()
**File**: `/frontend/src/lib/wiki/services/WikiSearchService.ts` (Lines 286-289)

**Same change as Fix #1** (identical code pattern).

### Fix #3: WikiAnalyticsService.getRecentActivity()
**File**: `/frontend/src/lib/wiki/services/WikiAnalyticsService.ts` (Lines 129-131)

**Current**:
```typescript
WHERE ua.activity_type = 'wiki_edit'
  AND (ua.entity_type IN ('page', 'wiki', 'wiki_page') OR ua.entity_type IS NULL)
```

**Fixed**:
```typescript
WHERE ua.activity_type = 'wiki_edit'
  AND (ua.entity_type IN ('page', 'wiki', 'wiki_page') OR ua.entity_type IS NULL)
  AND wp.status = 'published'
  AND wp.namespace != 'journals'
  AND (
    wp.category_id IS NULL
    OR c.is_public IS NULL
    OR c.is_public = true
  )
```

---

## Testing the Fix

### Before Fix (Shows Bug)
1. Log in as admin
2. Create a page in a hidden category (e.g., mark a category as is_public = false)
3. Add some views to it
4. Log out, log in as regular user
5. Visit /wiki
6. Page appears in "Popular Pages" tab
7. **BUG CONFIRMED**: Non-admin sees admin-only page

### After Fix (Should Work)
1. Same setup
2. Regular user visits /wiki
3. Admin-only page does NOT appear in "Popular Pages"
4. **BUG FIXED**: Visibility enforced

---

## Why This Matters Architecturally

This bug demonstrates a critical principle: **Visibility control must be enforced at the data access layer (database), not at presentation layer (component).**

### Why Component Filtering Fails
1. Components are easy to bypass (client can modify requests)
2. Data caching can include unfiltered results
3. New callers might not know to apply the filter
4. Maintenance burden (repeat code in multiple places)

### Why Database Filtering Works
1. Enforced for all queries (no way to bypass)
2. Cache behavior is deterministic (filtered data stays filtered)
3. Single source of truth (WHERE clause is explicit)
4. No component knowledge needed (safe by default)

---

## Commit Message for Fix

```
fix: Add is_public visibility filter to popular/recent pages queries

The Popular Pages and Recent Pages endpoints were only checking for the
hardcoded 'library' category instead of checking the is_public field
on wiki_categories. This allowed non-admin users to see pages from
hidden categories.

Fixes visibility control by:
1. Adding c.is_public filter to WHERE clause in getPopularPages()
2. Adding c.is_public filter to WHERE clause in getRecentPages()
3. Adding visibility filters to getRecentActivity()

This enforces visibility at the database layer (correct) instead of
component layer (was incomplete).

Affected methods:
- WikiSearchService.getPopularPages()
- WikiSearchService.getRecentPages()
- WikiAnalyticsService.getRecentActivity()

Security impact: Non-admin users can no longer access hidden category pages.
```

---

## Document References

See also:
- `ARCHITECTURAL_COMPARISON_ANALYSIS.md` - Full 14-section architectural analysis
- `BUG_FIX_CODE_LOCATIONS.md` - Exact code locations and full code blocks
- `/frontend/src/lib/wiki/services/WikiCategoryService.ts` - Reference for correct pattern

---

## Key Takeaway

**Journal filtering works because it uses ownership (a user-level property).**
**Popular pages fail because they should use visibility (a category-level property) but don't check the field that defines it.**

The fix: Check the `is_public` field that already exists in the database and is already used elsewhere in the codebase. Make the code consistent with itself.
