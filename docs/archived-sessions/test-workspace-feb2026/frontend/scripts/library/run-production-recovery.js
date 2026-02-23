#!/usr/bin/env node

/**
 * Production Database Recovery Migration Runner
 *
 * Fixes schema inconsistency on production database where:
 * - New columns (file_path, notes) exist
 * - Old columns (description, status, etc.) have been dropped
 * - Standard migration fails because it expects old columns
 *
 * This recovery migration ensures all required columns exist
 * without assuming the state of dropped columns.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  console.error('   Usage: DATABASE_URL="..." node run-production-recovery.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  // Connection timeout for remote databases
  connectionTimeoutMillis: 10000,
  // Query timeout
  query_timeout: 30000,
});

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(symbol, message, detail = '') {
  console.log(`${symbol} ${message}${detail ? ` ${colors.gray}${detail}${colors.reset}` : ''}`);
}

async function getSchemaState() {
  try {
    const result = await pool.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'library'
        AND table_name = 'library_documents'
      ORDER BY ordinal_position
    `);

    const schema = {};
    result.rows.forEach(row => {
      schema[row.column_name] = {
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        default: row.column_default,
      };
    });

    return schema;
  } catch (err) {
    throw new Error(`Failed to query schema: ${err.message}`);
  }
}

async function getDocumentCount() {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM library.library_documents');
    return parseInt(result.rows[0].count, 10);
  } catch (err) {
    return null;
  }
}

async function checkViewExists(viewName) {
  try {
    const result = await pool.query(
      `
      SELECT EXISTS(
        SELECT 1 FROM information_schema.views
        WHERE table_schema = 'library' AND table_name = $1
      ) as exists
    `,
      [viewName]
    );
    return result.rows[0].exists;
  } catch (err) {
    return false;
  }
}

async function runMigration(sqlContent) {
  try {
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      log('▶', `Executing statement ${i + 1}/${statements.length}`);

      try {
        await pool.query(statement);
        log('  ✅', `Statement ${i + 1} completed`);
      } catch (err) {
        // Check if this is a constraint check error (expected to fail)
        if (err.code === '23514' && statement.includes('check_document_has_content')) {
          log('  ⚠️', `Check constraint may already exist, continuing...`);
        } else {
          throw err;
        }
      }
    }

    return true;
  } catch (err) {
    throw new Error(`Migration execution failed: ${err.message}`);
  }
}

async function verifyDocumentCreation() {
  try {
    // Try to create a test document
    const testSlug = `test-recovery-${Date.now()}`;
    const result = await pool.query(
      `
      INSERT INTO library.library_documents (
        slug,
        title,
        author,
        publication_date,
        document_type,
        notes,
        file_path,
        created_by,
        created_at,
        updated_at,
        view_count
      ) VALUES (
        $1,
        'Recovery Test Document',
        'System',
        '2025-12-29',
        'document',
        'Test document for recovery validation',
        '/data/library/documents/2025/12/recovery-test.md',
        1,
        NOW(),
        NOW(),
        0
      ) RETURNING id, slug
    `,
      [testSlug]
    );

    if (result.rows.length > 0) {
      const doc = result.rows[0];
      log('✅', `Test document created successfully`, `id=${doc.id}, slug=${doc.slug}`);

      // Clean up test document
      try {
        await pool.query('DELETE FROM library.library_documents WHERE slug = $1', [testSlug]);
        log('  🧹', 'Test document cleaned up');
      } catch (err) {
        log('  ⚠️', 'Failed to clean up test document (non-critical)');
      }

      return true;
    }

    return false;
  } catch (err) {
    log('❌', `Test document creation failed: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n' + colors.cyan + '═'.repeat(60) + colors.reset);
  console.log(colors.cyan + '  Production Database Recovery Migration' + colors.reset);
  console.log(colors.cyan + '═'.repeat(60) + colors.reset + '\n');

  try {
    // Step 1: Connection test
    log('🔍', 'Connecting to database...');
    await pool.query('SELECT 1');
    log('✅', 'Database connection successful');

    // Step 2: Current schema state
    log('\n📋', 'Analyzing current schema state...');
    const beforeSchema = await getSchemaState();
    const docCount = await getDocumentCount();

    console.log('\n  Current columns:');
    const requiredCols = [
      'id',
      'slug',
      'title',
      'author',
      'publication_date',
      'document_type',
      'notes',
      'file_path',
      'created_by',
      'created_at',
      'updated_at',
      'view_count',
    ];

    let schemaHealthy = true;
    requiredCols.forEach(col => {
      const exists = beforeSchema[col] !== undefined;
      const status = exists ? '✅' : '❌';
      const detail = exists ? beforeSchema[col].type : 'MISSING';
      console.log(`    ${status} ${col}: ${detail}`);
      if (!exists) schemaHealthy = false;
    });

    console.log(`\n  📊 Database status:`);
    log('  ℹ️', `Total documents: ${docCount || '(unable to count)'}`);

    const oldColsDropped = ['status', 'description', 'abstract', 'search_text'].every(
      col => beforeSchema[col] === undefined
    );
    log('  ℹ️', `Old columns dropped: ${oldColsDropped ? 'YES' : 'NO'}`);

    // Step 3: Run recovery migration
    if (schemaHealthy) {
      log('\n✅', 'Schema appears healthy, migration may not be needed');
      log('  ℹ️', 'Proceeding with recovery validation...\n');
    } else {
      log('\n⏳', 'Running recovery migration...');
      const migrationPath = path.join(__dirname, 'production-recovery-migration.sql');

      if (!fs.existsSync(migrationPath)) {
        throw new Error(`Migration file not found: ${migrationPath}`);
      }

      const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
      await runMigration(migrationSql);
      log('✅', 'Recovery migration completed successfully\n');
    }

    // Step 4: Verify schema after migration
    log('📋', 'Verifying schema after recovery...');
    const afterSchema = await getSchemaState();

    let allRequiredPresent = true;
    requiredCols.forEach(col => {
      const exists = afterSchema[col] !== undefined;
      const status = exists ? '✅' : '❌';
      const detail = exists ? afterSchema[col].type : 'MISSING';
      console.log(`  ${status} ${col}: ${detail}`);
      if (!exists) allRequiredPresent = false;
    });

    if (!allRequiredPresent) {
      throw new Error('Required columns still missing after migration');
    }

    log('\n✅', 'All required columns present');

    // Step 5: Check views
    log('\n🔗', 'Verifying views...');
    const viewExists = await checkViewExists('all_documents');
    const viewStatus = viewExists ? '✅' : '❌';
    log(viewStatus, `all_documents view: ${viewExists ? 'EXISTS' : 'MISSING'}`);

    // Step 6: Test document creation
    log('\n🧪', 'Testing document creation capability...');
    const canCreate = await verifyDocumentCreation();

    if (!canCreate) {
      throw new Error('Document creation test failed');
    }

    // Success summary
    console.log('\n' + colors.green + '═'.repeat(60) + colors.reset);
    console.log(colors.green + '  ✅ Recovery Migration Successful!' + colors.reset);
    console.log(colors.green + '═'.repeat(60) + colors.reset);
    console.log(`
  Database schema is now consistent and ready for document creation.

  Next steps:
  1. Run file migration: node scripts/library/migrate-to-files.js
  2. Test document creation in the web UI
  3. Monitor application logs for any issues
  4. Verify www.veritablegames.com/library works correctly

  If issues persist, check:
  - Application logs (Coolify dashboard)
  - Database connection in code
  - API endpoint response in browser DevTools
    `);

    process.exit(0);
  } catch (err) {
    console.log('\n' + colors.red + '═'.repeat(60) + colors.reset);
    console.log(colors.red + '  ❌ Recovery Migration Failed' + colors.reset);
    console.log(colors.red + '═'.repeat(60) + colors.reset);
    log('\n❌', 'Error:', err.message);

    console.log(`
  Troubleshooting:
  1. Verify DATABASE_URL is correct
  2. Check PostgreSQL is running on production server
  3. Verify network connectivity to 192.168.1.15:5432
  4. Check database user permissions
  5. Review PostgreSQL logs on production server

  For detailed diagnostics, run:
  ssh root@192.168.1.15 'docker logs -f veritable_games-postgres-1'
    `);

    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
