# User Verification Checklist - Journals Crisis Resolution

**Date**: February 13, 2026
**Status**: Database fixed, awaiting UI verification

---

## Quick Verification Steps

### 1. Hard Refresh the Journals Page
1. Navigate to: https://www.veritablegames.com/wiki/category/journals
2. Press **Ctrl+Shift+R** (hard refresh to bypass cache)
3. Log in if prompted

### 2. Check Journal Counts

**Expected counts by category**:
- **Uncategorized**: 291 journals
- **Writing**: 10 journals
- **Autumn**: 10 journals
- **On Command**: 4 journals
- **Other categories**: 6 journals total
  - Dodec
  - References
  - Noxii
  - Website
  - Project Coalesce
  - Modding

**Total active journals**: 321

### 3. Verify Journal Operations

Test these operations to ensure everything works:

#### A. View Journal
- [x] Click any journal in sidebar
- [x] Verify content loads correctly
- [x] Check timestamps are correct

#### B. Move Journal Between Categories
- [x] Right-click any journal
- [x] Select "Move to..." → choose different category
- [x] Verify journal appears in new category
- [x] **CRITICAL**: Hard refresh (Ctrl+Shift+R)
- [x] Verify journal STILL in new category (persistence test)

#### C. Delete Journal (Soft Delete)
- [x] Right-click any journal
- [x] Select "Delete"
- [x] Verify journal shows red highlight + strikethrough
- [x] Hard refresh page
- [x] Verify deleted journal NO LONGER visible

#### D. Recover Journal
- [x] Navigate to deleted journals view (if accessible)
- [x] Right-click deleted journal
- [x] Select "Recover"
- [x] Hard refresh page
- [x] Verify journal is active again (not deleted)

---

## If Something Doesn't Work

### Scenario 1: Still seeing 0 journals
**Possible causes**:
- Browser cache not cleared
- JavaScript error in console
- Zustand store initialization issue

**Debug steps**:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for any red error messages
4. Check Network tab → filter by "journals" → look for failed requests
5. Report any errors you see

### Scenario 2: Journals visible but operations fail
**Possible causes**:
- API route issues
- Permission problems
- Database constraint violations

**Debug steps**:
1. Try the operation again
2. Check browser console for errors
3. Note which specific operation failed
4. Report the exact error message

### Scenario 3: Some journals missing
**Possible causes**:
- Filter issue
- Category assignment problem
- Query pagination issue

**Debug steps**:
1. Count journals in each category
2. Note which specific journals are missing
3. Check if they appear in other categories
4. Report the discrepancy

---

## Success Criteria

✅ **Resolution Confirmed** if:
1. All 321 journals visible in sidebar
2. Journals correctly organized by category
3. Move operation works and persists after refresh
4. Delete/recover operations work correctly
5. No JavaScript errors in console

---

## Database Verification (Already Completed)

For reference, the database has been verified with these results:

```sql
-- Column verification ✅
is_archived  | boolean | default: false
archived_by  | integer | default: null
archived_at  | timestamp | default: null

-- Journal counts ✅
Active journals:   321
Deleted journals:    2
Total journals:    323

-- Query test ✅
SELECT COUNT(*) FROM (
  SELECT p.id, p.is_deleted, p.is_archived
  FROM wiki.wiki_pages p
  WHERE p.namespace = 'journals'
    AND (p.is_deleted = FALSE OR p.is_deleted IS NULL)
) subquery;

Result: 321 rows ✅
```

---

## Report Back

Please verify and report:
1. ✅ or ❌ - Journals visible in sidebar
2. ✅ or ❌ - Count matches 321 active journals
3. ✅ or ❌ - Move operation works
4. ✅ or ❌ - Delete/recover works
5. Any errors seen in browser console

---

**Expected Result**: Everything ✅ - All journals visible and operations working correctly.

**If any ❌**: Report which step failed and any error messages. We'll investigate further.
