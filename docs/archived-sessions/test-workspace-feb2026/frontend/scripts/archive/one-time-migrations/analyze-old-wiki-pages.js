const Database = require('better-sqlite3');
const path = require('path');

const mainDbPath = path.join(__dirname, '../data/main.db');
const mainDb = new Database(mainDbPath, { readonly: true });

const oldPageSlugs = [
  'community-guidelines',
  'getting-started',
  'political-messaging-strategy',
  'the-enact-dialogue-system-03122023',
];

console.log('=== Detailed Analysis of Old Wiki Pages ===\n');

oldPageSlugs.forEach(slug => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Page: ${slug}`);
  console.log('='.repeat(60));

  // Get page details
  const page = mainDb
    .prepare(
      `
    SELECT * FROM wiki_pages WHERE slug = ?
  `
    )
    .get(slug);

  if (!page) {
    console.log('  ERROR: Page not found!');
    return;
  }

  console.log('\n📄 Page Details:');
  console.log(`  ID: ${page.id}`);
  console.log(`  Title: ${page.title}`);
  console.log(`  Namespace: ${page.namespace || 'main'}`);
  console.log(`  Status: ${page.status || 'published'}`);
  console.log(`  Category: ${page.category_id || 'uncategorized'}`);
  console.log(`  Created: ${page.created_at}`);
  console.log(`  Updated: ${page.updated_at}`);
  console.log(`  Created By: ${page.created_by || 'unknown'}`);

  // Get revision count
  const revisions = mainDb
    .prepare(
      `
    SELECT
      id,
      author_id,
      revision_timestamp,
      summary,
      LENGTH(content) as content_length
    FROM wiki_revisions
    WHERE page_id = ?
    ORDER BY revision_timestamp DESC
  `
    )
    .all(page.id);

  console.log(`\n📝 Revisions: ${revisions.length}`);
  if (revisions.length > 0) {
    console.log('  Latest revision:');
    const latest = revisions[0];
    console.log(`    ID: ${latest.id}`);
    console.log(`    Date: ${latest.revision_timestamp}`);
    console.log(`    Author: ${latest.author_id || 'unknown'}`);
    console.log(`    Summary: ${latest.summary || '(no summary)'}`);
    console.log(`    Content Length: ${latest.content_length} bytes`);

    if (revisions.length > 1) {
      console.log(`  ... and ${revisions.length - 1} older revision(s)`);
    }
  }

  // Get tags
  const tags = mainDb
    .prepare(
      `
    SELECT wt.name
    FROM wiki_page_tags wpt
    JOIN wiki_tags wt ON wpt.tag_id = wt.id
    WHERE wpt.page_id = ?
  `
    )
    .all(page.id);

  console.log(`\n🏷️  Tags: ${tags.length}`);
  if (tags.length > 0) {
    tags.forEach(tag => console.log(`    - ${tag.name}`));
  }

  // Get page views
  const views = mainDb
    .prepare(
      `
    SELECT COUNT(*) as count, SUM(view_count) as total_views
    FROM wiki_page_views
    WHERE page_id = ?
  `
    )
    .get(page.id);

  if (views && views.total_views) {
    console.log(`\n👁️  Views: ${views.total_views}`);
  }

  // Get links to this page
  const inboundLinks = mainDb
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM wiki_page_links
    WHERE target_page_id = ?
  `
    )
    .get(page.id);

  console.log(`\n🔗 Inbound Links: ${inboundLinks.count}`);
});

console.log('\n\n' + '='.repeat(60));
console.log('Summary');
console.log('='.repeat(60));

const totalRevisions = mainDb
  .prepare(
    `
  SELECT COUNT(*) as count
  FROM wiki_revisions wr
  JOIN wiki_pages wp ON wr.page_id = wp.id
  WHERE wp.slug IN (?, ?, ?, ?)
`
  )
  .get(...oldPageSlugs);

const totalTags = mainDb
  .prepare(
    `
  SELECT COUNT(*) as count
  FROM wiki_page_tags wpt
  JOIN wiki_pages wp ON wpt.page_id = wp.id
  WHERE wp.slug IN (?, ?, ?, ?)
`
  )
  .get(...oldPageSlugs);

const totalViews = mainDb
  .prepare(
    `
  SELECT SUM(view_count) as total
  FROM wiki_page_views wpv
  JOIN wiki_pages wp ON wpv.page_id = wp.id
  WHERE wp.slug IN (?, ?, ?, ?)
`
  )
  .get(...oldPageSlugs);

console.log(`\nTotal pages to migrate: ${oldPageSlugs.length}`);
console.log(`Total revisions: ${totalRevisions.count}`);
console.log(`Total tags: ${totalTags.count}`);
console.log(`Total views: ${totalViews.total || 0}`);

mainDb.close();
