/**
 * Forum E2E Test Helpers
 *
 * Reusable utilities for forum testing to reduce duplication and improve maintainability.
 *
 * Usage:
 *   import { login, createTopic, vote, getVoteCount } from './helpers/forum-helpers';
 *
 * Security Note:
 *   Uses .claude-credentials file for test authentication (NOT hardcoded passwords)
 *   See: docs/forums/SECURITY_ISSUE_E2E_ADMIN_PASSWORD.md
 */

import { Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Load credentials from .claude-credentials file
function loadClaudeCredentials(): { username: string; password: string; email: string } {
  const credPath = path.join(process.cwd(), '..', '.claude-credentials');

  if (!fs.existsSync(credPath)) {
    throw new Error(
      '.claude-credentials file not found! See docs/forums/SECURITY_ISSUE_E2E_ADMIN_PASSWORD.md'
    );
  }

  const credContent = fs.readFileSync(credPath, 'utf8');
  const credentials: Record<string, string> = {};

  credContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      credentials[key] = valueParts.join('='); // Handle passwords with = in them
    }
  });

  const username = credentials['CLAUDE_TEST_USERNAME'];
  const password = credentials['CLAUDE_TEST_PASSWORD'];
  const email = credentials['CLAUDE_TEST_EMAIL'];

  if (!username || !password) {
    throw new Error(
      '.claude-credentials is missing required fields! See docs/forums/SECURITY_ISSUE_E2E_ADMIN_PASSWORD.md'
    );
  }

  return { username, password, email };
}

// Test credentials - loaded from .claude-credentials
export const CLAUDE_CREDENTIALS = loadClaudeCredentials();

// Legacy credentials (for backward compatibility during migration)
// DEPRECATED: Use CLAUDE_CREDENTIALS instead
export const TEST_CREDENTIALS = {
  admin: CLAUDE_CREDENTIALS, // Map 'admin' to Claude credentials for backward compatibility
  claude: CLAUDE_CREDENTIALS,
};

/**
 * Test data types
 */
export interface TopicData {
  title: string;
  content: string;
  category?: string;
  categoryId?: number;
  tags?: string[];
}

export interface ReplyData {
  content: string;
  parentId?: number;
}

/**
 * Login helper with Claude credentials
 *
 * @param page - Playwright page object
 * @param username - Username to login as (defaults to Claude test user)
 * @param password - Password (defaults to Claude test password from .claude-credentials)
 */
export async function login(page: Page, username?: string, password?: string): Promise<void> {
  // Use Claude credentials by default
  const user = username || CLAUDE_CREDENTIALS.username;
  const pwd =
    password || (user === CLAUDE_CREDENTIALS.username ? CLAUDE_CREDENTIALS.password : undefined);

  // Fallback: if username provided but no password, check TEST_CREDENTIALS
  const finalPassword = pwd || TEST_CREDENTIALS[user as keyof typeof TEST_CREDENTIALS]?.password;

  if (!finalPassword) {
    throw new Error(`No password found for user: ${user}. Check .claude-credentials file.`);
  }

  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="username"], input[name="email"]', user);
  await page.fill('input[name="password"]', finalPassword);
  await page.click('button[type="submit"]');

  // Wait for navigation to complete
  await page.waitForURL(/.*/, { timeout: 10000 });

  // Wait for any auth redirects
  await page.waitForTimeout(2000);

  // Verify login succeeded by checking we're NOT on the login page
  const currentUrl = page.url();
  if (currentUrl.includes('/auth/login')) {
    throw new Error(`Login failed for user '${user}' - still on login page after submission`);
  }
}

/**
 * Logout helper
 */
export async function logout(page: Page): Promise<void> {
  await page.goto('/auth/logout');
  await page.waitForURL(/.*/, { timeout: 5000 });
}

/**
 * Create test topic and return topic ID and URL
 *
 * @param page - Playwright page object
 * @param data - Topic data (title, content, category, tags)
 * @returns Object with topicId and url
 */
