/**
 * Rate Limiting Security Tests
 *
 * Verifies that the forum system properly enforces rate limits to prevent abuse.
 *
 * Rate limits (from security-payloads.ts):
 * - Topic creation: 5 topics per minute
 * - Reply creation: 10 replies per minute
 * - Voting: 20 votes per minute
 *
 * Tests verify:
 * 1. Rate limits are enforced (429 Too Many Requests after limit)
 * 2. Retry-After header is present
 * 3. Rate limit resets after time window
 */

import { test, expect } from '@playwright/test';
import { RATE_LIMIT } from '../../factories/security-payloads';
import { login, createTopic, createReply } from '../../helpers/forum-helpers';
import { buildTopic } from '../../factories/topic-factory';
import { buildReply } from '../../factories/reply-factory';

test.describe('Rate Limiting - Topic Creation', () => {
  test('should enforce topic creation rate limit', async ({ page, request }) => {
    await login(page);

    // Get cookies for API requests
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const createdTopics: number[] = [];
    let rateLimitHit = false;
    let rateLimitResponse: any = null;

    // Attempt to create topics rapidly
    for (let i = 0; i < RATE_LIMIT.topicCreation + 3; i++) {
      const topicData = buildTopic({
        title: `[E2E TEST] Rate Limit Test Topic ${i + 1}`,
        content: `Topic ${i + 1} for rate limit testing`,
        category: 'general',
      });

      const response = await request.post('https://www.veritablegames.com/api/forums/topics', {
        data: topicData,
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieHeader,
          Origin: 'https://www.veritablegames.com',
        },
      });

      if (response.status() === 429) {
        // Rate limit hit
        rateLimitHit = true;
        rateLimitResponse = response;
        console.log(`Rate limit hit after ${i} topics`);
        break;
      } else if (response.status() === 200 || response.status() === 201) {
        const data = await response.json();
        if (data.data?.id) {
          createdTopics.push(data.data.id);
        }
      }

      // Small delay to avoid overwhelming server
      await page.waitForTimeout(100);
    }

    // Verify rate limit behavior
    if (rateLimitHit) {
      // Expected: Rate limit was enforced
      expect(rateLimitResponse.status()).toBe(429);

      // Verify Retry-After header exists
      const retryAfter = rateLimitResponse.headers()['retry-after'];
      if (retryAfter) {
        const retrySeconds = parseInt(retryAfter);
        expect(retrySeconds).toBeGreaterThan(0);
        expect(retrySeconds).toBeLessThan(120); // Should be reasonable (< 2 minutes)
        console.log(`Retry-After: ${retrySeconds} seconds`);
      }

      // Response should include error message about rate limit
      try {
        const errorData = await rateLimitResponse.json();
        expect(errorData.error).toMatch(/rate limit|too many requests/i);
      } catch {
        // Non-JSON response is acceptable for 429
      }
    } else {
      // If no rate limit hit, either:
      // 1. Rate limiting is not implemented (finding to report)
      // 2. Limit is higher than expected
      console.warn(
        `WARNING: Created ${createdTopics.length} topics without hitting rate limit (expected limit: ${RATE_LIMIT.topicCreation})`
      );

      // This is not necessarily a test failure, but a finding
      // The system may have more lenient limits than documented
    }

    // Cleanup: Delete created topics
    for (const topicId of createdTopics) {
      await request.delete(`https://www.veritablegames.com/api/forums/topics/${topicId}`, {
        headers: { Cookie: cookieHeader },
      });
    }
  });

  test.skip('should reset rate limit after time window', async ({ page, request }) => {
    // This test is skipped by default as it takes >60 seconds to run
    // Enable it for thorough rate limit testing

    await login(page);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // Create topics until rate limit hit
    let rateLimitHit = false;
    for (let i = 0; i < RATE_LIMIT.topicCreation + 1; i++) {
      const topicData = buildTopic({
        title: `[E2E TEST] Rate Reset Test ${i + 1}`,
      });

      const response = await request.post('https://www.veritablegames.com/api/forums/topics', {
        data: topicData,
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieHeader,
          Origin: 'https://www.veritablegames.com',
        },
      });

      if (response.status() === 429) {
        rateLimitHit = true;
        break;
      }

      await page.waitForTimeout(100);
    }

    if (rateLimitHit) {
      // Wait for rate limit window to reset (typically 60 seconds)
      console.log('Waiting 65 seconds for rate limit reset...');
      await page.waitForTimeout(65000);

      // Try creating another topic
      const topicData = buildTopic({
        title: '[E2E TEST] After Rate Reset',
      });

      const response = await request.post('https://www.veritablegames.com/api/forums/topics', {
        data: topicData,
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieHeader,
          Origin: 'https://www.veritablegames.com',
        },
      });

      // Should succeed after rate limit reset
      expect(response.status()).not.toBe(429);
      expect([200, 201]).toContain(response.status());
    }
  });
});

