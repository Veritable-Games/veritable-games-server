# Technical Architecture - Anarchist Library Integration

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     VERITABLE GAMES PLATFORM                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Frontend Layer (Next.js/React)                          │  │
│  │  - Pages                                                 │  │
│  │  - Components                                            │  │
│  │  - Search interfaces                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  API Layer (REST endpoints)                              │  │
│  │  - /api/anarchist/search                                 │  │
│  │  - /api/anarchist/documents                              │  │
│  │  - /api/anarchist/languages                              │  │
│  │  - /api/search (unified across archives)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Service Layer (TypeScript)                              │  │
│  │  ┌────────────────┐      ┌──────────────────────────┐   │  │
│  │  │ AnarchistService        │ UnifiedSearchService   │   │  │
│  │  │                │        │                        │   │  │
│  │  │ - search()    │        │ - searchAll()          │   │  │
│  │  │ - getDocuments│        │ - getArchiveStats()    │   │  │
│  │  │ - getBySlug() │        │ - getLanguages()       │   │  │
│  │  │ - getByAuthor │        │ - getRecent()          │   │  │
│  │  │ - getLanguages        │ - getMostViewed()      │   │  │
│  │  │ - getStats()  │        │                        │   │  │
│  │  └────────────────┘      └──────────────────────────┘   │  │
│  │         ↓                          ↓                     │  │
│  │  ┌────────────────────────────────────────────────┐    │  │
│  │  │      dbAdapter (PostgreSQL async interface)    │    │  │
│  │  │      - query()                                 │    │  │
│  │  │      - execute()                               │    │  │
│  │  │      - Schema management                       │    │  │
│  │  │      - Connection pooling                      │    │  │
│  │  └────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Data Layer                                              │  │
│  │  ┌────────────────────┐   ┌────────────────────┐        │  │
│  │  │  PostgreSQL        │   │ Docker Volume      │        │  │
│  │  │  anarchist schema  │   │ Markdown Files     │        │  │
│  │  │                    │   │                    │        │  │
│  │  │ - documents        │   │ /app/anarchist-    │        │  │
│  │  │ - tags             │   │ library/           │        │  │
│  │  │ - document_tags    │   │                    │        │  │
│  │  │ - indexes (GIN)    │   │ - 24,599 files     │        │  │
│  │  │                    │   │ - 1.3 GB total     │        │  │
│  │  │ Metadata in DB     │   │ - YAML frontmatter │        │  │
│  │  │ Fast search/filter │   │ - Content storage  │        │  │
│  │  └────────────────────┘   └────────────────────┘        │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## PostgreSQL Schema Design

### Main Tables

#### `anarchist.documents`
Stores metadata for all documents:

```sql
CREATE TABLE anarchist.documents (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,           -- URL-friendly identifier
  title TEXT NOT NULL,                 -- Document title
  author TEXT,                         -- Author/theorist name
  publication_date TEXT,               -- Original publication date
  language TEXT DEFAULT 'en',          -- ISO 639-1 language code
  file_path TEXT NOT NULL,             -- Path to markdown file
  source_url TEXT,                     -- Original source URL
  category TEXT,                       -- e.g., 'anarchist-en'
  document_type TEXT DEFAULT 'article',-- article, letter, work, etc.
  notes TEXT,                          -- Additional metadata
  original_format TEXT DEFAULT 'muse', -- Source format (muse)
  view_count INTEGER DEFAULT 0,        -- Popularity tracking
  created_at TIMESTAMP DEFAULT NOW(),  -- Import timestamp
  updated_at TIMESTAMP DEFAULT NOW()   -- Last modification
);
```

**Indexes:**
- Primary: `id` (SERIAL primary key)
- Unique: `slug` (for URL generation)
- Full-text: GIN index on (title || author || notes)
- Performance: B-tree on language, category, author

#### `anarchist.tags`
Categorization and taxonomy:

