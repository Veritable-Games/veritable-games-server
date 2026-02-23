-- PostgreSQL Schema Conversion Template
-- Use this as a reference when converting SQLite schemas to PostgreSQL

-- ============================================================================
-- 1. SCHEMA CREATION
-- ============================================================================

-- Create schema (namespace) for this database
CREATE SCHEMA IF NOT EXISTS schema_name;

-- Set search path (optional, for convenience)
SET search_path TO schema_name, public;


-- ============================================================================
-- 2. TYPE CONVERSIONS
-- ============================================================================

-- SQLite → PostgreSQL Type Mapping:
--
-- INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY or BIGSERIAL
-- INTEGER                           → INTEGER or BIGINT
-- TEXT                             → TEXT or VARCHAR(n) [use VARCHAR for bounded]
-- REAL                             → REAL or DOUBLE PRECISION or NUMERIC
-- BLOB                             → BYTEA
-- DATETIME                         → TIMESTAMP or TIMESTAMPTZ
-- BOOLEAN (0/1 in SQLite)          → BOOLEAN (true/false)
-- NULL                             → NULL (same)


-- ============================================================================
-- 3. TABLE CREATION EXAMPLES
-- ============================================================================

-- Example 1: Simple table with auto-increment
-- SQLite:
-- CREATE TABLE users (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     username TEXT NOT NULL UNIQUE,
--     email TEXT NOT NULL,
--     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
-- );

-- PostgreSQL:
CREATE TABLE schema_name.users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);


-- Example 2: Table with foreign key
-- SQLite:
-- CREATE TABLE posts (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     user_id INTEGER NOT NULL,
--     title TEXT NOT NULL,
--     content TEXT,
--     is_published INTEGER DEFAULT 0,
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- );

-- PostgreSQL:
CREATE TABLE schema_name.posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_posts_user FOREIGN KEY (user_id)
        REFERENCES schema_name.users(id)
        ON DELETE CASCADE
);


-- Example 3: Table with JSON data
-- SQLite (TEXT with JSON):
-- CREATE TABLE settings (
--     key TEXT PRIMARY KEY,
--     value TEXT,  -- JSON stored as TEXT
--     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
-- );

-- PostgreSQL (native JSONB):
CREATE TABLE schema_name.settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB,  -- Native JSON support with indexing
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add GIN index for JSONB queries
CREATE INDEX idx_settings_value_gin ON schema_name.settings USING GIN (value);


-- ============================================================================
-- 4. INDEXES
-- ============================================================================

-- Simple index
CREATE INDEX idx_users_username ON schema_name.users(username);

-- Unique index
CREATE UNIQUE INDEX idx_users_email ON schema_name.users(email);

-- Composite index
CREATE INDEX idx_posts_user_published ON schema_name.posts(user_id, is_published);

-- Partial index (PostgreSQL-specific optimization)
CREATE INDEX idx_posts_published ON schema_name.posts(created_at)
WHERE is_published = true;

-- Full-text search index (GIN)
CREATE INDEX idx_posts_search ON schema_name.posts USING GIN(search_vector);


-- ============================================================================
-- 5. FULL-TEXT SEARCH CONVERSION
-- ============================================================================

-- SQLite FTS5:
-- CREATE VIRTUAL TABLE post_search USING fts5(
--     post_id UNINDEXED,
--     title,
--     content
-- );

-- PostgreSQL (tsvector with generated column):
CREATE TABLE schema_name.posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'B')
    ) STORED
);

CREATE INDEX idx_posts_search ON schema_name.posts USING GIN(search_vector);

-- Search query example:
-- SELECT * FROM schema_name.posts
-- WHERE search_vector @@ to_tsquery('english', 'search & term')
-- ORDER BY ts_rank(search_vector, to_tsquery('english', 'search & term')) DESC;


-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

-- Updated_at trigger (common pattern)
CREATE OR REPLACE FUNCTION schema_name.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_updated_at
BEFORE UPDATE ON schema_name.posts
FOR EACH ROW
EXECUTE FUNCTION schema_name.update_updated_at();


