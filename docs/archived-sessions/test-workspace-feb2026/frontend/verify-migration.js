const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function verify() {
  console.log('\n🔍 Verifying Migration Results\n');

  // Check wiki pages
  const wikiPages = await pool.query(`
    SELECT id, slug, title, category_id, created_at
    FROM wiki.wiki_pages
    WHERE slug LIKE 'archive/%'
    ORDER BY slug
  `);

  console.log(`✅ Wiki Archive Pages Created: ${wikiPages.rows.length}`);
  wikiPages.rows.forEach(row => {
    console.log(`   - ${row.slug} (${row.title})`);
  });

  // Check revisions count
  const revisionCounts = await pool.query(`
    SELECT wp.slug, wp.title, COUNT(wr.id) as revision_count
    FROM wiki.wiki_pages wp
    LEFT JOIN wiki.wiki_revisions wr ON wp.id = wr.page_id
    WHERE wp.slug LIKE 'archive/%'
    GROUP BY wp.id, wp.slug, wp.title
    ORDER BY wp.slug
  `);

  console.log(`\n📝 Revision History:`);
  revisionCounts.rows.forEach(row => {
    console.log(`   - ${row.slug}: ${row.revision_count} revision(s)`);
  });

  // Check that project content was cleared
  const projects = await pool.query(`
    SELECT slug, title, LENGTH(content) as content_length
    FROM content.projects
    WHERE slug IN ('noxii', 'autumn', 'dodec', 'on-command', 'cosmic-knights', 'project-coalesce')
    ORDER BY slug
  `);

  console.log(`\n🗑️  Project Content Cleared:`);
  projects.rows.forEach(row => {
    const status =
      row.content_length === 0 ? '✅ CLEARED' : `⚠️  ${row.content_length} chars remaining`;
    console.log(`   - ${row.slug}: ${status}`);
  });

  await pool.end();
  console.log('\n✅ Verification Complete!\n');
}

verify().catch(console.error);
