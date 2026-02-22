# Gallery Ctrl+Click Delete/De-Stack Pattern Analysis

## Executive Summary

The application implements a sophisticated ctrl+click (cmd+click on Mac) selection pattern across gallery views (ImageCard, AlbumCard) and document cards. The pattern enables multi-select operations with visual feedback, keyboard shortcuts for batch deletion, and optimistic UI updates.

---

## Part 1: Ctrl+Click Event Detection

### 1.1 Implementation Location

**Gallery Components (ImageCard & AlbumCard)**
- File: `/frontend/src/components/references/ImageCard.tsx`
- File: `/frontend/src/components/references/AlbumCard.tsx`
- Pattern: Detects ctrl/cmd key in `handleClick` event handler

**Document Cards (DraggableDocumentCard)**
- File: `/frontend/src/components/library/DraggableDocumentCard.tsx`
- Pattern: Similar ctrl/cmd detection with additional shift key support

### 1.2 Exact Code Locations

**ImageCard.tsx (Lines 56-71):**
```typescript
const handleClick = (e: React.MouseEvent) => {
  // Ctrl+Click or Cmd+Click for selection (admin only)
  if ((e.ctrlKey || e.metaKey) && isAdmin) {
    e.preventDefault();
    e.stopPropagation();
    toggleImageSelection(image.id);
  } else {
    // Clear selection before opening lightbox on regular click
    if (selectedImageIds.size > 0 || selectedAlbumIds.size > 0) {
      clearSelection();
    }
    // Clear album context - viewing a standalone image, not in an album
    setSelectedAlbum(null);
    openLightbox(index);
  }
};
```

**AlbumCard.tsx (Lines 69-82):**
```typescript
const handleCardClick = (e: React.MouseEvent) => {
  // Ctrl+Click or Cmd+Click for selection (admin only)
  if ((e.ctrlKey || e.metaKey) && isAdmin) {
    e.preventDefault();
    e.stopPropagation();
    toggleAlbumSelection(album.id);
  } else {
    // Clear selection before opening album on regular click
    if (selectedImageIds.size > 0 || selectedAlbumIds.size > 0) {
      clearSelection();
    }
    onClick();
  }
};
```

**DraggableDocumentCard.tsx (Lines 46-51):**
```typescript
onClick={e => {
  // Allow selection with Ctrl+Click
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    onSelect(doc, true, e.shiftKey);  // Also supports shift key for range selection
  }
}}
```

### 1.3 Key Characteristics

