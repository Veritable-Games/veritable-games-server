const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../data/wiki.db'), { readonly: true });

const migratedSlugs = [
  'community-guidelines',
  'getting-started',
  'the-enact-dialogue-system-03122023',
];

console.log('=== Final Migration Verification ===\n');

let allPassed = true;

migratedSlugs.forEach(slug => {
  console.log(`Testing: ${slug}`);

  // Test 1: Page exists and has correct structure
  const page = db.prepare('SELECT * FROM wiki_pages WHERE slug = ?').get(slug);
  if (!page) {
    console.log('  ❌ FAIL: Page not found');
    allPassed = false;
    return;
  }
  console.log(`  ✓ Page exists (ID: ${page.id})`);

  // Test 2: Has at least one revision
  const revCount = db
    .prepare('SELECT COUNT(*) as count FROM wiki_revisions WHERE page_id = ?')
    .get(page.id);
  if (revCount.count === 0) {
    console.log('  ❌ FAIL: No revisions found');
    allPassed = false;
    return;
  }
  console.log(`  ✓ Has ${revCount.count} revision(s)`);

  // Test 3: Latest revision has content
  const latest = db
    .prepare(
      'SELECT LENGTH(content) as len FROM wiki_revisions WHERE page_id = ? ORDER BY revision_timestamp DESC LIMIT 1'
    )
    .get(page.id);
  if (!latest || latest.len === 0) {
    console.log('  ❌ FAIL: No content in latest revision');
    allPassed = false;
    return;
  }
  console.log(`  ✓ Latest revision has ${latest.len} bytes of content`);

  // Test 4: Category is valid
  const category = db
    .prepare('SELECT name FROM wiki_categories WHERE id = ?')
    .get(page.category_id);
  if (!category) {
    console.log('  ❌ FAIL: Invalid category');
    allPassed = false;
    return;
  }
  console.log(`  ✓ Valid category: ${category.name}`);

  // Test 5: Page is in FTS5 search index
  const inSearch = db.prepare('SELECT rowid FROM wiki_search WHERE rowid = ?').get(page.id);
  if (!inSearch) {
    console.log('  ❌ FAIL: Not in search index');
    allPassed = false;
    return;
  }
  console.log('  ✓ Indexed in FTS5 search');

  console.log('');
});

console.log('\n=== Test Summary ===');
if (allPassed) {
  console.log('✅ All tests passed! Migration verified successfully.');
  console.log('\nMigrated pages are ready for use in the application.');
  console.log('\nAccess URLs:');
  console.log('  - /wiki/community-guidelines');
  console.log('  - /wiki/getting-started');
  console.log('  - /wiki/the-enact-dialogue-system-03122023');
} else {
  console.log('❌ Some tests failed. Review errors above.');
}

db.close();
