# Document Data Fetching - Code Snippets & Examples

## Type Definitions

### UnifiedDocument (Primary Type)
**File**: `/frontend/src/lib/documents/types.ts`

```typescript
export interface UnifiedDocument {
  id: number | string;
  source: 'library' | 'anarchist';
  slug: string;
  title: string;
  author?: string;
  language: string;
  publication_date?: string;
  document_type?: string;

  // Description/notes - THE PREVIEW FIELD
  description?: string;  // Library: description field; Anarchist: notes field

  // Metadata
  view_count: number;
  created_at: string;
  updated_at: string;

  // Tags and linking
  tags?: UnifiedTag[];
  linked_documents?: UnifiedDocument[];
  linked_document_group_id?: string | null;

  // Source-specific
  source_url?: string;  // Anarchist only
  original_format?: string;  // Anarchist only
  content?: string;  // Not in list view
  file_path?: string;  // Anarchist: filesystem path
}
```

### LibraryDocumentWithMetadata
**File**: `/frontend/src/lib/library/types.ts`

```typescript
export interface LibraryDocumentWithMetadata extends LibraryDocument {
  category_name?: string;
  tags?: Array<{
    id: number;
    name: string;
    type: string;
  }>;
  uploaded_by_username?: string;
  uploaded_by_display_name?: string;
  is_public?: boolean;
}

export interface LibraryDocument {
  id: number;
  slug: string;
  title: string;
  author: string | null;
  publication_date: string | null;
  document_type: string;
  status: string;
  
  // PREVIEW FIELD
  description: string | null;  // ← Main preview
  abstract: string | null;     // ← Secondary preview
  
  content: string;  // Not fetched in list view
  language: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  view_count: number;
  search_text: string | null;
}
```

---

## Database Queries

### Library - SELECT Documents with Description

**File**: `/frontend/src/lib/library/service.ts` (lines 149-161)

```typescript
const documentsQuery = `
  SELECT
    d.*,
    STRING_AGG(DISTINCT c.name, ',') as category_names,
    STRING_AGG(DISTINCT c.code, ',') as category_codes
  FROM library_documents d
  LEFT JOIN library_document_categories dc ON d.id = dc.document_id
  LEFT JOIN library_categories c ON dc.category_id = c.id
  ${whereClause}
  GROUP BY d.id
  ORDER BY d.${safeSortBy} ${safeSortOrder}
  LIMIT $${paramIndex++} OFFSET $${paramIndex++}
`;

// This includes:
// - d.description (the preview field)
// - d.abstract (secondary preview)
// - d.search_text (for search)
// - NOT d.content (only for detail view)
```

### Library - Full-Text Search (includes description)

**File**: `/frontend/src/lib/library/service.ts` (lines 108-118)

```typescript
if (query) {
  whereConditions.push(
    `(d.title ILIKE $${paramIndex} 
      OR d.author ILIKE $${paramIndex} 
      OR d.description ILIKE $${paramIndex}  // ← Searches preview
      OR d.search_text ILIKE $${paramIndex})`
  );
  const searchTerm = `%${query}%`;
  queryParams.push(searchTerm);
  paramIndex++;
}
```

### Anarchist - SELECT Documents with Notes

**File**: `/frontend/src/lib/anarchist/service.ts` (lines 145-157)

```typescript
const documentsQuery = `
  SELECT *
  FROM anarchist.documents d
  ${whereClause}
  ORDER BY d.${safeSortBy} ${safeSortOrder}
  LIMIT $${paramIndex++} OFFSET $${paramIndex++}
`;

// This includes:
// - d.notes (the preview field, mapped to description)
// - NOT d.content (stored on filesystem)
```

### Anarchist - Full-Text Search (includes notes)

**File**: `/frontend/src/lib/anarchist/service.ts` (lines 412-415)

```typescript
async search(query: string, limit: number = 100): Promise<AnarchistDocument[]> {
  const result = await dbAdapter.query(
    `
    SELECT *
    FROM anarchist.documents
    WHERE
      title ILIKE $1 OR
      author ILIKE $1 OR
      notes ILIKE $1  // ← Searches preview
    ORDER BY
      CASE WHEN title ILIKE $1 THEN 1 ELSE 2 END,
      view_count DESC
    LIMIT $2
  `,
    [`%${query}%`, limit],
    { schema: 'anarchist' }
  );
  return result.rows as AnarchistDocument[];
}
```

---

## Service Layer

### UnifiedDocumentService.getDocuments()

**File**: `/frontend/src/lib/documents/service.ts` (lines 45-113)

