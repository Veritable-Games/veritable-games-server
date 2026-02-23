# Library Curation Guide

**Status**: Implementation ready
**Date**: November 10, 2025
**Scope**: Curation workflows for Anarchist Library (24,643 docs) and Marxists.org (500K+ docs)

---

## Executive Summary

Veritable Games integrates two massive document archives:
- **Anarchist Library**: 24,643 texts across 27 languages
- **Marxists.org**: 500,000+ documents being scraped

Both archives require **extensive curation work** to:
- Fix formatting issues (markdown, encoding, broken syntax)
- Normalize metadata (author names, publication dates, categories)
- Detect and merge duplicate documents
- Build consistent taxonomy (tags, categories, language codes)
- Improve OCR quality and text accuracy

**Estimated curation effort**: 700-1200 hours total

This guide provides workflows for managing this curation work efficiently.

---

## Part 1: Understanding Library Architecture

### Two-Layer System

**Layer 1: Filesystem (Docker Volumes)**
```
/app/anarchist-library/       (24,643 markdown files)
├── en/
│   ├── bakunin-god-state.md
│   ├── kropotkin-mutual-aid.md
│   └── ... (8,000+ documents)
├── es/ (2,500+ documents)
├── fr/ (3,000+ documents)
└── ... (27 languages total)

/app/marxists-library/         (500K+ markdown files)
├── authors/
│   ├── marx/
│   ├── engels/
│   └── ... (100+ authors)
├── categories/
└── chronological/
```

**Layer 2: Database (PostgreSQL)**
```
anarchist.documents table:
├── id (text, unique identifier)
├── slug (URL-safe version)
├── title, authors[], language
├── publication_date, year
├── file_path (points to markdown file)
├── category, document_type
├── tags (linked via document_tags junction table)
├── view_count, created_at, updated_at
└── linked_document_group_id (for deduplication)
```

### Document Frontmatter Format

Each markdown file in the volumes has YAML frontmatter:

```markdown
---
id: "bakunin-god-state-en-1882"
title: "God and the State"
authors:
  - "Mikhail Bakunin"
language: "en"
year: 1882
publication_date: "1882-01-01"  # ISO format preferred
category: "theory"
document_type: "essay"
source_url: "https://..."
notes: "Translated from original Russian"
---

# Document content starts here

Full text of the document...
```

---

## Part 2: Curation Workflows

### Workflow A: Web UI Curation (Recommended for Ongoing Work)

**Best for**: Regular fixes, small batches, user-facing changes

**Process**:
```
1. Browse library at /library/documents
2. Find document needing curation
3. Click "Edit" button
4. Web form opens with editable fields
5. Make changes (title, author, content, tags)
6. Preview changes
7. Save (updates BOTH database AND markdown file atomically)
8. Changes immediately visible
```

