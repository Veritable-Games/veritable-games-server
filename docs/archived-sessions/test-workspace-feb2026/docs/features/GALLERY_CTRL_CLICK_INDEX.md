# Gallery Ctrl+Click Delete Pattern - Documentation Index

## Overview

Complete analysis of how the ctrl+click multi-select and Delete key pattern is implemented across gallery views (images, albums) and document cards.

---

## Documentation Files

### 1. **GALLERY_CTRL_CLICK_QUICK_REF.md** (8.2 KB)
**START HERE** - Quick reference guide with essential information

- 30-second overview
- Key files and line numbers
- Ctrl+Click detection code
- Visual feedback guide
- Keyboard shortcuts
- Delete flow diagram
- Testing checklist
- Common issues & fixes

Best for: Quick lookup, implementation reference, troubleshooting

---

### 2. **GALLERY_CTRL_CLICK_ANALYSIS.md** (19 KB)
**COMPREHENSIVE REFERENCE** - Complete technical analysis

11 detailed sections:
1. **Ctrl+Click Event Detection** - Exact code locations (ImageCard, AlbumCard, DocumentCard)
2. **Selection State Management** - Zustand store implementation
3. **Visual Feedback** - Badge styling and effects
4. **Delete/De-Stack Functionality** - Keyboard handlers and API endpoints
5. **Optimistic UI Updates** - React 19 useTransition pattern
6. **Permission Checks** - Security gates (frontend vs backend)
7. **Gallery vs Documents Grid** - Pattern comparison
8. **State Management Flow** - Complete selection → deletion flow
9. **Code Locations Quick Reference** - File path index table
10. **Key Implementation Insights** - Design patterns and best practices
11. **How to Adapt for Grid View** - Extending pattern to new components

Best for: Deep understanding, architectural decisions, extending pattern

---

### 3. **GALLERY_ARCHITECTURE_DIAGRAMS.md** (20 KB)
**VISUAL REFERENCE** - Architecture and flow diagrams

Visual diagrams for:
- User interaction flow (gallery vs documents)
- State management architecture (store + hooks)
- Permission model (security gates)
- Visual feedback progression (UI states)
- Component interaction tree
- API call sequence diagram
- Key data structures

Best for: Visual learners, understanding relationships, presentations

---

## Quick Navigation

### I need to...

**...implement ctrl+click delete in a new view**
1. Start with: GALLERY_CTRL_CLICK_QUICK_REF.md → "Extending to New Views"
2. Reference: GALLERY_CTRL_CLICK_ANALYSIS.md → Part 11
3. Copy code from: ImageCard.tsx (lines 56-71), MasonryGrid.tsx (lines 82-102)

**...understand how selection works**
1. Read: GALLERY_CTRL_CLICK_QUICK_REF.md → "How Selection Works"
2. Diagram: GALLERY_ARCHITECTURE_DIAGRAMS.md → "State Management Architecture"
3. Code: referencesStore.ts (lines 345-392)

**...fix a bug with delete**
1. Check: GALLERY_CTRL_CLICK_QUICK_REF.md → "Common Issues"
2. Trace: GALLERY_CTRL_CLICK_ANALYSIS.md → "State Management Flow"
3. Verify: Permission checks match architecture

**...understand the visual design**
1. Reference: GALLERY_CTRL_CLICK_QUICK_REF.md → "Visual Feedback"
2. Diagram: GALLERY_ARCHITECTURE_DIAGRAMS.md → "Visual Feedback Progression"
3. Code: ImageCard.tsx (lines 189-205), AlbumCard.tsx (lines 201-217)

**...add permission checks**
1. Review: GALLERY_CTRL_CLICK_ANALYSIS.md → Part 6: "Permission Checks"
2. Diagram: GALLERY_ARCHITECTURE_DIAGRAMS.md → "Permission Model"
3. Note: Gallery needs backend gate, documents already have one

**...optimize performance**
1. Reference: GALLERY_CTRL_CLICK_QUICK_REF.md → "Performance Notes"
2. Detail: GALLERY_CTRL_CLICK_ANALYSIS.md → "Key Implementation Insights"
3. Consider: Parallelize API calls, debounce selection

---

## Key Code Locations

```
Ctrl+Click Detection:
  /frontend/src/components/references/ImageCard.tsx (lines 56-71)
  /frontend/src/components/references/AlbumCard.tsx (lines 69-82)
  /frontend/src/components/library/DraggableDocumentCard.tsx (lines 46-51)

Delete Trigger:
  /frontend/src/components/references/MasonryGrid.tsx (lines 82-102)

Delete Execution:
  /frontend/src/hooks/useOptimisticAlbums.ts (lines 333-390)

Selection State:
  /frontend/src/lib/stores/referencesStore.ts (lines 59-60, 345-392)

Visual Feedback:
  /frontend/src/components/references/ImageCard.tsx (lines 189-205)
  /frontend/src/components/references/AlbumCard.tsx (lines 201-217)

API Endpoints:
  DELETE /api/projects/[slug]/references/[imageId]
  DELETE /api/projects/[slug]/references/albums/[albumId]/images/[imageId]
  POST /api/documents/unlink (documents only)
```

---

## Key Takeaways

### Architecture Decisions
1. **Selection Storage**: Set<ID> for O(1) lookup performance
2. **State Management**: Zustand for simplicity and reactivity
3. **Optimistic Updates**: React 19 useTransition for instant feedback
4. **Permission Gates**: Frontend (gallery) + Backend (documents)