export async function createTopic(
  page: Page,
  data: Partial<TopicData>
): Promise<{ topicId: number; url: string }> {
  const {
    title = 'Test Topic ' + Date.now(),
    content = 'Test Content',
    category = 'general',
  } = data;

  // Navigate directly to create page (uses server-side auth)
  await page.goto('/forums/create');

  // Wait for page load
  await page.waitForLoadState('networkidle');

  // Fill in topic form
  // Try data-testid first (new approach), fallback to generic selectors
  const titleInput = await page
    .locator(
      '[data-testid="topic-title-input"], input[name="title"], input[placeholder*="title" i]'
    )
    .first();
  await titleInput.waitFor({ state: 'visible', timeout: 10000 });
  await titleInput.fill(title);

  // Content can be in UnifiedMarkdownEditor (textarea) or other editor
  const contentInput = await page
    .locator('textarea[name="content"], [role="textbox"], textarea[placeholder*="content" i]')
    .first();
  await contentInput.waitFor({ state: 'visible', timeout: 5000 });
  await contentInput.fill(content);

  // Submit form
  const submitBtn = await page
    .locator(
      '[data-testid="create-topic-submit"], button[type="submit"], button:has-text("Create Topic"), button:has-text("Create"), button:has-text("Submit")'
    )
    .first();
  await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
  await submitBtn.click();

  // Wait for redirect to topic page (note: singular "topic" not "topics")
  await page.waitForURL(/\/forums\/topic\/\d+/, { timeout: 10000 });

  // Extract topic ID from URL
  const url = page.url();
  const match = url.match(/\/forums\/topic\/(\d+)/);
  const topicId = match ? parseInt(match[1], 10) : 0;

  if (!topicId) {
    throw new Error(`Failed to extract topic ID from URL: ${url}`);
  }

  return { topicId, url };
}

/**
 * Create test reply and return reply ID
 *
 * @param page - Playwright page object
 * @param topicId - Topic ID to reply to
 * @param content - Reply content
 * @param parentId - Optional parent reply ID for nested replies
 * @returns Object with replyId
 */
