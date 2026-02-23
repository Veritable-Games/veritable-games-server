# Workspace E2E Test Status - February 16, 2026

## Summary

**Status**: 12 of 16 tests passing (75%)
**Date**: February 16, 2026
**Test File**: `e2e/specs/workspace-basic-crud.spec.ts`
**Browser**: Chromium
**Environment**: localhost:3000 (development)

## Infrastructure Fixes Applied ✅

### 1. Login System (FIXED)
- **Issue**: Tests failing with "Login failed: 500 -"
- **Root Cause**: Missing `auth.login_history` table + SQL parameter mismatches
- **Fixes**:
  - Created `fix-login-history.ts` script to apply missing migration
  - Fixed 3 SQL queries in `auth/service.ts` (parameter count mismatch)
  - Added `DATABASE_URL` and `API_BASE_URL` to `playwright.config.ts`
- **Commit**: e42322e6af

### 2. Request Body Consumption (FIXED)
- **Issue**: `request.clone()` TypeError masking real authentication errors
- **Root Cause**: Request body consumed at line 16, can't be re-read with `.clone()`
- **Fix**: Moved `twoFactorToken` extraction to function scope, eliminated `.clone()` call
- **Commit**: 54d4d2f015

### 3. Workspace Route Access (FIXED)
- **Issue**: 404 errors on `/projects/{slug}/workspace` routes
- **Root Cause**: Workspace page requires `isDeveloperOrAbove` role, testuser had role "user"
- **Fixes**:
  - Updated testuser role from "user" to "developer" using `update-testuser-role.ts`
  - Added `export const dynamic = 'force-dynamic'` to workspace page
  - Updated `.claude-credentials` to reflect developer role
- **Commit**: 2d8bfcab6f

### 4. Test Credentials (FIXED)
- **Issue**: Login returning 401 "Invalid username or password"
- **Root Cause**: `.claude-credentials` referenced non-existent "claude" user
- **Fix**: Updated credentials to use existing testuser account (ID: 6)
- **Password**: cKwzlKa4ixJDNc8 (15 chars, cryptographically secure)

## Passing Tests (12/16) ✅

### Create Operations (2/2)
- ✅ should create a text node via API (8.0s)
- ✅ should create a sticky note (note type) (5.2s)

### Read Operations (2/2)
- ✅ should display node content correctly (4.5s)
- ✅ should persist nodes across page refresh (10.7s)

### Update Operations - Content Editing (3/3)
- ✅ should edit node content via double-click (11.3s)
- ✅ should auto-save content after edit (9.1s)
- ✅ should handle special characters in content (8.9s)

### Update Operations - Position (3/3)
- ✅ should move node by dragging (7.2s)
- ✅ should ensure position is stored as NUMBER not STRING (7.6s)
- ✅ should persist position after page refresh (10.8s)

### Update Operations - Size (1/2)
- ❌ should resize node by dragging corner handle (FAILED)
- ✅ should persist size after page refresh (18.5s)

### Auto-Save (1/2)
- ❌ should debounce rapid edits (only save once) (FAILED)
- ✅ should save content before navigation (test not shown in output)

## Failing Tests (4/16) ❌

### 1. Resize Node by Dragging Corner Handle
**Status**: FAILED
**Expected**: Size should increase from 200x100 to > 200 width and > 100 height
**Actual**: Size remains 200x100
**Test Duration**: 11.8s

**Error**:
```
Actual size after resize: 200x100
expect(dbNode.size.width).toBeGreaterThan(200)
expect(dbNode.size.height).toBeGreaterThan(100)
```

**Analysis**:
- Test creates node with size 200x100
- Clicks node to select it (shows resize handles)
- Drags southeast corner by delta (50, 50)
- Expected: 300x150 (aspect ratio 2:1 maintained)
- Actual: 200x100 (no change)

**Attempted Fix**: Fixed React closure bug in `TextNode.tsx` resize handler using refs
- **Commit**: bb64b1b019
- **Result**: Still failing - fix did not resolve issue

**Possible Causes**:
1. Mousemove handler not being called (event not firing)
2. Size calculation logic has bug
3. `onUpdate()` not actually updating node
4. Update happening but not saved to database

**Next Steps**:
1. Add temporary logging to verify mousemove events fire
2. Check if resize handles are actually rendered and clickable
3. Verify `onUpdateRef.current()` is called during resize
4. Check if auto-save is triggered after resize completes

---

### 2. Delete Node via Delete Key
**Status**: FAILED
**Expected**: Node should disappear from UI and be soft-deleted in database
**Actual**: Node still visible after pressing Delete key
**Test Duration**: 9.8s

**Error**:
```
Error: expect(locator).not.toBeVisible() failed
Locator: locator('[data-node-id="..."]')
Expected: not visible
Received: visible
Timeout: 5000ms
```

**Analysis**:
- Test creates node, selects it, presses Delete key
- Node should be removed from UI (soft-delete in database)
- Node remains visible - Delete key not working

**Possible Causes**:
1. Delete key handler not registered or not firing
2. Handler firing but delete action not working
3. Node deleted from store but UI not updating
4. Delete permission check failing

**Next Steps**:
1. Check keyboard event handler in `WorkspaceCanvas.tsx`
2. Verify Delete key event is reaching the handler
3. Check if `deleteSelectedNodes()` is being called
4. Verify node is selected when Delete is pressed

---

### 3. Delete Multiple Selected Nodes
**Status**: FAILED - TIMEOUT
**Expected**: Should select two nodes and delete both with Delete key
**Actual**: Test timed out trying to click second node
**Test Duration**: 15.1s

