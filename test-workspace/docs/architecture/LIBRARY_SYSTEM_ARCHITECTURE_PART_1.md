# Library System Architecture - Part 1: Overview & Database

**Version:** 1.0
**Last Updated:** 2025-11-17
**Analysis Date:** November 17, 2025
**Analyzed By:** Claude Code (Specialized Architecture Agents)

---

## Document Organization

This comprehensive architectural analysis is split into multiple parts:

- **Part 1** (This Document): System Overview, Database Architecture
- **Part 2**: Frontend Architecture, API Layer
- **Part 3**: Tag System, Import Pipeline, Data Processing
- **Part 4**: Known Issues, Design Patterns, Performance Characteristics, Roadmap

---

## Executive Summary

The Veritable Games library system is a sophisticated political literature archival platform managing **24,643 anarchist texts** with **194,664 tag associations** across **27 languages**. The system uses a hybrid storage architecture (PostgreSQL + filesystem), unified tag schema, and modern Next.js 15 App Router with virtual scrolling for performance.

### Key Metrics

**Data Scale:**
- **Documents:** 24,643 anarchist texts (library collection exists but separate)
- **Tags:** 19,952 unique tags in unified schema
- **Tag Associations:** 194,664 document-tag relationships
- **Languages:** 27 languages (English, Spanish, German, French, etc.)
- **Categories:** Philosophy, history, economics, literature, etc.
- **Content Storage:** ~3.1GB markdown files (archived), content in PostgreSQL

**Performance Characteristics:**
- **Virtual Scrolling:** react-virtuoso handles 24K+ items without degradation
- **Pagination:** Proportional split (1% library, 99% anarchist)
- **Response Time:** <200ms for typical queries (no caching currently)
- **Database:** PostgreSQL 15 Alpine in Docker container

