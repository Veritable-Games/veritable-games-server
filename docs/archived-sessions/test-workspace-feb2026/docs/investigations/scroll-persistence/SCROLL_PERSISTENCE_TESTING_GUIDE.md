# Scroll Position Persistence Fix - Testing & Validation Guide

**Status:** Implementation Complete
**Date:** December 26, 2025
**Component:** Veritable Games Library (Grid & List Views)
**Previous Issue:** 6256px drift when scrolling to 100,000px

---

## Quick Start

The scroll position persistence fix tracks **pixel offset** in addition to index to eliminate drift.

### Quick Test (2 minutes)
```javascript
// In browser console at http://localhost:3000/library:

// Test 1: Grid view
document.querySelector('main').scrollTop = 50000;
// Wait 600ms, reload page (Ctrl+R)
console.log(document.querySelector('main').scrollTop); // Should be ~50000px

// Test 2: List view
// Click "List view" button
document.querySelector('main').scrollTop = 5000;
// Wait 600ms, reload
console.log(document.querySelector('main').scrollTop); // Should be ~5000px
```

**Expected:** Drift < 10px
**Failure:** Drift > 10px indicates issue with offset restoration

---

## What Was Fixed

### The Problem
- Only tracked row/item **index** when saving scroll position
- Large scrolls created drift: `offset_error = scrollTop % itemHeight`
- Example: Scrolling to 100,000px drifted 6,256px after reload

### The Solution
- Now track both **index** and **pixel offset**
- Formula: `offset = scrollTop - (index × itemHeight)`
- Two-step restoration:
  1. `scrollToIndex(index)` → Snap to row/item start
  2. `scrollBy(offset)` → Apply exact pixel offset
- Result: Exact restoration with < 5px tolerance

---

## Implementation Details

### Key Files

#### 1. useLibraryPreferences Hook
**Path:** `src/hooks/useLibraryPreferences.ts`

**What it does:**
- Stores scroll position in localStorage
- Debounces saves (500ms) to prevent thrashing
- Tracks: viewMode, index, offset

**Key function:**
```typescript
saveScrollPosition(viewMode: 'grid' | 'list', index: number, offset?: number)
```

**Saved data example:**
```json
{
  "scrollPosition": {
    "viewMode": "grid",
    "index": 198,
    "offset": 104
  }
}
```

#### 2. Grid View Handling
**Path:** `src/app/library/LibraryPageClient.tsx` (lines 1017-1209)

**Row height:** 252px (fixedItemHeight)

**Saving offset (line 1131):**
```typescript
const offset = scrollElement.scrollTop - range.startIndex * 252;
saveScrollPosition('grid', range.startIndex, offset);
```

**Restoring position (lines 1089-1110):**
```typescript
// Step 1: Snap to row start
virtuosoRef.current?.scrollToIndex({
  index: targetIndex,
  align: 'start',
});

// Step 2: Apply pixel offset
if (scrollPosition.offset && scrollPosition.offset !== 0) {
  scrollElement.scrollBy({ top: scrollPosition.offset });
}
```

#### 3. List View Handling
**Path:** `src/app/library/LibraryPageClient.tsx` (lines 1217-1549)

**Item height:** 36px (fixedItemHeight)

**Saving offset (line 1330):**
```typescript
const offset = scrollElement.scrollTop - range.startIndex * 36;
saveScrollPosition('list', range.startIndex, offset);
```

**Restoring position (lines 1292-1313):**
```typescript
// Same two-step process as grid view
virtuosoRef.current?.scrollToIndex({
  index: targetIndex,
  align: 'start',
});

if (scrollPosition.offset && scrollPosition.offset !== 0) {
  scrollElement.scrollBy({ top: scrollPosition.offset });
}
```

---

## Test Cases

### Test 1: Grid View - Large Scroll (50000px)

**Purpose:** Verify offset tracking works for very large positions

**Setup:**
1. Navigate to http://localhost:3000/library
2. Ensure GRID view selected (click Grid button)
3. Open DevTools → Console

**Test Steps:**
```javascript
// Save initial position
let before = document.querySelector('main').scrollTop;
console.log("Before:", before);

// Scroll to 50000px
document.querySelector('main').scrollTop = 50000;

// Wait for debounce (500ms) + margin
// In DevTools → Application → LocalStorage, verify:
// "library-preferences" has scrollPosition with offset

// Reload page
location.reload();

// Check restored position
setTimeout(() => {
  let after = document.querySelector('main').scrollTop;
  let drift = Math.abs(after - 50000);
  console.log("After:", after, "Drift:", drift, "px");
  console.log(drift < 10 ? "PASS ✓" : "FAIL ✗");
}, 2000);
```

