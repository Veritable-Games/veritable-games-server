-- Schema export from wiki.db
-- Generated: 2025-10-28T19:14:12.588Z
-- SQLite version: 0

CREATE INDEX idx_content_references_source ON content_references(source_type, source_id);

CREATE INDEX idx_content_references_target ON content_references(target_type, target_id);

CREATE INDEX idx_forum_replies_parent ON forum_replies(parent_id);

CREATE INDEX idx_forum_replies_topic ON forum_replies(topic_id);

CREATE INDEX idx_forum_replies_user ON forum_replies(user_id);

CREATE INDEX idx_forum_topics_category ON forum_topics(category_id);

CREATE INDEX idx_forum_topics_updated ON forum_topics(updated_at DESC);

CREATE INDEX idx_forum_topics_user ON forum_topics(user_id);

CREATE INDEX idx_forum_wiki_ref_forum ON forum_wiki_references(forum_topic_id);

CREATE INDEX idx_forum_wiki_ref_wiki ON forum_wiki_references(wiki_page_id);

CREATE INDEX idx_project_metadata_order ON project_metadata(display_order);

CREATE INDEX idx_project_metadata_status ON project_metadata(status);

CREATE INDEX idx_project_sections_order ON project_sections(project_slug, display_order);

CREATE INDEX idx_project_sections_project ON project_sections(project_slug);

CREATE INDEX idx_unified_activity_entity ON unified_activity(entity_type, entity_id);

CREATE INDEX idx_unified_activity_timestamp ON unified_activity(timestamp DESC);

CREATE INDEX idx_unified_activity_type ON unified_activity(activity_type);

CREATE INDEX idx_unified_activity_user ON unified_activity(user_id);

CREATE INDEX idx_user_permissions_entity ON user_permissions(entity_type, entity_id);

CREATE INDEX idx_user_permissions_type ON user_permissions(permission_type);

CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);

CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);

CREATE INDEX idx_users_active ON users(is_active);

CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_users_role ON users(role);

CREATE INDEX idx_users_username ON users(username);

CREATE INDEX idx_wiki_categories_parent ON wiki_categories(parent_id);

CREATE INDEX idx_wiki_categories_sort ON wiki_categories(sort_order);

CREATE INDEX idx_wiki_infoboxes_active ON wiki_infoboxes(is_active);

CREATE INDEX idx_wiki_infoboxes_page ON wiki_infoboxes(page_id);

CREATE INDEX idx_wiki_infoboxes_template ON wiki_infoboxes(template_id);

CREATE INDEX idx_wiki_page_categories ON wiki_page_categories(category_id, page_id);

CREATE INDEX idx_wiki_page_links_source ON wiki_page_links(source_page_id);

CREATE INDEX idx_wiki_page_links_target ON wiki_page_links(target_slug);

CREATE INDEX idx_wiki_page_links_target_page ON wiki_page_links(target_page_id);

CREATE INDEX idx_wiki_page_tags ON wiki_page_tags(tag_id, page_id);

CREATE INDEX idx_wiki_page_tags_tag_page ON wiki_page_tags (tag_id, page_id);

CREATE INDEX idx_wiki_page_views_date ON wiki_page_views(view_date);

CREATE INDEX idx_wiki_page_views_page ON wiki_page_views(page_id);

CREATE INDEX idx_wiki_page_views_page_date ON wiki_page_views(page_id, view_date);

CREATE INDEX idx_wiki_page_views_page_date_views ON wiki_page_views (page_id, view_date, view_count DESC);

CREATE INDEX idx_wiki_pages_category_updated ON wiki_pages (category_id, updated_at DESC);

CREATE INDEX idx_wiki_pages_created_by ON wiki_pages(created_by);

CREATE INDEX idx_wiki_pages_namespace ON wiki_pages(namespace);

CREATE INDEX idx_wiki_pages_namespace_status_updated ON wiki_pages(namespace, status, updated_at DESC);

CREATE INDEX idx_wiki_pages_namespace_title ON wiki_pages (namespace, title);

CREATE INDEX idx_wiki_pages_project ON wiki_pages(project_slug);

CREATE INDEX idx_wiki_pages_slug ON wiki_pages(slug);

CREATE INDEX idx_wiki_pages_slug_namespace ON wiki_pages(slug, namespace);

