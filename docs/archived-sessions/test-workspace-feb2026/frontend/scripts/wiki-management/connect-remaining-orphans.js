#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'forums.db');

try {
  const db = new Database(dbPath);

  console.log('🔗 CONNECTING REMAINING ORPHANED PAGES\n');

  // Define specific connections for orphaned pages
  const orphanConnections = [
    // DODEC character pages - connect to community overview
    {
      slugs: [
        'josefine-strand',
        'vivian-holt',
        'lorens-nass',
        'kalisa-bast',
        'sorrel-amor',
        'wilmet-edith',
        'arrisi-kron',
      ],
      connections: [
        '[[dodec-community-characters|Community and Characters]] - DODEC community overview',
        '[[dodec-maintenance-sentinel|The Maintenance Sentinel]] - Community maintenance entity',
        '[[atlas-tether-technology|Atlas Tether Technology]] - Infrastructure supporting communities',
        '[[planet-chione|Planet Chione]] - Super-Earth environment',
      ],
    },

    // ON COMMAND systems and units
    {
      slugs: [
        'on-command-squad-control-systems',
        'on-command-post-war-reconstruction',
        'gyre-unit',
        'heavy-gyre-unit',
        'ultra-gyre-unit',
        'dredge-unit',
        'dozer-unit',
        'scope-unit',
        'siphon-unit',
        'siren-unit',
        'vector-unit',
        'scav-unit',
        'spark-unit',
        'anchor-unit',
      ],
      connections: [
        '[[on-command-character-classes|Character Classes and Specializations]] - ON COMMAND overview',
        '[[allied-civil-preserve-territory|ACP Territory]] - Operational environment',
        '[[post-war-reconstruction|Post-War Reconstruction]] - Historical context',
      ],
    },

    // AUTUMN characters
    {
      slugs: ['little-raccoon-character'],
      connections: [
        '[[autumn-character|AUTUMN]] - Main character overview',
        '[[season-of-autumn|Season of AUTUMN]] - Environmental context',
      ],
    },

    // Academic and scientific content
    {
      slugs: ['five-city-academic-system', 'disappearing-stars-mystery'],
      connections: [
        '[[development-guidelines|Development Guidelines]] - Project development context',
        '[[getting-started|Getting Started]] - Project overview',
      ],
    },

    // NOXII advanced systems
    {
      slugs: ['mag-projectile-system'],
      connections: [
        '[[noxii-items-equipment|NOXII Items & Equipment]] - Equipment overview',
        '[[vatra-equipment-exchange-terminal|Equipment Exchange Terminal]] - Equipment access system',
        '[[noxii-economic-systems|Economic Systems]] - Currency and trading',
      ],
    },

    // Cosmic Knights content
    {
      slugs: ['cosmic-knights-skeleton-horde', 'cosmic-knights-weapon-greatgun'],
      connections: [
        '[[cosmic-knights-weapon-arsenal|Weapon Arsenal]] - Cosmic Knights equipment',
        '[[cosmic-knights-crystal-economy|Crystal Economy]] - Resource system',
        '[[cosmic-knights-banner-command|Banner Command]] - Military structure',
      ],
    },

    // Documentation and tutorials
    {
      slugs: ['tag-management-tutorial'],
      connections: [
        '[[development-guidelines|Development Guidelines]] - Project standards',
        '[[getting-started|Getting Started]] - Developer onboarding',
      ],
    },

    // Timeline contamination cleanup - connect Oskidere pages properly
    {
      slugs: ['oski-oxidere', 'oskidere'],
      connections: [
        '[[on-command-character-classes|Character Classes and Specializations]] - ON COMMAND military context',
        '[[allied-civil-preserve-territory|ACP Territory]] - Military operational environment',
      ],
    },
  ];

  let connectionsAdded = 0;

  orphanConnections.forEach(group => {
    group.slugs.forEach(slug => {
      const page = db
        .prepare(
          `
        SELECT p.id, p.slug, p.title, r.content
        FROM wiki_pages p
        JOIN wiki_revisions r ON p.id = r.page_id
        WHERE p.slug = ? AND p.status = 'published'
        AND r.revision_timestamp = (SELECT MAX(r2.revision_timestamp) FROM wiki_revisions r2 WHERE r2.page_id = p.id)
      `
        )
        .get(slug);

      if (page && !page.content.includes('## See Also')) {
        let seeAlsoSection = '\n\n## See Also\n\n';

        group.connections.forEach(connection => {
          seeAlsoSection += `- ${connection}\n`;
        });

        const updatedContent = page.content + seeAlsoSection;

        const insertRevision = db.prepare(`
          INSERT INTO wiki_revisions (
            page_id, content, summary, content_format, author_id, is_minor, size_bytes, revision_timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        insertRevision.run(
          page.id,
          updatedContent,
          'Add internal links to connect with related systems and project context',
          'markdown',
          1,
          0,
          Buffer.byteLength(updatedContent, 'utf8')
        );

        db.prepare(`UPDATE wiki_pages SET updated_at = datetime('now') WHERE id = ?`).run(page.id);

        console.log(`🔗 Connected: ${page.title} (${page.slug})`);
        connectionsAdded++;
      } else if (page && page.content.includes('## See Also')) {
        console.log(`⏭️  Skipped: ${page.title} (already has links)`);
      } else if (!page) {
        console.log(`❌ Not found: ${slug}`);
      }
    });
  });

  console.log(`\n✅ Added connections to ${connectionsAdded} orphaned pages`);

  // Now let's run a final analysis to see current status
  const allPages = db
    .prepare(
      `
    SELECT p.slug, p.title, r.content
    FROM wiki_pages p
    JOIN wiki_revisions r ON p.id = r.page_id
    WHERE p.status = 'published'
    AND r.revision_timestamp = (SELECT MAX(r2.revision_timestamp) FROM wiki_revisions r2 WHERE r2.page_id = p.id)
  `
    )
    .all();

  const existingPages = new Set(allPages.map(p => p.slug));

  function extractWikiLinks(content) {
    const linkPattern = /\[\[([^\|\]]+)(?:\|[^\]]+)?\]\]/g;
    const links = [];
    let match;
    while ((match = linkPattern.exec(content)) !== null) {
      links.push(match[1]);
    }
    return links;
  }

  // Find pages with incoming links
  const referencedPages = new Set();
  allPages.forEach(page => {
    const links = extractWikiLinks(page.content);
    links.forEach(link => {
      if (existingPages.has(link)) {
        referencedPages.add(link);
      }
    });
  });

  // Find remaining orphaned pages
  const stillOrphaned = allPages.filter(page => !referencedPages.has(page.slug));

  console.log(`\n🏝️  Remaining orphaned pages: ${stillOrphaned.length}`);
  if (stillOrphaned.length > 0) {
    stillOrphaned.forEach(page => {
      console.log(`   - ${page.title} (${page.slug})`);
    });
  }

  db.close();
  console.log('\n✅ Orphan connection process completed');
} catch (error) {
  console.error('❌ Error connecting orphaned pages:', error);
  process.exit(1);
}
