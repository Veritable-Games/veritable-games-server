# Ctrl+Click Architecture Diagram

## User Interaction Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  GALLERY VIEW (MasonryGrid + ImageCard + AlbumCard)             │
└─────────────────────────────────────────────────────────────────┘

User Action                    Component              Store Update
─────────────────              ─────────────────      ──────────────
Ctrl+Click Image    ──────→    ImageCard.handleClick  
                                (lines 56-71)
                                ├─ Check ctrlKey
                                ├─ Check isAdmin
                                └─ toggleImageSelection()
                                                      ──────────────→
                                                      selectedImageIds
                                                      .add(imageId)

Visual Feedback:
  ├─ Checkmark badge (top-right)
  ├─ Blue outline (outline-3)
  └─ Re-renders with isSelected=true

─────────────────────────────────────────────────────────────────

User presses Delete key  ──→   MasonryGrid.handleKeyDown
                                (lines 82-102)
                                ├─ Check e.key === 'Delete'
                                ├─ Check isAdmin
                                └─ handleDeleteSelection()
                                    ├─ Get selectedImageIds
                                    └─ executeDeleteSelection()
                                                      ──────────────→
                                                      startTransition()
                                                      removeImages()

Optimistic Update:
  ├─ startTransition() triggers
  ├─ UI updates immediately
  ├─ Loading overlay shows
  └─ Grid disabled (pointer-events-none)

─────────────────────────────────────────────────────────────────

API Calls (executeDeleteSelection):

DELETE /api/projects/[slug]/references/[imageId]
  ├─ Image 1
  ├─ Image 2
  └─ Image 3

Or for albums:

DELETE /api/projects/[slug]/references/albums/[albumId]/images/[imageId]
  ├─ Album A → Image 1
  ├─ Album A → Image 2
  └─ Album B → Image 3

─────────────────────────────────────────────────────────────────

Success Response:
  ├─ Clear selection
  ├─ Remove from store
  ├─ Hide loading overlay
  └─ Show undo notification (60 seconds)


┌─────────────────────────────────────────────────────────────────┐
│  DOCUMENT GRID (DraggableDocumentCard)                          │
└─────────────────────────────────────────────────────────────────┘

User Action                    Component              Store Update
─────────────────              ─────────────────      ──────────────
Ctrl+Click Document  ──────→   DraggableDocumentCard
                                .onClick (lines 46-51)
                                ├─ Check ctrlKey
                                ├─ Check metaKey
                                └─ onSelect(doc, true, shiftKey)

Visual Feedback:
  ├─ Checkmark badge (top-left)
  ├─ Blue ring outline
  ├─ Link indicator badge
  └─ Hover hint: "Ctrl+Click to select"

─────────────────────────────────────────────────────────────────

(No Delete key handler yet - documents use drag-to-link pattern)

Drag Document onto Another  ──→ DocumentCard.onDrop
                                ├─ Drag indicates linking action
                                └─ POST /api/library/documents/link

Unlink Documents (Admin):
  POST /api/documents/unlink
  ├─ Backend: getCurrentUser() check
  ├─ Validate admin role
  └─ unifiedDocumentService.unlinkGroup()
```

---

## State Management Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     useReferencesStore                            │
│                    (Zustand Store)                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  State:                                                           │
│  ├─ images: ReferenceImage[]                                      │
│  ├─ albums: ReferenceAlbum[]                                      │
│  ├─ selectedImageIds: Set<ReferenceImageId>  ← Selection State   │
│  ├─ selectedAlbumIds: Set<AlbumId>           ← Selection State   │
│  ├─ isLightboxOpen: boolean                                      │
│  └─ [...other state]                                             │
│                                                                   │
│  Actions:                                                         │
│  ├─ toggleImageSelection(imageId)    ← Called by Ctrl+Click      │
│  ├─ toggleAlbumSelection(albumId)    ← Called by Ctrl+Click      │
│  ├─ clearSelection()                 ← Called by Escape/Delete   │
│  ├─ removeImages(imageIds[])         ← Called by Delete key      │
│  └─ [...other actions]                                           │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
         ↑                                          ↑
         │                                          │
    Used by:                              Updates from:
    ├─ ImageCard                          ├─ ImageCard.handleClick
    ├─ AlbumCard                          ├─ MasonryGrid.handleKeyDown
    ├─ MasonryGrid                        ├─ useOptimisticAlbums
    └─ GalleryClient                      └─ GalleryClient


┌──────────────────────────────────────────────────────────────────┐
│              useOptimisticAlbums Hook                             │
│         (React 19 useTransition)                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Options:                                                         │
│  ├─ projectSlug                                                   │
│  ├─ galleryType                                                   │
│  ├─ onSuccess?: () => void                                       │
│  └─ onError?: (error) => void                                    │
│                                                                   │
│  Returns:                                                         │
│  ├─ isPending: boolean                                           │
│  ├─ executeCreateAlbum()                                         │
│  ├─ executeAddToAlbum()                                          │
│  ├─ executeCombineAlbums()                                       │
│  └─ executeDeleteSelection()  ← Used by MasonryGrid             │
│      ├─ startTransition()  ← React 19 API                       │
│      ├─ Optimistic update (remove from store)                   │
│      └─ API calls (DELETE /api/...)                             │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
    Provides immediate UI feedback before API confirmation
```

