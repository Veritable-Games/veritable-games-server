# Library System: Complete Overview

**Last Updated**: 2025-12-29

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [File Structure](#file-structure)
3. [Data Models](#data-models)
4. [API Endpoints](#api-endpoints)
5. [React Components](#react-components)
6. [State Management](#state-management)
7. [Features & Capabilities](#features--capabilities)
8. [Technical Patterns](#technical-patterns)
9. [Data Flow](#data-flow)
10. [Performance Optimizations](#performance-optimizations)
11. [Statistics](#statistics)

---

## System Architecture

### Core Concept: Unified Dual-Collection System

The library system is built on a **unified architecture** that seamlessly integrates two separate document sources into a single search interface:

```
┌─────────────────────────────────────────────────────┐
│         Unified Document Service                     │
│  (Bridges Library + Anarchist Collections)           │
└──────────────┬──────────────────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
    ┌───▼────┐    ┌──▼────┐
    │ Library │    │ Anarchist
    │ Schema  │    │ Schema
    └────────┘    └────────┘
        │             │
    ┌───▼────┐    ┌──▼────┐
    │PostgreSQL   (3,859)  (24,643)
    └────┬───┘    │
         └────┬───┘
              │
         File Storage
        (Markdown files)
```

### The Three Core Services

#### 1. UnifiedDocumentService (`src/lib/documents/service.ts`)
- **Purpose**: Orchestrates queries across both document sources
- **Mode**: Singleton that runs queries in parallel
- **Functions**:
  - `getDocuments()` - Paginated results from both sources
  - `getDocumentCount()` - Count-only endpoint for virtual scrolling
  - `getDocumentBySlug()` - Single document with full content
  - `getAllDocuments()` - Uncached full result set
  - `getLanguages()` - Available languages with counts
  - `getTranslationGroup()` - All language versions of a document
  - `searchDocuments()` - Full-text search across both sources
  - `searchByTags()` - Tag-based filtering
- **Key Features**:
  - Merges and deduplicates results
  - Handles translation groups across both sources
  - In-memory caching (5-minute TTL for full lists, 1-hour for metadata)
  - Parallel queries for performance
  - Fallback logic for missing data

#### 2. LibraryService (`src/lib/library/service.ts`)
- **Purpose**: Manages library-specific documents
- **Source**: PostgreSQL `library` schema (3,859 documents)
- **Features**:
  - Full-text search: title, author, description, content
  - File-based storage (all documents migrated to markdown)
  - Dual-read logic: filesystem-first, DB fallback
  - Tag management via `library_document_tags` junction table
  - Visibility filtering (`is_public` boolean field)
  - Role-based access control (admin/moderator see all)
  - View count tracking
- **File Storage**: Documents stored as markdown files in directory specified by `LIBRARY_DOCUMENTS_PATH` env var

#### 3. AnarchistService (`src/lib/anarchist/service.ts`)
- **Purpose**: Manages the global anarchist archive
- **Source**: PostgreSQL `anarchist` schema (24,643 documents)
- **Features**:
  - Supports 27+ languages
  - Content stored as markdown files in Docker volume
  - Original format conversion: `.muse` → markdown
  - YAML frontmatter parsing for metadata
  - Tags via `anarchist_document_tags` junction table
  - Visibility control for private documents
  - Multilingual content retrieval

---

## File Structure

### Pages (Next.js App Router)

| Path | Purpose | Type |
|------|---------|------|
| `src/app/library/page.tsx` | Library list page with SSR | Server Component |
| `src/app/library/LibraryPageClient.tsx` | Interactive filters & infinite scroll | Client Component |
| `src/app/library/[slug]/page.tsx` | Document detail page | Server Component |
| `src/app/library/[slug]/edit/page.tsx` | Document editing interface | Server Component |
| `src/app/library/[slug]/history/page.tsx` | Document revision history | Server Component |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/documents` | GET | Unified search with pagination |
| `/api/documents/count` | GET | Count-only endpoint (virtual scroll) |
| `/api/documents/[slug]` | GET | Single document detail |
| `/api/documents/languages` | GET | Available languages with counts |
| `/api/documents/unified` | GET | Alternative unified endpoint |
| `/api/documents/[slug]/translations` | GET | Translation groups for a document |
| `/api/documents/anarchist/[slug]` | GET | Anarchist document detail |
| `/api/library/tags` | GET | All available tags with usage counts |

### Services (Business Logic)

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/documents/service.ts` | 814 | Unified document orchestration |
| `src/lib/library/service.ts` | 838 | Library-specific operations |
| `src/lib/anarchist/service.ts` | 754 | Anarchist archive operations |
| `src/lib/library/file-service.ts` | ~200 | File I/O for documents |
| `src/lib/documents/types.ts` | ~150 | Unified type definitions |
| `src/lib/documents/constants.ts` | ~50 | Pagination and limits |

### Components (15 total)

| Component | Purpose |
|-----------|---------|
| `DocumentCard.tsx` | Grid card display with selection |
| `DocumentCardSkeleton.tsx` | Loading placeholder |
| `TagFilterSidebar.tsx` | Language/tag filtering UI |
| `LibraryListView.tsx` | Alternative list-mode display |
| `LibraryDocumentClient.tsx` | Detail page wrapper |
| `LibraryDocumentContentClient.tsx` | Content renderer |
| `LibraryTextEditor.tsx` | Document editor |
| `CreateDocumentModal.tsx` | New document dialog |
| `SelectionToolbar.tsx` | Multi-select batch operations |
| `LibrarySelectionCounterBar.tsx` | Selection count display |
| `LibraryMouseFollowingCounter.tsx` | Interactive selection counter |
| `LibraryAnnotationOverlay.tsx` | Notes/annotations overlay |
| `LanguageFilter.tsx` | Language dropdown filter |
| `JumpToDocument.tsx` | Quick search/jump |
| `ScrollPositionIndicator.tsx` | Scroll progress visual |

### Custom Hooks

| Hook | Purpose |
|------|---------|
| `useLibraryPreferences.ts` | localStorage-based scroll position & sort preferences |
| `useVirtualizedDocuments.ts` | Virtual scroll cache & range-based fetching |
| `useLibraryEditor.ts` | Document editing state management |

### State Management

| Store | Purpose |
|-------|---------|
| `src/lib/stores/documentSelectionStore.ts` | Zustand store for multi-document selection |

---

## Data Models

### Unified Document Type

```typescript
interface UnifiedDocument {
  id: number | string
  source: 'library' | 'anarchist'
  slug: string
  title: string
  titleEnglish?: string
  author?: string
  language: string // ISO 639-1 code (e.g., 'en', 'es', 'fr')
  publication_date?: string
  document_type?: string
  description?: string // Maps to 'notes' for anarchist
  view_count: number
  created_at: string
  updated_at: string
  tags?: UnifiedTag[]
  translation_group_id?: string
  available_languages?: string[]
  is_public?: boolean
  content?: string
  file_path?: string
}
```

### Library Schema

**Table: `library.library_documents`**
```sql
id (PRIMARY KEY)
slug (UNIQUE)
title
author
publication_date
document_type
notes (description)
language (ISO 639-1)
content (deprecated, now file_path)
file_path (markdown file location)
created_by (user ID)
created_at
updated_at
view_count
is_public (boolean)
reconversion_status
translation_group_id
```

**Table: `library.library_document_tags`**
```sql
document_id (FK)
tag_id (FK)
added_by (user ID)
added_at
```

### Anarchist Schema

**Table: `anarchist.documents`**
```sql
id (PRIMARY KEY)
slug (UNIQUE)
title
title_english
author
publication_date
document_type
notes (description)
language (ISO 639-1)
file_path (markdown file location)
original_format ('muse')
view_count
is_public
translation_group_id
created_at
updated_at
```

**Table: `anarchist.document_tags`**
```sql
document_id (FK)
tag_id (FK)
```

### Shared Schema

**Table: `shared.tags`**
```sql
id (PRIMARY KEY)
name (UNIQUE)
usage_count
created_at
```

---

## API Endpoints

### GET /api/documents - Unified Search

**Purpose**: Main search endpoint combining both sources

**Query Parameters**:
- `query` (string) - Full-text search term
- `language` (string | string[]) - ISO 639-1 code(s)
- `tags` (string[]) - Tag names to filter by
- `source` ('library' | 'anarchist' | 'all') - Which source(s) to search
- `sort_by` (string) - Field to sort by (default: 'title')
- `sort_order` ('asc' | 'desc') - Sort direction (default: 'asc')
- `page` (number) - 1-indexed page number
- `limit` (number) - Results per page (default: 50, max: 5000)
- `offset` (number) - Alternative to page-based pagination

**Response**:
```typescript
{
  documents: UnifiedDocument[]
  pagination: {
    current_page: number
    page_size: number
    total_documents: number
    total_pages: number
    has_more: boolean
  }
  filters_applied: {
    query?: string
    languages?: string[]
    tags?: string[]
    source?: string
  }
  search_time_ms: number
}
```

**Performance**:
- Runs queries against both sources in parallel
- Deduplicates results by slug
- Applies stable sorting with tiebreakers
- Cached results (5-minute TTL)

### GET /api/documents/count - Count Only

**Purpose**: Get document count for virtual scrolling setup

**Query Parameters**:
- `query` (string) - Optional search filter
- `language` (string) - Optional language filter
- `tags` (string[]) - Optional tag filter
- `source` (string) - Optional source filter

**Response**:
```typescript
{
  total: number
  library_count: number
  anarchist_count: number
}
```

**Performance**: No document content fetched, counts only

### GET /api/documents/[slug] - Single Document

**Purpose**: Retrieve a specific document with full content

**Path Parameters**:
- `slug` - Document slug (auto-detects source)

**Response**:
- Full UnifiedDocument with content loaded
- Increments view_count asynchronously
- Returns 404 if document not found

### GET /api/documents/languages - Language Info

**Purpose**: Get all available languages with document counts

**Response**:
```typescript
{
  languages: Array<{
    code: string              // ISO 639-1
    name: string              // e.g., "Spanish"
    document_count: number
    from_library: number
    from_anarchist: number
  }>
}
```

**Sorting**: By document_count descending, then by language name

### GET /api/documents/unified - Alternative Unified Endpoint

**Purpose**: Alternative to page-based pagination

**Query Parameters**:
- All parameters from `/api/documents`
- `all=true` - Fetch all documents without pagination (up to API_MAX_LIMIT)

**Response**: Same format as `/api/documents`

### GET /api/documents/[slug]/translations - Translation Groups

**Purpose**: Get all language versions of a document

**Path Parameters**:
- `slug` - Document slug

**Response**:
```typescript
{
  translation_group_id: string
  documents: Array<{
    slug: string
    language: string
    title: string
    source: 'library' | 'anarchist'
  }>
}
```

### GET /api/library/tags - Tag List

**Purpose**: Get all tags actually used by documents

**Query Parameters**:
- `language` (string) - Optional filter by language
- `search` (string) - Optional search in tag names

**Response**:
```typescript
{
  tags: Array<{
    name: string
    usage_count: number
    from_library: number
    from_anarchist: number
  }>
}
```

**Features**:
- Respects visibility (hides private docs for non-admins)
- Sorted by usage_count DESC, then by name
- Only returns tags with at least 1 document

---

## React Components

### Page Structure

#### LibraryPage (Server Component)
- Fetches initial data server-side (first 200 documents)
- Retrieves all tags from `/api/library/tags`
- 5-minute ISR revalidation
- Passes initial state to client component

#### LibraryPageClient (Client Component)
- Manages interactive filters:
  - Search query
  - Selected tags (multi-select)
  - Language filter
  - Source filter (library/anarchist/all)
  - Sort field and order
- Implements infinite scroll with react-virtuoso
- Toggles between grid and list view modes
- Refetches data when filters change
- Persists preferences to localStorage

### Virtual Scrolling

**Grid View** (default):
- Fixed item height: 240px
- Overscan buffer: 2000px
- Card display with overflow truncation

**List View**:
- Variable item height
- Expandable rows
- Alternative to grid layout

**Performance**:
- Sparse loading: fetches ranges as needed
- `useVirtualizedDocuments` hook manages cache
- Map-based cache for O(1) lookups
- Parallel page fetching (batch size: 10)
- Abort controller for request cancellation
- Cache eviction by distance from scroll center

### DocumentCard Component

**Display**:
- Title (truncated to 2 lines)
- Author
- Language code badge
- Document type badge
- Source badge (Library/Anarchist)
- Tag pills
- Preview text (first 150 chars of content)

**Interactions**:
- Click: navigate to detail page
- Ctrl+Click: toggle selection
- Shift+Click: range selection
- Selection state via Zustand store

**Styling**:
- 240px fixed height
- overflow:hidden for cards
- Responsive padding
- Hover effects for interactivity

### TagFilterSidebar Component

**Language Filter Section**:
- Dropdown or expandable list
- Shows document count per language
- Multi-select support
- Clear all option

**Tag Filter Section**:
- Checkbox list of tags
- Sorted by usage_count DESC, then by name
- Shows usage count in parentheses
- Mobile: collapsible on small screens
- Admin features: Delete key to remove tags

**Features**:
- Dynamically generated from `/api/documents/languages`
- Updates counts based on search results
- Click to apply/remove filters
- Visual indicator of active filters

### Document Detail Components

**LibraryDocumentClient**:
- Server-side rendered detail page wrapper
- Handles not-found errors
- Passes content to content renderer

**LibraryDocumentContentClient**:
- Renders document content (markdown)
- Displays metadata (author, date, language, tags)
- Translation switcher
- View count display
- Edit/delete buttons (for authors)

**LibraryTextEditor**:
- Edit mode for document content
- Markdown syntax highlighting
- Save and cancel buttons
- Metadata editing (title, author, etc.)

### Selection Components

**SelectionToolbar**:
- Shows batch operations (delete, export, move, etc.)
- Only visible when documents are selected
- Fixed position above/below content

**LibrarySelectionCounterBar**:
- Shows selected document count
- "Select All" / "Clear Selection" buttons
- Percentage indicator

**LibraryMouseFollowingCounter**:
- Interactive counter following mouse
- Shows on hover of document cards
- Dynamic position based on cursor

---

## State Management

### Client-Side State (LibraryPageClient)

```typescript
// Filter & Sort State
const [searchQuery, setSearchQuery] = useState('')
const [selectedTags, setSelectedTags] = useState<string[]>([])
const [selectedLanguage, setSelectedLanguage] = useState('all')
const [selectedSource, setSelectedSource] = useState<'all' | 'library' | 'anarchist'>('all')
const [sortBy, setSortBy] = useState('title')
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

// View & Display State
const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
const [documents, setDocuments] = useState<UnifiedDocument[]>([])
const [tags, setTags] = useState<Tag[]>([])

// Pagination & Loading State
const [currentPage, setCurrentPage] = useState(1)
const [totalDocuments, setTotalDocuments] = useState(0)
const [hasMore, setHasMore] = useState(true)
const [isLoadingMore, setIsLoadingMore] = useState(false)
```

### Persistence

**localStorage Key**: `library-preferences`
```typescript
{
  scrollPosition: number        // Scroll Y offset
  sortBy: string               // Field name
  sortOrder: 'asc' | 'desc'    // Direction
  viewMode: 'grid' | 'list'    // Display mode
}
```

**Debouncing**: 500ms debounce on scroll position saves

### Zustand Store: useDocumentSelectionStore

```typescript
interface DocumentSelectionState {
  selectedDocumentIds: Set<string>
  lastSelectedIndex: number | null

  // Methods
  toggleDocumentSelection(docId: string, index?: number): void
  selectWithShift(clickedIndex: number, documents: UnifiedDocument[]): void
  clearSelection(): void
  selectMultipleDocuments(docIds: string[]): void
  selectAllDocuments(documents: UnifiedDocument[]): void
}
```

**Features**:
- Persistent across component re-renders
- Supports Ctrl+Click toggle
- Supports Shift+Click range selection
- Integration with DocumentCard component

---

## Features & Capabilities

### Search & Filtering

| Feature | Implementation |
|---------|-----------------|
| Full-text search | Queries title, author, description, content across both sources |
| Language filtering | Single or multi-select with document counts |
| Tag-based filtering | Multiple tags with AND logic (all selected tags must match) |
| Source filtering | Library-only, anarchist-only, or both sources |
| Visibility | Admins see all; regular users see only public documents |
| Deduplication | Prevents same document appearing twice in results |

**Search Performance**:
- Parallel queries to both sources
- Cached results (5-minute TTL)
- Full-text index on PostgreSQL
- Typical response: <100ms

### Sorting Options

- **By Title** (default): A-Z or Z-A
- **By Author**: Alphabetical sorting
- **By Publication Date**: Chronological or reverse
- **By Created Date**: Most recent or oldest first
- **By View Count**: Most viewed or least viewed first
- **By Source**: Library-first or anarchist-first (tiebreaker)

**Stable Sorting**: Tiebreakers prevent inconsistent results with same values

### Pagination

**Page-Based**:
```
/api/documents?page=1&limit=50
/api/documents?page=2&limit=50
```

**Offset-Based**:
```
/api/documents?offset=0&limit=50
/api/documents?offset=50&limit=50
```

**Infinite Scroll**:
- `useVirtualizedDocuments` hook manages sparse loading
- Fetches pages on-demand as user scrolls
- No cumulative page limitations
- Total count obtained upfront from `/api/documents/count`

**Limits**:
- Default limit: 50
- Maximum limit: 5000
- Initial SSR load: 200 documents

### Translation Support

| Feature | Details |
|---------|---------|
| Language codes | ISO 639-1 (en, es, fr, de, ja, zh, etc.) |
| Translation groups | Same document in multiple languages linked |
| Language switcher | On detail page to view other versions |
| Language counts | Per-language statistics in `/api/documents/languages` |
| Multilingual content | Full-text search across all languages |

**Implementation**:
- `translation_group_id` field links translations
- `/api/documents/[slug]/translations` endpoint lists all versions
- Detail page includes language switcher
- Language-specific filtering in library page

### Multi-Document Selection

| Operation | Interaction |
|-----------|-------------|
| Single toggle | Ctrl+Click on card |
| Range select | Shift+Click on two cards |
| Select all | Button in selection toolbar |
| Clear selection | Button in selection toolbar |
| Selection counter | Shows count and percentage |

**Batch Operations** (when documents selected):
- Delete selected
- Export to CSV/JSON
- Move to different collection
- Add tags to all selected
- Change visibility (public/private)

### Content Display Modes

**Grid View** (default):
- Card-based layout
- 240px fixed height
- Title, author, language, type, tags visible
- Preview text truncated
- Responsive columns

**List View**:
- Expandable rows
- Full metadata visible
- Click to expand for preview
- Compact alternative to grid

### User Roles & Permissions

| Role | Capabilities |
|------|--------------|
| **Anonymous** | View public documents only (is_public=true) |
| **Logged-in User** | View own documents, create new documents |
| **Moderator** | View all documents, edit/delete any document |
| **Admin** | All permissions, manage tags and collections |

**View Count**:
- Incremented on document detail page load
- Tracked per document per user
- Visible in grid/list view
- Sortable by view count

---

## Technical Patterns

### Dual Read Logic (File-Based + DB Fallback)

**LibraryService**:
```typescript
async getDocumentContent(document: Document): Promise<string | null> {
  // Try file first
  if (document.file_path) {
    try {
      const content = await libraryFileService.getDocumentContent(document.file_path)
      return content
    } catch (error) {
      console.warn(`Failed to read file: ${document.file_path}`, error)
    }
  }

  // Fallback to DB content field (legacy)
  if (document.content) {
    return document.content
  }

  return null
}
```

**Benefits**:
- Migration path from DB-stored to file-based
- Resilience to file I/O failures
- Ability to update content without DB access
- Filesystem-first approach for performance

### Service Pattern

**Singleton Services**:
- Single instance per application lifecycle
- Lazy initialization on first use
- Shared cache across all requests
- Thread-safe (Node.js single-threaded)

**Composition**:
```
UnifiedDocumentService
├── Uses LibraryService
├── Uses AnarchistService
└── Orchestrates results
```

**Method Signatures**:
```typescript
// Library Service
async getDocuments(filters, pagination): Promise<Document[]>
async getDocumentBySlug(slug): Promise<Document | null>
async searchByTags(tags, options): Promise<Document[]>

// Anarchist Service
async getDocuments(filters, pagination): Promise<Document[]>
async getDocumentBySlug(slug): Promise<Document | null>

// Unified Service
async getDocuments(filters, pagination): Promise<UnifiedDocument[]>
async searchDocuments(query, filters, pagination): Promise<UnifiedDocument[]>
async getLanguages(): Promise<LanguageInfo[]>
```

### Caching Strategy

**In-Memory Cache**:
- Map-based storage
- Size limits: max 10,000 documents
- TTL (Time-To-Live):
  - Full document lists: 5 minutes
  - Metadata (languages, counts): 1 hour
  - Single documents: On-demand (not cached)

**Cache Invalidation**:
- Manual clearing on filter changes
- TTL-based expiration
- LRU eviction when size limit exceeded
- No automatic updates (app restart required)

**Cache Hits**:
- Same query parameters within TTL window
- Deduplication reduces repeat queries
- Cross-service cache sharing

### Virtual Scrolling Optimization

**useVirtualizedDocuments Hook**:
```typescript
interface CacheState {
  // Map of page number → documents
  cache: Map<number, Document[]>

  // Track which pages are being fetched
  pendingFetches: Map<number, Promise<Document[]>>

  // Abort controllers for cancellation
  abortControllers: Map<number, AbortController>
}
```

**Behavior**:
1. User scrolls → detects range of visible items
2. Calculate which pages needed (e.g., pages 2-5)
3. Check cache for pages
4. Fetch missing pages in parallel
5. Add to cache, deduplicate, return
6. Evict old pages outside scroll region

**Performance Benefits**:
- Only fetches visible + overscan (2000px buffer)
- Parallel requests for multiple pages
- Request deduplication (no duplicate fetches)
- Cache prevents re-fetching as user scrolls up/down
- Abort controller cancels out-of-view requests

### Pagination Constants

**File**: `src/lib/documents/constants.ts`

```typescript
INITIAL_PAGE_SIZE = 200          // SSR initial load
INFINITE_SCROLL_PAGE_SIZE = 200  // Each scroll fetch
API_MAX_LIMIT = 5000             // Maximum limit parameter
DEFAULT_LIMIT = 50               // Default if not specified
BATCH_FETCH_SIZE = 10            // Parallel page fetches
TRADITIONAL_PAGE_SIZE = 120      // Alternative traditional size
```

**Why Multiple Sizes?**
- Larger initial load = faster first paint (SSR optimization)
- Larger scroll size = fewer API calls while scrolling
- Batch fetch size = parallelism level

### Security Patterns

| Pattern | Implementation |
|---------|-----------------|
| **Path traversal prevention** | File service validates paths, no `../` allowed |
| **SQL injection prevention** | Parameterized queries via dbPool adapter |
| **CSRF protection** | `withSecurity()` middleware on POST endpoints |
| **Authorization** | Role checks before returning private documents |
| **Content sanitization** | ContentSanitizer utility for user input |

---

## Data Flow

### Search/Filter Flow

```
User types in search box or selects filter
    ↓
LibraryPageClient debounces change (300ms)
    ↓
Calls setSearchQuery() or setSelectedTags()
    ↓
useEffect detects state change
    ↓
Constructs query parameters
    ↓
Calls /api/documents with params
    ↓
UnifiedDocumentService.searchDocuments()
    ↓
Parallel queries:
  ├── LibraryService.searchDocuments(params)
  │   ├── Query library.library_documents
  │   ├── JOIN with library_document_tags
  │   └── Apply full-text search
  │
  └── AnarchistService.searchDocuments(params)
      ├── Query anarchist.documents
      ├── JOIN with anarchist_document_tags
      └── Apply full-text search
    ↓
Merge results arrays
    ↓
Deduplicate by slug
    ↓
Apply sorting (title, author, date, view_count)
    ↓
Slice to requested page/limit
    ↓
Return paginated results
    ↓
LibraryPageClient receives response
    ↓
Updates state: setDocuments(results)
    ↓
React re-renders DocumentCard for each document
    ↓
Virtuoso positions visible cards on screen
```

### Infinite Scroll Flow

```
User scrolls down
    ↓
Virtuoso detects end-of-list (nearEndThreshold)
    ↓
triggerOnEndReached() callback fires
    ↓
useVirtualizedDocuments calculates next page
    ↓
Check cache for page N
    ↓
If not in cache:
  ├── Create AbortController
  ├── Fetch /api/documents?page=N&limit=200
  ├── Add to pendingFetches Map
  └── Store controller for cancellation
    ↓
Parallel fetches if overscan triggers multiple pages
    ↓
Responses arrive
    ↓
Add to cache Map
    ↓
Return combined results
    ↓
LibraryPageClient appends to documents array
    ↓
Virtuoso re-measures and positions new cards
    ↓
User sees documents seamlessly loaded
```

### Document Detail Flow

```
User clicks DocumentCard
    ↓
Navigation to /library/[slug]
    ↓
[slug]/page.tsx Server Component
    ↓
Calls unifiedDocumentService.getDocumentBySlug(slug)
    ↓
Auto-detects source (tries both schemas)
    ↓
Loads content from file system
    ↓
Returns UnifiedDocument to page
    ↓
SSR renders page with content
    ↓
Asynchronously increments view_count
    ↓
Passes to LibraryDocumentContentClient (Client Component)
    ↓
Renders content, metadata, translation switcher
    ↓
User can click language link to view different translation
    ↓
Navigation to [slug]?lang=es (or other language code)
    ↓
Page re-fetches document in different language
```

### Multi-Select Flow

```
User Ctrl+Clicks DocumentCard
    ↓
DocumentCard component detects event
    ↓
Calls store.toggleDocumentSelection(docId, index)
    ↓
Zustand store updates selectedDocumentIds Set
    ↓
Store notifies all subscribers (LibraryPageClient, SelectionToolbar, etc.)
    ↓
LibraryPageClient gets updated selection state
    ↓
LibrarySelectionCounterBar re-renders with new count
    ↓
SelectionToolbar appears/updates with operations
    ↓
DocumentCard re-renders with selected visual state
    ↓
User clicks batch operation (e.g., "Delete Selected")
    ↓
Calls /api/documents/batch/delete with selected IDs
    ↓
Server deletes documents
    ↓
Client calls store.clearSelection()
    ↓
Refetches document list
```

---

## Performance Optimizations

### Server-Side Rendering (SSR)

**Benefits**:
- Initial page load: 200 documents pre-rendered
- No blank page while JavaScript loads
- Faster First Contentful Paint (FCP)
- Better SEO (indexable content)

**Implementation**:
```typescript
// library/page.tsx (Server Component)
export const revalidate = 300 // 5-minute ISR

async function LibraryPage() {
  const documents = await unifiedDocumentService.getDocuments({
    limit: INITIAL_PAGE_SIZE (200),
    page: 1
  })
  const tags = await tagsService.getAllTags()

  return <LibraryPageClient initialDocuments={documents} initialTags={tags} />
}
```

### Pagination Size Strategy

| Stage | Size | Reason |
|-------|------|--------|
| Initial SSR | 200 | Fast initial load, meaningful content |
| Infinite scroll | 200 | Balanced: fewer API calls, reasonable payload |
| Batch fetch | 10 pages parallel | Parallelism improves perceived responsiveness |

### Virtual Scrolling

**How it saves rendering**:
- Only visible cards mounted (typically 4-6 on screen)
- Rest unmounted (not in DOM)
- Overscan: 2000px above/below viewport (prevents flashing)
- Total mounted: ~20-30 cards instead of hundreds

**Performance Impact**:
- 100 visible documents: ~80 components unmounted = 80% reduction
- Memory: Only 20-30 card components in memory
- Rendering time: O(visible) instead of O(total)

### Caching Strategy

**5-Minute TTL for Full Document Lists**:
- Prevents repeated identical queries
- Accounts for real-time document updates
- Trade-off: 5 minutes of possible stale data

**1-Hour TTL for Metadata**:
- Languages rarely change
- Tag lists change infrequently
- Reduces database load significantly

**Single Document: No Cache**:
- Always fetch latest content
- View count increments must be accurate
- Authors expect edits to appear immediately

### Debouncing & Throttling

**Search Input Debounce**: 300ms
- User types 5 characters = 1 API call (not 5)
- Reduces unnecessary requests

**Scroll Position Save Debounce**: 500ms
- Save position every 500ms of scrolling (not every pixel)
- Reduces localStorage writes

### File-Based Storage Benefits

**vs. Database-Only Approach**:
- Smaller database (metadata only)
- Faster full-text indexing (DB has no content)
- Easier backups (rsync files separately)
- Filesystem operations parallelizable

**File I/O Performance**:
- Content loaded on-demand (not in list queries)
- Markdown parsing happens once per request
- Large documents don't impact list performance

---

## Statistics

### Document Collection

| Metric | Value |
|--------|-------|
| Library documents | 3,859 |
| Anarchist documents | 24,643 |
| Total documents | 28,502+ |
| Supported languages | 27+ |
| Largest collection | Anarchist (86% of total) |

### Codebase Statistics

| Category | Count |
|----------|-------|
| React components | 15 |
| API endpoints | 8 |
| Core services | 3 |
| Custom hooks | 3 |
| Database schemas | 3 |
| Service code lines | 2,406 |
| Component code lines | ~1,800 |

### API Response Times

| Endpoint | Typical Response |
|----------|------------------|
| `/api/documents` (page 1) | <100ms (cached) |
| `/api/documents/count` | <50ms (fast count) |
| `/api/documents/[slug]` | 50-200ms (file I/O) |
| `/api/documents/languages` | <50ms (1-hour cache) |
| `/api/library/tags` | <100ms (5-minute cache) |

**Note**: Times include network latency and DB round-trip

### Memory & Storage

| Resource | Size |
|----------|------|
| Cached documents (max) | ~200MB (10k docs @ 20KB avg) |
| Average document | ~20KB |
| Single page load (200 docs) | ~4MB |
| Typical scroll fetch (200 docs) | ~4MB |

---

## Interconnections & Dependencies

### Component Dependency Graph

```
LibraryPage (SSR)
├── Initial data fetch
├── Tag data fetch
└── → LibraryPageClient (Client)
    ├── → TagFilterSidebar
    │   ├── Uses /api/documents/languages
    │   └── Uses /api/library/tags
    ├── → Search input
    │   └── Triggers /api/documents?query=...
    ├── → Virtuoso (react-virtuoso)
    │   ├── Uses useVirtualizedDocuments hook
    │   └── Calls /api/documents?page=N
    └── → DocumentCard (repeated per doc)
        ├── Zustand selection state
        ├── Navigation to [slug]
        └── View count display

[slug]/page.tsx (SSR)
├── unifiedDocumentService.getDocumentBySlug()
└── → LibraryDocumentContentClient
    ├── → LibraryDocumentContentClient
    ├── → TranslationSwitcher
    │   └── Uses /api/documents/[slug]/translations
    └── → LibraryTextEditor (if editing)
```

### Service Dependencies

```
API Endpoints
├── /api/documents → UnifiedDocumentService
│   ├── LibraryService
│   │   ├── dbPool.getConnection('library')
│   │   └── libraryFileService
│   └── AnarchistService
│       ├── dbPool.getConnection('anarchist')
│       └── anarchistFileService
│
├── /api/documents/languages → UnifiedDocumentService
│
├── /api/documents/[slug] → UnifiedDocumentService
│   ├── LibraryService OR AnarchistService (auto-detect)
│   └── File service (load content)
│
└── /api/library/tags → TagsService
    └── dbPool.getConnection('library')
```

### External Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `react-virtuoso` | Virtual scrolling | Latest |
| `zustand` | State management | Latest |
| `lodash.debounce` | Debouncing | Latest |
| `next` | Framework | 15.x |
| `postgres` | Database driver | Latest |

---

## Key Takeaways

1. **Unified Architecture**: Seamlessly combines two separate document sources into one searchable interface
2. **Performance-First**: Virtual scrolling, caching, SSR, and sparse loading ensure smooth experience
3. **Scalable Design**: Handles 28K+ documents across 27+ languages efficiently
4. **File-Based Storage**: Modern approach separating metadata (DB) from content (filesystem)
5. **Feature-Rich**: Translation support, filtering, multi-select, and more
6. **Production-Ready**: Proper error handling, security patterns, and monitoring

---

## Related Documents

- [API Documentation](../api/DOCUMENTS_API.md)
- [Database Schema](../database/DATABASE.md)
- [Component API Reference](./COMPONENTS.md)
- [Performance Tuning Guide](./PERFORMANCE_TUNING.md)