-- Audit trigger example
CREATE TABLE schema_name.audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL,  -- INSERT, UPDATE, DELETE
    user_id INTEGER,
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMP DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION schema_name.audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO schema_name.audit_log (table_name, operation, old_data)
        VALUES (TG_TABLE_NAME, 'DELETE', row_to_json(OLD));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO schema_name.audit_log (table_name, operation, old_data, new_data)
        VALUES (TG_TABLE_NAME, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO schema_name.audit_log (table_name, operation, new_data)
        VALUES (TG_TABLE_NAME, 'INSERT', row_to_json(NEW));
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables you want to audit
CREATE TRIGGER audit_users
AFTER INSERT OR UPDATE OR DELETE ON schema_name.users
FOR EACH ROW EXECUTE FUNCTION schema_name.audit_trigger();


-- ============================================================================
-- 7. VIEWS
-- ============================================================================

-- Materialized view (cached, must be refreshed)
CREATE MATERIALIZED VIEW schema_name.user_stats AS
SELECT
    u.id,
    u.username,
    COUNT(p.id) as post_count,
    MAX(p.created_at) as last_post_at
FROM schema_name.users u
LEFT JOIN schema_name.posts p ON p.user_id = u.id
GROUP BY u.id, u.username;

-- Create unique index for faster refresh
CREATE UNIQUE INDEX idx_user_stats_id ON schema_name.user_stats(id);

-- Refresh command:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY schema_name.user_stats;


-- Regular view (dynamic query)
CREATE VIEW schema_name.active_users AS
SELECT *
FROM schema_name.users
WHERE created_at > NOW() - INTERVAL '30 days';


-- ============================================================================
-- 8. CONSTRAINTS
-- ============================================================================

-- Check constraints
ALTER TABLE schema_name.posts
ADD CONSTRAINT chk_title_length CHECK (length(title) >= 3);

ALTER TABLE schema_name.users
ADD CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$');

-- Foreign key with ON DELETE options
ALTER TABLE schema_name.posts
ADD CONSTRAINT fk_posts_user
FOREIGN KEY (user_id) REFERENCES schema_name.users(id)
ON DELETE CASCADE  -- Delete posts when user deleted
ON UPDATE CASCADE; -- Update post.user_id when users.id changes


-- ============================================================================
-- 9. SEQUENCES
-- ============================================================================

-- Manual sequence creation (SERIAL does this automatically)
CREATE SEQUENCE schema_name.custom_id_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Use in table
CREATE TABLE schema_name.custom_table (
    id INTEGER PRIMARY KEY DEFAULT nextval('schema_name.custom_id_seq'),
    name VARCHAR(255)
);

-- Reset sequence after data import
SELECT setval('schema_name.custom_id_seq', (SELECT MAX(id) FROM schema_name.custom_table));


-- ============================================================================
-- 10. DATE/TIME FUNCTIONS
-- ============================================================================

-- SQLite → PostgreSQL equivalents:

-- Current timestamp
-- SQLite: datetime('now') or CURRENT_TIMESTAMP
-- PostgreSQL: NOW() or CURRENT_TIMESTAMP

-- Date arithmetic
-- SQLite: date('now', '-7 days')
-- PostgreSQL: NOW() - INTERVAL '7 days'

-- Extract parts
-- SQLite: strftime('%Y', created_at)
-- PostgreSQL: EXTRACT(YEAR FROM created_at) or date_part('year', created_at)

-- Format dates
-- SQLite: strftime('%Y-%m-%d', created_at)
-- PostgreSQL: to_char(created_at, 'YYYY-MM-DD')


-- ============================================================================
-- 11. COMMON QUERY PATTERNS
-- ============================================================================

-- Pagination
SELECT * FROM schema_name.posts
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;

-- Conditional aggregation
SELECT
    user_id,
    COUNT(*) FILTER (WHERE is_published = true) as published_count,
    COUNT(*) FILTER (WHERE is_published = false) as draft_count
FROM schema_name.posts
GROUP BY user_id;

-- JSON queries (PostgreSQL-specific)
SELECT * FROM schema_name.settings
WHERE value->>'enabled' = 'true'
AND (value->'config'->>'max_users')::INTEGER > 100;

-- Array operations (PostgreSQL-specific)
CREATE TABLE schema_name.tags (
    post_id INTEGER,
    tags TEXT[]  -- Array of tags
);

-- Query array contains
SELECT * FROM schema_name.tags
WHERE 'postgresql' = ANY(tags);

-- Array aggregate
SELECT post_id, array_agg(tag_name) as tags
FROM schema_name.post_tags
GROUP BY post_id;


-- ============================================================================
-- 12. PERMISSIONS (Optional)
-- ============================================================================

-- Create role for application
CREATE ROLE app_user WITH LOGIN PASSWORD 'secure_password';

-- Grant schema access
GRANT USAGE ON SCHEMA schema_name TO app_user;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA schema_name TO app_user;

-- Grant sequence permissions (for SERIAL columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA schema_name TO app_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA schema_name
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;


-- ============================================================================
-- 13. OPTIMIZATION TIPS
-- ============================================================================

-- Analyze tables after bulk insert
ANALYZE schema_name.posts;

-- Vacuum to reclaim space
VACUUM ANALYZE schema_name.posts;

-- Create statistics for query planner
CREATE STATISTICS schema_name.posts_stats (dependencies)
ON user_id, created_at FROM schema_name.posts;

-- Explain query plan
EXPLAIN ANALYZE
SELECT * FROM schema_name.posts
WHERE user_id = 123
ORDER BY created_at DESC
LIMIT 20;


-- ============================================================================
-- 14. MIGRATION CHECKLIST
-- ============================================================================

-- [ ] Schema created
-- [ ] All tables converted
-- [ ] Primary keys defined
-- [ ] Foreign keys defined
-- [ ] Indexes created
-- [ ] Full-text search configured
-- [ ] Triggers created
-- [ ] Views created
-- [ ] Constraints added
-- [ ] Sequences reset
-- [ ] Permissions granted
-- [ ] Data imported
-- [ ] Verify record counts
-- [ ] Test queries
-- [ ] Performance benchmarks
