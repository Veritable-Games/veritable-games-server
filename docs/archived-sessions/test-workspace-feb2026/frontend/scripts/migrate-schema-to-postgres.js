#!/usr/bin/env node

/**
 * Migrate SQLite Schema to PostgreSQL
 *
 * Reads all SQLite database schemas and creates equivalent PostgreSQL tables
 * in the appropriate schemas.
 *
 * Handles:
 * - SQLite → PostgreSQL syntax conversion
 * - FTS5 virtual tables → tsvector columns with GIN indexes
 * - AUTOINCREMENT → BIGSERIAL
 * - Date/time functions
 * - Foreign keys and indexes
 */

require('dotenv').config({ path: '.env.local' });
const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Database mappings
const DATABASES = {
  forums: 'forums.db',
  wiki: 'wiki.db',
  users: 'users.db',
  auth: 'auth.db',
  content: 'content.db',
  library: 'library.db',
  messaging: 'messaging.db',
  system: 'system.db',
  cache: 'cache.db',
  main: 'main.db',
};

const DATA_DIR = path.join(__dirname, '../data');

// Statistics tracking
const stats = {
  databases: 0,
  tables: 0,
  indexes: 0,
  triggers: 0,
  fts_tables: 0,
  errors: [],
};

/**
 * Convert SQLite SQL to PostgreSQL SQL
 */
