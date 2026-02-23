/**
 * Analyze all database files to understand what content is stored where
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../data');

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function analyzeDatabase(dbPath) {
  const dbName = path.basename(dbPath);
  const stats = fs.statSync(dbPath);

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📁 ${dbName.toUpperCase()}`);
  console.log(`   File size: ${formatBytes(stats.size)}`);
  console.log(`${'='.repeat(70)}\n`);

  const db = new Database(dbPath);

  try {
    // Get all tables
    const tables = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `
      )
      .all();

    console.log(`📊 Tables (${tables.length} total):\n`);

    tables.forEach(table => {
      try {
        // Get row count
        const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
        const count = countResult.count;

        // Get sample data for key tables
        let sampleInfo = '';

        if (count > 0) {
          // Special handling for different table types
          if (table.name === 'projects') {
            const samples = db
              .prepare(`SELECT slug, title, LENGTH(content) as size FROM ${table.name} LIMIT 5`)
              .all();
            sampleInfo =
              '\n     ' + samples.map(s => `${s.slug} (${formatBytes(s.size)})`).join('\n     ');
          } else if (table.name === 'wiki_pages') {
            const samples = db.prepare(`SELECT slug, namespace FROM ${table.name} LIMIT 5`).all();
            sampleInfo = '\n     ' + samples.map(s => `${s.slug} [${s.namespace}]`).join('\n     ');
          } else if (table.name === 'wiki_revisions') {
            const totalSize = db
              .prepare(`SELECT SUM(size_bytes) as total FROM ${table.name}`)
              .get();
            sampleInfo = ` (total content: ${formatBytes(totalSize.total || 0)})`;
          } else if (table.name === 'project_revisions') {
            const totalSize = db
              .prepare(`SELECT SUM(size_bytes) as total FROM ${table.name}`)
              .get();
            const projects = db.prepare(`SELECT DISTINCT project_slug FROM ${table.name}`).all();
            sampleInfo = ` (${projects.length} projects, ${formatBytes(totalSize.total || 0)} total)`;
          } else if (table.name === 'library_documents') {
            const samples = db.prepare(`SELECT slug, title FROM ${table.name} LIMIT 3`).all();
            if (samples.length > 0) {
              sampleInfo = '\n     ' + samples.map(s => s.title || s.slug).join('\n     ');
            }
          } else if (table.name === 'forum_topics') {
            const samples = db.prepare(`SELECT title FROM ${table.name} LIMIT 3`).all();
            if (samples.length > 0) {
              sampleInfo = '\n     ' + samples.map(s => s.title).join('\n     ');
            }
          } else if (table.name === 'users') {
            const samples = db.prepare(`SELECT username, role FROM ${table.name} LIMIT 5`).all();
            sampleInfo = '\n     ' + samples.map(s => `${s.username} (${s.role})`).join('\n     ');
          }
        }

        const icon = count > 0 ? '✓' : '○';
        console.log(
          `   ${icon} ${table.name.padEnd(40)} ${String(count).padStart(6)} rows${sampleInfo}`
        );
      } catch (error) {
        console.log(`   ❌ ${table.name.padEnd(40)} Error: ${error.message}`);
      }
    });
  } catch (error) {
    console.error(`Error analyzing ${dbName}:`, error.message);
  } finally {
    db.close();
  }
}

function main() {
  console.log('🔍 ANALYZING ALL DATABASE FILES');
  console.log('='.repeat(70));

  // Get all .db files
  const dbFiles = fs
    .readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.db'))
    .sort()
    .map(f => path.join(DATA_DIR, f));

  console.log(`\nFound ${dbFiles.length} database files:\n`);
  dbFiles.forEach(f => console.log(`  • ${path.basename(f)}`));

  // Analyze each database
  dbFiles.forEach(analyzeDatabase);

  console.log('\n' + '='.repeat(70));
  console.log('✨ Analysis complete!\n');
}

main();
