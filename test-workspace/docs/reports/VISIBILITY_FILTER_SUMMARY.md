# Category Visibility Filter - Executive Summary

**Status**: November 13, 2025
**Severity**: Medium (inconsistent UI, but data not exposed to unauthorized users via other means)
**Root Cause**: Missing `is_public` filter in three database queries

---

## The Problem in 30 Seconds

When an admin toggles a category's visibility (Ctrl+Click + TAB in WikiCategoriesGrid):
- ✅ The category grid shows the change (eye overlay appears)
- ✅ The database is updated correctly
- ❌ Popular Pages tab still shows pages from that category
- ❌ Recent Activity tab still shows activity from that category
- ❌ Users see inconsistent UI

---

## Root Cause

Three database queries are missing a WHERE clause filter for the `is_public` field in the `wiki_categories` table.

### What's Working
```
WikiCategoryService.getAllCategories()
  ├─ Fetches all categories from DB
  ├─ Filters in JavaScript: if (is_public === false) return userRole === 'admin'
  └─ Result: Only shows categories user can see ✓
```

### What's Broken
```
WikiSearchService.getPopularPages()
  ├─ Fetches pages from DB
  ├─ Filter: namespace != 'journals' ✓
  ├─ Filter: library category access ✓
  ├─ Filter: is_public ✗ MISSING
  └─ Result: Shows pages from ALL categories, even admin-only ones ✗

WikiSearchService.getRecentPages()
  └─ (Same issue as getPopularPages)

WikiAnalyticsService.getRecentActivity()
  └─ (Same issue, no is_public filter at all)
```

---

## The Architecture Gap

```
         WikiCategoriesGrid
              │
         TAB key → toggle visibility
              │
         Update database ✓
              │
         Update local state ✓
              │
              X ──────────── NO COMMUNICATION ──────────→ X
              │                                            │
              │                                    WikiLandingTabs
              │                                    (shows old data)
              │                                            │
         Eye overlay ✓                    Still shows admin-only content ✗
```

Two sibling components with NO state sharing mechanism.

---

## Files Affected

### Files With Issues (Need Fixing)
1. **WikiSearchService.ts** - `getPopularPages()` (line ~220)
2. **WikiSearchService.ts** - `getRecentPages()` (line ~283)
3. **WikiAnalyticsService.ts** - `getRecentActivity()` (line ~129)

### Files Working Correctly (No Fix Needed)
1. **WikiCategoryService.ts** - `getAllCategories()` - Correctly filters by is_public
2. **WikiCategoriesGrid.tsx** - Correctly manages visibility toggle
3. **page.tsx** - Correctly fetches data (but downstream services filter incorrectly)

---

## The Fix (3 SQL WHERE Clauses)

### Before (All Three Broken Methods)
```sql
WHERE p.status = 'published'
  AND p.namespace != 'journals'
```

### After (All Three Fixed Methods)
```sql
WHERE p.status = 'published'
  AND p.namespace != 'journals'
  AND (c.is_public = TRUE OR c.is_public IS NULL)  -- ← ADD THIS LINE
```

**Why this works**:
- Shows pages only from categories where `is_public = TRUE` (public)
- Also shows pages from categories where `is_public IS NULL` (undefined/default public)
- Hides pages from categories where `is_public = FALSE` (admin-only)
- Only applies filter to non-admin users (add userRole check if needed)

---

## Exact Locations

| File | Line | Function | Current | Needed |
|------|------|----------|---------|--------|
| WikiSearchService.ts | ~220 | getPopularPages() | `WHERE p.status = 'published' AND p.namespace != 'journals'` | Add `AND (c.is_public = TRUE OR c.is_public IS NULL)` |
| WikiSearchService.ts | ~283 | getRecentPages() | `WHERE p.status = 'published' AND p.namespace != 'journals'` | Add `AND (c.is_public = TRUE OR c.is_public IS NULL)` |
| WikiAnalyticsService.ts | ~129 | getRecentActivity() | `WHERE ua.activity_type = 'wiki_edit' AND ua.entity_type IN ...` | Add `AND (c.is_public = TRUE OR c.is_public IS NULL)` |

---

## Impact Assessment

### Users Affected
- **Non-admin users**: See inconsistent UI (categories hidden in grid but shown in Popular Pages/Recent Activity)
- **Admin users**: No issues (they see everything)

### Severity
- **Data exposure**: Low - authorization controlled elsewhere, pages still require permission to view
- **UI consistency**: Medium - confusing when hidden category appears in tabs
- **Data integrity**: None - database is correct, filtering is the issue

### Performance Impact
- Adding WHERE clause has negligible performance impact (indexes already exist on is_public)
- May actually improve performance by reducing result set size

---

## Component Interaction Map

```
/app/wiki/page.tsx (SERVER)
  │
  ├─ getCategories() ──────────→ getAllCategories() ✓ (filters is_public)
  ├─ getPopularPages() ────────→ getPopularPages() ✗ (NO filter)
  ├─ getRecentActivity() ──────→ getRecentActivity() ✗ (NO filter)
  │
  └─ Render to Client
      │
      ├─ WikiCategoriesGrid
      │  ├─ State: categories[] with is_public
      │  ├─ Handler: TAB key → toggle visibility
      │  ├─ Output: Eye overlay for admin-only ✓
      │  └─ Effect: Updates DB, local state
      │
      └─ WikiLandingTabs
         ├─ Props: popularPages, recentActivity (STATIC)
         ├─ No state for visibility
         ├─ Output: Shows ALL content ✗
         └─ Effect: None (no refresh mechanism)
```

