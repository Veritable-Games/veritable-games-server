/**
 * Topic View Page Object
 *
 * Represents a single topic page (/forums/topics/[id])
 * Provides methods for viewing, replying, voting, and moderation
 */

import { Page, Locator, expect } from '@playwright/test';

export class TopicPage {
  readonly page: Page;
  readonly topicId: number;
  readonly baseUrl: string;

  constructor(page: Page, topicId: number, baseUrl = 'https://www.veritablegames.com') {
    this.page = page;
    this.topicId = topicId;
    this.baseUrl = baseUrl;
  }

  /**
   * Navigate to topic page
   */
  async goto(): Promise<void> {
    await this.page.goto(`${this.baseUrl}/forums/topics/${this.topicId}`);
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(2000); // Wait for React hydration
  }

  /**
   * Get topic title
   */
  async getTitle(): Promise<string> {
    const titleEl = await this.page.$('h1, [data-testid="topic-title"]');
    return (await titleEl?.textContent()) || '';
  }

  /**
   * Get topic content
   */
  async getContent(): Promise<string> {
    const contentEl = await this.page.$('[data-testid="topic-content"], .topic-content');
    return (await contentEl?.textContent()) || '';
  }

  /**
   * Reply to topic (top-level reply)
   */
  async reply(content: string): Promise<void> {
    await this.page.click('[data-testid="new-reply-btn"], button:has-text("Reply")');
    await this.page.waitForTimeout(1000);

    await this.page.fill('[data-testid="reply-input"], textarea:visible', content);
    await this.page.click(
      '[data-testid="submit-reply-btn"], button:has-text("Submit"), button:has-text("Post")'
    );

    // Wait for API response
    await this.page.waitForResponse(resp => resp.url().includes('/api/forums/replies'), {
      timeout: 10000,
    });
  }

  /**
   * Reply to a specific reply (nested reply)
   */
  async replyTo(replyId: number, content: string): Promise<void> {
    await this.page.click(`[data-testid="reply-to-${replyId}"]`);
    await this.page.waitForTimeout(1000);

    await this.page.fill('textarea:visible', content);
    await this.page.click('button:has-text("Submit"), button:has-text("Post")');

    // Wait for API response
    await this.page.waitForResponse(resp => resp.url().includes('/api/forums/replies'), {
      timeout: 10000,
    });
  }

  /**
   * Vote on a reply
   */
  async vote(replyId: number, voteType: 'up' | 'down'): Promise<void> {
    const btnTestId = voteType === 'up' ? `upvote-btn-${replyId}` : `downvote-btn-${replyId}`;
    await this.page.click(`[data-testid="${btnTestId}"]`);

    // Wait for vote API call
    await this.page.waitForResponse(
      resp => resp.url().includes(`/api/forums/replies/${replyId}/vote`),
      { timeout: 5000 }
    );
  }

  /**
   * Get vote count for a reply
   */
  async getVoteCount(replyId: number): Promise<number> {
    const countEl = await this.page.$(`[data-testid="vote-count-${replyId}"]`);
    const text = (await countEl?.textContent()) || '0';
    return parseInt(text, 10);
  }

  /**
   * Edit topic (must be owner or moderator)
   */
  async edit(newTitle: string, newContent: string): Promise<void> {
    await this.page.click('[data-testid="edit-topic-btn"], button:has-text("Edit")');
    await this.page.waitForTimeout(1000);

    await this.page.fill('[data-testid="title-input"], input[name="title"]', newTitle);
    await this.page.fill('[data-testid="content-input"], textarea[name="content"]', newContent);

    await this.page.click('[data-testid="save-btn"], button:has-text("Save")');

    // Wait for update
    await this.page.waitForResponse(
      resp => resp.url().includes(`/api/forums/topics/${this.topicId}`),
      { timeout: 5000 }
    );
  }

