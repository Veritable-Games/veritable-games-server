# Workspace Export/Import Testing Guide

**Date**: February 13, 2026
**Purpose**: Manual testing guide for Export and Import buttons
**Estimated Time**: 10-15 minutes

---

## 🎯 Prerequisites

- ✅ Dev server running on http://localhost:3000
- ✅ TypeScript compilation successful (0 errors)
- ✅ Browser (Chrome/Firefox/Safari)

---

## 📋 Test Procedure

### PART 1: Visual Verification (2 minutes)

#### Step 1: Navigate to Workspace

1. Open your browser
2. Navigate to: **http://localhost:3000**
3. You'll likely be redirected to login or landing page
4. Log in if needed (use existing account or create one)
5. Navigate to **any project's workspace page**, for example:
   - http://localhost:3000/workspace/game-development
   - OR click on a project → Workspace tab
   - OR create a new project and go to its workspace

#### Step 2: Locate the Toolbar

**Look in the BOTTOM-LEFT corner** of the workspace canvas:

Expected UI:
```
┌─────────────────────────────────────────────────┐
│ [💾 Export] [📤 Import] │ [↶] [↷] │ [Grid: ✓] │
└─────────────────────────────────────────────────┘
```

**✅ Verify you see**:
- [ ] Rounded dark toolbar with border
- [ ] 5 buttons: Export, Import, Undo, Redo, Grid
- [ ] Vertical dividers between button groups
- [ ] Node count (e.g., "0 nodes" or "3 nodes")
- [ ] Hints panel below toolbar (with keyboard shortcuts)
- [ ] "▼ Hints" toggle button

**📸 Take a screenshot** if you want to document the UI

---

### PART 2: Export Button Test (3 minutes)

#### Step 3: Create Test Nodes

1. **Double-click** anywhere on the canvas to create a text node
2. Type some text (e.g., "Test Node 1")
3. Click outside the node to finish editing
4. Create 2 more nodes:
   - Double-click at different positions
   - Add text to each (e.g., "Test Node 2", "Test Node 3")

**✅ Current state**:
- [ ] 3 text nodes visible on canvas
- [ ] Bottom-left toolbar shows "3 nodes"

#### Step 4: Test Export Selected Nodes

1. **Select 2 nodes**:
   - Click on Node 1 to select it
   - Hold **Ctrl** and click on Node 2 to add to selection
   - Both nodes should have blue selection borders

2. **Click the Export button**:
   - Click **"Export"** in the bottom-left toolbar
   - OR press **Ctrl+E** on your keyboard

**✅ Expected behavior**:
- [ ] Browser downloads a file immediately
- [ ] Filename format: `workspace-{project-slug}-{timestamp}.json`
   - Example: `workspace-game-development-2026-02-13T11-30-00Z.json`
- [ ] File appears in your Downloads folder

3. **Open the downloaded JSON file** in a text editor:

**✅ Verify JSON structure**:
```json
{
  "version": "1.0",
  "timestamp": "2026-02-13T11:30:00.000Z",
  "metadata": {
    "nodeCount": 2,
    "connectionCount": 0,
    "boundingBox": { ... }
  },
  "nodes": [
    {
      "id": "...",
      "position": { "x": 100, "y": 200 },
      "size": { "width": 200, "height": 150 },
      "content": "<p>Test Node 1</p>",
      ...
    },
    {
      "id": "...",
      ...
    }
  ],
  "connections": []
}
```

**✅ Verify**:
- [ ] `nodeCount: 2` (only selected nodes exported)
- [ ] `nodes` array has 2 items
- [ ] Node content matches what you typed
- [ ] Positions and sizes are present
- [ ] Valid JSON (no syntax errors)

#### Step 5: Test Export All Nodes

1. **Deselect all nodes**:
   - Click on empty canvas area
   - All selection borders should disappear

2. **Click Export button again**:
   - Click **"Export"** or press **Ctrl+E**

**✅ Expected behavior**:
- [ ] New JSON file downloads
- [ ] This file should have `nodeCount: 3` (all nodes)
- [ ] `nodes` array has 3 items

**🎉 Export Test Complete!**

---

### PART 3: Import Button Test (5 minutes)

#### Step 6: Prepare for Import

1. **Keep the JSON file** you just downloaded (the one with 3 nodes)
2. **Delete 1 node from the canvas**:
   - Click a node to select it
   - Press **Delete** key
   - Node should disappear
3. **Current state**: Canvas now has 2 nodes

#### Step 7: Test Import Functionality

1. **Click the Import button**:
   - Click **"Import"** in the bottom-left toolbar
   - OR press **Ctrl+Shift+I**

**✅ Expected behavior**:
- [ ] **File picker dialog opens**
- [ ] Dialog shows "Choose files" or similar
- [ ] Accept filter: ".json" or "JSON files"

2. **Select the exported JSON file**:
   - Navigate to your Downloads folder
   - Select the `workspace-{project}-{timestamp}.json` file
   - Click "Open"

**✅ Expected behavior after file selection**:
- [ ] File picker closes
- [ ] **3 new nodes appear** on the canvas (imported from JSON)
- [ ] New nodes appear **at viewport center** (not at original positions)
- [ ] Total nodes on canvas: **5** (2 original + 3 imported)
- [ ] New nodes have **same content** as exported nodes
- [ ] New nodes have **same sizes** as exported nodes
- [ ] Bottom-left toolbar shows "5 nodes"

#### Step 8: Verify UUID Remapping

1. **Open browser DevTools**:
   - Press **F12** or right-click → Inspect
   - Go to **Console** tab

2. **Look at the imported nodes**:
   - The 3 newly imported nodes should be selectable
   - Check that they don't overlap with original nodes (proving new IDs)

