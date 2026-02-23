const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('./data/forums.db');

try {
  const pages = [
    {
      slug: 'prisoner-daily-life',
      title: 'Prisoner Daily Life (NOXII)',
      file: 'prisoner-daily-life.md',
      summary:
        'Added comprehensive prisoner daily life documentation including routines, underground economy, and resistance coordination',
    },
    {
      slug: 'imperial-infrastructure-vulnerabilities',
      title: 'Imperial Infrastructure & Vulnerabilities',
      file: 'imperial-infrastructure-vulnerabilities.md',
      summary:
        'Created detailed Imperial infrastructure documentation with exploitable weaknesses and resistance opportunities',
    },
  ];

  const transaction = db.transaction(() => {
    const noxiiCategory = db.prepare('SELECT id FROM wiki_categories WHERE name = ?').get('NOXII');

    if (!noxiiCategory) {
      console.log('❌ NOXII category not found');
      return;
    }

    pages.forEach(page => {
      // Check if page exists
      const existing = db.prepare('SELECT id FROM wiki_pages WHERE slug = ?').get(page.slug);

      if (!existing) {
        // Read content
        const content = fs.readFileSync(page.file, 'utf8');

        // Insert page
        const insertPage = db.prepare(`
          INSERT INTO wiki_pages (slug, title, namespace, status, created_by)
          VALUES (?, ?, ?, ?, ?)
        `);

        const pageResult = insertPage.run(page.slug, page.title, 'main', 'published', 1);

        // Insert revision
        const insertRevision = db.prepare(`
          INSERT INTO wiki_revisions (page_id, content, summary, author_id, size_bytes)
          VALUES (?, ?, ?, ?, ?)
        `);

        insertRevision.run(
          pageResult.lastInsertRowid,
          content,
          page.summary,
          1,
          Buffer.byteLength(content, 'utf8')
        );

        // Add to category
        db.prepare('INSERT INTO wiki_page_categories (page_id, category_id) VALUES (?, ?)').run(
          pageResult.lastInsertRowid,
          noxiiCategory.id
        );

        console.log(`✅ Created ${page.title}`);
      } else {
        console.log(`⚠️ ${page.title} already exists`);
      }
    });
  });

  transaction();
  console.log('\n🌍 Phase 4 Progress: World-building gaps filled');
} catch (error) {
  console.error('❌ Error:', error);
} finally {
  db.close();
}
