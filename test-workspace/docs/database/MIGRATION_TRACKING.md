# Database Migration Tracking

This document tracks all database migrations and their status across environments.

**Last Updated**: 2026-02-15

---

## Migration Status

| # | Name | Description | Dev | Prod | Date Applied |
|---|------|-------------|-----|------|--------------|
| 001 | initial-schema | Initial database schema | ✅ | ✅ | 2025-12-20 |
| 002 | wiki-namespaces | Add namespaces to wiki | ✅ | ✅ | 2025-12-21 |
| 003 | forums-categories | Forum categories and sections | ✅ | ✅ | 2025-12-22 |
| 004 | user-badges | User badge system | ✅ | ✅ | 2025-12-23 |
| 005 | library-tags | Document tagging system | ✅ | ✅ | 2025-12-24 |
| 006 | journal-categories | Journal organization | ✅ | ✅ | 2025-12-25 |
| 007 | messaging-system | Private messaging | ✅ | ✅ | 2025-12-26 |
| 008 | godot-integration | Godot project tracking | ✅ | ✅ | 2026-01-05 |
| 009 | workspace-canvas | Infinite canvas workspace | ✅ | ✅ | 2026-01-15 |
| 010 | donations-transparency | Donation tracking | ✅ | ✅ | 2026-01-20 |
| 011 | timed-releases | Content scheduling | ✅ | ✅ | 2026-01-25 |
| 012 | x402-protection | Bot protection system | ✅ | ✅ | 2026-01-30 |
| 013 | anarchist-library | Anarchist Library integration | ✅ | ✅ | 2026-02-01 |
| 014 | project-galleries | Project image galleries | ✅ | ✅ | 2026-02-05 |
| 015 | content-tracing | Content dependency tracking | ✅ | ✅ | 2026-02-10 |
| 016 | journal-deletion-tracking | Soft delete for journals | ✅ | ⚠️ Manual | 2026-02-12 |
| 018 | separate-journals-table | Migrate journals to dedicated table | 🔄 | ❌ | 2026-02-15 |
| 020 | add-user-uuid | UUID for permanent user ID | ✅ | ✅ | 2026-02-15 |

**Legend**:
- ✅ Applied
- ❌ Not Applied
- ⚠️ Partially Applied / Manual
- 🔄 In Progress

---

## Migration 016: Journal Deletion Tracking

**Status**: ⚠️ Manually applied in production (emergency fix)

**Issue**: Migration was not applied before code deployment, causing production incident.

**Columns Added**:
- `wiki.wiki_pages.is_deleted` (BOOLEAN DEFAULT FALSE)
- `wiki.wiki_pages.deleted_by` (INTEGER)
- `wiki.wiki_pages.deleted_at` (TIMESTAMP)

**Applied Manually**:
```sql
ALTER TABLE wiki.wiki_pages
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_by INTEGER,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
```

**Missing in Migration File**:
- `is_team_category` column for `journal_categories` table (planned for future migration)

**Related**:
- Incident: [docs/incidents/2026-02-12-journals-missing-columns.md](../incidents/2026-02-12-journals-missing-columns.md)
- Commits: `8f89035989`, `a3307af1be`, `c20353cd0b`

---

## Migration 018: Separate Journals Table

**Status**: 🔄 In Development (code ready, not yet deployed)

**Date**: 2026-02-15

**Purpose**: Migrate journals from `wiki_pages` table to dedicated `journals` table for better separation and performance.

**Related Documentation**: [Journal/Wiki Separation Fix](../architecture/JOURNAL_WIKI_SEPARATION_FIX.md)

**Migration Plan**: [Journal Table Migration Plan](/.claude/plans/serialized-giggling-flamingo.md)

### Schema Changes

**New Table Created**: `wiki.journals`
```sql
CREATE TABLE journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  content TEXT DEFAULT '',
  category_id UUID REFERENCES journal_categories(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by UUID REFERENCES users.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  restored_by UUID REFERENCES users.users(id) ON DELETE SET NULL,
  restored_at TIMESTAMP,
  CONSTRAINT journals_unique_slug UNIQUE (user_id, slug)
);
```

**Indexes Created**:
- `idx_journals_user_id` on `user_id`
- `idx_journals_slug` on `slug`
- `idx_journals_category_id` on `category_id`
- `idx_journals_deleted` on `(is_deleted, user_id)`
- `idx_journals_created_at` on `created_at DESC`
- `idx_wiki_revisions_namespace` on `(namespace, page_id)` in `wiki_revisions`

