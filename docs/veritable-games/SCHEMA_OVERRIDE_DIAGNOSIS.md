# Schema Override: What Happened and How to Fix It

**Date:** November 12, 2025
**Critical Issue:** Deployed API queries OLD schema (anarchist.tags) instead of NEW unified schema (shared.tags)

---

## The Problem: Remote Model Used Old Schema

### What We Built (Unified Tag Schema)

Our implementation queried the **unified** `shared.tags` table:

```sql
-- OUR VERSION: Queries shared.tags
SELECT t.id, t.name
FROM anarchist.document_tags dt
JOIN shared.tags t ON dt.tag_id = t.id  -- ✓ SHARED SCHEMA
WHERE dt.document_id = $1
```

### What Got Deployed (Old Schema)

The deployed API queries the **old** `anarchist.tags` table:

```sql
-- DEPLOYED VERSION: Queries anarchist.tags
SELECT t.id, t.name
FROM anarchist.document_tags dt
JOIN anarchist.tags t ON dt.tag_id = t.id  -- ✗ OLD SCHEMA
WHERE dt.document_id = $1
```

### Why This Breaks Everything

```bash
# The table the API is querying:
$ docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "SELECT COUNT(*) FROM anarchist.tags;"
ERROR:  relation "anarchist.tags" does not exist

# The table it SHOULD query:
$ docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "SELECT COUNT(*) FROM shared.tags;"
 count
-------
 19952
```

**The deployed API is trying to query a table that doesn't exist anymore!**

Our migration script dropped `anarchist.tags` and created `shared.tags` instead.

---

## What Happened: Timeline

### 1. Server Model Work (Nov 11-12)

**Database:**
- Created `shared` schema
- Created `shared.tags` table
- Migrated library tags to shared schema
- **Dropped** `anarchist.tags` (old table)
- Imported 19,952 tags into `shared.tags`
- Created 194,664 associations in `anarchist.document_tags`
- Updated foreign keys to point to `shared.tags`

**Code:**
- Created API endpoint that queries `shared.tags`
- Updated frontend routing
- Created git patches

### 2. Remote Model Work (Nov 12)

**Received patches but:**
- Didn't have the anarchist tags API endpoint file
- Created their own version from scratch
- **Used old schema design** (anarchist.tags)
- Committed and deployed

**Result:**
- Container has API endpoint ✓
- But it queries wrong table ✗
- Tags can't load (table doesn't exist)

---

## Evidence: Deployed API vs Our API

### Our API (Server Repo) - CORRECT

**File:** `/home/user/veritable-games-migration/frontend/src/app/api/documents/anarchist/[slug]/tags/route.ts`

**Line 66-72:**
```typescript
const currentTagsResult = await dbAdapter.query(
  `
    SELECT
      t.id,
      t.name
    FROM anarchist.document_tags dt
    JOIN shared.tags t ON dt.tag_id = t.id  // ✓ SHARED SCHEMA
    WHERE dt.document_id = $1
    ORDER BY t.name
  `,
  [document.id]
);
```

**Line 85-95:**
```typescript
const allTagsResult = await dbAdapter.query(
  `
    SELECT
      t.id,
      t.name
    FROM shared.tags t  // ✓ SHARED SCHEMA
    ORDER BY t.usage_count DESC, t.name
  `
);
```

### Deployed API (Container) - WRONG

**File:** `/app/src/app/api/documents/anarchist/[slug]/tags/route.ts` (extracted to `/home/user/DEPLOYED_ANARCHIST_TAGS_API.ts`)

**Line 62-70:**
```typescript
const currentTagsResult = await dbAdapter.query(
  `
      SELECT
        t.id,
        t.name
      FROM anarchist.document_tags dt
      JOIN anarchist.tags t ON dt.tag_id = t.id  // ✗ OLD SCHEMA
      WHERE dt.document_id = $1
      ORDER BY t.name ASC
    `,
  [document.id]
);
```

**Line 74-84:**
```typescript
const allTagsResult = await dbAdapter.query(
  `
      SELECT
        t.id,
        t.name
      FROM anarchist.tags t  // ✗ OLD SCHEMA
      ORDER BY t.name ASC
    `,
  []
);
```

---

## Database State Verification

### Tables That Exist

```bash
$ docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "\dt shared.*"
        List of relations
 Schema | Name | Type  |  Owner
--------+------+-------+----------
 shared | tags | table | postgres  # ✓ EXISTS (19,952 tags)

$ docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "\dt anarchist.*"
                    List of relations
  Schema   |       Name       | Type  |  Owner
-----------+------------------+-------+----------
 anarchist | document_tags    | table | postgres  # ✓ EXISTS (194,664 rows)
 anarchist | documents        | table | postgres  # ✓ EXISTS (24,643 docs)

# Note: anarchist.tags is NOT listed (we dropped it)
```

### Tables That Don't Exist

```bash
$ docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "SELECT * FROM anarchist.tags LIMIT 1;"
ERROR:  relation "anarchist.tags" does not exist
LINE 1: SELECT * FROM anarchist.tags LIMIT 1;
                      ^
```

