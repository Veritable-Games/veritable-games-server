#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'forums.db');

try {
  const db = new Database(dbPath);
  console.log('🔍 FINAL COMPREHENSIVE CONTENT GAP ANALYSIS\n');

  // Get all existing wiki pages
  const existingPages = db
    .prepare(
      `
    SELECT DISTINCT
      p.slug,
      p.title,
      GROUP_CONCAT(DISTINCT c.name) as categories
    FROM wiki_pages p
    LEFT JOIN wiki_page_categories pc ON p.id = pc.page_id
    LEFT JOIN wiki_categories c ON pc.category_id = c.id
    WHERE p.status = 'published'
    GROUP BY p.slug
    ORDER BY p.title
  `
    )
    .all();

  console.log(`📊 Current wiki pages: ${existingPages.length}\n`);

  // Read key project documents to extract detailed elements
  const projectNotesPath = '/home/user/Projects/web/project-notes';

  // Helper function to check if something exists in wiki
  const existsInWiki = searchTerms => {
    return existingPages.some(page => {
      const pageText = (page.title + ' ' + page.slug).toLowerCase();
      return searchTerms.some(term => pageText.includes(term.toLowerCase()));
    });
  };

  // Comprehensive analysis of missing elements
  const missingElements = {
    NOXII: {
      characters: [
        // Fellow prisoners mentioned in design docs
        {
          name: 'Fellow NOXII Prisoners',
          type: 'Character Group',
          priority: 'medium',
          description: 'Other prisoners in death games, potential allies/enemies',
        },
        {
          name: 'Guards/Authority Figures',
          type: 'Character Group',
          priority: 'medium',
          description: 'Empire representatives enforcing prison system',
        },
        {
          name: 'Anarchists (External)',
          type: 'Character Group',
          priority: 'high',
          description: 'Liberation network that saved player character',
        },
      ],

      locations: [
        {
          name: 'Dropship',
          type: 'Location',
          priority: 'medium',
          description: 'Transport to death game arenas',
        },
        {
          name: 'Stadium',
          type: 'Location',
          priority: 'medium',
          description: 'Death game arena environment',
        },
        {
          name: 'Complex Architectural Environments',
          type: 'Location',
          priority: 'low',
          description: 'Varied arena types within Atlas Tethers',
        },
      ],

      items: [
        {
          name: 'Iron Slugs',
          type: 'Weapon/Item',
          priority: 'high',
          description: 'Throwing weapons mentioned in item system',
        },
        {
          name: 'Homing Magnets',
          type: 'Weapon/Item',
          priority: 'high',
          description: 'Magnetic targeting system for combat',
        },
        {
          name: 'Drag Anchors',
          type: 'Weapon/Item',
          priority: 'high',
          description: 'Mobility control items in skydiving combat',
        },
        {
          name: 'Boost Cells',
          type: 'Item',
          priority: 'medium',
          description: 'Consumable propulsion enhancement items',
        },
        {
          name: 'Protection Cores',
          type: 'Item',
          priority: 'medium',
          description: 'Defensive equipment for matches',
        },
      ],

      mechanics: [
        {
          name: 'Backwards Throwing Mechanic',
          type: 'Mechanic',
          priority: 'medium',
          description: 'Unique throwing system mentioned in design',
        },
        {
          name: 'Damage-Dealt Currency System',
          type: 'Economy',
          priority: 'high',
          description: 'Injury Points and Death Points economy',
        },
        {
          name: 'Broadcast Audience System',
          type: 'Mechanic',
          priority: 'medium',
          description: 'Entertainment/spectacle mechanics for viewers',
        },
        {
          name: 'Violence Escalation System',
          type: 'Social Mechanic',
          priority: 'high',
          description: 'Conversation choices leading to physical consequences',
        },
        {
          name: 'Political Identity Tracking',
          type: 'Social System',
          priority: 'high',
          description: 'System tracking performed vs actual beliefs',
        },
      ],
    },

    DODEC: {
      locations: [
        {
          name: 'Maria (Northernmost Tether)',
          type: 'Location',
          priority: 'medium',
          description: 'Specific Atlas Tether location on Chione',
        },
        {
          name: 'Endless Ocean',
          type: 'Location',
          priority: 'medium',
          description: "Chione's vast ocean system",
        },
        {
          name: 'Ring Structures',
          type: 'Architecture',
          priority: 'medium',
          description: 'Massive ring architecture on Chione',
        },
      ],

      systems: [
        {
          name: 'Weighted Movement System',
          type: 'Mechanic',
          priority: 'medium',
          description: "Oskidere's heavy mechanical movement",
        },
        {
          name: 'Repair & Maintenance System',
          type: 'Mechanic',
          priority: 'medium',
          description: 'Community maintenance and care systems',
        },
        {
          name: 'Mystery Investigation System',
          type: 'Mechanic',
          priority: 'low',
          description: 'Exploration and discovery mechanics',
        },
        {
          name: 'Environmental Storytelling System',
          type: 'Narrative',
          priority: 'low',
          description: 'World narrative through environment',
        },
      ],

      items: [
        {
          name: 'Vertical Scalers',
          type: 'Equipment',
          priority: 'medium',
          description: 'Equipment for navigating Atlas Tethers',
        },
        {
          name: 'Modular Components',
          type: 'Equipment',
          priority: 'medium',
          description: "Parts for Oskidere's modular system",
        },
        {
          name: 'Repair Tools',
          type: 'Equipment',
          priority: 'medium',
          description: 'Community maintenance equipment',
        },
      ],
    },

    'ON COMMAND': {
      mechanics: [
        {
          name: 'Actionable Objects (AO) System',
          type: 'Mechanic',
          priority: 'high',
          description: 'Interactive environment objects mentioned in design',
        },
        {
          name: 'Droid Enemy AI System',
          type: 'Combat System',
          priority: 'high',
          description: 'AI behavior for droid opponents',
        },
        {
          name: 'Mission Selection System',
          type: 'Interface System',
          priority: 'medium',
          description: 'Squad subset selection for missions',
        },
        {
          name: 'Communication Framework',
          type: 'Interface System',
          priority: 'medium',
          description: 'Squad coordination and command systems',
        },
        {
          name: 'Cover System',
          type: 'Combat Mechanic',
          priority: 'medium',
          description: 'Environmental protection mechanics',
        },
      ],

      characters: [
        {
          name: 'Extended Squad Pool Members',
          type: 'Character Group',
          priority: 'low',
          description: 'Additional squad members beyond core 6',
        },
      ],

      locations: [
        {
          name: 'City of Alexandria',
          type: 'Location',
          priority: 'medium',
          description: 'Major city location mentioned in docs',
        },
        {
          name: 'Allied Civil Preserve Territory',
          type: 'Location',
          priority: 'medium',
          description: 'ACP controlled areas',
        },
      ],

      items: [
        {
          name: 'EVA Suits',
          type: 'Equipment',
          priority: 'medium',
          description: 'Environmental suits for hazardous conditions',
        },
        {
          name: 'Proximity Mines',
          type: 'Equipment',
          priority: 'medium',
          description: 'Explosive/stunning defensive equipment',
        },
        {
          name: 'Terminals (Hackable)',
          type: 'Environment',
          priority: 'medium',
          description: 'Interactive computer systems',
        },
        {
          name: 'Distributors',
          type: 'Equipment',
          priority: 'medium',
          description: 'Resource distribution technology',
        },
      ],
    },

    AUTUMN: {
      mechanics: [
        {
          name: 'Reading & Listening Benefits',
          type: 'Social Mechanic',
          priority: 'medium',
          description: 'Gameplay benefits from engaging with stories/books',
        },
        {
          name: 'Relationship Balance System',
          type: 'Social System',
          priority: 'medium',
          description: 'Managing relationships between all characters',
        },
        {
          name: 'Community Care Mechanics',
          type: 'Social System',
          priority: 'medium',
          description: 'Collective caregiving and support systems',
        },
        {
          name: 'Emotional State Management',
          type: 'Character System',
          priority: 'medium',
          description: 'Managing Autumn and others emotional wellbeing',
        },
      ],

      locations: [
        {
          name: 'Family Home',
          type: 'Location',
          priority: 'medium',
          description: "Autumn's personal living space",
        },
        {
          name: 'The Forest/Ether',
          type: 'Location',
          priority: 'medium',
          description: 'Natural/spiritual space in AUTUMN',
        },
        {
          name: 'Character Personal Spaces',
          type: 'Location Group',
          priority: 'low',
          description: 'Individual character living/working spaces',
        },
      ],

      items: [
        {
          name: "Autumn's Journal",
          type: 'Narrative Item',
          priority: 'medium',
          description: 'Personal writing and reflection tool',
        },
        {
          name: 'Seasonal Tools',
          type: 'Equipment',
          priority: 'low',
          description: 'Tools for seasonal work and activities',
        },
      ],
    },

    'COSMIC KNIGHTS': {
      mechanics: [
        {
          name: 'Banner Command System',
          type: 'Command Mechanic',
          priority: 'high',
          description: 'Knight leadership and unit coordination',
        },
        {
          name: 'Crystal Economy System',
          type: 'Resource System',
          priority: 'high',
          description: 'Resource collection and management',
        },
        {
          name: 'Fracture Warfare',
          type: 'Combat System',
          priority: 'high',
          description: 'Dimensional combat mechanics',
        },
        {
          name: 'Environmental Corruption',
          type: 'Environmental System',
          priority: 'medium',
          description: 'World corruption and cleansing mechanics',
        },
        {
          name: 'Vehicle-Based Specialization',
          type: 'Character System',
          priority: 'medium',
          description: 'Different knights with specialized vehicles',
        },
        {
          name: 'Scalable Command System',
          type: 'Interface System',
          priority: 'medium',
          description: 'Managing forces from small to large scale',
        },
      ],

      locations: [
        {
          name: 'Fracture Sites',
          type: 'Location',
          priority: 'high',
          description: 'Dimensional breach locations',
        },
        {
          name: 'Corrupted Territories',
          type: 'Location',
          priority: 'medium',
          description: 'Areas affected by dimensional corruption',
        },
        {
          name: 'Dimensional Portals',
          type: 'Location',
          priority: 'medium',
          description: 'Gateways between dimensions',
        },
      ],

      systems: [
        {
          name: 'AI Learning System',
          type: 'Mechanic',
          priority: 'medium',
          description: 'Adaptive AI that learns from player tactics',
        },
        {
          name: 'Knight Progression System',
          type: 'Character System',
          priority: 'medium',
          description: 'Character development and advancement',
        },
        {
          name: 'Audio Design Integration',
          type: 'Interface System',
          priority: 'low',
          description: 'Music and sound as gameplay mechanics',
        },
      ],
    },

    SYSTEMS: {
      crossProject: [
        {
          name: 'Diegetic Interface Systems',
          type: 'Interface Design',
          priority: 'high',
          description: 'In-world interface elements across all projects',
        },
        {
          name: 'Political Messaging Strategy',
          type: 'Narrative Framework',
          priority: 'high',
          description: 'Overarching political themes across projects',
        },
        {
          name: 'Restorative Justice Framework',
          type: 'Narrative Philosophy',
          priority: 'high',
          description: 'Alternative justice approach in all games',
        },
        {
          name: 'Community Building Mechanics',
          type: 'Social System',
          priority: 'medium',
          description: 'Shared community development concepts',
        },
        {
          name: 'Anti-Authoritarian Design Principles',
          type: 'Design Philosophy',
          priority: 'medium',
          description: 'Design approaches that resist hierarchy',
        },
      ],
    },
  };

  console.log('🎯 MISSING ELEMENTS ANALYSIS:\n');
  console.log('='.repeat(50));

  // Analyze and categorize missing elements
  let highPriorityMissing = [];
  let mediumPriorityMissing = [];
  let lowPriorityMissing = [];

  Object.keys(missingElements).forEach(project => {
    console.log(`\n📁 ${project.toUpperCase()}`);
    console.log('-'.repeat(project.length + 4));

    Object.keys(missingElements[project]).forEach(category => {
      const items = missingElements[project][category];

      items.forEach(item => {
        const searchTerms = [item.name.toLowerCase(), ...item.name.toLowerCase().split(' ')];

        if (!existsInWiki(searchTerms)) {
          const missingItem = {
            ...item,
            project,
            category: category.toUpperCase(),
          };

          if (item.priority === 'high') {
            highPriorityMissing.push(missingItem);
          } else if (item.priority === 'medium') {
            mediumPriorityMissing.push(missingItem);
          } else {
            lowPriorityMissing.push(missingItem);
          }

          const priorityIcon =
            item.priority === 'high' ? '🔴' : item.priority === 'medium' ? '🟡' : '🟢';
          console.log(`   ${priorityIcon} ${item.name} (${item.type})`);
          console.log(`      ${item.description}`);
        }
      });
    });
  });

  console.log('\n\n🔥 HIGH PRIORITY MISSING PAGES:');
  console.log('='.repeat(40));
  highPriorityMissing.forEach((item, index) => {
    console.log(`${index + 1}. ${item.name} (${item.project} - ${item.type})`);
    console.log(`   📝 ${item.description}`);
  });

  console.log('\n\n⚡ MEDIUM PRIORITY MISSING PAGES:');
  console.log('='.repeat(40));
  mediumPriorityMissing.forEach((item, index) => {
    console.log(`${index + 1}. ${item.name} (${item.project} - ${item.type})`);
    console.log(`   📝 ${item.description}`);
  });

  console.log('\n\n📋 SUMMARY:');
  console.log(`• Current wiki pages: ${existingPages.length}`);
  console.log(`• High priority missing: ${highPriorityMissing.length}`);
  console.log(`• Medium priority missing: ${mediumPriorityMissing.length}`);
  console.log(`• Low priority missing: ${lowPriorityMissing.length}`);
  console.log(
    `• Total identified gaps: ${highPriorityMissing.length + mediumPriorityMissing.length + lowPriorityMissing.length}`
  );

  console.log('\n\n🎯 RECOMMENDED NEXT BATCH:');
  console.log('Top 10 most important missing pages:');
  const topMissing = [...highPriorityMissing, ...mediumPriorityMissing].slice(0, 10);
  topMissing.forEach((item, index) => {
    console.log(`${index + 1}. ${item.name} (${item.project})`);
  });

  db.close();
} catch (error) {
  console.error('❌ Error in final content gap analysis:', error);
  process.exit(1);
}
