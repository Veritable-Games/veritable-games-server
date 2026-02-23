const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('./data/forums.db');

try {
  // Get all unique NOXII wiki pages
  const wikiPages = db
    .prepare(
      `
    SELECT 
      p.slug, 
      p.title, 
      r.content,
      LENGTH(r.content) as content_length
    FROM wiki_pages p
    LEFT JOIN wiki_revisions r ON p.id = r.page_id
    WHERE (p.namespace = 'noxii' OR p.slug LIKE '%noxii%' OR p.title LIKE '%noxii%')
      AND r.revision_timestamp = (
        SELECT MAX(r2.revision_timestamp) 
        FROM wiki_revisions r2 
        WHERE r2.page_id = p.id
      )
    ORDER BY p.title
  `
    )
    .all();

  console.log('=== NOXII WIKI CONTENT ANALYSIS ===\n');

  // Analyze content completeness
  let totalWords = 0;
  let pagesWithContent = 0;
  const contentAnalysis = [];

  wikiPages.forEach(page => {
    if (page.content && page.content.trim().length > 0) {
      pagesWithContent++;
      const wordCount = page.content.split(/\s+/).length;
      totalWords += wordCount;

      // Analyze content type
      const hasHeaders = page.content.includes('#');
      const hasLists = page.content.includes('-') || page.content.includes('*');
      const hasLinks = page.content.includes('[') && page.content.includes(']');

      contentAnalysis.push({
        title: page.title,
        slug: page.slug,
        wordCount: wordCount,
        hasHeaders: hasHeaders,
        hasLists: hasLists,
        hasLinks: hasLinks,
        qualityScore:
          (hasHeaders ? 1 : 0) +
          (hasLists ? 1 : 0) +
          (hasLinks ? 1 : 0) +
          (wordCount > 500 ? 1 : 0),
      });
    }
  });

  console.log(`Total Wiki Pages: ${wikiPages.length}`);
  console.log(`Pages with Content: ${pagesWithContent}`);
  console.log(`Total Words: ${totalWords}`);
  console.log(`Average Words per Page: ${Math.round(totalWords / pagesWithContent)}`);

  console.log('\n=== CONTENT QUALITY ANALYSIS ===');
  contentAnalysis.sort((a, b) => a.qualityScore - b.qualityScore);

  contentAnalysis.forEach(analysis => {
    console.log(`\n${analysis.title} (${analysis.slug})`);
    console.log(`  Words: ${analysis.wordCount}`);
    console.log(`  Quality Score: ${analysis.qualityScore}/4`);
    console.log(
      `  Structure: ${analysis.hasHeaders ? '✓' : '✗'} Headers | ${analysis.hasLists ? '✓' : '✗'} Lists | ${analysis.hasLinks ? '✓' : '✗'} Links`
    );
  });

  // Check for missing documentation files
  console.log('\n=== DOCUMENTATION FILE ANALYSIS ===');

  const expectedFiles = [
    'noxii-organized-notes.md',
    'atlas-tether-final-comprehensive.md',
    'engineering-caste-improved.md',
    'labor-caste-improved.md',
    'prefects-improved.md',
  ];

  expectedFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      const content = fs.readFileSync(file, 'utf8');
      const wordCount = content.split(/\s+/).length;
      console.log(`✓ ${file}: ${wordCount} words, ${Math.round(stats.size / 1024)}KB`);
    } else {
      console.log(`✗ ${file}: MISSING`);
    }
  });
} finally {
  db.close();
}
