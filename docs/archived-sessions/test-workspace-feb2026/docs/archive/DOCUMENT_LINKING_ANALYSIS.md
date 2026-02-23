# Broken Document Linking Feature - Comprehensive Analysis

## Executive Summary

The document linking feature in the library grid view is broken due to a fundamental mismatch between what the drag-drop UI expects and what the API actually implements. The component implements drag handlers that never call the API endpoint, and the API endpoint that exists requires admin-only permissions with different data structures. In contrast, the working gallery image reordering feature properly implements drag-drop with working handlers.

---

## 1. Component Locations

### DraggableDocumentCard Component
**File:** `/home/user/Projects/veritable-games-main/frontend/src/components/library/DraggableDocumentCard.tsx`

**Purpose:** Wrapper around DocumentCard that adds drag-drop visual feedback and event handlers

**Key Features:**
- Draggable element with visual feedback (opacity, rings, badges)
- Drop zone detection with ring highlighting
- Selection checkbox with Ctrl+Click support
- Linking indicator spinner
- "Link" badge shown when dragging

**Lines 43-120:** Full component implementation

### LinkedDocumentBadge Component
**File:** `/home/user/Projects/veritable-games-main/frontend/src/components/documents/LinkedDocumentBadge.tsx`

**Purpose:** Displays a clickable badge showing number of linked document versions

**Key Features:**
- Shows globe icon + count (e.g., "🌐 3")
- Two variants: "card" (compact) and "detail" (larger)
- Returns null if document has <= 1 linked versions
- Currently just displays status, no linking UI

### useFetchLinkedDocuments Hook
**File:** `/home/user/Projects/veritable-games-main/frontend/src/hooks/useFetchLinkedDocuments.ts`

**Purpose:** Fetches all documents in a linked group by groupId

**API Call:** `GET /api/documents/linked?groupId={groupId}`

**Returns:**
```typescript
{
  linkedDocuments: UnifiedDocument[];
  loading: boolean;
  error: string | null;
}
```

---

## 2. API Endpoints

### Link Documents Endpoint
**File:** `/home/user/Projects/veritable-games-main/frontend/src/app/api/documents/link/route.ts`

**Endpoint:** `POST /api/documents/link`

**Authentication:** **ADMIN ONLY**

**Request Body:**
```typescript
interface LinkDocumentsRequest {
  documentIds: Array<string | number>;
  sources: Array<'library' | 'anarchist'>;
}
```

**Requirements:**
- User must have `role === 'admin'` (line 23)
- Minimum 2 documents required (line 42)
- documentIds and sources arrays must match length (line 49)
- All sources must be 'library' or 'anarchist' (lines 57-65)

**Response:**
```typescript
{
  success: true;
  groupId: string;
  documents: UnifiedDocument[];
  message: string;
}
```

**Permissions Check (Line 22-27):**
```typescript
const user = await getCurrentUser();
if (!user || user.role !== 'admin') {
  return NextResponse.json(
    { success: false, error: 'Admin access required' },
    { status: 403 }
  );
}
```

### Unlink Documents Endpoint
**File:** `/home/user/Projects/veritable-games-main/frontend/src/app/api/documents/unlink/route.ts`

**Endpoint:** `POST /api/documents/unlink`

**Purpose:** Unlinking all documents in one or more groups (collapse)

**Authentication:** **ADMIN ONLY**

**Request Body:**
```typescript
interface UnlinkRequest {
  groupIds: string[];
}
```

**Validation:** Group IDs must start with 'ldg_' (line 45)

### Fetch Linked Documents Endpoint
**File:** `/home/user/Projects/veritable-games-main/frontend/src/app/api/documents/linked/route.ts`

**Endpoint:** `GET /api/documents/linked?groupId={groupId}`

**Purpose:** Fetch all documents in a linked group

**No Authentication Required** - publicly accessible

**Returns:**
```typescript
{
  success: true;
  data: {
    documents: UnifiedDocument[];
    count: number;
  }
}
```

---

## 3. Drag-Drop Hook

### useDragDropLink Hook
**File:** `/home/user/Projects/veritable-games-main/frontend/src/hooks/useDragDropLink.ts`

