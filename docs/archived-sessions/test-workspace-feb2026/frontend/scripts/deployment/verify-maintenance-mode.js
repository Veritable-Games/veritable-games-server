#!/usr/bin/env node

/**
 * Post-Deployment Verification: Maintenance Mode Status
 *
 * This script verifies that maintenance mode (site lockdown) is correctly
 * configured after deployment. It should be run IMMEDIATELY after any
 * deployment that touches:
 * - middleware.ts
 * - site_settings table
 * - maintenance mode logic
 *
 * INCIDENT BACKGROUND:
 * On Feb 18, 2026, a deployment removed buggy lockdown code, which exposed
 * the database default value of 'false', making the site publicly accessible
 * without warning.
 *
 * USAGE:
 *   node scripts/deployment/verify-maintenance-mode.js
 *
 *   # Or with npm:
 *   npm run deployment:verify-maintenance
 *
 * EXIT CODES:
 *   0 = Verification passed (site is locked as expected)
 *   1 = Verification failed (site is PUBLIC - ACTION REQUIRED)
 *
 * See: docs/incidents/2026-02-18-maintenance-mode-disabled-after-deployment.md
 */

const { Pool } = require('pg');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const PRODUCTION_DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@10.100.0.1:5432/veritable_games';

async function verifyMaintenanceMode() {
  console.log(`${colors.cyan}${colors.bold}
╔═══════════════════════════════════════════════════════════════╗
║   POST-DEPLOYMENT VERIFICATION: Maintenance Mode Status       ║
╚═══════════════════════════════════════════════════════════════╝
${colors.reset}`);

  const pool = new Pool({
    connectionString: PRODUCTION_DATABASE_URL,
    ssl: false,
  });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log(`${colors.green}✓${colors.reset} Database connection established\n`);

    // Query maintenance mode setting
    const result = await pool.query(
      `SELECT key, value, updated_at, updated_by
       FROM system.site_settings
       WHERE key = 'maintenanceMode'`
    );

    if (result.rows.length === 0) {
      console.error(`${colors.red}${colors.bold}❌ CRITICAL ERROR${colors.reset}`);
      console.error(
        `${colors.red}maintenanceMode setting does NOT exist in database!${colors.reset}\n`
      );
      console.error('ACTION REQUIRED:');
      console.error('  1. Run migration: npm run db:migrate:production');
      console.error('  2. Verify setting exists');
      console.error('  3. Re-run this script\n');
      process.exit(1);
    }

    const setting = result.rows[0];
    const isEnabled = setting.value === 'true';

    console.log('Current Maintenance Mode Configuration:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Key:         ${setting.key}`);
    console.log(
      `  Value:       ${isEnabled ? colors.green : colors.red}${setting.value}${colors.reset}`
    );
    console.log(`  Updated:     ${setting.updated_at}`);
    console.log(`  Updated By:  ${setting.updated_by || 'N/A (system)'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check audit log for recent changes
    const auditCheck = await pool.query(
      `SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'system'
        AND table_name = 'site_settings_audit'
      ) as audit_exists`
    );

    if (auditCheck.rows[0].audit_exists) {
      const recentChanges = await pool.query(
        `SELECT key, old_value, new_value, changed_at, operation
         FROM system.site_settings_audit
         WHERE key = 'maintenanceMode'
         ORDER BY changed_at DESC
         LIMIT 5`
      );

      if (recentChanges.rows.length > 0) {
        console.log('Recent Maintenance Mode Changes:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        recentChanges.rows.forEach((change, idx) => {
          console.log(
            `  ${idx + 1}. ${change.operation}: ${change.old_value || 'NULL'} → ${change.new_value || 'NULL'}`
          );
          console.log(`     Changed: ${change.changed_at}`);
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      }
    } else {
      console.log(
        `${colors.yellow}⚠ Warning: Audit table not found. Run migration 024-site-settings-audit-log.sql${colors.reset}\n`
      );
    }

    // VERIFICATION RESULT
    console.log(`${colors.bold}Verification Result:${colors.reset}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (isEnabled) {
      console.log(
        `${colors.green}${colors.bold}✅ PASS: Site is LOCKED (maintenance mode ON)${colors.reset}`
      );
      console.log(
        `${colors.green}Site requires authentication - public cannot access${colors.reset}\n`
      );
      console.log('Deployment verification successful.\n');
      process.exit(0);
    } else {
      console.log(
        `${colors.red}${colors.bold}❌ FAIL: Site is PUBLIC (maintenance mode OFF)${colors.reset}`
      );
      console.log(
        `${colors.red}${colors.bold}WARNING: Anyone can access the site without authentication!${colors.reset}\n`
      );

      console.log(`${colors.yellow}${colors.bold}IMMEDIATE ACTION REQUIRED:${colors.reset}`);
      console.log('  1. Enable maintenance mode:');
      console.log(`     ${colors.cyan}npm run maintenance:enable${colors.reset}`);
      console.log('\n  2. Or via SQL:');
      console.log(
        `     ${colors.cyan}UPDATE system.site_settings SET value = 'true' WHERE key = 'maintenanceMode';${colors.reset}`
      );
      console.log('\n  3. Verify change:');
      console.log(`     ${colors.cyan}npm run deployment:verify-maintenance${colors.reset}\n`);

      console.log('If site should be public, this is expected. Otherwise, ENABLE LOCKDOWN NOW.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `${colors.red}${colors.bold}❌ ERROR during verification:${colors.reset}`,
      error.message
    );

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tips:');
      console.error('   - Is PostgreSQL running?');
      console.error('   - Is VPN connected? (ping 10.100.0.1)');
      console.error('   - Check DATABASE_URL environment variable');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run verification
verifyMaintenanceMode();
