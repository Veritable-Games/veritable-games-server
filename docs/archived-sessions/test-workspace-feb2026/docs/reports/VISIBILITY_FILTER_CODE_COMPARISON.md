# Category Visibility Filter - Side-by-Side Code Comparison

## What Works: WikiCategoryService.getAllCategories()

**File**: `/frontend/src/lib/wiki/services/WikiCategoryService.ts` (lines 258-322)

```typescript
✅ CORRECT PATTERN - WORKING IMPLEMENTATION

async getAllCategories(userRole?: string): Promise<WikiCategory[]> {
  try {
    // 1. Check if table exists
    const tableCheckResult = await dbAdapter.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'wiki' AND table_name = 'wiki_categories'`,
      [],
      { schema: 'wiki' }
    );
    if (tableCheckResult.rows.length === 0) {
      return [];
    }

    // 2. FETCH ALL from database (no WHERE filter for is_public)
    const result = await dbAdapter.query(
      `SELECT
        c.*,
        (
          SELECT COUNT(DISTINCT p.id)
          FROM wiki_pages p
          WHERE p.category_id = c.id
            AND p.status = 'published'
        ) as page_count
      FROM wiki_categories c
      GROUP BY c.id, ..., c.is_public
      ORDER BY c.sort_order, c.name`,
      [],
      { schema: 'wiki' }
    );

    const allCategories = result.rows.map(row => ({
      ...row,
      page_count: parseInt(row.page_count) || 0,
    })) as WikiCategory[];

    // 3. ✅ FILTER IN APPLICATION CODE BASED ON is_public
    const filteredCategories = allCategories.filter(category => {
      // If category has is_public field set to false, it's admin-only
      if (category.is_public === false) {
        return userRole === 'admin';  // ← Only admins see admin-only categories
      }
      // Default to public if is_public is undefined/null
      return true;
    });

    // 4. Return filtered results
    return filteredCategories;
  } catch (error) {
    console.error('Error getting wiki categories:', error);
    return [];
  }
}
```

**Why This Works**:
1. Fetches ALL categories from database
2. Applies visibility filter in application code
3. Filter logic: `if (is_public === false) return userRole === 'admin'`
4. Non-admins only see categories where `is_public !== false`

---

## What's Broken: WikiSearchService.getPopularPages()

**File**: `/frontend/src/lib/wiki/services/WikiSearchService.ts` (lines 190-249)

```typescript
❌ BROKEN - MISSING is_public FILTER

async getPopularPages(limit: number = 10, userRole?: string): Promise<WikiPage[]> {
  const cacheKey = `popular_pages:${limit}:${userRole || 'anonymous'}`;
  const cached = await cache.get<WikiPage[]>({ category: 'search', identifier: cacheKey });
  if (cached) {
    return cached;  // Returns cached data WITH admin-only pages ❌
  }

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

  // ❌ MISSING: Filter by c.is_public
  // Current WHERE clause does NOT check if category is public!
  // Should add: AND (c.is_public = TRUE OR c.is_public IS NULL)

  query += `
    GROUP BY p.id, r.content, r.content_format, r.size_bytes, c.id, c.name, u.username, u.display_name, u.avatar_url
    HAVING COALESCE(SUM(pv.view_count), 0) > 0
    ORDER BY total_views DESC
    LIMIT $1
  `;

  // Validate limit parameter
  const validLimit = Math.max(1, Math.min(Number(limit) || 10, 100));
  if (!Number.isInteger(validLimit)) {
    throw new Error('Invalid limit parameter');
  }

  const result = await dbAdapter.query(query, [validLimit], { schema: 'wiki' });
  const pages = result.rows
    .map(result => this.formatPageResult(result))
    .filter(page => this.canUserAccessPage(page, userRole));

  // Cache for 10 minutes (but cache contains unfiltered data) ❌
  await cache.set({ category: 'search', identifier: cacheKey }, pages);

  return pages;  // Returns ALL popular pages regardless of category visibility
}
```

**Why This Fails**:
1. Query does NOT include `c.is_public` in WHERE clause
2. Returns pages from ALL categories, including admin-only ones
3. Caches unfiltered results (cache key doesn't include visibility info)
4. Non-admins can see pages in admin-only categories in Popular Pages

---

## What's Broken: WikiSearchService.getRecentPages()

**File**: `/frontend/src/lib/wiki/services/WikiSearchService.ts` (lines 254-312)

```typescript
❌ BROKEN - MISSING is_public FILTER (SAME ISSUE AS getPopularPages)

