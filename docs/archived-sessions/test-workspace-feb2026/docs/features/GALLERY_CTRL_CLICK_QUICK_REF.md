# Quick Reference: Gallery Ctrl+Click Delete Pattern

## 30-Second Overview

The app implements **ctrl+click multi-select** for gallery images/albums with keyboard delete:

1. **Ctrl+Click** → Toggles selection (blue checkmark badge appears)
2. **Delete Key** → Deletes all selected items with optimistic update
3. **Escape** → Clears selection
4. **Admin-only** in gallery, public in documents

---

## Key Files

| What | File | Key Lines |
|------|------|-----------|
| **Select Image** | `ImageCard.tsx` | 56-71 |
| **Select Album** | `AlbumCard.tsx` | 69-82 |
| **Delete Trigger** | `MasonryGrid.tsx` | 82-102 |
| **Delete Execute** | `useOptimisticAlbums.ts` | 333-390 |
| **Selection State** | `referencesStore.ts` | 59-60, 345-392 |
| **Document Select** | `DraggableDocumentCard.tsx` | 46-51 |

---

## Ctrl+Click Detection

```typescript
// Both gallery and documents use this pattern:
if ((e.ctrlKey || e.metaKey) && isAdmin) {
  e.preventDefault();
  e.stopPropagation();
  toggleImageSelection(image.id);  // or toggleAlbumSelection()
}
```

- `e.ctrlKey || e.metaKey` = Cross-platform (Ctrl on Windows/Linux, Cmd on Mac)
- `&& isAdmin` = Admin-only gate (gallery only, not documents)
- Prevents default browser behavior and stops event bubbling

---

## Visual Feedback

| State | Badge | Outline | Card Style |
|-------|-------|---------|-----------|
| Idle | None | gray-700 | normal |
| Hover | None | gray-600 | bg-gray-800 |
| Selected | Checkmark (top-right) | outline-blue-500 | outline-offset-4 |

Badge: 6x6 blue-500 rounded circle with white checkmark

---

## Keyboard Shortcuts

| Key | Action | Scope | Permission |
|-----|--------|-------|-----------|
| **Ctrl+Click** | Select/Deselect | Image/Album | Admin |
| **Delete** | Delete selected | Grid | Admin |
| **Escape** | Clear selection | Grid | All |
| **Ctrl+A** | Select all | Grid | Admin |

---

## Delete Flow

```
User: Ctrl+Click Image → Image selected (checkmark shows)
User: Delete key → Delete triggered

executeDeleteSelection():
  1. startTransition() → isPending=true
  2. Remove from store (optimistic)
  3. Loading overlay shows
  4. API DELETE calls made
  5. On success: Clear selection, hide overlay
  6. On error: Auto-rollback via useTransition

API Calls:
  DELETE /api/projects/[slug]/references/[imageId]
  DELETE /api/projects/[slug]/references/albums/[albumId]/images/[imageId]
```

---

## State Management

```typescript
// Store: useReferencesStore (Zustand)
selectedImageIds: Set<ReferenceImageId>    // O(1) lookup
selectedAlbumIds: Set<AlbumId>

// Hook: useOptimisticAlbums
isPending: boolean                          // From React 19 useTransition
executeDeleteSelection(imageIds[], albumIds[])
```

Actions:
- `toggleImageSelection(id)` - Add or remove from selection
- `toggleAlbumSelection(id)` - Add or remove from selection
- `clearSelection()` - Reset both sets to empty

---

## Optimistic Updates (React 19)

```typescript
const [isPending, startTransition] = useTransition();

startTransition(() => {
  // UI updates immediately with this state change
  removeImages(imageIds);
  // If API fails, this rolls back automatically
});

// Meanwhile, API calls are made:
for (const imageId of imageIds) {
  const response = await fetch(...DELETE...);
}
```

Benefits:
- Instant feedback (no wait for API)
- Automatic rollback on error
- Loading state (`isPending`) for UI feedback
- Grid disabled during pending (pointer-events-none)

---

## Permission Model

### Gallery (Images/Albums)

```
Frontend Gate:
  if (isAdmin) {
    • Ctrl+Click works
    • Delete key works
  }
  else {
    • Ctrl+Click opens lightbox
    • Delete key does nothing
  }

Backend Gate: None (relies on frontend)
Risk: API calls can be made directly
Fix: Add admin check to DELETE endpoints
```

### Documents (Libraries)

