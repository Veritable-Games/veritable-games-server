-- Schema export from content.db
-- Generated: 2025-10-28T19:14:12.594Z
-- SQLite version: 0

CREATE INDEX idx_album_images_album ON reference_album_images(album_id);

CREATE INDEX idx_album_images_position ON reference_album_images(album_id, position);

CREATE INDEX idx_albums_project ON reference_albums(project_id, gallery_type);

CREATE INDEX idx_canvas_edges_elements
    ON canvas_edges(canvas_id, from_element, to_element);

CREATE INDEX idx_canvas_elements_spatial
    ON canvas_elements(canvas_id, x, y, width, height);

CREATE INDEX idx_canvas_elements_zindex
    ON canvas_elements(canvas_id, z_index);

CREATE INDEX idx_canvas_nodes_created_at
  ON canvas_nodes(created_at DESC);

CREATE INDEX idx_canvas_nodes_is_deleted
  ON canvas_nodes(is_deleted);

CREATE INDEX idx_canvas_nodes_workspace
  ON canvas_nodes(workspace_id);

CREATE INDEX idx_canvas_project
    ON canvas_documents(project_id);

CREATE INDEX idx_collab_canvas
    ON canvas_collaboration_state(canvas_id);

CREATE UNIQUE INDEX idx_collection_images_image
      ON collection_images(image_id)
    ;

CREATE INDEX idx_collection_images_order
      ON collection_images(collection_id, sort_order)
    ;

CREATE INDEX idx_collections_project
      ON reference_collections(project_id, gallery_type)
    ;

CREATE INDEX idx_connections_created_by ON node_connections(created_by);

CREATE INDEX idx_connections_source ON node_connections(source_node_id, is_deleted);

CREATE INDEX idx_connections_target ON node_connections(target_node_id, is_deleted);

CREATE INDEX idx_connections_workspace ON node_connections(workspace_id, is_deleted);

CREATE INDEX idx_gallery_images_type
      ON project_reference_images(project_id, gallery_type, is_deleted)
    ;

CREATE INDEX idx_gallery_tags_type
      ON reference_tags(project_id, gallery_type)
    ;

CREATE INDEX idx_layers_canvas
    ON canvas_layers(canvas_id, z_index);

CREATE INDEX idx_news_slug ON news(slug);

CREATE INDEX idx_project_metadata_category
  ON project_metadata(category);

CREATE INDEX idx_project_metadata_display_order
  ON project_metadata(display_order);

CREATE INDEX idx_project_metadata_status
  ON project_metadata(status);

CREATE INDEX idx_project_revisions_author
        ON project_revisions(author_id)
    ;

CREATE INDEX idx_project_revisions_project_slug
        ON project_revisions(project_slug)
    ;

CREATE INDEX idx_project_revisions_project_timestamp
        ON project_revisions(project_slug, revision_timestamp DESC)
    ;

CREATE INDEX idx_project_revisions_timestamp
        ON project_revisions(revision_timestamp DESC)
    ;

CREATE INDEX idx_project_sections_display_order
  ON project_sections(project_slug, display_order);

CREATE INDEX idx_project_sections_project_slug
  ON project_sections(project_slug);

CREATE INDEX idx_project_sections_section_key
  ON project_sections(section_key);

CREATE INDEX idx_project_sections_visibility
  ON project_sections(is_visible);

CREATE INDEX idx_projects_slug ON projects(slug);

CREATE INDEX idx_reference_categories_display_order ON reference_categories(display_order);

CREATE INDEX idx_reference_categories_name ON reference_categories(name COLLATE NOCASE);

CREATE INDEX idx_reference_categories_order
    ON reference_categories(display_order)
  ;

CREATE INDEX idx_reference_categories_visibility ON reference_categories(visibility);

CREATE INDEX idx_reference_image_tags_reference_id
      ON project_reference_image_tags(reference_id)
    ;

