#!/usr/bin/env node
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/content.db');
const db = new Database(DB_PATH);

// Check for autumn with different cases
const checks = ['autumn', 'Autumn', 'AUTUMN'];
checks.forEach(slug => {
  const project = db.prepare('SELECT id, title, slug FROM projects WHERE slug = ?').get(slug);
  console.log(`slug='${slug}':`, project || 'NOT FOUND');
});

// Check what the actual slug value is
const autumn = db.prepare("SELECT id, title, slug FROM projects WHERE title LIKE '%autumn%'").get();
console.log('\nActual AUTUMN project:', autumn);

db.close();
