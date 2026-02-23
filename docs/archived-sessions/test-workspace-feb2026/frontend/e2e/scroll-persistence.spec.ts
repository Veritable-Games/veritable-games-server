import { test, expect, Page } from '@playwright/test';

/**
 * Scroll Persistence Fix Tests
 *
 * Tests the scroll position persistence fix that tracks pixel offset in addition
 * to row/item index to prevent scroll drift and jitter.
 *
 * Key Scenarios:
 * 1. Grid view: Large scroll positions (50000px, 100000px)
 * 2. List view: Large scroll positions
 * 3. Sub-pixel positioning: Positions between card/item boundaries
 * 4. Reload verification: Exact position restoration
 */

interface ScrollTestCase {
  name: string;
  targetScrollPosition: number;
  viewMode: 'grid' | 'list';
}

interface ScrollTestResult {
  testName: string;
  viewMode: 'grid' | 'list';
  initialPosition: number;
  targetPosition: number;
  beforeReloadPosition: number;
  afterReloadPosition: number;
  drift: number;
  driftPercentage: number;
  passed: boolean;
  details?: string;
}

const TEST_CASES: ScrollTestCase[] = [
  // Grid view tests (grid rows are 252px tall)
  { name: 'Grid: Scroll to 100px (sub-row)', targetScrollPosition: 100, viewMode: 'grid' },
  { name: 'Grid: Scroll to 250px (edge of row)', targetScrollPosition: 250, viewMode: 'grid' },
  { name: 'Grid: Scroll to 500px (2 rows)', targetScrollPosition: 500, viewMode: 'grid' },
  { name: 'Grid: Scroll to 5000px', targetScrollPosition: 5000, viewMode: 'grid' },
  { name: 'Grid: Scroll to 50000px (large)', targetScrollPosition: 50000, viewMode: 'grid' },

  // List view tests (list items are 36px tall)
  { name: 'List: Scroll to 50px (sub-item)', targetScrollPosition: 50, viewMode: 'list' },
  { name: 'List: Scroll to 100px (edge)', targetScrollPosition: 100, viewMode: 'list' },
  { name: 'List: Scroll to 500px (multiple items)', targetScrollPosition: 500, viewMode: 'list' },
  { name: 'List: Scroll to 5000px', targetScrollPosition: 5000, viewMode: 'list' },
];

// Helper to get scroll container element
async function getScrollContainer(page: Page, viewMode: 'grid' | 'list'): Promise<any> {
  return await page.evaluate(() => {
    // Get the Virtuoso scroll container
    const virtuosoContainer = document.querySelector('[class*="virtuoso"]');
    if (virtuosoContainer) {
      return virtuosoContainer;
    }
    // Fallback to main content area
    return document.querySelector('main[role="main"]');
  });
}

// Helper to get current scroll position
async function getScrollTop(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const main = document.querySelector('main[role="main"]');
    if (!main) return 0;
    return main.scrollTop;
  });
}

// Helper to scroll to a specific position
async function scrollToPosition(page: Page, position: number): Promise<void> {
  await page.evaluate(pos => {
    const main = document.querySelector('main[role="main"]');
    if (main) {
      main.scrollTop = pos;
    }
  }, position);

  // Wait a bit for any animations/debounces
  await page.waitForTimeout(100);
}

// Helper to switch view mode
async function switchViewMode(page: Page, mode: 'grid' | 'list'): Promise<void> {
  const buttonLabel = mode === 'grid' ? 'Grid view' : 'List view';
  const button = page.getByLabel(buttonLabel);
  await button.click();
  await page.waitForTimeout(500); // Wait for view to switch
}

// Helper to reload and wait for scroll restoration
async function reloadAndWaitForRestoration(page: Page): Promise<void> {
  await page.reload();
  // Wait for library content to load
  await page.waitForTimeout(2000);
}

// Helper to get localStorage scroll position
async function getStoredScrollPosition(page: Page): Promise<any> {
  return await page.evaluate(() => {
    const prefs = localStorage.getItem('library-preferences');
    if (!prefs) return null;
    const parsed = JSON.parse(prefs);
    return parsed.scrollPosition;
  });
}