CREATE INDEX idx_reference_image_tags_tag_id
      ON project_reference_image_tags(tag_id)
    ;

CREATE INDEX idx_reference_images_created_at
    ON project_reference_images(created_at DESC)
  ;

CREATE INDEX idx_reference_images_deleted
    ON project_reference_images(is_deleted)
  ;

CREATE INDEX idx_reference_images_project_id
    ON project_reference_images(project_id)
  ;

CREATE INDEX idx_reference_tags_category
    ON reference_tags(category_id)
  ;

CREATE INDEX idx_reference_tags_category_id ON reference_tags(category_id);

CREATE INDEX idx_reference_tags_project_id ON reference_tags(project_id);

CREATE INDEX idx_revisions_canvas
    ON canvas_revisions(canvas_id, created_at);

CREATE INDEX idx_snapshots_timestamp
      ON workspace_snapshots(snapshot_timestamp DESC);

CREATE INDEX idx_snapshots_workspace_id
      ON workspace_snapshots(workspace_id);

CREATE INDEX idx_viewport_user ON viewport_states(user_id);

CREATE INDEX idx_viewport_workspace_user ON viewport_states(workspace_id, user_id);

CREATE INDEX idx_workspace_revisions_created_at
      ON workspace_revisions(workspace_id, created_at DESC);

CREATE INDEX idx_workspace_revisions_workspace_id
      ON workspace_revisions(workspace_id);

CREATE INDEX idx_workspaces_created_by ON "workspaces_old"(created_by);

CREATE INDEX idx_workspaces_project ON "workspaces_old"(project_slug);

CREATE INDEX idx_workspaces_project_slug
      ON "workspaces_old"(project_slug);

CREATE INDEX idx_workspaces_updated_at
      ON "workspaces_old"(updated_at DESC);

