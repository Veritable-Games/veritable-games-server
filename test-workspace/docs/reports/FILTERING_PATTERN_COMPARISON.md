# Visual Comparison: Journal Filtering vs Popular Pages Filtering

**Purpose**: Visual representation of the architectural difference causing the bug.

---

## Data Flow Diagram

### Journals (WORKING CORRECTLY)

```
Server Component: /app/wiki/category/[id]/page.tsx
    ↓
    getJournalsData(userId)
    ↓
Direct SQL Query:
    SELECT * FROM wiki_pages p
    WHERE p.namespace = 'journals'
      AND p.created_by = $1  ← USER-LEVEL FILTER
    ↓
Database returns ONLY current user's journals
    ↓
Server passes filtered data to client component
    ↓
Client Component: JournalsPageClient.tsx
    ↓
    RENDER (no filtering needed)
    ↓
User sees: ONLY THEIR OWN JOURNALS ✓
```

**Key**: Filter at database level, filter by user ownership.

---

### Popular Pages (BROKEN)

```
Server Component: /app/wiki/page.tsx
    ↓
    getPopularPages(limit, userRole)
    ↓
Service Method: WikiSearchService.getPopularPages()
    ↓
SQL Query #1 (Database Layer):
    SELECT * FROM wiki_pages p
    LEFT JOIN wiki_categories c ON p.category_id = c.id
    WHERE p.status = 'published'
      AND p.namespace != 'journals'
      AND (p.category_id IS NULL OR p.category_id != 'library')
           ↑↑↑ INCOMPLETE FILTER
           Only checks hardcoded 'library'
           Misses: 'archive', 'development', custom hidden categories
           Ignores: c.is_public field in database
    ↓
Database returns: Public pages + HIDDEN CATEGORY PAGES ❌
    ↓
Service-level Filter #2 (Broken Attempt):
    Cache results
    (Cache includes unfiltered results)
    ↓
Component-level Filter #3 (Backup):
    canUserAccessPage(page, userRole)
    (Never actually called - component just renders what it got)
    ↓
Client Component: WikiLandingTabs.tsx
    ↓
    {popularPages.map(page => (
        <Link href={page.slug}>
          {page.title}  ← Renders without checking
        </Link>
    ))}
    ↓
User sees: Public pages + hidden category pages ❌
```

**Key**: Filter incomplete at database level, component filter non-functional.

---

## Side-by-Side Comparison

```
┌─────────────────────────────────────────┬─────────────────────────────────────────┐
│           JOURNALS (✓ WORKING)          │     POPULAR PAGES (❌ BROKEN)            │
├─────────────────────────────────────────┼─────────────────────────────────────────┤
│ Access Model:                           │ Access Model:                           │
│ WHO created it?                         │ IS IT PUBLIC?                           │
│                                         │                                         │
│ Database Filter:                        │ Database Filter:                        │
│ created_by = user_id                    │ category_id != 'library' (incomplete)   │
│ ✓ Complete                              │ ❌ Missing: is_public check             │
│ ✓ Data-driven (from table)              │ ❌ Hardcoded category name              │
│ ✓ Automatically adapts                  │ ❌ Breaks with new hidden categories    │
│                                         │                                         │
│ Service Filter:                         │ Service Filter:                         │
│ None (direct query)                     │ Cache (doesn't filter)                  │
│ ✓ Simple                                │ ❌ Incomplete                           │
│                                         │                                         │
│ Component Filter:                       │ Component Filter:                       │
│ None (trusts database)                  │ canUserAccessPage() (never called)      │
│ ✓ Correct pattern                       │ ❌ Non-functional backup                │
│                                         │                                         │
│ Security:                               │ Security:                               │
│ ✓ Enforced by database                  │ ❌ Not enforced                         │
│ ✓ No way to bypass                      │ ❌ Users can see hidden pages           │
└─────────────────────────────────────────┴─────────────────────────────────────────┘
```

---

## Filter Responsibility Chain

### CORRECT (Journal Pattern)