CREATE INDEX idx_wiki_pages_status ON wiki_pages(status);

CREATE INDEX idx_wiki_pages_template ON wiki_pages(template_type);

CREATE INDEX idx_wiki_pages_template_type ON wiki_pages(template_type);

CREATE INDEX idx_wiki_pages_title_search ON wiki_pages(title, is_deleted);

CREATE INDEX idx_wiki_pages_updated ON wiki_pages(updated_at DESC);

CREATE INDEX idx_wiki_revisions_author ON wiki_revisions(author_id);

CREATE INDEX idx_wiki_revisions_page_timestamp ON wiki_revisions(page_id, revision_timestamp DESC);

CREATE INDEX idx_wiki_revisions_timestamp ON wiki_revisions(revision_timestamp DESC);

CREATE INDEX idx_wiki_tags_name ON wiki_tags(name);

CREATE INDEX idx_wiki_tags_usage ON wiki_tags(usage_count DESC);

CREATE INDEX idx_wiki_template_fields_order ON wiki_template_fields(template_id, display_order);

CREATE INDEX idx_wiki_template_fields_template ON wiki_template_fields(template_id);

CREATE INDEX idx_wiki_templates_active ON wiki_templates(is_active);

CREATE INDEX idx_wiki_templates_category ON wiki_templates(category);

CREATE INDEX idx_wiki_templates_name ON wiki_templates(name);

CREATE INDEX idx_wiki_templates_type ON wiki_templates(type);

CREATE TABLE content_references (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        reference_context TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (source_type IN ('project', 'wiki', 'forum')),
        CHECK (target_type IN ('project', 'wiki', 'forum'))
      );

CREATE TABLE forum_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#6B7280',
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

CREATE TABLE forum_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER NOT NULL,
        user_id INTEGER,
        content TEXT NOT NULL,
        is_solution BOOLEAN DEFAULT FALSE,
        parent_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (parent_id) REFERENCES forum_replies(id)
      );

CREATE TABLE forum_topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        category_id INTEGER,
        user_id INTEGER,
        is_pinned BOOLEAN DEFAULT FALSE,
        is_locked BOOLEAN DEFAULT FALSE,
        is_solved BOOLEAN DEFAULT FALSE,
        reply_count INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES forum_categories(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

CREATE TABLE forum_wiki_references (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        forum_topic_id INTEGER,
        wiki_page_id INTEGER,
        reference_type TEXT DEFAULT 'mention',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (forum_topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
        FOREIGN KEY (wiki_page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE
      );

CREATE TABLE project_metadata (
        project_slug TEXT PRIMARY KEY,
        main_wiki_page_id INTEGER,
        status TEXT NOT NULL,
        category TEXT NOT NULL,
        color TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        edit_locked BOOLEAN DEFAULT FALSE,
        last_major_edit DATETIME,
        content_structure TEXT, -- JSON for section organization
        FOREIGN KEY (main_wiki_page_id) REFERENCES wiki_pages(id),
        CHECK (status IN ('In Development', 'Pre-Production', 'Planning', 'Concept', 'Archive'))
      );

CREATE TABLE project_sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_slug TEXT NOT NULL,
        section_key TEXT NOT NULL,
        wiki_page_id INTEGER,
        display_order INTEGER DEFAULT 0,
        is_visible BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (project_slug) REFERENCES project_metadata(project_slug),
        FOREIGN KEY (wiki_page_id) REFERENCES wiki_pages(id),
        UNIQUE(project_slug, section_key)
      );

CREATE TABLE sqlite_sequence(name,seq);

CREATE TABLE sqlite_stat1(tbl,idx,stat);

CREATE TABLE sqlite_stat4(tbl,idx,neq,nlt,ndlt,sample);

CREATE TABLE "unified_activity" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        activity_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        metadata TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

CREATE TABLE user_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        permission_type TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        granted_by INTEGER,
        granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (granted_by) REFERENCES users(id)
      );

CREATE TABLE user_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        avatar_url TEXT,
        bio TEXT,
        role TEXT DEFAULT 'user',
        reputation INTEGER DEFAULT 0,
        post_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      );

CREATE TABLE wiki_categories (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#6B7280',
        icon TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, is_public INTEGER DEFAULT 1,
        FOREIGN KEY (parent_id) REFERENCES wiki_categories(id)
      );