```
Frontend Gate: None (public selection)
  • Ctrl+Click works for anyone
  • No Delete key handler (uses drag-to-link)

Backend Gate: API validation
  POST /api/documents/unlink
  ├─ getCurrentUser() check
  ├─ user.role === 'admin' required
  └─ Returns 403 Forbidden if not admin
  
Safe: Backend validates all requests
```

---

## How Selection Works

### Storage
- Set data structure = O(1) lookup/add/remove
- Efficient for large galleries (thousands of items)
- Deduplication automatic (Set prevents duplicates)

### Rendering
- `isSelected = selectedImageIds.has(image.id)`
- If true, show checkmark and outline
- Component re-renders on selection state change

### Clearing
- Escape key: `clearSelection()` → both Sets reset
- Regular click: If selection active, clear before opening lightbox
- Delete success: Auto-cleared by store

---

## Visual Progression

```
Click Image
  ↓
[Checkmark appears, outline shows]
  ↓
Press Delete
  ↓
[Loading overlay, grid opacity 0.6, pointer-events: none]
  ↓
API completes
  ↓
[Image removed, selection cleared, overlay hidden]
  ↓
[Undo notification shows - 60 second window]
```

---

## Testing Checklist

To test the ctrl+click delete pattern:

- [ ] Single image: Ctrl+Click → Delete
- [ ] Multiple images: Ctrl+Click each → Delete (should delete all)
- [ ] Album: Ctrl+Click album → Delete (album removed, images return)
- [ ] Mixed: Select images + albums → Delete all
- [ ] Escape: While selected, press Escape → Selection clears
- [ ] Regular click: While selected, click image → Opens lightbox + clears selection
- [ ] Ctrl+A: Select all images
- [ ] Delete key blocked: Non-admin user → Delete key does nothing
- [ ] Undo: Wait for undo notification after delete

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Selection doesn't appear | Not admin | Verify isAdmin = true |
| Delete key doesn't work | Not selected or not admin | Ctrl+Click first, check role |
| Loading overlay stuck | API error | Check network tab, see console error |
| Selection persists after delete | Store not cleared | Manually call clearSelection() |
| Checkmark in wrong position | Component CSS | ImageCard = top-right, AlbumCard = top-left |

---

## File Locations (Absolute Paths)

```
/home/user/Projects/veritable-games-main/frontend/src/

components/references/
  ├─ ImageCard.tsx              ← Ctrl+Click detect + badge
  ├─ AlbumCard.tsx              ← Ctrl+Click detect + badge
  └─ MasonryGrid.tsx            ← Delete key handler + optimistic update

components/library/
  └─ DraggableDocumentCard.tsx   ← Document Ctrl+Click

lib/stores/
  └─ referencesStore.ts         ← Selection state + actions

lib/projects/
  └─ gallery-service.ts         ← Gallery configuration

hooks/
  └─ useOptimisticAlbums.ts     ← Delete execution + React 19

app/api/
  └─ documents/unlink/route.ts  ← De-stack (unlink) endpoint
  └─ projects/[slug]/[type]/[imageId]/
     └─ route.ts                 ← Delete image endpoint
```

---

## Extending to New Views

To add ctrl+click delete to a new grid view:

1. **Copy** keyboard handler from MasonryGrid (lines 82-102)
2. **Add** ctrl+click handler to card component (copy ImageCard lines 56-71)
3. **Show** selection badge (copy ImageCard lines 189-205)
4. **Reuse** store: toggleImageSelection(), clearSelection()
5. **Reuse** hook: useOptimisticAlbums() for delete execution
6. **Add** permission gate: `&& isAdmin` if admin-only

That's it! All state management already exists.

---

## Performance Notes

- **Selection lookup**: O(1) with Set data structure
- **Batch delete**: Sequential API calls (could parallelize)
- **Rendering**: Only affected images re-render
- **Loading**: Grid disabled + overlay shown (prevents user actions)
- **Undo window**: 60 seconds before permanent delete

---

## Security Considerations

1. **Gallery**: Frontend gate only (not secure)
   - Add backend admin check to DELETE endpoints
   
2. **Documents**: Backend gate (secure)
   - API validates user.role === 'admin'
   
3. **CSRF Protection**: fetchWithCSRF() used in hooks
   - Prevents cross-site request forgery
   
4. **Input Validation**: IDs validated on backend
   - Format checks for group IDs, image IDs

---

## Related Documentation

- `GALLERY_DELETE_STRATEGY.md` - Soft delete implementation
- `GALLERY_AUDIT_SUMMARY.md` - Gallery system overview
- `GALLERY_ARCHITECTURE_DIAGRAMS.md` - Visual diagrams
