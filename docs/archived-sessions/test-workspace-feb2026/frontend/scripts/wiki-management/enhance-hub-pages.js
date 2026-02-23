#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'forums.db');

try {
  const db = new Database(dbPath);

  console.log('🌟 ENHANCING HUB PAGES WITH MORE CONNECTIONS\n');

  // Enhance Atlas Tether Technology page (major hub)
  const atlasPage = db
    .prepare(
      `
    SELECT p.id, p.slug, p.title, r.content
    FROM wiki_pages p
    JOIN wiki_revisions r ON p.id = r.page_id
    WHERE p.slug = 'atlas-tether-technology' AND p.status = 'published'
    AND r.revision_timestamp = (SELECT MAX(r2.revision_timestamp) FROM wiki_revisions r2 WHERE r2.page_id = p.id)
  `
    )
    .get();

  if (atlasPage && !atlasPage.content.includes('## Character Integration')) {
    const characterIntegrationSection = `

## Character Integration

Atlas Tether Technology directly impacts character experiences across projects:

### DODEC Community Characters
- **[[dodec-community-characters|Community and Characters]]** - Post-war societies built around Atlas Tether infrastructure
- **[[dodec-maintenance-sentinel|The Maintenance Sentinel]]** - Mechanical entity maintaining Atlas Tether systems
- **[[gregers-ovesen|Gregers Ovesen]]** - Community member working with Atlas Tether integration
- **[[marian-cenric|Marian Cenric]]** - Individual adapting to Atlas Tether-based community life

### Infrastructure Systems
- **[[vertical-scalers|Vertical Scalers]]** - Personal mobility equipment for Atlas Tether navigation
- **[[repair-tools|Repair Tools]]** - Community maintenance equipment for Atlas Tether infrastructure
- **[[transportation-network|Transportation Network]]** - Community systems integrated with Atlas Tether structures
- **[[vertical-cities-management-system|Vertical Cities Management]]** - Urban planning around Atlas Tether foundations`;

    const updatedContent = atlasPage.content + characterIntegrationSection;

    const insertRevision = db.prepare(`
      INSERT INTO wiki_revisions (
        page_id, content, summary, content_format, author_id, is_minor, size_bytes, revision_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    insertRevision.run(
      atlasPage.id,
      updatedContent,
      'Add character integration section - connect Atlas Tether technology to community members and systems',
      'markdown',
      1,
      0,
      Buffer.byteLength(updatedContent, 'utf8')
    );

    db.prepare(`UPDATE wiki_pages SET updated_at = datetime('now') WHERE id = ?`).run(atlasPage.id);
    console.log('🌟 Enhanced Atlas Tether Technology with character connections');
  }

  // Enhance VATRA Hub page (major hub for NOXII)
  const vatraPage = db
    .prepare(
      `
    SELECT p.id, p.slug, p.title, r.content
    FROM wiki_pages p
    JOIN wiki_revisions r ON p.id = r.page_id
    WHERE p.slug = 'vatra-hub' AND p.status = 'published'
    AND r.revision_timestamp = (SELECT MAX(r2.revision_timestamp) FROM wiki_revisions r2 WHERE r2.page_id = p.id)
  `
    )
    .get();

  if (vatraPage && !vatraPage.content.includes('## Character Interactions')) {
    const characterInteractionSection = `

## Character Interactions

VATRA Hub serves as central location for prisoner interactions and authority control:

### Authority Figures
- **[[guards-authority-figures|Guards/Authority Figures]]** - Imperial personnel maintaining order within VATRA Hub
- **[[anarchists-external-network|External Anarchists]]** - Hidden resistance network coordinating through hub activities

### Equipment and Systems
- **[[vatra-equipment-exchange-terminal|Equipment Exchange Terminal]]** - Central commodity processing and equipment distribution
- **[[noxii-items-equipment|NOXII Items & Equipment]]** - Gear available through hub systems
- **[[cauterizing-suits|Cauterizing Suits]]** - Medical systems integrated with hub infrastructure
- **[[damage-dealt-currency-system|Damage-Dealt Currency]]** - Economic framework operating through hub transactions`;

    const insertionPoint = vatraPage.content.lastIndexOf('## See Also');
    const updatedContent =
      insertionPoint !== -1
        ? vatraPage.content.slice(0, insertionPoint) +
          characterInteractionSection +
          '\n\n' +
          vatraPage.content.slice(insertionPoint)
        : vatraPage.content + characterInteractionSection;

    const insertRevision = db.prepare(`
      INSERT INTO wiki_revisions (
        page_id, content, summary, content_format, author_id, is_minor, size_bytes, revision_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    insertRevision.run(
      vatraPage.id,
      updatedContent,
      'Add character interaction section - connect VATRA Hub to authority figures and resistance networks',
      'markdown',
      1,
      0,
      Buffer.byteLength(updatedContent, 'utf8')
    );

    db.prepare(`UPDATE wiki_pages SET updated_at = datetime('now') WHERE id = ?`).run(vatraPage.id);
    console.log('🌟 Enhanced VATRA Hub with character interaction details');
  }

  // Enhance Character Classes page (major ON COMMAND hub)
  const classesPage = db
    .prepare(
      `
    SELECT p.id, p.slug, p.title, r.content
    FROM wiki_pages p
    JOIN wiki_revisions r ON p.id = r.page_id
    WHERE p.slug = 'on-command-character-classes' AND p.status = 'published'
    AND r.revision_timestamp = (SELECT MAX(r2.revision_timestamp) FROM wiki_revisions r2 WHERE r2.page_id = p.id)
  `
    )
    .get();

  if (classesPage && !classesPage.content.includes('## Equipment Integration')) {
    const equipmentIntegrationSection = `

## Equipment Integration

Character classes integrate with specialized equipment and systems:

### Combat Equipment
- **[[proximity-mines|Proximity Mines]]** - Specialized equipment for tactical classes
- **[[hackable-terminals|Hackable Terminals]]** - Technology integration for support classes
- **[[distributors|Distributors]]** - Resource management equipment for logistics classes

### Territory and Infrastructure
- **[[allied-civil-preserve-territory|ACP Territory]]** - Operational environment for character classes
- **[[post-war-reconstruction|Post-War Reconstruction]]** - Context for character class evolution and adaptation`;

    const insertionPoint = classesPage.content.lastIndexOf('## See Also');
    const updatedContent =
      insertionPoint !== -1
        ? classesPage.content.slice(0, insertionPoint) +
          equipmentIntegrationSection +
          '\n\n' +
          classesPage.content.slice(insertionPoint)
        : classesPage.content + equipmentIntegrationSection;

    const insertRevision = db.prepare(`
      INSERT INTO wiki_revisions (
        page_id, content, summary, content_format, author_id, is_minor, size_bytes, revision_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    insertRevision.run(
      classesPage.id,
      updatedContent,
      'Add equipment integration section - connect character classes to specialized equipment and territory systems',
      'markdown',
      1,
      0,
      Buffer.byteLength(updatedContent, 'utf8')
    );

    db.prepare(`UPDATE wiki_pages SET updated_at = datetime('now') WHERE id = ?`).run(
      classesPage.id
    );
    console.log('🌟 Enhanced Character Classes with equipment integration');
  }

  db.close();
  console.log('\n✅ Enhanced hub pages with additional connections');
} catch (error) {
  console.error('❌ Error enhancing hub pages:', error);
  process.exit(1);
}
