# Wiki Category Count Update Analysis

**Date**: October 13, 2025
**Issue**: Category boxes (with icons and page counts) not updating when pages are migrated, deleted, or added

---

## Executive Summary

**STATUS**: ⚠️ **CRITICAL DATA INTEGRITY ISSUE**

The wiki category page counts are **NOT updating in real-time** due to a fundamental architectural issue with caching strategy. The system calculates page counts dynamically but caches them for 5 minutes, leading to stale data being displayed to users.

**Impact**:
- Users see incorrect category counts
- Category boxes don't reflect actual page distribution
- Creates confusion about content organization
- Undermines trust in the wiki system

**Root Cause**: Aggressive caching (5-minute TTL) + incomplete cache invalidation on page mutations

---

## Technical Architecture

### 1. Database Schema Analysis

**CRITICAL FINDING**: The `wiki_categories` table does **NOT** have a `page_count` column.

```sql
-- Actual schema (NO page_count column)
CREATE TABLE wiki_categories (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6B7280',
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  -- ❌ NO page_count column exists!
)
```

**This means**:
- Page counts are **calculated on every query**, not stored
- No database-level triggers update counts (because there's no column to update)
- Performance depends on efficient subquery execution

### 2. Page Count Calculation Method

**Location**: `WikiCategoryService.ts:264-278`

```typescript
const query = db.prepare(`
  SELECT
    c.*,
    (
      SELECT COUNT(DISTINCT p.id)
      FROM wiki_pages p
      WHERE p.category_id = c.id
        AND p.status = 'published'
        AND (p.is_deleted = 0 OR p.is_deleted IS NULL)
    ) as page_count
  FROM wiki_categories c
  GROUP BY c.id
  ORDER BY c.sort_order, c.name
`);
```

**Analysis**:
- ✅ **CORRECT**: Excludes draft/deleted pages
- ✅ **CORRECT**: Uses soft delete check (`is_deleted = 0`)
- ✅ **CORRECT**: Counts only published pages
- ⚠️ **ISSUE**: Calculated dynamically on every request (expensive)
- ⚠️ **ISSUE**: Cached result becomes stale

### 3. Caching Strategy

**Cache Configuration** (`cache/manager.ts:85-91`):
```typescript
content: {
  enabled: true,
  maxSize: 2000,
  ttl: 300, // 5 minutes - short TTL for mutable content
  tags: ['content'],
  warming: { enabled: true },
}
```

**Cache Key Pattern**:
```typescript
const cacheKey = `categories:all:${userRole || 'anonymous'}`;
// Example keys:
// - categories:all:admin
// - categories:all:user
// - categories:all:anonymous
```

**Cache Hit Flow**:
1. User requests wiki homepage
2. `WikiCategoryService.getAllCategories()` checks cache
3. **IF CACHED**: Returns stale data (even if pages changed 1 second ago)
4. **IF NOT CACHED**: Runs expensive SQL query, caches for 5 minutes

### 4. Cache Invalidation Points

**When categories SHOULD be invalidated**:

#### ✅ Page Creation (`WikiPageService.ts:107`)
```typescript
await cacheManager.invalidateCategory('search'); // ✅ Invalidates search
// ❌ Does NOT invalidate 'content' category!
```

#### ✅ Page Update (`WikiPageService.ts:261`)
```typescript
await cacheManager.invalidateCategory('search'); // ✅ Invalidates search
// ❌ Does NOT invalidate 'content' category!
```

#### ✅ Page Deletion (`WikiPageService.ts:309-311`)
```typescript
await cacheManager.invalidateCategory('search'); // ✅ Invalidates search
await cacheManager.invalidateCategory('content'); // ✅ Invalidates content!
// ✅ This one is correct!
```

#### ✅ Category CRUD (`WikiCategoryService.ts:500-521`)
```typescript
private async invalidateCategoryCache(): Promise<void> {
  const cacheKeys = [
    'categories:all:admin',
    'categories:all:moderator',
    'categories:all:user',
    'categories:all:anonymous',
    // ... also root and hierarchy variants
  ];

  await Promise.all(
    cacheKeys.map(key => cache.delete({ category: 'content', identifier: key }))
  );
}
```

**✅ This invalidation is CORRECT** - called on:
- Category creation
- Category update
- Category deletion

---

## The Problem: Incomplete Cache Invalidation

### Issue 1: Page Creation/Update Don't Invalidate Category Cache

**Location**: `WikiPageService.ts:107, 261`

```typescript
// ❌ WRONG - Only invalidates search cache
await cacheManager.invalidateCategory('search');

// ✅ SHOULD BE:
await cacheManager.invalidateCategory('search');
await cacheManager.invalidateCategory('content'); // Invalidate categories too!
```

**Why this matters**:
1. User creates new page in "AUTUMN" category
2. Search cache is invalidated ✅
3. Category cache **NOT** invalidated ❌
4. Homepage still shows "AUTUMN: 18 pages" instead of "AUTUMN: 19 pages"
5. User must wait up to 5 minutes OR hard refresh

### Issue 2: 5-Minute Cache is Too Long for Mutable Data

**Current TTL**: 300 seconds (5 minutes)

**Problems**:
- Wiki is actively edited (high mutation rate)
- Users expect immediate feedback
- 5 minutes feels like "broken" to users
- Creates false sense of data being outdated

**Recommended TTL**: 30-60 seconds (or use aggressive invalidation)

### Issue 3: Category Re-assignment Not Handled

**Scenario**:
1. Page "doom-bible" starts in "DODEC" category (14 pages)
2. User moves it to "AUTUMN" category (18 pages)
3. **Expected**: DODEC shows 13, AUTUMN shows 19
4. **Actual**: Both show old counts for 5 minutes

**Why**:
- `updatePage()` calls `invalidateCategory('search')` only
- Category counts remain cached
- **Both** categories need invalidation (old and new)

### Issue 4: Role-Based Cache Keys

**Cache keys are role-specific**:
```typescript
const cacheKey = `categories:all:${userRole || 'anonymous'}`;
```

**This means**:
- Admin cache: `categories:all:admin`
- User cache: `categories:all:user`
- Anonymous cache: `categories:all:anonymous`

**Invalidation must hit all role variants**, which the current code does via:
```typescript
const cacheKeys = [
  'categories:all:admin',
  'categories:all:moderator',
  'categories:all:user',
  'categories:all:anonymous',
];
```

✅ This is correctly implemented in `WikiCategoryService.invalidateCategoryCache()`

---

## Current State Analysis

### Test Query Results (October 13, 2025)

**Actual database counts** (from direct SQL query):

| Category ID | Name | Page Count |
|-------------|------|------------|
| autumn | AUTUMN | 18 |
| archive | Archive | 0 |
| cosmic-knights | COSMIC KNIGHTS | 19 |
| community | Community | 0 |
| dodec | DODEC | 14 |
| development | Development | 6 |
| journals | Journals | 0 |
| modding | Modding | 0 |
| noxii | NOXII | 32 |
| on-command | ON COMMAND | 38 |
| project-coalesce | PROJECT COALESCE | 0 |
| systems | Systems | 14 |
| tutorials | Tutorials | 6 |
| uncategorized | Uncategorized | 27 |

**Total pages**: 174 (published, non-deleted)

### Cache Invalidation Audit

| Operation | Search Cache | Content Cache | Status |
|-----------|--------------|---------------|--------|
| Create page | ✅ Invalidated | ❌ **NOT** invalidated | 🔴 **BUG** |
| Update page | ✅ Invalidated | ❌ **NOT** invalidated | 🔴 **BUG** |
| Delete page | ✅ Invalidated | ✅ Invalidated | ✅ Correct |
| Create category | N/A | ✅ Invalidated | ✅ Correct |
| Update category | N/A | ✅ Invalidated | ✅ Correct |
| Delete category | N/A | ✅ Invalidated | ✅ Correct |

**2 out of 6 operations have bugs** (33% failure rate)

---

## Performance Implications

### Current Query Performance

**Subquery execution** (calculated per category):
```sql
SELECT COUNT(DISTINCT p.id)
FROM wiki_pages p
WHERE p.category_id = c.id
  AND p.status = 'published'
  AND (p.is_deleted = 0 OR p.is_deleted IS NULL)
```

**With 14 categories**: 14 subqueries per request

**Estimated cost**:
- Without cache: ~20-50ms per homepage load
- With cache: ~1-2ms (cache hit)

**Cache hit rate**: ~90% (estimated, based on 5-minute TTL)

**Trade-off**:
- ✅ Fast response times (1-2ms cached)
- ❌ Stale data for up to 5 minutes
- ❌ User confusion about accuracy

---

## Solutions Analysis

### Solution 1: Add page_count Column (NOT RECOMMENDED)

**Approach**: Add `page_count INTEGER DEFAULT 0` to `wiki_categories` table

**Pros**:
- Fastest query performance (no subquery)
- Eliminates cache staleness issues
- Single source of truth

**Cons**:
- Requires database migration
- Needs triggers for automatic updates:
  - ON INSERT wiki_pages → increment category count
  - ON UPDATE wiki_pages (category change) → decrement old, increment new
  - ON DELETE wiki_pages → decrement category count
  - ON UPDATE wiki_pages (status change) → adjust count
- Complex trigger logic for soft deletes
- Trigger maintenance burden
- Risk of count drift if triggers fail

**Verdict**: ❌ **NOT RECOMMENDED** - Too complex, triggers are fragile

---

### Solution 2: Fix Cache Invalidation (RECOMMENDED)

**Approach**: Invalidate content cache on all page mutations

**Changes needed**:

#### A. Fix WikiPageService.createPage() (line 107)
```typescript
// BEFORE:
await cacheManager.invalidateCategory('search');

// AFTER:
await cacheManager.invalidateCategory('search');
await cacheManager.invalidateCategory('content'); // Add this line
```

#### B. Fix WikiPageService.updatePage() (line 261)
```typescript
// BEFORE:
await cacheManager.invalidateCategory('search');

// AFTER:
await cacheManager.invalidateCategory('search');
await cacheManager.invalidateCategory('content'); // Add this line
```

**Pros**:
- ✅ Simple fix (2 lines of code)
- ✅ No database migration needed
- ✅ No trigger complexity
- ✅ Guaranteed fresh data
- ✅ Works with existing architecture

**Cons**:
- ⚠️ Slightly more cache misses (acceptable trade-off)
- ⚠️ Homepage query runs more often (~20-50ms)

**Verdict**: ✅ **RECOMMENDED** - Simple, effective, low risk

---

### Solution 3: Reduce Cache TTL (PARTIAL FIX)

**Approach**: Change TTL from 300s (5 min) to 30-60s

**Change**:
```typescript
// cache/manager.ts:85-91
content: {
  enabled: true,
  maxSize: 2000,
  ttl: 60, // CHANGED: 1 minute instead of 5
  tags: ['content'],
  warming: { enabled: true },
}
```

**Pros**:
- ✅ Reduces staleness window
- ✅ No code changes in services
- ✅ Still benefits from caching

**Cons**:
- ⚠️ Partial fix - still shows stale data for up to 1 minute
- ⚠️ More cache misses = more database load
- ⚠️ Doesn't solve the fundamental issue

**Verdict**: ⚠️ **PARTIAL FIX** - Use in combination with Solution 2

---

### Solution 4: Real-Time Invalidation with Event System (OVER-ENGINEERED)

**Approach**: Implement event-driven cache invalidation

**Architecture**:
```typescript
class WikiEventEmitter {
  on(event: 'page:created' | 'page:updated' | 'page:deleted', handler: Function);
  emit(event, data);
}

// In WikiPageService:
await wikiEvents.emit('page:created', { pageId, categoryId });

// In cache listener:
wikiEvents.on('page:created', async ({ categoryId }) => {
  await cacheManager.invalidateCategory('content');
});
```

**Pros**:
- ✅ Precise, targeted invalidation
- ✅ Extensible for future features
- ✅ Decouples services

**Cons**:
- ❌ Over-engineered for current needs
- ❌ Adds complexity
- ❌ Risk of missing event handlers
- ❌ Harder to debug

**Verdict**: ❌ **OVER-ENGINEERED** - Use Solution 2 instead

---

## Recommended Fix (Priority 1)

### Implementation Plan

**Step 1: Fix Cache Invalidation** (5 minutes)

**File**: `frontend/src/lib/wiki/services/WikiPageService.ts`

**Line 107** (in `createPage()` method):
```typescript
// Invalidate all search caches (new page affects search results)
await cacheManager.invalidateCategory('search');
// ADD THIS LINE:
await cacheManager.invalidateCategory('content'); // New page affects category counts
```

**Line 261** (in `updatePage()` method):
```typescript
// Invalidate all search caches (content/title changes affect search results)
await cacheManager.invalidateCategory('search');
// ADD THIS LINE:
await cacheManager.invalidateCategory('content'); // Category changes affect counts
```

**Step 2: Test** (10 minutes)
```bash
# Test category count updates
cd frontend
npm run dev

# In browser:
# 1. Note current category count for "AUTUMN" (currently 18)
# 2. Create new wiki page, assign to "AUTUMN" category
# 3. Return to homepage immediately
# 4. Verify "AUTUMN" shows 19 pages

# Test page migration:
# 1. Note counts for "AUTUMN" (18) and "DODEC" (14)
# 2. Move one page from AUTUMN to DODEC
# 3. Return to homepage
# 4. Verify AUTUMN shows 17, DODEC shows 15
```

**Step 3: Verify Cache Behavior** (optional)
```typescript
// Add temporary logging in WikiCategoryService.ts:244-246
const cached = await cache.get<WikiCategory[]>({ category: 'content', identifier: cacheKey });
if (cached) {
  console.log('🔵 Category cache HIT:', cacheKey, 'count:', cached.length);
  return cached;
}
console.log('🔴 Category cache MISS:', cacheKey, 'running query...');
```

---

## Additional Improvements (Priority 2)

### Reduce Cache TTL for Content

**File**: `frontend/src/lib/cache/manager.ts`

**Line 85-91**:
```typescript
content: {
  enabled: true,
  maxSize: 2000,
  ttl: 60, // CHANGED: 1 minute (from 5 minutes)
  tags: ['content'],
  warming: { enabled: true },
}
```

**Rationale**:
- Wiki content changes frequently
- 1-minute staleness is acceptable
- Reduces user confusion
- Still provides significant performance benefit

---

## Testing Scenarios

### Test 1: Create New Page
**Steps**:
1. Note "AUTUMN" count (currently 18)
2. Navigate to `/wiki/create`
3. Create new page:
   - Title: "Test Page"
   - Category: "AUTUMN"
   - Content: "Test content"
   - Click "Create"
4. Navigate back to `/wiki`
5. **Expected**: "AUTUMN" shows 19 pages
6. **Without fix**: Shows 18 for 5 minutes
7. **With fix**: Shows 19 immediately

### Test 2: Delete Page
**Steps**:
1. Note "DODEC" count (currently 14)
2. Navigate to any DODEC page
3. Delete the page
4. Navigate back to `/wiki`
5. **Expected**: "DODEC" shows 13 pages
6. **Status**: ✅ Already works (deletePage invalidates content cache)

### Test 3: Move Page Between Categories
**Steps**:
1. Note "AUTUMN" count (18) and "DODEC" count (14)
2. Navigate to any AUTUMN page
3. Edit page, change category to "DODEC"
4. Save changes
5. Navigate back to `/wiki`
6. **Expected**: "AUTUMN" shows 17, "DODEC" shows 15
7. **Without fix**: Both show old counts for 5 minutes
8. **With fix**: Both show new counts immediately

### Test 4: Publish Draft Page
**Steps**:
1. Create page with status="draft" in "NOXII" category
2. Note "NOXII" count (currently 32)
3. Edit page, change status to "published"
4. Navigate back to `/wiki`
5. **Expected**: "NOXII" shows 33 pages
6. **Without fix**: Shows 32 for 5 minutes
7. **With fix**: Shows 33 immediately

---

## Impact Assessment

### Before Fix
- ❌ Users see stale category counts (up to 5 minutes)
- ❌ Confusing UX ("I just added a page, why doesn't it show?")
- ❌ Undermines trust in wiki system
- ❌ Category migration appears broken
- ✅ Fast homepage loads (1-2ms)

### After Fix
- ✅ Users see accurate category counts immediately
- ✅ Clear, predictable UX
- ✅ Builds trust in wiki system
- ✅ Category migration works correctly
- ⚠️ Slightly slower homepage loads (20-50ms on cache miss)
  - Cache hit rate: ~80-90% (reduced from ~95%)
  - Acceptable trade-off for accuracy

### Performance Impact

**Current state** (with 5-minute cache):
- Cache hit rate: ~95%
- Cache miss cost: 20-50ms
- Average page load: ~2-5ms (mostly cache hits)

**After fix** (with 1-minute cache + aggressive invalidation):
- Cache hit rate: ~80-90%
- Cache miss cost: 20-50ms
- Average page load: ~5-10ms (more cache misses)
- **Trade-off**: +5ms average latency for accurate data

**Verdict**: ✅ Acceptable performance trade-off

---

## Root Cause Summary

**The wiki category counts are not updating because**:

1. ✅ Page counts are calculated correctly (SQL subquery)
2. ✅ Cache invalidation exists (but incomplete)
3. ❌ **Page creation does NOT invalidate content cache**
4. ❌ **Page updates do NOT invalidate content cache**
5. ⚠️ 5-minute cache TTL is too aggressive for mutable data

**The fix is simple**: Add 2 lines of code to invalidate content cache on page mutations.

---

## Conclusion

**TLDR**: The wiki category boxes show stale data because page creation/updates don't invalidate the content cache. The fix is trivial (2 lines of code) and should be applied immediately.

**Recommendation**: Implement Solution 2 (fix cache invalidation) + Solution 3 (reduce TTL to 60s).

**Expected Result**: Category counts update in real-time, users see accurate data, minimal performance impact.

**Implementation Time**: ~5 minutes
**Testing Time**: ~10 minutes
**Risk Level**: ⚠️ Low (conservative change, well-tested pattern)

---

## Files to Modify

1. **`frontend/src/lib/wiki/services/WikiPageService.ts`**
   - Line 107: Add `await cacheManager.invalidateCategory('content');`
   - Line 261: Add `await cacheManager.invalidateCategory('content');`

2. **`frontend/src/lib/cache/manager.ts`** (optional but recommended)
   - Line 88: Change `ttl: 300` to `ttl: 60`

---

**Status**: Ready for implementation
**Priority**: P1 - User-facing data integrity issue
**Complexity**: Low (2-line fix)
**Risk**: Low (follows existing patterns)
