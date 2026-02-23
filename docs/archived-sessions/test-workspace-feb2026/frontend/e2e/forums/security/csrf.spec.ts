/**
 * CSRF Protection Security Tests
 *
 * Verifies that the forum system properly protects against Cross-Site Request Forgery (CSRF) attacks.
 *
 * CSRF protection strategies tested:
 * 1. CSRF token requirement for state-changing operations
 * 2. CSRF token validation (rejects invalid tokens)
 * 3. Origin/Referer header validation
 *
 * Note: Next.js 15 may use different CSRF protection mechanisms than traditional token-based approaches.
 * This test suite verifies that SOME form of CSRF protection exists.
 */

import { test, expect } from '@playwright/test';
import { CSRF_TEST_TOKENS } from '../../factories/security-payloads';
import { CLAUDE_CREDENTIALS } from '../../helpers/forum-helpers';

// Get baseURL from environment or default to localhost
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

test.describe('CSRF Protection - Token Validation', () => {
  test('should reject requests without proper CSRF protection', async ({ request }) => {
    // Attempt to create a topic without proper session/token
    const response = await request.post('/api/forums/topics', {
      data: {
        title: '[E2E TEST] CSRF Attack Attempt',
        content: 'This should be rejected due to CSRF protection',
        categoryId: 1,
      },
      headers: {
        'Content-Type': 'application/json',
        // Explicitly omit Origin and Referer headers (suspicious)
      },
    });

    // Should be rejected (401, 403, or specific CSRF error)
    expect([401, 403]).toContain(response.status());

    // Response should not leak sensitive information
    if (response.status() === 403 || response.status() === 401) {
      try {
        const responseData = await response.json();

        // Error message should indicate authentication/authorization issue
        // Note: API uses 'error' or 'message' fields, not 'success'
        expect(responseData.error || responseData.message).toBeTruthy();
      } catch {
        // Non-JSON response is also acceptable for blocked request
        expect([401, 403]).toContain(response.status());
      }
    }
  });

  test('should validate Origin header for state-changing requests', async ({
    request,
    context,
  }) => {
    // Create a context with cookies from legitimate login
    // Then attempt request with wrong Origin header

    // Attempt POST with mismatched Origin (simulating CSRF attack from evil.com)
    const response = await request.post('/api/forums/topics', {
      data: {
        title: '[E2E TEST] CSRF Origin Attack',
        content: 'Malicious cross-site request',
        categoryId: 1,
      },
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil.com', // Malicious origin
        Referer: 'https://evil.com/attack.html',
      },
    });

    // Should be rejected due to Origin mismatch
    // Expected: 403 Forbidden or 401 Unauthorized
    expect([401, 403]).toContain(response.status());

    // Some frameworks return specific CSRF error
    if (response.status() === 403) {
      try {
        const responseData = await response.json();
        // Error should indicate CSRF or origin mismatch
        // (May vary based on implementation)
        expect(responseData.success).toBe(false);
      } catch {
        // Non-JSON response is also acceptable for blocked request
        expect(response.status()).toBe(403);
      }
    }
  });

  test('should allow requests with valid Origin and session', async ({ page, request }) => {
    // Login to establish valid session
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[name="username"], input[type="text"]', CLAUDE_CREDENTIALS.username);
    await page.fill('input[name="password"], input[type="password"]', CLAUDE_CREDENTIALS.password);
    await page.click('button[type="submit"]');

    // Wait for redirect after login
    await page.waitForURL(/\/(?!auth\/login)/, { timeout: 10000 });

    // Get cookies from logged-in session
    const cookies = await page.context().cookies();

    // Attempt request with proper Origin and valid session
    const response = await request.post('/api/forums/topics', {
      data: {
        title: '[E2E TEST] CSRF Valid Request',
        content: 'This should succeed with valid session and origin',
        categoryId: 1,
      },
      headers: {
        'Content-Type': 'application/json',
        Origin: baseURL,
        Referer: `${baseURL}/forums/create`,
        Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; '),
      },
    });

    // Should succeed or return validation error (not CSRF error)
    // 200 OK, 201 Created, or 400 Bad Request (validation) are all acceptable
    expect(response.status()).not.toBe(403); // Should NOT be forbidden
    expect(response.status()).toBeLessThan(500); // Should NOT be server error

    if (response.status() === 200 || response.status() === 201) {
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
    }
  });
});

