# Workspace Undo/Redo Testing Guide

**Date**: February 13, 2026
**Purpose**: Manual testing guide for Undo and Redo buttons
**Estimated Time**: 15-20 minutes

---

## 🎯 Prerequisites

- ✅ Dev server running on http://localhost:3000
- ✅ Workspace toolbar visible in bottom-left corner
- ✅ Browser with DevTools access (for debugging)

---

## 🧪 What We're Testing

**Undo/Redo System**:
- Powered by **Yjs UndoManager**
- Tracks all workspace operations (create, delete, move, edit, connect)
- Undo button: Reverts last action
- Redo button: Restores undone action
- Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z or Ctrl+Y (redo)
- Disabled states: Gray out when no history available

---

## 📋 Test Procedure

### PART 1: Visual Verification (2 minutes)

#### Step 1: Navigate to Workspace

1. Open browser: **http://localhost:3000**
2. Navigate to any project's workspace
3. Locate the toolbar in the **bottom-left corner**

**✅ Verify you see**:
- [ ] Toolbar with 5 buttons
- [ ] Undo button (↶ curved arrow left) after Export/Import
- [ ] Redo button (↷ curved arrow right) next to Undo
- [ ] Vertical divider between Edit and View controls

#### Step 2: Check Initial Disabled State

**On a fresh page load** (no undo history):

**✅ Verify Undo button**:
- [ ] Button appears **grayed out** (opacity: 0.5)
- [ ] Button has `disabled` attribute (inspect in DevTools)
- [ ] Cursor shows **not-allowed** icon when hovering
- [ ] Tooltip shows: "Undo (Ctrl+Z)"

**✅ Verify Redo button**:
- [ ] Button appears **grayed out** (same as Undo)
- [ ] Button has `disabled` attribute
- [ ] Cursor shows **not-allowed** icon
- [ ] Tooltip shows: "Redo (Ctrl+Shift+Z)"

**✅ Test clicking disabled buttons**:
- [ ] Click Undo button → Nothing happens (button is disabled)
- [ ] Click Redo button → Nothing happens (button is disabled)

**📸 Screenshot**: Disabled state (grayed out buttons)

---

### PART 2: Undo Node Creation (3 minutes)

#### Step 3: Create a Node

1. **Double-click** anywhere on the canvas
2. A text node appears with editable text
3. Type: **"Test Node 1"**
4. Click outside the node to finish editing

**Current state**:
- [ ] 1 node visible on canvas
- [ ] Bottom-left shows "1 node"

#### Step 4: Check Undo Button Enabled

**✅ Verify Undo button state changed**:
- [ ] Button is now **enabled** (full opacity, not grayed)
- [ ] Button is **clickable** (no longer disabled)
- [ ] Cursor shows **pointer** when hovering
- [ ] Redo button still **disabled** (no redo history yet)

**📸 Screenshot**: Undo enabled, Redo disabled

#### Step 5: Test Undo - Click Button

1. **Click the Undo button** (↶)

**✅ Expected behavior**:
- [ ] Node **disappears** from canvas
- [ ] Bottom-left shows "0 nodes"
- [ ] Undo button becomes **disabled** again (no more history)
- [ ] Redo button becomes **ENABLED** (can redo the undone action)

**📸 Screenshot**: Undo disabled, Redo enabled

#### Step 6: Test Redo - Click Button

1. **Click the Redo button** (↷)

**✅ Expected behavior**:
- [ ] Node **reappears** at same position
- [ ] Node has same content: "Test Node 1"
- [ ] Bottom-left shows "1 node"
- [ ] Undo button becomes **enabled** again
- [ ] Redo button becomes **disabled** (no more redo history)

**🎉 Basic Undo/Redo Test Complete!**

---

### PART 3: Keyboard Shortcuts (3 minutes)

#### Step 7: Test Ctrl+Z (Undo Keyboard)

1. **Create another node**:
   - Double-click on canvas
   - Type: "Test Node 2"
   - Click outside

2. **Press Ctrl+Z**

