/**
 * Playwright Workspace Test Fixtures
 */

import { Page } from '@playwright/test';
import { apiRequest, loginViaAPI } from './auth-fixtures';

export async function loginAsDeveloper(page: Page) {
  await loginViaAPI(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
}

export async function createAndOpenWorkspace(page: Page, slug?: string): Promise<string> {
  const workspaceSlug = slug || `test-ws-${Date.now()}`;

  const projectResponse = await apiRequest(page, 'POST', '/api/projects', {
    data: {
      slug: workspaceSlug,
      title: `Test Workspace ${workspaceSlug}`,
      description: 'E2E test workspace',
      category: 'game',
      color: '#3b82f6',
      status: 'in_development',
    },
  });

  if (!projectResponse.ok() && projectResponse.status() !== 409) {
    const errorText = await projectResponse.text();
    throw new Error(`Failed to create project: ${projectResponse.status()} - ${errorText}`);
  }

  await page.goto(`/projects/${workspaceSlug}/workspace`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="workspace-canvas"]', { timeout: 10000 });

  return workspaceSlug;
}

export async function createNode(
  page: Page,
  workspaceId: string,
  position: { x: number; y: number },
  text: string = 'Test Node',
  options: { width?: number; height?: number; nodeType?: 'text' | 'note'; locked?: boolean } = {}
): Promise<string> {
  const { width = 200, height = 100, nodeType = 'text', locked = false } = options;

  const response = await apiRequest(page, 'POST', '/api/workspace/nodes', {
    data: {
      workspace_id: workspaceId,
      position,
      size: { width, height },
      content: { text, markdown: text },
      metadata: { nodeType, locked },
    },
  });

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(`Failed to create node: ${response.status()} - ${errorText}`);
  }

  const data = await response.json();
  return data.id;
}

export async function cleanupWorkspace(page: Page, workspaceId: string) {
  // Skip cleanup if workspaceId is undefined (test failed before workspace creation)
  if (!workspaceId) {
    return;
  }

  try {
    const response = await apiRequest(page, 'DELETE', `/api/projects/${workspaceId}`, {});
    // 405 = Method Not Allowed (DELETE endpoint not implemented yet)
    // 404 = Not Found (already deleted)
    // Both are acceptable outcomes for cleanup
    if (!response.ok() && response.status() !== 404 && response.status() !== 405) {
      console.warn(`Failed to delete workspace ${workspaceId}: ${response.status()}`);
    }
  } catch (error) {
    // Silently ignore cleanup errors - tests run in isolation
    console.warn(`Cleanup error for ${workspaceId}:`, error);
  }
}

export function getNodeElement(page: Page, nodeId: string) {
  return page.locator(`[data-node-id="${nodeId}"]`);
}

export async function getNodeFromDatabase(page: Page, nodeId: string, includeDeleted = false) {
  const url = includeDeleted
    ? `/api/workspace/nodes/${nodeId}?includeDeleted=true`
    : `/api/workspace/nodes/${nodeId}`;
  const response = await apiRequest(page, 'GET', url, {});
  if (!response.ok()) {
    throw new Error(`Failed to fetch node: ${response.status()}`);
  }
  const data = await response.json();
  return data;
}

export async function waitForAutoSave(page: Page, timeout: number = 3000) {
  // Wait for the debounce timer (500ms) + network request time
  // Simpler and more reliable than waiting for UI indicator
  await page.waitForTimeout(timeout);
}

export async function isNodeEditing(page: Page, nodeId: string): Promise<boolean> {
  const editor = page.locator(`[data-node-id="${nodeId}"] [contenteditable="true"]`);
  return await editor.isVisible().catch(() => false);
}

export async function verifyNodePosition(
  page: Page,
  nodeId: string,
  expectedPosition: { x: number; y: number }
) {
  const dbNode = await getNodeFromDatabase(page, nodeId);
  if (dbNode.position.x !== expectedPosition.x || dbNode.position.y !== expectedPosition.y) {
    throw new Error(
      `Position mismatch: expected (${expectedPosition.x}, ${expectedPosition.y}), got (${dbNode.position.x}, ${dbNode.position.y})`
    );
  }
}

export async function verifyNodeSize(
  page: Page,
  nodeId: string,
  expectedSize: { width: number; height: number }
) {
  const dbNode = await getNodeFromDatabase(page, nodeId);
  if (dbNode.size.width !== expectedSize.width || dbNode.size.height !== expectedSize.height) {
    throw new Error(
      `Size mismatch: expected ${expectedSize.width}x${expectedSize.height}, got ${dbNode.size.width}x${dbNode.size.height}`
    );
  }
}