```sql
CREATE TABLE anarchist.tags (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,      -- Tag name
  usage_count INTEGER DEFAULT 0,  -- How many documents use this tag
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `anarchist.document_tags`
Many-to-many relationship:

```sql
CREATE TABLE anarchist.document_tags (
  document_id INTEGER NOT NULL REFERENCES anarchist.documents(id),
  tag_id INTEGER NOT NULL REFERENCES anarchist.tags(id),
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (document_id, tag_id)
);
```

## Data Flow

### Conversion Pipeline

```
Anarchist Library ZIP Archives (441 MB)
         ↓
   Extract .muse files (24,643)
         ↓
   Parse .muse format metadata
         ↓
   Convert markup to Markdown
         ↓
   Generate YAML frontmatter
         ↓
   Write .md files (1.3 GB)
         ↓
   Result: 24,643 markdown files
   Success rate: 100%
   Errors: 0
```

### Import Pipeline

```
Markdown files in ~/converted-markdown
         ↓
   Read file metadata
         ↓
   Extract YAML frontmatter
         ↓
   Generate slug from filename
         ↓
   Determine language from path
         ↓
   INSERT into anarchist.documents
         ↓
   Handle conflicts (ON CONFLICT DO NOTHING)
         ↓
   Result: 24,599 documents in PostgreSQL
   Success rate: 99.8%
```

### Query Pipeline

```
User Query (e.g., "anarchism")
         ↓
   UnifiedSearchService.searchAll()
         ↓
   Parallel queries:
   - AnarchistService.search()
   - LibraryService.search()
         ↓
   Full-text GIN index lookup
         ↓
   Filter by language/category
         ↓
   Sort by relevance/recency
         ↓
   Combine results from both services
         ↓
   Add metadata (source, relevance)
         ↓
   Return to frontend
         ↓
   Results displayed to user
```

## Service Layer Implementation

### AnarchistService Class

**File:** `frontend/src/lib/anarchist/service.ts`

#### Constructor
```typescript
constructor() {
  this.LIBRARY_BASE_PATH = process.env.ANARCHIST_LIBRARY_PATH || '/app/anarchist-library';
  this.DEFAULT_LIMIT = 50;
  this.MAX_LIMIT = 500;
}
```

#### Core Methods

**1. getDocuments(params) - Flexible document retrieval**
```typescript
Parameters:
  - query: string (optional) - Full-text search query
  - language: string (optional) - Filter by ISO 639-1 code
  - category: string (optional) - Filter by category
  - author: string (optional) - Filter by author name
  - sort_by: 'title' | 'author' | 'publication_date' | 'created_at' | 'view_count'
  - sort_order: 'asc' | 'desc'
  - page: number (optional, default 1)
  - limit: number (optional, default 50, max 500)

Returns:
  AnarchistSearchResult {
    documents: AnarchistDocument[]
    total: number
    page: number
    limit: number
    has_more: boolean
  }

Query Example:
  Find Polish anarchist texts about syndicalism:
  getDocuments({
    language: 'pl',
    query: 'syndycalizm',
    sort_by: 'publication_date',
    sort_order: 'desc'
  })
```

**2. getDocumentBySlug(slug) - Load full document with content**
```typescript
Process:
  1. Query PostgreSQL for document metadata
  2. Load markdown file from Docker volume
  3. Parse YAML frontmatter
  4. Return combined document + content
  5. Increment view_count for tracking

Returns:
  AnarchistDocumentWithContent {
    ...AnarchistDocument properties
    content: string (full markdown content)
    frontmatter: Record<string, any> (parsed YAML)
  }
```

**3. search(query, limit) - Simple full-text search**
```typescript
Uses: GIN full-text index on (title || author || notes)
Returns: Top N results sorted by relevance
Performance: < 100ms for typical queries
```

**4. getDocumentsByLanguage(language) - Filter by language**
```typescript
Returns: All documents in specified language
Sorted: By title alphabetically
Useful: For language-specific browsing
```

**5. getAvailableLanguages() - Language discovery**
```typescript
Returns: Array of {
  code: string
  name: string
  document_count: number
}