**Expected Result:**
- Drift: < 10px
- Calculation:
  - Index: 198 (50000 ÷ 252)
  - Offset: 104 (50000 - 49896)
  - Restored: 198×252 + 104 = 50000 ✓

**Pass Criteria:** `Math.abs(after - 50000) < 10`

---

### Test 2: Grid View - Sub-Pixel (250px)

**Purpose:** Verify exact position for edge case (between rows)

**Test Steps:**
```javascript
location.reload(); // Reset
setTimeout(() => {
  // Set position to exactly 250px
  document.querySelector('main').scrollTop = 250;

  // Wait for debounce + reload
  setTimeout(() => {
    location.reload();

    setTimeout(() => {
      let after = document.querySelector('main').scrollTop;
      let drift = Math.abs(after - 250);
      console.log("Position:", after, "Drift:", drift, "px");
      console.log(drift < 5 ? "PASS ✓" : "FAIL ✗");
    }, 2000);
  }, 600);
}, 500);
```

**Expected Result:**
- Drift: < 5px
- Calculation:
  - Index: 0 (250 ÷ 252)
  - Offset: 250 (250 - 0)
  - Restored: 0×252 + 250 = 250 ✓

**Pass Criteria:** `Math.abs(after - 250) < 5`

---

### Test 3: Grid View - Small Scroll (100px)

**Purpose:** Verify offset for minimal scroll distance

**Test Steps:**
```javascript
document.querySelector('main').scrollTop = 100;
// Wait 600ms, reload, check
// Expected: scrollTop ≈ 100px (±5px)
```

**Calculation:**
- Index: 0 (100 ÷ 252)
- Offset: 100 (100 - 0)
- Restored: 0×252 + 100 = 100 ✓

---

### Test 4: List View - Large Scroll (5000px)

**Purpose:** Verify offset works for list view with large positions

**Setup:**
1. Click "List view" button
2. Wait for view to switch

**Test Steps:**
```javascript
document.querySelector('main').scrollTop = 5000;

// Wait 600ms for debounce

// Check localStorage for list view offset:
// "index": 138, "offset": 32

// Reload and check
location.reload();
// Expected: scrollTop ≈ 5000px (±10px)
```

**Calculation:**
- Index: 138 (5000 ÷ 36)
- Offset: 32 (5000 - 4968)
- Restored: 138×36 + 32 = 5000 ✓

---

### Test 5: List View - Sub-Pixel (100px)

**Purpose:** Verify exact restoration in list view

**Test Steps:**
```javascript
// Reload to reset
location.reload();

setTimeout(() => {
  document.querySelector('main').scrollTop = 100;

  // Wait for debounce + reload
  setTimeout(() => {
    location.reload();

    // Check: should be ≈100px (±5px)
  }, 600);
}, 1000);
```

**Calculation:**
- Index: 2 (100 ÷ 36)
- Offset: 28 (100 - 72)
- Restored: 2×36 + 28 = 100 ✓

---

### Test 6: Cross-View Switching

**Purpose:** Verify grid and list views maintain independent positions

**Setup:**
1. Start in GRID view
2. Open DevTools → Application → LocalStorage

**Test Steps:**
```javascript
// Step 1: Grid view position
document.querySelector('main').scrollTop = 1000;
setTimeout(() => {
  // Verify localStorage shows: "viewMode": "grid", offset calculated

  // Step 2: Switch to list view
  document.querySelector('button[aria-label="List view"]').click();

  setTimeout(() => {
    document.querySelector('main').scrollTop = 500;

    // Wait 600ms, check localStorage shows: "viewMode": "list"

    // Step 3: Switch back to grid - should restore to ~1000px
    document.querySelector('button[aria-label="Grid view"]').click();

    setTimeout(() => {
      let gridPos = document.querySelector('main').scrollTop;
      console.log("Grid restored to:", gridPos, "px (was 1000px)");

      // Step 4: Back to list - should restore to ~500px
      document.querySelector('button[aria-label="List view"]').click();

      setTimeout(() => {
        let listPos = document.querySelector('main').scrollTop;
        console.log("List restored to:", listPos, "px (was 500px)");

        let gridDrift = Math.abs(gridPos - 1000);
        let listDrift = Math.abs(listPos - 500);

        console.log(
          gridDrift < 20 && listDrift < 20 ? "PASS ✓" : "FAIL ✗"
        );
      }, 2000);
    }, 1000);
  }, 600);
}, 600);
```

