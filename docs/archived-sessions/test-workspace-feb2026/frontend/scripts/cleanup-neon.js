#!/usr/bin/env node

/**
 * Clean Up Neon Database
 *
 * Drops all custom schemas to prepare for fresh migration.
 * This ensures no partial/corrupt data from previous attempts.
 *
 * DANGER: This will DELETE ALL DATA in the Neon database!
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function cleanupDatabase() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  try {
    console.log('\n🧹 Cleaning up Neon Database...\n');
    console.log('⚠️  WARNING: This will DELETE ALL DATA!\n');

    await client.connect();
    console.log('✅ Connected to Neon PostgreSQL\n');

    // Get all custom schemas
    const schemasResult = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'public')
      ORDER BY schema_name;
    `);

    if (schemasResult.rows.length === 0) {
      console.log('✅ Database is already clean (no custom schemas found)\n');
      return;
    }

    console.log(`Found ${schemasResult.rows.length} schemas to drop:\n`);

    // Drop each schema
    for (const { schema_name } of schemasResult.rows) {
      console.log(`   🗑️  Dropping schema: ${schema_name}...`);
      try {
        await client.query(`DROP SCHEMA IF EXISTS "${schema_name}" CASCADE;`);
        console.log(`      ✅ Dropped ${schema_name}`);
      } catch (err) {
        console.log(`      ❌ Error dropping ${schema_name}: ${err.message}`);
      }
    }

    console.log('\n✅ Database cleanup complete! Ready for fresh migration.\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

cleanupDatabase();
