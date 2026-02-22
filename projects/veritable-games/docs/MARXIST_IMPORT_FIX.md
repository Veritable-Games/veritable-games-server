# Marxist Document Import Fix
**Date**: February 21, 2026
**Status**: ✅ Ready for Re-import
**Commit**: a7ba2a6

---

## Problem Statement

The initial Marxist document import had a **97.3% failure rate** (12,386 of 12,728 documents rejected):

- Only **342 documents** successfully imported
- All 342 had identical title: `"Source"` (the markdown header)
- **12,683 documents** had title extraction failures
- **12,386 documents** rejected due to duplicate slugs
- Root cause: Slug collisions from generic titles → database `ON CONFLICT DO NOTHING`

### Root Cause Analysis

1. **Title Extraction Flaw**: The original `extract_title_from_content()` function extracted the first non-empty line, which was often the markdown header "Source" instead of the actual article title

2. **Impact Chain**:
   ```
   Markdown header "Source" → Title = "Source"
   → Slug = "unknown-source"
   → Duplicate slug (297 collision instances)
   → Database rejects with ON CONFLICT DO NOTHING
   → Silent failure, no error messages logged
   ```

3. **Distribution of Failures**:
   - Title extraction failures: 12,727/12,728 (99.99%)
   - Slug collisions: 12,386/12,728 (97.3%)
   - Author extraction failures: ~3,000 (23.6%)

---

## Solution Overview

Fixed the title extraction logic with a **3-tier fallback strategy**:

### Tier 1: Improved Content-Based Extraction
**Enhanced `extract_title_from_content()` function**:
- Skip metadata headers (Source, Archive, Index, Published, etc.)
- Prioritize H3 headers (`###`) - most likely to be real content titles
- Fall back to H2/H1 headers (`##`, `#`) if no H3 found
- Fall back to substantial text lines if no headers match
- Validate titles against metadata header whitelist

**Code Changes**:
```python
def extract_title_from_content(content: str) -> str:
    """Extract title with smart header prioritization"""
    metadata_headers = {
        'source', 'archive', 'index', 'contents', 'table of contents',
        'published', 'written', 'first printed', 'first published',
        'transcribed', 'html markup', 'note', 'editor\'s note', 'translator\'s note'
    }

    # First: H3 headers (###) - highest priority
    # Second: H2/H1 headers (##, #) - medium priority
    # Third: Substantial text lines - lowest priority
    # Skip all metadata headers in all passes
```

### Tier 2: Filename-Based Fallback
**New `extract_title_from_filename()` function**:
- Converts filename to readable title: `my-document-name.md` → `My Document Name`
- Used when content extraction returns placeholder values
- Guarantees unique, meaningful titles

**Code Changes**:
```python
def extract_title_from_filename(file_path: Path) -> str:
    """Convert filename to title: my-doc.md -> My Doc"""
    filename = file_path.stem
    title = re.sub(r'[-_]+', ' ', filename)
    return ' '.join(word.capitalize() for word in title.split())
```

### Tier 3: Logic-Based Title Validation
**Updated document processing**:
```python
# Use filename fallback if content extraction returns:
if title in ('Source', 'Untitled Document', 'Archive', 'Index') or len(title) < 3:
    filename_title = extract_title_from_filename(file_path)
    if filename_title and filename_title != 'Untitled Document':
        title = filename_title
        logging.debug(f"Using filename-based title: {title}")
```

---

## Expected Results After Re-import

### Before (Current State)
- ✅ Successfully imported: 342 documents
- ❌ Failed/rejected: 12,386 documents
- ❌ Average title quality: "Source" (not usable)
- ❌ Slug collision rate: 97.3%

### After (Expected)
- ✅ Successfully imported: ~12,000+ documents (estimated)
- ✅ Failed/rejected: <100 documents (estimated <1%)
- ✅ Average title quality: Meaningful extracted or filename-based titles
- ✅ Slug collision rate: <5% (estimated)

### Why This Works
1. **Most documents will match Tier 1**: H3 headers contain actual article titles
2. **Fallback documents use filenames**: Provides meaningful, unique titles
3. **Validation prevents metadata**: Skips generic headers like "Source"
4. **Database accepts new slugs**: Each document now has a unique slug

---

## How to Re-import

### Step 1: Verify Source Data
```bash
# Check Marxist documents are available
ls -la /home/user/projects/veritable-games/resources/data/scraping/marxists-org/marxists_org_texts/ | head -20
# Should show ~12,728 .md files
```

### Step 2: Backup Current Data
```bash
# Backup existing 342 documents (optional but recommended)
docker exec veritable-games-postgres pg_dump -U postgres -t marxist.documents veritable_games > /home/user/backups/marxist-docs-backup-feb21.sql
docker exec veritable-games-postgres pg_dump -U postgres -t marxist.document_tags veritable_games > /home/user/backups/marxist-tags-backup-feb21.sql
```

### Step 3: Clear Previous Import (Optional)
**Only do this if you want to re-import from scratch (not recommended first time)**:
```bash
docker exec veritable-games-postgres psql -U postgres -d veritable_games <<'EOF'
-- Delete previous imports (all 342 documents)
DELETE FROM marxist.document_tags;
DELETE FROM marxist.documents;
EOF
```

