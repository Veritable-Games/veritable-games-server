# Library Import Verification Checklist

Quick verification steps you can perform yourself to confirm import quality.

---

## ✅ Database Checks (via PostgreSQL)

```sql
-- 1. Total documents imported
SELECT COUNT(*) as total_docs
FROM library.library_documents
WHERE created_by = 3;
-- Expected: 3,880

-- 2. Documents by category
SELECT lc.name, COUNT(*) as count
FROM library.library_documents ld
JOIN library.library_categories lc ON ld.category_id = lc.id
WHERE ld.created_by = 3
GROUP BY lc.name
ORDER BY count DESC;
-- Expected: 13 categories, Political Theory highest (~1,428)

-- 3. Tag coverage
SELECT
  COUNT(DISTINCT ld.id) as docs_with_tags,
  COUNT(*) as total_associations,
  ROUND(AVG(tag_count), 2) as avg_tags_per_doc
FROM (
  SELECT ld.id, COUNT(ldt.tag_id) as tag_count
  FROM library.library_documents ld
  LEFT JOIN library.library_document_tags ldt ON ldt.document_id = ld.id
  WHERE ld.created_by = 3
  GROUP BY ld.id
) t,
library.library_documents ld
WHERE ld.created_by = 3;
-- Expected: ~3,880 docs with tags, ~60,900 associations, ~15.7 avg

-- 4. Check for documents without content
SELECT COUNT(*) as docs_without_content
FROM library.library_documents
WHERE created_by = 3 AND (content IS NULL OR content = '');
-- Expected: 0

-- 5. Check overlap with anarchist library
SELECT COUNT(*) as overlaps
FROM library.library_documents ld
WHERE ld.created_by = 3
  AND EXISTS (
    SELECT 1 FROM anarchist.documents ad
    WHERE ad.slug = ld.slug
  );
-- Expected: 16
```

---

## 🔍 Spot Check Random Documents

```sql
-- Get 5 random documents
SELECT id, title, author, category_id,
       LENGTH(content) as content_length,
       (SELECT COUNT(*) FROM library.library_document_tags
        WHERE document_id = ld.id) as tag_count
FROM library.library_documents ld
WHERE created_by = 3
ORDER BY RANDOM()
LIMIT 5;
```

For each document:
- ✅ Has title?
- ✅ Has content (content_length > 0)?
- ✅ Has category_id?
- ✅ Has tags (tag_count > 0)?

---

## 📊 Check Specific Examples

### Example 1: Check a Political Theory document
```sql
SELECT ld.title, ld.author, lc.name as category,
       STRING_AGG(t.name, ', ') as tags
FROM library.library_documents ld
JOIN library.library_categories lc ON ld.category_id = lc.id
LEFT JOIN library.library_document_tags ldt ON ldt.document_id = ld.id
LEFT JOIN shared.tags t ON t.id = ldt.tag_id
WHERE ld.created_by = 3
  AND lc.code = 'political-theory'
GROUP BY ld.id, ld.title, ld.author, lc.name
LIMIT 1;
```
Expected: Political Theory category, relevant tags like 'anarchism', 'revolution', 'organizing'

### Example 2: Check a Game Design document
```sql
SELECT ld.title, ld.author, lc.name as category,
       STRING_AGG(t.name, ', ') as tags
FROM library.library_documents ld
JOIN library.library_categories lc ON ld.category_id = lc.id
LEFT JOIN library.library_document_tags ldt ON ldt.document_id = ld.id
LEFT JOIN shared.tags t ON t.id = ldt.tag_id
WHERE ld.created_by = 3
  AND lc.code = 'game-design'
GROUP BY ld.id, ld.title, ld.author, lc.name
LIMIT 1;
```
Expected: Game Design category, tags like 'game-design', 'design'

---

## 🌐 Frontend Checks (Browser)

1. **Navigate to Library**:
   - Go to: https://www.veritablegames.com/library (or http://192.168.1.15:3000/library)

2. **Check Document Count**:
   - Should show ~28,479 total documents (24,599 anarchist + 3,880 library)

3. **Filter by Category**:
   - Select "Political Theory"
   - Should show ~1,428 library documents

4. **Filter by Tag**:
   - Try filtering by "anarchism", "labor", "climate-change"
   - Documents should appear with those tags

5. **Search**:
   - Search for a specific document title from the overlaps CSV
   - Should return results

6. **View Document**:
   - Click on a document
   - Should display:
     - Full title
     - Author (if available)
     - Content (full markdown)
     - Tags at bottom
     - Category badge

---

## 📁 File System Checks

```bash
# 1. Count markdown files
ls -1 /home/user/projects/veritable-games/resources/data/library/*.md | wc -l
# Expected: 4,393

# 2. Check tracking.csv exists
wc -l /home/user/projects/veritable-games/resources/data/library/tracking.csv
# Expected: ~4,384 (including header)

# 3. Check import logs
ls -lh /home/user/projects/veritable-games/resources/scripts/*.log
# Should show:
# - library_import.log
# - library_import_incremental.log
# - keyword_tagging.log
```

---

## ✅ Pass Criteria

Import is SUCCESSFUL if:
- ✅ 3,880 documents in database
- ✅ All have content (no empty documents)
- ✅ All have categories (13 categories used)
- ✅ Average 10+ tags per document
- ✅ Only ~16 overlaps with anarchist library
- ✅ Documents display correctly in frontend
- ✅ Search and filtering work

---

## 🚨 Red Flags (Signs of Problems)

- ❌ Fewer than 3,800 documents imported
- ❌ Large number of documents without content
- ❌ Documents without categories
- ❌ Average fewer than 5 tags per document
- ❌ More than 100 overlaps with anarchist library
- ❌ Documents not displaying in frontend
- ❌ Broken search or filtering

---

## 📞 Next Steps if Issues Found

1. **Check import logs** for error messages
2. **Review CSV files** on Desktop for patterns
3. **Run spot checks** on specific problematic documents
4. **Check database indexes** are created correctly
5. **Verify frontend integration** is working

---

**Last Updated**: November 20, 2025