CREATE TABLE canvas_collaboration_state (
      canvas_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      cursor_x REAL,
      cursor_y REAL,
      selection TEXT, -- JSON array of selected element IDs
      color TEXT, -- User cursor color
      last_active_at INTEGER NOT NULL,
      PRIMARY KEY (canvas_id, user_id),
      FOREIGN KEY (canvas_id) REFERENCES canvas_documents(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE TABLE canvas_documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      viewport_data TEXT NOT NULL, -- JSON: {x, y, zoom, width, height}
      metadata TEXT, -- JSON: {createdBy, lastModifiedBy, etc}
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(slug) ON DELETE CASCADE
    );

CREATE TABLE canvas_edges (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL,
      from_element TEXT NOT NULL,
      to_element TEXT NOT NULL,
      from_side TEXT, -- 'top', 'right', 'bottom', 'left'
      to_side TEXT,
      type TEXT DEFAULT 'arrow', -- 'arrow', 'line', 'curve', 'elbow'
      style TEXT, -- JSON: color, thickness, dashed, etc.
      data TEXT, -- JSON: additional metadata
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (canvas_id) REFERENCES canvas_documents(id) ON DELETE CASCADE,
      FOREIGN KEY (from_element) REFERENCES canvas_elements(id) ON DELETE CASCADE,
      FOREIGN KEY (to_element) REFERENCES canvas_elements(id) ON DELETE CASCADE
    );

CREATE TABLE canvas_elements (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL,
      layer_id TEXT NOT NULL,
      type TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      rotation REAL NOT NULL DEFAULT 0,
      data TEXT NOT NULL, -- JSON: Complete element serialization
      z_index INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (canvas_id) REFERENCES canvas_documents(id) ON DELETE CASCADE,
      FOREIGN KEY (layer_id) REFERENCES canvas_layers(id) ON DELETE CASCADE
    );

CREATE TABLE canvas_layers (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL,
      name TEXT NOT NULL,
      visible INTEGER NOT NULL DEFAULT 1,
      locked INTEGER NOT NULL DEFAULT 0,
      opacity REAL NOT NULL DEFAULT 1.0,
      blend_mode TEXT NOT NULL DEFAULT 'normal',
      z_index INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (canvas_id) REFERENCES canvas_documents(id) ON DELETE CASCADE
    );

CREATE TABLE "canvas_nodes" (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,

  -- Position (canvas coordinates)
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,

  -- Size (UPDATED: Lower minimums from 100x50 to 60x30)
  width REAL NOT NULL DEFAULT 200,
  height REAL NOT NULL DEFAULT 100,

  -- Content (JSON: { title?, text, markdown?, format? })
  content TEXT NOT NULL,

  -- Visual styling (JSON: { backgroundColor?, borderColor?, ... })
  style TEXT,

  -- Metadata (JSON: { nodeType?, textScale?, ... })
  metadata TEXT,

  -- Z-index for layering
  z_index INTEGER NOT NULL DEFAULT 0,

  -- Audit fields
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Soft delete (for undo functionality)
  is_deleted INTEGER DEFAULT 0,
  deleted_at DATETIME,

  -- Constraints
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,

  -- UPDATED: Lower minimum sizes for tighter text boxes
  CHECK (width >= 60),   -- Minimum width: 60px (was 100px)
  CHECK (height >= 30)   -- Minimum height: 30px (was 50px)
);

CREATE TABLE canvas_revisions (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL,
      snapshot TEXT NOT NULL, -- JSON: full canvas state
      change_summary TEXT, -- Human-readable description
      created_by INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (canvas_id) REFERENCES canvas_documents(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

CREATE TABLE collection_images (
        collection_id TEXT NOT NULL,
        image_id TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        added_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (collection_id, image_id),
        FOREIGN KEY (collection_id) REFERENCES reference_collections(id) ON DELETE CASCADE,
        FOREIGN KEY (image_id) REFERENCES project_reference_images(id) ON DELETE CASCADE
      );

CREATE TABLE commission_credits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL,
    client_name TEXT NOT NULL,
    project_type TEXT,
    year INTEGER,
    description TEXT,
    url TEXT,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        excerpt TEXT,
        author_id INTEGER,
        published_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      , author TEXT, featured_image TEXT, tags TEXT, status TEXT DEFAULT "published", views INTEGER DEFAULT 0);

CREATE TABLE node_connections (
  id TEXT PRIMARY KEY,                    -- conn_<uuid> (ConnectionId)
  workspace_id TEXT NOT NULL,             -- FK to workspaces.id

  -- Source node and anchor
  source_node_id TEXT NOT NULL,           -- FK to canvas_nodes.id
  source_anchor_side TEXT NOT NULL,       -- 'top' | 'right' | 'bottom' | 'left' | 'center'
  source_anchor_offset REAL NOT NULL DEFAULT 0.5, -- 0.0 to 1.0 (position along side)

  -- Target node and anchor
  target_node_id TEXT NOT NULL,           -- FK to canvas_nodes.id
  target_anchor_side TEXT NOT NULL,
  target_anchor_offset REAL NOT NULL DEFAULT 0.5,

  -- Optional label
  label TEXT,

  -- Styling (optional JSON)
  -- Schema: { color?: string, width?: number, dashArray?: number[], etc. }
  style TEXT,

  -- Layering (rendered below nodes by default)
  z_index INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  metadata TEXT,

  -- Audit fields
  created_by INTEGER NOT NULL,            -- FK to users.id
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER,                     -- FK to users.id
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Soft delete
  is_deleted INTEGER DEFAULT 0,
  deleted_at DATETIME,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (source_node_id) REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_node_id) REFERENCES canvas_nodes(id) ON DELETE CASCADE,

  -- Constraints
  CHECK (source_node_id != target_node_id),                               -- No self-connections
  CHECK (source_anchor_side IN ('top', 'right', 'bottom', 'left', 'center')),
  CHECK (target_anchor_side IN ('top', 'right', 'bottom', 'left', 'center')),
  CHECK (source_anchor_offset >= 0.0 AND source_anchor_offset <= 1.0),
  CHECK (target_anchor_offset >= 0.0 AND target_anchor_offset <= 1.0)
);

CREATE TABLE project_metadata (
  project_slug TEXT PRIMARY KEY,
  main_wiki_page_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived', 'draft', 'on_hold')),
  category TEXT,
  color TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  edit_locked INTEGER NOT NULL DEFAULT 0,
  last_major_edit TEXT,
  content_structure TEXT, -- JSON metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE "project_reference_image_tags" (
        reference_id INTEGER NOT NULL,
        tag_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (reference_id, tag_id),
        FOREIGN KEY (reference_id) REFERENCES project_reference_images(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES reference_tags(id) ON DELETE CASCADE
      );

CREATE TABLE "project_reference_images" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,

      -- File metadata (no filename_original)
      filename_storage TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,

      -- Image dimensions
      width INTEGER,
      height INTEGER,
      aspect_ratio REAL,

      -- Metadata
      uploaded_by TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,

      -- Soft delete
      is_deleted INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      deleted_by TEXT,

      -- Timestamps
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')), gallery_type TEXT DEFAULT 'references' NOT NULL,

      -- Foreign keys
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

CREATE TABLE project_revisions (
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
      );

CREATE TABLE project_sections (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL,
  section_key TEXT NOT NULL,
  wiki_page_id TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_slug) REFERENCES project_metadata(project_slug) ON DELETE CASCADE,
  UNIQUE(project_slug, section_key)
);

CREATE TABLE project_workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_slug TEXT NOT NULL UNIQUE,
      scene_data TEXT NOT NULL,
      scene_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by INTEGER,
      updated_by INTEGER,
      is_locked INTEGER NOT NULL DEFAULT 0,
      checksum TEXT NOT NULL,

      FOREIGN KEY (project_slug) REFERENCES projects(slug) ON DELETE CASCADE
    );

CREATE TABLE projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      , category TEXT, color TEXT, display_order INTEGER DEFAULT 0, is_universal_system INTEGER DEFAULT 0, content TEXT);