**✅ Expected behavior**:
- [ ] Node 2 disappears (same as clicking Undo button)
- [ ] Undo button state updates (may become disabled)
- [ ] Redo button becomes enabled

**✅ Verify**:
- [ ] Keyboard shortcut works identically to clicking button
- [ ] Button states update correctly

#### Step 8: Test Ctrl+Shift+Z (Redo Keyboard)

1. **Press Ctrl+Shift+Z**

**✅ Expected behavior**:
- [ ] Node 2 reappears
- [ ] Same behavior as clicking Redo button

#### Step 9: Test Ctrl+Y (Alternative Redo)

1. **Delete Node 2**:
   - Click on Node 2 to select it
   - Press **Delete** key
   - Node disappears

2. **Press Ctrl+Z** to undo deletion
   - Node reappears

3. **Press Ctrl+Y** (alternative redo shortcut)

**✅ Expected behavior**:
- [ ] Redo operation works (node disappears again)
- [ ] Ctrl+Y behaves same as Ctrl+Shift+Z

**✅ Verify all 3 shortcuts**:
- [ ] **Ctrl+Z** → Undo works
- [ ] **Ctrl+Shift+Z** → Redo works
- [ ] **Ctrl+Y** → Redo works (alternative)

---

### PART 4: Multiple Undo/Redo Operations (4 minutes)

#### Step 10: Create Multiple Nodes

1. **Clear the canvas** (select all with Ctrl+A, press Delete)
2. **Create 5 nodes**:
   - Double-click 5 times at different positions
   - Name them: "Node A", "Node B", "Node C", "Node D", "Node E"
   - Click outside each after typing

**Current state**:
- [ ] 5 nodes visible
- [ ] Bottom-left shows "5 nodes"
- [ ] Undo button **enabled**

#### Step 11: Test Multiple Undo in Sequence

1. **Click Undo button** (or Ctrl+Z)
   - **✅ Expected**: Node E disappears (most recent action)
   - **✅ Node count**: 4 nodes

2. **Click Undo again**
   - **✅ Expected**: Node D disappears
   - **✅ Node count**: 3 nodes

3. **Click Undo again**
   - **✅ Expected**: Node C disappears
   - **✅ Node count**: 2 nodes

4. **Click Undo again**
   - **✅ Expected**: Node B disappears
   - **✅ Node count**: 1 node

5. **Click Undo again**
   - **✅ Expected**: Node A disappears
   - **✅ Node count**: 0 nodes
   - **✅ Undo button**: Now **disabled** (no more history)

**✅ Verify**:
- [ ] Each undo removes nodes in **reverse order** (LIFO - Last In First Out)
- [ ] Undo button disables when history is empty
- [ ] Redo button enabled after first undo

#### Step 12: Test Multiple Redo in Sequence

1. **Click Redo 5 times** (or press Ctrl+Y 5 times)

**✅ Expected behavior after each redo**:
- [ ] Redo 1: Node A reappears (1 node)
- [ ] Redo 2: Node B reappears (2 nodes)
- [ ] Redo 3: Node C reappears (3 nodes)
- [ ] Redo 4: Node D reappears (4 nodes)
- [ ] Redo 5: Node E reappears (5 nodes)
- [ ] Redo button: Now **disabled** (no more redo history)

**✅ Verify**:
- [ ] All nodes restored in correct order
- [ ] All nodes at original positions
- [ ] All nodes have original content

---

### PART 5: Undo/Redo Different Operations (5 minutes)

#### Step 13: Undo Node Deletion

1. **Create a node** (name it "Delete Test")
2. **Select the node** (click on it)
3. **Delete it** (press Delete key)
   - Node disappears
4. **Click Undo** (or Ctrl+Z)

**✅ Expected behavior**:
- [ ] Node **reappears**
- [ ] Node is at **same position** as before deletion
- [ ] Node has **same content**: "Delete Test"
- [ ] Node **remains selected** (blue border)

#### Step 14: Undo Node Movement

1. **Drag a node** to a new position:
   - Click and drag Node A to a different location
   - Release mouse

2. **Click Undo**

