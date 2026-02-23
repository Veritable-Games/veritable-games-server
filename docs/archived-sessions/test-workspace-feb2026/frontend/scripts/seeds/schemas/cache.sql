-- Schema export from cache.db
-- Generated: 2025-10-28T19:14:12.600Z
-- SQLite version: 0

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