  /**
   * Delete topic
   */
  async delete(): Promise<void> {
    await this.page.click('[data-testid="delete-topic-btn"], button:has-text("Delete")');

    // Handle confirmation
    const confirmBtn = await this.page.$(
      '[data-testid="confirm-delete"], button:has-text("Confirm")'
    );
    if (confirmBtn) {
      await confirmBtn.click();
    }

    // Wait for deletion
    await this.page.waitForResponse(
      resp =>
        resp.url().includes(`/api/forums/topics/${this.topicId}`) &&
        resp.request().method() === 'DELETE',
      { timeout: 5000 }
    );
  }

  /**
   * Pin topic (moderator action)
   */
  async pin(): Promise<void> {
    await this.page.click('[data-testid="pin-topic-btn"], button:has-text("Pin")');

    await this.page.waitForResponse(
      resp => resp.url().includes(`/api/forums/topics/${this.topicId}/pin`),
      { timeout: 5000 }
    );
  }

  /**
   * Unpin topic (moderator action)
   */
  async unpin(): Promise<void> {
    await this.page.click('[data-testid="unpin-topic-btn"], button:has-text("Unpin")');

    await this.page.waitForResponse(
      resp => resp.url().includes(`/api/forums/topics/${this.topicId}/pin`),
      { timeout: 5000 }
    );
  }

  /**
   * Lock topic (moderator action)
   */
  async lock(): Promise<void> {
    await this.page.click('[data-testid="lock-topic-btn"], button:has-text("Lock")');

    await this.page.waitForResponse(
      resp => resp.url().includes(`/api/forums/topics/${this.topicId}/lock`),
      { timeout: 5000 }
    );
  }

  /**
   * Unlock topic (moderator action)
   */
  async unlock(): Promise<void> {
    await this.page.click('[data-testid="unlock-topic-btn"], button:has-text("Unlock")');

    await this.page.waitForResponse(
      resp => resp.url().includes(`/api/forums/topics/${this.topicId}/lock`),
      { timeout: 5000 }
    );
  }

  /**
   * Mark topic as solved
   */
  async markSolved(): Promise<void> {
    await this.page.click('[data-testid="mark-solved-btn"], button:has-text("Mark as Solved")');

    await this.page.waitForResponse(
      resp => resp.url().includes(`/api/forums/topics/${this.topicId}/solved`),
      { timeout: 5000 }
    );
  }

  /**
   * Mark reply as solution
   */
  async markReplyAsSolution(replyId: number): Promise<void> {
    await this.page.click(
      `[data-testid="mark-solution-${replyId}"], button:has-text("Mark as Solution")`
    );

    await this.page.waitForResponse(
      resp => resp.url().includes(`/api/forums/replies/${replyId}/solution`),
      { timeout: 5000 }
    );
  }

  /**
   * Get all replies
   */
  async getReplies(): Promise<Locator[]> {
    return this.page.locator('[data-testid^="reply-"], [class*="reply"]').all();
  }

  /**
   * Get reply count
   */
  async getReplyCount(): Promise<number> {
    const replies = await this.getReplies();
    return replies.length;
  }

  /**
   * Check if topic is pinned
   */
  async isPinned(): Promise<boolean> {
    const pinnedBadge = await this.page.$('[data-testid="pinned-badge"], text=/pinned/i');
    return pinnedBadge !== null;
  }

  /**
   * Check if topic is locked
   */
  async isLocked(): Promise<boolean> {
    const lockedBadge = await this.page.$('[data-testid="locked-badge"], text=/locked/i');
    return lockedBadge !== null;
  }

  /**
   * Check if topic is solved
   */
  async isSolved(): Promise<boolean> {
    const solvedBadge = await this.page.$('[data-testid="solved-badge"], text=/solved/i');
    return solvedBadge !== null;
  }

  /**
   * Get solution reply (if exists)
   */
  async getSolutionReply(): Promise<Locator | null> {
    const solution = await this.page.$('[data-testid^="solution-badge"]');
    return solution;
  }

  /**
   * Verify topic loaded successfully
   */
  async verifyLoaded(): Promise<boolean> {
    const title = await this.getTitle();
    return title.length > 0;
  }
}
