-- Schema export from system.db
-- Generated: 2025-10-28T19:14:12.600Z
-- SQLite version: 0

CREATE INDEX idx_apm_endpoint ON apm_request_metrics (endpoint);

CREATE INDEX idx_apm_status ON apm_request_metrics (status_code);

CREATE INDEX idx_apm_timestamp ON apm_request_metrics (timestamp);

CREATE INDEX idx_budgets_metric ON rum_performance_budgets(metric_name);

CREATE INDEX idx_budgets_url ON rum_performance_budgets(url_pattern);

CREATE INDEX idx_cache_timestamp ON cache_performance_metrics (timestamp);

CREATE INDEX idx_cache_type ON cache_performance_metrics (cache_type);

CREATE INDEX idx_heap_dump_logs_timestamp ON heap_dump_logs(timestamp);

CREATE INDEX idx_memory_alerts_severity ON memory_alerts(severity);

CREATE INDEX idx_memory_alerts_timestamp ON memory_alerts(timestamp);

CREATE INDEX idx_memory_metrics_timestamp ON memory_metrics(timestamp);

CREATE INDEX idx_memory_settings_key ON memory_monitoring_settings(setting_key);

CREATE INDEX idx_resource_timestamp ON resource_usage(timestamp);

CREATE INDEX idx_resource_type ON resource_usage(resource_type);

CREATE INDEX idx_rum_sessions_device ON rum_sessions(device_type);

CREATE INDEX idx_rum_sessions_timestamp ON rum_sessions(start_timestamp DESC);

CREATE INDEX idx_rum_sessions_user ON rum_sessions(user_id);

CREATE INDEX idx_sessions_created_at ON rum_sessions(created_at);

CREATE INDEX idx_system_timestamp ON system_performance_metrics (timestamp);

CREATE INDEX idx_ux_page ON user_experience_metrics (page_url);

CREATE INDEX idx_ux_timestamp ON user_experience_metrics (timestamp);

CREATE INDEX idx_ux_user ON user_experience_metrics (user_id);

CREATE INDEX idx_web_vitals_metric ON rum_web_vitals(metric_name);

CREATE INDEX idx_web_vitals_rating ON rum_web_vitals(rating);

CREATE INDEX idx_web_vitals_session ON rum_web_vitals(session_id);

CREATE INDEX idx_web_vitals_url ON rum_web_vitals(url);

CREATE TABLE apm_request_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      method TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_time_ms REAL NOT NULL,
      user_id INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      error_message TEXT,
      memory_usage INTEGER,
      cpu_usage REAL
    );

CREATE TABLE cache_performance_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      cache_type TEXT NOT NULL,
      hits INTEGER NOT NULL DEFAULT 0,
      misses INTEGER NOT NULL DEFAULT 0,
      size INTEGER DEFAULT 0,
      memory_usage INTEGER DEFAULT 0,
      evictions INTEGER DEFAULT 0
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

CREATE TABLE memory_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        process_rss INTEGER NOT NULL,
        process_heap_total INTEGER NOT NULL,
        process_heap_used INTEGER NOT NULL,
        process_external INTEGER NOT NULL,
        process_array_buffers INTEGER NOT NULL,
        system_total_mb INTEGER NOT NULL,
        system_free_mb INTEGER NOT NULL,
        system_used_mb INTEGER NOT NULL,
        system_usage_percent REAL NOT NULL,
        rss_growth_rate REAL DEFAULT 0,
        heap_growth_rate REAL DEFAULT 0,
        memory_efficiency REAL DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch())
      );

CREATE TABLE memory_monitoring_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        description TEXT,
        updated_at INTEGER DEFAULT (unixepoch()),
        created_at INTEGER DEFAULT (unixepoch())
      );

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

CREATE TABLE rum_configuration (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

CREATE TABLE rum_performance_budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_name TEXT NOT NULL,
        url_pattern TEXT NOT NULL DEFAULT '*',
        threshold_good REAL NOT NULL,
        threshold_poor REAL NOT NULL,
        alert_enabled BOOLEAN DEFAULT 1,
        alert_channel TEXT, -- 'email', 'slack', 'webhook'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        -- Unique constraint
        UNIQUE(metric_name, url_pattern)
      );

