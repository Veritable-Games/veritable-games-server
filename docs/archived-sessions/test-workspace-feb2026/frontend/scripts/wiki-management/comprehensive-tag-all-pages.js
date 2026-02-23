#!/usr/bin/env node

/**
 * Comprehensive tagging system for all wiki pages
 * Tags all 135+ wiki pages based on their content and project affiliation
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'forums.db');

function comprehensiveTagging() {
  const db = new Database(dbPath);

  try {
    console.log('🏷️ COMPREHENSIVE WIKI PAGE TAGGING');
    console.log('=====================================\n');

    // Comprehensive tagging rules for all pages
    const allPageTaggingRules = [
      // ===== PROJECT HUB PAGES =====
      {
        slug: 'veritable-games-overview',
        tags: ['hub', 'overview', 'main', 'veritable-games'],
      },
      {
        slug: 'cosmic-knights-overview',
        tags: ['hub', 'overview', 'cosmic-knights', 'banner-coordination'],
      },

      // ===== COSMIC KNIGHTS SYSTEM PAGES =====
      {
        slug: 'cosmic-knights-banner-command',
        tags: ['cosmic-knights', 'banner', 'coordination', 'democracy', 'system'],
      },
      {
        slug: 'cosmic-knights-crystal-economy',
        tags: ['cosmic-knights', 'crystal', 'economy', 'resources', 'system'],
      },
      {
        slug: 'cosmic-knights-fracture-warfare',
        tags: ['cosmic-knights', 'fracture', 'warfare', 'sealing', 'objectives'],
      },
      {
        slug: 'cosmic-knights-corruption-pressure',
        tags: ['cosmic-knights', 'corruption', 'pressure', 'environment', 'system'],
      },
      {
        slug: 'cosmic-knights-ai-learning-system',
        tags: ['cosmic-knights', 'ai', 'learning', 'adaptive', 'system'],
      },
      {
        slug: 'cosmic-knights-multiplayer-systems',
        tags: ['cosmic-knights', 'multiplayer', 'cooperation', 'system'],
      },
      {
        slug: 'cosmic-knights-skeleton-horde',
        tags: ['cosmic-knights', 'skeleton', 'visualization', 'tactical', 'system'],
      },
      {
        slug: 'cosmic-knights-level-environments',
        tags: ['cosmic-knights', 'environments', 'levels', 'design', 'tactical'],
      },
      {
        slug: 'cosmic-knights-knight-controls',
        tags: ['cosmic-knights', 'controls', 'interface', 'system'],
      },
      {
        slug: 'cosmic-knights-knight-progression',
        tags: ['cosmic-knights', 'progression', 'advancement', 'system'],
      },
      {
        slug: 'cosmic-knights-knight-combat',
        tags: ['cosmic-knights', 'combat', 'mechanics', 'system'],
      },
      {
        slug: 'cosmic-knights-progression-unlocks',
        tags: ['cosmic-knights', 'progression', 'unlocks', 'system'],
      },
      {
        slug: 'cosmic-knights-special-abilities',
        tags: ['cosmic-knights', 'abilities', 'special', 'system'],
      },

      // ===== COSMIC KNIGHTS WEAPONS =====
      {
        slug: 'cosmic-knights-mining-pistol',
        tags: ['cosmic-knights', 'weapon', 'mining', 'pistol', 'extraction'],
      },
      {
        slug: 'cosmic-knights-weapon-glesum',
        tags: ['cosmic-knights', 'weapon', 'glesum', 'crystallization', 'launcher'],
      },
      {
        slug: 'cosmic-knights-weapon-bestiolae',
        tags: ['cosmic-knights', 'weapon', 'bestiolae', 'magma', 'destroyer'],
      },
      {
        slug: 'cosmic-knights-weapon-tendril',
        tags: ['cosmic-knights', 'weapon', 'tendril', 'lightning', 'flail'],
      },
      {
        slug: 'cosmic-knights-weapon-gale',
        tags: ['cosmic-knights', 'weapon', 'gale', 'wind', 'cannon'],
      },
      {
        slug: 'cosmic-knights-weapon-greatgun',
        tags: ['cosmic-knights', 'weapon', 'greatgun', 'precision', 'penetrator'],
      },

      // ===== NOXII PROJECT PAGES =====
      {
        slug: 'noxii-game-mechanics',
        tags: ['noxii', 'mechanics', 'skydiving', 'politics', 'system'],
      },
      {
        slug: 'noxii-economic-systems',
        tags: ['noxii', 'economy', 'resources', 'system'],
      },
      {
        slug: 'noxii-narrative-themes',
        tags: ['noxii', 'narrative', 'themes', 'politics', 'resistance'],
      },
      {
        slug: 'noxii-locations-world-building',
        tags: ['noxii', 'locations', 'world-building', 'setting'],
      },
      {
        slug: 'noxii-items-equipment',
        tags: ['noxii', 'items', 'equipment', 'gear'],
      },
      {
        slug: 'vatra-hub',
        tags: ['noxii', 'vatra', 'hub', 'location', 'multi-directional-elevator'],
      },
      {
        slug: 'atlas-tether-technology',
        tags: ['noxii', 'atlas', 'tether', 'technology', 'megastructure'],
      },
      {
        slug: 'droid-bartender',
        tags: ['noxii', 'character', 'droid', 'bartender', 'surveillance'],
      },
      {
        slug: 'guards-authority-figures',
        tags: ['noxii', 'character', 'guards', 'authority', 'system'],
      },
      {
        slug: 'anarchists-external-network',
        tags: ['noxii', 'character', 'anarchists', 'network', 'resistance'],
      },

      // ===== NOXII CHARACTERS =====
      {
        slug: 'acp-defector',
        tags: ['noxii', 'character', 'acp', 'defector', 'protagonist'],
      },
      {
        slug: 'kalisa-bast',
        tags: ['noxii', 'character', 'kalisa-bast', 'prisoner'],
      },

      // ===== DODEC PROJECT PAGES =====
      {
        slug: 'post-scarcity-society-framework',
        tags: ['dodec', 'society', 'post-scarcity', 'framework', 'system'],
      },
      {
        slug: 'dodec-community-characters',
        tags: ['dodec', 'community', 'characters', 'social'],
      },
      {
        slug: 'dodec-world-systems',
        tags: ['dodec', 'world', 'systems', 'infrastructure'],
      },
      {
        slug: 'vertical-cities-management-system',
        tags: ['dodec', 'cities', 'management', 'ultrathink', 'system'],
      },
      {
        slug: 'dodec-maintenance-sentinel',
        tags: ['dodec', 'maintenance', 'sentinel', 'ai', 'character'],
      },
      {
        slug: 'five-city-academic-system',
        tags: ['dodec', 'academic', 'education', 'cities', 'system'],
      },
      {
        slug: 'transportation-network',
        tags: ['dodec', 'transportation', 'network', 'infrastructure'],
      },
      {
        slug: 'planet-chione',
        tags: ['dodec', 'chione', 'planet', 'super-earth', 'location'],
      },
      {
        slug: 'chione-megastructures',
        tags: ['dodec', 'chione', 'megastructures', 'architecture'],
      },

      // ===== DODEC CHARACTERS =====
      {
        slug: 'arrisi-kron',
        tags: ['dodec', 'character', 'arrisi-kron', 'protagonist'],
      },
      {
        slug: 'gregers-ovesen',
        tags: ['dodec', 'character', 'gregers-ovesen'],
      },
      {
        slug: 'josefine-strand',
        tags: ['dodec', 'character', 'josefine', 'joe', 'strand'],
      },
      { slug: 'lorens-nass', tags: ['dodec', 'character', 'lorens-nass'] },
      { slug: 'marian-cenric', tags: ['dodec', 'character', 'marian-cenric'] },
      { slug: 'oski-oxidere', tags: ['dodec', 'character', 'oski', 'oxidere'] },
      {
        slug: 'oskidere',
        tags: ['dodec', 'character', 'oskidere', 'sentinel', 'machine'],
      },
      { slug: 'sorrel-amor', tags: ['dodec', 'character', 'sorrel-amor'] },
      { slug: 'vivian-holt', tags: ['dodec', 'character', 'vivian-holt'] },
      { slug: 'wilmet-edith', tags: ['dodec', 'character', 'wilmet-edith'] },

      // ===== ON COMMAND PROJECT PAGES =====
      {
        slug: 'on-command-character-classes',
        tags: ['on-command', 'character', 'classes', 'specializations', 'system'],
      },
      {
        slug: 'on-command-squad-control-systems',
        tags: ['on-command', 'squad', 'control', 'command', 'system'],
      },
      {
        slug: 'on-command-post-war-reconstruction',
        tags: ['on-command', 'post-war', 'reconstruction', 'humanitarian'],
      },
      {
        slug: 'allied-civil-preserve-territory',
        tags: ['on-command', 'acp', 'territory', 'location'],
      },
      {
        slug: 'acp-military-forces',
        tags: ['on-command', 'acp', 'military', 'forces'],
      },
      {
        slug: 'maria-colony',
        tags: ['on-command', 'maria', 'colony', 'location'],
      },
      {
        slug: 'corrupted-territories',
        tags: ['on-command', 'corrupted', 'territories', 'location'],
      },
      {
        slug: 'carden-frode',
        tags: ['on-command', 'character', 'carden-frode'],
      },

      // ===== ON COMMAND UNITS/ENEMIES =====
      {
        slug: 'anchor-unit',
        tags: ['on-command', 'enemy', 'anchor', 'unit', 'nanite'],
      },
      {
        slug: 'dozer-unit',
        tags: ['on-command', 'enemy', 'dozer', 'unit', 'nanite'],
      },
      {
        slug: 'dredge-unit',
        tags: ['on-command', 'enemy', 'dredge', 'unit', 'nanite'],
      },
      {
        slug: 'gyre-unit',
        tags: ['on-command', 'enemy', 'gyre', 'unit', 'nanite'],
      },
      {
        slug: 'heavy-gyre-unit',
        tags: ['on-command', 'enemy', 'heavy-gyre', 'unit', 'nanite'],
      },
      {
        slug: 'ultra-gyre-unit',
        tags: ['on-command', 'enemy', 'ultra-gyre', 'unit', 'nanite'],
      },
      {
        slug: 'scav-unit',
        tags: ['on-command', 'enemy', 'scav', 'unit', 'nanite'],
      },
      {
        slug: 'scope-unit',
        tags: ['on-command', 'enemy', 'scope', 'unit', 'nanite'],
      },
      {
        slug: 'siphon-unit',
        tags: ['on-command', 'enemy', 'siphon', 'unit', 'nanite'],
      },
      {
        slug: 'siren-unit',
        tags: ['on-command', 'enemy', 'siren', 'unit', 'nanite'],
      },
      {
        slug: 'spark-unit',
        tags: ['on-command', 'enemy', 'spark', 'unit', 'nanite'],
      },
      {
        slug: 'vector-unit',
        tags: ['on-command', 'enemy', 'vector', 'unit', 'nanite'],
      },
      {
        slug: 'distributors',
        tags: ['on-command', 'enemy', 'distributors', 'unit', 'nanite'],
      },

      // ===== ON COMMAND SYSTEMS =====
      {
        slug: 'nanite-technology',
        tags: ['on-command', 'nanite', 'technology', 'system'],
      },
      {
        slug: 'mag-projectile-system',
        tags: ['on-command', 'mag', 'projectile', 'weapon', 'system'],
      },
      {
        slug: 'modular-components-system',
        tags: ['on-command', 'modular', 'components', 'system'],
      },
      {
        slug: 'multi-point-propulsion-system',
        tags: ['on-command', 'propulsion', 'system'],
      },
      {
        slug: 'heat-management-system',
        tags: ['on-command', 'heat', 'management', 'system'],
      },
      {
        slug: 'environmental-boost-system',
        tags: ['on-command', 'environmental', 'boost', 'system'],
      },
      {
        slug: 'emplacement-zones-system',
        tags: ['on-command', 'emplacement', 'zones', 'system'],
      },
      {
        slug: 'strategic-points-system',
        tags: ['on-command', 'strategic', 'points', 'system'],
      },
      {
        slug: 'time-to-prepare-system',
        tags: ['on-command', 'time-to-prepare', 'ttp', 'system'],
      },
      {
        slug: 'proximity-mines',
        tags: ['on-command', 'proximity', 'mines', 'weapon'],
      },
      {
        slug: 'hackable-terminals',
        tags: ['on-command', 'hackable', 'terminals', 'system'],
      },
      {
        slug: 'cauterizing-suits',
        tags: ['on-command', 'cauterizing', 'suits', 'equipment'],
      },
      {
        slug: 'rock-paper-scissors-combat',
        tags: ['on-command', 'combat', 'rock-paper-scissors', 'system'],
      },

      // ===== AUTUMN PROJECT PAGES =====
      {
        slug: 'autumn-character',
        tags: ['autumn', 'character', 'protagonist', 'player'],
      },
      {
        slug: 'father-fortune',
        tags: ['autumn', 'character', 'father-fortune', 'divine'],
      },
      {
        slug: 'mother-nature',
        tags: ['autumn', 'character', 'mother-nature', 'beatrice', 'divine'],
      },
      {
        slug: 'day-and-night',
        tags: ['autumn', 'character', 'day', 'night', 'dual'],
      },
      {
        slug: 'village-folk',
        tags: ['autumn', 'character', 'village', 'folk', 'community'],
      },
      {
        slug: 'little-raccoon-character',
        tags: ['autumn', 'character', 'little', 'raccoon', 'companion'],
      },
      {
        slug: 'spring-character',
        tags: ['autumn', 'character', 'spring', 'season', 'sacrificing'],
      },
      {
        slug: 'summer-character',
        tags: ['autumn', 'character', 'summer', 'season', 'perfectionist'],
      },
      {
        slug: 'winter-character',
        tags: ['autumn', 'character', 'winter', 'season', 'distant'],
      },
      { slug: 'family-home', tags: ['autumn', 'location', 'family', 'home'] },
      {
        slug: 'world-of-ether',
        tags: ['autumn', 'location', 'world', 'ether'],
      },
      {
        slug: 'character-needs-tracking',
        tags: ['autumn', 'system', 'needs', 'tracking'],
      },

      // ===== ENACT EMOTION SYMBOLS =====
      {
        slug: 'balance',
        tags: ['enact-symbol', 'central-state', 'balance', 'equilibrium', 'core-enact'],
      },
      {
        slug: 'depression',
        tags: ['enact-symbol', 'central-state', 'depression', 'core-enact'],
      },
      {
        slug: 'honor-dignity-pride',
        tags: ['enact-symbol', 'affect', 'honor', 'dignity', 'pride', 'core-enact'],
      },
      {
        slug: 'enmity-will-of-reproach',
        tags: ['enact-symbol', 'affect', 'enmity', 'reproach', 'core-enact'],
      },
      {
        slug: 'fear-anxiety-aversion',
        tags: ['enact-symbol', 'affect', 'fear', 'anxiety', 'aversion', 'core-enact'],
      },
      {
        slug: 'pain-injury-trauma',
        tags: ['enact-symbol', 'affect', 'pain', 'injury', 'trauma', 'core-enact'],
      },
      {
        slug: 'response-aggression',
        tags: ['enact-symbol', 'affect', 'response', 'aggression', 'core-enact'],
      },
      {
        slug: 'courage-volition',
        tags: ['enact-symbol', 'affect', 'courage', 'volition', 'core-enact'],
      },
      {
        slug: 'comfort-reassurance',
        tags: ['enact-symbol', 'affect', 'comfort', 'reassurance', 'core-enact'],
      },
      {
        slug: 'seeking-want-take',
        tags: ['enact-symbol', 'affect', 'seeking', 'want', 'take', 'core-enact'],
      },
      {
        slug: 'empathy',
        tags: ['enact-symbol', 'affect', 'empathy', 'understanding', 'core-enact'],
      },
      {
        slug: 'contentment-complacency',
        tags: ['enact-symbol', 'affect', 'contentment', 'complacency', 'core-enact'],
      },
      {
        slug: 'elation-pleasure',
        tags: ['enact-symbol', 'affect', 'elation', 'pleasure', 'core-enact'],
      },
      {
        slug: 'misery-loss-shame',
        tags: ['enact-symbol', 'affect', 'misery', 'loss', 'shame', 'core-enact'],
      },

      // ===== SHARED SYSTEMS =====
      {
        slug: 'dimensional-portals',
        tags: ['cross-project', 'dimensional', 'portals', 'system'],
      },
      {
        slug: 'disappearing-stars-mystery',
        tags: ['cross-project', 'stars', 'mystery', 'cosmic'],
      },
      {
        slug: 'architect-ai',
        tags: ['cross-project', 'ai', 'architect', 'system'],
      },
      {
        slug: 'core-mechanics',
        tags: ['cross-project', 'mechanics', 'core', 'system'],
      },

      // ===== DEVELOPMENT & TECHNICAL =====
      {
        slug: 'content-creation-overview',
        tags: ['development', 'content', 'creation', 'overview', 'guide'],
      },
      {
        slug: 'design-philosophy-overview',
        tags: ['development', 'design', 'philosophy', 'overview'],
      },
      {
        slug: 'political-messaging-strategy',
        tags: ['development', 'politics', 'messaging', 'strategy'],
      },
      {
        slug: 'development-setup',
        tags: ['development', 'setup', 'environment', 'technical'],
      },
      {
        slug: 'gdscript-patterns',
        tags: ['development', 'gdscript', 'coding', 'patterns', 'technical'],
      },
      {
        slug: 'platform-compatibility',
        tags: ['development', 'platform', 'compatibility', 'technical'],
      },
      {
        slug: 'technical-standards-overview',
        tags: ['development', 'standards', 'technical', 'overview'],
      },
      {
        slug: 'writing-standards',
        tags: ['development', 'writing', 'standards', 'documentation'],
      },
      {
        slug: 'writing-guidelines-framework',
        tags: ['development', 'writing', 'guidelines', 'framework'],
      },
      {
        slug: 'api-documentation-guidelines',
        tags: ['development', 'api', 'documentation', 'guidelines'],
      },
      {
        slug: 'art-direction-standards',
        tags: ['development', 'art', 'direction', 'standards'],
      },
      {
        slug: 'audio-design-philosophy',
        tags: ['development', 'audio', 'design', 'philosophy'],
      },
      {
        slug: 'quality-assurance-standards',
        tags: ['development', 'quality', 'assurance', 'standards'],
      },

      // ===== COMMUNITY & DOCUMENTATION =====
      {
        slug: 'community-guidelines',
        tags: ['community', 'guidelines', 'rules', 'forum'],
      },

      // ===== DEMO/TEMPLATE PAGES =====
      {
        slug: 'infobox-demo-character-profile',
        tags: ['demo', 'infobox', 'character', 'template'],
      },
      {
        slug: 'infobox-demo-game-project',
        tags: ['demo', 'infobox', 'project', 'template'],
      },
      {
        slug: 'infobox-demo-game-system',
        tags: ['demo', 'infobox', 'system', 'template'],
      },
      {
        slug: 'infobox-demo-positions',
        tags: ['demo', 'infobox', 'positions', 'template'],
      },
    ];

    // Create all unique tags first
    const allTags = new Set();
    allPageTaggingRules.forEach(rule => {
      rule.tags.forEach(tag => allTags.add(tag));
    });

    console.log(`📝 Creating ${allTags.size} unique tags...`);
    const insertTag = db.prepare(
      'INSERT OR IGNORE INTO wiki_tags (name, description, color, usage_count, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)'
    );

    allTags.forEach(tagName => {
      insertTag.run(tagName, null, null, 0);
    });

    // Apply tags to pages
    console.log(`\n🏷️ Tagging ${allPageTaggingRules.length} pages...\n`);

    const transaction = db.transaction(() => {
      let successCount = 0;
      let notFoundCount = 0;

      for (const rule of allPageTaggingRules) {
        // Find the page by slug
        const page = db.prepare('SELECT * FROM wiki_pages WHERE slug = ?').get(rule.slug);
        if (!page) {
          console.log(`  ❌ Page not found: ${rule.slug}`);
          notFoundCount++;
          continue;
        }

        // Remove existing tags for this page
        db.prepare('DELETE FROM wiki_page_tags WHERE page_id = ?').run(page.id);

        // Add new tags
        const insertPageTag = db.prepare(
          'INSERT INTO wiki_page_tags (page_id, tag_id, tagged_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
        );

        rule.tags.forEach(tagName => {
          const tag = db.prepare('SELECT id FROM wiki_tags WHERE name = ?').get(tagName);
          if (tag) {
            insertPageTag.run(page.id, tag.id);
          }
        });

        console.log(`  ✅ ${page.title.padEnd(40)} -> [${rule.tags.join(', ')}]`);
        successCount++;
      }

      console.log(`\n📊 Tagging Results:`);
      console.log(`  ✅ Successfully tagged: ${successCount} pages`);
      console.log(`  ❌ Pages not found: ${notFoundCount} pages`);
    });

    transaction();

    // Update tag usage counts
    console.log(`\n🔄 Updating tag usage counts...`);
    db.prepare(
      `
      UPDATE wiki_tags 
      SET usage_count = (
        SELECT COUNT(*) 
        FROM wiki_page_tags 
        WHERE tag_id = wiki_tags.id
      )
    `
    ).run();

    // Final verification
    console.log(`\n🎯 Final Statistics:`);

    const taggedPages = db
      .prepare(
        `
      SELECT COUNT(DISTINCT p.id) as count
      FROM wiki_pages p
      JOIN wiki_page_tags pt ON p.id = pt.page_id
    `
      )
      .get();

    const totalPages = db.prepare('SELECT COUNT(*) as count FROM wiki_pages').get();
    const totalTags = db.prepare('SELECT COUNT(*) as count FROM wiki_tags').get();

    console.log(`  📄 Total pages: ${totalPages.count}`);
    console.log(`  🏷️ Total tags: ${totalTags.count.count}`);
    console.log(`  ✅ Tagged pages: ${taggedPages.count}`);
    console.log(`  ❌ Untagged pages: ${totalPages.count - taggedPages.count}`);

    // Show most used tags
    console.log(`\n🔥 Most used tags:`);
    const topTags = db
      .prepare(
        `
      SELECT name, usage_count 
      FROM wiki_tags 
      WHERE usage_count > 0 
      ORDER BY usage_count DESC 
      LIMIT 10
    `
      )
      .all();

    topTags.forEach((tag, i) => {
      console.log(
        `  ${(i + 1).toString().padStart(2)}: ${tag.name.padEnd(20)} (${tag.usage_count} pages)`
      );
    });

    console.log(`\n✅ COMPREHENSIVE TAGGING COMPLETE!`);
    console.log(`🌟 All ${taggedPages.count} pages are now properly categorized.`);
  } catch (error) {
    console.error('❌ Error during comprehensive tagging:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run if called directly
if (require.main === module) {
  comprehensiveTagging();
}

module.exports = { comprehensiveTagging };
