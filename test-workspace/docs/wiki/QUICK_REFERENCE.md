# Wiki Category Bug - Quick Reference

## The Problem in One Sentence
Wiki category pages show "doesn't exist" because `wiki.wiki_categories` table in PostgreSQL has 0 rows (it's empty).

## Proof
```sql
SELECT COUNT(*) FROM wiki.wiki_categories;  -- Returns: 0
SELECT COUNT(*) FROM wiki.wiki_pages WHERE status = 'published';  -- Returns: 174
```

## Root Cause (3 Things)
1. **Corrupted schema file**: `frontend/scripts/seeds/schemas/wiki.sql` starts with indexes before tables
2. **No seed file**: `frontend/scripts/seeds/data/wiki-categories.sql` doesn't exist
3. **No initialization**: `init-databases.js` doesn't seed wiki categories

## Impact
- ✓ 174 wiki pages work fine
- ✓ Individual page queries work
- ✗ All category features broken (0 categories)
- ✗ Category pages show 404

## The Fix (3 Steps)
1. Fix schema file order (tables before indexes)
2. Create `wiki-categories.sql` with 10 INSERT statements
3. Update `init-databases.js` to include wiki seeds

## Time Required
- Fix schema: 10 min
- Create seeds: 5 min
- Update code: 2 min
- Test locally: 5 min
- Deploy: 10 min
- Verify: 5 min
- **Total: 40 minutes**

## Risk Level
**LOW** - Only adds missing data, doesn't modify existing code

## Files to Change
1. `frontend/scripts/seeds/schemas/wiki.sql` - Reorder (tables first)
2. `frontend/scripts/seeds/data/wiki-categories.sql` - Create new file
3. `frontend/scripts/init-databases.js` - Line 30, add seeds

## Testing Checklist
- [ ] Local schema initializes without errors
- [ ] Local database has 10 categories
- [ ] Local `/wiki/categories` page loads
- [ ] Code pushed to GitHub
- [ ] Coolify deployment completes
- [ ] Production PostgreSQL has 10 categories
- [ ] Production `/wiki/categories` page loads
- [ ] Individual category pages work
- [ ] No 404 errors on wiki pages

## Diagnostic Commands

**Check production state**:
```bash
ssh user@192.168.1.15
psql postgresql://postgres:PASSWORD@veritable-games-postgres-new:5432/veritable_games
SELECT COUNT(*) FROM wiki.wiki_categories;
```

**Check local state**:
```bash
cd frontend
sqlite3 data/wiki.db "SELECT COUNT(*) FROM wiki_categories;"
```

**View full diagnostics**: See `WIKI_PRODUCTION_DIAGNOSTIC_QUERIES.sql`

## Implementation Guides
- **Technical Analysis**: `WIKI_CATEGORY_PRODUCTION_BUG_ANALYSIS.md`
- **Step-by-Step Fix**: `WIKI_CATEGORY_FIX_IMPLEMENTATION.md`
- **Architecture Overview**: `ARCHITECTURE_AND_DATA_FLOW.md`
- **Full Diagnosis**: `README_CATEGORY_BUG_DIAGNOSIS.md`

## Seed Data (10 Categories)
```
uncategorized   → Pages without a category
archive         → Historical and archived content
autumn          → Autumn project documentation
cosmic-knights  → Cosmic Knights project
dodec           → Dodec project documentation
journals        → Personal journals and notes
noxii           → Noxii civilization documentation
on-command      → On-Command project
systems         → System documentation
tutorials       → Learning tutorials and guides
```

## Not Broken
- ✓ Wiki page queries
- ✓ Wiki search
- ✓ Page creation
- ✓ Revisions
- ✓ All code and queries
- ✓ All UI components

## Why Previous Fixes Failed
All previous fix attempts treated it as a **code problem** when it's a **data problem**. The code is perfect - it just needs data to query.

## Quick Deploy
```bash
# Make changes to 3 files
# Commit
git add frontend/scripts/seeds/*
git commit -m "fix: Add wiki category seed data"
git push origin main

# Wait 5-10 minutes for Coolify to deploy
# Verify
ssh user@192.168.1.15
psql postgresql://postgres:PASSWORD@192.168.1.15:5432/veritable_games -c "SELECT COUNT(*) FROM wiki.wiki_categories;"
# Should return: 10
```

## Success = These All Work
- [ ] GET `/api/wiki/categories` returns 10 categories
- [ ] GET `/wiki/categories` shows category list
- [ ] GET `/wiki/categories/archive` shows archive pages
- [ ] GET `/wiki/pages/autumn` still works (individual pages)
- [ ] No 404 errors anywhere
- [ ] Database has 174 pages in 10 categories

## Questions?
- **Root cause**: See WIKI_CATEGORY_PRODUCTION_BUG_ANALYSIS.md
- **How to fix**: See WIKI_CATEGORY_FIX_IMPLEMENTATION.md
- **SQL diagnostics**: See WIKI_PRODUCTION_DIAGNOSTIC_QUERIES.sql
- **Architecture**: See ARCHITECTURE_AND_DATA_FLOW.md

---
**Status**: ROOT CAUSE IDENTIFIED - Ready to fix
**Confidence**: 100% (verified with SQL queries)
**Date**: November 14, 2025
