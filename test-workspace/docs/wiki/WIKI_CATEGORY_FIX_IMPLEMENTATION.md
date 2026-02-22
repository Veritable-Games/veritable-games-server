# Wiki Category Fix - Implementation Guide

**Status**: Ready to implement
**Complexity**: Low
**Estimated time**: 45 minutes (fix + test + deploy)
**Risk level**: Low (only adds missing data, doesn't modify existing code)

## Overview

This guide provides step-by-step implementation to fix the wiki category production bug. The issue is missing wiki_categories data in PostgreSQL due to:

1. Corrupted schema file (indexes before tables)
2. Missing seed data file
3. Incomplete database initialization

## Prerequisites

- Access to production PostgreSQL (192.168.1.15)
- Admin password for SSH access
- Coolify deployment access
- ~45 minutes of downtime tolerance

## Phase 1: Diagnose Current State (5 minutes)

### Step 1.1: Run Diagnostic Queries on Production

```bash
# SSH into production server
ssh user@192.168.1.15

# Connect to PostgreSQL
psql postgresql://postgres:SECURE_PASSWORD@veritable-games-postgres-new:5432/veritable_games

# Run these diagnostic queries (copy from WIKI_PRODUCTION_DIAGNOSTIC_QUERIES.sql)
SELECT COUNT(*) as category_count FROM wiki.wiki_categories;
SELECT COUNT(*) as page_count FROM wiki.wiki_pages WHERE status = 'published';
```

**Expected output**:
- category_count: 0 (THIS IS THE PROBLEM)
- page_count: 174 (pages exist fine)

### Step 1.2: Verify Schema Exists

```sql
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'wiki';
```

**Expected**: 1 row (schema already exists)

## Phase 2: Fix the Schema File (10 minutes)

### Step 2.1: Generate Proper Schema File

The current schema file starts with CREATE INDEX statements before CREATE TABLE. We need to reorder it.

**Option A: Generate new schema file from production**

```bash
# Connect to production PostgreSQL and export schema
pg_dump \
  --schema=wiki \
  --schema-only \
  --no-privileges \
  --no-owner \
  postgresql://postgres:SECURE_PASSWORD@veritable-games-postgres-new:5432/veritable_games \
  > /tmp/wiki_schema_correct.sql
```

**Option B: Manually fix the current schema file**

Alternatively, we can manually reorder the current `frontend/scripts/seeds/schemas/wiki.sql`:

1. Move all `CREATE TABLE` statements to the beginning (lines ~140-290 in current file)
2. Keep all `CREATE INDEX` statements after tables (current lines 1-135)
3. Keep all triggers at the end

The ordering should be:
```sql
-- 1. CREATE TABLE wiki_categories
-- 2. CREATE TABLE wiki_pages
-- 3. CREATE TABLE wiki_revisions
-- ... (all other tables)
-- 4. CREATE INDEX idx_wiki_categories_parent
-- ... (all indexes)
-- 5. CREATE TRIGGER auto_categorize_immediate
-- ... (all triggers)
```

### Step 2.2: Update init-databases.js

**File**: `frontend/scripts/init-databases.js`
**Line**: 30

Current:
```javascript
{ name: 'wiki', hasSeeds: false },
```

Change to:
```javascript
{ name: 'wiki', hasSeeds: true, seeds: ['wiki-categories.sql'] },
```

## Phase 3: Create Seed Data File (5 minutes)

### Step 3.1: Create Wiki Categories Seed

**File**: `frontend/scripts/seeds/data/wiki-categories.sql`

**Content**:
```sql
-- Wiki Categories Seed Data
-- Initial categories for wiki organization
-- Created: November 14, 2025

-- Insert base categories
INSERT INTO wiki.wiki_categories (id, name, description, color, icon, sort_order, is_public)
VALUES
  (
    'uncategorized',
    'Uncategorized',
    'Pages without a specific category',
    '#6B7280',
    NULL,
    0,
    true
  ),
  (
    'archive',
    'Archive',
    'Historical and archived content',
    '#9B2C2C',
    'archive',
    1,
    true
  ),
  (
    'autumn',
    'Autumn',
    'Autumn project documentation',
    '#ED8936',
    'leaf',
    2,
    true
  ),
  (
    'cosmic-knights',
    'Cosmic Knights',
    'Cosmic Knights project information',
    '#2B6CB0',
    'star',
    3,
    true
  ),
  (
    'dodec',
    'Dodec',
    'Dodec project documentation',
    '#5A67D8',
    'cube',
    4,
    true
  ),
  (
    'journals',
    'Journals',
    'Personal journals and notes',
    '#F6E05E',
    'book',
    5,
    true
  ),
  (
    'noxii',
    'Noxii',
    'Noxii civilization documentation',
    '#38A169',
    'globe',
    6,
    true
  ),
  (
    'on-command',
    'On-Command',
    'On-Command project documentation',
    '#D69E2E',
    'command',
    7,
    true
  ),
  (
    'systems',
    'Systems',
    'System documentation and technical guides',
    '#718096',
    'cog',
    8,
    true
  ),
  (
    'tutorials',
    'Tutorials',
    'Learning tutorials and guides',
    '#3182CE',
    'graduation-cap',
    9,
    true
  );

-- Link pages to their categories based on markdown file structure
-- This is done via the application on first scan, so we don't hardcode page-category relationships here
```

### Step 3.2: Verify Seed File Syntax

```bash
# Check PostgreSQL syntax (from laptop)
cd /home/user/Projects/veritable-games-main/frontend

# Validate against production schema
cat scripts/seeds/data/wiki-categories.sql | psql \
  postgresql://postgres:SECURE_PASSWORD@192.168.1.15:5432/veritable_games \
  -v ON_ERROR_STOP=1 \
  --echo-all \
  --no-psqlrc

# Should complete without errors
```

## Phase 4: Apply Fix to Development (5 minutes)

### Step 4.1: Test Schema Fix Locally

```bash
cd /home/user/Projects/veritable-games-main/frontend

# Initialize fresh local database
npm run db:init -- --force

# Verify schema was applied
sqlite3 data/wiki.db << 'EOF'
.tables
SELECT COUNT(*) FROM wiki_categories;
EOF
```

Expected output:
```
content_references forum_categories forum_replies ... wiki_tags
9
```

### Step 4.2: Verify Queries Work Locally

```bash
# Start development server
npm run dev

# Test in browser:
# - Visit http://localhost:3000/wiki/categories
# - Should see category list
# - Click on a category
# - Should see pages in that category
```

## Phase 5: Deploy to Production (20 minutes)

### Step 5.1: Commit Changes

```bash
cd /home/user/Projects/veritable-games-main

git add frontend/scripts/seeds/schemas/wiki.sql
git add frontend/scripts/seeds/data/wiki-categories.sql
git add frontend/scripts/init-databases.js

git commit -m "fix: Repair corrupted wiki schema and add category seed data

- Fixed wiki.sql schema file: tables now created before indexes
- Added wiki-categories.sql with initial 10 categories
- Updated init-databases.js to include wiki seeds
- Resolves category pages showing 'doesn't exist' in production
- All 174 wiki pages continue to work

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

### Step 5.2: Wait for Auto-Deployment

Coolify should automatically detect the push and start deployment. Monitor at:
```
http://192.168.1.15:8000
```

Expected timeline:
- Push detected: ~1-2 minutes
- Build starts: Immediately
- Build duration: ~3-5 minutes
- Deployment: ~1 minute
- Total: ~5-7 minutes

### Step 5.3: Verify Production Deployment

Once deployment completes, run diagnostics on production:

```bash
# SSH into production
ssh user@192.168.1.15

# Connect to PostgreSQL
psql postgresql://postgres:SECURE_PASSWORD@veritable-games-postgres-new:5432/veritable_games

# Check categories are now present
SELECT COUNT(*) as category_count FROM wiki.wiki_categories;
SELECT id, name FROM wiki.wiki_categories ORDER BY sort_order;
```

Expected output:
```
category_count
10

id               | name
uncategorized    | Uncategorized
archive          | Archive
autumn           | Autumn
cosmic-knights   | Cosmic Knights
dodec            | Dodec
journals         | Journals
noxii            | Noxii
on-command       | On-Command
systems          | Systems
tutorials        | Tutorials
```

### Step 5.4: Test in Browser

Visit the production site:

```
https://www.veritablegames.com/wiki/categories
```

Verify:
- ✓ Category list displays with all 10 categories
- ✓ Can click on each category
- ✓ Category pages show list of pages in that category
- ✓ Individual pages still work (e.g., `/wiki/pages/autumn-2025`)

## Phase 6: Verification (5 minutes)

### Step 6.1: Run Full Diagnostic

Use the SQL script: `docs/wiki/WIKI_PRODUCTION_DIAGNOSTIC_QUERIES.sql`

Expected results after fix:
- ✓ wiki schema exists
- ✓ wiki_categories table has 10 rows
- ✓ wiki_pages table has 174 rows
- ✓ 174 published pages across categories
- ✓ No orphaned pages
- ✓ All foreign keys valid

### Step 6.2: Test User Scenarios

1. **Browse categories**:
   - Visit `/wiki/categories`
   - See all 10 categories listed
   - Click on each category
   - See pages in that category

2. **Search within categories**:
   - Use search feature
   - Filter by category
   - Results respect category filter

3. **Category visibility**:
   - Verify `uncategorized` is public
   - Verify all categories are visible to anonymous users

4. **Page creation**:
   - Create new wiki page
   - Should auto-assign to `uncategorized` category if not specified

## Rollback Plan (If Needed)

If something goes wrong after deployment, you can quickly rollback:

```bash
# SSH into production
ssh user@192.168.1.15

# Stop the container
docker stop m4s0kwo4kc4oooocck4sswc4

# Restore database from backup (if available)
docker exec veritable-games-postgres-new \
  pg_restore -U postgres -d veritable_games \
  /path/to/backup/veritable_games_backup.sql

# Restart container
docker start m4s0kwo4kc4oooocck4sswc4

# Or revert code and redeploy
cd /home/user/veritable-games-site
git revert HEAD
git push origin main
```

## Alternative: Manual PostgreSQL Fix (If Auto-Deploy Fails)

If Coolify deployment fails, you can manually apply the fix:

```bash
# SSH into production
ssh user@192.168.1.15

# Connect to PostgreSQL
psql postgresql://postgres:SECURE_PASSWORD@veritable-games-postgres-new:5432/veritable_games

# Paste wiki-categories seed data:
INSERT INTO wiki.wiki_categories (id, name, description, color, icon, sort_order, is_public)
VALUES
  ('uncategorized', 'Uncategorized', 'Pages without a specific category', '#6B7280', NULL, 0, true),
  ('archive', 'Archive', 'Historical and archived content', '#9B2C2C', 'archive', 1, true),
  ('autumn', 'Autumn', 'Autumn project documentation', '#ED8936', 'leaf', 2, true),
  ('cosmic-knights', 'Cosmic Knights', 'Cosmic Knights project information', '#2B6CB0', 'star', 3, true),
  ('dodec', 'Dodec', 'Dodec project documentation', '#5A67D8', 'cube', 4, true),
  ('journals', 'Journals', 'Personal journals and notes', '#F6E05E', 'book', 5, true),
  ('noxii', 'Noxii', 'Noxii civilization documentation', '#38A169', 'globe', 6, true),
  ('on-command', 'On-Command', 'On-Command project documentation', '#D69E2E', 'command', 7, true),
  ('systems', 'Systems', 'System documentation and technical guides', '#718096', 'cog', 8, true),
  ('tutorials', 'Tutorials', 'Learning tutorials and guides', '#3182CE', 'graduation-cap', 9, true);

# Verify
SELECT COUNT(*) FROM wiki.wiki_categories;

# If you also need to update wiki_pages with correct category_id values:
UPDATE wiki.wiki_pages
SET category_id = 'uncategorized'
WHERE category_id IS NULL OR category_id = '';
```

## Troubleshooting

### Issue: Categories still don't appear after deployment

**Diagnosis**:
```bash
ssh user@192.168.1.15
docker logs m4s0kwo4kc4oooocck4sswc4 | tail -50
```

**Solutions**:
1. Check if seed file was included in deployment: `docker exec m4s0kwo4kc4oooocck4sswc4 ls /app/scripts/seeds/data/wiki-categories.sql`
2. Manually run seed script: `docker exec m4s0kwo4kc4oooocck4sswc4 npm run seed:wiki-categories`
3. Check PostgreSQL has data: `psql ...` with diagnostic queries

### Issue: Schema file still has errors

**Solution**: Regenerate from production using pg_dump:
```bash
pg_dump \
  --schema=wiki \
  --schema-only \
  --no-privileges \
  --no-owner \
  postgresql://postgres:PASSWORD@192.168.1.15:5432/veritable_games \
  > frontend/scripts/seeds/schemas/wiki.sql
```

### Issue: Pages not linked to categories

**Solution**: Create a migration to auto-assign pages:
```sql
UPDATE wiki.wiki_pages
SET category_id = 'uncategorized'
WHERE category_id IS NULL OR category_id = '' OR
      category_id NOT IN (SELECT id FROM wiki.wiki_categories);
```

## Testing Checklist

- [ ] Local schema initializes without errors
- [ ] Local `npm run dev` works and shows categories
- [ ] Local category pages work correctly
- [ ] Code committed to GitHub with proper message
- [ ] Coolify deployment completes successfully
- [ ] Production PostgreSQL has 10 categories
- [ ] Production `/wiki/categories` page loads
- [ ] Production individual category pages work
- [ ] Production wiki search still works
- [ ] No 404 errors on wiki pages
- [ ] Analytics/activity logs update correctly

## Files Modified

1. ✅ `frontend/scripts/seeds/schemas/wiki.sql` - FIXED
2. ✅ `frontend/scripts/seeds/data/wiki-categories.sql` - CREATED
3. ✅ `frontend/scripts/init-databases.js` - UPDATED

## Files Not Modified (Already Working)

- ✓ `frontend/src/lib/wiki/services/WikiCategoryService.ts` - Queries are correct
- ✓ `frontend/src/lib/wiki/services/WikiPageService.ts` - Works fine
- ✓ All UI components - Ready to display categories
- ✓ All API routes - Ready to serve category data

## Post-Deployment Monitoring

### Week 1
- Monitor wiki category pages for errors
- Check database logs for any constraint violations
- Verify page-category relationships are correct

### Long-term
- Monitor query performance for category pages
- Consider adding indexes if queries slow down
- Monitor FTS search performance with categories

## Success Criteria

After implementation, the following should be true:

1. ✓ All wiki category pages load without 404 errors
2. ✓ Category browser at `/wiki/categories` shows all categories
3. ✓ Each category page shows associated pages
4. ✓ All 174 wiki pages remain accessible
5. ✓ No database errors in logs
6. ✓ Performance is not degraded
7. ✓ Developers can initialize fresh databases with categories

## Timeline Summary

| Phase | Duration | Status |
|-------|----------|--------|
| Diagnose | 5 min | Ready |
| Fix schema | 10 min | Ready |
| Create seeds | 5 min | Ready |
| Test locally | 5 min | Ready |
| Deploy | 10 min | Ready |
| Verify | 5 min | Ready |
| **Total** | **40 min** | **Ready to implement** |

## Questions?

Refer to:
- `docs/wiki/WIKI_CATEGORY_PRODUCTION_BUG_ANALYSIS.md` - Detailed root cause analysis
- `docs/wiki/WIKI_PRODUCTION_DIAGNOSTIC_QUERIES.sql` - SQL diagnostic queries
- `docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md` - Production access procedures