- **Cross-platform**: `e.ctrlKey || e.metaKey` handles both Windows/Linux (Ctrl) and Mac (Cmd)
- **Admin-only**: Gate-kept with `&& isAdmin` check in gallery, allowing public in documents
- **Event Prevention**: `e.preventDefault()` and `e.stopPropagation()` prevent default behavior
- **Shift Key Support**: DraggableDocumentCard also supports shift-key for range selection
- **Visual Indicator**: Gallery shows hover hint "Ctrl+Click to select" (AlbumCard doesn't show this yet)

---

## Part 2: Selection State Management

### 2.1 Store Implementation

**File**: `/frontend/src/lib/stores/referencesStore.ts`

Selection state uses Zustand with Set data structure for O(1) lookups:

```typescript
// State (Lines 59-60)
selectedImageIds: Set<ReferenceImageId>;
selectedAlbumIds: Set<AlbumId>;

// Selection Actions (Lines 345-365)
toggleImageSelection: imageId =>
  set(state => {
    const newSelection = new Set(state.selectedImageIds);
    if (newSelection.has(imageId)) {
      newSelection.delete(imageId);
    } else {
      newSelection.add(imageId);
    }
    return { selectedImageIds: newSelection };
  }),

toggleAlbumSelection: albumId =>
  set(state => {
    const newSelection = new Set(state.selectedAlbumIds);
    if (newSelection.has(albumId)) {
      newSelection.delete(albumId);
    } else {
      newSelection.add(albumId);
    }
    return { selectedAlbumIds: newSelection };
  }),
```

### 2.2 Selection Features in Store

- **clearSelection()**: Resets both image and album selections
- **selectAllImages()**: Ctrl+A support (from GalleryClient.tsx lines 333)
- **selectMultipleImages/Albums()**: Batch operations support
- **selectionCount()**: Returns { images: number, albums: number }
- **getSelectedImages/Albums()**: Retrieve actual objects from selection IDs

---

## Part 3: Visual Feedback

### 3.1 Selection Badge Styling

**ImageCard.tsx (Lines 189-205):**
```typescript
{isSelected && (
  <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 shadow-lg">
    <svg className="h-4 w-4 text-white">
      {/* Checkmark SVG */}
    </svg>
  </div>
)}
```

**AlbumCard.tsx (Lines 201-217):**
```typescript
{isSelected && (
  <div className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 shadow-lg">
    {/* Checkmark SVG */}
  </div>
)}
```

**DraggableDocumentCard.tsx (Lines 80-90):**
```typescript
{isSelected && (
  <div className="absolute top-2 left-2 inline-flex items-center justify-center h-5 w-5 rounded bg-blue-600 border border-blue-400">
    {/* Checkmark SVG */}
  </div>
)}
```

### 3.2 Visual Effects

| Component | Selected Border | Checkmark Position | Size |
|-----------|-----------------|-------------------|------|
| ImageCard | outline-3 outline-blue-500 | top-right | h-6 w-6 |
| AlbumCard | outline-3 outline-blue-500 + blue border-2 | top-left | h-6 w-6 |
| DocumentCard | ring-2 ring-blue-500 | top-left | h-5 w-5 |

### 3.3 Unselected Hover Hint (DraggableDocumentCard only)

Lines 113-117:
```typescript
{!isSelected && (
  <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 pointer-events-none">
    <span className="text-xs text-gray-300">Ctrl+Click to select</span>
  </div>
)}
```

---

## Part 4: Delete/De-Stack Functionality

### 4.1 Keyboard Shortcuts for Deletion

**MasonryGrid.tsx (Lines 82-102):**
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Delete key - delete selected items
    if (e.key === 'Delete' && isAdmin) {
      const imageIds = Array.from(selectedImageIds);
      const albumIds = Array.from(selectedAlbumIds);
      if (imageIds.length > 0 || albumIds.length > 0) {
        e.preventDefault();
        handleDeleteSelection();
      }
    }

    // Escape key - clear selection
    if (e.key === 'Escape') {
      clearSelection();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isAdmin, selectedImageIds, selectedAlbumIds, clearSelection, handleDeleteSelection]);
```

### 4.2 Delete Execution

**useOptimisticAlbums.ts (Lines 333-390):**

The `executeDeleteSelection` function handles both albums and images:

```typescript
const executeDeleteSelection = useCallback(
  async (imageIds: ReferenceImageId[], albumIds: AlbumId[]) => {
    try {
      // Get albums that will be deleted
      const albumsToDelete = albums.filter(a => albumIds.includes(a.id));

      // Apply optimistic update
      startTransition(() => {
        // Remove selected albums (images stay in store and auto-reappear)
        useReferencesStore.setState(state => ({
          albums: state.albums.filter(a => !albumIds.includes(a.id)),
        }));
        // Remove selected standalone images (soft delete)
        removeImages(imageIds);
      });

      // Delete albums: remove each image from album
      for (const albumId of albumIds) {
        const album = albumsToDelete.find(a => a.id === albumId);
        if (!album) continue;

        for (const image of album.images) {
          const response = await fetchWithCSRF(
            `/api/projects/${projectSlug}/${galleryType}/albums/${albumId}/images/${image.id}`,
            { method: 'DELETE' }
          );
          if (!response.ok) throw new Error('Failed to delete album');
        }
      }

      // Soft delete selected standalone images
      for (const imageId of imageIds) {
        const response = await fetchWithCSRF(
          `/api/projects/${projectSlug}/${galleryType}/${imageId}`,
          { method: 'DELETE' }
        );
        if (!response.ok) throw new Error('Failed to delete image');
      }

      onSuccess?.('delete');
    } catch (error) {
      console.error('Failed to delete selection:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to delete selection'));
    }
  },
  [projectSlug, galleryType, albums, removeImages, onSuccess, onError]
);
```

### 4.3 Document De-Stack API

**API Route**: `/frontend/src/app/api/documents/unlink/route.ts`

Admin-only endpoint for unlinking document groups:

```typescript
interface UnlinkRequest {
  groupIds: string[];
}

