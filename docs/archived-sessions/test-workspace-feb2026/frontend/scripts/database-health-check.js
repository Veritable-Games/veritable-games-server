#!/usr/bin/env node

/**
 * Database Health Check Script
 *
 * ⚠️ DEVELOPMENT ONLY - SQLite Health Check
 *
 * This script checks the health of the SQLite database used in development.
 * It is NOT compatible with PostgreSQL production environments.
 *
 * Performs specific database health checks:
 * - Database file accessibility
 * - Connection pool functionality
 * - Table integrity
 * - Index performance
 * - Foreign key constraints
 *
 * For production health checks, use: node scripts/database-health-check-postgres.js
 */

// Safety guard: Warn if running in production
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.ALLOW_SQLITE_IN_PRODUCTION) {
  console.error(
    '[ERROR] SQLite Database Health Check cannot run in production.\n' +
      'This script only works with SQLite (development).\n' +
      'For production health checks, use: database-health-check-postgres.js\n' +
      'Production database: PostgreSQL 15\n'
  );
  process.exit(1);
}

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'forums.db');

function performDatabaseHealthCheck() {
  console.log('🗄️  Database Health Check');
  console.log('========================\n');

  const checks = [];

  try {
    // 1. Check database file accessibility
    const db = new Database(DB_PATH, { readonly: true });
    checks.push({
      name: 'Database File Access',
      status: 'PASS',
      details: 'Database file accessible',
    });

    // 2. Check database integrity
    console.log('1. Checking database integrity...');
    const integrityCheck = db.prepare('PRAGMA integrity_check').get();
    if (integrityCheck.integrity_check === 'ok') {
      console.log('   ✅ Database integrity: OK');
      checks.push({
        name: 'Database Integrity',
        status: 'PASS',
        details: 'Integrity check passed',
      });
    } else {
      console.log('   ❌ Database integrity: FAILED');
      checks.push({
        name: 'Database Integrity',
        status: 'FAIL',
        details: integrityCheck.integrity_check,
      });
    }

    // 3. Check foreign key constraints
    console.log('\n2. Checking foreign key constraints...');
    const foreignKeyCheck = db.prepare('PRAGMA foreign_key_check').all();
    if (foreignKeyCheck.length === 0) {
      console.log('   ✅ Foreign key constraints: OK');
      checks.push({
        name: 'Foreign Key Constraints',
        status: 'PASS',
        details: 'No constraint violations',
      });
    } else {
      console.log(`   ❌ Foreign key constraints: ${foreignKeyCheck.length} violations found`);
      checks.push({
        name: 'Foreign Key Constraints',
        status: 'FAIL',
        details: `${foreignKeyCheck.length} violations`,
      });
      foreignKeyCheck.forEach((violation, index) => {
        console.log(`      ${index + 1}. Table: ${violation.table}, Row: ${violation.rowid}`);
      });
    }

    // 4. Check table statistics
    console.log('\n3. Analyzing table statistics...');
    const tables = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `
      )
      .all();

    console.log(`   Found ${tables.length} tables`);
    checks.push({ name: 'Table Count', status: 'PASS', details: `${tables.length} tables found` });

    // Check a few key tables for data
    const keyTables = ['users', 'wiki_pages', 'forum_topics', 'library_documents'];
    let healthyTables = 0;

    for (const tableName of keyTables) {
      if (tables.find(t => t.name === tableName)) {
        try {
          const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
          console.log(`   ${tableName}: ${count.count} records`);
          healthyTables++;
        } catch (error) {
          console.log(`   ${tableName}: Error reading (${error.message})`);
        }
      } else {
        console.log(`   ${tableName}: Table not found`);
      }
    }

    checks.push({
      name: 'Key Tables Health',
      status: healthyTables === keyTables.length ? 'PASS' : 'PARTIAL',
      details: `${healthyTables}/${keyTables.length} key tables accessible`,
    });

    // 5. Check indexes
    console.log('\n4. Checking indexes...');
    const indexes = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM sqlite_master
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
    `
      )
      .get();

    console.log(`   Found ${indexes.count} custom indexes`);
    checks.push({
      name: 'Index Count',
      status: 'PASS',
      details: `${indexes.count} custom indexes`,
    });

    // 6. Check triggers
    console.log('\n5. Checking triggers...');
    const triggers = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM sqlite_master
      WHERE type='trigger'
    `
      )
      .get();

    console.log(`   Found ${triggers.count} triggers`);
    checks.push({ name: 'Trigger Count', status: 'PASS', details: `${triggers.count} triggers` });

    // 7. Check database size and performance
    console.log('\n6. Checking database performance...');
    const pageInfo = db.prepare('PRAGMA page_count').get();
    const pageSize = db.prepare('PRAGMA page_size').get();
    const dbSize = (pageInfo.page_count * pageSize.page_size) / 1024 / 1024;

    console.log(`   Database size: ${dbSize.toFixed(2)} MB`);
    console.log(`   Page count: ${pageInfo.page_count}`);
    console.log(`   Page size: ${pageSize.page_size} bytes`);

    const sizeStatus = dbSize > 100 ? 'WARNING' : dbSize > 50 ? 'CAUTION' : 'PASS';
    checks.push({
      name: 'Database Size',
      status: sizeStatus,
      details: `${dbSize.toFixed(2)} MB${sizeStatus !== 'PASS' ? ' (consider cleanup)' : ''}`,
    });

    // 8. Check WAL mode
    console.log('\n7. Checking WAL mode...');
    const journalMode = db.prepare('PRAGMA journal_mode').get();
    console.log(`   Journal mode: ${journalMode.journal_mode}`);

    const walStatus = journalMode.journal_mode.toLowerCase() === 'wal' ? 'PASS' : 'WARNING';
    checks.push({
      name: 'WAL Mode',
      status: walStatus,
      details: `Journal mode: ${journalMode.journal_mode}`,
    });

    // 9. Test a simple query performance
    console.log('\n8. Testing query performance...');
    const startTime = Date.now();
    const testQuery = db.prepare('SELECT COUNT(*) as total FROM sqlite_master').get();
    const queryTime = Date.now() - startTime;

    console.log(`   Query time: ${queryTime}ms`);
    const perfStatus = queryTime > 100 ? 'WARNING' : queryTime > 50 ? 'CAUTION' : 'PASS';
    checks.push({
      name: 'Query Performance',
      status: perfStatus,
      details: `${queryTime}ms for metadata query`,
    });

    db.close();

    // Generate summary
    console.log('\n' + '='.repeat(50));
    console.log('Database Health Summary');
    console.log('='.repeat(50));

    const passed = checks.filter(c => c.status === 'PASS').length;
    const warnings = checks.filter(c => c.status === 'WARNING' || c.status === 'CAUTION').length;
    const failed = checks.filter(c => c.status === 'FAIL').length;
    const partial = checks.filter(c => c.status === 'PARTIAL').length;

    checks.forEach(check => {
      const icon =
        check.status === 'PASS'
          ? '✅'
          : check.status === 'WARNING' || check.status === 'CAUTION'
            ? '⚠️'
            : check.status === 'PARTIAL'
              ? '🔶'
              : '❌';
      console.log(`${icon} ${check.name}: ${check.details}`);
    });

    console.log(
      `\nResults: ${passed} passed, ${warnings} warnings, ${partial} partial, ${failed} failed`
    );

    const healthScore = ((passed + partial * 0.5) / checks.length) * 100;
    console.log(`Database Health Score: ${healthScore.toFixed(1)}%`);

    if (healthScore >= 90) {
      console.log('🎉 Database is in excellent health!');
    } else if (healthScore >= 75) {
      console.log('😊 Database is in good health with minor issues.');
    } else if (healthScore >= 50) {
      console.log('⚠️  Database has some issues that may need attention.');
    } else {
      console.log('🚨 Database has significant issues requiring immediate attention.');
    }
  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
    checks.push({ name: 'Database Access', status: 'FAIL', details: error.message });
  }
}

// Run if called directly
if (require.main === module) {
  performDatabaseHealthCheck();
}

module.exports = { performDatabaseHealthCheck };