export async function createReply(
  page: Page,
  topicId: number,
  content: string,
  parentId?: number
): Promise<{ replyId: number }> {
  // Navigate to topic
  await page.goto(`/forums/topics/${topicId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // Wait for React hydration

  if (parentId) {
    // Click reply button on specific reply
    const replyBtn = await page.$(
      `[data-testid="reply-to-${parentId}"], button[data-reply-id="${parentId}"]`
    );
    if (replyBtn) {
      await replyBtn.click();
    } else {
      throw new Error(`Reply button for parent ${parentId} not found`);
    }
  } else {
    // Click main reply button
    const mainReplyBtn = await page.$('[data-testid="new-reply-btn"], button:has-text("Reply")');
    if (mainReplyBtn) {
      await mainReplyBtn.click();
    }
  }

  await page.waitForTimeout(1000);

  // Fill reply content
  const replyInput = await page.$('[data-testid="reply-input"], textarea[placeholder*="reply" i]');
  if (replyInput) {
    await replyInput.fill(content);
  } else {
    // Fallback: find any visible textarea
    await page.fill('textarea:visible', content);
  }

  // Submit reply
  await page.click(
    '[data-testid="submit-reply-btn"], button:has-text("Submit"), button:has-text("Post")'
  );

  // Wait for API response
  const response = await page.waitForResponse(
    resp => resp.url().includes('/api/forums/replies') && resp.status() === 200,
    { timeout: 10000 }
  );

  // Extract reply ID from response
  const responseData = await response.json();
  const replyId = responseData?.data?.reply?.id || responseData?.data?.id;

  if (!replyId) {
    // Fallback: look for reply in DOM
    await page.waitForTimeout(2000);
    const newReply = await page.$(`text="${content}"`);
    if (newReply) {
      console.warn('Reply created but ID not found in response, using DOM fallback');
      return { replyId: 0 }; // Placeholder
    }
    throw new Error('Failed to extract reply ID from response');
  }

  return { replyId };
}

/**
 * Vote on reply (upvote or downvote)
 *
 * @param page - Playwright page object
 * @param replyId - Reply ID to vote on
 * @param voteType - 'up' or 'down'
 */
export async function vote(page: Page, replyId: number, voteType: 'up' | 'down'): Promise<void> {
  const btnTestId = voteType === 'up' ? `upvote-btn-${replyId}` : `downvote-btn-${replyId}`;

  // Try data-testid first
  let voteBtn = await page.$(`[data-testid="${btnTestId}"]`);

  if (!voteBtn) {
    // Fallback: find by SVG path (arrow up/down icons)
    if (voteType === 'up') {
      // Arrow pointing up: M5 15l7-7 7 7 (ChevronUp)
      voteBtn = await page.$('button svg path[d*="M5 15l7-7 7 7"]');
    } else {
      // Arrow pointing down: M19 9l-7 7-7-7 (ChevronDown)
      voteBtn = await page.$('button svg path[d*="M19 9l-7 7-7-7"]');
    }

    if (voteBtn) {
      const parent = await voteBtn.evaluateHandle(el => el.closest('button'));
      voteBtn = parent.asElement();
    }
  }

  if (!voteBtn) {
    throw new Error(`Vote button not found for reply ${replyId}, type ${voteType}`);
  }

  await voteBtn.click();

  // Wait for API response
  await page.waitForResponse(resp => resp.url().includes(`/api/forums/replies/${replyId}/vote`), {
    timeout: 5000,
  });
}

/**
 * Get vote count for a reply
 *
 * @param page - Playwright page object
 * @param replyId - Reply ID
 * @returns Vote count as number
 */
export async function getVoteCount(page: Page, replyId: number): Promise<number> {
  // Try data-testid first
  const voteCountEl = await page.$(`[data-testid="vote-count-${replyId}"]`);

  if (voteCountEl) {
    const text = await voteCountEl.textContent();
    return parseInt(text || '0', 10);
  }

  // Fallback: find vote count near reply
  console.warn(`Vote count element not found for reply ${replyId}, using fallback`);
  return 0;
}

/**
 * Wait for SSE event
 *
 * @param page - Playwright page object
 * @param eventType - Event type to wait for (e.g., 'topic:pinned')
 * @param timeout - Timeout in milliseconds (default 5000)
 */
export async function waitForEvent(page: Page, eventType: string, timeout = 5000): Promise<void> {
  // Setup event listener if not already set
  await page.evaluate(() => {
    if (!(window as any).__sseEvents) {
      (window as any).__sseEvents = [];
      const eventSource = new EventSource('/api/forums/events');
      eventSource.onmessage = event => {
        (window as any).__sseEvents.push(JSON.parse(event.data));
      };
    }
  });

  // Wait for event of specified type
  await page.waitForFunction(
    type => {
      const events = (window as any).__sseEvents || [];
      return events.some((e: any) => e.type === type);
    },
    eventType,
    { timeout }
  );
}

/**
 * Assert error message is displayed
 *
 * @param page - Playwright page object
 * @param errorText - Expected error text (string or regex)
 */
export async function assertError(page: Page, errorText: string | RegExp): Promise<void> {
  const errorEl = await page.$(
    '[data-testid="error-message"], [role="alert"], .error, .alert-error'
  );

  if (!errorEl) {
    throw new Error('Error message element not found');
  }

  await expect(errorEl).toHaveText(errorText);
}

/**
 * Delete topic (soft delete)
 *
 * @param page - Playwright page object
 * @param topicId - Topic ID to delete
 */
export async function deleteTopic(page: Page, topicId: number): Promise<void> {
  await page.goto(`/forums/topics/${topicId}`);
  await page.waitForLoadState('networkidle');

  const deleteBtn = await page.$('[data-testid="delete-topic-btn"], button:has-text("Delete")');
  if (!deleteBtn) {
    throw new Error('Delete button not found');
  }

  await deleteBtn.click();

  // Handle confirmation dialog
  const confirmBtn = await page.$('[data-testid="confirm-delete"], button:has-text("Confirm")');
  if (confirmBtn) {
    await confirmBtn.click();
  }

  // Wait for deletion to complete
  await page.waitForResponse(
    resp =>
      resp.url().includes(`/api/forums/topics/${topicId}`) && resp.request().method() === 'DELETE',
    { timeout: 5000 }
  );
}

/**
 * Delete reply (soft delete)
 *
 * @param page - Playwright page object
 * @param replyId - Reply ID to delete
 */
export async function deleteReply(page: Page, replyId: number): Promise<void> {
  const deleteBtn = await page.$(
    `[data-testid="delete-reply-${replyId}"], button[data-reply-id="${replyId}"]:has-text("Delete")`
  );
  if (!deleteBtn) {
    throw new Error(`Delete button for reply ${replyId} not found`);
  }

  await deleteBtn.click();

  // Handle confirmation dialog
  const confirmBtn = await page.$('[data-testid="confirm-delete"], button:has-text("Confirm")');
  if (confirmBtn) {
    await confirmBtn.click();
  }

  // Wait for deletion to complete
  await page.waitForResponse(
    resp =>
      resp.url().includes(`/api/forums/replies/${replyId}`) && resp.request().method() === 'DELETE',
    { timeout: 5000 }
  );
}

/**
 * Edit topic
 *
 * @param page - Playwright page object
 * @param topicId - Topic ID to edit
 * @param newTitle - New title
 * @param newContent - New content
 */
export async function editTopic(
  page: Page,
  topicId: number,
  newTitle: string,
  newContent: string
): Promise<void> {
  await page.goto(`/forums/topics/${topicId}`);
  await page.waitForLoadState('networkidle');

  const editBtn = await page.$('[data-testid="edit-topic-btn"], button:has-text("Edit")');
  if (!editBtn) {
    throw new Error('Edit button not found');
  }

  await editBtn.click();
  await page.waitForTimeout(1000);

  // Fill new values
  await page.fill('[data-testid="title-input"], input[name="title"]', newTitle);
  await page.fill('[data-testid="content-input"], textarea[name="content"]', newContent);

  // Save
  await page.click('[data-testid="save-btn"], button:has-text("Save")');

  // Wait for update
  await page.waitForResponse(
    resp =>
      resp.url().includes(`/api/forums/topics/${topicId}`) && resp.request().method() === 'PATCH',
    { timeout: 5000 }
  );
}

/**
 * Edit reply
 *
 * @param page - Playwright page object
 * @param replyId - Reply ID to edit
 * @param newContent - New content
 */
export async function editReply(page: Page, replyId: number, newContent: string): Promise<void> {
  const editBtn = await page.$(
    `[data-testid="edit-reply-${replyId}"], button[data-reply-id="${replyId}"]:has-text("Edit")`
  );
  if (!editBtn) {
    throw new Error(`Edit button for reply ${replyId} not found`);
  }

  await editBtn.click();
  await page.waitForTimeout(1000);

  // Fill new content
  await page.fill('textarea:visible', newContent);

  // Save
  await page.click('[data-testid="save-btn"], button:has-text("Save")');

  // Wait for update
  await page.waitForResponse(
    resp =>
      resp.url().includes(`/api/forums/replies/${replyId}`) && resp.request().method() === 'PATCH',
    { timeout: 5000 }
  );
}

/**
 * Pin topic (moderator action)
 *
 * @param page - Playwright page object
 * @param topicId - Topic ID to pin
 */
export async function pinTopic(page: Page, topicId: number): Promise<void> {
  await page.goto(`/forums/topics/${topicId}`);
  await page.waitForLoadState('networkidle');

  const pinBtn = await page.$('[data-testid="pin-topic-btn"], button:has-text("Pin")');
  if (!pinBtn) {
    throw new Error('Pin button not found');
  }

  await pinBtn.click();

  // Wait for API response
  await page.waitForResponse(resp => resp.url().includes(`/api/forums/topics/${topicId}/pin`), {
    timeout: 5000,
  });
}

/**
 * Lock topic (moderator action)
 *
 * @param page - Playwright page object
 * @param topicId - Topic ID to lock
 */
export async function lockTopic(page: Page, topicId: number): Promise<void> {
  await page.goto(`/forums/topics/${topicId}`);
  await page.waitForLoadState('networkidle');

  const lockBtn = await page.$('[data-testid="lock-topic-btn"], button:has-text("Lock")');
  if (!lockBtn) {
    throw new Error('Lock button not found');
  }

  await lockBtn.click();

  // Wait for API response
  await page.waitForResponse(resp => resp.url().includes(`/api/forums/topics/${topicId}/lock`), {
    timeout: 5000,
  });
}

/**
 * Mark topic as solved
 *
 * @param page - Playwright page object
 * @param topicId - Topic ID to mark as solved
 */
export async function markTopicAsSolved(page: Page, topicId: number): Promise<void> {
  await page.goto(`/forums/topics/${topicId}`);
  await page.waitForLoadState('networkidle');

  const solvedBtn = await page.$(
    '[data-testid="mark-solved-btn"], button:has-text("Mark as Solved")'
  );
  if (!solvedBtn) {
    throw new Error('Mark as Solved button not found');
  }

  await solvedBtn.click();

  // Wait for API response
  await page.waitForResponse(resp => resp.url().includes(`/api/forums/topics/${topicId}/solved`), {
    timeout: 5000,
  });
}

/**
 * Mark reply as solution
 *
 * @param page - Playwright page object
 * @param replyId - Reply ID to mark as solution
 */
export async function markReplyAsSolution(page: Page, replyId: number): Promise<void> {
  const solutionBtn = await page.$(
    `[data-testid="mark-solution-${replyId}"], button:has-text("Mark as Solution")`
  );
  if (!solutionBtn) {
    throw new Error(`Mark as Solution button for reply ${replyId} not found`);
  }

  await solutionBtn.click();

  // Wait for API response
  await page.waitForResponse(
    resp => resp.url().includes(`/api/forums/replies/${replyId}/solution`),
    { timeout: 5000 }
  );
}

/**
 * Search forums
 *
 * @param page - Playwright page object
 * @param query - Search query
 * @param filters - Optional filters (category, tags, etc.)
 */
export async function searchForums(
  page: Page,
  query: string,
  filters?: { category?: string; tags?: string[] }
): Promise<void> {
  let url = `/forums/search?q=${encodeURIComponent(query)}`;

  if (filters?.category) {
    url += `&category=${encodeURIComponent(filters.category)}`;
  }

  if (filters?.tags && filters.tags.length > 0) {
    url += `&tags=${filters.tags.map(encodeURIComponent).join(',')}`;
  }

  await page.goto(url);
  await page.waitForLoadState('networkidle');
}

/**
 * Cleanup helper - Delete test content
 * Useful in afterEach hooks
 */
export async function cleanupTestContent(page: Page, prefix = '[E2E TEST]'): Promise<void> {
  // This would require admin API access to bulk delete
  // For now, tests should use soft deletes which can be cleaned up manually
  console.log(`Cleanup: Test content with prefix "${prefix}" can be cleaned up manually`);
}

/**
 * Wait for optimistic UI update
 * Useful for testing React 19 useOptimistic patterns
 */
export async function waitForOptimisticUpdate(page: Page, timeoutMs = 100): Promise<void> {
  await page.waitForTimeout(timeoutMs);
}

/**
 * Verify element count
 */
export async function verifyElementCount(
  page: Page,
  selector: string,
  expectedCount: number
): Promise<void> {
  const elements = await page.$$(selector);
  expect(elements.length).toBe(expectedCount);
}

/**
 * Get test topic URL (relative path)
 */
export function getTopicUrl(topicId: number): string {
  return `/forums/topics/${topicId}`;
}

/**
 * Get test category URL (relative path)
 */
export function getCategoryUrl(slug: string): string {
  return `/forums/category/${slug}`;
}
