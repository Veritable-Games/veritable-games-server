/**
 * Initialize Project Revisions Table in content.db
 *
 * Creates a standalone revision system for projects completely separate from wiki.db
 * This script ensures projects have their own revision history in content.db only.
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/content.db');

function initializeProjectRevisions() {
  console.log('🔧 Initializing project revisions table...');

  const db = new Database(DB_PATH);

  try {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create project_revisions table
    console.log('Creating project_revisions table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_slug TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        author_id INTEGER,
        author_name TEXT NOT NULL,
        revision_timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        size_bytes INTEGER NOT NULL,
        is_minor INTEGER DEFAULT 0,
        content_format TEXT DEFAULT 'markdown',

        FOREIGN KEY (project_slug) REFERENCES projects(slug) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    console.log('Creating indexes...');

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_project_revisions_project_slug
        ON project_revisions(project_slug)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_project_revisions_timestamp
        ON project_revisions(revision_timestamp DESC)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_project_revisions_author
        ON project_revisions(author_id)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_project_revisions_project_timestamp
        ON project_revisions(project_slug, revision_timestamp DESC)
    `);

    // Create trigger to auto-update projects.updated_at when revision is created
    console.log('Creating triggers...');
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_project_on_revision
      AFTER INSERT ON project_revisions
      FOR EACH ROW
      BEGIN
        UPDATE projects
        SET
          content = NEW.content,
          updated_at = NEW.revision_timestamp
        WHERE slug = NEW.project_slug;
      END
    `);

    // Verify table was created
    const tableCheck = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='project_revisions'
    `
      )
      .get();

    if (tableCheck) {
      console.log('✅ project_revisions table created successfully');

      // Show table info
      const columns = db.prepare(`PRAGMA table_info(project_revisions)`).all();
      console.log('\n📋 Table structure:');
      columns.forEach(col => {
        console.log(
          `  - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`
        );
      });

      // Show indexes
      const indexes = db.prepare(`PRAGMA index_list(project_revisions)`).all();
      console.log('\n🔍 Indexes created:');
      indexes.forEach(idx => {
        console.log(`  - ${idx.name}`);
      });

      // Show triggers
      const triggers = db
        .prepare(
          `
        SELECT name FROM sqlite_master
        WHERE type='trigger' AND tbl_name='project_revisions'
      `
        )
        .all();
      console.log('\n⚡ Triggers created:');
      triggers.forEach(trigger => {
        console.log(`  - ${trigger.name}`);
      });

      // Count existing projects
      const projectCount = db.prepare(`SELECT COUNT(*) as count FROM projects`).get();
      console.log(`\n📊 Ready to track revisions for ${projectCount.count} projects`);
    } else {
      console.error('❌ Failed to create project_revisions table');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error initializing project revisions:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    db.close();
  }

  console.log('\n✨ Project revisions system initialized successfully!');
}

// Run if called directly
if (require.main === module) {
  initializeProjectRevisions();
}

module.exports = { initializeProjectRevisions };
