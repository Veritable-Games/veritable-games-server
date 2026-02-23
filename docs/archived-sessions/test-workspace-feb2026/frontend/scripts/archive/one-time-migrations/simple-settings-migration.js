#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const dataDir = path.join(process.cwd(), 'data');
const forumsDbPath = path.join(dataDir, 'forums.db');
const systemDbPath = path.join(dataDir, 'system.db');

console.log('Simple settings migration from forums.db to system.db');

let forumsDb, systemDb;

try {
  forumsDb = new Database(forumsDbPath);
  systemDb = new Database(systemDbPath);

  // Create simple table in system.db
  systemDb.exec(`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Check if settings exist in forums.db
  const settingsExist = forumsDb
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='site_settings'
  `
    )
    .get();

  if (!settingsExist) {
    console.log('No site_settings table in forums.db - inserting defaults');

    // Insert default settings directly
    const defaults = [
      ['siteName', 'Veritable Games'],
      ['siteDescription', 'Creating memorable gaming experiences'],
      ['maintenanceMode', 'false'],
      ['registrationEnabled', 'true'],
      ['emailVerification', 'false'],
      ['forumEnabled', 'true'],
      ['wikiEnabled', 'true'],
      ['maxUploadSize', '5'],
      ['allowedFileTypes', 'jpg,png,gif,pdf'],
    ];

    const insertStmt = systemDb.prepare(
      'INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)'
    );

    let inserted = 0;
    for (const [key, value] of defaults) {
      insertStmt.run(key, value);
      inserted++;
    }

    console.log(`Inserted ${inserted} default settings`);
  } else {
    // Get settings from forums.db
    const settings = forumsDb.prepare('SELECT key, value FROM site_settings').all();
    console.log(`Found ${settings.length} settings in forums.db`);

    if (settings.length > 0) {
      const insertStmt = systemDb.prepare(
        'INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)'
      );

      let migrated = 0;
      for (const setting of settings) {
        try {
          insertStmt.run(setting.key, setting.value);
          migrated++;
        } catch (error) {
          console.error(`Failed to migrate setting ${setting.key}:`, error.message);
        }
      }

      console.log(`Migrated ${migrated} settings`);
    }
  }

  // Verify final count
  const finalCount = systemDb.prepare('SELECT COUNT(*) as count FROM site_settings').get();
  console.log(`Final settings count in system.db: ${finalCount.count}`);

  console.log('Settings migration complete');
} catch (error) {
  console.error('Migration failed:', error.message);
} finally {
  if (forumsDb) forumsDb.close();
  if (systemDb) systemDb.close();
}
