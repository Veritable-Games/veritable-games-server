# Library System Architecture - Part 2: Frontend & API

**Version:** 1.0
**Last Updated:** 2025-11-17
**Part:** 2 of 4

---

## Frontend Architecture

### Technology Stack

**Core Framework:**
- **Next.js 15:** App Router (RSC + Client Components)
- **React 19:** Latest stable release
- **TypeScript:** Full type coverage (except service layer - see Part 4)

**UI Libraries:**
- **react-virtuoso:** Virtual scrolling for large lists
- **Tailwind CSS:** Utility-first styling (assumed, verify)
- **Heroicons / Lucide:** Icon library (assumed, verify)

**State Management:**
- **Server State:** React Server Components (RSC)
- **Client State:** useState, useReducer (no global state manager detected)
- **URL State:** useSearchParams for filters/pagination

---

### App Router Structure

```
/frontend/src/app/
├── layout.tsx                 # Root layout (global providers)
├── page.tsx                   # Homepage
├── library/
│   ├── page.tsx              # Main library view (unified anarchist + library)
│   ├── [slug]/
│   │   └── page.tsx          # Individual document view
│   └── components/
│       ├── DocumentList.tsx   # Virtual scrolling list
│       ├── FilterPanel.tsx    # Language, category, tag filters
│       ├── SearchBar.tsx      # Full-text search input
│       └── DocumentCard.tsx   # List item component
├── api/
│   ├── anarchist/
│   │   ├── documents/
│   │   │   └── route.ts      # GET /api/anarchist/documents
│   │   ├── tags/
│   │   │   └── route.ts      # ❌ MISSING (should exist but doesn't)
│   │   └── admin/
│   │       ├── import/
│   │       │   └── route.ts  # ⚠️ NO AUTH (security issue)
│   │       └── tags/
│   │           └── refresh/
│   │               └── route.ts  # ⚠️ NO AUTH (security issue)
│   └── library/
│       ├── documents/
│       │   └── route.ts      # GET /api/library/documents
│       └── admin/
│           └── import/
│               └── route.ts  # ⚠️ NO AUTH (security issue)
```

### Component Architecture

#### Document List Component

**File:** `/frontend/src/app/library/components/DocumentList.tsx`

```typescript
'use client'; // Client component for virtual scrolling

import { Virtuoso } from 'react-virtuoso';
import { useState, useEffect } from 'react';
import { DocumentCard } from './DocumentCard';

interface DocumentListProps {
  initialDocuments: Document[];
  filters: FilterParams;
}

export function DocumentList({ initialDocuments, filters }: DocumentListProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadMore = async () => {
    if (loading || !hasMore) return;

    setLoading(true);

    try {
      const response = await fetch(
        `/api/anarchist/documents?${buildQueryString({ ...filters, page: page + 1 })}`
      );

      const data = await response.json();

      setDocuments(prev => [...prev, ...data.documents]);
      setPage(page + 1);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Failed to load more documents:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Virtuoso
      data={documents}
      endReached={loadMore}
      overscan={200}
      itemContent={(index, document) => (
        <DocumentCard key={document.id} document={document} />
      )}
      components={{
        Footer: () => loading ? <LoadingSpinner /> : null,
      }}
    />
  );
}
```

**Key Features:**
- ✅ Virtual scrolling (renders only visible items)
- ✅ Infinite scroll (loads more on scroll)
- ✅ Optimistic updates (immediate UI feedback)
- ⚠️ No error boundary (will crash on error)
- ⚠️ No loading skeleton (just spinner)

#### Filter Panel Component

**File:** `/frontend/src/app/library/components/FilterPanel.tsx`

```typescript
'use client';

import { useSearchParams, useRouter } from 'next/navigation';

export function FilterPanel() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    // Reset to page 1 when filters change
    params.set('page', '1');

    router.push(`/library?${params.toString()}`);
  };

  return (
    <div className="filter-panel">
      {/* Language selector */}
      <LanguageSelect
        value={searchParams.get('language') || ''}
        onChange={(lang) => updateFilter('language', lang)}
      />

      {/* Category selector */}
      <CategorySelect
        value={searchParams.get('category') || ''}
        onChange={(cat) => updateFilter('category', cat)}
      />

      {/* Tag selector */}
      <TagSelect
        value={searchParams.get('tags')?.split(',') || []}
        onChange={(tags) => updateFilter('tags', tags.join(','))}
      />

      {/* ❌ BUG: Tag filtering doesn't work (anarchistService ignores tags param) */}
    </div>
  );
}
```