### Implementation Pattern
1. Ctrl+Click detection: `(e.ctrlKey || e.metaKey) && isAdmin`
2. Visual feedback: Blue checkmark badge + outline
3. Keyboard trigger: Delete key with selection check
4. Async execution: startTransition() for optimistic updates

### Security Considerations
1. **Gallery**: Frontend gate only (should add backend gate)
2. **Documents**: Backend gate with admin check (secure)
3. **CSRF**: fetchWithCSRF() used in all API calls
4. **Validation**: Input validation on both client and server

### UX Patterns
1. **Selection**: Toggle on Ctrl+Click, visual feedback immediate
2. **Deletion**: Requires explicit Delete key press (no accidental deletes)
3. **Feedback**: Loading overlay, disabled grid, undo notification
4. **Shortcuts**: Escape to clear, Ctrl+A to select all

---

## Development Workflow

### Adding Ctrl+Click to New Component

1. **Add click handler** (copy from ImageCard lines 56-71)
   ```typescript
   const handleClick = (e: React.MouseEvent) => {
     if ((e.ctrlKey || e.metaKey) && isAdmin) {
       e.preventDefault();
       e.stopPropagation();
       toggleImageSelection(item.id);
     }
   };
   ```

2. **Add selection badge** (copy from ImageCard lines 189-205)
   ```typescript
   {isSelected && (
     <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 shadow-lg">
       {/* Checkmark SVG */}
     </div>
   )}
   ```

3. **Add to Zustand store** (reuse existing)
   ```typescript
   const isSelected = selectedImageIds.has(item.id);
   const toggleImageSelection = useReferencesStore(state => state.toggleImageSelection);
   ```

4. **Add Delete key handler to container** (copy from MasonryGrid lines 82-102)
   ```typescript
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       if (e.key === 'Delete' && isAdmin) {
         e.preventDefault();
         handleDeleteSelection();
       }
     };
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
   }, [isAdmin, selectedImageIds, clearSelection]);
   ```

5. **Execute delete** (use existing useOptimisticAlbums)
   ```typescript
   await executeDeleteSelection(Array.from(selectedImageIds), []);
   ```

---

## Testing Guide

### Unit Tests Needed
- [ ] toggleImageSelection adds/removes ID from Set
- [ ] clearSelection resets both Sets
- [ ] selectAllImages populates Set correctly
- [ ] Ctrl+Click calls toggleImageSelection
- [ ] Regular click clears selection when active
- [ ] Delete key calls executeDeleteSelection when selected
- [ ] Non-admin can't select/delete (gate works)

### Integration Tests Needed
- [ ] Selection persists across re-renders
- [ ] Visual badge shows/hides with selection
- [ ] Delete removes items from store
- [ ] Optimistic update shows loading overlay
- [ ] API failure rolls back selection
- [ ] Multiple selections delete correctly

### E2E Tests Needed
- [ ] Ctrl+Click image → checkmark appears
- [ ] Delete key → image disappears
- [ ] Escape clears selection
- [ ] Undo notification works
- [ ] Non-admin user can't select
- [ ] Works on mobile (touch events?)

---

## Performance Considerations

| Aspect | Current | Potential Issue | Optimization |
|--------|---------|-----------------|---------------|
| Selection lookup | O(1) Set | None | Use Set consistently |
| Rendering | Only affected items | Large selections = many re-renders | Memoize cards |
| API calls | Sequential | Rate limiting, timeouts | Parallelize with Promise.all |
| Loading state | Global overlay | Blocks entire grid | Could be per-item |
| Memory | Per item in Set | 10k+ items might be slow | Paginate or virtualize |

---

## Security Checklist

- [ ] Gallery delete has admin gate on DELETE endpoints
- [ ] Document unlink has admin gate on POST endpoint
- [ ] CSRF token included in fetchWithCSRF
- [ ] User role validated on every API call
- [ ] Input IDs validated (format, existence)
- [ ] Rate limiting on delete operations
- [ ] Audit logging for delete actions
- [ ] No direct ID exposure in API responses

---

## Related Documentation

See also:
- `GALLERY_DELETE_STRATEGY.md` - Soft delete and undo implementation
- `GALLERY_AUDIT_SUMMARY.md` - Gallery system overview
- `/frontend/src/lib/stores/referencesStore.ts` - Store interface
- `/frontend/src/hooks/useOptimisticAlbums.ts` - Optimistic update hook

---

## Document Metadata

- **Created**: November 10, 2025
- **Last Updated**: November 10, 2025
- **Coverage**: Gallery ImageCard, AlbumCard, DocumentCard components
- **Files Analyzed**: 15+ component and hook files
- **Total Lines Examined**: 2,000+
- **Versions**: React 19, Zustand, Next.js App Router

---

## Quick Links

All absolute file paths:

- `/home/user/Projects/veritable-games-main/frontend/src/components/references/ImageCard.tsx`
- `/home/user/Projects/veritable-games-main/frontend/src/components/references/AlbumCard.tsx`
- `/home/user/Projects/veritable-games-main/frontend/src/components/references/MasonryGrid.tsx`
- `/home/user/Projects/veritable-games-main/frontend/src/components/library/DraggableDocumentCard.tsx`
- `/home/user/Projects/veritable-games-main/frontend/src/lib/stores/referencesStore.ts`
- `/home/user/Projects/veritable-games-main/frontend/src/hooks/useOptimisticAlbums.ts`
- `/home/user/Projects/veritable-games-main/frontend/src/app/api/documents/unlink/route.ts`

---

**Start with GALLERY_CTRL_CLICK_QUICK_REF.md for a quick overview!**