```
┌─────────────────────────────────┐
│  Database Query                 │
│  WHERE created_by = user_id     │
│  ✓ Enforces visibility          │
│  ✓ Returns safe data            │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│  Service Layer                  │
│  (direct pass-through)          │
│  ✓ Returns what DB gave         │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│  Component Layer                │
│  (just renders)                 │
│  ✓ Can trust all data           │
└─────────────────────────────────┘
```

### WRONG (Current Popular Pages Pattern)

```
┌─────────────────────────────────┐
│  Database Query                 │
│  WHERE status = 'published'     │
│    AND category != 'library'    │  ← Incomplete!
│  ❌ Allows hidden pages         │
│  ❌ Returns unsafe data         │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│  Service Layer                  │
│  (caches, doesn't filter)       │
│  ❌ Caches includes bad data    │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│  Component Layer                │
│  (should backup, doesn't work)  │
│  ❌ Renders everything given    │
│  ❌ canUserAccessPage() unused  │
└─────────────────────────────────┘
```

---

## The is_public Field (Exists but Unused)

### In Database
```sql
wiki_categories table:
┌────────┬──────────┬──────────┐
│   id   │   name   │ is_public│
├────────┼──────────┼──────────┤
│ main   │ Main     │ true     │
│ library│ Library  │ false    │ ← Hidden
│ archive│ Archive  │ false    │ ← Hidden
│ dev    │ Dev      │ false    │ ← Hidden
└────────┴──────────┴──────────┘
```

### Where It IS Used ✓
1. WikiCategoryService.getAllCategories()
   ```typescript
   if (category.is_public === false) {
     return userRole === 'admin';
   }
   ```

2. Category API Endpoint
   ```typescript
   if (category.is_public === false) {
     if (userRole !== 'admin') {
       return 404;
     }
   }
   ```

### Where It SHOULD Be Used ❌
1. WikiSearchService.getPopularPages()
   - Currently: `AND (p.category_id IS NULL OR p.category_id != 'library')`
   - Should be: `AND (p.category_id IS NULL OR c.is_public = true OR ...)`

2. WikiSearchService.getRecentPages()
   - Same issue

3. WikiAnalyticsService.getRecentActivity()
   - Doesn't filter by visibility at all

---

## The Three-Layer Pattern

### Theory (What Should Happen)

```
Layer 1: Database
    ↓ Returns only rows that match WHERE clause

Layer 2: Service
    ↓ Processes results, caches, returns

Layer 3: Component
    ↓ Renders final UI

Rule: Each layer should be safe for the next
      - DB: Only return safe rows
      - Service: Never undo DB filtering
      - Component: Safe to render anything received
```

### Reality for Journals (✓ Works)

```
Database: created_by = user_id
          ↓
Service: Returns journal rows
         ↓
Component: Renders them
           ↓ Result: User sees only their journals
```

### Reality for Popular Pages (❌ Broken)

```
Database: category != 'library' (incomplete!)
          ↓ Returns public + hidden pages

Service: Caches incomplete results
         ↓ Doesn't fix DB layer

Component: Can't rescue bad data
           ↓
Result: User sees hidden pages ❌
```

---

## The Fix Visualized

### Current WHERE Clause Structure

```
WHERE p.status = 'published'
  AND p.namespace != 'journals'
  ├─ Checks status ✓
  ├─ Excludes journals ✓
  └─ Hardcoded category check ❌
      └─ Only knows about 'library'
      └─ Doesn't check is_public field
      └─ Breaks with new hidden categories
```

### Fixed WHERE Clause Structure

```
WHERE p.status = 'published'
  AND p.namespace != 'journals'
  AND (
    p.category_id IS NULL                    ← No category = visible
    OR c.is_public IS NULL                   ← Old pages = visible (backward compat)
    OR c.is_public = true                    ← Public categories = visible
    ${userRole === 'admin' ? 'OR c.is_public = false' : ''}  ← Admins see hidden
  )
  ├─ Checks status ✓
  ├─ Excludes journals ✓
  ├─ Uses data-driven field ✓
  ├─ Handles backward compatibility ✓
  ├─ Adapts to any new hidden categories ✓
  └─ Respects admin visibility ✓
```

---

## Cache Impact

