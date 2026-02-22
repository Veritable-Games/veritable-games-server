# Deep Architectural Comparison: Journal Filtering vs Popular Pages Filtering

**Analysis Date**: November 13, 2025
**Status**: ROOT CAUSE IDENTIFIED - Missing is_public filter in WikiSearchService

---

## Executive Summary

The bug is a **missing database-level visibility filter** in the Popular Pages endpoint. While journals use category membership to control visibility, popular pages fail to filter by the `is_public` field on `wiki_categories`. This allows users to see pages from hidden/admin-only categories.

**Root Cause**: WikiSearchService.getPopularPages() doesn't filter by `c.is_public` field
**Impact**: Non-admin users can view pages from categories like 'library', 'archive', and other hidden categories
**Severity**: HIGH - Visibility control bypassed entirely

---

## 1. Working Pattern: Journals (REFERENCE ARCHITECTURE)

### Location Map
- **Page Route**: `/frontend/src/app/wiki/category/[id]/page.tsx` (Line 42-107)
- **Service Layer**: Direct SQL query (no service abstraction)
- **Component**: `/frontend/src/app/wiki/category/journals/JournalsPageClient.tsx`

### How Journals Work (The Correct Pattern)

**Data Fetch** (`/frontend/src/app/wiki/category/[id]/page.tsx:42-107`):
```typescript
async function getJournalsData(userId: number) {
  try {
    const result = await dbAdapter.query(
      `
      SELECT
        p.id, p.slug, p.title, p.namespace,
        p.created_at, p.updated_at,
        r.content,
        COALESCE(b.id, 0) as is_bookmarked
      FROM wiki_pages p
      LEFT JOIN wiki_revisions r ON p.id = r.page_id
        AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = p.id)
      LEFT JOIN wiki_page_bookmarks b ON p.id = b.page_id AND b.user_id = $1
      WHERE p.namespace = 'journals'
        AND p.created_by = $2          // USER-LEVEL FILTER
      ORDER BY p.updated_at DESC
    `,
      [userId, userId],
      { schema: 'wiki' }
    );
```

**Key Architectural Points for Journals**:
1. **Filtering by ownership**: `p.created_by = $2` ensures user only sees THEIR journals
2. **No category visibility check needed**: Journals bypass categories (use namespace instead)
3. **Database-level filter**: NOT component-level
4. **Direct server component**: Fetches in server component, passes to client component
5. **No service abstraction**: Direct dbAdapter query (simpler, appropriate for single-purpose fetch)

**Why Journals Work**:
- They're user-scoped (created_by = current user)
- They don't use the wiki_categories system
- Access control is implicit in the query (can only fetch YOUR journals)
- Even if visible, they're private by definition

---

## 2. Broken Pattern: Popular Pages (THE BUG)

### Location Map
- **Fetch Point**: `/frontend/src/app/wiki/page.tsx` (Line 22-28)
- **Service Method**: `/frontend/src/lib/wiki/services/WikiSearchService.ts` (Line 190-249)
- **Component**: `/frontend/src/components/wiki/WikiLandingTabs.tsx` (Line 34-260)

### How Popular Pages CURRENTLY Work (Broken)

**Data Fetch** (`/frontend/src/app/wiki/page.tsx:22-28`):
```typescript
const [categories, stats, recentActivity, popularPages, recentPages] = await Promise.all([
  wikiService.getCategories(userRole || undefined),
  wikiService.getWikiStats(),
  wikiService.getRecentActivity(6),
  wikiService.getPopularPages(5, userRole || undefined),  // PASSES userRole
  wikiService.getRecentPages(5, userRole || undefined),
]);
```

