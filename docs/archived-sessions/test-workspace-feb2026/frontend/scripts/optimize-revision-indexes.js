const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../data/forums.db'));

console.log('=== Optimizing Revision Indexes for Individual Productivity ===\n');

/**
 * Indexes specifically designed for individual user revision browsing patterns
 */
const revisionIndexes = [
  // Individual author productivity queries
  {
    name: 'idx_wiki_revisions_author_time',
    table: 'wiki_revisions',
    columns: 'author_id, revision_timestamp DESC, page_id',
    description: 'Optimize personal revision history browsing',
  },

  // Page-specific revision browsing (current functionality)
  {
    name: 'idx_wiki_revisions_page_time_author',
    table: 'wiki_revisions',
    columns: 'page_id, revision_timestamp DESC, author_id',
    description: 'Optimize page revision history with author info',
  },

  // Content search optimization
  {
    name: 'idx_wiki_revisions_summary_search',
    table: 'wiki_revisions',
    columns: 'summary, page_id, revision_timestamp DESC',
    description: 'Speed up summary-based searches',
  },

  // Size-based filtering for productivity analysis
  {
    name: 'idx_wiki_revisions_size_filter',
    table: 'wiki_revisions',
    columns: 'page_id, size_bytes, revision_timestamp DESC',
    description: 'Optimize size change filtering queries',
  },

  // Date range queries (very common for individual productivity)
  {
    name: 'idx_wiki_revisions_date_range',
    table: 'wiki_revisions',
    columns: 'revision_timestamp, page_id, author_id',
    description: 'Optimize date range filtering for productivity tracking',
  },

  // Session analysis support (group by time periods)
  {
    name: 'idx_wiki_revisions_session_analysis',
    table: 'wiki_revisions',
    columns: 'author_id, page_id, revision_timestamp, size_bytes',
    description: 'Support session grouping and productivity analysis',
  },

  // Minor edit filtering
  {
    name: 'idx_wiki_revisions_major_changes',
    table: 'wiki_revisions',
    columns: 'page_id, is_minor, revision_timestamp DESC',
    description: 'Quick filtering of major vs minor changes',
  },
];

// Function to check if index exists
function indexExists(name) {
  const result = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`)
    .get(name);
  return !!result;
}

// Function to check if table exists
function tableExists(tableName) {
  const result = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(tableName);
  return !!result;
}

// Add revision-specific indexes
let created = 0;
let skipped = 0;
let failed = 0;

for (const index of revisionIndexes) {
  // Check if table exists
  if (!tableExists(index.table)) {
    console.log(`⚠️  Skipping ${index.name} - table ${index.table} does not exist`);
    skipped++;
    continue;
  }

  // Check if index already exists
  if (indexExists(index.name)) {
    console.log(`✓ ${index.name} already exists`);
    skipped++;
    continue;
  }

  try {
    const sql = `CREATE INDEX IF NOT EXISTS ${index.name} ON ${index.table}(${index.columns})`;

    console.log(`Creating ${index.name}...`);
    const startTime = Date.now();

    db.prepare(sql).run();

    const duration = Date.now() - startTime;
    console.log(`✅ Created ${index.name} in ${duration}ms - ${index.description}`);
    created++;
  } catch (error) {
    console.error(`❌ Failed to create ${index.name}: ${error.message}`);
    failed++;
  }
}

// Analyze wiki_revisions table to update statistics
console.log('\n=== Analyzing wiki_revisions table ===\n');
try {
  const analyzeStart = Date.now();
  db.prepare(`ANALYZE wiki_revisions`).run();
  const analyzeDuration = Date.now() - analyzeStart;
  console.log(`✓ Analyzed wiki_revisions table in ${analyzeDuration}ms`);
} catch (error) {
  console.error(`⚠️  Failed to analyze wiki_revisions: ${error.message}`);
}

// Show current index statistics for wiki_revisions
console.log('\n=== Wiki Revisions Index Statistics ===\n');
const revisionIndexes_current = db
  .prepare(
    `SELECT name, sql FROM sqlite_master 
     WHERE type = 'index' 
       AND tbl_name = 'wiki_revisions'
       AND name NOT LIKE 'sqlite_%'
     ORDER BY name`
  )
  .all();

console.log(`Wiki Revisions Table: ${revisionIndexes_current.length} custom indexes`);
for (const idx of revisionIndexes_current) {
  console.log(`  - ${idx.name}`);
  // Show the SQL for new indexes
  if (
    idx.name.includes('author_time') ||
    idx.name.includes('session_analysis') ||
    idx.name.includes('date_range') ||
    idx.name.includes('size_filter')
  ) {
    console.log(`    SQL: ${idx.sql}`);
  }
}

// Performance test with sample queries
console.log('\n=== Performance Test Sample Queries ===\n');

// Test individual author queries
try {
  const authorQueryStart = Date.now();
  const authorQuery = db.prepare(`
    SELECT COUNT(*) as count 
    FROM wiki_revisions 
    WHERE author_id = 1 
      AND revision_timestamp >= datetime('now', '-7 days')
  `);
  const authorResult = authorQuery.get();
  const authorDuration = Date.now() - authorQueryStart;
  console.log(
    `✓ Author productivity query: ${authorResult.count} revisions in ${authorDuration}ms`
  );
} catch (error) {
  console.log(`⚠️  Author query test skipped: ${error.message}`);
}

// Test page revision queries
try {
  const pageQueryStart = Date.now();
  const pageQuery = db.prepare(`
    SELECT COUNT(*) as count 
    FROM wiki_revisions r
    LEFT JOIN users u ON r.author_id = u.id
    WHERE r.page_id = 1 
    ORDER BY r.revision_timestamp DESC 
    LIMIT 20
  `);
  const pageResult = pageQuery.get();
  const pageDuration = Date.now() - pageQueryStart;
  console.log(`✓ Page revision history query: ${pageResult.count} results in ${pageDuration}ms`);
} catch (error) {
  console.log(`⚠️  Page query test skipped: ${error.message}`);
}

// Test date range queries
try {
  const dateQueryStart = Date.now();
  const dateQuery = db.prepare(`
    SELECT COUNT(*) as count 
    FROM wiki_revisions 
    WHERE revision_timestamp >= datetime('now', '-30 days')
      AND revision_timestamp <= datetime('now')
  `);
  const dateResult = dateQuery.get();
  const dateDuration = Date.now() - dateQueryStart;
  console.log(`✓ Date range query: ${dateResult.count} revisions in ${dateDuration}ms`);
} catch (error) {
  console.log(`⚠️  Date range query test skipped: ${error.message}`);
}

db.close();

console.log('\n=== Optimization Summary ===\n');
console.log(`✅ Created: ${created} new revision indexes`);
console.log(`⏭️  Skipped: ${skipped} (already exist or table missing)`);
console.log(`❌ Failed: ${failed}`);

if (created > 0) {
  console.log('\n🎯 Individual productivity query performance should be significantly improved!');
  console.log('Key improvements:');
  console.log('  - Personal revision history browsing');
  console.log('  - Session-based productivity analysis');
  console.log('  - Date range filtering for time-based insights');
  console.log('  - Content size change tracking');
  console.log('  - Major vs minor edit filtering');
}

console.log('\n✨ Revision database optimization complete!');
