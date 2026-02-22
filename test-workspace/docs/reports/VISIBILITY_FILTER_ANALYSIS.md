# Category Visibility Filter Propagation Analysis

**Status**: November 13, 2025
**Problem**: Category visibility filters (is_public) work correctly in WikiCategoriesGrid (ctrl+click TAB toggle) but do NOT propagate to Popular Pages and Recent Activity tabs on the wiki landing page.

---

## Executive Summary

The visibility filter control exists ONLY in the WikiCategoriesGrid component but never flows to:
1. **Popular Pages** (WikiLandingTabs panel)
2. **Recent Activity** (WikiLandingTabs panel)

These tabs display data fetched during server-side rendering in `/wiki/page.tsx` with NO CLIENT-SIDE FILTERING mechanism to apply category visibility state.

**Root Cause**: Client-side state change (visibility toggle in WikiCategoriesGrid) is ISOLATED and never communicated to WikiLandingTabs component.

---

## Component Architecture & Data Flow

### Current Architecture (Server → Client)

```
/app/wiki/page.tsx (Server Component)
  │
  ├─> WikiService.getCategories(userRole)
  │   └─> getAllCategories() filtered by userRole
  │       └─> Returns categories with is_public flag
  │
  ├─> WikiService.getPopularPages(limit, userRole)
  │   └─> getPopularPages() from WikiSearchService
  │       └─> NO category visibility filter applied
  │
  ├─> WikiService.getRecentActivity(limit)
  │   └─> getRecentActivity() from WikiAnalyticsService
  │       └─> NO category visibility filter applied
  │
  └─> Render:
      ├─> WikiCategoriesGrid (CLIENT COMPONENT)
      │   └─> Manages own state: selectedCategories, visibility toggles
      │       └─> Updates via TAB key → toggleMultipleCategoriesVisibility()
      │           └─> API PATCH /api/wiki/categories/:id {is_public}
      │               └─> Database updates
      │               └─> DOES NOT notify WikiLandingTabs
      │
      └─> WikiLandingTabs (CLIENT COMPONENT - STATIC)
          ├─> Props: popularPages, recentActivity (from server render time)
          ├─> NO category visibility state
          ├─> NO refresh mechanism when categories change
          └─> Display: Static data, never re-filtered
```

### The Gap

```
WikiCategoriesGrid                      WikiLandingTabs
┌─────────────────────────┐           ┌──────────────────────────┐
│ Local State:            │           │ Props (Server Data Only) │
│  selectedCategories     │           │  ├─ popularPages        │
│  categories             │           │  └─ recentActivity      │
│                         │           │                          │
│ TAB Key Handler:        │           │ NO access to:           │
│  → toggleVisibiility()  │           │  • Category state       │
│  → PATCH API call       │           │  • Visibility filters   │
│  → Updates is_public    │           │  • Refresh mechanism    │
│                         │           │                          │
│ Updates Database ✓      │  ╳╳╳╳╳   │ No re-fetch ✗          │
└─────────────────────────┘ (NO LINK) └──────────────────────────┘
```

---

## Detailed Component Analysis

### 1. WikiCategoriesGrid (Client Component)

**File**: `/frontend/src/components/wiki/WikiCategoriesGrid.tsx`

**Visibility State Management**:
```typescript
// Line 73-74
const [categories, setCategories] = useState<Category[]>(initialCategories);
const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

// Line 361-387: Single category toggle
const toggleCategoryVisibility = async (categoryId: string) => {
  const newIsPublic = !category.is_public;
  await fetchJSON(`/api/wiki/categories/${categoryId}`, {
    method: 'PATCH',
    body: { is_public: newIsPublic },
  });
  setCategories(categories.map(c =>
    c.id === categoryId ? { ...c, is_public: newIsPublic } : c
  ));
};

// Line 389-434: Bulk visibility toggle (TAB key)
const toggleMultipleCategoriesVisibility = async (categoryIds: Set<string>) => {
  // Determine target state
  const selectedCats = categories.filter(c => categoryIds.has(c.id));
  const allPublic = selectedCats.every(c => c.is_public === true);
  const targetIsPublic = !allPublic;

  // OPTIMISTICALLY update UI
  setCategories(prev =>
    prev.map(c => (categoryIds.has(c.id) ? { ...c, is_public: targetIsPublic } : c))
  );

  // Send parallel API requests to update database
  const updatePromises = Array.from(categoryIds).map(categoryId =>
    fetchJSON(`/api/wiki/categories/${encodeURIComponent(categoryId)}`, {
      method: 'PATCH',
      body: { is_public: targetIsPublic },
    })
  );
  // ...
};

// Line 694-697: TAB key binding
if (e.key === 'Tab' && selectedCategories.size > 0) {
  e.preventDefault();
  toggleMultipleCategoriesVisibility(selectedCategories);
}
```

