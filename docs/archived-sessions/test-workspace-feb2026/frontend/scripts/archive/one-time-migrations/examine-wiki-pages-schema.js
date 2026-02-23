#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'forums.db');

function examineWikiPagesSchema() {
  console.log('🔍 Examining wiki_pages table structure...\n');

  try {
    const db = new Database(DB_PATH, { readonly: true });

    // Get table structure
    const columns = db.prepare("PRAGMA table_info('wiki_pages')").all();

    console.log('Current wiki_pages columns:');
    columns.forEach(col => {
      console.log(
        `  ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : 'NULL'} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`
      );
    });

    // Check for file-related columns
    const fileColumns = columns.filter(col =>
      ['file_path', 'file_size', 'mime_type'].includes(col.name)
    );

    console.log(`\nFile-related columns found: ${fileColumns.length}`);
    fileColumns.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });

    // Get sample data to understand the schema better
    const sampleRow = db.prepare('SELECT * FROM wiki_pages LIMIT 1').get();
    if (sampleRow) {
      console.log('\nSample row keys:');
      console.log(Object.keys(sampleRow).join(', '));
    }

    db.close();
  } catch (error) {
    console.error('❌ Error examining schema:', error);
  }
}

examineWikiPagesSchema();
