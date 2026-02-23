# Outstanding Issues and Future Work

**Session Date**: November 24, 2025
**Status**: ⚠️ Needs Attention

---

## Critical Issue: User Library Document Quality

### Problem Statement

**User reported**: "the user library documents are still having major quality issues"

### Current Status

**✅ INVESTIGATION COMPLETE** (November 24, 2025)

**Findings Summary**:
- 99 documents (2.2%) with empty content - CRITICAL
- 159 documents (3.6%) with encoding issues (replacement characters)
- 1,867 documents (41.9%) missing authors - metadata extraction failure
- 210 documents (4.7%) with suspiciously short content
- 215 documents (4.8%) without tags
- All issues from single import batch on November 24, 2025

**📖 Full Investigation Report**: [06-library-quality-investigation.md](./06-library-quality-investigation.md)

**Fix Scripts Ready**:
- ✅ Phase 1: Delete empty content documents (99 docs)
- ✅ Phase 3: Extract authors from content (1,867 docs)
- ✅ Phase 4: Flag untagged documents for review (215 docs)
- ⏳ Phase 2: Encoding repair (requires re-import with proper encoding detection)

### Potential Issues to Investigate

#### 1. Content Quality Problems

**Possible Issues**:
- Malformed or corrupted text content
- HTML entities not properly decoded
- Encoding issues (UTF-8, special characters)
- Line break problems
- Whitespace issues

**Examples to Look For**:
```
Bad: &quot;Hello&quot; &mdash; it&#39;s broken
Good: "Hello" — it's working

Bad: Lorem ipsumÂ dolor sitÂ amet
Good: Lorem ipsum dolor sit amet

Bad: Text withno spaces between
Good: Text with proper spaces
```

#### 2. Metadata Quality Problems

**Possible Issues**:
- Missing or incorrect titles
- Author fields empty or malformed
- Incorrect publication dates
- Wrong document types
- Missing descriptions

**Examples**:
```sql
-- Check for empty titles
SELECT COUNT(*) FROM library.library_documents WHERE title IS NULL OR title = '';

-- Check for missing authors
SELECT COUNT(*) FROM library.library_documents WHERE author IS NULL OR author = '';

-- Check for invalid dates
SELECT COUNT(*) FROM library.library_documents WHERE publication_date > CURRENT_DATE;
```

#### 3. Tag Association Problems

**Possible Issues**:
- Documents missing tags entirely
- Incorrect tag assignments
- Duplicate tag associations
- Orphaned document_tag relationships

**Verification Queries**:
```sql
-- Documents with no tags
SELECT COUNT(*)
FROM library.library_documents d
WHERE NOT EXISTS (
  SELECT 1 FROM library.library_document_tags dt WHERE dt.document_id = d.id
);

-- Documents with duplicate tag associations
SELECT document_id, tag_id, COUNT(*)
FROM library.library_document_tags
GROUP BY document_id, tag_id
HAVING COUNT(*) > 1;
```

#### 4. Content Formatting Issues

**Possible Issues**:
- Markdown not rendering correctly
- HTML mixed with markdown
- Code blocks malformed
- Lists not formatted
- Headers broken

**Examples**:
```markdown
Bad:
#Header with no space
- List item with wrong indent
  - Nested item broken

Good:
# Header with proper space
- List item
  - Nested item
```

#### 5. Duplicate Documents

**Possible Issues**:
- Same document imported multiple times
- Different versions of same document
- Slug collisions

**Detection**:
```sql
-- Find duplicate titles
SELECT title, COUNT(*)
FROM library.library_documents
GROUP BY title
HAVING COUNT(*) > 1;

-- Find duplicate slugs (should be unique)
SELECT slug, COUNT(*)
FROM library.library_documents
GROUP BY slug
HAVING COUNT(*) > 1;
```

---

## Investigation Needed

### Step 1: Document Sample Analysis

**Action Items**:
1. Export sample of 20-50 user library documents
2. Manually review for quality issues
3. Categorize problems found
4. Document patterns

**SQL Query**:
```sql
SELECT id, title, author, slug, content, description, created_at
FROM library.library_documents
WHERE source = 'library'  -- User library only
ORDER BY created_at DESC
LIMIT 50;
```

### Step 2: Automated Quality Checks

**Checks to Run**:

1. **Content Checks**:
   ```sql
   -- Empty content
   SELECT COUNT(*) FROM library.library_documents WHERE content IS NULL OR content = '';

   -- Suspiciously short content
   SELECT COUNT(*) FROM library.library_documents WHERE LENGTH(content) < 100;

   -- HTML entities present
   SELECT COUNT(*) FROM library.library_documents WHERE content LIKE '%&%;%';
   ```

2. **Metadata Checks**:
   ```sql
   -- Missing titles
   SELECT COUNT(*) FROM library.library_documents WHERE title IS NULL OR title = '';

   -- Missing authors
   SELECT COUNT(*) FROM library.library_documents WHERE author IS NULL;

   -- Invalid dates
   SELECT COUNT(*) FROM library.library_documents WHERE publication_date > CURRENT_DATE;
   ```

