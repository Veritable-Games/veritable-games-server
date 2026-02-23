# Category Visibility Filter - Component Tree & Data Flow

## Component Hierarchy

```
/app/wiki/page.tsx (SERVER COMPONENT)
  │
  ├─────────────────────────────────────────────────────────────────┐
  │                   SERVER-SIDE DATA FETCHING                     │
  │                                                                   │
  │  1. wikiService.getCategories(userRole)                         │
  │     └─> getAllCategories() with is_public filter ✓              │
  │     └─> Returns: [{id, name, is_public, ...}]                  │
  │                                                                   │
  │  2. wikiService.getPopularPages(limit, userRole)                │
  │     └─> getPopularPages() with NO is_public filter ✗            │
  │     └─> Returns: [{id, slug, title, categories, ...}]          │
  │                                                                   │
  │  3. wikiService.getRecentActivity(limit)                        │
  │     └─> getRecentActivity() with NO is_public filter ✗          │
  │     └─> Returns: [{action, page_title, categories, ...}]       │
  │                                                                   │
  └─────────────────────────────────────────────────────────────────┘
  │
  │ PASS TO CLIENT:
  │ initialCategories, popularPages, recentActivity
  │
  ├─── WikiCategoriesGrid (CLIENT COMPONENT) ─────────┐
  │                                                    │
  │  Props: initialCategories, isAdmin               │
  │                                                    │
  │  ✅ State: categories[], selectedCategories      │
  │  ✅ State: editingCategoryId, reorderingCategoryId
  │                                                    │
  │  Handlers:                                        │
  │  • handleCategoryClick(e, categoryId)            │
  │  • Ctrl+Click → select/deselect                  │
  │  • Shift+Click → edit mode                       │
  │  • Alt+Click → reorder mode                      │
  │  • TAB key → toggleMultipleCategoriesVisibility()│
  │      └─> PATCH /api/wiki/categories/:id          │
  │      └─> setCategories() updates state ✓        │
  │      └─> is_public field updated ✓              │
  │                                                    │
  │  Rendering:                                      │
  │  • Display all categories with is_public=false   │
  │    showing red eye-with-slash overlay ✓          │
  │  • Toggle visibility: Admin-only indicator ✓     │
  │                                                    │
  │  State Isolation:                                │
  │  ✗ Does NOT communicate with WikiLandingTabs    │
  │  ✗ No callback to parent                         │
  │  ✗ No context provider                           │
  │                                                    │
  └────────────────────────────────────────────────────┘
  │
  │
  ├─── WikiLandingTabs (CLIENT COMPONENT) ───────────┐
  │                                                   │
  │  Props: popularPages[], recentActivity[]         │
  │                                                   │
  │  ✗ State: activeTab only                        │
  │  ✗ No visibility state                          │
  │  ✗ No category state                            │
  │                                                   │
  │  Tabs:                                           │
  │  1. "Popular Pages" (static)                     │
  │     └─> popularPages.map(page => (              │
  │         <Link>{page.title}</Link>               │
  │         {page.categories[0]}  (shows but        │
  │     └─> NO filtering by is_public ✗             │
  │     └─> NO access to visibility state ✗         │
  │     └─> NO refresh mechanism ✗                  │
  │                                                   │
  │  2. "Recent Activity" (static)                   │
  │     └─> recentActivity.map(activity => (        │
  │         <Link>{activity.page_title}</Link>      │
  │         {activity.categories[0]}  (shows but     │
  │     └─> NO filtering by is_public ✗             │
  │     └─> NO access to visibility state ✗         │
  │     └─> NO refresh mechanism ✗                  │
  │                                                   │
  │  Isolation Issues:                               │
  │  ✗ Cannot see WikiCategoriesGrid state          │
  │  ✗ Cannot respond to visibility changes         │
  │  ✗ Props immutable from server render           │
  │                                                   │
  └────────────────────────────────────────────────────┘


KEY INSIGHT: Two siblings (WikiCategoriesGrid and WikiLandingTabs)
with NO communication pathway between them.
```

---

## Detailed State Flow: Current (Broken)

