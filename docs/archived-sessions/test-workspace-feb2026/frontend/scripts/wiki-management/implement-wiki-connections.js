#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'forums.db');

try {
  const db = new Database(dbPath);
  console.log('🔗 IMPLEMENTING WIKI CONNECTION IMPROVEMENTS\n');

  // Get all unique pages with their categories and content
  const pages = db
    .prepare(
      `
    SELECT DISTINCT
      p.id,
      p.slug,
      p.title,
      r.content,
      GROUP_CONCAT(DISTINCT c.name) as categories
    FROM wiki_pages p
    LEFT JOIN wiki_revisions r ON p.id = r.page_id
    LEFT JOIN wiki_page_categories pc ON p.id = pc.page_id
    LEFT JOIN wiki_categories c ON pc.category_id = c.id
    WHERE p.status = 'published' AND r.content IS NOT NULL
    GROUP BY p.slug
    ORDER BY p.title
  `
    )
    .all();

  console.log(`📊 Analyzing ${pages.length} wiki pages for connections...\n`);

  // Extract keywords function
  function extractKeywords(content, title) {
    if (!content) return new Set();

    const text = (content + ' ' + title).toLowerCase();
    const keywords = new Set();

    // Game development terms
    const gameTerms = [
      'weapon',
      'combat',
      'battle',
      'fight',
      'attack',
      'defense',
      'shield',
      'armor',
      'character',
      'player',
      'npc',
      'enemy',
      'boss',
      'unit',
      'hero',
      'protagonist',
      'level',
      'stage',
      'area',
      'zone',
      'map',
      'world',
      'environment',
      'terrain',
      'quest',
      'mission',
      'objective',
      'goal',
      'task',
      'challenge',
      'skill',
      'ability',
      'power',
      'magic',
      'spell',
      'enchant',
      'ritual',
      'inventory',
      'equipment',
      'item',
      'tool',
      'resource',
      'material',
      'health',
      'mana',
      'energy',
      'stamina',
      'experience',
      'level up',
      'dialogue',
      'conversation',
      'story',
      'narrative',
      'plot',
      'lore',
      'system',
      'mechanic',
      'gameplay',
      'control',
      'interface',
      'ui',
      'menu',
      'technology',
      'ai',
      'artificial',
      'intelligence',
      'robot',
      'droid',
      'machine',
      'faction',
      'alliance',
      'empire',
      'kingdom',
      'guild',
      'organization',
      'crystal',
      'nanite',
      'tether',
      'atlas',
      'skeleton',
      'knight',
      'banner',
    ];

    // Project-specific terms
    const projectTerms = [
      'noxii',
      'autumn',
      'cosmic knights',
      'on command',
      'dodec',
      'seasonal',
      'spring',
      'summer',
      'winter',
      'little',
      'raccoon',
      'chione',
      'maria',
      'oskidere',
      'architect',
      'sentinel',
      'gyre',
      'dredge',
      'dozer',
      'scav',
      'scope',
      'siphon',
      'siren',
      'spark',
      'vector',
      'arrisi',
      'carden',
      'gregers',
      'josefine',
      'kalisa',
      'lorens',
      'marian',
      'sorrel',
      'vivian',
      'wilmet',
    ];

    // Character emotion/dialogue terms
    const emotionTerms = [
      'balance',
      'empathy',
      'comfort',
      'reassurance',
      'contentment',
      'complacency',
      'courage',
      'volition',
      'depression',
      'elation',
      'pleasure',
      'enmity',
      'reproach',
      'fear',
      'anxiety',
      'aversion',
      'honor',
      'dignity',
      'pride',
      'misery',
      'loss',
      'shame',
      'pain',
      'injury',
      'trauma',
      'response',
      'aggression',
      'seeking',
      'want',
      'take',
    ];

    // Check for all terms
    [...gameTerms, ...projectTerms, ...emotionTerms].forEach(term => {
      if (text.includes(term)) {
        keywords.add(term);
      }
    });

    return keywords;
  }

  // Analyze connections within each category (excluding NOXII-AUTUMN cross connections)
  const categoryAnalysis = {};

  pages.forEach(page => {
    const keywords = extractKeywords(page.content, page.title);
    const categories = page.categories
      ? page.categories.split(',').map(c => c.trim())
      : ['Uncategorized'];

    categories.forEach(category => {
      if (!categoryAnalysis[category]) {
        categoryAnalysis[category] = [];
      }

      categoryAnalysis[category].push({
        id: page.id,
        slug: page.slug,
        title: page.title,
        keywords: Array.from(keywords),
        content: page.content,
      });
    });
  });

  // Priority implementation based on analysis
  const connectionsToImplement = [];

  console.log('🔍 IDENTIFYING HIGH-PRIORITY CONNECTIONS:');
  console.log('='.repeat(60));

  // Process each category for internal connections
  Object.keys(categoryAnalysis)
    .sort()
    .forEach(category => {
      const categoryPages = categoryAnalysis[category];
      if (categoryPages.length < 2) return; // Skip single-page categories

      console.log(`\n📁 ${category.toUpperCase()} (${categoryPages.length} pages)`);
      console.log('-'.repeat(40));

      // Find strongest connections within category
      const connections = [];

      for (let i = 0; i < categoryPages.length; i++) {
        for (let j = i + 1; j < categoryPages.length; j++) {
          const page1 = categoryPages[i];
          const page2 = categoryPages[j];

          // Skip NOXII-AUTUMN cross connections
          const isNoxiiAutumnCross =
            (page1.title.toLowerCase().includes('noxii') &&
              page2.title.toLowerCase().includes('autumn')) ||
            (page1.title.toLowerCase().includes('autumn') &&
              page2.title.toLowerCase().includes('noxii'));

          if (isNoxiiAutumnCross) {
            continue;
          }

          // Find common keywords
          const common = page1.keywords.filter(k => page2.keywords.includes(k));

          if (common.length >= 3) {
            // High threshold for implementation
            connections.push({
              page1: page1,
              page2: page2,
              commonKeywords: common,
              strength: common.length,
            });
          }
        }
      }

      // Sort by strength and take top connections
      connections.sort((a, b) => b.strength - a.strength);
      const topConnections = connections.slice(0, 5); // Top 5 per category

      if (topConnections.length > 0) {
        console.log('🎯 TOP CONNECTIONS TO IMPLEMENT:');
        topConnections.forEach((conn, index) => {
          console.log(`${index + 1}. "${conn.page1.title}" ⟷ "${conn.page2.title}"`);
          console.log(
            `   Strength: ${conn.strength} keywords (${conn.commonKeywords.slice(0, 3).join(', ')})`
          );

          connectionsToImplement.push({
            category: category,
            page1: conn.page1,
            page2: conn.page2,
            keywords: conn.commonKeywords,
            strength: conn.strength,
          });
        });
      } else {
        console.log('⚠️  No high-strength connections found (3+ shared keywords)');
      }
    });

  console.log(`\n\n🚀 IMPLEMENTING ${connectionsToImplement.length} HIGH-PRIORITY CONNECTIONS:`);
  console.log('='.repeat(60));

  let implementedCount = 0;

  // Group connections by strength for prioritized implementation
  connectionsToImplement.sort((a, b) => b.strength - a.strength);

  for (const connection of connectionsToImplement) {
    console.log(`\n🔧 ${connection.page1.title} ⟷ ${connection.page2.title}`);
    console.log(`   Category: ${connection.category} | Strength: ${connection.strength}`);

    // Add "See Also" section to both pages if not already present
    let page1Updated = false;
    let page2Updated = false;

    // Update page 1 with connection to page 2
    if (
      !connection.page1.content.includes(`[[${connection.page2.slug}|${connection.page2.title}]]`)
    ) {
      let updatedContent1 = connection.page1.content;

      if (!updatedContent1.includes('## See Also')) {
        updatedContent1 += `\n\n## See Also\n\n- [[${connection.page2.slug}|${connection.page2.title}]]`;
      } else {
        // Add to existing See Also section
        if (!updatedContent1.includes(`[[${connection.page2.slug}|${connection.page2.title}]]`)) {
          updatedContent1 = updatedContent1.replace(
            /## See Also\n/,
            `## See Also\n\n- [[${connection.page2.slug}|${connection.page2.title}]]\n`
          );
        }
      }

      // Insert new revision
      const insertRevision1 = db.prepare(`
        INSERT INTO wiki_revisions (
          page_id, content, summary, content_format, author_id, author_ip,
          size_bytes, revision_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      insertRevision1.run(
        connection.page1.id,
        updatedContent1,
        `Added cross-reference to ${connection.page2.title}`,
        'markdown',
        null,
        '127.0.0.1',
        Buffer.byteLength(updatedContent1, 'utf8')
      );

      page1Updated = true;
    }

    // Update page 2 with connection to page 1
    if (
      !connection.page2.content.includes(`[[${connection.page1.slug}|${connection.page1.title}]]`)
    ) {
      let updatedContent2 = connection.page2.content;

      if (!updatedContent2.includes('## See Also')) {
        updatedContent2 += `\n\n## See Also\n\n- [[${connection.page1.slug}|${connection.page1.title}]]`;
      } else {
        // Add to existing See Also section
        if (!updatedContent2.includes(`[[${connection.page1.slug}|${connection.page1.title}]]`)) {
          updatedContent2 = updatedContent2.replace(
            /## See Also\n/,
            `## See Also\n\n- [[${connection.page1.slug}|${connection.page1.title}]]\n`
          );
        }
      }

      // Insert new revision
      const insertRevision2 = db.prepare(`
        INSERT INTO wiki_revisions (
          page_id, content, summary, content_format, author_id, author_ip,
          size_bytes, revision_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      insertRevision2.run(
        connection.page2.id,
        updatedContent2,
        `Added cross-reference to ${connection.page1.title}`,
        'markdown',
        null,
        '127.0.0.1',
        Buffer.byteLength(updatedContent2, 'utf8')
      );

      page2Updated = true;
    }

    if (page1Updated || page2Updated) {
      console.log(`   ✅ Implemented bidirectional connection`);
      implementedCount++;
    } else {
      console.log(`   ⚠️  Connection already exists`);
    }
  }

  console.log(`\n\n🎉 IMPLEMENTATION COMPLETE!`);
  console.log('='.repeat(40));
  console.log(`• Connections analyzed: ${connectionsToImplement.length}`);
  console.log(`• New connections implemented: ${implementedCount}`);
  console.log(`• NOXII-AUTUMN connections avoided: ✅`);
  console.log(`• High-quality connections prioritized: ✅`);

  db.close();
} catch (error) {
  console.error('❌ Error implementing wiki connections:', error);
  process.exit(1);
}