3. **Relationship Checks**:
   ```sql
   -- Orphaned tags
   SELECT COUNT(*) FROM library.library_document_tags dt
   WHERE NOT EXISTS (SELECT 1 FROM library.library_documents d WHERE d.id = dt.document_id);

   -- Orphaned tag references
   SELECT COUNT(*) FROM library.library_document_tags dt
   WHERE NOT EXISTS (SELECT 1 FROM shared.tags t WHERE t.id = dt.tag_id);
   ```

### Step 3: Pattern Recognition

**Questions to Answer**:
1. Are issues concentrated in specific time periods?
2. Are issues correlated with specific users?
3. Are issues related to import method?
4. Are issues related to document type?

**Analysis Queries**:
```sql
-- Issues by creation date
SELECT DATE(created_at), COUNT(*)
FROM library.library_documents
WHERE [quality issue condition]
GROUP BY DATE(created_at)
ORDER BY DATE(created_at);

-- Issues by user
SELECT user_id, COUNT(*)
FROM library.library_documents
WHERE [quality issue condition]
GROUP BY user_id;
```

---

## Potential Solutions

### Solution 1: Bulk Content Cleanup Script

**If**: HTML entities or encoding issues found

**Script Structure**:
```python
import psycopg2
import html

def clean_content(content):
    # Decode HTML entities
    content = html.unescape(content)

    # Fix common encoding issues
    content = content.replace('\u00A0', ' ')  # Non-breaking space
    content = content.replace('\u2019', "'")  # Smart apostrophe
    content = content.replace('\u201C', '"')  # Smart quote open
    content = content.replace('\u201D', '"')  # Smart quote close

    # Normalize whitespace
    content = ' '.join(content.split())

    return content

# Batch update documents
conn = psycopg2.connect(...)
cur = conn.cursor()
cur.execute("SELECT id, content FROM library.library_documents WHERE source = 'library'")
for doc_id, content in cur.fetchall():
    cleaned = clean_content(content)
    cur.execute("UPDATE library.library_documents SET content = %s WHERE id = %s",
                (cleaned, doc_id))
conn.commit()
```

### Solution 2: Metadata Enrichment

**If**: Missing or poor metadata

**Approach**:
1. Extract title from content if missing
2. Parse author from first paragraph
3. Infer document type from content structure
4. Generate description from first N characters

**Example**:
```python
def enrich_metadata(doc):
    if not doc['title']:
        # Extract from first heading
        doc['title'] = extract_first_heading(doc['content'])

    if not doc['description']:
        # First paragraph or 200 chars
        doc['description'] = doc['content'][:200] + '...'

    if not doc['document_type']:
        # Infer from content structure
        doc['document_type'] = infer_type(doc['content'])

    return doc
```

### Solution 3: Tag Auto-Assignment

**If**: Documents missing tags

**Approach**:
1. Extract keywords from content
2. Match against existing tags
3. Auto-assign high-confidence matches
4. Flag low-confidence for manual review

**Example**:
```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

def auto_tag(content, existing_tags):
    # Extract keywords
    keywords = extract_keywords(content, top_n=20)

    # Match against tag names
    matches = []
    for tag in existing_tags:
        if tag.name.lower() in content.lower():
            matches.append(tag)

    return matches
```

### Solution 4: Duplicate Removal

**If**: Duplicate documents found

**Strategy**:
1. Identify duplicates by title similarity
2. Compare content to confirm
3. Keep newest or most complete version
4. Merge tags from duplicates
5. Delete redundant copies

**SQL**:
```sql
-- Find likely duplicates
SELECT d1.id as keep_id, d2.id as delete_id
FROM library.library_documents d1
JOIN library.library_documents d2
  ON LOWER(d1.title) = LOWER(d2.title)
  AND d1.id < d2.id
  AND d1.source = 'library'
  AND d2.source = 'library';
```

---

## Next Steps

### Immediate Actions Required

1. **Diagnose Specific Issues**:
   - Run automated quality checks
   - Sample manual review
   - Document findings

2. **Prioritize Problems**:
   - Rank by severity
   - Rank by prevalence
   - Rank by user impact

3. **Create Fix Plan**:
   - Script-based bulk fixes
   - Manual review process
   - Validation procedures

4. **Execute Fixes**:
   - Backup database first
   - Test on small sample
   - Run bulk cleanup
   - Verify results

5. **Prevent Future Issues**:
   - Add validation on import
   - Improve upload UX
   - Add quality warnings

---

## Other Outstanding Items

### 1. Tag System Enhancements

**Completed This Session**:
- ✅ Cleanup of redundant tags
- ✅ Admin deletion feature
- ✅ UI improvements

**Still Needed**:
- Tag merge functionality (vs. delete)
- Tag rename capability
- Bulk tag operations
- Tag usage analytics

