# Bug Fix - Exact Code Locations and Solutions

**Last Updated**: November 13, 2025

---

## TL;DR - The Bug in One Code Block

### BROKEN CODE
**File**: `/frontend/src/lib/wiki/services/WikiSearchService.ts` (Lines 218-225)

```typescript
WHERE p.status = 'published'
  AND p.namespace != 'journals'
  // ❌ MISSING: is_public filter
  // Only checks hardcoded 'library' category
  AND (p.category_id IS NULL OR p.category_id != 'library')
```

### FIXED CODE
**File**: `/frontend/src/lib/wiki/services/WikiSearchService.ts` (Lines 218-225)

```typescript
WHERE p.status = 'published'
  AND p.namespace != 'journals'
  // ✅ FIXED: Now checks is_public field from database
  AND (
    p.category_id IS NULL
    OR c.is_public IS NULL
    OR c.is_public = true
    ${userRole === 'admin' ? 'OR c.is_public = false' : ''}
  )
```

---

## Complete Bug Analysis by Location

### 1. PRIMARY BUG: WikiSearchService.getPopularPages()

**File**: `/frontend/src/lib/wiki/services/WikiSearchService.ts`
**Method**: `getPopularPages()`
**Lines**: 190-249

#### Current Code (BROKEN)
```typescript
190→  async getPopularPages(limit: number = 10, userRole?: string): Promise<WikiPage[]> {
191→    const cacheKey = `popular_pages:${limit}:${userRole || 'anonymous'}`;
192→    const cached = await cache.get<WikiPage[]>({ category: 'search', identifier: cacheKey });
193→    if (cached) {
194→      return cached;
195→    }
196→
197→    let query = `
198→      SELECT
199→        p.*,
200→        r.content,
201→        r.content_format,
202→        r.size_bytes,
203→        c.id as category_id,
204→        c.name as category_name,
205→        string_agg(DISTINCT t.name, ',') as tags,
206→        COALESCE(SUM(pv.view_count), 0) as total_views,
207→        u.username,
208→        u.display_name,
209→        u.avatar_url
210→      FROM wiki.wiki_pages p
211→      LEFT JOIN wiki.wiki_revisions r ON p.id = r.page_id
212→        AND r.id = (SELECT MAX(id) FROM wiki.wiki_revisions WHERE page_id = p.id)
213→      LEFT JOIN wiki.wiki_categories c ON p.category_id = c.id
214→      LEFT JOIN wiki.wiki_page_tags pt ON p.id = pt.page_id
215→      LEFT JOIN wiki.wiki_tags t ON pt.tag_id = t.id
216→      LEFT JOIN wiki.wiki_page_views pv ON p.id = pv.page_id
217→      LEFT JOIN users.users u ON p.created_by = u.id
218→      WHERE p.status = 'published'
219→        AND p.namespace != 'journals'
220│    `;
221│
222│    // Add access control for Library category
223│    if (userRole !== 'admin') {
224│      query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
225│    }
226│
227│    query += `
228│      GROUP BY p.id, r.content, r.content_format, r.size_bytes, c.id, c.name, u.username, u.display_name, u.avatar_url
229│      HAVING COALESCE(SUM(pv.view_count), 0) > 0
230│      ORDER BY total_views DESC
231│      LIMIT $1
232│    `;
```

#### Issues
1. **Line 224**: Only checks hardcoded 'library' category
2. **Missing**: No check for `c.is_public` field
3. **Missing**: No check for other hidden categories (archive, development, uncategorized)
4. **Impact**: Non-admin users see pages from hidden categories

#### Fix: Add is_public Filter

Replace lines 222-225 with:

```typescript
222│    // Add access control - filter by category visibility
223│    if (userRole !== 'admin' && userRole !== 'moderator') {
224│      query += ` AND (
225│        p.category_id IS NULL
226│        OR c.is_public IS NULL
227│        OR c.is_public = true
228│      )`;
229│    }
```

**Why this works**:
- `p.category_id IS NULL`: Pages without category are always visible
- `c.is_public IS NULL`: Backward compatibility (existing pages without is_public flag)
- `c.is_public = true`: Public categories are visible to everyone
- For admins/moderators: No filter applied (they see everything)

---

### 2. SECONDARY BUG: WikiSearchService.getRecentPages()

**File**: `/frontend/src/lib/wiki/services/WikiSearchService.ts`
**Method**: `getRecentPages()`
**Lines**: 254-299