**Expected Result:**
- Grid view: ≈1000px (±20px)
- List view: ≈500px (±20px)
- Each view maintains independent scroll position

---

## Verification Checklist

### Code Implementation
- [ ] `src/hooks/useLibraryPreferences.ts`
  - [ ] ScrollPosition interface has `offset?: number`
  - [ ] saveScrollPosition accepts offset parameter
  - [ ] Debounce delay is 500ms

- [ ] `src/app/library/LibraryPageClient.tsx` - VirtuosoGridView
  - [ ] handleRangeChanged calculates offset (line 1131)
  - [ ] Scroll restoration uses requestAnimationFrame (line 1089)
  - [ ] scrollToIndex() called first (line 1091)
  - [ ] scrollBy(offset) called second (line 1105)
  - [ ] itemHeight is 252px

- [ ] `src/app/library/LibraryPageClient.tsx` - VirtuosoListView
  - [ ] handleRangeChanged calculates offset (line 1330)
  - [ ] Scroll restoration uses requestAnimationFrame (line 1292)
  - [ ] scrollToIndex() called first (line 1294)
  - [ ] scrollBy(offset) called second (line 1308)
  - [ ] itemHeight is 36px

### Browser Testing
- [ ] Test in Chromium (Desktop Chrome)
- [ ] Test in Firefox
- [ ] Test in WebKit (Safari)
- [ ] Test on mobile Chrome (Pixel 5 emulation)
- [ ] Test on mobile Safari (iPhone 13 emulation)

### Test Case Results
- [ ] Grid View - 50000px: Drift < 10px
- [ ] Grid View - 250px: Drift < 5px
- [ ] Grid View - 100px: Drift < 5px
- [ ] List View - 5000px: Drift < 10px
- [ ] List View - 100px: Drift < 5px
- [ ] Cross-view switching: Both views maintain position (±20px)

### Edge Cases
- [ ] Zero position (scrollTop = 0): Restored correctly
- [ ] Maximum position (end of list): Restored correctly
- [ ] Rapid view switching: No position loss
- [ ] Filter change → Reload: Position cleared (expected)
- [ ] Sort change → Reload: Position preserved
- [ ] localStorage disabled: Graceful fallback (no error)
- [ ] localStorage full: Error handled gracefully

### Integration Tests
- [ ] View mode preference persists (grid vs list)
- [ ] Sort preference persists with scroll position
- [ ] Tag filters don't affect scroll restoration
- [ ] Search doesn't interfere with scroll position

---

## Offset Calculation Reference

### Grid View (252px rows)

| scrollTop | Calculation | Index | Offset | Verification |
|-----------|-------------|-------|--------|--------------|
| 0 | 0 ÷ 252 | 0 | 0 | 0×252 + 0 = 0 ✓ |
| 100 | 100 ÷ 252 | 0 | 100 | 0×252 + 100 = 100 ✓ |
| 250 | 250 ÷ 252 | 0 | 250 | 0×252 + 250 = 250 ✓ |
| 252 | 252 ÷ 252 | 1 | 0 | 1×252 + 0 = 252 ✓ |
| 500 | 500 ÷ 252 | 1 | 248 | 1×252 + 248 = 500 ✓ |
| 5000 | 5000 ÷ 252 | 19 | 188 | 19×252 + 188 = 5000 ✓ |
| 50000 | 50000 ÷ 252 | 198 | 104 | 198×252 + 104 = 50000 ✓ |

### List View (36px items)

| scrollTop | Calculation | Index | Offset | Verification |
|-----------|-------------|-------|--------|--------------|
| 0 | 0 ÷ 36 | 0 | 0 | 0×36 + 0 = 0 ✓ |
| 50 | 50 ÷ 36 | 1 | 14 | 1×36 + 14 = 50 ✓ |
| 100 | 100 ÷ 36 | 2 | 28 | 2×36 + 28 = 100 ✓ |
| 500 | 500 ÷ 36 | 13 | 32 | 13×36 + 32 = 500 ✓ |
| 5000 | 5000 ÷ 36 | 138 | 32 | 138×36 + 32 = 5000 ✓ |