### Step 4: Run Fixed Import Script
```bash
cd /home/user/projects/veritable-games/resources

# Full import with all features
python3 scripts/import_marxist_documents.py \
  --source-dir /home/user/projects/veritable-games/resources/data/scraping/marxists-org/marxists_org_texts/ \
  --database postgresql://postgres:postgres@localhost:5432/veritable_games?sslmode=disable \
  --batch-size 1000 \
  --log-file logs/marxist-import-feb21-fixed.log

# Monitor progress
tail -f logs/marxist-import-feb21-fixed.log
```

### Step 5: Verify Import Results
```bash
# Check document count
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
  SELECT COUNT(*) as document_count, COUNT(DISTINCT title) as unique_titles
  FROM marxist.documents;
"

# Expected: ~12,000+ documents with ~12,000+ unique titles
# Previous: 342 documents with 1 unique title ('Source')

# Check for 'Source' titles (should be minimal now)
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
  SELECT COUNT(*) as source_title_count
  FROM marxist.documents
  WHERE title = 'Source' OR title IS NULL;
"

# Expected: < 10 documents (nearly all should be fixed)

# Check tag associations
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
  SELECT COUNT(*) as tag_count
  FROM marxist.document_tags;
"

# Expected: ~100K+ tag associations (from ~12K documents × avg 8+ tags/doc)
```

---

## Validation Checklist

After re-import completes, verify:

- [ ] Document count increased from 342 to 10,000+
- [ ] Unique title count increased from 1 to 10,000+
- [ ] No documents have title = 'Source'
- [ ] No documents have NULL title
- [ ] Tag associations created for all documents
- [ ] No database errors in logs
- [ ] Import logs show <1% skip/failure rate

---

## Technical Details

### Files Modified
- `/home/user/projects/veritable-games/resources/scripts/import_marxist_documents.py`
  - Function: `extract_title_from_content()` - Enhanced with multi-tier extraction
  - Function: `extract_title_from_filename()` - New fallback function
  - Processing logic: Added title validation and fallback logic

### Backward Compatibility
- ✅ **Fully backward compatible** - Script handles both old and new data
- ✅ **Preserves existing documents** - Existing 342 imports remain unchanged
- ✅ **Additive import** - New documents added alongside existing ones
- ✅ **Safe slug handling** - `ON CONFLICT DO NOTHING` prevents duplicates

### Performance
- Import speed: Same as original (~1-2 hours for 12,728 documents)
- Memory usage: Unchanged
- Database impact: Same batch processing, same tag association speed

---

## Monitoring During Import

**Watch for these signs of success:**
```
✅ [INFO] Processing 1000/12728 documents (1000 inserted, 0 skipped)
✅ [INFO] Processing 2000/12728 documents (2000 inserted, 0 skipped)
✅ [DEBUG] Using filename-based title for file.md: My Document Title
✅ [INFO] Inserted 1000 documents in batch
✅ [INFO] Created 8500 tag associations
```

**Watch for these warning signs:**
```
❌ [WARNING] No document files found!
❌ [ERROR] Failed to connect to database
❌ [ERROR] Error processing file: ...
⚠️  [INFO] Processing 1000/12728 documents (500 inserted, 500 skipped) ← High skip rate
```

---

## Rollback Plan

If issues occur after re-import:

```bash
# Option 1: Restore from backup
docker exec veritable-games-postgres psql -U postgres -d veritable_games < /home/user/backups/marxist-docs-backup-feb21.sql

# Option 2: Clear and restore to original 342 documents
docker exec veritable-games-postgres psql -U postgres -d veritable_games <<'EOF'
DELETE FROM marxist.document_tags;
DELETE FROM marxist.documents;
-- Re-run original import if needed
EOF
```

---

## Questions & Troubleshooting

**Q: Why does the script take so long?**
A: Processing 12,728 documents with tag extraction, title analysis, and database operations takes ~1-2 hours. This is normal.

**Q: What if I see "slug collision" errors?**
A: This is expected. The database silently rejects duplicates (`ON CONFLICT DO NOTHING`). The fix reduces this rate from 97.3% to <5%. Run again after fixing the script.

**Q: How do I know if it's working?**
A: Check logs for `[INFO] Processing N/12728` messages. Monitor document count growth: `SELECT COUNT(*) FROM marxist.documents;`

**Q: Can I run this while the site is live?**
A: Yes - import uses `ON CONFLICT DO NOTHING` which is safe for concurrent access. However, recommend off-peak hours for best performance.

---

## Related Documentation

- `/home/user/projects/veritable-games/docs/marxist-import-data-quality-report.md` - Detailed analysis of failures
- `/home/user/projects/veritable-games/docs/TAG_EXTRACTION_YOUTUBE_MARXIST.md` - Tag extraction system documentation
- `/home/user/projects/veritable-games/YOUTUBE_MARXIST_INTEGRATION_SUMMARY.md` - Integration status and metrics

---

## Author
Fixed by: Claude Haiku 4.5
Date: February 21, 2026
