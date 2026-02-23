# Bug Fix: Nodes Disappearing When Clicked

**Date**: November 27, 2025
**Status**: ✅ Fixed
**Severity**: Critical
**File Modified**: `frontend/src/components/workspace/WorkspaceCanvas.tsx` (lines 634-639)

---

## Problem Description

Users reported that workspace nodes would disappear when clicking on them. This was a critical UX bug that made the workspace unusable.

---

## Root Cause Analysis

### The Bug Sequence

1. User clicks on a workspace node
2. The outer `<div>` container of the TextNode receives focus (it has `tabIndex={0}`)
3. This outer div is **NOT** contentEditable (only the RichTextEditor inside is)
4. If user presses Backspace or Delete (common action after clicking something), the keyboard handler checks:
   ```typescript
   const isTyping =
     target.tagName === 'INPUT' ||
     target.tagName === 'TEXTAREA' ||
     target.isContentEditable;
   ```
5. Since the focused element (outer div) is not contentEditable, `isTyping = false`
6. The delete handler executes and removes the node!

### Why This Happened

The `isTyping` check was too simplistic. It only checked if the target element itself was contentEditable, but didn't consider:
- Elements that are **inside** a workspace node component
- Elements that have a contentEditable **child** or **parent**

---

## The Fix

### Before (WorkspaceCanvas.tsx:634-635)

```typescript
const isTyping =
  target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
```

### After (WorkspaceCanvas.tsx:634-639)

```typescript
const isTyping =
  target.tagName === 'INPUT' ||
  target.tagName === 'TEXTAREA' ||
  target.isContentEditable ||
  target.closest('[data-node-id]') !== null || // Focused on workspace node
  target.closest('[contenteditable="true"]') !== null; // Inside contentEditable area
```

### What Changed

1. **`target.closest('[data-node-id]') !== null`**:
   - Checks if the focused element is **inside** a workspace node
   - Every TextNode has `data-node-id={node.id}` attribute
   - This prevents Delete/Backspace from working when focus is anywhere on the node

2. **`target.closest('[contenteditable="true"]') !== null`**:
   - Additional safety check for contentEditable areas
   - Covers edge cases where `isContentEditable` might not be true on the target itself

---

## Testing

### Manual Test Steps

1. Navigate to any project workspace
2. Click on a node to select it
3. Press Backspace or Delete
4. **Expected**: Node should NOT be deleted (because focus is on the node)
5. Click on the canvas background (away from nodes)
6. Select a node using Shift+Click
7. Press Delete with focus on canvas
8. **Expected**: Node SHOULD be deleted (intentional delete action)

### Automated Test

Created test script: `scripts/test-workspace-click-bug.ts`

To run:
```bash
npx tsx scripts/test-workspace-click-bug.ts
```

---

## Impact

**Before Fix**:
- ❌ Nodes would disappear unexpectedly when clicking on them
- ❌ Users couldn't interact with nodes without accidentally deleting them
- ❌ Workspace was essentially unusable

**After Fix**:
- ✅ Nodes only delete when explicitly requested (canvas has focus + Delete key)
- ✅ Users can safely click and interact with nodes
- ✅ Workspace is fully functional

---

## Related Issues

This fix also addresses:
- Accidental deletion when clicking to edit a node
- Confusion about how to delete nodes (users now must focus canvas or use delete button)
- Keyboard shortcuts working unexpectedly when focused on UI elements

---

## Future Improvements

Consider adding:
1. **Visual feedback**: Show which element has keyboard focus
2. **Delete confirmation**: Prompt before deleting nodes
3. **Undo/Redo**: Allow users to recover from accidental deletions
4. **Better focus management**: Automatically focus canvas after certain actions

---

## Files Changed

- `frontend/src/components/workspace/WorkspaceCanvas.tsx` (lines 634-639) - **Fixed isTyping check**
- `frontend/scripts/test-workspace-click-bug.ts` - **New test script**
- `docs/features/workspace/BUG_FIX_NODES_DISAPPEARING.md` - **This file**

---

## Commit Message

```
Fix: Prevent nodes from being accidentally deleted when clicked

Root cause: The isTyping check in keyboard handlers was too simplistic.
It only checked if the target element itself was contentEditable, but
didn't consider when focus was on a workspace node container.

When users clicked on a node, the outer div received focus. If they
then pressed Backspace/Delete, the node would be deleted because the
keyboard handler thought they weren't typing.

Fix: Enhanced isTyping check to also detect:
- When focus is inside a workspace node (data-node-id attribute)
- When focus is inside any contentEditable area (closest() check)

This ensures Delete/Backspace only work for intentional deletions
(when canvas has focus), not when interacting with nodes.

Files changed:
- src/components/workspace/WorkspaceCanvas.tsx (lines 634-639)
- scripts/test-workspace-click-bug.ts (new test)
- docs/features/workspace/BUG_FIX_NODES_DISAPPEARING.md (documentation)
```

---

**Fixed by**: Claude Code
**Tested by**: Manual testing + automated test script
**Production Ready**: Yes ✅
