#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'forums.db');

try {
  const db = new Database(dbPath);

  console.log('🔗 SUGGESTING INTERNAL LINKS FOR ORPHANED PAGES\n');

  // Get pages with no incoming links
  const orphanedPages = db
    .prepare(
      `
    SELECT p.id, p.slug, p.title, p.status
    FROM wiki_pages p
    WHERE p.status = 'published'
    AND p.slug NOT IN (
      SELECT DISTINCT target_slug FROM wiki_page_links WHERE target_slug IS NOT NULL
    )
    ORDER BY p.title
  `
    )
    .all();

  console.log(`Found ${orphanedPages.length} pages with no incoming links\n`);

  // Get all pages that could potentially link to orphaned pages
  const allPages = db
    .prepare(
      `
    SELECT p.id, p.slug, p.title, r.content
    FROM wiki_pages p
    JOIN wiki_revisions r ON p.id = r.page_id
    WHERE r.revision_timestamp = (SELECT MAX(r2.revision_timestamp) FROM wiki_revisions r2 WHERE r2.page_id = p.id)
    AND p.status = 'published'
  `
    )
    .all();

  // Function to find potential link opportunities
  const findLinkOpportunities = (orphanedPage, allPages) => {
    const opportunities = [];
    const orphanedTitle = orphanedPage.title.toLowerCase();
    const orphanedSlug = orphanedPage.slug.toLowerCase();

    // Extract key terms from orphaned page title
    const keyTerms = orphanedTitle
      .split(/[\\s\\-\\(\\)]+/)
      .filter(
        term =>
          term.length > 3 &&
          ![
            'the',
            'and',
            'for',
            'with',
            'this',
            'that',
            'from',
            'they',
            'have',
            'will',
            'been',
            'their',
          ].includes(term)
      );

    for (const page of allPages) {
      if (page.id === orphanedPage.id) continue; // Skip self

      const content = page.content.toLowerCase();
      let relevanceScore = 0;
      const foundTerms = [];

      // Check for exact title mentions
      if (content.includes(orphanedTitle)) {
        relevanceScore += 10;
        foundTerms.push('exact title match');
      }

      // Check for key terms from title
      keyTerms.forEach(term => {
        if (content.includes(term)) {
          relevanceScore += 2;
          foundTerms.push(term);
        }
      });

      // Check for slug-related terms
      const slugParts = orphanedSlug.split('-');
      slugParts.forEach(part => {
        if (part.length > 3 && content.includes(part)) {
          relevanceScore += 1;
          if (!foundTerms.includes(part)) foundTerms.push(part);
        }
      });

      // If we found relevant content, suggest this as a link opportunity
      if (relevanceScore >= 3) {
        opportunities.push({
          targetPage: page,
          relevanceScore,
          foundTerms: foundTerms.slice(0, 5), // Limit to top 5 terms
          suggestion: `Add link to [[${orphanedPage.slug}|${orphanedPage.title}]] in "${page.title}"`,
        });
      }
    }

    return opportunities.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 3); // Top 3 opportunities
  };

  // Process each orphaned page
  const linkSuggestions = [];
  let processedCount = 0;

  console.log('🔍 ANALYZING LINK OPPORTUNITIES:');
  console.log('=================================\n');

  for (const orphanedPage of orphanedPages.slice(0, 20)) {
    // Process first 20 to avoid overwhelming output
    const opportunities = findLinkOpportunities(orphanedPage, allPages);

    if (opportunities.length > 0) {
      console.log(`📄 ${orphanedPage.title} (${opportunities.length} opportunities):`);
      opportunities.forEach(opp => {
        console.log(`  → ${opp.targetPage.title} (score: ${opp.relevanceScore})`);
        console.log(`    Terms found: ${opp.foundTerms.join(', ')}`);
      });
      console.log('');

      linkSuggestions.push({
        orphanedPage,
        opportunities,
      });
    }
    processedCount++;
  }

  // Automated link insertion for high-confidence matches
  console.log('\n🤖 AUTOMATED LINK INSERTION (HIGH CONFIDENCE):');
  console.log('================================================\n');

  let autoLinksAdded = 0;

  for (const suggestion of linkSuggestions) {
    const highConfidenceOpps = suggestion.opportunities.filter(opp => opp.relevanceScore >= 8);

    for (const opp of highConfidenceOpps) {
      // Get current content of the target page
      const currentRevision = db
        .prepare(
          `
        SELECT content FROM wiki_revisions 
        WHERE page_id = ? 
        ORDER BY revision_timestamp DESC 
        LIMIT 1
      `
        )
        .get(opp.targetPage.id);

      if (currentRevision) {
        let updatedContent = currentRevision.content;
        let linksAdded = 0;

        // Try to add links for exact title matches (most conservative approach)
        if (opp.foundTerms.includes('exact title match')) {
          const titleRegex = new RegExp(
            `\\\\b${suggestion.orphanedPage.title.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\\\b`,
            'gi'
          );
          const linkReplacement = `[[${suggestion.orphanedPage.slug}|${suggestion.orphanedPage.title}]]`;

          // Only replace if it's not already a link
          const matches = updatedContent.match(titleRegex);
          if (matches) {
            // Check if any match is not already inside [[]] brackets
            let hasUnlinkedMention = false;
            let position = 0;

            while (position < updatedContent.length) {
              const match = updatedContent
                .toLowerCase()
                .indexOf(suggestion.orphanedPage.title.toLowerCase(), position);
              if (match === -1) break;

              // Check if this match is not inside existing [[]] brackets
              const beforeMatch = updatedContent.substring(0, match);
              const afterMatch = updatedContent.substring(match);
              const lastOpenBracket = beforeMatch.lastIndexOf('[[');
              const lastCloseBracket = beforeMatch.lastIndexOf(']]');

              if (lastOpenBracket === -1 || lastCloseBracket > lastOpenBracket) {
                // This mention is not inside link brackets - we can link it
                const nextCloseBracket = afterMatch.indexOf(']]');
                if (
                  nextCloseBracket === -1 ||
                  nextCloseBracket > suggestion.orphanedPage.title.length
                ) {
                  hasUnlinkedMention = true;
                  break;
                }
              }

              position = match + suggestion.orphanedPage.title.length;
            }

            if (hasUnlinkedMention) {
              // Replace first unlinked mention only
              updatedContent = updatedContent.replace(titleRegex, linkReplacement);
              linksAdded = 1;
            }
          }
        }

        if (linksAdded > 0) {
          // Insert new revision
          db.prepare(
            `
            INSERT INTO wiki_revisions (
              page_id, content, summary, content_format, author_id, is_minor, size_bytes, revision_timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `
          ).run(
            opp.targetPage.id,
            updatedContent,
            `Auto-linked to ${suggestion.orphanedPage.title}`,
            'markdown',
            1,
            1, // Minor edit
            Buffer.byteLength(updatedContent, 'utf8')
          );

          // Add to wiki_page_links table
          db.prepare(
            `
            INSERT OR IGNORE INTO wiki_page_links (source_page_id, target_slug, link_text) 
            VALUES (?, ?, ?)
          `
          ).run(opp.targetPage.id, suggestion.orphanedPage.slug, suggestion.orphanedPage.title);

          console.log(
            `✅ Added link: "${opp.targetPage.title}" → "${suggestion.orphanedPage.title}"`
          );
          autoLinksAdded++;
        }
      }
    }
  }

  // Final statistics
  const finalOrphanedCount = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM wiki_pages p
    WHERE p.status = 'published'
    AND p.slug NOT IN (
      SELECT DISTINCT target_slug FROM wiki_page_links WHERE target_slug IS NOT NULL
    )
  `
    )
    .get();

  console.log('\n📊 LINK SUGGESTION RESULTS:');
  console.log('===========================');
  console.log(`🔍 Analyzed: ${processedCount} orphaned pages`);
  console.log(`💡 Link opportunities found: ${linkSuggestions.length} pages with suggestions`);
  console.log(`🤖 Automatic links added: ${autoLinksAdded}`);
  console.log(
    `📈 Orphaned pages reduced from ${orphanedPages.length} to ${finalOrphanedCount.count}`
  );

  // Create a summary report for manual review
  const reportData = linkSuggestions
    .filter(s => s.opportunities.some(o => o.relevanceScore < 8))
    .map(suggestion => ({
      orphanedPage: suggestion.orphanedPage.title,
      slug: suggestion.orphanedPage.slug,
      manualReviewNeeded: suggestion.opportunities
        .filter(o => o.relevanceScore < 8)
        .map(opp => ({
          targetPage: opp.targetPage.title,
          score: opp.relevanceScore,
          terms: opp.foundTerms.join(', '),
        })),
    }));

  if (reportData.length > 0) {
    console.log('\n📝 MANUAL REVIEW NEEDED:');
    console.log('========================');
    console.log('The following pages have potential link opportunities that need human review:');
    reportData.slice(0, 10).forEach(item => {
      console.log(`\n${item.orphanedPage}:`);
      item.manualReviewNeeded.forEach(opp => {
        console.log(`  - Consider linking from "${opp.targetPage}" (score: ${opp.score})`);
      });
    });
  }

  db.close();

  console.log('\n🎉 INTERNAL LINK ANALYSIS COMPLETE!');
} catch (error) {
  console.error('❌ Error during link analysis:', error);
  process.exit(1);
}
