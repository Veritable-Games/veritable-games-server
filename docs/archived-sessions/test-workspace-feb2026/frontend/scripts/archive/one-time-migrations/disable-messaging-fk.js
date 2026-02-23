#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const messagingDbPath = path.join(__dirname, '..', 'data', 'messaging.db');
const db = new Database(messagingDbPath);

console.log('Current foreign key setting:', db.pragma('foreign_keys'));
console.log('Disabling foreign keys...');

// Disable foreign keys
db.pragma('foreign_keys = OFF');

console.log('New foreign key setting:', db.pragma('foreign_keys'));

// Test if we can still perform operations
try {
  const conversations = db.prepare('SELECT COUNT(*) as count FROM conversations').get();
  console.log('Conversations:', conversations.count);
  console.log('✅ Database operations work with foreign keys disabled');
} catch (error) {
  console.log('❌ Error:', error.message);
}

db.close();
console.log('Database closed');