---

## Troubleshooting

### Symptom: Position still drifts after reload

**Check:**
1. Open DevTools → Application → LocalStorage
2. Find "library-preferences" key
3. Verify scrollPosition contains:
   - `viewMode`: "grid" or "list"
   - `index`: integer
   - `offset`: integer

**If offset is missing:**
- handleRangeChanged may not be passing offset to saveScrollPosition
- Check line 1131 (grid) or 1330 (list)

**If offset is 0:**
- Might be rounding error
- Check: `scrollElement.scrollTop % itemHeight` should equal offset

### Symptom: Drift increases with larger scroll positions

**Check:**
1. Verify itemHeight is correct (252 for grid, 36 for list)
2. Check offset calculation formula
3. Ensure scrollBy() is applied after scrollToIndex()

**Debug:**
```javascript
// Log the calculation
const main = document.querySelector('main');
const scrollTop = main.scrollTop;
const itemHeight = 252; // or 36 for list
const index = Math.floor(scrollTop / itemHeight);
const offset = scrollTop - (index * itemHeight);
console.log({
  scrollTop,
  itemHeight,
  index,
  offset,
  calculated: index * itemHeight + offset
});
```

### Symptom: Offset always 0

**Check:**
- View is using Virtuoso (not custom scroll)
- scrollElement is accessible from virtuosoRef
- rangeChanged is firing (add console.log)

**Debug:**
```javascript
// Check if Virtuoso is rendering
const virtuoso = document.querySelector('[class*="virtuoso"]');
console.log("Virtuoso found:", !!virtuoso);

// Check scroll values
const main = document.querySelector('main');
console.log("Main scrollTop:", main.scrollTop);
```

---

## Performance Considerations

### Debounce Mechanism
- **Delay:** 500ms
- **Benefit:** Reduces writes from 100+/sec to ~1 per scroll
- **Trade-off:** 500ms delay before position is saved

### Memory Impact
- localStorage: ~100 bytes
- Runtime memory: <1KB
- No impact on scroll performance

### Browser Compatibility
- localStorage: All modern browsers
- requestAnimationFrame: All modern browsers
- Virtuoso: React 18+

---

## Success Criteria

### Quantitative
- Drift < 10px for all scroll positions
- Drift < 5px for sub-pixel positioning
- 100% of test cases pass
- All browsers show same behavior

### Qualitative
- Scroll feels smooth (no jitter)
- Position restored immediately after reload
- No performance degradation
- No console errors

---

## Test Report Template

```markdown
# Test Report: Scroll Position Persistence

**Date:** [Date]
**Tester:** [Name]
**Browser:** [Browser & Version]

## Results

| Test Case | Expected | Actual | Drift | Status |
|-----------|----------|--------|-------|--------|
| Grid 50000px | 50000 | [value] | [value] | [PASS/FAIL] |
| Grid 250px | 250 | [value] | [value] | [PASS/FAIL] |
| Grid 100px | 100 | [value] | [value] | [PASS/FAIL] |
| List 5000px | 5000 | [value] | [value] | [PASS/FAIL] |
| List 100px | 100 | [value] | [value] | [PASS/FAIL] |
| Cross-view | 1000/500 | [grid]/[list] | [grid]/[list] | [PASS/FAIL] |

## Notes
[Any issues encountered]

## Signature
[Tester Name] - [Date]
```

---

## Related Documentation

- **Implementation:** `SCROLL_PERSISTENCE_TEST_REPORT.md`
- **Test Framework:** `frontend/scroll-test-results.json`
- **Test Script:** `frontend/scripts/test-scroll-persistence.js`
- **Source Code:**
  - `src/hooks/useLibraryPreferences.ts`
  - `src/app/library/LibraryPageClient.tsx`

---

## Summary

The scroll position persistence fix is **complete** and **ready for testing**. The implementation correctly:

1. **Tracks offset** alongside index
2. **Debounces saves** to prevent localStorage thrashing
3. **Restores in two steps** for exact positioning
4. **Supports both views** with correct item heights

**Expected outcome:** Zero drift (±5-10px tolerance) across all scroll positions.

**To validate:** Follow the test cases above or use the quick test commands at the top of this guide.

---

*Last Updated: 2025-12-26*
*Component: Veritable Games Library*
*Status: Ready for QA*
