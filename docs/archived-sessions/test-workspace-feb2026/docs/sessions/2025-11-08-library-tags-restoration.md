# Library Tags Restoration Session

**Date**: November 8, 2025
**Status**: ⚠️ In Progress - Core Fixes Applied, API Issues Remain

## Problem Statement

The library tag system that was working on October 26, 2025 stopped displaying tags on the main library page after the PostgreSQL migration (November 5, 2025). Tags still appeared on individual document pages but were missing from:
- Tag filter sidebar
- Grid view document cards
- List view document rows

## Root Cause Analysis

### Primary Issue: Type Mismatch in Map Keys

The PostgreSQL migration changed how database query results return ID fields:

- **Tag query** (`library_document_tags`): Returns `document_id` as **number**
- **Document query** (`library_documents`): Returns `id` as **string**

When using a JavaScript `Map` for tag lookups:
```typescript
tagsMap.set(2, tags);        // Key is number 2
tagsMap.get("2");            // Lookup with string "2" returns undefined
```

This type mismatch caused all Map lookups to fail, resulting in empty tag arrays.

### Secondary Issue: Missing ID Field

The `getTagGroups()` method wasn't returning the `id` field for tag categories, which is required for drag-and-drop functionality and category management.

## Fixes Applied

### 1. Type Normalization in Tag Map Population

**File**: `frontend/src/lib/library/service.ts`
**Lines**: 195, 211

```typescript
// When populating the Map (line 195)
for (const tag of allTags) {
  const docId = typeof tag.document_id === 'string'
    ? parseInt(tag.document_id, 10)
    : tag.document_id;

  if (!tagsMap.has(docId)) {
    tagsMap.set(docId, []);
  }
  tagsMap.get(docId)!.push({ id: tag.id, name: tag.name, type: tag.type });
}

// When looking up from the Map (line 211)
const transformedDocuments = documents.map(doc => {
  const docId = typeof doc.id === 'string'
    ? parseInt(doc.id, 10)
    : doc.id;

  return {
    ...doc,
    tags: tagsMap.get(docId) || [],
  };
});
```

### 2. Type Normalization in Tag Category Filtering

**File**: `frontend/src/lib/library/service.ts`
**Lines**: 669-681

```typescript
const groups: LibraryTagGroup[] = tagCategories.map(cat => {
  const catId = typeof cat.id === 'string' ? parseInt(cat.id, 10) : cat.id;

  return {
    id: cat.id,  // Added missing id field
    type: cat.type,
    name: cat.name,
    tags: tags
      .filter(t => {
        const tagCatId = typeof t.category_id === 'string'
          ? parseInt(t.category_id, 10)
          : t.category_id;
        return tagCatId === catId;
      })
      .map(t => ({ id: t.id, name: t.name, usage_count: t.usage_count || 0 })),
  };
});
```

### 3. Client-Side Type Handling for Drag-and-Drop

**File**: `frontend/src/components/library/TagFilterSidebar.tsx`
**Line**: 191

```typescript
const categoryId = typeof targetCategory.id === 'string'
  ? parseInt(targetCategory.id, 10)
  : targetCategory.id;

const response = await fetchJSON(`/api/library/tags/${draggedTag.id}/category`, {
  method: 'PUT',
  body: JSON.stringify({ categoryId }),
});
```

### 4. Expanded Tag Type Validation Schema

**File**: `frontend/src/app/api/library/tag-categories/route.ts`
**Lines**: 10-23

Expanded the Zod validation schema to include all 8 actual tag types from the database:

```typescript
type: z.enum([
  'general',
  'primary',
  'secondary',
  'tertiary',
  'format',
  'geography',
  'method',
  'source',
  'subject',
  'theme',
  'time',
])
```

### 5. Component Restoration from Git History

**Restored from commit**: `c758da2` (October 29, 2025)

- `frontend/src/app/library/LibraryPageClient.tsx` (458 lines)
- `frontend/src/components/library/TagFilterSidebar.tsx` (534+ lines)

## Verification Results

### ✅ Server-Side Tag Fetching

Debug logs confirm:
```
[Library Service] Tags fetched: 38 tags for 7 documents
[DEBUG] Map has 7 document IDs with tags: 2:6, 8:6, 7:6, 13:4, 15:6, 5:5, 19:5
[DEBUG] Lookup doc.id=2 found=true tags=6
```

