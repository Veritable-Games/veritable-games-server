#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'forums.db');

// Critical missing pages that our links point to but don't exist
const missingPages = [
  {
    slug: 'noxii',
    title: 'NOXII',
    content: `# NOXII

NOXII is a lethally competitive skydiving action-adventure game with strong narrative & character driven elements. Fight to survive the death games and restore your honor as a citizen of the Allied Civil Empire.

## Core Systems

- [[noxii-game-mechanics|Game Mechanics]]
- [[core-mechanics|Core Mechanics]]  
- [[noxii-economic-systems|Economic Systems]]
- [[getting-started|Getting Started]]

## Narrative Elements

- [[noxii-narrative-themes|Narrative Themes]]
- [[noxii-locations-world-building|Locations and World-Building]]
- [[noxii-design-evolution-overview|Design Evolution]]

## Project Pages

- [[noxii-overview|Game Project Overview]]

## Related Systems

- [[enact-dialogue-system|Dialogue System]]
- [[atlas-tether-technology|Atlas Tether Technology]]`,
    category_name: 'NOXII',
  },
  {
    slug: 'dodec',
    title: 'DODEC',
    content: `# DODEC

DODEC represents the distant future timeline of the Veritable Games universe, featuring post-scarcity communities and advanced AI integration.

## Core Elements

- [[planet-chione|Planet Chione]] - The main setting
- [[dodec-community-characters|Community and Characters]]
- [[post-scarcity-society-framework|Post-Scarcity Society]]

## Key Characters

- [[architect-ai|Architect AI]]
- [[oskidere|Oskidere]]
- [[maria-colony|Maria Colony]]

## Systems and Technology

- [[atlas-tether-technology|Atlas Tether Technology]]
- [[nanite-technology|Nanite Technology]]
- [[disappearing-stars-mystery|Disappearing Stars Mystery]]
- [[dodec-world-systems|World Systems]]

## Related Pages

- [[dodec-maintenance-sentinel|The Maintenance Sentinel]]`,
    category_name: 'DODEC',
  },
  {
    slug: 'on-command',
    title: 'ON COMMAND',
    content: `# ON COMMAND

ON COMMAND represents the conflict period of the Veritable Games universe, featuring tactical combat and resistance themes.

## Core Systems

- [[on-command-character-classes|Character Classes and Specializations]]
- [[acp-military-forces|ACP Military Forces]]
- [[on-command-squad-control-systems|Squad Control Systems]]

## Technology

- [[atlas-tether-technology|Atlas Tether Technology]]
- [[nanite-technology|Nanite Technology]]
- [[mag-projectile-system|M.A.G. Projectile System]]

## Characters

- [[acp-defector|ACP Defector]]
- [[carden-frode|Carden Frode]]
- [[arrisi-kron|Arrisi Kron]]

## Enemy Units

- [[gyre-unit|Gyre]] and [[heavy-gyre-unit|Heavy Gyre]]
- [[dredge-unit|Dredge]] and [[dozer-unit|Dozer]]
- [[scav-unit|Scav]] and [[scope-unit|Scope]]

## World Building

- [[five-city-academic-system|The Five-City Academic System]]
- [[on-command-post-war-reconstruction|Post-War Reconstruction]]`,
    category_name: 'ON COMMAND',
  },
  {
    slug: 'autumn',
    title: 'AUTUMN',
    content: `# AUTUMN

AUTUMN is a character-driven narrative game featuring seasonal magic and emotional themes.

## Core Characters

- [[autumn-character|Autumn (Player Character)]]
- [[little-raccoon-character|Little the Raccoon]]

## Seasonal Characters

- [[spring-character|Spring - The Self-Sacrificing Giver]]
- [[summer-character|Summer - The Facade Perfectionist]]  
- [[winter-character|Winter - The Distant Perfectionist]]

## World and Systems

- [[world-of-ether|The World of Ether]]
- [[seasonal-magic-system|Seasonal Magic System]]

## Character Development

- [[autumn-family-dynamics|Family Dynamics]]
- [[character-ai-integration|Character AI Integration]]`,
    category_name: 'AUTUMN',
  },
  {
    slug: 'cosmic-knights',
    title: 'COSMIC KNIGHTS',
    content: `# COSMIC KNIGHTS

COSMIC KNIGHTS is a strategic combat game featuring crystal economy and fracture warfare mechanics.

## Core Systems

- [[cosmic-knights-banner-command|Banner Command System]]
- [[cosmic-knights-crystal-economy|Crystal Economy System]]
- [[cosmic-knights-fracture-warfare|Fracture Warfare]]

## Gameplay Mechanics

- [[cosmic-knights-controls-interface|Controls & Interface System]]
- [[knight-progression-system|Knight Progression System]]
- [[skeleton-horde-mechanics|Skeleton Horde Mechanics]]

## Combat and Strategy

- [[weapon-arsenal|Weapon Arsenal]]
- [[abilities-system|Abilities System]]
- [[player-mechanics|Player Mechanics]]

## Environment

- [[level-design|Level Design Philosophy]]

## Related Systems

- [[enact-dialogue-system|Dialogue System]]`,
    category_name: 'COSMIC KNIGHTS',
  },
];