**✅ Verify**:
- [ ] No console errors related to "duplicate ID" or "ID conflict"
- [ ] New nodes have different IDs than originals (UUID remapping worked)

#### Step 9: Test Import Error Handling

1. **Create an invalid JSON file**:
   - Create a new text file: `invalid.json`
   - Put invalid content: `{ invalid json }`
   - Save the file

2. **Try importing the invalid file**:
   - Click **Import** button
   - Select `invalid.json`

**✅ Expected behavior**:
- [ ] Error message appears (likely in top-right corner or toolbar area)
- [ ] Message says something like: "Invalid JSON" or "Import failed"
- [ ] No nodes are added to canvas
- [ ] Canvas remains unchanged

3. **Create wrong version JSON**:
   - Copy your exported JSON file
   - Edit the `"version"` field to `"99.0"`
   - Save as `wrong-version.json`

4. **Try importing wrong version**:
   - Click **Import** button
   - Select `wrong-version.json`

**✅ Expected behavior**:
- [ ] Error message appears
- [ ] Message mentions "unsupported version" or "schema validation failed"
- [ ] No nodes added

**🎉 Import Test Complete!**

---

### PART 4: Edge Cases & Integration (5 minutes)

#### Step 10: Test Export with Connections

1. **Create 2 new nodes** on the canvas
2. **Create a connection**:
   - Hover over the right edge of Node 1
   - You should see connection points (anchors)
   - Click and drag from Node 1's right edge to Node 2's left edge
   - A line (connection) should appear

3. **Select both connected nodes**:
   - Ctrl+click to select both nodes

4. **Export**:
   - Click **Export** button

5. **Check JSON file**:

**✅ Verify**:
- [ ] `connections` array is NOT empty
- [ ] Connection has `sourceNodeId` and `targetNodeId` matching node IDs
- [ ] Connection has `sourceAnchor` and `targetAnchor` data

6. **Delete both nodes and connection**

7. **Import the file**:
   - Click **Import**
   - Select the JSON with connections

**✅ Expected behavior**:
- [ ] 2 nodes appear
- [ ] Connection line appears between them
- [ ] Connection preserves anchor positions (left/right, etc.)

#### Step 11: Test Viewport Positioning

1. **Pan the viewport**:
   - Hold **Space** and drag to pan the canvas
   - Move to a different area of the canvas

2. **Import a JSON file**:
   - Click **Import**
   - Select any exported JSON

**✅ Expected behavior**:
- [ ] Imported nodes appear **at the current viewport center**
- [ ] NOT at their original positions from the export
- [ ] This proves viewport-relative positioning works

#### Step 12: Test Keyboard Shortcuts

1. **Select a node**
2. Press **Ctrl+E**
   - **✅ Expected**: Export dialog/download triggers

3. Press **Ctrl+Shift+I**
   - **✅ Expected**: Import file picker opens

**✅ Verify**:
- [ ] Keyboard shortcuts work the same as clicking buttons
- [ ] Tooltips on buttons show the shortcuts

---

## 🐛 Known Issues to Watch For

**Issue**: Export button doesn't trigger download
- **Debug**: Open DevTools Console → Look for errors
- **Check**: `handleExportClick` function is called (add `console.log` if needed)

**Issue**: Import doesn't add nodes
- **Debug**: Check Console for errors
- **Likely cause**: JSON validation failed or viewport calculation error

**Issue**: Imported nodes overlap exactly with original
- **Problem**: Viewport center calculation incorrect
- **Expected**: Nodes should paste at viewport center with offset

---

## ✅ Test Results Summary

After completing all tests, fill out this summary:

### Export Functionality
- [ ] Export button visible in bottom-left toolbar
- [ ] Export selected nodes (Ctrl+E) downloads JSON
- [ ] Export all nodes (when none selected) downloads JSON
- [ ] JSON file has correct structure (version 1.0)
- [ ] Node content and positions preserved in JSON
- [ ] Connections included in export

### Import Functionality
- [ ] Import button visible in bottom-left toolbar
- [ ] Import button (Ctrl+Shift+I) opens file picker
- [ ] Importing JSON creates nodes on canvas
- [ ] Nodes appear at viewport center
- [ ] New UUIDs generated (no ID conflicts)
- [ ] Node content preserved after import
- [ ] Connections recreated with remapped IDs
- [ ] Error handling works (invalid JSON, wrong version)

### Integration
- [ ] Export → Import round trip works perfectly
- [ ] Nodes with connections export/import correctly
- [ ] Viewport positioning works (paste at center)
- [ ] Keyboard shortcuts work (Ctrl+E, Ctrl+Shift+I)
- [ ] Node count updates correctly
- [ ] No console errors during normal operation

---

## 📊 Final Verdict

**Overall Status**: ⬜ PASS  ⬜ FAIL  ⬜ PARTIAL

**Notes**:
_[Add any observations, bugs found, or suggestions here]_

---

**Testing Completed**: _________________ (date/time)
**Tester**: _________________
**Browser**: _________________ (Chrome/Firefox/Safari + version)

---

## 🔍 Debugging Tips

If something doesn't work:

1. **Open DevTools Console** (F12) → Look for errors
2. **Check Network tab** → See if API calls are failing
3. **Inspect element** → Verify button handlers are attached
4. **Add console.log** → In `handleExportClick` and `handleImportClick`
5. **Check file permissions** → Ensure browser can download files

**Common Issues**:
- **Download blocked**: Browser may block downloads → Allow in settings
- **File picker doesn't open**: Check browser permissions for file access
- **JSON parse error**: Export might be corrupted → Re-export and try again

---

**Report Template**: Save this checklist and your results!
**Next Steps**: Report findings, fix any bugs, then move to testing Undo/Redo buttons