async getRecentPages(limit: number = 10, userRole?: string): Promise<WikiPage[]> {
  const cacheKey = `recent_pages:${limit}:${userRole || 'anonymous'}`;
  const cached = await cache.get<WikiPage[]>({ category: 'search', identifier: cacheKey });
  if (cached) {
    return cached;
  }

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

  // ❌ MISSING: Filter by c.is_public
  // Should add: AND (c.is_public = TRUE OR c.is_public IS NULL)

  query += `
    GROUP BY p.id, r.content, r.content_format, r.size_bytes, c.id, c.name, u.username, u.display_name, u.avatar_url
    ORDER BY p.created_at DESC
    LIMIT $1
  `;

  const validLimit = Math.max(1, Math.min(Number(limit) || 10, 100));
  if (!Number.isInteger(validLimit)) {
    throw new Error('Invalid limit parameter');
  }

  const result = await dbAdapter.query(query, [validLimit], { schema: 'wiki' });
  const pages = result.rows
    .map(result => this.formatPageResult(result))
    .filter(page => this.canUserAccessPage(page, userRole));

  await cache.set({ category: 'search', identifier: cacheKey }, pages);

  return pages;  // Returns ALL recent pages regardless of category visibility
}
```

---

## What's Broken: WikiAnalyticsService.getRecentActivity()

**File**: `/frontend/src/lib/wiki/services/WikiAnalyticsService.ts` (lines 100-168)

```typescript
❌ BROKEN - MISSING is_public FILTER

async getRecentActivity(limit: number = 10): Promise<any[]> {
  const cacheKey = `wiki_activity:recent:${limit}`;
  const cached = await cache.get<any[]>({
    category: 'content',
    identifier: cacheKey,
    version: 'v1',
  });
  if (cached) {
    return cached;  // Returns cached activity WITH admin-only pages ❌
  }

  try {
    const result = await dbAdapter.query(
      `
      SELECT
        ua.*,
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
      `,
      [limit]
    );

    // ❌ MISSING: Filter by c.is_public
    // Current WHERE clause does NOT check if category is public!
    // Should add: AND (c.is_public = TRUE OR c.is_public IS NULL)

    const formattedResults = result.rows.map(row => {
      const metadata = row.metadata ? JSON.parse(row.metadata) : {};

      const pageTitle = row.page_title || metadata.page_title || metadata.title || null;
      const pageSlug = row.page_slug || metadata.page_slug || metadata.slug || null;
      const categoryName =
        row.category_name ||
        metadata.category_name ||
        metadata.from_category ||
        metadata.to_category ||
        null;

      return {
        ...row,
        page_title: pageTitle,
        page_slug: pageSlug,
        categories: categoryName ? [categoryName] : metadata.categories || [],
        category_ids: row.category_id ? [row.category_id] : [],
        parsed_metadata: metadata,
      };
    });

    // Cache for 2 minutes (but with unfiltered data) ❌
    await cache.set({ category: 'content', identifier: cacheKey }, formattedResults);

    return formattedResults;  // Returns ALL activity regardless of category visibility
  } catch (error) {
    console.error('Error getting recent activity:', error);
    return [];
  }
}
```

**Why This Fails**:
1. Query does NOT include `c.is_public` in WHERE clause
2. Returns activity from ALL categories, including admin-only ones
3. Does NOT accept `userRole` parameter (unlike getPopularPages)
4. Caches all activity without visibility filtering

---

## The Fix Pattern - Adding is_public Filter

### Option 1: Simple WHERE Clause (Recommended for DB-level consistency)

Add this to WHERE clause in all three broken methods:

```sql
-- For non-admins, only show pages from public categories
AND (c.is_public = TRUE OR c.is_public IS NULL)
```

### Option 2: Role-Based Filter (More explicit)

```typescript
// In each method, modify the query building:

let whereConditions = [
  "p.status = 'published'",
  "p.namespace != 'journals'"
];

// Add visibility filter for non-admins
if (userRole !== 'admin') {
  whereConditions.push("(c.is_public = TRUE OR c.is_public IS NULL)");
}

