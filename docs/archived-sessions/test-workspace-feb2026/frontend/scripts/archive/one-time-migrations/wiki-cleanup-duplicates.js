#!/usr/bin/env node

/**
 * Wiki Category Duplicate Cleanup Script
 *
 * This script finds and fixes duplicate category assignments and other
 * categorization issues in the wiki system.
 */

const path = require('path');
const Database = require('better-sqlite3');

class WikiCategoryCleanup {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
    };

    const dbPath = path.join(process.cwd(), 'data', 'forums.db');
    this.db = new Database(dbPath);
  }

  /**
   * Find all categorization issues
   */
  findIssues() {
    const issues = {
      duplicateCategories: [],
      redundantUncategorized: [],
      orphanedPages: [],
      invalidCategories: [],
    };

    // 1. Find exact duplicate category assignments (same page, same category, multiple entries)
    const duplicates = this.db
      .prepare(
        `
      SELECT page_id, category_id, COUNT(*) as count
      FROM wiki_page_categories
      GROUP BY page_id, category_id
      HAVING count > 1
    `
      )
      .all();

    issues.duplicateCategories = duplicates;

    // 2. Find pages that have both 'uncategorized' and other specific categories
    const redundantUncategorized = this.db
      .prepare(
        `
      SELECT DISTINCT 
        wpc1.page_id,
        wp.title
      FROM wiki_page_categories wpc1
      JOIN wiki_page_categories wpc2 ON wpc1.page_id = wpc2.page_id
      JOIN wiki_pages wp ON wpc1.page_id = wp.id
      WHERE wpc1.category_id = 'uncategorized'
      AND wpc2.category_id != 'uncategorized'
      AND wp.status = 'published'
      ORDER BY wp.title
    `
      )
      .all();

    issues.redundantUncategorized = redundantUncategorized;

    // 3. Find orphaned pages (no categories at all)
    const orphanedPages = this.db
      .prepare(
        `
      SELECT wp.id, wp.title
      FROM wiki_pages wp
      LEFT JOIN wiki_page_categories wpc ON wp.id = wpc.page_id
      WHERE wpc.page_id IS NULL
      AND wp.status = 'published'
      ORDER BY wp.title
    `
      )
      .all();

    issues.orphanedPages = orphanedPages;

    // 4. Find invalid category references
    const invalidCategories = this.db
      .prepare(
        `
      SELECT DISTINCT wpc.category_id
      FROM wiki_page_categories wpc
      LEFT JOIN wiki_categories wc ON wpc.category_id = wc.id
      WHERE wc.id IS NULL
    `
      )
      .all();

    issues.invalidCategories = invalidCategories;

    return issues;
  }

  /**
   * Fix duplicate category assignments
   */
  fixDuplicateCategories(duplicates) {
    let fixed = 0;

    for (const duplicate of duplicates) {
      if (this.options.verbose) {
        console.log(
          `Fixing duplicate: Page ${duplicate.page_id}, Category ${duplicate.category_id} (${duplicate.count} entries)`
        );
      }

      if (!this.options.dryRun) {
        // Keep only the oldest entry (first one inserted)
        const deleteResult = this.db
          .prepare(
            `
          DELETE FROM wiki_page_categories
          WHERE page_id = ? AND category_id = ? AND rowid NOT IN (
            SELECT MIN(rowid) 
            FROM wiki_page_categories 
            WHERE page_id = ? AND category_id = ?
          )
        `
          )
          .run(duplicate.page_id, duplicate.category_id, duplicate.page_id, duplicate.category_id);

        fixed += deleteResult.changes;
      } else {
        fixed += duplicate.count - 1; // Would remove all but one
      }
    }

    return fixed;
  }

  /**
   * Remove redundant 'uncategorized' assignments
   */
  fixRedundantUncategorized(redundantUncategorized) {
    let fixed = 0;

    if (!this.options.dryRun && redundantUncategorized.length > 0) {
      const deleteResult = this.db
        .prepare(
          `
        DELETE FROM wiki_page_categories
        WHERE category_id = 'uncategorized'
        AND page_id IN (
          SELECT DISTINCT wpc.page_id
          FROM wiki_page_categories wpc
          WHERE wpc.category_id != 'uncategorized'
        )
      `
        )
        .run();

      fixed = deleteResult.changes;
    } else {
      fixed = redundantUncategorized.length;
    }

    return fixed;
  }

  /**
   * Auto-categorize orphaned pages
   */
  fixOrphanedPages(orphanedPages) {
    let fixed = 0;

    for (const page of orphanedPages) {
      if (this.options.verbose) {
        console.log(`Auto-categorizing orphaned page: ${page.title} (ID: ${page.id})`);
      }

      if (!this.options.dryRun) {
        try {
          const insertResult = this.db
            .prepare(
              `
            INSERT INTO wiki_page_categories (page_id, category_id, added_at)
            VALUES (?, 'uncategorized', ?)
          `
            )
            .run(page.id, new Date().toISOString());

          if (insertResult.changes > 0) {
            fixed++;
          }
        } catch (error) {
          console.error(`Failed to categorize page ${page.id}: ${error.message}`);
        }
      } else {
        fixed++;
      }
    }

    return fixed;
  }

  /**
   * Remove invalid category references
   */
  fixInvalidCategories(invalidCategories) {
    let fixed = 0;

    for (const invalid of invalidCategories) {
      if (this.options.verbose) {
        console.log(`Removing invalid category reference: ${invalid.category_id}`);
      }

      if (!this.options.dryRun) {
        const deleteResult = this.db
          .prepare(
            `
          DELETE FROM wiki_page_categories
          WHERE category_id = ?
        `
          )
          .run(invalid.category_id);

        fixed += deleteResult.changes;
      } else {
        // Count how many would be removed
        const count = this.db
          .prepare(
            `
          SELECT COUNT(*) as count
          FROM wiki_page_categories
          WHERE category_id = ?
        `
          )
          .get(invalid.category_id);

        fixed += count.count;
      }
    }

    return fixed;
  }

  /**
   * Main cleanup function
   */
  async run() {
    console.log('🧹 Wiki Category Cleanup Script');
    console.log('=================================');

    if (this.options.dryRun) {
      console.log('🔥 DRY RUN MODE - No changes will be made');
    }
    console.log('');

    // Find all issues
    console.log('🔍 Scanning for categorization issues...');
    const issues = this.findIssues();

    // Report findings
    console.log(`\n📊 Issues Found:`);
    console.log(`  Duplicate category assignments: ${issues.duplicateCategories.length}`);
    console.log(`  Pages with redundant 'uncategorized': ${issues.redundantUncategorized.length}`);
    console.log(`  Orphaned pages (no categories): ${issues.orphanedPages.length}`);
    console.log(`  Invalid category references: ${issues.invalidCategories.length}`);

    if (this.options.verbose) {
      if (issues.duplicateCategories.length > 0) {
        console.log('\n🔥 Duplicate Category Assignments:');
        issues.duplicateCategories.forEach(dup => {
          console.log(
            `  - Page ${dup.page_id}, Category "${dup.category_id}": ${dup.count} entries`
          );
        });
      }

      if (issues.redundantUncategorized.length > 0) {
        console.log('\n⚠️  Pages with Redundant "Uncategorized":');
        issues.redundantUncategorized.forEach(page => {
          console.log(`  - ${page.title} (ID: ${page.page_id})`);
        });
      }

      if (issues.orphanedPages.length > 0) {
        console.log('\n📄 Orphaned Pages:');
        issues.orphanedPages.forEach(page => {
          console.log(`  - ${page.title} (ID: ${page.id})`);
        });
      }

      if (issues.invalidCategories.length > 0) {
        console.log('\n❌ Invalid Category References:');
        issues.invalidCategories.forEach(cat => {
          console.log(`  - "${cat.category_id}"`);
        });
      }
    }

    // Fix issues
    const results = {
      duplicatesFixed: 0,
      redundantFixed: 0,
      orphansFixed: 0,
      invalidFixed: 0,
    };

    if (issues.duplicateCategories.length > 0) {
      console.log('\n🔧 Fixing duplicate category assignments...');
      results.duplicatesFixed = this.fixDuplicateCategories(issues.duplicateCategories);
      console.log(`✅ Fixed ${results.duplicatesFixed} duplicate assignments`);
    }

    if (issues.redundantUncategorized.length > 0) {
      console.log('\n🔧 Removing redundant "uncategorized" assignments...');
      results.redundantFixed = this.fixRedundantUncategorized(issues.redundantUncategorized);
      console.log(`✅ Removed ${results.redundantFixed} redundant "uncategorized" assignments`);
    }

    if (issues.orphanedPages.length > 0) {
      console.log('\n🔧 Categorizing orphaned pages...');
      results.orphansFixed = this.fixOrphanedPages(issues.orphanedPages);
      console.log(`✅ Categorized ${results.orphansFixed} orphaned pages`);
    }

    if (issues.invalidCategories.length > 0) {
      console.log('\n🔧 Removing invalid category references...');
      results.invalidFixed = this.fixInvalidCategories(issues.invalidCategories);
      console.log(`✅ Removed ${results.invalidFixed} invalid category references`);
    }

    // Final verification
    console.log('\n📊 Final Status:');
    const totalPages = this.db
      .prepare('SELECT COUNT(*) as count FROM wiki_pages WHERE status = ?')
      .get('published').count;
    const categorizedPages = this.db
      .prepare('SELECT COUNT(DISTINCT page_id) as count FROM wiki_page_categories')
      .get().count;

    console.log(`Total published pages: ${totalPages}`);
    console.log(`Total categorized pages: ${categorizedPages}`);
    console.log(`All pages categorized: ${totalPages === categorizedPages ? '✅' : '❌'}`);

    const totalFixed =
      results.duplicatesFixed +
      results.redundantFixed +
      results.orphansFixed +
      results.invalidFixed;

    if (totalFixed === 0) {
      console.log('\n✨ No issues found - wiki categories are clean!');
    } else {
      console.log(`\n🎉 Fixed ${totalFixed} categorization issues!`);
      if (this.options.dryRun) {
        console.log('   (Run without --dry-run to apply changes)');
      }
    }
  }

  close() {
    this.db.close();
  }
}

// CLI interface
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Wiki Category Cleanup Script

Usage: node scripts/wiki-cleanup-duplicates.js [options]

Options:
  --dry-run         Show what would be fixed without making changes
  --verbose         Show detailed output for each issue
  --help, -h        Show this help message

This script finds and fixes:
- Duplicate category assignments (same page in same category multiple times)
- Redundant 'uncategorized' assignments (pages that have both specific categories and uncategorized)
- Orphaned pages (pages with no categories)
- Invalid category references (references to non-existent categories)
`);
      process.exit(0);
    }
  }

  return options;
}

if (require.main === module) {
  const options = parseArgs();
  const cleanup = new WikiCategoryCleanup(options);

  cleanup
    .run()
    .then(() => {
      cleanup.close();
    })
    .catch(error => {
      console.error('Cleanup failed:', error);
      cleanup.close();
      process.exit(1);
    });
}

module.exports = WikiCategoryCleanup;
