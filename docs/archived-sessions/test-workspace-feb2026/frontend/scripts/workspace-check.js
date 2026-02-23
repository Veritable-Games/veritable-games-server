#!/usr/bin/env node

/**
 * Workspace Check Tool
 *
 * Validates the development workspace structure:
 * - Checks for required databases and files
 * - Lists tables in each database
 * - Validates database connectivity
 *
 * Supports both SQLite (development) and PostgreSQL (production)
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

// Determine database type from environment
const DATABASE_MODE = process.env.DATABASE_MODE || 'sqlite';
const isPostgres =
  DATABASE_MODE === 'postgres' || process.env.POSTGRES_URL || process.env.DATABASE_URL;

async function checkWorkspaceSQLite() {
  console.log('🗂️  Workspace Check (SQLite Development Mode)\n');

  const dataDir = path.join(__dirname, '..', 'data');

  // Check if data directory exists
  if (!fs.existsSync(dataDir)) {
    console.error(`❌ Data directory not found: ${dataDir}`);
    console.log('   Run: npm run db:init');
    process.exit(1);
  }

  console.log(`📁 Data directory: ${dataDir}`);

  // Expected databases
  const expectedDatabases = [
    'forums.db',
    'wiki.db',
    'users.db',
    'system.db',
    'content.db',
    'library.db',
    'auth.db',
    'messaging.db',
  ];

  let foundCount = 0;
  console.log('\n📋 Database Files:');

  expectedDatabases.forEach(dbFile => {
    const fullPath = path.join(dataDir, dbFile);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`   ✅ ${dbFile} (${sizeMB} MB)`);
      foundCount++;
    } else {
      console.log(`   ❌ ${dbFile} (missing)`);
    }
  });

  console.log(`\n📊 Summary: ${foundCount}/${expectedDatabases.length} databases found`);

  if (foundCount === 0) {
    console.log('\n⚠️  No databases found. Initialize with:');
    console.log('   npm run db:init');
    process.exit(1);
  }

  // Try to connect and list tables in content.db as sample
  try {
    const Database = require('better-sqlite3');
    const contentDb = new Database(path.join(dataDir, 'content.db'));

    console.log('\n🔗 Content Database Tables:');
    const tables = contentDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all();

    if (tables.length === 0) {
      console.log('   (empty database)');
    } else {
      tables.forEach(t => {
        console.log(`   - ${t.name}`);
      });
    }

    contentDb.close();
  } catch (error) {
    console.error(`\n❌ Failed to check database tables: ${error.message}`);
  }

  console.log('\n✅ Workspace check complete');
}

async function checkWorkspacePostgres() {
  console.log('🗂️  Workspace Check (PostgreSQL Production Mode)\n');

  const { Pool } = require('pg');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log(
      'Database:',
      (process.env.DATABASE_URL || process.env.POSTGRES_URL)?.split('@')[1] || 'localhost'
    );

    // Test connection
    console.log('\n🔌 Testing connection...');
    const result = await pool.query('SELECT NOW() as current_time');
    console.log(`✅ Connected: ${result.rows[0].current_time}`);

    // List schemas
    console.log('\n📋 Schemas:');
    const schemaResult = await pool.query(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
       ORDER BY schema_name`
    );

    const expectedSchemas = [
      'forums',
      'wiki',
      'users',
      'system',
      'content',
      'library',
      'auth',
      'messaging',
    ];
    const foundSchemas = new Set(schemaResult.rows.map(r => r.schema_name));

    expectedSchemas.forEach(schema => {
      if (foundSchemas.has(schema)) {
        console.log(`   ✅ ${schema}`);
      } else {
        console.log(`   ❌ ${schema} (missing)`);
      }
    });

    schemaResult.rows.forEach(row => {
      if (!expectedSchemas.includes(row.schema_name)) {
        console.log(`   ℹ️  ${row.schema_name} (extra)`);
      }
    });

    // Sample table count
    console.log('\n📊 Sample Tables (content schema):');
    const tableResult = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'content' ORDER BY tablename`
    );

    if (tableResult.rows.length === 0) {
      console.log('   (no tables found)');
    } else {
      tableResult.rows.forEach(t => {
        console.log(`   - ${t.tablename}`);
      });
    }

    console.log(`\n✅ Workspace check complete (${foundSchemas.size} schemas found)`);
  } catch (error) {
    console.error(`\n❌ Workspace check failed: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.error('   PostgreSQL server is not reachable');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Determine and run appropriate check
if (isPostgres) {
  checkWorkspacePostgres()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
} else {
  checkWorkspaceSQLite();
}
