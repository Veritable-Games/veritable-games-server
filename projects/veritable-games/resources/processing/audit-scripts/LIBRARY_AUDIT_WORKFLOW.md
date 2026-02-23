# Library Audit Workflow - Live Session

**Started**: February 23, 2026 @ 01:27 UTC
**Status**: ✅ ACTIVE

---

## 📊 Current Progress

```
Total Documents: 2,561
├─ Fixed: 1 ✅
├─ In Review: 19 (being reviewed)
├─ Pending: 2,541 (waiting to review)
├─ Reviewed: 0 (no changes needed)
└─ Skipped: 0 (couldn't fix)

Priority Breakdown:
├─ CRITICAL (0-39):    1,198 documents
├─ POOR (40-59):         54 documents
├─ GOOD (60-79):      1,306 documents
└─ EXCELLENT (80-100):    3 documents

Average Quality: 44.6/100
```

---

## 🎯 Quick Workflow

### Step 1: Get Next Batch (10 documents)

```bash
cd /home/user/projects/veritable-games/resources/processing/audit-scripts
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/veritable_games"

python3 metadata_audit.py next --count 10
```

This will show 10 documents with the lowest quality scores that need review.

### Step 2: Review Each Document

For each document listed, you'll see:
- **ID**: Audit record ID (needed to mark as fixed)
- **Slug**: Document slug in database
- **Quality Score**: 0-100 (lower = more issues)
- **Issues**: List of detected problems

Example output:
```
ID: 1005 (library.news-from-libertarian-spain-13833)
  Quality Score: 12
  Issues: 4
    - [critical] missing_author: Author field is empty
    - [critical] missing_publication_date: Publication date is empty
    - [medium] author_in_title: Title may contain author name
    - [high] insufficient_content: Content too short (45 words, minimum 100)
```

### Step 3: Look Up Document Details

```bash
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
SELECT id, slug, title, author, publication_date, content
FROM library.library_documents
WHERE slug = 'DOCUMENT-SLUG-HERE';"
```

### Step 4: Research Missing Metadata

**For each missing field:**

- **Author**: Search document online, check source, look at tags
- **Publication Date**: Look for date in content, check source website, search title
- **Title Issues**: Fix author-in-title, remove truncation markers
- **Content Issues**: Add missing paragraphs, fix formatting

### Step 5: Update Database

```bash
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
UPDATE library.library_documents
SET author = 'AUTHOR NAME',
    publication_date = 'YYYY-MM-DD'
WHERE id = DOCUMENT_ID;"
```

### Step 6: Mark as Fixed in Audit

```bash
python3 metadata_audit.py mark-fixed AUDIT_ID --notes 'NOTES ABOUT WHAT WAS FIXED'
```

Or if you can't fix it:
```bash
python3 metadata_audit.py mark-skipped AUDIT_ID --reason 'Why you skipped it'
```

---

## 📝 Document Examples

### Example 1: Missing Author & Date (Just Fixed!)

**Document**: "News From Libertarian Spain"
**Status**: ✅ FIXED

**Before**:
- Author: (empty)
- Publication Date: (empty)
- Content: "Date: Unknown"

**Solution**:
- Found tags: "Spain 1970s"
- Source: Libertarian News Service
- Added: Author = "Libertarian News Service", Date = "1970-01-01"

**Command**:
```bash
UPDATE library.library_documents
SET author = 'Libertarian News Service',
    publication_date = '1970-01-01'
WHERE id = 13833;
```

---

## 🔄 Batch Processing Pattern

This is the recommended workflow for efficient batch processing:

```
┌─ Get next 10 documents
│
├─ For each document:
│  ├─ Look up in database
│  ├─ Research missing metadata
│  ├─ Update database (if fixable)
│  └─ Mark as fixed/skipped
│
├─ After 10 documents:
│  └─ Check progress with `status`
│
├─ After 50 documents (1 batch):
│  └─ Finalize round checkpoint
│
└─ Repeat until complete
```

---

## 📋 Common Issues & How to Fix

### Issue 1: Missing Author

**Detection**: "Author field is empty"

**Solutions**:
1. Check if author is in the title
2. Search document online
3. Check document source (libcom.org, marxists.org, etc.)
4. Look at tags/categories for author hints
5. If truly unknown, use collective/publication name

