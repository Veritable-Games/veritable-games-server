-- Schema export from users.db
-- Generated: 2025-10-28T19:14:12.591Z
-- SQLite version: 0

CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE INDEX idx_sessions_token ON sessions(token);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);

CREATE INDEX idx_unified_activity_entity ON unified_activity(entity_type, entity_id);

CREATE INDEX idx_unified_activity_entity_type_timestamp ON unified_activity (entity_type, entity_id, timestamp DESC);

CREATE INDEX idx_unified_activity_recent ON unified_activity(timestamp DESC, activity_type, entity_type);

CREATE INDEX idx_unified_activity_timestamp ON unified_activity(timestamp DESC);

CREATE INDEX idx_unified_activity_type ON unified_activity(activity_type);

CREATE INDEX idx_unified_activity_user ON unified_activity(user_id);

CREATE INDEX idx_unified_activity_user_type_time ON unified_activity(user_id, activity_type, timestamp DESC);

CREATE INDEX idx_unified_activity_user_type_timestamp ON unified_activity (user_id, activity_type, timestamp DESC);

CREATE INDEX idx_user_activities_created ON user_activities(created_at);

CREATE INDEX idx_user_activities_user ON user_activities(user_id);

CREATE INDEX idx_user_activity_cache_updated ON user_activity_summary_cache(cache_updated_at);

CREATE INDEX idx_user_favorites_user ON user_favorites(user_id);

CREATE INDEX idx_user_permissions_entity ON user_permissions(entity_type, entity_id);

CREATE INDEX idx_user_permissions_type ON user_permissions(permission_type);

CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);

CREATE INDEX idx_user_privacy_user ON user_privacy_settings(user_id);

CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);

CREATE INDEX idx_user_sessions_user_expires ON user_sessions(user_id, expires_at);

CREATE INDEX idx_users_active ON users(is_active);

CREATE INDEX idx_users_active_lookup ON users(username, email, is_active);

CREATE INDEX idx_users_discord ON users(discord_username);

CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_users_email_lower ON users (email);

CREATE INDEX idx_users_follower_count ON users(follower_count DESC);

CREATE INDEX idx_users_github ON users(github_url);

CREATE INDEX idx_users_last_seen ON users(last_seen DESC);

CREATE INDEX idx_users_role ON users(role);

CREATE INDEX idx_users_username ON users(username);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

CREATE TABLE sqlite_sequence(name,seq);

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

CREATE TABLE user_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    activity_type TEXT NOT NULL,
    activity_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_public BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

CREATE TABLE user_activity_summary_cache (
            user_id INTEGER PRIMARY KEY,
            total_topics INTEGER DEFAULT 0,
            total_replies INTEGER DEFAULT 0,
            last_activity_at TEXT,
            cache_updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          );

CREATE TABLE user_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, item_type, item_id)
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

CREATE TABLE user_profiles (
    user_id INTEGER PRIMARY KEY,
    headline TEXT,
    interests TEXT,
    skills TEXT,
    languages TEXT,
    timezone TEXT,
    theme_preference TEXT DEFAULT 'auto',
    notification_preferences TEXT,
    profile_views INTEGER DEFAULT 0,
    last_profile_update DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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