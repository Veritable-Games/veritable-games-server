/**
 * Debug script to check what settingsService.getSettings() returns
 */

async function testSettings() {
  // Simulate the parsing logic from settings service
  const rows = [
    { key: 'maintenanceMode', value: 'false' },
    { key: 'siteName', value: 'Veritable Games' },
    { key: 'registrationEnabled', value: 'true' },
  ];

  const settings = {};
  for (const { key, value } of rows) {
    console.log(`Processing: key=${key}, value="${value}", type=${typeof value}`);

    if (value === 'true' || value === 'false') {
      settings[key] = value === 'true';
      console.log(`  → Parsed as boolean: ${settings[key]}`);
    } else {
      settings[key] = value;
      console.log(`  → Kept as string: ${settings[key]}`);
    }
  }

  console.log('\nFinal settings object:');
  console.log(JSON.stringify(settings, null, 2));

  console.log('\nmaintenanceMode value:', settings.maintenanceMode);
  console.log('maintenanceMode type:', typeof settings.maintenanceMode);
  console.log('maintenanceMode is truthy?', !!settings.maintenanceMode);
}

testSettings();
