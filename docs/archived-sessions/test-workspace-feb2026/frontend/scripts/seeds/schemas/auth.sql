-- Schema export from auth.db
-- Generated: 2025-10-28T19:14:12.577Z
-- SQLite version: 0

CREATE INDEX idx_invitations_active ON invitations(token, is_revoked, expires_at)
  WHERE is_revoked = 0 AND used_at IS NULL;

CREATE INDEX idx_invitations_created_by ON invitations(created_by);

CREATE INDEX idx_invitations_email ON invitations(email);

CREATE INDEX idx_invitations_expires_at ON invitations(expires_at);

CREATE INDEX idx_invitations_is_revoked ON invitations(is_revoked);

CREATE INDEX idx_invitations_token ON invitations(token);

CREATE INDEX idx_invitations_used_at ON invitations(used_at);

CREATE INDEX idx_unified_activity_user
        ON unified_activity(user_id, created_at DESC)
      ;

CREATE INDEX idx_user_privacy_user ON user_privacy_settings(user_id);

CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);

CREATE INDEX idx_user_sessions_user_expires ON user_sessions(user_id, expires_at);

CREATE INDEX idx_users_active ON users(is_active);

CREATE INDEX idx_users_active_lookup ON users(username, email, is_active);

CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_users_email_lower ON users (email);

CREATE INDEX idx_users_follower_count ON users(follower_count DESC);

CREATE INDEX idx_users_last_seen ON users(last_seen DESC);

CREATE INDEX idx_users_role ON users(role);

CREATE INDEX idx_users_username ON users(username);

CREATE TABLE invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Invitation token (unique, secure)
  token TEXT NOT NULL UNIQUE,

  -- Who created this invitation
  created_by INTEGER NOT NULL,

  -- Optional: Email this invitation is for (if specified, only this email can use it)
  email TEXT,

  -- Invitation metadata
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL, -- Invitations expire after a set time

  -- Usage tracking
  used_at DATETIME, -- NULL if not yet used
  used_by INTEGER, -- User ID who used this invitation (NULL if not used)

  -- Status tracking
  is_revoked INTEGER NOT NULL DEFAULT 0, -- 0 = active, 1 = revoked by admin
  revoked_at DATETIME,
  revoked_by INTEGER,

  -- Optional metadata
  notes TEXT, -- Admin notes about this invitation
  max_uses INTEGER NOT NULL DEFAULT 1, -- How many times can this token be used (usually 1)
  use_count INTEGER NOT NULL DEFAULT 0, -- How many times has it been used

  -- Foreign keys
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    last_accessed INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

CREATE TABLE sqlite_sequence(name,seq);

CREATE TABLE sqlite_stat1(tbl,idx,stat);

CREATE TABLE sqlite_stat4(tbl,idx,neq,nlt,ndlt,sample);

CREATE TABLE unified_activity (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          activity_type TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          action TEXT NOT NULL,
          metadata TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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