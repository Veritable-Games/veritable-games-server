/**
 * Category Page Object
 *
 * Represents a category view page (/forums/category/[slug])
 * Provides methods for viewing and filtering topics in a category
 */

import { Page, Locator } from '@playwright/test';

export class CategoryPage {
  readonly page: Page;
  readonly categorySlug: string;
  readonly baseUrl: string;

  constructor(page: Page, categorySlug: string, baseUrl = 'https://www.veritablegames.com') {
    this.page = page;
    this.categorySlug = categorySlug;
    this.baseUrl = baseUrl;
  }

  /**
   * Navigate to category page
   */
  async goto(): Promise<void> {
    await this.page.goto(`${this.baseUrl}/forums/category/${this.categorySlug}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get category name
   */
  async getCategoryName(): Promise<string> {
    const nameEl = await this.page.$('h1, [data-testid="category-name"]');
    return (await nameEl?.textContent()) || '';
  }

  /**
   * Get category description
   */
  async getCategoryDescription(): Promise<string> {
    const descEl = await this.page.$('[data-testid="category-description"], .category-description');
    return (await descEl?.textContent()) || '';
  }

  /**
   * Get all topics in category
   */
  async getTopics(): Promise<{ title: string; id: number }[]> {
    const topicLinks = await this.page.$$('a[href*="/forums/topics/"]');
    const topics = await Promise.all(
      topicLinks.map(async link => {
        const href = (await link.getAttribute('href')) || '';
        const match = href.match(/\/topics\/(\d+)/);
        const id = match ? parseInt(match[1], 10) : 0;

        return {
          title: (await link.textContent()) || '',
          id,
        };
      })
    );

    return topics.filter(t => t.id > 0);
  }

  /**
   * Click on a topic by title
   */
  async selectTopic(title: string): Promise<void> {
    await this.page.click(`text="${title}"`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Click on a topic by ID
   */
  async selectTopicById(topicId: number): Promise<void> {
    await this.page.click(`a[href*="/forums/topics/${topicId}"]`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Create new topic in this category
   */
  async createTopic(title: string, content: string): Promise<number> {
    await this.page.click('[data-testid="new-topic-btn"], button:has-text("New Topic")');
    await this.page.waitForTimeout(1000);

    await this.page.fill('input[name="title"]', title);
    await this.page.fill('textarea[name="content"]', content);
    await this.page.click('button[type="submit"]');

    // Wait for redirect
    await this.page.waitForURL(/\/forums\/topics\/\d+/);

    // Extract topic ID
    const url = this.page.url();
    const match = url.match(/\/topics\/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Filter topics by status
   */
  async filterByStatus(status: 'pinned' | 'locked' | 'solved'): Promise<void> {
    await this.page.click(`[data-testid="filter-${status}"], button:has-text("${status}")`);
    await this.page.waitForTimeout(1000);
  }

  /**
   * Sort topics
   */
  async sortBy(sortType: 'recent' | 'popular' | 'replies' | 'views'): Promise<void> {
    await this.page.click(`[data-testid="sort-${sortType}"], option[value="${sortType}"]`);
    await this.page.waitForTimeout(1000);
  }

  /**
   * Search within category
   */
  async search(query: string): Promise<void> {
    const searchInput = await this.page.$('input[type="search"]');
    if (searchInput) {
      await searchInput.fill(query);
      await this.page.keyboard.press('Enter');
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * Get pinned topics (should appear first)
   */
  async getPinnedTopics(): Promise<{ title: string; id: number }[]> {
    const pinnedSection = await this.page.$('[data-testid="pinned-topics"]');
    if (!pinnedSection) return [];

    const links = await pinnedSection.$$('a[href*="/topics/"]');
    return Promise.all(
      links.map(async link => {
        const href = (await link.getAttribute('href')) || '';
        const match = href.match(/\/topics\/(\d+)/);
        return {
          title: (await link.textContent()) || '',
          id: match ? parseInt(match[1], 10) : 0,
        };
      })
    );
  }

  /**
   * Get topic count
   */
  async getTopicCount(): Promise<number> {
    const topics = await this.getTopics();
    return topics.length;
  }

  /**
   * Verify page loaded successfully
   */
  async verifyLoaded(): Promise<boolean> {
    const name = await this.getCategoryName();
    return name.length > 0;
  }
}