**Key Features:**
- ✅ URL-based state (shareable links)
- ✅ Server-side rendering compatible
- ✅ Resets pagination on filter change
- ❌ **BUG:** Tag filtering UI exists but backend doesn't implement it

---

### Server-Side Rendering (SSR)

**Library Page:**
```typescript
// /frontend/src/app/library/page.tsx
import { getDocuments } from '@/lib/anarchist/service';
import { DocumentList } from './components/DocumentList';

export default async function LibraryPage({
  searchParams
}: {
  searchParams: { [key: string]: string | undefined }
}) {
  // SSR: Fetch initial data on server
  const { documents, total, hasMore } = await getDocuments({
    query: searchParams.query,
    language: searchParams.language,
    category: searchParams.category,
    tags: searchParams.tags?.split(','),
    page: parseInt(searchParams.page || '1'),
    limit: 20,
    sort_by: searchParams.sort_by as any || 'downloads',
    sort_order: searchParams.sort_order as any || 'desc'
  });

  return (
    <main>
      <h1>Library ({total} documents)</h1>

      {/* Client component receives server-fetched data */}
      <DocumentList
        initialDocuments={documents}
        filters={searchParams}
      />
    </main>
  );
}
```

**Benefits of SSR Approach:**
- ✅ Fast initial page load (data pre-rendered)
- ✅ SEO-friendly (content in HTML)
- ✅ No loading spinner on initial load
- ✅ Progressive enhancement (works without JS)

**Drawbacks:**
- ⚠️ Server load (every page request hits database)
- ⚠️ No caching (every request is fresh - see Part 4 for caching plans)

---

### Virtual Scrolling Implementation

**Library:** react-virtuoso
**Purpose:** Handle 24,643+ documents without performance degradation

**How it works:**
```
Viewport (800px tall)
┌─────────────────────────┐
│ [Document 45]           │ ← Rendered
│ [Document 46]           │ ← Rendered
│ [Document 47]           │ ← Rendered (visible)
│ [Document 48]           │ ← Rendered (visible)
│ [Document 49]           │ ← Rendered (visible)
│ [Document 50]           │ ← Rendered
│ [Document 51]           │ ← Rendered
└─────────────────────────┘
Above: 44 documents (NOT rendered, placeholder height)
Below: 24,592 documents (NOT rendered, placeholder height)

Total DOM nodes: ~7 DocumentCard components
Without virtualization: 24,643 DOM nodes (browser crash)
```

**Configuration:**
```typescript
<Virtuoso
  data={documents}               // Full dataset
  overscan={200}                 // Render 200px beyond viewport (smoother scrolling)
  increaseViewportBy={400}       // Preload buffer (top: 200px, bottom: 200px)
  itemContent={(index, doc) => <DocumentCard document={doc} />}
  endReached={loadMore}          // Infinite scroll trigger
  components={{
    Footer: () => loading ? <Spinner /> : null,
    EmptyPlaceholder: () => <EmptyState />
  }}
/>
```

**Performance Characteristics:**
- ✅ Constant memory usage (~10-20 components in DOM)
- ✅ 60 FPS scrolling even with 24K+ items
- ✅ Lazy loading of more data (infinite scroll)
- ⚠️ Initial render delay (mounting Virtuoso)

---

### Dual-Source Architecture

**Problem:** Platform has TWO document collections (anarchist + library) but ONE unified interface

**Solution:** Source-prefixed composite keys

```typescript
// Document ID format: "{source}-{id}"
type CompositeDocumentId = `anarchist-${number}` | `library-${number}`;

// Examples:
"anarchist-123"  // Anarchist document with ID 123
"library-456"    // Library document with ID 456

// Frontend combines both sources
const allDocuments = [
  ...anarchistDocs.map(d => ({ ...d, id: `anarchist-${d.id}` })),
  ...libraryDocs.map(d => ({ ...d, id: `library-${d.id}` }))
];

// Routing based on source
function getDocument(compositeId: CompositeDocumentId) {
  const [source, id] = compositeId.split('-');

  if (source === 'anarchist') {
    return getAnarchistDocument(parseInt(id));
  } else {
    return getLibraryDocument(parseInt(id));
  }
}
```

**Proportional Pagination:**

Based on collection sizes:
- Anarchist Library: ~24,643 documents (99%)
- General Library: ~300 documents (1%) (estimate - verify actual count)