**✅ Expected behavior**:
- [ ] Node **moves back** to original position
- [ ] Movement is **smooth** (not teleporting)

3. **Click Redo**
   - **✅ Expected**: Node moves to new position again

#### Step 15: Undo Node Editing

1. **Double-click a node** to edit it
2. **Change the text**: "Node A" → "Modified Node A"
3. **Click outside** to finish editing
4. **Click Undo**

**✅ Expected behavior**:
- [ ] Node content **reverts** to "Node A"
- [ ] Text inside node updates immediately

5. **Click Redo**
   - **✅ Expected**: Node content becomes "Modified Node A" again

#### Step 16: Undo Connection Creation

1. **Create 2 nodes** (if not already present)
2. **Create a connection**:
   - Hover over right edge of Node 1 (see anchor points)
   - Click and drag to left edge of Node 2
   - Connection line appears

3. **Click Undo**

**✅ Expected behavior**:
- [ ] Connection **disappears**
- [ ] Both nodes remain (only connection undone)

4. **Click Redo**
   - **✅ Expected**: Connection **reappears** with same anchor points

---

### PART 6: Edge Cases & Integration (4 minutes)

#### Step 17: Test Undo After Page Refresh

1. **Create a node** (name it "Persistence Test")
2. **Note**: Undo button is enabled
3. **Refresh the page** (F5 or Ctrl+R)
4. **Wait for page to reload**

**✅ Expected behavior**:
- [ ] Node "Persistence Test" is **still visible** (persisted to database)
- [ ] Undo button is **DISABLED** (undo history cleared on refresh)
- [ ] Redo button is **DISABLED**

**📌 Important**: Yjs UndoManager stores history in **memory only**, not in database. Refreshing clears undo/redo history.

#### Step 18: Test Undo History Limit

**Note**: Yjs UndoManager may have a history limit (e.g., 100 operations)

1. **Perform 10 operations** quickly:
   - Create 10 nodes in rapid succession
   - Or: Create 1 node, move it 10 times

2. **Undo 10 times**

**✅ Verify**:
- [ ] All 10 operations can be undone
- [ ] Undo button disables after undoing all
- [ ] No errors in console

**Note**: If you want to test the limit, you'd need to perform 100+ operations, which is impractical for manual testing.

#### Step 19: Test Undo Clears Redo History

This is a critical edge case:

1. **Create Node 1**
2. **Create Node 2**
3. **Undo** (Node 2 disappears, Redo enabled)
4. **Create Node 3** (new action)

**✅ Expected behavior**:
- [ ] Node 3 appears
- [ ] Redo button becomes **DISABLED** (redo history cleared)
- [ ] You **cannot** redo Node 2 anymore (new timeline created)

**📌 Why?**: Creating a new action after undo creates a new timeline, invalidating the old redo history.

#### Step 20: Test Undo with Node Resize

1. **Create a node**
2. **Resize the node**:
   - Hover over bottom-right corner (resize handle appears)
   - Drag to make node larger
3. **Click Undo**

**✅ Expected behavior**:
- [ ] Node **resizes back** to original size
- [ ] Resize is smooth (animated)

**⚠️ Known Issue**: If resize undo doesn't work, this might be a bug. Check console for errors.

---

### PART 7: Multi-User Undo (Advanced - Optional)

**Note**: This test requires WebSocket multi-user sync to be working. If WebSocket is not deployed, skip this section.

#### Step 21: Test Undo in Multi-User Session

1. **Open 2 browser windows** (side by side)
2. **Navigate both to the same workspace**
3. **In Window 1**: Create a node
4. **In Window 2**: Verify node appears (sync)
5. **In Window 1**: Click Undo

**✅ Expected behavior**:
- [ ] Node disappears in **Window 1**
- [ ] Node disappears in **Window 2** (synced undo)

**⚠️ Note**: If multi-user doesn't work, this is expected (WebSocket not deployed). This test is optional.

---

## 🐛 Known Issues to Watch For

