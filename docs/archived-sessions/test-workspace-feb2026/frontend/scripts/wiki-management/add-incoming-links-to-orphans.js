#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'forums.db');

try {
  const db = new Database(dbPath);

  console.log('🔗 ADDING INCOMING LINKS TO ORPHANED PAGES\n');

  // Define which hub pages should reference which orphaned pages
  const hubToOrphanMappings = [
    {
      hubSlug: 'on-command-character-classes',
      hubTitle: 'Character Classes and Specializations',
      orphans: [
        { slug: 'gyre-unit', title: 'Gyre', category: 'Support Units' },
        {
          slug: 'heavy-gyre-unit',
          title: 'Heavy Gyre',
          category: 'Support Units',
        },
        {
          slug: 'ultra-gyre-unit',
          title: 'Ultra Gyre',
          category: 'Support Units',
        },
        { slug: 'dredge-unit', title: 'Dredge', category: 'Support Units' },
        { slug: 'dozer-unit', title: 'Dozer', category: 'Support Units' },
        { slug: 'scope-unit', title: 'Scope', category: 'Support Units' },
        { slug: 'siphon-unit', title: 'Siphon', category: 'Support Units' },
        { slug: 'siren-unit', title: 'Siren', category: 'Support Units' },
        { slug: 'vector-unit', title: 'Vector', category: 'Support Units' },
        { slug: 'scav-unit', title: 'Scav', category: 'Support Units' },
        { slug: 'spark-unit', title: 'Spark', category: 'Support Units' },
        { slug: 'anchor-unit', title: 'Anchor', category: 'Support Units' },
        {
          slug: 'on-command-squad-control-systems',
          title: 'Squad Control Systems',
          category: 'Systems',
        },
        {
          slug: 'on-command-post-war-reconstruction',
          title: 'Post-War Reconstruction',
          category: 'Context',
        },
        {
          slug: 'oski-oxidere',
          title: 'Oski (Oxidere)',
          category: 'Characters',
        },
      ],
    },

    {
      hubSlug: 'noxii-items-equipment',
      hubTitle: 'NOXII Items & Equipment',
      orphans: [
        {
          slug: 'mag-projectile-system',
          title: 'M.A.G. Projectile System',
          category: 'Advanced Equipment',
        },
      ],
    },

    {
      hubSlug: 'cosmic-knights-weapon-arsenal',
      hubTitle: 'Weapon Arsenal',
      orphans: [
        {
          slug: 'cosmic-knights-weapon-greatgun',
          title: 'Greatgun Precision Penetrator',
          category: 'Heavy Weapons',
        },
      ],
    },

    {
      hubSlug: 'cosmic-knights-overview',
      hubTitle: 'Cosmic Knights Overview',
      orphans: [
        {
          slug: 'cosmic-knights-skeleton-horde',
          title: 'Skeleton Horde Mechanics',
          category: 'Enemy Systems',
        },
      ],
    },

    {
      hubSlug: 'autumn-character',
      hubTitle: 'AUTUMN',
      orphans: [
        {
          slug: 'little-raccoon-character',
          title: "Little the Raccoon - Autumn's Companion",
          category: 'Characters',
        },
      ],
    },

    {
      hubSlug: 'development-guidelines',
      hubTitle: 'Development Guidelines',
      orphans: [
        {
          slug: 'tag-management-tutorial',
          title: 'Tag Management Tutorial',
          category: 'Documentation',
        },
        {
          slug: 'five-city-academic-system',
          title: 'The Five-City Academic System',
          category: 'World Building',
        },
        {
          slug: 'disappearing-stars-mystery',
          title: 'Disappearing Stars Mystery',
          category: 'World Building',
        },
      ],
    },

    {
      hubSlug: 'dodec-community-characters',
      hubTitle: 'Community and Characters',
      orphans: [
        {
          slug: 'sorrel-amor',
          title: 'Sorrel Amor',
          category: 'Community Members',
        },
      ],
    },
  ];

  let hubPagesUpdated = 0;
  let linksAdded = 0;

  hubToOrphanMappings.forEach(mapping => {
    const hubPage = db
      .prepare(
        `
      SELECT p.id, p.slug, p.title, r.content
      FROM wiki_pages p
      JOIN wiki_revisions r ON p.id = r.page_id
      WHERE p.slug = ? AND p.status = 'published'
      AND r.revision_timestamp = (SELECT MAX(r2.revision_timestamp) FROM wiki_revisions r2 WHERE r2.page_id = p.id)
    `
      )
      .get(mapping.hubSlug);

    if (hubPage) {
      let updatedContent = hubPage.content;
      let needsUpdate = false;

      // Group orphans by category
      const categoryGroups = {};
      mapping.orphans.forEach(orphan => {
        if (!categoryGroups[orphan.category]) {
          categoryGroups[orphan.category] = [];
        }
        categoryGroups[orphan.category].push(orphan);
      });

      // Check if we need to add any references
      const missingRefs = mapping.orphans.filter(
        orphan =>
          !updatedContent.includes(`[[${orphan.slug}]]`) &&
          !updatedContent.includes(`[[${orphan.slug}|`)
      );

      if (missingRefs.length > 0) {
        let sectionsToAdd = '';

        Object.entries(categoryGroups).forEach(([category, orphans]) => {
          const missingInCategory = orphans.filter(
            orphan =>
              !updatedContent.includes(`[[${orphan.slug}]]`) &&
              !updatedContent.includes(`[[${orphan.slug}|`)
          );

          if (missingInCategory.length > 0) {
            sectionsToAdd += `\n\n### ${category}\n\n`;
            missingInCategory.forEach(orphan => {
              sectionsToAdd += `- [[${orphan.slug}|${orphan.title}]]\n`;
              linksAdded++;
            });
          }
        });

        if (sectionsToAdd) {
          // Find best insertion point - before "See Also" if it exists
          const seeAlsoIndex = updatedContent.lastIndexOf('## See Also');
          if (seeAlsoIndex !== -1) {
            updatedContent =
              updatedContent.slice(0, seeAlsoIndex) +
              sectionsToAdd +
              '\n\n' +
              updatedContent.slice(seeAlsoIndex);
          } else {
            updatedContent = updatedContent + sectionsToAdd;
          }
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        const insertRevision = db.prepare(`
          INSERT INTO wiki_revisions (
            page_id, content, summary, content_format, author_id, is_minor, size_bytes, revision_timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        insertRevision.run(
          hubPage.id,
          updatedContent,
          `Add links to related ${mapping.orphans.length} individual pages and specialized systems`,
          'markdown',
          1,
          0,
          Buffer.byteLength(updatedContent, 'utf8')
        );

        db.prepare(`UPDATE wiki_pages SET updated_at = datetime('now') WHERE id = ?`).run(
          hubPage.id
        );

        console.log(`🔗 Enhanced: ${hubPage.title} with ${missingRefs.length} new references`);
        hubPagesUpdated++;
      } else {
        console.log(`⏭️  Skipped: ${hubPage.title} (already has all references)`);
      }
    } else {
      console.log(`❌ Hub page not found: ${mapping.hubSlug}`);
    }
  });

  console.log(`\n✅ Updated ${hubPagesUpdated} hub pages with ${linksAdded} new incoming links`);

  // Final orphan check
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

  const referencedPages = new Set();
  allPages.forEach(page => {
    const links = extractWikiLinks(page.content);
    links.forEach(link => {
      if (existingPages.has(link)) {
        referencedPages.add(link);
      }
    });
  });

  const finalOrphans = allPages.filter(page => !referencedPages.has(page.slug));

  console.log(`\n🏝️  Final orphaned pages: ${finalOrphans.length}`);
  if (finalOrphans.length <= 10) {
    finalOrphans.forEach(page => {
      console.log(`   - ${page.title} (${page.slug})`);
    });
  } else {
    finalOrphans.slice(0, 10).forEach(page => {
      console.log(`   - ${page.title} (${page.slug})`);
    });
    console.log(`   ... and ${finalOrphans.length - 10} more`);
  }

  db.close();
  console.log('\n✅ Incoming link addition completed');
} catch (error) {
  console.error('❌ Error adding incoming links:', error);
  process.exit(1);
}
