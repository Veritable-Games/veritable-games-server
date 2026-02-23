#!/usr/bin/env node

/**
 * Generate Recent Wiki Activity
 * Creates varied edits to random wiki pages to populate activity feeds
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/wiki.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Get all published wiki pages with their latest content from revisions
const pages = db
  .prepare(
    `
  SELECT
    p.id,
    p.slug,
    p.title,
    r.content
  FROM wiki_pages p
  LEFT JOIN (
    SELECT page_id, content, MAX(revision_timestamp) as latest
    FROM wiki_revisions
    GROUP BY page_id
  ) r ON p.id = r.page_id
  WHERE p.status = 'published' AND r.content IS NOT NULL
`
  )
  .all();

if (pages.length === 0) {
  console.log('No wiki pages found. Please create some pages first.');
  process.exit(0);
}

console.log(`Found ${pages.length} wiki pages. Generating activity...`);

// Different types of edits with varied content changes
const editTypes = [
  {
    name: 'Grammar fix',
    summary: 'Fixed typo',
    modify: content => {
      // Just return content as-is (minor edit)
      return content;
    },
    isMinor: true,
  },
  {
    name: 'Add section',
    summary: 'Added new section with additional information',
    modify: content => {
      const sections = [
        '\n\n## Additional Notes\n\nThis section provides supplementary information for reference.',
        '\n\n## See Also\n\n- Related topic 1\n- Related topic 2',
        '\n\n## References\n\n1. Reference source\n2. Additional reading',
      ];
      return content + sections[Math.floor(Math.random() * sections.length)];
    },
    isMinor: false,
  },
  {
    name: 'Update content',
    summary: 'Updated information to reflect current status',
    modify: content => {
      // Add a timestamp note
      return content + `\n\n*Last updated: ${new Date().toLocaleDateString()}*`;
    },
    isMinor: false,
  },
  {
    name: 'Formatting improvement',
    summary: 'Improved formatting and readability',
    modify: content => {
      // Minor formatting change
      return content.replace(/\n\n\n+/g, '\n\n'); // Normalize spacing
    },
    isMinor: true,
  },
  {
    name: 'Content expansion',
    summary: 'Expanded content with more details',
    modify: content => {
      const additions = [
        '\n\nThis has been expanded to provide more comprehensive coverage of the topic.',
        '\n\n### Background\n\nProviding additional context and background information.',
        '\n\n### Overview\n\nA detailed overview of the key concepts.',
      ];
      return content + additions[Math.floor(Math.random() * additions.length)];
    },
    isMinor: false,
  },
  {
    name: 'Link addition',
    summary: 'Added internal links to related pages',
    modify: content => {
      return content + '\n\n---\n*See also: [Related Topic](#)*';
    },
    isMinor: true,
  },
];

// Get admin user for making edits
let adminUser = db.prepare('SELECT id, username FROM users WHERE role = ? LIMIT 1').get('admin');

if (!adminUser) {
  console.log('No admin user found. Creating default admin user...');
  db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
    'WikiBot',
    'wikibot@example.com',
    '$2a$12$dummyhash',
    'admin'
  );
  adminUser = db.prepare('SELECT id, username FROM users WHERE username = ?').get('WikiBot');
}

console.log(`Using author: ${adminUser.username} (ID: ${adminUser.id})`);

// Select random subset of pages (between 5-15 pages)
const numEdits = Math.min(Math.floor(Math.random() * 10) + 5, pages.length);
const selectedPages = [];
const pagesCopy = [...pages];

for (let i = 0; i < numEdits; i++) {
  const randomIndex = Math.floor(Math.random() * pagesCopy.length);
  selectedPages.push(pagesCopy.splice(randomIndex, 1)[0]);
}

console.log(`\nGenerating ${numEdits} edits across different pages...\n`);

// Generate edits
const transaction = db.transaction(() => {
  selectedPages.forEach((page, index) => {
    // Select random edit type
    const editType = editTypes[Math.floor(Math.random() * editTypes.length)];

    // Modify content
    const newContent = editType.modify(page.content);
    const contentBytes = Buffer.from(newContent, 'utf8').length;

    // Create revision
    const revisionStmt = db.prepare(`
      INSERT INTO wiki_revisions (
        page_id, content, summary, content_format,
        author_id, is_minor, size_bytes, revision_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-${numEdits - index} minutes'))
    `);

    const result = revisionStmt.run(
      page.id,
      newContent,
      editType.summary,
      'markdown',
      adminUser.id,
      editType.isMinor ? 1 : 0,
      contentBytes
    );

    // Update page timestamp (content is in revisions, not wiki_pages)
    db.prepare(
      `
      UPDATE wiki_pages
      SET updated_at = datetime('now', '-${numEdits - index} minutes')
      WHERE id = ?
    `
    ).run(page.id);

    console.log(`✓ [${editType.isMinor ? 'MINOR' : 'MAJOR'}] ${page.title}`);
    console.log(`  → ${editType.summary}`);
    console.log(`  → Revision ID: ${result.lastInsertRowid}`);
    console.log('');
  });
});

try {
  transaction();
  console.log(`\n✅ Successfully generated ${numEdits} edits!`);
  console.log(`\nYou can now view recent activity at:`);
  console.log(`  - Wiki landing page: http://localhost:3000/wiki`);
  console.log(`  - Any page history: http://localhost:3000/wiki/[slug]/history`);
} catch (error) {
  console.error('Error generating activity:', error);
  process.exit(1);
} finally {
  db.close();
}
