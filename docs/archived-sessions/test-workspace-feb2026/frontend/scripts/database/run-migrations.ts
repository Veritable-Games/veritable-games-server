#!/usr/bin/env tsx
/**
 * Database Migration Runner
 *
 * Automatically runs SQL migrations from scripts/migrations/ directory.
 * Tracks executed migrations in a migrations table to avoid re-running.
 *
 * Usage:
 *   npm run db:migrate
 *   npm run db:migrate:production  (requires POSTGRES_URL env var)
 *
 * Features:
 * - Runs migrations in alphanumeric order (001-*, 002-*, etc.)
 * - Tracks executed migrations to prevent duplicates
 * - Supports both development (via DATABASE_MODE) and production PostgreSQL
 * - Transaction-based execution for safety
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import pg from 'pg';

const { Pool } = pg;

// Configuration
const MIGRATIONS_DIR = join(process.cwd(), 'scripts', 'migrations');
const MIGRATIONS_TABLE = 'system.migrations';

// Database connection
function getPool(): pg.Pool {
  // Production: Use POSTGRES_URL environment variable
  if (process.env.NODE_ENV === 'production' || process.env.DATABASE_MODE === 'production') {
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!url) {
      console.error(
        '❌ POSTGRES_URL or DATABASE_URL environment variable is required in production mode'
      );
      process.exit(1);
    }

    console.log('🔗 Connecting to production PostgreSQL database...');
    return new Pool({
      connectionString: url,
      ssl: process.env.POSTGRES_SSL === 'false' ? false : { rejectUnauthorized: false },
    });
  }

  // Development: Use standard PostgreSQL connection
  console.log('🔗 Connecting to development PostgreSQL database...');
  return new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.POSTGRES_DB || 'veritable_games',
  });
}

/**
 * Ensure system schema and migrations table exist
 */
async function ensureMigrationsTable(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    // Create system schema if not exists
    await client.query('CREATE SCHEMA IF NOT EXISTS system');

    // Create migrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✅ Migrations table ensured');
  } finally {
    client.release();
  }
}

/**
 * Get list of already-executed migrations
 */
async function getExecutedMigrations(pool: pg.Pool): Promise<Set<string>> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT filename FROM ${MIGRATIONS_TABLE} ORDER BY executed_at`
    );
    return new Set(result.rows.map(row => row.filename));
  } finally {
    client.release();
  }
}

/**
 * Get pending migration files
 */
async function getPendingMigrations(executedMigrations: Set<string>): Promise<string[]> {
  const files = await readdir(MIGRATIONS_DIR);

  // Filter to only .sql files, exclude non-numbered files, sort alphanumerically
  const sqlFiles = files
    .filter(file => file.endsWith('.sql'))
    .filter(file => /^\d{3}-/.test(file)) // Only numbered migrations (001-, 002-, etc.)
    .filter(file => !executedMigrations.has(file))
    .sort(); // Alphanumeric sort ensures 001, 002, 003, etc.

  return sqlFiles;
}

/**
 * Execute a single migration file
 */
async function executeMigration(pool: pg.Pool, filename: string): Promise<void> {
  const filePath = join(MIGRATIONS_DIR, filename);
  const sql = await readFile(filePath, 'utf-8');

  const client = await pool.connect();
  try {
    // Start transaction
    await client.query('BEGIN');

    console.log(`\n📄 Executing migration: ${filename}`);

    // Execute migration SQL
    await client.query(sql);

    // Record migration
    await client.query(`INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ($1)`, [filename]);

    // Commit transaction
    await client.query('COMMIT');

    console.log(`✅ Successfully executed: ${filename}`);
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Main migration runner
 */
async function runMigrations(): Promise<void> {
  console.log('🚀 Starting database migrations...\n');

  const pool = getPool();

  try {
    // Ensure migrations table exists
    await ensureMigrationsTable(pool);

    // Get executed migrations
    const executedMigrations = await getExecutedMigrations(pool);
    console.log(`📋 Found ${executedMigrations.size} previously executed migrations`);

    // Get pending migrations
    const pendingMigrations = await getPendingMigrations(executedMigrations);

    if (pendingMigrations.length === 0) {
      console.log('✨ No pending migrations to run. Database is up to date!');
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migrations:\n`);
    pendingMigrations.forEach(file => console.log(`   - ${file}`));

    // Execute each pending migration
    for (const filename of pendingMigrations) {
      await executeMigration(pool, filename);
    }

    console.log(`\n✨ Successfully executed ${pendingMigrations.length} migrations!`);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migrations
runMigrations()
  .then(() => {
    console.log('\n✅ Migration process completed successfully\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Migration process failed\n');
    process.exit(1);
  });
