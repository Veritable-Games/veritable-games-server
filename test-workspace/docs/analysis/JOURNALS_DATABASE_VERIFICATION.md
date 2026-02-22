# Journals Database Verification Guide

**Date**: 2026-02-13
**Purpose**: Verify the exact state of journals in the production database

---

## Quick Diagnosis Commands

Run these commands to understand what's in the database:

### 1. Check Total Journal Count

```sql
SELECT COUNT(*) as total_journals
FROM wiki.wiki_pages
WHERE namespace = 'journals';
```

**Expected**: Should show total number of journals (e.g., 15)

---

### 2. Check Journals by Deletion Status

```sql
SELECT
  CASE
    WHEN is_deleted = TRUE THEN 'Deleted'
    WHEN is_deleted = FALSE THEN 'Active'
    ELSE 'NULL (Active)'
  END as deletion_status,
  COUNT(*) as count
FROM wiki.wiki_pages
WHERE namespace = 'journals'
GROUP BY is_deleted
ORDER BY is_deleted NULLS FIRST;
```

**Expected Output**:
```
deletion_status | count
----------------|------
NULL (Active)   |  0
Active          |  7
Deleted         |  8
```

**Current Problem**: If ALL journals show as "Deleted", the query filter excludes them all.

---

### 3. Check Journals by User

```sql
SELECT
  created_by,
  is_deleted,
  is_archived,
  COUNT(*) as count
FROM wiki.wiki_pages
WHERE namespace = 'journals'
GROUP BY created_by, is_deleted, is_archived
ORDER BY created_by, is_deleted NULLS FIRST;
```

**Shows**: How many journals each user has, broken down by deletion/archive status.

---

### 4. Detailed Journal List

```sql
SELECT
  id,
  title,
  created_by,
  is_deleted,
  deleted_at,
  deleted_by,
  is_archived,
  archived_at,
  archived_by,
  journal_category_id,
  created_at,
  updated_at
FROM wiki.wiki_pages
WHERE namespace = 'journals'
ORDER BY
  is_deleted NULLS FIRST,
  is_archived NULLS FIRST,
  updated_at DESC;
```

**Shows**: Complete list with all status fields.

---

### 5. Simulate the Current Query (Broken)

```sql
-- This is what the CURRENT code runs (with the bug)
SELECT
  p.id,
  p.slug,
  p.title,
  p.is_deleted,
  p.is_archived,
  p.journal_category_id
FROM wiki.wiki_pages p
WHERE p.namespace = 'journals'
  AND p.created_by = 1  -- Replace with actual user ID
  AND (p.is_deleted = FALSE OR p.is_deleted IS NULL);  -- ⚠️ PROBLEM LINE
```

**Expected**: Should return 0 rows if all journals have `is_deleted = TRUE`

---

### 6. Simulate the Fixed Query (Working)

```sql
-- This is what the code SHOULD run (after fix)
SELECT
  p.id,
  p.slug,
  p.title,
  p.is_deleted,
  p.is_archived,
  p.journal_category_id
FROM wiki.wiki_pages p
WHERE p.namespace = 'journals'
  AND p.created_by = 1;  -- Replace with actual user ID
  -- NO is_deleted filter ✅
```

**Expected**: Should return all journals (including deleted ones)

---

## Root Cause Verification

### Hypothesis: All Journals Have `is_deleted = TRUE`

**Test Query**:
```sql
SELECT
  COUNT(*) FILTER (WHERE is_deleted = TRUE) as deleted_count,
  COUNT(*) FILTER (WHERE is_deleted = FALSE) as active_count,
  COUNT(*) FILTER (WHERE is_deleted IS NULL) as null_count,
  COUNT(*) as total_count
FROM wiki.wiki_pages
WHERE namespace = 'journals';
```

**If this shows**:
```
deleted_count | active_count | null_count | total_count
--------------|--------------|------------|------------
     15       |      0       |     0      |     15
```

**Then the diagnosis is confirmed**: All journals are marked as deleted, so the query filter excludes them all.

---

## Category Verification

### Check Journal Categories

```sql
SELECT
  jc.id,
  jc.name,
  jc.user_id,
  COUNT(wp.id) as journal_count
FROM wiki.journal_categories jc
LEFT JOIN wiki.wiki_pages wp
  ON wp.journal_category_id = jc.id
  AND wp.namespace = 'journals'
GROUP BY jc.id, jc.name, jc.user_id
ORDER BY jc.sort_order, jc.name;
```

**Shows**: Each category and how many journals are in it (including deleted ones).

---

### Check Journals Without Category

```sql
SELECT COUNT(*) as uncategorized_journals
FROM wiki.wiki_pages
WHERE namespace = 'journals'
  AND (journal_category_id IS NULL OR journal_category_id = '');
```

