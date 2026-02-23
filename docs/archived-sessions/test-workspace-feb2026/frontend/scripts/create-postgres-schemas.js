#!/usr/bin/env node

/**
 * Create PostgreSQL Schemas
 *
 * Creates 10 PostgreSQL schemas to match the 10 SQLite databases:
 * - forums, wiki, users, auth, content, library, messaging, system, cache, main
 *
 * Each schema will contain the tables from its corresponding SQLite database.
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

// Database schema names (maps to SQLite database names)
const SCHEMAS = [
  'forums', // Forum discussions (categories, topics, replies)
  'wiki', // Wiki pages, revisions, categories
  'users', // User profiles, authentication
  'auth', // Sessions, tokens
  'content', // Projects, news, team members, workspaces
  'library', // Documents, annotations, tags
  'messaging', // Private messages, conversations
  'system', // System configuration, settings
  'cache', // Application-level caching (optional)
  'main', // Legacy archive (read-only)
];

// PostgreSQL extensions needed for full-text search and other features
const EXTENSIONS = [
  'pg_trgm', // Trigram matching for fuzzy search
  'unaccent', // Remove accents for better search
];

async function createSchemas() {
  console.log('\n🚀 Creating PostgreSQL Schemas for Veritable Games\n');
  console.log('='.repeat(60));

  // Validate environment
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('\n❌ Error: POSTGRES_URL not found in .env.local');
    console.error('   Please add your Neon connection string to frontend/.env.local');
    process.exit(1);
  }

  console.log('\n📊 Connection Details:');
  const url = new URL(connectionString);
  console.log(`   Host: ${url.hostname}`);
  console.log(`   Database: ${url.pathname.slice(1)}`);
  console.log(`   User: ${url.username}`);

  // Create connection pool
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log('\n🔌 Connecting to Neon PostgreSQL...');
    const client = await pool.connect();
    console.log('✅ Connected successfully!\n');

    // Enable extensions
    console.log('📦 Installing PostgreSQL Extensions...');
    for (const extension of EXTENSIONS) {
      try {
        await client.query(`CREATE EXTENSION IF NOT EXISTS ${extension}`);
        console.log(`   ✅ ${extension} enabled`);
      } catch (error) {
        console.log(`   ⚠️  ${extension} - ${error.message}`);
      }
    }

    console.log('\n📁 Creating Schemas...');

    // Track creation results
    const results = {
      created: [],
      existed: [],
      failed: [],
    };

    for (const schema of SCHEMAS) {
      try {
        // Check if schema already exists
        const checkResult = await client.query(
          `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
          [schema]
        );

        if (checkResult.rows.length > 0) {
          console.log(`   ⏭️  ${schema} - already exists`);
          results.existed.push(schema);
        } else {
          // Create schema
          await client.query(`CREATE SCHEMA ${schema}`);
          console.log(`   ✅ ${schema} - created`);
          results.created.push(schema);
        }

        // Grant permissions to current user
        const username = url.username;
        await client.query(`GRANT ALL PRIVILEGES ON SCHEMA ${schema} TO ${username}`);
        await client.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${schema} TO ${username}`);
        await client.query(
          `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${schema} TO ${username}`
        );

        // Set default privileges for future tables
        await client.query(`
          ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema}
          GRANT ALL PRIVILEGES ON TABLES TO ${username}
        `);
        await client.query(`
          ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema}
          GRANT ALL PRIVILEGES ON SEQUENCES TO ${username}
        `);
      } catch (error) {
        console.log(`   ❌ ${schema} - ${error.message}`);
        results.failed.push({ schema, error: error.message });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   ✅ Created: ${results.created.length}`);
    console.log(`   ⏭️  Already existed: ${results.existed.length}`);
    console.log(`   ❌ Failed: ${results.failed.length}`);

    if (results.created.length > 0) {
      console.log(`\n   New schemas: ${results.created.join(', ')}`);
    }

    if (results.failed.length > 0) {
      console.log('\n⚠️  Failed schemas:');
      results.failed.forEach(({ schema, error }) => {
        console.log(`   - ${schema}: ${error}`);
      });
    }

    // Get total schema count
    const schemasResult = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `);

    console.log(`\n📁 Total schemas in database: ${schemasResult.rows.length}`);
    console.log('   Schemas:', schemasResult.rows.map(r => r.schema_name).join(', '));

    // Get database size
    const sizeResult = await client.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    console.log(`\n💾 Database size: ${sizeResult.rows[0].size}`);

    client.release();

    if (results.failed.length > 0) {
      console.log('\n⚠️  Some schemas failed to create. Please review the errors above.');
      process.exit(1);
    }

    console.log('\n✅ Schema creation complete!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Run: npm run pg:migrate-schema');
    console.log('      (This will create all tables from your SQLite databases)');
    console.log('   2. Run: npm run pg:migrate-data');
    console.log('      (This will copy all data from SQLite to PostgreSQL)');
    console.log('\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
createSchemas().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
