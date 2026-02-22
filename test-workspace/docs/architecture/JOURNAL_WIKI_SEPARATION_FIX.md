# Journal/Wiki Separation Architecture Fix

**Date**: February 15, 2026
**Issue**: Journals leaking into Wiki "Uncategorized" category
**Status**: ✅ FIXED

## Root Cause

### Architectural Design
Journals and Wiki pages are **not separate systems** - they share the same database table:

```
wiki_pages
├── namespace: 'main' → Wiki pages
└── namespace: 'journals' → Journal entries
```

**The Problem**: Namespace filtering was inconsistently applied across wiki services.

## The Bug

### Missing Namespace Filters

**WikiPageService.ts** - `getAllPages()` method (line 616):
- ❌ **BEFORE**: `WHERE p.status = 'published'`
- ✅ **AFTER**: `WHERE p.status = 'published' AND p.namespace != 'journals'`

**WikiSearchService.ts** - `searchPages()` method (line 59-63):
- ❌ **BEFORE**: Only filtered if explicit namespace provided
- ✅ **AFTER**: Excludes journals by default unless `namespace: 'journals'` requested

**WikiSearchService.ts** - `fullTextSearch()` method (line 508-512):
- ❌ **BEFORE**: Only filtered if explicit namespace provided
- ✅ **AFTER**: Excludes journals by default unless `namespace: 'journals'` requested

## Files Fixed

| File | Method | Line | Fix |
|------|--------|------|-----|
| `WikiPageService.ts` | `getAllPages()` | 617 | Added `AND p.namespace != 'journals'` |
| `WikiSearchService.ts` | `searchPages()` | 63-66 | Added default journal exclusion |
| `WikiSearchService.ts` | `fullTextSearch()` | 512-515 | Added default journal exclusion |

## Already Correct (No Changes Needed)

These services already had proper namespace filtering:

| File | Method | Line | Status |
|------|--------|------|--------|
| `WikiCategoryService.ts` | Various | 232, 303, 353, 387 | ✅ Has `p.namespace != 'journals'` |
| `WikiAnalyticsService.ts` | Analytics | 272 | ✅ Has `p.namespace != 'journals'` |
| `WikiSearchService.ts` | `getPopularPages()` | 222 | ✅ Has `p.namespace != 'journals'` |
| `WikiSearchService.ts` | `getRecentPages()` | 287 | ✅ Has `p.namespace != 'journals'` |

## Impact

**Before Fix:**
- Creating a journal entry → Appears in Wiki "Uncategorized"
- Wiki queries return ALL published pages (wiki + journals)
- User confusion: "Why are my private journals in the public wiki?"

**After Fix:**
- Journal entries stay in journal UI only
- Wiki queries exclude journals by default
- Explicit `namespace: 'journals'` searches still work (for journal search feature)

## Testing Recommendations

1. Create a new journal entry
2. Check Wiki "Uncategorized" category → Should NOT appear
3. Search wiki for journal content → Should NOT find journals
4. Access journal via Journals UI → Should work normally

## Long-Term Architecture Recommendation

**Consider**: Move journals to a dedicated `journals` table in the future to:
- Eliminate namespace filtering complexity
- Improve query performance
- Reduce accidental cross-contamination
- Make system boundaries clearer

**Trade-offs**:
- Requires database migration
- Lose shared wiki revision/category/tag infrastructure
- More code duplication between systems

**Decision**: Keep current shared-table architecture for now, but enforce strict namespace filtering.

## Related Files

- Journal creation: `src/app/api/journals/route.ts`
- Wiki queries: `src/lib/wiki/services/WikiPageService.ts`
- Search: `src/lib/wiki/services/WikiSearchService.ts`

---

**Last Updated**: February 15, 2026
**Author**: Claude Code
**Commit**: (to be added)