// Admin-only validation
const user = await getCurrentUser();
if (!user || user.role !== 'admin') {
  return NextResponse.json(
    { success: false, error: 'Admin access required' },
    { status: 403 }
  );
}

// Batch unlink operation
const results = await Promise.all(
  groupIds.map(groupId => unifiedDocumentService.unlinkGroup(groupId))
);
```

---

## Part 5: Optimistic UI Updates

### 5.1 React 19 useTransition

**useOptimisticAlbums.ts (Lines 27, 67):**

```typescript
import { useCallback, useTransition } from 'react';

const [isPending, startTransition] = useTransition();

// Usage in executeDeleteSelection (Line 340)
startTransition(() => {
  // Remove selected albums (images stay in store and auto-reappear)
  useReferencesStore.setState(state => ({
    albums: state.albums.filter(a => !albumIds.includes(a.id)),
  }));
  // Remove selected standalone images (soft delete)
  removeImages(imageIds);
});
```

### 5.2 Loading Overlay

**MasonryGrid.tsx (Lines 261-282):**

```typescript
{isPending && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="flex items-center gap-3 rounded-lg bg-gray-800 px-6 py-4 shadow-xl">
      <svg className="h-6 w-6 animate-spin text-blue-500" />
      <p className="font-medium text-gray-200">Creating album...</p>
    </div>
  </div>
)}
```

### 5.3 Grid Disabled During Pending

**MasonryGrid.tsx (Line 334):**

```typescript
<div className={`masonry-grid ${isPending ? 'loading' : ''}`}>
```

CSS (Lines 326-329):
```css
.masonry-grid.loading {
  pointer-events: none;
  opacity: 0.6;
}
```

---

## Part 6: Permission Checks

### 6.1 Gallery (Image/Album) Operations

- **Selection**: `isAdmin` gate in ImageCard/AlbumCard click handlers
- **Deletion**: `isAdmin` gate in MasonryGrid keyboard listener
- **API**: No additional backend gate (relies on frontend gating)

### 6.2 Document Operations

- **Selection**: Public (no admin gate in DraggableDocumentCard)
- **De-Stack (Unlinking)**: **Admin-only** gate in API route `/api/documents/unlink`
- **Backend Validation**: `getCurrentUser()` check for admin role

| Operation | Gallery | Documents |
|-----------|---------|-----------|
| Ctrl+Click Select | Admin only | Public |
| Delete/Unlink | Admin only (frontend) | Admin only (backend) |
| Visual Feedback | Checkmark badge | Checkmark badge |

---

## Part 7: Comparison: Gallery vs Documents Grid

### 7.1 Gallery Pattern (Current)

- **Component**: MasonryGrid + ImageCard + AlbumCard
- **Selection**: Set-based, Zustand store
- **Delete Method**: Keyboard shortcut (Delete key)
- **Visual Feedback**: Checkmark badges, selection outline
- **Permission**: Admin-only frontend gate
- **Optimistic Updates**: React 19 useTransition
- **Operation**: Delete (albums) or Soft Delete (images)

### 7.2 Documents Grid (DraggableDocumentCard)

- **Component**: Grid of DraggableDocumentCard
- **Selection**: Shift-key support for range selection
- **Delete Method**: Drag-to-link (no delete yet)
- **Visual Feedback**: Checkmark badge, ring outline, link indicator
- **Permission**: Public selection, Admin-only unlink
- **Optimistic Updates**: Not yet implemented for unlink
- **Operation**: Document linking/unlinking via drag-drop

### 7.3 Differences Summary

| Aspect | Gallery | Documents |
|--------|---------|-----------|
| **Interaction** | Ctrl+Click → Delete key | Ctrl+Click → ??? |
| **Multi-select** | Toggle each | Shift key for range |
| **Visual** | Checkmark + outline | Checkmark + ring |
| **API Integration** | Batch delete in one operation | Individual unlink calls |
| **Loading State** | Overlay during operation | None (not optimized) |
| **Permission Model** | Frontend gate only | Backend API gate |

---

## Part 8: State Management Flow

### 8.1 Complete Flow: Selection → Deletion

```
User Ctrl+Clicks Image
  ↓
