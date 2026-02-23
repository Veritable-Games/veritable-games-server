# Library Quality Investigation Summary

**Date**: November 24, 2025
**Status**: ✅ Investigation Complete - Awaiting User Approval for Fixes

---

## Quick Summary

Investigated user library document quality issues reported by the user. Found 5 categories of problems affecting ~47% of 4,456 documents.

**All issues traced to single import batch on November 24, 2025.**

---

## Key Findings

| Issue | Count | % | Severity | Fix Ready |
|-------|-------|---|----------|-----------|
| Empty Content | 99 | 2.2% | 🔴 Critical | ✅ Yes (delete) |
| Encoding Issues | 159 | 3.6% | 🟠 High | ⏳ Needs re-import |
| Missing Authors | 1,867 | 41.9% | 🟡 Medium | ✅ Yes (extract from content) |
| Short Content | 210 | 4.7% | 🟡 Medium | ⏳ Needs manual review |
| No Tags | 215 | 4.8% | 🟢 Low | ✅ Yes (flag for review) |

---

## Documentation Created

1. **[06-library-quality-investigation.md](./06-library-quality-investigation.md)** (NEW)
   - Complete investigation report
   - Diagnostic queries and results
   - Root cause analysis for each issue
   - Proposed fix plan with success criteria
   - ~450 lines of detailed documentation

2. **[05-outstanding-issues.md](./05-outstanding-issues.md)** (UPDATED)
   - Updated with investigation status
   - Links to full investigation report
   - Lists ready fix scripts

---

## Fix Scripts Created

All scripts in `frontend/src/migrations/`:

1. **library-quality-phase1-delete-empty.sql**
   - Deletes 99 documents with 0-byte content
   - Creates audit log of deletions
   - Includes verification queries

2. **library-quality-phase3-extract-authors.sql**
   - Attempts to extract authors from content for 1,867 documents
   - Uses pattern matching (By, Author:, Written by, etc.)
   - Creates temporary function `extract_author_from_content()`
   - Shows preview before updating

3. **library-quality-phase4-flag-untagged.sql**
   - Flags 215 documents without tags
   - Adds `[NEEDS TAGS]` to notes field
   - Prepares for manual review/auto-tagging

---

## Next Steps (Awaiting User Approval)

### Immediate Fixes (Can Execute Now)

1. **Backup database** (CRITICAL - before any changes)
   ```bash
   docker exec veritable-games-postgres pg_dump -U postgres veritable_games > backup_before_library_fixes_2025-11-24.sql
   ```

2. **Execute Phase 1**: Delete empty content (99 docs)
   ```bash
   docker exec -i veritable-games-postgres psql -U postgres -d veritable_games < frontend/src/migrations/library-quality-phase1-delete-empty.sql
   ```

3. **Execute Phase 3**: Extract authors from content
   ```bash
   docker exec -i veritable-games-postgres psql -U postgres -d veritable_games < frontend/src/migrations/library-quality-phase3-extract-authors.sql
   ```

4. **Execute Phase 4**: Flag untagged documents
   ```bash
   docker exec -i veritable-games-postgres psql -U postgres -d veritable_games < frontend/src/migrations/library-quality-phase4-flag-untagged.sql
   ```

### Future Work (Requires More Investigation)

1. **Phase 2: Encoding Repair** (159 documents)
   - Requires re-importing with proper encoding detection
   - Need access to original source files
   - Recommend using `chardet` library for encoding detection

2. **Short Content Review** (210 documents)
   - Manual categorization needed
   - Determine: legitimate vs. broken vs. needs expansion
   - Execute fixes based on category

---

## Expected Results After Fixes

**Before**:
- Total Documents: 4,456
- Empty Content: 99 (2.2%)
- Missing Authors: 1,867 (41.9%)
- No Tags: 215 (4.8%)
- Documents with quality issues: ~2,156 (48.4%)

