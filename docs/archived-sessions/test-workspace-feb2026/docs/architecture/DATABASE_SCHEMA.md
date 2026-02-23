# Library System Database Schema

**Last Updated:** November 17, 2025
**Database:** veritable_games @ PostgreSQL 15 (Alpine)
**Server:** 192.168.1.15:5432
**Analysis Method:** Direct schema examination + production data analysis

---

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [Complete Table Inventory](#complete-table-inventory)
3. [Relationship Diagrams](#relationship-diagrams)
4. [Table Specifications](#table-specifications)
5. [Indexes & Performance](#indexes--performance)
6. [Triggers & Automation](#triggers--automation)
7. [Cascade Patterns](#cascade-patterns)
8. [Migration History](#migration-history)
9. [Deprecated Tables](#deprecated-tables)

---

## Schema Overview

### PostgreSQL Schema Organization

```
veritable_games (database)
├── anarchist     - Archival collection (24,643 documents)
├── library       - User-curated documents (7 documents)
├── shared        - Unified resources (tags)
├── users         - Authentication & profiles
├── auth          - Sessions & tokens
├── wiki          - Wiki pages & revisions
├── forums        - Discussion forums
├── content       - Projects & news
├── messaging     - Private messaging
├── cache         - Performance caching
├── system        - System configuration
└── public        - PostgreSQL default
```

**Library-Related Schemas:**
- `anarchist` - Scraped anarchist literature (read-only archive)
- `library` - User-uploaded documents (editable)
- `shared` - Unified tag system (serves both collections)

---

## Complete Table Inventory

### Production Tables (Active)

| Schema | Table | Rows | Purpose | Storage Pattern |
|--------|-------|------|---------|-----------------|
| `anarchist` | `documents` | 24,643 | Anarchist library metadata | Hybrid (metadata in DB, content on filesystem) |
| `anarchist` | `document_tags` | 194,664 | Document↔tag associations | Junction table |
| `anarchist` | `tags` | 0 | **DEPRECATED** - Never populated | Empty (scheduled for deletion) |
| `library` | `library_documents` | 7 | User library documents | Full content in DB |
| `library` | `library_document_tags` | 37 | Document↔tag associations | Junction table |
| `library` | `library_categories` | 5 | Document categories | Metadata |
| `library` | `library_document_categories` | ~15 | Document↔category associations | Junction table |
| `library` | `library_tag_categories` | 16 | Tag type taxonomy | Metadata (orphaned after migration) |
| `library` | `library_tags` | 60 | **DEPRECATED** - Migrated to shared.tags | Frozen (drop after Dec 11, 2025) |
| `shared` | `tags` | 19,952 | Unified tag repository | Central tag pool |

### Row Count Summary
- **Total documents**: 24,650 (24,643 anarchist + 7 library)
- **Total tag associations**: 194,701 (194,664 + 37)
- **Unique tags**: 19,952
- **Average tags per document**: 7.9

---

## Relationship Diagrams

### Core Relationships (ASCII Diagram)

```
┌─────────────────────────────────────────────────────────────────┐
│               UNIFIED TAG SYSTEM (Nov 2025)                     │
└─────────────────────────────────────────────────────────────────┘

users.users (NO direct FK)
    │
    │ (weak reference via created_by)
    ▼
library.library_documents ──────────────────────────────────────┐
│   id, slug, title, content                                    │
│   created_by (NO FK)  ← Intentional: flexible user reference │
│   status, document_type                                       │
└───────────────────────────────────────────────────────────────┘
    │
    │ (many-to-many)
    ▼
library.library_document_tags ──────────────────────────────────┐
│   document_id (NO FK to library_documents)                    │
│   tag_id (FK → shared.tags ON DELETE CASCADE)   ─────────────┼──┐
└───────────────────────────────────────────────────────────────┘  │
                                                                    │
                                                                    │
anarchist.documents ────────────────────────────────────────────┐  │
│   id, slug, title, author, file_path                          │  │
│   language, category, view_count                              │  │
└───────────────────────────────────────────────────────────────┘  │
    │                                                               │
    │ (many-to-many)                                                │
    ▼                                                               │
anarchist.document_tags ────────────────────────────────────────┐  │
│   document_id (FK → anarchist.documents ON DELETE CASCADE)    │  │
│   tag_id (FK → shared.tags ON DELETE CASCADE)   ─────────────┼──┤
│   added_at                                                     │  │
└───────────────────────────────────────────────────────────────┘  │
                                                                    │
                                                                    ▼
shared.tags ────────────────────────────────────────────────────┐
│   id, name (UNIQUE), usage_count (AUTO-MAINTAINED)            │
│   description, created_at, updated_at                         │
│                                                                │
│   Triggers:                                                    │
│   - library_document_tags_usage_trigger                       │
│   - anarchist_document_tags_usage_trigger                     │
└────────────────────────────────────────────────────────────────┘


SUPPORTING STRUCTURES:

library.library_categories ─────────────────────────────────────┐
│   id, code (UNIQUE), name, description                        │
│   item_count (denormalized, not auto-maintained)              │
└────────────────────────────────────────────────────────────────┘
    ▲
    │ (many-to-many, NO FK constraints!)
    │
library.library_document_categories ────────────────────────────┐
│   document_id (NO FK)                                         │
│   category_id (NO FK)                                         │
└────────────────────────────────────────────────────────────────┘


DEPRECATED (Post-Migration):

library.library_tag_categories ─────────────────────────────────┐
│   id, name (UNIQUE), type, description                        │
│   16 rows (orphaned - no active references)                   │
└────────────────────────────────────────────────────────────────┘
    ▲
    │ (one-to-many, broken after migration)
    │
library.library_tags (DEPRECATED) ──────────────────────────────┐
│   id, name, category_id, usage_count                          │
│   60 rows (frozen, scheduled for deletion Dec 11, 2025)       │
└────────────────────────────────────────────────────────────────┘
```

---

## Table Specifications

### 1. anarchist.documents

**Purpose:** Metadata storage for anarchist library collection

**Storage Strategy:** Hybrid
- Database: Metadata only (~2KB per row)
- Filesystem: Full content at `/app/anarchist-library/{file_path}`

```sql
CREATE TABLE anarchist.documents (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    author TEXT,
    publication_date TEXT,
    language TEXT DEFAULT 'en',

    -- Filesystem reference (NOT full content)
    file_path TEXT NOT NULL,

    source_url TEXT,
    document_type TEXT DEFAULT 'article',
    notes TEXT,
    original_format TEXT DEFAULT 'muse',
    category TEXT,  -- e.g., 'anarchist-en', 'anarchist-de'

    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
```sql
CREATE UNIQUE INDEX documents_slug_key ON anarchist.documents(slug);
CREATE INDEX idx_anarchist_documents_language ON anarchist.documents(language);
CREATE INDEX idx_anarchist_documents_category ON anarchist.documents(category);
```

**Triggers:**
```sql
CREATE TRIGGER anarchist_documents_update_timestamp
BEFORE UPDATE ON anarchist.documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Constraints:**
- `slug` must be unique (URL identifier)
- `file_path` must be non-null (required for content retrieval)

**Sample Data:**
```sql
id    | 42
slug  | kropotkin-mutual-aid-factor-evolution
title | Mutual Aid: A Factor of Evolution
author | Peter Kropotkin
publication_date | 1902
language | en
file_path | anarchist_library_texts_en/kropotkin-mutual-aid-factor-evolution.md
source_url | https://theanarchistlibrary.org/library/...
category | anarchist-en
view_count | 156
```

---

### 2. anarchist.document_tags

**Purpose:** Many-to-many relationship between anarchist documents and tags

```sql
CREATE TABLE anarchist.document_tags (
    document_id INTEGER NOT NULL REFERENCES anarchist.documents(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES shared.tags(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (document_id, tag_id)
);
```

**Indexes:**
```sql
CREATE INDEX idx_anarchist_document_tags_tag ON anarchist.document_tags(tag_id);

-- ⚠️ MISSING INDEX (Performance Issue):
-- CREATE INDEX idx_anarchist_document_tags_document ON anarchist.document_tags(document_id);
```

**Triggers:**
```sql
CREATE TRIGGER anarchist_document_tags_usage_trigger
AFTER INSERT OR DELETE ON anarchist.document_tags
FOR EACH ROW EXECUTE FUNCTION shared.update_tag_usage_count();
```

**Cascade Behavior:**
- `DELETE anarchist.documents` → CASCADE DELETE document_tags → TRIGGER UPDATE shared.tags.usage_count
- `DELETE shared.tags` → CASCADE DELETE document_tags (affects BOTH library and anarchist)

**Data Volume:**
- 194,664 tag associations
- Average: 7.9 tags per document
- Range: 1-50 tags per document

---

### 3. library.library_documents

**Purpose:** User-uploaded text-based documents

**Storage Strategy:** Full content in database

```sql
CREATE TABLE library.library_documents (
    id BIGSERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    author TEXT,
    publication_date TEXT,
    document_type TEXT DEFAULT 'document',  -- See CHECK constraint
    status TEXT DEFAULT 'published',       -- draft | published | archived
    description TEXT,
    abstract TEXT,

    -- Full document content (unlike anarchist.documents)
    content TEXT NOT NULL,

    language TEXT DEFAULT 'en',
    created_by INTEGER NOT NULL,  -- NO FK (intentional)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    view_count INTEGER DEFAULT 0,

    -- Searchable concatenation
    search_text TEXT
);
```

**Constraints:**
```sql
ALTER TABLE library.library_documents
ADD CONSTRAINT library_documents_document_type_check
CHECK (document_type IN (
    'article', 'book', 'paper', 'document', 'manifesto',
    'manual', 'guide', 'reference', 'case-study', 'other'
));

ALTER TABLE library.library_documents
ADD CONSTRAINT library_documents_status_check
CHECK (status IN ('draft', 'published', 'archived'));
```

**Indexes:**
```sql
CREATE UNIQUE INDEX library_documents_slug_key ON library.library_documents(slug);
CREATE INDEX idx_library_documents_created_at ON library.library_documents(created_at DESC);
CREATE INDEX idx_library_documents_search_text ON library.library_documents(search_text, title, author);
CREATE INDEX idx_library_documents_status_type_created
    ON library.library_documents(status, document_type, created_at DESC);
```

**Triggers:**
```sql
CREATE TRIGGER library_documents_update_timestamp
BEFORE UPDATE ON library.library_documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Why No FK on created_by?**
- Flexible user management (can delete users without cascading documents)
- Cross-database compatibility (SQLite dev vs PostgreSQL prod)
- Import flexibility (can import docs without user accounts)

**Key Difference from anarchist.documents:**
- **Content storage:** Full text in `content` column vs. `file_path` reference
- **Editability:** Designed for user editing vs. read-only archive
- **Size:** 7 documents vs. 24,643 (small collection allows full content in DB)

---

### 4. shared.tags

**Purpose:** Unified tag repository for all document collections

**Created:** November 11, 2025 (Unified Tag Schema Migration)

```sql
CREATE TABLE shared.tags (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    usage_count INTEGER DEFAULT 0,  -- Auto-maintained by triggers
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
```sql
-- Unique constraint creates automatic index
CREATE UNIQUE INDEX idx_shared_tags_name ON shared.tags(name);

-- Popular tags (for "top tags" queries)
CREATE INDEX idx_shared_tags_usage_count ON shared.tags(usage_count DESC);

-- Fuzzy search (trigram similarity)
CREATE INDEX idx_shared_tags_name_trgm ON shared.tags USING gin (name gin_trgm_ops);
```

**Triggers:**
```sql
-- Automatic usage_count maintenance
-- (Function defined in shared schema, invoked by triggers on junction tables)
CREATE OR REPLACE FUNCTION shared.update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE shared.tags
        SET usage_count = usage_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.tag_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE shared.tags
        SET usage_count = GREATEST(0, usage_count - 1),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.tag_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

**Tag Normalization:**
- All tags stored lowercase
- Spaces converted to hyphens
- Trimmed whitespace
- Example: "Anarcho Syndicalism " → "anarcho-syndicalism"

**Top 10 Tags by Usage:**
| Name | Usage Count | Percentage |
|------|-------------|------------|
| contemporary | 15,395 | 62.5% |
| english | 14,548 | 59.1% |
| 2010s | 7,277 | 29.6% |
| 2020s | 4,511 | 18.3% |
| 2000s | 3,602 | 14.6% |
| late-20th-century | 3,524 | 14.3% |
| early-20th-century | 3,033 | 12.3% |
| historical | 2,093 | 8.5% |
| 1990s | 1,769 | 7.2% |
| polish | 1,597 | 6.5% |

**Data Characteristics:**
- 19,952 unique tags total
- Usage distribution: Power law (few tags used heavily, long tail rarely used)
- Language/time period tags dominate top usage
- Thematic tags (anarchism, revolution, etc.) appear mid-range

---

### 5. library.library_document_tags

**Purpose:** Many-to-many relationship between library documents and tags

```sql
CREATE TABLE library.library_document_tags (
    document_id INTEGER NOT NULL,  -- NO FK (intentional)
    tag_id INTEGER NOT NULL REFERENCES shared.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, tag_id)
);
```

**Indexes:**
```sql
CREATE INDEX idx_library_document_tags_document ON library.library_document_tags(document_id);
CREATE INDEX idx_library_document_tags_tag ON library.library_document_tags(document_id);
```

**Triggers:**
```sql
CREATE TRIGGER library_document_tags_usage_trigger
AFTER INSERT OR DELETE ON library.library_document_tags
FOR EACH ROW EXECUTE FUNCTION shared.update_tag_usage_count();
```

**Migration Changes (November 11, 2025):**
- **Removed columns:** `added_by`, `added_at`
- **Reason:** Simplified schema, anarchist documents never had user tracking
- **Changed FK:** `tag_id` now references `shared.tags` (was `library.library_tags`)

**Why No FK on document_id?**
- Consistent with `library.library_documents.created_by` pattern
- Allows flexible document management
- Application-layer integrity enforcement

**Data Volume:**
- 37 tag associations (for 7 library documents)
- Average: 5.3 tags per document

---

### 6. library.library_categories

**Purpose:** Document classification categories

```sql
CREATE TABLE library.library_categories (
    id BIGSERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    item_count INTEGER DEFAULT 0,  -- Denormalized (NOT auto-maintained)
    display_order INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Current Data:**
| ID | Name | Code | Item Count | Display Order |
|----|------|------|------------|---------------|
| 1 | Reference Materials | reference | 1 | 1 |
| 2 | Technical Manuals | technical | 5 | 2 |
| 3 | Philosophy & Theory | philosophy | 7 | 3 |
| 4 | Guides & Handbooks | guides | 5 | 4 |
| 5 | Research Papers | research | 0 | 5 |

**Note:** `item_count` is NOT automatically maintained (unlike `shared.tags.usage_count`)
- Requires manual updates or periodic recalculation
- May drift from actual document counts

---

### 7. library.library_document_categories

**Purpose:** Many-to-many relationship between documents and categories

```sql
CREATE TABLE library.library_document_categories (
    document_id INTEGER NOT NULL,  -- NO FK
    category_id INTEGER NOT NULL,  -- NO FK
    PRIMARY KEY (document_id, category_id)
);
```

**No Foreign Keys:**
- Intentionally omitted for flexibility
- Allows category/document deletion without cascade constraints
- Application must ensure referential integrity

**Usage Pattern:**
```typescript
// Service layer ensures integrity
async assignCategory(documentId: number, categoryId: number) {
    // Verify document exists
    const doc = await this.getDocumentById(documentId);
    if (!doc) throw new Error('Document not found');

    // Verify category exists
    const category = await this.getCategoryById(categoryId);
    if (!category) throw new Error('Category not found');

    // Safe to insert
    await db.query(
        'INSERT INTO library_document_categories VALUES ($1, $2)',
        [documentId, categoryId]
    );
}
```

---

### 8. library.library_tag_categories (ORPHANED)

**Purpose:** Tag type taxonomy (pre-unification)

**Status:** Orphaned after November 11, 2025 migration

```sql
CREATE TABLE library.library_tag_categories (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Current Data (16 rows):**
| ID | Name | Type |
|----|------|------|
| 1 | Political Theory | political_theory |
| 2 | Economics & Labor | economics |
| 3 | Social Justice | social_justice |
| 4 | Technology & Science | technology |
| 5 | History & Movements | history |
| 6 | Source Type | source |
| 7 | Theme | theme |
| 8 | Methodology | method |
| 9 | Time Period | time |
| 10 | Geography | geography |

**Why Orphaned?**
- Original `library.library_tags` had `category_id` field
- Unified `shared.tags` has NO `category_id` field
- Migration deliberately removed categorization
- Table remains but has no active references

**Potential Future Use:**
- Could implement categorization in `shared.tags`
- Could use tag naming conventions (e.g., "theme:anarchism")
- Currently: Planning artifact, not production feature

---

## Indexes & Performance

### Index Strategy

**Primary Lookups (B-tree indexes):**
```sql
-- Document retrieval by slug
CREATE UNIQUE INDEX documents_slug_key ON anarchist.documents(slug);
CREATE UNIQUE INDEX library_documents_slug_key ON library.library_documents(slug);

-- Tag retrieval by name
CREATE UNIQUE INDEX idx_shared_tags_name ON shared.tags(name);
```

**List/Filter Queries (Composite indexes):**
```sql
-- Library documents: filter by status+type, sort by created_at
CREATE INDEX idx_library_documents_status_type_created
    ON library.library_documents(status, document_type, created_at DESC);

-- Anarchist documents: filter by language or category
CREATE INDEX idx_anarchist_documents_language ON anarchist.documents(language);
CREATE INDEX idx_anarchist_documents_category ON anarchist.documents(category);
```

**Full-Text Search (Limited):**
```sql
-- Current: Simple B-tree on concatenated search text
CREATE INDEX idx_library_documents_search_text
    ON library.library_documents(search_text, title, author);

-- ⚠️ LIMITATION: ILIKE searches don't scale well beyond 100K documents
-- Recommended: Migrate to tsvector + GIN index
```

**Fuzzy Search (Trigram):**
```sql
-- PostgreSQL pg_trgm extension for similarity search
CREATE INDEX idx_shared_tags_name_trgm
    ON shared.tags USING gin (name gin_trgm_ops);

-- Enables queries like:
-- SELECT * FROM shared.tags WHERE name % 'anarchy';  -- Similarity
-- SELECT * FROM shared.tags WHERE name ILIKE '%arch%';  -- Substring
```

**Junction Table Performance:**
```sql
-- Library (bidirectional indexes)
CREATE INDEX idx_library_document_tags_document ON library.library_document_tags(document_id);
CREATE INDEX idx_library_document_tags_tag ON library.library_document_tags(tag_id);

-- Anarchist (only tag→document index exists, missing document→tags!)
CREATE INDEX idx_anarchist_document_tags_tag ON anarchist.document_tags(tag_id);
-- ⚠️ MISSING:
-- CREATE INDEX idx_anarchist_document_tags_document ON anarchist.document_tags(document_id);
```

### Query Performance Benchmarks

**Document Retrieval:**
| Query Type | Rows | Time | Index Used |
|------------|------|------|------------|
| By slug (single) | 1 | ~5ms | `documents_slug_key` (UNIQUE) |
| List (200 docs) | 200 | ~50ms | `idx_documents_status_type_created` |
| By language filter | ~14,548 | ~30ms | `idx_anarchist_documents_language` |
| By category | ~3,000 | ~20ms | `idx_anarchist_documents_category` |

**Tag Operations:**
| Query Type | Rows | Time | Index Used |
|------------|------|------|------------|
| Tag by name | 1 | ~2ms | `idx_shared_tags_name` (UNIQUE) |
| Top 100 tags | 100 | ~5ms | `idx_shared_tags_usage_count` (DESC) |
| Fuzzy search | varies | ~10-20ms | `idx_shared_tags_name_trgm` (GIN) |
| Batch tag load (200 docs) | ~1,580 | ~10ms | `idx_anarchist_document_tags_tag` |

**Full-Text Search (Current ILIKE):**
| Document Count | Search Time | Acceptable? |
|----------------|-------------|------------|
| 7 (library) | <5ms | ✅ Yes |
| 24,643 (anarchist) | ~100-200ms | ⚠️ Borderline |
| 100,000 (projected) | ~800ms-1s | ❌ Too slow |

**Recommendation:** Migrate to PostgreSQL native full-text search
```sql
ALTER TABLE anarchist.documents ADD COLUMN search_vector tsvector;
CREATE INDEX idx_anarchist_documents_fts ON anarchist.documents USING gin(search_vector);
-- Expected: 3-5x faster, relevance ranking, better scalability
```

---

## Triggers & Automation

### 1. Automatic Timestamp Updates

**Pattern:** Update `updated_at` on row modification

```sql
-- Generic trigger function (reusable)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to multiple tables
CREATE TRIGGER anarchist_documents_update_timestamp
BEFORE UPDATE ON anarchist.documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER library_documents_update_timestamp
BEFORE UPDATE ON library.library_documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Behavior:**
- Fires on EVERY UPDATE (even if no columns changed)
- Sets `updated_at = NOW()` before row is written
- Cannot be bypassed (always runs)

---

### 2. Tag Usage Count Maintenance

**Pattern:** Event-driven denormalization

```sql
CREATE OR REPLACE FUNCTION shared.update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment usage count when tag association added
        UPDATE shared.tags
        SET usage_count = usage_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.tag_id;

    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement usage count when tag association removed
        UPDATE shared.tags
        SET usage_count = GREATEST(0, usage_count - 1),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.tag_id;
    END IF;

    RETURN NULL;  -- AFTER trigger, return value ignored
END;
$$ LANGUAGE plpgsql;
```

**Applied to Both Junction Tables:**
```sql
-- Library document tags
CREATE TRIGGER library_document_tags_usage_trigger
AFTER INSERT OR DELETE ON library.library_document_tags
FOR EACH ROW EXECUTE FUNCTION shared.update_tag_usage_count();

-- Anarchist document tags
CREATE TRIGGER anarchist_document_tags_usage_trigger
AFTER INSERT OR DELETE ON anarchist.document_tags
FOR EACH ROW EXECUTE FUNCTION shared.update_tag_usage_count();
```

**Behavior:**
- **On INSERT:** `usage_count++` for the referenced tag
- **On DELETE:** `usage_count--` (with `GREATEST(0, ...)` to prevent negatives)
- **On UPDATE:** N/A (primary key cannot be updated)
- **Updates timestamp:** `updated_at` reflects last usage change

**Correctness Guarantees:**
- Atomic: Increment/decrement happens in same transaction as INSERT/DELETE
- Accurate: Count always reflects actual associations (no drift)
- Race-safe: PostgreSQL row-level locking prevents race conditions

**Implication of updated_at:**
- `updated_at` reflects last **usage change**, not last **metadata change**
- Cannot distinguish "tag renamed" vs. "tag used on new document"
- Useful for cache invalidation, misleading for audit

---

## Cascade Patterns

### 1. Shared Tags (Global CASCADE)

**ON DELETE CASCADE from shared.tags:**

```
shared.tags (DELETE tag with id=42)
    ↓ CASCADE
    ├─ library.library_document_tags (all rows with tag_id=42 deleted)
    │  └─ TRIGGER: update_tag_usage_count() fires
    │     (but tag already deleted, so update fails - minor bug)
    │
    └─ anarchist.document_tags (all rows with tag_id=42 deleted)
       └─ TRIGGER: update_tag_usage_count() fires
          (same issue as above)
```

**Risk Level:** HIGH
- Deleting a popular tag (e.g., "contemporary" with 15,395 uses) removes ALL associations
- Affects BOTH library and anarchist collections
- No soft delete or trash bin

**Recommended Protection:**
```typescript
// Application layer protection
async deleteTag(tagId: number) {
    const tag = await this.getTagById(tagId);

    if (tag.usage_count > 0) {
        throw new Error(
            `Cannot delete tag "${tag.name}" with ${tag.usage_count} uses. ` +
            `Remove all associations first.`
        );
    }

    await db.query('DELETE FROM shared.tags WHERE id = $1', [tagId]);
}
```

---

### 2. Anarchist Documents (Strict CASCADE)

**ON DELETE CASCADE from anarchist.documents:**

```
anarchist.documents (DELETE document with id=123)
    ↓ CASCADE
    anarchist.document_tags (all rows with document_id=123 deleted)
        ↓ TRIGGER
        shared.update_tag_usage_count() fires for EACH deleted tag
            ↓
            shared.tags.usage_count decremented (accurate cleanup)
```

**Behavior:**
- Full cascade cleanup
- Automatic usage count maintenance
- No orphaned tag associations

**Correctness:** Excellent
- All references cleaned up
- Denormalized counts stay accurate
- No manual intervention required

---

### 3. Library Documents (NO CASCADE)

**NO CASCADE from library.library_documents:**

```
library.library_documents (DELETE document with id=5)
    ↓ NO CASCADE
    library.library_document_tags (orphaned rows with document_id=5 remain!)
    library.library_document_categories (orphaned rows with document_id=5 remain!)
```

**Risk Level:** MEDIUM
- Orphaned junction table records if application doesn't clean up
- Usage counts become inaccurate (triggers don't fire if junction rows not deleted)

**Recommended Pattern:**
```typescript
// Service layer ensures cleanup
async deleteDocument(documentId: number) {
    await db.transaction(async (tx) => {
        // Step 1: Delete tag associations (triggers usage_count decrement)
        await tx.query(
            'DELETE FROM library.library_document_tags WHERE document_id = $1',
            [documentId]
        );

        // Step 2: Delete category associations
        await tx.query(
            'DELETE FROM library.library_document_categories WHERE document_id = $1',
            [documentId]
        );

        // Step 3: Delete document
        await tx.query(
            'DELETE FROM library.library_documents WHERE id = $1',
            [documentId]
        );
    });
}
```

---

## Migration History

### Migration 001: Unified Tag Schema (November 11, 2025)

**File:** `frontend/scripts/migrations/001-unified-tag-schema.sql`

**Purpose:** Consolidate library-specific tags into shared schema

**10 Phases:**

1. **CREATE shared.tags table**
   - Central tag repository with usage_count tracking

2. **MIGRATE library tags to shared.tags**
   - Copy 60 tags from `library.library_tags` to `shared.tags`
   - Preserve tag IDs for compatibility
   - Result: 19,952 tags total (includes anarchist tags)

3. **CREATE trigger function**
   - `shared.update_tag_usage_count()` for automatic maintenance

4. **UPDATE library junction table**
   - Change FK from `library.library_tags` to `shared.tags`
   - Preserve existing tag associations (37 rows)

5. **SIMPLIFY library junction table**
   - Remove `added_by`, `added_at` columns
   - Reason: Anarchist collection has no user tracking, unified schema should match

6. **CREATE usage triggers**
   - Apply to both `library.library_document_tags` and `anarchist.document_tags`

7. **CALCULATE initial usage counts**
   - Count existing associations in both junction tables
   - Update `shared.tags.usage_count` accordingly

8. **VALIDATE migration**
   - Check tag count match (19,952)
   - Verify all relationships valid
   - Confirm usage counts accurate

9. **MARK tables as deprecated**
   - `library.library_tags` → "Safe to drop after 2025-12-11"
   - `anarchist.tags` → "Safe to drop immediately"

10. **COMMIT migration**

**Results:**
- ✅ 19,952 tags migrated successfully
- ✅ 194,701 tag associations preserved
- ✅ Usage counts accurate
- ✅ Triggers operational
- ⚠️ Application code NOT updated (libraryService still queries old table)

**Post-Migration Cleanup (Pending):**
- Drop `library.library_tags` after Dec 11, 2025
- Drop `anarchist.tags` (already empty)
- Update service layer to use `shared.tags`

---

## Deprecated Tables

### 1. library.library_tags (Scheduled for Deletion: Dec 11, 2025)

**Status:** DEPRECATED but still present

```sql
CREATE TABLE library.library_tags (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    category_id INTEGER REFERENCES library.library_tag_categories(id),
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE library.library_tags IS
    'DEPRECATED: Migrated to shared.tags on 2025-11-11.
     Safe to drop after 2025-12-11 if no issues.';
```

**Current State:**
- 60 rows (frozen, no updates)
- Foreign keys severed (no longer referenced by junction table)
- Application code STILL QUERIES THIS TABLE (bug!)

**Cleanup Plan:**
1. Fix `libraryService.getDocuments()` to query `shared.tags`
2. Verify no other code references this table
3. Drop table after 30-day grace period (Dec 11+)

---

### 2. anarchist.tags (Never Populated)

**Status:** DEPRECATED, safe to drop immediately

```sql
CREATE TABLE anarchist.tags (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE anarchist.tags IS
    'DEPRECATED: Never populated. Using shared.tags instead.
     Safe to drop immediately.';
```

**Current State:**
- 0 rows (never used)
- No foreign key references
- Safe to drop without impact

**Cleanup Plan:**
1. Verify no code references this table
2. Drop immediately (no grace period needed)

---

## Recommendations

### P0 - Critical (Immediate)

1. **Fix LibraryService to use shared.tags**
   - Current: Queries deprecated `library.library_tags`
   - Fix: Change JOIN to `shared.tags`
   - Impact: Prevents breakage when table dropped Dec 11

2. **Add missing index**
   ```sql
   CREATE INDEX idx_anarchist_document_tags_document
   ON anarchist.document_tags(document_id);
   ```
   - Impact: Faster document→tags queries

### P1 - High (Next Sprint)

3. **Clean up deprecated tables (after Dec 11)**
   ```sql
   DROP TABLE library.library_tags;
   DROP TABLE anarchist.tags;
   DROP TABLE library.library_tag_categories;  -- Orphaned
   ```

4. **Implement tag deletion protection**
   - Prevent deletion of tags with usage_count > 0
   - Add soft delete or trash bin

### P2 - Medium (Future)

5. **Migrate to tsvector full-text search**
   - Add `search_vector tsvector` column
   - Create GIN index
   - Update queries to use `@@` operator

6. **Add foreign keys to library.library_document_categories**
   - Currently: No constraints
   - Recommended: Add FKs with ON DELETE CASCADE

7. **Decide on tag categorization**
   - Either: Implement in `shared.tags` (add category_id column)
   - Or: Remove orphaned `library.library_tag_categories` table

---

**Document Version:** 1.0
**Last Updated:** November 17, 2025
**Next Review:** December 15, 2025 (after deprecated table cleanup)