CREATE TABLE reference_album_images (
        album_id INTEGER NOT NULL,
        image_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (album_id, image_id),
        FOREIGN KEY (album_id) REFERENCES reference_albums(id) ON DELETE CASCADE,
        FOREIGN KEY (image_id) REFERENCES project_reference_images(id) ON DELETE CASCADE,
        UNIQUE(image_id)
      );

CREATE TABLE reference_albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        gallery_type TEXT NOT NULL CHECK(gallery_type IN ('references', 'concept-art')),
        name TEXT,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

CREATE TABLE reference_categories (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'archived')),
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

CREATE TABLE reference_collections (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        gallery_type TEXT NOT NULL CHECK(gallery_type IN ('references', 'concept-art')),
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

CREATE TABLE "reference_tags" (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      project_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6B7280' CHECK (color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')), gallery_type TEXT DEFAULT 'references' NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES reference_categories(id) ON DELETE CASCADE,
      UNIQUE(project_id, category_id, name)
    );

CREATE TABLE sqlite_sequence(name,seq);

CREATE TABLE sqlite_stat1(tbl,idx,stat);

CREATE TABLE sqlite_stat4(tbl,idx,neq,nlt,ndlt,sample);

CREATE TABLE team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    title TEXT,
    role TEXT NOT NULL,
    summary TEXT,
    image_url TEXT,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE viewport_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,   -- ViewportStateId
  workspace_id TEXT NOT NULL,             -- FK to workspaces.id
  user_id INTEGER NOT NULL,               -- FK to users.id

  -- Transform data (viewport position and zoom)
  offset_x REAL NOT NULL DEFAULT 0,       -- Pan X offset
  offset_y REAL NOT NULL DEFAULT 0,       -- Pan Y offset
  scale REAL NOT NULL DEFAULT 1.0,        -- Zoom level (1.0 = 100%)

  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,

  -- One viewport state per user per workspace
  UNIQUE (workspace_id, user_id),

  -- Validate scale (0.1x to 5x zoom range)
  CHECK (scale >= 0.1 AND scale <= 5.0)
);