### Journals (Simple)
```
Request 1 (User A): getJournalsData(user_a_id)
    ↓
    DB filters by user_a_id
    ↓
    Returns user_a's journals
    ↓
    No cache (user-specific, fast enough)

Request 2 (User B): getJournalsData(user_b_id)
    ↓
    Different WHERE clause (user_b_id)
    ↓
    Returns user_b's journals
    ↓
    Safe even if no cache
```

### Popular Pages (Complex and Broken)

```
Request 1 (Admin): getPopularPages(userRole='admin')
    ↓
    DB query returns public + hidden pages (both visible to admin)
    ↓
    Cached under key: popular_pages:5:admin
    ↓
    Service returns: Public + Hidden

Request 2 (User): getPopularPages(userRole='user')
    ↓
    Different cache key: popular_pages:5:user
    ↓
    DB query SAME PROBLEM (doesn't check is_public)
    ↓
    Returns public + hidden pages (wrong!)
    ↓
    Cached under key: popular_pages:5:user
    ↓
    Service returns: Public + Hidden (should be Public only) ❌

Problem:
- Cache key includes userRole
- But WHERE clause doesn't check role-based visibility
- Cache key is wrong indicator
- User cache includes hidden pages
```

### With Fix (Correct)

```
WHERE clause includes:
  AND (c.is_public IS NULL OR c.is_public = true OR userRole is admin)

Request 1 (Admin): getPopularPages(userRole='admin')
    ↓
    DB query: WHERE ... OR c.is_public = false  ← Admin override
    ↓
    Returns: Public + Hidden
    ↓
    Cached under: popular_pages:5:admin

Request 2 (User): getPopularPages(userRole='user')
    ↓
    DB query: WHERE ... (no OR c.is_public = false)  ← No admin bypass
    ↓
    Returns: Public only ✓
    ↓
    Cached under: popular_pages:5:user
    ↓
    Different from admin cache (correct)
```

---

## Code Pattern Consistency Check

### Code Location 1: WikiCategoryService.getAllCategories()
```typescript
const filteredCategories = allCategories.filter(category => {
  if (category.is_public === false) {
    return userRole === 'admin';  ← PATTERN: Check is_public
  }
  return true;
});
```
**Status**: ✓ Correct

### Code Location 2: Category API /api/wiki/categories/[id]/
```typescript
if (category.is_public === false) {
  if (userRole !== 'admin') {
    return 404;
  }
}
```
**Status**: ✓ Correct

### Code Location 3: WikiSearchService.getPopularPages()
```typescript
if (userRole !== 'admin') {
  query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
}
```
**Status**: ❌ INCONSISTENT (doesn't use is_public)

### Code Location 4: WikiSearchService.getRecentPages()
```typescript
if (userRole !== 'admin') {
  query += ` AND (p.category_id IS NULL OR p.category_id != 'library')`;
}
```
**Status**: ❌ INCONSISTENT (doesn't use is_public)

### Code Location 5: WikiAnalyticsService.getRecentActivity()
```typescript
WHERE ua.activity_type = 'wiki_edit'
  AND (ua.entity_type IN ('page', 'wiki', 'wiki_page') OR ua.entity_type IS NULL)
```
**Status**: ❌ MISSING FILTER ENTIRELY

---

## Summary Table

| Aspect | Journals | Popular Pages | Should Be |
|--------|----------|---------------|-----------|
| **Filter Type** | User ownership | Category visibility | Category visibility |
| **Filter Location** | Database WHERE | Hardcoded + component | Database WHERE |
| **Checks Field** | created_by (user_id) | (hardcoded name) | is_public (category) |
| **Is Data-Driven** | N/A | No | Yes |
| **Adapts to Changes** | N/A | No | Yes |
| **Type-Safe** | N/A | No | Should be |
| **Works for All Cases** | Yes | No | Yes |
| **Consistent with Other Code** | N/A | No | Yes |

---

## The Lesson

**Visibility control patterns in the same codebase should be consistent.**

If you're using `is_public` field in WikiCategoryService and Category API, you must use it in WikiSearchService. The fact that three different pieces of code do visibility checks three different ways is a code smell indicating a bug.

The fix is to make them all use the same pattern: Check the `is_public` field at the database level.
