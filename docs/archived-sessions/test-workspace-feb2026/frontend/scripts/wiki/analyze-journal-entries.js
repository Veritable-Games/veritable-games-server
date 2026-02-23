#!/usr/bin/env node
/**
 * analyze-journal-entries.js
 *
 * Analyzes journal entries to find:
 * 1. Duplicates between Uncategorized and Journals
 * 2. Unique journal entries only in Uncategorized
 *
 * Usage:
 *   POSTGRES_URL=... node scripts/wiki/analyze-journal-entries.js
 */

const { Pool } = require('pg');

async function main() {
  console.log('🔍 Journal Entries Analysis');
  console.log('===========================\n');

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Error: POSTGRES_URL or DATABASE_URL environment variable not set');
    console.error(
      'Usage: POSTGRES_URL=postgresql://... node scripts/wiki/analyze-journal-entries.js'
    );
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    // 1. Get all pages in 'uncategorized' category
    console.log('📊 Step 1: Finding pages in Uncategorized category...\n');

    const uncategorizedQuery = `
      SELECT
        id,
        slug,
        title,
        namespace,
        category_id,
        created_by,
        created_at,
        LENGTH(title) as title_length
      FROM wiki.wiki_pages
      WHERE category_id = 'uncategorized'
      ORDER BY created_at DESC
    `;

    const uncategorizedResult = await pool.query(uncategorizedQuery);
    const uncategorizedPages = uncategorizedResult.rows;

    console.log(`Found ${uncategorizedPages.length} pages in Uncategorized\n`);

    // 2. Get all pages in 'journals' namespace
    console.log('📊 Step 2: Finding pages in Journals namespace...\n');

    const journalsQuery = `
      SELECT
        id,
        slug,
        title,
        namespace,
        category_id,
        created_by,
        created_at
      FROM wiki.wiki_pages
      WHERE namespace = 'journals'
      ORDER BY created_at DESC
    `;

    const journalsResult = await pool.query(journalsQuery);
    const journalsPages = journalsResult.rows;

    console.log(`Found ${journalsPages.length} pages in Journals namespace\n`);

    // 3. Identify which uncategorized pages are likely journal entries
    console.log('📊 Step 3: Identifying journal-like entries in Uncategorized...\n');

    // Journal entries typically:
    // - Have date-based slugs (e.g., "2025-11-21", "november-21-2025")
    // - Have short titles (often just dates)
    // - Were created by specific users who use journals

    const journalLikeUncategorized = uncategorizedPages.filter(page => {
      const slug = page.slug.toLowerCase();
      const title = page.title.toLowerCase();

      // Check for date patterns in slug or title
      const datePatterns = [
        /^\d{4}-\d{2}-\d{2}$/, // 2025-11-21
        /^\d{4}-\d{1,2}-\d{1,2}$/, // 2025-11-21 or 2025-1-1
        /^journal-\d{4}/, // journal-2025-...
        /^(january|february|march|april|may|june|july|august|september|october|november|december)/i,
        /^\d{1,2}-\d{1,2}-\d{4}$/, // 11-21-2025
        /session/i, // Contains "session"
        /day-\d+/i, // day-1, day-2, etc.
      ];

      return datePatterns.some(pattern => pattern.test(slug) || pattern.test(title));
    });

    console.log(
      `Found ${journalLikeUncategorized.length} journal-like entries in Uncategorized:\n`
    );

    if (journalLikeUncategorized.length > 0) {
      console.log('Journal-like entries:');
      journalLikeUncategorized.forEach((page, idx) => {
        console.log(`  ${idx + 1}. ID ${page.id}: "${page.title}" (slug: ${page.slug})`);
        console.log(
          `     Created: ${page.created_at}, User: ${page.created_by}, Namespace: ${page.namespace}`
        );
      });
      console.log();
    }

    // 4. Find duplicates (same slug exists in both uncategorized and journals)
    console.log('📊 Step 4: Finding duplicate entries...\n');

    const journalSlugs = new Set(journalsPages.map(p => p.slug));
    const duplicates = journalLikeUncategorized.filter(page => journalSlugs.has(page.slug));

    console.log(
      `Found ${duplicates.length} potential duplicates (same slug in both categories):\n`
    );

    if (duplicates.length > 0) {
      console.log('Duplicate entries (exist in both Uncategorized and Journals):');
      duplicates.forEach((page, idx) => {
        const journalVersion = journalsPages.find(p => p.slug === page.slug);
        console.log(`  ${idx + 1}. Slug: "${page.slug}"`);
        console.log(
          `     Uncategorized: ID ${page.id} - "${page.title}" (created: ${page.created_at})`
        );
        console.log(
          `     Journals: ID ${journalVersion.id} - "${journalVersion.title}" (created: ${journalVersion.created_at})`
        );
      });
      console.log();
    }

    // 5. Find unique journal entries only in Uncategorized
    console.log('📊 Step 5: Finding unique journal entries only in Uncategorized...\n');

    const uniqueJournals = journalLikeUncategorized.filter(page => !journalSlugs.has(page.slug));

    console.log(`Found ${uniqueJournals.length} unique journal entries only in Uncategorized:\n`);

    if (uniqueJournals.length > 0) {
      console.log('Unique journal entries (should be moved to Journals):');
      uniqueJournals.forEach((page, idx) => {
        console.log(`  ${idx + 1}. ID ${page.id}: "${page.title}"`);
        console.log(`     Slug: ${page.slug}`);
        console.log(`     Created: ${page.created_at}, User: ${page.created_by}`);
        console.log(`     Namespace: ${page.namespace} → Should be: journals`);
      });
      console.log();
    }

    // 6. Get user information for journal authors
    console.log('📊 Step 6: Identifying journal authors...\n');

    const journalAuthors = new Set(
      [
        ...journalLikeUncategorized.map(p => p.created_by),
        ...journalsPages.map(p => p.created_by),
      ].filter(id => id !== null)
    );

    if (journalAuthors.size > 0) {
      const authorsQuery = `
        SELECT id, username
        FROM users.users
        WHERE id = ANY($1::int[])
      `;

      const authorsResult = await pool.query(authorsQuery, [Array.from(journalAuthors)]);
      const authors = authorsResult.rows;

      console.log(`Journal entries created by ${authors.length} users:`);
      authors.forEach(author => {
        const journalCount = journalsPages.filter(p => p.created_by === author.id).length;
        const uncatCount = journalLikeUncategorized.filter(p => p.created_by === author.id).length;
        console.log(
          `  • ${author.username} (ID ${author.id}): ${journalCount} in Journals, ${uncatCount} in Uncategorized`
        );
      });
      console.log();
    }

    // 7. Summary and recommendations
    console.log('='.repeat(60));
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Uncategorized pages: ${uncategorizedPages.length}`);
    console.log(`Journal-like in Uncategorized: ${journalLikeUncategorized.length}`);
    console.log(`Duplicates (in both locations): ${duplicates.length}`);
    console.log(`Unique journals (only in Uncategorized): ${uniqueJournals.length}`);
    console.log();

    console.log('💡 RECOMMENDATIONS:');
    if (duplicates.length > 0) {
      console.log(`1. Review ${duplicates.length} duplicate entries - delete from Uncategorized`);
    }
    if (uniqueJournals.length > 0) {
      console.log(`2. Move ${uniqueJournals.length} unique journal entries to Journals namespace`);
      console.log(`   (set category_id='journals' AND namespace='journals')`);
    }
    console.log();

    // 8. Output SQL commands to fix the issues
    if (uniqueJournals.length > 0 || duplicates.length > 0) {
      console.log('📝 SQL COMMANDS TO FIX:');
      console.log('='.repeat(60));

      if (uniqueJournals.length > 0) {
        console.log('\n-- Move unique journal entries to Journals:');
        const uniqueIds = uniqueJournals.map(p => p.id).join(', ');
        console.log(`UPDATE wiki.wiki_pages`);
        console.log(`SET category_id = 'journals', namespace = 'journals'`);
        console.log(`WHERE id IN (${uniqueIds});`);
      }

      if (duplicates.length > 0) {
        console.log('\n-- Delete duplicate entries from Uncategorized:');
        const duplicateIds = duplicates.map(p => p.id).join(', ');
        console.log(`DELETE FROM wiki.wiki_pages`);
        console.log(`WHERE id IN (${duplicateIds});`);
      }
      console.log();
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
