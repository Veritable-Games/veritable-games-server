#!/usr/bin/env node

/**
 * Database Initialization Script
 *
 * Initializes all SQLite databases from schema and seed files.
 * Run this after a fresh clone or when databases are missing.
 *
 * Usage:
 *   npm run db:init
 *   npm run db:init -- --force  (recreate all databases)
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '../data');
const SCHEMA_DIR = path.join(__dirname, 'seeds/schemas');
const SEED_DIR = path.join(__dirname, 'seeds/data');

// Parse command line arguments
const args = process.argv.slice(2);
const force = args.includes('--force');

// Database configuration
const DATABASES = [
  { name: 'auth', hasSeeds: false },
  { name: 'forums', hasSeeds: true, seeds: ['forum-structure.sql'] },
  { name: 'wiki', hasSeeds: true, seeds: ['wiki-categories.sql'] },
  { name: 'users', hasSeeds: true, seeds: ['admin-user.sql'] },
  { name: 'content', hasSeeds: false },
  { name: 'library', hasSeeds: false },
  { name: 'messaging', hasSeeds: false },
  { name: 'system', hasSeeds: true, seeds: ['system-settings.sql'] },
  { name: 'cache', hasSeeds: false },
  { name: 'main', hasSeeds: false },
];

console.log('🗄️  Database Initialization');
console.log('==========================\n');

if (force) {
  console.log('⚠️  FORCE MODE: All databases will be recreated\n');
}

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  console.log('📁 Created data directory\n');
}

let created = 0;
let skipped = 0;
let errors = 0;

for (const config of DATABASES) {
  const { name, hasSeeds, seeds = [] } = config;
  const dbPath = path.join(DB_DIR, `${name}.db`);
  const schemaPath = path.join(SCHEMA_DIR, `${name}.sql`);

  console.log(`Processing ${name}.db...`);

  // Check if database exists
  const exists = fs.existsSync(dbPath);

  if (exists && !force) {
    console.log(`  ✓ Already exists (use --force to recreate)\n`);
    skipped++;
    continue;
  }

  if (exists && force) {
    console.log(`  🗑️  Deleting existing database`);
    fs.unlinkSync(dbPath);
  }

  // Check for schema file
  if (!fs.existsSync(schemaPath)) {
    console.log(`  ❌ Schema file not found: ${schemaPath}\n`);
    errors++;
    continue;
  }

  try {
    // Create database
    console.log(`  📝 Creating database from schema...`);
    const db = new Database(dbPath);

    // Read and execute schema
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split schema into individual statements (handle multi-line statements)
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      db.exec(statement);
    }

    console.log(`  ✓ Schema applied (${statements.length} statements)`);

    // Seed with data if available
    if (hasSeeds && seeds.length > 0) {
      console.log(`  🌱 Seeding data...`);

      for (const seedFile of seeds) {
        const seedPath = path.join(SEED_DIR, seedFile);

        if (!fs.existsSync(seedPath)) {
          console.log(`    ⚠  Seed file not found: ${seedFile}`);
          continue;
        }

        const seedData = fs.readFileSync(seedPath, 'utf8');
        const seedStatements = seedData
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of seedStatements) {
          try {
            db.exec(statement);
          } catch (err) {
            // Ignore duplicate errors (idempotent seeding)
            if (!err.message.includes('UNIQUE constraint')) {
              throw err;
            }
          }
        }

        console.log(`    ✓ Applied ${seedFile}`);
      }
    }

    // Validate database
    const tables = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `
      )
      .all();

    console.log(`  ✅ Created successfully (${tables.length} tables)\n`);

    db.close();
    created++;
  } catch (error) {
    console.error(`  ❌ Error creating database:`, error.message);
    console.error(`     ${error.stack}\n`);
    errors++;

    // Clean up failed database
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  }
}

// Summary
console.log('===============================');
console.log(`✅ Initialization complete!`);
console.log(`   Created: ${created}`);
console.log(`   Skipped: ${skipped}`);
console.log(`   Errors: ${errors}`);

if (errors > 0) {
  console.log(`\n⚠️  ${errors} database(s) failed to initialize`);
  process.exit(1);
}

if (created > 0) {
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Start the development server: npm run dev`);
  console.log(`   2. Verify databases: npm run db:health`);
}
