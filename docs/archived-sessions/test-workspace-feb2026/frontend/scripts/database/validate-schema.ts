#!/usr/bin/env tsx
/**
 * Database Schema Validation Script
 *
 * Validates that the database schema matches what the code expects.
 * Prevents production incidents caused by missing columns/tables.
 *
 * Created after: 2026-02-12 journals/categories missing incident
 * Related: docs/incidents/2026-02-12-journals-missing-columns.md
 *
 * Usage:
 *   npm run db:validate-schema               # Check current database
 *   DATABASE_MODE=production npm run db:validate-schema  # Check production
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Expected schema definition - CRITICAL COLUMNS ONLY
 *
 * This validation focuses on columns that code actually references.
 * Add entries here when creating migrations that add columns used in queries.
 *
 * Note: Only validates columns that MUST exist. Schema may have additional columns.
 */
const EXPECTED_SCHEMA = {
  wiki: {
    wiki_pages: [
      // Core columns
      { name: 'id', type: 'integer' },
      { name: 'slug', type: 'text' },
      { name: 'title', type: 'text' },
      { name: 'namespace', type: 'text' },
      { name: 'created_by', type: 'integer' },
      // Deletion tracking (Migration 016) - CRITICAL
      { name: 'is_deleted', type: 'boolean' },
      { name: 'deleted_by', type: 'integer' },
      { name: 'deleted_at', type: 'timestamp' },
    ],
    journal_categories: [
      { name: 'id', type: 'ANY' }, // Can be integer or text, both work
      { name: 'user_id', type: 'integer' },
      { name: 'name', type: 'text' },
      { name: 'sort_order', type: 'integer' },
      // Note: is_team_category NOT in production yet (planned Migration 017)
      // When added, uncomment:
      // { name: 'is_team_category', type: 'boolean' },
    ],
  },
  users: {
    users: [
      { name: 'id', type: 'integer' },
      { name: 'username', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'role', type: 'text' },
    ],
  },
};

/**
 * PostgreSQL type mapping
 * Maps PostgreSQL types to simplified types for comparison
 */
function normalizeType(pgType: string): string {
  const typeMap: Record<string, string> = {
    bigint: 'integer',
    integer: 'integer',
    smallint: 'integer',
    serial: 'integer',
    bigserial: 'integer',
    'character varying': 'text',
    varchar: 'text',
    text: 'text',
    'timestamp without time zone': 'timestamp',
    'timestamp with time zone': 'timestamp',
    boolean: 'boolean',
    json: 'json',
    jsonb: 'json',
  };

  return typeMap[pgType.toLowerCase()] || pgType;
}

/**
 * Validation result for a single column
 */
interface ColumnValidation {
  column: string;
  expected: string;
  actual: string | null;
  status: 'ok' | 'missing' | 'type_mismatch';
}

/**
 * Validation result for a single table
 */
interface TableValidation {
  table: string;
  status: 'ok' | 'missing' | 'has_issues';
  columns: ColumnValidation[];
}

/**
 * Validation result for a single schema
 */
interface SchemaValidation {
  schema: string;
  status: 'ok' | 'missing' | 'has_issues';
  tables: TableValidation[];
}

