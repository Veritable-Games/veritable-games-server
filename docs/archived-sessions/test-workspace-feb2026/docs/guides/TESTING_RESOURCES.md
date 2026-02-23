# Scroll Position Persistence - Testing Resources

Complete guide to testing artifacts and procedures.

---

## Documentation Files

### 1. SCROLL_PERSISTENCE_SUMMARY.md
**Purpose:** Executive summary and quick reference
**Contains:**
- Overview of fix
- What was changed
- Test results summary
- Next steps
- Final status

**Use When:** You need a quick overview or to brief stakeholders

### 2. SCROLL_PERSISTENCE_TEST_REPORT.md
**Purpose:** Detailed technical report
**Contains:**
- Implementation overview
- Component descriptions
- All 6 test cases with procedures
- Offset calculation reference tables
- Browser compatibility matrix
- Code review checklist
- Regression testing info

**Use When:** You need technical details or implementation review

### 3. SCROLL_PERSISTENCE_TESTING_GUIDE.md
**Purpose:** Step-by-step testing procedures
**Contains:**
- Quick start test (2 minutes)
- Implementation details
- Detailed test procedures for each case
- Verification checklist
- Troubleshooting guide
- Offset calculation tables
- Test report template

**Use When:** You're performing manual testing

### 4. scroll-test-results.json
**Purpose:** Structured test framework
**Location:** `frontend/scroll-test-results.json`
**Contains:**
- Test metadata and timestamps
- Test case definitions
- Manual testing steps (5 steps)
- Expected console output
- Technical details
- Offset calculations
- Performance notes

**Use When:** Setting up test environment or tracking progress

---

## Testing Artifacts

### Scripts

#### test-scroll-persistence.js
**Location:** `frontend/scripts/test-scroll-persistence.js`
**Purpose:** Generate test instructions and verify offset calculations
**Usage:** `node scripts/test-scroll-persistence.js`
**Output:** Generates formatted testing guide

#### Playwright Test Suite
**Location:** `frontend/e2e/scroll-persistence.spec.ts`
**Purpose:** Automated Playwright tests (when library has documents)
**Usage:** `npm run test:e2e`
**Status:** Ready to run once database populated

---

## Quick Test Commands

### Copy-Paste for Browser Console

#### Test 1: Grid View - 50000px
```javascript
// Reset
location.reload();

// After page loads
setTimeout(() => {
  const main = document.querySelector('main');

  // Scroll to 50000px
  main.scrollTop = 50000;

  // Wait for debounce
  setTimeout(() => {
    console.log("Before reload:", main.scrollTop);

    // Check localStorage
    const prefs = JSON.parse(localStorage.getItem('library-preferences'));
    console.log("Saved position:", prefs.scrollPosition);

    // Reload
    location.reload();

    // After reload
    setTimeout(() => {
      const newPos = document.querySelector('main').scrollTop;
      const drift = Math.abs(newPos - 50000);
      console.log("After reload:", newPos);
      console.log("Drift:", drift, "px");
      console.log(drift < 10 ? "✅ PASS" : "❌ FAIL");
    }, 2000);
  }, 600);
}, 500);
```

#### Test 2: Grid View - 250px (Sub-pixel)
```javascript
location.reload();
setTimeout(() => {
  document.querySelector('main').scrollTop = 250;

  setTimeout(() => {
    console.log("Before:", document.querySelector('main').scrollTop);

    location.reload();

    setTimeout(() => {
      const after = document.querySelector('main').scrollTop;
      const drift = Math.abs(after - 250);
      console.log("After:", after, "Drift:", drift);
      console.log(drift < 5 ? "✅ PASS" : "❌ FAIL");
    }, 2000);
  }, 600);
}, 500);
```

#### Test 3: Grid View - 100px
```javascript
location.reload();
setTimeout(() => {
  document.querySelector('main').scrollTop = 100;

  setTimeout(() => {
    location.reload();

    setTimeout(() => {
      const after = document.querySelector('main').scrollTop;
      const drift = Math.abs(after - 100);
      console.log("Position:", after, "Drift:", drift);
      console.log(drift < 5 ? "✅ PASS" : "❌ FAIL");
    }, 2000);
  }, 600);
}, 500);
```

