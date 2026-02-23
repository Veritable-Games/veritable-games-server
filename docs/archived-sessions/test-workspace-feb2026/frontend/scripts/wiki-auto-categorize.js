#!/usr/bin/env node

/**
 * Wiki Auto-Categorization Maintenance Script
 *
 * This script automatically categorizes orphaned wiki pages using the
 * auto-categorization system. Can be run manually or scheduled as a cron job.
 *
 * Usage:
 *   node scripts/wiki-auto-categorize.js [options]
 *
 * Options:
 *   --dry-run       Show what would be categorized without making changes
 *   --verbose       Show detailed output
 *   --category=X    Only suggest pages for specific category
 *   --confidence=X  Minimum confidence threshold (0.0-1.0, default: 0.4)
 */

const path = require('path');
const Database = require('better-sqlite3');

class WikiAutoCategorizeScript {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
      targetCategory: options.category || null,
      minConfidence: parseFloat(options.confidence) || 0.4,
    };

    // Database connection
    const dbPath = path.join(process.cwd(), 'data', 'forums.db');
    this.db = new Database(dbPath);

    // Initialize categorization rules
    this.initializeRules();
  }

  initializeRules() {
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
    ];
  }

  /**
   * Find all orphaned pages (no categories assigned)
   */
  getOrphanedPages() {
    return this.db
      .prepare(
        `
      SELECT 
        wp.id, 
        wp.title, 
        wp.slug, 
        wp.namespace,
        r.content
      FROM wiki_pages wp
      LEFT JOIN wiki_page_categories wpc ON wp.id = wpc.page_id
      LEFT JOIN wiki_revisions r ON wp.id = r.page_id 
        AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = wp.id)
      WHERE wpc.page_id IS NULL
      AND wp.status = 'published'
      ORDER BY wp.title
    `
      )
      .all();
  }

  /**
   * Analyze a page and suggest the best category
   */
  categorizePage(pageData) {
    const scores = new Map();

    // Initialize all categories with 0 score
    const categories = this.getCategories();
    categories.forEach(cat => {
      scores.set(cat.id, { score: 0, reasons: [] });
    });

    // Apply rules and calculate scores
    for (const rule of this.rules) {
      if (this.options.targetCategory && rule.categoryId !== this.options.targetCategory) {
        continue; // Skip if we're only looking for specific category
      }

      const ruleScore = this.calculateRuleScore(pageData, rule);
      if (ruleScore.score > 0) {
        const current = scores.get(rule.categoryId) || { score: 0, reasons: [] };
        current.score += ruleScore.score * rule.weight;
        current.reasons.push(...ruleScore.reasons);
        scores.set(rule.categoryId, current);
      }
    }

    // Find the best match
    let bestCategory = null;
    let bestScore = 0;
    let bestReasons = [];

    for (const [categoryId, data] of scores) {
      if (data.score > bestScore) {
        bestScore = data.score;
        bestCategory = categoryId;
        bestReasons = data.reasons;
      }
    }

    // Determine if we should use the suggestion or fall back to uncategorized
    const confidence = Math.min(bestScore, 1.0);
    const shouldFallback = confidence < this.options.minConfidence || bestCategory === null;

    return {
      suggestedCategory: shouldFallback ? 'uncategorized' : bestCategory,
      confidence,
      reasoning: shouldFallback
        ? `No strong category match found (confidence: ${confidence.toFixed(2)}), defaulting to Uncategorized`
        : `Matched "${bestCategory}" based on: ${bestReasons.join(', ')}`,
      fallbackToUncategorized: shouldFallback,
    };
  }

  calculateRuleScore(pageData, rule) {
    let score = 0;
    const reasons = [];

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
    if (rule.patterns.content && pageData.content) {
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

  getCategories() {
    return this.db
      .prepare(
        `
      SELECT id, name FROM wiki_categories
      ORDER BY name
    `
      )
      .all();
  }

  /**
   * Apply categorization to a page (with duplicate protection)
   */
  applyCategorizationToPage(pageId, categoryId) {
    if (this.options.dryRun) {
      return true; // Simulate success
    }

    try {
      // Check if this page already has this specific category
      const existingCategory = this.db
        .prepare(
          `
        SELECT 1 FROM wiki_page_categories 
        WHERE page_id = ? AND category_id = ?
      `
        )
        .get(pageId, categoryId);

      if (existingCategory) {
        if (this.options.verbose) {
          console.log(`   ⚠️  Page already has category ${categoryId}, skipping`);
        }
        return false; // Already has this category
      }

      // Insert the new category
      const insertCategory = this.db.prepare(`
        INSERT INTO wiki_page_categories (page_id, category_id, added_at)
        VALUES (?, ?, ?)
      `);

      insertCategory.run(pageId, categoryId, new Date().toISOString());
      return true;
    } catch (error) {
      console.error(`Failed to categorize page ${pageId}:`, error.message);
      return false;
    }
  }

  /**
   * Main execution function
   */
  async run() {
    console.log('🔍 Wiki Auto-Categorization Script');
    console.log('=====================================');

    if (this.options.dryRun) {
      console.log('🔥 DRY RUN MODE - No changes will be made');
    }

    if (this.options.targetCategory) {
      console.log(`🎯 Target category: ${this.options.targetCategory}`);
    }

    console.log(`📊 Minimum confidence: ${this.options.minConfidence}`);
    console.log('');

    // Get orphaned pages
    const orphanedPages = this.getOrphanedPages();
    console.log(`📄 Found ${orphanedPages.length} orphaned pages`);

    if (orphanedPages.length === 0) {
      console.log('✅ No orphaned pages found! All pages are properly categorized.');
      return;
    }

    const results = {
      processed: 0,
      categorized: 0,
      fallbacks: 0,
      errors: [],
    };

    // Process each orphaned page
    for (const page of orphanedPages) {
      results.processed++;

      if (this.options.verbose) {
        console.log(`\n📖 Processing: ${page.title} (ID: ${page.id})`);
      }

      try {
        // Analyze the page
        const analysis = this.categorizePage({
          title: page.title,
          content: page.content || '',
          slug: page.slug,
          namespace: page.namespace,
        });

        if (this.options.verbose) {
          console.log(`   Suggested: ${analysis.suggestedCategory}`);
          console.log(`   Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
          console.log(`   Reasoning: ${analysis.reasoning}`);
        }

        // Apply categorization if confidence meets threshold
        if (
          analysis.confidence >= this.options.minConfidence ||
          analysis.suggestedCategory === 'uncategorized'
        ) {
          const success = this.applyCategorizationToPage(page.id, analysis.suggestedCategory);

          if (success) {
            results.categorized++;
            if (analysis.fallbackToUncategorized) {
              results.fallbacks++;
            }

            if (!this.options.verbose) {
              console.log(
                `✅ ${page.title} → ${analysis.suggestedCategory} (${(analysis.confidence * 100).toFixed(1)}%)`
              );
            }
          } else {
            results.errors.push(`Failed to categorize ${page.title}`);
          }
        } else {
          if (this.options.verbose) {
            console.log(
              `   ⚠️  Skipped (confidence too low: ${(analysis.confidence * 100).toFixed(1)}%)`
            );
          }
        }
      } catch (error) {
        results.errors.push(`Error processing ${page.title}: ${error.message}`);
        if (this.options.verbose) {
          console.log(`   ❌ Error: ${error.message}`);
        }
      }
    }

    // Show summary
    console.log('\n📊 Summary:');
    console.log('===========');
    console.log(`Processed: ${results.processed} pages`);
    console.log(`Categorized: ${results.categorized} pages`);
    console.log(`Fell back to Uncategorized: ${results.fallbacks} pages`);
    console.log(`Errors: ${results.errors.length}`);

    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (results.categorized > 0) {
      console.log(`\n✅ Successfully auto-categorized ${results.categorized} pages!`);
      if (this.options.dryRun) {
        console.log('   (Run without --dry-run to apply changes)');
      }
    }
  }
}

// CLI argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg.startsWith('--category=')) {
      options.category = arg.split('=')[1];
    } else if (arg.startsWith('--confidence=')) {
      options.confidence = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Wiki Auto-Categorization Script

Usage: node scripts/wiki-auto-categorize.js [options]

Options:
  --dry-run         Show what would be categorized without making changes
  --verbose         Show detailed output for each page
  --category=X      Only suggest pages for specific category
  --confidence=X    Minimum confidence threshold (0.0-1.0, default: 0.4)
  --help, -h        Show this help message

Examples:
  node scripts/wiki-auto-categorize.js --dry-run --verbose
  node scripts/wiki-auto-categorize.js --category=noxii
  node scripts/wiki-auto-categorize.js --confidence=0.6
`);
      process.exit(0);
    }
  }

  return options;
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  const script = new WikiAutoCategorizeScript(options);

  script.run().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = WikiAutoCategorizeScript;