CREATE TABLE workspace_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      snapshot TEXT NOT NULL,
      snapshot_size_bytes INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      description TEXT,

      FOREIGN KEY (workspace_id) REFERENCES "workspaces_old"(id) ON DELETE CASCADE,
      UNIQUE(workspace_id, version)
    );

CREATE TABLE workspace_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      scene_data TEXT NOT NULL,
      scene_version INTEGER NOT NULL,
      snapshot_timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      created_by INTEGER,
      description TEXT,
      checksum TEXT NOT NULL,

      FOREIGN KEY (workspace_id) REFERENCES project_workspaces(id) ON DELETE CASCADE
    );

CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        project_slug TEXT NOT NULL UNIQUE,
        settings TEXT NOT NULL DEFAULT '{}',
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (id = project_slug)
      );

CREATE TABLE "workspaces_old" (
      id TEXT PRIMARY KEY,
      project_slug TEXT NOT NULL UNIQUE,
      version INTEGER NOT NULL DEFAULT 1,
      snapshot TEXT NOT NULL,
      snapshot_size_bytes INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_auto_save INTEGER NOT NULL DEFAULT 0,
      description TEXT,

      FOREIGN KEY (project_slug) REFERENCES projects(slug) ON DELETE CASCADE
    );

CREATE TRIGGER create_workspace_snapshot
      AFTER UPDATE OF scene_data ON project_workspaces
      FOR EACH ROW
      WHEN OLD.scene_data != NEW.scene_data
    BEGIN
      INSERT INTO workspace_snapshots (
        workspace_id,
        scene_data,
        scene_version,
        snapshot_timestamp,
        created_by,
        checksum
      ) VALUES (
        NEW.id,
        OLD.scene_data,
        OLD.scene_version,
        OLD.updated_at,
        OLD.updated_by,
        OLD.checksum
      );
    END;

CREATE TRIGGER increment_workspace_version
    AFTER UPDATE OF snapshot ON "workspaces_old"
    FOR EACH ROW
    WHEN OLD.snapshot != NEW.snapshot
    BEGIN
      UPDATE "workspaces_old"
      SET version = version + 1
      WHERE id = NEW.id;

      INSERT INTO workspace_revisions (
        workspace_id,
        version,
        snapshot,
        snapshot_size_bytes,
        created_by,
        description
      ) VALUES (
        NEW.id,
        OLD.version,
        OLD.snapshot,
        OLD.snapshot_size_bytes,
        NEW.created_by,
        'Auto-saved revision'
      );
    END;

CREATE TRIGGER limit_workspace_revisions
    AFTER INSERT ON workspace_revisions
    FOR EACH ROW
    BEGIN
      DELETE FROM workspace_revisions
      WHERE workspace_id = NEW.workspace_id
        AND id NOT IN (
          SELECT id FROM workspace_revisions
          WHERE workspace_id = NEW.workspace_id
          ORDER BY version DESC
          LIMIT 50
        );
    END;

CREATE TRIGGER node_connections_soft_delete
AFTER UPDATE OF is_deleted ON node_connections
FOR EACH ROW
WHEN NEW.is_deleted = 1 AND OLD.is_deleted = 0
BEGIN
  UPDATE node_connections SET deleted_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_canvas_documents_timestamp
    AFTER UPDATE ON canvas_documents
    FOR EACH ROW
    BEGIN
      UPDATE canvas_documents SET updated_at = (strftime('%s', 'now') * 1000) WHERE id = NEW.id;
    END;