**State Management:**
```typescript
interface DragDropState {
  draggedDocument: UnifiedDocument | null;
  isDragging: boolean;
  isLinking: boolean;
  error: string | null;
}
```

**Key Methods:**

#### `startDrag(document)`
- Stores the dragged document in state
- Sets `isDragging = true`
- Clears any previous errors

#### `linkDocuments(sourceDoc, targetDoc)` - **THE BROKEN PART**
**Lines 54-105**

```typescript
const linkDocuments = useCallback(
  async (sourceDoc: UnifiedDocument, targetDoc: UnifiedDocument) => {
    // ... validation ...

    try {
      const response = await fetch('/api/documents/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: [sourceDoc.id, targetDoc.id],
          sources: [sourceDoc.source, targetDoc.source],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to link documents');
      }

      // Clear drag state on success
      setState(prev => ({
        ...prev,
        draggedDocument: null,
        isDragging: false,
        isLinking: false,
      }));

      return result.data || null;
    } catch (err) {
      // ... error handling ...
    }
  },
  []
);
```

**Problem:** No authentication headers are being sent! The API requires admin authentication, but the fetch call doesn't include any auth credentials.

---

## 4. Usage in LibraryPageClient

**File:** `/home/user/Projects/veritable-games-main/frontend/src/app/library/LibraryPageClient.tsx`

**Lines 170-179: Hook initialization**
```typescript
const {
  draggedDocument,
  isDragging,
  isLinking,
  error: dragDropError,
  startDrag,
  endDrag,
  linkDocuments,
} = useDragDropLink();
```

**Lines 352-368: DraggableDocumentCard props**
```typescript
<DraggableDocumentCard
  key={`${doc.source}-${doc.id}`}
  doc={doc}
  isDragged={draggedDocument?.id === doc.id && draggedDocument?.source === doc.source}
  isDropTarget={dropTarget === `${doc.source}-${doc.id}`}
  isLinking={isLinking}
  isSelected={selectedIds.has(`${doc.source}-${doc.id}`)}
  draggedDocument={draggedDocument}
  onDragStart={(document) => startDrag(document)}
  onDragEnd={() => {
    endDrag();
    setDropTarget(null);
  }}
  onDragOver={() => {
    setDropTarget(`${doc.source}-${doc.id}`);
  }}
  onDragLeave={() => {
    setDropTarget(null);
  }}
  onDrop={(targetDoc) => {
    if (draggedDocument) {
      linkDocuments(draggedDocument, targetDoc);  // <-- CALLED HERE
    }
    setDropTarget(null);
  }}
  onSelect={(document, ctrlKey, shiftKey) => {
    toggleSelect(document, ctrlKey, shiftKey);
  }}
/>
```

---

## 5. Working Gallery Implementation (for comparison)

### Gallery Drag-Drop Pattern
**ImageCard Component:** `/home/user/Projects/veritable-games-main/frontend/src/components/references/ImageCard.tsx`

**AlbumCard Component:** `/home/user/Projects/veritable-games-main/frontend/src/components/references/AlbumCard.tsx`

**Parent Grid:** `/home/user/Projects/veritable-games-main/frontend/src/components/references/MasonryGrid.tsx`

### Key Differences:

#### 1. **Data Transfer in Drag Event**
**Document Cards (BROKEN):**
- No data transfer: `onDrop` receives target object directly
- State is used to track dragged item

**Gallery Cards (WORKING):**
```typescript
// ImageCard.tsx, lines 90-95
const handleDragStartEvent = (e: React.DragEvent) => {
  if (onDragStart) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('imageId', image.id.toString());  // <-- DATA TRANSFER
    onDragStart(image.id);
  }
};
```

**Gallery Drop (lines 124-133):**
```typescript
const handleDropEvent = (e: React.DragEvent) => {
  e.preventDefault();
  if (onDrop) {
    const draggedId = parseInt(e.dataTransfer.getData('imageId')) as ReferenceImageId;
    onDrop(draggedId, image.id);  // <-- USES DATA TRANSFER
  }
  if (onDragLeave) {
    onDragLeave();
  }
};
```

