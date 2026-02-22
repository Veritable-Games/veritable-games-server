# Library Feature Documentation

**Last Updated**: November 6, 2025
**Status**: ✅ Production-Ready
**Database**: `library.db` (SQLite development) / PostgreSQL (production)

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Facts](#quick-facts)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [Service Layer](#service-layer)
6. [API Endpoints](#api-endpoints)
7. [UI Components](#ui-components)
8. [Features](#features)
9. [Search System](#search-system)
10. [Tag System](#tag-system)
11. [Collections System](#collections-system)
12. [Annotations](#annotations)
13. [Security](#security)
14. [Performance](#performance)
15. [Testing](#testing)
16. [Troubleshooting](#troubleshooting)

---

## Overview

The Library system provides document management capabilities for the Veritable Games platform. It allows users to create, organize, search, and annotate documents with full-text search, tagging, and collections.

**Key Characteristics**:
- Completely separate from Wiki system (different database, services, UI)
- Full-text search with FTS5
- Tag-based organization with 4 category types
- Document collections for grouping
- Inline annotations support
- Production-ready with comprehensive testing

---

## Quick Facts

| Aspect | Details |
|--------|---------|
| **Status** | Fully Functional (Production-Ready) |
| **Database** | `library.db` (SQLite dev) / PostgreSQL (production) |
| **Documents** | ~19 as of October 2025 |
| **Tech Stack** | Next.js 15 + React 19 + TypeScript + better-sqlite3 |
| **Service Layer** | LibraryService (773 lines) |
| **API Routes** | 6 routes, 11 endpoints |
| **UI Components** | 12+ components |
| **Search** | FTS5 full-text search (5-30ms queries) |
| **Migration Status** | ✅ PostgreSQL migration complete |

---

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────┐
│                   Library System                     │
├─────────────────────────────────────────────────────┤
│  UI Layer (React 19 Components)                     │
│  ├── DocumentList                                   │
│  ├── DocumentEditor                                 │
│  ├── SearchInterface                                │
│  ├── TagManager                                     │
│  └── AnnotationPanel                                │
├─────────────────────────────────────────────────────┤
│  API Layer (Next.js 15 App Router)                  │
│  ├── /api/library/documents                         │
│  ├── /api/library/search                            │
│  ├── /api/library/tags                              │
│  └── /api/library/collections                       │
├─────────────────────────────────────────────────────┤
│  Service Layer                                      │
│  └── LibraryService (CRUD, search, tags, etc.)     │
├─────────────────────────────────────────────────────┤
│  Database Layer (library.db)                        │
│  ├── library_documents (main content)              │
│  ├── library_search_fts (FTS5 virtual table)       │
│  ├── library_tags (tag definitions)                │
│  ├── library_collections (grouping)                │
│  └── library_annotations (inline notes)            │
└─────────────────────────────────────────────────────┘
```

### Key Principles

1. **Separation from Wiki**: Completely independent system with own database
2. **Service-Based**: All database access through LibraryService
3. **Search-First**: FTS5 enables fast full-text search
4. **Flexible Tagging**: 4 category types for different tag purposes
5. **Type-Safe**: Comprehensive TypeScript types throughout

---

## Database Schema

### Tables (8 Total)

#### 1. `library_documents` (Main Content)
```sql
CREATE TABLE library_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT,
  author_id INTEGER NOT NULL,
  visibility TEXT DEFAULT 'public',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id)
);
```

**Records**: ~19 documents
**Purpose**: Primary storage for library documents

#### 2. `library_search_fts` (Virtual Table - FTS5)
```sql
CREATE VIRTUAL TABLE library_search_fts USING fts5(
  title,
  content,
  content='library_documents',
  content_rowid='id'
);
```

**Purpose**: Full-text search index (auto-synced with library_documents)
**Performance**: 5-30ms search queries

#### 3. `library_tags`
```sql
CREATE TABLE library_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  category_id INTEGER,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES library_tag_categories(id)
);
```

**Records**: ~50 tags (estimated)
**Purpose**: Individual tag definitions

#### 4. `library_tag_categories`
```sql
CREATE TABLE library_tag_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT
);
```

**Records**: 4 categories
**Purpose**: Organize tags into types (Topic, Format, Difficulty, Status)

#### 5. `library_categories`
```sql
CREATE TABLE library_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  parent_id INTEGER,
  FOREIGN KEY (parent_id) REFERENCES library_categories(id)
);
```

**Purpose**: Hierarchical document categorization

#### 6. `library_document_tags` (Junction)
```sql
CREATE TABLE library_document_tags (
  document_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (document_id, tag_id),
  FOREIGN KEY (document_id) REFERENCES library_documents(id),
  FOREIGN KEY (tag_id) REFERENCES library_tags(id)
);
```

**Purpose**: Many-to-many relationship between documents and tags

#### 7. `library_document_categories` (Junction)
```sql
CREATE TABLE library_document_categories (
  document_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY (document_id, category_id),
  FOREIGN KEY (document_id) REFERENCES library_documents(id),
  FOREIGN KEY (category_id) REFERENCES library_categories(id)
);
```

**Purpose**: Many-to-many relationship between documents and categories

#### 8. `library_collections`
```sql
CREATE TABLE library_collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**Purpose**: Group related documents into collections

### Database Indexes

```sql
CREATE INDEX idx_library_documents_author ON library_documents(author_id);
CREATE INDEX idx_library_documents_slug ON library_documents(slug);
CREATE INDEX idx_library_documents_created ON library_documents(created_at);
CREATE INDEX idx_library_tags_category ON library_tags(category_id);
```

**Purpose**: Optimize common queries

---

## Service Layer

### LibraryService

**Location**: `frontend/src/lib/library/service.ts`
**Size**: 773 lines
**Database**: Uses `dbPool.getConnection('library')`

#### Core Methods

**Document CRUD**:
```typescript
getDocuments(options?: QueryOptions): Document[]
getDocumentBySlug(slug: string): Document | null
getDocumentById(id: number): Document | null
createDocument(data: CreateDocumentDTO): Document
updateDocument(id: number, data: UpdateDocumentDTO): Document
deleteDocument(id: number): void
```

**Search**:
```typescript
searchDocuments(query: string, options?: SearchOptions): SearchResult[]
// Uses FTS5 for full-text search
// Returns ranked results with snippets
```

**Tags**:
```typescript
getTags(): Tag[]
getTagsByCategory(categoryId: number): Tag[]
createTag(data: CreateTagDTO): Tag
addTagToDocument(documentId: number, tagId: number): void
removeTagFromDocument(documentId: number, tagId: number): void
getDocumentTags(documentId: number): Tag[]
```

**Collections**:
```typescript
getCollections(): Collection[]
createCollection(data: CreateCollectionDTO): Collection
addDocumentToCollection(documentId: number, collectionId: number): void
getCollectionDocuments(collectionId: number): Document[]
```

**Annotations**:
```typescript
getAnnotations(documentId: number): Annotation[]
createAnnotation(data: CreateAnnotationDTO): Annotation
updateAnnotation(id: number, data: UpdateAnnotationDTO): Annotation
deleteAnnotation(id: number): void
```

---

## API Endpoints

### Document Management

**List Documents**
```typescript
GET /api/library/documents
Query: ?page=1&limit=20&search=query&tags=1,2,3

Response:
{
  success: true,
  data: {
    documents: Document[],
    pagination: { page, limit, total, pages }
  }
}
```

**Get Single Document**
```typescript
GET /api/library/documents/[slug]

Response:
{
  success: true,
  data: {
    document: Document,
    tags: Tag[],
    collections: Collection[]
  }
}
```

**Create Document**
```typescript
POST /api/library/documents
Body: { title, content, tags?, categories? }

Response:
{
  success: true,
  data: { document: Document }
}
```

**Update Document**
```typescript
PUT /api/library/documents/[slug]
Body: { title?, content?, tags?, categories? }

Response:
{
  success: true,
  data: { document: Document }
}
```

**Delete Document**
```typescript
DELETE /api/library/documents/[slug]

Response:
{
  success: true,
  message: "Document deleted"
}
```

### Search

**Search Documents**
```typescript
GET /api/library/search?q=query&page=1&limit=20

Response:
{
  success: true,
  data: {
    results: SearchResult[],
    query: string,
    pagination: PaginationData
  }
}
```

### Tags

**List Tags**
```typescript
GET /api/library/tags?category=1

Response:
{
  success: true,
  data: { tags: Tag[] }
}
```

**Create Tag**
```typescript
POST /api/library/tags
Body: { name, category_id?, description? }

Response:
{
  success: true,
  data: { tag: Tag }
}
```

### Collections

**List Collections**
```typescript
GET /api/library/collections

Response:
{
  success: true,
  data: { collections: Collection[] }
}
```

**Create Collection**
```typescript
POST /api/library/collections
Body: { name, description? }

Response:
{
  success: true,
  data: { collection: Collection }
}
```

---

## UI Components

### Document Components

**DocumentList** (`components/library/DocumentList.tsx`)
- Displays paginated list of documents
- Search bar integration
- Tag filtering
- Responsive grid layout

**DocumentCard** (`components/library/DocumentCard.tsx`)
- Thumbnail view of document
- Title, excerpt, tags
- Author and date information
- Quick actions (view, edit, delete)

**DocumentEditor** (`components/library/DocumentEditor.tsx`)
- Rich text editor for document content
- Title and slug editing
- Tag selection
- Category assignment
- Save/cancel actions

**DocumentViewer** (`components/library/DocumentViewer.tsx`)
- Read-only document display
- Formatted content rendering
- Annotation sidebar
- Related documents section

### Search Components

**SearchBar** (`components/library/SearchBar.tsx`)
- Real-time search input
- Debounced queries (300ms)
- Search suggestions
- Clear button

**SearchResults** (`components/library/SearchResults.tsx`)
- Displays search results
- Highlighted snippets
- Relevance ranking
- Result count

### Tag Components

**TagManager** (`components/library/TagManager.tsx`)
- Create new tags
- Edit existing tags
- Organize by category
- Bulk operations

**TagSelector** (`components/library/TagSelector.tsx`)
- Multi-select tag picker
- Category-based filtering
- Search tags by name
- Create new tags inline

**TagCloud** (`components/library/TagCloud.tsx`)
- Visual tag display
- Size based on usage count
- Clickable for filtering
- Color-coded by category

### Collection Components

**CollectionList** (`components/library/CollectionList.tsx`)
- Display all collections
- Document count per collection
- Sort and filter options

**CollectionView** (`components/library/CollectionView.tsx`)
- View collection details
- List documents in collection
- Add/remove documents
- Edit collection metadata

---

## Features

### 1. Full-Text Search (FTS5)

**Implementation**:
- SQLite FTS5 virtual table
- Auto-synced with main documents table
- Porter stemming for better matching
- Ranked results by relevance

**Search Syntax**:
```
"exact phrase"        - Exact match
term1 OR term2        - Either term
term1 AND term2       - Both terms
-excluded             - Exclude term
prefix*               - Prefix matching
```

**Performance**: 5-30ms for typical queries

### 2. Tag System

**4 Tag Categories**:
1. **Topic** - Subject matter (e.g., "Architecture", "Performance")
2. **Format** - Document type (e.g., "Tutorial", "Reference")
3. **Difficulty** - Complexity level (e.g., "Beginner", "Advanced")
4. **Status** - Document state (e.g., "Draft", "Published")

**Features**:
- Multiple tags per document
- Hierarchical categories
- Tag-based filtering
- Tag creation on-the-fly

### 3. Collections

**Purpose**: Group related documents together

**Use Cases**:
- Course materials
- Project documentation
- Reference guides
- Learning paths

**Features**:
- Named collections
- Description/metadata
- Order documents within collection
- Share collections

### 4. Annotations

**Types**:
- Inline comments
- Highlights
- Corrections
- Suggestions

**Features**:
- Position-based anchoring
- Reply threads
- Resolve/unresolve
- Author attribution

### 5. Visibility Control

**Levels**:
- `public` - Everyone can view
- `unlisted` - Only with direct link
- `private` - Author only
- `shared` - Specific users

---

## Search System

### FTS5 Configuration

**Tokenizer**: Porter stemming
**Index**: Title + content
**Sync**: Automatic via triggers
**Ranking**: BM25 algorithm

### Search Features

1. **Full-text search** across title and content
2. **Boolean operators** (AND, OR, NOT)
3. **Phrase matching** with quotes
4. **Prefix matching** with asterisk
5. **Ranking** by relevance
6. **Snippets** with highlighted matches
7. **Pagination** for large result sets

### Search Query Examples

```typescript
// Simple search
searchDocuments("react hooks")

// Boolean AND
searchDocuments("react AND hooks")

// Phrase search
searchDocuments('"server components"')

// Exclude terms
searchDocuments("react -class")

// Prefix matching
searchDocuments("optim*")  // Matches optimize, optimization, etc.
```

### Performance Optimization

- Index maintained automatically
- Query caching in LibraryService
- Debounced search input (300ms)
- Pagination to limit results
- EXPLAIN QUERY PLAN for optimization

---

## Tag System

### Tag Categories

**1. Topic Tags**
- Purpose: Subject classification
- Examples: "React", "TypeScript", "Database", "Security"
- Count: ~20 tags

**2. Format Tags**
- Purpose: Document type
- Examples: "Tutorial", "Reference", "Guide", "API Docs"
- Count: ~8 tags

**3. Difficulty Tags**
- Purpose: Complexity level
- Examples: "Beginner", "Intermediate", "Advanced", "Expert"
- Count: 4 tags

**4. Status Tags**
- Purpose: Document lifecycle
- Examples: "Draft", "Review", "Published", "Archived"
- Count: 4 tags

### Tag Management

**Creating Tags**:
```typescript
const tag = await createTag({
  name: "Performance",
  category_id: 1, // Topic category
  description: "Performance optimization techniques"
});
```

**Applying Tags**:
```typescript
// Add tag to document
await addTagToDocument(documentId, tagId);

// Multiple tags at once
await setDocumentTags(documentId, [tagId1, tagId2, tagId3]);
```

**Tag Filtering**:
```typescript
// Filter documents by single tag
const docs = await getDocuments({ tagId: 5 });

// Filter by multiple tags (AND)
const docs = await getDocuments({ tagIds: [5, 8, 12] });
```

---

## Collections System

### Collection Structure

```typescript
interface Collection {
  id: number;
  name: string;
  description: string;
  created_by: number;
  created_at: string;
  document_count: number;
}
```

### Collection Operations

**Create Collection**:
```typescript
const collection = await createCollection({
  name: "React Patterns",
  description: "Common React design patterns and best practices"
});
```

**Add Documents**:
```typescript
await addDocumentToCollection(documentId, collectionId);
```

**Retrieve Collection Documents**:
```typescript
const documents = await getCollectionDocuments(collectionId);
```

---

## Annotations

### Annotation Types

1. **Comment** - General feedback
2. **Highlight** - Mark important text
3. **Correction** - Suggest fixes
4. **Question** - Ask for clarification

### Annotation Structure

```typescript
interface Annotation {
  id: number;
  document_id: number;
  user_id: number;
  content: string;
  type: 'comment' | 'highlight' | 'correction' | 'question';
  position: {
    start: number;
    end: number;
  };
  created_at: string;
  resolved: boolean;
}
```

### Usage

```typescript
// Create annotation
const annotation = await createAnnotation({
  document_id: 5,
  content: "This section could use more examples",
  type: "comment",
  position: { start: 1240, end: 1380 }
});

// Resolve annotation
await updateAnnotation(annotationId, { resolved: true });
```

---

## Security

### Authentication
- All endpoints require authentication
- Session-based auth via getCurrentUser()
- CSRF protection on mutations

### Authorization
- Document ownership checks
- Visibility enforcement
- Collection access control
- Annotation permissions

### Input Validation
- Zod schemas for all inputs
- Content sanitization (DOMPurify)
- SQL injection prevention (prepared statements)
- XSS prevention (React escaping + DOMPurify)

---

## Performance

### Query Optimization
- Database indexes on common columns
- FTS5 for fast text search (5-30ms)
- Pagination to limit result sets
- Connection pooling (max 50 connections)

### Caching Strategy
- Service-level caching for frequent queries
- Cache invalidation on mutations
- ETags for HTTP caching
- Static asset optimization

### Best Practices
- Use `getDocuments()` with pagination, not `getAllDocuments()`
- Filter with tags/categories to reduce result sets
- Debounce search inputs (300ms)
- Use FTS5 search, not LIKE queries

---

## Testing

### Test Coverage

**Unit Tests**: `__tests__/library/service.test.ts`
- LibraryService methods
- CRUD operations
- Search functionality
- Tag management

**Integration Tests**: `__tests__/library/api.test.ts`
- API endpoints
- Authentication
- Error handling
- Edge cases

**E2E Tests**: `e2e/library.spec.ts`
- User workflows
- Document creation flow
- Search functionality
- Collection management

### Running Tests

```bash
# Unit tests
npm test library

# Integration tests
npm test -- --testPathPattern=api

# E2E tests
npm run test:e2e library
```

---

## Troubleshooting

### Common Issues

**Issue: Search returns no results**
- Check FTS5 index: `SELECT * FROM library_search_fts;`
- Verify triggers are active
- Rebuild index if needed

**Issue: Slow queries**
- Check indexes: `.schema library_documents`
- Use EXPLAIN QUERY PLAN
- Add pagination if fetching all documents

**Issue: Tags not appearing**
- Verify tag category exists
- Check junction table: `library_document_tags`
- Ensure proper foreign key relationships

**Issue: Annotations position incorrect**
- Verify position calculation (character-based, not byte-based)
- Check for HTML vs plain text content
- Ensure consistent content encoding

---

## Migration Notes

### SQLite → PostgreSQL Migration

**Status**: ✅ Complete (October 30, 2025)

**Changes**:
- FTS5 → PostgreSQL full-text search
- Auto-increment → SERIAL
- DATETIME → TIMESTAMP
- Triggers adapted for PostgreSQL syntax

**Migration Script**: `scripts/migrate-library-to-postgres.js`

**Data Integrity**: 100% (19 documents migrated successfully)

---

## Related Documentation

- [docs/DATABASE.md](../DATABASE.md) - Database architecture
- [docs/api/README.md](../api/README.md) - API reference
- [docs/REACT_PATTERNS.md](../REACT_PATTERNS.md) - React patterns used
- [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - Common fixes

---

## Changelog

**October 2025**:
- PostgreSQL migration complete
- Production deployment verified
- Updated documentation

**Previous versions archived in**:
- `docs/archive/features/library/` (historical reference)

---

**Last Updated**: November 6, 2025
**Status**: ✅ Production-Ready
**Version**: 1.0
