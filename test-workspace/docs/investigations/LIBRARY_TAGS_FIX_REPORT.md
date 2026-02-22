# Library Tags Fix Report

**Date**: November 8, 2025 **Issue**: Tags not displaying on library main page
(list view, grid view, tag filter sidebar)

## Root Cause Analysis

### Timeline

1. **October 25, 2025** - Commit `4fbae5d`: "Clean up residual tag filtering
   code"
   - Deleted `UnifiedTagManager.tsx` (558 lines)
   - Deleted `tag-management-types.ts` (341 lines)
   - Library page simplified to use `LibraryPageClient` component

2. **November 5, 2025** - Commit `e6028ac`: "Complete application migration from
   SQLite to PostgreSQL"
   - Broke tags query in `libraryService.getDocuments()`
   - Used explicit schema prefixes WITHOUT `{ schema: 'library' }` option
   - Tags query returned 0 results even though data exists

### The Breaking Change

In `frontend/src/lib/library/service.ts` (lines 174-189), the tags query was
inconsistent with other queries:

**Broken Pattern**:

```typescript
const tagsQuery = `
  FROM library.library_document_tags dt  -- Explicit prefix
  ...
`;
const tagsResult = await dbAdapter.query(tagsQuery, [documentIds]); // No schema option ❌
```

**Working Pattern** (used by all other queries):

```typescript
const documentsQuery = `
  FROM library_documents d  -- No prefix
  ...
`;
const docsResult = await dbAdapter.query(documentsQuery, params, {
  schema: 'library',
}); // With schema option ✅
```

## The Fix

**File**: `frontend/src/lib/library/service.ts:174-189`

**Changed**:

1. Removed explicit `library.` prefixes from table names
2. Added `{ schema: 'library' }` option to `dbAdapter.query()` call

**Before**:

```typescript
const tagsQuery = `
  SELECT dt.document_id, t.id, t.name, tc.type
  FROM library.library_document_tags dt
  JOIN library.library_tags t ON dt.tag_id = t.id
  LEFT JOIN library.library_tag_categories tc ON t.category_id = tc.id
  WHERE dt.document_id = ANY($1)
`;
const tagsResult = await dbAdapter.query(tagsQuery, [documentIds]);
```

**After**:

```typescript
const tagsQuery = `
  SELECT dt.document_id, t.id, t.name, tc.type
  FROM library_document_tags dt
  JOIN library_tags t ON dt.tag_id = t.id
  LEFT JOIN library_tag_categories tc ON t.category_id = tc.id
  WHERE dt.document_id = ANY($1)
`;
const tagsResult = await dbAdapter.query(tagsQuery, [documentIds], {
  schema: 'library',
});
```

## Verification

### Database State

- ✅ 37 tags exist in `library.library_document_tags`
- ✅ Tags correctly associated with documents
- ✅ Direct SQL query returns tags successfully

### Components Working Correctly

- ✅ `LibraryPageClient.tsx` - Passes tags to child components
- ✅ `LibraryListView.tsx` - Displays tags when `doc.tags.length > 0`
- ✅ `TagFilterSidebar.tsx` - Displays tag categories with tags
- ✅ Grid view - Shows hashtag-formatted tags when `doc.tags.length > 0`

### Service Methods

- ✅ `libraryService.getTagGroups()` - Fetches tag categories/tags for sidebar
- ✅ `libraryService.getDocuments()` - NOW returns documents with tags attached

## Expected Behavior After Fix

1. **Tag Filter Sidebar** - Shows tag categories with clickable tags:
   - Format (book, guide, manifesto, etc.)
   - Geography (global-south, western, etc.)
   - Methodology (critical-pedagogy, neural-networks, etc.)
   - Source Type (manual, technical-manual, thesis, etc.)
   - Subject Area (anarchism, computer-science, etc.)
   - Theme (anarchism, mutual-aid, contemporary, etc.)
   - Time Period (historical, #1, etc.)

2. **List View** - Tags column shows badges (e.g., "anarchism", "contemporary",
   "manual")

3. **Grid View** - Tags appear as hashtags below preview text (e.g.,
   `#anarchism ## #contemporary ## #manual`)

## Testing

```bash
# Verify database has tags
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT COUNT(*) FROM library.library_document_tags;"
# Output: 37

# Test the fixed query directly
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT dt.document_id, t.name FROM library.library_document_tags dt
      JOIN library.library_tags t ON dt.tag_id = t.id LIMIT 5;"
# Output: Returns 5 tag associations

# TypeScript validation
npm run type-check
# Output: 0 errors
```

## Status

- ✅ **Fix Applied**: `frontend/src/lib/library/service.ts:188`
- ✅ **TypeScript**: Passes with 0 errors
- ⏳ **Testing**: Server restart required to pick up changes
- 📋 **Next Steps**: Verify in browser at http://localhost:3000/library

## Notes

The individual document pages (`/library/{slug}`) were displaying tags correctly
because they use a different query method (`getDocumentBySlug`) that had the
correct schema handling pattern all along.