**Shows**: How many journals don't have a category assigned.

---

## User Identification

### Find the Current User's ID

```sql
-- If you know the username:
SELECT id, username, role
FROM users.users
WHERE username = 'your_username';  -- Replace with actual username

-- Or list all users with journals:
SELECT DISTINCT
  u.id,
  u.username,
  u.role,
  COUNT(wp.id) as journal_count
FROM users.users u
INNER JOIN wiki.wiki_pages wp
  ON wp.created_by = u.id
  AND wp.namespace = 'journals'
GROUP BY u.id, u.username, u.role
ORDER BY journal_count DESC;
```

**Use this user ID** in the queries above (replace `created_by = 1`).

---

## Permission Verification

### Check User Role

```sql
SELECT
  id,
  username,
  role,
  CASE
    WHEN role IN ('admin', 'developer') THEN 'Sees ALL journals'
    ELSE 'Sees only own journals'
  END as visibility
FROM users.users
WHERE username = 'your_username';  -- Replace with actual username
```

**Admin/Developer**: Can see ALL journals (no `created_by` filter)
**Regular User**: Can only see their own journals (`created_by = ?`)

---

## Fix Verification After Deployment

After reverting commit a9bef9fcfd and redeploying, run these queries to verify:

### 1. Verify Query Returns Data

```sql
-- Run the FIXED query (no is_deleted filter)
SELECT
  p.id,
  p.slug,
  p.title,
  p.is_deleted,
  p.is_archived
FROM wiki.wiki_pages p
WHERE p.namespace = 'journals'
  AND p.created_by = 1  -- Replace with actual user ID
ORDER BY p.updated_at DESC;
```

**Expected**: Should return all journals (including deleted ones).

---

### 2. Verify Sorting Priority

```sql
-- Verify journals can be sorted by priority
SELECT
  p.id,
  p.title,
  CASE
    WHEN p.is_deleted = TRUE THEN 2
    WHEN p.is_archived = TRUE THEN 1
    ELSE 0
  END as priority,
  p.is_deleted,
  p.is_archived,
  p.updated_at
FROM wiki.wiki_pages p
WHERE p.namespace = 'journals'
  AND p.created_by = 1  -- Replace with actual user ID
ORDER BY
  CASE
    WHEN p.is_deleted = TRUE THEN 2
    WHEN p.is_archived = TRUE THEN 1
    ELSE 0
  END ASC,
  p.updated_at DESC;
```

**Expected Output**:
```
id  | title      | priority | is_deleted | is_archived | updated_at
----|------------|----------|------------|-------------|------------
1   | Journal A  |    0     |   FALSE    |   FALSE     | 2026-02-13
2   | Journal B  |    0     |   FALSE    |   FALSE     | 2026-02-12
3   | Journal C  |    1     |   FALSE    |   TRUE      | 2026-02-11
4   | Journal D  |    2     |   TRUE     |   FALSE     | 2026-02-10
5   | Journal E  |    2     |   TRUE     |   FALSE     | 2026-02-09
```

**Order**: Active (0) → Archived (1) → Deleted (2), within each group by `updated_at DESC`

---

## Quick Diagnosis Script

Save this as `diagnose_journals.sql` and run it:

```sql
-- Journals Diagnosis Script
-- Run this on production database to verify state

\echo '=== TOTAL JOURNALS ==='
SELECT COUNT(*) as total_journals
FROM wiki.wiki_pages
WHERE namespace = 'journals';

\echo '\n=== JOURNALS BY STATUS ==='
SELECT
  CASE
    WHEN is_deleted = TRUE THEN 'Deleted'
    WHEN is_deleted = FALSE THEN 'Active'
    ELSE 'NULL (Active)'
  END as deletion_status,
  CASE
    WHEN is_archived = TRUE THEN 'Archived'
    WHEN is_archived = FALSE THEN 'Not Archived'
    ELSE 'NULL (Not Archived)'
  END as archive_status,
  COUNT(*) as count
FROM wiki.wiki_pages
WHERE namespace = 'journals'
GROUP BY is_deleted, is_archived
ORDER BY is_deleted NULLS FIRST, is_archived NULLS FIRST;

\echo '\n=== CURRENT QUERY RESULT (BROKEN) ==='
SELECT COUNT(*) as returned_journals
FROM wiki.wiki_pages p
WHERE p.namespace = 'journals'
  AND (p.is_deleted = FALSE OR p.is_deleted IS NULL);

\echo '\n=== FIXED QUERY RESULT (EXPECTED) ==='
SELECT COUNT(*) as returned_journals
FROM wiki.wiki_pages p
WHERE p.namespace = 'journals';

\echo '\n=== JOURNALS BY USER ==='
SELECT
  u.username,
  u.role,
  COUNT(wp.id) as journal_count,
  COUNT(wp.id) FILTER (WHERE wp.is_deleted = TRUE) as deleted_count,
  COUNT(wp.id) FILTER (WHERE wp.is_archived = TRUE) as archived_count
FROM users.users u
LEFT JOIN wiki.wiki_pages wp
  ON wp.created_by = u.id
  AND wp.namespace = 'journals'
GROUP BY u.username, u.role
HAVING COUNT(wp.id) > 0
ORDER BY journal_count DESC;

\echo '\n=== CATEGORIES WITH COUNTS ==='
SELECT
  jc.name,
  COUNT(wp.id) as journal_count,
  COUNT(wp.id) FILTER (WHERE wp.is_deleted = FALSE) as active_count,
  COUNT(wp.id) FILTER (WHERE wp.is_deleted = TRUE) as deleted_count
FROM wiki.journal_categories jc
LEFT JOIN wiki.wiki_pages wp
  ON wp.journal_category_id = jc.id
  AND wp.namespace = 'journals'
GROUP BY jc.id, jc.name
ORDER BY jc.sort_order, jc.name;

\echo '\n=== DIAGNOSIS COMPLETE ==='
```