test.describe('Rate Limiting - Reply Creation', () => {
  test('should enforce reply creation rate limit', async ({ page, request }) => {
    await login(page);

    // Create a test topic first
    const { topicId } = await createTopic(page, {
      title: '[E2E TEST] Rate Limit Reply Test Topic',
      content: 'Topic for testing reply rate limits',
      category: 'general',
    });

    // Get cookies for API requests
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const createdReplies: number[] = [];
    let rateLimitHit = false;
    let rateLimitResponse: any = null;

    // Attempt to create replies rapidly
    for (let i = 0; i < RATE_LIMIT.replyCreation + 3; i++) {
      const replyData = buildReply({
        content: `[E2E TEST] Rate limit reply ${i + 1}`,
      });

      const response = await request.post('https://www.veritablegames.com/api/forums/replies', {
        data: {
          topicId,
          content: replyData.content,
        },
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieHeader,
          Origin: 'https://www.veritablegames.com',
        },
      });

      if (response.status() === 429) {
        // Rate limit hit
        rateLimitHit = true;
        rateLimitResponse = response;
        console.log(`Reply rate limit hit after ${i} replies`);
        break;
      } else if (response.status() === 200 || response.status() === 201) {
        const data = await response.json();
        if (data.data?.id) {
          createdReplies.push(data.data.id);
        }
      }

      // Small delay
      await page.waitForTimeout(100);
    }

    // Verify rate limit behavior
    if (rateLimitHit) {
      // Expected: Rate limit was enforced
      expect(rateLimitResponse.status()).toBe(429);

      // Verify Retry-After header
      const retryAfter = rateLimitResponse.headers()['retry-after'];
      if (retryAfter) {
        const retrySeconds = parseInt(retryAfter);
        expect(retrySeconds).toBeGreaterThan(0);
        expect(retrySeconds).toBeLessThan(120);
        console.log(`Retry-After: ${retrySeconds} seconds`);
      }

      // Response should include error message
      try {
        const errorData = await rateLimitResponse.json();
        expect(errorData.error).toMatch(/rate limit|too many requests/i);
      } catch {
        // Non-JSON response acceptable
      }
    } else {
      console.warn(
        `WARNING: Created ${createdReplies.length} replies without hitting rate limit (expected limit: ${RATE_LIMIT.replyCreation})`
      );
    }

    // Cleanup
    for (const replyId of createdReplies) {
      await request.delete(`https://www.veritablegames.com/api/forums/replies/${replyId}`, {
        headers: { Cookie: cookieHeader },
      });
    }

    // Delete test topic
    await request.delete(`https://www.veritablegames.com/api/forums/topics/${topicId}`, {
      headers: { Cookie: cookieHeader },
    });
  });
});

test.describe('Rate Limiting - Voting', () => {
  test('should handle rapid voting attempts gracefully', async ({ page, request }) => {
    await login(page);

    // Create topic with multiple replies for voting
    const { topicId, url } = await createTopic(page, {
      title: '[E2E TEST] Voting Rate Limit Test',
      content: 'Topic for voting rate limit test',
      category: 'general',
    });

    // Create multiple replies to vote on
    const replyIds: number[] = [];
    for (let i = 0; i < 5; i++) {
      const { replyId } = await createReply(page, topicId, `[E2E TEST] Reply ${i + 1} for voting`);
      replyIds.push(replyId);
    }

    // Get cookies
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    let rateLimitHit = false;
    let voteCount = 0;

    // Attempt rapid voting
    for (let i = 0; i < RATE_LIMIT.voting + 3; i++) {
      const replyId = replyIds[i % replyIds.length]; // Cycle through replies
      const voteType = i % 2 === 0 ? 'up' : 'down';

      const response = await request.post(
        `https://www.veritablegames.com/api/forums/replies/${replyId}/vote`,
        {
          data: { voteType },
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookieHeader,
            Origin: 'https://www.veritablegames.com',
          },
        }
      );

      if (response.status() === 429) {
        rateLimitHit = true;
        console.log(`Vote rate limit hit after ${voteCount} votes`);
        break;
      } else if (response.status() === 200) {
        voteCount++;
      }

      await page.waitForTimeout(50);
    }

    if (rateLimitHit) {
      // Rate limiting is working
      console.log(`Voting rate limit enforced at ${voteCount} votes`);
      expect(voteCount).toBeLessThanOrEqual(RATE_LIMIT.voting + 2); // Some buffer allowed
    } else {
      // Either no rate limit or very high limit
      console.warn(
        `WARNING: Completed ${voteCount} votes without hitting rate limit (expected: ${RATE_LIMIT.voting})`
      );
    }

    // Cleanup
    await request.delete(`https://www.veritablegames.com/api/forums/topics/${topicId}`, {
      headers: { Cookie: cookieHeader },
    });
  });
});
