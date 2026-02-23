#!/usr/bin/env node
/**
 * Find potential slug conflicts between wiki pages and journals
 */

const { Pool } = require('pg');

const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!POSTGRES_URL) {
  console.error('❌ Error: POSTGRES_URL or DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: POSTGRES_URL,
  ssl: false,
});

async function main() {
  try {
    console.log('🔍 Checking for slug conflicts between wiki and journals...\n');

    // Check if any main wiki pages have "journal-" prefixed slugs
    const query = `
      SELECT
        id,
        slug,
        title,
        namespace,
        status,
        created_at
      FROM wiki.wiki_pages
      WHERE slug LIKE 'journal-%'
        AND namespace != 'journals'
      ORDER BY created_at DESC;
    `;

    const result = await pool.query(query);

    if (result.rows.length === 0) {
      console.log('✅ No wiki pages found with "journal-" prefix in main namespace');
      console.log(
        '   This means the slug collision is happening because of the global constraint\n'
      );
    } else {
      console.log(`⚠️  Found ${result.rows.length} wiki pages with "journal-" prefix:\n`);
      result.rows.forEach((row, index) => {
        console.log(`   [${index + 1}] ID: ${row.id} | Slug: ${row.slug}`);
        console.log(`       Title: ${row.title}`);
        console.log(`       Namespace: ${row.namespace} | Status: ${row.status}`);
        console.log(`       Created: ${row.created_at}`);
        console.log();
      });
    }

    // Show the exact issue
    console.log('📋 Root Cause:');
    console.log('─'.repeat(80));
    console.log('   The wiki_pages table has a UNIQUE constraint on just the "slug" column.');
    console.log('   This means slugs must be unique across ALL namespaces (main, journals, etc.)');
    console.log('');
    console.log('   When creating a new journal with slug "journal-1234567890123":');
    console.log('   1. System generates random slug: journal-{timestamp}-{random}');
    console.log('   2. Checks if slug already exists in ANY namespace');
    console.log('   3. If it exists in main wiki, throws UNIQUE constraint error');
    console.log('   4. Even though journals namespace should be separate\n');

    console.log('💡 Solution:');
    console.log('─'.repeat(80));
    console.log('   Change the UNIQUE constraint from UNIQUE(slug) to UNIQUE(slug, namespace)');
    console.log('   This allows same slug in different namespaces (main vs journals)\n');
    console.log('   Run: ssh user@192.168.1.15');
    console.log(
      '   Then: docker exec -i m4s0kwo4kc4oooocck4sswc4 psql "$POSTGRES_URL" < /path/to/fix-script.sql'
    );
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
