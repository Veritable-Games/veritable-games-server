-- Schema export from library.db
-- Generated: 2025-10-28T19:14:12.595Z
-- SQLite version: 0

CREATE INDEX idx_library_categories_display ON library_categories(display_order, item_count DESC, name);

CREATE INDEX idx_library_document_tags_document ON library_document_tags(document_id);

CREATE INDEX idx_library_document_tags_tag ON library_document_tags(tag_id);

CREATE INDEX idx_library_document_tags_user ON library_document_tags(added_by);

CREATE INDEX idx_library_documents_created_at
      ON library_documents(created_at DESC);

CREATE INDEX idx_library_documents_search_text ON library_documents(search_text, title, author);

CREATE INDEX idx_library_documents_slug
      ON library_documents(slug);

CREATE INDEX idx_library_documents_status_type_created ON library_documents(status, document_type, created_at DESC);

CREATE INDEX idx_library_tag_categories_type 
      ON library_tag_categories(type)
    ;

CREATE INDEX idx_library_tags_category 
      ON library_tags(category_id);

CREATE TABLE library_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        item_count INTEGER DEFAULT 0,
        display_order INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

CREATE TABLE library_document_categories (
    document_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (document_id, category_id),
    FOREIGN KEY (document_id) REFERENCES library_documents(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES library_categories(id) ON DELETE CASCADE
  );

CREATE TABLE library_document_tags (
        document_id INTEGER,
        tag_id INTEGER,
        added_by INTEGER,
        added_at DATETIME,
        PRIMARY KEY (document_id, tag_id),
        FOREIGN KEY (document_id) REFERENCES library_documents(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES library_tags(id) ON DELETE CASCADE,
        FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
      );

CREATE TABLE "library_documents" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        -- Slug for URL generation
        slug TEXT NOT NULL UNIQUE,

        -- Core metadata
        title TEXT NOT NULL,
        author TEXT,
        publication_date TEXT,
        document_type TEXT DEFAULT 'document' CHECK(document_type IN (
          'article', 'book', 'paper', 'document', 'manifesto',
          'manual', 'guide', 'reference', 'case-study', 'other'
        )),

        -- Status
        status TEXT DEFAULT 'published' CHECK(status IN (
          'draft', 'published', 'archived'
        )),

        -- Content and metadata
        description TEXT,
        abstract TEXT,
        content TEXT NOT NULL, -- Required for text documents
        language TEXT DEFAULT 'en',

        -- System fields
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        view_count INTEGER DEFAULT 0,

        -- Search optimization
        search_text TEXT, -- Concatenated searchable fields

        FOREIGN KEY (created_by) REFERENCES users(id)
      );

CREATE TABLE "library_tag_categories" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

CREATE TABLE library_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category_id INTEGER,
        description TEXT,
        usage_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES library_tag_categories(id)
      );

CREATE TABLE sqlite_sequence(name,seq);

CREATE TABLE sqlite_stat1(tbl,idx,stat);

CREATE TABLE sqlite_stat4(tbl,idx,neq,nlt,ndlt,sample);