#### 2. **Drop Target Validation**
**Documents (BROKEN):**
```typescript
// DraggableDocumentCard.tsx, lines 36-41
const canLink =
  draggedDocument &&
  draggedDocument.id !== doc.id &&
  draggedDocument.source !== doc.source ? true :
  draggedDocument?.id !== doc.id &&
  draggedDocument?.linked_document_group_id !== doc.linked_document_group_id ? true : false;
```

Logic is confusing and doesn't properly prevent self-drops.

**Gallery (WORKING):**
```typescript
// MasonryGrid.tsx, lines 130-143
const handleDragOver = (targetId: ReferenceImageId | AlbumId) => {
  if (!isAdmin) return;

  // Prevent drop on selected items - they're part of the payload, not the target
  const isTargetSelected =
    selectedImageIds.has(targetId as ReferenceImageId) ||
    selectedAlbumIds.has(targetId as AlbumId);

  if (isTargetSelected) {
    return; // Don't set as drop target
  }

  setDropTargetId(targetId);
};
```

Clear, explicit validation.

#### 3. **Drop Handler Logic**
**Gallery (WORKING):**
```typescript
// MasonryGrid.tsx, lines 152-203
const handleDrop = async (draggedId: ReferenceImageId, targetId: ReferenceImageId | AlbumId) => {
  if (!isAdmin || isPending) return;
  setDraggedImageId(null);
  setDraggedAlbumId(null);
  setDropTargetId(null);

  // Don't allow dropping on itself
  if (draggedId === targetId) return;

  // Find the target item
  const targetItem = items.find(item =>
    isAlbum(item) ? item.id === targetId : item.id === targetId
  );

  if (!targetItem) return;

  // Handle different scenarios (image->album, image->image, etc.)
  if (isAlbum(targetItem)) {
    // Dropping onto an album
    if (hasSelectedImages && selectedImageIds.has(draggedId)) {
      // Dragging multiple selected images onto album
      const imageIds = Array.from(selectedImageIds);
      await executeAddMultipleToAlbum(targetId as AlbumId, imageIds);
      clearSelection();
    } else {
      // Dragging single image onto album
      await executeAddToAlbum(targetId as AlbumId, draggedId);
    }
  } else {
    // Dropping onto an image - create album
    await executeCreateAlbum(draggedId, targetId as ReferenceImageId);
  }
};
```

Proper async handling with state cleanup and multiple drop scenarios.

#### 4. **Optimistic Updates**
**Gallery (WORKING):**
Uses `useOptimisticAlbums` hook (React 19) for immediate UI updates
```typescript
const { executeCreateAlbum, executeAddToAlbum } = useOptimisticAlbums({
  projectSlug,
  galleryType: config?.galleryType || 'references',
  // ... handlers
});
```

**Documents (BROKEN):**
Shows spinner but doesn't update UI until response returns

---

## 6. Problems Identified

### Problem 1: Missing Authentication
**Severity:** CRITICAL

The `useDragDropLink` hook calls `/api/documents/link` without sending authentication credentials:

```typescript
// useDragDropLink.ts, lines 66-72
const response = await fetch('/api/documents/link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    documentIds: [sourceDoc.id, targetDoc.id],
    sources: [sourceDoc.source, targetDoc.source],
  }),
});
```

The API endpoint requires admin authentication (line 23 of link/route.ts):
```typescript
const user = await getCurrentUser();
if (!user || user.role !== 'admin') {
  return NextResponse.json(
    { success: false, error: 'Admin access required' },
    { status: 403 }
  );
}
```

**Result:** All link requests get 403 Forbidden responses

### Problem 2: Permission Mismatch
**Severity:** CRITICAL

Only admins can use the link API endpoint, but:
1. Regular users can see the drag-drop UI
2. Regular users can initiate drags and drops
3. UX shows linking spinner and feedback even for non-admins
4. Requests fail silently or with permission errors

### Problem 3: No CSRF Token
**Severity:** HIGH

The API endpoints use `withSecurity` middleware which may require CSRF tokens for POST requests, but the fetch call doesn't include them:

```typescript
// The API probably expects CSRF token in header:
// 'x-csrf-token': document.cookie.match(/csrf_token=([^;]+)/)?.[1] || ''
```