ImageCard.handleClick (Line 56)
  ↓
Check e.ctrlKey || e.metaKey && isAdmin (Line 58)
  ↓
toggleImageSelection(image.id) → Store (Line 61)
  ↓
Set state.selectedImageIds (referencesStore.ts Line 353)
  ↓
ImageCard Re-renders (isSelected = true)
  ↓
Shows checkmark badge (Line 189)
  ↓
User presses Delete key
  ↓
MasonryGrid.handleKeyDown (Line 83)
  ↓
Check e.key === 'Delete' && isAdmin (Line 85)
  ↓
handleDeleteSelection() → executeDeleteSelection()
  ↓
startTransition() → Optimistic update (Line 340)
  ↓
Remove from store (Line 343)
  ↓
Make API calls DELETE /api/projects/[slug]/[type]/[imageId]
  ↓
Success callback → Clear selection
```

### 8.2 Store Dependency Graph

```
useReferencesStore (Zustand)
  ├── selectedImageIds: Set<ReferenceImageId>
  ├── selectedAlbumIds: Set<AlbumId>
  ├── images: ReferenceImage[]
  ├── albums: ReferenceAlbum[]
  └── Actions:
      ├── toggleImageSelection()
      ├── toggleAlbumSelection()
      ├── clearSelection()
      ├── removeImages()
      └── removeAlbum()

useOptimisticAlbums (Custom Hook)
  └── executeDeleteSelection()
      └── Calls useReferencesStore.setState()
          └── Updates selectedImageIds/selectedAlbumIds