**After Phase 1, 3, 4**:
- Total Documents: 4,357 (99 deleted)
- Empty Content: 0 (✅ fixed)
- Missing Authors: ~500-1,000 (reduced by 50-80%)
- No Tags: 215 (flagged for review)
- Documents with quality issues: ~875-1,215 (reduced to 20-28%)

**Quality Score Improvement**:
- Current: 51.6% of documents have all metadata
- Target: 72-80% of documents have all metadata

---

## Files Changed This Investigation

### New Files
- `docs/session-work/06-library-quality-investigation.md` (450 lines)
- `frontend/src/migrations/library-quality-phase1-delete-empty.sql`
- `frontend/src/migrations/library-quality-phase3-extract-authors.sql`
- `frontend/src/migrations/library-quality-phase4-flag-untagged.sql`
- `docs/session-work/INVESTIGATION_SUMMARY.md` (this file)

### Updated Files
- `docs/session-work/05-outstanding-issues.md` (added investigation results)

---

## Diagnostic Queries Used

```sql
-- Overall quality check
SELECT
  COUNT(*) as total_library_docs,
  COUNT(*) FILTER (WHERE content LIKE '%&%;%') as docs_with_html_entities,
  COUNT(*) FILTER (WHERE title IS NULL OR title = '') as docs_missing_title,
  COUNT(*) FILTER (WHERE author IS NULL OR author = '') as docs_missing_author,
  COUNT(*) FILTER (WHERE LENGTH(content) < 100) as suspiciously_short_content,
  COUNT(*) FILTER (WHERE content IS NULL OR content = '') as empty_content
FROM library.library_documents;

-- Documents without tags
SELECT COUNT(*) as docs_without_tags
FROM library.library_documents d
WHERE NOT EXISTS (
  SELECT 1 FROM library.library_document_tags dt WHERE dt.document_id = d.id
);

-- Encoding issues
SELECT
  COUNT(*) FILTER (WHERE content ~ '[■□●○◆◇△▲▼►◄]') as replacement_char,
  COUNT(*) FILTER (WHERE content LIKE '%â€%') as utf8_mangle,
  COUNT(*) FILTER (WHERE content LIKE '%Â %') as nbsp_issues
FROM library.library_documents;

-- Import date analysis
SELECT
  DATE(created_at) as import_date,
  COUNT(*) as total_docs,
  COUNT(*) FILTER (WHERE LENGTH(content) = 0) as empty_docs
FROM library.library_documents
GROUP BY DATE(created_at);
```

---

## Root Cause Analysis

**Import Script Issues**:
1. No encoding detection → replacement characters
2. No content length validation → empty documents
3. Poor metadata extraction → missing authors
4. No automatic tagging → untagged documents

**Recommended Import Script Improvements**:
```python
import chardet

def import_document(file_path):
    # 1. Detect encoding
    with open(file_path, 'rb') as f:
        raw = f.read()
        detected = chardet.detect(raw)
        encoding = detected['encoding']

    # 2. Read with proper encoding
    with open(file_path, 'r', encoding=encoding) as f:
        content = f.read()

    # 3. Validate content
    if len(content) < 100:
        raise ValueError(f"Content too short: {len(content)} bytes")

    # 4. Extract metadata
    author = extract_author(content)
    if not author:
        raise ValueError("Cannot extract author")

    # 5. Auto-tag
    tags = extract_keywords(content)

    return {
        'content': content,
        'author': author,
        'tags': tags
    }
```

---

## Time Spent

- Diagnostic queries: 30 minutes
- Analysis and documentation: 60 minutes
- Fix script development: 30 minutes
- **Total: 2 hours**

---

## Recommendations

1. **Execute fixes immediately** to improve library quality
2. **Review import script** to prevent future issues
3. **Add validation gates** before database insertion
4. **Implement quality monitoring** (weekly reports)
5. **Consider re-importing entire batch** with improved script

---

**Ready for user approval to proceed with fixes.**