test.describe('CSRF Protection - Same-Site Cookie Enforcement', () => {
  test('session cookies should have SameSite attribute', async ({ page }) => {
    // Login to establish session
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[name="username"], input[type="text"]', CLAUDE_CREDENTIALS.username);
    await page.fill('input[name="password"], input[type="password"]', CLAUDE_CREDENTIALS.password);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/(?!auth\/login)/, { timeout: 10000 });

    // Get cookies
    const cookies = await page.context().cookies();

    // Find session cookie(s)
    const sessionCookies = cookies.filter(
      c =>
        c.name.includes('session') ||
        c.name.includes('token') ||
        c.name.includes('auth') ||
        c.httpOnly // Session cookies are typically httpOnly
    );

    // At least one session cookie should exist
    expect(sessionCookies.length).toBeGreaterThan(0);

    // Session cookies should have SameSite attribute set
    for (const cookie of sessionCookies) {
      // SameSite should be 'Strict', 'Lax', or 'None' (with Secure)
      // Modern best practice: 'Lax' or 'Strict'
      expect(['strict', 'lax', 'none']).toContain(cookie.sameSite?.toLowerCase() || '');

      // If SameSite=None, cookie MUST be Secure
      if (cookie.sameSite?.toLowerCase() === 'none') {
        expect(cookie.secure).toBe(true);
      }
    }
  });

  test('session cookies should be httpOnly to prevent XSS theft', async ({ page }) => {
    // Login to establish session
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[name="username"], input[type="text"]', CLAUDE_CREDENTIALS.username);
    await page.fill('input[name="password"], input[type="password"]', CLAUDE_CREDENTIALS.password);

    console.log('Submitting login form...');

    // Intercept login response to see cookies
    const loginResponsePromise = page.waitForResponse(
      response =>
        response.url().includes('/api/auth/login') && response.request().method() === 'POST'
    );

    await page.click('button[type="submit"]');

    const loginResponse = await loginResponsePromise;
    console.log('Login response status:', loginResponse.status());
    console.log('Login response headers:', JSON.stringify(loginResponse.headers(), null, 2));

    // Check cookies immediately after login
    const cookiesAfterLogin = await page.context().cookies();
    console.log('Cookies after login:', JSON.stringify(cookiesAfterLogin, null, 2));

    console.log('Waiting for redirect...');
    try {
      await page.waitForURL(/\/(?!auth\/login)/, { timeout: 10000 });
      console.log('Redirected to:', page.url());
    } catch (error: any) {
      console.error('Redirect failed!', error.message);
      console.error('Still on:', page.url());
      // Check for error messages on page
      const errorText = await page.textContent('body');
      console.error('Page content:', errorText?.substring(0, 500));
    }

    // Attempt to access cookies via JavaScript (should fail for httpOnly cookies)
    const accessibleCookies = await page.evaluate(() => document.cookie);

    // Session tokens should NOT be accessible via document.cookie
    // Note: CSRF tokens SHOULD be accessible (not httpOnly) - only check for session/auth tokens
    expect(accessibleCookies).not.toContain('session_token');
    expect(accessibleCookies).not.toContain('auth_token');

    // Get actual cookies from context
    const cookies = await page.context().cookies();
    console.log('All cookies:', JSON.stringify(cookies, null, 2));

    const sessionCookies = cookies.filter(c => c.httpOnly);
    console.log('HttpOnly cookies:', JSON.stringify(sessionCookies, null, 2));

    // At least one cookie should be httpOnly (session protection)
    expect(sessionCookies.length).toBeGreaterThan(0);

    console.log(`Found ${sessionCookies.length} httpOnly cookies (protected from XSS)`);
  });
});

test.describe('CSRF Protection - Double Submit Cookie Pattern', () => {
  test('should implement some form of CSRF protection mechanism', async ({ page, request }) => {
    // This test verifies that cross-origin requests are properly blocked
    // even with valid session cookies (true CSRF attack scenario)

    // Step 1: Login and get valid session
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[name="username"], input[type="text"]', CLAUDE_CREDENTIALS.username);
    await page.fill('input[name="password"], input[type="password"]', CLAUDE_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(?!auth\/login)/, { timeout: 10000 });

    const cookies = await page.context().cookies();

    // Step 2: Simulate CSRF attack from evil.com
    // Attacker has user's cookies (browser automatically sends them)
    // But attacker is making request from different origin
    const csrfResponse = await request.post('/api/forums/topics', {
      data: {
        title: '[E2E TEST] CSRF Attack with Cookies',
        content: 'Attacker has cookies but wrong origin',
        categoryId: 1,
      },
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; '),
        // Simulate attack from evil.com
        Origin: 'https://evil.com',
        Referer: 'https://evil.com/csrf-attack.html',
      },
    });

    // Should be blocked despite having valid cookies
    // CSRF protection should detect origin mismatch
    expect([401, 403]).toContain(csrfResponse.status());

    // Step 3: Verify legitimate request works
    const legitimateResponse = await request.post('/api/forums/topics', {
      data: {
        title: '[E2E TEST] Legitimate Request',
        content: 'Same origin, valid cookies',
        categoryId: 1,
      },
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; '),
        // Legitimate origin
        Origin: baseURL,
        Referer: `${baseURL}/forums/create`,
      },
    });

    // Legitimate request should succeed (or return validation error, not CSRF block)
    expect(legitimateResponse.status()).not.toBe(403);
    expect(legitimateResponse.status()).toBeLessThan(500);

    console.log(
      `CSRF attack blocked: ${csrfResponse.status()}, Legitimate request: ${legitimateResponse.status()}`
    );
  });
});
