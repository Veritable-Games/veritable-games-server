/**
 * Wiki Auto-Categorization System
 *
 * Provides intelligent categorization for new wiki pages and orphaned pages
 * using content analysis, namespace detection, and pattern matching.
 */

import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

export interface AutoCategorizationResult {
  suggestedCategory: string | null;
  confidence: number; // 0-1 score
  reasoning: string;
  fallbackToUncategorized: boolean;
}

export interface CategoryRule {
  categoryId: string;
  patterns: {
    title?: RegExp[];
    content?: RegExp[];
    namespace?: string[];
    slug?: RegExp[];
  };
  weight: number; // Higher = more important
  description: string;
}

export class WikiAutoCategorizer {
  private rules: CategoryRule[] = [];

  constructor() {
    this.initializeRules();
  }

  private initializeRules() {
    this.rules = [
      // NOXII Game Content
      {
        categoryId: 'noxii',
        patterns: {
          title: [/noxii/i, /status effects?/i, /control scheme/i],
          content: [/noxii/i, /game mechanics/i, /player.*control/i],
          namespace: ['noxii'],
          slug: [/noxii/i],
        },
        weight: 0.9,
        description: 'NOXII game-related content',
      },

      // ON COMMAND Game Content
      {
        categoryId: 'on-command',
        patterns: {
          title: [/on.?command/i, /grand voss/i, /atlas tether/i, /cascade/i],
          content: [/on.?command/i, /space.*station/i, /neural.*implant/i],
          slug: [/on-command/i, /grand-voss/i, /atlas-tether/i],
        },
        weight: 0.9,
        description: 'ON COMMAND game universe content',
      },

      // AUTUMN Game Content
      {
        categoryId: 'autumn',
        patterns: {
          title: [/autumn/i, /mother nature/i, /father fortune/i],
          content: [/autumn/i, /divine.*matriarch/i, /lost.*patriarch/i],
          slug: [/autumn/i, /mother-nature/i, /father-fortune/i],
        },
        weight: 0.9,
        description: 'AUTUMN game content',
      },

      // COSMIC KNIGHTS Game Content
      {
        categoryId: 'cosmic-knights',
        patterns: {
          title: [/cosmic.?knights?/i, /space.*knight/i],
          content: [/cosmic.?knights?/i, /galactic/i],
          slug: [/cosmic-knights?/i],
        },
        weight: 0.9,
        description: 'COSMIC KNIGHTS game content',
      },

      // DODEC Game Content
      {
        categoryId: 'dodec',
        patterns: {
          title: [/dodec/i],
          content: [/dodec/i, /dodecahedron/i],
          slug: [/dodec/i],
        },
        weight: 0.9,
        description: 'DODEC game content',
      },

      // Development/Technical Content
      {
        categoryId: 'development',
        patterns: {
          title: [/development/i, /technical/i, /api/i, /documentation/i],
          content: [/function/i, /class/i, /code/i, /programming/i, /api/i],
          namespace: ['dev', 'api', 'docs'],
        },
        weight: 0.8,
        description: 'Development and technical documentation',
      },

      // Systems and Architecture
      {
        categoryId: 'systems',
        patterns: {
          title: [/system/i, /architecture/i, /infrastructure/i, /protocol/i],
          content: [/system/i, /protocol/i, /network/i, /infrastructure/i],
          slug: [/system/i, /protocol/i, /infrastructure/i],
        },
        weight: 0.8,
        description: 'System architecture and protocols',
      },

      // Tutorials and Guides
      {
        categoryId: 'tutorials',
        patterns: {
          title: [/tutorial/i, /guide/i, /how.?to/i, /walkthrough/i],
          content: [/step.?\d+/i, /tutorial/i, /guide/i, /instructions?/i],
        },
        weight: 0.7,
        description: 'Tutorials and instructional content',
      },

      // Community Content
      {
        categoryId: 'community',
        patterns: {
          title: [/community/i, /guidelines?/i, /rules?/i],
          content: [/community/i, /members?/i, /guidelines?/i, /moderation/i],
        },
        weight: 0.7,
        description: 'Community guidelines and social content',
      },

      // Library/Reference Content
      {
        categoryId: 'uncategorized', // Special case - library content goes to uncategorized for manual review
        patterns: {
          namespace: ['library'],
          slug: [/^library\//i],
          title: [/\.pdf$/i, /manual/i, /reference/i],
          content: [/converted from library/i, /document information/i],
        },
        weight: 0.6,
        description: 'Library and reference documents (needs manual categorization)',
      },
    ];
  }

  /**
   * Analyze a page and suggest the best category
   */
  async categorizePage(pageData: {
    title: string;
    content: string;
    slug: string;
    namespace?: string;
  }): Promise<AutoCategorizationResult> {
    const scores = new Map<string, { score: number; reasons: string[] }>();

    // Initialize all categories with 0 score
    const categories = await this.getCategories();
    categories.forEach(cat => {
      scores.set(cat.id, { score: 0, reasons: [] });
    });

    // Apply rules and calculate scores
    for (const rule of this.rules) {
      const ruleScore = this.calculateRuleScore(pageData, rule);
      if (ruleScore.score > 0) {
        const current = scores.get(rule.categoryId) || { score: 0, reasons: [] };
        current.score += ruleScore.score * rule.weight;
        current.reasons.push(...ruleScore.reasons);
        scores.set(rule.categoryId, current);
      }
    }

    // Find the best match
    let bestCategory: string | null = null;
    let bestScore = 0;
    let bestReasons: string[] = [];

    for (const [categoryId, data] of scores) {
      if (data.score > bestScore) {
        bestScore = data.score;
        bestCategory = categoryId;
        bestReasons = data.reasons;
      }
    }

    // Determine if we should use the suggestion or fall back to uncategorized
    const confidence = Math.min(bestScore, 1.0);
    const shouldFallback = confidence < 0.4 || bestCategory === null;

    return {
      suggestedCategory: shouldFallback ? 'uncategorized' : bestCategory,
      confidence,
      reasoning: shouldFallback
        ? 'No strong category match found, defaulting to Uncategorized for manual review'
        : `Matched "${bestCategory}" based on: ${bestReasons.join(', ')}`,
      fallbackToUncategorized: shouldFallback,
    };
  }

  private calculateRuleScore(
    pageData: { title: string; content: string; slug: string; namespace?: string },
    rule: CategoryRule
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // Check title patterns
    if (rule.patterns.title) {
      for (const pattern of rule.patterns.title) {
        if (pattern.test(pageData.title)) {
          score += 0.4;
          reasons.push(`title matches "${pattern.source}"`);
        }
      }
    }

    // Check content patterns (limited to first 1000 chars for performance)
    if (rule.patterns.content) {
      const contentPreview = pageData.content.substring(0, 1000);
      for (const pattern of rule.patterns.content) {
        if (pattern.test(contentPreview)) {
          score += 0.3;
          reasons.push(`content matches "${pattern.source}"`);
        }
      }
    }

    // Check slug patterns
    if (rule.patterns.slug) {
      for (const pattern of rule.patterns.slug) {
        if (pattern.test(pageData.slug)) {
          score += 0.4;
          reasons.push(`slug matches "${pattern.source}"`);
        }
      }
    }

    // Check namespace
    if (rule.patterns.namespace && pageData.namespace) {
      if (rule.patterns.namespace.includes(pageData.namespace)) {
        score += 0.5;
        reasons.push(`namespace "${pageData.namespace}" matches`);
      }
    }

    return { score: Math.min(score, 1.0), reasons };
  }

  /**
   * Auto-categorize a page during creation
   */
  async autoCategorizePage(pageId: number): Promise<boolean> {
    const page = await this.getPageById(pageId);
    if (!page) {
      return false;
    }

    // Check if page already has categories
    const existingCategoriesResult = await dbAdapter.query(
      `SELECT category_id FROM wiki_page_categories WHERE page_id = $1`,
      [pageId],
      { schema: 'wiki' }
    );

    if (existingCategoriesResult.rows.length > 0) {
      return false; // Already categorized
    }

    // Get the latest revision content
    const revisionResult = await dbAdapter.query(
      `SELECT content FROM wiki_revisions
       WHERE page_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [pageId],
      { schema: 'wiki' }
    );

    const revision = revisionResult.rows[0] as { content: string } | undefined;

    if (!revision) {
      return false;
    }

    // Analyze and categorize
    const result = await this.categorizePage({
      title: page.title,
      content: revision.content,
      slug: page.slug,
      namespace: page.namespace,
    });

    if (result.suggestedCategory) {
      // Add the suggested category
      await dbAdapter.query(
        `INSERT INTO wiki_page_categories (page_id, category_id, added_at)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [pageId, result.suggestedCategory, new Date().toISOString()],
        { schema: 'wiki' }
      );

      // Log the auto-categorization for audit
      logger.error(
        `Auto-categorized page ${pageId} (${page.title}) → ${result.suggestedCategory} (confidence: ${result.confidence.toFixed(2)})`
      );
      logger.error(`Reasoning: ${result.reasoning}`);

      return true;
    }

    return false;
  }

