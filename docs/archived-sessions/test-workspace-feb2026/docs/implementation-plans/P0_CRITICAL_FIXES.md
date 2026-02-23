# P0 Critical Fixes - Implementation Plan

**Priority:** P0 (Critical)
**Estimated Time:** 2 hours
**Impact:** Breaks core functionality (tag filtering on anarchist documents)

---

## Overview

This document outlines critical bugs that break core functionality and must be fixed immediately before any other development work.

---

## Bug 1: Tag Filtering Not Working for Anarchist Documents

**File:** `/frontend/src/lib/anarchist/service.ts`
**Lines:** 85-95
**Severity:** Critical
**Impact:** Users cannot filter anarchist documents by tags despite UI showing tag filters

### Problem Description

The `getDocuments()` function accepts a `tags` parameter in its type definition but never uses it in the SQL WHERE clause. This means tag filtering is completely non-functional for the anarchist collection.

```typescript
// Current code (BROKEN)
export async function getDocuments(params: GetAnarchistDocumentsParams): Promise<GetAnarchistDocumentsResult> {
  const { query, language, category, author, sort_by, sort_order, page, limit } = params;
  // ❌ tags parameter is defined in type but NOT extracted above

  let whereConditions: string[] = [];
  // ❌ No tag filtering logic added to whereConditions
}
```

### Root Cause

Parameter destructuring doesn't include `tags`, and no WHERE clause logic checks the `anarchist.document_tags` join table.

### Impact Analysis

- **User Impact:** High - users cannot use tag filtering (194,664 tag associations unusable)
- **Data Integrity:** None - data is correct, query logic is broken
- **Performance:** None currently, but fix will add JOIN
- **SEO/Discovery:** High - tag-based discovery completely broken

### Implementation Plan

**Time Estimate:** 1.5 hours

**Step 1: Add Parameter Extraction** (10 minutes)
```typescript
export async function getDocuments(params: GetAnarchistDocumentsParams): Promise<GetAnarchistDocumentsResult> {
  const { query, language, category, author, tags, sort_by, sort_order, page, limit } = params;
  //                                           ^^^^^ ADD THIS
```

**Step 2: Add Tags Join and Filtering** (45 minutes)
```typescript
let sql = `
  SELECT DISTINCT
    d.id,
    d.title,
    d.slug,
    d.authors,
    d.year,
    d.language,
    d.category,
    d.preview_text,
    d.downloads,
    d.reading_ease_score
  FROM anarchist.documents d
`;

// Add join if tags filter is present
if (tags && tags.length > 0) {
  sql += `
  INNER JOIN anarchist.document_tags dt ON d.id = dt.document_id
  INNER JOIN shared.tags t ON dt.tag_id = t.id
  `;

  // Add tag filtering to WHERE clause
  whereConditions.push(`t.normalized_name = ANY($${params.length + 1})`);
  queryParams.push(tags.map(tag => tag.toLowerCase().trim()));
}
```

**Step 3: Add Tests** (30 minutes)
- Test tag filtering with single tag
- Test tag filtering with multiple tags (AND vs OR logic - need to decide)
- Test tag filtering combined with other filters (query, language, category)
- Test pagination with tag filtering
- Test tag filtering with 0 results

**Step 4: Verify in UI** (15 minutes)
- Navigate to anarchist library page
- Select tag filters in UI
- Verify results update correctly
- Check URL params are passed correctly from frontend

### Testing Checklist

- [ ] Single tag filter returns correct documents
- [ ] Multiple tag filter works (decide AND vs OR behavior)
- [ ] Tag filter + search query works together
- [ ] Tag filter + language filter works
- [ ] Tag filter + category filter works
- [ ] Tag filter + author filter works
- [ ] Pagination works with tag filtering
- [ ] Sort order preserved with tag filtering
- [ ] Empty results handled gracefully
- [ ] Tag case-insensitivity works (shared.tags.normalized_name)

### Rollout Plan

1. **Local Testing:** Test fix against local PostgreSQL with full anarchist dataset
2. **Staging Deploy:** Deploy to staging, verify tag filtering works end-to-end
3. **Production Deploy:** Deploy via Coolify, monitor logs for query errors
4. **Verification:** Manually test tag filtering on production site
5. **Monitor:** Check PostgreSQL slow query logs for performance issues

### Performance Considerations