---

## Testing Strategy

### Test Case 1: Admin Makes Category Admin-Only
```
1. Admin navigates to /wiki
2. Admin Ctrl+Clicks "tutorials" category → selects it
3. Admin presses TAB → toggles visibility to admin-only
   Expected: Eye overlay appears on tutorials
4. Refresh page (Ctrl+R)
5. Check Popular Pages tab
   Before fix: Shows tutorials pages ✗
   After fix: Tutorials pages hidden ✓
6. Check Recent Activity tab
   Before fix: Shows tutorials activity ✗
   After fix: Tutorials activity hidden ✓
```

### Test Case 2: Regular User Sees Consistent UI
```
1. Some categories marked admin-only (is_public = false)
2. Non-admin user navigates to /wiki
3. Categories grid: Admin-only categories NOT visible ✓
4. Popular Pages tab: No pages from admin-only categories ✓ (after fix)
5. Recent Activity tab: No activity from admin-only categories ✓ (after fix)
```

### Test Case 3: Admin Sees Everything
```
1. Some categories marked admin-only
2. Admin navigates to /wiki
3. Categories grid: ALL categories visible ✓
4. Popular Pages tab: All pages visible ✓ (after fix)
5. Recent Activity tab: All activity visible ✓ (after fix)
```

---

## Secondary Issues (Not Critical)

### Issue: Missing userRole Parameter
**Location**: WikiAnalyticsService.getRecentActivity()

**Current**: Doesn't accept userRole parameter
```typescript
async getRecentActivity(limit: number = 10): Promise<any[]>
```

**Should be**:
```typescript
async getRecentActivity(limit: number = 10, userRole?: string): Promise<any[]>
```

**Impact**: Can't customize filtering based on user role (non-critical for is_public filtering since default behavior is correct)

### Issue: Cache Invalidation
**Current**: When visibility changes, cached results are not invalidated
```typescript
// Cache entries:
popular_pages:5:admin
popular_pages:5:anonymous
recent_pages:5:admin
recent_pages:5:anonymous
wiki_activity:recent:6
```

**Solution**: Invalidate when visibility changes (low priority, caches expire in 5-10 minutes)

---

## Deployment Checklist

- [ ] Add WHERE clause to WikiSearchService.getPopularPages()
- [ ] Add WHERE clause to WikiSearchService.getRecentPages()
- [ ] Add WHERE clause to WikiAnalyticsService.getRecentActivity()
- [ ] Add userRole parameter to getRecentActivity()
- [ ] Update call site in page.tsx to pass userRole
- [ ] Test with admin-only category
- [ ] Verify non-admin users see consistent UI
- [ ] Verify admin users see all content
- [ ] (Optional) Add cache invalidation mechanism

---

## Code Review Notes

### Pattern to Follow
See `WikiCategoryService.getAllCategories()` lines 304-311 for the correct filtering pattern:

```typescript
const filteredCategories = allCategories.filter(category => {
  if (category.is_public === false) {
    return userRole === 'admin';
  }
  return true;
});
```

### Implementation Options
1. **Database Level** (RECOMMENDED): Add WHERE clause to queries
2. **Application Level**: Filter results in TypeScript after query
3. **Context API**: Share state between components (unnecessary with DB fix)

### Why DB Level is Best
- Single source of truth
- Consistent across all code paths
- Better performance (filter at query time)
- Matches existing pattern in getAllCategories()

---

## Estimated Effort

| Task | Effort | Priority |
|------|--------|----------|
| Add is_public filter to getPopularPages() | 2 minutes | HIGH |
| Add is_public filter to getRecentPages() | 2 minutes | HIGH |
| Add is_public filter to getRecentActivity() | 5 minutes | HIGH |
| Add userRole param to getRecentActivity() | 5 minutes | MEDIUM |
| Update call sites | 2 minutes | MEDIUM |
| Test all three fixes | 15 minutes | HIGH |
| **TOTAL** | **~30 minutes** | |

---

## References

### Analysis Documents
1. **VISIBILITY_FILTER_ANALYSIS.md** - Deep technical analysis with data flows
2. **VISIBILITY_FILTER_COMPONENT_TREE.md** - Visual component hierarchy and state flow
3. **VISIBILITY_FILTER_CODE_COMPARISON.md** - Side-by-side code comparison with exact fixes

### Relevant Code Files
- `/frontend/src/lib/wiki/services/WikiSearchService.ts` - Lines 190-249, 254-312
- `/frontend/src/lib/wiki/services/WikiAnalyticsService.ts` - Lines 100-168
- `/frontend/src/lib/wiki/services/WikiCategoryService.ts` - Lines 258-322 (reference implementation)
- `/frontend/src/components/wiki/WikiCategoriesGrid.tsx` - Lines 361-434, 801-816
- `/frontend/src/app/wiki/page.tsx` - Lines 22-28

---

## Next Steps

1. **Read the detailed analysis**: See VISIBILITY_FILTER_ANALYSIS.md for complete explanation
2. **Review the code comparison**: See VISIBILITY_FILTER_CODE_COMPARISON.md for exact changes needed
3. **Implement the fix**: Add three WHERE clause filters (30 minutes total)
4. **Test thoroughly**: Verify all three test cases pass
5. **Deploy**: Include in next release