CREATE TABLE rum_sessions (
        session_id TEXT PRIMARY KEY,
        user_id TEXT,
        start_timestamp INTEGER NOT NULL,
        end_timestamp INTEGER,

        -- Session metrics
        page_count INTEGER DEFAULT 0,
        total_duration INTEGER DEFAULT 0,
        bounce_rate REAL,

        -- Device/browser info
        device_type TEXT,
        connection_type TEXT,
        user_agent TEXT,

        -- Aggregated performance
        avg_lcp REAL,
        avg_inp REAL,
        avg_cls REAL,
        avg_fcp REAL,
        avg_ttfb REAL,
        performance_score REAL,

        -- Error tracking
        error_count INTEGER DEFAULT 0,
        critical_errors INTEGER DEFAULT 0,

        -- Build context
        build_id TEXT,
        version TEXT,

        -- Indexes
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

CREATE TABLE rum_web_vitals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        metric_value REAL NOT NULL,
        rating TEXT CHECK(rating IN ('good', 'needs-improvement', 'poor')),
        url TEXT NOT NULL,
        timestamp INTEGER NOT NULL,

        -- Attribution data
        attribution_element TEXT,
        attribution_url TEXT,
        time_to_first_byte REAL,
        resource_load_time REAL,
        element_render_delay REAL,

        -- Context
        connection_effective_type TEXT,
        connection_downlink REAL,
        connection_rtt REAL,
        memory_used_js_heap INTEGER,
        memory_total_js_heap INTEGER,

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (session_id) REFERENCES rum_sessions(id)
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

CREATE TABLE sqlite_sequence(name,seq);

CREATE TABLE sqlite_stat1(tbl,idx,stat);

CREATE TABLE sqlite_stat4(tbl,idx,neq,nlt,ndlt,sample);

CREATE TABLE system_performance_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      cpu_usage REAL NOT NULL,
      memory_usage REAL NOT NULL,
      memory_total INTEGER NOT NULL,
      memory_used INTEGER NOT NULL,
      disk_usage REAL NOT NULL,
      disk_total INTEGER NOT NULL,
      disk_free INTEGER NOT NULL,
      load_average_1m REAL,
      load_average_5m REAL,
      load_average_15m REAL,
      active_connections INTEGER DEFAULT 0
    );

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

CREATE TABLE user_experience_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      user_id INTEGER,
      session_id TEXT,
      page_url TEXT NOT NULL,
      fcp REAL,
      lcp REAL,
      fid REAL,
      cls REAL,
      ttfb REAL,
      navigation_type TEXT,
      connection_type TEXT,
      device_type TEXT
    );

CREATE TABLE workflow_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        steps INTEGER,
        usage_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

CREATE TRIGGER cleanup_old_rum_data
      AFTER INSERT ON rum_web_vitals
      BEGIN
        DELETE FROM rum_web_vitals
        WHERE created_at < datetime('now', '-30 days')
        AND (SELECT COUNT(*) FROM rum_web_vitals) > 100000;

        DELETE FROM rum_resource_timings
        WHERE created_at < datetime('now', '-7 days');

        DELETE FROM rum_long_tasks
        WHERE created_at < datetime('now', '-7 days');
      END;

CREATE VIEW rum_latest_metrics AS
      SELECT
        session_id,
        page_url,
        metric_name,
        metric_value,
        rating,
        device_type,
        timestamp,
        ROW_NUMBER() OVER (PARTITION BY session_id, metric_name ORDER BY timestamp DESC) as rn
      FROM rum_metrics
      WHERE rn = 1;

CREATE VIEW rum_page_summary AS
      SELECT
        page_url,
        COUNT(DISTINCT session_id) as session_count,
        AVG(CASE WHEN metric_name = 'LCP' THEN metric_value END) as avg_lcp,
        AVG(CASE WHEN metric_name = 'INP' THEN metric_value END) as avg_inp,
        AVG(CASE WHEN metric_name = 'CLS' THEN metric_value END) as avg_cls,
        AVG(CASE WHEN metric_name = 'FCP' THEN metric_value END) as avg_fcp,
        AVG(CASE WHEN metric_name = 'TTFB' THEN metric_value END) as avg_ttfb,
        COUNT(CASE WHEN rating = 'poor' THEN 1 END) * 100.0 / COUNT(*) as poor_percentage,
        DATE(timestamp / 1000, 'unixepoch') as date
      FROM rum_metrics
      GROUP BY page_url, DATE(timestamp / 1000, 'unixepoch');

CREATE VIEW rum_performance_trends AS
      SELECT
        DATE(timestamp / 1000, 'unixepoch') as date,
        strftime('%H', datetime(timestamp / 1000, 'unixepoch')) as hour,
        metric_name,
        AVG(metric_value) as avg_value,
        COUNT(*) as sample_count
      FROM rum_metrics
      GROUP BY DATE(timestamp / 1000, 'unixepoch'), strftime('%H', datetime(timestamp / 1000, 'unixepoch')), metric_name;