**Run with**:
```bash
psql -h 192.168.1.15 -U postgres -d veritablegames -f diagnose_journals.sql
```

---

## Expected vs Actual Comparison

### Expected (Working System)

| Metric | Value |
|--------|-------|
| Total journals | 15 |
| Active journals | 7 |
| Deleted journals | 8 |
| Archived journals | 3 |
| **Current query returns** | **0** ⚠️ |
| **Fixed query returns** | **15** ✅ |

### Actual (Current Broken System)

| Metric | Value |
|--------|-------|
| Total journals | 15 |
| Active journals | 0 |
| Deleted journals | 15 |
| Archived journals | 0 |
| **Current query returns** | **0** ⚠️ |
| **Fixed query returns** | **15** ✅ |

**Diagnosis**: All journals marked as deleted, query filter excludes them all.

---

## How to Connect to Production Database

### Option 1: SSH + psql

```bash
# SSH into production server
ssh user@192.168.1.15

# Connect to PostgreSQL
psql -h localhost -U postgres -d veritablegames

# Switch to wiki schema
\c veritablegames
SET search_path TO wiki;

# Run queries...
```

### Option 2: Direct Connection (from local machine)

```bash
# Connect directly (requires PostgreSQL port open)
psql -h 192.168.1.15 -U postgres -d veritablegames

# Or use connection string
psql postgresql://postgres:password@192.168.1.15:5432/veritablegames
```

### Option 3: Using Coolify/Docker

```bash
# SSH into server
ssh user@192.168.1.15

# Access database container
docker exec -it <postgres-container-id> psql -U postgres -d veritablegames

# Or find container name:
docker ps | grep postgres
docker exec -it <container-name> psql -U postgres -d veritablegames
```

---

## Post-Fix Verification Checklist

After reverting commit a9bef9fcfd and redeploying:

- [ ] 1. Run diagnosis script - verify total journals count
- [ ] 2. Check query returns data (not 0 rows)
- [ ] 3. Load production site in browser
- [ ] 4. Hard refresh page (Ctrl+Shift+R / Cmd+Shift+R)
- [ ] 5. Verify journals appear in sidebar
- [ ] 6. Verify deleted journals show with strike-through
- [ ] 7. Verify deleted journals are at bottom of each category
- [ ] 8. Test "Recover" action on a deleted journal
- [ ] 9. Test delete → undo (Ctrl+Z)
- [ ] 10. Verify categories show correct journal counts

---

## Emergency Database Fix (NOT RECOMMENDED)

**⚠️ WARNING**: Only use this if you want to mark all journals as active (NOT recommended - breaks delete feature):

```sql
-- DANGER: This will mark all journals as active
-- This breaks the delete/recover functionality
-- Only use if you're sure you want to lose deletion history

UPDATE wiki.wiki_pages
SET
  is_deleted = FALSE,
  deleted_by = NULL,
  deleted_at = NULL
WHERE namespace = 'journals'
  AND is_deleted = TRUE;
```

**DO NOT RUN THIS**. Instead, revert the code fix (remove the `is_deleted` filter from the query).

---

## Summary

**Problem**: Query filters out deleted journals, but all journals are marked as deleted.

**Solution**: Remove the `is_deleted` filter from the query (revert commit a9bef9fcfd).

**Verification**: Run diagnosis script to confirm journals are in database, then deploy fix and verify UI shows them.