### Foreign Keys Point to Shared Schema

```bash
$ docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
SELECT
    conname AS constraint_name,
    confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE conname = 'document_tags_tag_id_fkey';
"

    constraint_name      | referenced_table
--------------------------+------------------
 document_tags_tag_id_fkey | shared.tags      # ✓ CORRECT
```

**The database is configured for the unified schema. The API code is not.**

---

## Why Tags Aren't Showing

### 1. API GET Request Fails

When user visits an anarchist document:
- Frontend makes request: `GET /api/documents/anarchist/[slug]/tags`
- API tries to query: `SELECT ... FROM anarchist.tags ...`
- PostgreSQL returns: `ERROR: relation "anarchist.tags" does not exist`
- API returns 500 error
- Frontend shows no tags

### 2. Tag Filter Panel Empty

When user clicks "Filter by tags":
- Frontend makes request: `GET /api/documents/anarchist/tags` (or similar)
- API tries to query: `SELECT ... FROM anarchist.tags ...`
- PostgreSQL returns: `ERROR: relation "anarchist.tags" does not exist`
- API returns error
- Panel shows no tags

### 3. Adding Tags Fails

When user tries to add a tag:
- Frontend makes request: `POST /api/documents/anarchist/[slug]/tags`
- API tries to query: `INSERT INTO anarchist.tags ...` or `SELECT FROM anarchist.tags ...`
- PostgreSQL returns: `ERROR: relation "anarchist.tags" does not exist`
- API returns error
- Tag addition fails

---

## The Fix: Update Deployed API to Use Shared Schema

### Option 1: Replace Deployed API with Our Version (Recommended)

The remote model needs to update the API endpoint to use `shared.tags` instead of `anarchist.tags`.

**Changes needed in `/app/src/app/api/documents/anarchist/[slug]/tags/route.ts`:**

1. **Line ~66:** Change `JOIN anarchist.tags t` → `JOIN shared.tags t`
2. **Line ~80:** Change `FROM anarchist.tags t` → `FROM shared.tags t`
3. **Line ~143:** Change references to `anarchist.tags` → `shared.tags`
4. **Line ~191:** Change INSERT/SELECT to use `shared.tags`

### Option 2: Provide Corrected File to Remote Model

**On server:**
```bash
# Copy our correct version to /tmp for transfer
cp /home/user/veritable-games-migration/frontend/src/app/api/documents/anarchist/\[slug\]/tags/route.ts /tmp/CORRECT_anarchist_tags_api.ts
```

**Remote model needs to:**
```bash
# On laptop:
scp user@veritable-games-server:/tmp/CORRECT_anarchist_tags_api.ts ~/Downloads/

cd ~/Projects/veritable-games-main
cp ~/Downloads/CORRECT_anarchist_tags_api.ts "src/app/api/documents/anarchist/[slug]/tags/route.ts"

git add "src/app/api/documents/anarchist/[slug]/tags/route.ts"
git commit -m "Fix anarchist tags API to use unified shared.tags schema

The deployed version was querying anarchist.tags which doesn't exist.
Updated all queries to use shared.tags (unified schema).

Fixes:
- Tags now load for anarchist documents
- Filter by tags shows all 19,952 tags
- Tag addition works correctly"

git push origin master
```

---

## Exact Code Changes Needed

### GET Handler - Fetch Current Tags

**Current (WRONG):**
```typescript
JOIN anarchist.tags t ON dt.tag_id = t.id
```

**Fixed (CORRECT):**
```typescript
JOIN shared.tags t ON dt.tag_id = t.id
```

### GET Handler - Fetch All Tags

**Current (WRONG):**
```typescript
FROM anarchist.tags t
```

**Fixed (CORRECT):**
```typescript
FROM shared.tags t
ORDER BY t.usage_count DESC, t.name
```

(Note: Also add `usage_count` to ORDER BY to show most-used tags first)

### POST Handler - Check Tag Exists

**Current (WRONG):**
```typescript
// Check if tag exists in anarchist.tags
const existingTagResult = await dbAdapter.query(
  'SELECT id, name FROM tags WHERE id = $1',
  [tagId],
  { schema: 'anarchist' }  // ✗ WRONG
);
```

**Fixed (CORRECT):**
```typescript
// Check if tag exists in shared.tags
const existingTagResult = await dbAdapter.query(
  'SELECT id, name FROM tags WHERE id = $1',
  [tagId],
  { schema: 'shared' }  // ✓ CORRECT
);
```

### POST Handler - Create New Tag

**Current (WRONG):**
```typescript
// Create tag if it doesn't exist in anarchist.tags
const insertTagResult = await dbAdapter.query(
  'INSERT INTO tags (name) VALUES ($1) RETURNING id, name',
  tagName,
  { schema: 'anarchist' }  // ✗ WRONG
);
```

**Fixed (CORRECT):**
```typescript
// Create tag if it doesn't exist in shared.tags
const insertTagResult = await dbAdapter.query(
  'INSERT INTO tags (name) VALUES ($1) RETURNING id, name',
  tagName,
  { schema: 'shared' }  // ✓ CORRECT
);
```