try {
  const db = new Database(dbPath);
  console.log('🚨 URGENT: Creating missing hub pages that links point to...\n');

  // First, get or create categories
  const getCategoryId = db.prepare(`SELECT id FROM wiki_categories WHERE name = ?`);
  const insertCategory = db.prepare(`
    INSERT INTO wiki_categories (name, description, created_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `);

  for (const pageData of missingPages) {
    console.log(`📝 Creating "${pageData.title}" page...`);

    // Get or create category
    let categoryResult = getCategoryId.get(pageData.category_name);
    if (!categoryResult) {
      insertCategory.run(pageData.category_name, `${pageData.category_name} project pages`);
      categoryResult = getCategoryId.get(pageData.category_name);
    }
    const categoryId = categoryResult.id;

    // Check if page already exists
    const existingPage = db.prepare(`SELECT id FROM wiki_pages WHERE slug = ?`).get(pageData.slug);

    if (!existingPage) {
      // Create the page
      const insertPage = db.prepare(`
        INSERT INTO wiki_pages (
          slug, title, namespace, status, protection_level,
          created_by, created_at, updated_at
        ) VALUES (?, ?, 'Main', 'published', 'open', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      insertPage.run(pageData.slug, pageData.title);
      const newPageId = db
        .prepare(`SELECT id FROM wiki_pages WHERE slug = ?`)
        .get(pageData.slug).id;

      // Create initial revision
      const insertRevision = db.prepare(`
        INSERT INTO wiki_revisions (
          page_id, content, summary, content_format, author_id, author_ip,
          size_bytes, revision_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      insertRevision.run(
        newPageId,
        pageData.content,
        'Initial page creation - hub page for project links',
        'markdown',
        null,
        '127.0.0.1',
        Buffer.byteLength(pageData.content, 'utf8')
      );

      // Associate with category
      const insertPageCategory = db.prepare(`
        INSERT INTO wiki_page_categories (page_id, category_id)
        VALUES (?, ?)
      `);
      insertPageCategory.run(newPageId, categoryId);

      console.log(`✅ Created "${pageData.title}" with ${pageData.content.length} characters`);
    } else {
      console.log(`⚠️  "${pageData.title}" already exists`);
    }
  }

  // Now check for other critical missing pages that are being referenced
  console.log('\n🔍 Checking for other missing referenced pages...');

  const allPages = db
    .prepare(
      `
    SELECT p.slug, p.title, r.content
    FROM wiki_pages p
    LEFT JOIN wiki_revisions r ON p.id = r.page_id
    WHERE p.status = 'published'
    GROUP BY p.id
  `
    )
    .all();

  const existingSlugs = new Set(allPages.map(p => p.slug));
  const referencedSlugs = new Set();

  // Extract all WikiLink targets
  for (const page of allPages) {
    if (!page.content) continue;

    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    let match;

    while ((match = wikiLinkRegex.exec(page.content)) !== null) {
      const linkText = match[1];
      const [slug] = linkText.split('|');
      const targetSlug = slug.trim().toLowerCase().replace(/\s+/g, '-').split('#')[0];
      referencedSlugs.add(targetSlug);
    }
  }

  // Find missing references
  const missingReferences = [...referencedSlugs].filter(slug => !existingSlugs.has(slug));

  if (missingReferences.length > 0) {
    console.log(`\n❌ Found ${missingReferences.length} missing referenced pages:`);
    missingReferences.slice(0, 20).forEach(slug => {
      console.log(`   • ${slug}`);
    });

    if (missingReferences.length > 20) {
      console.log(`   ... and ${missingReferences.length - 20} more`);
    }
  } else {
    console.log('\n✅ All WikiLink references now point to existing pages!');
  }

  console.log('\n📊 URGENT FIXES SUMMARY');
  console.log('='.repeat(50));
  console.log(`• Hub pages created: ${missingPages.length}`);
  console.log(`• Missing references found: ${missingReferences.length}`);
  console.log('• Critical navigation links should now work');

  db.close();
} catch (error) {
  console.error('❌ Error creating urgent fixes:', error);
  process.exit(1);
}
