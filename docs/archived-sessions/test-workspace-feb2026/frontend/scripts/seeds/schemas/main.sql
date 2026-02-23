-- Schema export from main.db
-- Generated: 2025-10-28T19:14:12.604Z
-- SQLite version: 0

CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at);

CREATE INDEX idx_contact_messages_status ON contact_messages(status);

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

CREATE INDEX idx_project_revisions_slug
    ON project_revisions(project_slug);

CREATE INDEX idx_project_revisions_timestamp
    ON project_revisions(project_slug, revision_timestamp DESC);

CREATE INDEX idx_project_sections_order ON project_sections(project_slug, display_order);

CREATE INDEX idx_project_sections_project ON project_sections(project_slug);

CREATE INDEX idx_unified_activity_entity ON unified_activity(entity_type, entity_id);

CREATE INDEX idx_unified_activity_timestamp ON unified_activity(timestamp DESC);

CREATE INDEX idx_unified_activity_type ON unified_activity(activity_type);

CREATE INDEX idx_unified_activity_user ON unified_activity(user_id);

CREATE INDEX idx_user_data_exports_created_at ON user_data_exports(created_at);

CREATE INDEX idx_user_data_exports_status ON user_data_exports(status);

CREATE INDEX idx_user_data_exports_user_id ON user_data_exports(user_id);

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

CREATE INDEX idx_wiki_page_links_source ON wiki_page_links(source_page_id);

CREATE INDEX idx_wiki_page_links_target ON wiki_page_links(target_slug);

CREATE INDEX idx_wiki_page_links_target_page ON wiki_page_links(target_page_id);

CREATE INDEX idx_wiki_page_views_date ON wiki_page_views(view_date);

CREATE INDEX idx_wiki_page_views_page ON wiki_page_views(page_id);

CREATE INDEX idx_wiki_page_views_page_date ON wiki_page_views(page_id, view_date);

CREATE INDEX idx_wiki_pages_created_by ON wiki_pages(created_by);

CREATE INDEX idx_wiki_pages_namespace ON wiki_pages(namespace);

CREATE INDEX idx_wiki_pages_project ON wiki_pages(project_slug);

CREATE INDEX idx_wiki_pages_slug ON wiki_pages(slug);

CREATE INDEX idx_wiki_pages_status ON wiki_pages(status);

CREATE INDEX idx_wiki_pages_template ON wiki_pages(template_type);

CREATE INDEX idx_wiki_pages_updated ON wiki_pages(updated_at DESC);

CREATE INDEX idx_wiki_revisions_author ON wiki_revisions(author_id);

CREATE INDEX idx_wiki_revisions_page_timestamp ON wiki_revisions(page_id, revision_timestamp DESC);

CREATE INDEX idx_wiki_revisions_timestamp ON wiki_revisions(revision_timestamp DESC);

CREATE INDEX idx_wiki_tags_name ON wiki_tags(name);

CREATE INDEX idx_wiki_tags_usage ON wiki_tags(usage_count DESC);

CREATE INDEX idx_wiki_templates_active ON wiki_templates(is_active);

CREATE INDEX idx_wiki_templates_category ON wiki_templates(category);

CREATE INDEX idx_wiki_templates_name ON wiki_templates(name);

CREATE INDEX idx_wiki_templates_type ON wiki_templates(type);

CREATE TABLE commission_credits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL,
    client_name TEXT NOT NULL,
    project_type TEXT NOT NULL,
    year INTEGER NOT NULL,
    description TEXT,
    url TEXT,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE contact_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'archived')),
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        read_at DATETIME,
        replied_at DATETIME
      );

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

CREATE TABLE conversation_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(conversation_id, user_id)
    );

CREATE TABLE conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_archived BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
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

CREATE TABLE heap_dump_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        reason TEXT,
        file_size_mb REAL,
        memory_before_rss INTEGER,
        memory_before_heap INTEGER,
        created_at INTEGER DEFAULT (unixepoch())
      );

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
    document_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (document_id, tag_id),
    FOREIGN KEY (document_id) REFERENCES library_documents(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES library_tags(id) ON DELETE CASCADE
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

CREATE TABLE memory_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        current_value REAL NOT NULL,
        threshold_value REAL NOT NULL,
        action_required TEXT NOT NULL,
        suggested_actions TEXT,
        acknowledged INTEGER DEFAULT 0,
        resolved INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT (unixepoch()),
        created_at INTEGER DEFAULT (unixepoch())
      );

CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      message_type TEXT DEFAULT 'text',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      edited_at DATETIME NULL,
      is_deleted BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE TABLE news_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    summary TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published')),
    featured_image TEXT,
    tags TEXT,
    views INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('message', 'follow', 'friend_request', 'mention', 'system')),
      title TEXT NOT NULL,
      content TEXT,
      entity_type TEXT, -- 'user', 'message', 'post', etc.
      entity_id INTEGER,
      action_url TEXT, -- URL to navigate to when clicked
      read_status BOOLEAN DEFAULT FALSE,
      priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME, -- Optional expiration for temporary notifications
      metadata TEXT -- JSON for additional notification data
    );