All 7 documents successfully receive their tags through the type-normalized Map lookups.

### ✅ Tag Categories API

```bash
GET /api/library/tag-categories
```

Returns 8 categories with tags:
- Geography: 3 tags (universal, western, global-south)
- Methodology, Source Type, Subject Matter, Theme, Time Period, Format, etc.

### ✅ Client-Side Data Reception

Server logs show first document receiving tags correctly:
```json
{
  "id": "26",
  "name": "anarchism",
  "type": "theme"
},
{
  "id": "39",
  "name": "contemporary",
  "type": "time"
}
```

### ✅ TypeScript Compilation

```
npm run type-check
# 0 errors
```

## Known Issues

### ❌ CSRF Token Validation Failures

Both tag management APIs are failing with CSRF validation errors:

```
PUT /api/library/tags/{id}/category
POST /api/library/tag-categories

Error: "CSRF validation failed" - Invalid or missing CSRF token
```

The client is sending CSRF tokens but the server is rejecting them. This blocks:
- Drag-and-drop tags between categories
- Creating new tag categories

### ⚠️ Parameter Count Mismatch Warnings

Database adapter shows warnings (non-blocking):
```
[DatabaseAdapter] Parameter count mismatch:
{ placeholders: 0, params: 7 }
```

These warnings don't prevent queries from executing but indicate the SQL conversion layer may need refinement for PostgreSQL numbered parameters.

### ⚠️ Tag Display Status Unverified

While server-side logs show tags are being fetched and attached to documents correctly, **visual verification of tag display in the browser UI has not been confirmed**. The following require testing:

- ✓ Tags in grid view document cards
- ✓ Tags in list view rows
- ✓ Tags in sidebar filter panel
- ✗ Tag click filtering behavior
- ✗ Tag count badges
- ✗ Tag hover states

## Files Modified

1. `frontend/src/lib/library/service.ts` - Type normalization in tag queries
2. `frontend/src/components/library/TagFilterSidebar.tsx` - Client-side type handling
3. `frontend/src/app/api/library/tag-categories/route.ts` - Expanded validation schema
4. `frontend/src/app/library/LibraryPageClient.tsx` - Restored from Oct 29
5. `frontend/src/app/library/page.tsx` - Debug logging (cleaned up)

## Next Steps

1. **Fix CSRF token validation** - Investigate why valid CSRF tokens are being rejected
2. **Resolve parameter count warnings** - Update SQL conversion for proper PostgreSQL syntax
3. **Visual verification** - Test tag display in browser UI across all three locations
4. **Test drag-and-drop** - Verify moving tags between categories works
5. **Test category creation** - Verify creating new tag categories works

## Technical Notes

### PostgreSQL vs SQLite Type Handling

PostgreSQL's `node-postgres` driver returns:
- Integer columns as JavaScript `number`
- BigInt columns as JavaScript `string`
- Text columns as JavaScript `string`

The specific behavior depends on column type definitions. Our database has:
```sql
library_documents.id BIGINT  → returns string
library_tags.id BIGINT → returns string
library_document_tags.document_id BIGINT → returns number (due to JOIN?)
```

This inconsistency requires defensive type normalization throughout the codebase.

### Map Key Type Coercion

JavaScript Map uses SameValueZero comparison:
- `Map.set(2, value)` and `Map.get("2")` are **different keys**
- `Map.set(2, value)` and `Map.get(2)` are **the same key**

Always normalize ID types before Map operations to ensure consistent lookups.

## Lessons Learned

1. **Database migrations change type semantics** - SQLite's loose typing vs PostgreSQL's strict typing
2. **Verify all three layers** - Database query → Service layer → Client display
3. **Don't trust logs alone** - Server logs showed "success" but UI was broken
4. **Type normalization is critical** - Even when TypeScript compiles, runtime type mismatches cause failures

## Session Summary

**What Works**:
- ✅ Tag data fetching from PostgreSQL database
- ✅ Type normalization preventing Map lookup failures
- ✅ Tag categories API returning data
- ✅ Tags being attached to documents server-side

**What Doesn't Work**:
- ❌ CSRF token validation for tag management APIs
- ⚠️ Parameter count mismatches in SQL queries
- ❓ Tag display in UI (unverified)

**Status**: Core type mismatch issues resolved, but CSRF validation and SQL parameter issues prevent full functionality. **Not production-ready.**