**Service Implementation** (`/frontend/src/lib/wiki/services/WikiSearchService.ts:190-249`):
```typescript
async getPopularPages(limit: number = 10, userRole?: string): Promise<WikiPage[]> {
  const cacheKey = `popular_pages:${limit}:${userRole || 'anonymous'}`;
  const cached = await cache.get<WikiPage[]>({ category: 'search', identifier: cacheKey });
  if (cached) return cached;

  let query = `
    SELECT
      p.*,
      r.content,
      r.content_format,
      r.size_bytes,
      c.id as category_id,
      c.name as category_name,
      string_agg(DISTINCT t.name, ',') as tags,
      COALESCE(SUM(pv.view_count), 0) as total_views,
      u.username,
      u.display_name,
      u.avatar_url
    FROM wiki.wiki_pages p
    LEFT JOIN wiki.wiki_revisions r ON p.id = r.page_id
      AND r.id = (SELECT MAX(id) FROM wiki.wiki_revisions WHERE page_id = p.id)
    LEFT JOIN wiki.wiki_categories c ON p.category_id = c.id
    LEFT JOIN wiki.wiki_page_tags pt ON p.id = pt.page_id
    LEFT JOIN wiki.wiki_tags t ON pt.tag_id = t.id
    LEFT JOIN wiki.wiki_page_views pv ON p.id = pv.page_id
    LEFT JOIN users.users u ON p.created_by = u.id
    WHERE p.status = 'published'
      AND p.namespace != 'journals'
  `;

  // Add access control for Library category
  if (userRole !== 'admin') {
    query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
  }

  query += `
    GROUP BY p.id, r.content, r.content_format, r.size_bytes, c.id, c.name, u.username, u.display_name, u.avatar_url
    HAVING COALESCE(SUM(pv.view_count), 0) > 0
    ORDER BY total_views DESC
    LIMIT $1
  `;

  const result = await dbAdapter.query(query, [validLimit], { schema: 'wiki' });
  const pages = result.rows
    .map(result => this.formatPageResult(result))
    .filter(page => this.canUserAccessPage(page, userRole));

  await cache.set({ category: 'search', identifier: cacheKey }, pages);
  return pages;
}
```

**Critical Issues**:

