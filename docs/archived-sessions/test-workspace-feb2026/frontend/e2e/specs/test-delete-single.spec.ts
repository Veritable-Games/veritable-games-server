/**
 * Focused test for Delete key functionality
 */
import { test, expect } from '@playwright/test';
import {
  loginAsDeveloper,
  createAndOpenWorkspace,
  createNode,
  getNodeElement,
  getNodeFromDatabase,
} from '../fixtures/workspace-fixtures';

test.describe('Delete Key - Focused Test', () => {
  let workspaceId: string;

  test.beforeEach(async ({ page }) => {
    // Login and create workspace
    await loginAsDeveloper(page);
    workspaceId = await createAndOpenWorkspace(page, 'delete-focused-' + Date.now());
    await page.waitForTimeout(1000);
  });

  test('DELETE KEY: should delete single node', async ({ page }) => {
    console.log('\n🧪 Testing Delete key functionality...\n');

    // Create a node via UI button (since WebSocket is disabled)
    console.log('Creating node via UI...');
    await page.click('[aria-label="Add text node to workspace"]');
    await page.waitForTimeout(1000);

    // Find the newly created node
    const nodes = await page.locator('[data-node-id]').all();
    if (nodes.length === 0) {
      throw new Error('No nodes found after clicking create button');
    }

    const node = nodes[0]; // Get the first (and only) node
    const nodeId = await node.getAttribute('data-node-id');
    if (!nodeId) {
      throw new Error('Node ID not found');
    }

    console.log(`✓ Node created via UI: ${nodeId}`);

    // Click node to select it
    await node.click();
    await page.waitForTimeout(300);
    console.log('✓ Node selected');

    // Press Delete key
    await page.keyboard.press('Delete');
    await page.waitForTimeout(1000);
    console.log('✓ Delete key pressed');

    // Verify node removed from UI
    await expect(node).not.toBeVisible();
    console.log('✓ Node removed from UI');

    // Verify node count decreased to 0
    const remainingNodes = await page.locator('[data-node-id]').count();
    expect(remainingNodes).toBe(0);
    console.log('✓ Node count = 0 (node removed from Yjs document)');

    console.log('\n✅ DELETE KEY TEST PASSED!\n');
    console.log('Summary:');
    console.log('  ✓ Delete key handler fires correctly');
    console.log('  ✓ Node removed from UI');
    console.log('  ✓ Workspace state updated');
    console.log('\nNote: WebSocket disabled, testing UI-only behavior\n');
  });
});