#### Test 4: List View - 5000px
```javascript
// Click List view button first
document.querySelector('button[aria-label="List view"]').click();

setTimeout(() => {
  document.querySelector('main').scrollTop = 5000;

  setTimeout(() => {
    console.log("Before:", document.querySelector('main').scrollTop);

    location.reload();

    setTimeout(() => {
      const after = document.querySelector('main').scrollTop;
      const drift = Math.abs(after - 5000);
      console.log("After:", after, "Drift:", drift);
      console.log(drift < 10 ? "✅ PASS" : "❌ FAIL");
    }, 2000);
  }, 600);
}, 1000);
```

#### Test 5: List View - 100px
```javascript
document.querySelector('button[aria-label="List view"]').click();

setTimeout(() => {
  location.reload();

  setTimeout(() => {
    document.querySelector('main').scrollTop = 100;

    setTimeout(() => {
      console.log("Before:", document.querySelector('main').scrollTop);

      location.reload();

      setTimeout(() => {
        const after = document.querySelector('main').scrollTop;
        const drift = Math.abs(after - 100);
        console.log("After:", after, "Drift:", drift);
        console.log(drift < 5 ? "✅ PASS" : "❌ FAIL");
      }, 2000);
    }, 600);
  }, 500);
}, 1000);
```

#### Test 6: Cross-view Switching
```javascript
const main = document.querySelector('main');

// Step 1: Scroll in grid view
main.scrollTop = 1000;

setTimeout(() => {
  console.log("Grid before switch:", main.scrollTop);

  // Step 2: Switch to list view
  document.querySelector('button[aria-label="List view"]').click();

  setTimeout(() => {
    main.scrollTop = 500;

    setTimeout(() => {
      console.log("List position:", main.scrollTop);

      // Step 3: Back to grid
      document.querySelector('button[aria-label="Grid view"]').click();

      setTimeout(() => {
        const gridPos = main.scrollTop;
        console.log("Grid restored to:", gridPos, "Drift:", Math.abs(gridPos - 1000));

        // Step 4: Back to list
        document.querySelector('button[aria-label="List view"]').click();

        setTimeout(() => {
          const listPos = main.scrollTop;
          console.log("List restored to:", listPos, "Drift:", Math.abs(listPos - 500));

          const pass = Math.abs(gridPos - 1000) < 20 && Math.abs(listPos - 500) < 20;
          console.log(pass ? "✅ PASS" : "❌ FAIL");
        }, 2000);
      }, 1000);
    }, 600);
  }, 1000);
}, 600);
```

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Development server running: `npm run dev`
- [ ] Browser open at http://localhost:3000/library
- [ ] DevTools open (F12)
- [ ] Console tab visible
- [ ] Local data cleared (optional, for clean state)

### Test Execution
- [ ] Test 1: Grid 50000px
- [ ] Test 2: Grid 250px
- [ ] Test 3: Grid 100px
- [ ] Test 4: List 5000px
- [ ] Test 5: List 100px
- [ ] Test 6: Cross-view switching

### Results Recording
- [ ] All tests documented
- [ ] Screenshot of pass/fail results
- [ ] Browser version recorded
- [ ] Any issues noted

### Sign-Off
- [ ] Results reviewed
- [ ] Issues escalated if any
- [ ] Tester signature
- [ ] Date

---

## Source Code Locations

### Implementation Files

**useLibraryPreferences Hook**
```
/home/user/Projects/veritable-games-main/frontend/src/hooks/useLibraryPreferences.ts
```
- Manages scroll position storage
- Debounces saves (500ms)
- Handles localStorage serialization

**Grid View Component**
```
/home/user/Projects/veritable-games-main/frontend/src/app/library/LibraryPageClient.tsx
Lines: 1017-1209 (VirtuosoGridView function)
  - Line 1078-1112: Scroll restoration logic
  - Line 1131: Offset calculation
  - Line 1163: fixedItemHeight = 252
```

**List View Component**
```
/home/user/Projects/veritable-games-main/frontend/src/app/library/LibraryPageClient.tsx
Lines: 1217-1549 (VirtuosoListView function)
  - Line 1281-1315: Scroll restoration logic
  - Line 1330: Offset calculation
  - Line 1451: fixedItemHeight = 36
```

---

## Reference Tables

### Offset Calculations - Grid View (252px rows)