function convertSQLiteToPostgres(sql, tableName, schemaName) {
  let pgSql = sql;

  // 0. Remove SQL comments first (they can interfere with regex patterns)
  // Remove single-line comments (-- comment)
  pgSql = pgSql.replace(/--[^\n]*/g, '');
  // Remove multi-line comments (/* comment */)
  pgSql = pgSql.replace(/\/\*[\s\S]*?\*\//g, '');

  // 1. Convert date/time FUNCTIONS first (before changing type names!)
  // This must happen before DATETIME → TIMESTAMP conversion
  pgSql = pgSql.replace(/DATETIME\(\s*['"]now['"]\s*\)/gi, 'NOW()');
  pgSql = pgSql.replace(/datetime\(\s*['"]now['"]\s*\)/gi, 'NOW()');
  pgSql = pgSql.replace(/CURRENT_TIMESTAMP/gi, 'NOW()');
  pgSql = pgSql.replace(/date\(\s*['"]now['"]\s*\)/gi, 'CURRENT_DATE');

  // 2. Now convert DATETIME data type to TIMESTAMP (after function calls are converted)
  pgSql = pgSql.replace(/\bDATETIME\b/gi, 'TIMESTAMP');

  // 3. Convert INTEGER PRIMARY KEY AUTOINCREMENT to BIGSERIAL
  pgSql = pgSql.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'BIGSERIAL PRIMARY KEY');
  pgSql = pgSql.replace(/INTEGER\s+PRIMARY\s+KEY/gi, 'BIGSERIAL PRIMARY KEY');

  // 3.5. Convert timestamp-related INTEGER columns to BIGINT
  // JavaScript timestamps (milliseconds since epoch) exceed PostgreSQL INTEGER max (2,147,483,647)
  // Match patterns: created_at, updated_at, expires_at, timestamp, etc.
  // This must happen BEFORE boolean conversion to avoid conflicts
  pgSql = pgSql.replace(
    /\b(created_at|updated_at|deleted_at|expires_at|subscribed_at|timestamp|session_start|session_end|collected_at|last_\w+_at|first_\w+_at|\w+_timestamp)\s+INTEGER\b/gi,
    '$1 BIGINT'
  );

  // 3.6. Convert memory/storage size columns to BIGINT
  // Memory sizes in bytes can exceed INTEGER max (e.g., 17GB = 17179869184)
  pgSql = pgSql.replace(
    /\b(memory_used|heap_used|heap_size|heap_total|rss|external_memory|array_buffers|total_heap_size|used_heap_size|heap_size_limit|memory_limit)\s+INTEGER\b/gi,
    '$1 BIGINT'
  );

  // 3.7. Convert duration columns to NUMERIC (video/audio durations in seconds with decimals)
  // Even though SQLite defines as INTEGER, actual data contains decimal values (e.g., 33.878 seconds)
  pgSql = pgSql.replace(/\b(duration)\s+INTEGER\b/gi, '$1 NUMERIC');

  // 3.8. Convert REAL/NUMERIC columns with decimal timestamps to NUMERIC
  // Some timestamps are stored as REAL with fractional seconds (e.g., 1758896477164.0928)
  pgSql = pgSql.replace(/\bREAL\b/gi, 'NUMERIC');

  // 4. Convert AUTOINCREMENT in column definitions
  pgSql = pgSql.replace(/AUTOINCREMENT/gi, '');

  // 5. Convert SQLite booleans to PostgreSQL booleans
  // SQLite stores booleans as INTEGER with 0/1 values
  // Convert both the type AND the default value for boolean-like columns
  // Match patterns like: is_deleted INTEGER DEFAULT 0 → is_deleted BOOLEAN DEFAULT FALSE
  // Use flexible matching to handle columns after commas, newlines, etc.
  pgSql = pgSql.replace(
    /((?:is_|has_|can_|should_|allow_|enable_|alert_)\w+)\s+INTEGER\s+DEFAULT\s+0\b/gi,
    '$1 BOOLEAN DEFAULT FALSE'
  );
  pgSql = pgSql.replace(
    /((?:is_|has_|can_|should_|allow_|enable_|alert_)\w+)\s+INTEGER\s+DEFAULT\s+1\b/gi,
    '$1 BOOLEAN DEFAULT TRUE'
  );
  // Also handle explicit BOOLEAN type declarations (just in case)
  pgSql = pgSql.replace(
    /((?:is_|has_|can_|should_|allow_|enable_|alert_)\w+)\s+BOOLEAN\s+DEFAULT\s+0\b/gi,
    '$1 BOOLEAN DEFAULT FALSE'
  );
  pgSql = pgSql.replace(
    /((?:is_|has_|can_|should_|allow_|enable_|alert_)\w+)\s+BOOLEAN\s+DEFAULT\s+1\b/gi,
    '$1 BOOLEAN DEFAULT TRUE'
  );

  // 6. Convert BLOB to BYTEA
  pgSql = pgSql.replace(/\bBLOB\b/gi, 'BYTEA');

  // 7. Convert GLOB operator to regex match
  pgSql = pgSql.replace(/\bGLOB\b/gi, '~*');

  // 8. Convert SQLite functions to PostgreSQL equivalents
  pgSql = pgSql.replace(/\brandomblob\(/gi, 'gen_random_bytes('); // Fixed typo: randomblob not randombytea
  pgSql = pgSql.replace(/\bunixepoch\(\)/gi, 'EXTRACT(EPOCH FROM NOW())');
  pgSql = pgSql.replace(
    /\bstrftime\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]now['"]\s*\)/gi,
    "TO_CHAR(NOW(), '$1')"
  );

  // 9. Convert remaining 'now' string literals to NOW() function
  // This catches: DEFAULT 'now', CHECK (...'now'...), etc.
  pgSql = pgSql.replace(/([(\s,=])['"]now['"]/gi, '$1NOW()');

  // 9.5. Convert double-quoted string literals to single quotes
  // PostgreSQL uses double quotes for identifiers, single quotes for strings
  // SQLite allows both, but PostgreSQL interprets "string" as a column reference
  // Convert: DEFAULT "string" → DEFAULT 'string'
  // Match: DEFAULT followed by optional whitespace, then "...", capture content
  pgSql = pgSql.replace(/DEFAULT\s+"([^"]+)"/gi, "DEFAULT '$1'");

  // 10. Remove ALL computed DEFAULT expressions
  // PostgreSQL doesn't support complex DEFAULT expressions
  // Strategy: Remove ANY DEFAULT that starts with '(' - these are computed
  // Simple defaults like DEFAULT 0 or DEFAULT 'public' will remain (no parens)
  // This aggressive approach handles:
  //   - Multiple levels of nesting: DEFAULT (lower(hex(randomblob(16))))
  //   - Operators after functions: DEFAULT (strftime(...) * 1000)
  //   - Column references: DEFAULT (id || '-' || slug)
  // We'll populate these during data migration instead
  let inDefault = false;
  let depth = 0;
  let newSql = '';
  let i = 0;

  while (i < pgSql.length) {
    // Check if we're starting a DEFAULT ( expression
    if (!inDefault && pgSql.substring(i).match(/^DEFAULT\s+\(/i)) {
      const match = pgSql.substring(i).match(/^DEFAULT\s+\(/i);
      inDefault = true;
      depth = 0;
      i += match[0].length - 1; // Skip 'DEFAULT (' but leave the '(' for counting
    }

    if (inDefault) {
      if (pgSql[i] === '(') depth++;
      if (pgSql[i] === ')') depth--;

      if (depth === 0) {
        inDefault = false;
        i++; // Skip the final ')'
        continue; // Don't add this character to output
      }
      i++; // Skip characters inside DEFAULT (...)
    } else {
      newSql += pgSql[i];
      i++;
    }
  }

  pgSql = newSql;

  // 11. Add schema prefix to table name in CREATE TABLE
  pgSql = pgSql.replace(/CREATE\s+TABLE\s+(["`]?)(\w+)\1/i, `CREATE TABLE ${schemaName}.$2`);

  // 12. Remove any SQLite-specific pragmas or options
  pgSql = pgSql.replace(/WITHOUT\s+ROWID/gi, '');

  // 13. Remove FOREIGN KEY constraints temporarily (will be added after all tables exist)
  // Match: FOREIGN KEY (col) REFERENCES table(col) or REFERENCES "table"(col)
  // Handle quoted and unquoted table names
  pgSql = pgSql.replace(
    /,?\s*FOREIGN\s+KEY\s*\([^)]+\)\s*REFERENCES\s+["`]?\w+["`]?\s*\([^)]+\)(?:\s+ON\s+(?:DELETE|UPDATE)\s+(?:CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION))*/gi,
    ''
  );

  // 14. Remove inline REFERENCES clauses from column definitions
  // Match: column_name TYPE REFERENCES table(col) or REFERENCES "table"(col)
  // But preserve the column definition itself
  pgSql = pgSql.replace(
    /(\w+\s+\w+(?:\([^)]*\))?)\s+REFERENCES\s+["`]?\w+["`]?\s*\([^)]+\)(?:\s+ON\s+(?:DELETE|UPDATE)\s+(?:CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION))*/gi,
    '$1'
  );

  // 15. Clean up trailing commas before closing parentheses (from FK removal)
  // This handles cases where FK constraints were at the end of table definitions
  pgSql = pgSql.replace(/,\s*\)/g, ')');

  // 16. Clean up multiple consecutive commas
  pgSql = pgSql.replace(/,\s*,/g, ',');

  return pgSql;
}

/**
 * Get table schema from SQLite database
 */
function getSQLiteSchema(dbPath) {
  const db = new Database(dbPath, { readonly: true });

  try {
    // Get all tables (exclude sqlite_* and FTS5 internal tables)
    const tables = db
      .prepare(
        `
      SELECT name, sql
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE '%_config'
        AND name NOT LIKE '%_content'
        AND name NOT LIKE '%_data'
        AND name NOT LIKE '%_docsize'
        AND name NOT LIKE '%_idx'
        AND sql IS NOT NULL
      ORDER BY name
    `
      )
      .all();

    // Get all indexes
    const indexes = db
      .prepare(
        `
      SELECT name, sql, tbl_name
      FROM sqlite_master
      WHERE type = 'index'
        AND name NOT LIKE 'sqlite_%'
        AND sql IS NOT NULL
      ORDER BY name
    `
      )
      .all();

    // Get all triggers
    const triggers = db
      .prepare(
        `
      SELECT name, sql, tbl_name
      FROM sqlite_master
      WHERE type = 'trigger'
        AND name NOT LIKE 'sqlite_%'
        AND sql IS NOT NULL
      ORDER BY name
    `
      )
      .all();

    return { tables, indexes, triggers };
  } finally {
    db.close();
  }
}

/**
 * Check if table is an FTS5 virtual table
 */
function isFTS5Table(sql) {
  return /CREATE\s+VIRTUAL\s+TABLE/i.test(sql) && /USING\s+fts5/i.test(sql);
}

/**
 * Convert FTS5 table to PostgreSQL tsvector table
 */
function convertFTS5ToPostgres(sql, tableName, schemaName) {
  // Extract columns from FTS5 definition
  // Handle complex FTS5 definitions with UNINDEXED, content='', etc.
  // Example: CREATE VIRTUAL TABLE wiki_search USING fts5(title, content UNINDEXED, tokenize='porter')

  // Match everything inside fts5(...)
  const columnsMatch = sql.match(/fts5\s*\(([\s\S]*?)\)\s*$/i);
  if (!columnsMatch) {
    throw new Error(`Could not parse FTS5 columns from: ${sql}`);
  }

  const columnsStr = columnsMatch[1];

  // Split by comma and parse each column
  const columns = [];
  const parts = columnsStr.split(',').map(p => p.trim());

  for (const part of parts) {
    // Skip if it's an option (contains =)
    if (part.includes('=')) continue;

    // Extract column name, removing UNINDEXED keyword
    const colName = part
      .replace(/\bUNINDEXED\b/gi, '')
      .replace(/['"]/g, '')
      .trim();

    // Only add non-empty column names
    if (colName && colName.length > 0) {
      columns.push(colName);
    }
  }

  if (columns.length === 0) {
    throw new Error(`No searchable columns found in FTS5 table: ${tableName}`);
  }

  // Create regular table with tsvector column
  const columnDefs = columns.map(col => `${col} TEXT`).join(',\n  ');

  // Build tsvector expression with proper syntax
  const tsvectorExpr = columns.map(col => `coalesce(${col}, '')`).join(" || ' ' || ");

  const pgSql = `
CREATE TABLE ${schemaName}.${tableName} (
  id BIGSERIAL PRIMARY KEY,
  ${columnDefs},
  search_vector tsvector
);

-- Create GIN index for full-text search
CREATE INDEX ${tableName}_search_idx ON ${schemaName}.${tableName} USING GIN (search_vector);
`.trim();

  return pgSql;
}

/**
 * Migrate a single database's schema
 */
async function migrateDatabase(dbName, dbFile, pgPool) {
  console.log(`\n📊 Processing ${dbName}.db...`);

  const dbPath = path.join(DATA_DIR, dbFile);
  if (!fs.existsSync(dbPath)) {
    console.log(`   ⏭️  Skipping (file not found)`);
    return;
  }

  const schema = getSQLiteSchema(dbPath);
  console.log(
    `   Found: ${schema.tables.length} tables, ${schema.indexes.length} indexes, ${schema.triggers.length} triggers`
  );

  stats.databases++;

  // Create tables
  for (const table of schema.tables) {
    try {
      if (isFTS5Table(table.sql)) {
        // Handle FTS5 virtual table
        console.log(`   📝 ${table.name} (FTS5 → tsvector)`);
        const pgSql = convertFTS5ToPostgres(table.sql, table.name, dbName);
        await pgPool.query(pgSql);
        stats.fts_tables++;
        stats.tables++;
      } else {
        // Handle regular table
        console.log(`   📝 ${table.name}`);
        const pgSql = convertSQLiteToPostgres(table.sql, table.name, dbName);
        await pgPool.query(pgSql);
        stats.tables++;
      }
    } catch (error) {
      console.log(`   ❌ ${table.name}: ${error.message}`);
      stats.errors.push({ database: dbName, table: table.name, error: error.message });
    }
  }

  // Create indexes (skip FTS indexes, already handled)
  for (const index of schema.indexes) {
    try {
      // Skip indexes on FTS tables (already created)
      if (index.sql.includes('fts5')) {
        continue;
      }

      console.log(`   🔍 Index: ${index.name}`);
      let pgSql = index.sql;

      // Add schema prefix
      pgSql = pgSql.replace(
        /CREATE\s+(UNIQUE\s+)?INDEX\s+(["`]?)(\w+)\2\s+ON\s+(["`]?)(\w+)\4/i,
        (match, unique, q1, indexName, q2, tableName) => {
          const uniqueStr = unique ? 'UNIQUE ' : '';
          return `CREATE ${uniqueStr}INDEX ${indexName} ON ${dbName}.${tableName}`;
        }
      );

      await pgPool.query(pgSql);
      stats.indexes++;
    } catch (error) {
      console.log(`   ⚠️  Index ${index.name}: ${error.message}`);
      // Indexes are non-critical, continue
    }
  }

  // Note: PostgreSQL triggers have different syntax than SQLite
  // We'll skip triggers for now and implement them later if needed
  if (schema.triggers.length > 0) {
    console.log(`   ⏭️  Skipping ${schema.triggers.length} triggers (need manual conversion)`);
    stats.triggers += schema.triggers.length;
  }
}

/**
 * Main migration function
 */
async function migrateSchemas() {
  console.log('\n🔄 Migrating SQLite Schemas to PostgreSQL\n');
  console.log('='.repeat(60));

  // Validate environment
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('\n❌ Error: POSTGRES_URL not found in .env.local');
    process.exit(1);
  }

  console.log('\n📊 Configuration:');
  console.log(`   SQLite data directory: ${DATA_DIR}`);
  console.log(`   Databases to migrate: ${Object.keys(DATABASES).length}`);

  // Create connection pool
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log('\n🔌 Connecting to Neon PostgreSQL...');
    await pool.query('SELECT 1');
    console.log('✅ Connected!');

    // Migrate each database
    for (const [dbName, dbFile] of Object.entries(DATABASES)) {
      await migrateDatabase(dbName, dbFile, pool);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`   Databases processed: ${stats.databases}`);
    console.log(`   Tables created: ${stats.tables}`);
    console.log(`   FTS tables converted: ${stats.fts_tables}`);
    console.log(`   Indexes created: ${stats.indexes}`);
    console.log(`   Triggers skipped: ${stats.triggers}`);
    console.log(`   Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      stats.errors.forEach(({ database, table, error }) => {
        console.log(`   - ${database}.${table}: ${error}`);
      });
    }

    // Get final stats
    const result = await pool.query(`
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname IN ('forums', 'wiki', 'users', 'auth', 'content', 'library', 'messaging', 'system', 'cache', 'main')
      ORDER BY schemaname, tablename
    `);

    console.log(`\n✅ Total PostgreSQL tables: ${result.rows.length}`);

    // Group by schema
    const bySchema = {};
    result.rows.forEach(row => {
      if (!bySchema[row.schemaname]) bySchema[row.schemaname] = [];
      bySchema[row.schemaname].push(row.tablename);
    });

    console.log('\n📁 Tables by schema:');
    Object.entries(bySchema).forEach(([schema, tables]) => {
      console.log(`   ${schema}: ${tables.length} tables`);
    });

    // Database size
    const sizeResult = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    console.log(`\n💾 Database size: ${sizeResult.rows[0].size}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Schema migration completed with errors.');
      console.log('   Please review the errors above before proceeding to data migration.');
      process.exit(1);
    }

    console.log('\n✅ Schema migration complete!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Review the created tables in Neon dashboard');
    console.log('   2. Run: npm run pg:migrate-data');
    console.log('      (This will copy all data from SQLite to PostgreSQL)');
    console.log('\n');
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
migrateSchemas().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
