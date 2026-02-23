#!/usr/bin/env node

/**
 * Cleanup PostgreSQL Schemas
 *
 * Drops all tables from the 10 schemas to prepare for a clean migration
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const SCHEMAS = [
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

async function cleanup() {
  console.log('\n🧹 Cleaning up PostgreSQL schemas...\n');

  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('❌ POSTGRES_URL not found');
    process.exit(1);
  }

  const pool = new Pool({ connectionString, max: 5 });

  try {
    console.log('🔌 Connected to PostgreSQL\n');

    for (const schema of SCHEMAS) {
      console.log(`📁 Cleaning ${schema} schema...`);

      // Drop all tables in schema
      await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);

      // Recreate empty schema
      await pool.query(`CREATE SCHEMA ${schema}`);

      // Grant permissions
      const url = new URL(connectionString);
      const username = url.username;
      await pool.query(`GRANT ALL PRIVILEGES ON SCHEMA ${schema} TO ${username}`);

      console.log(`   ✅ ${schema} cleaned\n`);
    }

    console.log('✅ All schemas cleaned!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanup();
