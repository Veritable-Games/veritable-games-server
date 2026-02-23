/**
 * Manually set maintenance mode
 * Usage: npx tsx scripts/set-maintenance-mode.ts [true|false]
 */

import { settingsService } from '../src/lib/settings/service';

const mode = process.argv[2];

if (mode !== 'true' && mode !== 'false') {
  console.error('Usage: npx tsx scripts/set-maintenance-mode.ts [true|false]');
  process.exit(1);
}

const enabled = mode === 'true';

(async () => {
  try {
    console.log(`Setting maintenance mode to: ${enabled}`);

    await settingsService.updateSetting('maintenanceMode', enabled);

    console.log('✓ Maintenance mode updated successfully');
    console.log('✓ Cache cleared - changes will propagate within 5 seconds');
    console.log(`\nSite is now: ${enabled ? 'LOCKED (login required)' : 'PUBLIC (open access)'}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
