/**
 * Diagnostic script to check maintenance mode settings
 */

import { dbAdapter } from '../src/lib/database/adapter';

async function checkMaintenanceMode() {
  try {
    console.log('\n=== Maintenance Mode Diagnostic ===\n');

    // 1. Check environment variables
    console.log('1. Environment Variables:');
    console.log(
      `   LOCKDOWN_EMERGENCY_OVERRIDE: ${process.env.LOCKDOWN_EMERGENCY_OVERRIDE || 'not set'}`
    );
    console.log(
      `   NEXT_PUBLIC_MAINTENANCE_MODE: ${process.env.NEXT_PUBLIC_MAINTENANCE_MODE || 'not set'}`
    );
    console.log(`   DATABASE_MODE: ${process.env.DATABASE_MODE || 'not set'}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}\n`);

    // 2. Check database value
    console.log('2. Database Value:');
    const result = await dbAdapter.query<{ key: string; value: string; updated_at: string }>(
      "SELECT key, value, updated_at FROM site_settings WHERE key = 'maintenanceMode'",
      [],
      { schema: 'system' }
    );

    const row = result.rows[0];
    if (row) {
      console.log(`   Raw value: "${row.value}" (type: ${typeof row.value})`);
      console.log(`   Updated at: ${row.updated_at}`);
      const boolValue = row.value === 'true';
      console.log(`   Converted to boolean: ${boolValue}\n`);
    } else {
      console.log('   ⚠️ No maintenanceMode setting found in database!\n');
    }

    // 3. Check all settings
    console.log('3. All Site Settings:');
    const allSettings = await dbAdapter.query<{ key: string; value: string }>(
      'SELECT key, value FROM site_settings ORDER BY key',
      [],
      { schema: 'system' }
    );
    for (const row of allSettings.rows) {
      console.log(`   ${row.key}: "${row.value}"`);
    }

    // 4. Test the API endpoint (simulated)
    console.log('\n4. What the API should return:');
    const maintenanceRow = result.rows[0];
    if (maintenanceRow) {
      const dbValue = maintenanceRow.value === 'true';
      const envOverride =
        process.env.LOCKDOWN_EMERGENCY_OVERRIDE === 'true' ||
        process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';
      const effectiveEnabled = envOverride || dbValue;

      console.log(`   Database value: ${dbValue}`);
      console.log(`   Environment override active: ${envOverride}`);
      console.log(`   Effective state (what middleware sees): ${effectiveEnabled}`);
      console.log(
        `\n   Result: Site is ${effectiveEnabled ? 'LOCKED (login required)' : 'PUBLIC (open access)'}`
      );
    }

    console.log('\n=================================\n');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkMaintenanceMode();
