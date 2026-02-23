/**
 * Forum Homepage Page Object
 *
 * Represents the main forums page (/forums)
 * Provides methods for interacting with categories, sections, and navigation
 */

import { Page, Locator } from '@playwright/test';

export class ForumPage {
  readonly page: Page;
  readonly baseUrl: string;

  constructor(page: Page, baseUrl = 'https://www.veritablegames.com') {
    this.page = page;
    this.baseUrl = baseUrl;
  }

  /**
   * Navigate to forum homepage
   */
  async goto(): Promise<void> {
    await this.page.goto(`${this.baseUrl}/forums`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get all category elements
   */
  async getCategories(): Promise<Locator[]> {
    return this.page.locator('[data-testid^="category-"], [class*="category"]').all();
  }

  /**
   * Click on a category by slug
   */
  async selectCategory(slug: string): Promise<void> {
    await this.page.click(`[data-testid="category-${slug}"], a[href*="/forums/category/${slug}"]`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get section headings
   */
  async getSections(): Promise<string[]> {
    const sections = await this.page.$$('h2, h3, [role="heading"]');
    const texts = await Promise.all(sections.map(s => s.textContent()));
    return texts.filter((t): t is string => t !== null);
  }

  /**
   * Search forums
   */
  async search(query: string): Promise<void> {
    const searchInput = await this.page.$('input[type="search"], input[placeholder*="search" i]');
    if (!searchInput) {
      throw new Error('Search input not found');
    }

    await searchInput.fill(query);
    await this.page.keyboard.press('Enter');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Click "New Topic" button
   */
  async clickNewTopic(): Promise<void> {
    await this.page.click(
      '[data-testid="new-topic-btn"], button:has-text("New Topic"), a:has-text("New Topic")'
    );
    await this.page.waitForTimeout(1000);
  }

  /**
   * Get recent topics list
   */
  async getRecentTopics(): Promise<{ title: string; url: string }[]> {
    const topicLinks = await this.page.$$('a[href*="/forums/topics/"]');
    const topics = await Promise.all(
      topicLinks.map(async link => ({
        title: (await link.textContent()) || '',
        url: (await link.getAttribute('href')) || '',
      }))
    );
    return topics;
  }

  /**
   * Verify page loaded successfully
   */
  async verifyLoaded(): Promise<boolean> {
    const categories = await this.getCategories();
    return categories.length > 0;
  }
}
