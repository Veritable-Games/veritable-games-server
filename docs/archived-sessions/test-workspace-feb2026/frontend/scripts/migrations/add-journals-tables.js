/**
 * Migration: Add journals-related tables to wiki.db
 * - journal_revisions (for auto-save and version history)
 * - wiki_page_bookmarks (for quick access to favorite journals)
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/wiki.db');
const db = new Database(dbPath);

console.log('🔄 Adding journals tables to wiki.db...\n');

try {
  db.exec('BEGIN TRANSACTION');

  // Create journal_revisions table
  console.log('Creating journal_revisions table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS journal_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      revision_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_autosave BOOLEAN DEFAULT TRUE,
      session_id TEXT,
      FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id)
    )
  `);

  // Create wiki_page_bookmarks table
  console.log('Creating wiki_page_bookmarks table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS wiki_page_bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(page_id, user_id),
      FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  console.log('Creating indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_journal_revisions_page_timestamp ON journal_revisions(page_id, revision_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_journal_revisions_author ON journal_revisions(author_id);
    CREATE INDEX IF NOT EXISTS idx_journal_revisions_session ON journal_revisions(session_id);
    CREATE INDEX IF NOT EXISTS idx_journal_revisions_hash ON journal_revisions(content_hash);

    CREATE INDEX IF NOT EXISTS idx_wiki_page_bookmarks_user ON wiki_page_bookmarks(user_id);
    CREATE INDEX IF NOT EXISTS idx_wiki_page_bookmarks_page ON wiki_page_bookmarks(page_id);
  `);

  db.exec('COMMIT');

  console.log('\n✅ Migration completed successfully!');
  console.log('   - journal_revisions table created');
  console.log('   - wiki_page_bookmarks table created');
  console.log('   - All indexes created');
} catch (error) {
  db.exec('ROLLBACK');
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
