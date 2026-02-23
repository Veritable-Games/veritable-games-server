#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'forums.db');

try {
  const db = new Database(dbPath);
  console.log('🔍 Searching for broken WikiLinks in forums...\n');

  // Get all existing wiki page slugs
  const wikiPages = db
    .prepare(
      `
    SELECT slug FROM wiki_pages WHERE status = 'published'
  `
    )
    .all();

  const existingSlugs = new Set(wikiPages.map(p => p.slug));
  console.log(`📊 Found ${existingSlugs.size} existing wiki pages\n`);

  // Get all forum content that might contain WikiLinks
  const forumContent = db
    .prepare(
      `
    SELECT 
      'topic' as type,
      t.id,
      t.title,
      t.content,
      'N/A' as topic_title
    FROM forum_topics t
    WHERE t.content IS NOT NULL AND t.content != ''
    
    UNION ALL
    
    SELECT 
      'reply' as type,
      r.id,
      'Reply to: ' || t.title as title,
      r.content,
      t.title as topic_title
    FROM forum_replies r
    JOIN forum_topics t ON r.topic_id = t.id
    WHERE r.content IS NOT NULL AND r.content != ''
  `
    )
    .all();

  console.log(`📝 Scanning ${forumContent.length} forum posts and replies...\n`);

  const brokenLinks = [];

  for (const item of forumContent) {
    if (!item.content) continue;

    // Find all WikiLinks in the content
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    let match;

    while ((match = wikiLinkRegex.exec(item.content)) !== null) {
      const linkText = match[1];
      const [slug, displayText] = linkText.split('|');
      const targetSlug = slug.trim().toLowerCase().replace(/\s+/g, '-');

      // Remove fragments for checking
      const baseSlug = targetSlug.split('#')[0];

      if (!existingSlugs.has(baseSlug)) {
        brokenLinks.push({
          type: item.type,
          id: item.id,
          title: item.title,
          topicTitle: item.topic_title,
          brokenLink: linkText,
          targetSlug: baseSlug,
          fullMatch: match[0],
        });
      }
    }
  }

  console.log('🚫 BROKEN FORUM LINKS FOUND');
  console.log('='.repeat(60));

  if (brokenLinks.length === 0) {
    console.log('✅ No broken WikiLinks found in forums!');
  } else {
    console.log(`❌ Found ${brokenLinks.length} broken WikiLinks:\n`);

    // Group by type
    const topicLinks = brokenLinks.filter(link => link.type === 'topic');
    const replyLinks = brokenLinks.filter(link => link.type === 'reply');

    if (topicLinks.length > 0) {
      console.log(`📋 BROKEN LINKS IN TOPICS (${topicLinks.length}):`);
      console.log('-'.repeat(40));
      topicLinks.forEach((link, index) => {
        console.log(`${index + 1}. Topic: "${link.title}"`);
        console.log(`   Link: ${link.fullMatch}`);
        console.log(`   Target: ${link.targetSlug} (MISSING)`);
        console.log(`   Forum Topic ID: ${link.id}\n`);
      });
    }

    if (replyLinks.length > 0) {
      console.log(`💬 BROKEN LINKS IN REPLIES (${replyLinks.length}):`);
      console.log('-'.repeat(40));
      replyLinks.forEach((link, index) => {
        console.log(`${index + 1}. Reply in: "${link.topicTitle}"`);
        console.log(`   Link: ${link.fullMatch}`);
        console.log(`   Target: ${link.targetSlug} (MISSING)`);
        console.log(`   Reply ID: ${link.id}\n`);
      });
    }

    // Show unique missing pages
    const uniqueMissing = [...new Set(brokenLinks.map(link => link.targetSlug))];
    console.log(`📋 UNIQUE MISSING PAGES (${uniqueMissing.length}):`);
    console.log('-'.repeat(40));
    uniqueMissing.forEach((slug, index) => {
      const count = brokenLinks.filter(link => link.targetSlug === slug).length;
      console.log(`${index + 1}. ${slug} (referenced ${count} time${count > 1 ? 's' : ''})`);
    });
  }

  console.log('\n📊 SUMMARY');
  console.log('='.repeat(30));
  console.log(`• Total forum items scanned: ${forumContent.length}`);
  console.log(`• Broken links found: ${brokenLinks.length}`);
  console.log(
    `• Unique missing pages: ${[...new Set(brokenLinks.map(link => link.targetSlug))].length}`
  );
  console.log(`• Topics with broken links: ${topicLinks.length}`);
  console.log(`• Replies with broken links: ${replyLinks.length}`);

  db.close();
} catch (error) {
  console.error('❌ Error scanning forum links:', error);
  process.exit(1);
}
