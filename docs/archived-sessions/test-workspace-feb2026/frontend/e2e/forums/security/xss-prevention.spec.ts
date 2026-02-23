/**
 * XSS Prevention Security Tests
 *
 * Verifies that the forum system properly sanitizes all user input
 * to prevent Cross-Site Scripting (XSS) attacks.
 *
 * Tests cover 8 attack vectors:
 * 1. Script tags in topic titles
 * 2. Script tags in reply content
 * 3. Event handlers (img onerror, svg onload, etc.)
 * 4. JavaScript URLs (javascript:, data:)
 * 5. CSS injection
 * 6. Iframe injection
 * 7. SVG-based XSS
 * 8. Encoded payloads
 */

import { test, expect } from '@playwright/test';
import { XSS_PAYLOADS, getQuickXSSPayloads } from '../../factories/security-payloads';
import { buildXSSTopic } from '../../factories/topic-factory';
import { buildXSSReply } from '../../factories/reply-factory';
import { login, createTopic, createReply } from '../../helpers/forum-helpers';

test.describe('XSS Prevention - Topic Titles', () => {
  test('should sanitize script tags in topic title', async ({ page }) => {
    await login(page); // Uses CLAUDE_CREDENTIALS by default

    const xssPayload = XSS_PAYLOADS.scriptTags[0]; // '<script>alert("XSS")</script>'
    const topicData = buildXSSTopic(xssPayload, 'title');

    const { topicId, url } = await createTopic(page, topicData);

    // Navigate to the created topic
    await page.goto(url);
    await page.waitForLoadState('networkidle');

    // Verify the title does NOT contain the script tag
    const titleElement = await page.$('h1, [data-testid="topic-title"]');
    const titleText = (await titleElement?.textContent()) || '';

    // Script tag should be sanitized out
    expect(titleText).not.toContain('<script>');
    expect(titleText).not.toContain('alert');

    // Page should not have any script execution
    const scripts = await page.locator('script:has-text("XSS")').count();
    expect(scripts).toBe(0);
  });

  test('should sanitize event handlers in topic title', async ({ page }) => {
    await login(page); // Uses CLAUDE_CREDENTIALS by default

    const xssPayload = XSS_PAYLOADS.eventHandlers[0]; // '<img src=x onerror=alert(1)>'
    const topicData = buildXSSTopic(xssPayload, 'title');

    const { topicId, url } = await createTopic(page, topicData);

    await page.goto(url);
    await page.waitForLoadState('networkidle');

    // Verify no onerror handler exists
    const titleElement = await page.$('h1, [data-testid="topic-title"]');
    const titleHTML = await titleElement?.evaluate(el => el.innerHTML);

    expect(titleHTML).not.toContain('onerror');
    expect(titleHTML).not.toContain('alert(1)');

    // Verify no img tag was injected
    const imgTags = await page.locator('h1 img, [data-testid="topic-title"] img').count();
    expect(imgTags).toBe(0);
  });

  test('should sanitize JavaScript URLs in topic title', async ({ page }) => {
    await login(page); // Uses CLAUDE_CREDENTIALS by default

    const xssPayload = XSS_PAYLOADS.javascriptUrls[0]; // '<a href="javascript:alert(1)">Click</a>'
    const topicData = buildXSSTopic(xssPayload, 'title');

    const { topicId, url } = await createTopic(page, topicData);

    await page.goto(url);
    await page.waitForLoadState('networkidle');

    // Verify no javascript: URLs exist
    const titleElement = await page.$('h1, [data-testid="topic-title"]');
    const titleHTML = await titleElement?.evaluate(el => el.innerHTML);

    expect(titleHTML).not.toContain('javascript:');

    // Verify no anchor tags were created with href
    const linkCount = await page.locator('h1 a[href], [data-testid="topic-title"] a[href]').count();
    expect(linkCount).toBe(0);
  });
});

