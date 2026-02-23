#!/usr/bin/env node

/**
 * Update category sections to use forum_sections IDs instead of display names
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/forums.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

console.log('Updating category sections to use section IDs...');

// Mapping of old display names to new section IDs
const sectionMapping = {
  'Social Contract': 'general',
  'Noxii Game': 'games',
  'Autumn Project': 'autumn',
  Miscellaneous: 'misc',
};

const updateStmt = db.prepare(`
  UPDATE forum_categories
  SET section = ?, updated_at = CURRENT_TIMESTAMP
  WHERE section = ?
`);

const transaction = db.transaction(() => {
  for (const [displayName, sectionId] of Object.entries(sectionMapping)) {
    const result = updateStmt.run(sectionId, displayName);
    console.log(`Updated ${result.changes} categories from "${displayName}" to "${sectionId}"`);
  }
});

transaction();

// Verify the update
const categories = db
  .prepare('SELECT id, name, section FROM forum_categories ORDER BY sort_order')
  .all();
console.log('\nUpdated categories:');
console.table(categories);

db.close();
console.log('\nMigration complete!');
