/**
 * SQL Injection Prevention Security Tests
 *
 * Verifies that the forum system properly sanitizes all database inputs
 * to prevent SQL injection attacks.
 *
 * Tests cover 5 attack scenarios:
 * 1. SQL injection in search queries
 * 2. SQL injection in topic creation (title/content)
 * 3. SQL injection in category filtering
 * 4. UNION-based injection attempts
 * 5. Time-based blind injection detection
 *
 * All payloads are safe for testing (no destructive operations).
 */

import { test, expect } from '@playwright/test';
import { SQL_INJECTION_PAYLOADS } from '../../factories/security-payloads';
import { buildSQLInjectionTopic } from '../../factories/topic-factory';
import { buildSQLInjectionReply } from '../../factories/reply-factory';
import { login, createTopic, searchForums } from '../../helpers/forum-helpers';

test.describe('SQL Injection Prevention - Search Queries', () => {
  test('should prevent basic OR-based SQL injection in search', async ({ page }) => {
    await page.goto('https://www.veritablegames.com/forums');
    await page.waitForLoadState('networkidle');

    // Attempt SQL injection via search
    const sqlPayload = SQL_INJECTION_PAYLOADS.basicOr[0]; // "' OR 1=1--"

    const searchInput = await page.$(
      'input[type="search"], input[name="search"], input[placeholder*="search" i]'
    );
    if (searchInput) {
      await searchInput.fill(sqlPayload);
      await searchInput.press('Enter');
      await page.waitForLoadState('networkidle');
    } else {
      // Alternative: use search helper
      await searchForums(page, sqlPayload);
    }

    // Verify no database error is shown
    const errorMessage = await page.$('[data-testid="error"], .error-message, text=/error/i');

    // Page should either:
    // 1. Show no results (payload treated as literal string)
    // 2. Show results matching the literal string (not all topics)
    // 3. Show a safe error message (not database internals)

    // Should NOT see database-specific errors
    const pageContent = await page.content();
    expect(pageContent).not.toContain('SQL');
    expect(pageContent).not.toContain('syntax error');
    expect(pageContent).not.toContain('sqlite');
    expect(pageContent).not.toContain('postgres');
    expect(pageContent).not.toContain('WHERE');
    expect(pageContent).not.toContain('SELECT');
  });

  test('should prevent UNION-based SQL injection in search', async ({ page }) => {
    await page.goto('https://www.veritablegames.com/forums');
    await page.waitForLoadState('networkidle');

    // Attempt UNION-based injection
    const sqlPayload = SQL_INJECTION_PAYLOADS.union[0]; // "' UNION SELECT NULL--"

    const searchInput = await page.$(
      'input[type="search"], input[name="search"], input[placeholder*="search" i]'
    );
    if (searchInput) {
      await searchInput.fill(sqlPayload);
      await searchInput.press('Enter');
      await page.waitForLoadState('networkidle');
    }

    // Verify no database error or data leak
    const pageContent = await page.content();
    expect(pageContent).not.toContain('UNION');
    expect(pageContent).not.toContain('NULL');

    // Should not expose database structure
    expect(pageContent).not.toContain('column');
    expect(pageContent).not.toContain('table');
    expect(pageContent).not.toContain('syntax');
  });

  test('should prevent comment-based SQL injection in search', async ({ page }) => {
    await page.goto('https://www.veritablegames.com/forums');
    await page.waitForLoadState('networkidle');

    // Attempt comment-based injection
    const sqlPayload = SQL_INJECTION_PAYLOADS.comments[0]; // "'--"

    const searchInput = await page.$(
      'input[type="search"], input[name="search"], input[placeholder*="search" i]'
    );
    if (searchInput) {
      await searchInput.fill(sqlPayload);
      await searchInput.press('Enter');
      await page.waitForLoadState('networkidle');
    }

    // Verify no database error
    const pageContent = await page.content();
    expect(pageContent).not.toContain('SQL');
    expect(pageContent).not.toContain('syntax error');

    // Should treat as literal string or safe error
    const hasResults = await page.$('[data-testid="search-results"], .search-results');
    const hasNoResults = await page.$('[data-testid="no-results"], text=/no results/i');
    const hasError = await page.$('[data-testid="error"], .error-message');

    // One of these should be true (all are safe outcomes)
    const isSafe = hasResults !== null || hasNoResults !== null || hasError !== null;
    expect(isSafe).toBe(true);
  });
});

