#!/usr/bin/env node

/**
 * Export Seed Data
 * Exports essential data needed for fresh database initialization:
 * - Admin user (first user from users.db + auth sessions)
 * - System settings (from system.db)
 * - Default forum structure (sections, categories from forums.db)
 * - Feature flags (from system.db)
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '../data');
const SEED_DIR = path.join(__dirname, 'seeds/data');

// Ensure seed directory exists
if (!fs.existsSync(SEED_DIR)) {
  fs.mkdirSync(SEED_DIR, { recursive: true });
}

console.log('🌱 Exporting Seed Data');
console.log('======================\n');

/**
 * Export admin user data
 */
function exportAdminUser() {
  const usersDb = path.join(DB_DIR, 'users.db');

  if (!fs.existsSync(usersDb)) {
    console.log('⚠  users.db not found, skipping admin user export');
    return;
  }

  try {
    const db = new Database(usersDb, { readonly: true });

    // Get first admin user (or first user if no admin exists)
    const admin = db
      .prepare(
        `
      SELECT * FROM users
      WHERE role = 'admin'
      ORDER BY id
      LIMIT 1
    `
      )
      .get();

    if (!admin) {
      console.log('  ⚠  No admin user found in database');
      db.close();
      return;
    }

    // Build INSERT statement
    const columns = Object.keys(admin).join(', ');
    const values = Object.values(admin)
      .map(v => (v === null ? 'NULL' : typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v))
      .join(', ');

    const sql = `-- Admin User Seed Data
-- Generated: ${new Date().toISOString()}
-- Username: ${admin.username}
-- Email: ${admin.email}

INSERT INTO users (${columns})
VALUES (${values});
`;

    fs.writeFileSync(path.join(SEED_DIR, 'admin-user.sql'), sql, 'utf8');
    console.log(`  ✓ admin-user.sql - User: ${admin.username} (${admin.email})`);

    db.close();
  } catch (error) {
    console.error('  ❌ Error exporting admin user:', error.message);
  }
}

/**
 * Export system settings
 */
function exportSystemSettings() {
  const systemDb = path.join(DB_DIR, 'system.db');

  if (!fs.existsSync(systemDb)) {
    console.log('⚠  system.db not found, skipping system settings export');
    return;
  }

  try {
    const db = new Database(systemDb, { readonly: true });

    // Get all settings
    const settings = db.prepare('SELECT * FROM settings ORDER BY key').all();

    if (settings.length === 0) {
      console.log('  ⚠  No settings found');
      db.close();
      return;
    }

    // Build INSERT statements
    const inserts = settings
      .map(setting => {
        const columns = Object.keys(setting).join(', ');
        const values = Object.values(setting)
          .map(v =>
            v === null ? 'NULL' : typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v
          )
          .join(', ');

        return `INSERT INTO settings (${columns}) VALUES (${values});`;
      })
      .join('\n');

    const sql = `-- System Settings Seed Data
-- Generated: ${new Date().toISOString()}
-- Total settings: ${settings.length}

${inserts}
`;

    fs.writeFileSync(path.join(SEED_DIR, 'system-settings.sql'), sql, 'utf8');
    console.log(`  ✓ system-settings.sql - ${settings.length} settings`);

    db.close();
  } catch (error) {
    console.error('  ❌ Error exporting system settings:', error.message);
  }
}

/**
 * Export forum structure (sections and categories)
 */
function exportForumStructure() {
  const forumsDb = path.join(DB_DIR, 'forums.db');

  if (!fs.existsSync(forumsDb)) {
    console.log('⚠  forums.db not found, skipping forum structure export');
    return;
  }

  try {
    const db = new Database(forumsDb, { readonly: true });

    // Get forum sections
    const sections = db.prepare('SELECT * FROM forum_sections ORDER BY sort_order').all();

    // Get forum categories
    const categories = db
      .prepare('SELECT * FROM forum_categories ORDER BY section, sort_order')
      .all();

    if (sections.length === 0 && categories.length === 0) {
      console.log('  ⚠  No forum structure found');
      db.close();
      return;
    }

    // Build INSERT statements
    let sql = `-- Forum Structure Seed Data
-- Generated: ${new Date().toISOString()}
-- Sections: ${sections.length}, Categories: ${categories.length}

`;

    if (sections.length > 0) {
      sql += `-- Forum Sections\n`;
      sections.forEach(section => {
        const columns = Object.keys(section).join(', ');
        const values = Object.values(section)
          .map(v =>
            v === null ? 'NULL' : typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v
          )
          .join(', ');

        sql += `INSERT INTO forum_sections (${columns}) VALUES (${values});\n`;
      });
      sql += `\n`;
    }

    if (categories.length > 0) {
      sql += `-- Forum Categories\n`;
      categories.forEach(category => {
        const columns = Object.keys(category).join(', ');
        const values = Object.values(category)
          .map(v =>
            v === null ? 'NULL' : typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v
          )
          .join(', ');

        sql += `INSERT INTO forum_categories (${columns}) VALUES (${values});\n`;
      });
    }

    fs.writeFileSync(path.join(SEED_DIR, 'forum-structure.sql'), sql, 'utf8');
    console.log(
      `  ✓ forum-structure.sql - ${sections.length} sections, ${categories.length} categories`
    );

    db.close();
  } catch (error) {
    console.error('  ❌ Error exporting forum structure:', error.message);
  }
}

/**
 * Export feature flags
 */
function exportFeatureFlags() {
  const systemDb = path.join(DB_DIR, 'system.db');

  if (!fs.existsSync(systemDb)) {
    return; // Already warned in exportSystemSettings
  }

  try {
    const db = new Database(systemDb, { readonly: true });

    // Check if feature_flags table exists
    const tableExists = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='feature_flags'
    `
      )
      .get();

    if (!tableExists) {
      console.log('  ⚠  feature_flags table not found');
      db.close();
      return;
    }

    const flags = db.prepare('SELECT * FROM feature_flags ORDER BY flag_key').all();

    if (flags.length === 0) {
      console.log('  ⚠  No feature flags found');
      db.close();
      return;
    }

    // Build INSERT statements
    const inserts = flags
      .map(flag => {
        const columns = Object.keys(flag).join(', ');
        const values = Object.values(flag)
          .map(v =>
            v === null ? 'NULL' : typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v
          )
          .join(', ');

        return `INSERT INTO feature_flags (${columns}) VALUES (${values});`;
      })
      .join('\n');

    const sql = `-- Feature Flags Seed Data
-- Generated: ${new Date().toISOString()}
-- Total flags: ${flags.length}

${inserts}
`;

    fs.writeFileSync(path.join(SEED_DIR, 'feature-flags.sql'), sql, 'utf8');
    console.log(`  ✓ feature-flags.sql - ${flags.length} flags`);

    db.close();
  } catch (error) {
    console.error('  ❌ Error exporting feature flags:', error.message);
  }
}

// Export all seed data
exportAdminUser();
exportSystemSettings();
exportForumStructure();
exportFeatureFlags();

console.log('\n✅ Seed data export complete!');
console.log(`   Output: ${SEED_DIR}/`);
