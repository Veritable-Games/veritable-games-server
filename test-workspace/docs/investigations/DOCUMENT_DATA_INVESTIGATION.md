# Document Data Fetching & Structure Investigation Report

## Executive Summary

This investigation examined how document data (both library and anarchist documents) is fetched, structured, and rendered in the Veritable Games application. The findings reveal that **preview/description data IS available in the schema and IS being fetched from the database**, but **there are important differences in data availability between the two document sources**.

---

## 1. UnifiedDocument Type Definition

### Location
`/frontend/src/lib/documents/types.ts`

### Preview/Description Fields Available

```typescript
export interface UnifiedDocument {
  // ... other fields ...
  
  // Description/notes field - THIS IS THE PREVIEW FIELD
  description?: string;  // Library: description field; Anarchist: notes field
  
  // ... other fields ...
}
```

### Key Findings
- **Field Name**: `description` (unified interface)
- **Type**: Optional string
- **Purpose**: Stores preview/summary text for documents
- **Source Mapping**:
  - Library documents use `description` field
  - Anarchist documents use `notes` field (mapped to `description`)

---

## 2. Database Schema Analysis

### Library Documents Schema
**File**: `/frontend/scripts/seeds/schemas/library.sql`

```sql
CREATE TABLE "library_documents" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT,
  publication_date TEXT,
  document_type TEXT,
  status TEXT,
  
  -- PREVIEW/DESCRIPTION FIELDS
  description TEXT,      -- ← Description/preview field
  abstract TEXT,         -- ← Abstract field (optional)
  
  content TEXT NOT NULL, -- Full content (required)
  language TEXT,
  created_by INTEGER,
  created_at DATETIME,
  updated_at DATETIME,
  view_count INTEGER,
  search_text TEXT,
  
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**Fields for Preview**:
- `description`: Main preview/summary text (searchable)
- `abstract`: Additional abstract (optional)
- `search_text`: Concatenated searchable fields (includes description)

### Anarchist Documents Schema
**File**: `/frontend/src/lib/database/migrations/002-create-anarchist-schema.sql`

```sql
CREATE TABLE IF NOT EXISTS anarchist.documents (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  publication_date TEXT,
  language TEXT DEFAULT 'en',
  
  -- File storage reference
  file_path TEXT NOT NULL,
  
  -- PREVIEW/NOTES FIELD
  notes TEXT,            -- ← Used as preview/description
  
  source_url TEXT,
  document_type TEXT DEFAULT 'article',
  original_format TEXT DEFAULT 'muse',
  category TEXT,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Fields for Preview**:
- `notes`: Used as preview/description text (included in full-text search)

### Full-Text Search Coverage
Both schemas include preview/description in full-text search:

**Library** (line 113 in service.ts):
```sql
WHERE d.title ILIKE $search 
  OR d.author ILIKE $search 
  OR d.description ILIKE $search  ← Description is searchable
  OR d.search_text ILIKE $search
```

**Anarchist** (lines 412-415 in service.ts):
```sql
WHERE title ILIKE $1 
  OR author ILIKE $1 
  OR notes ILIKE $1  ← Notes/description is searchable
ORDER BY CASE WHEN title ILIKE $1 THEN 1 ELSE 2 END
```

---

## 3. Data Fetching: How Description Data is Loaded

### 3.1 List/Grid View Documents

#### Library Service (`queryLibrary`)
**File**: `/frontend/src/lib/library/service.ts` lines 69-258

**Query Construction** (lines 149-161):
```typescript
const documentsQuery = `
  SELECT
    d.*,  // ← Includes description field
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
```

**What's Fetched**:
- ✅ All fields from `library_documents` table including `description`
- ✅ Category names and codes
- ✅ Tags (fetched separately after initial query - lines 170-212)
- ✅ Not included: `content` (full document text) - only for detail view

#### Anarchist Service (`queryAnarchist`)
**File**: `/frontend/src/lib/anarchist/service.ts` lines 85-199

**Query Construction** (lines 145-157):
```typescript
const documentsQuery = `
  SELECT *
  FROM anarchist.documents d
  ${whereClause}
  ORDER BY d.${safeSortBy} ${safeSortOrder}
  LIMIT $${paramIndex++} OFFSET $${paramIndex++}
`;
```

**What's Fetched**:
- ✅ All fields from `anarchist.documents` table including `notes`
- ✅ `notes` field (mapped to `description` in UnifiedDocument)
- ❌ Document content NOT included (stored on filesystem, fetched separately)

### 3.2 Unified Document Service Layer

**File**: `/frontend/src/lib/documents/service.ts` lines 45-113

**Flow** (lines 63-66):
```typescript
const [libraryResults, anarchistResults] = await Promise.all([
  source !== 'anarchist' 
    ? this.queryLibrary({ query, language, tags, sort_by, sort_order, limit: limit * 2, offset })
    : Promise.resolve({ documents: [], total: 0 }),
  source !== 'library'
    ? this.queryAnarchist({ query, language, tags, sort_by, sort_order, limit: limit * 2, offset })
    : Promise.resolve({ documents: [], total: 0 }),
]);
```

**Normalization** (lines 128-140 for library):
```typescript
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
```

**Normalization** (lines 159-163 for anarchist):
```typescript
documents: (result.documents || []).map(doc => ({
  ...doc,
  source: 'anarchist' as const,
  // Notes field (anarchist's description) is already in doc
})),
```

### 3.3 Detail View Documents

**Library Detail** (service.ts lines 263-321):
```typescript
const query = `
  SELECT d.*,  // ← Includes description
    STRING_AGG(DISTINCT c.name, ',') as category_names,
    STRING_AGG(DISTINCT c.code, ',') as category_codes
  FROM library_documents d
  ...
`;
// Returns LibraryDocumentWithMetadata with description
```

**Anarchist Detail** (service.ts lines 204-243):
```typescript
const result = await dbAdapter.query(
  `SELECT * FROM anarchist.documents WHERE slug = $1`,
  [slug],
  { schema: 'anarchist' }
);
// Notes field available in result, plus content loaded from filesystem
```

---

## 4. UI Rendering - DocumentCard Component

**File**: `/frontend/src/components/library/DocumentCard.tsx` lines 28-34

```typescript
const getPreviewText = (): string => {
  if (doc.description) {
    const text = doc.description.substring(0, 150);  // ← Uses description field
    return text.length === 150 ? text + '...' : text;
  }
  return '';
};
```

**Rendered in Template** (lines 112-116):
```jsx
{preview && (
  <p className="mt-2 text-xs text-gray-400 line-clamp-2">
    {preview}
  </p>
)}
```

---

## 5. API Endpoint Response

**File**: `/frontend/src/app/api/documents/route.ts`

**Response Structure**:
```typescript
return NextResponse.json({
  success: true,
  data: {
    documents: UnifiedDocument[],  // ← Contains description field
    pagination: { ... },
    metadata: { ... }
  }
});
```

**Example Response** (conceptual):
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": 123,
        "source": "library",
        "slug": "my-document",
        "title": "Document Title",
        "author": "Jane Doe",
        "language": "en",
        "publication_date": "2025-01-15",
        "description": "This is a preview of the document content...",
        "view_count": 42,
        "created_at": "2025-10-28T...",
        "updated_at": "2025-10-28T...",
        "tags": [...]
      }
    ],
    "pagination": { ... }
  }
}
```

---

## 6. Tags Fetching

### Library Tags (lines 170-212 in library/service.ts)

Tags are fetched **separately** for documents in list view:

```typescript
if (documentIds.length > 0) {
  const tagsQuery = `
    SELECT
      dt.document_id,
      t.id,
      t.name,
      tc.type
    FROM library_document_tags dt
    JOIN library_tags t ON dt.tag_id = t.id
    LEFT JOIN library_tag_categories tc ON t.category_id = tc.id
    WHERE dt.document_id IN (${placeholders})
  `;
  const tagsResult = await dbAdapter.query(tagsQuery, documentIds);
  // Build tagsMap indexed by document_id
}

// Then attached to each document
const transformedDocuments = documents.map(doc => {
  return {
    ...doc,
    tags: tagsMap.get(docId) || [],  // ← Tags attached here
  };
});
```

### Anarchist Tags

Anarchist documents do NOT automatically load tags in list view. They must be fetched separately if needed, as they're not included in the main documents query.

---

## 7. Data Availability Matrix

### Library Documents - List View
| Field | Available | Fetched | Notes |
|-------|-----------|---------|-------|
| `id` | ✅ | Yes | From SELECT * |
| `title` | ✅ | Yes | From SELECT * |
| `author` | ✅ | Yes | From SELECT * |
| `description` | ✅ | Yes | From SELECT * |
| `language` | ✅ | Yes | From SELECT * |
| `publication_date` | ✅ | Yes | From SELECT * |
| `view_count` | ✅ | Yes | From SELECT * |
| `created_at` | ✅ | Yes | From SELECT * |
| `tags` | ✅ | Yes | Separate query |
| `content` | ❌ | No | Not fetched in list view |
| `abstract` | ✅ | Yes | From SELECT * |

### Anarchist Documents - List View
| Field | Available | Fetched | Notes |
|-------|-----------|---------|-------|
| `id` | ✅ | Yes | From SELECT * |
| `title` | ✅ | Yes | From SELECT * |
| `author` | ✅ | Yes | From SELECT * |
| `notes` (→ `description`) | ✅ | Yes | From SELECT * |
| `language` | ✅ | Yes | From SELECT * |
| `publication_date` | ✅ | Yes | From SELECT * |
| `view_count` | ✅ | Yes | From SELECT * |
| `created_at` | ✅ | Yes | From SELECT * |
| `tags` | ❌ | No | Not in default query |
| `content` | ❌ | No | Filesystem based |
| `source_url` | ✅ | Yes | From SELECT * |

---

## 8. SQL Query Examples

### Library - Get Documents with Preview

```sql
SELECT
  d.id,
  d.slug,
  d.title,
  d.author,
  d.publication_date,
  d.description,          -- ← PREVIEW FIELD
  d.document_type,
  d.language,
  d.view_count,
  d.created_at,
  d.updated_at,
  STRING_AGG(DISTINCT c.name, ',') as category_names
FROM library_documents d
LEFT JOIN library_document_categories dc ON d.id = dc.document_id
LEFT JOIN library_categories c ON dc.category_id = c.id
WHERE d.status = 'published'
GROUP BY d.id
ORDER BY d.title ASC
LIMIT 50 OFFSET 0;
```

### Anarchist - Get Documents with Preview

```sql
SELECT
  id,
  slug,
  title,
  author,
  publication_date,
  notes,              -- ← PREVIEW FIELD
  language,
  category,
  document_type,
  view_count,
  created_at,
  updated_at
FROM anarchist.documents
WHERE language = 'en'
ORDER BY title ASC
LIMIT 50 OFFSET 0;
```

---

## 9. Key Differences: Library vs Anarchist

| Aspect | Library | Anarchist |
|--------|---------|-----------|
| **Preview Field Name** | `description` | `notes` |
| **Preview Fetched in List** | ✅ Yes (SELECT *) | ✅ Yes (SELECT *) |
| **Content Fetched in List** | ❌ No | ❌ No |
| **Content Storage** | PostgreSQL DB | Filesystem (Docker volume) |
| **Tags Loaded in List** | ✅ Yes (separate query) | ❌ No (need separate call) |
| **Search Includes Preview** | ✅ Yes (ILIKE description) | ✅ Yes (ILIKE notes) |
| **Abstract Field** | ✅ Yes (optional) | ❌ No |

---

## 10. Conclusions & Findings

### ✅ Preview Data IS Being Loaded

1. **Library documents**: `description` field is fetched with SELECT *
2. **Anarchist documents**: `notes` field is fetched with SELECT *
3. Both are included in full-text search indices
4. Both are mapped to unified `UnifiedDocument.description` field

### ✅ UI Components ARE Using Preview Data

The `DocumentCard` component (lines 28-34):
- Checks for `doc.description`
- Takes first 150 characters
- Adds "..." if truncated
- Displays in gray text below title

### ⚠️ Potential Optimization Issues

1. **Library documents**: Tags are fetched with a separate query after document list is retrieved (N+1 query pattern for tags)
2. **Anarchist documents**: Tags are NOT automatically loaded - would need separate call if displayed
3. **Content**: Full document content is NOT fetched for list views (correct - only needed for detail view)

### 🎯 What Could Be Improved

1. **For grid/list views**: Current implementation is optimal - only fetches necessary fields
2. **For detail views**: Consider whether full content load for anarchist docs (from filesystem) should be cached
3. **For tags**: Library tags could be batched in a single query (already doing this correctly)

---

## 11. Code Flow Diagram

```
User requests /api/documents?query=...
    ↓
API Route: /app/api/documents/route.ts
    ↓
UnifiedDocumentService.getDocuments()
    ↓
    ├─→ queryLibrary()
    │   ├─→ LibraryService.getDocuments()
    │   │   ├─→ Query: SELECT * FROM library_documents
    │   │   ├─→ includes: description, abstract, search_text
    │   │   ├─→ Query: SELECT tags WHERE document_id IN (...)
    │   │   └─→ Return: documents with tags
    │   │
    │   └─→ Normalize to UnifiedDocument[]
    │       └─→ description field passed through
    │
    ├─→ queryAnarchist()
    │   ├─→ AnarchistService.getDocuments()
    │   │   ├─→ Query: SELECT * FROM anarchist.documents
    │   │   ├─→ includes: notes (→ maps to description)
    │   │   └─→ Return: documents (tags NOT loaded)
    │   │
    │   └─→ Normalize to UnifiedDocument[]
    │       └─→ notes→description field passed through
    │
    ├─→ Merge and sort results
    └─→ Paginate and return

UI: DocumentCard component
    ↓
    Receives UnifiedDocument with description field
    ↓
    getPreviewText(): takes first 150 chars of description
    ↓
    Renders as gray text in card
```

---

## 12. Files Summary

### Type Definitions
- `/frontend/src/lib/documents/types.ts` - UnifiedDocument interface with description field
- `/frontend/src/lib/library/types.ts` - LibraryDocumentWithMetadata with description
- `/frontend/src/lib/anarchist/types.ts` - AnarchistDocument with notes field

### Services
- `/frontend/src/lib/documents/service.ts` - UnifiedDocumentService.getDocuments()
- `/frontend/src/lib/library/service.ts` - LibraryService.getDocuments() with tags
- `/frontend/src/lib/anarchist/service.ts` - AnarchistService.getDocuments()

### API Routes
- `/frontend/src/app/api/documents/route.ts` - GET /api/documents endpoint
- `/frontend/src/app/api/library/documents/route.ts` - Library specific

### UI Components
- `/frontend/src/components/library/DocumentCard.tsx` - Renders preview from description
- `/frontend/src/components/library/LibraryListView.tsx` - Grid/list container

### Database Schema
- `/frontend/scripts/seeds/schemas/library.sql` - Library schema with description field
- `/frontend/src/lib/database/migrations/002-create-anarchist-schema.sql` - Anarchist schema with notes field

---

## Appendix: Example Query Execution

### Library Document List Query
```sql
-- Main documents query
SELECT d.id, d.slug, d.title, d.author, d.publication_date, 
       d.description, d.document_type, d.language, d.view_count,
       d.created_at, d.updated_at, d.abstract,
       STRING_AGG(DISTINCT c.name, ',') as category_names,
       STRING_AGG(DISTINCT c.code, ',') as category_codes
FROM library_documents d
LEFT JOIN library_document_categories dc ON d.id = dc.document_id
LEFT JOIN library_categories c ON dc.category_id = c.id
WHERE d.status = 'published'
GROUP BY d.id
ORDER BY d.title ASC
LIMIT 50 OFFSET 0;

-- Followed by tags query for documents returned
SELECT dt.document_id, t.id, t.name, tc.type
FROM library_document_tags dt
JOIN library_tags t ON dt.tag_id = t.id
LEFT JOIN library_tag_categories tc ON t.category_id = tc.id
WHERE dt.document_id IN (123, 124, 125, ...);  -- IDs from first query

-- Result structure includes all fields from first query,
-- plus tags array populated from second query
```

