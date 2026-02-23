const Database = require('better-sqlite3');
const fs = require('fs');

// Function to simplify text by breaking down complex sentences
function simplifyText(text) {
  // This is a simplified approach - replace complex sentence patterns with simpler ones
  return (
    text
      // Remove excessive bureaucratic padding
      .replace(
        /operational (?:periods?|parameters?|frameworks?|protocols?|requirements?)/g,
        'operations'
      )
      .replace(
        /administrative (?:coordination|mechanisms|procedures|frameworks?)/g,
        'administration'
      )
      .replace(/systematic (?:organization|coordination|management)/g, 'systematic')
      .replace(/comprehensive (?:understanding|analysis|assessment)/g, 'complete')
      .replace(/essential (?:coordination|management|functions?)/g, 'essential')
      .replace(/specialized (?:technical|operational) expertise/g, 'specialized expertise')
      .replace(/sophisticated (?:systems?|mechanisms?|approaches?)/g, 'advanced')

      // Break down long sentences by replacing complex connectors
      .replace(/, while maintaining /g, '. They maintain ')
      .replace(/, enabling /g, '. This enables ')
      .replace(/, ensuring /g, '. This ensures ')
      .replace(/, creating /g, '. This creates ')
      .replace(/, providing /g, '. This provides ')
      .replace(/; /g, '. ')

      // Simplify complex phrases
      .replace(/through the utilization of/g, 'by using')
      .replace(/in order to/g, 'to')
      .replace(/for the purpose of/g, 'to')
      .replace(/with regard to/g, 'regarding')
      .replace(/in the event that/g, 'if')
      .replace(/due to the fact that/g, 'because')

      // Fix capitalization after our sentence breaks
      .replace(/\. ([a-z])/g, (match, p1) => '. ' + p1.toUpperCase())
  );
}

function updateWikiPage(db, slug, title, newContent) {
  try {
    const pageStmt = db.prepare('SELECT id FROM wiki_pages WHERE slug = ?');
    const page = pageStmt.get(slug);

    if (!page) {
      console.log(`Page not found: ${slug}`);
      return false;
    }

    const pageId = page.id;

    const revisionStmt = db.prepare(`
      INSERT INTO wiki_revisions (page_id, content, summary, author_id, size_bytes)
      VALUES (?, ?, ?, ?, ?)
    `);

    const summary = `Revised to use proper Wikipedia-style sentence structure - simplified complex nested sentences and removed bureaucratic padding`;
    const authorId = 1;
    const sizeBytes = Buffer.byteLength(newContent, 'utf8');

    revisionStmt.run(pageId, newContent, summary, authorId, sizeBytes);

    const updateStmt = db.prepare(
      'UPDATE wiki_pages SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );
    updateStmt.run(pageId);

    console.log(`Successfully updated: ${slug} (${sizeBytes} bytes)`);
    return true;
  } catch (error) {
    console.error(`Error updating ${slug}:`, error.message);
    return false;
  }
}

// Get original content and revise it
function getAndReviseOriginal(db, slug) {
  const stmt = db.prepare(`
    SELECT p.slug, p.title, r.content
    FROM wiki_pages p
    LEFT JOIN wiki_revisions r ON p.id = r.page_id
    WHERE p.slug = ?
    ORDER BY r.revision_timestamp DESC
    LIMIT 1
  `);

  const page = stmt.get(slug);
  if (page && page.content) {
    // Apply simplified revision
    const simplified = simplifyText(page.content);
    return { content: simplified, title: page.title };
  }
  return null;
}

// Main execution
const db = new Database('./data/forums.db');

// Pages that still need revision
const remainingPages = [
  'guards-authority-figures',
  'engineering-caste',
  'labor-caste',
  'icebreaker-caste',
  'stonebreaker-caste',
  'grand-voss-megastructures',
  'vatra-hub',
  'atlas-tether-infrastructure',
  'neural-implant-technology',
];

try {
  let updatedCount = 0;

  remainingPages.forEach(slug => {
    const revised = getAndReviseOriginal(db, slug);
    if (revised) {
      if (updateWikiPage(db, slug, revised.title, revised.content)) {
        updatedCount++;
      }
    } else {
      console.log(`Could not revise: ${slug}`);
    }
  });

  console.log(`\nRevised and updated ${updatedCount} pages successfully.`);
} finally {
  db.close();
}
