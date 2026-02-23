#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'forums.db');

try {
  const db = new Database(dbPath);

  console.log('🔍 ANALYZING ORPHANED WIKI PAGES\n');

  // 1. Find pages with no categories
  console.log('1. 📂 PAGES WITH NO CATEGORIES:');
  console.log('===============================\n');

  const uncategorizedPages = db
    .prepare(
      `
    SELECT p.id, p.slug, p.title, p.status, LENGTH(r.content) as content_length
    FROM wiki_pages p
    JOIN wiki_revisions r ON p.id = r.page_id
    WHERE r.revision_timestamp = (SELECT MAX(r2.revision_timestamp) FROM wiki_revisions r2 WHERE r2.page_id = p.id)
    AND p.status = 'published'
    AND p.id NOT IN (
      SELECT DISTINCT page_id FROM wiki_page_categories WHERE page_id IS NOT NULL
    )
    ORDER BY p.title
  `
    )
    .all();

  if (uncategorizedPages.length > 0) {
    console.log(`Found ${uncategorizedPages.length} uncategorized pages:`);
    uncategorizedPages.forEach(page => {
      console.log(`  - ${page.title} (${page.slug}) - ${page.content_length} chars`);
    });
  } else {
    console.log('✅ No uncategorized pages found');
  }

  // 2. Find pages with no incoming links (true orphans)
  console.log('\n2. 🔗 PAGES WITH NO INCOMING LINKS:');
  console.log('===================================\n');

  const orphanedPages = db
    .prepare(
      `
    SELECT p.id, p.slug, p.title, p.status, LENGTH(r.content) as content_length
    FROM wiki_pages p
    JOIN wiki_revisions r ON p.id = r.page_id
    WHERE r.revision_timestamp = (SELECT MAX(r2.revision_timestamp) FROM wiki_revisions r2 WHERE r2.page_id = p.id)
    AND p.status = 'published'
    AND p.slug NOT IN (
      SELECT DISTINCT target_slug FROM wiki_page_links WHERE target_slug IS NOT NULL
    )
    ORDER BY p.title
  `
    )
    .all();

  if (orphanedPages.length > 0) {
    console.log(`Found ${orphanedPages.length} pages with no incoming links:`);
    orphanedPages.forEach(page => {
      console.log(`  - ${page.title} (${page.slug}) - ${page.content_length} chars`);
    });
  } else {
    console.log('✅ No orphaned pages found');
  }

  // 3. Find pages that are both uncategorized AND have no incoming links
  console.log('\n3. ⚠️  TRULY ORPHANED PAGES (no categories + no incoming links):');
  console.log('==============================================================\n');

  const trulyOrphaned = db
    .prepare(
      `
    SELECT p.id, p.slug, p.title, p.status, LENGTH(r.content) as content_length
    FROM wiki_pages p
    JOIN wiki_revisions r ON p.id = r.page_id
    WHERE r.revision_timestamp = (SELECT MAX(r2.revision_timestamp) FROM wiki_revisions r2 WHERE r2.page_id = p.id)
    AND p.status = 'published'
    AND p.id NOT IN (
      SELECT DISTINCT page_id FROM wiki_page_categories WHERE page_id IS NOT NULL
    )
    AND p.slug NOT IN (
      SELECT DISTINCT target_slug FROM wiki_page_links WHERE target_slug IS NOT NULL
    )
    ORDER BY p.title
  `
    )
    .all();

  if (trulyOrphaned.length > 0) {
    console.log(`Found ${trulyOrphaned.length} truly orphaned pages:`);
    trulyOrphaned.forEach(page => {
      console.log(`  - ${page.title} (${page.slug}) - ${page.content_length} chars`);
    });
  } else {
    console.log('✅ No truly orphaned pages found');
  }

  // 4. Check what categories currently exist
  console.log('\n4. 📋 CURRENT CATEGORY STRUCTURE:');
  console.log('=================================\n');

  const categories = db
    .prepare(
      `
    SELECT DISTINCT category_id, COUNT(page_id) as page_count
    FROM wiki_page_categories 
    GROUP BY category_id
    ORDER BY page_count DESC
  `
    )
    .all();

  if (categories.length > 0) {
    console.log('Current categories:');
    categories.forEach(cat => {
      console.log(`  - ${cat.category_id}: ${cat.page_count} pages`);
    });
  }

  // 5. Check if 'unorganized' category already exists
  const unorganizedExists = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM wiki_page_categories WHERE category_id = 'unorganized'
  `
    )
    .get();

  console.log(`\n'unorganized' category exists: ${unorganizedExists.count > 0 ? 'YES' : 'NO'}`);

  // 6. Analyze content to suggest better categorization
  console.log('\n5. 🤖 CONTENT ANALYSIS FOR SMART CATEGORIZATION:');
  console.log('===============================================\n');

  if (uncategorizedPages.length > 0) {
    console.log('Analyzing content for automatic categorization...');

    const analysisResults = [];

    uncategorizedPages.forEach(page => {
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
        const text = content.content.toLowerCase();
        let suggestedCategory = 'unorganized';

        // Game project detection
        if (text.includes('noxii') || text.includes('death game') || text.includes('skydiving')) {
          suggestedCategory = 'noxii';
        } else if (text.includes('dodec') || text.includes('reconstruction')) {
          suggestedCategory = 'dodec';
        } else if (text.includes('on command') || text.includes('resistance')) {
          suggestedCategory = 'on-command';
        } else if (text.includes('autumn') || text.includes('seasonal')) {
          suggestedCategory = 'autumn';
        } else if (text.includes('cosmic knights')) {
          suggestedCategory = 'cosmic-knights';
        }

        // System type detection
        else if (text.includes('system') || text.includes('mechanic')) {
          suggestedCategory = 'systems';
        } else if (text.includes('character') || text.includes('npc')) {
          suggestedCategory = 'characters';
        } else if (text.includes('location') || text.includes('world')) {
          suggestedCategory = 'world';
        } else if (text.includes('equipment') || text.includes('item')) {
          suggestedCategory = 'equipment';
        } else if (text.includes('design') || text.includes('development')) {
          suggestedCategory = 'development';
        }

        analysisResults.push({
          ...page,
          suggestedCategory,
          contentPreview: text.substring(0, 100) + '...',
        });
      }
    });

    console.log('Content analysis results:');
    analysisResults.forEach(result => {
      console.log(`  - ${result.title}: suggested '${result.suggestedCategory}'`);
      console.log(`    Preview: ${result.contentPreview}`);
    });

    // Group by suggested category
    const categoryGroups = {};
    analysisResults.forEach(page => {
      if (!categoryGroups[page.suggestedCategory]) categoryGroups[page.suggestedCategory] = [];
      categoryGroups[page.suggestedCategory].push(page);
    });

    console.log('\nSuggested categorization summary:');
    Object.entries(categoryGroups).forEach(([category, pages]) => {
      console.log(`  ${category}: ${pages.length} pages`);
    });
  }

  console.log('\n📊 ORPHANED PAGES SUMMARY:');
  console.log('==========================');
  console.log(`- Uncategorized pages: ${uncategorizedPages.length}`);
  console.log(`- Pages with no incoming links: ${orphanedPages.length}`);
  console.log(`- Truly orphaned (both): ${trulyOrphaned.length}`);
  console.log(`- Current categories: ${categories.length}`);

  db.close();
  console.log('\n✅ Orphaned pages analysis complete');
} catch (error) {
  console.error('❌ Error analyzing orphaned pages:', error);
  process.exit(1);
}
