#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'forums.db');

try {
  const db = new Database(dbPath);
  console.log('📋 COMPLETE WIKI INVENTORY\n');

  // Get all published wiki pages with their details
  const pages = db
    .prepare(
      `
    SELECT 
      p.id,
      p.slug,
      p.title,
      p.namespace,
      p.status,
      GROUP_CONCAT(c.name) as categories,
      GROUP_CONCAT(t.name) as tags,
      r.content,
      LENGTH(r.content) as content_length,
      p.created_at,
      p.updated_at
    FROM wiki_pages p
    LEFT JOIN wiki_revisions r ON p.id = r.page_id
    LEFT JOIN wiki_page_categories pc ON p.id = pc.page_id
    LEFT JOIN wiki_categories c ON pc.category_id = c.id
    LEFT JOIN wiki_page_tags pt ON p.id = pt.page_id
    LEFT JOIN wiki_tags t ON pt.tag_id = t.id
    WHERE p.status = 'published'
    GROUP BY p.id
    ORDER BY p.title
  `
    )
    .all();

  console.log(`📊 TOTAL WIKI PAGES: ${pages.length}\n`);

  // Group by category
  const categoryGroups = {};
  const uncategorized = [];

  pages.forEach(page => {
    if (page.categories) {
      const cats = page.categories.split(',');
      cats.forEach(cat => {
        const categoryName = cat.trim();
        if (!categoryGroups[categoryName]) {
          categoryGroups[categoryName] = [];
        }
        categoryGroups[categoryName].push(page);
      });
    } else {
      uncategorized.push(page);
    }
  });

  // Display by category
  console.log('📂 PAGES BY CATEGORY:');
  console.log('='.repeat(50));

  Object.keys(categoryGroups)
    .sort()
    .forEach(category => {
      console.log(`\n📁 ${category} (${categoryGroups[category].length} pages):`);
      categoryGroups[category].forEach((page, index) => {
        const contentSize = page.content_length ? `${page.content_length} chars` : 'no content';
        console.log(`   ${index + 1}. "${page.title}" (${page.slug}) - ${contentSize}`);
      });
    });

  if (uncategorized.length > 0) {
    console.log(`\n📁 UNCATEGORIZED (${uncategorized.length} pages):`);
    uncategorized.forEach((page, index) => {
      const contentSize = page.content_length ? `${page.content_length} chars` : 'no content';
      console.log(`   ${index + 1}. "${page.title}" (${page.slug}) - ${contentSize}`);
    });
  }

  // Show all available slugs for reference
  console.log('\n🔗 ALL AVAILABLE SLUGS:');
  console.log('='.repeat(50));
  const slugs = pages.map(p => p.slug).sort();
  slugs.forEach((slug, index) => {
    console.log(`${(index + 1).toString().padStart(3)}. ${slug}`);
  });

  // Category statistics
  console.log('\n📊 CATEGORY STATISTICS:');
  console.log('='.repeat(30));
  const categoryStats = Object.keys(categoryGroups)
    .map(cat => ({
      category: cat,
      count: categoryGroups[cat].length,
    }))
    .sort((a, b) => b.count - a.count);

  categoryStats.forEach(stat => {
    console.log(`• ${stat.category}: ${stat.count} pages`);
  });

  if (uncategorized.length > 0) {
    console.log(`• Uncategorized: ${uncategorized.length} pages`);
  }

  console.log('\n📋 SUMMARY:');
  console.log(`• Total pages: ${pages.length}`);
  console.log(`• Categories: ${Object.keys(categoryGroups).length}`);
  console.log(`• Uncategorized pages: ${uncategorized.length}`);

  db.close();
} catch (error) {
  console.error('❌ Error creating wiki inventory:', error);
  process.exit(1);
}