const whereClause = whereConditions.join(" AND ");
query += ` WHERE ${whereClause}`;
```

### Option 3: Application-Level Filter (Less efficient)

```typescript
// After query executes, filter in JavaScript:

const result = await dbAdapter.query(query, [validLimit], { schema: 'wiki' });
const pages = result.rows
  .map(result => this.formatPageResult(result))
  .filter(page => {
    // Add visibility filter
    if (userRole !== 'admin' && !page.is_public) {
      return false;  // Hide admin-only categories
    }
    return this.canUserAccessPage(page, userRole);
  });
```

---

## Exact Lines to Modify

### Fix 1: WikiSearchService.getPopularPages()

**Location**: `/frontend/src/lib/wiki/services/WikiSearchService.ts` line 218-225

**Current** (BROKEN):
```typescript
    WHERE p.status = 'published'
      AND p.namespace != 'journals'
  `;

  // Add access control for Library category
  if (userRole !== 'admin') {
    query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
  }
```

**Fixed**:
```typescript
    WHERE p.status = 'published'
      AND p.namespace != 'journals'
  `;

  // Add visibility filter for category
  if (userRole !== 'admin') {
    query += ` AND (c.is_public = TRUE OR c.is_public IS NULL)`;
  }

  // Add access control for Library category
  if (userRole !== 'admin') {
    query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
  }
```

---

### Fix 2: WikiSearchService.getRecentPages()

**Location**: `/frontend/src/lib/wiki/services/WikiSearchService.ts` line 282-289

**Current** (BROKEN):
```typescript
    WHERE p.status = 'published'
      AND p.namespace != 'journals'
  `;

  // Add access control for Library category
  if (userRole !== 'admin') {
    query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
  }
```

**Fixed**:
```typescript
    WHERE p.status = 'published'
      AND p.namespace != 'journals'
  `;

  // Add visibility filter for category
  if (userRole !== 'admin') {
    query += ` AND (c.is_public = TRUE OR c.is_public IS NULL)`;
  }

  // Add access control for Library category
  if (userRole !== 'admin') {
    query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
  }