**Example**:
```sql
UPDATE library.library_documents
SET author = 'Collective Author Name'
WHERE id = 123;
```

### Issue 2: Missing Publication Date

**Detection**: "Publication date is empty"

**Solutions**:
1. Look for date in document content
2. Search document title + author online
3. Check source website publication history
4. Use approximate date if exact date unknown (e.g., "2020-01-01" for 2020)
5. If unknown, use year only: "1970-01-01" for 1970s

**Example**:
```sql
UPDATE library.library_documents
SET publication_date = '2015-06-20'
WHERE id = 123;
```

### Issue 3: Author in Title

**Detection**: "Title may contain author name"

**Solution**: Remove author from title if applicable

**Example**:
```sql
-- Before: "Smith, John: My Great Essay"
-- After: "My Great Essay"
UPDATE library.library_documents
SET title = 'My Great Essay'
WHERE id = 123;
```

### Issue 4: Insufficient Content

**Detection**: "Content too short (XX words, minimum 100)"

**Solutions**:
1. Check if document is actually short (partial archive)
2. Check source for full document
3. Mark as SKIPPED if it's supposed to be short (excerpt, news item)

**Example**:
```bash
# If document should be skipped
python3 metadata_audit.py mark-skipped AUDIT_ID --reason "Legitimate short excerpt from libcom.org"
```

---

## 💡 Tips for Efficiency

### Tip 1: Use Browser Searches
- Open a new browser tab
- Search "title + author" on Google, libcom.org, marxists.org
- Quickly identify author and date

### Tip 2: Check Document Source
- Many Library documents are from libcom.org
- Check the source link for metadata
- Look at libcom.org's original page for author/date

### Tip 3: Use Tags as Clues
- Tags often contain author names, topics, time periods
- "Spain 1970s" suggests 1970s publication
- "Marx, Karl" suggests about Karl Marx

### Tip 4: Batch Similar Documents
- Process documents by category/source
- This helps you develop patterns
- Speeds up research

### Tip 5: Save Progress Regularly
After every ~50 documents, create a checkpoint:

```bash
python3 metadata_audit.py finalize-round --name "Library_Batch_1_2026-02-23" \
  --notes "Fixed 50 documents, focused on missing authors"
```

---

## 🚀 Getting the Next Batch

```bash
# Get 10 more CRITICAL documents (lowest quality first)
cd /home/user/projects/veritable-games/resources/processing/audit-scripts
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/veritable_games"

python3 metadata_audit.py next --count 10 --max-score 39
```

---

## 📊 Tracking Progress

**Check status anytime:**
```bash
python3 metadata_audit.py status
```

**Expected timeline:**
- 10-15 documents per hour (with research)
- 1,198 CRITICAL documents = 80-120 hours of work
- 1-2 weeks working 8 hours/day

---

## ✅ Success Criteria for Library Phase

**Target**:
- Author completion: 95%+ (currently 53%)
- Publication date completion: 80%+ (currently 0.1%)
- Quality improvement: Average 44.6 → 85+

**Estimated result after full audit**:
- 2,433+ documents with author
- 2,049+ documents with publication date
- Quality score improvement: +40 points average

---

## 🔗 Quick Reference

| Command | Purpose |
|---------|---------|
| `python3 metadata_audit.py next --count 10 --max-score 39` | Get 10 CRITICAL documents |
| `python3 metadata_audit.py next --count 10 --max-score 59` | Get 10 POOR documents |
| `python3 metadata_audit.py mark-fixed AUDIT_ID --notes "notes"` | Mark document as fixed |
| `python3 metadata_audit.py mark-skipped AUDIT_ID --reason "reason"` | Skip document |
| `python3 metadata_audit.py status` | Show audit progress |
| `python3 metadata_audit.py finalize-round --name "Round_1"` | Create checkpoint |

---

## 📞 Need Help?

- **See detected issues**: Run `python3 metadata_audit.py next` (shows all issues)
- **Check specific document**: Use `SELECT ... FROM library.library_documents WHERE slug='...'`
- **See full plan**: Read `EXPANDED_MULTI_COLLECTION_PLAN.md`
- **Quick reference**: This file!

---

**Happy auditing! 🎉**

*Remember: Every document you fix is one step closer to 95% author completion and 80% date completion!*
