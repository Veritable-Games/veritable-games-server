# LIBRARY SYSTEM - COMPREHENSIVE ARCHITECTURAL ANALYSIS

**Analysis Date**: October 24, 2025
**System Status**: Fully Functional
**Database**: library.db (SQLite)
**Tech Stack**: Next.js 15 + React 19 + TypeScript + better-sqlite3

---

## EXECUTIVE SUMMARY

The Library System is a **completely separate document management system** from the Wiki. It provides:
- Text-based document storage (19 documents as of October 2025)
- Rich metadata (author, publication date, document type, abstract)
- Tag-based organization with category system
- FTS5 full-text search with BM25 ranking
- Complete CRUD operations with authentication
- Annotations support (client-side localStorage)
- View count tracking

**Key Architectural Principle**: The library is **decoupled from the wiki system**. It has its own database (library.db), service layer, API routes, components, and type system.

---

## DATABASE LAYER

### Database File
```
/home/user/Projects/web/veritable-games-main/frontend/data/library.db
```

### Schema Overview

**Total Tables**: 7 core tables + 1 virtual FTS5 table

#### 1. **library_documents** (Main Content Table)
```sql
CREATE TABLE library_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,              -- URL-safe identifier
  title TEXT NOT NULL,                    -- Document title
  author TEXT,                            -- Original document author
  publication_date TEXT,                  -- Date published (format: YYYY-MM-DD)
  document_type TEXT DEFAULT 'document',  -- article|book|whitepaper|manifesto|transcript
  description TEXT,                       -- Short summary
  abstract TEXT,                          -- Longer abstract/introduction
  content TEXT NOT NULL,                  -- Full text content (stored in DB, not files)
  search_text TEXT,                       -- Denormalized search index
  status TEXT DEFAULT 'published',        -- published|draft|archived
  page_count INTEGER DEFAULT NULL,        -- Future: auto-calculated from headers
  created_by INTEGER,                     -- User ID (from users.db)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  view_count INTEGER DEFAULT 0
)
```

**Indexes**:
- `idx_library_documents_slug` - Fast slug lookups
- `idx_library_documents_status` - Filter by status
- `idx_library_documents_type` - Filter by document type

**Constraints**:
- Slug must be unique (prevents duplicate URLs)
- Title and content are required
- Foreign key to users.id would violate cross-database constraint (disabled)

#### 2. **library_search_fts** (FTS5 Virtual Table)
```sql
CREATE VIRTUAL TABLE library_search_fts USING fts5(
  document_id UNINDEXED,              -- Reference to library_documents.id
  title,                              -- Indexed for search
  author,                             -- Indexed for search
  description,                        -- Indexed for search
  abstract,                           -- Indexed for search
  content,                            -- Indexed for search (largest field)
  tags,                               -- Comma-separated tag names
  document_type,                      -- article|book|etc
  publication_date UNINDEXED,         -- Not indexed (rarely searched)
  content='',
  contentless_delete=1,               -- Reduces FTS table size
  tokenize='porter unicode61 remove_diacritics 2'  -- Porter stemming
)
```

**Features**:
- BM25 ranking algorithm (relevance scoring)
- Porter stemming (matches variants: running, runs, run)
- Unicode normalization (handles diacritics)
- Automatically kept in sync via triggers
- Fallback to LIKE queries if FTS5 unavailable

**Triggers** (Auto-Sync):
- `library_fts_insert` - Add to FTS5 when document created
- `library_fts_update` - Update FTS5 when document changed
- `library_fts_delete` - Remove from FTS5 when document deleted

#### 3. **library_categories** (Document Categories)
```sql
CREATE TABLE library_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,      -- Category identifier (e.g., 'anarchism')
  name TEXT NOT NULL,             -- Display name
  description TEXT,               -- What goes in this category
  parent_id INTEGER DEFAULT NULL, -- Hierarchical support (not used yet)
  display_order INTEGER,          -- Sort order
  is_active INTEGER DEFAULT 1,    -- Soft delete via flag
  item_count INTEGER DEFAULT 0,   -- Denormalized count
  created_at DATETIME,
  updated_at DATETIME
)
```