**Query Performance:**
- Adding JOIN on `anarchist.document_tags` and `shared.tags`
- Index `idx_anarchist_document_tags_document` already exists on `document_id`
- Shared.tags has index on `normalized_name` (verify this exists)
- Tag filtering queries should be fast with proper indexes

**Recommended Index Check:**
```sql
-- Verify this index exists
SELECT * FROM pg_indexes
WHERE tablename = 'tags'
  AND schemaname = 'shared'
  AND indexname LIKE '%normalized%';

-- If not, create it:
CREATE INDEX idx_shared_tags_normalized_name ON shared.tags(normalized_name);
```

### AND vs OR Behavior Decision

**Question:** When user selects multiple tags, should we return documents that have:
- **AND:** ALL selected tags (intersection)
- **OR:** ANY selected tag (union)

**Recommendation:** Start with **OR** behavior (ANY tag) because:
1. More permissive, better for discovery
2. Matches typical e-commerce filtering UX
3. Can add "Match all tags" toggle later if needed

**OR Implementation:**
```sql
WHERE t.normalized_name = ANY($n)
```

**AND Implementation (if needed later):**
```sql
GROUP BY d.id
HAVING COUNT(DISTINCT t.id) = $tagCount
```

---

## Deployment

**Branch:** `fix/anarchist-tag-filtering`

**Commit Message:**
```
fix: implement tag filtering for anarchist documents

The getDocuments() function in anarchistService.ts accepted a 'tags'
parameter but never used it in the SQL query. This completely broke
tag filtering for the anarchist collection.

Changes:
- Extract 'tags' parameter in function destructuring
- Add INNER JOIN to anarchist.document_tags and shared.tags
- Add WHERE clause filtering by normalized_name
- Use OR behavior (ANY tag) for multiple tag selection
- Add comprehensive tests for tag filtering
- Verify indexes exist for query performance

Impact: Fixes tag filtering for 194,664 tag associations across
24,643 anarchist documents. Critical UX bug affecting discovery.

Refs: anarchistService.ts:85-95
```

**Files Changed:**
- `/frontend/src/lib/anarchist/service.ts` (10-15 lines added)
- `/frontend/src/lib/anarchist/__tests__/service.test.ts` (new file, 100+ lines)

**Estimated Diff:** +120 lines / -2 lines

---

## Post-Deployment Verification

**SQL Query to Test:**
```sql
-- Test tag filtering directly in PostgreSQL
SELECT DISTINCT
  d.id,
  d.title,
  t.name as tag_name
FROM anarchist.documents d
INNER JOIN anarchist.document_tags dt ON d.id = dt.document_id
INNER JOIN shared.tags t ON dt.tag_id = t.id
WHERE t.normalized_name = ANY(ARRAY['anarchism', 'revolution'])
ORDER BY d.title
LIMIT 10;
```

**UI Verification Steps:**
1. Navigate to https://www.veritablegames.com/library
2. Switch to "Anarchist Library" tab
3. Click on tag filter dropdown
4. Select 1-2 tags
5. Verify results update immediately
6. Check URL contains `?tags=anarchism,revolution`
7. Verify pagination works with tags
8. Clear tags, verify all documents return

---

## Risk Assessment

**Risks:** Low
- Simple SQL fix, well-understood pattern
- Indexes already exist for performance
- No data migration required
- No API breaking changes

**Mitigation:**
- Comprehensive test coverage before deploy
- Verify on staging environment first
- Monitor PostgreSQL slow query logs after deploy
- Can revert immediately if performance issues

**Rollback Plan:**
- Git revert commit
- Redeploy previous version via Coolify
- No data cleanup required (query-only change)

---

## Success Metrics

**Before Fix:**
- Tag filtering: 0% functional
- User complaints: Unknown (likely unreported)
- Tag association usage: 0%

**After Fix:**
- Tag filtering: 100% functional
- Query performance: <100ms for typical tag queries
- Tag association usage: Measurable in analytics

**Monitoring:**
```sql
-- Track tag filtering usage
SELECT
  COUNT(*) as tag_filtered_queries,
  AVG(query_time) as avg_query_time
FROM query_logs
WHERE query_contains_tag_filter = true
  AND timestamp > NOW() - INTERVAL '7 days';
```

---

**Document Status:** Ready for Implementation
**Last Updated:** 2025-11-17
**Author:** Claude Code (Architecture Analysis)
