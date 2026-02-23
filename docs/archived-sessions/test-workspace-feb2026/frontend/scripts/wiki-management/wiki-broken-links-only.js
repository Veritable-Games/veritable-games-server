#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'forums.db');

try {
  const db = new Database(dbPath);
  console.log('🔍 SEARCHING FOR BROKEN WIKI LINKS ONLY\n');

  // Get unique wiki pages only (no duplicates)
  const pages = db
    .prepare(
      `
    SELECT DISTINCT
      p.slug,
      p.title,
      r.content
    FROM wiki_pages p
    LEFT JOIN wiki_revisions r ON p.id = r.page_id
    WHERE p.status = 'published' AND r.content IS NOT NULL
    GROUP BY p.slug
    ORDER BY p.title
  `
    )
    .all();

  console.log(`📊 Found ${pages.length} unique wiki pages\n`);

  // Create set of all existing slugs
  const existingSlugs = new Set(pages.map(p => p.slug));

  // Find all broken WikiLinks
  const brokenLinks = [];

  for (const page of pages) {
    if (!page.content) continue;

    // Find all WikiLinks in content
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    let match;

    while ((match = wikiLinkRegex.exec(page.content)) !== null) {
      const linkText = match[1];
      const [slug, displayText] = linkText.split('|');
      const targetSlug = slug.trim().toLowerCase().replace(/\s+/g, '-');

      // Remove fragments for checking
      const baseSlug = targetSlug.split('#')[0];

      if (!existingSlugs.has(baseSlug)) {
        brokenLinks.push({
          sourcePage: page.title,
          sourceSlug: page.slug,
          brokenLink: linkText,
          targetSlug: baseSlug,
          fullMatch: match[0],
        });
      }
    }
  }

  console.log('🚫 BROKEN WIKI LINKS');
  console.log('='.repeat(60));

  if (brokenLinks.length === 0) {
    console.log('✅ No broken WikiLinks found in wiki pages!');
  } else {
    console.log(`❌ Found ${brokenLinks.length} broken WikiLinks:\n`);

    brokenLinks.forEach((link, index) => {
      console.log(`${index + 1}. FROM: "${link.sourcePage}" (${link.sourceSlug})`);
      console.log(`   LINK: ${link.fullMatch}`);
      console.log(`   MISSING TARGET: ${link.targetSlug}`);
      console.log(`   URL: http://localhost:3000/wiki/${link.targetSlug}`);
      console.log('');
    });

    // Show unique missing pages
    const uniqueMissing = [...new Set(brokenLinks.map(link => link.targetSlug))];
    console.log(`📋 UNIQUE MISSING PAGES (${uniqueMissing.length}):`);
    console.log('-'.repeat(40));
    uniqueMissing.forEach((slug, index) => {
      const count = brokenLinks.filter(link => link.targetSlug === slug).length;
      console.log(`${index + 1}. ${slug} (referenced ${count} time${count > 1 ? 's' : ''})`);
      console.log(`   Would be at: http://localhost:3000/wiki/${slug}`);
    });
  }

  console.log('\n📊 SUMMARY');
  console.log('='.repeat(30));
  console.log(`• Unique wiki pages scanned: ${pages.length}`);
  console.log(`• Broken links found: ${brokenLinks.length}`);
  console.log(
    `• Unique missing pages: ${[...new Set(brokenLinks.map(link => link.targetSlug))].length}`
  );

  db.close();
} catch (error) {
  console.error('❌ Error scanning wiki links:', error);
  process.exit(1);
}