**Critical Finding**:
- ✅ Updates local state `setCategories()`
- ✅ Updates database via PATCH API
- ✅ Displays eye-with-slash overlay for admin-only categories (line 801-816)
- ❌ **No mechanism to notify sibling WikiLandingTabs component**
- ❌ **No re-fetch or refresh of Popular Pages/Recent Activity**

---

### 2. WikiLandingTabs (Client Component)

**File**: `/frontend/src/components/wiki/WikiLandingTabs.tsx`

**Data Reception**:
```typescript
// Line 34-37: Props interface
interface WikiLandingTabsProps {
  popularPages: WikiPage[];
  recentActivity: WikiActivity[];
}

// Line 41: Destructure props
export default function WikiLandingTabs({ popularPages, recentActivity }: WikiLandingTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('popular');
  // ...
}
```

**Rendering**:
```typescript
// Line 190-260: Popular Pages Panel (STATIC - no filtering)
<div>
  {popularPages.slice(0, 5).map(page => {
    const contentPreview = generateContentPreview(page.content);
    return (
      <Link href={`/wiki/${encodeURIComponent(page.slug)}`}>
        {page.categories && page.categories.length > 0 && (
          <span>{page.categories[0]}</span>  // Shows category but NO filtering
        )}
        // ...
      </Link>
    );
  })}
</div>

// Line 262-340: Recent Activity Panel (STATIC - no filtering)
<div>
  {recentActivity.map((activity, index) => {
    return (
      <div>
        {activity.categories && activity.categories.length > 0 && (
          <span>{activity.categories[0]}</span>  // Shows category but NO filtering
        )}
        // ...
      </div>
    );
  })}
</div>
```

**Critical Finding**:
- ✅ Displays categories inline (shows which category page belongs to)
- ❌ **NO state for visibility filters**
- ❌ **NO mechanism to hide pages from admin-only categories**
- ❌ **NO refresh when WikiCategoriesGrid updates visibility**
- ❌ **NO access to category visibility state**
- ❌ **Purely static rendering of server-provided data**

---

### 3. WikiPage (Server Component) - Data Fetching

**File**: `/frontend/src/app/wiki/page.tsx`

**Data Fetching**:
```typescript
// Line 22-28: Server-side data fetching at render time
const [categories, stats, recentActivity, popularPages, recentPages] = await Promise.all([
  wikiService.getCategories(userRole || undefined),           // Gets all categories
  wikiService.getWikiStats(),
  wikiService.getRecentActivity(6),                            // STATIC - no filtering
  wikiService.getPopularPages(5, userRole || undefined),       // STATIC - no filtering
  wikiService.getRecentPages(5, userRole || undefined),
]);

// Line 44-45: Pass to client components
<WikiLandingTabs popularPages={popularPages} recentActivity={recentActivity} />
```

**Critical Finding**:
- ✅ getCategories() filters by userRole
- ❌ **getPopularPages() does NOT filter by category visibility (is_public)**
- ❌ **getRecentActivity() does NOT filter by category visibility (is_public)**
- ❌ **Data passed ONCE at render time, never refreshed**

---

## Service Layer Analysis

### WikiSearchService.getPopularPages()

**File**: `/frontend/src/lib/wiki/services/WikiSearchService.ts` (lines 190-249)

```typescript
async getPopularPages(limit: number = 10, userRole?: string): Promise<WikiPage[]> {
  const cacheKey = `popular_pages:${limit}:${userRole || 'anonymous'}`;
  const cached = await cache.get<WikiPage[]>({ category: 'search', identifier: cacheKey });
  if (cached) {
    return cached;
  }

  let query = `
    SELECT ... FROM wiki.wiki_pages p
    LEFT JOIN wiki.wiki_categories c ON p.category_id = c.id
    ...
    WHERE p.status = 'published'
      AND p.namespace != 'journals'
  `;

  // Add access control for Library category
  if (userRole !== 'admin') {
    query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
  }

  // ❌ MISSING: Filter by category.is_public
  // Should add:
  // AND (c.is_public = TRUE OR c.is_public IS NULL)

  query += ` ... ORDER BY total_views DESC LIMIT $1`;
  // ...
}
```

**Critical Finding**:
- ✅ Filters by `namespace != 'journals'` (namespace-based, not visibility-based)
- ✅ Filters Library category by userRole (role-based, not visibility-based)
- ❌ **MISSING: WHERE clause filter for `c.is_public = TRUE OR c.is_public IS NULL`**
- ❌ **Does not respect category visibility toggles at all**

---

### WikiSearchService.getRecentPages()

**File**: `/frontend/src/lib/wiki/services/WikiSearchService.ts` (lines 254-312)