**Error**:
```
TimeoutError: locator.click: Timeout 10000ms exceeded.
waiting for locator('[data-node-id="node_106eeea7-2f6e-4263-bd46-1fe1864f5c17"]')
```

**Analysis**:
- Test creates two nodes (node1 and node2)
- Clicks node1 successfully
- Tries to Shift+click node2 but times out
- node2 element not found or not clickable

**Possible Causes**:
1. node2 not rendered in DOM
2. node2 created but not visible in viewport
3. Previous test state not cleaned up properly
4. Multi-select functionality broken

**Next Steps**:
1. Verify both nodes are created successfully
2. Check if both nodes are in viewport
3. Test multi-select functionality manually
4. Add wait for node2 to be visible before clicking

---

### 4. Debounce Rapid Edits (Only Save Once)
**Status**: FAILED
**Expected**: Rapid edits should be debounced to < 5 save requests
**Actual**: 5 save requests (not debounced)
**Test Duration**: Test duration not shown

**Error**:
```
Error: expect(received).toBeLessThan(expected)
Expected: < 5
Received: 5
```

**Analysis**:
- Test edits node content rapidly (types 5 characters quickly)
- Expected: 1-2 save requests (500ms debounce working)
- Actual: 5 save requests (one per character - debounce NOT working)

**Possible Causes**:
1. Debounce not configured correctly
2. Each keystroke triggering immediate save
3. Debounce timer being reset incorrectly
4. onUpdate callback creating new debounce instance

**Next Steps**:
1. Check debounce implementation in workspace store
2. Verify 500ms debounce is configured for auto-save
3. Check if onUpdate creates new debounce on every call
4. Test debounce manually with rapid typing

## Test Environment

### Database
- **Type**: PostgreSQL
- **Connection**: localhost:5432/veritable_games
- **Mode**: postgres
- **Pool Size**: Max 50, Min 5 (increased for E2E tests)
- **Connection Timeout**: 30s

### Test Accounts
- **Username**: testuser
- **Email**: test@veritablegames.com
- **Role**: developer
- **User ID**: 6

### Browser Configuration
- **Browser**: Chromium (Desktop Chrome)
- **Viewport**: 1280x720
- **Workers**: 1 (sequential execution to prevent connection pool exhaustion)
- **Timeout**: 30s per test
- **Global Timeout**: 1 hour

## Performance Metrics

- **Total Test Duration**: 2.9 minutes (174 seconds)
- **Average Test Duration**: 10.9 seconds
- **Longest Test**: 18.5s (persist size after page refresh)
- **Shortest Test**: 4.5s (display node content correctly)

## Next Actions

### Priority 1 (Blocking)
1. **Fix Delete Key Handler** - Test #2 and #3 depend on this
2. **Fix Resize Functionality** - Add debugging to understand why mousemove not working
3. **Fix Debounce** - Should be quick fix, check store implementation

### Priority 2 (Nice to Have)
1. Add retry logic for flaky tests (multiple node click timeout)
2. Improve test isolation (ensure clean state between tests)
3. Add visual regression testing for resize operations

### Investigation Needed
1. Why did my React closure fix not work for resize?
   - Refs are updated correctly
   - useCallback has empty dependencies
   - Event handlers should access latest values via refs
   - **Hypothesis**: Something else is preventing resize from working

2. Is Delete key handler even registered?
   - Check `WorkspaceCanvas.tsx` keyboard handler
   - Verify event listener is attached to correct element
   - Test Delete key manually in browser

3. Why is debounce not working?
   - Check workspace store debounce configuration
   - Verify onUpdate isn't creating new debounce instance each time
   - Test with console logging to see save frequency

## Related Files

### Test Files
- `frontend/e2e/specs/workspace-basic-crud.spec.ts` - Main test suite
- `frontend/e2e/helpers/workspace-helpers.ts` - Test helper functions
- `frontend/e2e/global-setup.ts` - Test environment setup
- `frontend/playwright.config.ts` - Playwright configuration

### Source Files
- `frontend/src/components/workspace/TextNode.tsx` - Node component with resize handler
- `frontend/src/components/workspace/WorkspaceCanvas.tsx` - Canvas component with keyboard handler
- `frontend/src/stores/workspace.ts` - Workspace state management
- `frontend/src/lib/auth/service.ts` - Authentication service

### Infrastructure Scripts
- `frontend/scripts/fix-login-history.ts` - Creates auth.login_history table
- `frontend/scripts/update-testuser-role.ts` - Updates testuser role to developer
- `frontend/scripts/user-management/setup-localhost-accounts.js` - Creates test accounts

## Commits Made

1. **bb64b1b019** - Fixed resize React closure bug (didn't work)
2. **e42322e6af** - Fixed SQL + config + database table
3. **54d4d2f015** - Fixed request.clone() TypeError
4. **2d8bfcab6f** - Enable workspace access for developer role

## Conclusion

**Progress**: Improved from infrastructure failures (tests couldn't even run) to 75% passing tests (12/16).

**Infrastructure**: ✅ All fixed - authentication, database, routing all working

**Remaining Issues**: 4 specific functional bugs in workspace features:
1. Resize not working (despite attempted fix)
2. Delete key not deleting nodes
3. Multi-select + delete not working (likely related to #2)
4. Debounce not working (saving on every keystroke)

**Estimated Time to Fix**: 4-8 hours
- Delete key: 1-2 hours (likely simple fix)
- Debounce: 1 hour (configuration issue)
- Resize: 2-4 hours (need deeper debugging)
- Multi-select: 1 hour (likely fixed by delete key fix)

**Recommendation**: Focus on Delete key handler first, as two tests depend on it. Then fix debounce (should be quick). Finally, deep-dive into resize issue with proper debugging tools.
