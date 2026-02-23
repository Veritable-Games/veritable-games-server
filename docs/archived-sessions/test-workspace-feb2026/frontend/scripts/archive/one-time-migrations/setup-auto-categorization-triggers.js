#!/usr/bin/env node

/**
 * Setup Database Triggers for Wiki Auto-Categorization
 *
 * This script sets up SQLite triggers that automatically assign orphaned
 * wiki pages to the 'uncategorized' category. This ensures that no page
 * ever remains completely uncategorized.
 *
 * The triggers handle:
 * 1. New page creation without categories
 * 2. Category removal that leaves a page orphaned
 * 3. Page restoration/status changes
 */

const path = require('path');
const Database = require('better-sqlite3');

class AutoCategorizationTriggerSetup {
  constructor() {
    const dbPath = path.join(process.cwd(), 'data', 'forums.db');
    this.db = new Database(dbPath);

    console.log('🔧 Setting up auto-categorization triggers...');
  }

  /**
   * Create the auto-categorization triggers
   */
  setupTriggers() {
    // Trigger 1: Auto-categorize new published pages that don't get categories
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS auto_categorize_new_pages
      AFTER UPDATE OF status ON wiki_pages
      WHEN NEW.status = 'published' AND OLD.status != 'published'
      BEGIN
        INSERT OR IGNORE INTO wiki_page_categories (page_id, category_id, added_at)
        SELECT 
          NEW.id,
          'uncategorized',
          datetime('now')
        WHERE NOT EXISTS (
          SELECT 1 FROM wiki_page_categories 
          WHERE page_id = NEW.id
        );
      END;
    `);

    // Trigger 2: Auto-categorize when all categories are removed from a page
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS auto_categorize_orphaned_pages
      AFTER DELETE ON wiki_page_categories
      WHEN NOT EXISTS (
        SELECT 1 FROM wiki_page_categories 
        WHERE page_id = OLD.page_id
      )
      AND EXISTS (
        SELECT 1 FROM wiki_pages 
        WHERE id = OLD.page_id AND status = 'published'
      )
      BEGIN
        INSERT INTO wiki_page_categories (page_id, category_id, added_at)
        VALUES (OLD.page_id, 'uncategorized', datetime('now'));
      END;
    `);

    // Trigger 3: Handle immediate auto-categorization for new pages
    // Note: This is a backup trigger for pages that slip through
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS auto_categorize_immediate
      AFTER INSERT ON wiki_pages
      WHEN NEW.status = 'published'
      BEGIN
        -- Wait a moment for any explicit categorization, then auto-categorize if needed
        INSERT OR IGNORE INTO wiki_page_categories (page_id, category_id, added_at)
        SELECT 
          NEW.id,
          'uncategorized',
          datetime('now')
        WHERE NOT EXISTS (
          SELECT 1 FROM wiki_page_categories 
          WHERE page_id = NEW.id
        );
      END;
    `);

    console.log('✅ Auto-categorization triggers created successfully');
  }

  /**
   * Remove existing triggers (for cleanup/reinstall)
   */
  removeTriggers() {
    const triggers = [
      'auto_categorize_new_pages',
      'auto_categorize_orphaned_pages',
      'auto_categorize_immediate',
    ];

    triggers.forEach(triggerName => {
      try {
        this.db.exec(`DROP TRIGGER IF EXISTS ${triggerName}`);
        console.log(`🗑️  Removed trigger: ${triggerName}`);
      } catch (error) {
        console.log(`⚠️  Could not remove trigger ${triggerName}: ${error.message}`);
      }
    });
  }

  /**
   * Test the triggers by creating a test page
   */
  testTriggers() {
    console.log('🧪 Testing auto-categorization triggers...');

    const transaction = this.db.transaction(() => {
      // Create a test page
      const insertPage = this.db.prepare(`
        INSERT INTO wiki_pages (slug, title, namespace, status, created_by)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = insertPage.run(
        'test-auto-categorization-' + Date.now(),
        'Test Auto-Categorization Page',
        'test',
        'published',
        1
      );

      const pageId = result.lastInsertRowid;

