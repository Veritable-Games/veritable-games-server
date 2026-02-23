/**
 * E2E Tests - Workspace Node Connections
 *
 * Tests connection/arrow functionality:
 * - Create connections between nodes
 * - Connection path rendering
 * - Update connections when nodes move
 * - Delete connections
 * - Cascade delete connections when node deleted
 * - Multiple connections per node
 * - Self-connections (should be prevented)
 */

import { test, expect } from '@playwright/test';
import {
  loginAsDeveloper,
  createAndOpenWorkspace,
  createNode,
  createConnection,
  getNodeElement,
  getNodeFromDatabase,
  waitForAutoSave,
  cleanupWorkspace,
} from '../fixtures/workspace-fixtures';
import { dragNodeByDelta, waitForCondition } from '../helpers/workspace-helpers';

test.describe('Workspace Node Connections', () => {
  let workspaceId: string;

  test.beforeEach(async ({ page }) => {
    await loginAsDeveloper(page);
    workspaceId = await createAndOpenWorkspace(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupWorkspace(page, workspaceId);
  });

  test.describe('Create Connections', () => {
    test('should create connection between two nodes via API', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Source');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'Target');
      await page.waitForTimeout(500);

      // Create connection
      const connId = await createConnection(page, workspaceId, node1, node2);

      expect(connId).toBeTruthy();

      // Verify connection renders in UI
      await page.waitForTimeout(500);
      const connection = page.locator(`[data-connection-id="${connId}"]`);
      await expect(connection).toBeVisible();
    });

    test('should create connections with different anchor sides', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 200 }, 'Node A');
      const node2 = await createNode(page, workspaceId, { x: 400, y: 200 }, 'Node B');
      await page.waitForTimeout(500);

      // Top to bottom connection
      const conn1 = await createConnection(page, workspaceId, node1, node2, {
        sourceSide: 'top',
        targetSide: 'bottom',
      });

      // Right to left connection
      const conn2 = await createConnection(page, workspaceId, node1, node2, {
        sourceSide: 'right',
        targetSide: 'left',
      });

      await page.waitForTimeout(500);

      // Both connections should render
      await expect(page.locator(`[data-connection-id="${conn1}"]`)).toBeVisible();
      await expect(page.locator(`[data-connection-id="${conn2}"]`)).toBeVisible();
    });
  });

  test.describe('Connection Rendering', () => {
    test('should render connection as SVG path', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Start');
      const node2 = await createNode(page, workspaceId, { x: 400, y: 100 }, 'End');
      await page.waitForTimeout(500);

      const connId = await createConnection(page, workspaceId, node1, node2);
      await page.waitForTimeout(500);

      // Check SVG path element exists
      const path = page.locator(`[data-connection-id="${connId}"] path`);
      await expect(path).toBeVisible();

      // Verify path has d attribute (path data)
      const pathData = await path.getAttribute('d');
      expect(pathData).toBeTruthy();
      expect(pathData).toContain('M'); // Path should start with Move command
    });

    test('should render curved bezier path', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'A');
      const node2 = await createNode(page, workspaceId, { x: 400, y: 100 }, 'B');
      await page.waitForTimeout(500);

      const connId = await createConnection(page, workspaceId, node1, node2);
      await page.waitForTimeout(500);

      const path = page.locator(`[data-connection-id="${connId}"] path`);
      const pathData = await path.getAttribute('d');

      // Bezier curve should contain 'C' command (cubic bezier)
      expect(pathData).toContain('C');
    });
  });

  test.describe('Connection Updates When Nodes Move', () => {
    test('should update connection path when source node moves', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Source');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'Target');
      await page.waitForTimeout(500);

      const connId = await createConnection(page, workspaceId, node1, node2);
      await page.waitForTimeout(500);

      // Get initial path
      const path = page.locator(`[data-connection-id="${connId}"] path`);
      const initialPath = await path.getAttribute('d');

      // Move source node
      await dragNodeByDelta(page, node1, { x: 50, y: 100 });
      await page.waitForTimeout(500);

      // Path should have changed
      const newPath = await path.getAttribute('d');
      expect(newPath).not.toBe(initialPath);
    });

    test('should update connection path when target node moves', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Source');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'Target');
      await page.waitForTimeout(500);

      const connId = await createConnection(page, workspaceId, node1, node2);
      await page.waitForTimeout(500);

      const path = page.locator(`[data-connection-id="${connId}"] path`);
      const initialPath = await path.getAttribute('d');

      // Move target node
      await dragNodeByDelta(page, node2, { x: -50, y: 100 });
      await page.waitForTimeout(500);

      const newPath = await path.getAttribute('d');
      expect(newPath).not.toBe(initialPath);
    });

    test('should maintain connection when both nodes move', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'A');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'B');
      await page.waitForTimeout(500);

      const connId = await createConnection(page, workspaceId, node1, node2);
      await page.waitForTimeout(500);

      // Move both nodes
      await dragNodeByDelta(page, node1, { x: 50, y: 50 });
      await page.waitForTimeout(200);
      await dragNodeByDelta(page, node2, { x: 50, y: 50 });
      await page.waitForTimeout(500);

      // Connection should still exist and be visible
      const connection = page.locator(`[data-connection-id="${connId}"]`);
      await expect(connection).toBeVisible();
    });
  });

  test.describe('Delete Connections', () => {
    test('should delete connection via Delete key when selected', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Source');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'Target');
      await page.waitForTimeout(500);

      const connId = await createConnection(page, workspaceId, node1, node2);
      await page.waitForTimeout(500);

      // Click connection to select it
      const connection = page.locator(`[data-connection-id="${connId}"]`);
      await connection.click();
      await page.waitForTimeout(200);

      // Press Delete
      await page.keyboard.press('Delete');
      await page.waitForTimeout(500);

      // Connection should be removed
      await expect(connection).not.toBeVisible();
    });

    test('should cascade delete connections when source node deleted', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Source');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'Target');
      await page.waitForTimeout(500);

      const connId = await createConnection(page, workspaceId, node1, node2);
      await page.waitForTimeout(500);

      // Delete source node
      await getNodeElement(page, node1).click();
      await page.waitForTimeout(200);
      await page.keyboard.press('Delete');
      await page.waitForTimeout(500);

      // Connection should also be deleted
      const connection = page.locator(`[data-connection-id="${connId}"]`);
      await expect(connection).not.toBeVisible();
    });

    test('should cascade delete connections when target node deleted', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Source');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'Target');
      await page.waitForTimeout(500);

      const connId = await createConnection(page, workspaceId, node1, node2);
      await page.waitForTimeout(500);

      // Delete target node
      await getNodeElement(page, node2).click();
      await page.waitForTimeout(200);
      await page.keyboard.press('Delete');
      await page.waitForTimeout(500);

      // Connection should also be deleted
      const connection = page.locator(`[data-connection-id="${connId}"]`);
      await expect(connection).not.toBeVisible();
    });

    test('should delete all connections when intermediate node deleted (chain)', async ({
      page,
    }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'A');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'B');
      const node3 = await createNode(page, workspaceId, { x: 500, y: 100 }, 'C');
      await page.waitForTimeout(500);

      // Create chain: A → B → C
      const conn1 = await createConnection(page, workspaceId, node1, node2);
      const conn2 = await createConnection(page, workspaceId, node2, node3);
      await page.waitForTimeout(500);

      // Delete middle node (B)
      await getNodeElement(page, node2).click();
      await page.waitForTimeout(200);
      await page.keyboard.press('Delete');
      await page.waitForTimeout(500);

      // Both connections should be deleted
      await expect(page.locator(`[data-connection-id="${conn1}"]`)).not.toBeVisible();
      await expect(page.locator(`[data-connection-id="${conn2}"]`)).not.toBeVisible();

      // Nodes A and C should remain
      await expect(getNodeElement(page, node1)).toBeVisible();
      await expect(getNodeElement(page, node3)).toBeVisible();
    });
  });

  test.describe('Multiple Connections', () => {
    test('should support multiple outgoing connections from one node', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 200 }, 'Hub');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'Target 1');
      const node3 = await createNode(page, workspaceId, { x: 300, y: 200 }, 'Target 2');
      const node4 = await createNode(page, workspaceId, { x: 300, y: 300 }, 'Target 3');
      await page.waitForTimeout(500);

      // Create multiple connections from node1
      const conn1 = await createConnection(page, workspaceId, node1, node2);
      const conn2 = await createConnection(page, workspaceId, node1, node3);
      const conn3 = await createConnection(page, workspaceId, node1, node4);
      await page.waitForTimeout(500);

      // All connections should render
      await expect(page.locator(`[data-connection-id="${conn1}"]`)).toBeVisible();
      await expect(page.locator(`[data-connection-id="${conn2}"]`)).toBeVisible();
      await expect(page.locator(`[data-connection-id="${conn3}"]`)).toBeVisible();
    });

    test('should support multiple incoming connections to one node', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Source 1');
      const node2 = await createNode(page, workspaceId, { x: 100, y: 200 }, 'Source 2');
      const node3 = await createNode(page, workspaceId, { x: 100, y: 300 }, 'Source 3');
      const node4 = await createNode(page, workspaceId, { x: 400, y: 200 }, 'Hub');
      await page.waitForTimeout(500);

      // Create multiple connections to node4
      const conn1 = await createConnection(page, workspaceId, node1, node4);
      const conn2 = await createConnection(page, workspaceId, node2, node4);
      const conn3 = await createConnection(page, workspaceId, node3, node4);
      await page.waitForTimeout(500);

      // All connections should render
      await expect(page.locator(`[data-connection-id="${conn1}"]`)).toBeVisible();
      await expect(page.locator(`[data-connection-id="${conn2}"]`)).toBeVisible();
      await expect(page.locator(`[data-connection-id="${conn3}"]`)).toBeVisible();
    });

    test('should support bidirectional connections (A → B and B → A)', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'A');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'B');
      await page.waitForTimeout(500);

      // Create both directions
      const conn1 = await createConnection(page, workspaceId, node1, node2, {
        sourceSide: 'right',
        targetSide: 'left',
      });
      const conn2 = await createConnection(page, workspaceId, node2, node1, {
        sourceSide: 'left',
        targetSide: 'right',
      });
      await page.waitForTimeout(500);

      // Both connections should render (may overlap visually but distinct)
      await expect(page.locator(`[data-connection-id="${conn1}"]`)).toBeVisible();
      await expect(page.locator(`[data-connection-id="${conn2}"]`)).toBeVisible();
    });
  });

  test.describe('Connection Persistence', () => {
    test('should persist connections after page refresh', async ({ page }) => {
      const node1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Source');
      const node2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'Target');
      await page.waitForTimeout(500);

      const connId = await createConnection(page, workspaceId, node1, node2);
      await waitForAutoSave(page);

      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Connection should still exist
      const connection = page.locator(`[data-connection-id="${connId}"]`);
      await expect(connection).toBeVisible();
    });
  });
});