---

## Permission Model

```
┌──────────────────────────────────────────────────────────────────┐
│                    PERMISSION CHECKS                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Gallery Operations:                                              │
│  ────────────────────                                            │
│                                                                   │
│  Ctrl+Click Select:                                              │
│  ├─ Frontend Gate: if (isAdmin)                                  │
│  └─ Non-admin: Regular click opens lightbox                      │
│                                                                   │
│  Delete Key:                                                     │
│  ├─ Frontend Gate: if (e.key === 'Delete' && isAdmin)           │
│  └─ Non-admin: Key does nothing                                  │
│                                                                   │
│  API Call (DELETE /api/projects/.../):                           │
│  ├─ No backend gate (assumes frontend gate sufficient)          │
│  └─ Risk: Direct API calls could bypass permission               │
│                                                                   │
│  ────────────────────────────────────────────────────────────────│
│                                                                   │
│  Document Operations:                                             │
│  ────────────────────                                            │
│                                                                   │
│  Ctrl+Click Select:                                              │
│  ├─ Frontend Gate: None (public)                                │
│  └─ Anyone can select documents                                  │
│                                                                   │
│  Unlink (De-Stack):                                              │
│  ├─ Frontend Gate: None (public UI)                             │
│  ├─ API Route (/api/documents/unlink):                          │
│  │  ├─ Backend Gate: getCurrentUser()                           │
│  │  ├─ Check: user.role === 'admin'                             │
│  │  └─ Response: 403 Forbidden if not admin                     │
│  └─ Safe: Backend validates permission                          │
│                                                                   │
│  ────────────────────────────────────────────────────────────────│
│                                                                   │
│  Summary:                                                         │
│  ├─ Gallery: Frontend gate + API trust                          │
│  └─ Documents: Backend gate (secure)                            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Visual Feedback Progression

```
1. IDLE STATE
   ┌─────────────┐
   │  Image      │  (normal gray border)
   │             │
   └─────────────┘

2. HOVER STATE
   ┌─────────────┐
   │  Image      │  (border-gray-600, bg-gray-800)
   │             │  (Cursor becomes pointer)
   └─────────────┘

3. CTRL+CLICK (Selection)
   ┌──────────────────┐
   │  Image       ✓   │  (checkmark badge, top-right)
   │  ┌──────────┐    │  (blue-500 outline)
   │  │          │    │  (outline-3 outline-offset-4)
   │  └──────────┘    │
   └──────────────────┘

4. DELETE KEY PRESSED
   ┌─────────────────────┐
   │  ░░░░░░░░░░░░░░░   │  (opacity-0.6, pointer-events-none)
   │  ░ Image       ✓  ░ │
   │  ░                 ░ │
   │  ░░░░░░░░░░░░░░░   │
   │                      │
   │  Loading overlay:     │
   │  ┌────────────────┐  │
   │  │  ⟳ Creating... │  │
   │  └────────────────┘  │
   └─────────────────────┘

5. SUCCESS (Clear Selection)
   ┌─────────────┐
   │  [Empty]    │  (image removed from grid)
   │             │
   └─────────────┘

   + Undo Notification:
   ┌──────────────────────────┐
   │ Image deleted.           │
   │ You have 60s to undo. [↶] │
   └──────────────────────────┘
