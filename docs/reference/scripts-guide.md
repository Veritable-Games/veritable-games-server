# Scripts & Utilities Reference

**Organization:** `/home/user/veritable-games-migration/frontend/scripts/`

The project contains 80+ utility scripts organized by category for various development, maintenance, and testing tasks.

## Key Script Categories

### Development Tools (`dev-tools/`)
- `clear-and-restart.sh` - Clear caches and restart dev server

### Maintenance (`maintenance/`)
- One-off fix scripts (historical, kept for reference)
- `fix-fts-triggers.js` - Fix full-text search triggers

### Wiki Management (`wiki/`)
- `backfill-search-index.js` - Rebuild wiki search index

### Database Migrations (`migrations/`)
- Schema migration scripts
- `fix-forum-category-sections.sql` - Forum section alignment
- `sync-user-password-hashes.sql` - Auth schema sync
- `cleanup-orphaned-sessions.sql` - Session maintenance

### Testing (`testing/`)
- `health/health-check.js` - System health verification
- `security/test-security.js` - Security validation
- `integration/*` - API integration tests
- `data/wiki/`, `data/library/`, `data/forums/` - Domain validation

### General Utilities (root)
- `backup-all-databases.js` - Backup all databases
- `database-health-check.js` - Database health verification
- `comprehensive-security-audit.js` - Full security scan
- `db-maintenance.js` - Routine database maintenance

## Usage

```bash
cd /home/user/veritable-games-migration/frontend

# Run Node scripts
node scripts/[category]/[script-name].js

# Run shell scripts
./scripts/[category]/[script-name].sh

# Health check before deployment
node scripts/testing/health/health-check.js
```

## Best Practices

**Always backup databases before running migrations:**
```bash
node scripts/backup-all-databases.js
```

**Run health checks after significant changes:**
```bash
node scripts/database-health-check.js
node scripts/testing/health/health-check.js
```

## Complete Documentation

See `scripts/README.md` in the frontend directory for comprehensive documentation of all available scripts.
