/**
 * Check if project content exists in wiki.db
 */

const Database = require('better-sqlite3');
const path = require('path');

const WIKI_DB_PATH = path.join(__dirname, '../data/wiki.db');
const CONTENT_DB_PATH = path.join(__dirname, '../data/content.db');

console.log('🔍 Checking for project content in wiki.db...\n');

const wikiDb = new Database(WIKI_DB_PATH);
const contentDb = new Database(CONTENT_DB_PATH);

try {
  // Check wiki.db for project pages
  const wikiProjectPages = wikiDb
    .prepare(
      `
    SELECT slug, title, LENGTH(content) as content_length, namespace
    FROM wiki_pages
    WHERE namespace = 'project' OR slug LIKE 'project:%'
    ORDER BY slug
  `
    )
    .all();

  console.log('📄 Project pages in wiki.db:');
  if (wikiProjectPages.length === 0) {
    console.log('  ❌ No project pages found in wiki.db\n');
  } else {
    console.log(`  ✅ Found ${wikiProjectPages.length} project page(s):\n`);
    wikiProjectPages.forEach(page => {
      console.log(`  - ${page.slug}`);
      console.log(`    Title: ${page.title}`);
      console.log(`    Namespace: ${page.namespace}`);
      console.log(`    Content: ${page.content_length} bytes\n`);
    });
  }

  // Check content.db for current projects
  const contentProjects = contentDb
    .prepare(
      `
    SELECT slug, title, LENGTH(content) as content_length
    FROM projects
    ORDER BY slug
  `
    )
    .all();

  console.log('📊 Projects in content.db:');
  if (contentProjects.length === 0) {
    console.log('  ❌ No projects found in content.db\n');
  } else {
    console.log(`  ✅ Found ${contentProjects.length} project(s):\n`);
    contentProjects.forEach(project => {
      console.log(`  - ${project.slug}`);
      console.log(`    Title: ${project.title}`);
      console.log(`    Content: ${project.content_length || 0} bytes\n`);
    });
  }

  // Summary
  console.log('📝 Summary:');
  console.log(`  Wiki project pages: ${wikiProjectPages.length}`);
  console.log(`  Content.db projects: ${contentProjects.length}`);

  if (wikiProjectPages.length > 0) {
    console.log('\n✨ Migration needed: Project content exists in wiki.db');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  wikiDb.close();
  contentDb.close();
}
