#!/usr/bin/env node
/**
 * Check production database for journal slug conflicts
 *
 * This script connects to production PostgreSQL to:
 * 1. Check if the slug constraint is namespace-scoped or global
 * 2. List all existing journal entries with their slugs
 * 3. Check for any soft-deleted journals that might cause conflicts
 * 4. Verify if there are any duplicate slugs across namespaces
 */

const { Pool } = require('pg');

// Get PostgreSQL connection from environment
const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!POSTGRES_URL) {
  console.error('❌ Error: POSTGRES_URL or DATABASE_URL environment variable not set');
  console.error('   Set it to connect to production database');
  console.error(
    '   Example: POSTGRES_URL="postgresql://user:pass@192.168.1.15:5432/dbname" node check-journal-slug-conflict.js'
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: POSTGRES_URL,
  ssl: false, // Local network, no SSL needed
});

async function main() {
  try {
    console.log('🔍 Checking journal slug conflict in production database...\n');

    // 1. Check the UNIQUE constraint type
    console.log('1️⃣ Checking wiki_pages UNIQUE constraint:');
    console.log('─'.repeat(80));

    const constraintQuery = `
      SELECT
        conname as constraint_name,
        contype as constraint_type,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'wiki.wiki_pages'::regclass
        AND (conname LIKE '%slug%' OR contype = 'u')
      ORDER BY conname;
    `;

    const constraints = await pool.query(constraintQuery);

    if (constraints.rows.length === 0) {
      console.log('⚠️  No UNIQUE constraints found on wiki_pages');
    } else {
      constraints.rows.forEach(row => {
        console.log(`   ${row.constraint_name}:`);
        console.log(`   Type: ${row.constraint_type} (u = UNIQUE, p = PRIMARY KEY)`);
        console.log(`   Definition: ${row.definition}`);
        console.log();
      });
    }

    // 2. Check for existing journals
    console.log('2️⃣ Existing journal entries:');
    console.log('─'.repeat(80));

    const journalsQuery = `
      SELECT
        id,
        slug,
        title,
        namespace,
        status,
        created_by,
        created_at
      FROM wiki.wiki_pages
      WHERE namespace = 'journals'
      ORDER BY created_at DESC
      LIMIT 50;
    `;

    const journals = await pool.query(journalsQuery);

    if (journals.rows.length === 0) {
      console.log('   No journals found in database');
    } else {
      console.log(`   Found ${journals.rows.length} journals:\n`);
      journals.rows.forEach((row, index) => {
        console.log(`   [${index + 1}] ID: ${row.id} | Slug: ${row.slug}`);
        console.log(`       Title: ${row.title}`);
        console.log(`       Status: ${row.status}`);
        console.log(`       Created: ${row.created_at} | Author: ${row.created_by}`);
        console.log();
      });
    }

    // 3. Check for soft-deleted journals
    console.log('3️⃣ Soft-deleted journals:');
    console.log('─'.repeat(80));

    const deletedQuery = `
      SELECT
        id,
        slug,
        title,
        namespace
      FROM wiki.wiki_pages
      WHERE namespace = 'journals' AND status = 'deleted'
      ORDER BY updated_at DESC
      LIMIT 20;
    `;

    const deleted = await pool.query(deletedQuery);

    if (deleted.rows.length === 0) {
      console.log('   No soft-deleted journals found');
    } else {
      console.log(`   Found ${deleted.rows.length} soft-deleted journals:\n`);
      deleted.rows.forEach((row, index) => {
        console.log(`   [${index + 1}] ID: ${row.id} | Slug: ${row.slug}`);
        console.log(`       Title: ${row.title}`);
        console.log();
      });
    }

    // 4. Check for duplicate slugs across namespaces
    console.log('4️⃣ Duplicate slugs across namespaces:');
    console.log('─'.repeat(80));

    const duplicatesQuery = `
      SELECT
        slug,
        COUNT(*) as count,
        array_agg(DISTINCT namespace) as namespaces,
        array_agg(id) as page_ids
      FROM wiki.wiki_pages
      WHERE status != 'deleted'
      GROUP BY slug
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 20;
    `;

    const duplicates = await pool.query(duplicatesQuery);

    if (duplicates.rows.length === 0) {
      console.log('   ✅ No duplicate slugs found (constraint is working correctly)');
    } else {
      console.log(`   ⚠️  Found ${duplicates.rows.length} duplicate slugs:\n`);
      duplicates.rows.forEach((row, index) => {
        console.log(`   [${index + 1}] Slug: "${row.slug}"`);
        console.log(`       Count: ${row.count} pages`);
        console.log(`       Namespaces: ${row.namespaces.join(', ')}`);
        console.log(`       Page IDs: ${row.page_ids.join(', ')}`);
        console.log();
      });
    }

    // 5. Check for duplicate slugs within journals namespace
    console.log('5️⃣ Duplicate slugs within journals namespace:');
    console.log('─'.repeat(80));

    const journalDuplicatesQuery = `
      SELECT
        slug,
        COUNT(*) as count,
        array_agg(id) as page_ids,
        array_agg(status) as status_flags
      FROM wiki.wiki_pages
      WHERE namespace = 'journals'
      GROUP BY slug
      HAVING COUNT(*) > 1
      ORDER BY count DESC;
    `;

    const journalDuplicates = await pool.query(journalDuplicatesQuery);

    if (journalDuplicates.rows.length === 0) {
      console.log('   ✅ No duplicate slugs found within journals namespace');
    } else {
      console.log(`   ⚠️  Found ${journalDuplicates.rows.length} duplicate slugs in journals:\n`);
      journalDuplicates.rows.forEach((row, index) => {
        console.log(`   [${index + 1}] Slug: "${row.slug}"`);
        console.log(`       Count: ${row.count} journals`);
        console.log(`       Page IDs: ${row.page_ids.join(', ')}`);
        console.log(`       Status flags: ${row.status_flags.join(', ')}`);
        console.log();
      });
    }

    console.log('─'.repeat(80));
    console.log('✅ Analysis complete\n');

    // Provide recommendations
    console.log('📋 Recommendations:');
    console.log('─'.repeat(80));

    const hasGlobalConstraint = constraints.rows.some(
      row => row.constraint_name === 'wiki_pages_slug_key'
    );

    const hasNamespaceConstraint = constraints.rows.some(
      row => row.constraint_name === 'wiki_pages_slug_namespace_unique'
    );

    if (hasGlobalConstraint && !hasNamespaceConstraint) {
      console.log('⚠️  ISSUE FOUND: Database has global slug constraint (not namespace-scoped)');
      console.log(
        '   This means slugs must be unique across ALL namespaces (main wiki + journals)'
      );
      console.log('   This is likely causing the journal creation error');
      console.log();
      console.log('   FIX: Run the migration script:');
      console.log(
        '   $ psql $POSTGRES_URL -f frontend/scripts/migrations/fix-wiki-pages-slug-constraint.sql'
      );
    } else if (hasNamespaceConstraint) {
      console.log('✅ Constraint is namespace-scoped (correct configuration)');
      console.log('   Slugs can be duplicated across namespaces (main vs journals)');
    } else {
      console.log('⚠️  No slug constraint found - this is unexpected');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