### 2. Document Import Quality

**Current State**: Unknown quality of import process

**Needed**:
- Import validation rules
- Content sanitization
- Metadata extraction improvements
- Error reporting during import

### 3. Search and Discovery

**Current State**: Basic tag filtering works

**Enhancements Needed**:
- Full-text search within documents
- Advanced filter combinations
- Saved search queries
- Search result highlighting

### 4. Performance Optimization

**Current State**: Virtualized scrolling implemented

**Future Improvements**:
- Server-side filtering
- Pagination instead of infinite scroll (option)
- Search result caching
- Tag query optimization

---

## Documentation Gaps

### Areas Needing Documentation

1. **Import Process**:
   - How users upload documents
   - What validation occurs
   - How tags are assigned
   - Error handling

2. **Data Flow**:
   - Document creation pipeline
   - Tag extraction process
   - Content processing
   - Storage strategy

3. **Quality Standards**:
   - What constitutes a "good" document
   - Required metadata fields
   - Content formatting guidelines
   - Tag assignment rules

4. **Maintenance Procedures**:
   - How to identify quality issues
   - How to fix common problems
   - When to delete vs. fix
   - Backup and restore

---

## Resource Requirements

### For Investigation

**Time**: 2-4 hours
- Database analysis
- Sample review
- Pattern documentation

**Tools Needed**:
- PostgreSQL access
- Sample export capability
- Text analysis tools

### For Fixes

**Time**: 4-8 hours (depends on scope)
- Script development
- Testing
- Execution
- Validation

**Tools Needed**:
- Python environment
- Database backup
- Rollback capability
- Test dataset

---

## Risk Assessment

### Investigation Risks

**Low Risk**:
- Read-only queries
- Sample exports
- Documentation

### Fix Risks

**Medium Risk**:
- Bulk content updates
- Metadata changes
- Tag reassignments

**High Risk**:
- Document deletion
- Duplicate merging
- Schema changes

**Mitigation**:
- Full database backup before fixes
- Test on small sample first
- Verify results before proceeding
- Rollback plan ready

---

## Success Criteria

### How to Know Issues Are Resolved

1. **Content Quality**:
   - No HTML entities in display
   - Proper encoding throughout
   - Clean formatting

2. **Metadata Completeness**:
   - ≥95% have titles
   - ≥90% have authors
   - ≥80% have descriptions

3. **Tag Coverage**:
   - ≥90% have at least 1 tag
   - ≥70% have 3+ tags
   - No orphaned associations

4. **User Feedback**:
   - Quality complaints reduced
   - Positive feedback on improvements
   - Usability metrics improved

---

## Tracking and Monitoring

### Quality Metrics to Monitor

**Daily**:
```sql
-- Documents with issues
SELECT COUNT(*) FROM library.library_documents
WHERE content LIKE '%&%;%' OR title IS NULL;
```

**Weekly**:
```sql
-- Tag coverage
SELECT
  COUNT(*) as total_docs,
  COUNT(*) FILTER (WHERE tag_count = 0) as untagged,
  AVG(tag_count) as avg_tags
FROM (
  SELECT d.id, COUNT(dt.tag_id) as tag_count
  FROM library.library_documents d
  LEFT JOIN library.library_document_tags dt ON d.id = dt.document_id
  WHERE d.source = 'library'
  GROUP BY d.id
) AS doc_tags;
```

**Monthly**:
```sql
-- Overall quality score
SELECT
  AVG(quality_score) as avg_quality
FROM (
  SELECT
    CASE
      WHEN title IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN author IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN description IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN tag_count > 0 THEN 1 ELSE 0 END +
      CASE WHEN LENGTH(content) > 100 THEN 1 ELSE 0 END
    AS quality_score
  FROM library.library_documents d
  LEFT JOIN (
    SELECT document_id, COUNT(*) as tag_count
    FROM library.library_document_tags
    GROUP BY document_id
  ) dt ON d.id = dt.document_id
  WHERE d.source = 'library'
) quality;
```

---

## Contact and Follow-Up

**Next Session Priority**:
1. Investigate specific quality issues
2. Document findings
3. Create targeted fix plan
4. Execute initial fixes

**Owner**: TBD
**Timeline**: ASAP
**Dependencies**: Database access, sample export

---

## Appendix: Common Quality Issues in Document Systems

### Typical Problems

1. **Encoding Issues**:
   - Windows-1252 vs UTF-8
   - Smart quotes breaking
   - Emoji corruption

2. **HTML Remnants**:
   - Unclosed tags
   - Entity references
   - Inline styles

3. **Copy-Paste Artifacts**:
   - Extra whitespace
   - Line break issues
   - Font metadata

4. **Import Errors**:
   - Truncated content
   - Merged documents
   - Lost formatting

5. **User Input Errors**:
   - Wrong document type
   - Missing fields
   - Incorrect tags