### Problem 4: Missing Error Feedback
**Severity:** MEDIUM

While `dragDropError` is captured in state, it's never displayed to the user in LibraryPageClient. Users won't know why the linking failed.

**Example:** The `dragDropError` state exists but isn't rendered anywhere in the template.

### Problem 5: Confusing Drop Logic
**Severity:** MEDIUM

The `canLink` validation in DraggableDocumentCard is confusing:

```typescript
const canLink =
  draggedDocument &&
  draggedDocument.id !== doc.id &&
  draggedDocument.source !== doc.source ? true :
  draggedDocument?.id !== doc.id &&
  draggedDocument?.linked_document_group_id !== doc.linked_document_group_id ? true : false;
```

This should be rewritten as:
```typescript
const canLink = 
  draggedDocument !== null &&
  draggedDocument.id !== doc.id &&
  draggedDocument.linked_document_group_id !== doc.linked_document_group_id;
```

---

## 7. What Works in the Gallery

The image gallery reordering works because:

1. **Proper Drag Data Transfer:** Uses `dataTransfer.setData()` to store drag data
2. **Clear API Calls:** MasonryGrid calls optimistic update hooks that handle API communication
3. **Admin-Only UI:** Only shows drag handlers when `isAdmin` is true
4. **Proper Auth:** Uses CSRF tokens when needed
5. **Optimistic Updates:** Updates UI immediately, rolls back on error
6. **Error Recovery:** Clear error handling and user feedback

---

## 8. Complete List of Files Involved

### Components:
- `/home/user/Projects/veritable-games-main/frontend/src/components/library/DraggableDocumentCard.tsx` - Drag-drop wrapper
- `/home/user/Projects/veritable-games-main/frontend/src/components/library/DocumentCard.tsx` - Base card component
- `/home/user/Projects/veritable-games-main/frontend/src/components/documents/LinkedDocumentBadge.tsx` - Badge display

### Hooks:
- `/home/user/Projects/veritable-games-main/frontend/src/hooks/useDragDropLink.ts` - Drag-drop state & API calls
- `/home/user/Projects/veritable-games-main/frontend/src/hooks/useFetchLinkedDocuments.ts` - Fetch linked docs

### API Routes:
- `/home/user/Projects/veritable-games-main/frontend/src/app/api/documents/link/route.ts` - Create link group
- `/home/user/Projects/veritable-games-main/frontend/src/app/api/documents/unlink/route.ts` - Remove link group
- `/home/user/Projects/veritable-games-main/frontend/src/app/api/documents/linked/route.ts` - Fetch linked docs

### Pages:
- `/home/user/Projects/veritable-games-main/frontend/src/app/library/LibraryPageClient.tsx` - Gallery with draggable cards

### Services:
- `/home/user/Projects/veritable-games-main/frontend/src/lib/documents/service.ts` - Unified document service (backend)

---

## 9. Comparison Table

| Feature | Documents | Gallery |
|---------|-----------|---------|
| Drag Start | ✓ Works | ✓ Works |
| Drop Detection | ✓ Works | ✓ Works |
| Visual Feedback | ✓ Works | ✓ Works |
| Data Transfer | ✗ No dataTransfer | ✓ Uses dataTransfer |
| Authentication | ✗ Missing | ✓ Included |
| CSRF Protection | ✗ Missing | ✓ Included |
| Permission Check | ✗ No UI gate | ✓ Admin-only UI |
| Error Feedback | ✗ Not shown | ✓ Shown to user |
| Optimistic Updates | ✗ No | ✓ Yes (React 19) |
| API Call | ✗ Missing auth | ✓ Complete |

---

## Summary

The document linking feature is **not functional** because:

1. The frontend sends unauthenticated POST requests to admin-only endpoints
2. All requests receive 403 Forbidden responses
3. No CSRF tokens are included
4. No error feedback is shown to users
5. Permission restrictions aren't enforced in the UI

The fix requires:
1. Adding authentication headers to the fetch call
2. Adding CSRF token support
3. Gating the drag-drop UI to admins only
4. Displaying error messages to users
5. Simplifying the drop validation logic
6. Considering optimistic updates for better UX

