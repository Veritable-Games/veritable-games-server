# Linked Documents System - Quick Reference

## Key Files at a Glance

### Database
- **Migration**: `/frontend/src/lib/database/migrations/004-add-linked-documents.sql`
  - Defines `linked_document_groups` table
  - Adds `linked_document_group_id` to both collections
  - Creates indexes and trigger functions

### Type Definitions
- **Types**: `/frontend/src/lib/documents/types.ts` (lines 221-250)
  - `LinkedDocumentGroup` interface
  - `LinkDocumentsParams` interface
  - `LinkedDocumentOperationResult` interface

### Service Layer
- **Service**: `/frontend/src/lib/documents/service.ts` (lines 425-840)
  - `linkDocuments()` - Create group
  - `unlinkGroup()` - Collapse group
  - `mergeGroups()` - Merge multiple groups
  - `getDocumentsByGroupId()` - Fetch group members
  - `getLanguageCodesForGroup()` - Extract language codes
  - `getDropdownLabels()` - Generate switcher labels

### API Routes
- **GET /api/documents/linked** → `/frontend/src/app/api/documents/linked/route.ts`
  - Public read-only endpoint
  - Fetches documents in a group

- **POST /api/documents/link** → `/frontend/src/app/api/documents/link/route.ts`
  - Admin-only
  - Creates new linked group

- **POST /api/documents/unlink** → `/frontend/src/app/api/documents/unlink/route.ts`
  - Admin-only
  - Collapses group(s)

### UI Components
- **Badge**: `/frontend/src/components/documents/LinkedDocumentBadge.tsx`
  - Shows 🌐 icon + count on cards
  - Positioned below language badge

- **Switcher**: `/frontend/src/components/documents/LinkedDocumentSwitcher.tsx`
  - Dropdown menu on detail page
  - Switch between linked versions
  - Keyboard navigation (arrows, enter, escape)

- **Document Card**: `/frontend/src/components/library/DocumentCard.tsx`
  - Integrates LinkedDocumentBadge
  - Fetches linked documents via useFetchLinkedDocuments

- **Draggable Card**: `/frontend/src/components/library/DraggableDocumentCard.tsx`
  - Drag-drop linking in grid view
  - Can-link validation logic
  - Visual states (dragged, drop-target, linking, selected)

### Hooks
- **useFetchLinkedDocuments**: `/frontend/src/hooks/useFetchLinkedDocuments.ts`
  - Takes groupId, returns linkedDocuments + loading + error
  - Calls GET /api/documents/linked

- **useDragDropLink**: `/frontend/src/hooks/useDragDropLink.ts`
  - Manages drag-drop state
  - Handles API call to POST /api/documents/link
  - Returns draggedDocument, isDragging, isLinking, error

### Pages
- **Library Page**: `/frontend/src/app/library/LibraryPageClient.tsx`
  - Grid view: Uses DraggableDocumentCard (linking enabled)
  - List view: Uses LibraryListView (read-only, no linking)
  - Toggle with view mode buttons

- **Detail Page**: `/frontend/src/app/library/[slug]/page.tsx`
  - Server-side: Fetches linked documents
  - Client-side: Renders LinkedDocumentSwitcher dropdown

- **List View**: `/frontend/src/components/library/LibraryListView.tsx`
  - Table display with sortable columns
  - No linking UI (read-only)

---

## Linking Flow

### Creating a Link (Grid View)
```
User drags Doc A onto Doc B
  ↓
DraggableDocumentCard.onDrop()
  ↓
useDragDropLink.linkDocuments(A, B)
  ↓
POST /api/documents/link {documentIds, sources}
  ↓
Service: linkDocuments()
  ├─ Generate groupId
  ├─ Insert into linked_document_groups
  ├─ UPDATE both collections with groupId
  └─ Return documents in group
  ↓
UI updates: Badge shows + group shows together
```

### Viewing Links (Detail Page)
```
User navigates to /library/doc-slug
  ↓
Server: Get document → check for linked_document_group_id
  ↓
Server: If groupId exists, fetch getDocumentsByGroupId(groupId)
  ↓
Render: Pass linkedDocuments to LinkedDocumentSwitcher
  ↓
User clicks dropdown: See all language versions
  ↓
Click version: router.push(`/library/${doc.slug}`)
```

### Unlinking a Group (Admin)
```
Admin: Select 2+ linked groups + press Delete
  ↓
SelectionToolbar.onUnlinkSelected()
  ↓
POST /api/documents/unlink {groupIds}
  ↓
Service: unlinkGroup() for each
  ├─ UPDATE both collections SET linked_document_group_id = NULL
  └─ DELETE FROM linked_document_groups
  ↓
UI updates: Links removed, documents now standalone
```

---

## Language Code Priority

1. English (EN)
2. French (FR)
3. Spanish (ES)
4. German (DE)
5. Russian (RU)
6. Chinese (ZH)
7. Japanese (JA)
8. Alphabetical for all others

**Why**: Most users understand English as reference language.

---

## Permissions

### Public (No Auth Required)
- View linked documents
- Switch between versions
- GET /api/documents/linked

### Admin Only
- Create links (POST /api/documents/link)
- Collapse groups (POST /api/documents/unlink)
- Merge groups (future)

---

## Current Limitations

1. ❌ Batch linking not in UI (API ready)
2. ❌ Can't see group metadata (creator, date created)
3. ❌ No link suggestions
4. ❌ List view doesn't show link indicator
5. ❌ No unlink button on cards (toolbar only)

---

## What Works ✅

- Database schema with foreign keys & indexes
- Service layer with all operations
- All API routes with validation
- Components render correctly
- Drag-drop linking in grid view
- Language switcher on detail pages
- Admin permission enforcement
- Error handling and logging

---

## What's NOT Disabled

The system is **fully operational**. Common myths:

**Myth**: Linking is disabled
**Reality**: All operations working, admin-protected

**Myth**: Linking hidden in list view  
**Reality**: List view intentionally doesn't use drag-drop (read-only display)

**Myth**: Badge requires special flag to show  
**Reality**: Badge appears whenever linked_document_group_id is present

**Myth**: Only admins can view links  
**Reality**: Everyone can view and switch versions, only admins can create/modify

---

## Testing Key Features

### 1. Create Link
Admin drags document in grid view → should see badge appear

### 2. View Links
Click document → see dropdown with all versions in sidebar

### 3. Switch Version
Select from dropdown → navigate to different language

### 4. Unlink Group
Select group + press Delete → documents become standalone

### 5. Language Sorting
Create link with multiple languages → should appear in priority order (EN first)

---

## Performance Notes

- Service has 1-hour cache for translation groups
- API validates all inputs
- Database indexes on group_id for fast lookups
- Foreign keys prevent orphaned documents
- Triggers auto-update timestamps

---

## Next Steps to Enhance

1. Add batch linking UI
2. Show group metadata (creator, date)
3. Add link suggestions based on metadata
4. Make list view show link indicator
5. Add unlink button on cards directly
6. Implement merge groups UI
7. Add keyboard shortcut for linking
8. Analytics tracking for version switches

---

Report Location: `/docs/guides/codebase/LINKED_DOCUMENTS_ANALYSIS.md`