```
TIME: User opens /wiki
────────────────────────────────────────────────────────────────

[SERVER RENDER TIME]
  getPopularPages() → Query: WHERE p.status='published' AND p.namespace!='journals'
                      (NO filter for c.is_public)
                      Returns: ALL public pages including admin-only category pages ✗

  getRecentActivity() → Query: WHERE ua.activity_type='wiki_edit'
                         (NO filter for c.is_public)
                         Returns: ALL activity including admin-only category activity ✗

  getCategories() → Query: WHERE ... GROUP BY c.id, c.is_public
                   Filter in code: if (is_public === false) return userRole==='admin'
                   Returns: Only categories user can see ✓

[CLIENT RENDER TIME]
  WikiCategoriesGrid:
    └─ Props: initialCategories (with is_public info) ✓
    └─ State: categories[] updated from props ✓
    └─ Renders: All categories visible to user
                Admin-only categories show eye overlay ✓

  WikiLandingTabs:
    └─ Props: popularPages (ALL pages from server) ✗
    └─ Props: recentActivity (ALL activity from server) ✗
    └─ NO state for visibility
    └─ Renders: All pages/activity regardless of category visibility


TIME: Admin user Ctrl+Clicks category → TAB key
────────────────────────────────────────────────────────────────

[WIKI CATEGORIES GRID]
  toggleMultipleCategoriesVisibility(categoryIds):
    1. Optimistically update local state:
       setCategories(prev =>
         prev.map(c => categoryIds.has(c.id)
           ? {...c, is_public: !c.is_public}
           : c
         )
       )  ✓

    2. Send API PATCH requests:
       PATCH /api/wiki/categories/journals
       { is_public: false }
       → Database updated ✓

    3. Render update:
       Eye overlay now visible for journals category ✓

[WIKI LANDING TABS]
  (No change)
  • Still showing pages from journals category
  • Still showing activity from journals category
  • No awareness of visibility change ✗
  • Props unchanged (still same popularPages, recentActivity) ✗


RESULT:
  ✓ WikiCategoriesGrid: Visual indicator updated
  ✓ Database: is_public changed
  ✗ WikiLandingTabs: Still shows admin-only content
  ✗ User sees inconsistent UI
```

---

## Detailed State Flow: What Should Happen

```
TIME: Admin user toggles category visibility
────────────────────────────────────────────────────────────────

Option A: Shared Context (React Pattern)
──────────────────────────────────────────────

  <WikiPageContext.Provider value={{categories, setCategoryVisibility}}>
    <WikiCategoriesGrid />    ← reads/writes context
    <WikiLandingTabs />       ← reads context for filtering
  </WikiPageContext.Provider>

  Flow:
    1. WikiCategoriesGrid: TAB key
       → toggleMultipleCategoriesVisibility()
       → Update context: setCategoryVisibility(id, isPublic)
       → Database PATCH ✓

    2. WikiLandingTabs: Subscribes to context changes
       → useContext(WikiPageContext)
       → Watch categories state
       → Re-filter popularPages client-side
       → Update filtered display ✓


Option B: Database Filter (Server Pattern) ← RECOMMENDED
──────────────────────────────────────────────────────────────

  WikiSearchService.getPopularPages():

    OLD:
      WHERE p.status = 'published'
        AND p.namespace != 'journals'

    NEW:
      WHERE p.status = 'published'
        AND p.namespace != 'journals'
        AND (c.is_public = TRUE OR c.is_public IS NULL)  ← ADD THIS
                                                          ← userRole='admin' can still see all


Option C: Cache Invalidation (Refresh Pattern)
──────────────────────────────────────────────

  WikiCategoriesGrid.toggleMultipleCategoriesVisibility():
    1. Update database ✓
    2. Invalidate cache:
       cache.invalidate('popular_pages:*')
       cache.invalidate('recent_pages:*')
       cache.invalidate('wiki_activity:recent:*')
    3. Send signal to WikiLandingTabs to re-fetch
    4. WikiLandingTabs: useEffect listener
       → Detect cache invalidation
       → Fetch fresh data from API
       → Update props/state
       → Re-render ✓
```

---

## Key Data Structures

### Category (from WikiCategoriesGrid)
```typescript
interface Category {
  id: string;          // 'journals', 'archive', etc.
  name: string;        // 'Journals', 'Archive', etc.
  page_count?: number; // How many pages in category
  icon?: string | null;
  sort_order?: number;
  is_public?: boolean;  // ← KEY FIELD
                        // true: visible to all
                        // false: admin-only
                        // undefined: default to public
}
```

### WikiPage (from WikiLandingTabs - Popular Pages)
```typescript
interface WikiPage {
  id: number;
  slug: string;
  title: string;
  total_views?: number;
  categories?: string[];  // e.g., ['journals', 'archive']
  size_bytes?: number;
  content?: string;
  updated_at: string;
  author?: {
    username: string;
    display_name?: string;
  };
}
```

### WikiActivity (from WikiLandingTabs - Recent Activity)
```typescript
interface WikiActivity {
  username?: string;
  display_name?: string;
  action: string;        // 'create', 'edit', 'delete', 'recategorize'
  timestamp: string;
  page_title?: string;
  page_slug?: string;
  categories?: string[]; // ← Pages belong to category
  activity_type: string; // 'wiki_edit'
  metadata?: string | { summary?: string; change_type?: string };
}
```

---

## Database Visibility Field

**Table**: `wiki.wiki_categories`

```sql
CREATE TABLE wiki.wiki_categories (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id VARCHAR(100),
  color VARCHAR(7),
  icon VARCHAR(100),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_public BOOLEAN DEFAULT TRUE  -- ← THE KEY FIELD
                                  -- TRUE = public
                                  -- FALSE = admin-only
);
```

**Query Pattern for Filtering**:
```sql
WHERE (c.is_public = TRUE OR c.is_public IS NULL)
```

**Query Pattern for Admins**:
```sql
-- Admins see everything, don't filter by is_public
WHERE 1=1  -- no is_public filter
```

---

## Missing WHERE Clauses

### 1. WikiSearchService.getPopularPages() - Line ~220

