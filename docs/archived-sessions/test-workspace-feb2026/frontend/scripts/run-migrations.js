#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function runMigration(name) {
  const client = await pool.connect();
  try {
    console.log(`\n📦 Running migration: ${name}`);
    const migrationPath = path.join(__dirname, 'migrations', `${name}.sql`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await client.query(sql);
    console.log(`✓ Migration complete: ${name}`);
  } catch (error) {
    console.error(`✗ Migration failed: ${name}`);
    console.error(error.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log('🚀 Starting migrations...');
    await runMigration('add_email_verification');
    console.log('\n✓ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