```

---

### Fix 3: WikiAnalyticsService.getRecentActivity()

**Location**: `/frontend/src/lib/wiki/services/WikiAnalyticsService.ts` line 100-135

**Current** (BROKEN):
```typescript
  async getRecentActivity(limit: number = 10): Promise<any[]> {
    // ... setup ...

    try {
      const result = await dbAdapter.query(
        `
        SELECT ...
        FROM wiki.unified_activity ua
        LEFT JOIN users.users u ON ua.user_id = u.id
        LEFT JOIN wiki.wiki_pages wp ON ua.entity_id = CAST(wp.id AS TEXT)
        LEFT JOIN wiki.wiki_categories c ON wp.category_id = c.id
        WHERE ua.activity_type = 'wiki_edit'
          AND (ua.entity_type IN ('page', 'wiki', 'wiki_page') OR ua.entity_type IS NULL)
        ORDER BY ua.timestamp DESC
        LIMIT $1
        `,
        [limit]
      );
```

**Fixed** (Option A - Add userRole parameter):
```typescript
  async getRecentActivity(limit: number = 10, userRole?: string): Promise<any[]> {
    // ... setup ...

    try {
      let whereClause = `ua.activity_type = 'wiki_edit'
        AND (ua.entity_type IN ('page', 'wiki', 'wiki_page') OR ua.entity_type IS NULL)`;

      // Add visibility filter for non-admins
      if (userRole !== 'admin') {
        whereClause += ` AND (c.is_public = TRUE OR c.is_public IS NULL)`;
      }

      const result = await dbAdapter.query(
        `
        SELECT ...
        FROM wiki.unified_activity ua
        LEFT JOIN users.users u ON ua.user_id = u.id
        LEFT JOIN wiki.wiki_pages wp ON ua.entity_id = CAST(wp.id AS TEXT)
        LEFT JOIN wiki.wiki_categories c ON wp.category_id = c.id
        WHERE ${whereClause}
        ORDER BY ua.timestamp DESC
        LIMIT $1
        `,
        [limit]
      );
```

**Also update the call site in** `/app/wiki/page.tsx` line 25:
```typescript
// OLD:
wikiService.getRecentActivity(6),

// NEW:
wikiService.getRecentActivity(6, userRole || undefined),
```

---

## Cache Invalidation

After fixing the queries, also need to invalidate cache when visibility changes:

**In WikiCategoriesGrid.tsx**, update `toggleMultipleCategoriesVisibility()`:

```typescript
const toggleMultipleCategoriesVisibility = async (categoryIds: Set<string>) => {
  // ... existing code ...

  try {
    const updatePromises = Array.from(categoryIds).map(categoryId =>
      fetchJSON(`/api/wiki/categories/${encodeURIComponent(categoryId)}`, {
        method: 'PATCH',
        body: { is_public: targetIsPublic },
      })
    );

    const results = await Promise.all(updatePromises);

    // Check for failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      setError(`Failed to update ${failures.length} category/categories`);
      setTimeout(() => {
        handleRefresh();
      }, 1000);
    }

    // ✅ ADD CACHE INVALIDATION
    try {
      // Invalidate affected caches
      await fetchJSON('/api/wiki/cache/invalidate', {
        method: 'POST',
        body: {
          patterns: [
            'popular_pages:*',
            'recent_pages:*',
            'wiki_activity:recent:*'
          ]
        }
      });
    } catch (cacheError) {
      console.warn('Failed to invalidate cache:', cacheError);
      // Non-critical, don't show error to user
    }

  } catch (err) {
    console.error('Error updating category visibility:', err);
    setError('Failed to update visibility');
    setTimeout(() => {
      handleRefresh();
    }, 1000);
  }
};
```

Or alternatively, create an API route for cache invalidation:
```typescript
// /api/wiki/cache/invalidate (new endpoint)
export const POST = withSecurity(async (request) => {
  const { patterns } = await request.json();

  // Invalidate cache for each pattern
  for (const pattern of patterns) {
    await cache.invalidatePattern(pattern);
  }

  return Response.json({ success: true });
});
```

---

## Summary of Changes Required

| File | Function | Change | Priority |
|------|----------|--------|----------|
| `WikiSearchService.ts` | `getPopularPages()` | Add `(c.is_public = TRUE OR c.is_public IS NULL)` to WHERE | HIGH |
| `WikiSearchService.ts` | `getRecentPages()` | Add `(c.is_public = TRUE OR c.is_public IS NULL)` to WHERE | HIGH |
| `WikiAnalyticsService.ts` | `getRecentActivity()` | Add userRole param + is_public filter to WHERE | HIGH |
| `page.tsx` | Data fetching | Pass userRole to getRecentActivity() | HIGH |
| `WikiCategoriesGrid.tsx` | toggleMultipleCategoriesVisibility() | Add cache invalidation | MEDIUM |
| Optional: Create | `/api/wiki/cache/invalidate` | Bulk cache invalidation endpoint | MEDIUM |

---

## Verification Queries

Run these in PostgreSQL to verify the fix:

```sql
-- Check how many pages are in admin-only categories
SELECT COUNT(DISTINCT p.id) as total_pages,
       COUNT(DISTINCT CASE WHEN c.is_public = FALSE THEN p.id END) as admin_only_pages
FROM wiki.wiki_pages p
LEFT JOIN wiki.wiki_categories c ON p.category_id = c.id
WHERE p.status = 'published'
  AND p.namespace != 'journals';

-- Check what getPopularPages should return (for non-admin)
SELECT p.id, p.title, c.name as category, c.is_public
FROM wiki.wiki_pages p
LEFT JOIN wiki.wiki_categories c ON p.category_id = c.id
WHERE p.status = 'published'
  AND p.namespace != 'journals'
  AND (c.is_public = TRUE OR c.is_public IS NULL)
ORDER BY COALESCE((SELECT SUM(view_count) FROM wiki.wiki_page_views WHERE page_id = p.id), 0) DESC
LIMIT 5;

-- Check recent activity visibility
SELECT ua.id, wp.title, c.name as category, c.is_public
FROM wiki.unified_activity ua
LEFT JOIN wiki.wiki_pages wp ON ua.entity_id = CAST(wp.id AS TEXT)
LEFT JOIN wiki.wiki_categories c ON wp.category_id = c.id
WHERE ua.activity_type = 'wiki_edit'
  AND (c.is_public = TRUE OR c.is_public IS NULL)
ORDER BY ua.timestamp DESC
LIMIT 10;
```