**CURRENT** (BROKEN):
```sql
WHERE p.status = 'published'
  AND p.namespace != 'journals'
-- Missing visibility filter!
```

**NEEDED** (FIXED):
```sql
WHERE p.status = 'published'
  AND p.namespace != 'journals'
  AND (c.is_public = TRUE OR c.is_public IS NULL)  -- ← ADD THIS
```

**With userRole parameter** (BETTER):
```typescript
async getPopularPages(limit: number = 10, userRole?: string): Promise<WikiPage[]> {
  // ... build query ...

  let whereFilter = `p.status = 'published' AND p.namespace != 'journals'`;

  // Only non-admins need visibility filter
  if (userRole !== 'admin') {
    whereFilter += ` AND (c.is_public = TRUE OR c.is_public IS NULL)`;
  }

  query += ` WHERE ${whereFilter}`;

  // ...
}
```

---

### 2. WikiSearchService.getRecentPages() - Line ~283

**CURRENT** (BROKEN):
```sql
WHERE p.status = 'published'
  AND p.namespace != 'journals'
-- Missing visibility filter!
```

**NEEDED** (FIXED):
```sql
WHERE p.status = 'published'
  AND p.namespace != 'journals'
  AND (c.is_public = TRUE OR c.is_public IS NULL)  -- ← ADD THIS
```

---

### 3. WikiAnalyticsService.getRecentActivity() - Line ~129

**CURRENT** (BROKEN):
```sql
WHERE ua.activity_type = 'wiki_edit'
  AND (ua.entity_type IN ('page', 'wiki', 'wiki_page') OR ua.entity_type IS NULL)
-- Missing visibility filter!
```

**NEEDED** (FIXED):
```sql
WHERE ua.activity_type = 'wiki_edit'
  AND (ua.entity_type IN ('page', 'wiki', 'wiki_page') OR ua.entity_type IS NULL)
  AND (c.is_public = TRUE OR c.is_public IS NULL)  -- ← ADD THIS
```

**Note**: May also need `userRole` parameter added to this function:
```typescript
async getRecentActivity(limit: number = 10, userRole?: string): Promise<any[]> {
  // ...
  if (userRole !== 'admin') {
    query += ` AND (c.is_public = TRUE OR c.is_public IS NULL)`;
  }
}
```

---

## Code Locations Reference

### Service Layer (Need Fixes)

| File | Function | Line | Issue |
|------|----------|------|-------|
| `/lib/wiki/services/WikiSearchService.ts` | `getPopularPages()` | ~220 | Missing is_public filter |
| `/lib/wiki/services/WikiSearchService.ts` | `getRecentPages()` | ~283 | Missing is_public filter |
| `/lib/wiki/services/WikiAnalyticsService.ts` | `getRecentActivity()` | ~129 | Missing is_public filter |

### Component Layer (No Fixes Needed - Works Correctly)

| File | Component | Line | Status |
|------|-----------|------|--------|
| `/lib/wiki/services/WikiCategoryService.ts` | `getAllCategories()` | ~304 | ✅ Correctly filters |
| `/components/wiki/WikiCategoriesGrid.tsx` | `toggleMultipleCategoriesVisibility()` | ~389 | ✅ Works correctly |
| `/components/wiki/WikiCategoriesGrid.tsx` | Eye overlay rendering | ~801 | ✅ Works correctly |

### UI Components (Work Correctly with Filtered Data)

| File | Component | Status |
|------|-----------|--------|
| `/components/wiki/WikiLandingTabs.tsx` | Will work ✅ once data is filtered |
| `/app/wiki/category/[id]/page.tsx` | Already filters journals ✓ |

---

## Test Cases to Verify Fix

### Test 1: Admin Makes Category Admin-Only
```
1. Admin navigates to /wiki
2. Admin selects "tutorials" category (Ctrl+Click)
3. Admin presses TAB to toggle visibility
4. Eye overlay appears on tutorials category ✓
5. BEFORE FIX: Popular Pages still shows tutorials pages
6. AFTER FIX: Popular Pages hides tutorials pages
7. BEFORE FIX: Recent Activity still shows tutorials activity
8. AFTER FIX: Recent Activity hides tutorials activity
```

### Test 2: Regular User Can't See Hidden Categories
```
1. Admin makes "archives" category admin-only
2. Regular user navigates to /wiki
3. Archives category NOT visible in grid ✓
4. Popular Pages doesn't show archive pages ✓ (after fix)
5. Recent Activity doesn't show archive activity ✓ (after fix)
```

### Test 3: Admin Can Still See All Categories
```
1. Some categories set to admin-only (is_public=false)
2. Admin navigates to /wiki
3. Admin sees ALL categories in grid ✓
4. Admin sees ALL pages in Popular Pages ✓ (after fix)
5. Admin sees ALL activity in Recent Activity ✓ (after fix)
```

### Test 4: Visibility Toggle Consistency
```
1. All users see consistent experience
2. No unexpected pages appear in Popular/Recent after refresh
3. No pages from hidden categories shown
4. Category ownership maintained (page still in hidden category internally)
```

