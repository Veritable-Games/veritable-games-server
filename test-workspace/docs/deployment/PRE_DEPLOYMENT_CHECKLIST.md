# Pre-Deployment Checklist

**Purpose**: Prevent production incidents by validating schema, migrations, and code before deployment.

**Created**: 2026-02-12 (after journals/categories missing incident)

---

## ⚠️ CRITICAL: Database Schema Changes

If your PR includes database schema changes (new columns, tables, indexes), **you MUST complete this section**.

### 1. Migration File Exists
- [ ] Migration SQL file created in `frontend/scripts/migrations/`
- [ ] Migration numbered correctly (sequential)
- [ ] Migration includes rollback instructions in comments
- [ ] Migration tested locally with SQLite
- [ ] Migration tested locally with PostgreSQL (if possible)

### 2. Schema Validation
Run this command to check for missing columns/tables:

```bash
# From frontend/ - Check local database
npm run db:validate-schema

# Check production database (if you have DATABASE_URL configured for production)
DATABASE_MODE=production npm run db:validate-schema
```

**Expected Output**:
```
✅ Schema validation passed - No issues found
```

**If validation fails**:
- Review which columns/tables are missing
- Check if migrations need to be applied
- Apply missing migrations BEFORE deploying code

### 3. Migration Applied to Production
**BEFORE DEPLOYING CODE**, apply migrations to production:

```bash
# Option A: Using migration script
npm run db:migrate:production

# Option B: Manual SSH
ssh user@192.168.1.15 "docker exec veritable-games-postgres psql -U postgres -d veritable_games < /path/to/migration.sql"
```

**Verification**:
```bash
# Verify columns exist
ssh user@192.168.1.15 "docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \"SELECT column_name FROM information_schema.columns WHERE table_schema = 'wiki' AND table_name = 'wiki_pages';\""
```

---

## 🧪 Testing Requirements

### Code Quality
- [ ] `npm run type-check` passes (0 errors)
- [ ] `npm run format` applied
- [ ] `npm test` passes (all tests green)
- [ ] `npm run build` succeeds

### Manual Testing
- [ ] Feature tested in local development
- [ ] Feature tested with production-like data (if applicable)
- [ ] Error states tested
- [ ] Edge cases considered

---

## 📝 Code Review Checklist

### Query Safety
- [ ] All database queries use parameterized queries (no string concatenation)
- [ ] Queries reference only columns that exist in schema
- [ ] Schema changes match what code expects
- [ ] No SQL injection vulnerabilities

### Error Handling
- [ ] Database errors logged appropriately
- [ ] User-friendly error messages (no stack traces to users)
- [ ] API endpoints return proper HTTP status codes
- [ ] Try-catch blocks around database operations

### Performance
- [ ] Indexes created for new query patterns
- [ ] N+1 query patterns avoided
- [ ] Large data sets paginated
- [ ] No expensive operations in loops

---

## 🚀 Deployment Steps

### 1. Pre-Deployment (YOU ARE HERE)
- [ ] Complete all sections above
- [ ] Migrations applied to production
- [ ] Schema validated against production
- [ ] If modifying middleware/lockdown: Check current production maintenance mode state (`npm run maintenance:check`)

### 2. Deploy Code
```bash
git push origin main
```

### 3. Monitor Deployment
Watch Coolify logs for errors:
```bash
ssh user@192.168.1.15 "docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100 -f"
```

Expected output:
- "Server listening on port 3000"
- No error messages

### 4. Verify Deployment
- [ ] Visit https://www.veritablegames.com
- [ ] Test the new feature
- [ ] Check browser console (F12) for JavaScript errors
- [ ] Verify API responses in Network tab

### 4a. Verify Maintenance Mode (if middleware/lockdown changes)

**⚠️ CRITICAL**: If your deployment includes changes to:
- `middleware.ts`
- `site_settings` table
- Maintenance mode logic
- Authentication/lockdown code

**Run verification immediately**:
```bash
npm run deployment:verify-maintenance
```

**Expected output** (site should be locked):
```
✅ PASS: Site is LOCKED (maintenance mode ON)
Site requires authentication - public cannot access
```

**If verification FAILS** (site is public):
```bash
# IMMEDIATE ACTION: Enable lockdown
npm run maintenance:enable

# Verify change took effect
npm run deployment:verify-maintenance
```

**Incident Reference**: See [docs/incidents/2026-02-18-maintenance-mode-disabled-after-deployment.md](../incidents/2026-02-18-maintenance-mode-disabled-after-deployment.md)

### 5. Rollback Plan (if needed)
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or rollback migration
ssh user@192.168.1.15 "docker exec veritable-games-postgres psql -U postgres -d veritable_games < /path/to/rollback.sql"
```

---

## 📊 Common Issues & Solutions

### Issue: "Column does not exist" Error
**Symptom**: Database query fails with `ERROR: column "xyz" does not exist`

**Solution**:
1. Migration not applied to production
2. Apply migration: `npm run db:migrate:production`
3. Redeploy application

### Issue: Empty Results Despite Data Existing
**Symptom**: Query returns 0 rows but data exists in database

**Solution**:
1. Check for missing columns (same as above)
2. Verify WHERE clause doesn't filter out all rows
3. Check for silent query failures

### Issue: Type Errors After Schema Change
**Symptom**: TypeScript errors about missing properties

**Solution**:
1. Update interfaces in `frontend/src/lib/**/*.ts`
2. Update Zustand stores if state changed
3. Run `npm run type-check` to verify

---

## 📚 Related Documentation

- [Deployment Documentation Index](./DEPLOYMENT_DOCUMENTATION_INDEX.md)
- [Database Migration Guide](../database/MIGRATIONS.md)
- [Common Pitfalls](../COMMON_PITFALLS.md)
- [Incident Reports](../incidents/)

---

## 🔄 Post-Deployment

After successful deployment:
- [ ] Update CHANGELOG.md
- [ ] Close related GitHub issues
- [ ] Notify team in communication channel
- [ ] Monitor error logs for 24 hours
- [ ] Document any issues in incident reports

---

**Last Updated**: 2026-02-12
**Maintained By**: Development Team
