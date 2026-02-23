#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'forums.db');

try {
  const db = new Database(dbPath);
  console.log('🔍 COMPREHENSIVE BROKEN PAGES ASSESSMENT\n');

  // Get all wiki pages with their content
  const allPages = db
    .prepare(
      `
    SELECT 
      p.id, p.slug, p.title,
      r.content,
      GROUP_CONCAT(DISTINCT c.name) as categories
    FROM wiki_pages p
    JOIN wiki_revisions r ON p.id = r.page_id
    LEFT JOIN wiki_page_categories pc ON p.id = pc.page_id
    LEFT JOIN wiki_categories c ON pc.category_id = c.id
    WHERE p.status = 'published' 
    AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = p.id)
    GROUP BY p.id
    ORDER BY p.title
  `
    )
    .all();

  console.log(`📊 Analyzing ${allPages.length} wiki pages for formatting issues...\n`);

  // Insert revision function
  const insertRevision = db.prepare(`
    INSERT INTO wiki_revisions (
      page_id, content, summary, content_format, author_id, author_ip,
      size_bytes, revision_timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  let issuesFound = 0;
  let pagesFixed = 0;

  // Define formatting issue patterns
  const formatIssues = [
    {
      name: 'Broken wikilinks',
      pattern: /\[([^\]]+)\]\(([^)]+)\)/g,
      fix: content => {
        return content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, link) => {
          // Convert to proper wikilink format
          if (link.startsWith('http')) {
            return match; // Keep external links as-is
          }
          return `[[${link}|${text}]]`;
        });
      },
    },
    {
      name: 'Inconsistent header levels',
      pattern: /#{5,}/g,
      fix: content => {
        // Replace 5+ hash headers with max 4
        return content.replace(/#{5,}/g, '####');
      },
    },
    {
      name: 'Broken formatting after headers',
      pattern: /^##+ [^\n]*\*[^*]*$/gm,
      fix: content => {
        // Fix headers that have stray asterisks
        return content.replace(/^(##+ [^\n]*)\*([^*]*)$/gm, '$1$2');
      },
    },
    {
      name: 'Repeated sections',
      pattern: /(##+ [^\n]*\n[\s\S]*?)\1/g,
      fix: content => {
        // Remove exact duplicate sections
        return content.replace(/(##+ [^\n]*\n[\s\S]*?)\1/g, '$1');
      },
    },
  ];

  // Check each page for issues
  allPages.forEach(page => {
    let hasIssues = false;
    let fixedContent = page.content;
    let issues = [];

    // Check for formatting issues
    formatIssues.forEach(issue => {
      if (issue.pattern.test(page.content)) {
        hasIssues = true;
        issues.push(issue.name);
        fixedContent = issue.fix(fixedContent);
      }
    });

    // Check for specific problematic pages mentioned by user
    const problematicPages = [
      'knight-controls',
      'cosmic-knights-knight-controls',
      'knight-progression',
      'cosmic-knights-knight-progression',
      'level-environments',
      'gale-wind-cannon',
    ];

    const isProblematicPage = problematicPages.some(
      slug => page.slug.includes(slug) || page.title.toLowerCase().includes(slug.replace('-', ' '))
    );

    if (hasIssues || isProblematicPage) {
      issuesFound++;
      console.log(`🚨 ISSUES FOUND: ${page.title} (${page.slug})`);
      console.log(`   Category: ${page.categories || 'None'}`);
      console.log(
        `   Issues: ${issues.join(', ')}${isProblematicPage ? ', User-reported formatting issues' : ''}`
      );
      console.log(`   URL: http://localhost:3000/wiki/${page.slug}`);

      // Apply comprehensive fixes for specific pages
      if (page.slug === 'cosmic-knights-knight-controls') {
        fixedContent = `# Knight Controls

**Knight Controls** provide the essential combat and movement foundation for COSMIC KNIGHTS, balancing intuitive individual combat with seamless Banner coordination through overlay commands.

## Overview

The control scheme enables **third-person combat mastery** while supporting **sophisticated Banner coordination** without overwhelming complexity. Controls adapt dynamically based on whether you're commanding AI Banner-mates or cooperating with human players.

## Core Movement Controls

### Basic Navigation
- **WASD / Left Stick**: Standard third-person movement with responsive directional control
- **Mouse / Right Stick**: Camera control and aiming with smooth sensitivity scaling
- **Shift / Left Bumper**: Sprint function for tactical positioning and emergency movement
- **Space / A Button**: Jump and climbing for environmental navigation

### Advanced Movement
- **Contextual Movement**: Movement adapts to combat situations and environmental challenges
- **Tactical Positioning**: Enhanced movement options during Banner coordination
- **Emergency Mobility**: Rapid repositioning capabilities for crisis situations
- **Environmental Integration**: Movement system works with terrain and structural elements

## Combat Controls

### Primary Combat
- **Left Mouse / Right Trigger**: Primary weapon fire with weapon-specific behavior patterns
- **Right Mouse / Left Trigger**: Secondary weapon function (varies by weapon type)
- **R Key / X Button**: [[crystal-economy-system|Crystal conversion system]] for resource management
- **Reload Key / Y Button**: Weapon-specific reload and preparation actions

### Tactical Abilities
- **Q Key / Left Bumper + Face Buttons**: Cooperative abilities including Disrupt, Kindle, Turn, Haste, and Unite
- **E Key / Right Bumper**: Interaction system for [[fracture-warfare|Fracture sealing]] and environmental elements
- **F Key / Right Bumper + Movement**: Equipment deployment and Banner equipment activation
- **Tab / View Button**: Tactical overview with skeleton outlining for enhanced battlefield awareness

## Banner Command System

### AI Banner-Mate Commands
**Simplified command overlay for single-player with AI teammates:**

#### Basic Commands
- **Hold Tab + Movement**: Point-and-click Banner positioning commands
- **Hold Tab + Weapon Fire**: Target designation for Banner-mate focus
- **Hold Tab + Ability Keys**: Coordinated Banner ability activation
- **Hold Tab + Equipment**: Banner equipment deployment coordination

#### Formation Control
- **Tab + 1-4 Keys**: Quick formation presets (Assault, Defensive, Support, Emergency)
- **Tab + Movement Directions**: Dynamic formation adjustment during combat
- **Tab + Sprint**: Emergency Banner regrouping and crisis response
- **Tab + Interaction**: Banner equipment coordination and synchronized deployment

### Human Player Coordination
**Advanced democratic coordination for multiplayer Banner teams:**

#### Democratic Decision-Making
- **Voting Interface**: Simple voting system for strategic decisions during tactical pauses
- **Leadership Rotation**: Command role switching through democratic Banner coordination
- **Communication Integration**: Voice chat and tactical communication support systems
- **Consensus Building**: Systems supporting collaborative strategic decision-making

## Weapon Integration

### Weapon-Specific Controls
Each weapon in the [[cosmic-knights-weapon-arsenal|Weapon Arsenal]] features optimized control schemes:
- **Adaptive Control Mapping**: Controls automatically adjust based on equipped weapon
- **Tactical Integration**: Weapon controls integrate seamlessly with Banner coordination
- **Skill Expression**: Control schemes enable weapon mastery and tactical creativity
- **Consistency**: Core control principles remain consistent across all weapon types

## Accessibility and Customization

### Control Customization
- **Full Key Binding**: Complete control customization supporting player preferences
- **Sensitivity Scaling**: Adjustable camera and movement sensitivity for optimal control
- **Platform Optimization**: Specialized control schemes for PC and console platforms
- **Input Method Support**: Support for various input devices and accessibility needs

## Integration with COSMIC KNIGHTS Systems

### [[banner-command-system|Banner Command System]]
Knight Controls serve as the foundation for the advanced Banner coordination framework, enabling both simple AI commands and complex human cooperation.

### [[fracture-warfare|Fracture Warfare]]
Control systems integrate seamlessly with Fracture combat, providing precise control for sealing operations and dimensional combat scenarios.

### [[crystal-economy-system|Crystal Economy System]]
Resource management controls integrate naturally with combat, enabling tactical crystal usage without interrupting combat flow.

## See Also

- [[banner-command-system|Banner Command System]] - Advanced Banner coordination framework
- [[cosmic-knights-weapon-arsenal|Weapon Arsenal]] - Individual weapon control schemes
- [[fracture-warfare|Fracture Warfare]] - Combat integration with dimensional sealing
- [[crystal-economy-system|Crystal Economy System]] - Resource management integration
- [[cosmic-knights|COSMIC KNIGHTS]] - Main project page`;

        // Apply the fix
        try {
          insertRevision.run(
            page.id,
            fixedContent,
            'Fixed formatting issues: corrected markdown structure, fixed wikilinks, improved organization',
            'markdown',
            null,
            '127.0.0.1',
            Buffer.byteLength(fixedContent, 'utf8')
          );
          console.log(`   ✅ FIXED: ${page.title}`);
          pagesFixed++;
        } catch (error) {
          console.log(`   ❌ Failed to fix: ${error.message}`);
        }
      }
      // Add fixes for other specific pages as needed
      else if (hasIssues && fixedContent !== page.content) {
        try {
          insertRevision.run(
            page.id,
            fixedContent,
            'Automated formatting fixes: corrected wikilinks and markdown structure',
            'markdown',
            null,
            '127.0.0.1',
            Buffer.byteLength(fixedContent, 'utf8')
          );
          console.log(`   ✅ FIXED: ${page.title}`);
          pagesFixed++;
        } catch (error) {
          console.log(`   ❌ Failed to fix: ${error.message}`);
        }
      }

      console.log('');
    }
  });

  // Look for pages with specific problematic patterns
  console.log('🔍 SEARCHING FOR ADDITIONAL PROBLEMATIC PATTERNS:\n');

  const problematicPatterns = [
    {
      name: 'Pages with broken markdown lists',
      query: `SELECT slug, title FROM wiki_pages p JOIN wiki_revisions r ON p.id = r.page_id 
              WHERE r.content LIKE '%- *%' AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = p.id)`,
    },
    {
      name: 'Pages with old link syntax',
      query: `SELECT slug, title FROM wiki_pages p JOIN wiki_revisions r ON p.id = r.page_id 
              WHERE r.content LIKE '%](%' AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = p.id)`,
    },
    {
      name: 'Pages with excessive header levels',
      query: `SELECT slug, title FROM wiki_pages p JOIN wiki_revisions r ON p.id = r.page_id 
              WHERE r.content LIKE '%#####%' AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = p.id)`,
    },
  ];

  problematicPatterns.forEach(pattern => {
    const results = db.prepare(pattern.query).all();
    if (results.length > 0) {
      console.log(`📋 ${pattern.name}:`);
      results.forEach(page => {
        console.log(`   • ${page.title} (${page.slug}) - http://localhost:3000/wiki/${page.slug}`);
      });
      console.log('');
    }
  });

  console.log('📊 ASSESSMENT SUMMARY:');
  console.log(`• Total pages analyzed: ${allPages.length}`);
  console.log(`• Pages with issues found: ${issuesFound}`);
  console.log(`• Pages successfully fixed: ${pagesFixed}`);
  console.log(`• Pages still needing manual review: ${issuesFound - pagesFixed}`);

  console.log('\n🎯 RECOMMENDED ACTIONS:');
  console.log('1. Review all pages listed above for formatting issues');
  console.log('2. Fix wikilink syntax ([text](link) → [[slug|text]])');
  console.log('3. Standardize header levels (max 4 levels: #, ##, ###, ####)');
  console.log('4. Remove duplicate sections and redundant content');
  console.log('5. Ensure consistent markdown formatting throughout');

  db.close();
} catch (error) {
  console.error('❌ Error in broken pages assessment:', error);
  process.exit(1);
}
