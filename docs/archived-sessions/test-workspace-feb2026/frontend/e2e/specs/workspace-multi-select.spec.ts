/**
 * E2E Tests - Workspace Multi-Select Operations
 *
 * Tests selection and group operations:
 * - Single node selection
 * - Multi-select via Shift+click
 * - Marquee selection (drag box)
 * - Select all (Ctrl+A)
 * - Group drag (move all selected nodes together)
 * - Mixed locked/unlocked selection
 * - Alignment tools with multi-select
 */

import { test, expect } from '@playwright/test';
import {
  loginAsDeveloper,
  createAndOpenWorkspace,
  createNode,
  getNodeElement,
  getNodeFromDatabase,
  verifyNodePosition,
  waitForAutoSave,
  cleanupWorkspace,
  lockNode,
} from '../fixtures/workspace-fixtures';
import {
  selectMultipleNodes,
  marqueeSelect,
  verifyNodeSelected,
  verifyNodeNotSelected,
  dragNodeByDelta,
} from '../helpers/workspace-helpers';

test.describe('Workspace Multi-Select Operations', () => {
  let workspaceId: string;

  test.beforeEach(async ({ page }) => {
    await loginAsDeveloper(page);
    workspaceId = await createAndOpenWorkspace(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupWorkspace(page, workspaceId);
  });

  test.describe('Single Selection', () => {
    test('should select node on click', async ({ page }) => {
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Click Me');
      await page.waitForTimeout(500);

      // Click node
      await getNodeElement(page, nodeId).click();
      await page.waitForTimeout(200);

      // Verify selected
      await verifyNodeSelected(page, nodeId);

      // Verify visual feedback (selection outline)
      const node = getNodeElement(page, nodeId);
      const hasSelectionClass = await node.evaluate(
        el => el.classList.contains('selected') || el.classList.contains('ring-2')
      );
      expect(hasSelectionClass).toBeTruthy();
    });

    test('should deselect when clicking canvas', async ({ page }) => {
      const nodeId = await createNode(
        page,
        workspaceId,
        { x: 200, y: 200 },
        'Select Then Deselect'
      );
      await page.waitForTimeout(500);

      // Select node
      await getNodeElement(page, nodeId).click();
      await page.waitForTimeout(200);
      await verifyNodeSelected(page, nodeId);

      // Click empty canvas area
      const canvas = page.locator('[data-testid="workspace-canvas"]');
      await canvas.click({ position: { x: 500, y: 500 } });
      await page.waitForTimeout(200);

      // Verify deselected
      await verifyNodeNotSelected(page, nodeId);
    });

    test('should replace selection when clicking different node', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Node 1');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'Node 2');
      await page.waitForTimeout(500);

      // Select node 1
      await getNodeElement(page, node1).click();
      await page.waitForTimeout(200);
      await verifyNodeSelected(page, node1);

      // Click node 2 (without modifier)
      await getNodeElement(page, node2).click();
      await page.waitForTimeout(200);

      // Node 1 should be deselected, node 2 selected
      await verifyNodeNotSelected(page, node1);
      await verifyNodeSelected(page, node2);
    });
  });

  test.describe('Multi-Select via Shift+Click', () => {
    test('should add nodes to selection with Shift+click', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Node 1');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'Node 2');
      const node3 = await createNode(page, workspaceId, { x: 500, y: 100 }, 'Node 3');
      await page.waitForTimeout(500);

      // Select all three via Shift+click
      await selectMultipleNodes(page, [node1, node2, node3]);
      await page.waitForTimeout(200);

      // Verify all selected
      await verifyNodeSelected(page, node1);
      await verifyNodeSelected(page, node2);
      await verifyNodeSelected(page, node3);

      // Verify selection count in store
      const selectionCount = await page.evaluate(() => {
        const store = (window as any).__workspaceStore?.getState();
        return store?.selectedNodeIds?.size || 0;
      });
      expect(selectionCount).toBe(3);
    });

    test('should toggle selection with Shift+click', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Node 1');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'Node 2');
      await page.waitForTimeout(500);

      // Select both
      await selectMultipleNodes(page, [node1, node2]);
      await page.waitForTimeout(200);

      // Shift+click node2 again (should deselect it)
      await getNodeElement(page, node2).click({ modifiers: ['Shift'] });
      await page.waitForTimeout(200);

      // Only node1 should be selected
      await verifyNodeSelected(page, node1);
      await verifyNodeNotSelected(page, node2);
    });
  });

  test.describe('Marquee Selection (Drag Box)', () => {
    test('should select multiple nodes with marquee selection', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 150, y: 150 }, 'Node 1');
      const node2 = await createNode(page, workspaceId, { x: 250, y: 150 }, 'Node 2');
      const node3 = await createNode(page, workspaceId, { x: 150, y: 250 }, 'Node 3');
      const node4 = await createNode(page, workspaceId, { x: 500, y: 500 }, 'Outside');
      await page.waitForTimeout(500);

      // Drag selection box from (100, 100) to (300, 300)
      await marqueeSelect(page, { x: 100, y: 100 }, { x: 300, y: 300 });
      await page.waitForTimeout(200);

      // Nodes 1, 2, 3 should be selected
      await verifyNodeSelected(page, node1);
      await verifyNodeSelected(page, node2);
      await verifyNodeSelected(page, node3);

      // Node 4 (outside box) should NOT be selected
      await verifyNodeNotSelected(page, node4);
    });

    test('should show marquee box during drag', async ({ page }) => {
      await page.waitForTimeout(500);

      // Start marquee drag
      const canvas = page.locator('[data-testid="workspace-canvas"]');
      const box = await canvas.boundingBox();

      await page.mouse.move(box!.x + 100, box!.y + 100);
      await page.mouse.down();
      await page.mouse.move(box!.x + 300, box!.y + 300, { steps: 5 });

      // Check if marquee box is visible
      const marqueeVisible = await page.evaluate(() => {
        const marquee = document.querySelector('[data-testid="marquee-box"]');
        return marquee !== null;
      });

      expect(marqueeVisible).toBeTruthy();

      await page.mouse.up();
    });
  });

  test.describe('Select All (Ctrl+A)', () => {
    test('should select all nodes with Ctrl+A', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Node 1');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'Node 2');
      const node3 = await createNode(page, workspaceId, { x: 500, y: 100 }, 'Node 3');
      await page.waitForTimeout(500);

      // Press Ctrl+A
      await page.keyboard.press('Control+a');
      await page.waitForTimeout(200);

      // All nodes should be selected
      await verifyNodeSelected(page, node1);
      await verifyNodeSelected(page, node2);
      await verifyNodeSelected(page, node3);

      const selectionCount = await page.evaluate(() => {
        const store = (window as any).__workspaceStore?.getState();
        return store?.selectedNodeIds?.size || 0;
      });
      expect(selectionCount).toBe(3);
    });
  });

  test.describe('Group Drag', () => {
    test('should move all selected nodes together', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Node 1');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'Node 2');
      const node3 = await createNode(page, workspaceId, { x: 500, y: 100 }, 'Node 3');
      await page.waitForTimeout(500);

      // Select all three
      await selectMultipleNodes(page, [node1, node2, node3]);
      await page.waitForTimeout(200);

      // Drag node1 (should move all selected nodes)
      await dragNodeByDelta(page, node1, { x: 0, y: 100 });
      await waitForAutoSave(page);

      // Verify all nodes moved by same delta
      await verifyNodePosition(page, node1, { x: 100, y: 200 }, 10);
      await verifyNodePosition(page, node2, { x: 300, y: 200 }, 10);
      await verifyNodePosition(page, node3, { x: 500, y: 200 }, 10);

      // Verify relative positions maintained
      const db1 = await getNodeFromDatabase(page, node1);
      const db2 = await getNodeFromDatabase(page, node2);
      const db3 = await getNodeFromDatabase(page, node3);

      expect(db2.position.x - db1.position.x).toBe(200); // Original spacing
      expect(db3.position.x - db2.position.x).toBe(200);
    });

    test('should maintain selection after group drag', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Node 1');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'Node 2');
      await page.waitForTimeout(500);

      await selectMultipleNodes(page, [node1, node2]);
      await page.waitForTimeout(200);

      await dragNodeByDelta(page, node1, { x: 50, y: 50 });
      await page.waitForTimeout(200);

      // Both should still be selected
      await verifyNodeSelected(page, node1);
      await verifyNodeSelected(page, node2);
    });
  });

  test.describe('Mixed Locked/Unlocked Selection', () => {
    test('should skip locked nodes during group drag', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Unlocked 1');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'Locked');
      const node3 = await createNode(page, workspaceId, { x: 500, y: 100 }, 'Unlocked 2');
      await page.waitForTimeout(500);

      // Lock node2
      await lockNode(page, node2);

      // Select all three
      await selectMultipleNodes(page, [node1, node2, node3]);
      await page.waitForTimeout(200);

      // Drag (should only move unlocked nodes)
      await dragNodeByDelta(page, node1, { x: 0, y: 100 });
      await waitForAutoSave(page);

      // Unlocked nodes moved
      await verifyNodePosition(page, node1, { x: 100, y: 200 }, 10);
      await verifyNodePosition(page, node3, { x: 500, y: 200 }, 10);

      // Locked node stayed in place
      await verifyNodePosition(page, node2, { x: 300, y: 100 }, 10);
    });

    test('should allow selecting locked nodes but not dragging them', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Locked');
      await page.waitForTimeout(500);

      await lockNode(page, node1);

      // Should be able to select
      await getNodeElement(page, node1).click();
      await page.waitForTimeout(200);
      await verifyNodeSelected(page, node1);

      // Get initial position
      const initialPos = await getNodeFromDatabase(page, node1);

      // Try to drag (should be blocked)
      await dragNodeByDelta(page, node1, { x: 100, y: 100 });
      await waitForAutoSave(page);

      // Position should not change
      await verifyNodePosition(page, node1, initialPos.position, 5);
    });
  });

  test.describe('Selection Persistence', () => {
    test('should clear selection on page refresh', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Node 1');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'Node 2');
      await page.waitForTimeout(500);

      // Select both
      await selectMultipleNodes(page, [node1, node2]);
      await page.waitForTimeout(200);

      await verifyNodeSelected(page, node1);
      await verifyNodeSelected(page, node2);

      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Selection should be cleared (local state, not persisted)
      const selectionCount = await page.evaluate(() => {
        const store = (window as any).__workspaceStore?.getState();
        return store?.selectedNodeIds?.size || 0;
      });
      expect(selectionCount).toBe(0);
    });
  });
});