**Advantages**:
- ✅ Atomic transactions (DB + file updated together)
- ✅ Audit trail (tracks who edited what, when)
- ✅ Validation (prevents invalid YAML frontmatter)
- ✅ User-friendly (no technical skills needed)
- ✅ Safe (can't accidentally break markdown syntax)
- ✅ Reversible (change history available)

**Disadvantages**:
- ❌ Slower than direct file editing (not for 1000s of changes)
- ❌ Requires building admin UI (not yet implemented)

**Status**: 🟡 Ready for implementation (UI builder needed)

---

### Workflow B: Direct File Editing (Best for Bulk Operations)

**Best for**: Initial bulk cleanup, mass author normalization, encoding fixes

**Process**:
```
1. SSH to server: ssh user@192.168.1.15
2. Access volume: docker exec -it m4s0k bash
3. Edit files directly:
   cd /app/anarchist-library
   vi en/bakunin-god-state.md     # Edit YAML frontmatter + content
4. Save file
5. Exit container
6. Re-import metadata to PostgreSQL
7. Verify changes
```

**Example: Normalize Author Names**
```bash
#!/bin/bash
# Bulk rename author: "goldman, emma" → "Emma Goldman"

cd /app/anarchist-library
for file in en/*.md; do
  sed -i 's/goldman, emma/Emma Goldman/g' "$file"
done

# Then re-import metadata to update database
npm run library:reimport-metadata
```

**Advantages**:
- ✅ Fast (can process 1000s of files with scripts)
- ✅ Flexible (any text editor, regex search/replace)
- ✅ Powerful (batch operations with shell scripts)
- ✅ Direct (no intermediate API calls)

**Disadvantages**:
- ❌ Manual DB sync required (must re-import after edits)
- ❌ No audit trail (who made changes)
- ❌ Easy to break YAML syntax
- ❌ Requires SSH/command-line skills
- ❌ Risky without backups

**Status**: ✅ Ready to use immediately

---

### Workflow C: Hybrid (Recommended for Your Use Case)

**Best for**: Combining speed of bulk operations with safety of web UI

**Process**:
```
Phase 1: Bulk Cleanup (Filesystem)
├─ Identify problem categories (OCR errors, encoding issues, etc.)
├─ Create shell scripts to fix 100s at once
├─ Backup volume before running scripts
├─ Run scripts
└─ Re-import metadata to database

Phase 2: Incremental Improvements (Web UI)
├─ Browse improved documents
├─ Fix edge cases individually
├─ Make improvements that don't fit automation
└─ Changes saved atomically
```

**Example Timeline**:
```
Week 1-2: Direct file editing
├─ Normalize all author names (800+ variations)
├─ Standardize date formats (various formats → ISO)
├─ Fix common encoding issues (UTF-8 normalization)
└─ Build consistent taxonomy (anarchism, socialism, theory, history)

Week 3+: Web UI curation
├─ Browse results from bulk edits
├─ Fix edge cases
├─ Improve descriptions
├─ Add tags and metadata
└─ Ongoing improvements as users report issues
```

**Status**: ✅ Ready to use immediately

---

## Part 3: Common Curation Tasks

### Task 1: Normalize Author Names

**Problem**: Same author with multiple name variations
```
"Emma Goldman" vs "goldman, emma" vs "E. Goldman" vs "Emma Goldman (1869-1940)"
```

**Solution - Direct File Editing**:
```bash
#!/bin/bash
# Define mapping
declare -A authors=(
  ["goldman, emma"]="Emma Goldman"
  ["E. Goldman"]="Emma Goldman"
  ["Emma Goldman (1869-1940)"]="Emma Goldman"
  ["bakunin, mikhail"]="Mikhail Bakunin"
  ["M. Bakunin"]="Mikhail Bakunin"
)

# Apply mapping to all files
for author_old in "${!authors[@]}"; do
  author_new="${authors[$author_old]}"
  find /app/anarchist-library -name "*.md" -exec \
    sed -i "s/${author_old}/${author_new}/g" {} \;
done

# Re-import to update database
npm run library:reimport-metadata
```

**Solution - Web UI** (future):
```
1. Browse /library/authors
2. See "goldman, emma", "Emma Goldman", "E. Goldman" listed as separate
3. Click "Merge Authors"
4. Select canonical form: "Emma Goldman"
5. Save (updates all 150 documents automatically)
```

### Task 2: Standardize Publication Dates

**Problem**: Inconsistent date formats
```
1895, "circa 1895", "1895-01-01", "January 1895", 1895-01-01T00:00:00Z
```

**Solution - Direct File Editing**:
```bash
#!/bin/bash
# Standardize to ISO format: YYYY-MM-DD

# Convert "1895" → "1895-01-01"
find /app/anarchist-library -name "*.md" -exec \
  sed -i 's/^publication_date: "\([0-9]\{4\}\)"$/publication_date: "\1-01-01"/g' {} \;

# Convert "circa 1895" → "1895-01-01" + add note
find /app/anarchist-library -name "*.md" -print0 | while read -r -d '' file; do
  if grep -q "circa " "$file"; then
    year=$(grep "circa " "$file" | sed 's/.*circa \([0-9]*\).*/\1/')
    sed -i "s/publication_date:.*$/publication_date: \"$year-01-01\"/g" "$file"
    sed -i "s/^notes:.*$/notes: \"Approximate date: circa $year\"/g" "$file"
  fi
done

npm run library:reimport-metadata
```

### Task 3: Fix Markdown Formatting

**Problem**: Broken markdown syntax
```markdown
# This is a heading
# This is another heading without proper spacing
##Missing space after hash
Text without paragraph breaks runs together
- List item
- Another item
without consistent indentation
```

**Solution - Direct File Editing**:
```bash
#!/bin/bash
# Fix common markdown issues

for file in /app/anarchist-library/**/*.md; do
  # Add space after # if missing: ##text → ## text
  sed -i 's/^##\([^ ]/## \1/g' "$file"
  sed -i 's/^###\([^ ]/### \1/g' "$file"

  # Remove multiple blank lines: replace 3+ with 2
  sed -i '/^$/N;/^\n$/!P;D' "$file"

  # Ensure list items properly indented
  sed -i 's/^-/-  /g' "$file"
done

npm run library:reimport-metadata
```

### Task 4: Build Consistent Taxonomy

**Problem**: Tags and categories vary wildly
```
"anarchism" vs "Anarchist Theory" vs "theory" vs "ANARCHISM"
"history" vs "historical" vs "chronological account"
"philosophy" vs "philosophy and ethics"
```

**Solution - Direct File Editing**:
```bash
#!/bin/bash
# Define taxonomy

# Category mapping
declare -A categories=(
  ["theory"]="theory"
  ["anarchist theory"]="theory"
  ["anarchism"]="theory"
  ["ANARCHISM"]="theory"
  ["history"]="history"
  ["historical"]="history"
  ["biography"]="biography"
  ["autobiography"]="biography"
)

# Language mapping (ensure ISO 639-1 codes)
declare -A languages=(
  ["English"]="en"
  ["english"]="en"
  ["eng"]="en"
  ["Spanish"]="es"
  ["french"]="fr"
  ["German"]="de"
  ["Italian"]="it"
  ["Portuguese"]="pt"
  ["Russian"]="ru"
)

# Apply mappings
for file in /app/anarchist-library/**/*.md; do
  # Fix categories
  for old_cat in "${!categories[@]}"; do
    new_cat="${categories[$old_cat]}"
    sed -i "s/category: \"${old_cat}\"/category: \"${new_cat}\"/gi" "$file"
  done

  # Fix languages to ISO codes
  for old_lang in "${!languages[@]}"; do
    new_lang="${languages[$old_lang]}"
    sed -i "s/language: \"${old_lang}\"/language: \"${new_lang}\"/gi" "$file"
  done
done

npm run library:reimport-metadata
```

### Task 5: Fix Encoding Issues

**Problem**: UTF-8 encoding problems from OCR
```
• → •  (wrong Unicode character)
— → - (em dash becomes hyphen)
" " → " " (smart quotes converted to regular quotes)
é → Ã© (double-encoded UTF-8)
```

**Solution - Direct File Editing**:
```bash
#!/bin/bash
# Fix common encoding issues

for file in /app/anarchist-library/**/*.md; do
  # Normalize UTF-8 (remove combining diacritics duplication)
  iconv -f UTF-8 -t UTF-8 -c "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"

  # Fix common replacements
  sed -i 's/Ã©/é/g; s/Ã /à/g; s/Ã¼/ü/g' "$file"

  # Smart quotes → regular quotes (if problematic)
  sed -i 's/"/"/g; s/"/"/g' "$file"

  # Em dashes (— or –) to standard hyphen if needed
  # (Be careful: some docs intentionally use em dashes)
done

npm run library:reimport-metadata
```

---

## Part 4: Duplicate Detection & Merging

### Detection Strategy

**Method 1: Exact Match** (SQL)
```sql
-- Find documents with identical title + author + language
SELECT
  a.id as anarchist_id,
  m.id as marxist_id,
  a.title,
  a.author
FROM anarchist.documents a
JOIN marxist.documents m ON (
  LOWER(a.title) = LOWER(m.title) AND
  LOWER(a.authors[1]) = LOWER(m.authors[1]) AND
  a.language = m.language
)
ORDER BY a.author, a.title;
```

**Method 2: Fuzzy Match** (Levenshtein distance)
```typescript
// Match titles with 85% similarity
import { distance } from 'fastest-levenshtein';

async function findSimilarDocuments(doc: Document) {
  const candidates = await db.query(
    `SELECT * FROM documents WHERE author = $1`,
    [doc.author]
  );

  return candidates.filter(candidate => {
    const titleDistance = distance(doc.title, candidate.title);
    const maxLen = Math.max(doc.title.length, candidate.title.length);
    const similarity = 1 - (titleDistance / maxLen);
    return similarity > 0.85;
  });
}
```

**Method 3: Content Hash** (First 1KB)
```typescript
import crypto from 'crypto';

function generateContentHash(content: string): string {
  // Normalize: lowercase, no whitespace
  const normalized = content
    .substring(0, 1000)
    .replace(/\s+/g, ' ')
    .toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Find matching hashes
SELECT a.id, m.id
FROM anarchist.documents a
JOIN marxist.documents m ON a.content_hash = m.content_hash
WHERE a.id != m.id;
```

### Merging Options

**Option A: Linked Groups** (Recommended)
```sql
-- Create linked group
INSERT INTO library.linked_document_groups (canonical_document_id, group_type)
VALUES (1, 'duplicate');

-- Link both versions
UPDATE anarchist.documents SET linked_document_group_id = 1 WHERE id = 'bakunin-god-state-1';
UPDATE marxist.documents SET linked_document_group_id = 1 WHERE id = 'bakunin-god-state-2';

-- User sees: "Also available in Marxists.org"
-- Can choose preferred version
-- View counts aggregate
```

**Option B: Merge & Delete** (Simpler)
```sql
-- Keep version with highest quality (view_count, completeness)
-- Delete inferior version
-- Update file_path to point to canonical file

UPDATE anarchist.documents
SET file_path = 'en/bakunin-god-state-canonical.md'
WHERE id = 'bakunin-god-state-duplicate';

DELETE FROM marxist.documents WHERE id = 'bakunin-god-state-2';
```

### Deduplication Workflow

```
Step 1: Run detection (1-2 hours)
  ├─ Generate SQL result set: ~10,000-15,000 potential duplicates
  ├─ Review results (filter out false positives)
  └─ Export confirmed duplicates to CSV

Step 2: Manual review (2-4 weeks)
  ├─ For each group of duplicates:
  │  ├─ Read both versions
  │  ├─ Determine canonical version (best quality)
  │  ├─ Note differences (translations, editions, OCR quality)
  │  └─ Record decision in spreadsheet
  └─ Build deduplication rules

Step 3: Apply deduplication (1-2 weeks)
  ├─ Create linked groups in database
  ├─ Update document_group_id for all duplicates
  ├─ Generate "Also available in..." suggestions
  └─ Test in UI

Step 4: Verify results (1 week)
  ├─ Search for documents
  ├─ Verify "Also available in..." shows correctly
  ├─ Check view count aggregation
  └─ Gather user feedback
```

---

## Part 5: Best Practices

### ✅ DO

1. **Backup volumes before bulk operations**
   ```bash
   docker volume create anarchist-library-backup-YYYY-MM-DD
   docker run --rm -v anarchist-library:/src -v anarchist-library-backup:/dst alpine cp -r /src/* /dst/
   ```

2. **Test scripts on small subset first**
   ```bash
   # Test on 10 files before running on all 24,643
   find /app/anarchist-library/en -name "*.md" -type f | head -10 | while read f; do
     sed -i 's/old/new/g' "$f"
   done
   ```

3. **Use version control for scripts**
   ```bash
   git add frontend/scripts/curation/*.sh
   git commit -m "curation: Add author normalization script"
   git push
   ```

4. **Re-import metadata after bulk edits**
   ```bash
   npm run library:reimport-metadata
   ```

5. **Document curation decisions**
   ```
   - Author "goldman, emma" normalized to "Emma Goldman" (24 documents)
   - Created linked groups for 347 duplicate pairs
   - Fixed UTF-8 encoding in 1,200+ files
   ```

### ❌ DON'T

1. **Don't edit files without backups**
   ```bash
   # BAD
   sed -i 's/old/new/g' /app/anarchist-library/**/*.md

   # GOOD
   cp -r /app/anarchist-library /app/anarchist-library-backup
   sed -i 's/old/new/g' /app/anarchist-library/**/*.md
   ```

2. **Don't run bulk operations during peak hours**
   - Volume operations lock files
   - Users can't access documents
   - Schedule for off-peak times

3. **Don't commit sensitive data**
   ```bash
   # If curation reveals personal info:
   # - Redact from markdown files
   # - Update database
   # - Document reasoning
   # - Commit: "curation: Remove personal information (ref: #123)"
   ```

4. **Don't ignore failing imports**
   ```bash
   npm run library:reimport-metadata
   # If errors occur:
   #  1. Review error logs
   #  2. Fix problems
   #  3. Run again
   #  4. Verify all documents indexed
   ```

5. **Don't delete files without confirmation**
   ```bash
   # Always prompt before deletion
   # Keep deleted file list for audit trail
   # Consider soft-delete (mark as deleted, don't remove)
   ```

---

## Part 6: Troubleshooting

### Issue: Markdown Syntax Broken After Bulk Edit

**Symptom**: Files won't display in UI, malformed frontmatter errors

**Cause**: Regex replace broke YAML syntax

**Solution**:
```bash
# Restore from backup
rm -rf /app/anarchist-library
cp -r /app/anarchist-library-backup /app/anarchist-library

# Review script that failed
# Fix regex (escape special characters)
# Test on subset first
# Re-run with corrected script
```

### Issue: Database Out of Sync with Files

**Symptom**: UI shows old content, searches return wrong results

**Cause**: Edited files but forgot to re-import

**Solution**:
```bash
# Re-import all metadata
npm run library:reimport-metadata

# If that fails, verify file integrity
npm run library:validate-files

# Check for errors
npm run library:check-syntax
```

### Issue: Encoding Problems After Bulk Edit

**Symptom**: Files show garbled text, special characters broken

**Cause**: Conversion lost encoding, or applied wrong character set

**Solution**:
```bash
# Verify files are UTF-8
file /app/anarchist-library/en/*.md | grep -v UTF-8

# Convert to UTF-8 if needed
find /app/anarchist-library -name "*.md" -exec \
  iconv -f ISO-8859-1 -t UTF-8 -o {}.new {} \; \
  -exec mv {}.new {} \;

# Re-import metadata
npm run library:reimport-metadata
```

### Issue: Performance Degradation After Adding Documents

**Symptom**: Searches slow down, UI lags

**Cause**: Full-text search index outdated

**Solution**:
```bash
# Rebuild search indexes
npm run library:reindex-search

# Check index status
npm run library:check-index

# If still slow, consider pagination
# Limit search results to first 100 matches
```

---

## Part 7: Tools & Scripts

### Available Scripts

```bash
# Metadata management
npm run library:reimport-metadata              # Re-import all metadata
npm run library:validate-files                 # Check file integrity
npm run library:check-syntax                   # Verify YAML syntax

# Search & discovery
npm run library:reindex-search                 # Rebuild FTS indexes
npm run library:detect-duplicates              # Find duplicate pairs

# Utilities
npm run library:export-metadata <source>       # Export to CSV
npm run library:generate-report                # Curation progress report
```

### Custom Scripts

Create custom curation scripts in `frontend/scripts/curation/`:

```bash
# Example: normalize-author-names.sh
#!/bin/bash
declare -A authors=(
  ["goldman, emma"]="Emma Goldman"
  ["bakunin, mikhail"]="Mikhail Bakunin"
)

for author_old in "${!authors[@]}"; do
  author_new="${authors[$author_old]}"
  find /app/anarchist-library -name "*.md" -exec \
    sed -i "s/${author_old}/${author_new}/g" {} \;
done

npm run library:reimport-metadata
```

---

## Part 8: Long-Term Plan

### Timeline

**Weeks 1-4: Initial Cleanup**
- Normalize author names (800+ variations)
- Standardize publication dates
- Fix encoding issues
- Build taxonomy (categories, tags)

**Weeks 5-8: Deduplication**
- Detect duplicate pairs
- Manual review (which version is better)
- Create linked groups
- Verify results

**Weeks 9-12: Marxists Library**
- Apply same processes to marxists.org documents
- Detect duplicates across both libraries
- Merge and link related documents
- Build comprehensive unified search

**Ongoing: Incremental Improvements**
- Fix edge cases
- Improve descriptions
- Add missing metadata
- Handle user-reported issues

---

## Conclusion

The library curation workflows provide:
- ✅ Fast bulk operations (direct file editing)
- ✅ Safe incremental changes (web UI)
- ✅ Duplicate detection and merging
- ✅ Consistent taxonomy and metadata
- ✅ Quality assurance and validation

Combined, they enable managing **700K+ documents** efficiently while maintaining data integrity.

---

**Related Documentation**:
- [DATABASE_VOLUME_ARCHITECTURE_OPTIONS.md](../deployment/DATABASE_VOLUME_ARCHITECTURE_OPTIONS.md) - Volume architecture
- [OPTION_D_IMPLEMENTATION_SPECIFICATIONS.md](../deployment/OPTION_D_IMPLEMENTATION_SPECIFICATIONS.md) - Volume configuration
- [LIBRARY_IMPLEMENTATION_REPORT.md](/LIBRARY_IMPLEMENTATION_REPORT.md) - Current implementation status