```typescript
async getDocuments(params: UnifiedSearchParams = {}): Promise<UnifiedSearchResult> {
  const { query, language, tags, source = 'all', ... } = params;
  
  // Query both sources in parallel
  const [libraryResults, anarchistResults] = await Promise.all([
    source !== 'anarchist' 
      ? this.queryLibrary({ query, language, tags, ... })
      : Promise.resolve({ documents: [], total: 0 }),
    source !== 'library'
      ? this.queryAnarchist({ query, language, tags, ... })
      : Promise.resolve({ documents: [], total: 0 }),
  ]);

  // Merge results
  const allDocuments = [...libraryResults.documents, ...anarchistResults.documents];
  
  // Re-sort merged results
  allDocuments.sort((a, b) => {
    // Sort logic
  });

  // Return paginated results
  const paginatedDocuments = allDocuments.slice(0, limit);
  
  return {
    documents: paginatedDocuments,
    pagination: { page, limit, total, total_pages },
    metadata: { search_time_ms: Date.now() - startTime, ... }
  };
}
```

### Library Query with Tag Fetching

**File**: `/frontend/src/lib/library/service.ts` (lines 119-147)

```typescript
private async queryLibrary(params: any) {
  try {
    const result = await libraryService.getDocuments({
      status: 'published',
      ...params,  // Includes query, language, tags, sort_by, sort_order
    });

    // Returns LibraryDocumentWithMetadata[] which includes:
    // - description field
    // - tags array (fetched separately)
    // - category_name
    // - all metadata fields
    
    return {
      documents: (result.documents || []).map(doc => {
        return {
          ...doc,
          source: 'library' as const,
          author: doc.author || undefined,
          language: doc.language || 'en',
          publication_date: doc.publication_date || undefined,
          description: doc.description || undefined,  // ← Passed through
          document_type: doc.document_type || undefined,
        };
      }),
      total: result.pagination?.total || 0,
    };
  } catch (error) {
    console.error('[UnifiedDocumentService] queryLibrary error:', error);
    return { documents: [], total: 0 };
  }
}
```

### Anarchist Query

**File**: `/frontend/src/lib/documents/service.ts` (lines 153-169)

```typescript
private async queryAnarchist(params: any) {
  try {
    const result = await anarchistService.getDocuments(params);

    return {
      documents: (result.documents || []).map(doc => ({
        ...doc,  // includes notes field (mapped to description in AnarchistDocument type)
        source: 'anarchist' as const,
      })),
      total: result.pagination?.total || 0,
    };
  } catch (error) {
    console.error('[UnifiedDocumentService] queryAnarchist error:', error);
    return { documents: [], total: 0 };
  }
}
```

---

## UI Component

### DocumentCard Component

**File**: `/frontend/src/components/library/DocumentCard.tsx`

```typescript
'use client';

import { useRouter } from 'next/navigation';
import type { UnifiedDocument } from '@/lib/documents/types';

interface DocumentCardProps {
  doc: UnifiedDocument;
}

export function DocumentCard({ doc }: DocumentCardProps) {
  const router = useRouter();

  // Extract preview from description field
  const getPreviewText = (): string => {
    if (doc.description) {
      const text = doc.description.substring(0, 150);
      return text.length === 150 ? text + '...' : text;
    }
    return '';
  };

  const preview = getPreviewText();

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-gray-700/50 bg-gray-900/70 p-3">
      {/* Title */}
      <h3 className="mt-6 pr-16 text-sm font-semibold text-white line-clamp-2">
        {doc.title}
      </h3>

      {/* Preview Text from description field */}
      {preview && (
        <p className="mt-2 text-xs text-gray-400 line-clamp-2">
          {preview}
        </p>
      )}

      {/* Author and Date */}
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
        {doc.author && <span className="truncate">{doc.author}</span>}
        {doc.author && doc.publication_date && <span>•</span>}
        {doc.publication_date && <span>{new Date(doc.publication_date).getFullYear()}</span>}
      </div>

      {/* Tags */}
      {doc.tags && doc.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {doc.tags.slice(0, 4).map(tag => (
            <span key={tag.id} className="inline-block rounded bg-blue-900/30 px-2 py-0.5 text-[10px] text-blue-300">
              {tag.name}
            </span>
          ))}
          {doc.tags.length > 4 && (
            <span className="inline-block text-[10px] text-gray-500">
              +{doc.tags.length - 4}
            </span>
          )}
        </div>
      )}

      {/* View Count */}
      <div className="mt-auto pt-2 text-xs text-gray-600">
        {doc.view_count || 0} views
      </div>
    </div>
  );
}
```

---

## API Response

### GET /api/documents

**File**: `/frontend/src/app/api/documents/route.ts`

