#!/usr/bin/env node
/**
 * Library File-Based Storage Schema Migration Runner
 *
 * Executes the library schema migration to align with file-based storage refactor
 *
 * Usage:
 *   node scripts/library/run-schema-migration.js [--confirm]
 *
 * --confirm flag skips the confirmation prompt (useful for CI/CD)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const DB_CONNECTION_STRING = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const MIGRATION_FILE = path.join(
  __dirname,
  '../migrations/library-file-based-storage-migration.sql'
);
const SKIP_CONFIRM = process.argv.includes('--confirm');

/**
 * Read migration SQL from file
 */
function readMigrationSQL() {
  try {
    const sql = fs.readFileSync(MIGRATION_FILE, 'utf-8');
    return sql;
  } catch (error) {
    console.error(`❌ Failed to read migration file: ${MIGRATION_FILE}`);
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * Prompt user for confirmation
 */
async function promptConfirmation() {
  if (SKIP_CONFIRM) {
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question('⚠️  This will modify the library schema. Continue? (yes/no): ', answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Check current schema before migration
 */
async function checkCurrentSchema(pool) {
  console.log('\n📋 Checking current schema...');

  try {
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'library' AND table_name = 'library_documents'
      ORDER BY ordinal_position;
    `);

    const columns = {};
    result.rows.forEach(row => {
      columns[row.column_name] = row.data_type;
    });

    console.log(`   Total columns: ${result.rows.length}`);

    // Check for columns that will be added
    console.log(`   ✅ notes exists: ${columns.notes ? 'YES' : 'NO'}`);
    console.log(`   ✅ file_path exists: ${columns.file_path ? 'YES' : 'NO'}`);

    // Check for columns that will be dropped
    console.log(`   ⚠️  status exists: ${columns.status ? 'YES (will be dropped)' : 'NO'}`);
    console.log(
      `   ⚠️  description exists: ${columns.description ? 'YES (data migrated, then dropped)' : 'NO'}`
    );
    console.log(`   ⚠️  abstract exists: ${columns.abstract ? 'YES (will be dropped)' : 'NO'}`);
    console.log(
      `   ⚠️  search_text exists: ${columns.search_text ? 'YES (will be dropped)' : 'NO'}`
    );
    console.log(
      `   ℹ️  content exists: ${columns.content ? 'YES (kept for backward compat)' : 'NO'}`
    );

    return columns;
  } catch (error) {
    console.error('❌ Failed to check schema:', error.message);
    throw error;
  }
}

/**
 * Run migration
 */
async function runMigration(pool, sql) {
  console.log('\n⏳ Running migration...');

  try {
    const startTime = Date.now();
    await pool.query(sql);
    const duration = Date.now() - startTime;

    console.log(`✅ Migration completed successfully in ${duration}ms`);
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(`   Error code: ${error.code}`);
    if (error.detail) {
      console.error(`   Details: ${error.detail}`);
    }
    throw error;
  }
}

/**
 * Verify schema after migration
 */
async function verifySchema(pool) {
  console.log('\n✔️  Verifying schema after migration...');

  try {
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'library' AND table_name = 'library_documents'
      ORDER BY ordinal_position;
    `);

    const columns = new Set(result.rows.map(r => r.column_name));

    // Verify new columns exist
    const hasNotes = columns.has('notes');
    const hasFilePath = columns.has('file_path');

    // Verify old columns are gone
    const hasStatus = columns.has('status');
    const hasDescription = columns.has('description');
    const hasAbstract = columns.has('abstract');
    const hasSearchText = columns.has('search_text');

    console.log(`   ✅ notes column: ${hasNotes ? 'EXISTS' : 'MISSING'}`);
    console.log(`   ✅ file_path column: ${hasFilePath ? 'EXISTS' : 'MISSING'}`);
    console.log(`   ✅ status column removed: ${!hasStatus ? 'YES' : 'NO (still exists)'}`);
    console.log(
      `   ✅ description column removed: ${!hasDescription ? 'YES' : 'NO (still exists)'}`
    );
    console.log(`   ✅ abstract column removed: ${!hasAbstract ? 'YES' : 'NO (still exists)'}`);
    console.log(
      `   ✅ search_text column removed: ${!hasSearchText ? 'YES' : 'NO (still exists)'}`
    );

    const success =
      hasNotes && hasFilePath && !hasStatus && !hasDescription && !hasAbstract && !hasSearchText;

    if (success) {
      console.log('\n✅ Schema verification: PASSED');
    } else {
      console.log('\n⚠️  Schema verification: FAILED - Some changes did not apply');
    }

    return success;
  } catch (error) {
    console.error('❌ Schema verification failed:', error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Library File-Based Storage Schema Migration               ║');
  console.log('║  Aligns database with code refactor (Nov 2025)             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Check database connection
  if (!DB_CONNECTION_STRING) {
    console.error('❌ DATABASE_URL not set. Set it in .env.local or environment variables');
    process.exit(1);
  }

  console.log(`\n🔌 Connecting to database...`);
  const pool = new Pool({
    connectionString: DB_CONNECTION_STRING,
  });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connected to database');

    // Check current schema
    await checkCurrentSchema(pool);

    // Prompt for confirmation
    const confirmed = await promptConfirmation();
    if (!confirmed) {
      console.log('\n❌ Migration cancelled by user');
      process.exit(0);
    }

    // Read migration SQL
    const migrationSQL = readMigrationSQL();

    // Run migration
    await runMigration(pool, migrationSQL);

    // Verify schema
    const verifySuccess = await verifySchema(pool);

    if (verifySuccess) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('\n📝 Next steps:');
      console.log('   1. Run document file migration: node scripts/library/migrate-to-files.js');
      console.log('   2. Test creating a new library document');
      console.log('   3. Verify npm run db:health passes');
      console.log('   4. Commit changes and push to main');
      process.exit(0);
    } else {
      console.log('\n❌ Migration verification failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Migration failed with error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
main();