async function validateSchema(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL or POSTGRES_URL not configured');
    console.error('   Set DATABASE_URL in .env.local file');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('🔍 Database Schema Validation\n');
    console.log('Database:', databaseUrl.split('@')[1] || 'localhost');
    console.log('Time:', new Date().toISOString());
    console.log('Mode:', process.env.DATABASE_MODE || 'development');
    console.log('\n' + '='.repeat(70) + '\n');

    let totalIssues = 0;
    const schemaResults: SchemaValidation[] = [];

    // Validate each schema
    for (const [schemaName, tables] of Object.entries(EXPECTED_SCHEMA)) {
      console.log(`📂 Schema: ${schemaName}`);

      // Check if schema exists
      const schemaExists = await pool.query(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
        [schemaName]
      );

      if (schemaExists.rows.length === 0) {
        console.log(`   ❌ Schema does not exist\n`);
        totalIssues++;
        schemaResults.push({
          schema: schemaName,
          status: 'missing',
          tables: [],
        });
        continue;
      }

      const tableResults: TableValidation[] = [];

      // Validate each table
      for (const [tableName, expectedColumns] of Object.entries(tables)) {
        // Get actual columns from database
        const columnsResult = await pool.query(
          `SELECT column_name, data_type
           FROM information_schema.columns
           WHERE table_schema = $1 AND table_name = $2
           ORDER BY ordinal_position`,
          [schemaName, tableName]
        );

        const actualColumns = new Map(
          columnsResult.rows.map(row => [row.column_name, normalizeType(row.data_type)])
        );

        // Check if table exists
        if (actualColumns.size === 0) {
          console.log(`   ❌ Table ${tableName} does not exist`);
          totalIssues++;
          tableResults.push({
            table: tableName,
            status: 'missing',
            columns: [],
          });
          continue;
        }

        // Validate each expected column
        const columnValidations: ColumnValidation[] = [];
        let tableHasIssues = false;

        for (const expectedCol of expectedColumns) {
          const actualType = actualColumns.get(expectedCol.name);

          if (actualType === undefined) {
            console.log(
              `   ❌ ${tableName}.${expectedCol.name} - MISSING (expected: ${expectedCol.type})`
            );
            totalIssues++;
            tableHasIssues = true;
            columnValidations.push({
              column: expectedCol.name,
              expected: expectedCol.type,
              actual: null,
              status: 'missing',
            });
          } else if (expectedCol.type !== 'ANY' && actualType !== expectedCol.type) {
            // Skip type check if expected type is 'ANY'
            console.log(
              `   ⚠️  ${tableName}.${expectedCol.name} - TYPE MISMATCH (expected: ${expectedCol.type}, actual: ${actualType})`
            );
            totalIssues++;
            tableHasIssues = true;
            columnValidations.push({
              column: expectedCol.name,
              expected: expectedCol.type,
              actual: actualType,
              status: 'type_mismatch',
            });
          } else {
            columnValidations.push({
              column: expectedCol.name,
              expected: expectedCol.type,
              actual: actualType,
              status: 'ok',
            });
          }
        }

        if (!tableHasIssues) {
          console.log(`   ✅ ${tableName} - OK (${expectedColumns.length} columns)`);
        }

        tableResults.push({
          table: tableName,
          status: tableHasIssues ? 'has_issues' : 'ok',
          columns: columnValidations,
        });
      }

      schemaResults.push({
        schema: schemaName,
        status: tableResults.some(t => t.status !== 'ok') ? 'has_issues' : 'ok',
        tables: tableResults,
      });

      console.log('');
    }

    // Summary
    console.log('='.repeat(70));

    if (totalIssues === 0) {
      console.log('✅ Schema validation passed - No issues found');
      console.log('='.repeat(70));
      console.log('\nDatabase schema matches expected schema.\n');
      process.exit(0);
    } else {
      console.log(`❌ Schema validation failed - ${totalIssues} issue(s) found`);
      console.log('='.repeat(70));
      console.log('\n📝 Recommended Actions:\n');
      console.log('1. Check if migrations have been applied:');
      console.log('   npm run db:migrate              # For development');
      console.log('   npm run db:migrate:production   # For production\n');
      console.log('2. Review migration files in frontend/scripts/migrations/\n');
      console.log('3. See docs/database/MIGRATION_TRACKING.md for migration status\n');
      console.log('4. If production, manually apply missing migrations:');
      console.log('   ssh user@192.168.1.15 "docker exec veritable-games-postgres ..."');
      console.log('');

      // Show which schemas/tables have issues
      console.log('📊 Issues by Schema:\n');
      for (const schema of schemaResults) {
        if (schema.status !== 'ok') {
          const issueCount = schema.tables.filter(t => t.status !== 'ok').length;
          console.log(`   ${schema.schema}: ${issueCount} table(s) with issues`);
          for (const table of schema.tables) {
            if (table.status === 'missing') {
              console.log(`      - ${table.table}: TABLE MISSING`);
            } else if (table.status === 'has_issues') {
              const missingCols = table.columns.filter(c => c.status === 'missing').length;
              const mismatchCols = table.columns.filter(c => c.status === 'type_mismatch').length;
              console.log(
                `      - ${table.table}: ${missingCols} missing, ${mismatchCols} type mismatches`
              );
            }
          }
        }
      }
      console.log('');

      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Validation failed:', (error as Error).message);
    if ((error as any).code === 'ECONNREFUSED') {
      console.error('   PostgreSQL server is not reachable');
      console.error(`   Check DATABASE_URL: ${databaseUrl.split('@')[1]}`);
    }
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run validation
validateSchema().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
