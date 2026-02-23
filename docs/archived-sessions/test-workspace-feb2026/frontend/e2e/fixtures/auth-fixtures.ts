/**
 * Playwright Authentication Fixtures
 *
 * Provides helper functions and fixtures for authentication-related tests
 *
 * Security Note:
 *   Uses .claude-credentials file for test authentication (NOT hardcoded passwords)
 *   See: docs/forums/SECURITY_ISSUE_E2E_ADMIN_PASSWORD.md
 */

import { Page, test as base } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Load credentials from .claude-credentials file
function loadClaudeCredentials(): { username: string; password: string } {
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
      credentials[key] = valueParts.join('=');
    }
  });

  return {
    username: credentials['CLAUDE_TEST_USERNAME'] || 'claude',
    password: credentials['CLAUDE_TEST_PASSWORD'] || '',
  };
}

const CLAUDE_CREDENTIALS = loadClaudeCredentials();

/**
 * Setup API mocks for login page initialization
 *
 * The login page calls /api/csrf and /api/auth/me on load.
 * These API calls can hang in test environments, causing the page to stay in "Loading..." state.
 * This function intercepts those calls and provides fast responses.
 */
export async function setupLoginPageMocks(page: Page) {
  // Mock /api/csrf - return success
  await page.route('/api/csrf', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  // Mock /api/auth/me - return "not logged in" to skip redirect logic
  await page.route('/api/auth/me', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, data: null }),
    });
  });
}

/**
 * Wait for login page to finish loading
 *
 * The login page shows a loading spinner while checking auth state.
 * This waits for the form to appear.
 */
export async function waitForLoginPage(page: Page) {
  // Wait for either the username field or the "Sign In" button to appear
  await page.waitForSelector('[name="username"], button:has-text("Sign In")', {
    timeout: 10000,
  });
}

/**
 * Login helper that bypasses the UI and uses API directly
 *
 * More reliable than UI-based login for test setup.
 * Use this in beforeEach hooks to establish authenticated sessions.
 *
 * Security Note: Uses Claude test credentials by default (from .claude-credentials file)
 */
export async function loginViaAPI(
  page: Page,
  username: string = CLAUDE_CREDENTIALS.username,
  password: string = CLAUDE_CREDENTIALS.password
) {
  if (!password) {
    throw new Error(
      '.claude-credentials not configured! See docs/forums/SECURITY_ISSUE_E2E_ADMIN_PASSWORD.md'
    );
  }
  // Step 1: Initialize CSRF (GET request) - this sets the csrf_token cookie
  const csrfResponse = await page.request.get('/api/csrf');
  if (!csrfResponse.ok()) {
    throw new Error(`CSRF initialization failed: ${csrfResponse.status()}`);
  }

  // Step 2: Extract CSRF token from response cookies
  const cookies = await page.context().cookies();
  const csrfCookie = cookies.find(c => c.name === 'csrf_token');

  if (!csrfCookie) {
    throw new Error('CSRF cookie not set after initialization');
  }

  const csrfToken = csrfCookie.value;

  // Step 3: Login with CSRF token in header
  const loginResponse = await page.request.post('/api/auth/login', {
    data: {
      username,
      password,
    },
    headers: {
      'x-csrf-token': csrfToken, // Double-submit cookie pattern
    },
  });

  if (!loginResponse.ok()) {
    const errorBody = await loginResponse.text();
    throw new Error(`Login failed: ${loginResponse.status()} - ${errorBody}`);
  }

  const loginData = await loginResponse.json();
  if (!loginData.success) {
    throw new Error(`Login failed: ${loginData.error || 'Unknown error'}`);
  }

  return loginData.data.user;
}

/**
 * Login helper using UI (for testing the login flow itself)
 *
 * This actually fills in the form and submits it.
 * Use loginViaAPI() for test setup; use this only when testing login functionality.
 */
export async function loginViaUI(
  page: Page,
  username: string = CLAUDE_CREDENTIALS.username,
  password: string = CLAUDE_CREDENTIALS.password
) {
  if (!password) {
    throw new Error(
      '.claude-credentials not configured! See docs/forums/SECURITY_ISSUE_E2E_ADMIN_PASSWORD.md'
    );
  }

  // Setup mocks first
  await setupLoginPageMocks(page);

  // Navigate to login
  await page.goto('/auth/login');

  // Wait for page to load
  await waitForLoginPage(page);

  // Fill in form
  await page.getByLabel('Username or Email').fill(username);
  await page.getByLabel('Password').fill(password);

  // Submit
  await page.getByRole('button', { name: 'Log In' }).click();

  // Wait for redirect to home page
  await page.waitForURL('/', { timeout: 15000 });
}

/**
 * Extended test fixture with auth helpers
 *
 * Usage:
 *   import { test } from '@/e2e/fixtures/auth-fixtures';
 *
 *   test('my test', async ({ page, loginAsAdmin }) => {
 *     await loginAsAdmin();
 *     // page is now authenticated
 *   });
 */
export const test = base.extend({
  // Auto-setup API mocks for every test
  page: async ({ page }, use) => {
    // Setup login page mocks by default
    await setupLoginPageMocks(page);

    // Use the page
    await use(page);
  },

  // Helper to login as Claude test user
  loginAsAdmin: async ({ page }, use) => {
    const loginHelper = async () => {
      return await loginViaAPI(page); // Uses Claude credentials by default
    };
    await use(loginHelper);
  },
});

/**
 * Get current CSRF token from page cookies
 */
export async function getCSRFToken(page: Page): Promise<string | null> {
  const cookies = await page.context().cookies();
  const csrfCookie = cookies.find(c => c.name === 'csrf_token');
  return csrfCookie?.value || null;
}

/**
 * Make authenticated API request with CSRF token
 *
 * Use this instead of page.request.post/put/delete to automatically include CSRF token
 */
export async function apiRequest(
  page: Page,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  options: any = {}
) {
  const csrfToken = await getCSRFToken(page);

  const headers = {
    ...options.headers,
  };

  // Add CSRF token for non-GET requests
  if (method !== 'GET' && csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  return page.request.fetch(url, {
    ...options,
    method,
    headers,
  });
}

export { expect } from '@playwright/test';
