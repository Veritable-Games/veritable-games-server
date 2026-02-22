# Wiki Commands Reference

**Last Updated**: November 9, 2025
**Status**: Production-Ready
**Location**: Run from `frontend/` directory

## Overview

The wiki system provides three npm scripts for managing the bidirectional sync between markdown files and the PostgreSQL/SQLite database. These commands enable git-based versioning and collaboration.

---

## Commands

### `npm run wiki:export`

**Purpose**: Export wiki pages from database to markdown files

**What it does**:
1. Connects to PostgreSQL (production) or SQLite (development)
2. Queries all published wiki pages from `wiki_pages` table
3. Retrieves latest revision content from `wiki_revisions` table
4. Writes markdown files to `frontend/content/wiki/{category}/{slug}.md`
5. Includes frontmatter (title, slug, namespace, category, tags, timestamps)
6. Overwrites existing markdown files with current database state

**When to use**:
- After editing pages via web UI
- Before committing changes to git
- Before deploying to production
- When syncing database state to markdown

**Usage**:
```bash
cd frontend
npm run wiki:export
```

**Output**:
```
✓ Connected to database
✓ Found 174 wiki pages
✓ Exported to frontend/content/wiki/
  - archive: 12 pages
  - autumn: 8 pages
  - cosmic-knights: 15 pages
  - dodec: 3 pages
  - journals: 45 pages
  - noxii: 32 pages
  - on-command: 28 pages
  - systems: 18 pages
  - tutorials: 13 pages
✓ Export complete: 174 pages
```

**File Structure Created**:
```
frontend/content/wiki/
├── archive/
│   ├── page-1.md
│   └── page-2.md
├── noxii/
│   ├── status-effects.md
│   └── game-mechanics.md
└── tutorials/
    ├── getting-started.md
    └── advanced-editing.md
```

**Markdown Format**:
```markdown
---
title: Status Effects
slug: status-effects
namespace: main
category: noxii
tags: [game-mechanics, status, combat]
created_at: 2025-11-09T10:00:00Z
updated_at: 2025-11-09T15:30:00Z
---

# Status Effects

Content of the wiki page...
```

**Important Notes**:
- ⚠️ **Overwrites** existing markdown files
- ✅ Only exports published pages (status = 'published')
- ✅ Uses latest revision content
- ✅ Preserves all metadata in frontmatter
- ❌ Does NOT export revision history (only current version)
- ✅ Safe to run multiple times (idempotent)

**Common Workflow**:
```bash
# 1. Edit pages via web UI
# Visit http://localhost:3000/wiki/my-page/edit

# 2. Export to markdown
npm run wiki:export

# 3. Commit to git
git add frontend/content/wiki/
git commit -m "docs: Update wiki pages"
git push
```

---

### `npm run wiki:import`

**Purpose**: Import wiki pages from markdown files to database

**What it does**:
1. Scans `frontend/content/wiki/` for all `.md` files
2. Parses frontmatter (title, slug, category, tags, etc.)
3. Parses markdown content
4. Creates new pages in database if they don't exist
5. Updates existing pages if content or metadata changed
6. Creates new revisions in `wiki_revisions` table
7. Updates `wiki_categories` and `wiki_tags` tables
8. Rebuilds FTS5 search index

**When to use**:
- After pulling markdown changes from git
- When initializing a new database
- After manually editing markdown files
- When migrating from another wiki system

**Usage**:
```bash
cd frontend
npm run wiki:import
```

**Output**:
```
✓ Scanning frontend/content/wiki/
✓ Found 174 markdown files
✓ Parsing frontmatter and content
✓ Importing to database:
  - Created: 0 new pages
  - Updated: 174 existing pages
  - Skipped: 0 pages (no changes)
✓ Updating categories and tags
✓ Rebuilding FTS5 search index
✓ Import complete: 174 pages processed
```

**Important Notes**:
- ✅ **Non-destructive**: Only creates/updates, never deletes
- ✅ Creates new revision if content changed
- ✅ Updates metadata (title, category, tags)
- ✅ Rebuilds search index automatically
- ⚠️ Requires valid frontmatter format
- ✅ Handles missing categories (creates if needed)
- ✅ Safe to run multiple times (idempotent)

**Frontmatter Requirements**:
```yaml
---
title: Required (string)
slug: Required (string, lowercase, hyphens)
namespace: Optional (default: 'main')
category: Optional (default: 'uncategorized')
tags: Optional (array of strings)
created_at: Optional (ISO 8601 timestamp)
updated_at: Optional (ISO 8601 timestamp)
---
```

**Common Workflow**:
```bash
# 1. Pull latest markdown from git
git pull origin main

# 2. Import to database
npm run wiki:import

# 3. Verify pages load correctly
# Visit http://localhost:3000/wiki
```

**Error Handling**:
- Invalid frontmatter → Skips file, logs error
- Missing required fields → Uses defaults
- Invalid category → Creates 'uncategorized'
- Duplicate slug → Updates existing page

---

### `npm run wiki:reindex`

**Purpose**: Rebuild FTS5 full-text search index

**What it does**:
1. Connects to database
2. Deletes all entries from `wiki_search` FTS5 virtual table
3. Rebuilds index from `wiki_pages` and `wiki_revisions` tables
4. Includes title, content, tags, and category in search index
5. Verifies index integrity

**When to use**:
- After bulk imports
- If search results seem incorrect or missing
- After database schema changes
- When troubleshooting search issues
- After manual database modifications

**Usage**:
```bash
cd frontend
npm run wiki:reindex
```