```

---

## Component Interaction Tree

```
GalleryClient (Page Component)
├─ Keyboard listener (lines 329-345)
│  └─ Ctrl+A: selectAllImages()
│  └─ Escape: clearSelection()
│
├─ MasonryGrid
│  ├─ Keyboard listener (lines 82-102)
│  │  └─ Delete key: handleDeleteSelection() → executeDeleteSelection()
│  │  └─ Escape: clearSelection()
│  │
│  └─ map(item) → ImageCard | AlbumCard | VideoCard
│     │
│     ├─ ImageCard
│     │  ├─ onClick handler (lines 56-71)
│     │  │  ├─ If Ctrl+Click: toggleImageSelection()
│     │  │  └─ Else: openLightbox()
│     │  │
│     │  └─ Selection Badge (lines 189-205)
│     │     └─ Show if isSelected
│     │
│     └─ AlbumCard
│        ├─ handleCardClick (lines 69-82)
│        │  ├─ If Ctrl+Click: toggleAlbumSelection()
│        │  └─ Else: openLightbox()
│        │
│        └─ Selection Badge (lines 201-217)
│           └─ Show if isSelected
│
├─ useReferencesStore (Zustand)
│  ├─ selectedImageIds: Set
│  └─ selectedAlbumIds: Set
│
└─ useOptimisticAlbums (Hook)
   └─ executeDeleteSelection()
      ├─ startTransition()
      ├─ removeImages()
      ├─ API calls (DELETE)
      └─ onSuccess/onError callbacks
```

---

## API Call Sequence Diagram

```
User deletes 2 images from 1 album:

Timeline:
─────────────────────────────────────────────────────────────────

T0: Delete key pressed
    ├─ selectedImageIds: [101, 102]
    └─ selectedAlbumIds: [A1]

T1: executeDeleteSelection() called
    ├─ startTransition() → isPending = true
    ├─ UI updates immediately (optimistic)
    │  └─ removeImages([101, 102])
    │  └─ removeAlbum(A1)
    └─ Loading overlay shown

T2-T3: Delete album images (sequential)
    ├─ DELETE /api/projects/slug/references/albums/A1/images/101
    │  └─ Response: 200 OK
    └─ DELETE /api/projects/slug/references/albums/A1/images/102
       └─ Response: 200 OK
       
       Note: Backend auto-deletes album when empty
       If 3+ images in album, album stays with remaining images

T4-T5: Delete standalone images (sequential)
    ├─ DELETE /api/projects/slug/references/101
    │  └─ Response: 200 OK
    └─ DELETE /api/projects/slug/references/102
       └─ Response: 200 OK

T6: All APIs succeed
    ├─ isPending = false
    ├─ Loading overlay hidden
    ├─ selectedImageIds cleared
    ├─ selectedAlbumIds cleared
    └─ onSuccess('delete') callback

T7: Show undo notification
    └─ 60 second countdown for restore


Error Case (T2 fails):
─────────────────────
T2: DELETE .../images/101 fails
    ├─ Catch error
    ├─ useTransition auto-rollback
    ├─ selectedImageIds restored: [101, 102]
    ├─ selectedAlbumIds restored: [A1]
    ├─ UI reverts
    └─ onError() callback
       └─ Toast error notification shown
```

---

## Key Data Structures

```
ReferenceImage {
  id: ReferenceImageId                    // Unique ID
  project_id: string                      // Parent project
  file_path: string                       // CDN URL
  filename_storage: string                // Original filename
  aspect_ratio: number                    // For lazy-load skeleton
  tags: ReferenceTag[]                    // Associated tags
  linked_document_group_id?: string       // For linked documents
  is_deleted?: boolean                    // Soft delete marker
  [... 15+ more fields]
}

ReferenceAlbum {
  id: AlbumId                             // Unique ID (Math.random initially)
  project_id: string
  gallery_type: GalleryType
  name: string | null                     // Auto-generated or custom
  images: ReferenceImage[]                // Member images
  image_count: number                     // Quick reference
  created_by: UserId
  created_at: ISO8601
  updated_at: ISO8601
}

SelectionState (in Zustand) {
  selectedImageIds: Set<ReferenceImageId>
  selectedAlbumIds: Set<AlbumId>
  // O(1) lookup time - efficient for large galleries
}

UploadQueue (in Zustand) {
  uploadQueue: QueuedFile[]
  // Separate from selection - concurrent uploads
}
```