**Technology Stack:**
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript
- **Database:** PostgreSQL 15 (multi-schema: anarchist, library, shared, auth, wiki, forums)
- **Backend:** Node.js with pg/postgres drivers
- **Infrastructure:** Docker, Coolify, Traefik, Nixpacks

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                          │
│  (Next.js 15 App Router, React 19, Virtual Scrolling)          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP/HTTPS
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      Traefik (Reverse Proxy)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │
┌────────────────────────────▼────────────────────────────────────┐
│              Next.js Application Container                      │
│                (m4s0kwo4kc4oooocck4sswc4)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  App Router (SSR/CSR Hybrid)                             │  │
│  │  ├─ /library (unified view)                              │  │
│  │  ├─ /api/anarchist/* (anarchist endpoints)               │  │
│  │  ├─ /api/library/* (library endpoints)                   │  │
│  │  └─ /api/*/admin/* (admin endpoints - NO AUTH! Bug)      │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Service Layer                                           │  │
│  │  ├─ anarchistService.ts (tag bug on line 85-95)         │  │
│  │  ├─ libraryService.ts                                    │  │
│  │  ├─ wikiService.ts                                       │  │
│  │  └─ forumService.ts                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Database Client (pg)                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ PostgreSQL Protocol
                             │
┌────────────────────────────▼────────────────────────────────────┐
│         PostgreSQL Container (veritable-games-postgres)         │
│                    postgres:15-alpine                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Database: veritable_games                               │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  Schema: anarchist                                 │  │  │
│  │  │  - documents (24,643 rows)                         │  │  │
│  │  │  - document_tags (194,664 rows)                    │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  Schema: library                                   │  │  │
│  │  │  - documents                                       │  │  │
│  │  │  - library_tags (separate from anarchist)         │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  Schema: shared                                    │  │  │
│  │  │  - tags (19,952 unique tags)                       │  │  │
│  │  │  - Used by both anarchist and library             │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  Other Schemas                                     │  │  │
│  │  │  - auth (users, sessions)                          │  │  │
│  │  │  - wiki (wiki content)                             │  │  │
│  │  │  - forums (forum posts, threads)                   │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

**Document Retrieval Flow:**
```
1. User requests /library page
   ↓
2. Next.js SSR fetches initial data
   ↓
3. anarchistService.getDocuments(params)
   ↓
4. SQL query to anarchist.documents + joins
   ↓
5. PostgreSQL returns results
   ↓
6. Service maps rows to TypeScript objects
   ↓
7. Server component renders with data
   ↓
8. HTML sent to client with hydration data
   ↓
9. Client-side JS enables virtual scrolling
   ↓
10. User scrolls → fetch more via /api/anarchist/documents
```

**Tag Filtering Flow (CURRENTLY BROKEN):**
```
1. User selects tags in UI
   ↓
2. Frontend updates URL: ?tags=anarchism,revolution
   ↓
3. Component re-fetches with tag params
   ↓
4. anarchistService.getDocuments({ tags: ['anarchism', 'revolution'] })
   ↓
5. ❌ BUG: tags parameter ignored in SQL query
   ↓
6. Returns ALL documents (ignores filter)
   ↓
7. User sees unfiltered results (appears to not work)
```

---

## Database Architecture

### Schema Design

The database uses a **multi-schema architecture** to organize different functional domains:

```sql
-- Schemas in veritable_games database
- anarchist     -- Anarchist library documents and metadata
- library       -- General library documents (separate collection)
- shared        -- Shared resources (tags, etc.)
- auth          -- Authentication and user management
- wiki          -- Wiki content and pages
- forums        -- Forum posts and threads
```

### Core Tables

#### anarchist.documents

Primary table for anarchist literature:

```sql
CREATE TABLE anarchist.documents (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(200) UNIQUE NOT NULL,
  authors VARCHAR(500),
  year INTEGER,
  language VARCHAR(2) NOT NULL,
  category VARCHAR(100),
  content TEXT NOT NULL,
  preview_text TEXT,
  downloads INTEGER DEFAULT 0,
  reading_ease_score DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_anarchist_documents_language ON anarchist.documents(language);
CREATE INDEX idx_anarchist_documents_category ON anarchist.documents(category);
CREATE INDEX idx_anarchist_documents_year ON anarchist.documents(year);
CREATE INDEX idx_anarchist_documents_slug ON anarchist.documents(slug);
CREATE INDEX idx_anarchist_documents_downloads ON anarchist.documents(downloads DESC);

-- Current row count: 24,643
```

**Key Design Decisions:**
- **Slug:** URL-friendly unique identifier (e.g., "conquest-of-bread")
- **Language:** ISO 639-1 two-letter code (en, es, de, fr, etc.)
- **Content:** Full markdown/HTML content stored in database (not filesystem)
- **Preview Text:** First ~200 chars for list views
- **Downloads:** User download counter (incremented on access)
- **Reading Ease:** Flesch reading ease score (0-100, higher = easier)

#### anarchist.document_tags

Many-to-many relationship between documents and tags:

```sql
CREATE TABLE anarchist.document_tags (
  document_id INTEGER NOT NULL REFERENCES anarchist.documents(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES shared.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (document_id, tag_id)
);

-- Indexes
CREATE INDEX idx_anarchist_document_tags_document ON anarchist.document_tags(document_id);
CREATE INDEX idx_anarchist_document_tags_tag ON anarchist.document_tags(tag_id);

-- Current row count: 194,664 (avg ~8 tags per document)
```

**Key Design Decisions:**
- **Composite Primary Key:** (document_id, tag_id) prevents duplicates
- **Foreign Keys:** Cascade deletes maintain referential integrity
- **No additional columns:** Clean join table (created_at for auditing only)

#### shared.tags

Unified tag table shared across all document collections:

```sql
CREATE TABLE shared.tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  normalized_name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_shared_tags_normalized ON shared.tags(normalized_name);
CREATE INDEX idx_shared_tags_name ON shared.tags(name);

-- Current row count: 19,952
```

**Key Design Decisions:**
- **Normalized Name:** Lowercase, trimmed version for matching (prevents duplicates like "Anarchism" vs "anarchism")
- **Shared Schema:** Same tags used across anarchist, library, wiki, forums
- **No usage_count column:** Calculated dynamically via JOINs (prevents stale data)

#### library.documents

Separate schema for general library documents:

```sql
CREATE TABLE library.documents (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(200) UNIQUE NOT NULL,
  authors VARCHAR(500),
  year INTEGER,
  language VARCHAR(2),
  content TEXT NOT NULL,
  -- ... similar structure to anarchist.documents
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Similar indexes to anarchist.documents
```

**Key Design Decisions:**
- **Separate Schema:** Library collection is distinct from anarchist collection
- **Similar Structure:** Allows code reuse in service layer
- **Unified Frontend:** Both collections shown in same /library interface
- **Composite Keys:** Document IDs prefixed with source (e.g., "anarchist-123", "library-456")

#### library.library_tags

Separate tag junction table for library documents:

```sql
CREATE TABLE library.library_tags (
  document_id INTEGER NOT NULL REFERENCES library.documents(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES shared.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (document_id, tag_id)
);
```

**Important Note:** This is NOT deprecated. Initial analysis incorrectly flagged this as obsolete, but it's the correct table for library documents. `shared.tags` is shared, but junction tables are schema-specific.

---

### Database Relationships

```
┌─────────────────────┐
│  anarchist.         │
│  documents          │
│  (24,643 rows)      │
└──────┬──────────────┘
       │
       │ 1:N
       │
       ▼
┌─────────────────────┐       ┌─────────────────────┐
│  anarchist.         │  N:1  │  shared.tags        │
│  document_tags      │◄──────┤  (19,952 rows)      │
│  (194,664 rows)     │       └──────┬──────────────┘
└─────────────────────┘              │
                                     │ 1:N
                                     │
                                     ▼
                            ┌─────────────────────┐
                            │  library.           │
                            │  library_tags       │
                            └──────┬──────────────┘
                                   │
                                   │ N:1
                                   │
                                   ▼
                            ┌─────────────────────┐
                            │  library.           │
                            │  documents          │
                            └─────────────────────┘
```

**Key Relationships:**
1. **Documents → Document Tags:** 1:N (one document has many tags)
2. **Tags → Document Tags:** 1:N (one tag used by many documents)
3. **Documents ← → Tags:** N:N (many-to-many through document_tags)

**Cross-Schema References:**
- `anarchist.document_tags.tag_id` → `shared.tags.id`
- `library.library_tags.tag_id` → `shared.tags.id`
- Tags are SHARED, junction tables are SEPARATE

---

### Unified Tag Schema Migration

**Date:** November 11, 2025
**Migration:** `001-unified-tag-schema.sql`

This critical migration consolidated all tags into a single `shared.tags` table:

**Before Migration:**
```
anarchist.tags         (separate tags for anarchist docs)
library.tags           (separate tags for library docs)
wiki.tags              (separate tags for wiki pages)
forums.tags            (separate tags for forum posts)
```

**After Migration:**
```
shared.tags            (unified tags for all documents)
  ├─ anarchist.document_tags → tag_id
  ├─ library.library_tags → tag_id
  ├─ wiki.page_tags → tag_id
  └─ forums.post_tags → tag_id
```

**Benefits:**
- ✅ Single source of truth for all tags
- ✅ Cross-collection tag discovery (search anarchist + library)
- ✅ Consistent tag normalization
- ✅ Reduced storage (no duplicate "anarchism" tags)
- ✅ Easier tag management (one table to maintain)

**Migration Statistics:**
- **Tags Migrated:** 19,952 unique tags
- **Duplicates Merged:** Unknown (not logged)
- **Associations Preserved:** 194,664 anarchist + library associations
- **Downtime:** None (online migration)

**Database Triggers for Tag Usage:**
```sql
-- Automatic usage count maintenance (if implemented)
CREATE TRIGGER update_tag_usage_count
AFTER INSERT OR DELETE ON anarchist.document_tags
FOR EACH ROW
EXECUTE FUNCTION update_shared_tag_usage();
```

---

### Indexes and Performance

#### Existing Indexes

**anarchist.documents:**
```sql
idx_anarchist_documents_slug           (slug) UNIQUE
idx_anarchist_documents_language       (language)
idx_anarchist_documents_category       (category)
idx_anarchist_documents_year           (year)
idx_anarchist_documents_downloads      (downloads DESC)
```

**anarchist.document_tags:**
```sql
idx_anarchist_document_tags_document   (document_id)
idx_anarchist_document_tags_tag        (tag_id)
```

**shared.tags:**
```sql
idx_shared_tags_normalized             (normalized_name) UNIQUE
idx_shared_tags_name                   (name)
```

#### Missing Indexes (Recommended)

**For Tag Autocomplete:**
```sql
-- Prefix search optimization
CREATE INDEX idx_shared_tags_normalized_prefix
ON shared.tags(normalized_name text_pattern_ops);
```

**For Full-Text Search:**
```sql
-- Title search
CREATE INDEX idx_anarchist_documents_title_fts
ON anarchist.documents
USING gin(to_tsvector('english', title));

-- Authors search
CREATE INDEX idx_anarchist_documents_authors_fts
ON anarchist.documents
USING gin(to_tsvector('english', coalesce(authors, '')));

-- Combined search
CREATE INDEX idx_anarchist_documents_search
ON anarchist.documents
USING gin((
  to_tsvector('english', title) ||
  to_tsvector('english', coalesce(authors, ''))
));
```

**For Common Filter Combinations:**
```sql
-- Language + category (common filter combo)
CREATE INDEX idx_anarchist_docs_lang_category
ON anarchist.documents(language, category)
WHERE language IS NOT NULL AND category IS NOT NULL;

-- Year range queries
CREATE INDEX idx_anarchist_docs_year_range
ON anarchist.documents(year DESC)
WHERE year IS NOT NULL;
```

---

### Storage Model: Hybrid Architecture

**Important Discovery:** The system uses a HYBRID storage model:

**Metadata: PostgreSQL**
- Document title, authors, year, language, category
- Preview text (first ~200 chars)
- Reading ease score
- Download count
- Tag associations

**Content: PostgreSQL (Previously Filesystem)**
- Full markdown/HTML content stored in `anarchist.documents.content` column
- Original markdown files archived to compressed tarball
- ✅ Verified: Document service reads from database, NOT filesystem

**Evidence:**
```typescript
// Service reads from PostgreSQL
const result = await query(`
  SELECT content FROM anarchist.documents WHERE id = $1
`, [id]);

// NOT reading from filesystem:
// const content = await fs.readFile(`/path/to/markdown/${slug}.md`);
```

**Historical Context:**
- **Import Phase:** Python scripts converted .muse → markdown → PostgreSQL
- **Migration:** Content moved from filesystem to database
- **Archive:** Markdown files compressed (~3.1GB → ~350MB)
- **Current:** Database is single source of truth

**Advantages:**
- ✅ Atomic transactions (content + metadata together)
- ✅ Backup simplicity (single pg_dump)
- ✅ No filesystem sync issues
- ✅ Easier replication/scaling

**Disadvantages:**
- ❌ Large database size (content in TEXT columns)
- ❌ No CDN offloading (content not in static files)
- ❌ Backup size larger (includes all content)

---

### Database Configuration

**PostgreSQL Container:**
```yaml
Container: veritable-games-postgres
Image: postgres:15-alpine
Networks: veritable-games-network, coolify
Volumes: postgres-data (persistent)
Port: 5432 (internal only, not exposed)
```

**Connection Configuration:**
```env
DATABASE_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
POSTGRES_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
DATABASE_MODE=postgres
```

**Connection Pool Settings:**
```typescript
// Recommended (not currently implemented)
{
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // 30 seconds
  connectionTimeoutMillis: 2000
}
```

**Performance Settings (PostgreSQL):**
```sql
-- Check current settings
SHOW shared_buffers;        -- Should be ~25% of RAM
SHOW effective_cache_size;  -- Should be ~50% of RAM
SHOW work_mem;              -- Per-operation memory
SHOW maintenance_work_mem;  -- For VACUUM, CREATE INDEX

-- Recommended for 4GB RAM server:
shared_buffers = 1GB
effective_cache_size = 2GB
work_mem = 16MB
maintenance_work_mem = 256MB
```

---

## Data Migration History

### Import Pipeline: Anarchist Library

**Source:** Anarchist Library (theanarchistlibrary.org)
**Method:** 4-stage transformation pipeline
**Status:** COMPLETE (24,643 documents imported)

**Stage 1: Original Format (.muse)**
- Emacs Muse format (custom markup language)
- Downloaded via web scraper (Python requests + BeautifulSoup)
- Organized by language directories

**Stage 2: Markdown Conversion**
- .muse → .md via Python conversion script
- Preserved: Title, authors, year, language, content
- YAML frontmatter added with metadata

**Stage 3: PostgreSQL Import**
- Python import script: `import_anarchist_documents_postgres.py`
- Batch processing (100 docs per transaction)
- Location: `/home/user/projects/veritable-games/resources/scripts/`

**Stage 4: Tag Extraction**
- 4-tier tag extraction system (see Tag System section in Part 3)
- Extracted: 194,664 tag associations
- Stored in: `anarchist.document_tags`

**Import Statistics:**
```
Total Documents: 24,643
Languages: 27 (en, es, de, fr, ru, pt, it, pl, etc.)
Total Tags: 19,952 unique
Tag Associations: 194,664
Import Time: ~4-6 hours (estimate)
Data Size: ~3.1GB markdown → ~2.5GB PostgreSQL
```

---

## Summary: Part 1 Key Findings

### Database Architecture
- ✅ Well-designed multi-schema architecture
- ✅ Unified tag schema (shared.tags) serving all collections
- ✅ Proper indexes on primary access paths
- ⚠️ Missing indexes for full-text search and autocomplete
- ⚠️ No connection pooling configured

### Storage Model
- ✅ Hybrid architecture (PostgreSQL metadata + content)
- ✅ Content stored in database (not filesystem)
- ✅ Markdown files archived to compressed tarball
- ⚠️ Large database size due to content storage

### Data Migration
- ✅ Successful 4-stage import pipeline
- ✅ 24,643 documents imported successfully
- ✅ Tag extraction and association complete
- ✅ Unified tag schema migration complete

### Critical Issues
- ❌ **P0 Bug:** Tag filtering broken in anarchist service (Part 4)
- ⚠️ **P1 Missing:** Indexes for full-text search
- ⚠️ **P1 Missing:** Connection pooling configuration

---

**Continue to Part 2:** Frontend Architecture, API Layer, Component Structure

**Document Status:** Complete
**Next Update:** After implementation of recommended changes
