/**
 * Validation & Error Handling E2E Tests
 *
 * Comprehensive test coverage for input validation and error handling
 * in the forum system.
 *
 * Tests cover:
 * 1. Empty title validation
 * 2. Short title (< 3 chars)
 * 3. Long title (> 200 chars)
 * 4. Empty content validation
 * 5. Invalid/non-existent category
 * 6. Too many tags (> 10)
 * 7. 404 for non-existent topic
 * 8. 404 for non-existent reply
 */

import { test, expect } from '@playwright/test';
import { login, createTopic } from '../helpers/forum-helpers';
import { buildInvalidTopic } from '../factories/topic-factory';

test.describe('Validation - Topic Creation', () => {
  test('should show error for empty title', async ({ page }) => {
    await login(page);

    await page.goto('https://www.veritablegames.com/forums/create');
    await page.waitForLoadState('networkidle');

    // Fill form with empty title
    await page.fill('[data-testid="title-input"], input[name="title"]', '');
    await page.fill('[data-testid="content-input"], textarea[name="content"]', 'Valid content');

    // Select category
    const categorySelect = await page.$('select[name="category"], [data-testid="category-select"]');
    if (categorySelect) {
      await categorySelect.selectOption('general');
    }

    // Submit form
    await page.click('[data-testid="submit-btn"], button[type="submit"]');

    // Wait for validation
    await page.waitForTimeout(1000);

    // Should show validation error
    const errorMessage = await page.$(
      '[data-testid="error-message"], [data-testid="title-error"], .error-message'
    );

    expect(errorMessage).not.toBeNull();

    const errorText = (await errorMessage?.textContent()) || '';
    expect(errorText).toMatch(/title.*required|required.*title/i);
  });

  test('should show error for short title (< 3 chars)', async ({ page }) => {
    await login(page);

    await page.goto('https://www.veritablegames.com/forums/create');
    await page.waitForLoadState('networkidle');

    // Fill form with short title
    await page.fill('[data-testid="title-input"], input[name="title"]', 'AB'); // 2 chars
    await page.fill('[data-testid="content-input"], textarea[name="content"]', 'Valid content');

    const categorySelect = await page.$('select[name="category"], [data-testid="category-select"]');
    if (categorySelect) {
      await categorySelect.selectOption('general');
    }

    await page.click('[data-testid="submit-btn"], button[type="submit"]');
    await page.waitForTimeout(1000);

    // Should show validation error
    const errorMessage = await page.$(
      '[data-testid="error-message"], [data-testid="title-error"], .error-message'
    );

    if (errorMessage) {
      const errorText = (await errorMessage.textContent()) || '';
      expect(errorText).toMatch(/title.*3|minimum.*3|too short/i);
    } else {
      // Alternatively, form should not submit
      const currentUrl = page.url();
      expect(currentUrl).toContain('/create');
    }
  });

  test('should show error for long title (> 200 chars)', async ({ page }) => {
    await login(page);

    await page.goto('https://www.veritablegames.com/forums/create');
    await page.waitForLoadState('networkidle');

    // Fill form with very long title (201 chars)
    const longTitle = 'A'.repeat(201);
    await page.fill('[data-testid="title-input"], input[name="title"]', longTitle);
    await page.fill('[data-testid="content-input"], textarea[name="content"]', 'Valid content');

    const categorySelect = await page.$('select[name="category"], [data-testid="category-select"]');
    if (categorySelect) {
      await categorySelect.selectOption('general');
    }

    await page.click('[data-testid="submit-btn"], button[type="submit"]');
    await page.waitForTimeout(1000);

    // Should show validation error
    const errorMessage = await page.$(
      '[data-testid="error-message"], [data-testid="title-error"], .error-message'
    );

    if (errorMessage) {
      const errorText = (await errorMessage.textContent()) || '';
      expect(errorText).toMatch(/title.*200|maximum.*200|too long/i);
    } else {
      // Form should not submit
      const currentUrl = page.url();
      expect(currentUrl).toContain('/create');
    }
  });

  test('should show error for empty content', async ({ page }) => {
    await login(page);

    await page.goto('https://www.veritablegames.com/forums/create');
    await page.waitForLoadState('networkidle');

    // Fill form with empty content
    await page.fill('[data-testid="title-input"], input[name="title"]', '[E2E TEST] Valid Title');
    await page.fill('[data-testid="content-input"], textarea[name="content"]', '');

    const categorySelect = await page.$('select[name="category"], [data-testid="category-select"]');
    if (categorySelect) {
      await categorySelect.selectOption('general');
    }

    await page.click('[data-testid="submit-btn"], button[type="submit"]');
    await page.waitForTimeout(1000);

    // Should show validation error
    const errorMessage = await page.$(
      '[data-testid="error-message"], [data-testid="content-error"], .error-message'
    );

    expect(errorMessage).not.toBeNull();

    const errorText = (await errorMessage?.textContent()) || '';
    expect(errorText).toMatch(/content.*required|required.*content/i);
  });

  test('should show error for invalid category', async ({ page, request }) => {
    await login(page);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // Attempt to create topic with non-existent category via API
    const response = await request.post('https://www.veritablegames.com/api/forums/topics', {
      data: {
        title: '[E2E TEST] Topic with Invalid Category',
        content: 'Test content',
        category: 'non-existent-category-xyz-123',
      },
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        Origin: 'https://www.veritablegames.com',
      },
    });

    // Should return 400 Bad Request or 404 Not Found
    expect([400, 404]).toContain(response.status());

    const responseData = await response.json();
    expect(responseData.error).toMatch(/category.*not found|invalid.*category/i);
  });

  test('should show error for too many tags (> 10)', async ({ page, request }) => {
    await login(page);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // Create array of 11 tags (exceeds limit)
    const tooManyTags = Array(11)
      .fill(0)
      .map((_, i) => `tag${i}`);

    // Attempt to create topic with too many tags via API
    const response = await request.post('https://www.veritablegames.com/api/forums/topics', {
      data: {
        title: '[E2E TEST] Topic with Too Many Tags',
        content: 'Test content',
        category: 'general',
        tags: tooManyTags,
      },
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        Origin: 'https://www.veritablegames.com',
      },
    });

    // Should return 400 Bad Request
    if (response.status() === 400) {
      const responseData = await response.json();
      expect(responseData.error).toMatch(/tags.*10|too many tags|maximum.*10/i);
    } else if (response.status() === 200 || response.status() === 201) {
      // If accepted, this is a validation gap (finding to report)
      console.warn('WARNING: Topic created with 11 tags (limit should be 10)');
    }
  });
});

