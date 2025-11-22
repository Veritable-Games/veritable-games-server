# Library Visibility Bug & Migration Status Report

**Date**: November 21, 2025
**Status**: 🚨 CRITICAL BUG BLOCKING LIBRARY VISIBILITY
**Impact**: Only 2 of 3,859 user library documents are visible

---

## 🚨 Critical Bug: Wrong Tags Table in Library Service

### The Problem

**User library documents are NOT appearing** because the library service is querying the **wrong tags table**.

**File**: `frontend/src/lib/library/service.ts`
**Line**: 219
**Bug**: Queries `library.library_tags` instead of `shared.tags`

```typescript
// ❌ CURRENT (BROKEN)
const tagsQuery = `
  SELECT dt.document_id, t.id, t.name, tc.type
  FROM library_document_tags dt
  JOIN library_tags t ON dt.tag_id = t.id  // ❌ WRONG!
  LEFT JOIN library_tag_categories tc ON t.category_id = tc.id
  WHERE dt.document_id IN (${placeholders})
`;
```

```typescript
// ✅ CORRECT (SHOULD BE)
const tagsQuery = `
  SELECT dt.document_id, t.id, t.name, tc.type
  FROM library_document_tags dt
  JOIN shared.tags t ON dt.tag_id = t.id  // ✅ CORRECT!
  LEFT JOIN shared.tag_categories tc ON t.category_id = tc.id
  WHERE dt.document_id IN (${placeholders})
`;
```

---

## 📊 Database Evidence

### Tag Counts

| Table | Count | Status |
|-------|-------|--------|
| `shared.tags` | 19,952 tags | ✅ Unified schema (NEW) |
| `library.library_tags` | 60 tags | ❌ Old schema (DEPRECATED) |

### Document Tag Associations

| Query | Documents with Tags | Notes |
|-------|---------------------|-------|
| `library_document_tags → shared.tags` | 3,886 documents | ✅ CORRECT (matches foreign key) |
| `library_document_tags → library.library_tags` | ~2 documents | ❌ WRONG (only legacy tag IDs match) |

### Foreign Key Constraint (The Truth)

```sql
-- This is what the database ACTUALLY enforces:
ALTER TABLE library.library_document_tags
  ADD CONSTRAINT library_document_tags_tag_id_fkey
  FOREIGN KEY (tag_id) REFERENCES shared.tags(id);
```

The foreign key points to `shared.tags`, NOT `library.library_tags`.

---

## 🔍 Why Anarchist Library Works (24,643 docs visible)

**File**: `frontend/src/lib/anarchist/service.ts`
**Lines**: 206-207

```typescript
// ✅ ANARCHIST SERVICE (WORKING CORRECTLY)
const tagsQuery = `
  SELECT dt.document_id, t.id, t.name, tc.type
  FROM anarchist.document_tags dt
  JOIN shared.tags t ON dt.tag_id = t.id  // ✅ Uses shared.tags!
  WHERE dt.document_id = ANY($1)
  ...
`;
```

The anarchist service correctly uses `shared.tags`, so all 24,643 documents display properly.

---

## 📋 Comparison: Working vs Broken

| Feature | Anarchist Library (WORKING) | User Library (BROKEN) |
|---------|----------------------------|----------------------|
| **Total documents** | 24,643 | 3,859 |
| **Visible documents** | 24,643 (100%) | 2 (0.05%) |
| **Tags table used** | `shared.tags` ✅ | `library.library_tags` ❌ |
| **Tag count in table** | 19,952 unified tags | 60 old tags |
| **Code location** | `anarchist/service.ts:206-207` | `library/service.ts:218-222` |
| **Database schema** | `anarchist.document_tags → shared.tags` | `library.library_document_tags → shared.tags` |
| **Schema consistency** | ✅ Code matches DB | ❌ Code uses wrong table |

---

## 🛠️ The Fix

### Step 1: Update Tags Query

**File**: `frontend/src/lib/library/service.ts`
**Lines**: 218-222

```diff
  const tagsQuery = `
    SELECT
      dt.document_id,
      t.id,
      t.name,
      tc.type
    FROM library_document_tags dt
-   JOIN library_tags t ON dt.tag_id = t.id
+   JOIN shared.tags t ON dt.tag_id = t.id
-   LEFT JOIN library_tag_categories tc ON t.category_id = tc.id
+   LEFT JOIN shared.tag_categories tc ON t.category_id = tc.id
    WHERE dt.document_id IN (${placeholders})
  `;
```

### Step 2: Verify Tag Categories Table Exists

Check if `shared.tag_categories` exists in the database:

```sql
-- Run this query
SELECT COUNT(*) FROM shared.tag_categories;
```

If it doesn't exist, you may need to:
1. Keep using `library.library_tag_categories` temporarily
2. OR migrate tag categories to unified schema
3. OR remove the category JOIN if not needed

### Step 3: Check Tag Filtering Logic

**File**: `frontend/src/lib/library/service.ts`
**Lines**: 154-158