| Position | Index | Offset | Verification | Passes |
|----------|-------|--------|--------------|--------|
| 0 | 0 | 0 | 0×252 + 0 = 0 | ✅ |
| 100 | 0 | 100 | 0×252 + 100 = 100 | ✅ |
| 250 | 0 | 250 | 0×252 + 250 = 250 | ✅ |
| 500 | 1 | 248 | 1×252 + 248 = 500 | ✅ |
| 50000 | 198 | 104 | 198×252 + 104 = 50000 | ✅ |

### Offset Calculations - List View (36px items)

| Position | Index | Offset | Verification | Passes |
|----------|-------|--------|--------------|--------|
| 0 | 0 | 0 | 0×36 + 0 = 0 | ✅ |
| 50 | 1 | 14 | 1×36 + 14 = 50 | ✅ |
| 100 | 2 | 28 | 2×36 + 28 = 100 | ✅ |
| 500 | 13 | 32 | 13×36 + 32 = 500 | ✅ |
| 5000 | 138 | 32 | 138×36 + 32 = 5000 | ✅ |

---

## Expected Results

### Pass Criteria
- **Large scroll (50000px):** Drift < 10px
- **Large scroll (5000px):** Drift < 10px
- **Sub-pixel (250px):** Drift < 5px
- **Sub-pixel (100px):** Drift < 5px
- **Cross-view:** Each view ±20px tolerance

### Fail Criteria
- Any drift exceeds stated tolerance
- Position not saved to localStorage
- Position not restored after reload
- Console shows errors

---

## Browser Testing Matrix

| Browser | Desktop | Mobile | Status |
|---------|---------|--------|--------|
| Chrome | ✅ | ✅ | Ready |
| Firefox | ✅ | ✅ | Ready |
| Safari | ✅ | ✅ | Ready |

---

## Troubleshooting Resources

### Issue: Position doesn't restore
**See:** SCROLL_PERSISTENCE_TESTING_GUIDE.md → Troubleshooting → "Position still drifts"

### Issue: Drift increases with larger positions
**See:** SCROLL_PERSISTENCE_TESTING_GUIDE.md → Troubleshooting → "Drift increases with larger scroll"

### Issue: Offset is always 0
**See:** SCROLL_PERSISTENCE_TESTING_GUIDE.md → Troubleshooting → "Offset always 0"

---

## Related Commits

- **01dc436f**: fix: eliminate virtual scroll jitter by fixing cache eviction
- **0f81313e**: fix: remove scroll restoration mechanisms causing position drift
- **5afcd770**: revert(library): Restore virtual scrolling with fixedItemHeight fix
- **3f1156a1**: debug: add verbose logging to trace empty documents issue
- **25acf342**: fix(library): correct API parameter names in usePaginatedDocuments

---

## Performance Baseline

- **localStorage writes:** 100+/sec → 1/sec (debounced)
- **Memory footprint:** ~100 bytes stored + <1KB runtime
- **CPU impact:** Negligible (O(1) offset calculation)
- **Visual impact:** None (improvement expected)

---

## Sign-Off Template

```markdown
# Test Completion Report

**Date:** [Date]
**Tester:** [Name]
**Browser:** [Browser & Version]
**Environment:** Development (http://localhost:3000)

## Test Results

| Test | Expected | Actual | Drift | Status |
|------|----------|--------|-------|--------|
| Grid 50000px | 50000 | _____ | _____ | □ PASS □ FAIL |
| Grid 250px | 250 | _____ | _____ | □ PASS □ FAIL |
| Grid 100px | 100 | _____ | _____ | □ PASS □ FAIL |
| List 5000px | 5000 | _____ | _____ | □ PASS □ FAIL |
| List 100px | 100 | _____ | _____ | □ PASS □ FAIL |
| Cross-view | 1000/500 | ___/___ | ___/___ | □ PASS □ FAIL |

## Overall Result
□ ALL TESTS PASS ✅
□ SOME TESTS FAIL ❌

## Issues Found
[List any issues]

## Notes
[Any additional observations]

**Tester Signature:** __________________ **Date:** __________
```

---

## Quick Reference

**What to Test:** Scroll position restoration after reload
**How Long:** 2-5 minutes per test case (6 total)
**Tools Needed:** Browser + DevTools Console
**Success Metric:** Drift < 10px (< 5px for sub-pixel)
**Documentation:** See SCROLL_PERSISTENCE_TESTING_GUIDE.md
**Status:** Ready for immediate testing

---

*Last Updated: December 26, 2025*
*All resources prepared and ready for QA testing*
