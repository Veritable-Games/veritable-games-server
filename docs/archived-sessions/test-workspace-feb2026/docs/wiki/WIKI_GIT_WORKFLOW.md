📍 **Navigation**: [CLAUDE.md](../../CLAUDE.md) > [docs/](../README.md) > [wiki/README.md](./README.md) > Wiki Git Workflow

---

# Wiki Git Workflow

**Last Updated**: November 9, 2025
**Status**: Phase 3 Complete - 174 wiki pages exported to markdown
**Database**: PostgreSQL 15 (production) | SQLite (localhost development)

## Overview

The wiki uses a **bidirectional git-based workflow** where markdown files serve as the source of truth and PostgreSQL (production) or SQLite (development) acts as a queryable cache. This enables version control, collaboration, and easy migration between environments.

**Key Principle**: Markdown files are the source of truth. PostgreSQL/SQLite is a queryable cache that stays in sync via import/export scripts.

---

## How It Works

### Markdown Files (Source of Truth)

**Location**: `frontend/content/wiki/{category}/{slug}.md`

**File Structure**:
```
frontend/content/wiki/
├── archive/
├── autumn/
├── cosmic-knights/
├── dodec/
├── journals/
├── noxii/
├── on-command/
├── systems/
└── tutorials/
```

**File Format**:
```markdown
---
title: Page Title
slug: page-slug
namespace: main
category: noxii
tags: [tag1, tag2]
created_at: 2025-11-09T12:00:00Z
updated_at: 2025-11-09T12:30:00Z
---

# Page Content

Markdown content here with full formatting support...

## Sections

- Lists
- **Bold** and *italic*
- Code blocks
- Tables
- Links
```

**Advantages**:
- Version controlled in git with full edit history
- Can be edited locally or on production
- Portable (easy to migrate or backup)
- Human-readable
- Diffable (git diff shows changes)

---

### PostgreSQL/SQLite Database (Queryable Cache)

**Purpose**:
- Fast queries for web UI
- Full-text search (FTS5)
- Revision history tracking
- Analytics and statistics
- User activity logging

**Tables**:
- `wiki_pages` - Page metadata (slug, title, namespace, category_id)
- `wiki_revisions` - Complete revision history
- `wiki_search` - FTS5 full-text search index
- `wiki_page_views` - Analytics data
- Additional tables for tags, categories, links

**Current Status**:
- **Production**: PostgreSQL with 174 wiki pages
- **Development**: SQLite with same schema
- **Sync Mechanism**: Export/import scripts

---

## Sync Mechanism

### Export (Database → Markdown)

**Command**: `npm run wiki:export`

**What it does**:
1. Queries PostgreSQL/SQLite for all published wiki pages
2. Extracts latest revision content for each page
3. Writes markdown files to `frontend/content/wiki/{category}/{slug}.md`
4. Preserves frontmatter (title, slug, namespace, category, tags, timestamps)
5. Overwrites existing files (markdown is updated to match database)

**When to use**:
- After editing pages via web UI
- Before committing changes to git
- When syncing database state to markdown

**Example**:
```bash
cd frontend
npm run wiki:export

# Output:
# ✓ Exported 174 wiki pages to markdown files
# ✓ Categories: archive, autumn, cosmic-knights, dodec, journals, noxii, on-command, systems, tutorials
```

---

### Import (Markdown → Database)

**Command**: `npm run wiki:import`

**What it does**:
1. Scans `frontend/content/wiki/` for all markdown files
2. Parses frontmatter and content
3. Creates or updates pages in PostgreSQL/SQLite
4. Creates new revisions if content changed
5. Updates categories and tags
6. Rebuilds FTS5 search index

**When to use**:
- After pulling markdown changes from git
- When initializing a new database
- After manually editing markdown files

**Example**:
```bash
cd frontend
npm run wiki:import

# Output:
# ✓ Imported 174 wiki pages from markdown files
# ✓ Created 0 new pages
# ✓ Updated 174 existing pages
# ✓ Search index rebuilt
```

---

### Reindex (Rebuild Search)

**Command**: `npm run wiki:reindex`

**What it does**:
1. Rebuilds FTS5 full-text search index
2. Updates all search triggers
3. Verifies index integrity

**When to use**:
- After bulk imports
- If search results seem incorrect
- After database schema changes

**Example**:
```bash
cd frontend
npm run wiki:reindex

# Output:
# ✓ FTS5 search index rebuilt
# ✓ Indexed 174 pages
```

---

### Historical Revisions Import

**Command**: `node scripts/wiki/import-historical-revisions.js`