CREATE TABLE wiki_infoboxes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_id INTEGER NOT NULL,
        template_id INTEGER NOT NULL,
        position TEXT DEFAULT 'top-right',
        data TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
        FOREIGN KEY (template_id) REFERENCES wiki_templates(id),
        CHECK (position IN ('top-right', 'top-left', 'bottom-right', 'bottom-left', 'inline'))
      );

CREATE TABLE wiki_page_categories (
        page_id INTEGER,
        category_id TEXT,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (page_id, category_id),
        FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES wiki_categories(id) ON DELETE CASCADE
      );

CREATE TABLE wiki_page_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_page_id INTEGER NOT NULL,
        target_slug TEXT NOT NULL,
        target_page_id INTEGER,
        link_text TEXT,
        link_context TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
        FOREIGN KEY (target_page_id) REFERENCES wiki_pages(id) ON DELETE SET NULL
      );

CREATE TABLE wiki_page_tags (
        page_id INTEGER,
        tag_id INTEGER,
        tagged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (page_id, tag_id),
        FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES wiki_tags(id) ON DELETE CASCADE
      );

CREATE TABLE wiki_page_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_id INTEGER NOT NULL,
        view_date DATE NOT NULL,
        view_count INTEGER DEFAULT 1,
        unique_visitors INTEGER DEFAULT 1,
        UNIQUE(page_id, view_date),
        FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE
      );

CREATE TABLE "wiki_pages" (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          namespace TEXT DEFAULT 'main',
          status TEXT DEFAULT 'published',
          protection_level TEXT DEFAULT 'none',
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          project_slug TEXT,
          template_type TEXT,
          is_deleted BOOLEAN DEFAULT 0,
          deleted_by INTEGER,
          deleted_at DATETIME,
          content_type TEXT DEFAULT 'page',
          document_author TEXT,
          publication_date DATE,
          download_count INTEGER DEFAULT 0,
          category_id TEXT DEFAULT 'uncategorized'
        );

CREATE TABLE "wiki_revisions" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      content_format TEXT DEFAULT 'markdown',
      author_id INTEGER,
      author_ip TEXT,
      is_minor BOOLEAN DEFAULT FALSE,
      size_bytes INTEGER,
      revision_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE
    );

CREATE VIRTUAL TABLE wiki_search USING fts5(
        title, content, tags, category,
        content='',
        contentless_delete=1
      );

CREATE TABLE 'wiki_search_config'(k PRIMARY KEY, v) WITHOUT ROWID;

CREATE TABLE 'wiki_search_data'(id INTEGER PRIMARY KEY, block BLOB);

CREATE TABLE 'wiki_search_docsize'(id INTEGER PRIMARY KEY, sz BLOB, origin INTEGER);

CREATE VIRTUAL TABLE wiki_search_fts USING fts5(
          title, content, tags,
          content=wiki_pages,
          content_rowid=id
        );

CREATE TABLE 'wiki_search_fts_config'(k PRIMARY KEY, v) WITHOUT ROWID;

CREATE TABLE 'wiki_search_fts_data'(id INTEGER PRIMARY KEY, block BLOB);

CREATE TABLE 'wiki_search_fts_docsize'(id INTEGER PRIMARY KEY, sz BLOB);

CREATE TABLE 'wiki_search_fts_idx'(segid, term, pgno, PRIMARY KEY(segid, term)) WITHOUT ROWID;

CREATE TABLE 'wiki_search_idx'(segid, term, pgno, PRIMARY KEY(segid, term)) WITHOUT ROWID;

CREATE TABLE wiki_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        color TEXT DEFAULT '#3b82f6',
        usage_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      , updated_at DATETIME);

CREATE TABLE wiki_template_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        field_type TEXT NOT NULL,
        field_label TEXT NOT NULL,
        field_description TEXT,
        is_required BOOLEAN DEFAULT FALSE,
        default_value TEXT,
        validation_rules TEXT,
        display_order INTEGER DEFAULT 0,
        FOREIGN KEY (template_id) REFERENCES wiki_templates(id) ON DELETE CASCADE,
        UNIQUE(template_id, field_name),
        CHECK (field_type IN ('text', 'textarea', 'image', 'url', 'date', 'list', 'boolean', 'number'))
      );