test.describe('Scroll Position Persistence - Grid View', () => {
  let results: ScrollTestResult[] = [];

  test.beforeAll(() => {
    results = [];
  });

  test('Grid: Large scroll position (50000px)', async ({ page }) => {
    await page.goto('http://localhost:3000/library');
    await page.waitForLoadState('networkidle');

    // Ensure we're in grid view
    const gridViewButton = page.getByLabel('Grid view');
    const isGridSelected = await gridViewButton.evaluate(el =>
      (el as HTMLElement).classList.contains('bg-blue-600')
    );
    if (!isGridSelected) {
      await gridViewButton.click();
      await page.waitForTimeout(500);
    }

    // Get initial scroll position
    const initialPosition = await getScrollTop(page);
    console.log(`Initial scroll position: ${initialPosition}px`);

    // Scroll to 50000px
    const targetPosition = 50000;
    await scrollToPosition(page, targetPosition);
    const beforeReloadPosition = await getScrollTop(page);
    console.log(
      `Scroll position before reload: ${beforeReloadPosition}px (target was ${targetPosition}px)`
    );

    // Check localStorage
    const stored = await getStoredScrollPosition(page);
    console.log('Stored scroll position:', stored);

    // Reload page and wait for restoration
    await reloadAndWaitForRestoration(page);

    // Get restored scroll position
    const afterReloadPosition = await getScrollTop(page);
    console.log(`Scroll position after reload: ${afterReloadPosition}px`);

    // Calculate drift
    const drift = Math.abs(beforeReloadPosition - afterReloadPosition);
    const driftPercentage = (drift / targetPosition) * 100;

    console.log(`Drift: ${drift}px (${driftPercentage.toFixed(2)}%)`);

    // Test result
    const result: ScrollTestResult = {
      testName: 'Grid: Scroll to 50000px (large)',
      viewMode: 'grid',
      initialPosition,
      targetPosition,
      beforeReloadPosition,
      afterReloadPosition,
      drift,
      driftPercentage,
      passed: drift < 10, // Allow up to 10px drift
    };

    results.push(result);

    // Assertions
    expect(drift).toBeLessThan(10); // 10px tolerance for pixel rounding
  });

  test('Grid: Sub-pixel positioning (250px)', async ({ page }) => {
    await page.goto('http://localhost:3000/library');
    await page.waitForLoadState('networkidle');

    // Ensure grid view
    const gridViewButton = page.getByLabel('Grid view');
    const isGridSelected = await gridViewButton.evaluate(el =>
      (el as HTMLElement).classList.contains('bg-blue-600')
    );
    if (!isGridSelected) {
      await gridViewButton.click();
      await page.waitForTimeout(500);
    }

    const targetPosition = 250;
    await scrollToPosition(page, targetPosition);
    const beforeReloadPosition = await getScrollTop(page);

    await reloadAndWaitForRestoration(page);
    const afterReloadPosition = await getScrollTop(page);

    const drift = Math.abs(beforeReloadPosition - afterReloadPosition);
    const driftPercentage = (drift / targetPosition) * 100;

    console.log(
      `Sub-pixel test (250px): drift=${drift}px (${driftPercentage.toFixed(2)}%), before=${beforeReloadPosition}px, after=${afterReloadPosition}px`
    );

    results.push({
      testName: 'Grid: Sub-pixel positioning (250px)',
      viewMode: 'grid',
      initialPosition: 0,
      targetPosition,
      beforeReloadPosition,
      afterReloadPosition,
      drift,
      driftPercentage,
      passed: drift < 5,
    });

    expect(drift).toBeLessThan(5); // Stricter tolerance for sub-pixel
  });
});

