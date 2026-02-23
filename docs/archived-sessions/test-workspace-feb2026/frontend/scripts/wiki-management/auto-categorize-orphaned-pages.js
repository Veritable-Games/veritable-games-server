#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'forums.db');

try {
  const db = new Database(dbPath);

  console.log('🤖 AUTO-CATEGORIZING ORPHANED WIKI PAGES\n');

  // First, get all uncategorized pages
  const uncategorizedPages = db
    .prepare(
      `
    SELECT p.id, p.slug, p.title, p.status
    FROM wiki_pages p
    WHERE p.status = 'published'
    AND p.id NOT IN (
      SELECT DISTINCT page_id FROM wiki_page_categories WHERE page_id IS NOT NULL
    )
    ORDER BY p.title
  `
    )
    .all();

  console.log(`Found ${uncategorizedPages.length} uncategorized pages to process\n`);

  // Categorization rules based on content analysis
  const categorizePage = (content, slug, title) => {
    const text = content.toLowerCase();

    // Game project detection (highest priority)
    if (
      text.includes('noxii') ||
      text.includes('death game') ||
      text.includes('skydiving') ||
      text.includes('vatra')
    ) {
      return 'noxii';
    }
    if (text.includes('dodec') || text.includes('reconstruction') || text.includes('post-war')) {
      return 'dodec';
    }
    if (text.includes('on command') || text.includes('resistance') || text.includes('liberation')) {
      return 'on-command';
    }
    if (
      text.includes('autumn') ||
      text.includes('seasonal') ||
      text.includes('nature') ||
      slug.includes('autumn')
    ) {
      return 'autumn';
    }
    if (
      text.includes('cosmic knights') ||
      text.includes('corruption') ||
      text.includes('crystal')
    ) {
      return 'cosmic-knights';
    }

    // System type detection (medium priority)
    if (
      text.includes('currency system') ||
      text.includes('economic system') ||
      text.includes('tracking system') ||
      text.includes('escalation system') ||
      text.includes('identity system') ||
      slug.includes('system')
    ) {
      return 'systems';
    }
    if (
      text.includes('development') ||
      text.includes('guidelines') ||
      text.includes('standards') ||
      text.includes('tutorial')
    ) {
      return 'development';
    }
    if (text.includes('character') || text.includes('npc') || text.includes('personality')) {
      return 'characters';
    }
    if (
      text.includes('equipment') ||
      text.includes('tools') ||
      text.includes('items') ||
      text.includes('weapons')
    ) {
      return 'equipment';
    }
    if (
      text.includes('location') ||
      text.includes('world-building') ||
      text.includes('environment') ||
      text.includes('megastructures')
    ) {
      return 'world';
    }

    // Fallback category
    return 'unorganized';
  };

  // Process each uncategorized page
  let categorized = 0;
  let newCategories = [];
  const categoryStats = {};

  for (const page of uncategorizedPages) {
    // Get page content
    const content = db
      .prepare(
        `
      SELECT content FROM wiki_revisions 
      WHERE page_id = ? 
      ORDER BY revision_timestamp DESC 
      LIMIT 1
    `
      )
      .get(page.id);

    if (content) {
      const suggestedCategory = categorizePage(content.content, page.slug, page.title);

      // Track category statistics
      if (!categoryStats[suggestedCategory]) {
        categoryStats[suggestedCategory] = 0;
      }
      categoryStats[suggestedCategory]++;

      console.log(`📂 ${page.title} → "${suggestedCategory}"`);

      // Insert into wiki_page_categories
      try {
        db.prepare(
          `
          INSERT OR IGNORE INTO wiki_page_categories (page_id, category_id) 
          VALUES (?, ?)
        `
        ).run(page.id, suggestedCategory);

        categorized++;

        // Track new categories that don't exist yet
        if (!newCategories.includes(suggestedCategory)) {
          const existingCategory = db
            .prepare(
              `
            SELECT COUNT(*) as count FROM wiki_page_categories WHERE category_id = ?
          `
            )
            .get(suggestedCategory);

          if (existingCategory.count === 1) {
            // Just added first page to this category
            newCategories.push(suggestedCategory);
          }
        }
      } catch (error) {
        console.error(`   ❌ Failed to categorize ${page.title}: ${error.message}`);
      }
    }
  }

  // Create the "unorganized" category if it was used and doesn't exist
  if (categoryStats['unorganized'] > 0) {
    console.log(
      '\n🗂️  Created "unorganized" category for pages that couldn\'t be automatically classified'
    );
  }

  console.log('\n📊 AUTO-CATEGORIZATION RESULTS:');
  console.log('===============================');
  console.log(`✅ Successfully categorized: ${categorized} pages`);
  console.log(
    `🆕 New categories used: ${newCategories.length > 0 ? newCategories.join(', ') : 'none'}`
  );

  console.log('\nCategory distribution:');
  Object.entries(categoryStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`  - ${category}: ${count} pages`);
    });

  // Now let's also check for pages that still need internal linking
  console.log('\n🔗 ANALYZING REMAINING ORPHANED LINKS:');
  console.log('=====================================');

  const stillOrphaned = db
    .prepare(
      `
    SELECT p.id, p.slug, p.title, p.status
    FROM wiki_pages p
    WHERE p.status = 'published'
    AND p.slug NOT IN (
      SELECT DISTINCT target_slug FROM wiki_page_links WHERE target_slug IS NOT NULL
    )
    ORDER BY p.title
    LIMIT 10
  `
    )
    .all();

  console.log(
    `Pages still with no incoming links: ${stillOrphaned.length > 0 ? stillOrphaned.length : 'checking...'}`
  );

  if (stillOrphaned.length > 0) {
    console.log('\nTop 10 pages that still need internal links:');
    stillOrphaned.slice(0, 10).forEach(page => {
      console.log(`  - ${page.title} (${page.slug})`);
    });
  }

  // Final verification
  const finalUncategorized = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM wiki_pages p
    WHERE p.status = 'published'
    AND p.id NOT IN (
      SELECT DISTINCT page_id FROM wiki_page_categories WHERE page_id IS NOT NULL
    )
  `
    )
    .get();

  console.log(`\n🎯 Final uncategorized pages remaining: ${finalUncategorized.count}`);

  // Summary of all categories now
  const allCategories = db
    .prepare(
      `
    SELECT DISTINCT category_id, COUNT(page_id) as page_count
    FROM wiki_page_categories 
    GROUP BY category_id
    ORDER BY page_count DESC
  `
    )
    .all();

  console.log('\n📋 COMPLETE CATEGORY STRUCTURE:');
  console.log('===============================');
  allCategories.forEach(cat => {
    const isNew = newCategories.includes(cat.category_id);
    console.log(`  ${isNew ? '🆕' : '  '} ${cat.category_id}: ${cat.page_count} pages`);
  });

  db.close();

  console.log('\n🎉 AUTO-CATEGORIZATION COMPLETE!');
  console.log(`   - Processed ${uncategorizedPages.length} orphaned pages`);
  console.log(`   - Successfully categorized ${categorized} pages`);
  console.log(`   - Remaining uncategorized: ${finalUncategorized.count}`);

  if (newCategories.length > 0) {
    console.log(`   - New categories created: ${newCategories.join(', ')}`);
  }
} catch (error) {
  console.error('❌ Error during auto-categorization:', error);
  process.exit(1);
}
