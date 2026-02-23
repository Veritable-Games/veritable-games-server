#!/usr/bin/env node
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/content.db');
const db = new Database(DB_PATH);

// Get schema
const schema = db
  .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'")
  .get();
console.log('Projects table schema:');
console.log(schema.sql);
console.log('\nSample data:');
const projects = db.prepare('SELECT * FROM projects LIMIT 3').all();
console.log(JSON.stringify(projects, null, 2));

db.close();
