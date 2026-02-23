#!/usr/bin/env node

/**
 * Migration script: Add is_public column to wiki_categories table
 * This enables category visibility control (public vs admin-only)
 */

const Database = require('better-sqlite3');
const path = require('path');

const WIKI_DB_PATH = path.join(__dirname, '../data/wiki.db');

async function migrate() {
  console.log('Adding is_public column to wiki_categories table...');

  const db = new Database(WIKI_DB_PATH);

  try {
    // Check if column already exists
    const columns = db.prepare('PRAGMA table_info(wiki_categories)').all();
    const hasIsPublic = columns.some(col => col.name === 'is_public');

    if (hasIsPublic) {
      console.log('✓ Column is_public already exists');
      db.close();
      return;
    }

    // Add is_public column (default 1 = public)
    db.exec(`ALTER TABLE wiki_categories ADD COLUMN is_public INTEGER DEFAULT 1`);
    console.log('✓ Added is_public column (default 1 = public)');

    // Set specific categories to admin-only (is_public = 0)
    const adminOnlyCategories = ['library', 'archive', 'development', 'uncategorized', 'journals'];

    const updateStmt = db.prepare(`UPDATE wiki_categories SET is_public = 0 WHERE id = ?`);

    for (const categoryId of adminOnlyCategories) {
      const result = updateStmt.run(categoryId);
      if (result.changes > 0) {
        console.log(`✓ Set ${categoryId} to admin-only`);
      } else {
        console.log(`  Skipped ${categoryId} (category does not exist)`);
      }
    }

    // Verify migration
    const categories = db
      .prepare('SELECT id, name, is_public FROM wiki_categories ORDER BY id')
      .all();
    console.log('\nCategory visibility status:');
    categories.forEach(cat => {
      const visibility = cat.is_public ? 'PUBLIC' : 'ADMIN-ONLY';
      console.log(`  ${cat.id.padEnd(20)} ${visibility}`);
    });

    console.log('\n✓ Migration complete!');
  } catch (error) {
    console.error('✗ Migration failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

migrate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