### Issue 1: Undo Button Doesn't Enable After Action
- **Debug**: Open Console → Check for errors
- **Possible cause**: Yjs UndoManager not capturing transactions
- **Check**: `useWorkspaceStore.getState().canUndo()` returns `true`

### Issue 2: Undo Doesn't Revert Changes
- **Debug**: Console errors related to Yjs
- **Possible cause**: UndoManager not tracking the operation type
- **Example**: Node resize might not be tracked if it's not a Yjs operation

### Issue 3: Redo Button Stays Disabled
- **Debug**: After undo, `canRedo()` should return `true`
- **Check**: Button's `disabled` attribute in DevTools

### Issue 4: Keyboard Shortcuts Don't Work
- **Debug**: Check if focus is inside a text input (shortcuts disabled while typing)
- **Solution**: Click outside text node, then try shortcuts

---

## ✅ Test Results Summary

After completing all tests, fill out this summary:

### Undo Button
- [ ] Undo button visible in toolbar
- [ ] Button disabled on fresh page load
- [ ] Button enables after performing action
- [ ] Click Undo reverts last action
- [ ] Keyboard Ctrl+Z works
- [ ] Button disables when no more history
- [ ] Multiple undo works (LIFO order)

### Redo Button
- [ ] Redo button visible in toolbar
- [ ] Button disabled initially
- [ ] Button enables after undo
- [ ] Click Redo restores undone action
- [ ] Keyboard Ctrl+Shift+Z works
- [ ] Keyboard Ctrl+Y works (alternative)
- [ ] Button disables when no more redo history

### Operation Types
- [ ] Undo node creation
- [ ] Undo node deletion
- [ ] Undo node movement
- [ ] Undo node editing (text changes)
- [ ] Undo node resize
- [ ] Undo connection creation
- [ ] Redo all operation types

### Edge Cases
- [ ] Multiple undo/redo in sequence
- [ ] Undo after page refresh (history clears)
- [ ] New action clears redo history
- [ ] Tooltips show keyboard shortcuts
- [ ] No console errors during undo/redo
- [ ] Button states update correctly

---

## 📊 Final Verdict

**Overall Status**: ⬜ PASS  ⬜ FAIL  ⬜ PARTIAL

**Bugs Found**:
_[List any bugs or unexpected behavior]_

**Performance Notes**:
_[Is undo/redo fast? Any lag?]_

**UX Feedback**:
_[Is the disabled state clear? Are tooltips helpful?]_

---

**Testing Completed**: _________________ (date/time)
**Tester**: _________________
**Operations Tested**: _________________ (e.g., "create, delete, move, edit")

---

## 🔍 Debugging Commands

If you encounter issues, open DevTools Console and run:

```javascript
// Check if undo is available
useWorkspaceStore.getState().canUndo()  // Should return true/false

// Check if redo is available
useWorkspaceStore.getState().canRedo()  // Should return true/false

// Manually trigger undo (for debugging)
useWorkspaceStore.getState().undo()

// Manually trigger redo (for debugging)
useWorkspaceStore.getState().redo()

// Check Yjs undo manager
const store = useWorkspaceStore.getState()
// Internal reference - may not be directly accessible
```

**Common Console Errors**:
- `Cannot read property 'undo' of undefined` → UndoManager not initialized
- `Yjs transaction failed` → Yjs sync issue
- `canUndo is not a function` → Store not properly connected

---

## 🎯 Success Criteria

**Undo/Redo is working correctly if**:

1. ✅ Buttons enable/disable based on history
2. ✅ Undo reverts actions in correct order (LIFO)
3. ✅ Redo restores actions in correct order
4. ✅ All operation types are undoable (create, delete, move, edit)
5. ✅ Keyboard shortcuts work (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y)
6. ✅ Visual state (button disabled/enabled) matches actual state
7. ✅ No console errors during normal operation
8. ✅ Undo/redo is reasonably fast (< 100ms per operation)

---

**Next Steps**: After completing this test, move on to testing the **Grid Toggle** button!

---

**Report Template**: Save your test results for documentation
**Guide Location**: `/home/user/Desktop/workspace-undo-redo-test-guide.md`