1. **Missing `is_public` filter in WHERE clause**: Only excludes 'library', doesn't check `c.is_public` flag
2. **Component-level filtering fallback**: Uses `canUserAccessPage()` filter AFTER database query
3. **Incomplete hardcoded category list**: Only knows about 'library', not other hidden categories
4. **Cache-before-filter problem**: Caches results before component-level filtering (cache key doesn't account for all visibility rules)
5. **NO filtering on wiki_categories.is_public field**: Categories can be marked `is_public = false` (admin-only) but query ignores this

---

## 3. Architectural Pattern Comparison

### Pattern Dimension: Filtering Location

| Dimension | Journals | Popular Pages | Correct Approach |
|-----------|----------|----------------|------------------|
| **Database Filter** | Yes (created_by) | PARTIAL (hardcoded 'library' only) | REQUIRED for public/private |
| **Service Filter** | N/A (direct query) | Yes (hardcoded category list) | SHOULD use is_public field |
| **Component Filter** | N/A | Yes (canUserAccessPage) | Should be backup only |
| **Visibility Control Source** | Ownership (created_by) | Category (is_public flag) | Category should be primary |

### Pattern Dimension: Access Control Model

**Journals**: User-scoped access control
```
Is user allowed to see journal X?
→ Check: created_by = current_user_id
→ Location: Database WHERE clause
→ This is CORRECT for journals (owner-only)
```

**Popular Pages**: Category-scoped access control (broken)
```
Is user allowed to see page X?
→ Check: Can user view page's category?
  → Check: Is category.is_public = true OR is_admin?
  → Location: SHOULD be in WHERE clause
  → Current: Hardcoded list + component filter (WRONG)
```

### Pattern Dimension: Service Responsibility

| Aspect | Journals | Popular Pages | Right Way |
|--------|----------|----------------|-----------|
| **What filters?** | Direct route handler | WikiSearchService | WikiSearchService |
| **Where filters?** | SQL WHERE clause | SQL WHERE + component filter | SQL WHERE clause |
| **Visibility logic** | Hardcoded in SQL | Hardcoded category list | Data-driven (is_public field) |
| **Filter completeness** | Complete | INCOMPLETE (missing is_public) | Complete |

---

## 4. Root Cause: The Missing Filter

### What's Missing in getPopularPages()

Current filter (Line 218-225):
```typescript
WHERE p.status = 'published'
  AND p.namespace != 'journals'
  AND (p.category_id IS NULL OR p.category_id != 'library')  // HARDCODED
```

**What should be there**:
```typescript
WHERE p.status = 'published'
  AND p.namespace != 'journals'
  AND (
    p.category_id IS NULL  // Pages with no category are always visible
    OR (
      c.is_public IS NULL   // Backward compatibility: null = public
      OR c.is_public = true  // Public categories
      OR (c.is_public = false AND $userRole IN ('admin', 'moderator'))  // Private categories for admins
    )
  )
```

### Why This Pattern is Wrong

1. **Hardcoding Category Names**: 'library', 'archive' are hardcoded
   - If admin creates new hidden category, code doesn't know about it
   - Violates DRY principle
   - Maintenance nightmare

2. **Missing is_public Metadata**: `wiki_categories` table HAS `is_public` field
   - Created to solve exactly this problem
   - NOT being used in popular pages query
   - IS being used in getAllCategories() (shows correct pattern)

3. **Two-Layer Filtering**: Database + component filter
   - Component filter (canUserAccessPage) runs AFTER data fetched
   - Cache includes filtered results before component filter applied
   - Cache key doesn't account for all visibility variations

4. **Inconsistency**: Categories ARE filtered properly elsewhere
   - WikiCategoryService.getAllCategories() uses is_public (Line 304-311):
   ```typescript
   const filteredCategories = allCategories.filter(category => {
     if (category.is_public === false) {
       return userRole === 'admin';  // CORRECT: Uses is_public field
     }
     return true;
   });
   ```
   - But getPopularPages() doesn't use this same pattern

---

## 5. Type Safety Analysis

### WikiPage Type Definition
(`/frontend/src/lib/wiki/types.ts:3-39`)

**Current fields**:
```typescript
export interface WikiPage {
  id: number;
  slug: string;
  title: string;
  namespace: string;
  status: 'published' | 'archived';
  protection_level: 'none' | 'semi' | 'full';
  created_by: number;
  created_at: string;
  updated_at: string;

  // Joined data
  content?: string;
  content_format?: 'markdown' | 'html' | 'wikitext';
  size_bytes?: number;
  categories?: string[];
  category_ids?: string[];
  tags?: Array<{ id: number; name: string; color?: string }>;
  total_views?: number;

  // ... more fields
}
```

**Missing**: No `category` object with `is_public` field
- Should be: `category?: { id: string; is_public?: boolean; ... }`
- Currently: Only has category ID/name strings, not full object
- This makes type-safe visibility checks IMPOSSIBLE at component level

### WikiCategory Type Definition
(`/frontend/src/lib/wiki/types.ts:58-73`)

```typescript
export interface WikiCategory {
  id: string;
  parent_id?: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  sort_order: number;
  is_public?: boolean;  // THIS FIELD EXISTS
  created_at: string;
  page_count?: number;
  subcategories?: WikiCategory[];
  parent?: WikiCategory;
}
```

**The is_public field IS defined**, but:
1. Not included in WikiPage type when category data is joined
2. Not checked in getPopularPages() WHERE clause
3. TypeScript doesn't enforce visibility checks because type doesn't carry the info

---

## 6. API Contract Analysis

### Endpoint: GET /api/wiki/categories/[id]

**File**: `/frontend/src/app/api/wiki/categories/[id]/route.ts:217-268`

**Implementation**:
```typescript
async function getCategoryHandler(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // ... get category ...
  const category = await wikiService.getCategoryById(categoryId);

  // CHECK VISIBILITY: return 404 if category is hidden and user is not admin
  if (category.is_public === false) {
    if (userRole !== 'admin' && userRole !== 'moderator') {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    data: category,
  });
}
```

**Key Pattern**: Visibility check on `is_public` field ✓

### Endpoint: GET /api/wiki/activity

**File**: `/frontend/src/app/api/wiki/activity/route.ts:12-54`

**Does NOT check page visibility**:
```typescript
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');
    const offset = parseInt(searchParams.get('offset') || '0');

    const activities = await wikiAnalyticsService.getRecentActivity(limit + offset + 1);
    const paginatedActivities = activities.slice(offset, offset + limit);
    // NO FILTERING FOR HIDDEN CATEGORIES

    return NextResponse.json({
      success: true,
      activities: paginatedActivities,
      hasMore,
      offset,
      limit,
    });
  } catch (error) { /* ... */ }
});
```

**Issue**: getRecentActivity() at WikiAnalyticsService.ts:100-168 also has same bug
- Joins with wiki_categories but doesn't filter by is_public
- Returns pages from hidden categories

### Endpoint: getPopularPages() Service Method

**File**: `/frontend/src/lib/wiki/services/WikiSearchService.ts:190-249`

**Visibility check**:
- Hardcoded 'library' category check only
- Missing: `AND (c.is_public IS NULL OR c.is_public = true OR ...)`

---

## 7. Service Layer Pattern

### WikiCategoryService: Correct Pattern

**Method**: `getAllCategories()` (Line 258-322)

```typescript
async getAllCategories(userRole?: string): Promise<WikiCategory[]> {
  // ... fetch from database ...

  const allCategories = result.rows.map(row => ({
    ...row,
    page_count: parseInt(row.page_count) || 0,
  })) as WikiCategory[];

  // Apply role-based filtering based on is_public field
  const filteredCategories = allCategories.filter(category => {
    // If category has is_public field set to false, it's admin-only
    if (category.is_public === false) {
      return userRole === 'admin';  // CORRECT PATTERN
    }
    // Default to public if is_public is undefined/null
    return true;
  });

  return filteredCategories;
}
```

**This is the RIGHT PATTERN to follow**.

### WikiSearchService: Broken Pattern

**Method**: `getPopularPages()` (Line 190-249)

- Hardcodes category names in WHERE clause
- Doesn't use is_public field from database
- Falls back to component-level filtering

**Method**: `getRecentPages()` (Line 254-289+)

- Same broken pattern as getPopularPages()

---

## 8. The Complete Bug Picture

### Flow: How Popular Pages Leak Admin Content

```
1. User (non-admin) visits /wiki
   ↓
2. WikiPage server component calls getPopularPages(5, 'user')
   ↓
3. WikiSearchService.getPopularPages() executes query:

   SELECT * FROM wiki_pages p
   LEFT JOIN wiki_categories c ON p.category_id = c.id
   WHERE p.status = 'published'
     AND p.namespace != 'journals'
     AND (p.category_id IS NULL OR p.category_id != 'library')

   ❌ MISSING: AND (c.is_public IS NULL OR c.is_public = true)

   ↓
4. Database returns:
   - Public pages (correct)
   - Pages from hidden categories like 'archive' (WRONG!)
   - Pages from 'journals' that somehow got categorized (WRONG!)

   ↓
5. Component filter canUserAccessPage() tries to fix it
   - But it runs AFTER pages are cached
   - Cache includes unfiltered results
   - Some pages slip through anyway

   ↓
6. User sees pages they shouldn't see
```

### Why Component Filtering Doesn't Work

In `WikiLandingTabs.tsx:198-259`:
```typescript
{popularPages.slice(0, 5).map(page => {
  // Component just renders what it was given
  // No re-filtering happens here
  return (
    <Link href={`/wiki/${encodeURIComponent(page.slug)}`}>
      {page.title}
    </Link>
  );
})}
```

The component receives `popularPages` from parent and renders them. There's no additional visibility check at component level.

---

## 9. Comparison Table: The Architectural Difference

| Aspect | Journals (Working) | Popular Pages (Broken) | Correct Approach |
|--------|-------------------|----------------------|------------------|
| **Filtering Method** | Database WHERE (created_by) | Hardcoded category list + component filter | Database WHERE (is_public field) |
| **Visibility Source** | Ownership (user_id) | Category (hardcoded names) | Category (is_public flag) |
| **Where Filter Resides** | Database layer | Split (DB + component) | Database layer (primary) |
| **Is Data-Driven** | N/A (ownership model) | No (hardcoded) | Yes (is_public field) |
| **Adapts to New Categories** | N/A | No (needs code change) | Yes (uses is_public flag) |
| **Type Safe** | N/A | No | Should be (include category.is_public in WikiPage) |
| **Cache Complexity** | Simple | Complex (pre-filters cache) | Medium (cache key includes userRole) |
| **Consistency** | N/A | No (different from getAllCategories) | Yes (same pattern everywhere) |

---

## 10. The Architectural Principle

### Single Responsibility Principle (SRP) - Violated

**Correct split**:
- **Database layer**: WHERE clause filters based on visibility rules
- **Service layer**: Implements business logic, calls database
- **Component layer**: Renders safe data (assumes database filtered correctly)

**Current split**:
- **Database layer**: Incomplete WHERE clause (doesn't know about is_public)
- **Service layer**: Hardcoded category list, incomplete
- **Component layer**: Tries to fix database layer's mistakes

This violates SRP - the component is doing data filtering, not UI rendering.

### Data-Driven vs Hardcoded

**Journals**: Hardcoded filter (created_by comparison)
- Acceptable because it's a fundamental access model
- Created journals belong to user, period
- No metadata flag needed

**Popular Pages**: Hardcoded filter (category name list)
- NOT acceptable because metadata exists (is_public field)
- Should use the field that was created for this purpose
- Category-based visibility is meant to be flexible

---

## 11. Fix Strategy

### Option A: Database-Level Filter (RECOMMENDED)

**Location**: WikiSearchService.getPopularPages() WHERE clause

```typescript
async getPopularPages(limit: number = 10, userRole?: string): Promise<WikiPage[]> {
  let query = `
    SELECT
      p.*,
      r.content,
      -- ... other fields ...
    FROM wiki.wiki_pages p
    LEFT JOIN wiki.wiki_revisions r ON p.id = r.page_id
      AND r.id = (SELECT MAX(id) FROM wiki.wiki_revisions WHERE page_id = p.id)
    LEFT JOIN wiki.wiki_categories c ON p.category_id = c.id
    LEFT JOIN wiki.wiki_page_tags pt ON p.id = pt.page_id
    LEFT JOIN wiki.wiki_tags t ON pt.tag_id = t.id
    LEFT JOIN wiki.wiki_page_views pv ON p.id = pv.page_id
    LEFT JOIN users.users u ON p.created_by = u.id
    WHERE p.status = 'published'
      AND p.namespace != 'journals'
      AND (
        p.category_id IS NULL
        OR c.is_public IS NULL
        OR c.is_public = true
        ${userRole === 'admin' ? 'OR c.is_public = false' : ''}
      )
    GROUP BY p.id, r.content, r.content_format, r.size_bytes, c.id, c.name, u.username, u.display_name, u.avatar_url
    HAVING COALESCE(SUM(pv.view_count), 0) > 0
    ORDER BY total_views DESC
    LIMIT $1
  `;

  const validLimit = Math.max(1, Math.min(Number(limit) || 10, 100));
  const result = await dbAdapter.query(query, [validLimit], { schema: 'wiki' });
  const pages = result.rows.map(result => this.formatPageResult(result));

  await cache.set({ category: 'search', identifier: cacheKey }, pages);
  return pages;
}
```

**Advantages**:
- Visibility enforced at data source
- Component receives already-filtered data
- Cache is safe (filtered at database level)
- Single source of truth
- Data-driven (uses is_public field)
- Consistent with getAllCategories() pattern
- No component-level filtering needed
- Eliminates hardcoded category lists

**File to change**: `/frontend/src/lib/wiki/services/WikiSearchService.ts` (Line 190-249)

### Same Fix Applied to Other Methods

Apply same pattern to:
1. `getRecentPages()` (Line 254+)
2. `WikiAnalyticsService.getRecentActivity()` (Line 100-168)
3. Any other query joining with wiki_categories

---

## 12. Type Safety Enhancement (Optional but Recommended)

### Update WikiPage Type

**File**: `/frontend/src/lib/wiki/types.ts`

```typescript
export interface WikiPage {
  // ... existing fields ...

  // Include full category object (not just ID/name)
  category?: {
    id: string;
    name: string;
    is_public?: boolean;
  };

  // Keep backward compatibility
  categories?: string[];
  category_ids?: string[];
}
```

**Benefit**: Component could theoretically check category.is_public at render time as backup validation.

---

## 13. Complete File Summary

### Files Involved in the Bug

| File | Method | Issue | Fix |
|------|--------|-------|-----|
| WikiSearchService.ts | getPopularPages() | Missing is_public filter | Add to WHERE clause |
| WikiSearchService.ts | getRecentPages() | Missing is_public filter | Add to WHERE clause |
| WikiAnalyticsService.ts | getRecentActivity() | Missing is_public filter | Add to WHERE clause |
| wiki/types.ts | WikiPage | Missing category.is_public | Add to type |

### Files Using These Methods (Impact Check)

| File | Usage | Impact |
|------|-------|--------|
| /app/wiki/page.tsx | Calls getPopularPages() | Needs no change (service is fixed) |
| /components/wiki/WikiLandingTabs.tsx | Renders popularPages | Needs no change (receives filtered data) |
| /app/api/wiki/activity/route.ts | Calls getRecentActivity() | Needs no change (service is fixed) |

---

## 14. Key Takeaway: The Architectural Lesson

**Problem**: Popular Pages Filtering Works at WRONG LAYER

```
❌ CURRENT (Wrong)
┌─────────────────────────────────────────┐
│ Database: Incomplete WHERE clause       │  ← Missing is_public filter
│ Returns: Public + Hidden pages          │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ Service: Hardcoded category list        │  ← Only knows 'library'
│ Result: Still has uncaught pages        │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ Component: canUserAccessPage() filter   │  ← Cleanup duty
│ Rendered: Should-be-hidden pages        │
└─────────────────────────────────────────┘

✅ CORRECT (Target)
┌─────────────────────────────────────────┐
│ Database: Complete WHERE clause         │  ← Includes is_public check
│ Returns: ONLY visible pages             │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ Service: Call database, return result   │  ← Simple pass-through
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ Component: Render safely                │  ← No filtering needed
└─────────────────────────────────────────┘
```

**Lesson**: Visibility control belongs at the database layer, not scattered across service and component layers.
