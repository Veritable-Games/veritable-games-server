# Frontend Scripts

Utility scripts for database management, maintenance, and development.

## Directory Structure

```
scripts/
├── maintenance/           # One-off fix scripts (historical)
├── dev-tools/            # Development helper scripts
├── wiki/                 # Wiki-related scripts
├── migrations/           # Database migration scripts
├── testing/              # Testing utilities
└── [root scripts]/       # General utility scripts
```

## Script Categories

### Development Tools (`dev-tools/`)

Helper scripts for development workflow:

- `clear-and-restart.sh` - Clear caches and restart dev server

### Maintenance Scripts (`maintenance/`)

One-off scripts for fixing specific issues:

- `fix-braces.sh` - Fix brace syntax issues
- `fix-final-braces.sh` - Final brace corrections
- `fix-styled-jsx.sh` - Fix styled-jsx issues
- `fix-with-security.sh` - Apply security fixes
- `fix-fts-triggers.js` - Fix full-text search triggers

### Wiki Management (`wiki/`)

Scripts for wiki content management:

- `backfill-search-index.js` - Rebuild wiki search index

### Database Migrations (`migrations/`)

Schema migration scripts:

- `add-forum-tags.sql` - Add forum tagging support
- `lower-node-size-constraints.sql` - Adjust node size limits

### General Utilities (root)

Common database and maintenance scripts:

- `db-maintenance.js` - Database maintenance operations
- `init-forums-db.js` - Initialize forum database
- `backup-all-databases.js` - Backup all databases
- `cache-warmup.js` - Warm up application cache
- And many more...

## Usage

### Running Node Scripts

```bash
cd frontend
node scripts/[script-name].js
```

### Running Shell Scripts

```bash
cd frontend
./scripts/[category]/[script-name].sh
```

### Database Scripts

Most database scripts can be run with:

```bash
cd frontend
node scripts/[script-name].js
```

## Configuration Files (Frontend Root)

These configuration files remain in the frontend root directory as tools expect
them there:

- `next.config.js` - Next.js configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS configuration
- `jest.config.js` - Jest testing configuration
- `jest.setup.js` - Jest setup and mocks
- `prettier.config.js` - Prettier formatting
- `ecosystem.config.js` - PM2 process manager
- `lighthouserc.js` - Lighthouse CI configuration
- `.lint-stagedrc.js` - Lint-staged configuration (if exists)

## Important Notes

1. **Always review scripts before running** - Especially maintenance scripts
2. **Backup databases first** - Use `backup-all-databases.js` before migrations
3. **Check current directory** - Most scripts expect to be run from `frontend/`
4. **Read script comments** - Each script has usage instructions at the top

## Documentation

For more detailed information:

- Development workflow: `/docs/guides/scripts-guide.md`
- Database operations: `/docs/DATABASE.md`
- Production operations: `/docs/operations/PRODUCTION_OPERATIONS.md`

---

**Last Updated:** October 16, 2025 **Script Count:** 80+ scripts across all
categories