CREATE TRIGGER update_canvas_edges_timestamp
    AFTER UPDATE ON canvas_edges
    FOR EACH ROW
    BEGIN
      UPDATE canvas_edges SET updated_at = (strftime('%s', 'now') * 1000) WHERE id = NEW.id;
    END;

CREATE TRIGGER update_canvas_elements_timestamp
    AFTER UPDATE ON canvas_elements
    FOR EACH ROW
    BEGIN
      UPDATE canvas_elements SET updated_at = (strftime('%s', 'now') * 1000) WHERE id = NEW.id;
      UPDATE canvas_documents SET updated_at = (strftime('%s', 'now') * 1000) WHERE id = NEW.canvas_id;
    END;

CREATE TRIGGER update_canvas_layers_timestamp
    AFTER UPDATE ON canvas_layers
    FOR EACH ROW
    BEGIN
      UPDATE canvas_layers SET updated_at = (strftime('%s', 'now') * 1000) WHERE id = NEW.id;
    END;

CREATE TRIGGER update_canvas_nodes_timestamp
AFTER UPDATE ON canvas_nodes
FOR EACH ROW
BEGIN
  UPDATE canvas_nodes
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TRIGGER update_node_connections_timestamp
AFTER UPDATE ON node_connections
FOR EACH ROW
BEGIN
  UPDATE node_connections SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_project_metadata_timestamp
AFTER UPDATE ON project_metadata
FOR EACH ROW
BEGIN
  UPDATE project_metadata
  SET updated_at = datetime('now')
  WHERE project_slug = NEW.project_slug;
END;

CREATE TRIGGER update_project_on_revision
      AFTER INSERT ON project_revisions
      FOR EACH ROW
      BEGIN
        UPDATE projects
        SET
          content = NEW.content,
          updated_at = NEW.revision_timestamp
        WHERE slug = NEW.project_slug;
      END;

CREATE TRIGGER update_project_sections_timestamp
AFTER UPDATE ON project_sections
FOR EACH ROW
BEGIN
  UPDATE project_sections
  SET updated_at = datetime('now')
  WHERE id = NEW.id;
END;

CREATE TRIGGER update_reference_categories_timestamp
      AFTER UPDATE ON reference_categories
      BEGIN
        UPDATE reference_categories SET updated_at = datetime('now') WHERE id = NEW.id;
      END;

CREATE TRIGGER update_viewport_states_timestamp
AFTER UPDATE ON viewport_states
FOR EACH ROW
BEGIN
  UPDATE viewport_states SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_workspace_timestamp
    AFTER UPDATE ON "workspaces_old"
    FOR EACH ROW
    BEGIN
      UPDATE "workspaces_old"
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.id;
    END;

CREATE TRIGGER update_workspaces_timestamp
AFTER UPDATE ON "workspaces_old"
FOR EACH ROW
BEGIN
  UPDATE "workspaces_old" SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE VIEW v_category_stats AS
    SELECT
      c.id as category_id,
      c.name as category_name,
      c.visibility,
      rt.project_id,
      COUNT(DISTINCT rt.id) as tag_count,
      COUNT(DISTINCT prit.reference_id) as reference_count
    FROM reference_categories c
    LEFT JOIN reference_tags rt ON c.id = rt.category_id
    LEFT JOIN project_reference_image_tags prit ON rt.id = prit.tag_id
    GROUP BY c.id, rt.project_id;

CREATE VIEW v_reference_tag_counts AS
    SELECT
      t.id as tag_id,
      t.name as tag_name,
      t.color as tag_color,
      t.project_id,
      t.category_id,
      c.name as category_name,
      COUNT(DISTINCT prit.reference_id) as usage_count
    FROM reference_tags t
    LEFT JOIN reference_categories c ON t.category_id = c.id
    LEFT JOIN project_reference_image_tags prit ON t.id = prit.tag_id
    GROUP BY t.id;