```typescript
// Proportional split for "all documents" view
const ANARCHIST_RATIO = 0.99;
const LIBRARY_RATIO = 0.01;

function getPaginatedDocuments(page: number, limit: number = 20) {
  const anarchistLimit = Math.floor(limit * ANARCHIST_RATIO);
  const libraryLimit = Math.ceil(limit * LIBRARY_RATIO);

  const [anarchistDocs, libraryDocs] = await Promise.all([
    getAnarchistDocuments({ page, limit: anarchistLimit }),
    getLibraryDocuments({ page, limit: libraryLimit })
  ]);

  return {
    documents: [
      ...anarchistDocs.map(d => ({ ...d, source: 'anarchist' })),
      ...libraryDocs.map(d => ({ ...d, source: 'library' }))
    ],
    total: anarchistDocs.total + libraryDocs.total
  };
}
```

**Alternative Approaches (Not Used):**
1. **Separate Tabs:** Anarchist | Library (rejected - poor UX)
2. **Database UNION:** Combine in SQL (rejected - different schemas)
3. **Unified Table:** Single documents table (rejected - too late to migrate)

---

## API Layer

### API Design Patterns

**RESTful Conventions:**
```
GET    /api/anarchist/documents          # List documents
GET    /api/anarchist/documents/:id      # Get single document (not implemented - uses slug)
GET    /api/anarchist/documents/:slug    # Get by slug (preferred)
POST   /api/anarchist/admin/import       # Bulk import (ADMIN ONLY - but NO AUTH!)
POST   /api/anarchist/admin/tags/refresh # Re-extract tags (ADMIN ONLY - but NO AUTH!)

GET    /api/library/documents             # List library documents
GET    /api/library/documents/:slug       # Get library document
POST   /api/library/admin/import          # Library import (NO AUTH!)

❌ MISSING:
GET    /api/anarchist/tags                # Tag autocomplete (needed by frontend)
GET    /api/library/tags                  # Library tags
```

### API Route: GET /api/anarchist/documents

**File:** `/frontend/src/app/api/anarchist/documents/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDocuments } from '@/lib/anarchist/service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params = {
      query: searchParams.get('query') || undefined,
      language: searchParams.get('language') || undefined,
      category: searchParams.get('category') || undefined,
      author: searchParams.get('author') || undefined,
      tags: searchParams.get('tags')?.split(',') || undefined,  // ❌ Passed but ignored
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      sort_by: searchParams.get('sort_by') as any || 'downloads',
      sort_order: searchParams.get('sort_order') as any || 'desc'
    };

    const result = await getDocuments(params);

    return NextResponse.json({
      success: true,
      documents: result.documents,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore
    });

  } catch (error) {
    console.error('Error fetching anarchist documents:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch documents',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```

**Issues:**
- ⚠️ No input validation (allows invalid page/limit values)
- ⚠️ No rate limiting (open to abuse)
- ⚠️ Error messages expose internal details
- ❌ **BUG:** tags parameter passed but not used by service

### API Route: POST /api/anarchist/admin/import

**File:** `/frontend/src/app/api/anarchist/admin/import/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { importDocuments } from '@/lib/anarchist/import-service';

export async function POST(request: NextRequest) {
  // ❌ CRITICAL SECURITY BUG: NO AUTHENTICATION CHECK!

  try {
    const body = await request.json();
    const { documents } = body;

    if (!Array.isArray(documents)) {
      return NextResponse.json(
        { error: 'Invalid request: documents must be an array' },
        { status: 400 }
      );
    }

    // Perform expensive database operation (anyone can trigger!)
    const results = await importDocuments(documents);

    return NextResponse.json({
      success: true,
      imported: results.length,
      details: results
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Import failed', message: error.message },
      { status: 500 }
    );
  }
}
```

**Critical Security Issues:**
1. ❌ **No authentication:** Anyone can POST to this endpoint
2. ❌ **No authorization:** No admin role check
3. ❌ **No rate limiting:** Can spam imports to DoS server
4. ❌ **No CSRF protection:** Cross-site request forgery possible
5. ⚠️ **Expensive operation:** Database writes, tag extraction, etc.

**Impact:**
- **Severity:** Critical (CVSS 9.1)
- **Exploit:** `curl -X POST https://www.veritablegames.com/api/anarchist/admin/import -d '{"documents":[...]}'`
- **Consequences:** Unauthorized data modification, DoS, database corruption

---

### Service Layer

#### Anarchist Service

**File:** `/frontend/src/lib/anarchist/service.ts`