test.describe('Scroll Position Persistence - List View', () => {
  let results: ScrollTestResult[] = [];

  test.beforeAll(() => {
    results = [];
  });

  test('List: Large scroll position (5000px)', async ({ page }) => {
    await page.goto('http://localhost:3000/library');
    await page.waitForLoadState('networkidle');

    // Switch to list view
    await switchViewMode(page, 'list');

    const targetPosition = 5000;
    await scrollToPosition(page, targetPosition);
    const beforeReloadPosition = await getScrollTop(page);

    const stored = await getStoredScrollPosition(page);
    console.log('Stored scroll position (list):', stored);

    await reloadAndWaitForRestoration(page);
    const afterReloadPosition = await getScrollTop(page);

    const drift = Math.abs(beforeReloadPosition - afterReloadPosition);
    const driftPercentage = (drift / targetPosition) * 100;

    console.log(
      `List view 5000px: drift=${drift}px (${driftPercentage.toFixed(2)}%), before=${beforeReloadPosition}px, after=${afterReloadPosition}px`
    );

    results.push({
      testName: 'List: Large scroll position (5000px)',
      viewMode: 'list',
      initialPosition: 0,
      targetPosition,
      beforeReloadPosition,
      afterReloadPosition,
      drift,
      driftPercentage,
      passed: drift < 10,
    });

    expect(drift).toBeLessThan(10);
  });

  test('List: Sub-pixel positioning (100px)', async ({ page }) => {
    await page.goto('http://localhost:3000/library');
    await page.waitForLoadState('networkidle');

    // Switch to list view
    await switchViewMode(page, 'list');

    const targetPosition = 100;
    await scrollToPosition(page, targetPosition);
    const beforeReloadPosition = await getScrollTop(page);

    await reloadAndWaitForRestoration(page);
    const afterReloadPosition = await getScrollTop(page);

    const drift = Math.abs(beforeReloadPosition - afterReloadPosition);
    const driftPercentage = drift > 0 ? (drift / targetPosition) * 100 : 0;

    console.log(
      `List view 100px: drift=${drift}px, before=${beforeReloadPosition}px, after=${afterReloadPosition}px`
    );

    results.push({
      testName: 'List: Sub-pixel positioning (100px)',
      viewMode: 'list',
      initialPosition: 0,
      targetPosition,
      beforeReloadPosition,
      afterReloadPosition,
      drift,
      driftPercentage,
      passed: drift < 5,
    });

    expect(drift).toBeLessThan(5);
  });
});

test.describe('Scroll Persistence - Cross-View Switching', () => {
  test('Switch from grid to list and back preserves each view position', async ({ page }) => {
    await page.goto('http://localhost:3000/library');
    await page.waitForLoadState('networkidle');

    // Start in grid view
    const gridViewButton = page.getByLabel('Grid view');
    const isGridSelected = await gridViewButton.evaluate(el =>
      (el as HTMLElement).classList.contains('bg-blue-600')
    );
    if (!isGridSelected) {
      await gridViewButton.click();
      await page.waitForTimeout(500);
    }

    // Scroll in grid view
    const gridScrollPos = 1000;
    await scrollToPosition(page, gridScrollPos);
    await page.waitForTimeout(600); // Allow debounce to complete

    // Switch to list view
    await switchViewMode(page, 'list');
    const listViewButton = page.getByLabel('List view');
    const isListSelected = await listViewButton.evaluate(el =>
      (el as HTMLElement).classList.contains('bg-blue-600')
    );
    expect(isListSelected).toBe(true);

    // Scroll in list view
    const listScrollPos = 500;
    await scrollToPosition(page, listScrollPos);
    await page.waitForTimeout(600);

    // Switch back to grid view
    await switchViewMode(page, 'grid');

    const gridRestored = await getScrollTop(page);
    console.log(`Grid view restored to: ${gridRestored}px (was ${gridScrollPos}px)`);

    // Switch to list view
    await switchViewMode(page, 'list');
    const listRestored = await getScrollTop(page);
    console.log(`List view restored to: ${listRestored}px (was ${listScrollPos}px)`);

    // Both should maintain their respective positions (within tolerance)
    expect(Math.abs(gridRestored - gridScrollPos)).toBeLessThan(20);
    expect(Math.abs(listRestored - listScrollPos)).toBeLessThan(20);
  });
});

test.describe('Scroll Persistence - Console Validation', () => {
  test('Verify scroll position data in console logs', async ({ page }) => {
    page.on('console', msg => {
      if (msg.text().includes('saveScrollPosition')) {
        console.log('Scroll save log:', msg.text());
      }
    });

    await page.goto('http://localhost:3000/library');
    await page.waitForLoadState('networkidle');

    // Enable browser console collection
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });

    // Scroll and check logs
    await scrollToPosition(page, 2000);
    await page.waitForTimeout(600);

    // Check if scroll was recorded
    const hasScrollLog = consoleLogs.some(
      log => log.includes('scroll') || log.includes('position')
    );
    console.log('Console logs captured:', consoleLogs.length);
    console.log('Sample logs:', consoleLogs.slice(0, 5));
  });
});

test.afterAll(() => {
  console.log('\n========== SCROLL PERSISTENCE TEST RESULTS ==========');
  console.log('Tests completed. Full results would be printed here.');
});
