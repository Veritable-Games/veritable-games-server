/**
 * Workspace E2E Test Helper Functions
 *
 * Reusable utility functions for common workspace testing patterns:
 * - Drag and drop operations
 * - Mode state verification
 * - Selection manipulation
 * - Async state polling
 * - Visual regression helpers
 */

import { Page, expect } from '@playwright/test';
import { getNodeElement, waitForAutoSave } from '../fixtures/workspace-fixtures';

/**
 * Helper: Drag a node to a new position
 *
 * Simulates user dragging a node from its current position to a target position.
 */
export async function dragNode(
  page: Page,
  nodeId: string,
  targetPosition: { x: number; y: number },
  options: {
    steps?: number;
    smooth?: boolean;
  } = {}
) {
  const { steps = 10, smooth = true } = options;

  const node = getNodeElement(page, nodeId);
  const box = await node.boundingBox();

  if (!box) {
    throw new Error(`Node ${nodeId} not visible`);
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  // Move to center of node
  await page.mouse.move(startX, startY);

  // Mouse down
  await page.mouse.down();

  // Drag to target (with steps for smooth animation)
  if (smooth) {
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const x = startX + (targetPosition.x - startX) * progress;
      const y = startY + (targetPosition.y - startY) * progress;
      await page.mouse.move(x, y);
      await page.waitForTimeout(10); // Small delay for smooth drag
    }
  } else {
    await page.mouse.move(targetPosition.x, targetPosition.y);
  }

  // Mouse up
  await page.mouse.up();
}

/**
 * Helper: Drag a node by a delta offset
 */
export async function dragNodeByDelta(page: Page, nodeId: string, delta: { x: number; y: number }) {
  const node = getNodeElement(page, nodeId);
  const box = await node.boundingBox();

  if (!box) {
    throw new Error(`Node ${nodeId} not visible`);
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const targetX = startX + delta.x;
  const targetY = startY + delta.y;

  // Dispatch mouse events manually to ensure they're received
  await page.evaluate(
    ({ nodeId, startX, startY, targetX, targetY }) => {
      const element = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement;
      if (!element) throw new Error(`Node ${nodeId} not found`);

      // Dispatch mousedown
      element.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: startX,
          clientY: startY,
          button: 0,
        })
      );

      // Dispatch mousemove events in steps for smooth drag
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        const x = startX + (targetX - startX) * progress;
        const y = startY + (targetY - startY) * progress;

        document.dispatchEvent(
          new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
          })
        );
      }

      // Dispatch mouseup
      document.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: targetX,
          clientY: targetY,
          button: 0,
        })
      );
    },
    { nodeId, startX, startY, targetX, targetY }
  );

  // Wait a bit for the drag to process
  await page.waitForTimeout(200);
}

/**
 * Helper: Double-click a node to enter edit mode
 */
export async function doubleClickNode(page: Page, nodeId: string) {
  const node = getNodeElement(page, nodeId);
  await node.dblclick({ position: { x: 50, y: 50 } });
}

/**
 * Helper: Select multiple nodes (Shift+click pattern)
 */
export async function selectMultipleNodes(page: Page, nodeIds: string[]) {
  if (nodeIds.length === 0) return;

  // Click first node without modifier
  await getNodeElement(page, nodeIds[0]).click();

  // Shift+click remaining nodes
  for (let i = 1; i < nodeIds.length; i++) {
    await getNodeElement(page, nodeIds[i]).click({ modifiers: ['Shift'] });
  }
}

/**
 * Helper: Marquee select nodes by dragging a selection box
 */
export async function marqueeSelect(
  page: Page,
  startPosition: { x: number; y: number },
  endPosition: { x: number; y: number }
) {
  // Find canvas element
  const canvas = page.locator('[data-testid="workspace-canvas"]');

  // Get canvas bounding box to calculate absolute positions
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error('Workspace canvas not visible');
  }

  const startX = canvasBox.x + startPosition.x;
  const startY = canvasBox.y + startPosition.y;
  const endX = canvasBox.x + endPosition.x;
  const endY = canvasBox.y + endPosition.y;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.mouse.up();
}

/**
 * Helper: Wait for a condition with polling
 *
 * Useful for waiting for async state changes like auto-save, mode transitions, etc.
 */
export async function waitForCondition(
  page: Page,
  conditionFn: () => Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    errorMessage?: string;
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100, errorMessage = 'Condition not met' } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await conditionFn()) {
      return;
    }
    await page.waitForTimeout(interval);
  }

  throw new Error(`${errorMessage} (timeout after ${timeout}ms)`);
}

/**
 * Helper: Verify mode state in Zustand store
 *
 * Checks the global workspace state for mode-related flags.
 */
export async function verifyModeState(
  page: Page,
  expected: {
    isDragging?: boolean;
    isPanning?: boolean;
    editingNodeId?: string | null;
  }
) {
  const state = await page.evaluate(() => {
    const store = (window as any).__workspaceStore?.getState();
    return {
      isDragging: store?.isDragging,
      isPanning: store?.isPanning,
      editingNodeId: store?.editingNodeId,
    };
  });

  if (expected.isDragging !== undefined) {
    expect(state.isDragging).toBe(expected.isDragging);
  }

  if (expected.isPanning !== undefined) {
    expect(state.isPanning).toBe(expected.isPanning);
  }

  if (expected.editingNodeId !== undefined) {
    expect(state.editingNodeId).toBe(expected.editingNodeId);
  }
}

/**
 * Helper: Verify node is selected (has selection outline)
 */