CREATE TABLE page_tags (
        page_id INTEGER,
        tag_id INTEGER,
        PRIMARY KEY (page_id, tag_id),
        FOREIGN KEY (page_id) REFERENCES wiki_pages(id),
        FOREIGN KEY (tag_id) REFERENCES tags(id)
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

CREATE TABLE project_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_slug TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT NOT NULL,
      author_id INTEGER,
      author_name TEXT NOT NULL,
      revision_timestamp INTEGER NOT NULL,
      size_bytes INTEGER,
      FOREIGN KEY (project_slug) REFERENCES projects(slug) ON DELETE CASCADE
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

CREATE TABLE projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        color TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        is_universal_system BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      , content TEXT);

CREATE TABLE resource_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      resource_type TEXT NOT NULL, -- 'cpu', 'memory', 'disk', 'network'
      metric_name TEXT NOT NULL, -- 'usage_percent', 'total_mb', 'free_mb', 'read_ops', 'write_ops'
      current_value REAL NOT NULL,
      max_value REAL,
      unit TEXT NOT NULL,
      node_id TEXT DEFAULT 'main', -- for future multi-node support
      process_id INTEGER,
      details TEXT, -- JSON string with additional metrics
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

CREATE TABLE settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'general',
      type TEXT DEFAULT 'text' CHECK(type IN ('text', 'number', 'boolean', 'json')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE site_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_by INTEGER,
            FOREIGN KEY (updated_by) REFERENCES users(id)
          );

CREATE TABLE sqlite_sequence(name,seq);

CREATE TABLE sqlite_stat1(tbl,idx,stat);

CREATE TABLE sqlite_stat4(tbl,idx,neq,nlt,ndlt,sample);

CREATE TABLE system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        type TEXT DEFAULT 'string',
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER,
        UNIQUE(category, key)
      );

CREATE TABLE tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        color TEXT DEFAULT '#6B7280',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

CREATE TABLE team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    role TEXT NOT NULL,
    summary TEXT NOT NULL,
    image_url TEXT,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE unified_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        activity_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        metadata TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

CREATE TABLE user_data_exports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        request_type TEXT NOT NULL DEFAULT 'full' CHECK (request_type IN ('full', 'forums', 'wiki', 'library', 'activity')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        file_path TEXT,
        file_size INTEGER,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        error_message TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

CREATE TABLE user_privacy_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        profile_visibility TEXT DEFAULT 'public',
        activity_visibility TEXT DEFAULT 'public',
        email_visibility TEXT DEFAULT 'private',
        show_online_status BOOLEAN DEFAULT TRUE,
        show_last_active BOOLEAN DEFAULT TRUE,
        allow_friend_requests BOOLEAN DEFAULT TRUE,
        allow_messages BOOLEAN DEFAULT TRUE,
        show_reputation_details BOOLEAN DEFAULT TRUE,
        show_forum_activity BOOLEAN DEFAULT TRUE,
        show_wiki_activity BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CHECK (profile_visibility IN ('public', 'members', 'friends', 'private')),
        CHECK (activity_visibility IN ('public', 'members', 'friends', 'private')),
        CHECK (email_visibility IN ('public', 'members', 'admin', 'private'))
      );

CREATE TABLE user_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        permissions TEXT NOT NULL,
        hierarchy_level INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      , location TEXT, website_url TEXT, github_url TEXT, mastodon_url TEXT, linkedin_url TEXT, discord_username TEXT, profile_visibility TEXT DEFAULT "public", activity_privacy TEXT DEFAULT "public", email_visibility TEXT DEFAULT "private", show_online_status BOOLEAN DEFAULT TRUE, allow_messages BOOLEAN DEFAULT TRUE, two_factor_enabled BOOLEAN DEFAULT FALSE, email_verified BOOLEAN DEFAULT FALSE, last_login_at DATETIME, login_count INTEGER DEFAULT 0, steam_url TEXT, xbox_gamertag TEXT, psn_id TEXT, updated_at DATETIME, avatar_position_x REAL DEFAULT 50, avatar_position_y REAL DEFAULT 50, avatar_scale REAL DEFAULT 100, bluesky_url TEXT, follower_count INTEGER DEFAULT 0, following_count INTEGER DEFAULT 0, friend_count INTEGER DEFAULT 0, message_count INTEGER DEFAULT 0, last_seen DATETIME, privacy_settings TEXT DEFAULT '{}');

CREATE TABLE wiki_categories (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#6B7280',
        icon TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES wiki_categories(id)
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

CREATE TABLE wiki_revisions (
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
        FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id)
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
      );

CREATE TABLE wiki_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT 'infobox',
        category TEXT,
        schema_definition TEXT NOT NULL,
        default_data TEXT,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id),
        CHECK (type IN ('infobox', 'template', 'notice'))
      );