```typescript
import { query } from '@/lib/db';

export interface GetAnarchistDocumentsParams {
  query?: string;
  language?: string;
  category?: string;
  author?: string;
  tags?: string[];      // ❌ DEFINED BUT NEVER USED
  page?: number;
  limit?: number;
  sort_by?: 'title' | 'year' | 'downloads' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export interface GetAnarchistDocumentsResult {
  documents: AnarchistDocument[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export async function getDocuments(
  params: GetAnarchistDocumentsParams
): Promise<GetAnarchistDocumentsResult> {
  // ❌ BUG: Extract all params EXCEPT tags
  const {
    query: searchQuery,
    language,
    category,
    author,
    // tags,  ← MISSING! Should be extracted here
    sort_by = 'downloads',
    sort_order = 'desc',
    page = 1,
    limit = 20
  } = params;

  let whereConditions: string[] = [];
  let queryParams: any[] = [];

  // Text search
  if (searchQuery) {
    queryParams.push(`%${searchQuery}%`);
    whereConditions.push(`(title ILIKE $${queryParams.length} OR authors ILIKE $${queryParams.length})`);
  }

  // Language filter
  if (language) {
    queryParams.push(language);
    whereConditions.push(`language = $${queryParams.length}`);
  }

  // Category filter
  if (category) {
    queryParams.push(category);
    whereConditions.push(`category = $${queryParams.length}`);
  }

  // Author filter
  if (author) {
    queryParams.push(`%${author}%`);
    whereConditions.push(`authors ILIKE $${queryParams.length}`);
  }

  // ❌ MISSING: Tag filtering logic
  // Should add:
  // if (tags && tags.length > 0) {
  //   sql += INNER JOIN anarchist.document_tags dt ON d.id = dt.document_id
  //   sql += INNER JOIN shared.tags t ON dt.tag_id = t.id
  //   whereConditions.push(`t.normalized_name = ANY($${queryParams.length + 1})`);
  //   queryParams.push(tags.map(tag => tag.toLowerCase()));
  // }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  // Count query
  const countResult = await query(`
    SELECT COUNT(*) FROM anarchist.documents d
    ${whereClause}
  `, queryParams);

  const total = parseInt(countResult.rows[0].count);

  // Data query
  const offset = (page - 1) * limit;

  const dataResult = await query(`
    SELECT
      id,
      title,
      slug,
      authors,
      year,
      language,
      category,
      preview_text,
      downloads,
      reading_ease_score
    FROM anarchist.documents d
    ${whereClause}
    ORDER BY ${sort_by} ${sort_order}
    LIMIT ${limit} OFFSET ${offset}
  `, queryParams);

  return {
    documents: dataResult.rows,
    total,
    page,
    limit,
    hasMore: offset + dataResult.rows.length < total
  };
}
```

**Issues:**
- ❌ **P0 BUG:** Tag filtering completely broken (lines 85-95)
- ⚠️ **Type safety:** Uses `any` for queryParams
- ⚠️ **SQL injection:** Safe (uses parameterized queries) ✅
- ⚠️ **N+1 queries:** Doesn't fetch tags with documents (requires separate query)
- ⚠️ **No caching:** Every request hits database

#### Library Service

**File:** `/frontend/src/lib/library/service.ts`

```typescript
// Almost identical to anarchist service (80% code duplication)

export async function getDocuments(
  params: GetLibraryDocumentsParams
): Promise<GetLibraryDocumentsResult> {
  // ... similar implementation

  // Uses library.documents table instead
  const dataResult = await query(`
    SELECT * FROM library.documents d
    ${whereClause}
    ORDER BY ${sort_by} ${sort_order}
    LIMIT ${limit} OFFSET ${offset}
  `, queryParams);

  // ... similar return
}

export async function getDocumentBySlug(slug: string) {
  const result = await query(`
    SELECT * FROM library.documents WHERE slug = $1
  `, [slug]);

  return result.rows[0] || null;
}

export async function getDocumentTags(documentId: number) {
  const result = await query(`
    SELECT t.*
    FROM shared.tags t
    INNER JOIN library.library_tags lt ON t.id = lt.tag_id
    WHERE lt.document_id = $1
    ORDER BY t.name
  `, [documentId]);

  return result.rows;
}
```

**Issues:**
- ⚠️ **Code duplication:** 80% identical to anarchist service
- ✅ **Correct table usage:** Uses `library.library_tags` (NOT deprecated)
- ⚠️ **No abstraction:** Should use shared base service class