#### Current Code (BROKEN)
```typescript
254→  async getRecentPages(limit: number = 10, userRole?: string): Promise<WikiPage[]> {
255→    const cacheKey = `recent_pages:${limit}:${userRole || 'anonymous'}`;
256→    const cached = await cache.get<WikiPage[]>({ category: 'search', identifier: cacheKey });
257→    if (cached) {
258→      return cached;
259→    }
260→
261→    let query = `
262→      SELECT
263→        p.*,
264→        r.content,
265→        r.content_format,
266→        r.size_bytes,
267→        c.id as category_id,
268│        c.name as category_name,
269│        string_agg(DISTINCT t.name, ',') as tags,
270│        COALESCE(SUM(pv.view_count), 0) as total_views,
271│        u.username,
272│        u.display_name,
273│        u.avatar_url
274│      FROM wiki.wiki_pages p
275│      LEFT JOIN wiki.wiki_revisions r ON p.id = r.page_id
276│        AND r.id = (SELECT MAX(id) FROM wiki.wiki_revisions WHERE page_id = p.id)
277│      LEFT JOIN wiki.wiki_categories c ON p.category_id = c.id
278│      LEFT JOIN wiki.wiki_page_tags pt ON p.id = pt.page_id
279│      LEFT JOIN wiki.wiki_tags t ON pt.tag_id = t.id
280│      LEFT JOIN wiki.wiki_page_views pv ON p.id = pv.page_id
281│      LEFT JOIN users.users u ON p.created_by = u.id
282│      WHERE p.status = 'published'
283│        AND p.namespace != 'journals'
284│    `;
285│
286│    // Add access control for Library category
287│    if (userRole !== 'admin') {
288│      query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
289│    }
```

#### Same Issue
- Line 288: Only checks hardcoded 'library'
- Missing `c.is_public` filter

#### Fix: Same as getPopularPages()

Replace lines 286-289 with:

```typescript
286│    // Add access control - filter by category visibility
287│    if (userRole !== 'admin' && userRole !== 'moderator') {
288│      query += ` AND (
289│        p.category_id IS NULL
290│        OR c.is_public IS NULL
291│        OR c.is_public = true
292│      )`;
293│    }
```

---

### 3. TERTIARY BUG: WikiAnalyticsService.getRecentActivity()

**File**: `/frontend/src/lib/wiki/services/WikiAnalyticsService.ts`
**Method**: `getRecentActivity()`
**Lines**: 100-168

#### Current Code (BROKEN)
```typescript
100→  async getRecentActivity(limit: number = 10): Promise<any[]> {
101→    const cacheKey = `wiki_activity:recent:${limit}`;
102→    const cached = await cache.get<any[]>({
103→      category: 'content',
104→      identifier: cacheKey,
105→      version: 'v1',
106→    });
107→    if (cached) {
108→      return cached;
109→    }
110→
111→    try {
112→      // Note: Using explicit schema qualification (wiki.*, users.users)
113→      // so NO schema option needed - prevents double-prefixing
114→      const result = await dbAdapter.query(
115→        `
116→        SELECT
117→          ua.*,
118→          u.username,
119→          u.display_name,
120│          wp.title as page_title,
121│          wp.slug as page_slug,
122│          wp.namespace as page_namespace,
123│          c.name as category_name,
124│          c.id as category_id
125│        FROM wiki.unified_activity ua
126│        LEFT JOIN users.users u ON ua.user_id = u.id
127│        LEFT JOIN wiki.wiki_pages wp ON ua.entity_id = CAST(wp.id AS TEXT)
128│        LEFT JOIN wiki.wiki_categories c ON wp.category_id = c.id
129│        WHERE ua.activity_type = 'wiki_edit'
130│          AND (ua.entity_type IN ('page', 'wiki', 'wiki_page') OR ua.entity_type IS NULL)
131│        ORDER BY ua.timestamp DESC
132│        LIMIT $1
133│      `,
```

#### Issues
1. **Lines 129-131**: No visibility filter at all
2. **Missing**: No check for `c.is_public`
3. **Missing**: No check for `wp.status` (could show deleted pages)
4. **Missing**: Doesn't exclude 'journals' namespace
5. **Impact**: Recent activity shows hidden pages and deleted pages

#### Fix: Add Proper Filtering

Replace lines 129-131 with:

```typescript
129│        WHERE ua.activity_type = 'wiki_edit'
130│          AND (ua.entity_type IN ('page', 'wiki', 'wiki_page') OR ua.entity_type IS NULL)
131│          AND wp.status = 'published'
132│          AND wp.namespace != 'journals'
133│          AND (
134│            wp.category_id IS NULL
135│            OR c.is_public IS NULL
136│            OR c.is_public = true
137│          )
138│        ORDER BY ua.timestamp DESC
139│        LIMIT $1
```

**Note**: getRecentActivity doesn't receive userRole, so can't filter admin-only categories.
Either:
- Option A: Add userRole parameter to method
- Option B: Always hide private categories from activity (recommended)

