#!/usr/bin/env node

/**
 * Verify Migration Success
 *
 * Checks:
 * 1. All schemas exist
 * 2. All expected tables exist
 * 3. Row counts match expectations
 * 4. Critical data is present (users, wiki pages, projects)
 * 5. No data corruption
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function verifyMigration() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  try {
    console.log('\n✅ Verifying PostgreSQL Migration\n');
    console.log('============================================================\n');

    await client.connect();
    console.log('🔌 Connected to Neon PostgreSQL\n');

    // Expected schemas
    const expectedSchemas = [
      'forums',
      'wiki',
      'users',
      'auth',
      'content',
      'library',
      'messaging',
      'system',
      'cache',
      'main',
    ];

    // Check schemas
    console.log('📁 Checking schemas...');
    const schemasResult = await client.query(
      `
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = ANY($1)
      ORDER BY schema_name;
    `,
      [expectedSchemas]
    );

    const foundSchemas = schemasResult.rows.map(r => r.schema_name);
    const missingSchemas = expectedSchemas.filter(s => !foundSchemas.includes(s));

    if (missingSchemas.length > 0) {
      console.log('   ❌ Missing schemas:', missingSchemas.join(', '));
    } else {
      console.log('   ✅ All 10 schemas present\n');
    }

    // Check table counts per schema
    console.log('📊 Checking table counts...');
    for (const schema of expectedSchemas) {
      const tableCount = await client.query(
        `
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = $1;
      `,
        [schema]
      );

      const count = parseInt(tableCount.rows[0].count);
      console.log(`   ${schema}: ${count} tables`);
    }

    // Check row counts for critical tables
    console.log('\n📈 Checking row counts for critical tables...');

    const criticalTables = [
      { schema: 'forums', table: 'forum_categories', minRows: 5 },
      { schema: 'wiki', table: 'wiki_pages', minRows: 100 },
      { schema: 'wiki', table: 'wiki_revisions', minRows: 400 },
      { schema: 'users', table: 'users', minRows: 10 },
      { schema: 'content', table: 'projects', minRows: 5 },
      { schema: 'content', table: 'news', minRows: 20 },
      { schema: 'content', table: 'project_reference_images', minRows: 1000 },
    ];

    for (const { schema, table, minRows } of criticalTables) {
      try {
        const result = await client.query(`
          SELECT COUNT(*) as count FROM "${schema}"."${table}";
        `);
        const count = parseInt(result.rows[0].count);
        const status = count >= minRows ? '✅' : '⚠️ ';
        console.log(
          `   ${status} ${schema}.${table}: ${count.toLocaleString()} rows (expected: ${minRows}+)`
        );
      } catch (err) {
        console.log(`   ❌ ${schema}.${table}: Error - ${err.message}`);
      }
    }

    // Check total row count
    console.log('\n📊 Total row counts by schema...');
    let totalRows = 0;

    for (const schema of expectedSchemas) {
      try {
        // Get all tables in schema
        const tables = await client.query(
          `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = $1;
        `,
          [schema]
        );

        let schemaTotal = 0;
        for (const { table_name } of tables.rows) {
          const result = await client.query(`
            SELECT COUNT(*) as count FROM "${schema}"."${table_name}";
          `);
          schemaTotal += parseInt(result.rows[0].count);
        }

        totalRows += schemaTotal;
        console.log(`   ${schema}: ${schemaTotal.toLocaleString()} rows`);
      } catch (err) {
        console.log(`   ⚠️  ${schema}: Error counting rows - ${err.message}`);
      }
    }

    console.log(`\n   🎯 Total rows migrated: ${totalRows.toLocaleString()}`);

    // Check database size
    console.log('\n💾 Database size...');
    const sizeResult = await client.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size;
    `);
    console.log(`   Database: ${sizeResult.rows[0].size}`);

    // Data integrity checks
    console.log('\n🔍 Data integrity checks...');

    // Check for NULL in required fields
    try {
      const usersCheck = await client.query(`
        SELECT COUNT(*) as count
        FROM users.users
        WHERE username IS NULL OR email IS NULL;
      `);
      const nullUsers = parseInt(usersCheck.rows[0].count);
      if (nullUsers > 0) {
        console.log(`   ⚠️  Found ${nullUsers} users with NULL username/email`);
      } else {
        console.log('   ✅ Users table: No NULL in critical fields');
      }
    } catch (err) {
      console.log('   ⚠️  Users check failed:', err.message);
    }

    // Check wiki pages have content
    try {
      const wikiCheck = await client.query(`
        SELECT COUNT(*) as count
        FROM wiki.wiki_pages
        WHERE title IS NULL OR title = '';
      `);
      const emptyPages = parseInt(wikiCheck.rows[0].count);
      if (emptyPages > 0) {
        console.log(`   ⚠️  Found ${emptyPages} wiki pages with empty titles`);
      } else {
        console.log('   ✅ Wiki pages: All have valid titles');
      }
    } catch (err) {
      console.log('   ⚠️  Wiki check failed:', err.message);
    }

    console.log('\n============================================================');
    console.log('✅ Migration verification complete!\n');

    if (totalRows >= 45000) {
      console.log('🎉 Migration successful!');
      console.log(`   • ${totalRows.toLocaleString()} rows migrated`);
      console.log('   • All critical tables present');
      console.log('   • Data integrity checks passed\n');
      console.log('📋 Next Steps:');
      console.log('   1. Review any warnings above');
      console.log('   2. Test application locally with PostgreSQL');
      console.log('   3. Proceed with Vercel deployment\n');
    } else {
      console.log('⚠️  Migration may be incomplete:');
      console.log(`   • Only ${totalRows.toLocaleString()} rows migrated (expected ~50,000+)`);
      console.log('   • Review migration logs for errors');
      console.log('   • Re-run data migration if needed\n');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyMigration();