CREATE TABLE "wiki_templates" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'infobox',
        category TEXT,
        schema_definition TEXT NOT NULL,
        default_data TEXT,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

CREATE TRIGGER auto_categorize_immediate
        AFTER INSERT ON wiki_pages
        WHEN NEW.status = 'published'
        BEGIN
          INSERT OR IGNORE INTO wiki_page_categories (page_id, category_id, added_at)
          SELECT
            NEW.id,
            'uncategorized',
            datetime('now')
          WHERE NOT EXISTS (
            SELECT 1 FROM wiki_page_categories
            WHERE page_id = NEW.id
          );
        END;

CREATE TRIGGER auto_categorize_new_pages
        AFTER UPDATE OF status ON wiki_pages
        WHEN NEW.status = 'published' AND OLD.status != 'published'
        BEGIN
          INSERT OR IGNORE INTO wiki_page_categories (page_id, category_id, added_at)
          SELECT
            NEW.id,
            'uncategorized',
            datetime('now')
          WHERE NOT EXISTS (
            SELECT 1 FROM wiki_page_categories
            WHERE page_id = NEW.id
          );
        END;

CREATE TRIGGER auto_categorize_orphaned_pages
        AFTER DELETE ON wiki_page_categories
        WHEN NOT EXISTS (
          SELECT 1 FROM wiki_page_categories
          WHERE page_id = OLD.page_id
        )
        AND EXISTS (
          SELECT 1 FROM wiki_pages
          WHERE id = OLD.page_id AND status = 'published'
        )
        BEGIN
          INSERT INTO wiki_page_categories (page_id, category_id, added_at)
          VALUES (OLD.page_id, 'uncategorized', datetime('now'));
        END;

CREATE TRIGGER wiki_search_ad
AFTER DELETE ON wiki_pages
BEGIN
  DELETE FROM wiki_search WHERE rowid = OLD.id;
END;

CREATE TRIGGER wiki_search_ai
AFTER INSERT ON wiki_pages
BEGIN
  INSERT INTO wiki_search(rowid, title, content, tags, category)
  VALUES (
    NEW.id,
    NEW.title,
    COALESCE((SELECT content FROM wiki_revisions WHERE page_id = NEW.id ORDER BY id DESC LIMIT 1), ''),
    COALESCE((SELECT GROUP_CONCAT(wt.name, ', ') FROM wiki_page_tags wpt JOIN wiki_tags wt ON wpt.tag_id = wt.id WHERE wpt.page_id = NEW.id), ''),
    COALESCE((SELECT name FROM wiki_categories WHERE id = NEW.category_id), '')
  );
END;

CREATE TRIGGER wiki_search_au
AFTER UPDATE ON wiki_pages
BEGIN
  DELETE FROM wiki_search WHERE rowid = OLD.id;
  INSERT INTO wiki_search(rowid, title, content, tags, category)
  VALUES (
    NEW.id,
    NEW.title,
    COALESCE((SELECT content FROM wiki_revisions WHERE page_id = NEW.id ORDER BY id DESC LIMIT 1), ''),
    COALESCE((SELECT GROUP_CONCAT(wt.name, ', ') FROM wiki_page_tags wpt JOIN wiki_tags wt ON wpt.tag_id = wt.id WHERE wpt.page_id = NEW.id), ''),
    COALESCE((SELECT name FROM wiki_categories WHERE id = NEW.category_id), '')
  );
END;

CREATE TRIGGER wiki_search_revision_ai
AFTER INSERT ON wiki_revisions
BEGIN
  DELETE FROM wiki_search WHERE rowid = NEW.page_id;
  INSERT INTO wiki_search(rowid, title, content, tags, category)
  VALUES (
    NEW.page_id,
    (SELECT title FROM wiki_pages WHERE id = NEW.page_id),
    NEW.content,
    COALESCE((SELECT GROUP_CONCAT(wt.name, ', ') FROM wiki_page_tags wpt JOIN wiki_tags wt ON wpt.tag_id = wt.id WHERE wpt.page_id = NEW.page_id), ''),
    COALESCE((SELECT wc.name FROM wiki_pages wp JOIN wiki_categories wc ON wp.category_id = wc.id WHERE wp.id = NEW.page_id), '')
  );
END;