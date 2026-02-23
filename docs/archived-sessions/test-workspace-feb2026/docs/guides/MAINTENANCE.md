# Maintenance & Updates Guide

**Last Updated**: November 8, 2025

Guide for keeping dependencies updated and maintaining the codebase.

## Table of Contents

- [Dependency Updates](#dependency-updates)
- [Recent Updates](#recent-updates)
- [Planned Future Updates](#planned-future-updates)
- [Next.js Updates](#nextjs-updates)
- [TypeScript Updates](#typescript-updates)
- [Database Maintenance](#database-maintenance)
- [Monitoring & Health Checks](#monitoring--health-checks)
- [Performance Maintenance](#performance-maintenance)

---

## Dependency Updates

### Check for Updates

```bash
cd frontend

# Check outdated packages
npm run deps:check

# Security audit
npm run deps:audit

# Combined check
npm run deps:audit  # Runs both audit + outdated check
```

### Update Strategy

**Patch Updates** (✅ Safe - apply immediately):
```bash
npm run deps:update:patch
# Example: 15.5.4 → 15.5.6
```

**Minor Updates** (⚠️ Review - test thoroughly):
```bash
npm run deps:update:minor
# Example: 15.4.x → 15.5.x
# Always check release notes
```

**Major Updates** (🚨 Plan migration - may have breaking changes):
```bash
# DO NOT use automated script
# Manual process required:
# 1. Read migration guide
# 2. Review breaking changes
# 3. Test in development
# 4. Update code as needed
# 5. Update manually: npm install package@16
```

### Update Frequency

| Update Type | Frequency | Priority |
|-------------|-----------|----------|
| Security patches | Immediate | Critical |
| Patch versions | Weekly | High |
| Minor versions | Monthly | Medium |
| Major versions | Quarterly | Low (plan carefully) |

---

## Recent Updates

### November 8, 2025 - Security & Dependency Update

**Security Fixes** (6 vulnerabilities → 0):
- ✅ Fixed `dompurify` XSS vulnerability (GHSA-vhxf-7vqr-mrjg) in monaco-editor via npm override
- ✅ Replaced deprecated `axe-cli@3.2.1` with modern `@axe-core/cli@4.11.0` (eliminated tmp/xml2js vulnerabilities)

**Package Updates**:
- `@axe-core/cli`: 3.2.1 → 4.11.0 (modern accessibility testing tool)
- `@types/node`: 24.3.1 → 24.10.0
- `@types/three`: 0.180.0 → 0.181.0
- `prettier`: 3.4.2 → 3.6.2
- `lucide-react`: 0.544.0 → 0.553.0

**Configuration Changes**:
```json
"overrides": {
  "monaco-editor": {
    "dompurify": "^3.2.4"
  }
}
```

**Verification**:
- ✅ TypeScript type-check: 0 errors
- ✅ npm audit: 0 vulnerabilities
- ✅ Code formatted with new prettier

---

## Planned Future Updates

These major version updates are available but require careful planning and testing before implementation:

### High Priority (Security/Stability)

None currently - all security vulnerabilities resolved.

### Medium Priority (Features/Performance)

**better-sqlite3**: 9.6.0 → 12.4.1 (3 major versions)
- **Why**: Performance improvements, bug fixes
- **Risk**: Major version jump - may have API changes
- **Testing Required**:
  - [ ] Verify all database operations still work
  - [ ] Test connection pooling with new version
  - [ ] Check for breaking changes in release notes (v10, v11, v12)
  - [ ] Run full test suite
  - [ ] Test production migration path
- **Migration Guide**: Check GitHub releases for breaking changes

**Jest**: 29.7.0 → 30.2.0 (1 major version)
- **Why**: Latest features, better TypeScript support
- **Risk**: May require test configuration updates
- **Testing Required**:
  - [ ] Review Jest 30 migration guide
  - [ ] Update test configurations if needed
  - [ ] Run full test suite
  - [ ] Verify coverage reports still work
- **Migration Guide**: https://jestjs.io/docs/upgrading-to-jest30

**concurrently**: 8.2.2 → 9.2.1 (1 major version)
- **Why**: Dev tool - low risk update
- **Risk**: Low - only affects local development
- **Testing Required**:
  - [ ] Verify npm scripts still work
  - [ ] Test dev server startup

### Lower Priority (Optional Enhancements)

**Next.js**: 15.5.6 → 16.0.1 (1 major version)
- **Why**: Latest features, performance improvements
- **Risk**: HIGH - Major framework version, may have breaking changes
- **⚠️ WARNING**: Do not update without thorough planning
- **Testing Required**:
  - [ ] Read Next.js 16 migration guide thoroughly
  - [ ] Review all breaking changes
  - [ ] Create dedicated migration branch
  - [ ] Test all API routes
  - [ ] Test all pages and components
  - [ ] Verify build process
  - [ ] Run E2E test suite
  - [ ] Test production deployment
- **Migration Guide**: https://nextjs.org/docs/app/building-your-application/upgrading
- **Estimated Effort**: 1-2 weeks of development + testing

**Other Dependencies**:
- `lint-staged`: 15.5.2 → 16.2.6
- `lru-cache`: 10.4.3 → 11.2.2
- `marked`: 15.0.12 → 17.0.0
- `node-fetch`: 2.7.0 → 3.3.2
- `react-window`: 1.8.11 → 2.2.3

### Update Strategy Recommendation

**Quarterly Update Plan**:
1. **Q1 2026**: Update testing tools (Jest, concurrently)
2. **Q2 2026**: Update database layer (better-sqlite3) with thorough testing
3. **Q3 2026**: Update utility libraries (marked, lru-cache, etc.)
4. **Q4 2026**: Consider Next.js 16 migration if stable

**Before Any Major Update**:
1. Check if there are compelling features/fixes needed
2. Review all breaking changes in release notes
3. Create backup of databases
4. Create feature branch for update
5. Test thoroughly in development
6. Monitor for community issues/bugs in new versions

---

## Next.js Updates

### Check Current Version

```bash
cd frontend

# Check installed version
npm list next

# Check latest version
npm view next version

# Check latest in current major version
npm view next@15 version
```

### Turbopack Warning

If Turbopack shows "Next.js outdated" warning during development:

```bash
cd frontend

# Update to latest patch version
npm install next@latest

# Clear build cache
rm -rf .next

# Restart server
cd ..
./start-veritable-games.sh restart
```

### Update Process

**Patch Updates** (15.5.4 → 15.5.6):

```bash
cd frontend
npm install next@15.5.6
rm -rf .next
npm run type-check  # Verify no TypeScript errors
npm run build      # Test build
cd ..
./start-veritable-games.sh restart
```

**Minor Updates** (15.4.x → 15.5.x):

```bash
cd frontend

# 1. Check release notes
open https://github.com/vercel/next.js/releases

# 2. Update package
npm install next@15.5.0

# 3. Clear caches
rm -rf .next node_modules/.cache

# 4. Full test suite
npm run type-check
npm run build
npm test
npm run test:e2e

# 5. Manual testing
npm run dev
# Test all major features

# 6. Restart
cd ..
./start-veritable-games.sh restart
```

**Major Updates** (15.x → 16.x):

```bash
# 🚨 STOP - Do not proceed without reading migration guide

# 1. Read official migration guide
open https://nextjs.org/docs/app/building-your-application/upgrading

# 2. Review breaking changes
# - API route changes
# - Middleware changes
# - Build system changes
# - React version requirements

# 3. Create migration branch
git checkout -b upgrade/nextjs-16

# 4. Update incrementally
# - Update Next.js
# - Fix TypeScript errors
# - Update deprecated APIs
# - Test thoroughly

# 5. Full regression testing
# - All features
# - All pages
# - All API endpoints
# - E2E test suite
```

### Last Update

**November 8, 2025**: Security update (see [Recent Updates](#recent-updates))
**October 28, 2025**: Updated Next.js from 15.5.4 → 15.5.6

---

## TypeScript Updates

### Check Version

```bash
cd frontend
npm list typescript
npm view typescript version
```

### Update Process

```bash
cd frontend

# Patch/minor updates (usually safe)
npm install typescript@latest

# Run type-check to verify
npm run type-check

# If errors appear, fix them before committing
```

### Type-Check Before Commit

**CRITICAL**: Always run before committing

```bash
cd frontend
npm run type-check
# MUST show: "Found 0 errors"

# If errors found, fix them immediately
# See TYPESCRIPT_ERROR_REMEDIATION.md for patterns
```

---

## Database Maintenance

### Daily Health Checks

```bash
cd frontend
npm run db:health
```

**Checks**:
- All 10 databases exist
- Tables initialized properly
- FTS5 indexes active
- No corruption detected

### Weekly Backups

```bash
cd frontend
npm run db:backup
```

**Backup Location**: `frontend/data/backups/`
**Retention**: Keep last 7 days minimum

### Monthly Tasks

1. **Gallery Cleanup** (soft-deleted images > 30 days):
   ```bash
   npm run gallery:cleanup:dry-run  # Preview
   npm run gallery:cleanup          # Execute
   ```

2. **Gallery Audit** (integrity check):
   ```bash
   npm run gallery:audit
   ```

3. **Invitation Cleanup** (expired invitations):
   ```bash
   npm run invitations:cleanup:dry-run  # Preview
   npm run invitations:cleanup          # Execute
   ```

### Workspace Tables

If workspace features fail:

```bash
cd frontend
npm run workspace:check    # Verify tables exist
npm run workspace:init     # Initialize if missing
```

### Wiki Search Reindex

If wiki search performance degrades:

```bash
cd frontend
npm run wiki:reindex
```

📝 **See**: [docs/DATABASE.md](../DATABASE.md) for complete database operations

---

## Monitoring & Health Checks

### System Health

```bash
cd frontend

# Database health
npm run db:health

# Auth synchronization
npm run debug:auth:sync

# Library health
npm run debug:library:health

# Gallery schema
npm run debug:gallery:schema

# API endpoints
npm run debug:api:json-errors
```

### Performance Monitoring

```bash
cd frontend

# Full performance report
npm run perf:report

# Lighthouse audit
npm run performance:lighthouse

# Start monitoring
npm run performance:monitor
```

### Logs

**Background Server Logs**:
```bash
# From root directory
./start-veritable-games.sh logs
```

**Manual Log Locations**:
- Server logs: `logs/server.log`
- Error logs: Check terminal output when running `npm run dev`

---

## Performance Maintenance

### Build Performance

Track build times over time:

```bash
cd frontend

# Time the build
time npm run build

# Expected times:
# - Turbopack: ~30-40 seconds
# - Webpack: ~60-90 seconds
```

**If build times increase significantly**:
1. Clear caches: `rm -rf .next node_modules/.cache`
2. Check for circular dependencies
3. Review recently added heavy dependencies

### Bundle Size

```bash
cd frontend

# Analyze bundle
npm run analyze

# Check for:
# - Unexpectedly large chunks
# - Duplicate dependencies
# - Unused imports
```

### Image Optimization

```bash
cd frontend

# Optimize images
npm run optimize:images

# Validate optimization
npm run validate:images
```

---

## Troubleshooting Maintenance Issues

### Dependencies Won't Update

```bash
cd frontend

# Clear everything and reinstall
npm run dev:reset

# Or manual process:
rm -rf node_modules package-lock.json
npm install
```

### Type-Check Failing After Update

```bash
cd frontend

# Check TypeScript version compatibility
npm list typescript
npm list next

# Verify versions are compatible
# See Next.js docs for required TypeScript version
```

### Build Failing After Update

```bash
cd frontend

# Clear all caches
rm -rf .next node_modules/.cache

# Reinstall dependencies
npm install

# Rebuild
npm run build

# If still failing, check for:
# - Breaking changes in release notes
# - Deprecated APIs
# - Required config changes
```

### Database Issues After Maintenance

```bash
cd frontend

# Restore from backup
npm run db:restore

# Or reinitialize
npm run db:init

# Check health
npm run db:health
```

---

## Update Checklist Template

Use this checklist for any significant update:

### Pre-Update
- [ ] Review release notes / changelog
- [ ] Check for breaking changes
- [ ] Run full test suite (`npm test`)
- [ ] Backup databases (`npm run db:backup`)
- [ ] Create git branch (`git checkout -b update/package-name`)

### Update
- [ ] Update package(s)
- [ ] Clear caches (`rm -rf .next node_modules/.cache`)
- [ ] Run type-check (`npm run type-check`)
- [ ] Run tests (`npm test`)
- [ ] Test build (`npm run build`)
- [ ] Manual testing (all major features)

### Post-Update
- [ ] Update documentation if needed
- [ ] Commit changes with descriptive message
- [ ] Create pull request for review
- [ ] Monitor for issues after deployment

---

## Maintenance Schedule

### Daily
- [ ] Check server logs for errors
- [ ] Monitor application health

### Weekly
- [ ] Security updates (if any)
- [ ] Database backup
- [ ] Check for outdated dependencies

### Monthly
- [ ] Update patch versions
- [ ] Gallery cleanup
- [ ] Invitation cleanup
- [ ] Performance audit
- [ ] Dependency audit

### Quarterly
- [ ] Consider minor version updates
- [ ] Review and update dependencies
- [ ] Database optimization
- [ ] Full performance analysis

### Annually
- [ ] Consider major version updates
- [ ] Full security audit
- [ ] Architecture review
- [ ] Documentation review

---

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Main development guide
- [docs/guides/COMMANDS_REFERENCE.md](./COMMANDS_REFERENCE.md) - All available commands
- [docs/DATABASE.md](../DATABASE.md) - Database operations
- [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - Common issues
- [README.md](../../README.md) - Tech stack versions

---

**Last Updated**: November 8, 2025