```typescript
async getRecentPages(limit: number = 10, userRole?: string): Promise<WikiPage[]> {
  // ... similar to getPopularPages()

  let query = `SELECT ... WHERE p.status = 'published'
    AND p.namespace != 'journals'
  `;

  // Add access control for Library category
  if (userRole !== 'admin') {
    query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
  }

  // ❌ MISSING: Filter by category.is_public

  query += ` ORDER BY p.created_at DESC LIMIT $1`;
  // ...
}
```

**Critical Finding**: Same as getPopularPages() - missing visibility filter.

---

### WikiAnalyticsService.getRecentActivity()

**File**: `/frontend/src/lib/wiki/services/WikiAnalyticsService.ts` (lines 100-168)

```typescript
async getRecentActivity(limit: number = 10): Promise<any[]> {
  const cacheKey = `wiki_activity:recent:${limit}`;
  const cached = await cache.get<any[]>({ ... });
  if (cached) {
    return cached;
  }

  try {
    const result = await dbAdapter.query(`
      SELECT ua.*,
        u.username,
        u.display_name,
        wp.title as page_title,
        wp.slug as page_slug,
        wp.namespace as page_namespace,
        c.name as category_name,
        c.id as category_id
      FROM wiki.unified_activity ua
      LEFT JOIN users.users u ON ua.user_id = u.id
      LEFT JOIN wiki.wiki_pages wp ON ua.entity_id = CAST(wp.id AS TEXT)
      LEFT JOIN wiki.wiki_categories c ON wp.category_id = c.id
      WHERE ua.activity_type = 'wiki_edit'
        AND (ua.entity_type IN ('page', 'wiki', 'wiki_page') OR ua.entity_type IS NULL)
      ORDER BY ua.timestamp DESC
      LIMIT $1
    `, [limit]);

    // ❌ MISSING: Filter by category.is_public
    // Should add to WHERE:
    // AND (c.is_public = TRUE OR c.is_public IS NULL OR wp.category_id IS NULL)

    // ...
  }
}
```

**Critical Finding**:
- ❌ **MISSING: WHERE clause filter for `c.is_public`**
- ❌ **Shows activity for ALL categories regardless of visibility setting**

---

## WikiCategoryService.getAllCategories() - Correct Pattern

**File**: `/frontend/src/lib/wiki/services/WikiCategoryService.ts` (lines 258-322)

```typescript
async getAllCategories(userRole?: string): Promise<WikiCategory[]> {
  // ...
  const result = await dbAdapter.query(`
    SELECT c.*, ...
    FROM wiki_categories c
    LEFT JOIN wiki_pages p ON c.id = p.category_id
    ...
    GROUP BY c.id, ..., c.is_public
    ORDER BY c.sort_order, c.name
  `, [], { schema: 'wiki' });

  const allCategories = result.rows.map(row => ({
    ...row,
    page_count: parseInt(row.page_count) || 0,
  })) as WikiCategory[];

  // ✅ CORRECT: Apply role-based filtering on is_public field
  const filteredCategories = allCategories.filter(category => {
    // If category has is_public field set to false, it's admin-only
    if (category.is_public === false) {
      return userRole === 'admin';
    }
    // Default to public if is_public is undefined/null (for backwards compatibility)
    return true;
  });

  return filteredCategories;
}
```

**Key Pattern**:
- ✅ Fetches ALL categories from database
- ✅ Filters in application code based on `is_public` and `userRole`
- ✅ Returns only categories the user can see

**This pattern is MISSING from getPopularPages and getRecentActivity!**

---

## Data Flow Comparison: Working vs Broken

### WORKING: Categories List (Journals Category)

```
Server Render (/wiki/page.tsx)
  │
  ├─> WikiService.getCategories(userRole)
  │   └─> WikiCategoryService.getAllCategories(userRole)
  │       └─ Filter: if (category.is_public === false) → userRole === 'admin'
  │       └─ Returns: only categories user can see ✓
  │
  ├─> Render: WikiCategoriesGrid
  │   └─> initialCategories (filtered) ✓
  │
  └─> Client: WikiCategoriesGrid (INTERACTIVE)
      ├─> Local state: categories[], selectedCategories
      ├─> TAB key → toggleMultipleCategoriesVisibility()
      │   └─> PATCH /api/wiki/categories/:id {is_public}
      │   └─> setCategories() updates local state ✓
      │
      └─> Render: Eye overlay for is_public === false ✓


Result: Journals category visibility changes are:
  ✓ Updated in database
  ✓ Updated in local component state
  ✓ Displayed with visual feedback (eye overlay)
```

### BROKEN: Popular Pages & Recent Activity

