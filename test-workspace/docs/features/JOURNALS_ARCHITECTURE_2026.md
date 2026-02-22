# Journals System Architecture (2026)

**Date**: February 16, 2026
**Status**: Production (220 journals, 329 in database)
**Version**: 3.0 (Post-Refactor)

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [State Management](#state-management)
5. [Component Hierarchy](#component-hierarchy)
6. [Data Flow](#data-flow)
7. [Authorization](#authorization)
8. [Performance Optimizations](#performance-optimizations)
9. [File Structure](#file-structure)

---

## Overview

The Journals system is a **personal note-taking** feature that allows users to create, organize, and manage private journal entries. Journals are completely separate from the wiki system and use a dedicated database table.

### Key Features

- ✅ **Personal Journaling** - Each user has their own private journals
- ✅ **Categorization** - Organize journals into custom categories
- ✅ **Full-Text Search** - PostgreSQL FTS with relevance ranking
- ✅ **Soft Delete** - Journals can be deleted and restored
- ✅ **Revision History** - Content changes tracked in `wiki_revisions`
- ✅ **Real-time Updates** - Zustand state management for instant UI updates

### What's NOT in Journals

- ❌ Bookmarks (this is a wiki feature only)
- ❌ Archive functionality (removed Feb 2026)
- ❌ Team categories (may be removed - under review)
- ❌ Public sharing (journals are always private)

---

## Database Schema

### Tables

Journals use **3 tables** in the database:

#### 1. `wiki.journals` (Primary Table)

Stores journal metadata and references.

```sql
CREATE TABLE wiki.journals (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,

  -- Core Fields
  user_id INTEGER NOT NULL REFERENCES users.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  content TEXT DEFAULT '',  -- Deprecated, use wiki_revisions

  -- Journal-Specific
  category_id TEXT REFERENCES wiki.journal_categories(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by INTEGER REFERENCES users.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP,

  -- Full-Text Search (Added Feb 16, 2026)
  search_vector TSVECTOR,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  restored_by INTEGER REFERENCES users.users(id) ON DELETE SET NULL,
  restored_at TIMESTAMP,

  -- Constraints
  CONSTRAINT journals_unique_slug UNIQUE (user_id, slug)
);
```

**Indexes:**

- `idx_journals_user_id` - User lookup
- `idx_journals_slug` - Slug lookup
- `idx_journals_category_id` - Category filtering
- `idx_journals_deleted` - Trash filtering
- `idx_journals_created_at` - Sort by creation date
- `idx_journals_updated_at` - Sort by update date (added Feb 16)
- `idx_journals_fts` (GIN) - Full-text search (added Feb 16)

#### 2. `wiki.journal_categories` (Categories Table)

Stores user-defined categories for organizing journals.

```sql
CREATE TABLE wiki.journal_categories (
  id TEXT PRIMARY KEY,  -- Format: jcat-{userId}-{timestamp}-{random}
  user_id INTEGER NOT NULL REFERENCES users.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT journal_categories_unique_name UNIQUE (user_id, name)
);
```

**Special Category:**

- Every user has an "Uncategorized" category (auto-created)
- Cannot be renamed or deleted
- Always sort_order = 0 (appears first)

#### 3. `wiki.wiki_revisions` (Shared with Wiki)

Stores content history for both wiki pages and journals.

```sql
CREATE TABLE wiki.wiki_revisions (
  id BIGSERIAL PRIMARY KEY,
  page_id BIGINT NOT NULL,  -- journal.id or wiki_page.id
  content TEXT NOT NULL,
  summary TEXT,
  content_format VARCHAR(50) DEFAULT 'markdown',
  author_id INTEGER REFERENCES users.users(id),
  is_minor BOOLEAN DEFAULT FALSE,
  size_bytes INTEGER,
  revision_timestamp TIMESTAMP DEFAULT NOW()
);
```

**Key Points:**

- `page_id` references `journals.id` for journal entries
- No namespace column - revisions identified by page_id alone
- Latest revision fetched via `SELECT MAX(id)` subquery

---

## API Endpoints

The journals system exposes **11 API routes** (all require authentication):

### Core Operations

#### GET `/api/journals`

**Purpose**: List all user's journals
**Authorization**: User (own journals only)
**Query Params**: None
**Response**: Array of journals with metadata

#### POST `/api/journals`

**Purpose**: Create new journal
**Authorization**: User
**Body**: `{ title?: string }`
**Response**: Created journal object

#### GET `/api/journals/[slug]`

**Purpose**: Get single journal with content
**Authorization**: User (owner only)
**Response**: Journal with latest content from wiki_revisions

#### PATCH `/api/journals/[slug]`

**Purpose**: Update journal (save content or rename)
**Authorization**: User (owner only)
**Body**: `{ content?: string, title?: string }`
**Response**: Success message

### Search

#### GET `/api/journals/search?q={query}&limit={n}&offset={n}`

**Purpose**: Full-text search across user's journals
**Authorization**: User
**Features**:

- PostgreSQL FTS with GIN index
- Relevance ranking (title matches rank higher)
- Pagination support
- 50-80% faster than LIKE queries

**Response**:

```json
{
  "success": true,
  "data": {
    "pages": [...],
    "total": 100,
    "has_more": true,
    "query": "search term",
    "limit": 20,
    "offset": 0
  }
}
```

### Delete & Restore

#### DELETE `/api/journals/bulk-delete`

**Purpose**: Soft delete or permanently delete journals
**Authorization**: User (owner only), Admin (permanent delete)
**Body**: `{ journalIds: number[], permanent?: boolean }`
**Response**: Deleted count

**Behavior**:

- Regular users: Soft delete only (is_deleted = TRUE)
- Admin with permanent=true: Hard delete from database
- Permanent delete requires journals already soft-deleted

#### POST `/api/journals/restore`

**Purpose**: Restore soft-deleted journals from trash
**Authorization**: User (owner only), Admin (all journals)
**Body**: `{ journalIds: number[] }`
**Response**: Restored journal list

#### GET `/api/journals/deleted`

**Purpose**: List soft-deleted journals (trash view)
**Authorization**: User (own deleted only), Admin (all deleted)
**Response**: Array of deleted journals

### Categories

#### GET `/api/journals/categories`

**Purpose**: List user's categories
**Authorization**: User
**Response**: Array of categories sorted by sort_order

#### POST `/api/journals/categories`

**Purpose**: Create new category
**Authorization**: Admin/Developer only
**Body**: `{ name: string }`
**Response**: Created category

#### PATCH `/api/journals/categories/[id]`

**Purpose**: Rename category
**Authorization**: Admin/Developer only
**Body**: `{ name: string }`
**Response**: Updated category

#### DELETE `/api/journals/categories/[id]`

**Purpose**: Delete category (moves journals to Uncategorized)
**Authorization**: Admin/Developer only
**Response**: Success message

#### POST `/api/journals/categories/reorder`

**Purpose**: Reorder categories
**Authorization**: Admin/Developer only
**Body**: `{ orderedIds: string[] }`
**Response**: Success message

### Journal Movement

#### POST `/api/journals/[slug]/move`

**Purpose**: Move journal to different category
**Authorization**: User (owner only), Admin (all journals)
**Body**: `{ categoryId: string }`
**Response**: Success message

---

## State Management

The journals system uses **Zustand** for client-side state management, split into **7 focused stores** (refactored Feb 16, 2026).

### Store Architecture

```
/stores/journals/
├── types.ts                 - Shared TypeScript interfaces
├── useJournalsData.ts       - CRUD operations
├── useJournalsUI.ts         - UI state (expansion, selection)
├── useJournalsSearch.ts     - Search state
├── useJournalsSelection.ts  - Batch selection
├── useJournalsEditor.ts     - Editor content
├── useJournalsHistory.ts    - Undo/redo
└── index.ts                 - Centralized exports
```

### 1. useJournalsData (133 lines)

**Purpose**: Manage journals and categories data

**State**:

- `journals: JournalNode[]`
- `categories: JournalCategory[]`

**Actions**:

- `setJournals`, `addJournal`, `updateJournal`, `removeJournals`
- `setCategories`, `addCategory`, `updateCategory`, `removeCategory`
- `getJournalsByCategory`, `getUncategorizedId`

### 2. useJournalsUI (94 lines)

**Purpose**: UI state management

**State**:

- `selectedJournalId: number | null`
- `expandedNodes: Set<number>`
- `expandedCategories: Set<string>`
- `isPreviewMode: boolean`
- `sidebarWidth: number`

**Actions**:

- `setSelectedJournal`, `toggleNodeExpansion`, `toggleCategoryExpansion`
- `setSidebarWidth`, `setIsPreviewMode`

### 3. useJournalsSearch (54 lines)

**Purpose**: Search state

**State**:

- `searchQuery: string`
- `searchResults: JournalSearchResult[]`
- `isSearching: boolean`

**Actions**:

- `setSearchQuery`, `setSearchResults`, `clearSearch`

### 4. useJournalsSelection (83 lines)

**Purpose**: Batch selection for delete operations

**State**:

- `selectedJournalsForDeletion: Set<number>`
- `selectedCategoriesForDeletion: Set<string>`

**Actions**:

- `toggleJournalSelection`, `toggleCategorySelection`
- `selectAll`, `selectOnly`, `clearSelections`

### 5. useJournalsEditor (32 lines)

**Purpose**: Editor content state

**State**:

- `currentContent: string`

**Actions**:

- `setCurrentContent`

### 6. useJournalsHistory (212 lines)

**Purpose**: Undo/redo functionality

**State**:

- `undoRedoHistory: HistoryAction[]`
- `undoRedoIndex: number`

**Actions**:

- `pushHistory`, `undo`, `redo`, `canUndo`, `canRedo`, `clearHistory`

**Features**:

- localStorage persistence
- Action types: journal_created, journal_deleted, journal_moved, journal_renamed
- Immutable pattern (returns updated journals array)

### 7. index.ts (22 lines)

**Purpose**: Centralized exports for clean imports

```typescript
export { useJournalsData } from "./useJournalsData";
export { useJournalsUI } from "./useJournalsUI";
export { useJournalsSearch } from "./useJournalsSearch";
export { useJournalsSelection } from "./useJournalsSelection";
export { useJournalsEditor } from "./useJournalsEditor";
export { useJournalsHistory } from "./useJournalsHistory";
export type {
  JournalNode,
  JournalCategory,
  JournalSearchResult,
  HistoryAction,
} from "./types";
```

**Usage Example**:

```typescript
import { useJournalsData, useJournalsUI } from "@/stores/journals";

const { journals, categories, updateJournal } = useJournalsData();
const { selectedJournalId, setSelectedJournal } = useJournalsUI();
```

---

## Component Hierarchy

```
JournalsPageClient (Page)
└── JournalsLayout
    ├── JournalsSidebar
    │   ├── CreateJournalModal
    │   ├── JournalCategorySection
    │   │   └── TreeNode (per journal)
    │   └── TreeNode (uncategorized journals)
    └── JournalsEditor
```

### Component Descriptions

#### JournalsPageClient (`/app/wiki/category/journals/JournalsPageClient.tsx`)

- Server-side rendered page wrapper
- Receives initial journals data from server
- Hydrates Zustand stores on mount

#### JournalsLayout (`/components/journals/JournalsLayout.tsx`)

- Main container with resizable sidebar
- Manages sidebar width state
- Coordinates between sidebar and editor

#### JournalsSidebar (`/components/journals/JournalsSidebar.tsx`)

- Left panel with category tree
- Search bar for full-text search
- Bulk actions toolbar (delete, restore)
- Create new journal button
- Undo/redo keyboard shortcuts (Ctrl+Z, Ctrl+Y)

#### JournalCategorySection (`/components/journals/JournalCategorySection.tsx`)

- Collapsible category with journal list
- Drag-and-drop support for moving journals
- Context menu (rename, delete category)
- Journal count badge

#### TreeNode (`/components/journals/TreeNode.tsx`)

- Individual journal item in sidebar
- Draggable for category movement
- Inline rename (double-click or F2)
- Selection checkbox (for bulk actions)

#### JournalsEditor (`/components/journals/JournalsEditor.tsx`)

- Right panel with Tiptap rich text editor
- Auto-save every 30 seconds
- Manual save button (Ctrl+S)
- Preview mode toggle

#### CreateJournalModal (`/components/journals/CreateJournalModal.tsx`)

- Modal for creating new journal
- Optional title input (auto-generates if empty)
- Keyboard shortcuts (Enter to create, Escape to close)

---

## Data Flow

### 1. Initial Page Load

```
[Server] GET /wiki/category/journals
  ↓
[Server] getJournalsData(user.id)
  ↓ SQL query
[Database] SELECT journals + categories
  ↓
[Server] Serialize to JSON
  ↓
[Client] JournalsPageClient receives journals prop
  ↓
[Client] useEffect → setJournals(journals)
  ↓
[Zustand] useJournalsData.journals updated
  ↓
[Components] Re-render with journals
```

### 2. Create New Journal

```
[UI] User clicks "New Journal"
  ↓
[Modal] CreateJournalModal opens
  ↓
[User] Enters title (optional) → clicks Create
  ↓
[API] POST /api/journals { title }
  ↓
[Server] Insert into journals table
  ↓
[Server] Insert initial revision into wiki_revisions
  ↓
[API] Returns created journal
  ↓
[Client] onCreated(journal) callback
  ↓
[Zustand] addJournal(journal)
  ↓
[History] pushHistory('journal_created')
  ↓
[UI] Sidebar re-renders, new journal appears
```

### 3. Search Journals

```
[UI] User types in search bar
  ↓
[Debounce] Wait 300ms
  ↓
[API] GET /api/journals/search?q=query
  ↓
[Server] FTS query with ts_rank()
  ↓
[Database] search_vector @@ plainto_tsquery()
  ↓
[API] Returns ranked results
  ↓
[Zustand] setSearchResults(results)
  ↓
[UI] Display search results (ranked by relevance)
```

### 4. Delete Journals (Bulk)

```
[UI] User selects multiple journals → clicks Delete
  ↓
[API] DELETE /api/journals/bulk-delete { journalIds }
  ↓
[Auth] verifyBulkOwnership(journals, user)
  ↓
[Database] UPDATE journals SET is_deleted = TRUE
  ↓
[API] Returns success
  ↓
[Zustand] removeJournals(journalIds)
  ↓
[History] pushHistory('journal_deleted')
  ↓
[UI] Journals disappear from sidebar
```

### 5. Move Journal to Category

```
[UI] User drags journal to category
  ↓
[Component] onDrop event handler
  ↓
[API] POST /api/journals/[slug]/move { categoryId }
  ↓
[Server] journalCategoryService.moveJournalToCategory()
  ↓
[Database] UPDATE journals SET category_id = ?
  ↓
[API] Returns success
  ↓
[Zustand] updateJournal(id, { category_id })
  ↓
[History] pushHistory('journal_moved')
  ↓
[UI] Journal moves to new category
```

---

## Authorization

The journals system uses **centralized authorization utilities** (`/lib/auth/ownership.ts`) to ensure consistent permission checks.

### Authorization Functions

#### `verifyJournalOwnership(entity, user, options?)`

- Normalizes user_id (handles string/number/null)
- Supports admin bypass with `allowAdmin: true`
- Returns boolean

#### `assertJournalOwnership(entity, user, options?)`

- Throws `PermissionError` if unauthorized
- Used in API routes for ownership checks

#### `verifyAdminRole(userRole)`

- Checks if user is admin or developer
- Returns boolean

#### `assertAdminRole(userRole)`

- Throws `PermissionError` if not admin
- Used in API routes requiring admin privileges

#### `verifyBulkOwnership(entities, user, options?)`

- Checks ownership for array of entities
- Returns `{ authorized: boolean, unauthorized: T[] }`

#### `assertBulkOwnership(entities, user, options?)`

- Throws `PermissionError` if any entity unauthorized
- Used in bulk delete/restore operations

### Permission Matrix

| Action                             | Regular User | Admin/Developer |
| ---------------------------------- | ------------ | --------------- |
| **View own journals**              | ✅           | ✅              |
| **View other users' journals**     | ❌           | ✅              |
| **Create journal**                 | ✅           | ✅              |
| **Edit own journal**               | ✅           | ✅              |
| **Edit other users' journal**      | ❌           | ✅              |
| **Delete own journal (soft)**      | ✅           | ✅              |
| **Delete own journal (permanent)** | ❌           | ✅              |
| **Delete other users' journal**    | ❌           | ✅              |
| **Restore own journal**            | ✅           | ✅              |
| **Restore other users' journal**   | ❌           | ✅              |
| **Create category**                | ❌           | ✅              |
| **Rename category**                | ❌           | ✅              |
| **Delete category**                | ❌           | ✅              |
| **Reorder categories**             | ❌           | ✅              |
| **Move journal to category**       | ✅ (own)     | ✅ (all)        |

---

## Performance Optimizations

### 1. Full-Text Search (Feb 16, 2026)

**Problem**: LIKE queries (`LIKE '%query%'`) caused 300-500ms searches with full table scans

**Solution**: PostgreSQL full-text search with GIN index

```sql
-- Add tsvector column
ALTER TABLE wiki.journals ADD COLUMN search_vector TSVECTOR;

-- Create GIN index (50-80% faster)
CREATE INDEX idx_journals_fts ON wiki.journals USING GIN(search_vector);

-- Trigger to maintain search_vector
CREATE TRIGGER journals_search_vector_trigger
  BEFORE INSERT OR UPDATE ON wiki.journals
  FOR EACH ROW
  EXECUTE FUNCTION journals_search_vector_update();
```

**Benefits**:

- 50-80% faster queries (<100ms typical)
- Relevance ranking with `ts_rank()`
- Title matches weighted higher (A) than content (B)
- Handles multi-word searches efficiently

### 2. Zustand Store Split (Feb 16, 2026)

**Problem**: Monolithic 577-line store caused unnecessary re-renders

**Solution**: Split into 7 focused stores

**Benefits**:

- Components only subscribe to needed state
- Reduced re-render overhead
- Easier to test and maintain
- Each store <150 lines

### 3. Database Indexes

**Optimized Queries**:

- User journals: `idx_journals_user_id`
- Slug lookup: `idx_journals_slug`
- Category filtering: `idx_journals_category_id`
- Trash view: `idx_journals_deleted` (composite: is_deleted, user_id)
- Sorting: `idx_journals_created_at`, `idx_journals_updated_at`
- Search: `idx_journals_fts` (GIN index)

### 4. Revision Fetching

**Efficient Latest Content**:

```sql
-- Uses idx_wiki_revisions_page_id
SELECT content
FROM wiki_revisions
WHERE page_id = ?
ORDER BY id DESC
LIMIT 1
```

---

## File Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── wiki/category/journals/
│   │   │   └── JournalsPageClient.tsx    # Client-side page
│   │   └── api/journals/
│   │       ├── route.ts                  # GET list, POST create
│   │       ├── [slug]/
│   │       │   ├── route.ts              # GET single, PATCH update
│   │       │   └── move/route.ts         # POST move to category
│   │       ├── search/route.ts           # GET search
│   │       ├── bulk-delete/route.ts      # DELETE bulk
│   │       ├── restore/route.ts          # POST restore
│   │       ├── deleted/route.ts          # GET deleted list
│   │       └── categories/
│   │           ├── route.ts              # GET list, POST create
│   │           ├── [id]/route.ts         # PATCH rename, DELETE
│   │           ├── reorder/route.ts      # POST reorder
│   │           └── team/route.ts         # Team categories (TBD)
│   ├── components/journals/
│   │   ├── JournalsLayout.tsx            # Main container
│   │   ├── JournalsSidebar.tsx           # Left panel
│   │   ├── JournalsEditor.tsx            # Right panel
│   │   ├── JournalCategorySection.tsx    # Category with journals
│   │   ├── TreeNode.tsx                  # Individual journal
│   │   └── CreateJournalModal.tsx        # Create modal
│   ├── stores/journals/
│   │   ├── types.ts                      # Shared types
│   │   ├── useJournalsData.ts            # CRUD operations
│   │   ├── useJournalsUI.ts              # UI state
│   │   ├── useJournalsSearch.ts          # Search state
│   │   ├── useJournalsSelection.ts       # Batch selection
│   │   ├── useJournalsEditor.ts          # Editor content
│   │   ├── useJournalsHistory.ts         # Undo/redo
│   │   └── index.ts                      # Exports
│   └── lib/
│       ├── auth/ownership.ts             # Authorization utilities
│       └── journals/
│           └── JournalCategoryService.ts # Category service
└── scripts/migrations/
    ├── 010a-journal-categories.sql       # Create categories table
    ├── 016-journal-deletion-tracking.sql # Add soft delete
    ├── 018-separate-journals-table.sql   # Migrate to dedicated table
    ├── 019-journal-restore-tracking.sql  # Add restore tracking
    ├── 020-add-journals-fts.sql          # Add full-text search
    └── migrate-journals-to-table.ts      # Data migration script
```

---

## Architecture Decisions

### Why Separate from Wiki?

**Decision Date**: February 15, 2026

**Reasons**:

1. **Performance**: Wiki queries were slow due to polymorphic joins
2. **Schema Clarity**: Journals have different fields than wiki pages
3. **Authorization**: Journals are always private, wiki pages can be public
4. **Features**: Journals need categories, wiki needs infoboxes/templates
5. **Query Optimization**: Can add journal-specific indexes without affecting wiki

**Trade-offs**:

- ✅ Faster queries (no namespace filtering)
- ✅ Clearer code (no polymorphic patterns)
- ✅ Journal-specific features easier to add
- ❌ Revisions still shared (wiki_revisions table)
- ❌ More tables to maintain

### Why Split Zustand Store?

**Decision Date**: February 16, 2026

**Reasons**:

1. **Performance**: 577-line monolithic store caused unnecessary re-renders
2. **Maintainability**: Hard to understand and modify
3. **Testing**: Easier to test focused stores
4. **Composition**: Components can subscribe to only what they need

**Trade-offs**:

- ✅ Better performance (fewer re-renders)
- ✅ Easier to maintain (<150 lines per store)
- ✅ Clear separation of concerns
- ❌ More imports per component (2-3 instead of 1)
- ❌ More files to navigate

### Why Full-Text Search?

**Decision Date**: February 16, 2026

**Reasons**:

1. **Performance**: LIKE queries were 300-500ms (full table scan)
2. **Relevance**: FTS provides ranking, LIKE doesn't
3. **Multi-word**: FTS handles "foo bar" efficiently, LIKE doesn't
4. **PostgreSQL Native**: No external service needed

**Trade-offs**:

- ✅ 50-80% faster (<100ms typical)
- ✅ Relevance ranking built-in
- ✅ Automatic with trigger
- ❌ Adds search_vector column (~50-100MB for 10k journals)
- ❌ Slightly more complex queries

---

## Future Considerations

### Potential Improvements

1. **Real-time Sync** (WebSocket)
   - Currently: Manual refresh needed
   - Future: Live updates across tabs/devices

2. **Rich Text Formatting**
   - Currently: Plain markdown
   - Future: Tiptap with formatting toolbar

3. **Attachments**
   - Currently: Text only
   - Future: Image/file uploads

4. **Tags**
   - Currently: Categories only
   - Future: Multiple tags per journal

5. **Export**
   - Currently: No export
   - Future: Export to PDF/Markdown/JSON

### Known Issues

1. **Team Categories** - Under review, may be removed if unused
2. **Content Column** - Deprecated in journals table, should be removed
3. **Undo/Redo** - Limited to 50 actions, lost on refresh

---

## Related Documentation

- [Schema Evolution](../database/JOURNALS_SCHEMA_EVOLUTION.md) - Migration history
- [API Reference](../api/JOURNALS_API_REFERENCE.md) - Complete endpoint docs
- [Comprehensive Plan](../../docs/features/journals/COMPREHENSIVE_REFACTOR_PLAN.md) - Refactoring plan

---

**Last Updated**: February 16, 2026
**Maintained By**: Development Team
**Status**: ✅ Production-ready