```typescript
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const params: UnifiedSearchParams = {
      query: searchParams.get('query') || undefined,
      language: searchParams.get('language') || undefined,
      tags: searchParams.getAll('tags'),
      source: (searchParams.get('source') || 'all') as 'all' | 'library' | 'anarchist',
      sort_by: 'title',
      sort_order: 'asc',
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '50', 10),
    };

    const result = await unifiedDocumentService.getDocuments(params);

    return NextResponse.json({
      success: true,
      data: result,  // UnifiedSearchResult containing UnifiedDocument[] with description fields
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
```

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": 123,
        "source": "library",
        "slug": "example-doc",
        "title": "Example Document",
        "author": "Jane Doe",
        "language": "en",
        "publication_date": "2025-01-15",
        "document_type": "article",
        "description": "This is the preview text extracted from the description field. It shows up to 150 characters on the document card.",
        "view_count": 42,
        "created_at": "2025-10-28T12:00:00Z",
        "updated_at": "2025-10-28T14:30:00Z",
        "tags": [
          { "id": 1, "name": "anarchism", "type": "theme" },
          { "id": 2, "name": "political-theory", "type": "category" }
        ],
        "linked_document_group_id": null
      },
      {
        "id": 456,
        "source": "anarchist",
        "slug": "anarchist-text",
        "title": "Anarchist Text",
        "author": "Historical Author",
        "language": "fr",
        "publication_date": "1920-06-15",
        "document_type": "article",
        "description": "Notes from the anarchist library archive describing this historical text...",
        "view_count": 156,
        "created_at": "2025-11-08T10:00:00Z",
        "updated_at": "2025-11-08T10:00:00Z",
        "source_url": "https://theanarchistlibrary.org/...",
        "original_format": "muse"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1500,
      "total_pages": 30
    },
    "metadata": {
      "search_time_ms": 45,
      "results_from_library": 8,
      "results_from_anarchist": 42
    }
  }
}
```

---

## Database Schema Definitions

### Library Documents Table

**File**: `/frontend/scripts/seeds/schemas/library.sql`

```sql
CREATE TABLE "library_documents" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT,
  publication_date TEXT,
  document_type TEXT DEFAULT 'document',
  status TEXT DEFAULT 'published',
  
  -- PREVIEW FIELDS
  description TEXT,      -- ← Main preview/summary
  abstract TEXT,         -- ← Optional abstract
  
  content TEXT NOT NULL, -- Full content (not fetched in list view)
  language TEXT DEFAULT 'en',
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  view_count INTEGER DEFAULT 0,
  search_text TEXT,      -- Includes description for search
  
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### Anarchist Documents Table

**File**: `/frontend/src/lib/database/migrations/002-create-anarchist-schema.sql`

```sql
CREATE TABLE IF NOT EXISTS anarchist.documents (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  publication_date TEXT,
  language TEXT DEFAULT 'en',
  
  -- File storage
  file_path TEXT NOT NULL,  -- Path to markdown file in Docker volume
  
  -- PREVIEW FIELD
  notes TEXT,               -- ← Preview/description field
  
  -- Metadata
  source_url TEXT,
  category TEXT,
  document_type TEXT DEFAULT 'article',
  original_format TEXT DEFAULT 'muse',
  
  -- Stats
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Summary: Data Flow Example

When a user searches for "anarchism" with language filter "en":

### 1. API Request
```
GET /api/documents?query=anarchism&language=en&page=1&limit=50
```

### 2. Service Execution
```typescript
unifiedDocumentService.getDocuments({
  query: "anarchism",
  language: "en",
  page: 1,
  limit: 50
})
```

### 3. Parallel Queries
```sql
-- Library Query
SELECT d.id, d.slug, d.title, d.author, d.publication_date, 
       d.description, d.language, d.view_count, d.created_at,
       ... (all fields via SELECT *)
FROM library_documents d
WHERE d.status = 'published'
  AND d.language = 'en'
  AND (d.title ILIKE '%anarchism%' 
       OR d.author ILIKE '%anarchism%'
       OR d.description ILIKE '%anarchism%'  ← Searches preview
       OR d.search_text ILIKE '%anarchism%')
LIMIT 100 OFFSET 0;

-- Anarchist Query
SELECT *
FROM anarchist.documents d
WHERE d.language = 'en'
  AND (d.title ILIKE '%anarchism%'
       OR d.author ILIKE '%anarchism%'
       OR d.notes ILIKE '%anarchism%')  ← Searches preview
LIMIT 100 OFFSET 0;
```

### 4. Tag Fetching (Library only)
```sql
SELECT dt.document_id, t.id, t.name, tc.type
FROM library_document_tags dt
JOIN library_tags t ON dt.tag_id = t.id
LEFT JOIN library_tag_categories tc ON t.category_id = tc.id
WHERE dt.document_id IN (1, 2, 3, ...);
```

### 5. Results Merged & Normalized
```typescript
{
  documents: [
    { id: 1, description: "...", tags: [...] },  // Library doc
    { id: 456, description: "...", source: "anarchist" },  // Anarchist doc
    ...
  ],
  pagination: { page: 1, limit: 50, total: 120 },
  metadata: { search_time_ms: 45, results_from_library: 8, results_from_anarchist: 112 }
}
```

### 6. UI Rendering
```
DocumentCard receives UnifiedDocument with description
→ getPreviewText() extracts first 150 chars
→ Renders gray text under title
→ Shows author, date, tags, view count
```

