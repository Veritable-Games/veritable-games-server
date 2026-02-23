#!/usr/bin/env node

/**
 * Migration Script: Add is_public Column to forum_categories
 *
 * This script adds visibility control to forum categories.
 * - Adds `is_public` INTEGER column (1=public, 0=admin-only)
 * - Sets all existing categories to public (is_public=1)
 * - Safe to run multiple times (idempotent)
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/forums.db');

function main() {
  console.log('🔄 Starting forum category visibility migration...\n');

  const db = new Database(DB_PATH);

  try {
    // Check if column already exists
    const tableInfo = db.prepare('PRAGMA table_info(forum_categories)').all();
    const hasIsPublic = tableInfo.some(col => col.name === 'is_public');

    if (hasIsPublic) {
      console.log('✅ Column `is_public` already exists. Migration skipped.');
      db.close();
      return;
    }

    console.log('📊 Current schema:');
    tableInfo.forEach(col => {
      console.log(`   - ${col.name} (${col.type})`);
    });
    console.log();

    // Get count of existing categories
    const { count } = db.prepare('SELECT COUNT(*) as count FROM forum_categories').get();
    console.log(`📁 Found ${count} existing categories\n`);

    // Add the is_public column
    console.log('🔧 Adding is_public column...');
    db.prepare('ALTER TABLE forum_categories ADD COLUMN is_public INTEGER DEFAULT 1').run();

    // Verify the column was added
    const updatedTableInfo = db.prepare('PRAGMA table_info(forum_categories)').all();
    const isPublicCol = updatedTableInfo.find(col => col.name === 'is_public');

    if (!isPublicCol) {
      throw new Error('Failed to add is_public column');
    }

    console.log(
      `✅ Column added: is_public (${isPublicCol.type}, default: ${isPublicCol.dflt_value})\n`
    );

    // Update all existing categories to public
    console.log('🔧 Setting all existing categories to public...');
    const result = db.prepare('UPDATE forum_categories SET is_public = 1').run();
    console.log(`✅ Updated ${result.changes} categories to public\n`);

    // Display final schema
    console.log('📊 Updated schema:');
    updatedTableInfo.forEach(col => {
      const marker = col.name === 'is_public' ? '✨' : '  ';
      console.log(
        `${marker} - ${col.name} (${col.type})${col.dflt_value ? ` [default: ${col.dflt_value}]` : ''}`
      );
    });
    console.log();

    // Verify data integrity
    const categories = db
      .prepare(
        `
      SELECT id, slug, name, is_public
      FROM forum_categories
      ORDER BY sort_order
    `
      )
      .all();

    console.log('📋 Category visibility status:');
    categories.forEach(cat => {
      const visibility = cat.is_public === 1 ? '🌍 Public' : '🔒 Admin-Only';
      console.log(`   ${visibility} - ${cat.name} (${cat.slug})`);
    });
    console.log();

    console.log('✅ Migration completed successfully!\n');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