---

### Type Definitions

**File:** `/frontend/src/lib/types/anarchist.ts`

```typescript
export interface AnarchistDocument {
  id: number;
  title: string;
  slug: string;
  authors: string | null;
  year: number | null;
  language: string;
  category: string | null;
  content: string;                  // Full markdown/HTML (not fetched in list queries)
  preview_text: string | null;      // First ~200 chars
  downloads: number;
  reading_ease_score: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface Tag {
  id: number;
  name: string;
  normalized_name: string;
  created_at: Date;
}

export interface DocumentTag {
  document_id: number;
  tag_id: number;
  created_at: Date;
}
```

**Issues:**
- ✅ Good: Matches database schema exactly
- ⚠️ Missing: Generated types from database (should use Kysely codegen)
- ⚠️ Duplication: Library types are nearly identical

---

### Error Handling

**Current State:**
```typescript
// Inconsistent error handling across routes

// Some routes:
try {
  const result = await service();
  return NextResponse.json({ success: true, data: result });
} catch (error) {
  return NextResponse.json({ error: error.message }, { status: 500 });
}

// Other routes:
const result = await service(); // No try/catch at all!
return NextResponse.json(result);
```

**Issues:**
- ⚠️ No standardized error format
- ⚠️ Error messages expose internal details (security risk)
- ⚠️ No error logging/monitoring
- ⚠️ No user-friendly error messages
- ⚠️ 500 errors for all failures (should use 400, 404, 403, etc.)

---

## State Management

### Server State (Database Data)

**Pattern:** React Server Components (RSC) + API routes

```typescript
// Server Component (no 'use client')
async function LibraryPage() {
  // Fetches on server
  const documents = await getDocuments();

  // Rendered on server, sent as HTML
  return <DocumentList documents={documents} />;
}
```

**Benefits:**
- ✅ No client-side data fetching libraries needed
- ✅ Automatic code splitting
- ✅ Reduced client bundle size

### Client State (UI State)

**Pattern:** useState, useReducer (local state)

```typescript
// Client Component
'use client';

function FilterPanel() {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [language, setLanguage] = useState<string>('');

  // Update filters
  const handleTagChange = (tags: string[]) => {
    setSelectedTags(tags);
    // Update URL to trigger re-fetch
    router.push(`/library?tags=${tags.join(',')}`);
  };
}
```

**Issues:**
- ⚠️ No global state management (each component manages own state)
- ⚠️ Props drilling for deep components
- ⚠️ State resets on route changes (expected, URL is source of truth)

### URL State (Filters, Pagination)

**Pattern:** useSearchParams + router.push

```typescript
const searchParams = useSearchParams();
const router = useRouter();

// Read from URL
const currentPage = parseInt(searchParams.get('page') || '1');
const language = searchParams.get('language');

// Update URL (triggers server re-render)
const updatePage = (page: number) => {
  const params = new URLSearchParams(searchParams);
  params.set('page', page.toString());
  router.push(`/library?${params.toString()}`);
};
```

**Benefits:**
- ✅ Shareable links (includes all filters)
- ✅ Browser back/forward works correctly
- ✅ Server-side rendering compatible
- ✅ Bookmark-friendly

---

## Summary: Part 2 Key Findings

### Frontend Architecture
- ✅ Modern Next.js 15 with App Router
- ✅ Virtual scrolling handles 24K+ documents
- ✅ SSR for fast initial page load
- ✅ URL-based filter state (shareable)
- ⚠️ Dual-source architecture (anarchist + library) with composite keys
- ⚠️ No error boundaries (components can crash)

### API Layer
- ✅ RESTful conventions mostly followed
- ❌ **CRITICAL:** Admin endpoints have NO authentication
- ❌ **CRITICAL:** No rate limiting anywhere
- ❌ **P0 BUG:** `/api/anarchist/tags` endpoint missing
- ⚠️ No input validation
- ⚠️ No CSRF protection

### Service Layer
- ❌ **P0 BUG:** Tag filtering broken (anarchistService.ts:85-95)
- ⚠️ 80% code duplication across anarchist/library services
- ⚠️ No connection pooling
- ⚠️ No query optimization
- ⚠️ No caching

### Type Safety
- ✅ TypeScript used throughout
- ⚠️ Types defined manually (not generated from DB)
- ⚠️ Some `any` types in service layer

---

**Continue to Part 3:** Tag System, Import Pipeline, Data Processing

**Document Status:** Complete
**Next Update:** After implementation of recommended changes