**Columns Dropped from wiki_pages**:
- `journal_category_id` (moved to journals.category_id)
- `is_deleted` (moved to journals.is_deleted)
- `deleted_by` (moved to journals.deleted_by)
- `deleted_at` (moved to journals.deleted_at)
- `restored_by` (moved to journals.restored_by)
- `restored_at` (moved to journals.restored_at)
- `is_archived` (removed - archive functionality deprecated)
- `archived_by` (removed)
- `archived_at` (removed)

### Data Migration

**Script**: `frontend/scripts/migrations/migrate-journals-to-table.ts`

**Steps**:
1. Create `journals` table with all constraints and indexes
2. Copy all journal data from `wiki_pages` WHERE `namespace='journals'`
3. Preserve latest content from `wiki_revisions`
4. Verify migration count matches
5. Delete journals from `wiki_pages`
6. Drop journal-specific columns from `wiki_pages`

**Revision History**: Kept shared in `wiki_revisions` table (namespace='journals')

**Bookmarks**: Kept shared in `wiki_page_bookmarks` table (no changes)

### Code Changes

**API Routes Updated** (8 files):
- `/api/journals/route.ts` - GET, POST
- `/api/journals/[slug]/route.ts` - GET, PATCH
- `/api/journals/[slug]/move/route.ts` - POST
- `/api/journals/bulk-delete/route.ts` - DELETE
- `/api/journals/restore/route.ts` - POST
- `/api/journals/search/route.ts` - GET

**Services Updated**:
- `JournalCategoryService.ts` - All journal queries updated

**Column Mapping**:
- `wiki_pages.created_by` → `journals.user_id`
- `wiki_pages.journal_category_id` → `journals.category_id`
- `wiki_pages.namespace` → removed (no longer needed)

### Testing Checklist

**Schema Verification**:
- [ ] `journals` table exists with all columns
- [ ] All indexes created successfully
- [ ] Journal columns dropped from `wiki_pages`
- [ ] `wiki_revisions` still contains journal revisions

**Data Verification**:
- [ ] Journal count matches before/after migration
- [ ] All content preserved in `wiki_revisions`
- [ ] Category assignments preserved
- [ ] Deleted journals flagged correctly
- [ ] No journals remain in `wiki_pages`

**Functionality Testing**:
- [ ] Create new journal → saves to `journals` table
- [ ] Edit journal → content saved to `wiki_revisions`
- [ ] Move journal to category → `category_id` updated
- [ ] Soft delete journal → `is_deleted=true`
- [ ] Restore journal → `is_deleted=false`
- [ ] Hard delete journal → removed from `journals`
- [ ] Search journals → finds results
- [ ] Wiki "Uncategorized" → no journals visible

### Production Deployment Steps

**Pre-Deployment**:
1. ✅ Create migration files (018-separate-journals-table.sql, migrate-journals-to-table.ts)
2. ✅ Update all API routes and services
3. ✅ Run type-check (passed)
4. ⏳ Test locally with development database
5. ⏳ Backup production database
6. ⏳ Apply schema migration to production
7. ⏳ Run data migration script
8. ⏳ Verify migration success
9. ⏳ Deploy updated code
10. ⏳ Run post-deployment tests

**Commands**:
```bash
# 1. Backup production database
ssh user@10.100.0.1 "docker exec postgres pg_dump -U postgres veritable_games > /backups/pre-journal-migration-$(date +%Y%m%d).sql"

# 2. Apply schema migration
DATABASE_URL="postgresql://postgres:postgres@10.100.0.1:5432/veritable_games" \
DATABASE_MODE=production \
npm run db:migrate:production

# 3. Run data migration
DATABASE_URL="postgresql://postgres:postgres@10.100.0.1:5432/veritable_games" \
DATABASE_MODE=production \
npx tsx scripts/migrations/migrate-journals-to-table.ts

# 4. Verify migration
DATABASE_URL="postgresql://postgres:postgres@10.100.0.1:5432/veritable_games" \
psql -c "SELECT COUNT(*) FROM journals" -c "SELECT COUNT(*) FROM wiki_pages WHERE namespace='journals'"

# 5. Deploy code
git push origin main  # Coolify auto-deploys
```

### Rollback Plan

**If Migration Fails**:
```bash
# 1. Restore from backup
ssh user@10.100.0.1 "docker exec -i postgres psql -U postgres veritable_games < /backups/pre-journal-migration-YYYYMMDD.sql"

# 2. Drop journals table (if partially created)
psql -c "DROP TABLE IF EXISTS journals CASCADE;"

# 3. Verify wiki_pages restored
psql -c "SELECT COUNT(*) FROM wiki_pages WHERE namespace='journals';"

# 4. Revert code deployment
git revert <migration-commit-hash>
git push origin main
```

### Success Criteria