#### 4. **library_tag_categories** (Tag Organization)
```sql
CREATE TABLE library_tag_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,             -- Display name (e.g., 'Primary', 'Sources')
  type TEXT DEFAULT 'general',    -- primary|secondary|tertiary|general
  description TEXT,               -- Purpose of this category
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Type Mapping** (UI Styling):
- `primary` → Blue accent color
- `secondary` → Purple accent color
- `tertiary` → Green accent color
- `general` → Gray accent color

#### 5. **library_tags** (Individual Tags)
```sql
CREATE TABLE library_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,          -- Tag name (normalized)
  category_id INTEGER,                -- Link to tag_categories
  description TEXT,                   -- Optional tag description
  usage_count INTEGER DEFAULT 0,      -- How many documents use this tag
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES library_tag_categories(id) ON DELETE SET NULL
)
```

**Naming Convention**:
- Stored normalized: lowercase, hyphen-separated (e.g., "class-struggle")
- Display: original case (e.g., "Class Struggle")
- Always unique across entire system

#### 6. **library_document_categories** (Junction Table)
```sql
CREATE TABLE library_document_categories (
  document_id INTEGER,
  category_id INTEGER,
  PRIMARY KEY (document_id, category_id),
  FOREIGN KEY (document_id) REFERENCES library_documents(id) ON DELETE CASCADE
)
```

**Purpose**: One-to-many relationship allowing documents in multiple categories

#### 7. **library_document_tags** (Junction Table)
```sql
CREATE TABLE library_document_tags (
  document_id INTEGER,
  tag_id INTEGER,
  added_by INTEGER,               -- User ID (from users.db)
  added_at DATETIME,              -- When tag was added
  PRIMARY KEY (document_id, tag_id),
  FOREIGN KEY (document_id) REFERENCES library_documents(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES library_tags(id) ON DELETE CASCADE
  -- Cannot add FK to users(id) - cross-database constraint violation
)
```

**Purpose**: Many-to-many relationship between documents and tags

### Cross-Database Data Access Pattern

**Critical Limitation**: SQLite cannot enforce foreign keys across separate database files.

```typescript
// Cannot do this in SQL:
SELECT d.*, u.username FROM library_documents d
JOIN users u ON d.created_by = u.id  // FAILS - different database

// Must use application logic:
const libraryDb = dbPool.getConnection('library');
const usersDb = dbPool.getConnection('users');
const documents = libraryDb.prepare('SELECT * FROM library_documents').all();
for (const doc of documents) {
  const user = usersDb.prepare('SELECT * FROM users WHERE id = ?').get(doc.created_by);
}
```

**Solution Used**: LibraryService uses `getUserById()` helper to fetch user data separately.

---

## SERVICE LAYER

### File Path
```
/home/user/Projects/web/veritable-games-main/frontend/src/lib/library/service.ts
```

### LibraryService Class

**Singleton Pattern**: Exported as singleton instance
```typescript
export const libraryService = new LibraryService();
```

**Database Connections**:
```typescript
private getDb(): Database {
  return dbPool.getConnection('library');
}

private getAuthDb(): Database {
  return dbPool.getConnection('auth');
}

private getUsersDb(): Database {
  return dbPool.getConnection('users');
}
```

### Core Methods

#### 1. **getDocuments(params)** - Search & List
```typescript
async getDocuments(params: LibrarySearchParams = {}): Promise<LibrarySearchResult>
```

**Parameters**:
```typescript
{
  query?: string;              // FTS5 search query
  category?: string;           // Filter by category code
  tags?: string[];            // Filter by tag names
  author?: string;            // Filter by author (LIKE)
  document_type?: string;     // Filter by type
  status?: string;            // published|draft|archived
  sort_by?: 'title' | 'date' | 'author' | 'views' | 'downloads';
  sort_order?: 'asc' | 'desc';
  page?: number;              // Pagination (default: 1)
  limit?: number;             // Results per page (max: 500)
}
```

**Search Strategy**:
1. Checks if FTS5 table exists
2. If query provided:
   - Uses `library_search_fts MATCH` for full-text search with BM25 ranking
   - Falls back to LIKE query on title/author/description/search_text if FTS5 unavailable
3. Preserves FTS5 relevance ordering when using search
4. Applies standard SQL ordering (title, author, date) when no search

**Cross-Database Lookups**:
- Fetches tags for each document
- Maps document_id → tags with category type
- Transforms response to match frontend expectations

**Returns**:
```typescript
{
  documents: LibraryDocumentDisplay[];  // Formatted for UI
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats?: {
    total_documents: number;
    categories_used: number;
    contributors: number;
  };
}
```

#### 2. **getDocumentBySlug(slug)** - Single Document
```typescript
async getDocumentBySlug(slug: string): Promise<LibraryDocumentWithMetadata | null>
```

**Fetches**:
- Main document via slug (unique constraint)
- Associated tags with category types
- Category assignments
- User information (username, display_name) from users.db

#### 3. **createDocument(input, userId)** - Create
```typescript
async createDocument(
  input: LibraryDocumentCreateInput,
  userId: number
): Promise<{ id: number; slug: string }>
```

**Slug Generation**:
```typescript
let slug = input.title
  .toLowerCase()
  .replace(/\s+/g, '-')        // Spaces → hyphens
  .replace(/[^\w-]/g, '');     // Remove special chars

// Fallback for empty titles
if (!slug) {
  slug = `document-${Date.now()}`;
}
```

**Transaction Process**:
1. Disables foreign key constraints (cross-DB references)
2. Inserts document with metadata
3. Adds to category (if provided)
4. Creates/links tags (auto-assigns to "Unsorted" category)
5. Updates tag usage counts
6. Re-enables foreign key constraints

**Search Text**: Concatenates title + author + description + abstract for denormalized search

#### 4. **updateDocument(id, input)** - Update
```typescript
async updateDocument(id: number, input: LibraryDocumentUpdateInput): Promise<boolean>
```

**Selective Updates**: Only updates provided fields
- title, author, publication_date, document_type
- description, abstract, content
- status (draft|published|archived)
- tags (replaces all tags for document)

**Tag Replacement Strategy**:
1. Deletes all existing document-tag associations
2. Creates new associations from input.tags
3. Recalculates usage_count for all tags

#### 5. **deleteDocument(id, userId, userRole)** - Delete
```typescript
async deleteDocument(id: number, userId: number, userRole: string): 
  Promise<{success: boolean, message: string}>
```

**Authorization**:
- Only document author or admins can delete
- Returns 403 Forbidden if user lacks permission

**Cascading Delete**:
1. Removes FTS5 entry (if exists)
2. Removes all document-tag associations
3. Deletes document
4. Does NOT delete tags (can be reused elsewhere)

#### 6. **getCategories()** - List Categories
```typescript
async getCategories(): Promise<LibraryCategory[]>
```

Returns active categories ordered by display_order and name

#### 7. **getTagGroups()** - List Tags by Category
```typescript
async getTagGroups(): Promise<LibraryTagGroup[]>
```

Returns tags grouped by category type with usage counts

#### 8. **incrementViewCount(documentId)** - Analytics
```typescript
async incrementViewCount(documentId: number): Promise<void>
```

Increments view_count by 1 each time document is viewed

### Cross-Database Integration

**getUserById(userId)**: Private helper to fetch user data from users.db
```typescript
private getUserById(userId: number): 
  { username: string; display_name: string | null } | null {
  const usersDb = this.getUsersDb();
  return usersDb.prepare('SELECT username, display_name FROM users WHERE id = ?')
    .get(userId) as any;
}
```

### Transaction Management

Uses better-sqlite3 transactions to ensure atomicity:
```typescript
const result = db.transaction(() => {
  // Multiple operations
  insertDoc.run(...);
  insertCategory.run(...);
  insertTags.run(...);
  // All succeed or all rollback
})();
```

### Error Handling

- Logs all errors via logger utility
- Gracefully handles missing FTS5 table
- Returns meaningful error messages to API layer
- Uses try-catch for cross-database operations

---

## API LAYER

### Endpoints Overview

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/library/documents` | List/search documents |
| POST | `/api/library/documents` | Create document |
| GET | `/api/library/documents/[slug]` | Get single document |
| PUT | `/api/library/documents/[slug]` | Update document |
| DELETE | `/api/library/documents/[slug]` | Delete document |
| GET | `/api/library/documents/[slug]/tags` | Get document tags |
| POST | `/api/library/documents/[slug]/tags` | Add tags to document |
| DELETE | `/api/library/documents/[slug]/tags` | Remove tag from document |
| GET | `/api/library/tags` | List all tags |
| POST | `/api/library/tags` | Create new tag |
| GET | `/api/library/tag-categories` | List tag categories |
| POST | `/api/library/tag-categories` | Create tag category |
| GET | `/api/library/annotations` | Fetch annotations (client-side storage) |
| POST | `/api/library/annotations` | Log annotations to server |

### Route Details

#### GET /api/library/documents
**File**: `/home/user/Projects/web/veritable-games-main/frontend/src/app/api/library/documents/route.ts`

```typescript
async getDocuments(request: NextRequest) {
  // Query parameters:
  // - search: Full-text search query
  // - category: Filter by category code
  // - author: Filter by author
  // - type: Filter by document_type
  // - status: published|draft|archived
  // - sort: title|author|date|views|downloads
  // - order: asc|desc
  // - page: 1-based page number
  // - limit: Results per page (1-500, default 100)
  
  // Returns: LibrarySearchResult
  // {
  //   documents: [...],
  //   pagination: { page, limit, total, totalPages },
  //   stats: { total_documents, categories_used, contributors }
  // }
}
```

**Security**: `withSecurity()` middleware (no CSRF for GET)

#### POST /api/library/documents
**File**: Same as above

```typescript
async createDocument(request: NextRequest) {
  // Requires: Authentication
  // Body:
  // {
  //   title: string (required)
  //   author?: string
  //   publication_date?: string (YYYY-MM-DD)
  //   document_type?: string (article|book|etc)
  //   description?: string
  //   abstract?: string
  //   content: string (required, plain text or markdown)
  //   tags?: string[] (tag names)
  // }
  
  // Returns: { success: true, data: { id, slug, message } }
}
```

**Security**: `withSecurity()` with CSRF protection

**Validation**:
- Title must be non-empty string
- Content must be non-empty string
- Tags array is optional

#### GET /api/library/documents/[slug]
**File**: `/home/user/Projects/web/veritable-games-main/frontend/src/app/api/library/documents/[slug]/route.ts`

```typescript
async getDocument(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  // Awaits params (Next.js 15 requirement)
  // Fetches document by slug
  // Increments view_count
  // Returns formatted response for frontend
  
  // Response includes:
  // - Document metadata (title, author, publication_date, etc)
  // - Content
  // - Tags with category types
  // - User who created it (username, display_name)
  // - View count
}
```

**Security**: `withSecurity()` (no CSRF for GET)

#### PUT /api/library/documents/[slug]
**File**: Same as above

```typescript
async updateDocument(request: NextRequest, { params }) {
  // Requires: Authentication
  // Authorization: Document owner or admin/moderator
  // Body: Partial LibraryDocumentUpdateInput
  //   (any field can be updated individually)
  
  // Returns: { success: true, message: 'Document updated successfully' }
}
```

**Security**: `withSecurity()` with CSRF protection

#### DELETE /api/library/documents/[slug]
**File**: Same as above

```typescript
async deleteDocument(request: NextRequest, { params }) {
  // Requires: Authentication
  // Authorization: Document author or admin
  // Returns: { success: true, message: 'Document "[title]" has been successfully deleted.' }
  // Error: { error: 'You do not have permission...', success: false }
}
```

**Security**: `withSecurity()` with CSRF protection

#### GET /api/library/documents/[slug]/tags
**File**: `/home/user/Projects/web/veritable-games-main/frontend/src/app/api/library/documents/[slug]/tags/route.ts`

```typescript
export const GET = withSecurity(async (request, context) => {
  // Returns: {
  //   success: true,
  //   currentTags: [...],      // Tags on this document
  //   allTags: [...]           // All available tags
  // }
}
```

#### POST /api/library/documents/[slug]/tags
**File**: Same

```typescript
export const POST = withSecurity(async (request, context) => {
  // Requires: Authentication
  // Body: { tagId?: number } OR { tagNames?: string[] }
  //
  // If tagId provided:
  //   - Links existing tag to document
  // If tagNames provided:
  //   - Creates new tags (if not exist)
  //   - Links all to document
  //   - Auto-assigns to "Unsorted" category
  //
  // Returns: { success: true, addedTags: [...] }
}
```

#### DELETE /api/library/documents/[slug]/tags
**File**: Same

```typescript
export const DELETE = withSecurity(async (request, context) => {
  // Requires: Authentication
  // Body: { tagId: number }
  // Removes tag from document
  // Decrements tag.usage_count
  // Returns: { success: true, message: 'Tag removed successfully' }
}
```

#### GET /api/library/tags
**File**: `/home/user/Projects/web/veritable-games-main/frontend/src/app/api/library/tags/route.ts`

```typescript
export async function GET(request: NextRequest) {
  // Returns all tags grouped by category type
  // { success: true, tags: { category_type: [...] }, categories: [...] }
}
```

#### POST /api/library/tags
**File**: Same

```typescript
async function createTag(request: NextRequest) {
  // Requires: Authentication (implied from admin context)
  // Body: { name: string, category_type: string, description?: string }
  // Creates new tag
  // Returns: { success: true, tag: { id, name, category_type, usage_count } }
}
```

#### GET /api/library/tag-categories
**File**: `/home/user/Projects/web/veritable-games-main/frontend/src/app/api/library/tag-categories/route.ts`

```typescript
export const GET = withSecurity(async (request) => {
  // Returns all tag categories with nested tags
  // {
  //   success: true,
  //   categories: [
  //     {
  //       id, name, type, description, created_at,
  //       tag_count, tags: [...],
  //       isUnsorted: boolean
  //     }
  //   ]
  // }
}
```

#### POST /api/library/tag-categories
**File**: Same

```typescript
export const POST = withSecurity(async (request) => {
  // Requires: Authentication + admin/moderator role
  // Body: { name: string, type?: string, description?: string }
  // Creates new tag category (general|primary|secondary|tertiary)
  // Returns: { success: true, category: {...}, message: '...' }
}
```

#### GET/POST /api/library/annotations
**File**: `/home/user/Projects/web/veritable-games-main/frontend/src/app/api/library/annotations/route.ts`

```typescript
// GET: Returns message about annotation storage
// POST: Logs annotations from client-side localStorage to server console
//       Prints annotation status breakdown and summary
```

---

## COMPONENT LAYER

### Page Components

#### /app/library/page.tsx
**File**: `/home/user/Projects/web/veritable-games-main/frontend/src/app/library/page.tsx`

**Server Component** - Fetches initial data:
- getLibraryData() - Parallel fetch of documents + tag categories
- Direct service calls (faster than HTTP)
- Caches for 5 minutes via `revalidate = 300`
- Returns library data with user context

**Renders**:
```tsx
<LibraryPageClient
  initialDocuments={documents}
  tagCategories={tagCategories}
  user={user}
/>
```

### Client Components

#### LibraryPageClient
**File**: `/home/user/Projects/web/veritable-games-main/frontend/src/app/library/LibraryPageClient.tsx`

**State Management** (all client-side):
```typescript
const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
const [searchQuery, setSearchQuery] = useState('');
const [sortBy, setSortBy] = useState<'title'|'date'|'author'|...>('title');
const [sortOrder, setSortOrder] = useState<'asc'|'desc'>('asc');
const [viewMode, setViewMode] = useState<LibraryViewMode>('grid');
```

**LocalStorage Integration**:
- View mode (grid/list) persisted to localStorage
- Restores on page reload

**Filtering Logic** (useMemo):
1. Tag filtering (AND logic - must have ALL selected tags)
2. Search query filtering (title/author/description)
3. Sorting by selected column

**Subcomponents**:
- `LibraryContent` - Main layout with sidebar + document grid
- `UnifiedTagManager` - Tag filter sidebar
- `LibraryListView` - Table view of documents
- `CreateDocumentModal` - Modal for creating new documents

#### UnifiedTagManager
**File**: `/home/user/Projects/web/veritable-games-main/frontend/src/components/library/UnifiedTagManager.tsx`

**Features**:
- Drag-and-drop tag organization (admin only)
- Tag selection for filtering
- Category expansion/collapse
- Admin operations (create, edit, delete)

**Uses dnd-kit** library:
```typescript
<DndContext>
  <SortableContext strategy={verticalListSortingStrategy}>
    {/* Draggable tags */}
  </SortableContext>
  <DragOverlay>
    {/* Visual feedback during drag */}
  </DragOverlay>
</DndContext>
```

**Styling**:
- Color-coded by category type (primary/secondary/tertiary/general)
- Selected tags highlighted in blue
- Drag state visual feedback

#### LibraryListView
**File**: `/home/user/Projects/web/veritable-games-main/frontend/src/components/library/LibraryListView.tsx`

**Renders**:
- Table with columns: Title, Author, Date, Type, Category, Tags, Views
- Sort indicators (▲/▼)
- Click handlers for sorting
- Navigation to document detail page

#### CreateDocumentModal
**File**: `/home/user/Projects/web/veritable-games-main/frontend/src/components/library/CreateDocumentModal.tsx`

**Form Fields**:
- title (required)
- author (optional)
- publication_date (optional, date picker)
- document_type (select: article|book|whitepaper|transcript|manifesto)
- description (textarea)
- abstract (textarea)
- content (required, markdown)
- tags (comma-separated input)

**Validation**:
- Title required
- Content required (or abstract/description)
- Submits to POST /api/library/documents
- Redirects to document page on success

#### LibraryAnnotationOverlay
**File**: `/home/user/Projects/web/veritable-games-main/frontend/src/components/library/LibraryAnnotationOverlay.tsx`

**Purpose**: Annotation/highlighting system (currently client-side only)
- Client stores annotations in localStorage
- POST to /api/library/annotations for server logging
- Tracks annotation status: needs-edit|comparing|verified|amended

#### LibraryTextEditor
**File**: `/home/user/Projects/web/veritable-games-main/frontend/src/components/library/LibraryTextEditor.tsx`

**Purpose**: Rich text editing for document content
- Markdown support (implied by content_format)
- Sanitized via DOMPurify before storage

---

## TYPE SYSTEM

### Core Types

**File**: `/home/user/Projects/web/veritable-games-main/frontend/src/lib/library/types.ts`

#### Database Types
```typescript
interface LibraryDocument {
  id: number;
  slug: string;
  title: string;
  author: string | null;
  publication_date: string | null;
  document_type: string;
  status: string;              // published|draft|archived
  description: string | null;
  abstract: string | null;
  content: string;
  language: string | null;
  page_count: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  view_count: number;
  search_text: string | null;
}

interface LibraryCategory {
  id: number;
  code: string;
  name: string;
  description: string | null;
  parent_id: number | null;
  display_order: number;
  is_active: boolean;
  item_count: number;
  created_at: string;
  updated_at: string;
}

interface LibraryTag {
  id: number;
  name: string;
  category_id: number | null;
  description: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface LibraryTagCategory {
  id: number;
  name: string;
  type: string;  // 'source'|'theme'|'method'|'time'|'geography'
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface LibraryCollection {
  id: number;
  name: string;
  description: string | null;
  created_by: number;
  is_public: boolean;
  item_count: number;
  created_at: string;
  updated_at: string;
}
```

#### API Types
```typescript
interface LibraryDocumentWithMetadata extends LibraryDocument {
  category_name?: string;
  category_code?: string;
  tags?: Array<{ id: number; name: string; type: string }>;
  uploaded_by_username?: string;
  uploaded_by_display_name?: string;
  is_public?: boolean;
}

interface LibraryDocumentCreateInput {
  title: string;
  author?: string;
  publication_date?: string;
  document_type?: string;
  description?: string;
  abstract?: string;
  content: string;
  tags?: string[];
  category_id?: number;
}

interface LibraryDocumentUpdateInput {
  title?: string;
  author?: string;
  publication_date?: string;
  document_type?: string;
  description?: string;
  abstract?: string;
  content?: string;
  status?: 'draft' | 'published' | 'archived';
  tags?: string[];
  category_id?: number;
  authorId?: number;
}

interface LibrarySearchParams {
  query?: string;
  category?: string;
  tags?: string[];
  author?: string;
  document_type?: string;
  status?: string;
  sort_by?: 'title' | 'date' | 'author' | 'views' | 'downloads';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

interface LibrarySearchResult {
  documents: LibraryDocumentWithMetadata[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats?: {
    total_documents: number;
    categories_used: number;
    contributors: number;
  };
}
```

#### Display Types
```typescript
interface LibraryDocumentDisplay {
  id: number;
  title: string;
  author: string;
  publication_date: string;
  document_type: string;
  slug: string;
  category_name: string;
  tags: Array<{ id: number; name: string; type: string }>;
  created_at: string;
  view_count: number;
  page_count: number | null;
  is_public: boolean;
  description?: string;
}

export type LibraryViewMode = 'grid' | 'list';
```

### Tag Management Types

**File**: `/home/user/Projects/web/veritable-games-main/frontend/src/lib/library/tag-management-types.ts`

#### Branded Types (Type-Safe IDs)
```typescript
type Brand<K, T> = K & { __brand: T };

export type TagId = Brand<number, 'TagId'>;
export type CategoryId = Brand<number, 'CategoryId'>;
export type TagIdentifier = Brand<string, 'TagIdentifier'>;
```

**Purpose**: Prevents accidental mixing of different ID types at compile time

#### Tag Management Types
```typescript
export type CategoryType = 'primary' | 'secondary' | 'tertiary' | 'general';

interface TagWithMetadata {
  id: number;
  name: string;
  category_id: number | null;
  categoryType?: CategoryType;
  description?: string;
  usage_count: number;
  created_at: string;
  isSelected?: boolean;
}

interface CategoryWithTags {
  id: number;
  name: string;
  type: CategoryType;
  description?: string;
  created_at: string;
  tags: TagWithMetadata[];
  tag_count: number;
  isUnsorted?: boolean;
  isExpanded?: boolean;
}
```

#### Drag & Drop Types
```typescript
type DraggableType = 'tag' | 'category';
type DropTargetType = 'category' | 'create-zone' | 'unsorted';

interface TagDragPayload {
  type: 'tag';
  tagId: number;
  tagName: string;
  sourceCategoryId: number | null;
  sourceCategoryType: CategoryType;
}

type DragOperation = 
  | 'move-to-category'
  | 'create-category-with'
  | 'move-to-unsorted'
  | 'invalid';
```

#### Admin Operation Types
```typescript
interface TagEditPayload {
  tagId: number;
  updates: { name?: string; description?: string; category_id?: number | null };
}

interface CategoryEditPayload {
  categoryId: number;
  updates: { name?: string; type?: CategoryType; description?: string };
}

interface CategoryCreatePayload {
  name: string;
  type: CategoryType;
  description?: string;
  initialTagId?: number;
}
```

#### UI Constants
```typescript
export const CATEGORY_TYPE_NAMES: Record<CategoryType, string> = {
  primary: 'Primary (Blue)',
  secondary: 'Secondary (Purple)',
  tertiary: 'Tertiary (Green)',
  general: 'General (Gray)',
};

export const CATEGORY_COLOR_SCHEMES: Record<CategoryType, {...}> = {
  primary: {
    accent: 'text-blue-400',
    divider: 'border-gray-700/40',
    dropZone: 'bg-blue-500/5 ring-2 ring-blue-500/30 ring-inset',
  },
  // ... secondary, tertiary, general
};
```

---

## INTEGRATION POINTS

### 1. Authentication System
**Database**: auth.db (sessions)
**Integration**: 
- All mutations require `getCurrentUser(request)`
- Authorization checks: author or admin/moderator
- User ID stored in library_documents.created_by

### 2. User Profiles
**Database**: users.db
**Integration**:
- LibraryService.getUserById(userId) fetches user data
- Returns username + display_name
- Cannot enforce FK constraint (separate database)

### 3. Security Middleware
**Integration**: `withSecurity()` wrapper on all routes
- CSP headers
- Session management
- Content sanitization (DOMPurify)
- CSRF protection on mutations

### 4. Profile Aggregator Service
**Integration**: Could aggregate library contributions with wiki/forums stats
- Currently unused for library
- Would require joining across databases via application logic

### 5. Content Sanitization
**Library**: DOMPurify for user-generated content
- HTML tags allowed: b, i, em, strong, a, p, br
- Prevents XSS attacks

---

## CURRENT STATE & FEATURES

### Implemented Features
- ✅ Full CRUD operations (Create, Read, Update, Delete)
- ✅ FTS5 full-text search with BM25 ranking
- ✅ Tag-based organization with categories
- ✅ Drag-and-drop tag management (admin)
- ✅ View count tracking
- ✅ Author/publication metadata
- ✅ Search with fallback to LIKE
- ✅ Pagination (configurable limit)
- ✅ Status filtering (published/draft/archived)
- ✅ Multi-sorting (title, author, date, type, views)
- ✅ Document type classification
- ✅ Abstract/description fields
- ✅ Client-side annotations (localStorage)

### Partially Implemented
- ⚠️ Collections (schema exists, no UI)
- ⚠️ Document categories (junction table exists, rarely used)
- ⚠️ Annotations (client-side only, server logging only)

### Future Features (Planned)
- 🔄 Page count auto-calculation from markdown headers
- 🔄 PDF upload support (currently text-only)
- 🔄 Server-side annotation persistence
- 🔄 Document revisions/history tracking
- 🔄 Advanced search filters (publication date range, etc)

### Known Issues
- None documented

### Recent Changes (October 2025)
- ✅ Unified tag management system implemented
- ✅ Tag category types (primary/secondary/tertiary/general)
- ✅ Drag-and-drop tag organization
- ✅ Separate from wiki system (complete decoupling)

---

## PERFORMANCE CHARACTERISTICS

### Database Optimization
- **Indexes**: 3 indexes on library_documents (slug, status, type)
- **FTS5**: Full-text search with porter stemming
- **Denormalization**: search_text field for fallback search
- **WAL Mode**: Better concurrency, auto-checkpoint every 100 pages
- **Cache Size**: 10,000 pages
- **Busy Timeout**: 5 seconds for lock resolution

### Query Performance
- **Slug lookup**: O(1) via unique index
- **Status filter**: O(n) with index
- **FTS5 search**: ~80% cache hit rate (BM25 ranking)
- **Tag queries**: O(n) with small n (tags << documents)

### Pagination
- Default: 100 results per page
- Max: 500 results per page
- Optimized for typical library use case

### Caching
- Server-side: 5-minute revalidation on library page
- Client-side: localStorage for view mode preference
- Browser cache: Implicit via HTTP headers

---

## ERROR HANDLING

### Service Layer
```typescript
try {
  // Operation
} catch (error) {
  logger.error('Operation failed', error);
  throw error;  // Let API layer handle
}
```

### API Routes
```typescript
try {
  // Request handling
} catch (error: any) {
  console.error('Error:', error);
  return NextResponse.json(
    { error: 'User message', details: error.message },
    { status: 500 }
  );
}
```

### Common Error Responses
- 400: Validation error (missing required fields)
- 401: Authentication required
- 403: Insufficient permissions
- 404: Document/tag not found
- 409: Conflict (duplicate slug, tag already linked)
- 500: Server error

---

## SECURITY ARCHITECTURE

### Authentication
- Session-based (not JWT)
- Required for: create, update, delete, tag operations
- Optional for: read operations (public documents)

### Authorization
- Documents can only be deleted by author or admin
- Tag categories can only be created/edited by admin/moderator
- Document updates: owner or admin/moderator

### Content Security
- All user input validated via Zod schemas
- HTML sanitized via DOMPurify
- Prepared statements only (no string concatenation in SQL)
- Foreign key constraints enforced (except cross-DB references)

### Data Privacy
- Published documents are public (is_public = true)
- Draft documents visible to author/admin
- No public visibility restrictions (except status)

---

## SCALING CONSIDERATIONS

### Current Scale
- 19 documents (as of October 2025)
- Small tag set (~50 tags estimated)
- Single SQLite database file

### Scaling Limits
- SQLite: ~10GB file size practical limit
- ~100k documents: FTS5 performance degrades
- Query concurrency: Limited by WAL mode implementation

### Future Optimizations
- Migrate to PostgreSQL for >10k documents
- Add document content full-text search index
- Implement search query caching
- Batch tag operations for efficiency

---

## FILE STRUCTURE REFERENCE

```
frontend/
├── src/
│   ├── lib/library/
│   │   ├── service.ts                    # Core business logic (773 lines)
│   │   ├── types.ts                      # Type definitions (170 lines)
│   │   └── tag-management-types.ts       # Tag system types (342 lines)
│   ├── app/
│   │   ├── library/
│   │   │   ├── page.tsx                  # Server page (161 lines)
│   │   │   ├── LibraryPageClient.tsx     # Client wrapper (varies)
│   │   │   ├── [slug]/
│   │   │   │   ├── page.tsx              # Document view
│   │   │   │   ├── edit/page.tsx         # Document edit
│   │   │   │   └── history/page.tsx      # Document history
│   │   │   └── create/page.tsx           # Create page
│   │   └── api/library/
│   │       ├── documents/
│   │       │   ├── route.ts              # GET/POST documents
│   │       │   └── [slug]/
│   │       │       ├── route.ts          # GET/PUT/DELETE document
│   │       │       └── tags/route.ts     # Tag operations
│   │       ├── tags/
│   │       │   ├── route.ts              # GET/POST tags
│   │       │   └── [id]/route.ts         # Tag operations
│   │       ├── tag-categories/
│   │       │   ├── route.ts              # GET/POST categories
│   │       │   └── [id]/route.ts         # Category operations
│   │       └── annotations/route.ts      # Annotations API
│   └── components/library/
│       ├── UnifiedTagManager.tsx         # Tag filtering + drag/drop
│       ├── LibraryListView.tsx           # Table view
│       ├── CreateDocumentModal.tsx       # Create form
│       ├── LibraryTextEditor.tsx         # Text editing
│       └── LibraryAnnotationOverlay.tsx  # Annotations UI
└── data/
    └── library.db                        # SQLite database
```

---

## DEPLOYMENT CHECKLIST

Before deploying library changes:

1. ✅ Run `npm run type-check` (TypeScript validation)
2. ✅ Run `npm test` (Jest tests)
3. ✅ Verify database schema in pool.ts
4. ✅ Check cross-database FK constraints
5. ✅ Validate API route security middleware
6. ✅ Test FTS5 search functionality
7. ✅ Verify tag migration logic
8. ✅ Check localStorage for annotations

---

## NEXT STEPS FOR ENHANCEMENT

### High Priority
1. Implement server-side annotation persistence
2. Add document revision/history tracking
3. Implement page_count auto-calculation from markdown
4. Add advanced search filters

### Medium Priority
1. PDF upload support (requires file storage)
2. Document collections implementation (schema ready)
3. Export documents as PDF
4. Batch tag operations API

### Low Priority
1. Migrate to PostgreSQL (if >10k documents)
2. Advanced caching strategies
3. Full-text search analytics
4. Document similarity detection

