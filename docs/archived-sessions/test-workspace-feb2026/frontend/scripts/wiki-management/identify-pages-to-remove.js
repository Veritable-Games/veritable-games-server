const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'forums.db');
const db = new Database(dbPath);

console.log('🗑️ PAGES RECOMMENDED FOR REMOVAL:\n');

// Find any remaining cosmic knights content scattered in NULL project
const scatteredCosmicPages = db
  .prepare(
    `
  SELECT slug, title
  FROM wiki_pages 
  WHERE project_slug IS NULL 
    AND (slug LIKE '%cosmic%' OR title LIKE '%Cosmic%' OR slug LIKE '%knight%')
  ORDER BY title
`
  )
  .all();

// Find cooperative/coordination pages that might be duplicates of Banner Command
const cooperativePages = db
  .prepare(
    `
  SELECT slug, title
  FROM wiki_pages 
  WHERE project_slug IS NULL 
    AND (slug LIKE '%cooper%' OR slug LIKE '%coord%' OR title LIKE '%Coop%' OR title LIKE '%Coord%')
  ORDER BY title
`
  )
  .all();

// Find any remaining individual system pages that might conflict
const conflictingPages = db
  .prepare(
    `
  SELECT slug, title
  FROM wiki_pages 
  WHERE project_slug IS NULL 
    AND (slug LIKE '%enemy-types%' OR slug LIKE '%fractures-seals%' OR slug LIKE '%customization-unlocks%' OR slug LIKE '%controls-camera%')
  ORDER BY title
`
  )
  .all();

let totalToRemove = 0;

if (scatteredCosmicPages.length > 0) {
  console.log('🤖 SCATTERED COSMIC KNIGHTS PAGES:');
  scatteredCosmicPages.forEach(page => {
    console.log(`   ❌ ${page.title} (${page.slug})`);
    totalToRemove++;
  });
  console.log('   → Already consolidated into cosmic-knights project\n');
}

if (cooperativePages.length > 0) {
  console.log('🤝 COOPERATIVE/COORDINATION PAGES:');
  cooperativePages.forEach(page => {
    console.log(`   ❌ ${page.title} (${page.slug})`);
    totalToRemove++;
  });
  console.log('   → Already consolidated into Banner Command System\n');
}

if (conflictingPages.length > 0) {
  console.log('⚔️ CONFLICTING SYSTEM PAGES:');
  conflictingPages.forEach(page => {
    console.log(`   ❌ ${page.title} (${page.slug})`);
    totalToRemove++;
  });
  console.log('   → Replaced by new horde survival framework\n');
}

if (totalToRemove > 0) {
  const allPages = [...scatteredCosmicPages, ...cooperativePages, ...conflictingPages];
  const slugsToRemove = allPages.map(p => `'${p.slug}'`).join(',\n  ');

  console.log('💻 MANUAL REMOVAL SCRIPT:');
  console.log('You can remove these pages with this SQL:');
  console.log('```sql');
  console.log('DELETE FROM wiki_page_categories WHERE page_id IN (');
  console.log(`  SELECT id FROM wiki_pages WHERE slug IN (${slugsToRemove})`);
  console.log(');');
  console.log('DELETE FROM wiki_revisions WHERE page_id IN (');
  console.log(`  SELECT id FROM wiki_pages WHERE slug IN (${slugsToRemove})`);
  console.log(');');
  console.log('DELETE FROM wiki_pages WHERE slug IN (');
  console.log(`  ${slugsToRemove}`);
  console.log(');');
  console.log('```\n');

  console.log(`📊 TOTAL PAGES TO REMOVE: ${totalToRemove}`);
  console.log('📋 PAGES TO KEEP: 9 focused Cosmic Knights framework pages');
} else {
  console.log('✅ EXCELLENT! NO ADDITIONAL PAGES NEED REMOVAL');
  console.log('🎯 Your consolidation is complete and clean!');

  // Show what you have
  const finalPages = db
    .prepare(
      `
    SELECT title 
    FROM wiki_pages 
    WHERE project_slug = 'cosmic-knights' 
    ORDER BY title
  `
    )
    .all();

  console.log(`\n🏆 FINAL COSMIC KNIGHTS FRAMEWORK (${finalPages.length} pages):`);
  finalPages.forEach((page, i) => {
    console.log(`   ${i + 1}️⃣  ${page.title}`);
  });
}

db.close();