  /**
   * Find and auto-categorize all orphaned pages
   */
  async categorizeOrphanedPages(): Promise<{
    processed: number;
    categorized: number;
    errors: Array<{ pageId: number; error: string }>;
  }> {
    // Find orphaned pages
    const orphanedPagesResult = await dbAdapter.query(
      `SELECT wp.id, wp.title, wp.slug
       FROM wiki_pages wp
       LEFT JOIN wiki_page_categories wpc ON wp.id = wpc.page_id
       WHERE wpc.page_id IS NULL
       AND wp.status = 'published'`,
      [],
      { schema: 'wiki' }
    );

    const orphanedPages = orphanedPagesResult.rows as Array<{
      id: number;
      title: string;
      slug: string;
    }>;

    const results = {
      processed: 0,
      categorized: 0,
      errors: [] as Array<{ pageId: number; error: string }>,
    };

    for (const page of orphanedPages) {
      results.processed++;
      try {
        const success = await this.autoCategorizePage(page.id);
        if (success) {
          results.categorized++;
        }
      } catch (error) {
        results.errors.push({
          pageId: page.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  private async getPageById(pageId: number) {
    const result = await dbAdapter.query(
      `SELECT id, title, slug, namespace, status
       FROM wiki_pages
       WHERE id = $1`,
      [pageId],
      { schema: 'wiki' }
    );

    return result.rows[0] as
      | {
          id: number;
          title: string;
          slug: string;
          namespace: string;
          status: string;
        }
      | undefined;
  }

  private async getCategories(): Promise<Array<{ id: string; name: string }>> {
    const result = await dbAdapter.query(`SELECT id, name FROM wiki_categories ORDER BY name`, [], {
      schema: 'wiki',
    });

    return result.rows as Array<{ id: string; name: string }>;
  }

  /**
   * Add a custom categorization rule
   */
  addRule(rule: CategoryRule): void {
    this.rules.push(rule);
    // Sort by weight descending
    this.rules.sort((a, b) => b.weight - a.weight);
  }

  /**
   * Get all current rules for debugging
   */
  getRules(): CategoryRule[] {
    return [...this.rules];
  }
}

// Export singleton instance
export const wikiAutoCategorizer = new WikiAutoCategorizer();