export async function verifyNodeSelected(page: Page, nodeId: string) {
  const selectedNodeIds = await page.evaluate(() => {
    const store = (window as any).__workspaceStore?.getState();
    return Array.from(store?.selectedNodeIds || []);
  });

  expect(selectedNodeIds).toContain(nodeId);
}

/**
 * Helper: Verify node is NOT selected
 */
export async function verifyNodeNotSelected(page: Page, nodeId: string) {
  const selectedNodeIds = await page.evaluate(() => {
    const store = (window as any).__workspaceStore?.getState();
    return Array.from(store?.selectedNodeIds || []);
  });

  expect(selectedNodeIds).not.toContain(nodeId);
}

/**
 * Helper: Check if editor is active (contenteditable visible)
 * Waits up to 5 seconds for the editor to appear (handles lazy-loading and Tiptap initialization)
 */
export async function isEditorActive(page: Page): Promise<boolean> {
  const editor = page.locator('[contenteditable="true"]');
  try {
    await editor.waitFor({ state: 'visible', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper: Type text in active editor
 * Uses keyboard simulation for Tiptap compatibility (fill() doesn't trigger onChange properly)
 */
export async function typeInEditor(page: Page, text: string) {
  const editor = page.locator('[contenteditable="true"]');
  await editor.waitFor({ state: 'visible', timeout: 5000 });

  // Clear existing content first (Ctrl+A, then type)
  await editor.click();
  await page.keyboard.press('Control+A'); // Select all
  await page.keyboard.type(text); // Type new content (replaces selection)

  // Wait a bit for React to process state updates from typing
  // This ensures the content state is synced before exiting edit mode
  await page.waitForTimeout(200);
}

/**
 * Helper: Exit edit mode (blur the contenteditable element directly)
 * More reliable than clicking (which might create a node) or pressing Escape (which Tiptap might block)
 */
export async function exitEditMode(page: Page) {
  // Directly blur the contenteditable editor element
  await page.evaluate(() => {
    const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;
    if (editor) {
      editor.blur();
    }
  });
  await page.waitForTimeout(200); // Give React time to process blur event
}

/**
 * Helper: Resize node by dragging corner handle
 * Uses Playwright's mouse API for proper event timing
 */
export async function resizeNode(
  page: Page,
  nodeId: string,
  corner: 'nw' | 'ne' | 'sw' | 'se',
  delta: { x: number; y: number }
) {
  const node = getNodeElement(page, nodeId);

  // Find resize handle
  const handle = node.locator(`[data-resize-handle="${corner}"]`);
  const handleBox = await handle.boundingBox();

  if (!handleBox) {
    throw new Error(`Resize handle ${corner} not found for node ${nodeId}`);
  }

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  // Use Playwright's mouse API for proper event sequencing
  // Move to handle center
  await page.mouse.move(startX, startY);

  // Mouse down on handle (triggers React event handler which adds document listeners)
  await page.mouse.down();

  // Wait a bit for React to process the event and attach listeners
  await page.waitForTimeout(100);

  // Drag to target position (mousemove events on document)
  await page.mouse.move(startX + delta.x, startY + delta.y, { steps: 10 });

  // Wait a tiny bit for the last mousemove to process
  await page.waitForTimeout(50);

  // Mouse up
  await page.mouse.up();

  // Wait for save to complete
  await waitForAutoSave(page);
}

/**
 * Helper: Get viewport transform (pan and zoom)
 */
export async function getViewportTransform(page: Page) {
  return await page.evaluate(() => {
    const store = (window as any).__workspaceStore?.getState();
    return {
      offsetX: store?.viewport?.offsetX || 0,
      offsetY: store?.viewport?.offsetY || 0,
      scale: store?.viewport?.scale || 1,
    };
  });
}

/**
 * Helper: Pan viewport by delta
 */
export async function panViewport(page: Page, delta: { x: number; y: number }) {
  const canvas = page.locator('[data-testid="workspace-canvas"]');
  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error('Canvas not visible');
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  // Hold Space to enable pan mode
  await page.keyboard.down('Space');

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + delta.x, startY + delta.y, { steps: 10 });
  await page.mouse.up();

  await page.keyboard.up('Space');
}

/**
 * Helper: Zoom viewport
 */
export async function zoomViewport(page: Page, zoomFactor: number) {
  const canvas = page.locator('[data-testid="workspace-canvas"]');

  // Focus canvas first
  await canvas.click({ position: { x: 100, y: 100 } });

  // Ctrl+Wheel for zoom (positive = zoom in, negative = zoom out)
  const delta = zoomFactor > 0 ? -100 : 100;
  await page.mouse.wheel(0, delta);
}

/**
 * Helper: Wait for network idle (useful after batch operations)
 */
export async function waitForNetworkIdle(page: Page, timeout: number = 2000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Helper: Get all node IDs currently visible in viewport
 */
export async function getVisibleNodeIds(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const nodes = document.querySelectorAll('[data-node-id]');
    return Array.from(nodes).map(node => node.getAttribute('data-node-id')!);
  });
}

/**
 * Helper: Verify no console errors
 */
export async function verifyNoConsoleErrors(page: Page) {
  const errors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    errors.push(err.message);
  });

  return errors;
}

/**
 * Helper: Take screenshot of node (for visual regression)
 */
export async function screenshotNode(page: Page, nodeId: string, filename: string) {
  const node = getNodeElement(page, nodeId);
  await node.screenshot({ path: filename });
}