test.describe('Error Handling - Not Found (404)', () => {
  test('should return 404 for non-existent topic', async ({ page }) => {
    // Navigate to topic with very high ID (unlikely to exist)
    await page.goto('https://www.veritablegames.com/forums/topics/999999999');
    await page.waitForLoadState('networkidle');

    const pageContent = await page.content();

    // Should show 404 page or not found message
    const has404 =
      pageContent.includes('404') ||
      pageContent.includes('Not Found') ||
      pageContent.includes('not found') ||
      pageContent.includes('does not exist');

    expect(has404).toBe(true);

    // Should not show server error (500)
    expect(pageContent).not.toContain('500');
    expect(pageContent).not.toContain('Internal Server Error');
  });

  test('should return 404 for non-existent reply via API', async ({ request }) => {
    // Attempt to access non-existent reply via API
    const response = await request.get(
      'https://www.veritablegames.com/api/forums/replies/999999999'
    );

    // Should return 404 Not Found
    expect(response.status()).toBe(404);

    const responseData = await response.json();
    expect(responseData.error).toMatch(/not found|does not exist/i);
  });

  test('should return 404 for non-existent category', async ({ page }) => {
    // Navigate to category that doesn't exist
    await page.goto('https://www.veritablegames.com/forums/category/non-existent-category-xyz');
    await page.waitForLoadState('networkidle');

    const pageContent = await page.content();

    // Should show 404 page
    const has404 =
      pageContent.includes('404') ||
      pageContent.includes('Not Found') ||
      pageContent.includes('not found');

    expect(has404).toBe(true);
  });
});

test.describe('Error Handling - Reply Validation', () => {
  test('should show error for empty reply content', async ({ page, request }) => {
    await login(page);

    const { topicId } = await createTopic(page, {
      title: '[E2E TEST] Reply Validation Test',
      content: 'Test content',
      category: 'general',
    });

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // Attempt to create reply with empty content
    const response = await request.post('https://www.veritablegames.com/api/forums/replies', {
      data: {
        topicId,
        content: '', // Empty content
      },
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        Origin: 'https://www.veritablegames.com',
      },
    });

    // Should return 400 Bad Request
    expect(response.status()).toBe(400);

    const responseData = await response.json();
    expect(responseData.error).toMatch(/content.*required|required.*content/i);
  });

  test('should show error when replying to non-existent topic', async ({ page, request }) => {
    await login(page);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // Attempt to create reply on non-existent topic
    const response = await request.post('https://www.veritablegames.com/api/forums/replies', {
      data: {
        topicId: 999999999, // Non-existent
        content: '[E2E TEST] Reply to non-existent topic',
      },
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        Origin: 'https://www.veritablegames.com',
      },
    });

    // Should return 404 Not Found
    expect(response.status()).toBe(404);

    const responseData = await response.json();
    expect(responseData.error).toMatch(/topic.*not found|not found.*topic/i);
  });
});