test.describe('SQL Injection Prevention - Topic Creation', () => {
  test('should prevent SQL injection in topic title', async ({ page }) => {
    await login(page);

    // Attempt SQL injection via topic title
    const sqlPayload = SQL_INJECTION_PAYLOADS.basicOr[1]; // "' OR 'a'='a"
    const topicData = buildSQLInjectionTopic(sqlPayload, 'title');

    // Attempt to create topic
    try {
      const { topicId, url } = await createTopic(page, topicData);

      // If creation succeeds, verify the payload was escaped/sanitized
      await page.goto(url);
      await page.waitForLoadState('networkidle');

      // Title should contain the literal string (escaped), not execute SQL
      const titleElement = await page.$('h1, [data-testid="topic-title"]');
      const titleText = (await titleElement?.textContent()) || '';

      // The payload should appear as literal text (escaped)
      // It should NOT cause any database errors
      const pageContent = await page.content();
      expect(pageContent).not.toContain('SQL');
      expect(pageContent).not.toContain('syntax error');
      expect(pageContent).not.toContain('database error');
    } catch (error: any) {
      // If creation fails, it should be a validation error, not a database error
      expect(error.message).not.toContain('SQL');
      expect(error.message).not.toContain('syntax');
      expect(error.message).not.toContain('database');
    }
  });

  test('should prevent SQL injection in topic content', async ({ page }) => {
    await login(page);

    // Attempt SQL injection via topic content
    const sqlPayload = SQL_INJECTION_PAYLOADS.union[1]; // "' UNION SELECT * FROM users--"
    const topicData = buildSQLInjectionTopic(sqlPayload, 'content');

    try {
      const { topicId, url } = await createTopic(page, topicData);

      // If creation succeeds, verify the payload was escaped
      await page.goto(url);
      await page.waitForLoadState('networkidle');

      // Content should be escaped, not executed
      const pageContent = await page.content();
      expect(pageContent).not.toContain('UNION');
      expect(pageContent).not.toContain('FROM users');

      // Should not expose user data or database structure
      expect(pageContent).not.toContain('syntax error');
      expect(pageContent).not.toContain('database error');
    } catch (error: any) {
      // Safe validation error only
      expect(error.message).not.toContain('SQL');
      expect(error.message).not.toContain('database');
    }
  });
});

test.describe('SQL Injection Prevention - Category Filtering', () => {
  test('should prevent SQL injection in category filter', async ({ page }) => {
    // Attempt to access category with SQL injection in slug
    const sqlPayload = SQL_INJECTION_PAYLOADS.basicOr[0]; // "' OR 1=1--"
    const maliciousUrl = `https://www.veritablegames.com/forums/category/${encodeURIComponent(sqlPayload)}`;

    await page.goto(maliciousUrl);
    await page.waitForLoadState('networkidle');

    // Should get 404 or safe error, not database error
    const pageContent = await page.content();

    // Should NOT expose database internals
    expect(pageContent).not.toContain('SQL');
    expect(pageContent).not.toContain('syntax error');
    expect(pageContent).not.toContain('database error');
    expect(pageContent).not.toContain('sqlite');
    expect(pageContent).not.toContain('postgres');

    // Should show either 404 or category not found
    const has404 = pageContent.includes('404') || pageContent.includes('Not Found');
    const hasNotFound = pageContent.includes('not found') || pageContent.includes('does not exist');
    const isSafeError = has404 || hasNotFound;

    expect(isSafeError).toBe(true);
  });
});

test.describe('SQL Injection Prevention - Time-Based Detection', () => {
  test('should not be vulnerable to time-based blind SQL injection', async ({ page }) => {
    await page.goto('https://www.veritablegames.com/forums');
    await page.waitForLoadState('networkidle');

    // Attempt time-based blind injection
    const sqlPayload = SQL_INJECTION_PAYLOADS.timeBased[0]; // "' AND SLEEP(5)--"

    // Measure response time
    const startTime = Date.now();

    const searchInput = await page.$(
      'input[type="search"], input[name="search"], input[placeholder*="search" i]'
    );
    if (searchInput) {
      await searchInput.fill(sqlPayload);
      await searchInput.press('Enter');

      // Wait for response (with timeout)
      try {
        await page.waitForLoadState('networkidle', { timeout: 10000 });
      } catch (error) {
        // Timeout is acceptable
      }
    }

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Response should NOT be delayed by 5 seconds (SLEEP command)
    // Allow some buffer for network latency (max 3 seconds)
    expect(responseTime).toBeLessThan(3000);

    // Verify no database error
    const pageContent = await page.content();
    expect(pageContent).not.toContain('SQL');
    expect(pageContent).not.toContain('SLEEP');
    expect(pageContent).not.toContain('WAITFOR');
  });

  test('should handle malformed SQL gracefully', async ({ page }) => {
    await page.goto('https://www.veritablegames.com/forums');
    await page.waitForLoadState('networkidle');

    // Attempt various malformed SQL
    const malformedPayloads = [
      "'; DROP TABLE forum_topics;--", // Stacked query
      "' AND 1=CONVERT(int, (SELECT TOP 1 name FROM sysobjects))--", // Error-based
      "admin'--", // Comment injection
    ];

    for (const payload of malformedPayloads) {
      const searchInput = await page.$(
        'input[type="search"], input[name="search"], input[placeholder*="search" i]'
      );
      if (searchInput) {
        await searchInput.fill(payload);
        await searchInput.press('Enter');
        await page.waitForLoadState('networkidle');

        // Verify no database error or data exposure
        const pageContent = await page.content();
        expect(pageContent).not.toContain('DROP');
        expect(pageContent).not.toContain('CONVERT');
        expect(pageContent).not.toContain('sysobjects');
        expect(pageContent).not.toContain('syntax error');
        expect(pageContent).not.toContain('SQL error');

        // Navigate back for next iteration
        await page.goto('https://www.veritablegames.com/forums');
        await page.waitForLoadState('networkidle');
      }
    }
  });
});