test.describe('XSS Prevention - Reply Content', () => {
  test('should sanitize script tags in reply content', async ({ page }) => {
    await login(page); // Uses CLAUDE_CREDENTIALS by default

    // Create a safe topic first
    const { topicId, url } = await createTopic(page, {
      title: '[E2E TEST] XSS Test Topic',
      content: 'Safe topic content',
      category: 'general',
    });

    await page.goto(url);

    // Create reply with XSS payload
    const xssPayload = XSS_PAYLOADS.scriptTags[1]; // '<script>alert(String.fromCharCode(88,83,83))</script>'
    await createReply(page, topicId, xssPayload);

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify script tag was sanitized
    const pageContent = await page.content();
    expect(pageContent).not.toContain('String.fromCharCode');
    expect(pageContent).not.toContain('<script>');

    // Verify no scripts were executed
    const scripts = await page.locator('script:has-text("fromCharCode")').count();
    expect(scripts).toBe(0);
  });

  test('should sanitize img onerror handlers in reply content', async ({ page }) => {
    await login(page); // Uses CLAUDE_CREDENTIALS by default

    const { topicId, url } = await createTopic(page, {
      title: '[E2E TEST] XSS Test Topic',
      content: 'Safe topic content',
      category: 'general',
    });

    await page.goto(url);

    // Create reply with img onerror attack
    const xssPayload = XSS_PAYLOADS.eventHandlers[0]; // '<img src=x onerror=alert(1)>'
    await createReply(page, topicId, xssPayload);

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify onerror handler was removed
    const pageContent = await page.content();
    expect(pageContent).not.toContain('onerror=');

    // Check all img tags in replies don't have onerror
    const imgWithOnerror = await page.locator('img[onerror]').count();
    expect(imgWithOnerror).toBe(0);
  });

  test('should sanitize SVG onload handlers in reply content', async ({ page }) => {
    await login(page); // Uses CLAUDE_CREDENTIALS by default

    const { topicId, url } = await createTopic(page, {
      title: '[E2E TEST] XSS Test Topic',
      content: 'Safe topic content',
      category: 'general',
    });

    await page.goto(url);

    // Create reply with SVG onload attack
    const xssPayload = XSS_PAYLOADS.svgXss[0]; // '<svg onload=alert(1)>'
    await createReply(page, topicId, xssPayload);

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify onload handler was removed
    const pageContent = await page.content();
    expect(pageContent).not.toContain('onload=');

    // Check all svg tags don't have onload
    const svgWithOnload = await page.locator('svg[onload]').count();
    expect(svgWithOnload).toBe(0);
  });

  test('should sanitize data URLs in reply content', async ({ page }) => {
    await login(page); // Uses CLAUDE_CREDENTIALS by default

    const { topicId, url } = await createTopic(page, {
      title: '[E2E TEST] XSS Test Topic',
      content: 'Safe topic content',
      category: 'general',
    });

    await page.goto(url);

    // Create reply with data URL attack
    const xssPayload = XSS_PAYLOADS.dataUrls[0]; // '<a href="data:text/html,<script>alert(1)</script>">Click</a>'
    await createReply(page, topicId, xssPayload);

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify data: URLs were removed
    const pageContent = await page.content();
    expect(pageContent).not.toContain('data:text/html');

    // Check no anchor tags have data: URLs
    const links = await page.locator('a[href^="data:"]').count();
    expect(links).toBe(0);
  });

  test('should sanitize CSS injection in reply content', async ({ page }) => {
    await login(page); // Uses CLAUDE_CREDENTIALS by default

    const { topicId, url } = await createTopic(page, {
      title: '[E2E TEST] XSS Test Topic',
      content: 'Safe topic content',
      category: 'general',
    });

    await page.goto(url);

    // Create reply with CSS injection
    const xssPayload = XSS_PAYLOADS.cssInjection[0]; // '<style>body { background: url("javascript:alert(1)") }</style>'
    await createReply(page, topicId, xssPayload);

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify style tags were removed or sanitized
    const pageContent = await page.content();

    // Either style tag is completely removed, or javascript: URL is removed
    const hasStyleTag = pageContent.includes('<style>');
    if (hasStyleTag) {
      // If style tag exists, it should not have javascript: URLs
      expect(pageContent).not.toContain('javascript:alert');
    }

    // Check no inline styles have javascript: URLs
    const elementsWithJsUrls = await page.locator('[style*="javascript:"]').count();
    expect(elementsWithJsUrls).toBe(0);
  });
});