```
Server Render (/wiki/page.tsx)
  │
  ├─> WikiService.getPopularPages(limit, userRole)
  │   └─> WikiSearchService.getPopularPages()
  │       └─ Filter: namespace filtering ✓
  │       └─ Filter: library category access ✓
  │       └─ Filter: is_public filtering ✗ MISSING
  │       └─ Returns: ALL public pages (correct) but no category visibility
  │
  ├─> Render: WikiLandingTabs
  │   ├─> popularPages (static props)
  │   └─> recentActivity (static props)
  │
  └─> Client: WikiLandingTabs (NON-INTERACTIVE)
      ├─> No state management for categories
      ├─> No access to visibility state
      ├─ Props: never updated
      └─ Renders: static data from server ✗


Meanwhile in parallel:
  WikiCategoriesGrid
    ├─> TAB key → toggleMultipleCategoriesVisibility()
    ├─> PATCH /api/wiki/categories/:id {is_public}
    ├─> Updates: database ✓
    ├─> Updates: local state ✓
    └─> Effect on WikiLandingTabs: NONE ✗


Result:
  ✗ Popular Pages still show all pages
  ✗ Recent Activity still shows all activity
  ✗ No visual indication of admin-only categories
  ✗ UI is inconsistent (category grid shows some hidden, tabs show all)
```

---

## The Core Issue: State Management Architecture

### Current: Isolated State

```
WikiCategoriesGrid State              WikiLandingTabs Props
┌──────────────────────┐             ┌──────────────────────┐
│ categories[]         │             │ popularPages[]       │
│   ├─ id              │             │ recentActivity[]     │
│   └─ is_public ✓     │             │                      │
│                      │             │ (immutable - from    │
│ selectedCategories   │             │  server render)      │
│                      │             │                      │
│ Toggle: is_public    │  ╳╳╳       │ No refresh           │
│ Update: database     │  NO LINK   │ No state access      │
└──────────────────────┘             └──────────────────────┘
       ✓ Interactive                         ✗ Static
```

### Solution Required: Shared State or Refresh Mechanism

Either:
1. **Context API**: Share category visibility state across both components
2. **Query Parameter**: Add filter to URL that both components observe
3. **Server Invalidation**: Invalidate cache and re-fetch on visibility change
4. **Database Filter**: Add is_public filter directly to database queries (best for consistency)

---

## Summary: Where Filtering Happens vs Where It's Missing

| Component | Location | has is_public filter? | Issue |
|-----------|----------|----------------------|-------|
| **WikiCategoryService.getAllCategories()** | Lines 304-311 | ✅ YES | Correctly filters in app code |
| **WikiSearchService.getPopularPages()** | Lines 218-225 | ❌ NO | Missing WHERE clause filter |
| **WikiSearchService.getRecentPages()** | Lines 282-289 | ❌ NO | Missing WHERE clause filter |
| **WikiAnalyticsService.getRecentActivity()** | Lines 129-130 | ❌ NO | Missing WHERE clause filter |
| **WikiCategoriesGrid** | Lines 801-816 | ✅ YES | Shows eye overlay for admin-only |
| **WikiLandingTabs** | N/A | ❌ NO | No filtering, static rendering |

---

## Technical Root Causes

1. **Query-Level Issue**: The database queries for popular/recent data don't include `is_public` in WHERE clause
2. **State Isolation**: Category visibility state lives only in WikiCategoriesGrid
3. **No Re-fetch**: WikiLandingTabs has no mechanism to refresh when categories change
4. **Caching**: Results are cached with no invalidation on visibility change
5. **Architecture**: Server-side data passed once, never refreshed client-side

---

## File Paths for Implementation

**Needs `is_public` WHERE filter added**:
1. `/frontend/src/lib/wiki/services/WikiSearchService.ts` - Line ~220 (getPopularPages)
2. `/frontend/src/lib/wiki/services/WikiSearchService.ts` - Line ~283 (getRecentPages)
3. `/frontend/src/lib/wiki/services/WikiAnalyticsService.ts` - Line ~129 (getRecentActivity)

**Pattern to follow** (from WikiCategoryService):
```sql
WHERE ...
  AND (c.is_public = TRUE OR c.is_public IS NULL)
```

**Optional but recommended**:
1. Add cache invalidation when visibility changes (WikiCategoriesGrid)
2. Consider adding userRole parameter to getRecentActivity() for consistency
3. Add server-side filtering in `/app/wiki/page.tsx` to re-fetch after visibility change

---

## Next Steps

1. **Database Level** (Highest Priority):
   - Add WHERE clause to getPopularPages() query
   - Add WHERE clause to getRecentPages() query
   - Add WHERE clause to getRecentActivity() query

2. **Cache Invalidation** (Medium Priority):
   - Invalidate `popular_pages:*` cache when category visibility changes
   - Invalidate `recent_pages:*` cache when category visibility changes
   - Invalidate `wiki_activity:recent:*` cache when category visibility changes

3. **User Experience** (Low Priority):
   - Add "Filtered by visibility" indicator in WikiLandingTabs
   - Add loading state during cache invalidation
   - Consider adding "Refresh" button for manual update