**What it does**:
1. Imports 770+ historical revisions from `~/Documents/Documents/docs/archive/versions/`
2. Preserves all revision metadata (author, timestamp, summary, is_minor flag)
3. Skips revisions that already exist (by page_id + timestamp)
4. **Auto-creates archive pages** for unmatched slugs (pages that don't exist in production)
5. Maps old slugs to new slugs via SLUG_MAPPING configuration

**Archive Page Behavior**:
- If a page slug doesn't exist in the database, the script automatically creates it
- New pages are created in the **Archive** category
- All historical revisions for that page are then imported
- This ensures no historical data is lost during import

**Usage**:
```bash
cd frontend

# Preview what would be imported (safe, no changes)
node scripts/wiki/import-historical-revisions.js --dry-run

# Import all historical revisions
node scripts/wiki/import-historical-revisions.js --execute

# Import specific page only
node scripts/wiki/import-historical-revisions.js --slug=engineering-caste --dry-run
node scripts/wiki/import-historical-revisions.js --slug=engineering-caste --execute
```

**Example Output**:
```
Found 123 pages with version history

📄 planet-chione → Chione (Super Earth)
   Found 6 historical revisions
   ⏭️  2025-08-15 - already exists
   ✅ 2025-08-15 04:26:50 - Initial creation

📦 No match for slug: deleted-page - creating archive page
   ✨ Created archive page: "Deleted Page"
   ✅ 2025-08-20 10:00:00 - Historical revision 1
   ✅ 2025-08-21 15:30:00 - Historical revision 2

Pages processed:      123
Pages matched:        122
Pages unmatched:      1
Pages archived:       1
Revisions imported:   300
```

**When to use**:
- One-time import of historical wiki revisions from archive
- Restoring deleted pages to Archive category
- Migrating legacy wiki data

**Important Notes**:
- This is a **one-time operation** for bulk historical data import
- Different from `wiki:import` which syncs current state from markdown
- Uses dry-run mode by default for safety
- Archived pages won't appear in search results (Archive category is hidden)

---

## Workflow Scenarios

### Scenario 1: Edit Locally, Push to Production

**Use Case**: You're working on localhost and want to deploy changes to production.

**Steps**:

```bash
# 1. Edit wiki pages via web UI at localhost:3000/wiki
# Or edit markdown files directly in frontend/content/wiki/

# 2. Export latest database state to markdown
cd frontend
npm run wiki:export

# 3. Verify changes with git diff
git diff frontend/content/wiki/

# 4. Commit and push
git add frontend/content/wiki/
git commit -m "docs: Update wiki pages"
git push origin main

# 5. On production server (192.168.1.15)
ssh user@192.168.1.15
cd /path/to/veritable-games-main
git pull origin main

# 6. Import markdown to production database
cd frontend
npm run wiki:import

# 7. Verify on production
# Visit https://www.veritablegames.com/wiki
```

**Important**:
- Always export before committing
- Markdown is source of truth after commit
- Import on production syncs database

---

### Scenario 2: Edit on Production, Pull to Localhost

**Use Case**: You made quick edits on production and want to sync to localhost.

**Steps**:

```bash
# 1. On production server (192.168.1.15)
ssh user@192.168.1.15
cd /path/to/veritable-games-main

# 2. Export production database to markdown
cd frontend
npm run wiki:export

# 3. Commit and push
git add frontend/content/wiki/
git commit -m "docs: Update wiki from production"
git push origin main

# 4. On localhost
cd /home/user/Projects/veritable-games-main
git pull origin main

# 5. Import markdown to localhost database (optional)
cd frontend
npm run wiki:import

# 6. Verify on localhost
# Visit http://localhost:3000/wiki
```

**Important**:
- Export on production captures database state
- Git pull syncs markdown to localhost
- Import on localhost updates local database (optional if just reading)

---

### Scenario 3: Merge Changes from Both Environments

**Use Case**: You edited pages on both localhost and production. Need to merge.

**Steps**:

```bash
# 1. Export on BOTH environments
# On production:
ssh user@192.168.1.15
cd /path/to/veritable-games-main/frontend
npm run wiki:export
git add frontend/content/wiki/
git commit -m "docs: Production wiki updates"
git push origin main

# On localhost:
cd /home/user/Projects/veritable-games-main/frontend
npm run wiki:export
git add frontend/content/wiki/
git commit -m "docs: Local wiki updates"

# 2. Pull and merge (standard git workflow)
git pull origin main

# If conflicts:
# - Resolve conflicts in markdown files
# - Markdown files are human-readable, so conflicts are easy to resolve
# - Choose which version to keep or merge manually

# 3. After resolving conflicts
git add frontend/content/wiki/
git commit -m "docs: Merge wiki changes from production"
git push origin main

# 4. Import merged markdown to database
npm run wiki:import

# 5. On production, pull and import
ssh user@192.168.1.15
cd /path/to/veritable-games-main
git pull origin main
cd frontend
npm run wiki:import
```

**Important**:
- Git handles merge conflicts in markdown files
- Markdown format makes conflicts easy to resolve
- After merge, import on both environments

---

## Important Notes

### Always Export Before Committing

**Why**: Database changes are temporary until exported to markdown and committed.

**Workflow**:
```bash
# WRONG: Commit without exporting
git add frontend/src/  # Code changes
git commit -m "feat: Add new feature"
git push
# ⚠️ Database changes lost!

# CORRECT: Export before committing
npm run wiki:export
git add frontend/content/wiki/
git add frontend/src/  # Code changes
git commit -m "feat: Add new feature + update wiki"
git push
# ✓ Database changes preserved in markdown
```

---

### Markdown is Source of Truth

**After committing**: Markdown files in git are the authoritative source.

**Implications**:
- Database can be rebuilt from markdown files
- Always import after pulling markdown changes
- Database is a cache, not the source

**Example**: Fresh database setup
```bash
# Clone repository
git clone https://github.com/user/veritable-games-main.git
cd veritable-games-main/frontend

# Database is empty
# Import markdown to populate
npm run wiki:import

# ✓ Database now has all 174 wiki pages
```

---

### Full Revision History in PostgreSQL

**PostgreSQL maintains all revision history**:
- Markdown captures current state only
- Full revision history in `wiki_revisions` table
- Restore functionality uses database revisions

**Accessing History**:
- Web UI: `/wiki/[slug]/history`
- API: `GET /api/wiki/pages/[slug]/revisions`

**Important**: Exporting to markdown loses revision history (only latest version exported).

---

### No Manual Sync Needed

**Automatic Sync**:
- FTS5 search index updates via database triggers
- Category changes sync automatically
- Tag updates sync automatically

**No manual intervention** required between database tables.

**Manual sync only for**: Database ↔ Markdown files (via export/import).

---

### Schema Compatibility

**Export/import scripts handle**:
- Localhost (SQLite) ↔ Production (PostgreSQL) differences
- Schema version compatibility
- Missing columns (graceful degradation)
- Data type conversions

**No manual schema mapping** required.

---

## Quick Reference

### Common Commands

```bash
# Export database to markdown
npm run wiki:export

# Import markdown to database
npm run wiki:import

# Rebuild search index
npm run wiki:reindex

# Full workflow: Edit → Export → Commit → Push
npm run wiki:export
git add frontend/content/wiki/
git commit -m "docs: Update wiki pages"
git push origin main

# On production: Pull → Import
git pull origin main
npm run wiki:import
```

---

### File Locations

**Markdown Files**: `frontend/content/wiki/{category}/{slug}.md`

**Categories** (9 total):
- archive
- autumn
- cosmic-knights
- dodec
- journals
- noxii
- on-command
- systems
- tutorials

**Database**:
- **Production**: PostgreSQL 15 (via POSTGRES_URL env var)
- **Development**: SQLite at `frontend/data/wiki.db`

**Scripts**:
- Export: `frontend/scripts/wiki/export-to-markdown.js`
- Import: `frontend/scripts/wiki/import-from-markdown.js`
- Reindex: `frontend/scripts/wiki/reindex-search.js`

---

### Troubleshooting

**Import fails with "Page not found"**:
- Verify markdown file exists in correct category folder
- Check frontmatter format (valid YAML)
- Ensure slug and category match filename

**Export creates empty files**:
- Check database has pages (query `wiki_pages` table)
- Verify latest revisions exist (query `wiki_revisions` table)
- Run `npm run db:health` to check database

**Search not working after import**:
- Run `npm run wiki:reindex` to rebuild FTS5 index
- Verify `wiki_search` table has rows

**Merge conflicts in markdown**:
- Open conflicting files in editor
- Resolve manually (markdown is human-readable)
- Keep desired version or merge sections
- Commit resolved files
- Run `npm run wiki:import` on both environments

---

## Best Practices

### 1. Always Export Before Committing
```bash
npm run wiki:export
git add frontend/content/wiki/
git commit -m "docs: Update wiki"
```

### 2. Import After Pulling
```bash
git pull origin main
npm run wiki:import
```

### 3. Commit Frequently
- Small, focused commits
- Clear commit messages
- Export after each editing session

### 4. Test Before Pushing
```bash
npm run wiki:export
npm run wiki:import
# Verify pages load correctly
git push
```

### 5. Backup Before Major Changes
```bash
# Backup markdown files
cp -r frontend/content/wiki/ ~/backup/wiki-$(date +%Y%m%d)/

# Backup database
npm run db:backup
```

---

## Related Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system architecture
- **[SYSTEM_SUMMARY.md](./SYSTEM_SUMMARY.md)** - Quick reference guide
- **[COMMANDS.md](./COMMANDS.md)** - Wiki npm scripts reference
- **[CLAUDE.md](../../CLAUDE.md)** - Wiki Content Versioning section

---

**Workflow Version**: Phase 3 (Git-Based Versioning)
**Total Pages**: 174 exported markdown files
**Last Export**: November 9, 2025