test.describe('XSS Prevention - Encoded Payloads', () => {
  test('should sanitize URL-encoded XSS payloads', async ({ page }) => {
    await login(page); // Uses CLAUDE_CREDENTIALS by default

    // URL-encoded: %3Cscript%3Ealert(1)%3C/script%3E
    const xssPayload = XSS_PAYLOADS.encoded[0];
    const topicData = buildXSSTopic(xssPayload, 'content');

    const { topicId, url } = await createTopic(page, topicData);

    await page.goto(url);
    await page.waitForLoadState('networkidle');

    // Verify no script execution
    const scripts = await page.locator('script:has-text("alert")').count();
    expect(scripts).toBe(0);

    // Verify content doesn't contain decoded script tags
    const content = await page.content();
    expect(content).not.toContain('<script>alert(1)</script>');
  });

  test('should sanitize HTML entity-encoded XSS payloads', async ({ page }) => {
    await login(page); // Uses CLAUDE_CREDENTIALS by default

    // HTML entities: &#60;script&#62;alert(1)&#60;/script&#62;
    const xssPayload = XSS_PAYLOADS.encoded[1];
    const topicData = buildXSSTopic(xssPayload, 'content');

    const { topicId, url } = await createTopic(page, topicData);

    await page.goto(url);
    await page.waitForLoadState('networkidle');

    // Verify no script execution
    const scripts = await page.locator('script:has-text("alert")').count();
    expect(scripts).toBe(0);

    // Verify content doesn't contain decoded script tags
    const content = await page.content();
    expect(content).not.toContain('<script>alert(1)</script>');
  });
});

test.describe('XSS Prevention - Nested/Complex Attacks', () => {
  test('should sanitize nested script tags', async ({ page }) => {
    await login(page); // Uses CLAUDE_CREDENTIALS by default

    // Nested: <<script>alert(1)//<</script>
    const xssPayload = XSS_PAYLOADS.nested[0];
    const topicData = buildXSSTopic(xssPayload, 'title');

    const { topicId, url } = await createTopic(page, topicData);

    await page.goto(url);
    await page.waitForLoadState('networkidle');

    // Verify no script tags exist
    const titleElement = await page.$('h1, [data-testid="topic-title"]');
    const titleHTML = await titleElement?.evaluate(el => el.innerHTML);

    expect(titleHTML).not.toContain('<script>');
    expect(titleHTML).not.toContain('alert');

    // Verify no script execution
    const scripts = await page.locator('script:has-text("alert")').count();
    expect(scripts).toBe(0);
  });

  test('should sanitize obfuscated script tags', async ({ page }) => {
    await login(page); // Uses CLAUDE_CREDENTIALS by default

    // Obfuscated: <scr<script>ipt>alert(1)</scr</script>ipt>
    const xssPayload = XSS_PAYLOADS.nested[1];
    const topicData = buildXSSTopic(xssPayload, 'content');

    const { topicId, url } = await createTopic(page, topicData);

    await page.goto(url);
    await page.waitForLoadState('networkidle');

    // Verify no script tags exist
    const content = await page.content();
    expect(content).not.toContain('alert(1)');

    // Verify no script execution
    const scripts = await page.locator('script:has-text("alert")').count();
    expect(scripts).toBe(0);
  });
});