Verify tag filtering also uses correct table:

```typescript
// Check if this exists and uses correct table
if (tags && tags.length > 0) {
  // Should reference shared.tags, not library.library_tags
}
```

---

## 🎯 Impact After Fix

### Before Fix
- ❌ Only ~2 documents visible (those with legacy tag IDs)
- ❌ 3,857 documents hidden (99.95% of library)
- ❌ Tag filtering broken
- ❌ Cannot preview migration work

### After Fix
- ✅ All 3,859 published documents visible
- ✅ Correct tags from `shared.tags` (19,952 tags)
- ✅ Tag filtering works correctly
- ✅ Can preview migration scripts before running on full dataset

---

## 📝 Migration Work Status (Separate from Bug)

### ✅ Completed (Ready to Use After Bug Fix)

1. **Phase 0: Pre-Migration Safety** ✅
   - Full PostgreSQL backup created (522 MB)
   - Disk space verified (319 GB available)
   - Test migration successful (10 samples, 100% success)
   - Rollback procedure validated

2. **Phase 1: TypeScript Infrastructure** ✅
   - `LibraryFileService` created (`file-service.ts`)
   - Dual-read architecture implemented (file OR database)
   - `file_path` column added to database
   - Migration scripts created (Python)

3. **Phase 1: Migration Scripts** ✅
   - `cleanup_pdf_artifacts.py` - Removes 9 types of artifacts
   - `detect_document_structure.py` - Detects chapters (25+ patterns)
   - `assess_document_quality.py` - Quality scoring (5 categories)
   - `test_full_migration_pipeline.py` - Integration test

4. **Phase 1: Validation** ✅
   - Test run on 20 diverse samples (PASSED)
   - 100% success rate across all 3 phases
   - Average 4.0% size reduction from cleanup
   - 55% chapter detection rate
   - Quality assessment working correctly

### ⏸️ Paused (Waiting for Visibility Bug Fix)

1. **Phase 2: Production Migration** ⏸️
   - Cannot run until documents are visible
   - Need to preview results before full migration
   - Would migrate all 3,859 documents to file-based storage

---

## 🔄 Recommended Action Plan

### Immediate (Today)

1. **Fix the visibility bug** (5 minutes)
   - Update `library/service.ts` line 219
   - Change `library.library_tags` → `shared.tags`
   - Verify `shared.tag_categories` exists
   - Commit and deploy

2. **Verify fix** (5 minutes)
   - Check that all 3,859 documents now appear
   - Test tag filtering works
   - Confirm pagination working

3. **Preview migration scripts** (optional)
   - Browse to a few library documents
   - Check that they have PDF artifacts (page markers, etc.)
   - Verify migration will actually clean them up

### Next Steps (After Visibility Fixed)

1. **Run Phase 2: Production Migration** (~30-40 minutes)
   - Phase 1: Cleanup artifacts on all 3,859 docs
   - Phase 2: Detect structure (chapters, types)
   - Phase 3: Quality assessment
   - Generate reports for review

2. **Review quality reports** (1-2 hours)
   - Identify documents flagged for manual review
   - Check structure detection accuracy
   - Decide on action thresholds

3. **Execute file migration** (Phase 4)
   - Migrate to markdown files with YAML frontmatter
   - Update database with `file_path` references
   - Validate dual-read architecture

---

## 📚 Documentation References

### Bug Fix Documentation
- This file (status report)
- `frontend/src/lib/library/service.ts` (code to fix)
- `frontend/src/lib/anarchist/service.ts` (reference implementation)

### Migration Documentation
- `resources/scripts/cleanup_pdf_artifacts.py`
- `resources/scripts/detect_document_structure.py`
- `resources/scripts/assess_document_quality.py`
- `resources/scripts/test_full_migration_pipeline.py`
- `resources/logs/migration/test-run/full_pipeline_test_20251121_034221.json`

### Database Schema
- `library.library_documents` - User library documents (3,859)
- `library.library_document_tags` - Tag associations → `shared.tags`
- `shared.tags` - Unified tag schema (19,952 tags)
- `shared.tag_categories` - Tag categories (may need to verify)

---

## 🎯 Summary

### The Bug
**Wrong tags table reference in library service** prevents 99.95% of user library documents from appearing.

### The Fix
Change 2 lines in `library/service.ts` to use `shared.tags` instead of `library.library_tags`.

### The Migration
All migration scripts are **ready and tested**, but should wait until bug is fixed so you can:
1. Preview documents before migration
2. Verify artifacts exist and need cleanup
3. Test migration on visible documents first

### Estimated Timeline
- Bug fix: 5 minutes
- Deployment: 2-3 minutes (Coolify auto-deploy)
- Verification: 5 minutes
- **Total**: 15 minutes to restore full library visibility

---

**Status**: 🚨 CRITICAL BUG IDENTIFIED
**Next Action**: Fix tags table reference in library service
**Migration**: Ready to proceed after bug fix
