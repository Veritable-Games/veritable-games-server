-- Schema export from messaging.db
-- Generated: 2025-10-28T19:14:12.596Z
-- SQLite version: 0

CREATE INDEX idx_messages_conversation ON messages(conversation_id);

CREATE INDEX idx_messages_created ON messages(created_at);

CREATE INDEX idx_messages_sender ON messages(sender_id);

CREATE INDEX idx_participants_conversation ON conversation_participants(conversation_id);

CREATE INDEX idx_participants_user ON conversation_participants(user_id);

CREATE TABLE conversation_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      UNIQUE(conversation_id, user_id)
    );

CREATE TABLE conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_archived BOOLEAN DEFAULT FALSE
    );

CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      message_type TEXT DEFAULT 'text',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      edited_at TIMESTAMP,
      is_deleted BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

CREATE TABLE sqlite_sequence(name,seq);