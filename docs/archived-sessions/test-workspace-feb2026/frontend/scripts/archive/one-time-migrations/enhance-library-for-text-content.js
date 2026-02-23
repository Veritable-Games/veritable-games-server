const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../data/forums.db'));

console.log('Enhancing library system for text content support...');

try {
  // Start transaction
  db.prepare('BEGIN').run();

  // 1. Add content column to library_documents if it doesn't exist
  const columns = db.prepare('PRAGMA table_info(library_documents)').all();
  const hasContentColumn = columns.some(col => col.name === 'content');

  if (!hasContentColumn) {
    console.log('Adding content column to library_documents...');
    db.prepare(
      `
      ALTER TABLE library_documents 
      ADD COLUMN content TEXT
    `
    ).run();
    console.log('✓ Content column added');
  } else {
    console.log('✓ Content column already exists');
  }

  // 2. Add storage_type column if it doesn't exist
  const hasStorageTypeColumn = columns.some(col => col.name === 'storage_type');

  if (!hasStorageTypeColumn) {
    console.log('Adding storage_type column to library_documents...');
    db.prepare(
      `
      ALTER TABLE library_documents 
      ADD COLUMN storage_type TEXT DEFAULT 'file'
    `
    ).run();
    console.log('✓ Storage type column added');
  } else {
    console.log('✓ Storage type column already exists');
  }

  // 3. Create a new table with nullable storage_path
  console.log('Creating enhanced library_documents table with nullable storage_path...');

  // Check if enhanced table already exists
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='library_documents_enhanced'"
    )
    .all();

  if (tables.length === 0) {
    // Create new table with nullable storage_path
    db.prepare(
      `
      CREATE TABLE library_documents_enhanced (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_filename TEXT,
        storage_path TEXT,  -- Now nullable for text-only documents
        file_size INTEGER DEFAULT 0,
        mime_type TEXT,
        title TEXT NOT NULL,
        author TEXT,
        publication_date TEXT,
        document_type TEXT DEFAULT 'document',
        status TEXT DEFAULT 'published',
        description TEXT,
        abstract TEXT,
        content TEXT,  -- For storing text content directly
        storage_type TEXT DEFAULT 'file',  -- 'file', 'text', or 'hybrid'
        language TEXT DEFAULT 'en',
        page_count INTEGER,
        uploaded_by INTEGER NOT NULL,
        upload_date TEXT DEFAULT CURRENT_TIMESTAMP,
        last_modified TEXT DEFAULT CURRENT_TIMESTAMP,
        view_count INTEGER DEFAULT 0,
        download_count INTEGER DEFAULT 0,
        search_text TEXT,
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
      )
    `
    ).run();
    console.log('✓ Enhanced table created');

    // Copy existing data
    console.log('Migrating existing documents...');
    db.prepare(
      `
      INSERT INTO library_documents_enhanced 
      SELECT 
        id, filename, original_filename, storage_path, file_size, mime_type,
        title, author, publication_date, document_type, status,
        description, abstract, 
        NULL as content,  -- No content in old documents
        'file' as storage_type,  -- All existing docs are file-based
        language, page_count,
        uploaded_by, upload_date, last_modified,
        view_count, download_count, search_text
      FROM library_documents
    `
    ).run();

    const count = db.prepare('SELECT COUNT(*) as count FROM library_documents').get();
    console.log(`✓ Migrated ${count.count} documents`);

    // Rename tables
    console.log('Swapping tables...');
    db.prepare('ALTER TABLE library_documents RENAME TO library_documents_old').run();
    db.prepare('ALTER TABLE library_documents_enhanced RENAME TO library_documents').run();
    console.log('✓ Tables swapped');

    // Create indexes for performance
    console.log('Creating indexes...');
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_library_documents_title ON library_documents(title)'
    ).run();
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_library_documents_author ON library_documents(author)'
    ).run();
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_library_documents_type ON library_documents(document_type)'
    ).run();
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_library_documents_status ON library_documents(status)'
    ).run();
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_library_documents_storage_type ON library_documents(storage_type)'
    ).run();
    console.log('✓ Indexes created');
  } else {
    console.log('✓ Enhanced table already exists, skipping migration');
  }

  // Commit transaction
  db.prepare('COMMIT').run();
  console.log('\n✅ Library system successfully enhanced for text content support!');

  // Show current schema
  console.log('\nCurrent library_documents schema:');
  const newColumns = db.prepare('PRAGMA table_info(library_documents)').all();
  newColumns.forEach(col => {
    console.log(
      `  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : 'NULL'} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`
    );
  });
} catch (error) {
  console.error('Error during migration:', error);
  // Rollback transaction on error
  try {
    db.prepare('ROLLBACK').run();
    console.log('Transaction rolled back');
  } catch (rollbackError) {
    console.error('Rollback failed:', rollbackError);
  }
  process.exit(1);
} finally {
  db.close();
}