### POST Handler - Fetch Existing Tag by Name

**Current (WRONG):**
```typescript
// Get the tag from anarchist.tags
const tagResult = await dbAdapter.query(
  'SELECT id FROM tags WHERE name = $1',
  [tagName],
  { schema: 'anarchist' }  // ✗ WRONG
);
```

**Fixed (CORRECT):**
```typescript
// Get the tag from shared.tags
const tagResult = await dbAdapter.query(
  'SELECT id FROM tags WHERE name = $1',
  [tagName],
  { schema: 'shared' }  // ✓ CORRECT
);
```

---

## Summary of All Changes Needed

**Find and replace in deployed API:**
1. `JOIN anarchist.tags` → `JOIN shared.tags`
2. `FROM anarchist.tags` → `FROM shared.tags`
3. `{ schema: 'anarchist' }` (in tag queries) → `{ schema: 'shared' }`
4. Comments mentioning "anarchist.tags" → "shared.tags"

**That's it.** Everything else in the API can stay the same.

---

## What Needs to Be Re-Adopted

### Database Work: ✅ Nothing (Already Correct)

The database is perfect:
- `shared.tags` exists with 19,952 tags
- `anarchist.document_tags` has 194,664 associations
- Foreign keys point to `shared.tags`
- Triggers installed and working

**No database changes needed.**

### Container Code: ❌ API Endpoint Needs Update

The deployed API file needs schema references changed:
- All `anarchist.tags` → `shared.tags`
- All `{ schema: 'anarchist' }` → `{ schema: 'shared' }` (for tag operations)

**One file needs updating, then redeploy.**

### Frontend: ✅ Already Correct

The frontend routing is correct:
```typescript
apiPrefix={documentSource === 'anarchist' ? '/api/documents/anarchist' : '/api/library/documents'}
```

**No frontend changes needed.**

---

## Verification After Fix

Once remote model updates the API to use `shared.tags` and redeploys:

### Test 1: API Returns Tags
```bash
curl -s "https://www.veritablegames.com/api/documents/anarchist/emma-goldman-anarchism-what-it-really-stands-for/tags" | jq '.allTags | length'

# Expected: ~19952 (or similar large number)
# Current: Error or 0
```

### Test 2: Tags Display on Website
- Visit any anarchist document page
- Tags should appear below document title
- "Edit Tags" button should work

### Test 3: Filter Panel Shows Tags
- Click "Filter by tags" on library page
- Should show 19,952+ tags
- Can filter to see anarchist documents

### Test 4: Adding Tags Works
- Open an anarchist document
- Click "Edit Tags"
- Add a tag → Should work without errors
- Remove a tag → Should work without errors

---

## Why This Happened

The remote model:
1. Received our patches but the anarchist tags API file was missing
2. Created the API endpoint from scratch
3. Assumed anarchist documents use `anarchist.tags` (logical guess)
4. Didn't know we had migrated to `shared.tags`
5. Deployed code that queries a table that doesn't exist

**Not their fault** - they didn't have context about the unified schema migration.

---

## How to Prevent This

### For Server Model (Me):
When creating patches, include comprehensive documentation:
- What schema changes were made
- What tables were created/dropped
- How the API should query the database
- Database verification queries

### For Remote Model:
When creating code that depends on database:
- Check what tables exist: `\dt schema.*`
- Check foreign key relationships
- Test queries before deploying
- Ask for database schema documentation

### For Both:
Better communication about database changes:
- Server documents database state in `/tmp/*.md`
- Remote asks for verification before implementing
- Both check `CLAUDE.md` for schema information

---

## Files for Remote Model

**Correct API implementation available at:**
```
Server: /home/user/veritable-games-migration/frontend/src/app/api/documents/anarchist/[slug]/tags/route.ts
Copy at: /tmp/CORRECT_anarchist_tags_api.ts (to be created)
```

**Transfer command:**
```bash
scp user@veritable-games-server:/tmp/CORRECT_anarchist_tags_api.ts ~/Downloads/
```

---

## Bottom Line

### What's Wrong
✗ Deployed API queries `anarchist.tags` (doesn't exist)
✓ Database has `shared.tags` (19,952 tags)
= Tags can't load (table mismatch)

### What's Right
✓ Database migration complete and working
✓ All 19,952 tags imported correctly
✓ Frontend routing correct
✓ API endpoint file exists in container

### What Needs Fixing
❌ One file: `src/app/api/documents/anarchist/[slug]/tags/route.ts`
❌ Changes needed: Replace `anarchist.tags` with `shared.tags` (6-8 locations)
❌ Time to fix: 5 minutes
❌ Redeploy: 3-5 minutes

**Total fix time: ~10 minutes**

---

**End of Diagnosis**

Created: November 12, 2025
Location: `/home/user/SCHEMA_OVERRIDE_DIAGNOSIS.md`
Companion: `/home/user/UNIFIED_TAG_SCHEMA_STATUS.md`