**Output**:
```
✓ Connected to database
✓ Deleting existing FTS5 index
✓ Rebuilding search index:
  - Indexed 174 pages
  - Average index time: 2ms per page
✓ Verifying index integrity
✓ Search index rebuilt successfully
```

**What Gets Indexed**:
- **Title**: Page title (weighted heavily in BM25 ranking)
- **Content**: Full markdown content from latest revision
- **Tags**: All tags associated with page
- **Category**: Category name

**Important Notes**:
- ✅ Safe to run anytime
- ✅ No data loss (only rebuilds index)
- ⚠️ Brief search downtime during rebuild
- ✅ Automatic after `wiki:import`
- ✅ Fast (2-5ms per page)

**Common Workflow**:
```bash
# Search not working correctly?
npm run wiki:reindex

# After bulk database changes
npm run wiki:import
npm run wiki:reindex  # Optional - import does this automatically
```

**FTS5 Index Details**:
- **Algorithm**: BM25 ranking
- **Tokenizer**: Porter stemming
- **Max Results**: 500 per search
- **Query Time**: 5-30ms typical

---

## Script Locations

**Export Script**: `frontend/scripts/wiki/export-to-markdown.js`
**Import Script**: `frontend/scripts/wiki/import-from-markdown.js`
**Reindex Script**: `frontend/scripts/wiki/reindex-search.js`

**Package.json Definitions**:
```json
{
  "scripts": {
    "wiki:export": "node scripts/wiki/export-to-markdown.js",
    "wiki:import": "node scripts/wiki/import-from-markdown.js",
    "wiki:reindex": "node scripts/wiki/reindex-search.js"
  }
}
```

---

## Environment Variables

These scripts respect environment variables for database configuration:

**Production (PostgreSQL)**:
```bash
POSTGRES_URL=postgresql://user:password@192.168.1.15:5432/veritable_games
# or
DATABASE_URL=postgresql://user:password@192.168.1.15:5432/veritable_games
```

**Development (SQLite)**:
```bash
# No env var needed - defaults to:
# frontend/data/wiki.db
```

---

## Examples

### Complete Workflow: Localhost → Production

```bash
# On localhost
cd frontend

# 1. Edit pages via web UI
# Visit http://localhost:3000/wiki/my-page/edit

# 2. Export to markdown
npm run wiki:export

# 3. Review changes
git diff frontend/content/wiki/

# 4. Commit and push
git add frontend/content/wiki/
git commit -m "docs: Update wiki content"
git push origin main

# On production server (192.168.1.15)
ssh user@192.168.1.15
cd /path/to/veritable-games-main

# 5. Pull latest
git pull origin main

# 6. Import to database
cd frontend
npm run wiki:import

# 7. Verify
# Visit https://www.veritablegames.com/wiki
```

---

### Fresh Database Setup

```bash
# Clone repository
git clone https://github.com/user/veritable-games-main.git
cd veritable-games-main/frontend

# Database is empty - populate from markdown
npm run wiki:import

# Verify
npm run db:health

# Output:
# ✓ wiki database: 174 pages
# ✓ FTS5 search index: 174 entries
```

---

### Troubleshooting Search Issues

```bash
# Search not returning results?
cd frontend

# 1. Check database has pages
npm run db:health

# 2. Rebuild search index
npm run wiki:reindex

# 3. Test search
# Visit http://localhost:3000/wiki/search?q=test

# 4. If still issues, re-import
npm run wiki:export  # Capture current state
npm run wiki:import  # Rebuild from markdown
npm run wiki:reindex # Rebuild index
```

---

### Manual Markdown Editing

```bash
# Edit markdown files directly
cd frontend/content/wiki/noxii/
vim status-effects.md

# Update frontmatter and content
# Save file

# Import changes to database
cd ../../  # Back to frontend/
npm run wiki:import

# Verify
# Visit http://localhost:3000/wiki/status-effects
```

---

## Common Issues

### Import Fails: "Invalid frontmatter"

**Cause**: YAML frontmatter is malformed

**Fix**:
```yaml
# ❌ WRONG
---
title: My Page
tags: tag1, tag2  # Invalid - should be array
---

# ✅ CORRECT
---
title: My Page
tags: [tag1, tag2]
---
```

---

### Export Creates Empty Files

**Cause**: Database has no revisions for pages

**Fix**:
```bash
# Check database
npm run db:health

# If revisions missing, pages are corrupt
# Delete and re-import from markdown
npm run wiki:import
```

---

### Search Not Working After Import

**Cause**: FTS5 index not rebuilt

**Fix**:
```bash
npm run wiki:reindex
```

---

### Merge Conflicts in Markdown

**Cause**: Both environments edited same file

**Fix**:
```bash
# Pull changes
git pull origin main

# If conflicts, resolve in editor
vim frontend/content/wiki/category/page.md

# Resolve conflicts (markdown is human-readable)
# Save file

# Commit resolved version
git add frontend/content/wiki/category/page.md
git commit -m "docs: Resolve merge conflict in page.md"

# Import to database
npm run wiki:import
```

---

## Related Documentation

- **[WIKI_GIT_WORKFLOW.md](./WIKI_GIT_WORKFLOW.md)** - Complete workflow guide
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture
- **[SYSTEM_SUMMARY.md](./SYSTEM_SUMMARY.md)** - Quick reference
- **[CLAUDE.md](../../CLAUDE.md)** - Wiki Content Versioning section

---

**Commands Version**: Phase 3 (Git-Based Versioning)
**Total Wiki Pages**: 174 exported markdown files
**Last Export**: November 9, 2025
