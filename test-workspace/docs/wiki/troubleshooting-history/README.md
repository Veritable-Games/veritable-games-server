# Wiki Category Bug - Troubleshooting History

**Period**: October 17 - November 17, 2025 (1 month)
**Status**: ✅ Resolved November 17, 2025
**Final Resolution**: [WIKI_CATEGORY_BUG_FINAL_RESOLUTION_NOV_2025.md](../WIKI_CATEGORY_BUG_FINAL_RESOLUTION_NOV_2025.md)

---

## Overview

This directory contains the complete investigation history of a critical bug that affected all wiki category pages in production for one month. These documents represent multiple debugging sessions and hypotheses before the final resolution.

**Root Cause (Final)**: SQL query in `WikiPageService.ts` attempted to SELECT four non-existent columns (`p.content_type`, `p.document_author`, `p.publication_date`, `p.download_count`) from PostgreSQL `wiki.wiki_pages` table.

**Resolution**: Removed the invalid column references from the SQL query.

---

## Document Timeline (Chronological)

### Phase 1: Initial Investigation
1. **CATEGORY_PAGE_FIX_SESSION.md** - Early debugging session attempting to identify the issue
2. **WIKI_CATEGORY_TROUBLESHOOTING_HISTORY.md** - Comprehensive history of all troubleshooting attempts

### Phase 2: Root Cause Analysis (Multiple Hypotheses)
3. **WIKI_CATEGORY_ROOT_CAUSE_ANALYSIS.md** - First attempt at identifying root cause (authentication issues)
4. **PROPOSED_FIX_ANALYSIS.md** - Proposed solutions based on early understanding
5. **WIKI_CATEGORY_DATABASE_INVESTIGATION_REPORT.md** - Deep dive into database schema and queries

### Phase 3: Architecture Review
6. **WIKI_CATEGORY_RENDERING_ARCHITECTURE_ANALYSIS.md** - Analysis of Next.js Server Component rendering
7. **WIKI_CATEGORY_SECURITY_REVIEW.md** - Security audit and authentication requirements

### Phase 4: Failed Fix Attempts & Learning
8. **WIKI_CATEGORY_FIX_SUMMARY.md** - Summary of attempted fixes (authentication, GROUP BY clauses)
9. **WIKI_CATEGORY_FIX_COMPLETE_SUMMARY.md** - Believed to be complete but wasn't
10. **WIKI_CATEGORY_VERIFICATION_COMPLETE.md** - Verification attempts

### Phase 5: Actual Root Cause Discovery
11. **WIKI_CATEGORY_ACTUAL_ROOT_CAUSE.md** - Discovery of the SQL column mismatch

---

## Key Learnings From This Investigation

### 1. Production Logging is Critical
The breakthrough came when `process.stderr.write()` was used instead of `console.log()`:

```typescript
// ❌ BAD: Stripped in production
console.log('[getCategoryData] Called');

// ✅ GOOD: Preserved in production
console.error('[getCategoryData] Called');

// ✅ BEST: Cannot be stripped
process.stderr.write('[getCategoryData] Called\n');
```

### 2. Deployment Verification is Essential
Multiple times we thought fixes were deployed when they weren't. Always verify:

```bash
ssh user@10.100.0.1 "docker inspect <container> --format='{{range .Config.Env}}{{println .}}{{end}}' | grep SOURCE_COMMIT"
```

### 3. Schema Differences Between Dev & Prod
- **Development**: SQLite (more permissive)
- **Production**: PostgreSQL (stricter, caught the bug)

This strictness difference masked the issue in development.

### 4. Multiple Fixes Can Build Toward Solution
While earlier fixes didn't solve the core issue, they:
- ✅ Hardened authentication security
- ✅ Fixed PostgreSQL GROUP BY compliance
- ✅ Created logging infrastructure that revealed the final bug

### 5. Don't Mix Table Schemas
The bug was caused by copy-pasting columns from library documents schema into wiki pages schema. Always verify column existence when writing SQL.

---

## Related Documentation

- **Final Resolution** (Read this first): [../WIKI_CATEGORY_BUG_FINAL_RESOLUTION_NOV_2025.md](../WIKI_CATEGORY_BUG_FINAL_RESOLUTION_NOV_2025.md)
- **Wiki System Overview**: [../README.md](../README.md)
- **Database Architecture**: [../../database/DATABASE.md](../../database/DATABASE.md)
- **Troubleshooting Guide**: [../../TROUBLESHOOTING.md](../../TROUBLESHOOTING.md)

---

## Statistics

- **Duration**: 1 month (October 17 - November 17, 2025)
- **Debugging Sessions**: 10+ documented sessions
- **Commits Related**: 5 commits (be8da27, d194453, 92f65f2, 43b2d4d, 35607ed)
- **Files Modified**: 8 files
- **Lines Changed**: ~50 lines
- **Time to Fix After Log Discovery**: 14 minutes

---

## Archive Purpose

These documents are preserved for:
1. **Historical Reference** - Understanding how complex bugs get resolved
2. **Training Material** - Teaching debugging techniques and persistence
3. **Pattern Recognition** - Identifying similar issues in the future
4. **Process Improvement** - Learning what worked and what didn't

**Do not delete these files.** They represent valuable institutional knowledge.

---

## Quick Reference: The Actual Bug

**File**: `frontend/src/lib/wiki/services/WikiPageService.ts`
**Method**: `getAllPages()`
**Lines**: 557-560 (removed)

**Before**:
```sql
SELECT
  p.*,
  r.content,
  p.content_type,      -- ❌ Doesn't exist
  p.document_author,   -- ❌ Doesn't exist
  p.publication_date,  -- ❌ Doesn't exist
  p.download_count,    -- ❌ Doesn't exist
  ...
```

**After**:
```sql
SELECT
  p.id,
  p.slug,
  p.title,
  p.namespace,
  -- ... only columns that exist
  r.content,
  ...
```

**Error Message**:
```
[WikiCategory] Error: column p.content_type does not exist
```

**Resolution Commit**: `35607ed`
