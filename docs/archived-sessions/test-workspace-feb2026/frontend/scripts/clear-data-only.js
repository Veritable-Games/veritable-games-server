#!/usr/bin/env node

/**
 * Clear Data Only (Keep Schema)
 *
 * Truncates all tables but keeps the schema intact.
 * Use this to retry data migration after fixing schema issues.
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function clearData() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  try {
    console.log('\n🧹 Clearing Data (Keeping Schema)\n');
    console.log('============================================================\n');

    await client.connect();
    console.log('✅ Connected to Neon PostgreSQL\n');

    const schemas = [
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

    for (const schema of schemas) {
      console.log(`📊 Clearing ${schema}...`);

      // Get all tables in schema
      const tables = await client.query(
        `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `,
        [schema]
      );

      for (const { table_name } of tables.rows) {
        try {
          await client.query(`TRUNCATE TABLE "${schema}"."${table_name}" CASCADE;`);
          console.log(`   ✅ ${table_name}`);
        } catch (err) {
          console.log(`   ⚠️  ${table_name}: ${err.message}`);
        }
      }
    }

    console.log('\n============================================================');
    console.log('✅ Data cleared! Schema intact. Ready for fresh migration.\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

clearData();