Example Result:
  [
    { code: 'en', name: 'English', document_count: 14549 },
    { code: 'pl', name: 'Polish', document_count: 1597 },
    { code: 'ru', name: 'Russian', document_count: 1098 },
    ...
  ]
```

**6. getArchiveStats() - Overall statistics**
```typescript
Returns: {
  total_documents: 24599
  total_languages: 27
  total_authors: number
  oldest_publication: string
  newest_publication: string
  last_indexed: timestamp
}
```

**7. getRecentDocuments(limit) - Discovery feature**
```typescript
Returns: Most recently indexed documents
Useful: "New additions" feature
Default: Last 20 documents
```

**8. getMostViewedDocuments(limit) - Popularity tracking**
```typescript
Returns: Documents sorted by view_count DESC
Useful: "Most popular" feature
Requires: Incrementing view_count on each access
```

**9. getRelatedDocuments(documentId) - Discovery**
```typescript
Returns: Other documents by same author or language
Useful: "Related reading" feature
Algorithm: Find matches by author, then by language
```

**10. incrementViewCount(documentId) - Tracking**
```typescript
Updates: view_count += 1
Called: When document is viewed
Purpose: Popularity metrics
```

## UnifiedSearchService Integration

### Cross-Archive Search

```typescript
async searchAll(query: string, limit: number = 50): Promise<UnifiedSearchResult> {
  // 1. Query both services in parallel
  const [libraryResults, anarchistResults] = await Promise.all([
    libraryService.search(query, limit),
    anarchistService.search(query, limit)
  ]);

  // 2. Combine results
  const results = [
    ...libraryResults.map(r => ({ ...r, source: 'library' })),
    ...anarchistResults.map(r => ({ ...r, source: 'anarchist' }))
  ];

  // 3. Rank combined results
  results.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

  // 4. Return with metadata
  return {
    results: results.slice(0, limit),
    summary: {
      total: results.length,
      from_library: libraryResults.length,
      from_anarchist: anarchistResults.length,
      search_time_ms: Date.now() - startTime
    }
  };
}
```

## Database Indexes Strategy

### Full-Text Search Index
```sql
CREATE INDEX idx_anarchist_documents_fulltext
  ON anarchist.documents
  USING GIN (to_tsvector('english',
    title || ' ' || COALESCE(author, '') || ' ' || COALESCE(notes, '')
  ));
```

**Usage:** Fast keyword matching across title, author, notes
**Performance:** Typical queries < 100ms
**Cost:** ~10% of storage

### B-Tree Indexes
```sql
-- Fast exact matching and range queries
CREATE INDEX idx_anarchist_documents_slug ON anarchist.documents(slug);
CREATE INDEX idx_anarchist_documents_language ON anarchist.documents(language);
CREATE INDEX idx_anarchist_documents_category ON anarchist.documents(category);
CREATE INDEX idx_anarchist_documents_author ON anarchist.documents(author);
```

### Popularity Index
```sql
-- Fast "most viewed" queries
CREATE INDEX idx_anarchist_documents_view_count
  ON anarchist.documents(view_count DESC);
```

### Recency Index
```sql
-- Fast "recent additions" queries
CREATE INDEX idx_anarchist_documents_created_at
  ON anarchist.documents(created_at DESC);
```

## YAML Frontmatter Format

Each markdown file includes YAML frontmatter:

```yaml
---
title: The Conquest of Bread
author: Peter Kropotkin
date: 1892
language: en
source_url: https://theanarchistlibrary.org/library/peter-kropotkin-the-conquest-of-bread
topics:
  - anarchist-communism
  - economics
  - mutual-aid
  - production
archive: anarchist-library
original_format: muse
---

# Main content starts here...
```

**Fields Used by Service:**
- `title` - Document title
- `author` - Author/theorist name
- `date` - Publication date (parsed to publication_date)
- `language` - Language code (parsed to language field)
- `topics` - Tags/categories

## Docker Volume Configuration

### Setup
```yaml
# docker-compose.yml
volumes:
  anarchist-library:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/docker/volumes/anarchist-library/_data