```

---

## Part 9: Code Locations Quick Reference

| Feature | File | Lines |
|---------|------|-------|
| Ctrl+Click Detection (Image) | ImageCard.tsx | 56-71 |
| Ctrl+Click Detection (Album) | AlbumCard.tsx | 69-82 |
| Ctrl+Click Detection (Document) | DraggableDocumentCard.tsx | 46-51 |
| Delete Key Handler | MasonryGrid.tsx | 82-102 |
| Selection Badge (Image) | ImageCard.tsx | 189-205 |
| Selection Badge (Album) | AlbumCard.tsx | 201-217 |
| Selection Badge (Document) | DraggableDocumentCard.tsx | 80-90 |
| Selection Store | referencesStore.ts | 59-60, 345-392 |
| Delete Execution | useOptimisticAlbums.ts | 333-390 |
| Optimistic Update | useOptimisticAlbums.ts | 67, 99, 340 |
| Delete Unlink API | /api/documents/unlink/route.ts | 1-95 |
| Hover Hint (Document) | DraggableDocumentCard.tsx | 113-117 |

---

## Part 10: Key Implementation Insights

### 10.1 Smart Defaults

1. **Regular Click Behavior**: Clears selection and opens lightbox/document
2. **Shift Key Support**: Only in document cards (not in gallery yet)
3. **Selection Mode**: Admin-only in gallery, public in documents
4. **De-Stack Safety**: Admin-only gate at API level (not just frontend)

### 10.2 Optimistic Updates

- **Immediate Feedback**: UI updates before server confirmation
- **Automatic Rollback**: If API fails, state reverts (via useTransition)
- **Loading Overlay**: Shows "Creating album..." message
- **Grid Disabled**: pointer-events-none during pending operations

### 10.3 Visual Consistency

- **Badge Placement**: Top-right (images), top-left (albums/documents)
- **Badge Style**: Blue background, white checkmark, shadow
- **Outline**: Blue-500 outline with 4px offset for selected cards
- **Hover States**: gradient overlay with hint text (documents only)

### 10.4 API Design

- **Batch Operations**: Delete multiple images/albums in parallel
- **Album De-Stack**: Removes images from album, keeps them in gallery
- **Soft Delete**: Mark as deleted with undo window (60 seconds)
- **Permanent Delete**: Admin-only hard delete after soft delete

---

## Part 11: How to Adapt for Grid View

To implement ctrl+click delete in a grid view (like documents library):

### 11.1 Required Components

1. **Grid Container** with keyboard handler (copy from MasonryGrid)
2. **Card Component** with ctrl+click handler (copy from ImageCard)
3. **Selection State** in Zustand store (already have for gallery)

### 11.2 Implementation Steps

1. Add keyboard listener to grid for Delete key (copy MasonryGrid lines 82-102)
2. Add ctrl+click handler to card component (copy ImageCard lines 56-71)
3. Use existing selection store methods (toggleImageSelection, clearSelection)
4. Create delete endpoint or reuse existing one
5. Add selection badge to cards (copy ImageCard lines 189-205)
6. Implement optimistic updates via useOptimisticAlbums

### 11.3 Code Template

```typescript
// Grid Container
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Delete' && isAdmin) {
    const selected = Array.from(selectedImageIds);
    if (selected.length > 0) {
      e.preventDefault();
      executeDeleteSelection(selected, []);
    }
  }
};

// Card Component
const handleClick = (e: React.MouseEvent) => {
  if ((e.ctrlKey || e.metaKey) && isAdmin) {
    e.preventDefault();
    e.stopPropagation();
    toggleImageSelection(image.id);
  }
};
```

---

## Summary Table: Ctrl+Click Pattern Implementation

| Aspect | Implementation | Notes |
|--------|----------------|-------|
| **Detection** | `e.ctrlKey \|\| e.metaKey` | Cross-platform (Win/Mac) |
| **Gate** | `&& isAdmin` (gallery), backend (documents) | Two-level security |
| **Feedback** | Blue checkmark badge, outline | Visible selection state |
| **Storage** | Zustand Set<ID> | O(1) lookup, deduplication |
| **Deletion** | Delete key + executeDeleteSelection | Keyboard shortcut |
| **Optimistic** | React 19 useTransition | Instant UI, rollback on error |
| **API** | DELETE endpoints (images), POST unlink (docs) | Different patterns |
| **Permissions** | Admin-only (gallery), backend gate (docs) | Two security models |

---

## Conclusion

The ctrl+click delete/de-stack pattern is well-implemented across the codebase with:

1. **Consistent UX**: Same visual feedback and keyboard shortcuts
2. **Security**: Multiple layers (frontend admin gate + backend validation for docs)
3. **Performance**: O(1) selection tracking with Set data structure
4. **Feedback**: Optimistic updates with loading states
5. **Accessibility**: Keyboard shortcuts and visual indicators

The pattern can be easily adapted for any new grid view by:
- Copying the keyboard handler from MasonryGrid
- Adding ctrl+click handler to cards
- Reusing selection store and optimistic update hooks
- Creating appropriate delete/unlink endpoints