Migration is considered successful when:
- ✅ All journals copied to `journals` table
- ✅ Revision history preserved in `wiki_revisions`
- ✅ Zero journals remain in `wiki_pages`
- ✅ All API endpoints working
- ✅ Type-check passing
- ✅ Production deployment successful
- ✅ Wiki "Uncategorized" shows zero journals
- ✅ Journal create/edit/delete/restore all functional

### Benefits

**Performance**:
- Smaller `wiki_pages` table (fewer rows to scan)
- Dedicated indexes for journal queries
- No namespace filtering overhead

**Clarity**:
- Clear separation between journals and wiki
- No risk of journal/wiki contamination
- Simpler query logic (no namespace checks)

**Maintenance**:
- Easier to add journal-specific features
- Independent schema evolution
- Reduced complexity in wiki services

---

## Pending Migrations (Not Yet Created)

### Migration 017: Team Categories (Planned)
**Purpose**: Add team-shared journal categories support

**Columns to Add**:
- `journal_categories.is_team_category` (BOOLEAN DEFAULT FALSE)
- `journal_categories.team_id` (TEXT, nullable)
- `journal_categories.shared_with` (JSONB, nullable)

**Status**: Not yet needed (code temporarily works without this column)

---

## How to Apply Migrations

### Development (SQLite)
```bash
cd frontend
npm run db:migrate
```

### Production (PostgreSQL)
```bash
# Option 1: Using npm script (preferred)
npm run db:migrate:production

# Option 2: Manual SSH
ssh user@192.168.1.15 "docker exec veritable-games-postgres psql -U postgres -d veritable_games -f /path/to/migration.sql"

# Option 3: Direct psql
PGPASSWORD=postgres psql -h 192.168.1.15 -U postgres -d veritable_games -f scripts/migrations/016-journal-deletion-tracking.sql
```

### Verification
```bash
# Check if column exists
ssh user@192.168.1.15 "docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'wiki' AND table_name = 'wiki_pages' AND column_name = 'is_deleted';\""
```

---

## Migration Best Practices

1. **Always Create Migration File First**
   - Never deploy code that references new columns without migration
   - Migration file must exist in `frontend/scripts/migrations/`

2. **Test Locally First**
   - Run migration on local SQLite database
   - Test with PostgreSQL if possible
   - Verify application works after migration

3. **Apply to Production BEFORE Code Deploy**
   - Migrations must run before code that uses them
   - Verify migration succeeded before pushing code
   - Use `IF NOT EXISTS` / `IF EXISTS` for idempotency

4. **Document Everything**
   - Update this tracking document
   - Add comments to migration file
   - Reference in commit message

5. **Have Rollback Plan**
   - Include rollback SQL in migration comments
   - Test rollback locally
   - Know how to revert code if needed

---

## Schema Validation Script

**✅ IMPLEMENTED**: Automated script validates production schema matches code expectations.

```bash
# From frontend/
npm run db:validate-schema                # Check local database
DATABASE_MODE=production npm run db:validate-schema  # Check production

# Script checks:
# - Critical tables exist
# - Required columns exist with correct types
# - Detects schema drift between code and database
```

**Location**: `frontend/scripts/database/validate-schema.ts`

**When to Use**:
- Before every deployment (part of Pre-Deployment Checklist)
- After applying migrations
- When debugging "column does not exist" errors
- When setting up new environments

---

## Common Migration Patterns

### Adding a Column
```sql
ALTER TABLE schema.table_name
ADD COLUMN IF NOT EXISTS column_name TYPE DEFAULT value;

-- Create index if needed for queries
CREATE INDEX IF NOT EXISTS idx_table_column
ON schema.table_name(column_name);
```

### Adding a Table
```sql
CREATE TABLE IF NOT EXISTS schema.table_name (
    id SERIAL PRIMARY KEY,
    -- columns
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_table_lookup
ON schema.table_name(lookup_column);
```

### Modifying a Column (Careful!)
```sql
-- This can be dangerous in production with data
-- Always backup first!

-- Change type (if compatible)
ALTER TABLE schema.table_name
ALTER COLUMN column_name TYPE new_type USING column_name::new_type;

-- Add NOT NULL constraint (ensure no nulls exist first)
UPDATE schema.table_name SET column_name = default_value WHERE column_name IS NULL;
ALTER TABLE schema.table_name ALTER COLUMN column_name SET NOT NULL;
```

---

## Related Documentation

- [Database README](./README.md) - Schema overview
- [Pre-Deployment Checklist](../deployment/PRE_DEPLOYMENT_CHECKLIST.md)
- [Common Pitfalls](../COMMON_PITFALLS.md)
- [Incident Reports](../incidents/)

---

**Maintained By**: Development Team
**Review Frequency**: After each migration