```

### Access from Service Layer
```typescript
const filePath = path.join(
  process.env.ANARCHIST_LIBRARY_PATH || '/app/anarchist-library',
  document.file_path
);
const content = await fs.readFile(filePath, 'utf-8');
```

### File Structure
```
/var/lib/docker/volumes/anarchist-library/_data/
├── anarchist_library_texts_en/
│   ├── complete-works-of-pierre-joseph-proudhon.md
│   ├── the-conquest-of-bread.md
│   └── ... (14,549 files)
├── anarchist_library_texts_pl/
│   ├── rozprawy-z-zakresu-teorii-anarchistycznej.md
│   └── ... (1,597 files)
├── anarchist_library_texts_fr/
│   └── ... (970 files)
└── ... (27 language directories total)
```

## Error Handling & Edge Cases

### Missing Files
```typescript
// Service returns null content if file not found
if (!document) {
  return { ...metadata, content: null, error: 'File not found' };
}
```

### Database Errors
```typescript
// Caught by dbAdapter with proper error logging
try {
  const result = await dbAdapter.query(...);
} catch (error) {
  logger.error('Anarchist search failed', { error });
  return { documents: [], error: 'Database error' };
}
```

### Encoding Issues
```typescript
// YAML parser handles various encodings
const frontmatter = yaml.safeLoad(match[1], {
  json: true,
  onWarning: (error) => logger.warn('YAML warning', error)
});
```

## Performance Characteristics

### Query Performance
- **Simple search:** < 100ms
- **Complex filter:** 100-500ms
- **Full document load:** 50-200ms

### Index Performance
- **Full-text GIN:** Optimal for keyword search
- **B-tree indexes:** Fast for exact matching
- **No joins needed:** Denormalized schema design

### Caching Opportunities
- Language list: Cache for 24 hours
- Archive stats: Cache for 1 hour
- Popular documents: Cache for 1 hour
- Full-text results: Cache for 30 minutes

## Security Considerations

### SQL Injection Prevention
- All queries use parameterized statements ($1, $2, etc.)
- dbAdapter handles escaping

### XSS Prevention
- Markdown content rendered safely
- No unsafe HTML in frontmatter
- URL slugs validated

### Access Control
- No authentication required (public archive)
- Rate limiting (to be implemented)
- No file access outside volume

## Scalability Notes

### Current Capacity
- 24,599 documents: ✓ Optimal performance
- 27 languages: ✓ No issues
- Full-text search: ✓ GIN index efficient

### Scaling to 100,000+ documents
- ✓ PostgreSQL handles easily
- ✓ Index size grows but remains manageable
- ✓ Query time remains < 100ms
- Recommend: Connection pooling, caching layer

### Scaling to 500,000+ documents (Marxists.org)
- ✓ Identical schema design scales
- ✓ Create separate `marxist` schema (no conflicts)
- ✓ Unified search queries both schemas in parallel
- Consider: Separate indexes per schema, federation

## Technology Decisions & Rationale

### Why PostgreSQL?
- ✅ Full-text search with GIN indexes
- ✅ Schema-based organization
- ✅ ACID compliance
- ✅ Proven scalability
- ✅ Open source

### Why Docker Volume?
- ✅ Persists across container rebuilds
- ✅ Direct filesystem access
- ✅ Easy backup and migration
- ✅ No database row size limits
- ✅ Efficient for text content

### Why Hybrid Storage?
- ✅ Metadata (metadata) in database for fast queries
- ✅ Content (full text) on filesystem for flexibility
- ✅ Separates concerns properly
- ✅ Enables independent scaling

### Why dbAdapter Pattern?
- ✅ Unified interface for all queries
- ✅ Async/await support
- ✅ Connection pooling
- ✅ Error handling
- ✅ Future database agnostic

---

See `SERVICE_LAYER_IMPLEMENTATION.md` for complete method documentation.