---

## Reference: Correct Pattern (Already Implemented)

### How AllCategories Does It Right

**File**: `/frontend/src/lib/wiki/services/WikiCategoryService.ts`
**Method**: `getAllCategories()`
**Lines**: 258-322

```typescript
258→  async getAllCategories(userRole?: string): Promise<WikiCategory[]> {
    // ...skip caching checks...
267→    try {
268→      // Check if wiki_categories table exists
269→      const tableCheckResult = await dbAdapter.query(
         `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'wiki' AND table_name = 'wiki_categories'`,
         [],
         { schema: 'wiki' }
       );

       if (tableCheckResult.rows.length === 0) {
         return [];
       }

       // Count pages using only direct category_id column
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
         GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at, c.is_public
         ORDER BY c.sort_order, c.name`,
         [],
         { schema: 'wiki' }
       );

       const allCategories = result.rows.map(row => ({
         ...row,
         page_count: parseInt(row.page_count) || 0,
       })) as WikiCategory[];

       // Apply role-based filtering based on is_public field
303│      const filteredCategories = allCategories.filter(category => {
304│        // If category has is_public field set to false, it's admin-only
305│        if (category.is_public === false) {
306│          return userRole === 'admin';  // ✅ CORRECT PATTERN
307│        }
308│        // Default to public if is_public is undefined/null (for backwards compatibility)
309│        return true;
310│      });
```

**This is the pattern to follow in getPopularPages() and getRecentPages().**

---

## Category API Endpoint (Also Correct)

**File**: `/frontend/src/app/api/wiki/categories/[id]/route.ts`
**Method**: `getCategoryHandler()`
**Lines**: 217-268

```typescript
240│      // Check visibility: return 404 if category is hidden and user is not admin
241│      if (category.is_public === false) {
242│        if (userRole !== 'admin' && userRole !== 'moderator') {
243│          // Return 404 instead of 403 to hide existence of admin-only categories
244│          return NextResponse.json(
245│            { success: false, error: 'Category not found' },
246│            { status: 404 }
247│          );
248│        }
249│      }
```

**This also uses the is_public field correctly** - it's just that getPopularPages() and getRecentPages() don't.

---

## Where getPopularPages() is Called

### Server Component
**File**: `/frontend/src/app/wiki/page.tsx`
**Line**: 26

```typescript
22│    const [categories, stats, recentActivity, popularPages, recentPages] = await Promise.all([
23│      wikiService.getCategories(userRole || undefined),
24│      wikiService.getWikiStats(),
25│      wikiService.getRecentActivity(6),
26│      wikiService.getPopularPages(5, userRole || undefined),  // ← CALLED HERE
27│      wikiService.getRecentPages(5, userRole || undefined),
28│    ]);
```

**What happens**:
- Server gets popularPages array from service
- Passes to client component
- Component renders them without any additional filtering

### Client Component
**File**: `/frontend/src/components/wiki/WikiLandingTabs.tsx`
**Lines**: 34-260

```typescript
34→interface WikiLandingTabsProps {
35→  popularPages: WikiPage[];
36│  recentActivity: WikiActivity[];
37│}
38│
39│type TabType = 'popular' | 'recent';
40│
41│export default function WikiLandingTabs({ popularPages, recentActivity }: WikiLandingTabsProps) {
    // ...
198│        {popularPages.slice(0, 5).map(page => {
199│          const contentPreview = generateContentPreview(page.content);
200│
201│          return (
202│            <Link
203│              key={page.id}
204│              href={`/wiki/${encodeURIComponent(page.slug)}`}
205│              className="block rounded border border-gray-700 bg-gray-900/30 p-4 transition-colors hover:border-gray-600 hover:bg-gray-800/40"
206│            >
```

**Component just renders** - no filtering here. It trusts the service returned correct data.

---

## Summary: All Three Bugs

| Location | File | Method | Lines | Issue | Fix |
|----------|------|--------|-------|-------|-----|
| **PRIMARY** | WikiSearchService.ts | getPopularPages() | 218-225 | Hardcoded 'library' check only | Add is_public filter in WHERE |
| **SECONDARY** | WikiSearchService.ts | getRecentPages() | 286-289 | Hardcoded 'library' check only | Add is_public filter in WHERE |
| **TERTIARY** | WikiAnalyticsService.ts | getRecentActivity() | 129-131 | No visibility filter at all | Add is_public + status filters |

---

## Impact Chain

```
Bug in WikiSearchService.getPopularPages()
    ↓
Returns pages from hidden categories
    ↓
Server component caches these results
    ↓
Client component renders them
    ↓
Non-admin users see admin-only pages
```

**Breaking the chain**: Fix WikiSearchService queries to include is_public filter at database level.
