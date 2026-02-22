# Incident Report: Journals Missing in Production (2026-02-12)

## Summary
All 322 journals disappeared from production after deploying the journals deletion refactor. Users saw "No journals yet" despite journals existing in the database.

## Timeline
- **13:00 UTC** - Deployed journals refactor (commit `8f89035989`)
- **13:15 UTC** - User reported all journals missing
- **13:20 UTC** - Initial misdiagnosis: assumed query logic error
- **13:25 UTC** - Deployed "fix" for admin visibility (commit `a3307af1be`) - **this did not solve the issue**
- **13:30 UTC** - Discovered actual root cause: missing database columns
- **13:32 UTC** - Applied schema migration to production (added is_deleted, deleted_by, deleted_at)
- **13:32 UTC** - Journals restored (322 journals)
- **13:35 UTC** - User reported categories not showing (empty categories invisible)
- **13:36 UTC** - Discovered second missing column: `is_team_category`
- **13:37 UTC** - Deployed code fix to remove is_team_category query (commit `c20353cd0b`)
- **13:40 UTC** - Categories restored (6 categories now visible)

## Root Cause
The journals refactor added code that queries three new columns:
- `is_deleted` (BOOLEAN)
- `deleted_by` (INTEGER)
- `deleted_at` (TIMESTAMP)

**The migration to add these columns was never run in production before deploying the code.**

Query in `frontend/src/app/wiki/category/[id]/page.tsx` (lines 70-72):
```typescript
p.is_deleted,
p.deleted_by,
p.deleted_at,
```

PostgreSQL returned error: `ERROR: column "is_deleted" does not exist`, causing the query to fail and return 0 results.

## Impact
- **Severity**: Critical (P0)
- **Duration**: ~30 minutes
- **Affected Users**: All users (admin and regular)
- **Data Loss**: None (journals were never deleted, just not queryable)

## Resolution
Manually applied schema migration on production database:

```sql
ALTER TABLE wiki.wiki_pages
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_by INTEGER,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
```

All 322 journals immediately became visible again.

### Second Issue: Categories Missing (13:35 UTC)

**Root Cause**: Same pattern - `JournalCategoryService.ts` (line 82) was querying `is_team_category` column that doesn't exist:

```typescript
SELECT id, user_id, name, sort_order, created_at, is_team_category
FROM journal_categories
WHERE user_id = $1 OR is_team_category = TRUE
```

**Resolution**: Removed `is_team_category` from query temporarily (commit `c20353cd0b`). Categories now show correctly but without team category support until column is added.

## What Went Wrong

### 1. Missing Migration Process
- Development database had columns (likely added manually during testing)
- Production database never received the migration
- No automated check to ensure schema parity between dev and prod

### 2. Insufficient Pre-Deployment Validation
- Did not verify migration was applied to production
- Did not test queries against production schema before deployment
- Type-check passed because TypeScript doesn't validate database schema

### 3. Silent Query Failures
- Database error was not surfaced to user
- No error logging caught the schema mismatch
- Query returned empty array instead of throwing error

## Prevention Measures

### Immediate Actions (Required Before Next Deploy)
1. ✅ Create migration script: `frontend/scripts/migrations/016-journal-deletion-tracking.sql`
2. ⬜ Add migration to production deployment checklist
3. ⬜ Document schema differences between dev and production

### Short-Term (This Week)
1. ⬜ Add pre-deployment schema validation script
2. ⬜ Implement database query error logging in production
3. ⬜ Create automated migration runner for production deployments

### Long-Term (This Month)
1. ⬜ Set up automated schema comparison (dev vs prod)
2. ⬜ Add database migration tracking table
3. ⬜ Implement "dry-run" deployment mode for testing against prod schema
4. ⬜ Add alerts for database query failures

## Lessons Learned

### What Worked Well
- Quick identification once actual root cause was found
- Minimal data loss (zero - just visibility issue)
- Fast manual remediation (ALTER TABLE completed in <1 second)

### What Needs Improvement
- **Schema migration discipline**: Always run migrations BEFORE deploying code
- **Pre-deployment validation**: Must verify schema matches expected state
- **Error visibility**: Database errors should be logged and surfaced
- **Testing against production schema**: Need staging environment with prod-like schema

## Action Items

| Task | Owner | Deadline | Status |
|------|-------|----------|--------|
| Create migration script for journal deletion columns | Claude | 2026-02-12 | ✅ Done |
| Document all pending migrations in production | Claude | 2026-02-12 | ⬜ TODO |
| Add pre-deployment migration checklist | Claude | 2026-02-13 | ⬜ TODO |
| Implement schema validation script | Claude | 2026-02-14 | ⬜ TODO |
| Add database query error logging | Claude | 2026-02-15 | ⬜ TODO |

## References
- Commits: `8f89035989` (refactor), `a3307af1be` (incorrect fix)
- Files affected: `frontend/src/app/wiki/category/[id]/page.tsx`
- Production database: `veritable_games` (PostgreSQL)
- Table: `wiki.wiki_pages`

---

**Created**: 2026-02-12
**Last Updated**: 2026-02-12
**Status**: Resolved
