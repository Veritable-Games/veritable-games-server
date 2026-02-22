# DRAG-TO-LINK BUG FIX GUIDE

## The Bug

**File**: `/home/user/Projects/veritable-games-main/frontend/src/app/library/LibraryPageClient.tsx`  
**Lines**: 578 and 595  
**Severity**: Medium - Poor UX, functional but no visual feedback

### Problem
When user drops a document to link it, the loading spinner never appears because `isLinking` is hardcoded to `false`.

```typescript
// CURRENT (BROKEN) - Lines 578, 595
isLinking={false}

// SHOULD BE - Lines 578, 595
isLinking={isLinking}
```

## The Fix

### Change 1: Line 578
```diff
  <DraggableDocumentCard
    key={`${pair[0].source}-${pair[0].id}`}
    doc={pair[0]}
    isDragged={draggedDocument?.id === pair[0].id && draggedDocument?.source === pair[0].source}
    isDropTarget={dropTarget === `${pair[0].source}-${pair[0].id}`}
-   isLinking={false}
+   isLinking={isLinking}
    isSelected={selectedIds.has(`${pair[0].source}-${pair[0].id}`)}
    draggedDocument={draggedDocument}
    onDragStart={() => onDragStart(pair[0]!)}
    onDragEnd={onDragEnd}
    onDragOver={() => onDragOver(`${pair[0]!.source}-${pair[0]!.id}`)}
    onDragLeave={onDragLeave}
    onDrop={() => onDrop(pair[0]!)}
    onSelect={(doc, ctrlKey, shiftKey) => onSelect(doc, ctrlKey, shiftKey)}
  />
```

### Change 2: Line 595
```diff
  <DraggableDocumentCard
    key={`${pair[1].source}-${pair[1].id}`}
    doc={pair[1]}
    isDragged={draggedDocument?.id === pair[1].id && draggedDocument?.source === pair[1].source}
    isDropTarget={dropTarget === `${pair[1].source}-${pair[1].id}`}
-   isLinking={false}
+   isLinking={isLinking}
    isSelected={selectedIds.has(`${pair[1].source}-${pair[1].id}`)}
    draggedDocument={draggedDocument}
    onDragStart={() => onDragStart(pair[1]!)}
    onDragEnd={onDragEnd}
    onDragOver={() => onDragOver(`${pair[1]!.source}-${pair[1]!.id}`)}
    onDragLeave={onDragLeave}
    onDrop={() => onDrop(pair[1]!)}
    onSelect={(doc, ctrlKey, shiftKey) => onSelect(doc, ctrlKey, shiftKey)}
  />
```

## What This Fixes

With this change, when user drops a document:

1. `isLinking` state becomes `true` (from useDragDropLink hook)
2. Spinner appears on the target card
3. "Linking..." text displays
4. User sees feedback during the 500ms API call + page reload

## Testing the Fix

1. **As admin user**:
   - Go to Library page
   - Drag one document card onto another
   - **Before fix**: No spinner appears, page just reloads
   - **After fix**: Spinner + "Linking..." text appears on target card

2. **Console logs** (should see all of these):
   ```
   [useDragDropLink] Drop event triggered { ... }
   [useDragDropLink] Sending link request { ... }
   [useDragDropLink] Link request succeeded { groupId: "ldg_...", ... }
   [useDragDropLink] Reloading page to reflect changes
   ```

3. **UI Feedback** (should see all of these):
   - Card A fades to 50% opacity while dragging
   - "Link" badge appears on other cards
   - Card B shows purple ring when dragging over
   - **[AFTER FIX]** Card B shows spinner when dropping
   - Toast message: "Documents linked successfully! Refreshing..."
   - Page reloads after 500ms

## Impact

- **Lines changed**: 2
- **Files changed**: 1
- **Risk**: Minimal - just passing existing state value through
- **Side effects**: None - only enables already-implemented spinner UI
- **Testing needed**: Manual UI test with 2+ documents as admin

## Additional Issues Found

See `docs/DEBUG_DRAG_TO_LINK_SYSTEM.md` for:
- Complete system investigation
- Detailed flow diagrams
- Additional improvements (P1-P3)
- Database schema documentation

