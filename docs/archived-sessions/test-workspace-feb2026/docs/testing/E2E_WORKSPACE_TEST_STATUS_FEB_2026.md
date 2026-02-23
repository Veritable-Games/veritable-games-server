# Workspace E2E Test Status - February 16, 2026

## Summary

**Current Status**: 12 of 16 tests passing (75%)

**Progress**: From 5 passing → 12 passing in this session

## Test Results

### ✅ Passing Tests (12)

#### Create Operations
1. ✅ Should create a text node via API
2. ✅ Should create a sticky note (note type)

#### Read Operations
3. ✅ Should display node content correctly
4. ✅ Should persist nodes across page refresh

#### Update Operations - Content Editing
5. ✅ Should edit node content via double-click
6. ✅ Should auto-save content after edit
7. ✅ Should handle special characters in content

#### Update Operations - Position (Drag)
8. ✅ Should move node by dragging
9. ✅ Should ensure position is stored as NUMBER not STRING
10. ✅ Should persist position after page refresh

#### Auto-Save Functionality
11. ✅ Should save content before navigation

#### Update Operations - Size (Resize)
12. ✅ Should persist size after page refresh (verifies saved size persists, doesn't verify resize actually changes size)

### ❌ Failing Tests (4)

1. **❌ Should resize node by dragging corner handle**
   - Issue: Size stays 200x100, doesn't change
   - Root cause: useCallback dependency issue - callback recreated on every node update, old event listeners attached to stale closure
   - mousemove handler never fires because document listeners point to old callback

2. **❌ Should delete node via Delete key**
   - Issue: Delete key not removing nodes
   - Needs investigation

3. **❌ Should delete multiple selected nodes**
   - Issue: Deleting multiple nodes not working
   - Likely same root cause as #2

4. **❌ Should debounce rapid edits (only save once)**
   - Issue: Saving too many times (5 saves instead of <5)
   - Debounce logic needs investigation

## Key Fixes Applied

### 1. Test Infrastructure (CRITICAL FIX)
**Problem**: Playwright webServer config was starting its own server, conflicting with manually-started dev server
**Solution**: Let Playwright manage the server lifecycle via `reuseExistingServer: !process.env.CI`
**Impact**: Tests went from connection refused errors to stable execution

### 2. Drag System Improvements
**Changes**:
- Changed dragNodeByDelta() to use manual MouseEvent dispatch via page.evaluate()
- Fixed stale ref issues in onNodeDragMove and onNodeDragEnd
- Track start positions for ALL drags and calculate position as `startPos + cumulativeDelta`
- Read final position from `yjsNodes` instead of stale `nodesRef.current`

**Result**: All 3 drag tests now pass

### 3. Resize Helper Refactor
**Changes**:
- Switched from synthetic event dispatch to Playwright's mouse API
- Proper event sequencing: mousedown → wait 100ms → mousemove → mouseup
- Allows React time to process mousedown and attach document listeners
- Reduced from 80 lines to 35 lines

**Result**: Code is cleaner but resize still doesn't work due to component-level issue

### 4. Added Resize Handle Attributes
**Changes**: Added `data-resize-handle="se|sw|ne|nw"` to all 4 resize handles in TextNode.tsx
**Result**: Test selectors can now find handles

## Known Issues

### Resize Not Working - Root Cause Analysis

The resize failure is a **React closure bug**:

```typescript
// TextNode.tsx line 291
const handleResizeStart = useCallback(
  (e: React.MouseEvent, direction: string) => {
    // ... setup code ...

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // This closure captures current 'node', 'scale', 'onUpdate'
    };

    // Attach listeners to document
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  },
  [node, scale, onUpdate]  // <-- PROBLEM: Dependencies change frequently
);
```

**The Bug**:
1. User clicks resize handle → handleResizeStart runs → attaches listeners to document
2. Node updates during resize → useCallback deps change → NEW callback created
3. OLD listeners still attached to document, pointing to STALE closure
4. Mousemove events fire → OLD handler runs with STALE values → nothing happens

**Solution Options**:
1. Use refs for event handlers (proper fix, requires refactor)
2. Remove dependencies from useCallback (risky)
3. Use a different event handling pattern (e.g., global event bus)

### Delete Key Not Working

Needs investigation - keyboard event handlers might not be attached or Delete key not reaching the handler.

### Debounce Saving Too Much

The auto-save debounce (500ms) might not be working correctly. Needs investigation of the debouncedSave implementation.

## Recommendations

### Immediate Actions
1. Fix resize by refactoring to use refs for event handlers
2. Debug Delete key event handling
3. Review debounce logic in debouncedSave

### Medium Term
1. Consider using a state machine for workspace modes (idle/editing/dragging/resizing)
2. Centralize event handling to avoid closure bugs
3. Add more granular logging for debugging test failures

## Test Execution

```bash
# Run all workspace tests
npx playwright test e2e/specs/workspace-basic-crud.spec.ts --project=chromium

# Run specific test
npx playwright test e2e/specs/workspace-basic-crud.spec.ts --project=chromium --grep="resize node"

# Debug mode
npx playwright test e2e/specs/workspace-basic-crud.spec.ts --project=chromium --debug
```

## Files Modified

- `frontend/e2e/helpers/workspace-helpers.ts` - Improved drag and resize helpers
- `frontend/e2e/fixtures/workspace-fixtures.ts` - Cleanup and auto-save improvements
- `frontend/src/components/workspace/WorkspaceCanvas.tsx` - Fixed drag handlers
- `frontend/src/components/workspace/TextNode.tsx` - Added resize handle attributes, logging
- `frontend/playwright.config.ts` - Increased connection pool, reduced parallelism

## Performance

- Test suite runtime: ~2-3 minutes for 16 tests
- Server startup: ~5-8 seconds
- No memory leaks detected
- Connection pool stable at 50 max connections

---

**Last Updated**: February 16, 2026
**Test Framework**: Playwright 1.52.0
**Next.js**: 15.5.12
**Database**: PostgreSQL 15
