const Database = require('better-sqlite3');
const db = new Database('./data/forums.db');

try {
  // NOXII worldbuilding pages based on the context provided
  const noxiiWorldPages = [
    'allied-civil-preserve',
    'grand-voss-megastructures',
    'social-stratification-grand-voss',
    'icebreaker-caste',
    'labor-caste',
    'anarchists-external-network',
    'stonebreaker-caste',
    'authoritarian-character-noxii',
    'cauterizing-suits',
    'vatra-hub',
    'engineering-caste',
    'prefects-administrative-caste',
    'guards-authority-figures',
    'the-games',
    'chione-megastructures',
    'corrupted-territories',
    'planet-chione',
    'post-war-reconstruction',
  ];

  // Get content for these pages
  const pages = db
    .prepare(
      `
    SELECT p.slug, p.title, r.content 
    FROM wiki_pages p
    LEFT JOIN wiki_revisions r ON p.id = r.page_id
    WHERE p.slug IN (${noxiiWorldPages.map(() => '?').join(',')})
      AND r.revision_timestamp = (
        SELECT MAX(revision_timestamp) 
        FROM wiki_revisions r2 
        WHERE r2.page_id = p.id
      )
    ORDER BY p.slug
  `
    )
    .all(...noxiiWorldPages);

  console.log('=== NOXII Worldbuilding Pages Prose Analysis ===');
  console.log('Total pages found:', pages.length);
  console.log();

  // Analyze each page for prose issues
  const analyses = pages.map((page, i) => {
    const content = page.content || '';
    const wordCount = content.split(/\s+/).filter(w => w).length;
    const sentences = content.split(/[.!?]+/).filter(s => s.trim()).length;
    const avgWordsPerSentence = sentences > 0 ? Math.round(wordCount / sentences) : 0;
    const emDashCount = (content.match(/—/g) || []).length;
    const complexClauses = (content.match(/,\s*[a-z]/g) || []).length;
    const runOns = content.split(/[.!?]+/).filter(s => s.split(/,/).length >= 4).length;
    const dramaticWords = (
      content.match(
        /\b(dramatically|starkly|profoundly|deeply|utterly|completely|absolutely|entirely|wholly|perfectly|precisely|exactly)\b/gi
      ) || []
    ).length;
    const creatingPattern = (content.match(/\bcreating\s+[a-z]/gi) || []).length;

    // Calculate prose issue score (higher = more issues)
    const proseScore =
      (avgWordsPerSentence > 25 ? 2 : 0) +
      (emDashCount > 5 ? 2 : 0) +
      (complexClauses > wordCount * 0.05 ? 2 : 0) +
      (runOns > 3 ? 2 : 0) +
      (dramaticWords > 5 ? 1 : 0) +
      (creatingPattern > 3 ? 1 : 0);

    return {
      ...page,
      wordCount,
      sentences,
      avgWordsPerSentence,
      emDashCount,
      complexClauses,
      runOns,
      dramaticWords,
      creatingPattern,
      proseScore,
    };
  });

  // Sort by prose score (highest issues first)
  analyses.sort((a, b) => b.proseScore - a.proseScore);

  analyses.forEach((analysis, i) => {
    console.log(`${i + 1}. ${analysis.title} (${analysis.slug})`);
    console.log(
      `   Words: ${analysis.wordCount}, Sentences: ${analysis.sentences}, Avg: ${analysis.avgWordsPerSentence} w/s`
    );
    console.log(
      `   Em-dashes: ${analysis.emDashCount}, Complex clauses: ${analysis.complexClauses}`
    );
    console.log(
      `   Run-ons: ${analysis.runOns}, Dramatic words: ${analysis.dramaticWords}, "Creating": ${analysis.creatingPattern}`
    );
    console.log(`   PROSE ISSUE SCORE: ${analysis.proseScore}/10`);

    // Identify specific issues
    const issues = [];
    if (analysis.avgWordsPerSentence > 30) issues.push('Very long sentences');
    if (analysis.avgWordsPerSentence > 25) issues.push('Long sentences');
    if (analysis.emDashCount > 10) issues.push('Excessive em-dashes');
    if (analysis.emDashCount > 5) issues.push('Many em-dashes');
    if (analysis.complexClauses > analysis.wordCount * 0.08)
      issues.push('Excessive complex clauses');
    if (analysis.complexClauses > analysis.wordCount * 0.05) issues.push('Complex clauses');
    if (analysis.runOns > 5) issues.push('Many run-on sentences');
    if (analysis.runOns > 3) issues.push('Run-on sentences');
    if (analysis.dramaticWords > 8) issues.push('Very dramatic language');
    if (analysis.dramaticWords > 5) issues.push('Dramatic language');
    if (analysis.creatingPattern > 5) issues.push('Repetitive "creating"');
    if (analysis.creatingPattern > 3) issues.push('"Creating" pattern');

    if (issues.length > 0) {
      console.log(`   ISSUES: ${issues.join(', ')}`);
    }
    console.log();
  });

  console.log('=== REVISION PRIORITY RECOMMENDATIONS ===');
  console.log();
  console.log('HIGH PRIORITY (Score 6+):');
  analyses.filter(a => a.proseScore >= 6).forEach(a => console.log(`- ${a.title}`));
  console.log();
  console.log('MEDIUM PRIORITY (Score 4-5):');
  analyses
    .filter(a => a.proseScore >= 4 && a.proseScore < 6)
    .forEach(a => console.log(`- ${a.title}`));
  console.log();
  console.log('LOW PRIORITY (Score 2-3):');
  analyses
    .filter(a => a.proseScore >= 2 && a.proseScore < 4)
    .forEach(a => console.log(`- ${a.title}`));
} finally {
  db.close();
}