      // Create a test revision
      const insertRevision = this.db.prepare(`
        INSERT INTO wiki_revisions (page_id, content, summary, content_format, author_id, size_bytes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      insertRevision.run(
        pageId,
        'This is a test page for auto-categorization',
        'Test page creation',
        'markdown',
        1,
        39
      );

      return pageId;
    });

    const testPageId = transaction();

    // Check if the page was auto-categorized
    const categorized = this.db
      .prepare(
        `
      SELECT category_id FROM wiki_page_categories 
      WHERE page_id = ?
    `
      )
      .get(testPageId);

    if (categorized && categorized.category_id === 'uncategorized') {
      console.log('✅ Trigger test PASSED - Page auto-categorized to "uncategorized"');

      // Clean up test page
      this.db.prepare('DELETE FROM wiki_page_categories WHERE page_id = ?').run(testPageId);
      this.db.prepare('DELETE FROM wiki_revisions WHERE page_id = ?').run(testPageId);
      this.db.prepare('DELETE FROM wiki_pages WHERE id = ?').run(testPageId);
      console.log('🧹 Test page cleaned up');

      return true;
    } else {
      console.log('❌ Trigger test FAILED - Page was not auto-categorized');

      // Still clean up
      this.db.prepare('DELETE FROM wiki_page_categories WHERE page_id = ?').run(testPageId);
      this.db.prepare('DELETE FROM wiki_revisions WHERE page_id = ?').run(testPageId);
      this.db.prepare('DELETE FROM wiki_pages WHERE id = ?').run(testPageId);

      return false;
    }
  }

  /**
   * Show current trigger status
   */
  showTriggerStatus() {
    const triggers = this.db
      .prepare(
        `
      SELECT name, sql 
      FROM sqlite_master 
      WHERE type = 'trigger' 
      AND name LIKE 'auto_categorize_%'
      ORDER BY name
    `
      )
      .all();

    console.log('\n📋 Current auto-categorization triggers:');

    if (triggers.length === 0) {
      console.log('   No triggers found');
    } else {
      triggers.forEach((trigger, index) => {
        console.log(`   ${index + 1}. ${trigger.name}`);
      });
    }

    return triggers;
  }

  /**
   * Manually categorize existing orphaned pages
   */
  categorizeExistingOrphans() {
    console.log('🔄 Categorizing existing orphaned pages...');

    const result = this.db
      .prepare(
        `
      INSERT OR IGNORE INTO wiki_page_categories (page_id, category_id, added_at)
      SELECT 
        wp.id,
        'uncategorized',
        datetime('now')
      FROM wiki_pages wp
      LEFT JOIN wiki_page_categories wpc ON wp.id = wpc.page_id
      WHERE wpc.page_id IS NULL
      AND wp.status = 'published'
    `
      )
      .run();

    console.log(`✅ Categorized ${result.changes} orphaned pages`);
    return result.changes;
  }

  close() {
    this.db.close();
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const action = args[0] || 'setup';

  const setup = new AutoCategorizationTriggerSetup();

  try {
    switch (action) {
      case 'setup':
      case 'install':
        setup.setupTriggers();
        setup.categorizeExistingOrphans();
        if (setup.testTriggers()) {
          console.log('\n🎉 Auto-categorization system is ready!');
        }
        break;

      case 'remove':
      case 'uninstall':
        setup.removeTriggers();
        console.log('✅ Triggers removed');
        break;

      case 'test':
        if (setup.testTriggers()) {
          console.log('✅ All tests passed');
        } else {
          console.log('❌ Tests failed');
          process.exit(1);
        }
        break;

      case 'status':
        setup.showTriggerStatus();
        break;

      case 'categorize':
        const count = setup.categorizeExistingOrphans();
        console.log(`✅ Categorized ${count} orphaned pages`);
        break;

      case 'help':
      default:
        console.log(`
Auto-Categorization Trigger Setup

Usage: node scripts/setup-auto-categorization-triggers.js [command]

Commands:
  setup     Create auto-categorization triggers (default)
  remove    Remove all auto-categorization triggers  
  test      Test that triggers are working correctly
  status    Show current trigger status
  categorize Manually categorize existing orphaned pages
  help      Show this help message

The triggers automatically assign orphaned wiki pages to the 'uncategorized'
category, ensuring no page is ever completely without a category.
`);
        break;
    }
  } finally {
    setup.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = AutoCategorizationTriggerSetup;
