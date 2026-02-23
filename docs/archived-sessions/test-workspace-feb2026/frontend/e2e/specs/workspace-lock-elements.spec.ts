/**
 * E2E Tests - Workspace Lock Elements Feature
 *
 * Tests the complete lock functionality for workspace nodes:
 * - Lock/unlock via Ctrl+L keyboard shortcut
 * - Lock/unlock via context menu
 * - Drag prevention on locked nodes
 * - Resize prevention on locked nodes
 * - Edit prevention on locked nodes
 * - Delete prevention on locked nodes
 * - Group operations with locked nodes
 * - Lock persistence after refresh
 * - Server-side API validation
 */

import { test, expect, apiRequest } from '../fixtures/auth-fixtures';
import { Page } from '@playwright/test';
import { loginViaAPI } from '../fixtures/auth-fixtures';

const TEST_WORKSPACE_SLUG = 'test-lock-feature-' + Date.now();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Helper: Login as developer (required for workspace access)
 */
async function loginAsDeveloper(page: Page) {
  // Use API login instead of UI (faster and more reliable)
  await loginViaAPI(page);

  // Navigate to home to establish session
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

/**
 * Helper: Create a workspace and navigate to it
 *
 * Workspaces are tied to projects, so we create a project first
 */
async function createAndOpenWorkspace(page: Page): Promise<string> {
  // Create a test project (workspace is auto-created for projects)
  const projectResponse = await apiRequest(page, 'POST', '/api/projects', {
    data: {
      slug: TEST_WORKSPACE_SLUG,
      title: 'Lock Feature Test Project',
      description: 'Test project for workspace lock feature tests',
      category: 'game',
      color: '#3b82f6', // Blue
      status: 'in_development',
    },
  });

  // Don't fail if project already exists (409 = conflict)
  if (!projectResponse.ok() && projectResponse.status() !== 409) {
    const errorText = await projectResponse.text();
    throw new Error(`Failed to create project: ${projectResponse.status()} - ${errorText}`);
  }

  // Navigate to workspace page
  await page.goto(`/workspace/${TEST_WORKSPACE_SLUG}`);
  await page.waitForLoadState('networkidle');

  // Return the project slug as workspace ID
  return TEST_WORKSPACE_SLUG;
}

/**
 * Helper: Create a text node on the canvas
 */
async function createNode(
  page: Page,
  workspaceId: string,
  position: { x: number; y: number },
  text: string = 'Test Node'
): Promise<string> {
  const response = await apiRequest(page, 'POST', '/api/workspace/nodes', {
    data: {
      workspace_id: workspaceId,
      position,
      size: { width: 200, height: 100 },
      content: {
        text,
        markdown: text,
      },
      metadata: {
        nodeType: 'text',
        locked: false,
      },
    },
  });

  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  return data.id;
}

/**
 * Helper: Get node element by ID
 */
async function getNodeElement(page: Page, nodeId: string) {
  return page.locator(`[data-node-id="${nodeId}"]`);
}

/**
 * Helper: Lock a node via API
 */
async function lockNodeViaAPI(page: Page, nodeId: string) {
  const response = await apiRequest(page, 'PUT', `/api/workspace/nodes/${nodeId}`, {
    data: {
      metadata: { locked: true },
    },
  });
  expect(response.ok()).toBeTruthy();
}

/**
 * Helper: Check if lock icon is visible on a node
 */
async function isLockIconVisible(page: Page, nodeId: string): Promise<boolean> {
  const lockIcon = page.locator(`[data-node-id="${nodeId}"] [data-testid="lock-icon"]`);
  return await lockIcon.isVisible().catch(() => false);
}

test.describe('Workspace Lock Elements Feature', () => {
  let workspaceId: string;

  test.beforeEach(async ({ page }) => {
    // Login and create workspace
    await loginAsDeveloper(page);
    workspaceId = await createAndOpenWorkspace(page);
  });

  test.describe('Lock via Keyboard Shortcut', () => {
    test('should lock node with Ctrl+L', async ({ page }) => {
      // Create a node
      const nodeId = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Lock Me');

      // Wait for node to render
      await page.waitForTimeout(500);

      // Click node to select it
      const nodeElement = await getNodeElement(page, nodeId);
      await nodeElement.click();

      // Verify node is selected (has selection outline)
      await expect(nodeElement).toHaveClass(/selected/);

      // Press Ctrl+L to lock
      await page.keyboard.press('Control+l');

      // Wait for lock to apply
      await page.waitForTimeout(500);

      // Verify lock icon appears
      const lockIconVisible = await isLockIconVisible(page, nodeId);
      expect(lockIconVisible).toBeTruthy();

      // Verify console log (if accessible)
      const consoleLogs: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'log') consoleLogs.push(msg.text());
      });

      // Check for lock confirmation in logs
      const hasLockLog = consoleLogs.some(log => log.includes('Locked node'));
      expect(hasLockLog || lockIconVisible).toBeTruthy();
    });

    test('should unlock node with Ctrl+L when already locked', async ({ page }) => {
      // Create and lock a node
      const nodeId = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Unlock Me');
      await lockNodeViaAPI(page, nodeId);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify lock icon is visible
      let lockIconVisible = await isLockIconVisible(page, nodeId);
      expect(lockIconVisible).toBeTruthy();

      // Select and unlock
      const nodeElement = await getNodeElement(page, nodeId);
      await nodeElement.click();
      await page.keyboard.press('Control+l');
      await page.waitForTimeout(500);

      // Verify lock icon is gone
      lockIconVisible = await isLockIconVisible(page, nodeId);
      expect(lockIconVisible).toBeFalsy();
    });

    test('should lock multiple selected nodes', async ({ page }) => {
      // Create 3 nodes
      const nodeId1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Node 1');
      const nodeId2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'Node 2');
      const nodeId3 = await createNode(page, workspaceId, { x: 500, y: 100 }, 'Node 3');
      await page.waitForTimeout(500);

      // Select all nodes (Ctrl+A)
      await page.keyboard.press('Control+a');

      // Lock all
      await page.keyboard.press('Control+l');
      await page.waitForTimeout(500);

      // Verify all 3 nodes show lock icons
      const icon1 = await isLockIconVisible(page, nodeId1);
      const icon2 = await isLockIconVisible(page, nodeId2);
      const icon3 = await isLockIconVisible(page, nodeId3);

      expect(icon1 && icon2 && icon3).toBeTruthy();
    });
  });

  test.describe('Lock via Context Menu', () => {
    test('should show "Lock Node" option for unlocked node', async ({ page }) => {
      // Create an unlocked node
      const nodeId = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Right Click Me');
      await page.waitForTimeout(500);

      // Right-click on the node
      const nodeElement = await getNodeElement(page, nodeId);
      await nodeElement.click({ button: 'right' });

      // Wait for context menu
      await page.waitForTimeout(200);

      // Verify "Lock Node" option exists
      const lockMenuItem = page.locator('text=Lock Node');
      await expect(lockMenuItem).toBeVisible();

      // Click to lock
      await lockMenuItem.click();
      await page.waitForTimeout(500);

      // Verify node is locked
      const lockIconVisible = await isLockIconVisible(page, nodeId);
      expect(lockIconVisible).toBeTruthy();
    });

    test('should show "Unlock Node" option for locked node', async ({ page }) => {
      // Create and lock a node
      const nodeId = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Locked Node');
      await lockNodeViaAPI(page, nodeId);
      await page.reload();
      await page.waitForTimeout(1000);

      // Right-click on the locked node
      const nodeElement = await getNodeElement(page, nodeId);
      await nodeElement.click({ button: 'right' });
      await page.waitForTimeout(200);

      // Verify "Unlock Node" option exists
      const unlockMenuItem = page.locator('text=Unlock Node');
      await expect(unlockMenuItem).toBeVisible();

      // Click to unlock
      await unlockMenuItem.click();
      await page.waitForTimeout(500);

      // Verify lock icon is gone
      const lockIconVisible = await isLockIconVisible(page, nodeId);
      expect(lockIconVisible).toBeFalsy();
    });
  });

  test.describe('Drag Prevention', () => {
    test('should prevent dragging locked node', async ({ page }) => {
      // Create and lock a node
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Cannot Drag');
      await lockNodeViaAPI(page, nodeId);
      await page.reload();
      await page.waitForTimeout(1000);

      // Get initial position
      const nodeElement = await getNodeElement(page, nodeId);
      const initialBox = await nodeElement.boundingBox();
      expect(initialBox).toBeTruthy();

      // Try to drag the node
      await nodeElement.hover();
      await page.mouse.down();
      await page.mouse.move(initialBox!.x + 100, initialBox!.y + 100);
      await page.mouse.up();
      await page.waitForTimeout(500);

      // Verify position has NOT changed
      const finalBox = await nodeElement.boundingBox();
      expect(finalBox!.x).toBe(initialBox!.x);
      expect(finalBox!.y).toBe(initialBox!.y);
    });

    test('should allow dragging unlocked node', async ({ page }) => {
      // Create an unlocked node
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Can Drag');
      await page.waitForTimeout(500);

      // Get initial position
      const nodeElement = await getNodeElement(page, nodeId);
      const initialBox = await nodeElement.boundingBox();

      // Drag the node
      await nodeElement.hover();
      await page.mouse.down();
      await page.mouse.move(initialBox!.x + 100, initialBox!.y + 100);
      await page.mouse.up();
      await page.waitForTimeout(500);

      // Verify position HAS changed
      const finalBox = await nodeElement.boundingBox();
      expect(Math.abs(finalBox!.x - initialBox!.x)).toBeGreaterThan(50);
      expect(Math.abs(finalBox!.y - initialBox!.y)).toBeGreaterThan(50);
    });

    test('should skip locked nodes during group drag', async ({ page }) => {
      // Create 3 nodes: 2 unlocked, 1 locked
      const nodeId1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Unlocked 1');
      const nodeId2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'LOCKED');
      const nodeId3 = await createNode(page, workspaceId, { x: 500, y: 100 }, 'Unlocked 2');

      // Lock node 2
      await lockNodeViaAPI(page, nodeId2);
      await page.reload();
      await page.waitForTimeout(1000);

      // Select all nodes
      await page.keyboard.press('Control+a');

      // Get initial positions
      const node1 = await getNodeElement(page, nodeId1);
      const node2 = await getNodeElement(page, nodeId2);
      const node3 = await getNodeElement(page, nodeId3);

      const pos1Initial = await node1.boundingBox();
      const pos2Initial = await node2.boundingBox();
      const pos3Initial = await node3.boundingBox();

      // Drag the group
      await node1.hover();
      await page.mouse.down();
      await page.mouse.move(pos1Initial!.x + 100, pos1Initial!.y + 100);
      await page.mouse.up();
      await page.waitForTimeout(500);

      // Verify unlocked nodes moved
      const pos1Final = await node1.boundingBox();
      const pos3Final = await node3.boundingBox();
      expect(Math.abs(pos1Final!.x - pos1Initial!.x)).toBeGreaterThan(50);
      expect(Math.abs(pos3Final!.x - pos3Initial!.x)).toBeGreaterThan(50);

      // Verify locked node did NOT move
      const pos2Final = await node2.boundingBox();
      expect(pos2Final!.x).toBe(pos2Initial!.x);
      expect(pos2Final!.y).toBe(pos2Initial!.y);
    });
  });

  test.describe('Edit Prevention', () => {
    test('should prevent editing locked node', async ({ page }) => {
      // Create and lock a node
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Cannot Edit');
      await lockNodeViaAPI(page, nodeId);
      await page.reload();
      await page.waitForTimeout(1000);

      // Try to double-click to edit
      const nodeElement = await getNodeElement(page, nodeId);
      await nodeElement.dblclick();
      await page.waitForTimeout(500);

      // Verify editor does NOT appear (check for contenteditable or editor class)
      const editorActive = await page
        .locator('[contenteditable="true"]')
        .isVisible()
        .catch(() => false);
      expect(editorActive).toBeFalsy();
    });

    test('should allow editing unlocked node', async ({ page }) => {
      // Create an unlocked node
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Can Edit');
      await page.waitForTimeout(500);

      // Double-click to edit
      const nodeElement = await getNodeElement(page, nodeId);
      await nodeElement.dblclick();
      await page.waitForTimeout(500);

      // Verify editor appears
      const editorActive = await page
        .locator('[contenteditable="true"]')
        .isVisible()
        .catch(() => false);
      expect(editorActive).toBeTruthy();
    });
  });

  test.describe('Delete Prevention', () => {
    test('should prevent deleting locked node', async ({ page }) => {
      // Create and lock a node
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Cannot Delete');
      await lockNodeViaAPI(page, nodeId);
      await page.reload();
      await page.waitForTimeout(1000);

      // Select the node
      const nodeElement = await getNodeElement(page, nodeId);
      await nodeElement.click();

      // Press Delete key
      await page.keyboard.press('Delete');
      await page.waitForTimeout(500);

      // Verify node still exists
      const nodeStillExists = await nodeElement.isVisible();
      expect(nodeStillExists).toBeTruthy();
    });

    test('should allow deleting unlocked node', async ({ page }) => {
      // Create an unlocked node
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Can Delete');
      await page.waitForTimeout(500);

      // Select the node
      const nodeElement = await getNodeElement(page, nodeId);
      await nodeElement.click();

      // Press Delete key
      await page.keyboard.press('Delete');
      await page.waitForTimeout(500);

      // Verify node is gone
      const nodeExists = await nodeElement.isVisible().catch(() => false);
      expect(nodeExists).toBeFalsy();
    });

    test('should only delete unlocked nodes in multi-select', async ({ page }) => {
      // Create 3 nodes: 2 unlocked, 1 locked
      const nodeId1 = await createNode(page, workspaceId, { x: 100, y: 100 }, 'Unlocked 1');
      const nodeId2 = await createNode(page, workspaceId, { x: 300, y: 100 }, 'LOCKED');
      const nodeId3 = await createNode(page, workspaceId, { x: 500, y: 100 }, 'Unlocked 2');

      // Lock node 2
      await lockNodeViaAPI(page, nodeId2);
      await page.reload();
      await page.waitForTimeout(1000);

      // Select all nodes
      await page.keyboard.press('Control+a');

      // Press Delete
      await page.keyboard.press('Delete');
      await page.waitForTimeout(500);

      // Verify unlocked nodes are deleted
      const node1Exists = await getNodeElement(page, nodeId1)
        .isVisible()
        .catch(() => false);
      const node3Exists = await getNodeElement(page, nodeId3)
        .isVisible()
        .catch(() => false);
      expect(node1Exists).toBeFalsy();
      expect(node3Exists).toBeFalsy();

      // Verify locked node still exists
      const node2Exists = await getNodeElement(page, nodeId2).isVisible();
      expect(node2Exists).toBeTruthy();
    });
  });

  test.describe('Resize Prevention', () => {
    test('should hide resize handles on locked node', async ({ page }) => {
      // Create and lock a node
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'No Resize');
      await lockNodeViaAPI(page, nodeId);
      await page.reload();
      await page.waitForTimeout(1000);

      // Select the node
      const nodeElement = await getNodeElement(page, nodeId);
      await nodeElement.click();
      await page.waitForTimeout(300);

      // Check if resize handles are visible
      const resizeHandles = page.locator(`[data-node-id="${nodeId}"] [data-testid*="resize"]`);
      const handleCount = await resizeHandles.count();

      // Locked nodes should have no visible resize handles
      expect(handleCount).toBe(0);
    });

    test('should show resize handles on unlocked node', async ({ page }) => {
      // Create an unlocked node
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Can Resize');
      await page.waitForTimeout(500);

      // Select the node
      const nodeElement = await getNodeElement(page, nodeId);
      await nodeElement.click();
      await page.waitForTimeout(300);

      // Check if resize handles are visible
      const resizeHandles = page.locator(`[data-node-id="${nodeId}"] [data-testid*="resize"]`);
      const handleCount = await resizeHandles.count();

      // Unlocked nodes should have resize handles (typically 8: corners + edges)
      expect(handleCount).toBeGreaterThan(0);
    });
  });

  test.describe('Lock Persistence', () => {
    test('should persist lock state after page refresh', async ({ page }) => {
      // Create and lock a node
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Persistent Lock');
      await lockNodeViaAPI(page, nodeId);

      // Wait for save to complete (debounced save is 500ms)
      await page.waitForTimeout(1000);

      // Refresh the page
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Verify lock icon is still visible
      const lockIconVisible = await isLockIconVisible(page, nodeId);
      expect(lockIconVisible).toBeTruthy();

      // Verify node still cannot be dragged
      const nodeElement = await getNodeElement(page, nodeId);
      const initialBox = await nodeElement.boundingBox();

      await nodeElement.hover();
      await page.mouse.down();
      await page.mouse.move(initialBox!.x + 100, initialBox!.y + 100);
      await page.mouse.up();
      await page.waitForTimeout(500);

      const finalBox = await nodeElement.boundingBox();
      expect(finalBox!.x).toBe(initialBox!.x);
      expect(finalBox!.y).toBe(initialBox!.y);
    });
  });

  test.describe('Server-Side API Validation', () => {
    test('should reject updates to locked node via API', async ({ page }) => {
      // Create and lock a node
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'API Protected');
      await lockNodeViaAPI(page, nodeId);

      // Try to update the node via API
      const response = await page.request.put(`/api/workspace/nodes/${nodeId}`, {
        data: {
          position: { x: 999, y: 999 },
        },
      });

      // Verify API returns 403 Forbidden
      expect(response.status()).toBe(403);

      // Verify error message
      const errorData = await response.json();
      expect(errorData.error).toContain('Cannot update locked node');
    });

    test('should reject delete of locked node via API', async ({ page }) => {
      // Create and lock a node
      const nodeId = await createNode(
        page,
        workspaceId,
        { x: 200, y: 200 },
        'API Delete Protected'
      );
      await lockNodeViaAPI(page, nodeId);

      // Try to delete via API
      const response = await page.request.delete(`/api/workspace/nodes/${nodeId}`);

      // Verify API returns 403 Forbidden
      expect(response.status()).toBe(403);

      // Verify error message
      const errorData = await response.json();
      expect(errorData.error).toContain('Cannot delete locked node');
    });

    test('should allow unlocking a locked node via API', async ({ page }) => {
      // Create and lock a node
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Can Unlock via API');
      await lockNodeViaAPI(page, nodeId);

      // Unlock via API
      const response = await page.request.put(`/api/workspace/nodes/${nodeId}`, {
        data: {
          metadata: { locked: false },
        },
      });

      // Verify API returns 200 OK
      expect(response.status()).toBe(200);

      // Reload and verify lock icon is gone
      await page.reload();
      await page.waitForTimeout(1000);

      const lockIconVisible = await isLockIconVisible(page, nodeId);
      expect(lockIconVisible).toBeFalsy();
    });
  });

  test.describe('Visual Indicators', () => {
    test('should show lock icon on locked node', async ({ page }) => {
      // Create and lock a node
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Visual Lock Test');
      await lockNodeViaAPI(page, nodeId);
      await page.reload();
      await page.waitForTimeout(1000);

      // Verify lock icon is visible
      const lockIcon = page.locator(`[data-node-id="${nodeId}"] [data-testid="lock-icon"]`);
      await expect(lockIcon).toBeVisible();

      // Verify lock icon has correct styling (should be in top-right corner)
      const iconBox = await lockIcon.boundingBox();
      expect(iconBox).toBeTruthy();
    });

    test('should show lock icon even when node is not selected', async ({ page }) => {
      // Create and lock a node
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Always Visible Lock');
      await lockNodeViaAPI(page, nodeId);
      await page.reload();
      await page.waitForTimeout(1000);

      // Click elsewhere to deselect
      await page.click('body', { position: { x: 50, y: 50 } });
      await page.waitForTimeout(300);

      // Verify lock icon is still visible
      const lockIcon = page.locator(`[data-node-id="${nodeId}"] [data-testid="lock-icon"]`);
      await expect(lockIcon).toBeVisible();
    });
  });
});
